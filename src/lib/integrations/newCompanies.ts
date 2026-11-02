// NEW COMPANIES - the reads and writes (rules and figures in ../segmentation/newCompanies.ts).
//
// Two parts:
//   the scan   - inside Smart Segmentation's watcher (every 2 minutes, under its engine lock): every company created in
//                the last 48 hours, at least 20 minutes ago, with NO APSO segment gets the workflow's first segment.
//                Off / Paused / Live (kv segmentation:new:settings); it writes only in Live AND while the HubSpot
//                workflow 3339386054 is switched off - never both. Paused works each one out and later reads what the
//                workflow wrote, so the two can be compared before the switch.
//   the follow - after the nightly (and at the first start, and on an admin's press): every company created in the last
//                two years, read once (~25,000, a few minutes, reads only) into kv segmentation:new:follow - where it
//                came from, who gave it its first segment and when, its segment, priority, revenue and owner today.

import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { ownerNames } from "./erosion";
import { hubspotFetchJson } from "./hubspot";
import { userNames } from "./segmentation";
import { FOLLOW_DAYS, SEGMENT_AFTER_MIN, WORKFLOW_ID, firstSegment, firstValue, setByOf, sourceOf, type NewCo, type NewDoc, type RuleKey, type SetBy } from "../segmentation/newCompanies";
import type { HistoryEntry } from "../segmentation/engine";

const KV = { settings: "segmentation:new:settings", scan: "segmentation:new:scan", days: "segmentation:new:days", follow: "segmentation:new:follow", build: "segmentation:new:build", ownApp: "segmentation:own-app-id" } as const;
/** the days the scan's counts are kept */
const DAYS_KEPT = 120;
const FOLLOW_LOCK = 4_107_255;
const SCAN_WINDOW_H = 48;
const SCAN_KEEP = 400;
/** measured 02.11.2026: the hub's HubSpot app (its writes on the Domains tab show as INTEGRATION 50521064) */
const HUB_APP = "50521064";

export type Mode = "off" | "shadow" | "live";
export type Settings = { mode: Mode; liveFrom: string | null; by?: string; at?: string };
/** One decision of the scan; in Paused, `actual` is what the workflow wrote afterwards. */
export type ScanRow = {
  id: string; n: string; t: string; dom: string; emp: string; seg: string; why: string; at: string; ru?: RuleKey;
  w: "written" | "would" | "waiting" | "error"; err?: string; actual?: { seg: string; by: SetBy };
};
export type ScanInfo = { at: string; found: number; decided: number; written: number; mode: Mode; writing: boolean; error?: string };
export type ScanDoc = { rows: ScanRow[]; last: ScanInfo | null };
/** What the hub wrote per day (Zurich): the companies, by rule, and the ones HubSpot refused. */
export type DayCount = { written: number; freemail: number; small: number; other: number; errors: number };
export type Days = Record<string, DayCount>;
export type BuildInfo = { running: boolean; startedAt: string | null; beatAt: string | null; progress: string; at: string | null; rows: number; seconds: number; by?: string; error?: string };

