// THE SALES ACTIVITY PAGE'S RULES (SARCLA 05.11.2026: "build this report as a sub report on ESO and TSA master dashboard").
// Diana's HubSpot dashboard "Sales Activities x Companies Performance" (114773211, 21.08.2026) in ESO and TSA Reports:
// which companies Sales reached, and what share of the revenue and of the potential sits in them - with what Alexandre
// asked for on 10.09.2026: a fairer base than every company in HubSpot ("the ratio of visits on 60k companies is
// misleading"), and the same view on potential beside the revenue.
//
// Reached = Diana's company flags "Sales Activity in <year> (...)", Yes or No - one per definition and year, kept in
// HubSpot, so the page and her dashboard always give the same answer. Last year is the whole year, this year runs to
// today. The bases are the ones discussed in the thread (all companies, ever bought, bought this year, the customer
// categories) and Claudio's pick, Prio 1 + 2 - the size Sales can cover. The potential is today's for both years.
// No HubSpot here, so the page and the tests read it as it is; the read is ./salesActivityReport.ts.

import { PRIOS, prioFrom, usable } from "./customerDevRules";
import { prioOf } from "./esoRules";

/** Diana's four definitions, each a pair of company flags: `sales_activity_in_<year><suffix>` = "Yes" | "No". */
export const DEFS = [
  { id: "cv", suffix: "_calls_and_visits_sales", label: "Calls and visits", verb: "called or visited", note: "a logged call or a customer visit" },
  { id: "visits", suffix: "_only_visits", label: "Visits only", verb: "visited", note: "a customer visit" },
  { id: "sales", suffix: "_all_excl_bo", label: "Calls, visits and Sales e-mails", verb: "contacted by Sales", note: "a call, a visit or an e-mail by ESO or TSA - the Back Office's e-mails left out" },
  { id: "all", suffix: "", label: "Calls, visits and every e-mail", verb: "contacted", note: "a call, a visit or a sales e-mail, the Back Office's included" },
] as const;
export type DefId = (typeof DEFS)[number]["id"];
/** The HubSpot property behind a definition and a year. */
export const flagName = (year: number, def: number) => `sales_activity_in_${year}${DEFS[def].suffix}`;
/** A definition by its id - calls and visits (the CEO's "sales activity") when unknown. */
export const defOf = (id: string | null | undefined) => Math.max(0, DEFS.findIndex((d) => d.id === id));

/** The customer categories of the "core + growth + prospect" base. */
export const SEGMENTS = ["APSOcore", "APSOgrowth", "APSOprospect"] as const;
/** Which companies count, Claudio's pick first (his reply of 10.09.2026) - its name, and the words a sentence takes. */
export const BASES = [
  { id: "prio12", label: "Prio 1 + 2", words: "Prio 1 + 2 companies", note: "sales priority Prio 1 or Prio 2 - a potential of €2,500 or more, the companies Sales can cover" },
  { id: "all", label: "All companies", words: "companies in HubSpot", note: "every company in HubSpot - the base of the HubSpot dashboard" },
  { id: "bought", label: "Ever bought", words: "companies that ever bought", note: "a first order on record, or revenue last year or this year" },
  { id: "segments", label: "APSOcore, APSOgrowth, APSOprospect", words: "APSOcore, APSOgrowth and APSOprospect companies", note: "the customer categories today - APSOprospect is a size band" },
  { id: "active", label: "Bought this year", words: "companies that bought this year", note: "revenue this year - buying brings contact, so this base flatters the share" },
] as const;
export type BaseId = (typeof BASES)[number]["id"];
export const baseOf = (id: string | null | undefined): BaseId => (BASES.find((b) => b.id === id)?.id ?? "prio12");

