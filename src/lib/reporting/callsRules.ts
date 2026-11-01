// THE TSA CALLS PAGE'S RULES (SARCLA 01.11.2026: "TSA don't do visits, they call, they do qualified calls ... build instead
// of visits a sub report for calls"). A qualified call - the call outcome "TSA Qualified Calls", the TSA reps' "reached" -
// is to TSA what a completed visit is to ESO, so its rows are the Visits page's (./visitsRules.ts: the period, the filters,
// the prospects called and did they register and buy, the customers called and did they buy again, how much of each
// priority was reached, the companies behind a chart), the direction of the call in the visit type's place. Beside them,
// every call of the year with its outcome, for how many of a person's calls were qualified. No HubSpot or database here.

import { daysOf, type VWin, type VisitsData } from "./visitsRules";

export type CallsData = VisitsData & {
  /** every call of this year, qualified or not: person index, month (0 = January), day, outcome (index into outcomes) */
  all: number[][];
  /** the call outcomes by their HubSpot names, "No outcome" for a call without one */
  outcomes: string[];
};
/** The columns of an all-calls row. */
export const A = { person: 0, month: 1, day: 2, outcome: 3 } as const;

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

/** Every call of the period per person shown, and of them the qualified ones - by the call's day, as the rows. */
export function allCallsOf(d: CallsData, win: VWin, people: Set<number>): Map<number, { calls: number; qualified: number }> {
  const [a, b] = daysOf(d, win);
  const q = d.outcomes.indexOf(QUALIFIED);
  const out = new Map<number, { calls: number; qualified: number }>();
  for (const r of d.all) {
    const day = d.year * 10000 + (r[A.month] + 1) * 100 + r[A.day];
    if (day < a || day > b || !people.has(r[A.person])) continue;
    const x = out.get(r[A.person]) ?? { calls: 0, qualified: 0 };
    x.calls++;
    if (r[A.outcome] === q) x.qualified++;
    out.set(r[A.person], x);
  }
  return out;
}
