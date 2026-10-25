// CONTACT PHONE - the engine (Map assignment > Phone numbers; rules in rules.ts). Replaces the HubSpot workflow "SARCLA |
// Contact phone number correction" (3078691018), SARCLA 25.10.2026.
//
// Every 15 minutes, one copy of the hub at a time (advisory lock 4107244): every contact with the shop's phone
// (eyemagine_telephone) and no phone - the workflow's list 6612 "SARCLA | PHONE NUMBER LOOK UP INVERSED", ~420 on 25.10 -
// is read and decided; a contact changed in the last 2 minutes waits for the next run (the workflow's own 2-minute wait).
// Writes only in Live AND while the workflow is switched off (never both writing), only a contact that still has no
// phone (read again just before); every write kept with what was there before (kv contactPhone:log:<time>).
// CONTACT_PHONE=off stops the schedule.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { WORKFLOW_ID, decidePhone, type Verdict } from "./rules";

const LOCK = 4_107_244;
const EVERY_MS = 15 * 60_000;
const LIMIT_MS = 12 * 60_000;
/** the most contacts written in one run */
const PER_RUN = 500;
/** the workflow waited 2 minutes after a contact joined its list */
const SETTLE_MS = 2 * 60_000;
const KEEP_WRITTEN_MS = 30 * 86400_000;
const KV = { settings: "contactPhone:settings", state: "contactPhone:state", last: "contactPhone:last" };
const PROPS = ["firstname", "lastname", "email", "eyemagine_telephone", "phone", "country_custom", "country", "createdate", "lastmodifieddate"];

export type Mode = "off" | "shadow" | "live";
export type Settings = { mode: Mode; liveFrom: string | null; by?: string; at?: string };
export type Written = { at: string; phone?: string; error?: string };
export type Row = { id: string; name: string; email: string; shop: string; created: string; checkedAt: string; v: Verdict; written?: Written };
export type State = { at: string; rows: Row[] };
export type RunInfo = { at: string; seconds: number; waiting: number; fillable: number; invalid: number; written: number; live: boolean; error?: string };

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

// ---------------- HubSpot ----------------
/** Every contact with the shop's phone and no phone (the workflow's list), by id. */
async function waitingContacts(): Promise<Obj[]> {
  const out: Obj[] = [];
  let cursor = "0";
  for (let page = 0; page < 500; page++) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/contacts/search", method: "POST", body: {
      filterGroups: [{ filters: [
        { propertyName: "eyemagine_telephone", operator: "HAS_PROPERTY" },
        { propertyName: "phone", operator: "NOT_HAS_PROPERTY" },
        { propertyName: "hs_object_id", operator: "GT", value: cursor },
      ] }],
      properties: PROPS, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200,
    } });
    const res = j.results ?? [];
    out.push(...res);
    if (res.length < 200) break;
    cursor = String(res[res.length - 1].id);
  }
  return out;
}

type Change = { id: string; before: Record<string, string | null>; after: Record<string, string> };
/** Batches of 100; a batch HubSpot refuses is written one by one, so one bad value never stops the rest. */
async function writeContacts(changes: Change[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  for (let i = 0; i < changes.length; i += 100) {
    const chunk = changes.slice(i, i + 100);
    try {
      await hubspotRetry({ path: "/crm/v3/objects/contacts/batch/update", method: "POST", body: { inputs: chunk.map((c) => ({ id: c.id, properties: c.after })) } });
      for (const c of chunk) result.set(c.id, null);
    } catch {
      for (const c of chunk) {
        try { await hubspotRetry({ path: `/crm/v3/objects/contacts/${c.id}`, method: "PATCH", body: { properties: c.after } }); result.set(c.id, null); }
        catch (e) { result.set(c.id, (e as Error).message.slice(0, 160)); }
      }
    }
  }
  return result;
}
/** The contacts that still have no phone right now (read just before writing). */
async function stillWithout(ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/contacts/batch/read", method: "POST", body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: ["phone"] } });
    for (const c of j.results ?? []) if (!String(c.properties.phone ?? "").trim()) out.add(String(c.id));
  }
  return out;
}

