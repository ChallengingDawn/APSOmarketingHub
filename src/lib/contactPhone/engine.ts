// CONTACT PHONE - the engine (Map assignment > Phone numbers; rules in rules.ts). Replaces the HubSpot workflow "SARCLA |
// Contact phone number correction" (3078691018), SARCLA 25.10.2026.
//
// Every 15 minutes, one copy of the hub at a time (advisory lock 4107244): every contact with the shop's phone
// (eyemagine_telephone) and no phone - the workflow's list 6612 "SARCLA | PHONE NUMBER LOOK UP INVERSED", ~420 on 25.10 -
// is read and decided; a contact changed in the last 2 minutes waits for the next run (the workflow's own 2-minute wait).
// Only a VALID number is written (rules.ts, libphonenumber-js); one that cannot be made valid is listed. Writes only in
// Live AND while the workflow is switched off (never both writing), only a contact that still has no phone (read again
// just before); every write kept with what was there before (kv contactPhone:log:<time>).
// Once a day every phone in HubSpot is checked (SARCLA 25.10.2026: "numbers it can't make valid are listed on the tab
// for someone to fix, including the 958 old ones"): a certain repair is written by itself; the others are listed for a
// person, who types the right number on the tab (setPhone - checked, then written). SARCLA the same evening: "this
// should be correct once and then automatic" - Live is the default. CONTACT_PHONE=off stops the schedule.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { WORKFLOW_ID, checkPhone, decidePhone, manualPhone, type Repair, type Verdict } from "./rules";

const LOCK = 4_107_244;
const EVERY_MS = 15 * 60_000;
const LIMIT_MS = 12 * 60_000;
/** the most contacts written in one run */
const PER_RUN = 500;
/** the workflow waited 2 minutes after a contact joined its list */
const SETTLE_MS = 2 * 60_000;
const KEEP_WRITTEN_MS = 30 * 86400_000;
const KV = { settings: "contactPhone:settings", state: "contactPhone:state", last: "contactPhone:last", bad: "contactPhone:invalid" };
/** every phone in HubSpot checked once a day */
const SCAN_EVERY_MS = 20 * 3600_000;
/** the most certain repairs one run writes */
const REPAIR_PER_RUN = 2000;
const PROPS = ["firstname", "lastname", "email", "eyemagine_telephone", "phone", "country_custom", "country", "createdate", "lastmodifieddate"];

export type Mode = "off" | "shadow" | "live";
export type Settings = { mode: Mode; liveFrom: string | null; by?: string; at?: string };
export type Written = { at: string; phone?: string; error?: string };
export type Row = { id: string; name: string; email: string; shop: string; created: string; checkedAt: string; v: Verdict; written?: Written };
export type State = { at: string; rows: Row[] };
export type RunInfo = { at: string; seconds: number; waiting: number; fillable: number; invalid: number; written: number; live: boolean; repaired?: number; error?: string };
/** A phone in HubSpot that is not valid - the certain repair when there is one. */
export type BadRow = { id: string; name: string; email: string; phone: string; shop: string; country: string; created: string; repair: string | null; how: Repair | "nocode" | null; repaired?: Written & { by?: string } };
export type BadState = { at: string; scanned: number; rows: BadRow[] };

type Obj = { id: string; properties: Record<string, string | null> };

// ---------------- settings, the workflow ----------------
export async function getSettings(): Promise<Settings> {
  // Live unless someone paused it (SARCLA 25.10.2026: "this should be correct once and then automatic")
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
  let fillable = 0, invalid = 0, repaired = 0;
  for (const c of waiting) {
    const p = c.properties;
    const v = decidePhone({ shop: p.eyemagine_telephone, phone: p.phone, countryCustom: p.country_custom, country: p.country });
    const name = [p.firstname, p.lastname].filter(Boolean).join(" ").trim();
    const row: Row = { id: c.id, name, email: p.email ?? "", shop: p.eyemagine_telephone ?? "", created: p.createdate ?? "", checkedAt: now, v, written: old.get(c.id)?.written?.error ? old.get(c.id)!.written : undefined };
    rows.set(c.id, row);
    if (!v.phone || v.status === "same") { if (v.status === "invalid") invalid++; continue; }
    fillable++;
    if (v.status === "repaired") repaired++;
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
  const info: RunInfo = { at: now, seconds: Math.round((Date.now() - t0) / 1000), waiting: waiting.length, fillable, invalid, written, live, repaired };
  await kvSet(KV.last, info);
  // every phone in HubSpot, once a day (or when an admin asks)
  const bad = await kvGet<BadState>(KV.bad);
  if (scanAsked || !bad?.at || Date.now() - Date.parse(bad.at) > SCAN_EVERY_MS) { scanAsked = false; await scanPhones(bad ?? null); }
  // the certain repairs, by themselves
  if (live) {
    const r = await repairCertain();
    if (r.written) { info.repaired = (info.repaired ?? 0) + r.written; await kvSet(KV.last, info); console.log(`[contact-phone] ${r.written} phone number(s) repaired`); }
  }
  return info;
}

/** Every contact with a phone, read (by id) and checked; the ones that are not valid kept, with their certain repair. */
async function scanPhones(prev: BadState | null): Promise<void> {
  const done = new Map((prev?.rows ?? []).filter((r) => r.repaired && !r.repaired.error).map((r) => [r.id, r]));
  const rows: BadRow[] = [];
  let cursor = "0", scanned = 0;
  for (let page = 0; page < 2000; page++) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/contacts/search", method: "POST", body: {
      filterGroups: [{ filters: [{ propertyName: "phone", operator: "HAS_PROPERTY" }, { propertyName: "hs_object_id", operator: "GT", value: cursor }] }],
      properties: PROPS, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200,
    } });
    const res = j.results ?? [];
    for (const c of res) {
      const p = c.properties;
      const phone = String(p.phone ?? "").trim();
      if (!phone) continue;
      scanned++;
      const bad = checkPhone({ phone, shop: p.eyemagine_telephone, countryCustom: p.country_custom, country: p.country });
      if (!bad) continue;
      rows.push({
        id: c.id, name: [p.firstname, p.lastname].filter(Boolean).join(" ").trim(), email: p.email ?? "", phone, shop: p.eyemagine_telephone ?? "",
        country: (p.country_custom || p.country || "").trim(), created: p.createdate ?? "", repair: bad.repair, how: bad.how,
      });
    }
    if (res.length < 200) break;
    cursor = String(res[res.length - 1].id);
  }
  // the hub's own repairs stay to be seen for 30 days
  for (const r of done.values()) if (!rows.some((x) => x.id === r.id) && Date.now() - Date.parse(r.repaired!.at) < KEEP_WRITTEN_MS) rows.push(r);
  await kvSet(KV.bad, { at: new Date().toISOString(), scanned, rows } satisfies BadState);
}
let scanAsked = false;
/** "Look again" on the list of phones that are not valid: the next run (started now) reads every phone. */
export async function startScan(): Promise<{ started: boolean; why?: string }> {
  if ((await getSettings()).mode === "off") return { started: false, why: "the tab is Off" };
  scanAsked = true;
  void runOnce().catch((e) => console.warn(`[contact-phone] ${(e as Error).message}`));
  return { started: true };
}

