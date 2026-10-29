// THE ESO CUSTOMER DEVELOPMENT PAGE'S RULES (SARCLA 29.10.2026: "work on ESO Reports -> customer development" - his picks:
// rebuilt like Visits, the customers by their Performis SAE as the Figures, the orders from HubSpot, lost = no order for
// 12 to 24 months as Retain & grow's "stopped"). Every customer as one small row with its revenue and orders by month, so
// the page works out any period, team, person or filter itself. No HubSpot or database here, so the page and the tests
// read it as it is.
//
// What the CrystalESO deck asks (slide "Customer Dev."): existing customers - quantity, Ø revenue per customer, Ø number
// of orders - active, new, reactivated, slow, lost, the churning rate and the potential of the lost; this year and to
// last year.

export type CustDevData = {
  generatedAt: string;
  /** this year; months are numbered from January three years before (0) to December this year (47) */
  year: number;
  /** the day the read reaches, "2026-10-29" */
  today: string;
  /** this year's months with their revenue in - complete months, the customers' cube's rule (60% of last year's companies) */
  loaded: number;
  /** the month in progress, as far as the last ERP delivery reaches: its number (36 + month), that day, the month's days */
  running: { month: number; day: number; days: number } | null;
  /** the day of the ERP delivery the read stands on - a newer one makes the read stale */
  dataDay: string | null;
  /** the first month the orders are read from: January last year (24) */
  ordersFrom: number;
  /** the Performis SAE as its person (Map assignment's mapping), by index - and the team: "ESO", "TSA", "Other" */
  people: { name: string; team: string }[];
  labels: { prio: string[]; category: string[]; type: string[]; country: string[]; band: string[] };
  /** one row per customer - see C */
  companies: number[][];
  /** each customer's revenue by month: [month, revenue, month, revenue…], only the months with any */
  revenue: number[][];
  /** each customer's orders by month from ordersFrom: [month, orders, …] - as its "total orders" counts them */
  orders: number[][];
  names: string[];
  ids: string[];
  coverage: { companies: number; orders: number; ordersLinked: number };
};
/** The columns of a customer row: its SAE person, priority, customer category, customer type, country and potential band
 *  (label indexes), its yearly potential (0: none or a placeholder over €1m), and the month of its first order ever -
 *  FIRST_BEFORE when it is older than the months read, FIRST_NONE when none is known. */
export const C = { person: 0, prio: 1, category: 2, type: 3, country: 4, band: 5, potential: 6, first: 7 } as const;
export const FIRST_BEFORE = -1;
export const FIRST_NONE = -2;
/** This year's January in the month numbers. */
export const CY0 = 36;

/** A potential the page can use: above zero and up to €1m - higher ones are placeholders (as the customers' cube). */
export const usable = (v: number) => v > 0 && v <= 1_000_000;
export const POTENTIAL_BANDS = ["€100,000 and more", "€25,000 – 99,999", "€2,500 – 24,999", "€500 – 2,499", "Under €500", "Not set"] as const;
export function bandOf(v: number): string {
  if (!usable(v)) return "Not set";
  return v >= 100_000 ? POTENTIAL_BANDS[0] : v >= 25_000 ? POTENTIAL_BANDS[1] : v >= 2_500 ? POTENTIAL_BANDS[2] : v >= 500 ? POTENTIAL_BANDS[3] : POTENTIAL_BANDS[4];
}
/** The month number of a day "2025-03-14" (January three years before this one = 0); null outside the four years. */
export function monthNo(day: string | null | undefined, year: number): number | null {
  const m = /^(\d{4})-(\d{2})/.exec(day ?? "");
  if (!m) return null;
  const k = (Number(m[1]) - (year - 3)) * 12 + Number(m[2]) - 1;
  return k >= 0 && k <= 47 ? k : null;
}
/** An order's base number - "A123.001.002" and "A123.001.003" are one order (the hub's company facts count them so). */
export const orderBase = (num: string) => ((num.match(/\./g) ?? []).length >= 2 ? num.slice(0, num.lastIndexOf(".")) : num);

