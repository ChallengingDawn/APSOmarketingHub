// THE CUSTOMER REPORTS' FIGURES (SARCLA 01.11.2026 on Customer Reports: "based on what we know, think about what kind of
// dynamic KPI would be interesting here") - the whole company, on the customers' cube and the companies kept beside it
// (ledger.ts), worked out on the server: the ledger carries every company's name and never goes to the browser. Five pages:
//   base           active, new, won back, lost - and month by month what came and went
//   concentration  revenue per customer (average, median), the top 10% / 20%, the revenue bands, the top customers
//   cross          one, two, three or more profit centres, the pairs bought together, the cross-sell targets
//   recency        months since the last order, at risk, decreasing, lost - the call lists
//   retention      net and gross revenue retention, the customer retention rate, by cohort
// Each figure follows the period and the Filters; each list of companies behind it (ledger.ts companiesOf) asks the same
// rules (customerRules.ts), so it adds up to the figure.

import { DIMS, passes, type Cube, type Dim, type Filters, type Win } from "./cube";
import type { Ledger } from "./ledger";
import {
  BANDS, PC_FIVE, bandOf, breadthOf, cohortOf, factsOf, in12, inBase, leftAt, pcsIn, periodOf, prepOf, pyReach, revIn, topCount, wonAt,
  type Facts, type Prep,
} from "./customerRules";

export const KPI_PAGES = ["base", "concentration", "cross", "recency", "retention"] as const;
export type KpiPage = (typeof KPI_PAGES)[number];
/** The breakdowns every page has a tab for (SARCLA 01.11.2026 via the main session: country, segment, priority, customer
 *  type, Performis SAE, company owner). */
export const KPI_DIMS = ["country", "segment", "prio", "type", "sae", "owner"] as const satisfies readonly Dim[];
export type KpiDim = (typeof KPI_DIMS)[number];

export type KpiQuery = { page: KpiPage; filters: Filters; win: Win; ids?: string[]; min?: number };

/* ── the figures of each page ──────────────────────────────────────────── */

/** Active, new, won back, lost - this period and the same months a year earlier (null where the three years do not reach). */
export type BaseFig = { active: number; activePy: number; newC: number; newPy: number; won: number; wonPy: number | null; lost: number; lostPy: number | null };
export type BaseMonth = { month: number; active: number; activePy: number; newC: number; newPy: number; won: number; wonPy: number | null; left: number; leftPy: number | null; in12: number; in12Py: number | null };
/** Customers, their revenue, the median and the top 10% / 20% customers' revenue - a year earlier the same. */
export type ConcFig = { n: number; nPy: number; rev: number; revPy: number; median: number; medianPy: number; top10: number; top10Py: number; top20: number; top20Py: number; pos: number; posPy: number };
/** One, two, three or more profit centres; their revenue; the cross-sell targets - a year earlier null where not kept. */
export type CrossFig = { n: number; one: number; two: number; three: number; rev1: number; rev2: number; rev3: number; single: number; singleRev: number; none: number;
  py: { n: number; one: number; two: number; three: number; rev1: number; rev2: number; rev3: number; single: number; singleRev: number } | null };
/** Months since the last order at the period's end (0-3, 3-6, 6-12, 12+), at risk, decreasing. */
export type RecFig = { rec: number[]; recPy: number[] | null; risk: number; riskPy: number | null; riskRev: number; riskRevPy: number | null;
  down: number; downPy: number | null; downRev: number; downRevPy: number | null; downDrop: number; downDropPy: number | null; recRev: number[] };
/** The customers who bought in the same months a year earlier (the base), what they bought then and now - and the year before the same way. */
export type RetFig = { base: number; kept: number; then: number; now: number; gross: number; grew: number; grewThen: number; grewNow: number; shrank: number; shrankThen: number; shrankNow: number; gone: number; goneThen: number;
  py: { base: number; kept: number; then: number; now: number; gross: number } | null };

