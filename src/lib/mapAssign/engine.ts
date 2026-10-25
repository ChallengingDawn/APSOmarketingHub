// MAP ASSIGNMENT - the engine (SARCLA 19.10.2026: "copy to company owner / region responsibility and propagate to
// contact"). SHADOW by default: it reads every company, decides its owner with the rules (rules.ts decide()) and keeps
// the answer next to what HubSpot has, in the hub's own database - it writes NOTHING to HubSpot until a country is
// switched live on the page (kv "mapAssign:live", default none).
//
// One copy of the hub at a time (advisory lock 4107233), every 15 minutes:
//   1. the companies changed since the last run (hs_lastmodifieddate, 5 minutes overlap, id cursor past HubSpot's
//      10,000 search cap) - or, once a night from 02:30 Zurich (and whenever the last one is older than a day), ALL
//      companies (~61,000, the list API by id: it costs none of the hub's shared search pace)
//   2. each one decided; a company whose owner or region would change, and every company of a live country, has its
//      contacts read: how many have another owner / region / SAE than the company's decided ones (contacts_off)
//   3. LIVE countries only: owner + region_responsibility of the company (re-read first, only what differs), then its
//      own contacts (owner, region, SAE) - at most `breaker` companies a run; every write logged; an archived owner is
//      never written. Tickets and tasks are never touched (Owner redirection does that).
//   4. recent contacts with no company (14 days, not A+P people): the companies with their e-mail domain, and
//      contactCompany()'s answer - the page's "No company" list. Live country + a clear company = linked and owned.
//
// Each company's REGION (canton, département, Land - public/geo/shapes/<CC>.json regions[].code) comes from its
// postcode's point in public/geo/postcodes/<CC>.json (read from disk once per run; a 3-element point or a missing
// file = no region), for zones made of whole regions. The nightly full read also counts every company's contacts
// (v4 associations, 100 companies a call: ~610 calls, ~1.7 minutes) for the Performis tab, and every read keeps the
// map's layer facts: revenue this year (revenue_<year>), last / first order date, sales_priority.
//
// Tables (made on first use, never inside ensureSchema - a failure here must not hold up the hub's pages):
//   apsomh_map_assign            one row per company: the facts read, the decision, contacts_off, the last write
//   apsomh_map_assign_nocompany  the "No company" list
//   apsomh_map_assign_log        every write to HubSpot (before / after), for an audit or a rollback

