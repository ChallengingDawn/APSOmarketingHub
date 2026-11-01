// THE TSA CALLS PAGE'S RULES (SARCLA 01.11.2026: "TSA don't do visits, they call, they do qualified calls ... build instead
// of visits a sub report for calls"). A qualified call - the call outcome "TSA Qualified Calls", the TSA reps' "reached" -
// is to TSA what a completed visit is to ESO, so its rows are the Visits page's (./visitsRules.ts: the period, the filters,
// the prospects called and did they register and buy, the customers called and did they buy again, how much of each
// priority was reached, the companies behind a chart), the direction of the call in the visit type's place. Beside them,
// every call of the year with its outcome and company, for how many of a person's calls were qualified and which companies
// several people call; and each company's first contact by ESO, for what TSA reached alone. No HubSpot or database here.

import { CO, V, daysOf, type VWin, type VisitsData } from "./visitsRules";

export type CallsData = VisitsData & {
  /** every call of this year, qualified or not - see A */
  all: number[][];
  /** the call outcomes by their HubSpot names, "No outcome" for a call without one */
  outcomes: string[];
  /** whether ESO's visits and calls were read for CO_ESO (a read without them says no company had one) */
  esoRead?: boolean;
};
/** The columns of an all-calls row: who, the month (0 = January), the day, the outcome (index into outcomes), the company
 *  (index into companies, -1: none - neither on the call nor on its contact). */
export const A = { person: 0, month: 1, day: 2, outcome: 3, company: 4 } as const;
/** A company row's column after the Visits page's (CO): the first day this year ESO reached it - a completed visit by
 *  ESO, or a call by someone on ESO - yyyymmdd, or 0. */
export const CO_ESO = 6;

/** The call outcome that counts (SARCLA 01.11.2026: "they do qualified calls") */
export const QUALIFIED = "TSA Qualified Calls";
/** The outcomes HubSpot has in this portal, by their ids - a new one is read as "Other outcome" */
export const OUTCOMES: Record<string, string> = {
  "693d66b5-bd64-4289-bfc4-ff93ff004694": QUALIFIED,
  "f240bbac-87c9-4f6e-bf70-924b57d47db7": "Connected",
  "73a0d17f-1163-4015-bdd5-ec830791da20": "No answer",
  "b2cf5968-551e-4856-9783-52b3da59a7d0": "Left voicemail",
  "a4c4c377-d246-4b32-a13b-75a56a4cd0ff": "Left live message",
  "9d9162e7-6cf3-4944-bf63-4dff82258764": "Busy",
  "17b47fee-58de-441e-a44c-c6300d46f273": "Wrong number",
};
/** A qualified call with no company in HubSpot - neither on the call nor on its contact */
export const NO_COMPANY = "No company on the call";
/** The direction of a call, in the visit type's place */
export const DIRECTIONS = ["Outbound", "Inbound", "Not recorded"] as const;
export function directionOf(d: string | null | undefined): (typeof DIRECTIONS)[number] {
  return d === "OUTBOUND" ? "Outbound" : d === "INBOUND" ? "Inbound" : "Not recorded";
}

/** An all-calls row's day, yyyymmdd */
const dayOf = (d: CallsData, r: number[]) => d.year * 10000 + (r[A.month] + 1) * 100 + r[A.day];

/** Every call of the period per person shown, and of them the qualified ones - by the call's day, as the rows. */
export function allCallsOf(d: CallsData, win: VWin, people: Set<number>): Map<number, { calls: number; qualified: number }> {
  const [a, b] = daysOf(d, win);
  const q = d.outcomes.indexOf(QUALIFIED);
  const out = new Map<number, { calls: number; qualified: number }>();
  for (const r of d.all) {
    const day = dayOf(d, r);
    if (day < a || day > b || !people.has(r[A.person])) continue;
    const x = out.get(r[A.person]) ?? { calls: 0, qualified: 0 };
    x.calls++;
    if (r[A.outcome] === q) x.qualified++;
    out.set(r[A.person], x);
  }
  return out;
}

/** What TSA reached alone, and what ESO reached too (SARCLA 01.11.2026: "we need a split - only TSA, TSA & ESO: where the
 *  customer had also a contact from the sales ESO") */
export const WITH_ESO = ["Only TSA", "TSA & ESO"] as const;
/** A qualified call's side of that split: its company had an ESO visit or an ESO call this year by `end` (yyyymmdd) - a
 *  call without a company is TSA's alone. */
export function esoSideOf(d: CallsData, row: number[], end: number): (typeof WITH_ESO)[number] {
  const e = d.companies[row[V.company]]?.[CO_ESO] ?? 0;
  return e > 0 && e <= end ? WITH_ESO[1] : WITH_ESO[0];
}
/** Whether a company had an ESO contact this year by `end` (yyyymmdd). */
export const esoBy = (d: CallsData, ci: number, end: number) => { const e = d.companies[ci]?.[CO_ESO] ?? 0; return e > 0 && e <= end; };