type Obj = { id: string; properties?: Record<string, string | null>; propertiesWithHistory?: Record<string, HistoryEntry[]> };
const nowIso = () => new Date().toISOString().slice(0, 19) + "Z";
/** today in Zurich, and the moment its day began */
export function zurichDay(ms = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}
function zurichMidnight(ms = Date.now()): number {
  const day = zurichDay(ms);
  // the offset at that moment: Zurich's wall clock against UTC
  const wall = new Date(new Date(ms).toLocaleString("en-US", { timeZone: "Europe/Zurich" })).getTime();
  const utc = new Date(new Date(ms).toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return Date.parse(`${day}T00:00:00Z`) - (wall - utc);
}

/* ── settings, the workflow ─────────────────────────────────────────────── */

export async function getSettings(): Promise<Settings> {
  return (await kvGet<Settings>(KV.settings)) ?? { mode: "shadow", liveFrom: null };
}
export async function saveSettings(mode: Mode, by: string): Promise<Settings> {
  const cur = await getSettings();
  const next: Settings = { mode, liveFrom: mode === "live" ? (cur.mode === "live" ? cur.liveFrom : new Date().toISOString()) : null, by, at: new Date().toISOString() };
  await kvSet(KV.settings, next);
  return next;
}
let wfCache: { at: number; on: boolean | null } | null = null;
/** The HubSpot workflow switched on? null = could not be read (then nothing is written). */
export async function workflowOn(): Promise<boolean | null> {
  if (wfCache && Date.now() - wfCache.at < 2 * 60_000) return wfCache.on;
  let on: boolean | null = null;
  try { on = !!(await hubspotFetchJson<{ isEnabled?: boolean }>({ path: `/automation/v4/flows/${WORKFLOW_ID}` })).isEnabled; } catch { on = null; }
  wfCache = { at: Date.now(), on };
  return on;
}

async function hubApps(): Promise<Set<string>> {
  const learned = await kvGet<{ appId: string }>(KV.ownApp);
  const env = (process.env.HUBSPOT_OWN_APP_ID ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return new Set([HUB_APP, ...env, ...(learned?.appId ? [learned.appId] : [])]);
}

/* ── HubSpot ───────────────────────────────────────────────────────────── */

/** Every company matching, page by page from the last id - no 10,000 cap. */
async function searchAll(filters: object[], properties: string[], beat?: (n: number) => Promise<void>): Promise<Obj[]> {
  const out: Obj[] = [];
  let cursor = "0";
  for (let page = 0; page < 2000; page++) {
    const r = await hubspotFetchJson<{ results?: Obj[] }>({
      path: "/crm/v3/objects/companies/search", method: "POST",
      body: { filterGroups: [{ filters: [...filters, { propertyName: "hs_object_id", operator: "GT", value: cursor }] }], properties, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200 },
    });
    const res = r.results ?? [];
    out.push(...res);
    if (beat && page % 10 === 0) await beat(out.length);
    if (res.length < 200) break;
    cursor = String(res[res.length - 1].id);
  }
  return out;
}

/** The history of a few properties, 50 companies a call (HubSpot's limit with history). */
async function histories(ids: string[], props: string[], beat?: (n: number) => Promise<void>): Promise<Map<string, Record<string, HistoryEntry[]>>> {
  const out = new Map<string, Record<string, HistoryEntry[]>>();
  for (let i = 0; i < ids.length; i += 50) {
    const r = await hubspotFetchJson<{ results?: Obj[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST",
      body: { inputs: ids.slice(i, i + 50).map((id) => ({ id })), properties: props, propertiesWithHistory: props },
    });
    for (const x of r.results ?? []) out.set(String(x.id), x.propertiesWithHistory ?? {});
    if (beat && (i / 50) % 20 === 0) await beat(i);
  }
  return out;
}

/* ── the scan (the watcher calls it, holding the engine lock) ───────────── */

export async function scanNew(): Promise<ScanInfo | null> {
  const settings = await getSettings();
  if (settings.mode === "off") return null;
  const writing = settings.mode === "live" && (await workflowOn()) === false;
  const now = Date.now();
  const doc = (await kvGet<ScanDoc>(KV.scan)) ?? { rows: [], last: null };
  const info: ScanInfo = { at: nowIso(), found: 0, decided: 0, written: 0, mode: settings.mode, writing };
  try {
    const found = await searchAll([
      { propertyName: "createdate", operator: "GTE", value: String(now - SCAN_WINDOW_H * 3_600_000) },
      { propertyName: "createdate", operator: "LTE", value: String(now - SEGMENT_AFTER_MIN * 60_000) },
      { propertyName: "apso_customer", operator: "NOT_HAS_PROPERTY" },
    ], ["name", "domain", "numberofemployees", "createdate"]);
    info.found = found.length;
    const decided: ScanRow[] = found.map((c) => {
      const p = c.properties ?? {}, v = firstSegment(p);
      return { id: String(c.id), n: p.name ?? "", t: p.createdate ?? "", dom: p.domain ?? "", emp: p.numberofemployees ?? "", seg: v.segment, why: v.why, ru: v.rule, at: info.at, w: writing ? "written" : settings.mode === "live" ? "waiting" : "would" };
    });
    info.decided = decided.length;
    if (writing && decided.length) {
      for (let i = 0; i < decided.length; i += 100) {
        const chunk = decided.slice(i, i + 100);
        try {
          await hubspotFetchJson({ path: "/crm/v3/objects/companies/batch/update", method: "POST", body: { inputs: chunk.map((x) => ({ id: x.id, properties: { apso_customer: x.seg } })) } });
          info.written += chunk.length;
        } catch {
          // one refused value never stops the rest
          for (const x of chunk) {
            try { await hubspotFetchJson({ path: `/crm/v3/objects/companies/${x.id}`, method: "PATCH", body: { properties: { apso_customer: x.seg } } }); info.written++; }
            catch (e) { x.w = "error"; x.err = (e as Error).message.slice(0, 160); }
          }
        }
      }
    }
    if (writing && decided.length) {
      // the day's count: what the hub wrote, by rule (a company is written once - it has a segment after)
      const days = (await kvGet<Days>(KV.days)) ?? {};
      const k = zurichDay();
      const d = days[k] ?? { written: 0, freemail: 0, small: 0, other: 0, errors: 0 };
      for (const x of decided) { if (x.w === "error") d.errors++; else { d.written++; if (x.ru) d[x.ru]++; } }
      days[k] = d;
      for (const old of Object.keys(days).sort().slice(0, -DAYS_KEPT)) delete days[old];
      await kvSet(KV.days, days);
    }
    // the newest decision of each company first; a company decided again replaces its older row
    const fresh = new Set(decided.map((x) => x.id));
    const rows = [...decided, ...doc.rows.filter((x) => !fresh.has(x.id))].slice(0, SCAN_KEEP);
    // not written by the hub: what did the workflow (or anyone) give it? read once, 30 minutes after the creation
    const open = rows.filter((x) => x.w !== "written" && !x.actual && now - Date.parse(x.t) > 30 * 60_000 && !fresh.has(x.id)).slice(0, 100);
    if (open.length) {
      const apps = await hubApps();
      const h = await histories(open.map((x) => x.id), ["apso_customer"]);
      for (const x of open) {
        const first = firstValue(h.get(x.id)?.apso_customer);
        if (first) x.actual = { seg: (first.value ?? "").trim(), by: setByOf(first, apps) };
      }
    }
    await kvSet(KV.scan, { rows, last: info } satisfies ScanDoc);
  } catch (e) {
    info.error = (e as Error).message.slice(0, 200);
    await kvSet(KV.scan, { rows: doc.rows, last: info } satisfies ScanDoc);
  }
  return info;
}

/* ── the follow: every company of the last two years ────────────────────── */

const FOLLOW_PROPS = [
  "name", "createdate", "country", "country_custom", "hs_object_source", "hs_object_source_id", "hs_object_source_detail_1",
  "apso_customer", "sales_priority", "hubspot_owner_id", "num_associated_contacts", "domain",
];
const BEAT_STALE_MS = 5 * 60_000;
const alive = (b: BuildInfo | null | undefined) => !!b?.running && Date.now() - Date.parse(b.beatAt ?? "") < BEAT_STALE_MS;

async function buildInner(by: string): Promise<BuildInfo> {
  const t0 = Date.now();
  const startedAt = new Date().toISOString();
  const state: BuildInfo = { running: true, startedAt, beatAt: startedAt, progress: "reading the companies", at: null, rows: 0, seconds: 0, by };
  const beat = async (progress: string) => { state.beatAt = new Date().toISOString(); state.progress = progress; await kvSet(KV.build, state); };
  await beat("reading the companies");
  const year = new Date().getUTCFullYear();
  const since = new Date(Date.now() - FOLLOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const revProps: string[] = [];
  for (let y = year - Math.ceil(FOLLOW_DAYS / 365); y <= year; y++) revProps.push(`revenue_${y}`);
  const companies = await searchAll([{ propertyName: "createdate", operator: "GTE", value: String(Date.parse(`${since}T00:00:00Z`)) }],
    [...FOLLOW_PROPS, ...revProps], (n) => beat(`${n.toLocaleString("en")} companies read`));
  await beat(`${companies.length.toLocaleString("en")} companies - reading who gave each its first segment`);
  const h = await histories(companies.map((c) => String(c.id)), ["apso_customer", "domain", "numberofemployees"], (i) => beat(`first segments: ${i.toLocaleString("en")} of ${companies.length.toLocaleString("en")}`));
  const apps = await hubApps();
  const rows: NewCo[] = [];
  for (const c of companies) {
    const p = c.properties ?? {};
    const created = p.createdate ?? "";
    if (!created) continue;
    const hist = h.get(String(c.id)) ?? {};
    const first = firstValue(hist.apso_customer);
    const fb = setByOf(first, apps);
    // the rule that decided, from the domain and the size as they were the moment the workflow or the hub wrote
    const asOf = (k: string) => [...(hist[k] ?? [])].filter((e) => (e.timestamp ?? "") <= (first?.timestamp ?? "")).sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""))[0]?.value ?? "";
    const ru = first && (fb === "workflow" || fb === "hub") ? firstSegment({ domain: asOf("domain"), numberofemployees: asOf("numberofemployees") }).rule : undefined;
    const cy = Number(created.slice(0, 4));
    let r = 0;
    for (const k of revProps) if (Number(k.slice(8)) >= cy) r += Number(p[k]) || 0;
    const { src, by: who } = sourceOf(p);
    rows.push({
      id: String(c.id), n: p.name ?? "", d: created.slice(0, 10), t: created.slice(0, 19), k: (p.country || p.country_custom || "").trim(),
      src, ...(who ? { by: who } : {}),
      f: (first?.value ?? "").trim(), fb, ...(ru ? { ru } : {}), fm: first?.timestamp ? Math.max(0, Math.round((Date.parse(first.timestamp) - Date.parse(created)) / 60_000)) : null,
      s: (p.apso_customer ?? "").trim(), p: (p.sales_priority ?? "").trim().slice(0, 1), r: Math.round(r),
      o: p.hubspot_owner_id ?? "", c: Number(p.num_associated_contacts) || 0, dom: !!(p.domain ?? "").trim(),
    });
  }
  const [owners, users] = await Promise.all([ownerNames().catch(() => new Map<string, string>()), userNames().catch(() => new Map<string, string>())]);
  // the people who created companies and own none (any more) are not in the owners list - HubSpot's users know them
  for (const id of [...new Set(rows.map((x) => x.by).filter((x): x is string => !!x && !users.has(x)))].slice(0, 200)) {
    try {
      const u = await hubspotFetchJson<{ firstName?: string; lastName?: string; email?: string }>({ path: `/settings/v3/users/${id}` });
      const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email;
      if (name) users.set(id, name);
    } catch { /* stays "User <id>" */ }
  }
  const doc: NewDoc = { at: new Date().toISOString(), since, rows, owners: Object.fromEntries(owners), users: Object.fromEntries(users), hubApps: [...apps] };
  await kvSet(KV.follow, doc);
  docCache = { at: doc.at, doc };
  return { running: false, startedAt, beatAt: new Date().toISOString(), progress: "done", at: doc.at, rows: rows.length, seconds: Math.round((Date.now() - t0) / 1000), by };
}

/** Read the last two years again; one copy of the hub at a time. Returns at once - it runs in the background. */
export async function startFollow(by: string): Promise<{ started: boolean; why?: string }> {
  if (alive(await kvGet<BuildInfo>(KV.build))) return { started: false, why: "already counting" };
  void (async () => {
    const client = await getPool().connect();
    try {
      const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [FOLLOW_LOCK]);
      if (!got.rows[0]?.ok) return;
      try {
        const info = await buildInner(by).catch(async (e) => {
          const prev = await kvGet<BuildInfo>(KV.build);
          return { running: false, startedAt: prev?.startedAt ?? null, beatAt: new Date().toISOString(), progress: "failed", at: prev?.at ?? null, rows: 0, seconds: 0, by, error: (e as Error).message.slice(0, 300) } satisfies BuildInfo;
        });
        await kvSet(KV.build, info);
        console.log(`[segmentation] new companies followed: ${info.error ? `failed - ${info.error}` : `${info.rows} companies in ${info.seconds} s`}`);
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [FOLLOW_LOCK]).catch(() => {});
      }
    } catch (e) {
      console.warn(`[segmentation] new companies: ${(e as Error).message}`);
    } finally {
      client.release();
    }
  })();
  return { started: true };
}

