// COMPANY DUPLICATES (SARCLA 10.11.2026: "COMPANIES FULL DUPLICATE CHECK - then we need to migrate it to the hub; can we
// rework duplicates and merges to include a company duplicate check"). The workflow "SARCLA | COMPANIES FULL DUPLICATE
// CHECK |" (2905757899) merged two companies of the same ERP customer number and Mandant into the oldest - for a company
// whose Mandant changed, so an ERP number set later was never looked at again (Dassault Aviation, 845265, twice since
// 25.09.2026). Here, every hour, one copy of the hub at a time (advisory lock 4107280):
//   - every company read (about 615 pages of 100), its groups found by the rules (rules.ts), kept (kv companyDup:snapshot);
//   - live - only while the page says Live AND the workflow is off, so the two never merge at once -: the same ERP customer
//     merged into the oldest company, every company read again first (at most 60 merges an hour, 4 companies a group);
//     since 10.11.2026 also the same name, postcode and website (rules.ts autoBoth), into the company with the number;
//   - a possible duplicate waits for a person: Merge or Not duplicates on the page (admins) - done at once.
// Once a day the merges of the last 400 days are read back from HubSpot's history of hs_merged_object_ids on every company
// others went into (lock 4107281): who merged - the workflow, the hub, a person - and when.

import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { locked } from "@/lib/ticketDuplicates/reads";
import { ownerNames } from "@/lib/integrations/erosion";
import {
  DEFAULT_RULES, MERGE_PER_HOUR, MERGE_PER_RUN, READ_PROPS, apartPairs, autoBoth, domainOf, erpOf, findGroups, intoOf, mergesOf, stillHolds, toCompany, zipKey,
  type Company, type Found, type Group, type HistEntry, type MergeEvent, type RawCompany, type Rules,
} from "./rules";
import { performisFamilies, type PerfFamily } from "./performis";

export const WORKFLOW_ID = "2905757899";
/** the apps behind HubSpot's history of a merge */
const APPS: Record<string, string> = { "22343290": "The workflow", "50521064": "APSOhub" };

const READ_LOCK = 4_107_280, HISTORY_LOCK = 4_107_281;
const TICK_MS = 5 * 60_000, EVERY_MS = 60 * 60_000, HISTORY_EVERY_MS = 24 * 3600_000, LIMIT_MS = 30 * 60_000;
const HISTORY_DAYS = 400;

const KV = {
  settings: "companyDup:settings", snapshot: "companyDup:snapshot", last: "companyDup:lastRun", log: "companyDup:log",
  apart: "companyDup:apart", survivors: "companyDup:survivors", history: "companyDup:history", ask: "companyDup:ask", hour: "companyDup:hour:merge",
  performis: "companyDup:performis",
};

export type Mode = "off" | "shadow" | "live";
export type Settings = { mode: Mode; rules: Rules; by: string | null; at: string | null };
export type RunInfo = { at: string; seconds: number; read: number; sure: number; possible: number; merged: number; skipped?: number; error?: string };
/** v: what a snapshot holds - a newer hub reads again at once when the kept one is older (2 = street, unique number,
 *  phone, the owner's name: SARCLA 10.11.2026 "more properties"; 3 = the last order, Performis) */
export type Snapshot = { at: string; seconds: number; found: Found; v?: number };
const SNAP_V = 3;
export type Performis = { at: string; families: PerfFamily[] };
export type LogEntry = { at: string; what: "merge" | "apart" | "skip" | "error"; ids: string[]; names: string[]; into?: string; text: string; by: string };
export type History = { at: string; survivors: number; read: number; events: (MergeEvent & { name: string })[]; error?: string };

