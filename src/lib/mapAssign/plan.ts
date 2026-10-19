// MAP ASSIGNMENT - the engine's pure parts (engine.ts does the HubSpot reads and writes, this decides what they are):
// what a PUT may store, what differs on a company and on its contacts, which contacts are a company's own, when the
// nightly full scan is due, and who is internal (an A+P employee is never given a customer's owner).
// No HubSpot, no database, relative imports only - tests/map-assign-engine.test.ts runs it as is.

import { saeKey, type AssignRules, type CountryRule, type OwnerId, type Zone } from "./rules";

/* ── settings ──────────────────────────────────────────────────────────── */

/** Live mode only: at most this many companies / contacts / no-company links written per run (the rest wait 15 minutes). */
export type Settings = { breaker: number; contactBreaker: number; linkBreaker: number };
export const DEFAULT_SETTINGS: Settings = { breaker: 500, contactBreaker: 5000, linkBreaker: 100 };

export function cleanSettings(x: unknown): Settings {
  const s = (x && typeof x === "object" ? x : {}) as Partial<Record<keyof Settings, unknown>>;
  const n = (v: unknown, d: number, max: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.min(max, Math.round(Number(v))) : d);
  return {
    breaker: n(s.breaker, DEFAULT_SETTINGS.breaker, 5000),
    contactBreaker: n(s.contactBreaker, DEFAULT_SETTINGS.contactBreaker, 50_000),
    linkBreaker: n(s.linkBreaker, DEFAULT_SETTINGS.linkBreaker, 1000),
  };
}

/* ── what a PUT may store ──────────────────────────────────────────────── */

const ISO2 = /^[A-Z]{2}$/;
const OWNER = /^\d+$/;
const PREFIX = /^[0-9A-Z]+$/;
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const str = (x: unknown) => (typeof x === "string" || typeof x === "number" ? String(x).trim() : "");

export type Checked<T> = { ok: true; value: T } | { ok: false; errors: string[] };

/** One prefix as stored: "30", "869", "1234AB" or a range of one length "30-38" (from <= to). Null = not a prefix. */
export function cleanPrefix(p: unknown): string | null {
  const s = str(p).toUpperCase().replace(/\s+/g, "");
  const r = /^([0-9A-Z]+)-([0-9A-Z]+)$/.exec(s);
  if (r) {
    if (r[1].length !== r[2].length) return null;
    const numeric = /^\d+$/.test(r[1] + r[2]);
    if (numeric ? Number(r[1]) > Number(r[2]) : r[1] > r[2]) return null;
    return `${r[1]}-${r[2]}`;
  }
  return PREFIX.test(s) ? s : null;
}

/**
 * The rules a PUT stores - every owner a numeric HubSpot owner id, every country ISO2 (the key and the rule agree),
 * every prefix a prefix or a same-length range, zone ids unique per country, no SAE written twice for two people.
 * Returns the rules trimmed and upper-cased as they are stored, or every problem found (the page shows them all).
 */
