// THE CUSTOMER REPORTS' RULES, ONE COMPANY AT A TIME (SARCLA 01.11.2026 on Customer Reports: "based on what we know, think
// about what kind of dynamic KPI would be interesting here"). Pure - the cube's companies as the ledger keeps them (ledger.ts),
// server side only. The figures (customerKpis.ts) and the lists of companies behind them (ledger.ts companiesOf) both ask
// these rules, so a list adds up to its figure.
//
// Months are the cube's: January of the year before last = 0 … December this year = 35. A company "bought" in a month when
// its revenue that month is above zero - the cube's buyers. The words are the ones agreed on the ESO reports:
//   new        its first invoice ever falls in the period - the BSC report's count (customers.ts firstInvoiceOf)
//   won back   bought in a month after 12 months or more without an order, having ordered before - the ESO Customer
//              development's "reactivated", month by month (one month's period is exactly that rule)
//   lost       no order for 12 months or more at the period's end, however long ago the last one (SARCLA 29.10.2026: "customer
//              should be after 12 months not in between - actualize in all KPI") - so every company that ever ordered counts,
//              its first order ever from HubSpot where the three years read do not reach
// The month in progress counts as far as it has gone; last year's same month counts pro rata (12 days of October against
// 12/31 of last October), as everywhere on the cube.

import { partial, type Cube, type Win } from "./cube";

/** The five profit centres a customer can buy from - "other" (pw, ws, unknown …) is not one of them. */
export const PC_FIVE = ["dt", "ft", "kt", "at", "st"] as const;
export type PcCode = (typeof PC_FIVE)[number];

/** What a company's figures are read from: the ledger, unpacked once per read. */
export type Prep = {
  n: number;
  /** the months bought in, as the cube's buyers: bits 0-23 and 24-35 */
  lo: Int32Array; hi: Int32Array;
  /** revenue by month, the companies with any */
  rev: Map<number, Float64Array>;
  /** revenue by month of each of the five profit centres (this year and last - months 12 to 35) */
  pc: Map<number, Float64Array[]>;
  /** the month of the first invoice - a new customer of the three years; -1 otherwise */
  first: Int16Array;
  /** the first and last order ever, yyyymmdd (0 not known) */
  orders: Map<number, [number, number]>;
};
/** What the ledger hands the rules (ledger.ts Ledger's rows). */
export type PrepIn = { ids: string[]; bought: number[][]; rev: number[][]; firsts: number[][]; pcLabels: string[]; pc: number[][]; orders?: number[][] };

const prepped = new WeakMap<object, Prep>();
/** The ledger unpacked - once per ledger object. */
export function prepOf(l: PrepIn): Prep {
  const hit = prepped.get(l);
  if (hit) return hit;
  const n = l.ids.length;
  const p: Prep = { n, lo: new Int32Array(n), hi: new Int32Array(n), rev: new Map(), pc: new Map(), first: new Int16Array(n).fill(-1), orders: new Map() };
  for (const b of l.bought) { p.lo[b[0]] = b[1]; p.hi[b[0]] = b[2]; }
  for (const r of l.rev) {
    let a = p.rev.get(r[0]);
    if (!a) { a = new Float64Array(36); p.rev.set(r[0], a); }
    const base = (2 - r[1]) * 12;
    for (let m = 0; m < 12; m++) a[base + m] += r[2 + m];
  }
  const five = l.pcLabels.map((x) => PC_FIVE.indexOf(x as PcCode));
  for (const r of l.pc) {
    const k = five[r[2]];
    if (k < 0 || r[1] > 1) continue;
    let a = p.pc.get(r[0]);
    if (!a) { a = PC_FIVE.map(() => new Float64Array(36)); p.pc.set(r[0], a); }
    const base = (2 - r[1]) * 12;
    for (let m = 0; m < 12; m++) a[k][base + m] += r[3 + m];
  }
  for (const f of l.firsts) p.first[f[0]] = f[1];
  for (const o of l.orders ?? []) p.orders.set(o[0], [o[1], o[2]]);
  prepped.set(l, p);
  return p;
}