type Row<F> = F & { label: string };
export type KpiOut = {
  page: KpiPage;
  /** the cube read the figures stand on */
  generatedAt: string;
  win: Win; min: number;
  reach: { flows: boolean; stock: boolean };
  /** customers chosen in Filters with no figures: none of them ordered */
  base?: { total: BaseFig; by: Record<KpiDim, Row<BaseFig>[]>; months: BaseMonth[]; start12: number; end12: number; start12Py: number | null; end12Py: number | null };
  concentration?: { total: ConcFig; by: Record<KpiDim, Row<ConcFig>[]>; pareto: { cy: number[]; py: number[] }; bands: Row<{ n: number; nPy: number; rev: number; revPy: number }>[]; top: { id: string; name: string; rev: number; revPy: number }[] };
  cross?: { total: CrossFig; by: Record<KpiDim, Row<CrossFig>[]>; pairs: { a: string; b: string; n: number; nPy: number | null }[]; single: { pc: string; n: number; nPy: number | null; rev: number }[] };
  recency?: { total: RecFig; by: Record<KpiDim, Row<RecFig>[]> };
  retention?: { total: RetFig; by: Record<KpiDim, Row<RetFig>[]>; cohorts: Row<RetFig & { cohort: number }>[] };
};

/* ── the work ──────────────────────────────────────────────────────────── */

/** The companies the filters and the customers chosen leave - their index and, per breakdown, their value's index. */
function kept(cube: Cube, l: Ledger, filters: Filters, ids?: string[]) {
  const ok = passes(cube, filters);
  const only = ids?.length ? new Set(ids.map(String)) : null;
  const out: number[] = [];
  for (let i = 0; i < l.ids.length; i++) {
    const ci = l.cells[i];
    if (ci >= 0 && ok[ci] && (!only || only.has(l.ids[i]))) out.push(i);
  }
  return out;
}
const DIM_AT = Object.fromEntries(KPI_DIMS.map((d) => [d, DIMS.indexOf(d)])) as Record<KpiDim, number>;

/** Groups: the whole company under "", and per breakdown per value - each with its own accumulator. */
function grouper<A>(cube: Cube, l: Ledger, zero: () => A) {
  const total = zero();
  const by = Object.fromEntries(KPI_DIMS.map((d) => [d, new Map<number, A>()])) as Record<KpiDim, Map<number, A>>;
  return {
    total, by,
    /** the accumulators a company adds to: the total's and its value's on each breakdown */
    of(i: number): A[] {
      const cell = cube.cells[l.cells[i]];
      return [total, ...KPI_DIMS.map((d) => { const v = cell[DIM_AT[d]]; let a = by[d].get(v); if (!a) { a = zero(); by[d].set(v, a); } return a; })];
    },
    rows<F>(done: (a: A) => F, keep: (f: F) => boolean): Record<KpiDim, Row<F>[]> {
      return Object.fromEntries(KPI_DIMS.map((d) => [d, [...by[d].entries()].map(([v, a]) => ({ label: cube.labels[d][v] ?? "Not set", ...done(a) })).filter(keep)])) as Record<KpiDim, Row<F>[]>;
    },
  };
}

/** The weighted median: half the weight on either side. */
export function median(vals: [number, number][]): number {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a[0] - b[0]);
  const half = s.reduce((t, v) => t + v[1], 0) / 2;
  let run = 0;
  for (let k = 0; k < s.length; k++) {
    run += s[k][1];
    if (run > half) return s[k][0];
    if (run === half) return k + 1 < s.length ? (s[k][0] + s[k + 1][0]) / 2 : s[k][0];
  }
  return s[s.length - 1][0];
}
/** The revenue of the top `pct`% of customers (by their revenue), and of all - the positive revenue only. */
function topRev(vals: number[], pct: number): number {
  const s = [...vals].sort((a, b) => b - a);
  let t = 0;
  for (let k = 0; k < topCount(s.length, pct); k++) t += Math.max(0, s[k]);
  return t;
}
const posSum = (vals: number[]) => vals.reduce((t, v) => t + Math.max(0, v), 0);
/** The Pareto curve: the share of the revenue the first 0%, 5%, … 100% of customers (the largest first) bring. */
function pareto(vals: number[]): number[] {
  const s = [...vals].sort((a, b) => b - a), all = posSum(s);
  return Array.from({ length: 21 }, (_, k) => {
    const upto = Math.round((s.length * k * 5) / 100);
    let t = 0;
    for (let j = 0; j < upto; j++) t += Math.max(0, s[j]);
    return all > 0 ? t / all : 0;
  });
}