import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import type { PoolClient } from "pg";
import { getPool, query } from "@/lib/db/client";
import { ensureSchema, kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { IntegrationError } from "@/lib/integrations/status";
import { hubChain } from "@/lib/connectors/chainStatus";
import { SEED } from "./seed";
import { applyFixes } from "./fixes";
import { GENERIC_DOMAINS, cleanZip, contactCompany, countryOf, decide, type AssignRules, type CompanyFacts, type Decision, type OwnerId, type Via } from "./rules";
import type { ChangesPage, CompanyChange, CompanyRow, CountrySummary, LayerData, MapData, MoveStat, NoCompany, Owner, OwnerLoad, PerformisData, RedirectionConflict, ScanInfo, TicketLoad } from "./api";
import { listRules } from "@/lib/ownerRules/store";
import { publishedRules, type PubRule } from "@/lib/ownerRules/rules";
// used inside run() only - contactsKpi.ts imports ensureMapAssign from here, a cycle that is safe at runtime
import { newContactsKpi } from "./contactsKpi";
import { followOnRun } from "./contactFollow"; // the same: inside run() only
import {
  DEFAULT_SETTINGS, EMPTY_ZIP_INDEX, INTERNAL_DOMAINS, cleanSettings, companyChanges, conflictCounts, contactChanges, emailDomain, fullDue, heldBy, inYear,
  internalFromList, isInternal, layerPoints, likeEscape, mergeRules, priorityKey, ownContacts, placeZip, redirectionSig, saeStats, validateLive, validateRules, zipIndex, zurich,
  type Checked, type ConflictRow, type Internal, type LayerRow, type RulesPatch, type SaeRow, type Settings, type ZipIndex,
} from "./plan";

const LOCK = 4_107_233;
const EVERY_MS = 15 * 60_000;
/** A run is stopped (and its lock dropped) after this long; the next tick starts over. */
const LIMIT_MS = 50 * 60_000;
/** HubSpot's search index trails a write: each window starts this much earlier (rows are keyed, so nothing doubles). */
const OVERLAP_MS = 5 * 60_000;
const NIGHTLY_AT = "02:30";
const NO_COMPANY_DAYS = 14;
/** Rows whose contacts were never counted (a rules change, a country just set live): this many a run. */
const RECHECK_PER_RUN = 2000;
const CHANGES_SHOWN = 3000;
const NO_COMPANY_SHOWN = 500;
const LOG_KEEP_DAYS = 180;
const AP_EMPLOYEES_LIST = "2865";
/** A failed write is tried again after this long (a run every 15 minutes would otherwise hammer the same record). */
const RETRY_FAILED_AFTER = "6 hours";
/** Shown for a company whose country cannot be read. */
export const NO_COUNTRY = "??";

const KV = {
  rules: "mapAssign:rules", live: "mapAssign:live", settings: "mapAssign:settings",
  last: "mapAssign:last", lastFull: "mapAssign:lastFull", cursor: "mapAssign:cursor",
  /** answers to Owner redirection conflicts: ruleId -> {decision, sig, at, by} */
  redirections: "mapAssign:redirections",
  /** what the stored decisions were made with: a hash of the rules and the redirection rules kept */
  decidedWith: "mapAssign:decidedWith",
  /** ESO + TSA tickets per owner (the KPI workload), refreshed at most hourly */
  tickets: "mapAssign:tickets",
  /** the sandbox's rules (SARCLA 24.10.2026): {rules, by, at, from} - never used to decide or write */
  sandbox: "mapAssign:sandbox",
  /** the ids of the corrections applied once to the saved rules (fixes.ts) */
  fixes: "mapAssign:fixes",
};

/** A full read whose facts are older than this (a new column) makes the next run a full one: every row filled. */
const SCAN_VERSION = 3; // 3 (24.10.2026): apso_customer

/** The calendar year in Zurich - the year of "revenue this year", "customer this year". */
const yearNow = () => Number(zurich(Date.now()).day.slice(0, 4));
/** Net revenue of a year (Performis, by the Compass connector every night; EUR). */
export const revenueField = (year: number) => `revenue_${year}`;
/** The last order (Compass connector, every night: credit notes and cancelled orders are not orders). */
export const CUSTOMERS_FIELD = "order_last_order_date";
const FIRST_ORDER_FIELD = "order_first_order_date";
const PRIORITY_FIELD = "sales_priority";
/** APSOcore / APSOgrowth / APSOprospect / APSOlost / APSOmicro / Growth Engine Customer (the segmentation) */
const CATEGORY_FIELD = "apso_customer";
const BASE_PROPS = ["name", "country", "country_custom", "zip", "sae_performis", "erp_customer_id", "hubspot_owner_id", "region_responsibility", "hs_lastmodifieddate"];
/** What a company read asks for: the rules' facts and the map's layers. */
const companyProps = (year = yearNow()) => [...BASE_PROPS, revenueField(year), CUSTOMERS_FIELD, FIRST_ORDER_FIELD, PRIORITY_FIELD, CATEGORY_FIELD];
const CONTACT_PROPS = ["email", "hubspot_owner_id", "region_responsibility", "sae_performis", "associatedcompanyid"];
/** v4 association types: contact -> company, unlabeled and primary. */
const CONTACT_TO_COMPANY = 279, CONTACT_TO_PRIMARY_COMPANY = 1;

export type RunInfo = ScanInfo & {
  /** companies read whose owner or region differs from the decision */
  differ?: number;
  wrote?: { companies: number; contacts: number; links: number; failed: number };
  noCompany?: number;
  /** the rules changed during the run: every row was decided again at its end */
  redecided?: number;
  live?: string[];
  /** the facts a full read keeps (SCAN_VERSION) */
  v?: number;
};

/* ── tables ────────────────────────────────────────────────────────────── */

let ready: Promise<void> | null = null;

/** The three tables, once per process. Raw SQL only (no kv in here); a failure is retried on the next call. */
export function ensureMapAssign(): Promise<void> {
  ready ??= (async () => {
    await ensureSchema(); // the hub's own tables first; this is never called FROM ensureSchema
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_map_assign (
        company_id      TEXT PRIMARY KEY,
        name            TEXT,
        country         TEXT,
        country_raw     TEXT,
        country_custom  TEXT,
        zip             TEXT,
        sae             TEXT,
        erp_id          TEXT,
        owner_now       TEXT,
        region_now      TEXT,
        owner_decided   TEXT NOT NULL,
        via             TEXT NOT NULL,
        detail          TEXT,
        flags           TEXT[] NOT NULL DEFAULT '{}',
        contacts_off    INTEGER,
        contacts_at     TIMESTAMPTZ,
        modified_at     TIMESTAMPTZ,
        checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        wrote_at        TIMESTAMPTZ,
        wrote_error     TEXT
      );
      CREATE INDEX IF NOT EXISTS apsomh_map_assign_country_idx ON apsomh_map_assign (country);
      -- v2 (19.10.2026): the region of the postcode, the map's layer facts, the contacts count (full read)
      ALTER TABLE apsomh_map_assign ADD COLUMN IF NOT EXISTS region        TEXT;
      ALTER TABLE apsomh_map_assign ADD COLUMN IF NOT EXISTS revenue_cy    DOUBLE PRECISION;
      ALTER TABLE apsomh_map_assign ADD COLUMN IF NOT EXISTS revenue_year  INTEGER;
      ALTER TABLE apsomh_map_assign ADD COLUMN IF NOT EXISTS last_order    TEXT;
      ALTER TABLE apsomh_map_assign ADD COLUMN IF NOT EXISTS first_order   TEXT;
      ALTER TABLE apsomh_map_assign ADD COLUMN IF NOT EXISTS priority      TEXT;
      ALTER TABLE apsomh_map_assign ADD COLUMN IF NOT EXISTS contacts_n    INTEGER;
      ALTER TABLE apsomh_map_assign ADD COLUMN IF NOT EXISTS contacts_n_at TIMESTAMPTZ;
      -- v4 (21.10.2026): contacts whose owner / region differ from the company's NOW (every company, nightly), and the
      -- tickets of the last 90 days per company - all pipelines and the sales ones (ESO + TSA), hourly
      ALTER TABLE apsomh_map_assign ADD COLUMN IF NOT EXISTS contacts_mism INTEGER;
      ALTER TABLE apsomh_map_assign ADD COLUMN IF NOT EXISTS tickets_90    INTEGER;
      ALTER TABLE apsomh_map_assign ADD COLUMN IF NOT EXISTS sales_90      INTEGER;
      -- v5 (24.10.2026): the APSO customer category, for the KPI split per person (SARCLA: "the split of PRIO and APSOcustomer")
      ALTER TABLE apsomh_map_assign ADD COLUMN IF NOT EXISTS apso_customer TEXT;
      -- v6 (25.10.2026): when the facts the rules decide by last changed (SAE, postcode, country) or the company was new -
      -- a live country writes what changed since it went live, like the Performis workflow on an SAE change
      ALTER TABLE apsomh_map_assign ADD COLUMN IF NOT EXISTS facts_at TIMESTAMPTZ;
      -- v7 (25.10.2026): open ESO + TSA tickets on the company, hourly - the KPI's "Sales open" per country (SARCLA: "what
      -- am I doing in Italy if I have no companies or contacts" - it counted a person's open tickets in every country)
      ALTER TABLE apsomh_map_assign ADD COLUMN IF NOT EXISTS sales_open INTEGER;
      CREATE TABLE IF NOT EXISTS apsomh_map_assign_nocompany (
        contact_id       TEXT PRIMARY KEY,
        email            TEXT,
        name             TEXT,
        createdate       TIMESTAMPTZ,
        owner_id         TEXT,
        why              TEXT,
        suggested_owner  TEXT,
        link             TEXT,
        candidates       JSONB NOT NULL DEFAULT '[]'::jsonb,
        checked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        wrote_at         TIMESTAMPTZ,
        wrote_error      TEXT
      );
      CREATE TABLE IF NOT EXISTS apsomh_map_assign_log (
        id          BIGSERIAL PRIMARY KEY,
        at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        kind        TEXT NOT NULL,
        object_id   TEXT NOT NULL,
        company_id  TEXT,
        before      JSONB,
        after       JSONB,
        error       TEXT,
        by          TEXT
      );
      CREATE INDEX IF NOT EXISTS apsomh_map_assign_log_at_idx ON apsomh_map_assign_log (at DESC);
    `);
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

/* ── settings in kv ────────────────────────────────────────────────────── */

type Saved<T> = { value: T; by: string | null; at: string | null };

/** The rules: the saved ones, else the seed (as read from the HubSpot workflows). */
export async function getRules(): Promise<Saved<AssignRules>> {
  const x = await kvGet<{ rules?: AssignRules; by?: string | null; at?: string | null }>(KV.rules);
  if (x?.rules?.countries) return { value: x.rules, by: x.by ?? null, at: x.at ?? null };
  return { value: SEED, by: null, at: null };
}
export async function getLive(): Promise<Saved<Record<string, boolean>> & { since: Record<string, string> }> {
  const x = await kvGet<{ live?: Record<string, boolean>; by?: string | null; at?: string | null; since?: Record<string, string> }>(KV.live);
  const v = validateLive(x?.live ?? {});
  const value = v.ok ? v.value : {};
  // when each live country went live (a switch saved before 25.10.2026 has none: from now)
  const since = Object.fromEntries(Object.keys(value).filter((cc) => value[cc]).map((cc) => [cc, x?.since?.[cc] ?? x?.at ?? new Date().toISOString()]));
  return { value, by: x?.by ?? null, at: x?.at ?? null, since };
}
export async function getSettings(): Promise<Settings> {
  return cleanSettings((await kvGet<Partial<Settings>>(KV.settings)) ?? DEFAULT_SETTINGS);
}
export const lastRun = async () => (await kvGet<RunInfo>(KV.last)) ?? null;
const liveList = (live: Record<string, boolean>) => Object.keys(live).filter((k) => live[k]).sort();

/** PUT rules (whole) or patch (one country / the SAE table, merged into the saved ones): validated, stored, and every
 *  stored company decided again at once, so the page shows the new picture without waiting for a scan. */
export async function saveRules(input: { rules?: unknown; patch?: RulesPatch }, by: string): Promise<Checked<{ redecided: number }>> {
  const base = input.rules !== undefined ? input.rules : mergeRules((await getRules()).value, input.patch ?? {});
  const v = validateRules(base);
  if (!v.ok) return v;
  await kvSet(KV.rules, { rules: v.value, by, at: new Date().toISOString() });
  return { ok: true, value: { redecided: await redecideAll() } };
}
/** PUT live: merged into the saved switches (a country left out keeps its switch). */
export async function saveLive(x: unknown, by: string): Promise<Checked<Record<string, boolean>>> {
  const v = validateLive(x);
  if (!v.ok) return v;
  const cur = await getLive();
  const next = { ...cur.value, ...v.value };
  const now = new Date().toISOString();
  // a country switched on now: it writes what changes from now on (and every company with no owner or one who has left)
  const since = Object.fromEntries(Object.keys(next).filter((cc) => next[cc]).map((cc) => [cc, cur.value[cc] ? cur.since[cc] ?? now : now]));
  await kvSet(KV.live, { live: next, by, at: now, since });
  return { ok: true, value: next };
}
export async function saveSettings(x: unknown, by: string): Promise<Settings> {
  const next = cleanSettings({ ...(await getSettings()), ...(x && typeof x === "object" ? x : {}) });
  await kvSet(KV.settings, { ...next, by, at: new Date().toISOString() });
  return next;
}

/* ── the sandbox and the one-time corrections ─────────────────────────── */

/**
 * The sandbox (SARCLA 24.10.2026: "a Sandbox / Live toggle so the sales leader can play around and do tests on regions
 * ... always the comparing KPIs, to measure the result with one ESO less, the km², the money, everything ... then we
 * bring it back on the main one - this should not in any way be automatic, a human pushes the button"): a second set
 * of rules, a copy of the live ones until someone changes it. It never decides a stored company and never writes to
 * HubSpot - the KPIs decide the stored companies with it on the fly (layerData). Promote = an admin brings one part
 * (a country, or the SAE table) into the saved rules.
 */
export type SandboxSaved = { rules: AssignRules; by: string | null; at: string | null; from: string | null };
export async function getSandbox(): Promise<SandboxSaved | null> {
  const x = await kvGet<{ rules?: AssignRules | null; by?: string | null; at?: string | null; from?: string | null }>(KV.sandbox);
  return x?.rules?.countries ? { rules: x.rules, by: x.by ?? null, at: x.at ?? null, from: x.from ?? null } : null;
}
/** A patch merged into the sandbox (a copy of the live rules when there is none), or a part put back to live ("sae" or a
 *  country), or reset: true = the sandbox gone (it starts again from live). */
export async function saveSandbox(input: { patch?: RulesPatch; reset?: string | boolean }, by: string): Promise<Checked<SandboxSaved | null>> {
  if (input.reset === true) {
    await kvSet(KV.sandbox, { rules: null, by, at: new Date().toISOString() });
    return { ok: true, value: null };
  }
  const live = (await getRules()).value;
  const cur = await getSandbox();
  let base = cur?.rules ?? live;
  if (typeof input.reset === "string") {
    const part = input.reset.trim().toUpperCase();
    base = part === "SAE" ? { ...base, sae: live.sae, defaultOwner: live.defaultOwner, successors: live.successors } : mergeRules(base, { countries: { [part]: live.countries[part] ?? null } });
  }
  if (input.patch) base = mergeRules(base, input.patch);
  const v = validateRules(base);
  if (!v.ok) return v;
  const value = { rules: v.value, by, at: new Date().toISOString(), from: cur?.from ?? new Date().toISOString() };
  await kvSet(KV.sandbox, value);
  return { ok: true, value };
}
/** An admin brings one part of the sandbox into the live rules: "sae" (the SAE table and the default) or a country. */
export async function promoteSandbox(part: string, by: string): Promise<Checked<{ redecided: number }>> {
  const sb = await getSandbox();
  if (!sb) return { ok: false, errors: ["there is no sandbox - nothing to bring to live"] };
  const p = part.trim().toUpperCase();
  const patch: RulesPatch = p === "SAE" ? { sae: sb.rules.sae, defaultOwner: sb.rules.defaultOwner, successors: sb.rules.successors ?? {} } : { countries: { [p]: sb.rules.countries[p] ?? null } };
  return saveRules({ patch }, `${by} (from the sandbox)`);
}

/** Who the corrections are saved by: SARCLA, who asked for them (24.10.2026: "take out 'asked in chat'" - the page read
 *  "Saved ... by SARCLA 24.10.2026 (asked in chat)"). */
const FIX_BY = "Claudio Saraiva";
const FIX_BY_BEFORE = "SARCLA 24.10.2026 (asked in chat)";

/** The corrections of fixes.ts not applied yet: applied once to the SAVED rules (the seed carries them already). */
async function applyRuleFixes(): Promise<void> {
  const had = await kvGet<string[]>(KV.fixes);
  const done = Array.isArray(had) ? had : [];
  const saved = await kvGet<{ rules?: AssignRules; by?: string | null; at?: string | null }>(KV.rules);
  if (saved?.rules?.countries && saved.by === FIX_BY_BEFORE) await kvSet(KV.rules, { ...saved, by: FIX_BY });
  const { rules, applied } = applyFixes(saved?.rules?.countries ? saved.rules : SEED, done);
  if (!applied.length) return;
  if (saved?.rules?.countries) {
    const v = validateRules(rules);
    if (!v.ok) { console.warn(`[map-assign] corrections not applied: ${v.errors[0]}`); return; }
    await kvSet(KV.rules, { rules: v.value, by: FIX_BY, at: new Date().toISOString() });
  }
  await kvSet(KV.fixes, [...done, ...applied.map((f) => f.id)]);
  console.log(`[map-assign] corrections applied to the saved rules: ${applied.map((f) => f.why).join("; ")}`);
}

/* ── Owner redirection against the map ────────────────────────────────── */

type RedirAnswer = { decision: "map" | "rule"; sig: string; at: string; by: string };
type Redir = { enabled: PubRule[]; held: Set<string> };
export async function redirAnswers(): Promise<Record<string, RedirAnswer>> {
  const x = await kvGet<Record<string, RedirAnswer>>(KV.redirections);
  return x && typeof x === "object" ? x : {};
}
/** Store (or, null, forget) the answer to a rule's conflict - tied to the rule as it is now. */
export async function saveRedirAnswer(rule: PubRule, decision: "map" | "rule" | null, by: string): Promise<void> {
  const all = await redirAnswers();
  if (decision) all[rule.id] = { decision, sig: redirectionSig(rule), at: new Date().toISOString(), by };
  else delete all[rule.id];
  await kvSet(KV.redirections, all);
}
/** The enabled Owner redirection rules, in order, and those that hold their companies over the map: EVERY rule still
 *  switched on (SARCLA 25.10.2026: "the overlapping rules - if it's overlapping it should not show as wrong": France ->
 *  Jeremy gave 381 "Jeremy Borey -> TSA Team" differences while the rule itself keeps them on Jeremy) - unless the map was
 *  chosen over it (an accepted conflict, which also switches the rule off). Switch a rule off on Owner redirection (the
 *  day its country goes live here) and the map decides its companies. Owner redirection unreadable = nothing held. */
async function redirState(): Promise<Redir> {
  try {
    const enabled = publishedRules(await listRules());
    const answers = await redirAnswers();
    const held = new Set(enabled.filter((r) => !(answers[r.id]?.decision === "map" && answers[r.id].sig === redirectionSig(r))).map((r) => r.id));
    return { enabled, held };
  } catch (e) {
    console.warn(`[map-assign] owner redirection rules unreadable: ${msg(e)}`);
    return { enabled: [], held: new Set() };
  }
}

/* ── HubSpot reads ─────────────────────────────────────────────────────── */

type Props = Record<string, string | null>;
type Obj = { id: string; properties?: Props };
type Page = { results?: Obj[]; paging?: { next?: { after?: string } } };
const hs = <T>(path: string, method: "GET" | "POST" | "PATCH" | "PUT" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body });
const msg = (e: unknown) => String((e as Error)?.message ?? e).replace(/\s+/g, " ").slice(0, 200);
const refused = (e: unknown) => e instanceof IntegrationError && (e.status === 401 || e.status === 403);

type OwnersInfo = { list: Owner[]; active: Set<string>; names: Map<string, string> };
let ownersCache: { at: number; v: OwnersInfo } | null = null;
/** Every owner, the archived ones flagged inactive - an hour old at most. No active owner read = an error, never "everyone has left". */
export async function owners(): Promise<OwnersInfo> {
  if (ownersCache && Date.now() - ownersCache.at < 3600_000) return ownersCache.v;
  type O = { id: string; firstName?: string; lastName?: string; email?: string };
  const read = async (archived: boolean) => {
    const out: O[] = [];
    let after: string | undefined;
    for (let page = 0; page < 50; page++) {
      const r = await hs<{ results?: O[]; paging?: { next?: { after?: string } } }>(`/crm/v3/owners?limit=100&archived=${archived}${after ? `&after=${encodeURIComponent(after)}` : ""}`);
      out.push(...(r.results ?? []));
      after = r.paging?.next?.after;
      if (!after) break;
    }
    return out;
  };
  const [on, off] = [await read(false), await read(true)];
  if (!on.length) throw new Error("HubSpot returned no active owner - nothing decided");
  const name = (o: O) => `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim() || o.email || String(o.id);
  const active = new Set(on.map((o) => String(o.id)));
  const byId = new Map<string, Owner>();
  for (const o of on) byId.set(String(o.id), { id: String(o.id), name: name(o), active: true });
  for (const o of off) if (!active.has(String(o.id))) byId.set(String(o.id), { id: String(o.id), name: name(o), active: false });
  const list = [...byId.values()].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  const v = { list, active, names: new Map(list.map((o) => [o.id, o.name])) };
  ownersCache = { at: Date.now(), v };
  return v;
}

let internalCache: { at: number; v: Internal } | null = null;
/** A+P people (list 2865's domains and addresses), six hours old at most; unreadable = the two company domains. */
export async function internal(): Promise<Internal> {
  if (internalCache && Date.now() - internalCache.at < 6 * 3600_000) return internalCache.v;
  let v: Internal;
  try {
    const j = await hs<{ list?: { filterBranch?: unknown } }>(`/crm/v3/lists/${AP_EMPLOYEES_LIST}?includeFilters=true`);
    v = internalFromList(j.list?.filterBranch);
  } catch {
    v = { domains: new Set(INTERNAL_DOMAINS), emails: new Set() };
  }
  internalCache = { at: Date.now(), v };
  return v;
}

export async function batchRead(obj: "companies" | "contacts" | "tickets" | "tasks", ids: string[], properties: string[]): Promise<Map<string, Props>> {
  const out = new Map<string, Props>();
  for (let i = 0; i < ids.length; i += 100) {
    const j = await hs<{ results?: Obj[] }>(`/crm/v3/objects/${obj}/batch/read`, "POST", { properties, inputs: ids.slice(i, i + 100).map((id) => ({ id })) });
    for (const r of j.results ?? []) out.set(String(r.id), r.properties ?? {});
  }
  return out;
}

type AssocRow = { from: { id: string }; to?: { toObjectId: string | number }[]; paging?: { next?: { after?: string } } };
/** company id -> its contact ids, every page. */
export async function companyContacts(ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 100) {
    const j = await hs<{ results?: AssocRow[] }>("/crm/v4/associations/companies/contacts/batch/read", "POST", { inputs: ids.slice(i, i + 100).map((id) => ({ id })) });
    for (const r of j.results ?? []) {
      const list = (r.to ?? []).map((x) => String(x.toObjectId));
      let next = r.paging?.next?.after;
      for (let guard = 0; next && guard < 200; guard++) {
        const g = await hs<{ results?: { toObjectId: string | number }[]; paging?: { next?: { after?: string } } }>(
          `/crm/v4/objects/companies/${r.from.id}/associations/contacts?limit=500&after=${encodeURIComponent(next)}`,
        );
        list.push(...(g.results ?? []).map((x) => String(x.toObjectId)));
        next = g.paging?.next?.after;
      }
      out.set(String(r.from.id), [...new Set(list)]);
    }
  }
  return out;
}

/* ── the map's files (public/geo, shipped with the hub) ────────────────── */

const geoDir = () => path.join(process.cwd(), "public", "geo");
const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, "utf8"));