/* ── the period ────────────────────────────────────────────────────────── */

/** A period and how it is compared: the window, the running month and the share of it gone, the amount "at least". */
export type Period = {
  win: Win;
  /** the month in progress and the share of it gone - last year's same month counts that share */
  run: { month: number; share: number } | null;
  /** the first year read (month 0's year) */
  firstYear: number;
  /** at risk and decreasing: at least this much (euros) */
  min: number;
};
export function periodOf(cube: Cube, win: Win, min = 0): Period {
  const r = partial(cube);
  return { win, run: r ? { month: r.month, share: r.day / r.days } : null, firstYear: cube.years[2], min: Math.max(0, min) };
}
/** Which year-earlier figures the three years read can give: each rule looks back 12 months from its months, the profit
 *  centres are kept for this year and last only. */
export function pyReach(p: Period) {
  const { start: A, end: E } = p.win;
  return {
    /** won back, became lost, decreasing, retention, profit centres: their year-earlier months look back 12 more */
    flows: A >= 24,
    /** lost, recency and at risk at the period's end a year earlier */
    stock: E >= 23,
  };
}

/* ── one company ───────────────────────────────────────────────────────── */

const bit = (p: Prep, i: number, k: number) => (k < 0 || k > 35 ? false : k < 24 ? (p.lo[i] & (1 << k)) !== 0 : (p.hi[i] & (1 << (k - 24))) !== 0);
/** The bits a to z (both from 0 to 23). */
const span = (a: number, z: number) => (z < a ? 0 : ((1 << (z + 1)) - 1) ^ ((1 << a) - 1));
/** Bought in any month from a to z (inside the three years). */
export function boughtIn(p: Prep, i: number, a: number, z: number): boolean {
  a = Math.max(0, a); z = Math.min(35, z);
  if (z < a) return false;
  if (a <= 23 && (p.lo[i] & span(a, Math.min(z, 23))) !== 0) return true;
  return z >= 24 && (p.hi[i] & span(Math.max(a, 24) - 24, z - 24)) !== 0;
}
/** The last month up to k it bought in; -1 none in the three years. */
export function lastBought(p: Prep, i: number, k: number): number {
  for (let j = Math.min(35, k); j >= 0; j--) if (bit(p, i, j)) return j;
  return -1;
}
/** Its revenue from month a to z - the month `cut` counted `share` of. */
export function revIn(p: Prep, i: number, a: number, z: number, cut = -99, share = 1): number {
  return sumOf(p.rev.get(i), a, z, cut, share);
}
/** A company's months from a to z added up - the month `cut` counted `share` of. */
function sumOf(r: Float64Array | undefined, a: number, z: number, cut = -99, share = 1): number {
  if (!r) return 0;
  let s = 0;
  for (let k = Math.max(0, a); k <= Math.min(35, z); k++) s += k === cut ? r[k] * share : r[k];
  return s;
}
/** A day yyyymmdd as a month number (negative before the three years); null without one. */
export const monthOfDay = (d: number, firstYear: number) => (d > 0 ? (Math.floor(d / 10000) - firstYear) * 12 + (Math.floor(d / 100) % 100) - 1 : null);
/**
 * Ordered before month x: a purchase before it, or a customer from before the three years (revenue in them, no first invoice
 * in them - customers.ts gives one only to the new), or a first order ever before it (HubSpot's, the ERP's for its own).
 */