export type SalesActData = {
  generatedAt: string;
  /** this year; last year is year - 1 */
  year: number;
  /** the day the read reaches, "2026-11-05" */
  today: string;
  /** whether each definition's flag is in HubSpot, last year and this year (by DEFS) - one missing reads as unknown, not none */
  read: { py: boolean[]; cy: boolean[] };
  /** the company owners, by index - and their team: "ESO", "TSA", "Other" */
  people: { name: string; team: string }[];
  labels: { prio: string[]; category: string[]; country: string[] };
  /** one row per company in HubSpot - see C */
  companies: number[][];
  names: string[];
  ids: string[];
  coverage: { companies: number; noOwner: number; prioWorkedOut: number };
};
/**
 * The columns of a company row: its owner (index into people, -1: none), priority, customer category and country (label
 * indexes); the definitions it was reached by last year and this year (bit i = DEFS[i]); whether it ever bought (0/1);
 * its revenue last year and this year so far, and its yearly potential (whole euros, 0 when none is usable).
 */
export const C = { person: 0, prio: 1, category: 2, country: 3, py: 4, cy: 5, bought: 6, revPy: 7, revCy: 8, pot: 9 } as const;

/** The priority a company is counted under: Smart Segmentation's, else worked out by its rule (as Customer development). */
export function prioLabel(salesPriority: string | null | undefined, potential: number, bestYear: number): { prio: string; worked: boolean } {
  const p = prioOf(salesPriority);
  return p === "Not set" ? { prio: prioFrom(potential, bestYear), worked: true } : { prio: p, worked: false };
}
/** A potential the page counts: above zero and up to €1m - higher ones are placeholders (as the customers' cube). */
export const potentialOf = (v: string | number | null | undefined) => { const n = Number(v); return Number.isFinite(n) && usable(n) ? Math.round(n) : 0; };
/** The definitions a company was reached by, as bits, from its flags read for one year. */
export function reachedBits(props: Record<string, string | null | undefined>, year: number): number {
  let bits = 0;
  DEFS.forEach((_, i) => { if (props[flagName(year, i)] === "Yes") bits |= 1 << i; });
  return bits;
}
/** Whether a company was reached by a definition, this year or last. */
export const reachedBy = (row: number[], def: number, side: "cy" | "py") => ((row[side === "cy" ? C.cy : C.py] >> def) & 1) === 1;

export type SDim = "person" | "prio" | "category" | "country";
export type SFilters = Partial<Record<SDim, string[]>>;
/** The base a breakdown counts on: by priority every priority stands (SARCLA 06.11.2026: "put all the priorities here") -
 *  Prio 1 + 2 is itself two of the rows, so there it widens to every company; any other base keeps its companies. */
export const baseForDim = (base: BaseId, dim?: SDim): BaseId => (dim === "prio" && base === "prio12" ? "all" : base);
const COL: Record<Exclude<SDim, "person">, number> = { prio: C.prio, category: C.category, country: C.country };
export const ORDER: Partial<Record<SDim, readonly string[]>> = { prio: PRIOS, category: ["APSOcore", "APSOgrowth", "APSOprospect", "APSOmicro", "APSOlost", "Growth Engine Customer", "Not set"] };

/** A company's value on a breakdown, as its label. */
export function labelOf(d: SalesActData, row: number[], dim: SDim): string {
  if (dim === "person") return row[C.person] >= 0 ? d.people[row[C.person]]?.name ?? "No owner" : "No owner";
  return d.labels[dim][row[COL[dim]]] ?? "Not set";
}

/** Whether a company is in a base. */
export function inBase(d: SalesActData, row: number[], base: BaseId): boolean {
  if (base === "all") return true;
  if (base === "prio12") { const p = d.labels.prio[row[C.prio]]; return p === "Prio 1" || p === "Prio 2"; }
  if (base === "bought") return row[C.bought] === 1;
  if (base === "segments") return (SEGMENTS as readonly string[]).includes(d.labels.category[row[C.category]] ?? "");
  return row[C.revCy] > 0;
}