/** One page's figures for a period and the Filters. */
export function customerKpis(cube: Cube, l: Ledger, q: KpiQuery): KpiOut {
  const p = prepOf(l), per = periodOf(cube, q.win, q.min ?? 0), reach = pyReach(per);
  const idx = kept(cube, l, q.filters, q.ids);
  const out: KpiOut = { page: q.page, generatedAt: cube.generatedAt, win: q.win, min: per.min, reach };
  const facts = (i: number) => factsOf(p, i, per);
  if (q.page === "base") out.base = baseOf(cube, l, p, per, idx, facts, reach);
  else if (q.page === "concentration") out.concentration = concOf(cube, l, p, per, idx, facts);
  else if (q.page === "cross") out.cross = crossOf(cube, l, p, per, idx, facts, reach.flows);
  else if (q.page === "recency") out.recency = recOf(cube, l, idx, facts, reach);
  else out.retention = retOf(cube, l, p, per, idx, facts, reach.flows);
  return out;
}
type FactsFn = (i: number) => Facts;
type Per = ReturnType<typeof periodOf>;

/* ── a) the customer base ──────────────────────────────────────────────── */

function baseOf(cube: Cube, l: Ledger, p: Prep, per: Per, idx: number[], facts: FactsFn, reach: { flows: boolean; stock: boolean }): NonNullable<KpiOut["base"]> {
  const { start: A, end: E } = per.win;
  const cut = per.run ? per.run.month - 12 : -99, share = per.run ? per.run.share : 1;
  const zero = (): BaseFig => ({ active: 0, activePy: 0, newC: 0, newPy: 0, won: 0, wonPy: reach.flows ? 0 : null, lost: 0, lostPy: reach.stock ? 0 : null });
  const g = grouper(cube, l, zero);
  const months: BaseMonth[] = Array.from({ length: E - A + 1 }, (_, j) => {
    const k = A + j;
    // a year earlier: each month's rules look back 12 more months - month 24 (January last year) is the first they reach
    const flows = k - 12 >= 12, stock = k - 12 >= 11;
    return { month: k, active: 0, activePy: 0, newC: 0, newPy: 0, won: 0, wonPy: flows ? 0 : null, left: 0, leftPy: flows ? 0 : null, in12: 0, in12Py: stock ? 0 : null };
  });
  let start12 = 0, end12 = 0, start12Py = reach.stock && A - 13 >= 11 ? 0 : null, end12Py = reach.stock ? 0 : null;
  for (const i of idx) {
    const f = facts(i);
    if (f.active || f.activePy || f.newPy || f.wonPy || f.lost || f.lostPy || f.left || f.leftPy) {
      for (const a of g.of(i)) {
        if (f.active) a.active++;
        a.activePy += f.activePy;
        if (f.newC) a.newC++;
        a.newPy += f.newPy;
        if (f.won) a.won++;
        if (a.wonPy != null) a.wonPy += f.wonPy;
        if (f.lost) a.lost++;
        if (a.lostPy != null && f.lostPy) a.lostPy++;
      }
    }
    // month by month: who bought, who came (new, won back), who left - and the customers who bought in the last 12 months
    if (!(p.lo[i] || p.hi[i])) continue;
    if (in12(p, i, A - 1)) start12++;
    if (in12(p, i, E)) end12++;
    if (start12Py != null && in12(p, i, A - 13)) start12Py++;
    if (end12Py != null && in12(p, i, E - 12)) end12Py++;
    for (const m of months) {
      const k = m.month, w = k - 12 === cut ? share : 1;
      if (boughtAt(p, i, k)) m.active++;
      if (boughtAt(p, i, k - 12)) m.activePy += w;
      if (p.first[i] === k) m.newC++;
      if (p.first[i] === k - 12) m.newPy += w;
      if (wonAt(p, i, k)) m.won++;
      if (m.wonPy != null && wonAt(p, i, k - 12)) m.wonPy += w;
      if (leftAt(p, i, k)) m.left++;
      if (m.leftPy != null && leftAt(p, i, k - 12)) m.leftPy += w;
      if (in12(p, i, k)) m.in12++;
      if (m.in12Py != null && in12(p, i, k - 12)) m.in12Py++;
    }
  }
  return { total: g.total, by: g.rows((a) => a, (a) => !!(a.active || a.activePy || a.newC || a.won || a.lost || a.lostPy)), months, start12, end12, start12Py, end12Py };
}
const boughtAt = (p: Prep, i: number, k: number) => (k < 0 || k > 35 ? false : k < 24 ? (p.lo[i] & (1 << k)) !== 0 : (p.hi[i] & (1 << (k - 24))) !== 0);

