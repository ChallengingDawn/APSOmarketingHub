// COMPANY DOMAIN - the engine (Map assignment > Domains; rules in rules.ts). Replaces the HubSpot workflow
// "SARCLA | COMPANY SETS DOMAIN" (3339408610), SARCLA 25.10.2026.
//
// Every 15 minutes, one copy of the hub at a time (advisory lock 4107242): every company WITHOUT a domain is read (a
// search - ~760 on 25.10), the new, changed and week-old ones get their contacts' e-mails read and are decided - a real
// domain from the work e-mails or the website, never a guess; "private or micro" -> apso_customer APSOmicro. Writes only
// in Live AND while the workflow is switched off (never both writing); every write is kept with what was there before
// (kv companyDomain:log:<time>:<job>). Two jobs an admin starts from the tab: "Find old guesses" (every company's domain
// read, the workflow's name guesses picked out and looked up on the internet) and "Clear the dead ones" (a guess that
// does not exist gets the contacts' real domain, or none). COMPANY_DOMAIN=off stops the schedule.

import type { PoolClient } from "pg";
import { Resolver } from "node:dns/promises";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { GENERIC, INTERNAL, WORKFLOW_ID, decide, emailDomain, isNameGuess, pickBest, type Verdict } from "./rules";

const LOCK = 4_107_242;
const EVERY_MS = 15 * 60_000;
const LIMIT_MS = 12 * 60_000;
/** companies decided again per run - new ones first */
const PER_RUN = 150;
const RECHECK_MS = 7 * 86400_000;
const KEEP_WRITTEN_MS = 30 * 86400_000;
const CONTACTS_PER_COMPANY = 50;
const KV = { settings: "companyDomain:settings", state: "companyDomain:state", last: "companyDomain:last", guesses: "companyDomain:guesses", clear: "companyDomain:clear" };
const PROPS = ["name", "website", "country", "country_custom", "createdate", "hs_lastmodifieddate", "num_associated_contacts", "apso_customer", "max_pot_or_turnover", "max_revenue_2015_2026"];

export type Mode = "off" | "shadow" | "live";
export type Settings = { mode: Mode; liveFrom: string | null; by?: string; at?: string };
export type Written = { at: string; domain?: string; apso?: string; error?: string };
export type Row = { id: string; name: string; country: string; created: string; contacts: number; apso: string; key: string; checkedAt: string; v: Verdict; written?: Written };
export type State = { at: string; rows: Row[] };
export type RunInfo = { at: string; seconds: number; without: number; looked: number; found: number; micro: number; written: number; live: boolean; error?: string };
export type Guess = { id: string; name: string; domain: string; contacts: number; exists: boolean | null; real: string | null; cleared?: Written };
export type Guesses = { running: boolean; startedAt: string | null; beatAt: string | null; progress: string; at: string | null; scanned: number; rows: Guess[]; by?: string; error?: string };
export type Clearing = { running: boolean; startedAt: string | null; beatAt: string | null; done: number; of: number; errors: number; at: string | null; by?: string };

type Obj = { id: string; properties: Record<string, string | null> };
const num = (v: string | null | undefined) => Number(v) || 0;

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