/**
 * The companies of a base, under the filters, owned by the people shown (indexes; null: everyone, the companies without an
 * owner too). `except` leaves a breakdown's own filter out, for the Filters window's lists; base null: every company.
 */
export function rowsOf(d: SalesActData, base: BaseId | null, f: SFilters, people: Set<number> | null, except?: SDim): number[] {
  const sets = (Object.keys(f) as SDim[]).filter((k) => k !== except && f[k]?.length).map((k) => [k, new Set(f[k])] as const);
  const out: number[] = [];
  d.companies.forEach((r, i) => {
    if (people && !people.has(r[C.person])) return;
    if (base && !inBase(d, r, base)) return;
    if (sets.every(([k, s]) => s.has(labelOf(d, r, k)))) out.push(i);
  });
  return out;
}

/** A set of companies under one definition: reached this year, last year, in neither; their revenue and potential. */
export type SStats = {
  /** the companies */
  n: number;
  /** reached this year (so far), last year, in both, in neither */
  cy: number; py: number; both: number; never: number;
  /** revenue this year so far and last year - of it, the companies reached in that year */
  revCy: number; revPy: number; revCyHit: number; revPyHit: number;
  /** today's potential - of it, the companies reached this year, last year, in neither */
  pot: number; potCy: number; potPy: number; potNever: number;
};
export const blank = (): SStats => ({ n: 0, cy: 0, py: 0, both: 0, never: 0, revCy: 0, revPy: 0, revCyHit: 0, revPyHit: 0, pot: 0, potCy: 0, potPy: 0, potNever: 0 });

/** Add one company to a set's figures. */
export function addTo(s: SStats, row: number[], def: number): void {
  const cy = reachedBy(row, def, "cy"), py = reachedBy(row, def, "py");
  const pot = row[C.pot];
  s.n++;
  s.revCy += row[C.revCy];
  s.revPy += row[C.revPy];
  s.pot += pot;
  if (cy) { s.cy++; s.revCyHit += row[C.revCy]; s.potCy += pot; }
  if (py) { s.py++; s.revPyHit += row[C.revPy]; s.potPy += pot; }
  if (cy && py) s.both++;
  if (!cy && !py) { s.never++; s.potNever += pot; }
}

/** The figures of a set of companies, grouped by a label (all together under ""). */
export function statsBy(d: SalesActData, idx: number[], def: number, key: (row: number[]) => string = () => ""): Map<string, SStats> {
  const out = new Map<string, SStats>();
  for (const i of idx) {
    const row = d.companies[i];
    const k = key(row);
    let s = out.get(k);
    if (!s) { s = blank(); out.set(k, s); }
    addTo(s, row, def);
  }
  return out;
}

/** Every base side by side, under the same filters and people (Alexandre's question: "what could be a better base?"). */
export function basesOf(d: SalesActData, f: SFilters, people: Set<number> | null, def: number): Map<BaseId, SStats> {
  const out = new Map<BaseId, SStats>(BASES.map((b) => [b.id, blank()]));
  for (const i of rowsOf(d, null, f, people)) {
    const row = d.companies[i];
    for (const b of BASES) if (inBase(d, row, b.id)) addTo(out.get(b.id)!, row, def);
  }
  return out;
}

/** A share, or null without a base. */
export const shareOf = (a: number, b: number) => (b > 0 ? a / b : null);
/** The four shares of a set: companies reached, revenue and potential in them, and companies reached in neither year. */
export function sharesOf(s: SStats) {
  return {
    reach: { cy: shareOf(s.cy, s.n), py: shareOf(s.py, s.n) },
    rev: { cy: shareOf(s.revCyHit, s.revCy), py: shareOf(s.revPyHit, s.revPy) },
    pot: { cy: shareOf(s.potCy, s.pot), py: shareOf(s.potPy, s.pot) },
    never: shareOf(s.never, s.n),
  };
}
