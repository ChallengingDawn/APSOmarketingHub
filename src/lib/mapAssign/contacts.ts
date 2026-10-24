// MAP ASSIGNMENT - contacts, the pure part (SARCLA 21.10.2026: "instead of Differences I want to see the KPI of new
// contacts entering the assignment - to whom, if it hit the rules or not - and also the contact association: every
// contact associated to a company matches the same as in the company"). How a new contact stands against its company,
// which of those that do not follow the rules are sure to correct (24.10.2026), and the page's numbers counted from them. No HubSpot, no database, relative imports only - tests/map-assign-contacts.test.ts
// runs it as is. The reads, the kv and the match totals: contactsKpi.ts (which re-exports everything here).

import { INTERNAL_DOMAINS, isInternal, zurich, type Internal } from "./plan";
import type { ContactFollow } from "./follow";

/* ── one new contact ───────────────────────────────────────────────────── */

/**
 * follows          its owner AND region responsibility are the company's owner by the rules
 * follows-company  its owner is the company's owner in HubSpot now, which is not the one the rules give
 * differs          anything else (another owner, or the right owner with another region responsibility)
 * unknown-company  its company is not in the table yet (new, the next run reads it)
 * no-company       no primary company (the "No company" tab)
 */
export type ContactClass = "follows" | "follows-company" | "differs" | "unknown-company" | "no-company";
export const CLASS_ORDER: readonly ContactClass[] = ["follows", "follows-company", "differs", "unknown-company", "no-company"];

/** Which rule gave the company its owner: the table's via ("sae" rule 1, "zone" / "default" rule 2). */
export type RuleKey = "rule1" | "rule2" | "key" | "redirection" | "other" | "unknown-company" | "no-company";
export const RULE_ORDER: readonly RuleKey[] = ["rule1", "rule2", "key", "redirection", "other", "unknown-company", "no-company"];

export function ruleOf(via: string | null | undefined): Exclude<RuleKey, "unknown-company" | "no-company"> {
  switch (String(via ?? "").trim()) {
    case "sae": return "rule1";
    case "zone": case "default": return "rule2";
    case "key": return "key";
    case "redirection": return "redirection";
    default: return "other";
  }
}

/** A new contact as HubSpot has it. */
export type NewContactRow = {
  id: string; email: string | null;
  /** createdate: ISO or epoch ms as text */
  created: string | null;
  /** hubspot_owner_id, region_responsibility (an owner id too), sae_performis, associatedcompanyid */
  owner: string | null; region: string | null; sae?: string | null; companyId: string | null;
};
/** Its company as the table keeps it (apsomh_map_assign). */
export type CompanyRuleRow = {
  id: string; name: string | null; country: string | null; ownerNow: string | null; regionNow: string | null;
  /** owner_decided: the person the rules give */
  decided: string;
  via: string; sae?: string | null;
};

/** Ids compared as text - kv and pg can hand back a number. null = "" (nobody). */
const v = (x: unknown) => String(x ?? "").trim();

/** The contact against its company - the first that fits, in CLASS_ORDER. */
export function contactClass(c: { owner?: unknown; region?: unknown; companyId?: unknown }, co: CompanyRuleRow | null | undefined): ContactClass {
  if (!v(c.companyId)) return "no-company";
  if (!co) return "unknown-company";
  const decided = v(co.decided);
  if (v(c.owner) === decided && v(c.region) === decided) return "follows";
  if (v(c.owner) === v(co.ownerNow) && v(co.ownerNow) !== decided) return "follows-company";
  return "differs";
}

/**
 * SARCLA 24.10.2026: "Can we correct all 'The latest that do not follow the rules'? If we are 100% sure that they don't
 * follow the rules." A contact that does not follow the rules is SURE when its company does - the company's owner AND
 * region responsibility in HubSpot now are the person the rules give it: then the right owner and region of the
 * contact are the company's, whichever way one looks, and once written the contact follows the rules. Every other one
 * is not sure - the company first:
 *   company          the company itself differs from the rules (owner or region) - right the company, its contacts follow
 *   unknown-company  the company is not in the table yet (the next run reads it)
 *   no-company       no primary company (the No company tab)
 * null = the contact follows the rules: nothing to correct. A+P people are left out before (isInternal).
 */
