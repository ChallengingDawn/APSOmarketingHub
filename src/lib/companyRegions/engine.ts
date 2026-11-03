// COMPANY REGIONS - the engine (Map assignment > Regions; the values in src/lib/mapAssign/regionsProp.ts). Replaces the
// HubSpot workflow "SARCLA | REGIONS SET" (3134893257), SARCLA 03.11.2026: "can we then proceed to this migration? also
// I think data is not entirely correct" - 3,918 of the 57,322 companies of its eight countries had a wrong region
// (the workflow guessed from the postcode's first two digits).
//
// Every 15 minutes, one copy of the hub at a time (advisory lock 4107249): the companies of the eight countries changed
// since the last look (a search on hs_lastmodifieddate) get the region of their postcode - the official one (GeoNames'
// postal codes, public/geo/regions/regions.json), else the map's. A value is never taken away; an empty one with no
// postcode region gets the workflow's "ZIP CODE UNKOWN". Writes only in Live AND while the workflow is switched off;
// every write is kept with what was there before (kv companyRegions:log:<time>:<job>). Two jobs an admin starts from
// the tab: "Check all" (every company of the eight countries read, the ones to correct listed - writes nothing) and
// "Correct them" (that list written, each company read again first). COMPANY_REGIONS=off stops the schedule.

import path from "node:path";
import { readFile } from "node:fs/promises";
import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { EMPTY_ZIP_INDEX, placeZip, zipIndex, type ZipIndex } from "@/lib/mapAssign/plan";
import { REGION_COUNTRIES, regionsFor, regionsToWrite, type RegionsAnswer, type RegionsTable } from "@/lib/mapAssign/regionsProp";

export const WORKFLOW_ID = "3134893257";
const LOCK = 4_107_249;
const EVERY_MS = 15 * 60_000;
const LIMIT_MS = 12 * 60_000;
/** the first look after a deploy goes back a day; then each look from the one before, with two minutes' overlap */
const FIRST_LOOK_MS = 86400_000;
const OVERLAP_MS = 2 * 60_000;
const RECENT_KEPT = 300;
const KV = { settings: "companyRegions:settings", state: "companyRegions:state", last: "companyRegions:last", check: "companyRegions:check", correct: "companyRegions:correct" };
const PROPS = ["name", "zip", "city", "country_custom", "regions", "hs_lastmodifieddate"];
/** The workflow's eight countries as HubSpot's country_custom writes them. */
export const COUNTRY_CC: Record<string, string> = {
  Austria: "AT", Switzerland: "CH", Germany: "DE", France: "FR", Italy: "IT", Liechtenstein: "LI", Netherlands: "NL", Poland: "PL",
};

export type Mode = "off" | "shadow" | "live";
export type Settings = { mode: Mode; liveFrom: string | null; by?: string; at?: string };
/** A company whose region the hub would change: what it has, what it gets and from where. */
export type Fix = {
  id: string; name: string; cc: string; zip: string; city: string; now: string | null; to: string; via: "postcode" | "map" | "none";
  /** skipped: read again before writing, nothing to change any more (its postcode or region changed since) */
  written?: { at: string; error?: string; skipped?: boolean };
};
export type CountryCount = { companies: number; right: number; fix: number; none: number };
export type RunInfo = { at: string; seconds: number; since: string; looked: number; fix: number; written: number; live: boolean; error?: string };
export type State = { at: string; recent: Fix[] };
export type Check = {
  running: boolean; startedAt: string | null; beatAt: string | null; progress: string; at: string | null; by?: string; error?: string;
  total: number; byCountry: Record<string, CountryCount>; fixes: Fix[];
};
export type Correcting = { running: boolean; startedAt: string | null; beatAt: string | null; done: number; of: number; errors: number; skipped: number; at: string | null; by?: string };

type Obj = { id: string; properties: Record<string, string | null> };