// ---------------- HubSpot, reading ----------------
async function searchAll(filters: Record<string, unknown>[], props: string[], beat?: (n: number) => void): Promise<Obj[]> {
  const out: Obj[] = [];
  let cursor = "0";
  for (let page = 0; page < 1000; page++) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/companies/search", method: "POST", body: {
      filterGroups: [{ filters: [...filters, { propertyName: "hs_object_id", operator: "GT", value: cursor }] }],
      properties: props, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200,
    } });
    const res = j.results ?? [];
    out.push(...res);
    beat?.(out.length);
    if (res.length < 200) break;
    cursor = String(res[res.length - 1].id);
  }
  return out;
}
/** Each company's contacts' e-mails (up to 50 contacts a company). */
async function contactEmails(companyIds: string[]): Promise<Map<string, string[]>> {
  const links = new Map<string, string[]>();
  for (let i = 0; i < companyIds.length; i += 500) {
    const j = await hubspotRetry<{ results?: { from: { id: string }; to?: { toObjectId: string | number }[] }[] }>({
      path: "/crm/v4/associations/companies/contacts/batch/read", method: "POST", body: { inputs: companyIds.slice(i, i + 500).map((id) => ({ id })) },
    });
    for (const r of j.results ?? []) links.set(String(r.from.id), (r.to ?? []).slice(0, CONTACTS_PER_COMPANY).map((t) => String(t.toObjectId)));
  }
  const ids = [...new Set([...links.values()].flat())];
  const email = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/contacts/batch/read", method: "POST", body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: ["email"] } });
    for (const c of j.results ?? []) if (c.properties.email) email.set(String(c.id), c.properties.email);
  }
  const out = new Map<string, string[]>();
  for (const [co, cs] of links) out.set(co, cs.map((c) => email.get(c)).filter((e): e is string => !!e));
  return out;
}

// ---------------- HubSpot, writing (kept with what was there before) ----------------
type Change = { id: string; before: Record<string, string | null>; after: Record<string, string> };
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
  if (entries.length) await kvSet(`companyDomain:log:${new Date().toISOString()}:${job}`, entries);
}

// ---------------- the run ----------------
const keyOf = (c: Obj) => `${c.properties.hs_lastmodifieddate ?? ""}|${num(c.properties.num_associated_contacts)}`;

