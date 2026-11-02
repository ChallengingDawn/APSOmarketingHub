// MY SALES REPORTS' FIGURES - what each of the VPP sheet's five targets is measured on, out of the ESO reports' own reads:
// the customers' cube (revenue of the person's customers by Performis SAE, the profit centres DT and KT, the new
// customers - the BSC rule, as ESO's New customers counts them) and the visits read (completed visit reports). Per
// quarter of this year, last year's same quarters, last year in all, and the year to date - for one person, a team, or
// all ESO, and per person for the contribution views. No HubSpot or database here, so the page and the tests read it.

import { breakdown, lastMonth, monthOf, newBy, partial, pcBy, totals, type Cube, type Filters, type Win } from "../marketingKpis/cube";
import { V, type VisitsData } from "./visitsRules";
import type { TargetId } from "./mySalesRules";

/** One target's figures for the people shown. */
export type Measured = {
  /** this year's quarters - nothing yet in a quarter not begun */
  q: number[];
  /** last year's quarters, whole */
  qPy: number[];
  /** last year in all - what a growth target is set on */
  py: number;
  /** this year to date, and last year's same days */
  ytd: number; ytdPy: number;
};
export type Measures = Record<TargetId, Measured>;

/** Where this year's figures reach: the month (0-11) and how much of it - the cube's ERP day, the visits' read day. */
export type Reach = { month: number; share: number };
export const cubeReach = (cube: Cube): Reach => {
  const month = Math.max(0, lastMonth(cube) - monthOf(0, 0));
  const run = partial(cube);
  return { month, share: run && run.month === monthOf(0, month) ? run.day / run.days : 1 };
};
export const visitsReach = (d: VisitsData): Reach => {
  const month = Number(d.today.slice(5, 7)) - 1, day = Number(d.today.slice(8, 10));
  return { month, share: day / new Date(Date.UTC(d.year, month + 1, 0)).getUTCDate() };
};

const sum = (xs: number[], a = 0, b = xs.length - 1) => { let s = 0; for (let i = a; i <= b; i++) s += xs[i] ?? 0; return s; };
const NONE: Filters = { sae: ["\u0000 none"] };
/** The cube's filter for these people (their SAE names); nobody: nothing at all, never everybody. */
export const saeFilter = (labels: string[]): Filters => (labels.length ? { sae: labels } : NONE);
const win = (a: number, b: number, py = false): Win => ({ start: monthOf(py ? 1 : 0, a), end: monthOf(py ? 1 : 0, b) });

/** A series of twelve months (this year, last year) as the quarters, the year and the year to date. */
function fromMonths(cy: number[], py: number[], r: Reach): Measured {
  const q = [0, 1, 2, 3].map((k) => (k * 3 > r.month ? 0 : sum(cy, k * 3, Math.min(k * 3 + 2, r.month))));
  const qPy = [0, 1, 2, 3].map((k) => sum(py, k * 3, k * 3 + 2));
  // last year's month matching the one in progress counts pro rata, as everywhere on the reports
  const ytdPy = sum(py, 0, r.month - 1) + (py[r.month] ?? 0) * r.share;
  return { q, qPy, py: sum(py), ytd: sum(cy, 0, r.month), ytdPy };
}

/** The four revenue targets for the people with these SAE names. */
export function revenueMeasures(cube: Cube, labels: string[]): Omit<Measures, "visits"> {
  const f = saeFilter(labels), r = cubeReach(cube);
  // own area: the customers' revenue month by month
  const cy = Array.from({ length: 12 }, (_, m) => (m > r.month ? 0 : totals(cube, f, win(m, m)).rev));
  const py = Array.from({ length: 12 }, (_, m) => totals(cube, f, win(m, m, true)).rev);
  const own = fromMonths(cy, py, r);
  // the profit centres, as the Figures' Profit center tab reads them
  const pcs = pcBy(cube, f).get("") ?? new Map();
  const pcOf = (pc: string) => { const p = pcs.get(pc); return fromMonths(p?.cy ?? [], p?.py ?? [], r); };
  // the new customers: first invoiced this year, and what they were invoiced - a quarter is what the year's new
  // customers were invoiced in it, so the quarters add up to the year to date
  const cum = (k: number) => { const a = newBy(cube, f, win(0, Math.min(k * 3 + 2, r.month))).get(""); return { rev: a?.rev ?? 0, revPy: a?.revPy ?? 0 }; };
  const runQ = Math.floor(r.month / 3);
  const c = [0, 1, 2, 3].map((k) => (k <= runQ ? cum(k) : null));
  const nq = c.map((x, k) => (x ? x.rev - (k > 0 ? c[k - 1]!.rev : 0) : 0));
  const nqPy = c.map((x, k) => (x ? x.revPy - (k > 0 ? c[k - 1]!.revPy : 0) : 0));
  const pyYear = newBy(cube, f, win(0, 11, true)).get("")?.rev ?? 0;
  const neu: Measured = { q: nq, qPy: nqPy, py: pyYear, ytd: c[runQ]?.rev ?? 0, ytdPy: c[runQ]?.revPy ?? 0 };
  return { own, dt: pcOf("dt"), kt: pcOf("kt"), new: neu };
}