// ---------------- settings, the workflow ----------------
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
/** The old workflow switched on? null = could not be read (then nothing is written). */
export async function workflowOn(): Promise<boolean | null> {
  if (wfCache && Date.now() - wfCache.at < 2 * 60_000) return wfCache.on;
  let on: boolean | null = null;
  try { on = !!(await hubspotRetry<{ isEnabled?: boolean }>({ path: `/automation/v4/flows/${WORKFLOW_ID}` })).isEnabled; } catch { on = null; }
  wfCache = { at: Date.now(), on };
  return on;
}
export async function writing(): Promise<boolean> {
  return (await getSettings()).mode === "live" && (await workflowOn()) === false;
}

// ---------------- the region of a company ----------------
type Geo = { table: RegionsTable; points: Map<string, ZipIndex> };
let geoCache: Promise<Geo> | null = null;
/** The official table and the eight countries' postcode points (public/geo), read once per copy of the hub. */
function geo(): Promise<Geo> {
  geoCache ??= (async () => {
    const dir = path.join(process.cwd(), "public", "geo");
    const table = JSON.parse(await readFile(path.join(dir, "regions", "regions.json"), "utf8")) as RegionsTable;
    const points = new Map<string, ZipIndex>();
    for (const cc of REGION_COUNTRIES) {
      try { points.set(cc, zipIndex((JSON.parse(await readFile(path.join(dir, "postcodes", `${cc}.json`), "utf8")) as { points?: unknown }).points)); }
      catch { points.set(cc, EMPTY_ZIP_INDEX); }
    }
    return { table, points };
  })().catch((e) => { geoCache = null; throw e; });
  return geoCache;
}
/** What the hub gives a company, and whether that changes its value (null = nothing to write). */
function judge(g: Geo, c: Obj): { cc: string; answer: RegionsAnswer; write: string | null } | null {
  const cc = COUNTRY_CC[String(c.properties.country_custom ?? "").trim()];
  if (!cc) return null;
  const zip = c.properties.zip;
  const answer = regionsFor(g.table, cc, zip, placeZip(g.points.get(cc) ?? EMPTY_ZIP_INDEX, zip)?.region ?? null, c.properties.city);
  return { cc, answer, write: regionsToWrite(c.properties.regions, answer) };
}
const fixOf = (c: Obj, cc: string, answer: RegionsAnswer, to: string): Fix => ({
  id: String(c.id), name: c.properties.name ?? "", cc, zip: c.properties.zip ?? "", city: c.properties.city ?? "",
  now: c.properties.regions || null, to, via: answer?.via ?? "none",
});