async function run(): Promise<RunInfo> {
  const t0 = Date.now();
  const live = await writing();
  const state = (await kvGet<State>(KV.state)) ?? { at: "", rows: [] };
  const old = new Map(state.rows.map((r) => [r.id, r]));
  const without = await searchAll([{ propertyName: "domain", operator: "NOT_HAS_PROPERTY" }], PROPS);
  const due = without
    .filter((c) => { const r = old.get(c.id); return !r || r.key !== keyOf(c) || Date.now() - Date.parse(r.checkedAt) > RECHECK_MS; })
    .sort((a, b) => (b.properties.createdate ?? "").localeCompare(a.properties.createdate ?? ""))
    .slice(0, PER_RUN);
  const dueIds = new Set(due.map((c) => c.id));
  const emails = due.length ? await contactEmails(due.map((c) => c.id)) : new Map<string, string[]>();
  const now = new Date().toISOString();
  const rows = new Map<string, Row>();
  for (const c of without) { const r = old.get(c.id); if (r && !dueIds.has(c.id)) rows.set(c.id, r); }
  const changes: Change[] = [];
  let found = 0, micro = 0;
  for (const c of due) {
    const p = c.properties, apso = (p.apso_customer ?? "").trim();
    const v = decide({ name: p.name ?? "", website: p.website, apso, turnover: num(p.max_pot_or_turnover), revenue: num(p.max_revenue_2015_2026), contacts: num(p.num_associated_contacts), emails: emails.get(c.id) ?? [] });
    const row: Row = { id: c.id, name: p.name ?? "", country: (p.country || p.country_custom || "").trim(), created: p.createdate ?? "", contacts: num(p.num_associated_contacts), apso, key: keyOf(c), checkedAt: now, v };
    rows.set(c.id, row);
    const after: Record<string, string> = {};
    if (v.domain) { after.domain = v.domain; found++; }
    if (v.micro) { after.apso_customer = "APSOmicro"; micro++; }
    if (Object.keys(after).length) changes.push({ id: c.id, before: { domain: null, apso_customer: apso || null }, after });
  }
  let written = 0;
  if (live && changes.length) {
    const result = await writeCompanies(changes);
    await log("run", changes, result);
    for (const ch of changes) {
      const err = result.get(ch.id), row = rows.get(ch.id)!;
      row.written = err ? { at: now, error: err } : { at: now, domain: ch.after.domain, apso: ch.after.apso_customer };
      if (!err) written++;
    }
  }
  // a company that has a domain since is no longer searched: the hub's own writes are kept 30 days to be seen
  for (const r of state.rows) if (!rows.has(r.id) && r.written && !r.written.error && Date.now() - Date.parse(r.written.at) < KEEP_WRITTEN_MS) rows.set(r.id, r);
  await kvSet(KV.state, { at: now, rows: [...rows.values()] });
  const info: RunInfo = { at: now, seconds: Math.round((Date.now() - t0) / 1000), without: without.length, looked: due.length, found, micro, written, live };
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
        const info: RunInfo = { at: new Date().toISOString(), seconds: 0, without: 0, looked: 0, found: 0, micro: 0, written: 0, live: false, error: (e as Error).message.slice(0, 300) };
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
export function startCompanyDomain() {
  if (started || process.env.COMPANY_DOMAIN === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const timer = setTimeout(() => { running = false; }, LIMIT_MS);
    timer.unref?.();
    void runOnce()
      .catch((e) => console.warn(`[company-domain] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); running = false; });
  };
  setTimeout(tick, 200_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

// ---------------- the state the page reads ----------------
export async function pageState() {
  const [settings, last, state, guesses, clearing, on] = await Promise.all([
    getSettings(), kvGet<RunInfo>(KV.last), kvGet<State>(KV.state), kvGet<Guesses>(KV.guesses), kvGet<Clearing>(KV.clear), workflowOn(),
  ]);
  return { settings, last: last ?? null, state: state ?? { at: "", rows: [] }, guesses: guesses ?? null, clearing: clearing ?? null, workflowOn: on, writing: settings.mode === "live" && on === false };
}

// ---------------- the two jobs ----------------
const BEAT_STALE_MS = 3 * 60_000;
const alive = (j: { running: boolean; beatAt: string | null } | null | undefined) => !!j?.running && Date.now() - Date.parse(j.beatAt ?? "") < BEAT_STALE_MS;

const resolver = new Resolver({ timeout: 4000, tries: 2 });
/** On the internet at all: an address or a mail server. null = the lookup itself failed (then never cleared). */
export async function domainExists(d: string): Promise<boolean | null> {
  let unsure = false;
  for (const ask of [() => resolver.resolve4(d), () => resolver.resolve6(d), () => resolver.resolveMx(d)]) {
    try { const r = await ask(); if (r.length) return true; }
    catch (e) { const code = (e as { code?: string }).code; if (code !== "ENOTFOUND" && code !== "ENODATA") unsure = true; }
  }
  return unsure ? null : false;
}

/** Every company's domain read; the workflow's name guesses picked out, looked up, and the contacts' real domain beside them. */
export async function startGuessScan(by: string): Promise<{ started: boolean; why?: string }> {
  const cur = await kvGet<Guesses>(KV.guesses);
  if (alive(cur)) return { started: false, why: "already running" };
  if (alive(await kvGet<Clearing>(KV.clear))) return { started: false, why: "the dead guesses are being cleared - wait for it" };
  const g: Guesses = { running: true, startedAt: new Date().toISOString(), beatAt: new Date().toISOString(), progress: "starting", at: cur?.at ?? null, scanned: 0, rows: cur?.rows ?? [], by };
  await kvSet(KV.guesses, g);
  let lastBeat = 0;
  const beat = async (progress: string) => {
    g.progress = progress;
    if (Date.now() - lastBeat < 15_000) return;
    lastBeat = Date.now();
    g.beatAt = new Date().toISOString();
    await kvSet(KV.guesses, g);
  };
  void (async () => {
    try {
      const all = await searchAll([{ propertyName: "domain", operator: "HAS_PROPERTY" }], ["name", "domain", "num_associated_contacts"], (n) => { void beat(`reading every company's domain - ${n.toLocaleString("en-US")} so far`); });
      const cands = all.filter((c) => isNameGuess(c.properties.domain ?? "", c.properties.name ?? ""));
      const rows: Guess[] = cands.map((c) => ({ id: c.id, name: c.properties.name ?? "", domain: (c.properties.domain ?? "").toLowerCase(), contacts: num(c.properties.num_associated_contacts), exists: null, real: null }));
      let done = 0;
      const queue = [...rows];
      await Promise.all(Array.from({ length: 8 }, async () => {
        for (let r = queue.shift(); r; r = queue.shift()) {
          r.exists = await domainExists(r.domain);
          if (++done % 50 === 0) await beat(`looking the guesses up on the internet - ${done.toLocaleString("en-US")} of ${rows.length.toLocaleString("en-US")}`);
        }
      }));
      const withContacts = rows.filter((r) => r.contacts > 0);
      for (let i = 0; i < withContacts.length; i += 200) {
        await beat(`reading the contacts' e-mails - ${i.toLocaleString("en-US")} of ${withContacts.length.toLocaleString("en-US")} companies`);
        const em = await contactEmails(withContacts.slice(i, i + 200).map((r) => r.id));
        for (const r of withContacts.slice(i, i + 200)) {
          const pro = (em.get(r.id) ?? []).map(emailDomain).filter((d): d is string => !!d && !GENERIC.has(d) && !INTERNAL.has(d) && d !== r.domain);
          r.real = pickBest(pro);
        }
      }
      Object.assign(g, { running: false, at: new Date().toISOString(), beatAt: new Date().toISOString(), progress: "done", scanned: all.length, rows, error: undefined });
    } catch (e) {
      Object.assign(g, { running: false, beatAt: new Date().toISOString(), progress: "stopped", error: (e as Error).message.slice(0, 200) });
    }
    await kvSet(KV.guesses, g);
  })();
  return { started: true };
}

/** The guesses that do not exist get the contacts' real domain, or none. Live only, the workflow off, on a scan of the last 24 h. */
export async function startClear(by: string): Promise<{ started: boolean; why?: string }> {
  if (!(await writing())) return { started: false, why: "the tab is not Live, or the old workflow is still switched on" };
  const g = await kvGet<Guesses>(KV.guesses);
  if (!g?.at || alive(g)) return { started: false, why: "find the old guesses first" };
  if (Date.now() - Date.parse(g.at) > 24 * 3600_000) return { started: false, why: "the last look-up is older than a day - find the old guesses again" };
  const cur = await kvGet<Clearing>(KV.clear);
  if (alive(cur)) return { started: false, why: "already clearing" };
  const dead = g.rows.filter((r) => r.exists === false && !r.cleared);
  const c: Clearing = { running: true, startedAt: new Date().toISOString(), beatAt: new Date().toISOString(), done: 0, of: dead.length, errors: 0, at: null, by };
  await kvSet(KV.clear, c);
  void (async () => {
    for (let i = 0; i < dead.length; i += 100) {
      const chunk = dead.slice(i, i + 100);
      const changes: Change[] = chunk.map((r) => ({ id: r.id, before: { domain: r.domain }, after: { domain: r.real ?? "" } }));
      const result = await writeCompanies(changes);
      await log("clear", changes, result);
      const now = new Date().toISOString();
      for (const r of chunk) {
        const err = result.get(r.id);
        r.cleared = err ? { at: now, error: err } : { at: now, domain: r.real ?? "" };
        if (err) c.errors++; else c.done++;
      }
      c.beatAt = now;
      await kvSet(KV.clear, c);
      await kvSet(KV.guesses, g);
    }
    Object.assign(c, { running: false, at: new Date().toISOString(), beatAt: new Date().toISOString() });
    await kvSet(KV.clear, c);
  })();
  return { started: true };
}