export function orderedBefore(p: Prep, i: number, x: number, firstYear: number): boolean {
  if (boughtIn(p, i, 0, x - 1)) return true;
  if (p.first[i] < 0 && (p.lo[i] || p.hi[i] || p.rev.has(i))) return true;
  const o = p.orders.get(i);
  const f = o ? monthOfDay(o[0] || o[1], firstYear) : null;
  // a new customer's first order before the three years is the ERP's carried-over date (2014), not a purchase: the BSC
  // report counts it new (customers.ts), so it was no customer before its first invoice
  return f != null && f < x && (p.first[i] < 0 || f >= 0);
}
/** Lost at month e: ordered before the 12 months to e, nothing in them - however long ago. */
export const lostAt = (p: Prep, i: number, e: number, firstYear: number) => !boughtIn(p, i, e - 11, e) && orderedBefore(p, i, e - 11, firstYear);
/** Won back in month k: bought in it after 12 months without, not its first invoice - so it had ordered before. */
export const wonAt = (p: Prep, i: number, k: number) => bit(p, i, k) && !boughtIn(p, i, k - 12, k - 1) && p.first[i] !== k;
/** Left in month k: 12 months since its last purchase - out of the customers who bought in the last 12 months. */
export const leftAt = (p: Prep, i: number, k: number) => bit(p, i, k - 12) && !boughtIn(p, i, k - 11, k);
/** In the customers who bought in the 12 months to k. */
export const in12 = (p: Prep, i: number, k: number) => boughtIn(p, i, k - 11, k);

/** Months since the last purchase at month e: 0 (0-3), 1 (3-6), 2 (6-12), 3 (12 or more - lost); null when it had not bought by then. */
export function recencyAt(p: Prep, i: number, e: number, firstYear: number): 0 | 1 | 2 | 3 | null {
  const last = lastBought(p, i, e);
  if (last >= 0 && e - last < 12) return e - last < 3 ? 0 : e - last < 6 ? 1 : 2;
  return lostAt(p, i, e, firstYear) ? 3 : null;
}
export const RECENCY = ["0–3 months", "3–6 months", "6–12 months", "12 months or more"] as const;

/** The profit centres (of the five) bought from from month a to z: a bit each, PC_FIVE's order. */
export function pcsIn(p: Prep, i: number, a: number, z: number, cut = -99, share = 1): { set: number; rev: number[] } {
  const pcs = p.pc.get(i);
  const rev = [0, 0, 0, 0, 0];
  let set = 0;
  if (!pcs) return { set, rev };
  pcs.forEach((m, k) => {
    let s = 0;
    for (let j = Math.max(0, a); j <= Math.min(35, z); j++) s += m[j] * (j === cut ? share : 1);
    rev[k] = s;
    if (s > 0) set |= 1 << k;
  });
  return { set, rev };
}
export const countBits = (x: number) => { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; };

/**
 * A company in a period - everything the five Customer Reports pages count. `*Py` is the same months a year earlier: a weight
 * from 0 to 1 (last year's month matching the one in progress counts its share), null where the three years do not reach.
 */
export type Facts = {
  /** bought in the period; a year earlier (1, or the share when only in last year's running month) */
  active: boolean; activePy: number;
  /** revenue in the period, and in the same months a year earlier (its running month pro rata) */
  rev: number; revPy: number;
  newC: boolean; newPy: number;
  won: boolean; wonPy: number;
  /** months of the period it was won back in, and left (12 months since its last purchase) - the month by month flow */
  wonMonths: number[]; leftMonths: number[];
  left: boolean; leftPy: number;
  lost: boolean; lostPy: boolean;
  recency: 0 | 1 | 2 | 3 | null; recencyPy: 0 | 1 | 2 | 3 | null;
  /** revenue in the 12 months to the period's end (a year earlier: to that end) */
  rev12: number; rev12Py: number;
  /** last order 6 to 12 months before the period's end, at least `min` bought in the 12 months to it */
  risk: boolean; riskPy: boolean;
  /** bought in the period, at least `min` in the same months a year earlier and 30% or more less now */
  down: boolean; downPy: number;
  /** the period's revenue a year before last year's (the year earlier's own comparison) */
  revPy2: number;
};

/** The share "decreasing" asks: 30% or more less. */
export const DOWN = 0.7;

/** A year earlier's weight of a set of months it bought in: 1, or the share when the running month's match is the only one. */
function pyWeight(p: Prep, i: number, a: number, z: number, cut: number, share: number): number {
  let any = false, cutOnly = true;
  for (let k = Math.max(0, a); k <= Math.min(35, z); k++) if (bit(p, i, k)) { any = true; if (k !== cut) { cutOnly = false; break; } }
  return !any ? 0 : cutOnly ? share : 1;
}