export type Overlap = {
  /** the companies the people shown called, by how many of them called it: 1, 2, 3 or more */
  bands: { people: number; companies: number; calls: number }[];
  /** per person: calls logged on a company, companies called, of them called by another person shown too, and the calls on those */
  persons: Map<number, { calls: number; companies: number; shared: number; sharedCalls: number }>;
  /** per pair of people "a|b" (a < b): the companies both called */
  pairs: Map<string, number>;
  /** the companies called by two or more of the people shown: who called it how often, and the last call's day */
  shared: { ci: number; calls: number; by: Map<number, number>; last: number }[];
  /** calls without a company, which cannot overlap */
  noCompany: number;
};
/**
 * The same company called by several people (SARCLA 01.11.2026: "we have done a report on TSA calls where we showed how many
 * companies get overlapped by user - I want to see it as a diagram"): every call the people shown logged in the period with a
 * company, whatever its outcome - as the TSA calls report of September counted it - per company, who called it.
 */
export function overlapOf(d: CallsData, win: VWin, people: Set<number>): Overlap {
  const [a, b] = daysOf(d, win);
  const byCo = new Map<number, { by: Map<number, number>; calls: number; last: number }>();
  let noCompany = 0;
  for (const r of d.all) {
    const day = dayOf(d, r);
    if (day < a || day > b || !people.has(r[A.person])) continue;
    const ci = r[A.company] ?? -1;
    if (ci < 0) { noCompany++; continue; }
    const x = byCo.get(ci) ?? { by: new Map<number, number>(), calls: 0, last: 0 };
    x.by.set(r[A.person], (x.by.get(r[A.person]) ?? 0) + 1);
    x.calls++;
    x.last = Math.max(x.last, day);
    byCo.set(ci, x);
  }
  const bands = [1, 2, 3].map((n) => ({ people: n, companies: 0, calls: 0 }));
  const persons = new Map<number, { calls: number; companies: number; shared: number; sharedCalls: number }>();
  const pairs = new Map<string, number>();
  const shared: Overlap["shared"] = [];
  for (const [ci, x] of byCo) {
    const who = [...x.by.keys()].sort((p, q) => p - q);
    const band = bands[Math.min(who.length, 3) - 1];
    band.companies++;
    band.calls += x.calls;
    for (const p of who) {
      const s = persons.get(p) ?? { calls: 0, companies: 0, shared: 0, sharedCalls: 0 };
      s.calls += x.by.get(p)!;
      s.companies++;
      if (who.length > 1) { s.shared++; s.sharedCalls += x.by.get(p)!; }
      persons.set(p, s);
    }
    for (let i = 0; i < who.length; i++) for (let j = i + 1; j < who.length; j++) pairs.set(`${who[i]}|${who[j]}`, (pairs.get(`${who[i]}|${who[j]}`) ?? 0) + 1);
    if (who.length > 1) shared.push({ ci, calls: x.calls, by: x.by, last: x.last });
  }
  // the most people first, then the most calls, then this year's revenue
  const rev = (ci: number) => d.companies[ci]?.[CO.revenue] ?? 0;
  shared.sort((p, q) => q.by.size - p.by.size || q.calls - p.calls || rev(q.ci) - rev(p.ci) || p.ci - q.ci);
  return { bands, persons, pairs, shared, noCompany };
}

export type SameDay = {
  /** calls logged on a company */
  calls: number;
  /** calls to a company the person called more than once that day - of them qualified (the customer reached) */
  again: number; againQ: number;
  /** calls to a company someone else shown called the same day too - of them qualified */
  colleague: number; colleagueQ: number;
};
/**
 * The same company called on the same day (SARCLA 01.11.2026: "put also the number of calls on the same day by person, and
 * the outcome - qualified, or simply not qualified: did it reach the customer"), per person shown: the calls to a company
 * they called more than once that day, and the calls to a company someone else shown called that day as well - each with
 * how many were qualified. Every call logged with a company, whatever its outcome, as the overlap.
 */
export function sameDayOf(d: CallsData, win: VWin, people: Set<number>): Map<number, SameDay> {
  const [a, b] = daysOf(d, win);
  const q = d.outcomes.indexOf(QUALIFIED);
  const rows = d.all.filter((r) => { const day = dayOf(d, r); return day >= a && day <= b && people.has(r[A.person]) && (r[A.company] ?? -1) >= 0; });
  const own = new Map<string, number>(), who = new Map<string, Set<number>>();
  for (const r of rows) {
    const k = `${r[A.company]}|${dayOf(d, r)}`;
    own.set(`${r[A.person]}|${k}`, (own.get(`${r[A.person]}|${k}`) ?? 0) + 1);
    const s = who.get(k) ?? new Set<number>();
    s.add(r[A.person]);
    who.set(k, s);
  }
  const out = new Map<number, SameDay>();
  for (const r of rows) {
    const p = r[A.person], k = `${r[A.company]}|${dayOf(d, r)}`, qualified = r[A.outcome] === q;
    const x = out.get(p) ?? { calls: 0, again: 0, againQ: 0, colleague: 0, colleagueQ: 0 };
    x.calls++;
    if ((own.get(`${p}|${k}`) ?? 0) > 1) { x.again++; if (qualified) x.againQ++; }
    if ((who.get(k)?.size ?? 0) > 1) { x.colleague++; if (qualified) x.colleagueQ++; }
    out.set(p, x);
  }
  return out;
}