/** After the nightly, once a day; and at the first start when nothing was ever read. */
export async function followDue(): Promise<boolean> {
  const b = await kvGet<BuildInfo>(KV.build);
  if (alive(b)) return false;
  return !b?.at || b.at.slice(0, 10) !== new Date().toISOString().slice(0, 10);
}

let docCache: { at: string; doc: NewDoc } | null = null;
/** The followed companies - held in memory until the next read replaces them (~25,000 rows). */
export async function followDoc(): Promise<NewDoc | null> {
  const b = await kvGet<BuildInfo>(KV.build);
  if (docCache && (!b?.at || b.at <= docCache.at)) return docCache.doc;
  const doc = await kvGet<NewDoc>(KV.follow);
  if (doc) docCache = { at: doc.at, doc };
  return doc ?? null;
}

export type Unsegmented = { total: number; rows: { id: string; n: string; t: string }[] };
/** Every company in HubSpot with no APSO segment right now, the newest first (SARCLA 02.11.2026: "is there any company not
 *  segmented yet? this is important"). null = could not be read. */
async function unsegmented(): Promise<Unsegmented | null> {
  try {
    const r = await hubspotFetchJson<{ total?: number; results?: Obj[] }>({
      path: "/crm/v3/objects/companies/search", method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: "apso_customer", operator: "NOT_HAS_PROPERTY" }] }], properties: ["name", "createdate"], sorts: [{ propertyName: "createdate", direction: "DESCENDING" }], limit: 25 },
    });
    return { total: r.total ?? 0, rows: (r.results ?? []).map((c) => ({ id: String(c.id), n: c.properties?.name ?? "", t: c.properties?.createdate ?? "" })) };
  } catch {
    return null;
  }
}