export type SureClass = "sure" | "company" | "unknown-company" | "no-company";
export type NotSureCounts = Record<Exclude<SureClass, "sure">, number>;
export function sureClass(c: { owner?: unknown; region?: unknown; companyId?: unknown }, co: CompanyRuleRow | null | undefined): SureClass | null {
  const kind = contactClass(c, co);
  if (kind === "follows") return null;
  if (kind === "no-company" || kind === "unknown-company") return kind;
  const decided = v(co!.decided);
  return decided && v(co!.ownerNow) === decided && v(co!.regionNow) === decided ? "sure" : "company";
}

/* ── the 30 days ───────────────────────────────────────────────────────── */

/** "2026-10-21" -> the ms of midnight in Zurich (CET +1 / CEST +2). */
export function zurichMidnight(day: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return NaN;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  for (const h of [1, 2]) {
    const t = utc - h * 3600_000;
    const z = zurich(t);
    if (z.day === day && z.hm === "00:00") return t;
  }
  return utc - 3600_000;
}

/** The last `days` Zurich days, oldest first, today last ("2026-09-22" ... "2026-10-21"). */
export function windowDays(now: number, days = 30): string[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(zurich(now).day)!;
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - i)).toISOString().slice(0, 10));
  return out;
}
/** Where the window starts: midnight in Zurich of its first day - what the HubSpot search asks for. */
export const windowStart = (now: number, days = 30) => zurichMidnight(windowDays(now, days)[0]);

const msOf = (x: string | null | undefined) => {
  const s = v(x);
  if (!s) return NaN;
  return /^\d+$/.test(s) ? Number(s) : Date.parse(s);
};

/* ── the page's numbers ────────────────────────────────────────────────── */

export type ClassCounts = Record<ContactClass, number>;
export type DayCount = { day: string; total: number; classes: ClassCounts };
/** owner: the company's owner by the rules ("" = no company, or not read yet) */
export type PersonCount = { owner: string; n: number; follows: number };
export type RuleCount = { rule: RuleKey; n: number; follows: number };
/** country: the company's ("??" = the company has none; "" = no company, or not read yet) */
export type CountryCount = { country: string; n: number; follows: number };
export type NewContactExample = {
  id: string; email: string | null; created: string | null; kind: ContactClass;
  /** the contact's owner and region responsibility now */
  owner: string | null; region: string | null;
  companyId: string | null; companyName: string | null; country: string | null;
  /** the company's owner in HubSpot now, and by the rules */
  companyOwnerNow: string | null; decided: string | null;
  rule: RuleKey;
  /** its company follows the rules: "Correct the sure ones" gives it the company's owner and region (absent from an
   *  older count) */
  sure?: boolean;
};
export type NewContactsPart = {
  total: number; classes: ClassCounts;
  /** every day of the window, oldest first (empty days with 0) */
  perDay: DayCount[];
  byPerson: PersonCount[];
  byRule: RuleCount[];
  /** the latest that do not follow the rules (no-company ones are on the No company tab), newest first */
  examples: NewContactExample[];
  /** of those that do not follow the rules: the sure ones (sureClass) and the not sure ones by why - absent from a
   *  count made before 24.10.2026 */
  sure?: number;
  notSure?: NotSureCounts;
};
export type NewContactsKpi = NewContactsPart & {
  /** kept shape version */
  v: number;
  at: string;
  /** the window: Zurich days, today included */
  days: number;
  since: string;
  /** contacts read from HubSpot, A+P people included */
  read: number;
  /** A+P people left out (INTERNAL_DOMAINS, list 2865's addresses when given) */
  internal: number;
  /** the read stopped at HubSpot's 10,000 search results: the oldest days are short */
  capped: boolean;
  byCountry: CountryCount[];
  /** the same numbers per company country ("??" = no country) - the page's country pills; contacts with no company
   *  (or one not read yet) are in the totals only */
  countries: Record<string, NewContactsPart>;
};
export const KPI_VERSION = 1;
export const EXAMPLES = 20;
export const COUNTRY_EXAMPLES = 10;