/** The visits target for these people (indexes into d.people): this year's completed visits, last year's customer meetings. */
export function visitsMeasure(d: VisitsData, people: Set<number>): Measured {
  const r = visitsReach(d);
  const cy = Array(12).fill(0), py = Array(12).fill(0);
  // a visit row's year is counted back from the read's: 0 this year, 1 the year before
  for (const v of d.visits) if (people.has(v[V.person]) && v[V.year] === 0) cy[v[V.month]] += 1;
  for (const m of d.lastYear) if (people.has(m[0])) py[m[1]] += 1;
  return fromMonths(cy, py, r);
}

/** Per person, the year to date and last year's same days - the contribution views. */
export type PersonFig = { label: string; cur: number; prev: number };
export function revenueByPerson(cube: Cube, labels: string[]): Record<Exclude<TargetId, "visits">, PersonFig[]> {
  const f = saeFilter(labels), r = cubeReach(cube), ytd = win(0, r.month);
  const own = breakdown(cube, "sae", f, ytd).map((x) => ({ label: x.label, cur: x.rev, prev: x.revPy }));
  const pcs = pcBy(cube, f, "sae");
  const pcOf = (pc: string) => [...pcs.entries()].map(([label, m]) => { const p = m.get(pc); const x = fromMonths(p?.cy ?? [], p?.py ?? [], r); return { label, cur: x.ytd, prev: x.ytdPy }; });
  const neu = [...newBy(cube, f, ytd, "sae").entries()].map(([label, a]) => ({ label, cur: a.rev, prev: a.revPy }));
  const only = (xs: PersonFig[]) => xs.filter((x) => labels.includes(x.label) && (x.cur || x.prev));
  return { own: only(own), dt: only(pcOf("dt")), kt: only(pcOf("kt")), new: only(neu) };
}
export function visitsByPerson(d: VisitsData, people: Set<number>): PersonFig[] {
  return [...people].map((i) => { const x = visitsMeasure(d, new Set([i])); return { label: d.people[i]?.name ?? `#${i}`, cur: x.ytd, prev: x.ytdPy }; })
    .filter((x) => x.cur || x.prev);
}

/**
 * Per person - by owner id - each target's last year (what a growth is set on) and this year to date, as revenueMeasures
 * and visitsMeasure reckon them for one person; a single pass of the cube per figure for everyone (Sales Leader Reports'
 * tables: a row per person). The cube knows a person by their SAE name, the visits read by their owner id.
 */
export function figsByPerson(cube: Cube, d: VisitsData, people: { id: string; name: string }[]): Map<string, Record<TargetId, { py: number; ytd: number }>> {
  const labels = people.map((p) => p.name);
  const f = saeFilter(labels), r = cubeReach(cube);
  const ownYtd = new Map(breakdown(cube, "sae", f, win(0, r.month)).map((x) => [x.label, x.rev] as [string, number]));
  const ownPy = new Map(breakdown(cube, "sae", f, win(0, 11, true)).map((x) => [x.label, x.rev] as [string, number]));
  const pcs = pcBy(cube, f, "sae");
  const pcOf = (label: string, pc: string) => { const p = pcs.get(label)?.get(pc); return { py: sum(p?.py ?? []), ytd: sum(p?.cy ?? [], 0, r.month) }; };
  const newYtd = newBy(cube, f, win(0, r.month), "sae"), newPy = newBy(cube, f, win(0, 11, true), "sae");
  const index = new Map(d.people.map((p, i) => [p.id, i]));
  const out = new Map<string, Record<TargetId, { py: number; ytd: number }>>();
  for (const p of people) {
    const i = index.get(p.id);
    const v = i == null ? { py: 0, ytd: 0 } : visitsMeasure(d, new Set([i]));
    out.set(p.id, {
      own: { py: ownPy.get(p.name) ?? 0, ytd: ownYtd.get(p.name) ?? 0 },
      dt: pcOf(p.name, "dt"), kt: pcOf(p.name, "kt"),
      new: { py: newPy.get(p.name)?.rev ?? 0, ytd: newYtd.get(p.name)?.rev ?? 0 },
      visits: { py: v.py, ytd: v.ytd },
    });
  }
  return out;
}

/**
 * How much of the year's target is due by now: the quarters done in full, the running one as far as it has run (its
 * months done and the share of the month in progress). What the year to date is measured against.
 */
export function dueToDate(quarters: number[], r: Reach): number {
  const runQ = Math.floor(r.month / 3);
  const into = (r.month - runQ * 3 + r.share) / 3;
  return sum(quarters, 0, runQ - 1) + (quarters[runQ] ?? 0) * into;
}
