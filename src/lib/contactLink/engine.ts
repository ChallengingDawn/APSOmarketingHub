// CONTACT LINK - the engine (Duplicates & merges > Contacts > By e-mail domain; the rule in rules.ts). Replaces the HubSpot
// workflow "SARCLA | UNASSIGNED CONTACTS -> COMPANIES" (3778267356), SARCLA 10.11.2026.
//
// Every 15 minutes, one copy of the hub at a time (advisory lock 4107284): every contact without a company (10,762 on
// 10.11 - HubSpot's "associatedcompanyid" empty) is read, and its e-mail domain's companies looked up (kept a day, then
// looked up again - a company that gets its domain later is found then; the workflow decided a contact once, when it
// lost its company, which left 1,095 it would link today). One company on the domain, or one of the Mandant of the
// contact's country, is linked as the contact's primary company. Writes only in Live AND while the workflow is switched
// off (never both writing), 250 a run, each contact read again just before (only while it still has no company), every
// link kept (kv contactLink:links). Shadow by default: the tab shows what it would link. CONTACT_LINK=off stops it.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { WORKFLOW_ID, decideLink, domainKind, emailDomain, type LinkCo, type LinkKind, type LinkVerdict } from "./rules";

const LOCK = 4_107_284;
const EVERY_MS = 15 * 60_000;
const LIMIT_MS = 12 * 60_000;
const PER_RUN = 250;
/** a contact still being filled in (a form, the shop) waits for the next run */
const SETTLE_MS = 2 * 60_000;
/** a domain's companies are looked up again after this */
const DOMAIN_TTL_MS = 20 * 3600_000;
/** the "several companies" contacts kept for the page (the newest) */
const KEEP_SEVERAL = 3000;
const KV = { settings: "contactLink:settings", state: "contactLink:state", last: "contactLink:last", domains: "contactLink:domains", links: "contactLink:links" };
const PROPS = ["email", "firstname", "lastname", "country", "country_custom", "createdate", "lastmodifieddate"];

export type Mode = "off" | "shadow" | "live";
export type Settings = { mode: Mode; liveFrom: string | null; by?: string; at?: string };
/** A contact the rule links (or would link), or one whose domain has several companies. */
export type Row = { id: string; name: string; email: string; country: string; created: string; v: LinkVerdict; written?: { at: string; error?: string } };
export type State = { at: string; total: number; counts: Record<LinkKind, number>; rows: Row[] };
export type RunInfo = { at: string; seconds: number; total: number; toLink: number; written: number; live: boolean; domainsLooked: number; error?: string };
export type Linked = { at: string; contact: string; name: string; email: string; company: string; companyName: string; kind: "one" | "mandant" };
type DomainCache = Record<string, { at: string; cos: LinkCo[] }>;
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
export const linkedList = async () => (await kvGet<Linked[]>(KV.links)) ?? [];

// ---------------- HubSpot, reading ----------------
async function withoutCompany(): Promise<Obj[]> {
  const out: Obj[] = [];
  let cursor = "0";
  for (let page = 0; page < 500; page++) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/contacts/search", method: "POST", body: {
      filterGroups: [{ filters: [{ propertyName: "associatedcompanyid", operator: "NOT_HAS_PROPERTY" }, { propertyName: "hs_object_id", operator: "GT", value: cursor }] }],
      properties: PROPS, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200,
    } });
    const res = j.results ?? [];
    out.push(...res);
    if (res.length < 200) break;
    cursor = String(res[res.length - 1].id);
  }
  return out;
}
/** The companies of these domains (100 domains a search, every page). */
async function companiesOf(domains: string[]): Promise<Map<string, LinkCo[]>> {
  const out = new Map<string, LinkCo[]>(domains.map((d) => [d, []]));
  for (let i = 0; i < domains.length; i += 100) {
    const chunk = domains.slice(i, i + 100);
    let after: string | undefined;
    for (let page = 0; page < 50; page++) {
      const j = await hubspotRetry<{ results?: Obj[]; paging?: { next?: { after?: string } } }>({ path: "/crm/v3/objects/companies/search", method: "POST", body: {
        filterGroups: [{ filters: [{ propertyName: "domain", operator: "IN", values: chunk }] }],
        properties: ["name", "domain", "mandant"], limit: 200, ...(after ? { after } : {}),
      } });
      for (const c of j.results ?? []) {
        const d = String(c.properties.domain ?? "").trim().toLowerCase();
        out.get(d)?.push({ id: String(c.id), name: c.properties.name ?? "", mandant: c.properties.mandant ?? null });
      }
      after = j.paging?.next?.after;
      if (!after) break;
    }
  }
  return out;
}