const zero = (): ClassCounts => ({ follows: 0, "follows-company": 0, differs: 0, "unknown-company": 0, "no-company": 0 });

/** Of the contacts whose company is known, the share that follow the rules (0..1); null = none known. */
export function followShare(p: Pick<NewContactsPart, "classes">): number | null {
  const c = p.classes;
  const known = c.follows + c["follows-company"] + c.differs;
  return known > 0 ? c.follows / known : null;
}

type Acc = {
  total: number; classes: ClassCounts; days: Map<string, DayCount>;
  person: Map<string, PersonCount>; rule: Map<RuleKey, RuleCount>; examples: NewContactExample[]; max: number;
  sure: number; notSure: NotSureCounts;
};
const acc = (dayList: string[], max: number): Acc => ({
  total: 0, classes: zero(), days: new Map(dayList.map((day) => [day, { day, total: 0, classes: zero() }])),
  person: new Map(), rule: new Map(), examples: [], max, sure: 0, notSure: { company: 0, "unknown-company": 0, "no-company": 0 },
});
function add(a: Acc, day: string, kind: ContactClass, person: string, rule: RuleKey, ex: NewContactExample | null, sc: SureClass | null) {
  const f = kind === "follows" ? 1 : 0;
  a.total++; a.classes[kind]++;
  if (sc === "sure") a.sure++; else if (sc) a.notSure[sc]++;
  const d = a.days.get(day);
  if (d) { d.total++; d.classes[kind]++; }
  const p = a.person.get(person) ?? { owner: person, n: 0, follows: 0 };
  p.n++; p.follows += f; a.person.set(person, p);
  const r = a.rule.get(rule) ?? { rule, n: 0, follows: 0 };
  r.n++; r.follows += f; a.rule.set(rule, r);
  if (ex && a.examples.length < a.max) a.examples.push(ex);
}
const part = (a: Acc): NewContactsPart => ({
  total: a.total, classes: a.classes, perDay: [...a.days.values()],
  byPerson: [...a.person.values()].sort((x, y) => y.n - x.n || y.follows - x.follows || x.owner.localeCompare(y.owner)),
  byRule: RULE_ORDER.map((k) => a.rule.get(k)).filter((x): x is RuleCount => !!x),
  examples: a.examples, sure: a.sure, notSure: { ...a.notSure },
});

/**
 * The new contacts of the window, counted: A+P people left out, each contact classed against its company
 * (`companies`: company id -> its row), per class, per Zurich day, per person (the company's owner by the rules), per
 * rule, per country, the latest that do not follow; and the same per company country. Contacts created before the
 * window's first midnight are left out (the search asks for the same).
 */
