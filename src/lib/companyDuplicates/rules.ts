// COMPANY DUPLICATES - the rules, pure: no HubSpot, no "@/" imports (the tests compile this file on its own).
// SARCLA 10.11.2026: "COMPANIES FULL DUPLICATE CHECK - then we need to migrate it to the hub; can we rework duplicates
// and merges to include a company duplicate check". Measured that day (61,417 companies, read only):
//   - Same ERP customer = the same ERP customer number in the same Mandant - the workflow's rule, 100% sure, merged into
//     the oldest company. Only a real number counts: "NO ERP ID (LEAD)" (1,226) and "NO ERP ID CREATED BY ESO" (285) are
//     placeholders - the workflow's rule reads each as ONE customer and would merge them 50 at a time.
//   - Possible, for a person: the same name at the same postcode in the same country (1,226 groups), the same website - not
//     a mail provider's, not ours - in one country (721). Never two different ERP customers (a group's companies: 1,848
//     websites, 692 names), never one website in two countries (its sites: 77). Same ERP number in two Mandants = the
//     customer in AG and GmbH, two ledgers: never merged.

export type Company = {
  id: string;
  name: string;
  /** the website, as a bare host (www. dropped) - null for a mail provider's or ours */
  domain: string | null;
  /** a real ERP customer number, null for none or a placeholder */
  erp: string | null;
  /** what the ERP field holds when it is not a number ("NO ERP ID (LEAD)") */
  placeholder: string | null;
  mandant: string | null;
  createdate: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  owner: string | null;
  /** the owner's name - filled in by the engine for the companies of a group */
  ownerName?: string | null;
  deals: number;
  contacts: number;
  /** street (Street Address), Company Unique Number, phone - for the lists */
  address: string | null;
  unique: string | null;
  phone: string | null;
  /** the last order (Last Order Date), the Compass year when there is no date; the revenue this year to date and last
   *  year to the same day (EUR, the hub's ERP figures) */
  lastOrder: string | null;
  lastYear: number | null;
  revenue: number;
  revenuePy: number;
};

export type RawCompany = { id: string; properties: Record<string, string | null | undefined> };

export const READ_PROPS = [
  "name", "domain", "website", "erp_customer_id", "mandant", "createdate", "zip", "city", "country_custom", "country",
  "hubspot_owner_id", "num_associated_deals", "num_associated_contacts", "hs_merged_object_ids", "address", "company_unique_number", "phone",
  "order_last_order_date", "compass_last_order_year", "erp_rev_ytd_cy", "erp_rev_ytd_py",
];

const nz = (v: string | null | undefined) => {
  const s = v == null ? "" : String(v).trim();
  return s ? s : null;
};

/** A real ERP customer number: digits only (Compass's are six). */
export const erpOf = (v: string | null | undefined) => {
  const s = nz(v);
  return s && /^\d{3,10}$/.test(s) ? s : null;
};