/** The listed phones with a certain repair, each read again first (written only while it is still the same), Live and
 *  the workflow off only - every run, by itself; kept in kv contactPhone:log:<time>:repair. */
export async function repairCertain(): Promise<{ ok: boolean; written: number; left: number; why?: string }> {
  if (!(await writing())) return { ok: false, written: 0, left: 0, why: "the tab is not Live, or the old workflow is still switched on" };
  const bad = await kvGet<BadState>(KV.bad);
  const todo = (bad?.rows ?? []).filter((r) => r.repair && !r.repaired).slice(0, REPAIR_PER_RUN);
  if (!todo.length) return { ok: true, written: 0, left: 0 };
  const now = new Date().toISOString();
  const cur = new Map<string, string>();
  for (let i = 0; i < todo.length; i += 100) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/contacts/batch/read", method: "POST", body: { inputs: todo.slice(i, i + 100).map((r) => ({ id: r.id })), properties: ["phone"] } });
    for (const c of j.results ?? []) cur.set(String(c.id), String(c.properties.phone ?? "").trim());
  }
  const changes: Change[] = [];
  for (const r of todo) {
    if (cur.get(r.id) !== r.phone) { r.repaired = { at: now, error: "changed in HubSpot since the check - left as it is" }; continue; }
    changes.push({ id: r.id, before: { phone: r.phone }, after: { phone: r.repair! } });
  }
  const result = changes.length ? await writeContacts(changes) : new Map<string, string | null>();
  const ok = changes.filter((c) => result.get(c.id) === null);
  if (ok.length) await kvSet(`contactPhone:log:${now}:repair`, ok);
  for (const ch of changes) {
    const r = todo.find((x) => x.id === ch.id)!, err = result.get(ch.id);
    r.repaired = err ? { at: now, error: err } : { at: now, phone: ch.after.phone };
  }
  await kvSet(KV.bad, bad);
  const left = (bad?.rows ?? []).filter((r) => r.repair && !r.repaired).length;
  return { ok: true, written: ok.length, left };
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
/**
 * A person's number for a contact on the list (SARCLA 25.10.2026: "for a person should allow to correct here manually
 * the number"): read with the contact's ERP / own country ("079 …" -> +41 79 …), written only when valid, kept with what
 * was there before (kv contactPhone:log:<time>:manual) and the list updated at once.
 */
export async function setPhone(id: string, input: string, by: string): Promise<{ ok: boolean; phone?: string; why?: string }> {
  const j = await hubspotRetry<Obj>({ path: `/crm/v3/objects/contacts/${encodeURIComponent(id)}?properties=phone,country_custom,country` });
  const p = j.properties ?? {};
  const phone = manualPhone(input, p.country_custom, p.country);
  if (!phone) return { ok: false, why: `"${input}" is not a valid phone number${p.country_custom || p.country ? ` for ${p.country_custom || p.country}` : ""} - type it with its country code (+41 …)` };
  const before = String(p.phone ?? "").trim() || null;
  const result = await writeContacts([{ id, before: { phone: before }, after: { phone } }]);
  const err = result.get(id);
  if (err) return { ok: false, why: err };
  const now = new Date().toISOString();
  await kvSet(`contactPhone:log:${now}:manual`, [{ id, before: { phone: before }, after: { phone }, by }]);
  const bad = await kvGet<BadState>(KV.bad);
  const row = bad?.rows.find((r) => r.id === id);
  if (row) { row.repaired = { at: now, phone, by }; await kvSet(KV.bad, bad); }
  const state = await kvGet<State>(KV.state);
  const w = state?.rows.find((r) => r.id === id);
  if (w) { w.written = { at: now, phone }; await kvSet(KV.state, state); }
  return { ok: true, phone };
}

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
  const [settings, last, state, bad, on] = await Promise.all([getSettings(), kvGet<RunInfo>(KV.last), kvGet<State>(KV.state), kvGet<BadState>(KV.bad), workflowOn()]);
  return { settings, last: last ?? null, state: state ?? { at: "", rows: [] }, bad: bad ?? null, workflowOn: on, writing: settings.mode === "live" && on === false };
}
