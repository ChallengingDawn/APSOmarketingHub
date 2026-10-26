// PERSONAS - the engine (HubSpot apps > Personas; rules in rules.ts). Replaces the HubSpot workflow "SARCLA | PERSONAS
// SET" (4213275888), SARCLA 25.10.2026 ("migrate as a new sub-app and reinforce it").
//
// One copy of the hub at a time (advisory lock 4107246):
//   every 15 minutes  the contacts changed since the last run (job title, job position, role, language, company…) are
//                     decided again - the workflow decided a contact once, ever (no re-enrolment)
//   once a day        every contact and every company: the counts per persona, why the unclassified ones are, and every
//                     contact whose persona differs from the rules (a company's change reaches its contacts here)
// Writes hs_persona only in Live AND while the workflow is switched off (never both writing), only what differs, never
// a persona a person set by hand in HubSpot (its history says CRM_UI), never a contact with no job and no company (the
// workflow skipped those); every write kept with what was there before (kv personas:log:<time>). PERSONAS=off stops it.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { KEYS, PERSONAS, WORKFLOW_ID, derivePersona, hasSignal, keyOfValue, type CompanyFacts, type PersonaKey } from "./rules";

const LOCK = 4_107_246;
const EVERY_MS = 15 * 60_000;
const LIMIT_MS = 14 * 60_000;
const FULL_EVERY_MS = 20 * 3600_000;
/** the most changed contacts one 15-minute run looks at */
const RECENT_MAX = 5000;
/** the rows of "what changes" kept for the page */
const KEEP_ROWS = 3000;
const KV = { settings: "personas:settings", state: "personas:state", last: "personas:last", cursor: "personas:cursor" };
const CONTACT_PROPS = ["jobtitle", "job_position", "hs_role", "hs_language", "hs_persona", "associatedcompanyid", "firstname", "lastname", "email"];
const COMPANY_PROPS = ["name", "apic_ap", "country", "country_custom", "hs_country_code", "numberofemployees", "apso_customer"];

export type Mode = "off" | "shadow" | "live";
export type Settings = { mode: Mode; liveFrom: string | null; by?: string; at?: string };
/** A contact whose persona differs from the rules. */
export type Change = { id: string; name: string; email: string; company: string; from: PersonaKey | null; to: PersonaKey; why: string; done?: { at: string; error?: string; kept?: boolean } };
export type State = {
  at: string; contacts: number; skipped: number;
  /** per persona: in HubSpot now, and by the rules */
  now: Record<string, number>; rules: Record<string, number>;
  /** why the unclassified ones are */
  why: Record<string, number>;
  changes: Change[]; changesTotal: number;
  /** of every change (not only the rows kept): how many go to each persona */
  changeCounts?: Record<string, number>;
};
export type RunInfo = { at: string; seconds: number; looked: number; differ: number; written: number; kept: number; full: boolean; live: boolean; error?: string };

type Obj = { id: string; properties: Record<string, string | null> };