/** Mail providers and our own domains: a website shared by people, never by one company. */
const FREE = /^(gmail|googlemail|outlook|hotmail|live|msn|yahoo|ymail|gmx|web|t-online|bluewin|sunrise|hispeed|icloud|me|mac|aol|orange|free|wanadoo|sfr|laposte|libero|virgilio|tiscali|alice|freenet|posteo|mail|protonmail|proton|yandex|qq|163|126|seznam|wp|o2|onet|interia|abv|online|arcor|vodafone|swissonline|vtxmail|bluemail|tele2|telenet|skynet|ziggo|home|planet|chello|neuf|bbox|tin|fastwebnet|email|inbox|zoho|example)\./i;
const OWN = /(^|\.)(angst-pfister|apsoparts|apso)\./i;
export function domainOf(domain: string | null | undefined, website?: string | null): string | null {
  let d = nz(domain) ?? nz(website);
  if (!d) return null;
  d = d.toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\d?\./, "").replace(/[/?#:].*$/, "").replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) || FREE.test(d) || OWN.test(d)) return null;
  return d;
}

/** The legal forms and fill words a name is compared without ("Huwyler Klima AG" = "huwyler klima"). */
const LEGAL = /\b(ag|gmbh|mbh|sa|sarl|srl|spa|ltd|limited|inc|llc|bv|nv|kg|ohg|ug|se|oy|ab|as|aps|sas|sasu|eurl|sl|sp z o o|sp zoo|kft|sro|s r o|co|plc|gesmbh|ek|kgaa|snc|sagl|sp k|sk|ltda|lda|cie|et|und|and|the)\b/g;
export function nameKey(name: string | null | undefined): string | null {
  const s = nz(name);
  if (!s) return null;
  const n = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ").replace(LEGAL, " ").replace(/\s+/g, " ").trim();
  return n.length >= 3 ? n : null;
}
export const zipKey = (v: string | null | undefined) => nz(v)?.replace(/\s+/g, "").toUpperCase() ?? null;
export const countryKey = (v: string | null | undefined) => nz(v)?.toLowerCase() ?? null;

export function toCompany(r: RawCompany): Company {
  const p = r.properties;
  const raw = nz(p.erp_customer_id);
  const erp = erpOf(raw);
  return {
    id: String(r.id), name: nz(p.name) ?? `Company ${r.id}`, domain: domainOf(p.domain, p.website), erp, placeholder: raw && !erp ? raw : null,
    mandant: nz(p.mandant), createdate: nz(p.createdate), zip: nz(p.zip), city: nz(p.city), country: nz(p.country_custom) ?? nz(p.country),
    owner: nz(p.hubspot_owner_id), deals: Number(p.num_associated_deals) || 0, contacts: Number(p.num_associated_contacts) || 0,
    address: nz(p.address), unique: nz(p.company_unique_number), phone: nz(p.phone),
    lastOrder: nz(p.order_last_order_date), lastYear: Number(p.compass_last_order_year) || null,
    revenue: Math.round(Number(p.erp_rev_ytd_cy) || 0), revenuePy: Math.round(Number(p.erp_rev_ytd_py) || 0),
  };
}

// ---------------------------------------------------------------- the groups

export type Rules = {
  /** the same ERP customer: merged by the hub (once Live) */
  erp: { on: boolean; autoMerge: boolean; maxGroup: number };
  /** the same name at the same postcode, in the same country */
  place: { on: boolean };
  /** the same website, in one country; `otherNames`: also when the names differ (a sister company, often) */
  website: { on: boolean; otherNames: boolean };
  /** the same name, postcode AND website, at most one customer number: merged by the hub once Live (SARCLA 10.11.2026:
   *  "everything is the same - if there is no ERP number it's a definite merge; can we automate?") */
  both: { autoMerge: boolean };
};
export const DEFAULT_RULES: Rules = {
  erp: { on: true, autoMerge: true, maxGroup: 4 },
  place: { on: true },
  website: { on: true, otherNames: true },
  both: { autoMerge: true },
};

/** A possible group the hub merges by itself once Live: the same name, postcode and website, at most one customer number
 *  (a possible group never has two), not more companies than the rule allows. */
export const autoBoth = (g: Group, rules: Rules) =>
  g.kind === "possible" && rules.both.autoMerge && g.shared.includes("place") && g.shared.includes("website") && g.members.length <= rules.erp.maxGroup;

export type Shared = "erp" | "place" | "website";
export type Group = {
  /** the ids, sorted - the group's name */
  key: string;
  kind: "erp" | "possible" | "family" | "sites" | "big";
  shared: Shared[];
  /** oldest first */
  members: Company[];
  /** the company the others go into: the ERP customer's (for "erp" the oldest), else the oldest */
  into: string;
  why: string;
  /** when the youngest came - the day the duplicate appeared */
  newest: string | null;
  /** "erp": more than the hub merges by itself - a person decides */
  tooBig?: boolean;
  /** "possible": the names differ (only the website is shared) */
  otherNames?: boolean;
};

export type Found = {
  sure: Group[];
  possible: Group[];
  /** what was left alone, with a reason - the first 600 */
  left: Group[];
  counts: { read: number; withErp: number; withErpMandant: number; placeholders: number; withWebsite: number; families: number; sites: number; big: number; apart: number };
};

const byAge = (a: Company, b: Company) => (a.createdate ?? "9999").localeCompare(b.createdate ?? "9999") || a.id.localeCompare(b.id, undefined, { numeric: true });
export const groupKey = (ids: string[]) => [...ids].sort().join(",");
const pairs = (ids: string[]) => {
  const s = [...ids].sort(), out: string[] = [];
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) out.push(`${s[i]},${s[j]}`);
  return out;
};
/** Every pair of the ids a person said are not duplicates. */
export const apartPairs = (ids: string[]) => pairs(ids);