/** One country's postcode points as a lookup; a missing or broken file = none (no region, nothing placed). */
async function zipsOf(country: string): Promise<ZipIndex> {
  if (!/^[A-Z]{2}$/.test(country)) return EMPTY_ZIP_INDEX;
  try {
    return zipIndex(((await readJson(path.join(geoDir(), "postcodes", `${country}.json`))) as { points?: unknown })?.points);
  } catch {
    return EMPTY_ZIP_INDEX;
  }
}
/** Every country's postcode points - read once per run (or rules save), ~2 MB. */
async function loadGeo(): Promise<Map<string, ZipIndex>> {
  const out = new Map<string, ZipIndex>();
  let files: string[] = [];
  try { files = await readdir(path.join(geoDir(), "postcodes")); } catch { return out; }
  for (const f of files) {
    const m = /^([A-Z]{2})\.json$/.exec(f);
    if (m) out.set(m[1], await zipsOf(m[1]));
  }
  return out;
}
const regionOf = (geo: Map<string, ZipIndex>, country: string | null, zip: string | null) =>
  (country ? placeZip(geo.get(country) ?? EMPTY_ZIP_INDEX, zip)?.region : null) ?? null;

let gdpCache: Map<string, LayerData["gdp"]> | null = null;
/** GDP per region (public/geo/gdp/<CC>.json {code: MEUR}) for every region of the country's shapes; unknown = null. */
async function gdpOf(country: string): Promise<LayerData["gdp"]> {
  gdpCache ??= new Map();
  const hit = gdpCache.get(country);
  if (hit) return hit;
  let codes: string[] = [];
  let values: Record<string, unknown> = {};
  try { codes = (((await readJson(path.join(geoDir(), "shapes", `${country}.json`))) as { regions?: { code?: string }[] })?.regions ?? []).map((r) => String(r.code ?? "")).filter(Boolean); } catch { /* no shapes */ }
  try { values = ((await readJson(path.join(geoDir(), "gdp", `${country}.json`))) as Record<string, unknown>) ?? {}; } catch { /* no GDP */ }
  if (!codes.length) codes = Object.keys(values).filter((k) => !k.startsWith("_"));
  const out = codes.map((code) => { const n = Number(values[code]); return { code, gdp: values[code] !== undefined && values[code] !== null && Number.isFinite(n) ? n : null }; });
  gdpCache.set(country, out);
  return out;
}

let gdpIndex: Promise<Record<string, { year?: number | null; regionalYear?: number | null }>> | null = null;
/** The GDP's years for a country (public/geo/gdp/index.json, written by scripts/geo/build_gdp.py). */
async function gdpSourceOf(country: string): Promise<LayerData["gdpSource"]> {
  gdpIndex ??= readJson(path.join(geoDir(), "gdp", "index.json")).then((x) => (x && typeof x === "object" ? x as Record<string, { year?: number | null; regionalYear?: number | null }> : {})).catch(() => ({}));
  const e = (await gdpIndex)[country];
  return e ? { year: Number(e.year) || null, regionalYear: Number(e.regionalYear) || null } : null;
}

async function chainRunning(): Promise<boolean> {
  try {
    const c = await hubChain();
    return c?.status === "running" && Date.now() / 1000 - (c.ts ?? 0) < 3 * 3600;
  } catch {
    return false;
  }
}

/* ── one run's context ─────────────────────────────────────────────────── */

type Ctx = {
  rules: AssignRules; rulesAt: string | null; live: Record<string, boolean>; settings: Settings; own: OwnersInfo; internal: Internal;
  /** when each live country went live */
  liveSince: Record<string, string>;
  /** the postcode points per country (regions), read once for the run */
  geo: Map<string, ZipIndex>;
  /** the year of revenue_<year>, fixed for the run */
  year: number;
  /** a full read: every company's contacts are counted */
  full: boolean;
  /** the Owner redirection rules kept over the map (declined conflicts) */
  redir: Redir;
  signal?: AbortSignal; companies: number; contacts: number; differ: number;
};
async function context(signal?: AbortSignal): Promise<Ctx> {
  const [rules, live, settings] = [await getRules(), await getLive(), await getSettings()];
  return {
    rules: rules.value, rulesAt: rules.at, live: live.value, liveSince: live.since, settings, own: await owners(), internal: await internal(), geo: await loadGeo(),
    year: yearNow(), full: false, redir: await redirState(), signal, companies: 0, contacts: 0, differ: 0,
  };
}
const stop = (ctx: Ctx) => { if (ctx.signal?.aborted) throw new Error("stopped: the run's time limit"); };
const isActive = (ctx: Ctx) => (o: OwnerId) => ctx.own.active.has(String(o));
const isLive = (ctx: Ctx, country: string | null) => !!country && !!ctx.live[country];

/** One company as the table keeps it. */
type Rec = {
  company_id: string; name: string | null; country: string | null; country_raw: string | null; country_custom: string | null; zip: string | null;
  region: string | null; sae: string | null; erp_id: string | null; owner_now: string | null; region_now: string | null;
  owner_decided: string; via: Via; detail: string; flags: string; contacts_off: number | null; contacts_checked: boolean; modified_at: string | null;
  revenue_cy: number | null; revenue_year: number; last_order: string | null; first_order: string | null; priority: string | null;
  category: string | null;
  /** associated contacts, counted on a full read (null = keep the stored count) */
  contacts_n: number | null;
  /** of its own contacts: owner or region not the company's now (null = keep the stored count) */
  contacts_mism: number | null;
};
const nz = (x: string | null | undefined) => { const s = String(x ?? "").trim(); return s ? s : null; };
const num = (x: string | null | undefined) => { const s = String(x ?? "").trim(); const n = Number(s); return s && Number.isFinite(n) ? n : null; };
const factsOf = (r: Pick<Rec, "company_id" | "country_raw" | "country_custom" | "zip" | "region" | "sae" | "erp_id">): CompanyFacts =>
  ({ id: r.company_id, country: r.country_raw, countryCustom: r.country_custom, zip: r.zip, region: r.region, sae: r.sae, erpId: r.erp_id });
/** The rules' decision - unless an Owner redirection rule SARCLA kept over the map holds the company (owner_now: the
 *  rules by owner read it). */
const decideRec = (f: CompanyFacts, ctx: Pick<Ctx, "rules" | "own" | "redir">, ownerNow: string | null): Decision => {
  const d = decide(f, ctx.rules, (o) => ctx.own.active.has(String(o)), (o) => ctx.own.names.get(String(o)) ?? String(o));
  const h = heldBy({ country_raw: f.country ?? null, country_custom: f.countryCustom ?? null, owner_now: ownerNow }, ctx.redir.enabled, ctx.redir.held);
  if (!h || String(h.toOwner) === String(d.owner)) return d;
  const name = (o: string) => ctx.own.names.get(String(o)) ?? String(o);
  return { owner: String(h.toOwner), via: "redirection", country: d.country, detail: `Owner redirection keeps it with ${name(h.toOwner)} - the map would give ${name(d.owner)}`, flags: d.flags };
};

function toRec(o: Obj, ctx: Ctx): Rec {
  const p = o.properties ?? {};
  const raw = { company_id: String(o.id), country_raw: nz(p.country), country_custom: nz(p.country_custom), zip: nz(p.zip), sae: nz(p.sae_performis), erp_id: nz(p.erp_customer_id) };
  const base = { ...raw, region: regionOf(ctx.geo, countryOf(factsOf({ ...raw, region: null })), raw.zip) };
  const d = decideRec(factsOf(base), ctx, nz(p.hubspot_owner_id));
  return {
    ...base, name: nz(p.name), country: d.country, owner_now: nz(p.hubspot_owner_id), region_now: nz(p.region_responsibility),
    owner_decided: d.owner, via: d.via, detail: d.detail, flags: d.flags.join(","), contacts_off: null, contacts_checked: false, modified_at: nz(p.hs_lastmodifieddate),
    revenue_cy: num(p[revenueField(ctx.year)]), revenue_year: ctx.year, last_order: nz(p[CUSTOMERS_FIELD]), first_order: nz(p[FIRST_ORDER_FIELD]),
    priority: nz(p[PRIORITY_FIELD]), category: nz(p[CATEGORY_FIELD]), contacts_n: null, contacts_mism: null,
  };
}
const differs = (r: { owner_now: string | null; region_now: string | null; owner_decided: string }) =>
  (r.owner_now ?? "") !== r.owner_decided || (r.region_now ?? "") !== r.owner_decided;

/* ── table writes ──────────────────────────────────────────────────────── */

async function upsert(recs: Rec[]): Promise<void> {
  for (let i = 0; i < recs.length; i += 500) {
    await query(
      `INSERT INTO apsomh_map_assign AS m (company_id, name, country, country_raw, country_custom, zip, region, sae, erp_id, owner_now, region_now,
         owner_decided, via, detail, flags, contacts_off, contacts_at, modified_at, checked_at,
         revenue_cy, revenue_year, last_order, first_order, priority, contacts_n, contacts_n_at, contacts_mism, apso_customer, facts_at)
       SELECT x.company_id, x.name, x.country, x.country_raw, x.country_custom, x.zip, x.region, x.sae, x.erp_id, x.owner_now, x.region_now,
         x.owner_decided, x.via, x.detail, COALESCE(string_to_array(NULLIF(x.flags, ''), ','), '{}'), x.contacts_off,
         CASE WHEN x.contacts_checked THEN NOW() END, x.modified_at, NOW(),
         x.revenue_cy, x.revenue_year, x.last_order, x.first_order, x.priority, x.contacts_n, CASE WHEN x.contacts_n IS NOT NULL THEN NOW() END, x.contacts_mism, x.category, NOW()
       FROM jsonb_to_recordset($1::jsonb) AS x(company_id text, name text, country text, country_raw text, country_custom text, zip text, region text,
         sae text, erp_id text, owner_now text, region_now text, owner_decided text, via text, detail text, flags text, contacts_off int,
         contacts_checked boolean, modified_at timestamptz, revenue_cy double precision, revenue_year int, last_order text, first_order text,
         priority text, contacts_n int, contacts_mism int, category text)
       ON CONFLICT (company_id) DO UPDATE SET
         name = EXCLUDED.name, country = EXCLUDED.country, country_raw = EXCLUDED.country_raw, country_custom = EXCLUDED.country_custom,
         zip = EXCLUDED.zip, region = EXCLUDED.region, sae = EXCLUDED.sae, erp_id = EXCLUDED.erp_id, owner_now = EXCLUDED.owner_now,
         region_now = EXCLUDED.region_now, owner_decided = EXCLUDED.owner_decided, via = EXCLUDED.via, detail = EXCLUDED.detail, flags = EXCLUDED.flags,
         contacts_off = EXCLUDED.contacts_off, contacts_at = EXCLUDED.contacts_at, modified_at = EXCLUDED.modified_at, checked_at = NOW(),
         revenue_cy = EXCLUDED.revenue_cy, revenue_year = EXCLUDED.revenue_year, last_order = EXCLUDED.last_order, first_order = EXCLUDED.first_order,
         priority = EXCLUDED.priority, apso_customer = EXCLUDED.apso_customer,
         facts_at = CASE WHEN m.sae IS DISTINCT FROM EXCLUDED.sae OR m.zip IS DISTINCT FROM EXCLUDED.zip
           OR m.country_raw IS DISTINCT FROM EXCLUDED.country_raw OR m.country_custom IS DISTINCT FROM EXCLUDED.country_custom THEN NOW() ELSE m.facts_at END,
         -- counted on a full read only: a 15-minute read keeps the count
         contacts_n = COALESCE(EXCLUDED.contacts_n, m.contacts_n),
         contacts_n_at = CASE WHEN EXCLUDED.contacts_n IS NOT NULL THEN NOW() ELSE m.contacts_n_at END,
         contacts_mism = COALESCE(EXCLUDED.contacts_mism, m.contacts_mism)`,
      [JSON.stringify(recs.slice(i, i + 500))],
    );
  }
}