/* ── b) revenue concentration ──────────────────────────────────────────── */

function concOf(cube: Cube, l: Ledger, p: Prep, per: Per, idx: number[], facts: FactsFn): NonNullable<KpiOut["concentration"]> {
  type Acc = { cy: number[]; py: [number, number][] };
  const g = grouper<Acc>(cube, l, () => ({ cy: [], py: [] }));
  const bands = BANDS.map((label) => ({ label, n: 0, nPy: 0, rev: 0, revPy: 0 }));
  const top: { i: number; rev: number; revPy: number }[] = [];
  for (const i of idx) {
    const f = facts(i);
    if (!f.active && !f.activePy) continue;
    for (const a of g.of(i)) {
      if (f.active) a.cy.push(f.rev);
      if (f.activePy) a.py.push([f.revPy, f.activePy]);
    }
    if (f.active) { const b = bands[bandOf(f.rev)]; b.n++; b.rev += f.rev; top.push({ i, rev: f.rev, revPy: f.revPy }); }
    // a year earlier: its revenue then, pro rata as a whole year's would be banded
    if (f.activePy) { const b = bands[bandOf(f.revPy)]; b.nPy += f.activePy; b.revPy += f.revPy; }
  }
  const done = (a: Acc): ConcFig => {
    const py = a.py.map((x) => x[0]);
    return {
      n: a.cy.length, nPy: a.py.reduce((t, x) => t + x[1], 0), rev: a.cy.reduce((t, v) => t + v, 0), revPy: py.reduce((t, v) => t + v, 0),
      median: median(a.cy.map((v) => [v, 1])), medianPy: median(a.py),
      top10: topRev(a.cy, 10), top10Py: topRev(py, 10), top20: topRev(a.cy, 20), top20Py: topRev(py, 20), pos: posSum(a.cy), posPy: posSum(py),
    };
  };
  top.sort((a, b) => b.rev - a.rev || l.names[a.i].localeCompare(l.names[b.i]));
  return {
    total: done(g.total), by: g.rows(done, (f) => f.n > 0 || f.nPy > 0),
    pareto: { cy: pareto(g.total.cy), py: pareto(g.total.py.map((x) => x[0])) },
    bands, top: top.slice(0, 25).map((t) => ({ id: l.ids[t.i], name: l.names[t.i], rev: Math.round(t.rev), revPy: Math.round(t.revPy) })),
  };
}

/* ── c) cross-selling ──────────────────────────────────────────────────── */