export function validateRules(x: unknown): Checked<AssignRules> {
  const errors: string[] = [];
  const err = (m: string) => { if (errors.length < 50) errors.push(m); };
  if (!isObj(x)) return { ok: false, errors: ["the rules are not an object"] };
  const owner = (v: unknown, where: string): OwnerId => {
    const s = str(v);
    if (!OWNER.test(s)) err(`${where}: owner "${s}" is not a HubSpot owner id`);
    return s;
  };

  const defaultOwner = owner(x.defaultOwner, "default owner");

  const sae: Record<string, OwnerId> = {};
  if (!isObj(x.sae)) err("sae: not a table of SAE -> owner");
  else {
    const seen = new Map<string, { name: string; owner: string }>();
    for (const [k, v] of Object.entries(x.sae)) {
      const name = k.trim().replace(/\s+/g, " ");
      if (!name) { err("sae: an empty SAE name"); continue; }
      if (name.length > 120) { err(`sae: "${name.slice(0, 40)}..." is too long`); continue; }
      const o = owner(v, `SAE "${name}"`);
      const key = saeKey(name);
      const before = seen.get(key);
      if (before && before.owner !== o) err(`sae: "${name}" and "${before.name}" are the same SAE with two owners`);
      seen.set(key, { name, owner: o });
      sae[name] = o;
    }
  }

  const countries: Record<string, CountryRule> = {};
  if (!isObj(x.countries)) err("countries: not a table of country -> rule");
  else {
    const entries = Object.entries(x.countries);
    if (entries.length > 250) err("countries: more than 250");
    for (const [k, raw] of entries) {
      const cc = k.trim().toUpperCase();
      if (!ISO2.test(cc)) { err(`country "${k}": not an ISO 3166 two-letter code`); continue; }
      if (!isObj(raw)) { err(`${cc}: not a rule`); continue; }
      const named = str(raw.country).toUpperCase();
      if (named && named !== cc) err(`${cc}: the rule says country "${named}"`);
      const source = raw.source === "map" ? "map" : raw.source === "sae" ? "sae" : null;
      if (!source) err(`${cc}: source must be "sae" or "map"`);
      const zones: Zone[] = [];
      if (raw.zones !== undefined && !Array.isArray(raw.zones)) err(`${cc}: zones is not a list`);
      const zl = Array.isArray(raw.zones) ? raw.zones : [];
      if (zl.length > 500) err(`${cc}: more than 500 zones`);
      const ids = new Set<string>();
      zl.forEach((z, i) => {
        if (!isObj(z)) { err(`${cc} zone ${i + 1}: not a zone`); return; }
        const id = str(z.id);
        if (!id) err(`${cc} zone ${i + 1}: no id`);
        else if (ids.has(id)) err(`${cc}: zone id "${id}" twice`);
        ids.add(id);
        const o = owner(z.owner, `${cc} zone ${id || i + 1}`);
        const prefixes: string[] = [];
        if (!Array.isArray(z.prefixes)) err(`${cc} zone ${id || i + 1}: prefixes is not a list`);
        else {
          if (z.prefixes.length > 5000) err(`${cc} zone ${id || i + 1}: more than 5000 prefixes`);
          for (const p of z.prefixes) {
            const c = cleanPrefix(p);
            if (c === null) err(`${cc} zone ${id || i + 1}: "${str(p)}" is not a postcode prefix or a range of one length ("30-38")`);
            else prefixes.push(c);
          }
        }
        const label = str(z.label);
        zones.push({ id, owner: o, prefixes, ...(label ? { label: label.slice(0, 80) } : {}) });
      });
      const rule: CountryRule = { country: cc, source: source ?? "sae", zones };
      if (raw.defaultOwner !== undefined && raw.defaultOwner !== null && str(raw.defaultOwner) !== "") rule.defaultOwner = owner(raw.defaultOwner, `${cc} default owner`);
      else if (raw.defaultOwner === null) rule.defaultOwner = null;
      if (raw.keyAccounts !== undefined) {
        if (!Array.isArray(raw.keyAccounts)) err(`${cc}: key accounts is not a list`);
        else {
          rule.keyAccounts = [];
          raw.keyAccounts.forEach((ka, i) => {
            if (!isObj(ka)) { err(`${cc} key accounts ${i + 1}: not a list of ERP ids`); return; }
            const o = owner(ka.owner, `${cc} key accounts ${i + 1}`);
            const erpIds = Array.isArray(ka.erpIds) ? [...new Set(ka.erpIds.map(str).filter(Boolean))] : [];
            if (!Array.isArray(ka.erpIds)) err(`${cc} key accounts ${i + 1}: erpIds is not a list`);
            for (const e of erpIds) if (!/^\w{1,20}$/.test(e)) err(`${cc} key accounts ${i + 1}: "${e}" is not an ERP customer id`);
            const label = str(ka.label);
            rule.keyAccounts!.push({ owner: o, erpIds, ...(label ? { label: label.slice(0, 80) } : {}) });
          });
        }
      }
      countries[cc] = rule;
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: { sae, countries, defaultOwner } };
}

/** A part of the rules, merged into the current ones before validateRules - one country per PUT keeps the body under
 *  the hub's 8 KB request limit. A country set to null is removed (back to the SAE table and the global default). */
export type RulesPatch = { sae?: Record<string, OwnerId>; defaultOwner?: OwnerId; countries?: Record<string, CountryRule | null> };
export function mergeRules(cur: AssignRules, p: RulesPatch): AssignRules {
  const countries = { ...cur.countries };
  for (const [k, v] of Object.entries(p.countries ?? {})) {
    const cc = k.trim().toUpperCase();
    if (v === null) delete countries[cc];
    else countries[cc] = v;
  }
  return { sae: p.sae ?? cur.sae, defaultOwner: p.defaultOwner ?? cur.defaultOwner, countries };
}

/** live: country (ISO2) -> on/off; anything else is refused. */
export function validateLive(x: unknown): Checked<Record<string, boolean>> {
  if (!isObj(x)) return { ok: false, errors: ["live is not a table of country -> on/off"] };
  const errors: string[] = [];
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(x)) {
    const cc = k.trim().toUpperCase();
    if (!ISO2.test(cc)) errors.push(`live: "${k}" is not an ISO 3166 two-letter code`);
    else if (typeof v !== "boolean") errors.push(`live: ${cc} must be true or false`);
    else out[cc] = v;
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: out };
}

/* ── what differs ──────────────────────────────────────────────────────── */

const v = (x: string | null | undefined) => String(x ?? "").trim();