// ---------------- settings, the workflow ----------------
export async function getSettings(): Promise<Settings> {
  return (await kvGet<Settings>(KV.settings)) ?? { mode: "shadow", liveFrom: null };
}
export async function saveSettings(mode: Mode, by: string): Promise<Settings> {
  const cur = await getSettings();
  const next: Settings = { mode, liveFrom: mode === "live" ? (cur.mode === "live" ? cur.liveFrom : new Date().toISOString()) : null, by, at: new Date().toISOString() };
  await kvSet(KV.settings, next);
  // SARCLA 26.10.2026 ("change it at once"): switching to Live changes every contact now, not at the next daily pass
  if (mode === "live" && cur.mode !== "live") startFull();
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
async function searchAll(obj: "contacts" | "companies", props: string[], filters: Record<string, unknown>[] = [], max = Number.MAX_SAFE_INTEGER): Promise<Obj[]> {
  const out: Obj[] = [];
  let cursor = "0";
  while (out.length < max) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: `/crm/v3/objects/${obj}/search`, method: "POST", body: {
      filterGroups: [{ filters: [...filters, { propertyName: "hs_object_id", operator: "GT", value: cursor }] }],
      properties: props, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200,
    } });
    const res = j.results ?? [];
    out.push(...res);
    if (res.length < 200) break;
    cursor = String(res[res.length - 1].id);
  }
  return out.slice(0, max);
}
async function companiesById(ids: string[]): Promise<Map<string, Record<string, string | null>>> {
  const out = new Map<string, Record<string, string | null>>();
  const uniq = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 100) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/companies/batch/read", method: "POST", body: { inputs: uniq.slice(i, i + 100).map((id) => ({ id })), properties: COMPANY_PROPS } });
    for (const c of j.results ?? []) out.set(String(c.id), c.properties);
  }
  return out;
}
/** The contacts whose persona was last set by a person in HubSpot - never overwritten. */
async function setByHand(ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += 50) {
    const j = await hubspotRetry<{ results?: { id: string; propertiesWithHistory?: Record<string, { sourceType?: string }[]> }[] }>({
      path: "/crm/v3/objects/contacts/batch/read", method: "POST", body: { inputs: ids.slice(i, i + 50).map((id) => ({ id })), properties: ["hs_persona"], propertiesWithHistory: ["hs_persona"] },
    });
    for (const c of j.results ?? []) if (c.propertiesWithHistory?.hs_persona?.[0]?.sourceType === "CRM_UI") out.add(String(c.id));
  }
  return out;
}
async function writePersonas(rows: Change[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    try {
      await hubspotRetry({ path: "/crm/v3/objects/contacts/batch/update", method: "POST", body: { inputs: chunk.map((r) => ({ id: r.id, properties: { hs_persona: PERSONAS[r.to].value } })) } });
      for (const r of chunk) result.set(r.id, null);
    } catch {
      for (const r of chunk) {
        try { await hubspotRetry({ path: `/crm/v3/objects/contacts/${r.id}`, method: "PATCH", body: { properties: { hs_persona: PERSONAS[r.to].value } } }); result.set(r.id, null); }
        catch (e) { result.set(r.id, (e as Error).message.slice(0, 160)); }
      }
    }
  }
  return result;
}

// ---------------- the run ----------------
/** Decide a page of contacts: the changes, and (for the daily pass) the counts. */
function decide(contacts: Obj[], companies: Map<string, Record<string, string | null>>, tally?: Omit<State, "at" | "changes" | "changesTotal" | "changeCounts">): Change[] {
  const out: Change[] = [];
  for (const c of contacts) {
    const p = c.properties;
    const co = companies.get(String(p.associatedcompanyid ?? "")) ?? null;
    const now = keyOfValue(p.hs_persona);
    if (tally) { tally.contacts++; tally.now[now ?? "none"] = (tally.now[now ?? "none"] ?? 0) + 1; }
    if (!hasSignal(p, co as CompanyFacts | null)) { if (tally) tally.skipped++; continue; }
    const v = derivePersona(p, co as CompanyFacts | null);
    if (tally) {
      tally.rules[v.key] = (tally.rules[v.key] ?? 0) + 1;
      if (v.key === "UN") tally.why[v.why] = (tally.why[v.why] ?? 0) + 1;
    }
    if (now === v.key) continue;
    out.push({ id: c.id, name: [p.firstname, p.lastname].filter(Boolean).join(" ").trim(), email: p.email ?? "", company: String(co?.name ?? ""), from: now, to: v.key, why: v.why });
  }
  return out;
}