type LogRow = { kind: "company" | "contact" | "link" | "ticket" | "task"; object_id: string; company_id: string | null; before: unknown; after: unknown; error: string | null; by: string };
async function log(rows: LogRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    await query(
      `INSERT INTO apsomh_map_assign_log (kind, object_id, company_id, before, after, error, by)
       SELECT x.kind, x.object_id, x.company_id, x.before, x.after, x.error, x.by
       FROM jsonb_to_recordset($1::jsonb) AS x(kind text, object_id text, company_id text, before jsonb, after jsonb, error text, by text)`,
      [JSON.stringify(rows.slice(i, i + 500))],
    );
  }
}

/* ── contacts ──────────────────────────────────────────────────────────── */

type ContactRec = { id: string; email: string | null; owner: string | null; region: string | null; sae: string | null };

/** company -> its own contacts (ownContacts: the primary ones, and the ones with no primary company). `pre`: the
 *  associations already read for these companies (the full read counts every company's). */
async function contactsOf(ids: string[], ctx: Ctx, pre?: Map<string, string[]>): Promise<Map<string, ContactRec[]>> {
  const out = new Map<string, ContactRec[]>();
  for (let i = 0; i < ids.length; i += 100) {
    stop(ctx);
    const part = ids.slice(i, i + 100);
    const assoc = pre ? new Map(part.map((id) => [id, pre.get(id) ?? []])) : await companyContacts(part);
    const props = await batchRead("contacts", [...new Set([...assoc.values()].flat())], CONTACT_PROPS);
    ctx.contacts += props.size;
    const mine = ownContacts(part, assoc, (id) => { const p = props.get(id); return p ? nz(p.associatedcompanyid) : undefined; });
    for (const [co, list] of mine) {
      out.set(co, list.map((id) => {
        const p = props.get(id) ?? {};
        return { id, email: nz(p.email), owner: nz(p.hubspot_owner_id), region: nz(p.region_responsibility), sae: nz(p.sae_performis) };
      }));
    }
  }
  return out;
}
const offCount = (list: ContactRec[], target: { owner: OwnerId; sae: string | null }, internalSet: Internal) =>
  list.filter((c) => !isInternal(c.email, internalSet) && Object.keys(contactChanges(c, target)).length > 0).length;

/** Decide a page of companies; count the contacts of the ones that differ (and of every company of a live country).
 *  A full read also counts every company's associated contacts (one v4 call per 100 companies, its pages followed). */
async function processCompanies(objs: Obj[], ctx: Ctx): Promise<void> {
  for (let i = 0; i < objs.length; i += 100) {
    stop(ctx);
    const recs = objs.slice(i, i + 100).map((o) => toRec(o, ctx));
    // the full read counts every company's contacts (SARCLA 21.10.2026: "every contact associated to a company matches
    // the same as in the company"); a 15-minute read the ones that differ or are live
    const look = ctx.full ? recs : recs.filter((r) => differs(r) || isLive(ctx, r.country));
    ctx.differ += recs.filter(differs).length;
    const asked = ctx.full ? recs : look;
    const assoc = asked.length ? await companyContacts(asked.map((r) => r.company_id)) : null;
    // a company with no contact is not in the answer: 0
    if (assoc) for (const r of asked) r.contacts_n = assoc.get(r.company_id)?.length ?? 0;
    if (look.length) {
      const by = await contactsOf(look.map((r) => r.company_id), ctx, assoc ?? undefined);
      for (const r of look) {
        const own = by.get(r.company_id) ?? [];
        r.contacts_off = offCount(own, { owner: r.owner_decided, sae: r.sae }, ctx.internal);
        r.contacts_mism = own.filter((c) => !isInternal(c.email, ctx.internal) && ((c.owner ?? "") !== (r.owner_now ?? "") || (c.region ?? "") !== (r.region_now ?? ""))).length;
        r.contacts_checked = true;
      }
    }
    await upsert(recs);
    ctx.companies += recs.length;
  }
}

/** Rows whose contacts were never counted and should be: they differ, or their country is live. */
async function recheck(ctx: Ctx): Promise<void> {
  const r = await query<{ company_id: string; owner_decided: string; sae: string | null }>(
    `SELECT company_id, owner_decided, sae FROM apsomh_map_assign
     WHERE contacts_off IS NULL AND (owner_now IS DISTINCT FROM owner_decided OR region_now IS DISTINCT FROM owner_decided OR country = ANY($1::text[]))
     ORDER BY company_id LIMIT $2`,
    [liveList(ctx.live), RECHECK_PER_RUN],
  );
  for (let i = 0; i < r.rows.length; i += 100) {
    const part = r.rows.slice(i, i + 100);
    const by = await contactsOf(part.map((x) => x.company_id), ctx);
    const upd = part.map((x) => ({ id: x.company_id, off: offCount(by.get(x.company_id) ?? [], { owner: x.owner_decided, sae: x.sae }, ctx.internal) }));
    await query(
      `UPDATE apsomh_map_assign m SET contacts_off = x.off, contacts_at = NOW()
       FROM jsonb_to_recordset($1::jsonb) AS x(id text, off int) WHERE m.company_id = x.id`,
      [JSON.stringify(upd)],
    );
  }
}

/* ── HubSpot writes (live countries only) ──────────────────────────────── */

/** Batch update, 100 at a time: id -> null (written) or the error. One bad record fails a whole batch, so a failed
 *  batch is written record by record to find it. 401/403 stops the run - no permission is not a per-record matter. */