export function buildNewContacts(
  rows: NewContactRow[], companies: Map<string, CompanyRuleRow>,
  opts: { now: number; days?: number; capped?: boolean; internal?: Internal },
): NewContactsKpi {
  const days = opts.days ?? 30;
  const dayList = windowDays(opts.now, days);
  const since = zurichMidnight(dayList[0]);
  const internal = opts.internal ?? { domains: new Set(INTERNAL_DOMAINS), emails: new Set<string>() };
  const all = acc(dayList, EXAMPLES);
  const per = new Map<string, Acc>();
  const byCountry = new Map<string, CountryCount>();
  let skipped = 0;
  // newest first: the examples are the latest
  const sorted = rows.map((r) => ({ r, t: msOf(r.created) })).sort((a, b) => (b.t || 0) - (a.t || 0) || v(b.r.id).localeCompare(v(a.r.id)));
  const seen = new Set<string>();
  for (const { r, t } of sorted) {
    if (seen.has(v(r.id))) continue;
    seen.add(v(r.id));
    if (!Number.isFinite(t) || t < since) continue;
    if (isInternal(r.email, internal)) { skipped++; continue; }
    const cid = v(r.companyId);
    const co = cid ? companies.get(cid) : undefined;
    const kind = contactClass(r, co);
    const sc = sureClass(r, co);
    const known = kind !== "no-company" && kind !== "unknown-company" && !!co;
    const person = known ? v(co!.decided) : "";
    const rule: RuleKey = known ? ruleOf(co!.via) : kind === "no-company" ? "no-company" : "unknown-company";
    const country = known ? v(co!.country).toUpperCase() || "??" : "";
    const day = zurich(t).day;
    const ex: NewContactExample | null = kind === "follows" || kind === "no-company" ? null : {
      id: v(r.id), email: r.email, created: new Date(t).toISOString(), kind, owner: r.owner ? v(r.owner) : null, region: r.region ? v(r.region) : null,
      companyId: cid || null, companyName: co?.name ?? null, country: co ? (v(co.country).toUpperCase() || null) : null,
      companyOwnerNow: co?.ownerNow ? v(co.ownerNow) : null, decided: co ? v(co.decided) : null, rule, sure: sc === "sure",
    };
    add(all, day, kind, person, rule, ex, sc);
    const c = byCountry.get(country) ?? { country, n: 0, follows: 0 };
    c.n++; if (kind === "follows") c.follows++;
    byCountry.set(country, c);
    if (country) {
      let a = per.get(country);
      if (!a) { a = acc(dayList, COUNTRY_EXAMPLES); per.set(country, a); }
      add(a, day, kind, person, rule, ex, sc);
    }
  }
  return {
    v: KPI_VERSION, at: new Date(opts.now).toISOString(), days, since: new Date(since).toISOString(),
    read: seen.size, internal: skipped, capped: !!opts.capped,
    ...part(all),
    byCountry: [...byCountry.values()].sort((a, b) => b.n - a.n || a.country.localeCompare(b.country)),
    countries: Object.fromEntries([...per].sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0])).map(([k, a]) => [k, part(a)])),
  };
}

/* ── contacts against their company (the table's counts) ───────────────── */

/** One line of the match totals (a country, a person, or everything). */
export type MatchCounts = {
  companies: number;
  /** associated contacts (contacts_n, counted on the nightly full read) */
  contacts: number;
  /** companies whose contacts were counted */
  companiesCounted: number;
  /** contacts checked against the company's owner BY THE RULES (contacts_off: owner, region or SAE) - counted for the
   *  companies whose owner would change and every company of a live country - and of them those that differ */
  companiesChecked: number; checked: number; off: number;
  /** contacts compared with the company's owner and region IN HUBSPOT NOW (contacts_mism, the nightly full read), and
   *  of them those that differ */
  companiesMism: number; mismCounted: number; mism: number;
};
export type MatchByCountry = MatchCounts & { country: string };
export type MatchByOwner = MatchCounts & { owner: string };
export type ContactMatch = {
  /** the last read of the table, and the last full read (contacts counted) */
  at: string | null; countedAt: string | null;
  /** false: the table has no contacts_mism column yet (the engine's change is not deployed) */
  mismKnown: boolean;
  byCountry: MatchByCountry[];
  /** by the company's owner by the rules, the 15 with the most contacts */
  byOwner: MatchByOwner[];
  totals: MatchCounts;
};
/** GET /api/uc/map-assignment?contacts=1 (follow: the steering card, follow.ts - absent from an older hub) */
export type ContactsData = { newContacts: NewContactsKpi | null; match: ContactMatch; follow?: ContactFollow };

/** The share that matches (0..1): of the contacts counted, those that do not differ; null = none counted. */
export function matchShare(counted: number, differ: number): number | null {
  const n = Math.max(0, Number(counted) || 0);
  if (!n) return null;
  return Math.max(0, Math.min(1, 1 - Math.max(0, Number(differ) || 0) / n));
}