/** The company's own fields to write: owner and region_responsibility, only the ones that are not the decided owner. */
export function companyChanges(now: { owner: string | null | undefined; region: string | null | undefined }, decided: OwnerId): Record<string, string> {
  const out: Record<string, string> = {};
  if (v(now.owner) !== v(decided)) out.hubspot_owner_id = v(decided);
  if (v(now.region) !== v(decided)) out.region_responsibility = v(decided);
  return out;
}

/** A contact follows its company: owner, region_responsibility, and the company's SAE (only when the company has one -
 *  a contact's SAE is never blanked). Only what differs. */
export function contactChanges(c: { owner: string | null | undefined; region: string | null | undefined; sae: string | null | undefined }, t: { owner: OwnerId; sae: string | null | undefined }): Record<string, string> {
  const out: Record<string, string> = {};
  if (v(c.owner) !== v(t.owner)) out.hubspot_owner_id = v(t.owner);
  if (v(c.region) !== v(t.owner)) out.region_responsibility = v(t.owner);
  if (v(t.sae) && v(c.sae) !== v(t.sae)) out.sae_performis = v(t.sae);
  return out;
}

/**
 * Which contacts are a company's own: its primary contacts, and the ones with no primary company that it is the first
 * of these companies to list. A contact whose primary company is another one belongs to that one (also when that one
 * is outside this batch) - two companies never fight over a person. `primary(id)` undefined = the contact was not read.
 */
export function ownContacts(companyIds: string[], assoc: Map<string, string[]>, primary: (contactId: string) => string | null | undefined): Map<string, string[]> {
  const out = new Map<string, string[]>(companyIds.map((id) => [String(id), []]));
  const claimed = new Set<string>();
  for (const co of companyIds) {
    for (const ct of assoc.get(String(co)) ?? []) {
      const id = String(ct);
      if (claimed.has(id)) continue;
      const p = primary(id);
      if (p === undefined) continue;
      if (p && String(p) !== String(co)) continue;
      claimed.add(id);
      out.get(String(co))!.push(id);
    }
  }
  return out;
}

/* ── when the full scan is due ─────────────────────────────────────────── */

/** Day and time in Zurich: { day: "2026-10-19", hm: "02:30" }. */
export function zurich(ms: number): { day: string; hm: string } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms));
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "00";
  return { day: `${p("year")}-${p("month")}-${p("day")}`, hm: `${p("hour")}:${p("minute")}` };
}

/** Every company is read once a night from `at` (Zurich), and whenever the last full read is older than a day. */
export function fullDue(now: number, lastFull: number | null, at = "02:30"): boolean {
  if (!lastFull || !Number.isFinite(lastFull)) return true;
  if (now - lastFull >= 24 * 3600_000) return true;
  const n = zurich(now);
  if (n.hm < at) return false;
  const l = zurich(lastFull);
  return l.day < n.day || (l.day === n.day && l.hm < at);
}

/* ── who is internal ───────────────────────────────────────────────────── */

export const INTERNAL_DOMAINS = ["angst-pfister.com", "apsoparts.com"];
export type Internal = { domains: Set<string>; emails: Set<string> };

export function emailDomain(email: string | null | undefined): string {
  const s = String(email ?? "").trim().toLowerCase();
  const at = s.lastIndexOf("@");
  return at > 0 ? s.slice(at + 1).replace(/^www\./, "").replace(/[>\s]+$/, "") : "";
}

type ListFilter = { property?: string; operation?: { operator?: string; values?: unknown[] } };
type ListBranch = { filters?: ListFilter[]; filterBranches?: ListBranch[] };
/** The A+P employees list (HubSpot list 2865, "DO NOT EDIT! AP employees"): the domains and addresses it is made of.
 *  Only "is equal to" filters count - an exception inside a branch ("not diana.fehr@") still is an employee. */
export function internalFromList(branch: unknown): Internal {
  const domains = new Set(INTERNAL_DOMAINS);
  const emails = new Set<string>();
  const walk = (b: ListBranch | undefined, depth: number) => {
    if (!b || depth > 10) return;
    for (const f of b.filters ?? []) {
      const op = String(f.operation?.operator ?? "");
      if (op !== "IS_EQUAL_TO" && op !== "IS_ANY_OF") continue;
      const vals = (f.operation?.values ?? []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
      if (f.property === "hs_email_domain") for (const d of vals) domains.add(d.replace(/^@/, ""));
      if (f.property === "email") for (const e of vals) emails.add(e);
    }
    for (const c of b.filterBranches ?? []) walk(c, depth + 1);
  };
  walk(branch as ListBranch, 0);
  return { domains, emails };
}

export function isInternal(email: string | null | undefined, internal: Internal): boolean {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return false;
  if (internal.emails.has(e)) return true;
  const d = emailDomain(e);
  return !!d && internal.domains.has(d);
}