// ---------------- HubSpot ----------------
const COUNTRY_FILTER = { propertyName: "country_custom", operator: "IN", values: Object.keys(COUNTRY_CC) };
async function searchAll(filters: Record<string, unknown>[], beat?: (n: number) => Promise<void> | void): Promise<Obj[]> {
  const out: Obj[] = [];
  let cursor = "0";
  for (let page = 0; page < 2000; page++) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/companies/search", method: "POST", body: {
      filterGroups: [{ filters: [...filters, { propertyName: "hs_object_id", operator: "GT", value: cursor }] }],
      properties: PROPS, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200,
    } });
    const res = j.results ?? [];
    out.push(...res);
    await beat?.(out.length);
    if (res.length < 200) break;
    cursor = String(res[res.length - 1].id);
  }
  return out;
}
type Change = { id: string; before: { regions: string | null }; after: { regions: string } };
/** Batches of 100; a batch HubSpot refuses is written one by one, so one bad value never stops the rest. */
async function writeCompanies(changes: Change[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  for (let i = 0; i < changes.length; i += 100) {
    const chunk = changes.slice(i, i + 100);
    try {
      await hubspotRetry({ path: "/crm/v3/objects/companies/batch/update", method: "POST", body: { inputs: chunk.map((c) => ({ id: c.id, properties: c.after })) } });
      for (const c of chunk) result.set(c.id, null);
    } catch {
      for (const c of chunk) {
        try { await hubspotRetry({ path: `/crm/v3/objects/companies/${c.id}`, method: "PATCH", body: { properties: c.after } }); result.set(c.id, null); }
        catch (e) { result.set(c.id, (e as Error).message.slice(0, 160)); }
      }
    }
  }
  return result;
}
async function log(job: string, changes: Change[], result: Map<string, string | null>) {
  const entries = changes.filter((c) => result.get(c.id) === null);
  if (entries.length) await kvSet(`companyRegions:log:${new Date().toISOString()}:${job}`, entries);
}

// ---------------- the run: the companies changed since the last look ----------------
async function run(): Promise<RunInfo> {
  const t0 = Date.now();
  const live = await writing();
  const g = await geo();
  const last = await kvGet<RunInfo>(KV.last);
  const since = new Date(last?.at && !last.error ? Date.parse(last.at) - OVERLAP_MS : Date.now() - FIRST_LOOK_MS).toISOString();
  const now = new Date(t0).toISOString();
  const changed = await searchAll([COUNTRY_FILTER, { propertyName: "hs_lastmodifieddate", operator: "GTE", value: String(Date.parse(since)) }]);
  const fixes: Fix[] = [];
  for (const c of changed) {
    const j = judge(g, c);
    if (j?.write) fixes.push(fixOf(c, j.cc, j.answer, j.write));
  }
  let written = 0;
  if (live && fixes.length) {
    const changes = fixes.map((f) => ({ id: f.id, before: { regions: f.now }, after: { regions: f.to } }));
    const result = await writeCompanies(changes);
    await log("run", changes, result);
    for (const f of fixes) { const err = result.get(f.id); f.written = err ? { at: now, error: err } : { at: now }; if (!err) written++; }
  }
  const state = (await kvGet<State>(KV.state)) ?? { at: "", recent: [] };
  const ids = new Set(fixes.map((f) => f.id));
  await kvSet(KV.state, { at: now, recent: [...fixes, ...state.recent.filter((f) => !ids.has(f.id))].slice(0, RECENT_KEPT) });
  const info: RunInfo = { at: now, seconds: Math.round((Date.now() - t0) / 1000), since, looked: changed.length, fix: fixes.length, written, live };
  await kvSet(KV.last, info);
  return info;
}

export async function runOnce(): Promise<RunInfo | null> {
  if ((await getSettings()).mode === "off") return null;
  const client: PoolClient = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await run().catch(async (e) => {
        const prev = await kvGet<RunInfo>(KV.last);
        // a failed look keeps the last good one's time, so the next look still starts from there
        const info: RunInfo = { at: prev?.at ?? new Date().toISOString(), seconds: 0, since: prev?.since ?? "", looked: 0, fix: 0, written: 0, live: false, error: (e as Error).message.slice(0, 300) };
        await kvSet(KV.last, info);
        return info;
      });
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

let started = false, running = false;
export function startCompanyRegions() {
  if (started || process.env.COMPANY_REGIONS === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const timer = setTimeout(() => { running = false; }, LIMIT_MS);
    timer.unref?.();
    void runOnce()
      .catch((e) => console.warn(`[company-regions] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); running = false; });
  };
  setTimeout(tick, 230_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

// ---------------- the state the page reads ----------------
export async function pageState() {
  const [settings, last, state, check, correcting, on] = await Promise.all([
    getSettings(), kvGet<RunInfo>(KV.last), kvGet<State>(KV.state), kvGet<Check>(KV.check), kvGet<Correcting>(KV.correct), workflowOn(),
  ]);
  return {
    settings, last: last ?? null, state: state ?? { at: "", recent: [] }, check: check ?? null, correcting: correcting ?? null,
    workflowOn: on, writing: settings.mode === "live" && on === false,
  };
}

// ---------------- the two jobs ----------------
const BEAT_STALE_MS = 3 * 60_000;
const alive = (j: { running: boolean; beatAt: string | null } | null | undefined) => !!j?.running && Date.now() - Date.parse(j.beatAt ?? "") < BEAT_STALE_MS;

/** "Check all": every company of the eight countries (~57,000, a few minutes) - counted per country, the ones to
 *  correct listed. Writes nothing to HubSpot. */
export async function startCheck(by: string): Promise<{ started: boolean; why?: string }> {
  const cur = await kvGet<Check>(KV.check);
  if (alive(cur)) return { started: false, why: "already checking" };
  if (alive(await kvGet<Correcting>(KV.correct))) return { started: false, why: "the corrections are being written - wait for them" };
  const c: Check = { running: true, startedAt: new Date().toISOString(), beatAt: new Date().toISOString(), progress: "starting", at: cur?.at ?? null, by, total: cur?.total ?? 0, byCountry: cur?.byCountry ?? {}, fixes: cur?.fixes ?? [] };
  await kvSet(KV.check, c);
  void (async () => {
    try {
      const g = await geo();
      const all = await searchAll([COUNTRY_FILTER], async (n) => {
        if (n % 2000 === 0) { c.beatAt = new Date().toISOString(); c.progress = `${n.toLocaleString("de-CH")} companies read`; await kvSet(KV.check, c); }
      });
      const byCountry: Record<string, CountryCount> = {};
      const fixes: Fix[] = [];
      for (const co of all) {
        const j = judge(g, co);
        if (!j) continue;
        const k = (byCountry[j.cc] ??= { companies: 0, right: 0, fix: 0, none: 0 });
        k.companies++;
        // each company in one count only: to correct, else right, else no postcode region (its value kept)
        if (j.write) { k.fix++; fixes.push(fixOf(co, j.cc, j.answer, j.write)); } else if (j.answer) k.right++; else k.none++;
      }
      Object.assign(c, { running: false, beatAt: new Date().toISOString(), progress: "done", at: new Date().toISOString(), total: all.length, byCountry, fixes, error: undefined });
      await kvSet(KV.check, c);
    } catch (e) {
      Object.assign(c, { running: false, beatAt: new Date().toISOString(), progress: "stopped", error: (e as Error).message.slice(0, 300) });
      await kvSet(KV.check, c);
    }
  })();
  return { started: true };
}

/** "Correct them": the last check's list written, 100 at a time - each company read again first (its postcode or
 *  region may have changed since the check). Live only, with the workflow switched off. */
export async function startCorrect(by: string): Promise<{ started: boolean; why?: string }> {
  if (!(await writing())) return { started: false, why: "Live, with the workflow switched off, only" };
  const check = await kvGet<Check>(KV.check);
  if (!check?.at || alive(check)) return { started: false, why: "check all first" };
  if (alive(await kvGet<Correcting>(KV.correct))) return { started: false, why: "already writing" };
  const todo = check.fixes.filter((f) => !f.written || f.written.error);
  const c: Correcting = { running: true, startedAt: new Date().toISOString(), beatAt: new Date().toISOString(), done: 0, of: todo.length, errors: 0, skipped: 0, at: null, by };
  await kvSet(KV.correct, c);
  void (async () => {
    try {
      const g = await geo();
      for (let i = 0; i < todo.length; i += 100) {
        const chunk = todo.slice(i, i + 100);
        const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/companies/batch/read", method: "POST", body: { inputs: chunk.map((f) => ({ id: f.id })), properties: PROPS } });
        const changes: Change[] = [];
        for (const co of j.results ?? []) {
          const v = judge(g, co);
          if (v?.write) changes.push({ id: String(co.id), before: { regions: co.properties.regions || null }, after: { regions: v.write } });
        }
        const result = changes.length ? await writeCompanies(changes) : new Map<string, string | null>();
        await log("correct", changes, result);
        const at = new Date().toISOString();
        for (const f of chunk) {
          const ch = changes.find((x) => x.id === f.id);
          if (!ch) { c.skipped++; f.written = { at, skipped: true }; continue; }
          const err = result.get(f.id);
          f.to = ch.after.regions;
          f.written = err ? { at, error: err } : { at };
          if (err) c.errors++; else c.done++;
        }
        c.beatAt = at;
        await kvSet(KV.correct, c);
        await kvSet(KV.check, check);
      }
      Object.assign(c, { running: false, beatAt: new Date().toISOString(), at: new Date().toISOString() });
      await kvSet(KV.correct, c);
    } catch (e) {
      Object.assign(c, { running: false, beatAt: new Date().toISOString(), at: new Date().toISOString() });
      c.errors++;
      await kvSet(KV.correct, c);
      console.warn(`[company-regions] correct: ${(e as Error).message}`);
    }
  })();
  return { started: true };
}