export async function writeBatch(obj: "companies" | "contacts" | "tickets" | "tasks", inputs: { id: string; properties: Record<string, string> }[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  for (let i = 0; i < inputs.length; i += 100) {
    const chunk = inputs.slice(i, i + 100);
    try {
      const j = await hs<{ results?: { id: string }[]; errors?: { message?: string }[] }>(`/crm/v3/objects/${obj}/batch/update`, "POST", { inputs: chunk });
      const got = j.results ? new Set(j.results.map((r) => String(r.id))) : null;
      for (const r of chunk) out.set(r.id, !got || got.has(r.id) ? null : (j.errors?.[0]?.message ?? "not written").slice(0, 200));
    } catch (e) {
      if (refused(e)) throw new Error(`${obj}: HubSpot refused the write - ${msg(e)}`);
      for (const r of chunk) {
        try {
          await hs(`/crm/v3/objects/${obj}/${r.id}`, "PATCH", { properties: r.properties });
          out.set(r.id, null);
        } catch (e2) {
          if (refused(e2)) throw new Error(`${obj}: HubSpot refused the write - ${msg(e2)}`);
          out.set(r.id, msg(e2));
        }
      }
    }
  }
  return out;
}

export type Wrote = { companies: number; contacts: number; links: number; failed: number };

/**
 * Live countries, at most `breaker` companies a run - like the workflows they replace, NOT a sweep of every difference
 * (SARCLA 25.10.2026: "it will really copy as per today after the ERP load?"; "the redirections and the voluntary ones
 * exist in every country in different forms - only in HubSpot, both, or Performis"): a company is written when
 *   - its SAE, postcode or country changed since its country went live (the ERP load writes a new SAE - the Performis
 *     copy did the same), or it is new
 *   - it has no owner
 *   - its owner has left (to their successor, rules.successors)
 * Every other difference (an owner set by hand in HubSpot, one Performis has wrong) stays as it is - the Differences
 * tab shows it, "Fix" or Performis corrects it. Each company is read and decided again first; only what still differs
 * is written: the company, then its own contacts (A+P people left alone). A deactivated owner is never written.
 */
async function writeLive(ctx: Ctx, by: string): Promise<Wrote> {
  const w: Wrote = { companies: 0, contacts: 0, links: 0, failed: 0 };
  const live = liveList(ctx.live);
  if (!live.length || ctx.settings.breaker <= 0) return w;
  const pending = await query<{ company_id: string }>(
    `SELECT company_id FROM apsomh_map_assign m
     WHERE country = ANY($1::text[])
       AND (owner_now IS DISTINCT FROM owner_decided OR region_now IS DISTINCT FROM owner_decided OR contacts_off > 0)
       AND (wrote_error IS NULL OR wrote_at IS NULL OR wrote_at < NOW() - INTERVAL '${RETRY_FAILED_AFTER}')
       AND (owner_now IS NULL OR NOT (owner_now = ANY($3::text[]))
         OR m.facts_at >= COALESCE(($4::jsonb ->> m.country)::timestamptz, 'infinity'::timestamptz))
     ORDER BY (owner_now IS DISTINCT FROM owner_decided OR region_now IS DISTINCT FROM owner_decided) DESC, company_id
     LIMIT $2`,
    [live, ctx.settings.breaker, [...ctx.own.active], JSON.stringify(ctx.liveSince)],
  );
  await writeCompanies(pending.rows.map((r) => String(r.company_id)), ctx, by, w, { contacts: ctx.settings.contactBreaker }, { liveOnly: true });
  return w;
}

/** What a fix may look at to decide a company is still what was asked (fixTopic.ts). */
export type FixFacts = { sae: string | null; ownerNow: string | null; regionNow: string | null; decided: string; via: string };

/**
 * "Fix N in HubSpot" on a topic of the Differences (SARCLA 25.10.2026: "this should not create new rules on the
 * assignment - this should only correct the new ones because they are not related to Performis, so we can fix them"):
 * the same writes as a live country, for these companies only, whatever their country's switch - each read and decided
 * again first, skipped when `only` no longer holds (an SAE came meanwhile ...), only what differs written, contacts
 * following, every write logged. The rules are not touched.
 */
export async function fixCompanies(ids: string[], by: string, opts: { only?: (f: FixFacts) => boolean; signal?: AbortSignal; onBatch?: (w: Wrote) => Promise<void> } = {}): Promise<Wrote> {
  await ensureMapAssign();
  const ctx = await context(opts.signal);
  const w: Wrote = { companies: 0, contacts: 0, links: 0, failed: 0 };
  const only = opts.only;
  await writeCompanies(ids, ctx, by, w, { contacts: Number.MAX_SAFE_INTEGER }, {
    liveOnly: false,
    only: only ? (r) => only({ sae: r.sae, ownerNow: r.owner_now, regionNow: r.region_now, decided: r.owner_decided, via: r.via }) : undefined,
    onBatch: opts.onBatch ? () => opts.onBatch!(w) : undefined,
  });
  return w;
}

/** The writes of a live country (or a fix), 100 companies at a time: each read and decided again, the company then its
 *  own contacts, only what differs, logged; `budget.contacts` = the most contacts written. */
async function writeCompanies(all: string[], ctx: Ctx, by: string, w: Wrote, budget: { contacts: number },
  opts: { liveOnly: boolean; only?: (r: Rec) => boolean; onBatch?: () => Promise<void> }): Promise<void> {
  const active = isActive(ctx);
  for (let i = 0; i < all.length; i += 100) {
    stop(ctx);
    const ids = all.slice(i, i + 100);
    const fresh = await batchRead("companies", ids, companyProps(ctx.year));
    const recs: Rec[] = [];
    /** id -> the outcome to record (null = fine); absent = nothing was attempted */
    const outcome = new Map<string, string | null>();
    const logs: LogRow[] = [];
    const writes: { id: string; properties: Record<string, string> }[] = [];
    const before = new Map<string, Record<string, string | null>>();
    const ready: Rec[] = [];
    for (const id of ids) {
      const p = fresh.get(id);
      if (!p) { outcome.set(id, "not found in HubSpot (deleted or merged)"); continue; }
      const r = toRec({ id, properties: p }, ctx);
      recs.push(r);
      if (opts.liveOnly && !isLive(ctx, r.country)) continue; // its country changed meanwhile: the row is refreshed, nothing written
      if (opts.only && !opts.only(r)) { outcome.set(id, "no longer what the fix was asked for - not written"); continue; }
      if (!active(r.owner_decided)) { outcome.set(id, `${ctx.own.names.get(r.owner_decided) ?? r.owner_decided} is deactivated - not written`); continue; }
      const ch = companyChanges({ owner: r.owner_now, region: r.region_now }, r.owner_decided);
      if (Object.keys(ch).length) {
        writes.push({ id, properties: ch });
        before.set(id, { hubspot_owner_id: r.owner_now, region_responsibility: r.region_now });
      } else ready.push(r);
    }
    const res = await writeBatch("companies", writes);
    for (const x of writes) {
      const r = recs.find((y) => y.company_id === x.id)!;
      const e = res.get(x.id) ?? null;
      outcome.set(x.id, e);
      logs.push({ kind: "company", object_id: x.id, company_id: x.id, before: before.get(x.id), after: x.properties, error: e, by });
      if (e) { w.failed++; continue; }
      w.companies++;
      r.owner_now = r.owner_decided;
      r.region_now = r.owner_decided;
      ready.push(r);
    }
    // the contacts of the companies that are right now
    if (ready.length) {
      const kids = await contactsOf(ready.map((r) => r.company_id), ctx);
      const cw: { id: string; properties: Record<string, string>; company: string; before: Record<string, string | null> }[] = [];
      const left = new Map<string, number>();
      for (const r of ready) {
        for (const c of kids.get(r.company_id) ?? []) {
          if (isInternal(c.email, ctx.internal)) continue;
          const ch = contactChanges(c, { owner: r.owner_decided, sae: r.sae });
          if (!Object.keys(ch).length) continue;
          if (budget.contacts <= 0) { left.set(r.company_id, (left.get(r.company_id) ?? 0) + 1); continue; }
          budget.contacts--;
          cw.push({ id: c.id, properties: ch, company: r.company_id, before: { hubspot_owner_id: c.owner, region_responsibility: c.region, sae_performis: c.sae } });
        }
      }
      const cres = await writeBatch("contacts", cw.map(({ id, properties }) => ({ id, properties })));
      const failedOf = new Map<string, { n: number; first: string }>();
      for (const c of cw) {
        const e = cres.get(c.id) ?? null;
        logs.push({ kind: "contact", object_id: c.id, company_id: c.company, before: c.before, after: c.properties, error: e, by });
        if (e) {
          const f = failedOf.get(c.company) ?? { n: 0, first: e };
          f.n++;
          failedOf.set(c.company, f);
        } else w.contacts++;
      }
      for (const r of ready) {
        const f = failedOf.get(r.company_id);
        r.contacts_off = (f?.n ?? 0) + (left.get(r.company_id) ?? 0);
        r.contacts_checked = true;
        const touched = cw.some((c) => c.company === r.company_id) || outcome.has(r.company_id);
        if (f) { outcome.set(r.company_id, `${f.n} contact(s) not written: ${f.first}`.slice(0, 300)); w.failed++; }
        else if (touched) outcome.set(r.company_id, outcome.get(r.company_id) ?? null);
      }
    }
    await upsert(recs);
    if (outcome.size) {
      await query(
        `UPDATE apsomh_map_assign m SET wrote_at = NOW(), wrote_error = x.error
         FROM jsonb_to_recordset($1::jsonb) AS x(id text, error text) WHERE m.company_id = x.id`,
        [JSON.stringify([...outcome].map(([id, error]) => ({ id, error })))],
      );
    }
    await log(logs);
    await opts.onBatch?.();
  }
}

/* ── contacts with no company ──────────────────────────────────────────── */

type Cand = { id: string; name: string; ownerId: string | null; erpId: string | null; domain: string; country: string | null };

/** Companies whose `domain` is one of these (search IN, 100 domains a search, id cursor). */
async function companiesByDomain(domains: string[]): Promise<Map<string, Cand[]>> {
  const out = new Map<string, Cand[]>();
  for (let i = 0; i < domains.length; i += 100) {
    const values = domains.slice(i, i + 100);
    let cursor = "0";
    for (let page = 0; page < 20; page++) {
      const j = await hs<Page>("/crm/v3/objects/companies/search", "POST", {
        filterGroups: [{ filters: [{ propertyName: "domain", operator: "IN", values }, { propertyName: "hs_object_id", operator: "GT", value: cursor }] }],
        sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
        properties: ["name", "domain", "hubspot_owner_id", "erp_customer_id", "country", "country_custom"], limit: 200,
      });
      const res = j.results ?? [];
      for (const o of res) {
        const p = o.properties ?? {};
        const d = String(p.domain ?? "").trim().toLowerCase();
        if (!d) continue;
        const list = out.get(d) ?? [];
        list.push({ id: String(o.id), name: nz(p.name) ?? `Company ${o.id}`, ownerId: nz(p.hubspot_owner_id), erpId: nz(p.erp_customer_id), domain: d, country: countryOf({ id: String(o.id), country: p.country, countryCustom: p.country_custom }) });
        out.set(d, list);
      }
      if (res.length < 200) break;
      cursor = String(res[res.length - 1].id);
    }
  }
  return out;
}

type CompanyTarget = { id: string; owner: OwnerId; country: string | null; sae: string | null };
/** The decided owner of a company: the table's, else read and decided now (a company newer than the last scan). */
async function targetOf(companyId: string, ctx: Ctx): Promise<CompanyTarget | null> {
  const r = await query<{ owner_decided: string; country: string | null; sae: string | null }>(
    `SELECT owner_decided, country, sae FROM apsomh_map_assign WHERE company_id = $1`, [companyId],
  );
  if (r.rows[0]) return { id: companyId, owner: r.rows[0].owner_decided, country: r.rows[0].country, sae: r.rows[0].sae };
  const p = (await batchRead("companies", [companyId], companyProps(ctx.year))).get(companyId);
  if (!p) return null;
  const rec = toRec({ id: companyId, properties: p }, ctx);
  return { id: companyId, owner: rec.owner_decided, country: rec.country, sae: rec.sae };
}

/**
 * Link a contact to a company (primary when it has none) and, when the company's country is live, give the contact
 * the company's decided owner, region and SAE. `auto` (the engine): only while the contact still has no company.
 */
export async function linkContact(contactId: string, companyId: string, by: string, opts: { auto: boolean; ctx?: Ctx }): Promise<{ linked: boolean; owner: string | null; note?: string }> {
  await ensureMapAssign();
  const ctx = opts.ctx ?? (await context());
  const c = await hs<Obj>(`/crm/v3/objects/contacts/${contactId}?properties=${CONTACT_PROPS.join(",")}`);
  const p = c.properties ?? {};
  const primary = nz(p.associatedcompanyid);
  if (opts.auto && primary) return { linked: false, owner: null, note: "has a company now" };
  const t = await targetOf(companyId, ctx);
  if (!t) throw new Error(`company ${companyId} not found in HubSpot`);
  const types = primary ? [CONTACT_TO_COMPANY] : [CONTACT_TO_COMPANY, CONTACT_TO_PRIMARY_COMPANY];
  let error: string | null = null;
  try {
    await hs(`/crm/v4/objects/contact/${contactId}/associations/company/${companyId}`, "PUT", types.map((associationTypeId) => ({ associationCategory: "HUBSPOT_DEFINED", associationTypeId })));
  } catch (e) {
    if (refused(e)) throw new Error(`associations: HubSpot refused the write - ${msg(e)}`);
    error = msg(e);
  }
  await log([{ kind: "link", object_id: contactId, company_id: companyId, before: { associatedcompanyid: primary }, after: { company: companyId, primary: !primary }, error, by }]);
  if (error) {
    await query(`UPDATE apsomh_map_assign_nocompany SET wrote_at = NOW(), wrote_error = $2 WHERE contact_id = $1`, [contactId, error]);
    throw new Error(`link: ${error}`);
  }
  let owner: string | null = null;
  let note: string | undefined;
  if (!isLive(ctx, t.country)) note = `${t.country ?? "no country"} is not live - linked only, the owner is left to HubSpot`;
  else if (!ctx.own.active.has(String(t.owner))) note = `${ctx.own.names.get(t.owner) ?? t.owner} is deactivated - owner not written`;
  else if (isInternal(p.email, ctx.internal)) note = "an A+P address - owner not written";
  else {
    const ch = contactChanges({ owner: nz(p.hubspot_owner_id), region: nz(p.region_responsibility), sae: nz(p.sae_performis) }, { owner: t.owner, sae: t.sae });
    if (Object.keys(ch).length) {
      const e = (await writeBatch("contacts", [{ id: contactId, properties: ch }])).get(contactId) ?? null;
      await log([{ kind: "contact", object_id: contactId, company_id: companyId, before: { hubspot_owner_id: p.hubspot_owner_id ?? null, region_responsibility: p.region_responsibility ?? null, sae_performis: p.sae_performis ?? null }, after: ch, error: e, by }]);
      if (e) note = `linked; owner not written: ${e}`;
      else owner = t.owner;
    } else owner = t.owner;
  }
  await query(`DELETE FROM apsomh_map_assign_nocompany WHERE contact_id = $1`, [contactId]);
  return { linked: true, owner, ...(note ? { note } : {}) };
}

/** Recent contacts with no company: what their e-mail domain says, kept as the page's list; live + clear = linked. */
async function noCompanyScan(ctx: Ctx, by: string, w: Wrote): Promise<number> {
  const since = Date.now() - NO_COMPANY_DAYS * 86400_000;
  const found: Obj[] = [];
  let cursor = "0";
  for (let page = 0; page < 50; page++) {
    const j = await hs<Page>("/crm/v3/objects/contacts/search", "POST", {
      filterGroups: [{ filters: [
        { propertyName: "createdate", operator: "GTE", value: String(since) },
        { propertyName: "associatedcompanyid", operator: "NOT_HAS_PROPERTY" },
        { propertyName: "hs_object_id", operator: "GT", value: cursor },
      ] }],
      sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
      properties: ["email", "firstname", "lastname", "createdate", "hubspot_owner_id", "hs_email_domain"], limit: 200,
    });
    const res = j.results ?? [];
    found.push(...res);
    if (res.length < 200) break;
    cursor = String(res[res.length - 1].id);
  }
  const ext = found.filter((c) => !isInternal(c.properties?.email, ctx.internal));
  const domainOf = (c: Obj) => emailDomain(c.properties?.email) || String(c.properties?.hs_email_domain ?? "").trim().toLowerCase();
  const domains = [...new Set(ext.map(domainOf).filter((d) => d && !GENERIC_DOMAINS.has(d)))];
  const byDomain = await companiesByDomain(domains);
  const candIds = [...new Set([...byDomain.values()].flat().map((c) => c.id))];
  const known = new Map<string, { owner: string; country: string | null }>();
  if (candIds.length) {
    const r = await query<{ company_id: string; owner_decided: string; country: string | null }>(
      `SELECT company_id, owner_decided, country FROM apsomh_map_assign WHERE company_id = ANY($1::text[])`, [candIds],
    );
    for (const x of r.rows) known.set(String(x.company_id), { owner: x.owner_decided, country: x.country });
  }
  const rows = ext.map((c) => {
    const p = c.properties ?? {};
    const d = domainOf(c);
    const cands = byDomain.get(d) ?? [];
    const ownerOf = (k: Cand) => known.get(k.id)?.owner ?? k.ownerId;
    const res = contactCompany(d, cands.map((k) => ({ id: k.id, ownerId: ownerOf(k), erpId: k.erpId })));
    return {
      contact_id: String(c.id), email: nz(p.email), name: `${p.firstname ?? ""} ${p.lastname ?? ""}`.trim() || nz(p.email) || `Contact ${c.id}`,
      createdate: nz(p.createdate), owner_id: nz(p.hubspot_owner_id), why: res.why, suggested_owner: res.owner, link: res.link,
      candidates: cands.slice(0, 20).map((k) => ({ id: k.id, name: k.name, ownerId: ownerOf(k), erpId: k.erpId })),
      country: res.link ? (known.get(res.link)?.country ?? cands.find((k) => k.id === res.link)?.country ?? null) : null,
    };
  });
  for (let i = 0; i < rows.length; i += 500) {
    await query(
      `INSERT INTO apsomh_map_assign_nocompany (contact_id, email, name, createdate, owner_id, why, suggested_owner, link, candidates, checked_at)
       SELECT x.contact_id, x.email, x.name, x.createdate, x.owner_id, x.why, x.suggested_owner, x.link, COALESCE(x.candidates, '[]'::jsonb), NOW()
       FROM jsonb_to_recordset($1::jsonb) AS x(contact_id text, email text, name text, createdate timestamptz, owner_id text, why text,
         suggested_owner text, link text, candidates jsonb)
       ON CONFLICT (contact_id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, createdate = EXCLUDED.createdate,
         owner_id = EXCLUDED.owner_id, why = EXCLUDED.why, suggested_owner = EXCLUDED.suggested_owner, link = EXCLUDED.link,
         candidates = EXCLUDED.candidates, checked_at = NOW()`,
      [JSON.stringify(rows.slice(i, i + 500).map(({ country: _c, ...r }) => r))],
    );
  }
  // linked meanwhile, older than 14 days, or an A+P person: off the list
  await query(`DELETE FROM apsomh_map_assign_nocompany WHERE NOT (contact_id = ANY($1::text[]))`, [rows.map((r) => r.contact_id)]);

  let budget = ctx.settings.linkBreaker;
  for (const r of rows) {
    if (budget <= 0) break;
    if (!r.link || !isLive(ctx, r.country)) continue;
    stop(ctx);
    budget--;
    try {
      const out = await linkContact(r.contact_id, r.link, by, { auto: true, ctx });
      if (out.linked) w.links++;
    } catch (e) {
      if (/refused/.test(msg(e))) throw e;
      w.failed++;
    }
  }
  return rows.length;
}

/* ── the rules changed: decide every stored company again ──────────────── */

export async function redecideAll(): Promise<number> {
  await ensureMapAssign();
  const own = await owners();
  const ctx = { rules: (await getRules()).value, own, redir: await redirState() };
  // the region again too (the postcode files ship with the hub: a new deploy may place a postcode)
  const geo = await loadGeo();
  const r = await query<{
    company_id: string; country: string | null; country_raw: string | null; country_custom: string | null; zip: string | null; region: string | null;
    sae: string | null; erp_id: string | null; owner_now: string | null; owner_decided: string; via: string; detail: string | null; flags: string[] | null;
  }>(`SELECT company_id, country, country_raw, country_custom, zip, region, sae, erp_id, owner_now, owner_decided, via, detail, flags FROM apsomh_map_assign`);
  const changed: { id: string; country: string | null; region: string | null; owner: string; via: string; detail: string; flags: string; reset: boolean }[] = [];
  for (const row of r.rows) {
    const region = regionOf(geo, countryOf(factsOf({ ...row, region: null })), row.zip);
    const d = decideRec(factsOf({ ...row, region }), ctx, row.owner_now);
    const flags = d.flags.join(",");
    if (d.owner === row.owner_decided && d.via === row.via && d.detail === (row.detail ?? "") && flags === (row.flags ?? []).join(",") && d.country === row.country
      && region === (row.region ?? null)) continue;
    changed.push({ id: row.company_id, country: d.country, region, owner: d.owner, via: d.via, detail: d.detail, flags, reset: d.owner !== row.owner_decided });
  }
  for (let i = 0; i < changed.length; i += 1000) {
    await query(
      `UPDATE apsomh_map_assign m SET country = x.country, region = x.region, owner_decided = x.owner, via = x.via, detail = x.detail,
         flags = COALESCE(string_to_array(NULLIF(x.flags, ''), ','), '{}'),
         contacts_off = CASE WHEN x.reset THEN NULL ELSE m.contacts_off END,
         contacts_at = CASE WHEN x.reset THEN NULL ELSE m.contacts_at END
       FROM jsonb_to_recordset($1::jsonb) AS x(id text, country text, region text, owner text, via text, detail text, flags text, reset boolean)
       WHERE m.company_id = x.id`,
      [JSON.stringify(changed.slice(i, i + 1000))],
    );
  }
  return changed.length;
}

/* ── one run ───────────────────────────────────────────────────────────── */

async function* allCompanies(ctx: Ctx): AsyncGenerator<Obj[]> {
  let after: string | undefined;
  for (;;) {
    stop(ctx);
    const j = await hs<Page>(`/crm/v3/objects/companies?limit=100&archived=false&properties=${companyProps(ctx.year).join(",")}${after ? `&after=${encodeURIComponent(after)}` : ""}`);
    yield j.results ?? [];
    after = j.paging?.next?.after;
    if (!after) return;
  }
}
async function* changedCompanies(since: number, ctx: Ctx): AsyncGenerator<Obj[]> {
  let cursor = "0";
  for (;;) {
    stop(ctx);
    const j = await hs<Page>("/crm/v3/objects/companies/search", "POST", {
      filterGroups: [{ filters: [
        { propertyName: "hs_lastmodifieddate", operator: "GTE", value: String(since) },
        { propertyName: "hs_object_id", operator: "GT", value: cursor },
      ] }],
      sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], properties: companyProps(ctx.year), limit: 200,
    });
    const res = j.results ?? [];
    if (res.length) yield res;
    if (res.length < 200) return;
    cursor = String(res[res.length - 1].id);
  }
}