/** Where the others go: the ERP customer's company (the oldest of them), else the oldest. */
export function intoOf(members: Company[], kind: Group["kind"]): string {
  const old = [...members].sort(byAge);
  if (kind === "erp") return old[0].id;
  return (old.find((c) => c.erp) ?? old[0]).id;
}

const MAX_POSSIBLE = 6;
const MAX_LEFT = 600;

/** Every group of the companies read, by the rules; `apart` = the pairs a person said are not duplicates. */
export function findGroups(list: Company[], rules: Rules, apart: Set<string>): Found {
  const counts: Found["counts"] = { read: list.length, withErp: 0, withErpMandant: 0, placeholders: 0, withWebsite: 0, families: 0, sites: 0, big: 0, apart: 0 };
  const buckets = (keyOf: (c: Company) => string | null) => {
    const m = new Map<string, Company[]>();
    for (const c of list) { const k = keyOf(c); if (k) (m.get(k) ?? m.set(k, []).get(k)!).push(c); }
    return [...m.entries()].filter(([, g]) => g.length > 1);
  };
  for (const c of list) {
    if (c.erp) counts.withErp++;
    if (c.erp && c.mandant) counts.withErpMandant++;
    if (c.placeholder) counts.placeholders++;
    if (c.domain) counts.withWebsite++;
  }
  const sure: Group[] = [];
  if (rules.erp.on) {
    for (const [, g] of buckets((c) => (c.erp && c.mandant ? `${c.erp}|${c.mandant}` : null))) {
      const members = [...g].sort(byAge);
      sure.push({
        key: groupKey(members.map((c) => c.id)), kind: "erp", shared: ["erp"], members, into: intoOf(members, "erp"),
        why: `Same customer number ${members[0].erp} in ${members[0].mandant}`, newest: members[members.length - 1].createdate,
        ...(members.length > rules.erp.maxGroup ? { tooBig: true } : {}),
      });
    }
  }

  const possible = new Map<string, Group>();
  const left: Group[] = [];
  const consider = (shared: Shared, g: Company[], why: string) => {
    const members = [...g].sort(byAge);
    const key = groupKey(members.map((c) => c.id));
    const customers = new Set(members.filter((c) => c.erp).map((c) => `${c.erp}|${c.mandant ?? ""}`));
    const countries = new Set(members.map((c) => countryKey(c.country)).filter(Boolean));
    const base = { key, shared: [shared], members, why, newest: members[members.length - 1].createdate };
    if (customers.size > 1) { counts.families++; if (left.length < MAX_LEFT) left.push({ ...base, kind: "family", into: members[0].id, why: `${why} - ${customers.size} customer numbers: a group's companies, left alone` }); return; }
    if (countries.size > 1) { counts.sites++; if (left.length < MAX_LEFT) left.push({ ...base, kind: "sites", into: members[0].id, why: `${why} - in ${countries.size} countries: sites of one group, left alone` }); return; }
    if (members.length > MAX_POSSIBLE) { counts.big++; if (left.length < MAX_LEFT) left.push({ ...base, kind: "big", into: members[0].id, why: `${why} - ${members.length} companies: too many to be one, left alone` }); return; }
    // all of them one ERP customer: the sure rule has them
    if (customers.size === 1 && members.every((c) => c.erp)) return;
    if (pairs(members.map((c) => c.id)).every((p) => apart.has(p))) { counts.apart++; return; }
    const had = possible.get(key);
    if (had) { if (!had.shared.includes(shared)) { had.shared.push(shared); had.why = `${had.why}; ${why.charAt(0).toLowerCase()}${why.slice(1)}`; } if (shared === "place") delete had.otherNames; return; }
    const otherNames = shared === "website" && new Set(members.map((c) => nameKey(c.name))).size > 1;
    if (otherNames && !rules.website.otherNames) return;
    possible.set(key, { ...base, kind: "possible", into: intoOf(members, "possible"), ...(otherNames ? { otherNames: true } : {}) });
  };
  if (rules.place.on) {
    for (const [, g] of buckets((c) => { const n = nameKey(c.name), z = zipKey(c.zip), k = countryKey(c.country); return n && z && k ? `${n}|${z}|${k}` : null; })) {
      consider("place", g, `Same name at ${g[0].zip}${g[0].city ? ` ${g[0].city}` : ""}, ${g[0].country}`);
    }
  }
  if (rules.website.on) {
    for (const [d, g] of buckets((c) => c.domain)) consider("website", g, `Same website ${d}`);
  }
  // the strongest first: both shared, then the same name and place, the same website and name, another name
  const rank = (x: Group) => (x.shared.length > 1 ? 0 : x.shared[0] === "place" ? 1 : x.otherNames ? 3 : 2);
  return {
    sure: sure.sort((a, b) => (b.newest ?? "").localeCompare(a.newest ?? "")),
    possible: [...possible.values()].sort((a, b) => rank(a) - rank(b) || (b.newest ?? "").localeCompare(a.newest ?? "")),
    left,
    counts,
  };
}