/** A company that never bought nor ordered: in no figure. */
const NOTHING: Facts = Object.freeze({
  active: false, activePy: 0, rev: 0, revPy: 0, newC: false, newPy: 0, won: false, wonPy: 0, wonMonths: [], leftMonths: [], left: false, leftPy: 0,
  lost: false, lostPy: false, recency: null, recencyPy: null, rev12: 0, rev12Py: 0, risk: false, riskPy: false, down: false, downPy: 0, revPy2: 0,
}) as Facts;
/** Whether a company has anything a figure could count: a purchase, revenue, an order. */
export const anything = (p: Prep, i: number) => !!(p.lo[i] || p.hi[i] || p.rev.has(i) || p.orders.has(i));

/** One company in a period (Facts). */
export function factsOf(p: Prep, i: number, per: Period): Facts {
  if (!anything(p, i)) return NOTHING;
  const { start: A, end: E } = per.win, Ap = A - 12, Ep = E - 12;
  const cut = per.run ? per.run.month - 12 : -99, share = per.run ? per.run.share : 1;
  const cut2 = cut - 12, fy = per.firstYear, reach = pyReach(per);
  const active = boughtIn(p, i, A, E);
  const activePy = pyWeight(p, i, Ap, Ep, cut, share);
  const r = p.rev.get(i);
  const rev = sumOf(r, A, E), revPy = sumOf(r, Ap, Ep, cut, share);
  const f = p.first[i];
  const newC = f >= A && f <= E, newPy = f >= Ap && f <= Ep ? (f === cut ? share : 1) : 0;
  const wonMonths: number[] = [], leftMonths: number[] = [];
  const any = p.lo[i] !== 0 || p.hi[i] !== 0;
  if (any) for (let k = A; k <= E; k++) { if (wonAt(p, i, k)) wonMonths.push(k); if (leftAt(p, i, k)) leftMonths.push(k); }
  // a year earlier: the events of those months, the running month's match its share
  let wonPy = 0, leftPy = 0;
  if (reach.flows && any) {
    for (let k = Ap; k <= Ep; k++) {
      const w = k === cut ? share : 1;
      if (wonAt(p, i, k)) wonPy = Math.max(wonPy, w);
      // reached at a month's end: no pro rata
      if (leftAt(p, i, k)) leftPy = 1;
    }
  }
  const recency = recencyAt(p, i, E, fy), recencyPy = reach.stock ? recencyAt(p, i, Ep, fy) : null;
  const rev12 = sumOf(r, E - 11, E), rev12Py = sumOf(r, Ep - 11, Ep);
  const min = per.min;
  const risk = recency === 2 && rev12 > 0 && rev12 >= min;
  const riskPy = reach.stock && recencyPy === 2 && rev12Py > 0 && rev12Py >= min;
  const down = active && revPy > 0 && revPy >= min && rev <= DOWN * revPy;
  const revPy2 = reach.flows ? sumOf(r, Ap - 12, Ep - 12, cut2, share) : 0;
  const downPy = reach.flows && activePy > 0 && revPy2 > 0 && revPy2 >= min && revPy <= DOWN * revPy2 ? activePy : 0;
  return {
    active, activePy, rev, revPy, newC, newPy, won: wonMonths.length > 0, wonPy, wonMonths, leftMonths, left: leftMonths.length > 0, leftPy,
    lost: lostAt(p, i, E, fy), lostPy: reach.stock && lostAt(p, i, Ep, fy),
    recency, recencyPy, rev12, rev12Py, risk, riskPy, down, downPy, revPy2,
  };
}

/** The year of a company's first invoice (a new customer of the three years), or 0 for a customer from before them. */
export const cohortOf = (p: Prep, i: number, firstYear: number) => (p.first[i] >= 0 ? firstYear + Math.floor(p.first[i] / 12) : 0);

