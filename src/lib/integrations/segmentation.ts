// SMART SEGMENTATION - the engine's reads and writes, in the hub.
//
// Ported from the Compass connector's segmentation_load.py (05.10.2026); the rules
// are in ../segmentation/engine.ts and were checked against the connector on live
// companies. What it does, as the connector did:
//   run_new   - companies with an EMPTY sales_priority get one (the page's button)
//   sweep     - the whole portfolio, upgrade-only, max_* facts refreshed (nightly)
//   potential - machine-written or empty yearly potentials recomputed, raise-only
//   watcher   - every two minutes: new companies seeded, reps' potential edits followed
//   web       - company websites read once per 30 days for description, size, address
//   yearly    - January, by hand after a preview: every APSO segment decided again
//               (the May 2026 waterfall), the priority set to the formula up OR down
// Writes go out with the hub's own HubSpot app (the tickets app has no company
// write scope). Its app id is learned from the first value it writes, so the
// potential rules recognise the hub's own writes as a machine's, not a person's.
// One engine action at a time across both copies of the hub (advisory lock).

import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { connectorGet } from "@/lib/erosion/run";
import { ownerNames } from "./erosion";
import { hubspotFetchJson } from "./hubspot";
import { IntegrationError } from "./status";
import {
  OWN_MACHINE_APPS, READ_PROPS_BASE, WEB_PROPS, compute, enrich, initialPotential, isOwnMachine, labelVisits, markMass, potentialEdits, potentialSetter,
  pyStr, recalcDecision, revProps, unlost, webUpdates,
  type Enums, type HistoryEntry, type PotentialEdit, type Props, type Visit,
} from "../segmentation/engine";
import { reclassify, yearlyReadProps } from "../segmentation/yearly";

const LOCK = 4_107_204;
const KV = {
  state: "segmentation:state", ownApp: "segmentation:own-app-id", run: "segmentation:run", edits: "segmentation:potential-edits",
  yearlyPlan: "segmentation:yearly-plan", yearlyApplied: "segmentation:yearly-applied", yearlySummary: "segmentation:yearly-summary",
} as const;
const STALE_MS = 3 * 60 * 60_000;

const curYear = () => new Date().getUTCFullYear();
const utcToday = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString().slice(0, 19) + "Z";
const REV = () => revProps(curYear());
const READ_PROPS = () => [...READ_PROPS_BASE, ...REV()];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ── state ─────────────────────────────────────────────────────────────── */

/** The connector's segmentation_state.json, keys and all, held in the hub's kv. */
export type SegState = {
  web_new_enabled?: boolean;
  /** company id -> the day its website was last tried (one attempt per 30 days). */
  web_attempts?: Record<string, string>;
  last_run_new?: unknown;
  last_sweep?: unknown;
  last_potential?: unknown;
  last_web?: unknown;
  last_yearly?: unknown;
  /** The calendar year the yearly reclassification last really ran for. */
  yearly_done?: number;
  watcher_last?: unknown;
  nightly_day?: string;
  imported_at?: string;
};

export async function loadState(): Promise<SegState> {
  return (await kvGet<SegState>(KV.state)) ?? {};
}

async function patchState(p: Partial<SegState>) {
  await kvSet(KV.state, { ...(await loadState()), ...p });
}

/** Take over the connector's state once: the 30-day website memory and the new-company switch. */
export async function importConnectorState(): Promise<{ attempts: number }> {
  const st = await connectorGet<SegState & { error?: string }>("/segmentation/state");
  if (st.error) throw new IntegrationError(`The connector's segmentation state: ${st.error}`);
  const mine = await loadState();
  await kvSet(KV.state, {
    ...st,
    // whatever the hub has done itself since wins over the import
    ...Object.fromEntries(Object.entries(mine).filter(([, v]) => v !== undefined)),
    web_attempts: { ...(st.web_attempts ?? {}), ...(mine.web_attempts ?? {}) },
    imported_at: new Date().toISOString(),
  });
  return { attempts: Object.keys(st.web_attempts ?? {}).length };
}

/* ── whose writes are ours ─────────────────────────────────────────────── */