async function searchCount(filters: object[]): Promise<number | null> {
  try {
    const r = await hubspotFetchJson<{ total?: number }>({ path: "/crm/v3/objects/companies/search", method: "POST", body: { filterGroups: [{ filters }], limit: 1, properties: ["name"] } });
    return r.total ?? 0;
  } catch {
    return null;
  }
}

/**
 * The scan as it happens (SARCLA 02.11.2026: "it doesn't look alive - track it like a funnel, by the rules and the
 * stages"): today in Zurich - created, still in the 20 minutes' wait, given a segment by the hub (by rule), and every
 * company in HubSpot without one. Light: three counts and the kv; the tab asks again every 30 seconds.
 */
export async function liveState() {
  const now = Date.now(), midnight = zurichMidnight(now);
  const [settings, on, scan, days, createdToday, waiting, none] = await Promise.all([
    getSettings(), workflowOn(), kvGet<ScanDoc>(KV.scan), kvGet<Days>(KV.days),
    searchCount([{ propertyName: "createdate", operator: "GTE", value: String(midnight) }]),
    searchCount([{ propertyName: "createdate", operator: "GTE", value: String(now - SEGMENT_AFTER_MIN * 60_000) }, { propertyName: "apso_customer", operator: "NOT_HAS_PROPERTY" }]),
    unsegmented(),
  ]);
  return {
    at: new Date(now).toISOString(), today: zurichDay(now), settings, workflowOn: on, writing: settings.mode === "live" && on === false,
    last: scan?.last ?? null, rows: scan?.rows ?? [], days: days ?? {}, createdToday, waiting, unsegmented: none,
  };
}
export type LiveState = Awaited<ReturnType<typeof liveState>>;

/** What the tab needs besides the figures: the switch, the workflow, the scan's decisions, the last read, who has no segment. */
export async function scanState() {
  const [settings, on, scan, build, none] = await Promise.all([getSettings(), workflowOn(), kvGet<ScanDoc>(KV.scan), kvGet<BuildInfo>(KV.build), unsegmented()]);
  return {
    settings, workflowOn: on, writing: settings.mode === "live" && on === false,
    scan: scan ?? { rows: [], last: null }, build: build ? { ...build, running: alive(build) } : null, unsegmented: none,
  };
}