/** Is it still the group it was? Before a merge every company is read again: none gone, still the rule's. */
export function stillHolds(kind: "erp" | "possible", now: Company[]): string | null {
  if (now.length < 2) return "fewer than two companies left";
  if (kind === "erp") {
    const keys = new Set(now.map((c) => (c.erp && c.mandant ? `${c.erp}|${c.mandant}` : "-")));
    if (keys.size !== 1 || keys.has("-")) return "the customer numbers differ now";
    return null;
  }
  const customers = new Set(now.filter((c) => c.erp).map((c) => `${c.erp}|${c.mandant ?? ""}`));
  if (customers.size > 1) return `${customers.size} different customer numbers now - never merged`;
  return null;
}

// ---------------------------------------------------------------- the merges of the past, from HubSpot's history

export type HistEntry = { value: string | null; timestamp: string; sourceType?: string; sourceId?: string; updatedByUserId?: number };
export type MergeEvent = { at: string; into: string; n: number; by: string };

/** The merges a company's hs_merged_object_ids history tells: each change added the ids merged then - a merge into a new
 *  record adds two (the old record and the one merged in), an older one only the one merged in. */
export function mergesOf(companyId: string, hist: HistEntry[], byOf: (h: HistEntry) => string): MergeEvent[] {
  const h = [...hist].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  let prev = new Set<string>();
  const out: MergeEvent[] = [];
  for (const e of h) {
    const ids = String(e.value ?? "").split(";").map((x) => x.trim()).filter(Boolean);
    const added = ids.filter((x) => !prev.has(x));
    prev = new Set(ids);
    if (!added.length) continue;
    out.push({ at: e.timestamp, into: companyId, n: added.length >= 2 ? added.length - 1 : added.length, by: byOf(e) });
  }
  return out;
}