// ---------------- the run ----------------
async function run(): Promise<RunInfo> {
  const t0 = Date.now();
  const live = await writing();
  const state = (await kvGet<State>(KV.state)) ?? { at: "", rows: [] };
  const old = new Map(state.rows.map((r) => [r.id, r]));
  const waiting = await waitingContacts();
  const now = new Date().toISOString();
  const rows = new Map<string, Row>();
  const changes: Change[] = [];
  let fillable = 0, invalid = 0;
  for (const c of waiting) {
    const p = c.properties;
    const v = decidePhone({ shop: p.eyemagine_telephone, phone: p.phone, countryCustom: p.country_custom, country: p.country });
    const name = [p.firstname, p.lastname].filter(Boolean).join(" ").trim();
    const row: Row = { id: c.id, name, email: p.email ?? "", shop: p.eyemagine_telephone ?? "", created: p.createdate ?? "", checkedAt: now, v, written: old.get(c.id)?.written?.error ? old.get(c.id)!.written : undefined };
    rows.set(c.id, row);
    if (!v.phone || v.status === "same") { if (v.status === "invalid") invalid++; continue; }
    fillable++;
    // the workflow's 2-minute wait: a contact still being filled in (a form, the shop) waits for the next run
    if (Date.now() - Date.parse(p.lastmodifieddate ?? p.createdate ?? "") < SETTLE_MS) continue;
    changes.push({ id: c.id, before: { phone: p.phone ?? null }, after: { phone: v.phone } });
  }
  let written = 0;
  if (live && changes.length) {
    const todo = changes.slice(0, PER_RUN);
    const free = await stillWithout(todo.map((c) => c.id));
    const go = todo.filter((c) => free.has(c.id));
    const result = await writeContacts(go);
    const ok = go.filter((c) => result.get(c.id) === null);
    if (ok.length) await kvSet(`contactPhone:log:${now}:run`, ok);
    for (const ch of go) {
      const err = result.get(ch.id), row = rows.get(ch.id)!;
      row.written = err ? { at: now, error: err } : { at: now, phone: ch.after.phone };
      if (!err) written++;
    }
  }
  // a contact that has a phone since is no longer searched: the hub's own writes are kept 30 days to be seen
  for (const r of state.rows) if (!rows.has(r.id) && r.written && !r.written.error && Date.now() - Date.parse(r.written.at) < KEEP_WRITTEN_MS) rows.set(r.id, r);
  await kvSet(KV.state, { at: now, rows: [...rows.values()] });
  const info: RunInfo = { at: now, seconds: Math.round((Date.now() - t0) / 1000), waiting: waiting.length, fillable, invalid, written, live };
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
        const info: RunInfo = { at: new Date().toISOString(), seconds: 0, waiting: 0, fillable: 0, invalid: 0, written: 0, live: false, error: (e as Error).message.slice(0, 300) };
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
export function startContactPhone() {
  if (started || process.env.CONTACT_PHONE === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const timer = setTimeout(() => { running = false; }, LIMIT_MS);
    timer.unref?.();
    void runOnce()
      .then((r) => { if (r?.written) console.log(`[contact-phone] ${r.written} phone number(s) written`); if (r?.error) console.warn(`[contact-phone] ${r.error}`); })
      .catch((e) => console.warn(`[contact-phone] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); running = false; });
  };
  setTimeout(tick, 230_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

// ---------------- the state the page reads ----------------
export async function pageState() {
  const [settings, last, state, on] = await Promise.all([getSettings(), kvGet<RunInfo>(KV.last), kvGet<State>(KV.state), workflowOn()]);
  return { settings, last: last ?? null, state: state ?? { at: "", rows: [] }, workflowOn: on, writing: settings.mode === "live" && on === false };
}