/** A period: this year's months, 0 = January. */
export type CWin = { from: number; to: number };
export type CDim = "person" | "prio" | "category" | "type" | "country" | "band";
export type CFilters = Partial<Record<CDim, string[]>>;

const COL: Record<CDim, number> = { person: C.person, prio: C.prio, category: C.category, type: C.type, country: C.country, band: C.band };
/** A customer's value on a breakdown, as its label. */
export function labelOf(d: CustDevData, row: number[], dim: CDim): string {
  if (dim === "person") return d.people[row[C.person]]?.name ?? "No SAE";
  return d.labels[dim][row[COL[dim]]] ?? "Not set";
}

/** The customers under the filters and of the people shown (indexes) - a breakdown's own filter left out when grouping by it. */
export function rowsOf(d: CustDevData, f: CFilters, people: Set<number> | null, except?: CDim): number[] {
  const sets = (Object.keys(f) as CDim[]).filter((k) => k !== except && f[k]?.length).map((k) => [k, new Set(f[k])] as const);
  const out: number[] = [];
  d.companies.forEach((r, i) => {
    if (people && !people.has(r[C.person])) return;
    if (sets.every(([k, s]) => s.has(labelOf(d, r, k)))) out.push(i);
  });
  return out;
}

/** One status: customers this year and the same months a year earlier, their revenue and their orders in those months. */
export type Fig = { cy: number; py: number; rev: number; revPy: number; ord: number; ordPy: number };
export type CStats = {
  /** bought in the period (revenue in it) */
  active: Fig;
  /** first order ever in the period - as the New customers page counts them */
  new: Fig;
  /** bought in the period, nothing in the 12 months before it, ordered before that */
  react: Fig;
  /** bought in the period and in the same months a year earlier, less than half as much */
  slow: Fig;
  /** no order for 12 to 24 months at the period's end: bought in the 12 months before the last 12, nothing since - their
   *  revenue in that year as rev, their yearly potential as pot (orders are not read that far back) */
  lost: Fig & { pot: number; potPy: number };
  /** who bought in the 12 months before the last 12 - the churn rate's base */
  base: { cy: number; py: number };
  /** customers who bought, month by month of the period - this year, the same month a year earlier */
  months: { cy: number[]; py: number[] };
};
const fig = (): Fig => ({ cy: 0, py: 0, rev: 0, revPy: 0, ord: 0, ordPy: 0 });
export const blank = (n: number): CStats => ({
  active: fig(), new: fig(), react: fig(), slow: fig(), lost: { ...fig(), pot: 0, potPy: 0 }, base: { cy: 0, py: 0 },
  months: { cy: Array(n).fill(0), py: Array(n).fill(0) },
});
export const STATUSES = ["active", "new", "react", "slow", "lost"] as const;
export type Status = (typeof STATUSES)[number];

/** What a customer was in a period - the rules the tests hold; py* weighs last year's month in progress pro rata. */
export type CustomerIn = {
  activeCy: boolean; newCy: boolean; reactCy: boolean; slowCy: boolean; lostCy: boolean; baseCy: boolean;
  /** last year: 0 (no), 1 (yes), or the day share when only last year's same month as the one in progress counts */
  activePy: number; newPy: number; reactPy: number; slowPy: number; lostPy: boolean; basePy: boolean;
  revCy: number; revPy: number; ordCy: number; ordPy: number;
  /** the revenue of the 12 months before the last 12 - what a lost customer bought in its last year */
  lostRevCy: number; lostRevPy: number;
  /** the months of the period it bought in (from its first), this year and last - last year's month matching the one in
   *  progress apart, as pyRunBought (it counts as the share of the month gone) */
  monthsCy: number[]; monthsPy: number[]; pyRunBought: boolean;
};