function crossOf(cube: Cube, l: Ledger, p: Prep, per: Per, idx: number[], facts: FactsFn, pyOk: boolean): NonNullable<KpiOut["cross"]> {
  const { start: A, end: E } = per.win;
  const cut = per.run ? per.run.month - 12 : -99, share = per.run ? per.run.share : 1;
  const zero = (): CrossFig => ({ n: 0, one: 0, two: 0, three: 0, rev1: 0, rev2: 0, rev3: 0, single: 0, singleRev: 0, none: 0,
    py: pyOk ? { n: 0, one: 0, two: 0, three: 0, rev1: 0, rev2: 0, rev3: 0, single: 0, singleRev: 0 } : null });
  const g = grouper(cube, l, zero);
  const pairs: { a: string; b: string; n: number; nPy: number | null }[] = [];
  PC_FIVE.forEach((a, x) => PC_FIVE.forEach((b, y) => { if (y > x) pairs.push({ a, b, n: 0, nPy: pyOk ? 0 : null }); }));
  const single = PC_FIVE.map((pc) => ({ pc, n: 0, nPy: pyOk ? 0 : null as number | null, rev: 0 }));
  const pairOf = (set: number, into: "n" | "nPy", w: number) => {
    let k = 0;
    PC_FIVE.forEach((_, x) => PC_FIVE.forEach((_, y) => { if (y > x) { if ((set & (1 << x)) && (set & (1 << y))) pairs[k][into] = (pairs[k][into] ?? 0) + w; k++; } }));
  };
  for (const i of idx) {
    const f = facts(i);
    if (!f.active && !(pyOk && f.activePy)) continue;
    const set = f.active ? pcsIn(p, i, A, E).set : 0, b = breadthOf(set);
    const setPy = pyOk && f.activePy ? pcsIn(p, i, A - 12, E - 12, cut, share).set : 0, bPy = breadthOf(setPy);
    const target = f.active && b === 1 && f.rev >= per.min, targetPy = pyOk && f.activePy > 0 && bPy === 1 && f.revPy >= per.min;
    for (const a of g.of(i)) {
      if (f.active) {
        if (!b) a.none++;
        else { a.n++; if (b === 1) { a.one++; a.rev1 += f.rev; } else if (b === 2) { a.two++; a.rev2 += f.rev; } else { a.three++; a.rev3 += f.rev; } }
        if (target) { a.single++; a.singleRev += f.rev; }
      }
      if (a.py && f.activePy && bPy) {
        const w = f.activePy;
        a.py.n += w;
        if (bPy === 1) { a.py.one += w; a.py.rev1 += f.revPy; } else if (bPy === 2) { a.py.two += w; a.py.rev2 += f.revPy; } else { a.py.three += w; a.py.rev3 += f.revPy; }
        if (targetPy) { a.py.single += w; a.py.singleRev += f.revPy; }
      }
    }
    if (f.active && b >= 2) pairOf(set, "n", 1);
    if (pyOk && f.activePy && bPy >= 2) pairOf(setPy, "nPy", f.activePy);
    if (target) { const s = single[PC_FIVE.findIndex((_, k) => set & (1 << k))]; s.n++; s.rev += f.rev; }
    if (targetPy) { const s = single[PC_FIVE.findIndex((_, k) => setPy & (1 << k))]; s.nPy = (s.nPy ?? 0) + f.activePy; }
  }
  return { total: g.total, by: g.rows((a) => a, (a) => a.n > 0 || a.none > 0 || (a.py?.n ?? 0) > 0), pairs, single };
}

/* ── d) recency and risk ───────────────────────────────────────────────── */

function recOf(cube: Cube, l: Ledger, idx: number[], facts: FactsFn, reach: { flows: boolean; stock: boolean }): NonNullable<KpiOut["recency"]> {
  const zero = (): RecFig => ({ rec: [0, 0, 0, 0], recPy: reach.stock ? [0, 0, 0, 0] : null, risk: 0, riskPy: reach.stock ? 0 : null, riskRev: 0, riskRevPy: reach.stock ? 0 : null,
    down: 0, downPy: reach.flows ? 0 : null, downRev: 0, downRevPy: reach.flows ? 0 : null, downDrop: 0, downDropPy: reach.flows ? 0 : null, recRev: [0, 0, 0, 0] });
  const g = grouper(cube, l, zero);
  for (const i of idx) {
    const f = facts(i);
    if (f.recency == null && f.recencyPy == null) continue;
    for (const a of g.of(i)) {
      if (f.recency != null) { a.rec[f.recency]++; a.recRev[f.recency] += f.rev12; }
      if (a.recPy && f.recencyPy != null) a.recPy[f.recencyPy]++;
      if (f.risk) { a.risk++; a.riskRev += f.rev12; }
      if (a.riskPy != null && f.riskPy) { a.riskPy++; a.riskRevPy! += f.rev12Py; }
      if (f.down) { a.down++; a.downRev += f.rev; a.downDrop += f.revPy - f.rev; }
      if (a.downPy != null && f.downPy) { a.downPy += f.downPy; a.downRevPy! += f.revPy; a.downDropPy! += f.revPy2 - f.revPy; }
    }
  }
  return { total: g.total, by: g.rows((a) => a, (a) => a.rec.some((x) => x > 0) || !!a.recPy?.some((x) => x > 0)) };
}