// ---------------- settings ----------------
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
function cleanRules(r: Partial<Rules> | undefined, cur: Rules): Rules {
  const e = { ...cur.erp, ...(r?.erp ?? {}) }, p = { ...cur.place, ...(r?.place ?? {}) }, w = { ...cur.website, ...(r?.website ?? {}) }, b = { ...cur.both, ...(r?.both ?? {}) };
  return {
    erp: { on: bool(e.on, true), autoMerge: bool(e.autoMerge, true), maxGroup: Math.min(10, Math.max(2, Math.round(Number(e.maxGroup)) || 4)) },
    place: { on: bool(p.on, true) },
    website: { on: bool(w.on, true), otherNames: bool(w.otherNames, true) },
    both: { autoMerge: bool(b.autoMerge, true) },
  };
}
export async function getSettings(): Promise<Settings> {
  const s = await kvGet<Partial<Settings>>(KV.settings);
  return { mode: s?.mode === "off" || s?.mode === "live" ? s.mode : "shadow", rules: cleanRules(s?.rules, DEFAULT_RULES), by: s?.by ?? null, at: s?.at ?? null };
}
export async function saveSettings(patch: { mode?: Mode; rules?: Partial<Rules> }, by: string): Promise<Settings> {
  const cur = await getSettings();
  const next: Settings = {
    mode: patch.mode === "off" || patch.mode === "shadow" || patch.mode === "live" ? patch.mode : cur.mode,
    rules: patch.rules ? cleanRules(patch.rules, cur.rules) : cur.rules,
    by, at: new Date().toISOString(),
  };
  await kvSet(KV.settings, next);
  return next;
}
export const lastRun = async () => (await kvGet<RunInfo>(KV.last)) ?? null;
export const snapshot = async () => (await kvGet<Snapshot>(KV.snapshot)) ?? null;
export const readLog = async () => (await kvGet<LogEntry[]>(KV.log)) ?? [];
export const history = async () => (await kvGet<History>(KV.history)) ?? null;
export const performis = async () => (await kvGet<Performis>(KV.performis)) ?? null;
export const apartCount = async () => ((await kvGet<string[]>(KV.apart)) ?? []).length;
async function log(e: LogEntry) { await kvSet(KV.log, [e, ...(await readLog())].slice(0, 500)); }

// ---------------- the workflow ----------------
let wf: { at: number; on: boolean | null } | null = null;
/** true = COMPANIES FULL DUPLICATE CHECK still runs (the hub only finds), false = off, null = not readable (the hub waits). */
export async function workflowOn(): Promise<boolean | null> {
  if (wf && Date.now() - wf.at < 2 * 60_000) return wf.on;
  let on: boolean | null = null;
  try { on = !!(await hubspotRetry<{ isEnabled?: boolean }>({ path: `/automation/v4/flows/${WORKFLOW_ID}` })).isEnabled; } catch { on = null; }
  wf = { at: Date.now(), on };
  return on;
}