/**
 * One customer in a period. The month in progress counts as far as it has gone; last year's same month counts pro rata
 * (12 days of October against 12/31 of last October), as on the customers' cube: its revenue and orders scaled, and a
 * customer who bought last year ONLY in that month counts as that share of a customer.
 */
export function customerIn(d: CustDevData, i: number, win: CWin): CustomerIn {
  const row = d.companies[i], rev = d.revenue[i] ?? [], ord = d.orders[i] ?? [];
  const A = CY0 + win.from, E = CY0 + win.to, Ap = A - 12, Ep = E - 12;
  const run = d.running && d.running.month >= A && d.running.month <= E ? d.running : null;
  const share = run ? run.day / run.days : 1;
  const pyRun = run ? run.month - 12 : -99, py2Run = run ? run.month - 24 : -99;
  const first = row[C.first];
  let revCy = 0, revPy = 0, revPy2 = 0, ordCy = 0, ordPy = 0, lostRevCy = 0, lostRevPy = 0;
  let anyCy = false, pyMonths = 0, pyOnlyRun = true, pyRunBought = false, before = false, beforePy = false, earliest = 99;
  let lastYr = false, since = false, lastYrPy = false, sincePy = false;
  const monthsCy: number[] = [], monthsPy: number[] = [];
  for (let j = 0; j + 1 < rev.length; j += 2) {
    const k = rev[j], v = rev[j + 1], bought = v > 0;
    if (bought && k < earliest) earliest = k;
    if (k >= A && k <= E) { revCy += v; if (bought) { anyCy = true; monthsCy.push(k - A); } }
    if (k >= Ap && k <= Ep) {
      revPy += v * (k === pyRun ? share : 1);
      if (bought) { pyMonths++; if (k === pyRun) pyRunBought = true; else { pyOnlyRun = false; monthsPy.push(k - Ap); } }
    }
    if (k >= Ap - 12 && k <= Ep - 12) revPy2 += v * (k === py2Run ? share : 1);
    if (bought && k >= A - 12 && k <= A - 1) before = true;
    if (bought && k >= Ap - 12 && k <= Ap - 1) beforePy = true;
    // lost: the 12 months before the last 12 at the period's end, and the last 12
    if (k >= E - 23 && k <= E - 12) { lostRevCy += v; if (bought) lastYr = true; }
    if (bought && k >= E - 11 && k <= E) since = true;
    if (k >= Ep - 23 && k <= Ep - 12) { lostRevPy += v; if (bought) lastYrPy = true; }
    if (bought && k >= Ep - 11 && k <= Ep) sincePy = true;
  }
  for (let j = 0; j + 1 < ord.length; j += 2) {
    const k = ord[j], n = ord[j + 1];
    if (k >= A && k <= E) ordCy += n;
    if (k >= Ap && k <= Ep) ordPy += n * (k === pyRun ? share : 1);
  }
  const wPy = pyMonths === 0 ? 0 : pyOnlyRun ? share : 1;
  // ordered before a month: a first order older than it, or revenue before it
  const orderedBefore = (x: number) => first === FIRST_BEFORE || (first >= 0 && first < x) || earliest < x;
  const newCy = first >= A && first <= E;
  const newPyIn = first >= Ap && first <= Ep;
  const newPy = newPyIn ? (first === pyRun ? share : 1) : 0;
  return {
    activeCy: anyCy, newCy,
    reactCy: anyCy && !newCy && !before && orderedBefore(A - 12),
    slowCy: anyCy && revPy > 0 && revCy < 0.5 * revPy,
    lostCy: lastYr && !since, baseCy: lastYr,
    activePy: wPy, newPy,
    reactPy: wPy && !newPyIn && !beforePy && orderedBefore(Ap - 12) ? wPy : 0,
    slowPy: wPy && revPy2 > 0 && revPy < 0.5 * revPy2 ? wPy : 0,
    lostPy: lastYrPy && !sincePy, basePy: lastYrPy,
    revCy, revPy, ordCy, ordPy, lostRevCy, lostRevPy,
    monthsCy, monthsPy, pyRunBought,
  };
}

