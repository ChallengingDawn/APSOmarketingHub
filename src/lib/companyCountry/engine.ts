// DUPLICATES & MERGES > Companies > Country - the engine (the rule in rules.ts). Replaces the HubSpot workflow "SARCLA | REGION TO COUNTRY
// CUSTOM" (3500481774, the last ON workflow of the legacy app SARCLA | COMPANY SEGMENTATION, secret COMPANYSEG),
// SARCLA 11.11.2026.
//
// Every 15 minutes, one copy of the hub at a time (advisory lock 4107286): every company with a country and no
// country_custom is read (18 on 11.11.2026, each one the workflow had failed on); one created or changed in the last
// 2 minutes waits for the next run. A country the rule is sure of gets its dropdown value, each company read again just
// before (written only while country_custom is still empty and the country unchanged); the others are listed for a
// person, who picks the value (setCountry). Every write kept (kv companyCountry:log:<time>). Writes only in Live AND
// while the workflow is switched off (never both writing); Live unless paused, as the other plain property jobs.
// COMPANY_COUNTRY=off stops the schedule.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { PROPERTY, SOURCE, WORKFLOW_ID, buildIndex, decideCountry, type CountryIndex } from "./rules";

const LOCK = 4_107_286;
const EVERY_MS = 15 * 60_000;
const LIMIT_MS = 12 * 60_000;
const PER_RUN = 1000;
const SETTLE_MS = 2 * 60_000;
const KEEP_WRITTEN_MS = 30 * 86400_000;
const OPTIONS_MS = 6 * 3600_000;
const KV = { settings: "companyCountry:settings", state: "companyCountry:state", last: "companyCountry:last" };
const PROPS = ["name", SOURCE, PROPERTY, "city", "createdate", "hs_lastmodifieddate"];

export type Mode = "off" | "shadow" | "live";
export type Settings = { mode: Mode; liveFrom: string | null; by?: string; at?: string };
export type Row = {
  id: string; name: string; country: string; city: string; created: string;
  /** The dropdown's value the rule found, or nothing (then a person picks). */
  value: string | null; reason?: "unknown" | "two";
  written?: { at: string; value: string; by: string; error?: string };
};
export type State = { at: string; withCountry: number; withValue: number; rows: Row[] };
export type RunInfo = { at: string; seconds: number; without: number; sure: number; written: number; live: boolean; error?: string };

type Obj = { id: string; properties: Record<string, string | null> };

// ---------------- settings, the workflow, the dropdown ----------------
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
let optCache: { at: number; options: string[]; idx: CountryIndex } | null = null;
/** The dropdown's values (read from HubSpot, 6 h) and the index of every way of writing them. */
export async function dropdown(): Promise<{ options: string[]; idx: CountryIndex }> {
  if (optCache && Date.now() - optCache.at < OPTIONS_MS) return optCache;
  const p = await hubspotRetry<{ options?: { value: string; hidden?: boolean }[] }>({ path: `/crm/v3/properties/companies/${PROPERTY}` });
  const options = (p.options ?? []).filter((o) => !o.hidden && o.value).map((o) => o.value);
  if (!options.length) throw new Error(`the dropdown ${PROPERTY} has no values`);
  optCache = { at: Date.now(), options, idx: buildIndex(options) };
  return optCache;
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
async function count(filters: Record<string, unknown>[]): Promise<number> {
  const j = await hubspotRetry<{ total?: number }>({ path: "/crm/v3/objects/companies/search", method: "POST", body: { filterGroups: [{ filters }], properties: ["name"], limit: 1 } });
  return Number(j.total ?? 0);
}
async function readNow(ids: string[]): Promise<Map<string, Obj>> {
  const out = new Map<string, Obj>();
  for (let i = 0; i < ids.length; i += 100) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/companies/batch/read", method: "POST", body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: [SOURCE, PROPERTY] } });
    for (const c of j.results ?? []) out.set(String(c.id), c);
  }
  return out;
}
async function writeValues(items: { id: string; value: string }[]): Promise<{ ok: Set<string>; errors: Map<string, string> }> {
  const ok = new Set<string>(), errors = new Map<string, string>();
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100);
    try {
      await hubspotRetry({ path: "/crm/v3/objects/companies/batch/update", method: "POST", body: { inputs: chunk.map((r) => ({ id: r.id, properties: { [PROPERTY]: r.value } })) } });
      for (const r of chunk) ok.add(r.id);
    } catch {
      for (const r of chunk) {
        try { await hubspotRetry({ path: `/crm/v3/objects/companies/${r.id}`, method: "PATCH", body: { properties: { [PROPERTY]: r.value } } }); ok.add(r.id); }
        catch (e) { errors.set(r.id, (e as Error).message.slice(0, 160)); }
      }
    }
  }
  return { ok, errors };
}