/** Revenue bands of the period - the sales priority's thresholds (Smart Segmentation), as the potential bands. */
export const BANDS = ["€100,000 and more", "€25,000 – 99,999", "€2,500 – 24,999", "€500 – 2,499", "Under €500"] as const;
export const bandOf = (rev: number) => (rev >= 100_000 ? 0 : rev >= 25_000 ? 1 : rev >= 2_500 ? 2 : rev >= 500 ? 3 : 4);

/** The amounts "at least" a page offers (at risk, decreasing, cross-sell targets): the sales priority's thresholds. */
export const MINS = [0, 500, 2_500, 25_000] as const;
export const DEFAULT_MIN = 2_500;

/* ── the lists behind the figures (ledger.ts companiesOf) ──────────────── */

/**
 * The Customer Reports' lists: won (won back), lost, left (12 months since the last purchase, in a month of the period), moved
 * (new, won back or left), custlost (bought in the period or lost), rec:0-3 (months since the last order), recall (all four),
 * risk, down (decreasing), band:0-4, top:10|20 (the top share of the customers by revenue), first:<n> (the n largest),
 * pcs:1-3 (one, two, three or more profit centres), pcsany, pcsmany (two or more), pair:<pc>-<pc>, single (one profit centre,
 * at least the amount asked; single:<pc> that one), base (bought in the same months a year earlier), kept, gone, grew, shrank.
 */
export const CUSTOMER_BY = /^(won|lost|left|moved|custlost|rec:[0-3]|recall|risk|down|band:[0-4]|top:(?:10|20)|first:\d{1,3}|pcs:[1-3]|pcsany|pcsmany|pair:(?:dt|ft|kt|at|st)-(?:dt|ft|kt|at|st)|single(?::(?:dt|ft|kt|at|st))?|base|kept|gone|grew|shrank)$/;
export const isCustomerBy = (by: string) => CUSTOMER_BY.test(by);
/** The breadth group of a customer: 1, 2 or 3 (three or more) profit centres; 0 none of the five. */
export const breadthOf = (set: number) => Math.min(3, countBits(set));
/** The bit of a profit centre (PC_FIVE's order). */
export const pcBit = (pc: string) => 1 << PC_FIVE.indexOf(pc as PcCode);
/** Base of the retention: bought in the same months a year earlier. */
export const inBase = (f: Facts) => f.activePy > 0;

/** Is a company on the list `by` (all but top:/first:, which rank the customers of the period)? */
export function onList(by: string, f: Facts, set: number, min: number): boolean {
  const pcs = breadthOf(set);
  switch (by) {
    case "won": return f.won;
    case "lost": return f.lost;
    case "left": return f.left;
    case "moved": return f.newC || f.won || f.left;
    case "custlost": return f.active || f.lost;
    case "recall": return f.recency != null;
    case "risk": return f.risk;
    case "down": return f.down;
    case "pcsany": return f.active && pcs >= 1;
    case "pcsmany": return f.active && pcs >= 2;
    case "single": return f.active && pcs === 1 && f.rev >= min;
    case "base": return inBase(f);
    case "kept": return inBase(f) && f.active;
    case "gone": return inBase(f) && !f.active;
    case "grew": return inBase(f) && f.active && f.rev >= f.revPy;
    case "shrank": return inBase(f) && f.active && f.rev < f.revPy;
  }
  const [kind, arg = ""] = by.split(":");
  if (kind === "rec") return f.recency === Number(arg);
  if (kind === "band") return f.active && bandOf(f.rev) === Number(arg);
  if (kind === "pcs") return f.active && pcs === Number(arg);
  if (kind === "pair") { const [a, b] = arg.split("-"); return f.active && (set & pcBit(a)) !== 0 && (set & pcBit(b)) !== 0; }
  if (kind === "single") return f.active && pcs === 1 && (set & pcBit(arg)) !== 0 && f.rev >= min;
  return false;
}
/** How many customers the top share is: at least one when there is any. */
export const topCount = (n: number, pct: number) => (n > 0 ? Math.max(1, Math.round((n * pct) / 100)) : 0);