async function run(want: "full" | "changes" | undefined, signal: AbortSignal | undefined, by: string): Promise<RunInfo> {
  await ensureMapAssign();
  const t0 = Date.now();
  await applyRuleFixes().catch((e) => console.warn(`[map-assign] corrections not applied: ${msg(e)}`));
  const ctx = await context(signal);
  const cursor = await kvGet<number>(KV.cursor);
  const lastFull = await kvGet<RunInfo>(KV.lastFull);
  // due at night - or at once when the last full read kept fewer facts than this version (the new columns, the
  // contacts counts), outside the ERP chain
  const stale = !!lastFull && (lastFull.v ?? 1) < SCAN_VERSION;
  let mode: "full" | "changes" = want ?? ((fullDue(t0, lastFull?.at ? Date.parse(lastFull.at) : null, NIGHTLY_AT) || stale) && !(await chainRunning()) ? "full" : "changes");
  if (!Number.isFinite(Number(cursor)) || !lastFull) mode = "full"; // never read everything yet
  ctx.full = mode === "full";

  // the rules the table was decided with - a new seed in the code while nobody saved rules, an answer to a conflict:
  // decide every stored company again before anything is read or written (20.10.2026: France stayed "postcodes only"
  // in Differences all afternoon after its seed changed)
  const sig = createHash("sha256").update(JSON.stringify([ctx.rules, [...ctx.redir.held].sort()]), "utf8").digest("hex");
  if (String((await kvGet<string>(KV.decidedWith)) ?? "") !== sig) {
    const n = await redecideAll();
    await kvSet(KV.decidedWith, sig);
    console.log(`[map-assign] the rules changed since the table was decided: ${n} companies decided again`);
  }

  if (mode === "full") {
    const startedDb = (await query<{ t: string }>(`SELECT NOW()::text AS t`)).rows[0].t;
    for await (const page of allCompanies(ctx)) await processCompanies(page, ctx);
    // deleted or merged in HubSpot since the last full read
    await query(`DELETE FROM apsomh_map_assign WHERE checked_at < $1::timestamptz`, [startedDb]);
    await query(`DELETE FROM apsomh_map_assign_log WHERE at < NOW() - ($1::int * INTERVAL '1 day')`, [LOG_KEEP_DAYS]);
  } else {
    for await (const page of changedCompanies(Number(cursor) - OVERLAP_MS, ctx)) await processCompanies(page, ctx);
  }
  // read: the next run starts from here, even when a write below fails
  await kvSet(KV.cursor, t0);
  if (mode === "full") await kvSet(KV.lastFull, { at: new Date(t0).toISOString(), seconds: Math.round((Date.now() - t0) / 1000), companies: ctx.companies, contacts: ctx.contacts, mode, v: SCAN_VERSION } satisfies RunInfo);
  await recheck(ctx);
  const wrote = await writeLive(ctx, by);
  const noCompany = await noCompanyScan(ctx, by, wrote);
  await ticketLoad(ctx).catch((e) => console.warn(`[map-assign] ticket workload not read: ${msg(e)}`));
  // the Contacts view: the new contacts of the last 30 days and whether they follow the rules - at most hourly
  await newContactsKpi(signal, ctx.internal).catch((e) => console.warn(`[map-assign] new contacts not counted: ${msg(e)}`));
  // contacts follow their company when Automatic is on (SARCLA 24.10.2026: "corrected instantly as associated") - contactFollow.ts
  await followOnRun(signal, ctx.internal).catch((e) => console.warn(`[map-assign] contacts follow: ${msg(e)}`));

  // the rules were saved while this run decided with the old ones
  const rulesNow = await getRules();
  const redecided = rulesNow.at !== ctx.rulesAt ? await redecideAll() : undefined;

  const info: RunInfo = {
    at: new Date(t0).toISOString(), seconds: Math.round((Date.now() - t0) / 1000), companies: ctx.companies, contacts: ctx.contacts, mode,
    differ: ctx.differ, wrote, noCompany, live: liveList(ctx.live), ...(redecided !== undefined ? { redecided } : {}), ...(mode === "full" ? { v: SCAN_VERSION } : {}),
  };
  await kvSet(KV.last, info);
  if (mode === "full") await kvSet(KV.lastFull, info);
  return info;
}

/** One run under the lock; null = another copy of the hub is running it. */
export async function runOnce(opts: { mode?: "full" | "changes"; signal?: AbortSignal; by?: string } = {}): Promise<RunInfo | null> {
  await ensureMapAssign();
  const { signal } = opts;
  const client: PoolClient = await getPool().connect();
  let dropped = false;
  const drop = () => { dropped = true; client.release(new Error("map assignment: time limit")); };
  if (signal?.aborted) drop(); else signal?.addEventListener("abort", drop, { once: true });
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await run(opts.mode, signal, opts.by ?? "map assignment").catch(async (e) => {
        const info: RunInfo = { at: new Date().toISOString(), seconds: 0, companies: 0, contacts: 0, mode: opts.mode ?? "changes", error: msg(e) };
        await kvSet(KV.last, info).catch(() => {});
        return info;
      });
    } finally {
      if (!dropped) await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    signal?.removeEventListener("abort", drop);
    if (!dropped) client.release();
  }
}