// ---------------- the run ----------------
async function run(): Promise<RunInfo> {
  const t0 = Date.now();
  const live = await writing();
  const { idx } = await dropdown();
  const state = await kvGet<State>(KV.state);
  const without = await search([{ propertyName: SOURCE, operator: "HAS_PROPERTY" }, { propertyName: PROPERTY, operator: "NOT_HAS_PROPERTY" }]);
  const now = new Date().toISOString();
  const old = new Map((state?.rows ?? []).map((r) => [r.id, r]));
  const rows: Row[] = [];
  const todo: Row[] = [];
  for (const c of without) {
    const p = c.properties;
    const v = decideCountry(p[SOURCE], idx);
    const prev = old.get(c.id)?.written;
    const row: Row = {
      id: c.id, name: p.name ?? "", country: (p[SOURCE] ?? "").trim(), city: p.city ?? "", created: p.createdate ?? "",
      value: v.status === "sure" ? v.value : null, ...(v.status === "check" ? { reason: v.reason } : {}), ...(prev?.error ? { written: prev } : {}),
    };
    rows.push(row);
    if (row.value && Date.now() - Date.parse(p.hs_lastmodifieddate ?? p.createdate ?? "") >= SETTLE_MS) todo.push(row);
  }
  let written = 0;
  if (live && todo.length) {
    const batch = todo.slice(0, PER_RUN);
    // read again just before: a value someone set since, or a country changed since, is left as it is
    const fresh = await readNow(batch.map((r) => r.id));
    const go = batch.filter((r) => { const c = fresh.get(r.id); return c && !String(c.properties[PROPERTY] ?? "").trim() && (c.properties[SOURCE] ?? "").trim() === r.country; });
    const { ok, errors } = await writeValues(go.map((r) => ({ id: r.id, value: r.value! })));
    for (const r of go) r.written = ok.has(r.id) ? { at: now, value: r.value!, by: "the hub" } : { at: now, value: r.value!, by: "the hub", error: errors.get(r.id) };
    written = ok.size;
    if (ok.size) await kvSet(`companyCountry:log:${now}`, go.filter((r) => ok.has(r.id)).map((r) => ({ id: r.id, country: r.country, before: { [PROPERTY]: null }, after: { [PROPERTY]: r.value } })));
  }
  // the hub's own writes and a person's picks are kept 30 days to be seen (a company with its value is no longer searched)
  const listed = new Set(rows.map((r) => r.id));
  const kept = (state?.rows ?? []).filter((r) => r.written && !r.written.error && !listed.has(r.id) && Date.now() - Date.parse(r.written.at) < KEEP_WRITTEN_MS);
  const [withCountry, withValue] = await Promise.all([count([{ propertyName: SOURCE, operator: "HAS_PROPERTY" }]), count([{ propertyName: PROPERTY, operator: "HAS_PROPERTY" }])]);
  await kvSet(KV.state, { at: now, withCountry, withValue, rows: [...rows, ...kept] } satisfies State);
  const info: RunInfo = { at: now, seconds: Math.round((Date.now() - t0) / 1000), without: without.length, sure: todo.length, written, live };
  await kvSet(KV.last, info);
  return info;
}

/** A person picks the value for one company (the page's "Set"): only a dropdown value, only while it has none. */
export async function setCountry(id: string, value: string, by: string): Promise<{ ok: boolean; error?: string }> {
  const { options } = await dropdown();
  if (!options.includes(value)) return { ok: false, error: `"${value}" is not one of the dropdown's values` };
  const c = (await readNow([id])).get(id);
  if (!c) return { ok: false, error: "company not found" };
  const had = String(c.properties[PROPERTY] ?? "").trim();
  if (had) return { ok: false, error: `it has "${had}" already - changed in HubSpot since` };
  const { ok, errors } = await writeValues([{ id, value }]);
  if (!ok.has(id)) return { ok: false, error: errors.get(id) ?? "not written" };
  const now = new Date().toISOString();
  await kvSet(`companyCountry:log:${now}`, [{ id, country: (c.properties[SOURCE] ?? "").trim(), before: { [PROPERTY]: null }, after: { [PROPERTY]: value }, by }]);
  const state = await kvGet<State>(KV.state);
  if (state) {
    const rows = state.rows.map((r) => (r.id === id ? { ...r, value, written: { at: now, value, by } } : r));
    await kvSet(KV.state, { ...state, rows } satisfies State);
  }
  return { ok: true };
}

export async function runOnce(): Promise<RunInfo | null> {
  if ((await getSettings()).mode === "off") return null;
  const client: PoolClient = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await run().catch(async (e) => {
        const info: RunInfo = { at: new Date().toISOString(), seconds: 0, without: 0, sure: 0, written: 0, live: false, error: (e as Error).message.slice(0, 300) };
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
export function startCompanyCountry() {
  if (started || process.env.COMPANY_COUNTRY === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const timer = setTimeout(() => { running = false; }, LIMIT_MS);
    timer.unref?.();
    void runOnce()
      .then((r) => {
        if (r?.written) console.log(`[company-country] ${r.written} country value(s) written, ${r.without - r.written} still without one`);
        if (r?.error) console.warn(`[company-country] ${r.error}`);
      })
      .catch((e) => console.warn(`[company-country] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); running = false; });
  };
  setTimeout(tick, 310_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

// ---------------- the state the page reads ----------------
export async function pageState() {
  const [settings, last, state, on, dd] = await Promise.all([getSettings(), kvGet<RunInfo>(KV.last), kvGet<State>(KV.state), workflowOn(), dropdown().catch(() => null)]);
  return { settings, last: last ?? null, state: state ?? null, workflowOn: on, writing: settings.mode === "live" && on === false, options: dd?.options ?? [] };
}