/* ── e) retention ──────────────────────────────────────────────────────── */

function retOf(cube: Cube, l: Ledger, p: Prep, per: Per, idx: number[], facts: FactsFn, pyOk: boolean): NonNullable<KpiOut["retention"]> {
  const { start: A, end: E } = per.win;
  const cut = per.run ? per.run.month - 12 : -99, share = per.run ? per.run.share : 1;
  const zero = (): RetFig => ({ base: 0, kept: 0, then: 0, now: 0, gross: 0, grew: 0, grewThen: 0, grewNow: 0, shrank: 0, shrankThen: 0, shrankNow: 0, gone: 0, goneThen: 0,
    py: pyOk ? { base: 0, kept: 0, then: 0, now: 0, gross: 0 } : null });
  const g = grouper(cube, l, zero);
  const cohorts = new Map<number, RetFig>();
  for (const i of idx) {
    const f = facts(i);
    // the year before: who bought in the same months two years ago, and whether they bought a year ago
    const inPy2 = pyOk && boughtInWin(p, i, A - 24, E - 24);
    if (!inBase(f) && !inPy2) continue;
    const c = cohortOf(p, i, per.firstYear);
    let co = cohorts.get(c);
    if (!co) { co = zero(); cohorts.set(c, co); }
    const then2 = inPy2 ? revIn(p, i, A - 24, E - 24, cut - 12, share) : 0;
    for (const a of [...g.of(i), co]) {
      if (inBase(f)) {
        a.base++; a.then += f.revPy; a.now += f.rev;
        a.gross += Math.min(Math.max(f.rev, 0), f.revPy);
        if (f.active) { a.kept++; if (f.rev >= f.revPy) { a.grew++; a.grewThen += f.revPy; a.grewNow += f.rev; } else { a.shrank++; a.shrankThen += f.revPy; a.shrankNow += f.rev; } }
        else { a.gone++; a.goneThen += f.revPy; }
      }
      if (a.py && inPy2) {
        a.py.base++; a.py.then += then2; a.py.now += f.revPy;
        a.py.gross += Math.min(Math.max(f.revPy, 0), then2);
        if (f.activePy > 0) a.py.kept++;
      }
    }
  }
  return {
    total: g.total, by: g.rows((a) => a, (a) => a.base > 0 || (a.py?.base ?? 0) > 0),
    cohorts: [...cohorts.entries()].sort((a, b) => a[0] - b[0]).map(([cohort, a]) => ({ label: cohort ? String(cohort) : `Before ${per.firstYear}`, cohort, ...a })),
  };
}
const boughtInWin = (p: Prep, i: number, a: number, z: number) => { for (let k = Math.max(0, a); k <= Math.min(35, z); k++) if (boughtAt(p, i, k)) return true; return false; };

/** Ratios, null without a base. */
export const rate = (a: number, b: number) => (b > 0 ? a / b : null);
export const nrr = (r: { then: number; now: number }) => rate(r.now, r.then);
export const grr = (r: { then: number; gross: number }) => rate(r.gross, r.then);
export const keptRate = (r: { base: number; kept: number }) => rate(r.kept, r.base);
export { BANDS, PC_FIVE };
