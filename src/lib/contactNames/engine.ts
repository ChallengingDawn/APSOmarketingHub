// CONTACT NAMES - the engine (Duplicates & merges > Contacts > Name letters; rules in rules.ts). Replaces the HubSpot
// workflow "SARCLA | CONTACT NAME | UTF-8 CORRECT BY CODE" (2865279175), SARCLA 10.11.2026 ("this is a small tab on
// contact duplicate").
//
// Every 15 minutes, one copy of the hub at a time (advisory lock 4107283): the contacts of HubSpot's list 5943 (first or
// last name with Ã, Â, â, �, ¢ … - 69 on 10.11; HubSpot's search cannot look for these letters, its list can) are read
// and decided. A sure repair (no broken letter left in the field) is written by the hub itself, a contact changed in the
// last 2 minutes waits for the next run, each name is read again just before it is written (only while still the same),
// and every write is kept with what was there before (kv contactNames:log:<time>). Writes only in Live AND while the
// workflow is switched off (never both writing). The rest is listed for a person, who types the right name or says
// "the name is right" (João, O'Reilly - HubSpot's list flags them too). Live unless paused, as Phone numbers
// (SARCLA 25.10.2026: "this should be correct once and then automatic"). CONTACT_NAMES=off stops the schedule.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { LIST_ID, WORKFLOW_ID, decideName, isBroken, type NameVerdict } from "./rules";

const LOCK = 4_107_283;
const EVERY_MS = 15 * 60_000;
const LIMIT_MS = 10 * 60_000;
/** a contact still being filled in (a form, the shop) waits for the next run */
const SETTLE_MS = 2 * 60_000;
const PER_RUN = 500;
const KEEP_WRITTEN_MS = 30 * 86400_000;
const KV = { settings: "contactNames:settings", state: "contactNames:state", last: "contactNames:last", right: "contactNames:right" };
const PROPS = ["firstname", "lastname", "email", "createdate", "lastmodifieddate"];

export type Mode = "off" | "shadow" | "live";
export type Settings = { mode: Mode; liveFrom: string | null; by?: string; at?: string };
export type Written = { at: string; first?: string; last?: string; error?: string; by?: string; /** the name before ("first last") */ before?: string };
export type Row = { id: string; first: string; last: string; email: string; created: string; checkedAt: string; v: NameVerdict; written?: Written };
export type State = { at: string; rows: Row[] };
export type RunInfo = { at: string; seconds: number; listed: number; sure: number; check: number; written: number; live: boolean; error?: string };
/** contact id -> the name ("first|last") a person said is right; a name changed since comes back to the list */
export type Right = Record<string, { name: string; at: string; by: string }>;

