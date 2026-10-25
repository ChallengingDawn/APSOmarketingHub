// MAP ASSIGNMENT - the engine's pure parts (engine.ts does the HubSpot reads and writes, this decides what they are):
// what a PUT may store, what differs on a company and on its contacts, which contacts are a company's own, when the
// nightly full scan is due, who is internal (an A+P employee is never given a customer's owner), where a postcode
// sits on the map (its point and region), and the map's layers and the Performis tab, counted from the table's rows.
// No HubSpot, no database, relative imports only - tests/map-assign-engine.test.ts runs it as is.

import { cleanZip, saeKey, type AssignRules, type CountryRule, type OwnerId, type Zone } from "./rules";
import type { PostcodeStat, RedirectionConflict, SaeStat } from "./api";
import { matches as redirectionMatches, type PubRule } from "../ownerRules/rules";

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
/** A region code as public/geo/shapes/<CC>.json has it: "CH-BE", "FR-69", "FR-2A", "AT-1", "BE-BRU", "ES-A". */
const REGION = /^[A-Z0-9]{1,4}(-[A-Z0-9]{1,6})?$/;
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
 * every prefix a prefix or a same-length range, every region a shapes region code held by one zone only, zone ids
 * unique per country, no SAE written twice for two people (in the SAE table and in a country's redirects), a
 * country's people a list of owner ids. Returns the rules trimmed and upper-cased as they are stored, or every
 * problem found (the page shows them all).
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
  /** SAE value -> owner: names trimmed, one owner per SAE key ("Borey Jeremy" = "JEREMY BOREY"). */
  const saeTable = (t: Record<string, unknown>, where: string): Record<string, OwnerId> => {
    const out: Record<string, OwnerId> = {};
    const seen = new Map<string, { name: string; owner: string }>();
    for (const [k, v] of Object.entries(t)) {
      const name = k.trim().replace(/\s+/g, " ");
      if (!name) { err(`${where}: an empty SAE name`); continue; }
      if (name.length > 120) { err(`${where}: "${name.slice(0, 40)}..." is too long`); continue; }
      const o = owner(v, where === "sae" ? `SAE "${name}"` : `${where}: SAE "${name}"`);
      const key = saeKey(name);
      const before = seen.get(key);
      if (before && before.owner !== o) err(`${where}: "${name}" and "${before.name}" are the same SAE with two owners`);
      seen.set(key, { name, owner: o });
      out[name] = o;
    }
    return out;
  };

  const defaultOwner = owner(x.defaultOwner, "default owner");

  let sae: Record<string, OwnerId> = {};
  if (!isObj(x.sae)) err("sae: not a table of SAE -> owner");
  else sae = saeTable(x.sae, "sae");

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
      /** region -> the zone that holds it: a region belongs to one person (zoneFor would take the first zone) */
      const regionOf = new Map<string, string>();
      zl.forEach((z, i) => {
        if (!isObj(z)) { err(`${cc} zone ${i + 1}: not a zone`); return; }
        const id = str(z.id);
        if (!id) err(`${cc} zone ${i + 1}: no id`);
        else if (ids.has(id)) err(`${cc}: zone id "${id}" twice`);
        ids.add(id);
        const where = `${cc} zone ${id || i + 1}`;
        const o = owner(z.owner, where);
        const regions: string[] = [];
        if (z.regions !== undefined && z.regions !== null) {
          if (!Array.isArray(z.regions)) err(`${where}: regions is not a list`);
          else {
            if (z.regions.length > 500) err(`${where}: more than 500 regions`);
            for (const r of z.regions) {
              const c = str(r).toUpperCase();
              if (!REGION.test(c)) { err(`${where}: "${str(r)}" is not a region code ("CH-BE", "FR-69")`); continue; }
              if (regions.includes(c)) continue;
              const other = regionOf.get(c);
              if (other !== undefined) err(`${cc}: region ${c} is in zone "${other}" and in zone "${id || i + 1}"`);
              regionOf.set(c, id || String(i + 1));
              regions.push(c);
            }
          }
        }
        const prefixes: string[] = [];
        if (z.prefixes === undefined && regions.length) { /* a zone of whole regions only */ }
        else if (!Array.isArray(z.prefixes)) err(`${where}: prefixes is not a list`);
        else {
          if (z.prefixes.length > 5000) err(`${where}: more than 5000 prefixes`);
          for (const p of z.prefixes) {
            const c = cleanPrefix(p);
            if (c === null) err(`${where}: "${str(p)}" is not a postcode prefix or a range of one length ("30-38")`);
            else prefixes.push(c);
          }
        }
        const label = str(z.label);
        zones.push({ id, owner: o, prefixes, ...(regions.length ? { regions } : {}), ...(label ? { label: label.slice(0, 80) } : {}) });
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
      // an SAE redirected in this country only (the Performis tab)
      if (raw.saeOverride !== undefined && raw.saeOverride !== null) {
        if (!isObj(raw.saeOverride)) err(`${cc}: SAE redirects is not a table of SAE -> owner`);
        else {
          if (Object.keys(raw.saeOverride).length > 200) err(`${cc}: more than 200 SAE redirects`);
          const t = saeTable(raw.saeOverride, `${cc} SAE redirects`);
          if (Object.keys(t).length) rule.saeOverride = t;
        }
      }
      // the people who work this country (an empty list = anyone)
      if (raw.people !== undefined && raw.people !== null) {
        if (!Array.isArray(raw.people)) err(`${cc}: people is not a list`);
        else {
          if (raw.people.length > 200) err(`${cc}: more than 200 people`);
          const people = [...new Set(raw.people.map((p, i) => owner(p, `${cc} people ${i + 1}`)))];
          if (people.length) rule.people = people;
        }
      }
      countries[cc] = rule;
    }
  }
  // someone who has left -> who takes over (one hop: a successor is never someone's predecessor in the same table)
  const successors: Record<OwnerId, OwnerId> = {};
  if (x.successors !== undefined && x.successors !== null) {
    if (!isObj(x.successors)) err("successors: not a table of person -> person");
    else {
      if (Object.keys(x.successors).length > 200) err("successors: more than 200");
      for (const [k, v] of Object.entries(x.successors)) {
        const from = owner(k, "successors"), to = owner(v, `successors of ${k}`);
        if (from === to) { err(`successors: ${from} takes over from themselves`); continue; }
        successors[from] = to;
      }
    }
  }
  const value: AssignRules = { sae, countries, defaultOwner, ...(Object.keys(successors).length ? { successors } : {}) };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

/** A part of the rules, merged into the current ones before validateRules - one country per PUT keeps the body under
 *  the hub's 8 KB request limit. A country set to null is removed (back to the SAE table and the default owner). */
export type RulesPatch = { sae?: Record<string, OwnerId>; defaultOwner?: OwnerId; countries?: Record<string, CountryRule | null>; successors?: Record<OwnerId, OwnerId> };
export function mergeRules(cur: AssignRules, p: RulesPatch): AssignRules {
  const countries = { ...cur.countries };
  for (const [k, v] of Object.entries(p.countries ?? {})) {
    const cc = k.trim().toUpperCase();
    if (v === null) delete countries[cc];
    else countries[cc] = v;
  }
  const successors = p.successors ?? cur.successors;
  return { sae: p.sae ?? cur.sae, defaultOwner: p.defaultOwner ?? cur.defaultOwner, countries, ...(successors && Object.keys(successors).length ? { successors } : {}) };
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

/** The WAF in front of the hub refuses a request body over 8 KB with a bare HTML 403 the route never sees. */
export const BODY_LIMIT = 8192;
/** The bytes (UTF-8) of the PUT that saves one country: {patch: {countries: {CC: rule}}}. Over BODY_LIMIT = it
 *  cannot be saved in one request (write long postcode lists as ranges, or whole regions). */
export function countryPutBytes(cc: string, rule: CountryRule | null): number {
  return new TextEncoder().encode(JSON.stringify({ patch: { countries: { [cc]: rule } } })).length;
}

/* ── the SAE a country uses ────────────────────────────────────────────── */

/**
 * Who an SAE value gives a company in a country - the SAE half of decide() (rules.ts), for the Performis tab: the
 * country's own redirect first (it may point to anyone), else the SAE table, but only to one of the country's
 * people (`notInCountry`: the zone decides instead). Not mapped / no SAE: owner null. The country's source is not
 * looked at: in a "map" country the SAE is shown, never copied (the page says so from the rules).
 */
export function saeTarget(rules: AssignRules, country: string | null, sae: string | null | undefined): { owner: OwnerId | null; redirected: boolean; notInCountry: boolean } {
  const s = String(sae ?? "").trim();
  if (!s) return { owner: null, redirected: false, notInCountry: false };
  const rule = country ? rules.countries[country] : undefined;
  const k = saeKey(s);
  const local = Object.entries(rule?.saeOverride ?? {}).find(([x]) => saeKey(x) === k);
  if (local) return { owner: local[1], redirected: true, notInCountry: false };
  const hit = Object.entries(rules.sae).find(([x]) => saeKey(x) === k);
  if (!hit) return { owner: null, redirected: false, notInCountry: false };
  if (rule?.people?.length && !rule.people.includes(hit[1])) return { owner: null, redirected: false, notInCountry: true };
  return { owner: hit[1], redirected: false, notInCountry: false };
}

/* ── where a postcode sits on the map ──────────────────────────────────── */

/** public/geo/postcodes/<CC>.json, cleaned and sorted for lookups. A point is [postcode, lat, lon, regionCode?]. */
export type ZipIndex = { keys: string[]; codes: string[]; regions: (string | null)[]; exact: Map<string, number>; minLen: number; maxLen: number };
export const EMPTY_ZIP_INDEX: ZipIndex = { keys: [], codes: [], regions: [], exact: new Map(), minLen: 0, maxLen: 0 };

/** The index of a country's postcode points; anything that is not a point is skipped (a 3-element point = no region). */
export function zipIndex(points: unknown): ZipIndex {
  const rows: { key: string; code: string; region: string | null }[] = [];
  const seen = new Set<string>();
  if (Array.isArray(points)) for (const p of points) {
    if (!Array.isArray(p)) continue;
    const code = str(p[0]);
    const key = cleanZip(code);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const r = str(p[3]).toUpperCase();
    rows.push({ key, code, region: r || null });
  }
  if (!rows.length) return EMPTY_ZIP_INDEX;
  rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const keys = rows.map((r) => r.key);
  return {
    keys, codes: rows.map((r) => r.code), regions: rows.map((r) => r.region), exact: new Map(keys.map((k, i) => [k, i])),
    minLen: Math.min(...keys.map((k) => k.length)), maxLen: Math.max(...keys.map((k) => k.length)),
  };
}

/**
 * The point a company's postcode is shown at, and its region: the postcode itself, else the nearest point that
 * shares its longest beginning ("1234 AB" -> 1234, a new "86999" -> 86998), at least two characters. Not placed: no
 * postcode, shorter than the country's, or a numeric one longer than the country's (another country's postcode).
 */
export function placeZip(ix: ZipIndex, zip: string | null | undefined): { code: string; region: string | null; exact: boolean } | null {
  const z = cleanZip(zip);
  if (!z || !ix.keys.length || z.length < ix.minLen) return null;
  const at = ix.exact.get(z);
  if (at !== undefined) return { code: ix.codes[at], region: ix.regions[at], exact: true };
  if (/^\d+$/.test(z) && z.length > ix.maxLen) return null;
  let lo = 0, hi = ix.keys.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (ix.keys[m] < z) lo = m + 1; else hi = m; }
  // the keys sharing a beginning with z are one block around z's place in the sorted list: its neighbours are in it
  for (let k = z.length - 1; k >= 2; k--) {
    const head = z.slice(0, k);
    const cands = [lo - 1, lo].filter((i) => i >= 0 && i < ix.keys.length && ix.keys[i].startsWith(head));
    if (!cands.length) continue;
    let i = cands[0];
    if (cands.length === 2 && /^\d+$/.test(z) && cands.every((c) => /^\d+$/.test(ix.keys[c]) && ix.keys[c].length === z.length)) {
      i = Math.abs(Number(ix.keys[cands[1]]) - Number(z)) < Math.abs(Number(ix.keys[cands[0]]) - Number(z)) ? cands[1] : cands[0];
    }
    return { code: ix.codes[i], region: ix.regions[i], exact: false };
  }
  return null;
}

/* ── the map's layers ──────────────────────────────────────────────────── */

/** sales_priority "1-Prio 1 - Pot >25000€" ... "4- No priority for sales, Pot. <500€" -> "P1" ... "P4". */
export function priorityKey(v: string | null | undefined): string | null {
  const m = /^\s*([1-4])\s*-/.exec(String(v ?? ""));
  return m ? `P${m[1]}` : null;
}
/** A HubSpot date ("2026-09-11", or a timestamp) in this calendar year. */
export function inYear(d: string | null | undefined, year: number): boolean {
  const s = String(d ?? "").trim();
  if (/^\d{4}-/.test(s)) return s.slice(0, 4) === String(year);
  const n = Number(s);
  return !!s && Number.isFinite(n) && new Date(n).getUTCFullYear() === year;
}

export type LayerRow = {
  id: string; name: string | null; zip: string | null; owner: OwnerId | null;
  revenue: number | null; lastOrder: string | null; firstOrder: string | null; priority: string | null;
  /** the Performis SAE as written, the owner by the rules, region_responsibility now - absent in old callers */
  sae?: string | null; decided?: OwnerId | null; region?: OwnerId | null; via?: string | null;
  /** tickets of the last 90 days on the company: every pipeline / the sales ones */
  tickets?: number | null; sales?: number | null;
  /** apso_customer */
  category?: string | null;
};
/**
 * One country's companies per postcode point (PostcodeStat): companies, customers this year (an order this year -
 * order_last_order_date, credit notes and cancelled orders are not orders), new customers (first order this year),
 * revenue this year, sales priority P1..P4, and the three biggest customers. `place` = the point code of a postcode,
 * null = not on the map (counted in `unplaced`).
 */
export function layerPoints(rows: LayerRow[], place: (zip: string | null) => string | null, year: number, topN = 3): { points: PostcodeStat[]; unplaced: number } {
  const by = new Map<string, PostcodeStat>();
  let unplaced = 0;
  for (const r of rows) {
    const code = place(r.zip);
    if (!code) { unplaced++; continue; }
    let s = by.get(code);
    if (!s) { s = { zip: code, companies: 0, customers: 0, newCustomers: 0, revenue: 0, priority: {}, category: {}, top: [], sae: {}, now: {}, decided: {}, change: 0, via: {} }; by.set(code, s); }
    s.companies++;
    const sae = String(r.sae ?? "").trim().replace(/\s+/g, " ");
    s.sae![sae] = (s.sae![sae] ?? 0) + 1;
    const now = String(r.owner ?? "");
    s.now![now] = (s.now![now] ?? 0) + 1;
    if (r.decided !== undefined && r.decided !== null) {
      const dec = String(r.decided);
      s.decided![dec] = (s.decided![dec] ?? 0) + 1;
      if (now !== dec || String(r.region ?? "") !== dec) s.change!++;
    }
    if (r.via) s.via![r.via] = (s.via![r.via] ?? 0) + 1;
    const tk = Number(r.tickets) || 0, sl = Number(r.sales) || 0;
    s.tickets = (s.tickets ?? 0) + tk;
    s.sales = (s.sales ?? 0) + sl;
    if (r.decided !== undefined && r.decided !== null) {
      const by = s.byOwner ?? (s.byOwner = {});
      const o = String(r.decided);
      const ps = by[o] ?? (by[o] = { companies: 0, customers: 0, newCustomers: 0, revenue: 0, tickets: 0, sales: 0 });
      ps.companies++;
      if (inYear(r.lastOrder, year)) ps.customers++;
      if (inYear(r.firstOrder, year)) ps.newCustomers++;
      const rv = Number(r.revenue);
      if (Number.isFinite(rv)) ps.revenue += rv;
      ps.tickets += tk;
      ps.sales += sl;
    }
    if (inYear(r.lastOrder, year)) s.customers++;
    if (inYear(r.firstOrder, year)) s.newCustomers++;
    const rev = Number(r.revenue);
    if (Number.isFinite(rev) && rev) s.revenue += rev;
    const p = priorityKey(r.priority);
    if (p) s.priority[p] = (s.priority[p] ?? 0) + 1;
    const cat = String(r.category ?? "").trim();
    if (cat) s.category![cat] = (s.category![cat] ?? 0) + 1;
    if (Number.isFinite(rev) && rev > 0) {
      const t = { id: String(r.id), name: r.name ?? `Company ${r.id}`, revenue: Math.round(rev * 100) / 100, owner: r.owner };
      // the list stays sorted, biggest first, at most topN
      if (s.top.length < topN || t.revenue > s.top[s.top.length - 1].revenue) {
        s.top.push(t);
        s.top.sort((a, b) => b.revenue - a.revenue || a.id.localeCompare(b.id));
        if (s.top.length > topN) s.top.length = topN;
      }
    }
  }
  const points = [...by.values()].map((s) => ({ ...s, revenue: Math.round(s.revenue * 100) / 100 }));
  points.sort((a, b) => (a.zip < b.zip ? -1 : a.zip > b.zip ? 1 : 0));
  return { points, unplaced };
}

/** Text for an ILIKE pattern: %, _ and the backslash match themselves. */
export const likeEscape = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/* ── Owner redirection against the map ────────────────────────────────── */

/** What an answer to a conflict is tied to: the rule's matching and its person. Edit the rule and the answer lapses. */
export const redirectionSig = (r: PubRule): string =>
  JSON.stringify(r.kind === "country"
    ? ["country", [...r.countries].map((x) => x.trim().toLowerCase()).sort(), [...r.customCountries].map((x) => x.trim().toLowerCase()).sort(), String(r.toOwner)]
    : ["owner", String(r.fromOwner), String(r.toOwner)]);

/** A stored company as the redirection rules read it. */
export type RedirectionFacts = { country_raw: string | null; country_custom: string | null; owner_now: string | null };
const asCompany = (c: RedirectionFacts) => ({ country: c.country_raw, country_custom: c.country_custom, hubspot_owner_id: c.owner_now });

/**
 * The rule SARCLA kept over the map for this company, or null: the FIRST enabled rule that matches it (as Owner
 * redirection runs them) - and only when that rule is one of `held` (declined conflicts whose rule is unchanged).
 */
export function heldBy(c: RedirectionFacts, enabled: PubRule[], held: Set<string>): PubRule | null {
  if (!held.size) return null;
  const co = asCompany(c);
  for (const r of enabled) if (redirectionMatches(r, co)) return held.has(r.id) ? r : null;
  return null;
}

export type ConflictRow = RedirectionFacts & { country: string | null; owner_decided: string };
/**
 * Per enabled rule: the stored companies it matches (first match wins) and those the map gives to someone else,
 * by that person (most first), with their countries.
 */
export function conflictCounts(rows: ConflictRow[], enabled: PubRule[]): Map<string, Pick<RedirectionConflict, "matched" | "against">> {
  const out = new Map<string, { matched: number; against: Map<string, { companies: number; countries: Map<string, number> }> }>();
  for (const r of enabled) out.set(r.id, { matched: 0, against: new Map() });
  for (const row of rows) {
    const co = asCompany(row);
    const r = enabled.find((x) => redirectionMatches(x, co));
    if (!r) continue;
    const acc = out.get(r.id)!;
    acc.matched++;
    const to = String(row.owner_decided ?? "");
    if (!to || to === String(r.toOwner)) continue;
    const a = acc.against.get(to) ?? { companies: 0, countries: new Map<string, number>() };
    a.companies++;
    const cc = row.country ?? "??";
    a.countries.set(cc, (a.countries.get(cc) ?? 0) + 1);
    acc.against.set(to, a);
  }
  return new Map([...out].map(([id, v]) => [id, {
    matched: v.matched,
    against: [...v.against].map(([owner, a]) => ({ owner, companies: a.companies, countries: [...a.countries].sort((x, y) => y[1] - x[1]).map(([c]) => c) }))
      .sort((x, y) => y.companies - x.companies || x.owner.localeCompare(y.owner)),
  }]));
}

/* ── the Performis tab ─────────────────────────────────────────────────── */

/** The table's companies, grouped by country, SAE value as written and owner now. */
export type SaeRow = {
  country: string; sae: string | null; owner_now: OwnerId | null;
  companies: number; contacts: number;
  /** companies whose owner or region differ from the rules */
  off: number;
  /** their contacts that differ (counted for the companies that differ, and every company of a live country) */
  contactsOff: number;
};
/**
 * Per country and SAE (spellings of one SAE together: "Borey Jeremy" = "JEREMY BOREY", shown as the most common):
 * companies, contacts, who the rules give it (saeTarget), owner now, what differs. Companies without an SAE are one
 * row with sae "" (the zones decide them). Biggest countries first, then biggest SAE.
 */
export function saeStats(rows: SaeRow[], rules: AssignRules): SaeStat[] {
  type Acc = SaeStat & { spellings: Map<string, number>; owners: Map<string, number> };
  const by = new Map<string, Acc>();
  const perCountry = new Map<string, number>();
  for (const r of rows) {
    const raw = String(r.sae ?? "").trim().replace(/\s+/g, " ");
    const id = `${r.country}\u0000${saeKey(raw)}`;
    let a = by.get(id);
    if (!a) {
      a = { sae: raw, country: r.country, companies: 0, contacts: 0, mappedTo: null, redirected: false, ownerNow: [], companiesOff: 0, contactsOff: 0, spellings: new Map(), owners: new Map() };
      by.set(id, a);
    }
    const n = Number(r.companies) || 0;
    a.companies += n;
    a.contacts += Number(r.contacts) || 0;
    a.companiesOff += Number(r.off) || 0;
    a.contactsOff += Number(r.contactsOff) || 0;
    a.spellings.set(raw, (a.spellings.get(raw) ?? 0) + n);
    const o = r.owner_now ?? "";
    a.owners.set(o, (a.owners.get(o) ?? 0) + n);
    perCountry.set(r.country, (perCountry.get(r.country) ?? 0) + n);
  }
  const out: SaeStat[] = [];
  for (const a of by.values()) {
    const sae = [...a.spellings].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0][0];
    const t = saeTarget(rules, a.country, sae);
    out.push({
      sae, country: a.country, companies: a.companies, contacts: a.contacts, mappedTo: t.owner, redirected: t.redirected,
      ownerNow: [...a.owners].map(([owner, companies]) => ({ owner: owner || null, companies })).sort((x, y) => y.companies - x.companies || String(x.owner).localeCompare(String(y.owner))),
      companiesOff: a.companiesOff, contactsOff: a.contactsOff,
    });
  }
  out.sort((x, y) => (perCountry.get(y.country) ?? 0) - (perCountry.get(x.country) ?? 0) || x.country.localeCompare(y.country) || y.companies - x.companies || x.sae.localeCompare(y.sae));
  return out;
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
