// COMPANY DATA > Google Maps link - the engine (the rule in rules.ts). Replaces the HubSpot workflow "SARCLA | GMAPS QUERY
// WITH CODE" (2865179896), SARCLA 10.11.2026.
//
// Every 15 minutes, one copy of the hub at a time (advisory lock 4107285): every company without a Google Maps link
// (3,529 on 10.11 - 3,462 of them from the load of 14.02.2026, which the workflow never reached) is read; one created or
// changed in the last 3 minutes waits for the next run (the workflow's own 3-minute wait, for its address to arrive);
// the others get their link, 1,000 a run, each read again just before (written only while it still has none). Every
// write kept (kv companyMaps:log:<time>). Writes only in Live AND while the workflow is switched off (never both
// writing); Live unless paused, as the other plain property jobs. COMPANY_MAPS=off stops the schedule.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { ADDRESS, PROPERTY, WORKFLOW_ID, mapsLink, mapsQuery } from "./rules";

const LOCK = 4_107_285;
const EVERY_MS = 15 * 60_000;
const LIMIT_MS = 12 * 60_000;
const PER_RUN = 1000;
const SETTLE_MS = 3 * 60_000;
const KEEP_WRITTEN_MS = 30 * 86400_000;
const KV = { settings: "companyMaps:settings", state: "companyMaps:state", last: "companyMaps:last" };
const PROPS = ["name", ...ADDRESS, "createdate", "hs_lastmodifieddate"];

export type Mode = "off" | "shadow" | "live";
export type Settings = { mode: Mode; liveFrom: string | null; by?: string; at?: string };
export type Row = { id: string; name: string; query: string; link: string; created: string; written?: { at: string; error?: string } };
export type State = { at: string; companies: number; withLink: number; rows: Row[] };
export type RunInfo = { at: string; seconds: number; without: number; written: number; live: boolean; error?: string };

type Obj = { id: string; properties: Record<string, string | null> };

// ---------------- settings, the workflow ----------------
export async function getSettings(): Promise<Settings> {
  return (await kvGet<Settings>(KV.settings)) ?? { mode: "live", liveFrom: null };
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

// ---------------- HubSpot ----------------
async function search(filters: Record<string, unknown>[]): Promise<Obj[]> {
  const out: Obj[] = [];
  let cursor = "0";
  for (let page = 0; page < 500; page++) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/companies/search", method: "POST", body: {
      filterGroups: [{ filters: [...filters, { propertyName: "hs_object_id", operator: "GT", value: cursor }] }],
      properties: PROPS, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200,
    } });
    const res = j.results ?? [];
    out.push(...res);
    if (res.length < 200) break;
    cursor = String(res[res.length - 1].id);
  }
  return out;
}
/** How many companies match (HubSpot's total of a one-row search). */
async function count(filters: Record<string, unknown>[]): Promise<number> {
  const j = await hubspotRetry<{ total?: number }>({ path: "/crm/v3/objects/companies/search", method: "POST", body: { filterGroups: [{ filters }], properties: ["name"], limit: 1 } });
  return Number(j.total ?? 0);
}

// ---------------- the run ----------------
async function run(): Promise<RunInfo> {
  const t0 = Date.now();
  const live = await writing();
  const state = await kvGet<State>(KV.state);
  const without = await search([{ propertyName: PROPERTY, operator: "NOT_HAS_PROPERTY" }]);
  const now = new Date().toISOString();
  const old = new Map((state?.rows ?? []).map((r) => [r.id, r]));
  const rows: Row[] = [];
  const todo: Row[] = [];
  for (const c of without) {
    const p = c.properties;
    const prev = old.get(c.id)?.written;
    const row: Row = { id: c.id, name: p.name ?? "", query: mapsQuery(p), link: mapsLink(p), created: p.createdate ?? "", ...(prev?.error ? { written: prev } : {}) };
    rows.push(row);
    if (row.link && Date.now() - Date.parse(p.hs_lastmodifieddate ?? p.createdate ?? "") >= SETTLE_MS) todo.push(row);
  }
  let written = 0;
  if (live && todo.length) {
    const batch = todo.slice(0, PER_RUN);
    // read again just before: a link someone set since is left as it is
    const still = new Set<string>();
    for (let i = 0; i < batch.length; i += 100) {
      const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/companies/batch/read", method: "POST", body: { inputs: batch.slice(i, i + 100).map((r) => ({ id: r.id })), properties: [PROPERTY] } });
      for (const c of j.results ?? []) if (!String(c.properties[PROPERTY] ?? "").trim()) still.add(String(c.id));
    }
    const go = batch.filter((r) => still.has(r.id));
    const ok: Row[] = [];
    for (let i = 0; i < go.length; i += 100) {
      const chunk = go.slice(i, i + 100);
      try {
        await hubspotRetry({ path: "/crm/v3/objects/companies/batch/update", method: "POST", body: { inputs: chunk.map((r) => ({ id: r.id, properties: { [PROPERTY]: r.link } })) } });
        ok.push(...chunk);
      } catch {
        for (const r of chunk) {
          try { await hubspotRetry({ path: `/crm/v3/objects/companies/${r.id}`, method: "PATCH", body: { properties: { [PROPERTY]: r.link } } }); ok.push(r); }
          catch (e) { r.written = { at: now, error: (e as Error).message.slice(0, 160) }; }
        }
      }
    }
    for (const r of ok) r.written = { at: now };
    written = ok.length;
    if (ok.length) await kvSet(`companyMaps:log:${now}`, ok.map((r) => ({ id: r.id, before: { [PROPERTY]: null }, after: { [PROPERTY]: r.link } })));
  }
  // the hub's own writes are kept 30 days to be seen (a company with its link is no longer searched)
  const listed = new Set(rows.map((r) => r.id));
  const kept = (state?.rows ?? []).filter((r) => r.written && !r.written.error && !listed.has(r.id) && Date.now() - Date.parse(r.written.at) < KEEP_WRITTEN_MS);
  const [companies, withLink] = await Promise.all([count([{ propertyName: "hs_object_id", operator: "HAS_PROPERTY" }]), count([{ propertyName: PROPERTY, operator: "HAS_PROPERTY" }])]);
  await kvSet(KV.state, { at: now, companies, withLink, rows: [...rows, ...kept] } satisfies State);
  const info: RunInfo = { at: now, seconds: Math.round((Date.now() - t0) / 1000), without: without.length, written, live };
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
        const info: RunInfo = { at: new Date().toISOString(), seconds: 0, without: 0, written: 0, live: false, error: (e as Error).message.slice(0, 300) };
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
export function startCompanyMaps() {
  if (started || process.env.COMPANY_MAPS === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const timer = setTimeout(() => { running = false; }, LIMIT_MS);
    timer.unref?.();
    void runOnce()
      .then((r) => { if (r?.written) console.log(`[company-maps] ${r.written} Google Maps link(s) written`); if (r?.error) console.warn(`[company-maps] ${r.error}`); })
      .catch((e) => console.warn(`[company-maps] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); running = false; });
  };
  setTimeout(tick, 290_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

// ---------------- the state the page reads ----------------
export async function pageState() {
  const [settings, last, state, on] = await Promise.all([getSettings(), kvGet<RunInfo>(KV.last), kvGet<State>(KV.state), workflowOn()]);
  return { settings, last: last ?? null, state: state ?? null, workflowOn: on, writing: settings.mode === "live" && on === false };
}