type Obj = { id: string; properties: Record<string, string | null> };
export const nameKey = (first: string, last: string) => `${first.trim()}|${last.trim()}`;

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
/** The list's contacts, by id. */
async function listed(): Promise<string[]> {
  const ids: string[] = [];
  let after: string | undefined;
  for (let page = 0; page < 200; page++) {
    const j = await hubspotRetry<{ results?: ({ recordId?: string | number } | string | number)[]; paging?: { next?: { after?: string } } }>({
      path: `/crm/v3/lists/${LIST_ID}/memberships?limit=250${after ? `&after=${encodeURIComponent(after)}` : ""}`,
    });
    for (const r of j.results ?? []) ids.push(String(typeof r === "object" ? r.recordId : r));
    after = j.paging?.next?.after;
    if (!after) break;
  }
  return ids.filter((x) => /^\d+$/.test(x));
}
async function readContacts(ids: string[], props: string[]): Promise<Obj[]> {
  const out: Obj[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/contacts/batch/read", method: "POST", body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: props } });
    out.push(...(j.results ?? []));
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

// ---------------- the run ----------------
async function run(): Promise<RunInfo> {
  const t0 = Date.now();
  const live = await writing();
  const state = (await kvGet<State>(KV.state)) ?? { at: "", rows: [] };
  const old = new Map(state.rows.map((r) => [r.id, r]));
  const ids = await listed();
  const contacts = await readContacts(ids, PROPS);
  const now = new Date().toISOString();
  const rows = new Map<string, Row>();
  const changes: Change[] = [];
  let sure = 0, check = 0;
  for (const c of contacts) {
    const p = c.properties;
    const first = (p.firstname ?? "").trim(), last = (p.lastname ?? "").trim();
    const v = decideName(first, last);
    const prev = old.get(c.id)?.written;
    const keep = !!prev && (!!prev.error || Date.now() - Date.parse(prev.at) < KEEP_WRITTEN_MS);
    rows.set(c.id, { id: c.id, first, last, email: p.email ?? "", created: p.createdate ?? "", checkedAt: now, v, written: keep ? prev : undefined });
    if (v.status === "sure") sure++; else check++;
    if (!Object.keys(v.write).length) continue;
    if (Date.now() - Date.parse(p.lastmodifieddate ?? p.createdate ?? "") < SETTLE_MS) continue;
    const after: Record<string, string> = {};
    const before: Record<string, string | null> = {};
    if (v.write.firstname !== undefined) { after.firstname = v.write.firstname; before.firstname = first || null; }
    if (v.write.lastname !== undefined) { after.lastname = v.write.lastname; before.lastname = last || null; }
    changes.push({ id: c.id, before, after });
  }
  let written = 0;
  if (live && changes.length) {
    const todo = changes.slice(0, PER_RUN);
    // read again just before: a name someone changed since is left as it is
    const cur = new Map((await readContacts(todo.map((c) => c.id), ["firstname", "lastname"])).map((c) => [String(c.id), c.properties]));
    const go = todo.filter((c) => {
      const p = cur.get(c.id);
      return !!p && Object.entries(c.before).every(([k, v]) => ((p[k] ?? "").trim() || null) === v);
    });
    const result = await writeContacts(go);
    const ok = go.filter((c) => result.get(c.id) === null);
    if (ok.length) await kvSet(`contactNames:log:${now}:run`, ok);
    for (const ch of go) {
      const err = result.get(ch.id), row = rows.get(ch.id)!;
      row.written = err ? { at: now, error: err } : { at: now, first: ch.after.firstname, last: ch.after.lastname, before: `${row.first} ${row.last}`.trim() };
      if (!err) written++;
    }
  }
  // a contact repaired leaves HubSpot's list: the hub's own writes are kept 30 days to be seen
  for (const r of state.rows) if (!rows.has(r.id) && r.written && !r.written.error && Date.now() - Date.parse(r.written.at) < KEEP_WRITTEN_MS) rows.set(r.id, r);
  await kvSet(KV.state, { at: now, rows: [...rows.values()] } satisfies State);
  const info: RunInfo = { at: now, seconds: Math.round((Date.now() - t0) / 1000), listed: ids.length, sure, check, written, live };
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
        const info: RunInfo = { at: new Date().toISOString(), seconds: 0, listed: 0, sure: 0, check: 0, written: 0, live: false, error: (e as Error).message.slice(0, 300) };
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

// ---------------- a person's hand ----------------
/** A person's name for a contact on the list: written as typed (spaces tidied), kept with what was there before. */
export async function setName(id: string, first: string, last: string, by: string): Promise<{ ok: boolean; why?: string; first?: string; last?: string }> {
  const f = first.replace(/\s+/g, " ").trim(), l = last.replace(/\s+/g, " ").trim();
  if (!f && !l) return { ok: false, why: "A first or a last name is needed" };
  if (isBroken(f) || isBroken(l)) return { ok: false, why: "That still has a broken letter (Ã, Â, Å or �) - type the letter itself (ü, é, à …)" };
  const [c] = await readContacts([id], ["firstname", "lastname"]);
  if (!c) return { ok: false, why: "That contact is not in HubSpot any more" };
  const before = { firstname: c.properties.firstname ?? null, lastname: c.properties.lastname ?? null };
  const after: Record<string, string> = {};
  if (f !== (before.firstname ?? "").trim()) after.firstname = f;
  if (l !== (before.lastname ?? "").trim()) after.lastname = l;
  const now = new Date().toISOString();
  if (Object.keys(after).length) {
    const err = (await writeContacts([{ id, before, after }])).get(id);
    if (err) return { ok: false, why: err };
    await kvSet(`contactNames:log:${now}:manual`, [{ id, before, after, by }]);
  }
  const state = await kvGet<State>(KV.state);
  const row = state?.rows.find((r) => r.id === id);
  if (row && state) { row.written = { at: now, first: f, last: l, by, before: `${(before.firstname ?? "").trim()} ${(before.lastname ?? "").trim()}`.trim() }; await kvSet(KV.state, state); }
  // what the person wrote is right - should HubSpot's list still flag it (a "–", a "ã"), it stays off the list
  await markRight(id, by, nameKey(f, l));
  return { ok: true, first: f, last: l };
}

/** "The name is right": off the list while it stays this name. */
export async function markRight(id: string, by: string, name?: string): Promise<{ ok: boolean; why?: string }> {
  let key = name;
  if (key === undefined) {
    const row = (await kvGet<State>(KV.state))?.rows.find((r) => r.id === id);
    if (!row) return { ok: false, why: "That contact is not on the list - read it again" };
    key = nameKey(row.first, row.last);
  }
  const right = (await kvGet<Right>(KV.right)) ?? {};
  right[id] = { name: key, at: new Date().toISOString(), by };
  await kvSet(KV.right, right);
  return { ok: true };
}

let started = false, running = false;
export function startContactNames() {
  if (started || process.env.CONTACT_NAMES === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const timer = setTimeout(() => { running = false; }, LIMIT_MS);
    timer.unref?.();
    void runOnce()
      .then((r) => { if (r?.written) console.log(`[contact-names] ${r.written} name(s) repaired`); if (r?.error) console.warn(`[contact-names] ${r.error}`); })
      .catch((e) => console.warn(`[contact-names] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); running = false; });
  };
  setTimeout(tick, 250_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

// ---------------- the state the page reads ----------------
export async function pageState() {
  const [settings, last, state, right, on] = await Promise.all([getSettings(), kvGet<RunInfo>(KV.last), kvGet<State>(KV.state), kvGet<Right>(KV.right), workflowOn()]);
  return { settings, last: last ?? null, state: state ?? { at: "", rows: [] }, right: right ?? {}, workflowOn: on, writing: settings.mode === "live" && on === false };
}