async function ownApps(): Promise<Set<string>> {
  const learned = await kvGet<{ appId: string }>(KV.ownApp);
  const env = (process.env.HUBSPOT_OWN_APP_ID ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return new Set([...OWN_MACHINE_APPS, ...env, ...(learned?.appId ? [learned.appId] : [])]);
}

/** Read back the history of a value just written: its INTEGRATION source is the hub's own app. */
async function learnOwnApp(companyId: string, prop: string): Promise<void> {
  if (await kvGet(KV.ownApp)) return;
  try {
    const r = await hubspotFetchJson<{ propertiesWithHistory?: Record<string, HistoryEntry[]> }>({
      path: `/crm/v3/objects/companies/${companyId}?properties=${prop}&propertiesWithHistory=${prop}`,
    });
    const e = r.propertiesWithHistory?.[prop]?.[0];
    const fresh = e?.timestamp && Date.now() - Date.parse(e.timestamp) < 15 * 60_000;
    if (e?.sourceType === "INTEGRATION" && e.sourceId && fresh) {
      await kvSet(KV.ownApp, { appId: String(e.sourceId), learnedAt: new Date().toISOString(), from: `${companyId}.${prop}` });
      console.log(`[segmentation] the hub writes as HubSpot app ${e.sourceId} - counted as our own machine from now on`);
    }
  } catch (err) {
    console.warn(`[segmentation] could not learn the hub's app id: ${(err as Error).message}`);
  }
}

/* ── HubSpot ───────────────────────────────────────────────────────────── */

let enumsCache: { at: number; en: Enums } | null = null;

/** The portal's option values (never hard-coded: the euro sign's encoding), an hour at a time. */
export async function enums(): Promise<Enums> {
  if (enumsCache && Date.now() - enumsCache.at < 60 * 60_000) return enumsCache.en;
  type Def = { type?: string; options?: { value: string }[] };
  const get = (p: string) => hubspotFetchJson<Def>({ path: `/crm/v3/properties/companies/${p}` });
  const [prio, rb, apic, ind] = await Promise.all([get("sales_priority"), get("max_revenue_bucket"), get("apic_ap"), get("industry")]);
  let kw: Def | null = null;
  try {
    kw = await get("hs_keywords");
  } catch {
    kw = null;
  }
  const first = (opts: { value: string }[] | undefined) => Object.fromEntries((opts ?? []).map((o) => [o.value[0], o.value]));
  const apicMap: Record<string, string> = {};
  for (const o of apic.options ?? []) {
    const code = o.value.split(" ")[0];
    if (!(code in apicMap)) apicMap[code] = o.value;
  }
  const en: Enums = {
    prio: first(prio.options), revbucket: first(rb.options), apic: apicMap,
    industry: new Set((ind.options ?? []).map((o) => o.value)),
    kwType: kw?.type ?? null, kwOpts: new Set((kw?.options ?? []).map((o) => o.value)),
  };
  enumsCache = { at: Date.now(), en };
  return en;
}

type Obj = { id: string; properties?: Props; propertiesWithHistory?: Record<string, HistoryEntry[]> };

async function searchTotal(filters: object[] | null): Promise<number> {
  const r = await hubspotFetchJson<{ total?: number }>({
    path: "/crm/v3/objects/companies/search", method: "POST",
    body: { filterGroups: filters ? [{ filters }] : [], limit: 1, properties: ["name"] },
  });
  return r.total ?? -1;
}

/** Search ids page by page (HubSpot stops a search at 10,000 - every caller stays well under). */
async function searchIds(filters: object[], opts: { sorts?: unknown[]; cap?: number } = {}): Promise<string[]> {
  const ids: string[] = [];
  let after: string | undefined;
  for (;;) {
    const r = await hubspotFetchJson<{ results?: Obj[]; paging?: { next?: { after?: string } } }>({
      path: "/crm/v3/objects/companies/search", method: "POST",
      body: { filterGroups: [{ filters }], limit: 200, properties: ["name"], ...(opts.sorts ? { sorts: opts.sorts } : {}), ...(after ? { after } : {}) },
    });
    ids.push(...(r.results ?? []).map((x) => x.id));
    after = r.paging?.next?.after;
    if (!after || ids.length >= (opts.cap ?? 9800)) break;
  }
  return ids;
}

async function batchRead(ids: string[], properties: string[]): Promise<Map<string, Props>> {
  const out = new Map<string, Props>();
  for (let i = 0; i < ids.length; i += 100) {
    const r = await hubspotFetchJson<{ results?: Obj[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST",
      body: { properties, inputs: ids.slice(i, i + 100).map((id) => ({ id })) },
    });
    for (const x of r.results ?? []) out.set(x.id, x.properties ?? {});
  }
  return out;
}

/** Changed-only writes, 100 at a time; the first failing batch stops the run and is logged. */
async function batchUpdate(changes: [string, Props][], log: string[]): Promise<number> {
  let wrote = 0;
  for (let i = 0; i < changes.length; i += 100) {
    const chunk = changes.slice(i, i + 100);
    try {
      await hubspotFetchJson({
        path: "/crm/v3/objects/companies/batch/update", method: "POST",
        body: { inputs: chunk.map(([id, properties]) => ({ id, properties })) },
      });
    } catch (e) {
      log.push(`write error @${i}: ${(e as Error).message.slice(0, 200)}`);
      break;
    }
    wrote += chunk.length;
    if (i === 0) {
      // the first company written tells us which app the hub writes as
      const [id, props] = chunk[0];
      const prop = ["yearly_customer_potential", "sales_priority", "max_pot_or_turnover", "max_revenue_2015_2026", "apic_ap", "description"].find((k) => k in props);
      if (prop) await learnOwnApp(id, prop);
    }
  }
  return wrote;
}

/** Every company, page by page through the list API (no search cap). */
async function* allCompanies(properties: string[], opts: { withHistory?: string; limit?: number } = {}): AsyncGenerator<Obj[]> {
  let after: string | undefined;
  const limit = opts.limit ?? 100;
  for (;;) {
    const qs = `limit=${limit}&archived=false&properties=${properties.join(",")}${opts.withHistory ? `&propertiesWithHistory=${opts.withHistory}` : ""}${after ? `&after=${after}` : ""}`;
    const r = await hubspotFetchJson<{ results?: Obj[]; paging?: { next?: { after?: string } } }>({ path: `/crm/v3/objects/companies?${qs}` });
    yield r.results ?? [];
    after = r.paging?.next?.after;
    if (!after) return;
  }
}

/* ── one action at a time ─────────────────────────────────────────────── */

export type RunInfo = { what: string; started: string; heartbeat: string; by: string } | null;

export async function currentRun(): Promise<RunInfo> {
  const r = await kvGet<RunInfo>(KV.run);
  if (!r || Date.now() - Date.parse(r.heartbeat) > STALE_MS) return null;
  return r;
}

/** Run under the engine lock; null when another action (here or on the other copy) holds it. */
async function exclusive<T>(what: string, by: string, fn: (beat: () => Promise<void>) => Promise<T>): Promise<T | null> {
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    const started = new Date().toISOString();
    const beat = () => kvSet(KV.run, { what, started, heartbeat: new Date().toISOString(), by });
    try {
      await beat();
      return await fn(beat);
    } finally {
      await kvSet(KV.run, null).catch(() => {});
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

/* ── status and breakdown ─────────────────────────────────────────────── */

export async function status() {
  const en = await enums();
  const total = await searchTotal(null);
  const counts: Record<string, number> = {};
  for (const [pfx, val] of Object.entries(en.prio).sort()) {
    counts[`prio_${pfx}`] = await searchTotal([{ propertyName: "sales_priority", operator: "EQ", value: val }]);
  }
  const empty = await searchTotal([{ propertyName: "sales_priority", operator: "NOT_HAS_PROPERTY" }]);
  const noprio = (counts.prio_4 ?? 0) + Math.max(empty, 0);
  const st = await loadState();
  const own = await kvGet<{ appId: string }>(KV.ownApp);
  return {
    total, empty, ...counts,
    no_prio_share_pct: total ? Math.round((1000 * noprio) / total) / 10 : null,
    web_new_enabled: st.web_new_enabled !== false,
    web_candidates: await searchTotal([
      { propertyName: "domain", operator: "HAS_PROPERTY" },
      { propertyName: "description", operator: "NOT_HAS_PROPERTY" },
    ]),
    last_run_new: st.last_run_new ?? null, last_sweep: st.last_sweep ?? null, last_potential: st.last_potential ?? null,
    last_web: st.last_web ?? null, watcher_last: st.watcher_last ?? null,
    last_yearly: st.last_yearly ?? null, yearly_done: st.yearly_done ?? null, year: curYear(),
    yearly_summary: (await kvGet<Omit<YearlyPlan, "rows"> & { rowCount: number }>(KV.yearlySummary)) ?? null,
    running: await currentRun(),
    engine: process.env.SEGMENTATION_ENGINE === "live" ? "hub" : "connector",
    state_imported: st.imported_at ?? null,
    own_app: own?.appId ?? null,
  };
}

export async function breakdown() {
  type Def = { options?: { value: string }[] };
  const def = await hubspotFetchJson<Def>({ path: "/crm/v3/properties/companies/apso_customer" });
  let opts = (def.options ?? []).map((o) => o.value);
  if (!opts.length) opts = ["APSOcore", "APSOgrowth", "APSOprospect", "APSOmicro", "No sales focus", "Growth Engine Customer"];
  const total = await searchTotal(null);
  const withSeg = await searchTotal([{ propertyName: "apso_customer", operator: "HAS_PROPERTY" }]);
  const byValue: Record<string, number> = {};
  for (const v of opts) {
    const t = await searchTotal([{ propertyName: "apso_customer", operator: "EQ", value: v }]);
    if (t > 0) byValue[v] = t;
  }
  const lostBought = await searchTotal([
    { propertyName: "apso_customer", operator: "EQ", value: "APSOlost" },
    { propertyName: `revenue_${curYear()}`, operator: "GT", value: "0" },
  ]);
  // the few without an APSO segment, by name - the engine never fills it, a person has to
  const missing = await hubspotFetchJson<{ results?: Obj[] }>({
    path: "/crm/v3/objects/companies/search", method: "POST",
    body: { filterGroups: [{ filters: [{ propertyName: "apso_customer", operator: "NOT_HAS_PROPERTY" }] }], limit: 10, properties: ["name"] },
  });
  return {
    total, with_apso_customer: withSeg, empty: total - withSeg,
    by_value: Object.fromEntries(Object.entries(byValue).sort((a, b) => b[1] - a[1])),
    other: withSeg - Object.values(byValue).reduce((a, b) => a + b, 0),
    lost_with_current_revenue: lostBought,
    without_segment: (missing.results ?? []).map((c) => ({ id: c.id, name: c.properties?.name ?? c.id })),
  };
}

/* ── the actions ───────────────────────────────────────────────────────── */

/** Segment ONLY companies with an EMPTY sales_priority. */
async function runNewInner(dry: boolean) {
  const en = await enums();
  const rev = REV();
  const log: string[] = [];
  const ids = await searchIds([{ propertyName: "sales_priority", operator: "NOT_HAS_PROPERTY" }], { sorts: ["createdate"] });
  if (!ids.length) return { scanned: 0, written: 0, note: "no unsegmented companies", dry };
  const props = await batchRead(ids, READ_PROPS());
  const changes: [string, Props][] = [];
  const dist: Record<string, number> = {};
  let clamps = 0, enriched = 0;
  for (const [cid, p] of props) {
    const c = compute(p, en, rev);
    clamps += c.clamped ? 1 : 0;
    const upd = { ...c.upd };
    const e = enrich(p, en);
    if (Object.keys(e).length) { Object.assign(upd, e); enriched += 1; }
    upd.sales_priority = en.prio[c.prefix];
    dist[`P${c.prefix}`] = (dist[`P${c.prefix}`] ?? 0) + 1;
    changes.push([cid, upd]);
  }
  const written = dry ? 0 : await batchUpdate(changes, log);
  await patchState({ last_run_new: { at: nowIso(), scanned: ids.length, written, dist, dry } });
  return { scanned: ids.length, written, assigned: dist, enriched, garbage_potentials_clamped: clamps, dry, log };
}

/** What the sweep would write, company by company - reads only. */
export async function planSweep(beat: () => Promise<void> = async () => {}, maxPages = 0) {
  const en = await enums();
  const rev = REV();
  const year = curYear();
  const log: string[] = [];
  const changes: [string, Props][] = [];
  const stats: Record<string, number> = { fill_empty: 0, upgrade: 0, facts_only: 0, clamped: 0, enriched: 0 };
  let scanned = 0, pages = 0;
  for await (const page of allCompanies(READ_PROPS())) {
    for (const res of page) {
      scanned += 1;
      const p = res.properties ?? {};
      const c = compute(p, en, rev);
      stats.clamped += c.clamped ? 1 : 0;
      const upd: Props = { ...c.upd };
      const e = enrich(p, en);
      if (Object.keys(e).length) { Object.assign(upd, e); stats.enriched += 1; }
      const u = unlost(p, year);
      if (Object.keys(u).length) { Object.assign(upd, u); stats.unlost = (stats.unlost ?? 0) + 1; }
      const cur = p.sales_priority ?? "";
      if (!cur) { upd.sales_priority = en.prio[c.prefix]; stats.fill_empty += 1; }
      else if (c.prefix < cur[0]) { upd.sales_priority = en.prio[c.prefix]; stats.upgrade += 1; }
      else if (Object.keys(upd).length) stats.facts_only += 1;
      if (Object.keys(upd).length) changes.push([res.id, upd]);
    }
    pages += 1;
    if (pages % 50 === 0) await beat();
    if (maxPages && pages >= maxPages) break;
  }
  return { scanned, changes, stats, log };
}

/** The whole portfolio, upgrade-only: fills EMPTY, upgrades stale buckets, refreshes max_* facts. */
async function sweepInner(dry: boolean, beat: () => Promise<void>, maxPages = 0) {
  const { scanned, changes, stats, log } = await planSweep(beat, maxPages);
  const written = dry ? 0 : await batchUpdate(changes, log);
  await patchState({ last_sweep: { at: nowIso(), scanned, changes: changes.length, written, stats, dry } });
  return { scanned, planned_changes: changes.length, written, stats, dry, log };
}

/** Recompute yearly potentials written by our own machines or empty - raise-only, a person's number never touched. */
async function potentialInner(dry: boolean, beat: () => Promise<void>, maxPages = 0) {
  const rev = REV();
  const own = await ownApps();
  const changes: [string, Props][] = [];
  const stats: Record<string, number> = { manual_kept: 0, machine_recalc: 0, filled: 0, unchanged: 0, no_revenue: 0, kept_higher: 0, human_restored: 0 };
  // the same pass measures the sales side: every person's edit, and who set each potential now
  const edits: PotentialEdit[] = [];
  const setters = { person: 0, machine: 0, empty: 0 };
  let scanned = 0, pages = 0;
  // the list API caps a page at 50 when it carries history
  for await (const page of allCompanies(["name", "yearly_customer_potential", "apic_ap", "apso_customer", ...rev], { withHistory: "yearly_customer_potential", limit: 50 })) {
    for (const res of page) {
      scanned += 1;
      const p = res.properties ?? {};
      const hist = res.propertiesWithHistory?.yearly_customer_potential ?? [];
      const d = recalcDecision(p, hist, rev, own);
      stats[d.kind] += 1;
      if ("value" in d) changes.push([res.id, { yearly_customer_potential: pyStr(d.value) }]);
      edits.push(...potentialEdits(res.id, p, hist, rev, own));
      setters[potentialSetter(p, hist, own)] += 1;
    }
    pages += 1;
    if (pages % 50 === 0) await beat();
    if (maxPages && pages >= maxPages) break;
  }
  const log: string[] = [];
  const written = dry ? 0 : await batchUpdate(changes, log);
  const res = { at: nowIso(), scanned, planned: changes.length, written, stats, dry };
  await patchState({ last_potential: res });
  await saveEdits({ scannedAt: res.at, scanned, setters }, edits, true);
  return { ...res, log };
}

/* ── the yearly reclassification (January) ────────────────────────────── */

export type YearlyRow = {
  id: string; name: string; rule: string; reason: string;
  segFrom: string; segTo: string; prioFrom: string; prioTo: string;
  apicFrom: string; apicTo: string; indFrom: string; indTo: string;
};

export type YearlyPlan = {
  at: string; dry: boolean; year: number; scanned: number; changes: number; written: number;
  stats: Record<string, number>;
  /** "APSOprospect → APSOcore": companies. */
  transitions: Record<string, number>;
  before: Record<string, number>;
  after: Record<string, number>;
  byRule: Record<string, number>;
  rows: YearlyRow[];
};

/** The portal's company property names - the yearly run reads only those that exist. */
async function companyPropNames(): Promise<Set<string>> {
  const r = await hubspotFetchJson<{ results?: { name: string }[] }>({ path: "/crm/v3/properties/companies?archived=false" });
  return new Set((r.results ?? []).map((x) => x.name));
}

/** Which of these companies have any ticket (the tickets app reads associations). Null = could not read. */
async function withTickets(ids: string[]): Promise<Set<string> | null> {
  try {
    const r = await hubspotFetchJson<{ results?: { from?: { id?: string | number }; to?: unknown[] }[] }>({
      path: "/crm/v4/associations/companies/tickets/batch/read", method: "POST", useTicketsToken: true,
      body: { inputs: ids.map((id) => ({ id })) },
    });
    return new Set((r.results ?? []).filter((x) => (x.to ?? []).length > 0).map((x) => String(x.from?.id)));
  } catch {
    return null;
  }
}

/**
 * The January run: every company's APSO segment decided again from scratch (the May
 * waterfall), APIC and industry made to agree, and the priority set exactly to the
 * formula - up OR down. ERP segments and the potential are never written.
 */
async function yearlyInner(dry: boolean, beat: () => Promise<void>, maxPages = 0) {
  const en = await enums();
  const rev = REV();
  const year = curYear();
  const now = Date.now();
  const names = await companyPropNames();
  const segDef = await hubspotFetchJson<{ options?: { value: string }[] }>({ path: "/crm/v3/properties/companies/apso_customer" });
  const segOptions = new Set((segDef.options ?? []).map((o) => o.value));
  const props = [...new Set([...READ_PROPS(), ...yearlyReadProps(names, year)])];
  const stats: Record<string, number> = {
    segment_changed: 0, prio_up: 0, prio_down: 0, prio_filled: 0, apic_corrected: 0, apic_set: 0, apic_cleared: 0,
    industry_filled: 0, industry_corrected: 0, facts_only: 0, erp_left_alone: 0, segment_not_in_portal: 0, tickets_unread: 0,
  };
  const transitions: Record<string, number> = {};
  const before: Record<string, number> = {};
  const after: Record<string, number> = {};
  const byRule: Record<string, number> = {};
  const rows: YearlyRow[] = [];
  const changes: [string, Props][] = [];
  const prioName = (v: string) => (v ? `P${v[0]}`.replace("P4", "No priority") : "-");
  let scanned = 0, pages = 0;
  for await (const page of allCompanies(props)) {
    const tickets = await withTickets(page.map((x) => x.id));
    if (!tickets) stats.tickets_unread += page.length;
    for (const res of page) {
      scanned += 1;
      const p = res.properties ?? {};
      const r = reclassify(p, en, { year, now, tickets: tickets?.has(res.id) ? 1 : 0 });
      byRule[r.rule] = (byRule[r.rule] ?? 0) + 1;
      const segFrom = (p.apso_customer ?? "").trim();
      before[segFrom || "(empty)"] = (before[segFrom || "(empty)"] ?? 0) + 1;
      const upd: Props = {};
      let segTo = segFrom;
      if (r.segment === null) stats.erp_left_alone += 1;
      else if (r.segment !== segFrom) {
        if (segOptions.has(r.segment)) {
          upd.apso_customer = r.segment;
          segTo = r.segment;
          stats.segment_changed += 1;
          const t = `${segFrom || "(empty)"} → ${r.segment}`;
          transitions[t] = (transitions[t] ?? 0) + 1;
        } else stats.segment_not_in_portal += 1;
      }
      after[segTo || "(empty)"] = (after[segTo || "(empty)"] ?? 0) + 1;
      const apicFrom = (p.apic_ap ?? "").trim();
      if (r.apic !== undefined && r.apic !== apicFrom) {
        upd.apic_ap = r.apic;
        stats[r.apic === "" ? "apic_cleared" : apicFrom ? "apic_corrected" : "apic_set"] += 1;
      }
      const indFrom = (p.industry ?? "").trim();
      if (r.industry !== undefined && r.industry !== indFrom) {
        upd.industry = r.industry;
        stats[indFrom ? "industry_corrected" : "industry_filled"] += 1;
      }
      // the priority, exactly to the formula - from the potential as it stands
      const c = compute(p, en, rev);
      const cur = p.sales_priority ?? "";
      const prioTo = en.prio[c.prefix];
      if (prioTo && (!cur || c.prefix !== cur[0])) {
        upd.sales_priority = prioTo;
        stats[!cur ? "prio_filled" : c.prefix < cur[0] ? "prio_up" : "prio_down"] += 1;
      }
      const decided = Object.keys(upd).length > 0;
      Object.assign(upd, c.upd);
      if (!decided && Object.keys(upd).length) stats.facts_only += 1;
      if (Object.keys(upd).length) changes.push([res.id, upd]);
      if (decided) {
        rows.push({
          id: res.id, name: p.name ?? "", rule: r.rule, reason: r.reason,
          segFrom, segTo, prioFrom: prioName(cur), prioTo: prioName(upd.sales_priority ?? cur),
          apicFrom, apicTo: upd.apic_ap ?? apicFrom, indFrom, indTo: upd.industry ?? indFrom,
        });
      }
    }
    pages += 1;
    if (pages % 50 === 0) await beat();
    if (maxPages && pages >= maxPages) break;
  }
  const log: string[] = [];
  const written = dry ? 0 : await batchUpdate(changes, log);
  const plan: YearlyPlan = { at: nowIso(), dry, year, scanned, changes: changes.length, written, stats, transitions, before, after, byRule, rows };
  await kvSet(dry ? KV.yearlyPlan : KV.yearlyApplied, plan);
  // the page shows the moves without loading every row
  await kvSet(KV.yearlySummary, { ...plan, rows: undefined, rowCount: rows.length });
  await patchState({
    last_yearly: { at: plan.at, scanned, changes: changes.length, written, stats, dry, year },
    ...(dry ? {} : { yearly_done: year }),
  });
  return { scanned, planned_changes: changes.length, written, stats, dry, log };
}

/** The last preview, or the last real run - for the page and the Excel. */
export async function yearlyPlan(which: "preview" | "applied"): Promise<YearlyPlan | null> {
  return (await kvGet<YearlyPlan>(which === "preview" ? KV.yearlyPlan : KV.yearlyApplied)) ?? null;
}

/* ── the sales side of the potential ──────────────────────────────────── */

export type EditsDoc = {
  /** The last full history scan (the nightly recalculation, or its preview). */
  scannedAt: string | null;
  scanned: number;
  /** Who set the potential each company carries now. */
  setters: { person: number; machine: number; empty: number };
  updated: string;
  edits: PotentialEdit[];
};

const editKey = (e: PotentialEdit) => `${e.companyId}|${e.at}`;

/** Store the edits: a full scan replaces the list, the watcher's finds are merged in. */
async function saveEdits(meta: { scannedAt: string; scanned: number; setters: EditsDoc["setters"] } | null, found: PotentialEdit[], full: boolean) {
  const cur = await kvGet<EditsDoc>(KV.edits);
  const map = new Map<string, PotentialEdit>();
  if (!full) for (const e of cur?.edits ?? []) map.set(editKey(e), e);
  for (const e of found) map.set(editKey(e), e);
  const edits = [...map.values()].sort((a, b) => b.at.localeCompare(a.at));
  await kvSet(KV.edits, {
    scannedAt: meta?.scannedAt ?? cur?.scannedAt ?? null,
    scanned: meta?.scanned ?? cur?.scanned ?? 0,
    setters: meta?.setters ?? cur?.setters ?? { person: 0, machine: 0, empty: 0 },
    updated: new Date().toISOString(),
    edits,
  } satisfies EditsDoc);
}

let usersCache: { at: number; map: Map<string, string> } | null = null;

/** HubSpot user id -> name, active and archived owners, paged to the end. */
async function userNames(): Promise<Map<string, string>> {
  if (usersCache && Date.now() - usersCache.at < 60 * 60_000) return usersCache.map;
  const map = new Map<string, string>();
  for (const archived of [false, true]) {
    let after: string | undefined;
    for (let page = 0; page < 50; page++) {
      const r = await hubspotFetchJson<{ results?: { userId?: number; firstName?: string; lastName?: string; email?: string }[]; paging?: { next?: { after?: string } } }>({
        path: `/crm/v3/owners?limit=100&archived=${archived}${after ? `&after=${after}` : ""}`,
      });
      for (const o of r.results ?? []) {
        if (o.userId === undefined) continue;
        const name = `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim() || o.email || String(o.userId);
        if (!map.has(String(o.userId))) map.set(String(o.userId), name);
      }
      after = r.paging?.next?.after;
      if (!after) break;
    }
  }
  usersCache = { at: Date.now(), map };
  return map;
}

const VISIT_OBJ = "2-139767037";
let visitsCache: { at: number; map: Map<string, Visit[]> } | null = null;

/** Every customer visit by company - to tell a visit report's write from another workflow's. */
async function visitsByCompany(): Promise<Map<string, Visit[]>> {
  if (visitsCache && Date.now() - visitsCache.at < 30 * 60_000) return visitsCache.map;
  const visits = new Map<string, Visit>();
  let after: string | undefined;
  for (let page = 0; page < 500; page++) {
    const r = await hubspotFetchJson<{ results?: { id: string; properties?: Record<string, string | null> }[]; paging?: { next?: { after?: string } } }>({
      path: `/crm/v3/objects/${VISIT_OBJ}?limit=100&properties=hs_createdate,hs_lastmodifieddate,hubspot_owner_id${after ? `&after=${after}` : ""}`,
      useTicketsToken: true,
    });
    for (const v of r.results ?? []) {
      const p = v.properties ?? {};
      visits.set(v.id, { id: v.id, created: p.hs_createdate ?? "", modified: p.hs_lastmodifieddate ?? "", ownerId: p.hubspot_owner_id ?? null });
    }
    after = r.paging?.next?.after;
    if (!after) break;
  }
  const map = new Map<string, Visit[]>();
  const ids = [...visits.keys()];
  for (let i = 0; i < ids.length; i += 100) {
    const r = await hubspotFetchJson<{ results?: { from?: { id?: string }; to?: { toObjectId?: number | string }[] }[] }>({
      path: `/crm/v4/associations/${VISIT_OBJ}/companies/batch/read`, method: "POST", useTicketsToken: true,
      body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })) },
    });
    for (const row of r.results ?? []) {
      const v = row.from?.id ? visits.get(String(row.from.id)) : undefined;
      if (!v) continue;
      for (const t of row.to ?? []) {
        const k = String(t.toObjectId);
        map.set(k, [...(map.get(k) ?? []), v]);
      }
    }
  }
  visitsCache = { at: Date.now(), map };
  return map;
}

/**
 * The measure for the page: every edit - visit reports told from other workflows,
 * mass updates marked - and the names of the people (HubSpot users by user id,
 * visit owners by owner id).
 */
export async function potentialEditsData(): Promise<EditsDoc & { people: Record<string, string>; owners: Record<string, string>; visitsMatched: boolean }> {
  const doc = (await kvGet<EditsDoc>(KV.edits)) ?? { scannedAt: null, scanned: 0, setters: { person: 0, machine: 0, empty: 0 }, updated: "", edits: [] };
  let people: Record<string, string> = {};
  let owners: Record<string, string> = {};
  let edits = doc.edits;
  let visitsMatched = false;
  try {
    people = Object.fromEntries(await userNames());
  } catch (e) {
    console.warn(`[segmentation] user names unavailable: ${(e as Error).message}`);
  }
  try {
    owners = Object.fromEntries(await ownerNames());
  } catch (e) {
    console.warn(`[segmentation] owner names unavailable: ${(e as Error).message}`);
  }
  try {
    edits = labelVisits(edits, await visitsByCompany());
    visitsMatched = true;
  } catch (e) {
    console.warn(`[segmentation] customer visits unavailable - workflow edits stay unlabelled: ${(e as Error).message}`);
  }
  return { ...doc, edits: markMass(edits), people, owners, visitsMatched };
}

async function fetchSite(domain: string): Promise<string | null> {
  for (const url of [`https://www.${domain}`, `https://${domain}`, `http://www.${domain}`]) {
    try {
      const r = await fetch(url, {
        redirect: "follow", signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; APSO-enrich/1.0)" },
      });
      if (r.status < 400) {
        const t = await r.text();
        if (t) return t.slice(0, 400_000);
      }
    } catch {
      /* the next form of the address */
    }
  }
  return null;
}

/** Companies WITH a domain and WITHOUT a description, newest first; each tried at most once per 30 days. */
async function webInner(limit: number, dry: boolean) {
  const en = await enums();
  const st = await loadState();
  const attempts = { ...(st.web_attempts ?? {}) };
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const found: string[] = [];
  let after: string | undefined;
  while (found.length < limit * 3) {
    const r = await hubspotFetchJson<{ results?: Obj[]; paging?: { next?: { after?: string } } }>({
      path: "/crm/v3/objects/companies/search", method: "POST",
      body: {
        filterGroups: [{ filters: [
          { propertyName: "domain", operator: "HAS_PROPERTY" },
          { propertyName: "description", operator: "NOT_HAS_PROPERTY" },
        ] }],
        limit: 200, properties: ["name"], sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
        ...(after ? { after } : {}),
      },
    });
    found.push(...(r.results ?? []).map((x) => x.id));
    after = r.paging?.next?.after;
    if (!after) break;
  }
  const ids = found.filter((i) => (attempts[i] ?? "") < cutoff).slice(0, limit);
  const props = await batchRead(ids, WEB_PROPS);
  const changes: [string, Props][] = [];
  const stats = { attempted: 0, site_ok: 0, description: 0, employees: 0, address: 0, apic_or_industry: 0, website: 0 };
  const today = utcToday();
  for (const cid of ids) {
    const p = props.get(cid);
    if (!p) continue;
    const domain = (p.domain ?? "").toLowerCase().trim();
    const page = domain ? await fetchSite(domain) : null;
    const upd = webUpdates(p, page, en);
    attempts[cid] = today;
    if (upd === null) continue;
    stats.attempted += 1;
    if (!Object.keys(upd).length) continue;
    stats.site_ok += 1;
    if ("description" in upd) stats.description += 1;
    if ("numberofemployees" in upd) stats.employees += 1;
    if (["city", "zip", "country"].some((k) => k in upd)) stats.address += 1;
    if ("apic_ap" in upd || "industry" in upd) stats.apic_or_industry += 1;
    if ("website" in upd) stats.website += 1;
    changes.push([cid, upd]);
  }
  const log: string[] = [];
  const written = dry ? 0 : await batchUpdate(changes, log);
  const fresh = await loadState();
  const patch: Partial<SegState> = { web_attempts: { ...(fresh.web_attempts ?? {}), ...attempts } };
  // a no-op pass (the watcher's small batch finding nothing new) must not hide the last real batch
  if (stats.attempted > 0 || !fresh.last_web) patch.last_web = { at: nowIso(), candidates: ids.length, written, stats, dry };
  await patchState(patch);
  return { candidates: ids.length, written, stats, dry, log };
}

/** Potentials edited by anything but our machines in the last N minutes: priority + facts follow, up OR down. */
async function recheckInner(windowMin: number, dry: boolean, cap = 500) {
  const en = await enums();
  const rev = REV();
  const own = await ownApps();
  const since = Date.now() - windowMin * 60_000;
  const ids = await searchIds([
    { propertyName: "hs_lastmodifieddate", operator: "GTE", value: String(since) },
    { propertyName: "yearly_customer_potential", operator: "HAS_PROPERTY" },
  ], { sorts: ["hs_lastmodifieddate"], cap });
  const out = { window_min: windowMin, modified: ids.length, potential_changed: 0, written: 0, up: 0, down: 0, facts: 0, log: [] as string[] };
  if (!ids.length) return out;
  const changes: [string, Props][] = [];
  const found: PotentialEdit[] = [];
  for (const cid of ids.slice(0, cap)) {
    let res: Obj;
    try {
      res = await hubspotFetchJson<Obj>({ path: `/crm/v3/objects/companies/${cid}?properties=${READ_PROPS().join(",")}&propertiesWithHistory=yearly_customer_potential` });
    } catch {
      continue;
    }
    const hist = res.propertiesWithHistory?.yearly_customer_potential ?? [];
    if (!hist.length) continue;
    const last = hist[0];
    const ts = Date.parse((last.timestamp ?? "").slice(0, 19) + "Z");
    if (!Number.isFinite(ts) || ts < since || isOwnMachine(last, own)) continue; // unchanged, or we wrote it
    out.potential_changed += 1;
    const p = res.properties ?? {};
    found.push(...potentialEdits(cid, p, hist, rev, own).filter((e) => Date.parse(e.at) >= since));
    const c = compute(p, en, rev);
    const upd: Props = { ...c.upd };
    const cur = p.sales_priority ?? "";
    if (!cur || c.prefix !== cur[0]) {
      upd.sales_priority = en.prio[c.prefix];
      if (!cur || c.prefix < cur[0]) out.up += 1;
      else out.down += 1;
    } else if (Object.keys(upd).length) out.facts += 1;
    if (Object.keys(upd).length) changes.push([cid, upd]);
  }
  out.written = dry ? 0 : await batchUpdate(changes, out.log);
  if (found.length) await saveEdits(null, found, false);
  return out;
}

const WATCH_MIN_AGE_MIN = 3;
const WATCH_WINDOW_H = 48;
const WATCH_POLL_S = 120;

/** One watcher pass: new companies (48 h to 3 min old) missing a priority or a potential, then reps' potential edits. */
async function watchInner() {
  const en = await enums();
  const rev = REV();
  const year = curYear();
  const st = await loadState();
  let web: unknown = null;
  if (st.web_new_enabled !== false) {
    try {
      const w = await webInner(8, false);
      if (w.written) web = { ...w, log: undefined };
    } catch (e) {
      web = { error: (e as Error).message.slice(0, 150) };
    }
  }
  const now = Date.now();
  const lo = String(now - WATCH_WINDOW_H * 3_600_000);
  const hi = String(now - WATCH_MIN_AGE_MIN * 60_000);
  const found = new Set<string>();
  for (const missing of ["sales_priority", "yearly_customer_potential"]) {
    for (const id of await searchIds([
      { propertyName: "createdate", operator: "GTE", value: lo },
      { propertyName: "createdate", operator: "LTE", value: hi },
      { propertyName: missing, operator: "NOT_HAS_PROPERTY" },
    ])) found.add(id);
  }
  const log: string[] = [];
  const dist: Record<string, number> = {};
  let seeded = 0, written = 0, enriched = 0;
  if (found.size) {
    const props = await batchRead([...found].sort(), READ_PROPS());
    const changes: [string, Props][] = [];
    for (const [cid, p0] of props) {
      let p = p0;
      const upd: Props = enrich(p, en);
      if (Object.keys(upd).length) { enriched += 1; p = { ...p, ...upd }; }
      Object.assign(upd, unlost(p, year));
      if (!p.yearly_customer_potential) {
        const pot = initialPotential(p, rev);
        const s = pyStr(pot);
        upd.yearly_customer_potential = s;
        p = { ...p, yearly_customer_potential: s };
        seeded += 1;
      }
      const c = compute(p, en, rev);
      Object.assign(upd, c.upd);
      const cur = p.sales_priority ?? "";
      if (!cur || c.prefix < cur[0]) {
        upd.sales_priority = en.prio[c.prefix];
        dist[`P${c.prefix}`] = (dist[`P${c.prefix}`] ?? 0) + 1;
      }
      if (Object.keys(upd).length) changes.push([cid, upd]);
    }
    written = await batchUpdate(changes, log);
  }
  let changed: unknown;
  try {
    changed = await recheckInner(Math.max(10, Math.floor((2 * WATCH_POLL_S) / 60) + 5), false);
  } catch (e) {
    changed = { error: (e as Error).message.slice(0, 150) };
  }
  const res = { at: nowIso(), found: found.size, potential_seeded: seeded, enriched, priorities_set: dist, written, web, potential_changed: changed };
  await patchState({ watcher_last: res });
  return { ...res, log };
}

/* ── what the routes and the scheduler call ───────────────────────────── */

export type Action = "run-new" | "sweep" | "potential" | "web" | "watch" | "recheck" | "yearly";

/** Start an action in the background; false when another one is running. */
export async function startAction(action: Action, opts: { dry?: boolean; limit?: number; windowMin?: number; by: string }): Promise<{ started: boolean; note: string }> {
  if (await currentRun()) return { started: false, note: "another segmentation run is in progress" };
  const dry = !!opts.dry;
  void exclusive(action, opts.by, async (beat) => {
    try {
      const r =
        action === "run-new" ? await runNewInner(dry)
        : action === "sweep" ? await sweepInner(dry, beat)
        : action === "potential" ? await potentialInner(dry, beat)
        : action === "web" ? await webInner(Math.max(1, Math.min(opts.limit ?? 200, 1000)), dry)
        : action === "watch" ? await watchInner()
        : action === "yearly" ? await yearlyInner(dry, beat)
        : await recheckInner(Math.max(1, opts.windowMin ?? 60), dry, 2000);
      const { log, changes, ...rest } = r as Record<string, unknown>;
      void changes;
      console.log(`[segmentation] ${action}${dry ? " (dry)" : ""} by ${opts.by}: ${JSON.stringify(rest).slice(0, 400)}`);
      if (Array.isArray(log) && log.length) console.warn(`[segmentation] ${action}: ${log.join(" | ").slice(0, 400)}`);
      await kvSet(`segmentation:last:${action}`, { ...rest, by: opts.by });
    } catch (e) {
      console.warn(`[segmentation] ${action} failed: ${(e as Error).message}`);
      await kvSet(`segmentation:last:${action}`, { error: (e as Error).message, at: nowIso(), by: opts.by });
    }
  });
  return { started: true, note: `${action}${dry ? " (preview)" : ""} started` };
}

export async function lastResult(action: Action): Promise<unknown> {
  return kvGet(`segmentation:last:${action}`);
}

/** The scheduler's watcher tick - quietly skipped while another action holds the lock. */
export async function watchTick(): Promise<void> {
  await exclusive("watch", "watcher", async () => {
    const r = await watchInner();
    if (r.written || (r.potential_changed as { written?: number } | undefined)?.written) {
      console.log(`[segwatch] ${JSON.stringify({ ...r, log: undefined }).slice(0, 400)}`);
    }
    // a refused write leaves written at 0 - it must never pass in silence
    const refused = [...r.log, ...(((r.potential_changed as { log?: string[] } | undefined)?.log) ?? [])];
    if (refused.length) console.warn(`[segwatch] write refused: ${refused.join(" | ").slice(0, 400)}`);
  });
}

/** Once a day after the chain: the potential recalc (when POTENTIAL_RECALC=1), the sweep, a web batch. */
export async function nightly(): Promise<unknown> {
  const today = utcToday();
  const st = await loadState();
  if (st.nightly_day === today) return { skipped: "already ran today" };
  return exclusive("nightly", "nightly", async (beat) => {
    await patchState({ nightly_day: today });
    const result: Record<string, unknown> = {};
    if (process.env.POTENTIAL_RECALC === "1") {
      try {
        const pr = await potentialInner(false, beat);
        if (pr.log.length) console.warn(`[segmentation] nightly potential: write refused: ${pr.log.join(" | ").slice(0, 400)}`);
        result.potential = { ...pr, log: undefined };
      } catch (e) {
        result.potential = { error: (e as Error).message.slice(0, 200) };
      }
    }
    const sw = await sweepInner(false, beat);
    if (sw.log.length) console.warn(`[segmentation] nightly sweep: write refused: ${sw.log.join(" | ").slice(0, 400)}`);
    Object.assign(result, { ...sw, log: undefined });
    const cap = Number(process.env.WEB_ENRICH_NIGHTLY ?? "200");
    if (cap > 0) {
      try {
        const w = await webInner(cap, false);
        if (w.log.length) console.warn(`[segmentation] nightly web: write refused: ${w.log.join(" | ").slice(0, 400)}`);
        result.web = { ...w, log: undefined };
      } catch (e) {
        result.web = { error: (e as Error).message.slice(0, 200) };
      }
    }
    console.log(`[segmentation] nightly ${today}: ${JSON.stringify(result).slice(0, 500)}`);
    return result;
  });
}

export async function setWebNew(enabled: boolean) {
  await patchState({ web_new_enabled: enabled });
  return { web_new_enabled: enabled };
}