/** Is a run going - here, or on the other copy of the hub (its advisory lock)? */
export async function isRunning(): Promise<boolean> {
  if (running) return true;
  const r = await query<{ held: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND classid = 0 AND objid = $1::bigint::oid AND objsubid = 1 AND granted) AS held`, [LOCK],
  );
  return !!r.rows[0]?.held;
}

let started = false, running = false;

/** Start a run in the background (the timer, or "run now" on the page). False = one is going already. */
export function kick(by = "map assignment", mode?: "full" | "changes"): boolean {
  if (running) return false;
  running = true;
  const limit = new AbortController();
  const timer = setTimeout(() => {
    console.error(`[map-assign] run still going after ${LIMIT_MS / 60_000} min - stopped and its lock dropped`);
    limit.abort();
    running = false;
  }, LIMIT_MS);
  timer.unref?.();
  void runOnce({ mode, signal: limit.signal, by })
    .then((info) => { if (info?.error) console.warn(`[map-assign] ${info.error}`); })
    .catch((e) => console.warn(`[map-assign] ${msg(e)}`))
    .finally(() => { clearTimeout(timer); if (!limit.signal.aborted) running = false; });
  return true;
}

export function startMapAssign() {
  if (started || process.env.MAP_ASSIGN === "off") return;
  started = true;
  // the two copies start seconds apart: a different first tick each, the lock lets one run
  setTimeout(() => kick(), 150_000 + Math.floor(Math.random() * 60_000)).unref?.();
  setInterval(() => kick(), EVERY_MS).unref?.();
}

/* ── the page's data ───────────────────────────────────────────────────── */

type DbChange = {
  company_id: string; name: string | null; country: string | null; zip: string | null; sae: string | null; owner_now: string | null; region_now: string | null;
  owner_decided: string; via: Via; detail: string | null; flags: string[] | null; contacts_off: number | null; wrote_at: Date | null; wrote_error: string | null;
};
type DbNoCompany = {
  contact_id: string; email: string | null; name: string | null; createdate: Date | null; owner_id: string | null; why: string | null;
  suggested_owner: string | null; link: string | null; candidates: NoCompany["candidates"] | null;
};
const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);
const toChange = (r: DbChange): CompanyChange => ({
  id: String(r.company_id), name: r.name ?? `Company ${r.company_id}`, country: r.country, zip: r.zip, sae: r.sae,
  ownerNow: r.owner_now, regionNow: r.region_now,
  decided: { owner: r.owner_decided, via: r.via, country: r.country, detail: r.detail ?? "", flags: r.flags ?? [] },
  contactsOff: r.contacts_off ?? 0,
  wrote: r.wrote_at ? { at: iso(r.wrote_at)!, ok: !r.wrote_error, ...(r.wrote_error ? { error: r.wrote_error } : {}) } : null,
});

export async function mapData(admin: boolean): Promise<MapData> {
  await ensureMapAssign();
  const rules = await getRules();
  const live = await getLive();
  const last = await lastRun();
  const own = await owners().catch(() => null);

  const sum = await query<{ country: string; companies: number; change: number }>(
    `SELECT COALESCE(country, '${NO_COUNTRY}') AS country, count(*)::int AS companies,
       (count(*) FILTER (WHERE owner_now IS DISTINCT FROM owner_decided OR region_now IS DISTINCT FROM owner_decided))::int AS change
     FROM apsomh_map_assign GROUP BY 1 ORDER BY 2 DESC, 1`,
  );
  const byOwner = await query<{ country: string; owner: string; n: number }>(
    `SELECT COALESCE(country, '${NO_COUNTRY}') AS country, owner_decided AS owner, count(*)::int AS n FROM apsomh_map_assign GROUP BY 1, 2 ORDER BY 3 DESC`,
  );
  const vias = await query<{ country: string; via: string; n: number }>(
    `SELECT COALESCE(country, '${NO_COUNTRY}') AS country, via, count(*)::int AS n FROM apsomh_map_assign GROUP BY 1, 2`,
  );
  // what a country writes as soon as it goes live: the companies with no owner, or one who has left (writeLive)
  const atOnce = own ? await query<{ country: string; n: number }>(
    `SELECT COALESCE(country, '${NO_COUNTRY}') AS country, count(*)::int AS n FROM apsomh_map_assign
     WHERE (owner_now IS DISTINCT FROM owner_decided OR region_now IS DISTINCT FROM owner_decided)
       AND (owner_now IS NULL OR NOT (owner_now = ANY($1::text[]))) GROUP BY 1`, [[...own.active]],
  ) : { rows: [] as { country: string; n: number }[] };
  const flags = await query<{ country: string; f: string; n: number }>(
    `SELECT COALESCE(country, '${NO_COUNTRY}') AS country, f, count(*)::int AS n FROM apsomh_map_assign, unnest(flags) AS f GROUP BY 1, 2`,
  );
  const countries: CountrySummary[] = sum.rows.map((s) => ({
    country: s.country, companies: s.companies, change: s.change,
    byOwner: byOwner.rows.filter((b) => b.country === s.country).map((b) => ({ owner: b.owner, companies: b.n })),
    flags: Object.fromEntries(flags.rows.filter((f) => f.country === s.country).map((f) => [f.f, f.n])),
    byVia: Object.fromEntries(vias.rows.filter((v) => v.country === s.country).map((v) => [v.via, v.n])),
    live: !!live.value[s.country],
    writeAtOnce: atOnce.rows.find((a) => a.country === s.country)?.n ?? 0,
    liveSince: live.since[s.country] ?? null,
  }));

  const ch = await query<DbChange>(
    `WITH c AS (SELECT country, count(*) AS n FROM apsomh_map_assign GROUP BY country)
     SELECT m.company_id, m.name, m.country, m.zip, m.sae, m.owner_now, m.region_now, m.owner_decided, m.via, m.detail, m.flags,
       m.contacts_off, m.wrote_at, m.wrote_error
     FROM apsomh_map_assign m JOIN c ON c.country IS NOT DISTINCT FROM m.country
     WHERE m.owner_now IS DISTINCT FROM m.owner_decided OR m.region_now IS DISTINCT FROM m.owner_decided OR m.contacts_off > 0
     ORDER BY c.n DESC, m.country NULLS LAST, (m.owner_now IS DISTINCT FROM m.owner_decided) DESC, m.name NULLS LAST, m.company_id
     LIMIT ${CHANGES_SHOWN}`,
  );
  const changes: CompanyChange[] = ch.rows.map(toChange);

  const nc = await query<DbNoCompany>(
    `SELECT contact_id, email, name, createdate, owner_id, why, suggested_owner, link, candidates FROM apsomh_map_assign_nocompany
     ORDER BY createdate DESC NULLS LAST, contact_id DESC LIMIT ${NO_COMPANY_SHOWN}`,
  );
  const noCompany: NoCompany[] = nc.rows.map((r) => ({
    id: String(r.contact_id), email: r.email, name: r.name ?? r.email ?? `Contact ${r.contact_id}`, createdate: iso(r.createdate), ownerId: r.owner_id,
    why: r.why ?? "", suggestedOwner: r.suggested_owner, link: r.link, candidates: Array.isArray(r.candidates) ? r.candidates : [],
  }));

  const mv = await query<{ country: string; from: string | null; to: string; companies: number; contacts: number }>(
    `SELECT COALESCE(country, '${NO_COUNTRY}') AS country, owner_now AS "from", owner_decided AS "to",
       (count(*) FILTER (WHERE owner_now IS DISTINCT FROM owner_decided OR region_now IS DISTINCT FROM owner_decided))::int AS companies,
       COALESCE(sum(contacts_off), 0)::int AS contacts
     FROM apsomh_map_assign
     WHERE owner_now IS DISTINCT FROM owner_decided OR region_now IS DISTINCT FROM owner_decided OR contacts_off > 0
     GROUP BY 1, 2, 3 ORDER BY 4 DESC, 5 DESC`,
  );
  const moves: MoveStat[] = mv.rows.map((m) => ({ country: m.country, from: m.from, to: m.to, companies: m.companies, contacts: m.contacts }));

  const latest = [rules, live].filter((x) => x.at).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  return {
    rules: rules.value, seeded: SEED, owners: own?.list ?? [], live: live.value, last, countries, changes, noCompany, admin,
    moves, conflicts: await conflicts(), sandbox: await getSandbox(),
    by: latest?.by ?? null, at: latest?.at ?? null,
  };
}

/** Owner redirection rules against the map: every enabled rule that gives stored companies to someone the map would
 *  not, and every rule with an answer (so an accepted one shows as switched off). Open ones first. */
export async function conflicts(): Promise<RedirectionConflict[]> {
  let stored;
  try { stored = await listRules(); } catch (e) { console.warn(`[map-assign] owner redirection rules unreadable: ${msg(e)}`); return []; }
  const enabled = publishedRules(stored);
  const answers = await redirAnswers();
  const rows = await query<ConflictRow>(`SELECT country, country_raw, country_custom, owner_now, owner_decided FROM apsomh_map_assign`);
  const counts = conflictCounts(rows.rows, enabled);
  const out: RedirectionConflict[] = [];
  stored.forEach((r, i) => {
    const c = counts.get(r.id) ?? { matched: 0, against: [] };
    const a = answers[r.id];
    const decision = a ? { decision: a.decision, at: a.at, by: a.by, current: a.sig === redirectionSig(r) } : null;
    if (!(r.enabled && (c.against.length || decision)) && !(decision && decision.decision === "map")) return;
    out.push({
      ruleId: r.id, position: i + 1, enabled: r.enabled, kind: r.kind,
      countries: r.kind === "country" ? r.countries : [], customCountries: r.kind === "country" ? r.customCountries : [],
      fromOwner: r.kind === "owner" ? r.fromOwner : null, toOwner: r.toOwner, matched: c.matched, against: c.against, decision,
    });
  });
  const open = (c: RedirectionConflict) => c.enabled && c.against.length > 0 && !(c.decision?.current && c.decision.decision === "rule");
  return out.sort((x, y) => Number(open(y)) - Number(open(x)) || x.position - y.position);
}

/** Companies by ERP id (at most 1,000) or by a search on name / ERP id (the first 25, by name); a country narrows both. */
export async function companyRows(f: { erp?: string[]; q?: string | null; country?: string | null }): Promise<CompanyRow[]> {
  await ensureMapAssign();
  const args: unknown[] = [];
  const arg = (v: unknown) => { args.push(v); return `$${args.length}`; };
  const where: string[] = [];
  if (f.country) where.push(`country = ${arg(f.country)}`);
  const erp = (f.erp ?? []).map((x) => x.trim()).filter(Boolean).slice(0, 1000);
  const q = likeEscape(String(f.q ?? "").trim());
  if (erp.length) where.push(`erp_id = ANY(${arg(erp)}::text[])`);
  else if (q) where.push(`(name ILIKE ${arg(`%${q}%`)} OR erp_id ILIKE ${arg(`${q}%`)})`);
  else return [];
  const year = yearNow();
  const r = await query<{ company_id: string; name: string | null; erp_id: string | null; country: string | null; zip: string | null; owner_now: string | null;
    owner_decided: string | null; via: string | null; revenue_cy: number | null; revenue_year: number | null }>(
    `SELECT company_id, name, erp_id, country, zip, owner_now, owner_decided, via, revenue_cy, revenue_year FROM apsomh_map_assign
     WHERE ${where.join(" AND ")} ORDER BY name NULLS LAST, company_id LIMIT ${erp.length ? 1000 : 25}`, args,
  );
  return r.rows.map((x) => ({
    id: String(x.company_id), name: x.name ?? `Company ${x.company_id}`, erpId: x.erp_id, country: x.country, zip: x.zip,
    ownerNow: x.owner_now, decided: x.owner_decided, via: x.via,
    revenue: Number(x.revenue_year) === year && x.revenue_cy !== null ? Number(x.revenue_cy) : null,
  }));
}

/** One move's companies (Differences): country, owner now ("" = nobody), owner by the rules; a search on name,
 *  postcode or SAE; 50 a page, by name. */
export async function changesPage(f: { country?: string | null; from?: string | null; to?: string | null; q?: string | null; offset?: number }): Promise<ChangesPage> {
  await ensureMapAssign();
  const where = [`(m.owner_now IS DISTINCT FROM m.owner_decided OR m.region_now IS DISTINCT FROM m.owner_decided OR m.contacts_off > 0)`];
  const args: unknown[] = [];
  const arg = (v: unknown) => { args.push(v); return `$${args.length}`; };
  if (f.country) where.push(f.country === NO_COUNTRY ? `m.country IS NULL` : `m.country = ${arg(f.country)}`);
  if (f.from !== undefined && f.from !== null) where.push(f.from === "" ? `m.owner_now IS NULL` : `m.owner_now = ${arg(f.from)}`);
  if (f.to) where.push(`m.owner_decided = ${arg(f.to)}`);
  const q = likeEscape(String(f.q ?? "").trim());
  if (q) where.push(`(m.name ILIKE ${arg(`%${q}%`)} OR m.zip ILIKE ${arg(`${q}%`)} OR m.sae ILIKE ${arg(`%${q}%`)})`);
  const offset = Math.max(0, Math.floor(Number(f.offset) || 0));
  const w = where.join(" AND ");
  const total = await query<{ n: number }>(`SELECT count(*)::int AS n FROM apsomh_map_assign m WHERE ${w}`, args);
  const r = await query<DbChange>(
    `SELECT m.company_id, m.name, m.country, m.zip, m.sae, m.owner_now, m.region_now, m.owner_decided, m.via, m.detail, m.flags,
       m.contacts_off, m.wrote_at, m.wrote_error
     FROM apsomh_map_assign m WHERE ${w}
     ORDER BY m.name NULLS LAST, m.company_id LIMIT 50 OFFSET ${offset}`, args,
  );
  return { total: total.rows[0]?.n ?? 0, offset, rows: r.rows.map(toChange) };
}

/* ── the map's layers (GET ?layers=CC) ─────────────────────────────────── */

/**
 * One country's companies per postcode point, from the table (refreshed by every scan): companies, customers this
 * year (order_last_order_date this year), new customers (order_first_order_date this year), revenue this year
 * (revenue_<year>, EUR), sales_priority P1..P4, the three biggest customers; GDP per region from public/geo/gdp.
 * A postcode is shown at its own point, else the nearest one with the same beginning (placeZip); none = `unplaced`.
 * Without a postcode file the cleaned postcode is the key (the page cannot place those).
 */
export async function layerData(country: string, opts: { rules?: AssignRules } = {}): Promise<LayerData> {
  await ensureMapAssign();
  const cc = country.trim().toUpperCase();
  const year = yearNow();
  const r = await query<{
    company_id: string; name: string | null; zip: string | null; owner_now: string | null; revenue_cy: number | null; revenue_year: number | null;
    last_order: string | null; first_order: string | null; priority: string | null; sae: string | null; owner_decided: string | null; region_now: string | null;
    via: string | null; tickets_90: number | null; sales_90: number | null; apso_customer: string | null; sales_open: number | null;
    country_raw: string | null; country_custom: string | null; region: string | null; erp_id: string | null;
  }>(
    `SELECT company_id, name, zip, owner_now, revenue_cy, revenue_year, last_order, first_order, priority, sae, owner_decided, region_now, via, tickets_90, sales_90,
       apso_customer, country_raw, country_custom, region, erp_id, sales_open
     FROM apsomh_map_assign WHERE country = $1`, [cc],
  );
  // the sandbox: every company decided again with its rules, here only (the table keeps the live decision)
  if (opts.rules) {
    const ctx = { rules: opts.rules, own: await owners(), redir: await redirState() };
    for (const x of r.rows) {
      const d = decideRec(factsOf({ company_id: x.company_id, country_raw: x.country_raw, country_custom: x.country_custom, zip: x.zip, region: x.region, sae: x.sae, erp_id: x.erp_id }), ctx, x.owner_now);
      x.owner_decided = d.owner; x.via = d.via;
    }
  }
  const rows: LayerRow[] = r.rows.map((x) => ({
    id: String(x.company_id), name: x.name, zip: x.zip, owner: x.owner_now,
    // a row read before New Year holds last year's revenue: none until the next read
    revenue: Number(x.revenue_year) === year ? x.revenue_cy : null,
    lastOrder: x.last_order, firstOrder: x.first_order, priority: x.priority, sae: x.sae, decided: x.owner_decided, region: x.region_now, via: x.via,
    tickets: x.tickets_90, sales: x.sales_90, category: x.apso_customer,
  }));
  const ix = await zipsOf(cc);
  const place = ix.keys.length ? (z: string | null) => placeZip(ix, z)?.code ?? null : (z: string | null) => cleanZip(z) || null;
  const { points, unplaced } = layerPoints(rows, place, year);
  const last = await lastRun();
  // the workload per person: owner now and by the rules; of the companies by the rules, customers / revenue this year
  const by = new Map<string, OwnerLoad>();
  const at = (o: string) => by.get(o) ?? (by.set(o, { owner: o, now: 0, after: 0, customers: 0, newCustomers: 0, revenue: 0, contacts: 0, tickets: 0, sales: 0, salesOpen: 0, priority: {}, category: {} }), by.get(o)!);
  const extra = await query<{ company_id: string; contacts_n: number | null }>(`SELECT company_id, contacts_n FROM apsomh_map_assign WHERE country = $1`, [cc]);
  const contactsOf = new Map(extra.rows.map((x) => [String(x.company_id), Number(x.contacts_n) || 0]));
  for (const x of r.rows) {
    if (x.owner_now) at(String(x.owner_now)).now++;
    if (!x.owner_decided) continue;
    const a = at(String(x.owner_decided));
    a.after++;
    if (inYear(x.last_order, year)) a.customers++;
    if (inYear(x.first_order, year)) a.newCustomers++;
    a.tickets += Number(x.tickets_90) || 0;
    a.sales += Number(x.sales_90) || 0;
    a.salesOpen! += Number(x.sales_open) || 0;
    if (Number(x.revenue_year) === year && Number.isFinite(Number(x.revenue_cy))) a.revenue += Number(x.revenue_cy);
    a.contacts += contactsOf.get(String(x.company_id)) ?? 0;
    // the split SARCLA asked for (24.10.2026): "PRIO and APSOcustomer" - "" = none
    const pk = priorityKey(x.priority) ?? "";
    a.priority![pk] = (a.priority![pk] ?? 0) + 1;
    const ck = String(x.apso_customer ?? "").trim();
    a.category![ck] = (a.category![ck] ?? 0) + 1;
  }
  const load = [...by.values()].map((l) => ({ ...l, revenue: Math.round(l.revenue) })).sort((a, b) => b.after - a.after || b.now - a.now);
  return {
    country: cc, at: last?.at ?? null, points, unplaced, gdp: await gdpOf(cc), gdpSource: await gdpSourceOf(cc),
    revenueField: revenueField(year), customersField: CUSTOMERS_FIELD,
    load, tickets: (await kvGet<TicketLoad>(KV.tickets)) ?? null,
  };
}

/* ── the ticket workload (the KPI view) ────────────────────────────────── */

const SALES_PIPELINES = ["1726599376", "1726599377"]; // ESO, TSA
/** ESO + TSA tickets per owner - open now, created in the last 90 days - in paged searches, at most hourly. */
async function ticketLoad(ctx: Ctx): Promise<void> {
  const had = await kvGet<TicketLoad>(KV.tickets);
  if (had?.at && Date.now() - Date.parse(had.at) < 60 * 60_000) return;
  const byOwner: TicketLoad["byOwner"] = {};
  const count = async (filters: unknown[], key: "open" | "last90") => {
    let after: string | undefined;
    for (let page = 0; page < 50; page++) {
      stop(ctx);
      const j = await hs<{ results?: { properties?: Props }[]; paging?: { next?: { after?: string } } }>("/crm/v3/objects/tickets/search", "POST", {
        filterGroups: [{ filters: [{ propertyName: "hs_pipeline", operator: "IN", values: SALES_PIPELINES }, ...filters] }],
        properties: ["hubspot_owner_id"], sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200, after,
      });
      for (const t of j.results ?? []) {
        const o = String(t.properties?.hubspot_owner_id ?? "");
        if (!o) continue;
        const e = byOwner[o] ?? (byOwner[o] = { open: 0, last90: 0 });
        e[key]++;
      }
      after = j.paging?.next?.after;
      if (!after) break;
    }
  };
  await count([{ propertyName: "closed_date", operator: "NOT_HAS_PROPERTY" }], "open");
  await count([{ propertyName: "createdate", operator: "GTE", value: String(Date.now() - 90 * 86_400_000) }], "last90");
  await kvSet(KV.tickets, { at: new Date().toISOString(), byOwner } satisfies TicketLoad);
  await ticketsPerCompany(ctx);
}

/** Every ticket of the last 90 days, pipeline by pipeline in 30-day windows (a search answers 10,000 at most), and
 *  its companies: tickets_90 (all) and sales_90 (ESO + TSA) on each company row. */
async function ticketsPerCompany(ctx: Ctx): Promise<void> {
  const pipes = await hs<{ results?: { id: string; stages?: { id: string; metadata?: { isClosed?: string | boolean } }[] }[] }>("/crm/v3/pipelines/tickets");
  const sales = new Set(SALES_PIPELINES);
  const tickets = new Map<string, boolean>(); // ticket -> a sales ticket
  const now = Date.now();
  for (const pl of pipes.results ?? []) {
    for (let w = 0; w < 3; w++) {
      const from = now - (w + 1) * 30 * 86_400_000, to = now - w * 30 * 86_400_000;
      let after: string | undefined;
      for (let page = 0; page < 50; page++) {
        stop(ctx);
        const j = await hs<{ results?: { id: string }[]; paging?: { next?: { after?: string } } }>("/crm/v3/objects/tickets/search", "POST", {
          filterGroups: [{ filters: [
            { propertyName: "hs_pipeline", operator: "EQ", value: pl.id },
            { propertyName: "createdate", operator: "GTE", value: String(from) },
            { propertyName: "createdate", operator: "LT", value: String(to) },
          ] }],
          properties: ["hs_pipeline"], sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200, after,
        });
        for (const t of j.results ?? []) tickets.set(String(t.id), sales.has(String(pl.id)));
        after = j.paging?.next?.after;
        if (!after) break;
      }
    }
  }
  const per = new Map<string, { all: number; sales: number }>();
  const ids = [...tickets.keys()];
  for (let i = 0; i < ids.length; i += 1000) {
    stop(ctx);
    const j = await hs<{ results?: { from: { id: string }; to?: { toObjectId: string | number }[] }[] }>("/crm/v4/associations/tickets/companies/batch/read", "POST", {
      inputs: ids.slice(i, i + 1000).map((id) => ({ id })),
    });
    for (const r of j.results ?? []) {
      const isSales = tickets.get(String(r.from.id)) ?? false;
      for (const t of r.to ?? []) {
        const c = per.get(String(t.toObjectId)) ?? { all: 0, sales: 0 };
        c.all++;
        if (isSales) c.sales++;
        per.set(String(t.toObjectId), c);
      }
    }
  }
  // the open ESO + TSA tickets, whenever created, per company (the KPI's "Sales open" in a country)
  const open: string[] = [];
  for (const pl of (pipes.results ?? []).filter((p) => SALES_PIPELINES.includes(String(p.id)))) {
    const closed = (pl.stages ?? []).filter((st) => st.metadata?.isClosed === true || st.metadata?.isClosed === "true").map((st) => st.id);
    let cursor = "0";
    for (let page = 0; page < 100; page++) {
      stop(ctx);
      const j = await hs<{ results?: { id: string }[] }>("/crm/v3/objects/tickets/search", "POST", {
        filterGroups: [{ filters: [
          { propertyName: "hs_pipeline", operator: "EQ", value: pl.id },
          ...(closed.length ? [{ propertyName: "hs_pipeline_stage", operator: "NOT_IN", values: closed }] : []),
          { propertyName: "hs_object_id", operator: "GT", value: cursor },
        ] }],
        properties: ["hs_pipeline"], sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200,
      });
      const res = j.results ?? [];
      open.push(...res.map((t) => String(t.id)));
      if (res.length < 200) break;
      cursor = String(res[res.length - 1].id);
    }
  }
  const openPer = new Map<string, number>();
  for (let i = 0; i < open.length; i += 1000) {
    stop(ctx);
    const j = await hs<{ results?: { from: { id: string }; to?: { toObjectId: string | number }[] }[] }>("/crm/v4/associations/tickets/companies/batch/read", "POST", {
      inputs: open.slice(i, i + 1000).map((id) => ({ id })),
    });
    for (const r of j.results ?? []) for (const t of r.to ?? []) openPer.set(String(t.toObjectId), (openPer.get(String(t.toObjectId)) ?? 0) + 1);
  }
  await query(`UPDATE apsomh_map_assign SET sales_open = 0 WHERE COALESCE(sales_open, -1) <> 0`);
  const openRows = [...openPer].map(([id, n]) => ({ id, n }));
  for (let i = 0; i < openRows.length; i += 2000) {
    await query(`UPDATE apsomh_map_assign m SET sales_open = x.n FROM jsonb_to_recordset($1::jsonb) AS x(id text, n int) WHERE m.company_id = x.id`, [JSON.stringify(openRows.slice(i, i + 2000))]);
  }

  await query(`UPDATE apsomh_map_assign SET tickets_90 = 0, sales_90 = 0 WHERE COALESCE(tickets_90, -1) <> 0 OR COALESCE(sales_90, -1) <> 0`);
  const rows = [...per].map(([id, c]) => ({ id, all: c.all, sales: c.sales }));
  for (let i = 0; i < rows.length; i += 2000) {
    await query(
      `UPDATE apsomh_map_assign m SET tickets_90 = x.all, sales_90 = x.sales FROM jsonb_to_recordset($1::jsonb) AS x(id text, "all" int, sales int) WHERE m.company_id = x.id`,
      [JSON.stringify(rows.slice(i, i + 2000))],
    );
  }
}

/* ── the Performis tab (GET ?performis=1) ──────────────────────────────── */

/** What the Performis SAE copy fills: the company's owner and region (its SAE is Performis' own), and on every
 *  contact the owner, region and the company's SAE. */
const PERFORMIS_PROPS = { company: ["hubspot_owner_id", "region_responsibility"], contact: ["hubspot_owner_id", "region_responsibility", "sae_performis"] };

/** Per country and SAE: companies, contacts (counted on the nightly full read), who the rules give it, owner now,
 *  what differs. Companies without an SAE are one row per country with sae "". */
export async function performisData(): Promise<PerformisData> {
  await ensureMapAssign();
  const rules = await getRules();
  const r = await query<SaeRow>(
    `SELECT COALESCE(country, '${NO_COUNTRY}') AS country, sae, owner_now, count(*)::int AS companies,
       COALESCE(sum(contacts_n), 0)::int AS contacts,
       (count(*) FILTER (WHERE owner_now IS DISTINCT FROM owner_decided OR region_now IS DISTINCT FROM owner_decided))::int AS "off",
       COALESCE(sum(contacts_off), 0)::int AS "contactsOff"
     FROM apsomh_map_assign GROUP BY 1, 2, 3`,
  );
  const last = await lastRun();
  return { at: last?.at ?? null, sae: saeStats(r.rows, rules.value), props: PERFORMIS_PROPS };
}