// ---------------- HubSpot ----------------
const zurich = (d = new Date()) => d.toLocaleString("de-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
type Page = { results?: RawCompany[]; paging?: { next?: { after?: string } } };

/** Every company, a page of 100 at a time - and those others were merged into (for the history). */
async function readAll(signal?: AbortSignal): Promise<{ list: Company[]; survivors: string[] }> {
  const list: Company[] = [], survivors: string[] = [], away = new Set<string>();
  let after: string | undefined;
  for (let page = 0; page < 3000; page++) {
    if (signal?.aborted) throw new Error("stopped at the time limit");
    const j = await hubspotRetry<Page>({ path: `/crm/v3/objects/companies?limit=100&archived=false&properties=${READ_PROPS.join(",")}${after ? `&after=${encodeURIComponent(after)}` : ""}` });
    for (const r of j.results ?? []) {
      list.push(toCompany(r));
      if (r.properties.hs_merged_object_ids) {
        survivors.push(String(r.id));
        for (const x of String(r.properties.hs_merged_object_ids).split(";")) if (x.trim()) away.add(x.trim());
      }
    }
    after = j.paging?.next?.after;
    if (!after) break;
  }
  // a merge while the pages are read: the old records can still come in a later page - never a group of their own
  return { list: list.filter((c) => !away.has(c.id)), survivors };
}

/** One more merge this hour - false at the limit. */
async function allow(n: number): Promise<boolean> {
  const hour = new Date().toISOString().slice(0, 13);
  const cur = (await kvGet<{ hour: string; n: number }>(KV.hour)) ?? { hour, n: 0 };
  const used = cur.hour === hour ? cur.n : 0;
  if (used + n > MERGE_PER_HOUR) return false;
  await kvSet(KV.hour, { hour, n: used + n });
  return true;
}

/** The group, merged: every company read again (none merged or gone meanwhile, still the rule's), then each into the one
 *  the others go into - a merge makes a new record in HubSpot, so the next merge goes into the id the last one gave. */
export async function mergeGroup(kind: "erp" | "possible", ids: string[], by: string, why: string, into?: string, both?: Rules): Promise<{ into: string; merged: string[]; name: string }> {
  const now: Company[] = [];
  for (const id of [...new Set(ids)]) {
    const r = await hubspotRetry<RawCompany>({ path: `/crm/v3/objects/companies/${id}?properties=${READ_PROPS.join(",")}` });
    if (String(r.id) !== id) throw new Error(`company ${id} was merged into ${r.id} meanwhile - nothing merged`);
    now.push(toCompany(r));
  }
  const bad = stillHolds(kind, now);
  if (bad) throw new Error(`${bad} - nothing merged`);
  // merged by itself as the same name, postcode and website: still all three, read now
  if (both && !findGroups(now, both, new Set()).possible.some((g) => g.members.length === now.length && autoBoth(g, both))) throw new Error("the name, postcode or website differ now - nothing merged, a person decides");
  if (!(await allow(now.length - 1))) throw new Error(`the limit of ${MERGE_PER_HOUR} merges an hour is reached - nothing merged, try again next hour`);
  const target = into && now.some((c) => c.id === into) ? into : intoOf(now, kind);
  const keep = now.find((c) => c.id === target)!;
  let primary = target;
  const merged: string[] = [];
  for (const c of now) {
    if (c.id === target) continue;
    // one try only: a merge HubSpot did but answered badly must not be sent again
    const r = await hubspotFetchJson<{ id?: string | number }>({ path: "/crm/v3/objects/companies/merge", method: "POST", body: { primaryObjectId: primary, objectIdToMerge: c.id } });
    merged.push(c.id);
    if (r?.id) primary = String(r.id);
  }
  const absorbed = now.filter((c) => c.id !== target).map((c) => `${c.name} (#${c.id})`).join(", ");
  await hubspotRetry({
    path: `/crm/v3/objects/companies/${primary}`, method: "PATCH",
    body: { properties: { for_duplicates: "100", comment_on_company_duplicates: `Merged ${merged.length} duplicate(s) into ${keep.name} (#${primary}) - ${why} - by ${by} in APSOhub, ${zurich()}. Absorbed: ${absorbed}.`.slice(0, 2000) } },
  }).catch(() => {});
  await log({ at: new Date().toISOString(), what: "merge", ids: now.map((c) => c.id), names: now.map((c) => c.name), into: primary, text: `${why} - ${merged.length} merged into ${keep.name}`, by });
  return { into: primary, merged, name: keep.name };
}

/** The snapshot without the groups these companies were in - a click shows its result at once, the next read confirms. */
async function dropFromSnapshot(ids: string[]) {
  const s = await snapshot();
  if (!s) return;
  const gone = new Set(ids);
  const keep = (g: Group) => !g.members.some((c) => gone.has(c.id));
  await kvSet(KV.snapshot, { ...s, found: { ...s.found, sure: s.found.sure.filter(keep), possible: s.found.possible.filter(keep) } });
}
const groupOf = (s: Snapshot | null, key: string) => s ? [...s.found.sure, ...s.found.possible].find((g) => g.key === key) ?? null : null;

/** A person's decision on the page: merge the group, or keep its companies apart for good. */
export async function decide(action: "merge" | "apart", key: string, by: string, into?: string): Promise<{ ok: true; text: string; into?: string }> {
  const g = groupOf(await snapshot(), key);
  if (!g) throw new Error("This group is not in the last read any more - read again");
  const ids = g.members.map((c) => c.id);
  if (action === "apart") {
    const cur = (await kvGet<string[]>(KV.apart)) ?? [];
    await kvSet(KV.apart, [...new Set([...cur, ...apartPairs(ids)])].slice(-20000));
    await log({ at: new Date().toISOString(), what: "apart", ids, names: g.members.map((c) => c.name), text: `Not duplicates - ${g.why}`, by });
    await dropFromSnapshot(ids);
    return { ok: true, text: "Kept apart - they will not be shown again." };
  }
  try {
    const r = await mergeGroup(g.kind === "erp" ? "erp" : "possible", ids, by, g.why, into);
    await dropFromSnapshot(ids);
    return { ok: true, text: `Merged ${r.merged.length} into ${r.name}.`, into: r.into };
  } catch (e) {
    await log({ at: new Date().toISOString(), what: "error", ids, names: g.members.map((c) => c.name), text: (e as Error).message.slice(0, 300), by });
    throw e;
  }
}

// ---------------- the hourly read ----------------
async function run(settings: Settings, signal?: AbortSignal): Promise<RunInfo> {
  const started = Date.now();
  const info: RunInfo = { at: new Date().toISOString(), seconds: 0, read: 0, sure: 0, possible: 0, merged: 0 };
  const { list, survivors } = await readAll(signal);
  const apart = new Set((await kvGet<string[]>(KV.apart)) ?? []);
  const found = findGroups(list, settings.rules, apart);
  // what a person merged or kept apart while the pages were read is not shown again
  const decided = new Set((await readLog()).filter((e) => e.at >= info.at && (e.what === "merge" || e.what === "apart")).flatMap((e) => e.ids));
  if (decided.size) {
    const keep = (g: Group) => !g.members.some((c) => decided.has(c.id));
    found.sure = found.sure.filter(keep);
    found.possible = found.possible.filter(keep);
  }
  // the owners' names, for the lists
  const names = await ownerNames().catch(() => new Map<string, string>());
  for (const g of [...found.sure, ...found.possible, ...found.left]) for (const c of g.members) c.ownerName = c.owner ? names.get(c.owner) ?? null : null;
  info.read = list.length; info.sure = found.sure.length; info.possible = found.possible.length;
  await kvSet(KV.survivors, survivors);
  await kvSet(KV.snapshot, { at: info.at, seconds: Math.round((Date.now() - started) / 1000), found, v: SNAP_V } satisfies Snapshot);
  // Performis: one company, several customer numbers - the accounts' new names
  const fams = performisFamilies(list);
  for (const f of fams) for (const a of f.accounts) a.ownerName = a.owner ? names.get(a.owner) ?? null : null;
  await kvSet(KV.performis, { at: info.at, families: fams } satisfies Performis);
  // live, only once the workflow is off: the same customer number into the oldest company, the same name, postcode and
  // website into the company with the customer number
  if (settings.mode === "live" && (await workflowOn()) === false) {
    const todo: { g: Group; kind: "erp" | "possible"; by: string; both?: Rules }[] = [
      ...(settings.rules.erp.autoMerge ? found.sure.map((g) => ({ g, kind: "erp" as const, by: "APSOhub (same customer number)" })) : []),
      ...found.possible.filter((g) => autoBoth(g, settings.rules)).map((g) => ({ g, kind: "possible" as const, by: "APSOhub (same name, postcode and website)", both: settings.rules })),
    ];
    let skipped = 0;
    for (const t of todo) {
      if (signal?.aborted || info.merged >= MERGE_PER_RUN) break;
      const ids = t.g.members.map((c) => c.id);
      if (t.g.tooBig) { skipped++; continue; }
      try { await mergeGroup(t.kind, ids, t.by, t.g.why, undefined, t.both); info.merged++; await dropFromSnapshot(ids); }
      catch (e) {
        skipped++;
        const msg = (e as Error).message;
        // merged meanwhile (a person, another copy of the hub): nothing to do, not a failure
        await log({ at: new Date().toISOString(), what: /limit|meanwhile/.test(msg) ? "skip" : "error", ids, names: t.g.members.map((c) => c.name), text: msg.slice(0, 300), by: "APSOhub" });
        if (/limit/.test(msg)) break;
      }
    }
    if (skipped) info.skipped = skipped;
  }
  info.seconds = Math.round((Date.now() - started) / 1000);
  await kvSet(KV.last, info);
  return info;
}

export async function runOnce(signal?: AbortSignal, force = false): Promise<RunInfo | null> {
  const settings = await getSettings();
  if (settings.mode === "off") return null;
  const last = await lastRun();
  // asked by "Read again now", or the kept snapshot is of an older hub
  const asked = (await kvGet<boolean>(KV.ask)) || ((await snapshot())?.v ?? 1) < SNAP_V;
  // a read that failed is tried again after 15 minutes, not at every tick
  if (!force && !asked && last && Date.now() - Date.parse(last.at) < (last.error ? 15 * 60_000 : EVERY_MS)) return null;
  return locked(READ_LOCK, async () => {
    await kvSet(KV.ask, false);
    return run(settings, signal).catch(async (e) => {
      const info: RunInfo = { at: new Date().toISOString(), seconds: 0, read: 0, sure: 0, possible: 0, merged: 0, error: (e as Error).message.slice(0, 300) };
      await kvSet(KV.last, info);
      return info;
    });
  }, signal);
}
/** "Look now": the next tick of any copy of the hub reads again - this one at once. */
export async function askRun() {
  await kvSet(KV.ask, true);
  setTimeout(tick, 500).unref?.();
}

// ---------------- the merges of the past ----------------
let usersCache: { at: number; byUser: Map<string, string> } | null = null;
async function users(): Promise<Map<string, string>> {
  if (usersCache && Date.now() - usersCache.at < 60 * 60_000) return usersCache.byUser;
  const byUser = new Map<string, string>();
  for (const archived of [false, true]) {
    let after: string | undefined;
    for (let page = 0; page < 20; page++) {
      const r = await hubspotRetry<{ results?: { userId?: number; firstName?: string; lastName?: string; email?: string }[]; paging?: { next?: { after?: string } } }>({ path: `/crm/v3/owners?limit=100&archived=${archived}${after ? `&after=${after}` : ""}` });
      for (const o of r.results ?? []) if (o.userId && !byUser.has(String(o.userId))) byUser.set(String(o.userId), [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || `user ${o.userId}`);
      after = r.paging?.next?.after;
      if (!after) break;
    }
  }
  usersCache = { at: Date.now(), byUser };
  return byUser;
}

async function buildHistory(): Promise<History> {
  const survivors = (await kvGet<string[]>(KV.survivors)) ?? [];
  const byUser = await users().catch(() => new Map<string, string>());
  const byOf = (h: HistEntry) => h.sourceType === "INTEGRATION" ? APPS[String(h.sourceId)] ?? `App ${h.sourceId}`
    : h.updatedByUserId ? byUser.get(String(h.updatedByUserId)) ?? `User ${h.updatedByUserId}` : h.sourceType === "CRM_UI" ? "A person" : (h.sourceType ?? "HubSpot").toLowerCase();
  const since = new Date(Date.now() - HISTORY_DAYS * 86400_000).toISOString();
  const events: History["events"] = [];
  let read = 0;
  for (let i = 0; i < survivors.length; i += 50) {
    const j = await hubspotRetry<{ results?: (RawCompany & { propertiesWithHistory?: Record<string, HistEntry[]> })[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST",
      body: { inputs: survivors.slice(i, i + 50).map((id) => ({ id })), properties: ["name"], propertiesWithHistory: ["hs_merged_object_ids"] },
    });
    for (const r of j.results ?? []) {
      read++;
      for (const e of mergesOf(String(r.id), r.propertiesWithHistory?.hs_merged_object_ids ?? [], byOf)) if (e.at >= since) events.push({ ...e, name: String(r.properties.name ?? `Company ${r.id}`) });
    }
  }
  const h: History = { at: new Date().toISOString(), survivors: survivors.length, read, events: events.sort((a, b) => b.at.localeCompare(a.at)) };
  await kvSet(KV.history, h);
  return h;
}
async function historyOnce(): Promise<History | null> {
  const h = await history();
  if (h && !h.error && Date.now() - Date.parse(h.at) < HISTORY_EVERY_MS) return null;
  if (!((await kvGet<string[]>(KV.survivors)) ?? []).length) return null;
  return locked(HISTORY_LOCK, () => buildHistory().catch(async (e) => {
    const x: History = { at: new Date().toISOString(), survivors: 0, read: 0, events: h?.events ?? [], error: (e as Error).message.slice(0, 300) };
    await kvSet(KV.history, x);
    return x;
  }));
}

// ---------------- one company, read only ----------------
/** What the rules find for one company now: the companies sharing its ERP number, website or postcode - nothing written. */
export async function checkCompany(id: string): Promise<{ company: Company; groups: Group[] }> {
  const r = await hubspotRetry<RawCompany>({ path: `/crm/v3/objects/companies/${id}?properties=${READ_PROPS.join(",")}` });
  const me = toCompany(r);
  const search = async (filters: object[]) => (await hubspotRetry<Page>({ path: "/crm/v3/objects/companies/search", method: "POST", body: { filterGroups: [{ filters }], properties: READ_PROPS, limit: 100 } })).results ?? [];
  const raw = String(r.properties.erp_customer_id ?? "").trim();
  const near: RawCompany[] = [];
  if (erpOf(raw) && me.mandant) near.push(...(await search([{ propertyName: "erp_customer_id", operator: "EQ", value: raw }])));
  const d = domainOf(r.properties.domain, r.properties.website);
  if (d) near.push(...(await search([{ propertyName: "domain", operator: "EQ", value: d }])));
  const z = zipKey(me.zip);
  if (z) near.push(...(await search([{ propertyName: "zip", operator: "EQ", value: me.zip }])));
  const list = new Map<string, Company>([[me.id, me], ...near.map((x) => [String(x.id), toCompany(x)] as [string, Company])]);
  const s = await getSettings();
  const f = findGroups([...list.values()], s.rules, new Set((await kvGet<string[]>(KV.apart)) ?? []));
  const mine = (g: Group) => g.members.some((c) => c.id === me.id);
  const groups = [...f.sure, ...f.possible, ...f.left].filter(mine);
  const names = await ownerNames().catch(() => new Map<string, string>());
  for (const c of [me, ...groups.flatMap((g) => g.members)]) c.ownerName = c.owner ? names.get(c.owner) ?? null : null;
  return { company: me, groups };
}

// ---------------- the timer ----------------
let started = false, running = false, histing = false;
function tick() {
  if (!histing) {
    histing = true;
    void historyOnce().catch((e) => console.warn(`[company-duplicates] history: ${(e as Error).message}`)).finally(() => { histing = false; });
  }
  if (running) return;
  running = true;
  const limit = new AbortController();
  const timer = setTimeout(() => { console.error(`[company-duplicates] read still going after ${LIMIT_MS / 60_000} min - stopped`); limit.abort(); running = false; }, LIMIT_MS);
  timer.unref?.();
  void runOnce(limit.signal)
    .then((r) => { if (r) console.log(`[company-duplicates] ${r.error ? `failed: ${r.error}` : `${r.read} companies read in ${r.seconds}s: ${r.sure} same ERP customer, ${r.possible} possible, ${r.merged} merged`}`); })
    .catch((e) => console.warn(`[company-duplicates] ${(e as Error).message}`))
    .finally(() => { clearTimeout(timer); if (!limit.signal.aborted) running = false; });
}
export function startCompanyDuplicates() {
  if (started || process.env.COMPANY_DUPLICATES === "off") return;
  started = true;
  setTimeout(tick, 150_000).unref?.();
  setInterval(tick, TICK_MS).unref?.();
}