// ---------------- the run ----------------
async function run(): Promise<RunInfo> {
  const t0 = Date.now();
  const live = await writing();
  const state = await kvGet<State>(KV.state);
  const old = new Map((state?.rows ?? []).map((r) => [r.id, r]));
  const contacts = await withoutCompany();
  // the work domains, each looked up again after a day
  const cache = (await kvGet<DomainCache>(KV.domains)) ?? {};
  const domains = [...new Set(contacts.map((c) => emailDomain(c.properties.email)).filter((d) => !domainKind(d)))];
  const stale = domains.filter((d) => !cache[d] || Date.now() - Date.parse(cache[d].at) > DOMAIN_TTL_MS);
  if (stale.length) {
    const found = await companiesOf(stale);
    const at = new Date().toISOString();
    for (const [d, cos] of found) cache[d] = { at, cos };
  }
  const keep = new Set(domains);
  for (const d of Object.keys(cache)) if (!keep.has(d)) delete cache[d];
  await kvSet(KV.domains, cache);

  const now = new Date().toISOString();
  const counts: Record<LinkKind, number> = { one: 0, mandant: 0, several: 0, none: 0, free: 0, internal: 0, noemail: 0 };
  const rows: Row[] = [];
  const todo: Row[] = [];
  for (const c of contacts) {
    const p = c.properties;
    const v = decideLink({ email: p.email, countryCustom: p.country_custom, country: p.country }, cache[emailDomain(p.email)]?.cos ?? []);
    counts[v.kind]++;
    if (v.kind !== "one" && v.kind !== "mandant" && v.kind !== "several") continue;
    const prev = old.get(c.id)?.written;
    const row: Row = {
      id: c.id, name: [p.firstname, p.lastname].filter(Boolean).join(" ").trim(), email: p.email ?? "",
      country: (p.country_custom || p.country || "").trim(), created: p.createdate ?? "", v, ...(prev?.error ? { written: prev } : {}),
    };
    rows.push(row);
    if (v.company && Date.now() - Date.parse(p.lastmodifieddate ?? p.createdate ?? "") >= SETTLE_MS) todo.push(row);
  }
  let written = 0;
  if (live && todo.length) written = await link(todo.slice(0, PER_RUN), now);
  const several = rows.filter((r) => r.v.kind === "several").sort((a, b) => b.created.localeCompare(a.created)).slice(0, KEEP_SEVERAL);
  const next: State = { at: now, total: contacts.length, counts, rows: [...rows.filter((r) => r.v.kind !== "several" && !(r.written && !r.written.error)), ...several] };
  await kvSet(KV.state, next);
  const info: RunInfo = { at: now, seconds: Math.round((Date.now() - t0) / 1000), total: contacts.length, toLink: counts.one + counts.mandant - written, written, live, domainsLooked: stale.length };
  await kvSet(KV.last, info);
  return info;
}

/** The contacts linked to their company as primary - each read again first; HubSpot's answer says which were made. */
async function link(rows: Row[], now: string): Promise<number> {
  const still = new Set<string>();
  for (let i = 0; i < rows.length; i += 100) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/contacts/batch/read", method: "POST", body: { inputs: rows.slice(i, i + 100).map((r) => ({ id: r.id })), properties: ["associatedcompanyid"] } });
    for (const c of j.results ?? []) if (!String(c.properties.associatedcompanyid ?? "").trim()) still.add(String(c.id));
  }
  const go = rows.filter((r) => still.has(r.id));
  const made: Linked[] = [];
  for (let i = 0; i < go.length; i += 100) {
    const chunk = go.slice(i, i + 100);
    try {
      const j = await hubspotRetry<{ numErrors?: number; errors?: { message?: string }[]; results?: { fromObjectId?: string | number }[] }>({
        path: "/crm/v4/associations/contacts/companies/batch/create", method: "POST",
        body: { inputs: chunk.map((r) => ({ from: { id: r.id }, to: { id: r.v.company!.id }, types: [
          { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 279 },
          { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 1 },
        ] })) },
      });
      const refused = Number(j.numErrors ?? 0) > 0;
      const ok = new Set((j.results ?? []).map((x) => String(x.fromObjectId ?? "")));
      for (const r of chunk) {
        if (!refused || ok.has(r.id)) {
          r.written = { at: now };
          made.push({ at: now, contact: r.id, name: r.name, email: r.email, company: r.v.company!.id, companyName: r.v.company!.name, kind: r.v.kind as "one" | "mandant" });
        } else r.written = { at: now, error: String(j.errors?.[0]?.message ?? "HubSpot did not link it").slice(0, 160) };
      }
    } catch (e) {
      for (const r of chunk) r.written = { at: now, error: (e as Error).message.slice(0, 160) };
    }
  }
  if (made.length) await kvSet(KV.links, [...made, ...(await linkedList())].slice(0, 5000));
  return made.length;
}

export async function runOnce(): Promise<RunInfo | null> {
  if ((await getSettings()).mode === "off") return null;
  const client: PoolClient = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await run().catch(async (e) => {
        const info: RunInfo = { at: new Date().toISOString(), seconds: 0, total: 0, toLink: 0, written: 0, live: false, domainsLooked: 0, error: (e as Error).message.slice(0, 300) };
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
export function startContactLink() {
  if (started || process.env.CONTACT_LINK === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const timer = setTimeout(() => { running = false; }, LIMIT_MS);
    timer.unref?.();
    void runOnce()
      .then((r) => { if (r?.written) console.log(`[contact-link] ${r.written} contact(s) linked to their company`); if (r?.error) console.warn(`[contact-link] ${r.error}`); })
      .catch((e) => console.warn(`[contact-link] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); running = false; });
  };
  setTimeout(tick, 270_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

// ---------------- the state the page reads ----------------
export async function pageState() {
  const [settings, last, state, links, on] = await Promise.all([getSettings(), kvGet<RunInfo>(KV.last), kvGet<State>(KV.state), linkedList(), workflowOn()]);
  return { settings, last: last ?? null, state: state ?? null, links, workflowOn: on, writing: settings.mode === "live" && on === false };
}