async function run(): Promise<RunInfo> {
  const t0 = Date.now();
  const live = await writing();
  const startedAt = new Date().toISOString();
  const state = await kvGet<State>(KV.state);
  const full = !state?.at || Date.now() - Date.parse(state.at) > FULL_EVERY_MS || fullAsked;
  fullAsked = false;
  let changes: Change[];
  let looked: number;
  let next: State | null = null;
  if (full) {
    const companies = new Map((await searchAll("companies", COMPANY_PROPS)).map((c) => [String(c.id), c.properties]));
    const contacts = await searchAll("contacts", CONTACT_PROPS);
    const tally = { contacts: 0, skipped: 0, now: {} as Record<string, number>, rules: {} as Record<string, number>, why: {} as Record<string, number> };
    changes = decide(contacts, companies, tally);
    looked = contacts.length;
    const changeCounts: Record<string, number> = {};
    for (const r of changes) changeCounts[r.to] = (changeCounts[r.to] ?? 0) + 1;
    next = { at: startedAt, ...tally, changes: [], changesTotal: changes.length, changeCounts };
  } else {
    const since = await kvGet<string>(KV.cursor);
    const contacts = since ? await searchAll("contacts", CONTACT_PROPS, [{ propertyName: "lastmodifieddate", operator: "GTE", value: String(Date.parse(since) - 5 * 60_000) }], RECENT_MAX) : [];
    const companies = await companiesById(contacts.map((c) => String(c.properties.associatedcompanyid ?? "")));
    changes = decide(contacts, companies);
    looked = contacts.length;
  }
  let written = 0, kept = 0;
  if (live && changes.length) {
    const hand = await setByHand(changes.map((r) => r.id));
    const now = new Date().toISOString();
    const go = changes.filter((r) => { if (hand.has(r.id)) { r.done = { at: now, kept: true }; kept++; return false; } return true; });
    const result = await writePersonas(go);
    const ok = go.filter((r) => result.get(r.id) === null);
    if (ok.length) await kvSet(`personas:log:${now}`, ok.map((r) => ({ id: r.id, before: { hs_persona: r.from ? PERSONAS[r.from].value : null }, after: { hs_persona: PERSONAS[r.to].value }, why: r.why })));
    for (const r of go) { const e = result.get(r.id); r.done = e ? { at: now, error: e } : { at: now }; if (!e) written++; }
  }
  // the page's list: the daily pass's differences, kept up to date by the 15-minute runs
  if (next) next.changes = changes.slice(0, KEEP_ROWS);
  else if (state) {
    const byId = new Map(state.changes.map((r) => [r.id, r]));
    for (const r of changes) byId.set(r.id, r);
    next = { ...state, changes: [...byId.values()].slice(-KEEP_ROWS) };
  }
  if (next) await kvSet(KV.state, next);
  await kvSet(KV.cursor, startedAt);
  const info: RunInfo = { at: startedAt, seconds: Math.round((Date.now() - t0) / 1000), looked, differ: changes.length, written, kept, full, live };
  await kvSet(KV.last, info);
  if (written || kept) console.log(`[personas] ${written} persona(s) written${kept ? `, ${kept} kept (set by hand)` : ""}${full ? " - daily pass" : ""}`);
  return info;
}

let fullAsked = false;
export async function runOnce(opts: { full?: boolean } = {}): Promise<RunInfo | null> {
  if ((await getSettings()).mode === "off") return null;
  if (opts.full) fullAsked = true;
  const client: PoolClient = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await run().catch(async (e) => {
        const info: RunInfo = { at: new Date().toISOString(), seconds: 0, looked: 0, differ: 0, written: 0, kept: 0, full: false, live: false, error: (e as Error).message.slice(0, 300) };
        await kvSet(KV.last, info);
        console.warn(`[personas] ${info.error}`);
        return info;
      });
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}
/** "Check everyone now": the daily pass, started now (returns at once - it takes a few minutes). */
export function startFull(): void {
  void runOnce({ full: true }).catch((e) => console.warn(`[personas] ${(e as Error).message}`));
}

let started = false, running = false;
export function startPersonas() {
  if (started || process.env.PERSONAS === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const timer = setTimeout(() => { running = false; }, LIMIT_MS);
    timer.unref?.();
    void runOnce().catch((e) => console.warn(`[personas] ${(e as Error).message}`)).finally(() => { clearTimeout(timer); running = false; });
  };
  setTimeout(tick, 260_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

// ---------------- the state the page reads ----------------
export async function pageState() {
  const [settings, last, state, on] = await Promise.all([getSettings(), kvGet<RunInfo>(KV.last), kvGet<State>(KV.state), workflowOn()]);
  return { settings, last: last ?? null, state: state ?? null, workflowOn: on, writing: settings.mode === "live" && on === false, keys: KEYS };
}