const addTo = (f: Fig, s: CustomerIn, cy: boolean, py: number) => {
  if (cy) { f.cy++; f.rev += s.revCy; f.ord += s.ordCy; }
  if (py) { f.py += py; f.revPy += s.revPy; f.ordPy += s.ordPy; }
};
/** The figures of a set of customers in a period, grouped by a label (all together under ""). */
export function statsBy(d: CustDevData, idx: number[], win: CWin, key: (row: number[]) => string = () => ""): Map<string, CStats> {
  const out = new Map<string, CStats>();
  const n = win.to - win.from + 1;
  // last year's month matching the one in progress: its buyers as a share, as the customers' cube counts them
  const run = d.running && d.running.month >= CY0 + win.from && d.running.month <= CY0 + win.to ? d.running : null;
  const runAt = run ? run.month - CY0 - win.from : -1, share = run ? run.day / run.days : 1;
  for (const i of idx) {
    const row = d.companies[i];
    const s = customerIn(d, i, win);
    if (!s.activeCy && !s.activePy && !s.newCy && !s.newPy && !s.baseCy && !s.basePy) continue;
    const k = key(row);
    let t = out.get(k);
    if (!t) { t = blank(n); out.set(k, t); }
    addTo(t.active, s, s.activeCy, s.activePy);
    addTo(t.new, s, s.newCy, s.newPy);
    addTo(t.react, s, s.reactCy, s.reactPy);
    addTo(t.slow, s, s.slowCy, s.slowPy);
    const pot = usable(row[C.potential]) ? row[C.potential] : 0;
    if (s.lostCy) { t.lost.cy++; t.lost.rev += s.lostRevCy; t.lost.pot += pot; }
    if (s.lostPy) { t.lost.py++; t.lost.revPy += s.lostRevPy; t.lost.potPy += pot; }
    if (s.baseCy) t.base.cy++;
    if (s.basePy) t.base.py++;
    for (const m of s.monthsCy) t.months.cy[m]++;
    for (const m of s.monthsPy) t.months.py[m]++;
    if (runAt >= 0 && s.pyRunBought) t.months.py[runAt] += share;
  }
  return out;
}

/** A share, or null without a base. */
export const rateOf = (a: number, b: number) => (b > 0 ? a / b : null);
/** The churn rate: lost of those who bought in the 12 months before the last 12. */
export const churn = (s: CStats) => ({ cy: rateOf(s.lost.cy, s.base.cy), py: rateOf(s.lost.py, s.base.py) });

/** A customer to name: lost or slowing, with what it bought. */
export type Named = { i: number; name: string; person: string; country: string; rev: number; revPy: number; potential: number; last: number | null };
/** The customers of one status in a period - lost: their revenue in their last year; slowing: this year against last. */
export function namedOf(d: CustDevData, idx: number[], win: CWin, status: "lost" | "slow"): Named[] {
  const out: Named[] = [];
  for (const i of idx) {
    const s = customerIn(d, i, win);
    if (status === "lost" ? !s.lostCy : !s.slowCy) continue;
    const row = d.companies[i], rev = d.revenue[i] ?? [];
    let last: number | null = null;
    for (let j = 0; j + 1 < rev.length; j += 2) if (rev[j + 1] > 0 && rev[j] <= CY0 + win.to && (last === null || rev[j] > last)) last = rev[j];
    out.push({
      i, name: d.names[i] || `Company ${d.ids[i]}`, person: labelOf(d, row, "person"), country: labelOf(d, row, "country"),
      rev: status === "lost" ? s.lostRevCy : s.revCy, revPy: s.revPy, potential: usable(row[C.potential]) ? row[C.potential] : 0, last,
    });
  }
  return out;
}
