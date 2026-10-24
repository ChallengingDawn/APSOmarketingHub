// WHO ARE OUR CUSTOMERS, AS A CUBE - pure, shared by the server that builds it
// and the page that slices it (SARCLA 13.10: "if click, drill down on
// potential / APSO customer / country / owner"; "time filters", "a custom time
// filter").
//
// Every company in HubSpot is counted into one cell per combination of its
// sales priority, APSO segment, potential band, country, owner, customer type,
// APIC and mandant. Beside the cells: revenue per cell month by month over three
// years, and the companies that bought, by the months they bought in across all
// three - so "who bought between October and March" counts each company once,
// over a year end too. Counts and sums only - no company, no id.

// "sae" - the Performis sales agent (sae_performis), as the person Map assignment maps it to (SARCLA 24.10.2026: "the
// revenue should come from Performis SAE, the split as well, next to the company owner; TSA as individuals")
export const DIMS = ["prio", "segment", "potential", "country", "owner", "type", "apic", "mandant", "sae"] as const;
export type Dim = (typeof DIMS)[number];

/** A cell: the dimension indexes in DIMS order, then these. */
export const CELL = { n: DIMS.length, pot: DIMS.length + 1 } as const;

export type Cube = {
  generatedAt: string;
  /** this year, last year, the year before */
  years: number[];
  /** months each year has loaded: this year's complete months with their revenue in, 12 for the others */
  loaded: number[];
  /**
   * The month in progress, as far as the last ERP delivery reaches: its month
   * number, that day, and the days the month has. Null when there is none.
   */
  running: { month: number; day: number; days: number } | null;
  /** The day of the ERP delivery the read stands on - a newer one makes the read stale. */
  dataDay?: string | null;
  labels: Record<Dim, string[]>;
  /** [dimension indexes…, companies, their yearly potential where usable] */
  cells: number[][];
  /** [cell, year index, revenue Jan…Dec] - only cells and years with revenue */
  revenue: number[][];
  /** the same, for the part of the revenue from companies without a usable potential (rare) */
  revenueNoPot: number[][];
  /**
   * [cell, months bought in the two earlier years, months bought in this year, companies].
   * Months are counted from January of the year before last (month 0) to December
   * of this year (month 35); the first 24 sit in one mask, this year's 12 in the other.
   */
  buyers: number[][];
  /** [cell, month number, companies whose first order ever falls in that month] - the new customers */
  newCustomers: number[][];
  /** [cell, year index, order intake Jan…Dec] - as revenue; the ESO reports' Figures (SARCLA 24.10.2026: "OI MTD, OI YTD as the revenue") */
  intake?: number[][];
  /** the team of each sales rep, by the name the cube carries: "ESO", "TSA", "Other" (rosters.ts) - the Figures' ESO | TSA | Total */
  teams?: Record<string, string>;
  /** the same for the Performis SAE's people: "ESO", "TSA", "Other" */
  saeTeams?: Record<string, string>;
  /**
   * [cell, ...ERP] - the ERP file's own figures per company, summed (ERP_FIELDS order): month and year to date, this
   * year and last, cut on the same day. The monthly order intake per company lags months behind the ERP (loaded
   * through June in October 2026), so the Figures' MTD / YTD stand on these (SARCLA 24.10.2026: "not sure the
   * figures are right" - order intake MTD read 0).
   */
  erp?: number[][];
  /** the day of the ERP file those figures are of ("2026-10-21") */
  erpDay?: string | null;
  /** this year's months with the order intake per company loaded (60% of last year's companies, as revenue) */
  oiLoaded?: number;
};

/** The ERP's figures a cell carries, in this order. */
export const ERP_FIELDS = ["revMtd", "revMtdPy", "revYtd", "revYtdPy", "oiMtd", "oiMtdPy", "oiYtd", "oiYtdPy"] as const;
export type ErpAgg = Record<(typeof ERP_FIELDS)[number], number>;

/**
 * A time window: its first and last month, both included, counted from January
 * of the year before last (0) - so January this year is 24. It is compared with
 * the same months a year earlier, so it may start no earlier than 12.
 */
export type Win = { start: number; end: number };
/** The values chosen per dimension: a company passes when it holds any of them (SARCLA 17.10: "two sales reps"). */
export type Filters = Partial<Record<Dim, string[]>>;
/** The dimensions with at least one value chosen. */
export const chosenDims = (f: Filters): Dim[] => DIMS.filter((d) => (f[d]?.length ?? 0) > 0);
export type Agg = { n: number; pot: number; bought: number; boughtPy: number; rev: number; revPy: number; revPot: number; newC: number; newCPy: number; oi: number; oiPy: number };
/** A row of one breakdown; the online share (KPI C06) joins it on the page once its own read is in. */
export type Row = Agg & { label: string; online?: number | null; onlinePy?: number | null };

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Potential bands, the same thresholds as the sales priority (Smart Segmentation). */
/** In full - no "K" (SARCLA 13.10: "no abbreviation"). */
export const POTENTIAL_BANDS = ["€100,000 and more", "€25,000 – 99,999", "€2,500 – 24,999", "€500 – 2,499", "Under €500", "Not set"] as const;
export function potentialBand(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "Not set";
  if (v >= 100_000) return POTENTIAL_BANDS[0];
  if (v >= 25_000) return POTENTIAL_BANDS[1];
  if (v >= 2_500) return POTENTIAL_BANDS[2];
  if (v >= 500) return POTENTIAL_BANDS[3];
  return POTENTIAL_BANDS[4];
}
/**
 * A potential that can be weighed against revenue: above zero and at most 1 M€.
 * Larger values without matching revenue are typing slips that the segmentation
 * maths ignores too - one of them would swallow a whole band's share of wallet.
 */
export const usablePotential = (v: number | null) => v != null && v > 0 && v <= 1_000_000;

export const PRIO_ORDER = ["Prio 1", "Prio 2", "Prio 3", "No priority", "Not set"];
/** Dimensions read in their own order, not by size. */
const FIXED: Partial<Record<Dim, readonly string[]>> = { prio: PRIO_ORDER, potential: POTENTIAL_BANDS };

/** The month number of a year index (0 this year, 1 last, 2 the one before) and a month. */
export const monthOf = (yearIndex: number, month: number) => (2 - yearIndex) * 12 + month;
/** The two masks (earlier two years, this year) of the months from `a` to `b`. */
export function masks(a: number, b: number): [number, number] {
  let lo = 0, hi = 0;
  for (let k = Math.max(0, a); k <= Math.min(35, b); k++) {
    if (k < 24) lo |= 1 << k; else hi |= 1 << (k - 24);
  }
  return [lo, hi];
}

/* ── building ─────────────────────────────────────────────────────────── */

export type CompanyIn = {
  dims: Record<Dim, number>;
  potential: number | null;
  /** revenue per month, per year index (this year, last, the one before) */
  months: number[][];
  /** the month number of the company's first order ever, when it falls in the three years; null otherwise */
  firstMonth?: number | null;
  /** order intake per month, per year index, as `months` */
  intake?: number[][];
  /** the ERP's figures (ERP_FIELDS order), when the company is in the ERP file */
  erp?: number[] | null;
};

/** Folds companies into a cube's cells, revenue and buyers. */
export function fold(companies: Iterable<CompanyIn>): Pick<Cube, "cells" | "revenue" | "revenueNoPot" | "buyers" | "newCustomers" | "intake" | "erp"> {
  const cellIx = new Map<string, number>();
  const cells: number[][] = [];
  const rev = new Map<string, number[]>(), revNoPot = new Map<string, number[]>(), buyers = new Map<string, number[]>(), fresh = new Map<string, number[]>(), oi = new Map<string, number[]>();
  const erp = new Map<number, number[]>();
  for (const c of companies) {
    const idx = DIMS.map((d) => c.dims[d]);
    const key = idx.join(",");
    let ci = cellIx.get(key);
    if (ci === undefined) { ci = cells.push([...idx, 0, 0]) - 1; cellIx.set(key, ci); }
    const cell = cells[ci];
    cell[CELL.n] += 1;
    const usable = usablePotential(c.potential);
    if (usable) cell[CELL.pot] += c.potential!;
    let lo = 0, hi = 0;
    c.months.forEach((months, y) => {
      months.forEach((x, m) => {
        if (!(x > 0)) return;
        const k = monthOf(y, m);
        if (k < 24) lo |= 1 << k; else hi |= 1 << (k - 24);
      });
      if (!months.some((x) => x !== 0)) return;
      for (const target of usable ? [rev] : [rev, revNoPot]) {
        const k = `${ci},${y}`;
        let r = target.get(k);
        if (!r) { r = [ci, y, ...Array(12).fill(0)]; target.set(k, r); }
        months.forEach((x, m) => { r![2 + m] += x; });
      }
    });
    if (lo || hi) {
      const k = `${ci},${lo},${hi}`;
      const b = buyers.get(k);
      if (b) b[3] += 1; else buyers.set(k, [ci, lo, hi, 1]);
    }
    if (c.erp?.some((x) => x !== 0)) {
      let e = erp.get(ci);
      if (!e) { e = [ci, ...ERP_FIELDS.map(() => 0)]; erp.set(ci, e); }
      c.erp.forEach((x, i) => { e![1 + i] += x || 0; });
    }
    (c.intake ?? []).forEach((months, y) => {
      if (!months.some((x) => x !== 0)) return;
      const k = `${ci},${y}`;
      let r = oi.get(k);
      if (!r) { r = [ci, y, ...Array(12).fill(0)]; oi.set(k, r); }
      months.forEach((x, m) => { r![2 + m] += x; });
    });
    if (c.firstMonth != null && c.firstMonth >= 0 && c.firstMonth <= 35) {
      const k = `${ci},${c.firstMonth}`;
      const f = fresh.get(k);
      if (f) f[2] += 1; else fresh.set(k, [ci, c.firstMonth, 1]);
    }
  }
  const round = (rows: number[][]) => rows.map((r) => r.map((x, i) => (i < 2 ? x : Math.round(x))));
  return { cells, revenue: round([...rev.values()]), revenueNoPot: round([...revNoPot.values()]), buyers: [...buyers.values()], newCustomers: [...fresh.values()], intake: round([...oi.values()]), erp: [...erp.values()].map((r) => r.map((x, i) => (i ? Math.round(x) : x))) };
}

/* ── slicing ──────────────────────────────────────────────────────────── */

const zero = (): Agg => ({ n: 0, pot: 0, bought: 0, boughtPy: 0, rev: 0, revPy: 0, revPot: 0, newC: 0, newCPy: 0, oi: 0, oiPy: 0 });

/**
 * Everything the filters leave in the window, against the same months a year
 * earlier - grouped by one dimension, or all together. Grouping leaves that
 * dimension's own filter out, so the clicked view still shows all its values.
 */
function aggregate(cube: Cube, filters: Filters, win: Win, groupBy?: Dim): Map<number, Agg> {
  // a value the cube does not know matches nothing, so a filter of only such values leaves nothing
  const f: [number, Set<number>][] = [];
  DIMS.forEach((d, i) => {
    const vs = filters[d];
    if (vs?.length && d !== groupBy) f.push([i, new Set(vs.map((v) => cube.labels[d].indexOf(v)).filter((x) => x >= 0))]);
  });
  const gi = groupBy ? DIMS.indexOf(groupBy) : -1;
  const ok = cube.cells.map((c) => f.every(([i, vs]) => vs.has(c[i])));
  const out = new Map<number, Agg>();
  const at = (ci: number) => {
    const g = gi < 0 ? 0 : cube.cells[ci][gi];
    let a = out.get(g);
    if (!a) { a = zero(); out.set(g, a); }
    return a;
  };
  cube.cells.forEach((c, ci) => { if (ok[ci]) { const a = at(ci); a.n += c[CELL.n]; a.pot += c[CELL.pot]; } });
  const { start, end } = win, ps = start - 12, pe = end - 12;
  // The month in progress is compared with the same month a year earlier, pro
  // rata: 12 days of October against 12/31 of last October. Monthly figures
  // know no days, so that part of last year is an estimate - and says so.
  const run = partial(cube);
  const pyRun = run ? run.month - 12 : -99;
  const share = run ? run.day / run.days : 1;
  for (const r of cube.revenue) {
    if (!ok[r[0]]) continue;
    const base = monthOf(r[1], 0);
    let cur = 0, prev = 0;
    for (let m = 0; m < 12; m++) {
      const k = base + m;
      if (k >= start && k <= end) cur += r[2 + m];
      if (k >= ps && k <= pe) prev += r[2 + m] * (k === pyRun ? share : 1);
    }
    if (cur || prev) { const a = at(r[0]); a.rev += cur; a.revPot += cur; a.revPy += prev; }
  }
  // order intake: as revenue, last year's month in progress pro rata too
  for (const r of cube.intake ?? []) {
    if (!ok[r[0]]) continue;
    const base = monthOf(r[1], 0);
    let cur = 0, prev = 0;
    for (let m = 0; m < 12; m++) {
      const k = base + m;
      if (k >= start && k <= end) cur += r[2 + m];
      if (k >= ps && k <= pe) prev += r[2 + m] * (k === pyRun ? share : 1);
    }
    if (cur || prev) { const a = at(r[0]); a.oi += cur; a.oiPy += prev; }
  }
  for (const r of cube.revenueNoPot) {
    if (!ok[r[0]]) continue;
    const base = monthOf(r[1], 0);
    let cur = 0;
    for (let m = 0; m < 12; m++) { const k = base + m; if (k >= start && k <= end) cur += r[2 + m]; }
    if (cur) at(r[0]).revPot -= cur;
  }
  const [wl, wh] = masks(start, end), [pl, ph] = masks(ps, pe);
  // last year's buyers who bought ONLY in the month matching the one in progress count pro rata too
  const cut = pyRun >= ps && pyRun <= pe;
  const [ql, qh] = cut ? [pl & ~(pyRun < 24 ? 1 << pyRun : 0), ph & ~(pyRun >= 24 ? 1 << (pyRun - 24) : 0)] : [pl, ph];
  for (const b of cube.buyers) {
    if (!ok[b[0]]) continue;
    if ((b[1] & wl) || (b[2] & wh)) at(b[0]).bought += b[3];
    if ((b[1] & pl) || (b[2] & ph)) at(b[0]).boughtPy += cut && !((b[1] & ql) || (b[2] & qh)) ? b[3] * share : b[3];
  }
  // new customers: a first order ever in the window; last year's month in progress pro rata as well
  for (const f of cube.newCustomers ?? []) {
    if (!ok[f[0]]) continue;
    if (f[1] >= start && f[1] <= end) at(f[0]).newC += f[2];
    if (f[1] >= ps && f[1] <= pe) at(f[0]).newCPy += f[2] * (f[1] === pyRun ? share : 1);
  }
  return out;
}

export function totals(cube: Cube, filters: Filters, win: Win): Agg {
  return aggregate(cube, filters, win).get(0) ?? zero();
}

/** One dimension broken down under every OTHER filter, in its own order (priority, potential) or by revenue. */
export function breakdown(cube: Cube, dim: Dim, filters: Filters, win: Win): Row[] {
  const groups = aggregate(cube, filters, win, dim);
  const rows = [...groups.entries()].filter(([, a]) => a.n > 0).map(([i, a]) => ({ label: cube.labels[dim][i], ...a }));
  return sortRows(rows, "natural", dim);
}

export type SortKey = "natural" | "label" | "n" | "bought" | "boughtPy" | "newC" | "newCPy" | "rev" | "revPy" | "diff" | "change" | "share" | "sow" | "online" | "oi" | "oiPy";
export const change = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);
/** Every sort is largest first except the name; `desc: false` turns it round. */
export function sortRows(rows: Row[], key: SortKey, dim: Dim, desc = true): Row[] {
  const fixed = FIXED[dim];
  const val: Partial<Record<SortKey, (r: Row) => number>> = {
    n: (r) => r.n, bought: (r) => r.bought, boughtPy: (r) => r.boughtPy, newC: (r) => r.newC, newCPy: (r) => r.newCPy, rev: (r) => r.rev, revPy: (r) => r.revPy,
    diff: (r) => r.rev - r.revPy, change: (r) => change(r.rev, r.revPy) ?? -Infinity, share: (r) => r.rev,
    sow: (r) => (r.pot > 0 ? r.revPot / r.pot : -Infinity),
    online: (r) => r.online ?? -Infinity,
    oi: (r) => r.oi, oiPy: (r) => r.oiPy,
  };
  const dir = desc ? 1 : -1;
  // names compare as people read them: APIC 1.1.9 before 1.1.10
  const cmp = key === "label" ? (a: Row, b: Row) => dir * a.label.localeCompare(b.label, "en", { numeric: true })
    : key === "natural" ? (fixed ? (a: Row, b: Row) => fixed.indexOf(a.label) - fixed.indexOf(b.label) : (a: Row, b: Row) => b.rev - a.rev)
      : (a: Row, b: Row) => dir * (val[key]!(b) - val[key]!(a));
  return [...rows].sort((a, b) => cmp(a, b) || b.n - a.n || a.label.localeCompare(b.label));
}

/** Revenue in the window against the yearly potential for as many months - the month in progress as far as it has gone. */
export function shareOfWallet(a: Agg, win: Win, cube?: Cube): number | null {
  const run = cube ? partial(cube) : null;
  const months = win.end - win.start + 1 - (run && win.start <= run.month && run.month <= win.end ? 1 - run.day / run.days : 0);
  return a.pot > 0 && months > 0 ? a.revPot / (a.pot * (months / 12)) : null;
}

/* ── windows: which, and in words ─────────────────────────────────────── */

export const yearOfMonth = (cube: Cube, k: number) => cube.years[2] + Math.floor(k / 12);
/** "Sep 2026" */
export const monthLabel = (cube: Cube, k: number) => `${MONTH_NAMES[((k % 12) + 12) % 12]} ${yearOfMonth(cube, k)}`;
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** The month in progress when the data stop before its end; null otherwise. */
export const partial = (cube: Cube) => (cube.running && cube.running.day < cube.running.days ? cube.running : null);
/** This year's last complete month with its revenue in. */
export const lastComplete = (cube: Cube) => monthOf(0, Math.max(0, (cube.loaded[0] || 1) - 1));
/** The last month a window may reach: the month in progress, as far as the data go. */
export const lastMonth = (cube: Cube) => Math.max(lastComplete(cube), cube.running?.month ?? -1);
/** The first: January last year, so the comparison stays inside the three years read. */
export const FIRST_MONTH = 12;

/**
 * "2025", "Jan–Sep 2026", "Mar 2026", "Oct 2025 – Sep 2026"; a window ending in
 * the month in progress ends on its day: "Jan – 12 Oct 2026", "1–12 Oct 2026".
 * `yearsBack` 1 = the comparison, the same days a year earlier.
 */
export function windowLabel(cube: Cube, win: Win, yearsBack = 0): string {
  const s = win.start - 12 * yearsBack, e = win.end - 12 * yearsBack;
  const ys = yearOfMonth(cube, s), ye = yearOfMonth(cube, e);
  const run = partial(cube);
  const day = run && win.end === run.month ? run.day : null;
  if (day) {
    if (s === e) return `1–${day} ${MONTH_NAMES[e % 12]} ${ye}`;
    return ys === ye ? `${MONTH_NAMES[s % 12]} – ${day} ${MONTH_NAMES[e % 12]} ${ys}` : `${monthLabel(cube, s)} – ${day} ${monthLabel(cube, e)}`;
  }
  if (s === e) return monthLabel(cube, s);
  if (ys === ye) return s % 12 === 0 && e % 12 === 11 ? String(ys) : `${MONTH_NAMES[s % 12]}–${MONTH_NAMES[e % 12]} ${ys}`;
  return `${monthLabel(cube, s)} – ${monthLabel(cube, e)}`;
}
/** The last day the window's figures cover: "30 Sep 2026", or the last delivery's day in the month in progress. */
export function upToDate(cube: Cube, win: Win): string {
  const y = yearOfMonth(cube, win.end), m = win.end % 12;
  const run = partial(cube);
  const day = run && win.end === run.month ? run.day : new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return `${day} ${MONTH_NAMES[m]} ${y}`;
}
/** When the window reaches into the month in progress, how last year's same month was counted - else null. */
export function proRataNote(cube: Cube, win: Win): string | null {
  const run = partial(cube);
  if (!run || run.month - 12 < win.start - 12 || run.month - 12 > win.end - 12) return null;
  return `${MONTH_FULL[run.month % 12]} ${yearOfMonth(cube, run.month - 12)} counted pro rata, ${run.day} of ${run.days} days`;
}

/** The ready-made windows; the first is the one a page opens on. */
export function presets(cube: Cube): { id: string; label: string; win: Win }[] {
  const last = lastMonth(cube), done = lastComplete(cube), jan = monthOf(0, 0), run = partial(cube);
  const out = [
    { id: "ytd", label: "Year to date", win: { start: jan, end: last } },
    ...(run ? [{ id: "mtd", label: "Month to date", win: { start: run.month, end: run.month } }] : []),
    { id: "lm", label: `${MONTH_FULL[done % 12]} ${yearOfMonth(cube, done)}`, win: { start: done, end: done } },
    { id: "12m", label: "Last 12 months", win: { start: Math.max(FIRST_MONTH, last - 11), end: last } },
    { id: "ly", label: `Last year (${cube.years[1]})`, win: { start: monthOf(1, 0), end: monthOf(1, 11) } },
  ];
  for (let q = 0; q < 4; q++) {
    const w = { start: jan + q * 3, end: jan + q * 3 + 2 };
    if (w.end <= done) out.push({ id: `q${q + 1}`, label: `Q${q + 1} ${cube.years[0]}`, win: w });
  }
  return out;
}
export const defaultWindow = (cube: Cube): Win => presets(cube)[0].win;
/** A window kept inside what was read: from January last year to this year's last loaded month. */
export function clampWindow(cube: Cube, w: Win): Win {
  const last = lastMonth(cube);
  const start = Math.min(Math.max(FIRST_MONTH, Math.round(w.start)), last);
  const end = Math.min(Math.max(start, Math.round(w.end)), last);
  return { start, end };
}

/* ── month by month (the ESO reports' Figures) ────────────────────────── */

export type MonthFig = { month: number; rev: number; revPy: number; oi: number; oiPy: number };
/**
 * This year month by month to the last month read, under the filters: revenue and order intake against the same
 * month a year earlier - the month in progress against last year's pro rata, as everywhere on the cube.
 */
export function byMonth(cube: Cube, filters: Filters): MonthFig[] {
  const jan = monthOf(0, 0), last = lastMonth(cube);
  const out: MonthFig[] = [];
  for (let k = jan; k <= last; k++) {
    const a = totals(cube, filters, { start: k, end: k });
    out.push({ month: k, rev: a.rev, revPy: a.revPy, oi: a.oi, oiPy: a.oiPy });
  }
  return out;
}

/** The months of this year (index 0 = January) as one value per month: revenue and order intake, this year to the last month read, last year whole. */
export type YearCurve = { rev: number[]; revPy: number[]; oi: number[]; oiPy: number[] };
const passes = (cube: Cube, filters: Filters, except?: Dim) => {
  const f: [number, Set<number>][] = [];
  DIMS.forEach((d, i) => {
    const vs = filters[d];
    if (vs?.length && d !== except) f.push([i, new Set(vs.map((v) => cube.labels[d].indexOf(v)).filter((x) => x >= 0))]);
  });
  return cube.cells.map((c) => f.every(([i, vs]) => vs.has(c[i])));
};

/**
 * The year as curves (the ESO reports' Figures' trajectory, SARCLA 24.10.2026): month by month as read - this year
 * to the last month read (the month in progress as far as it has gone), last year all twelve, no pro rata: a curve
 * shows what each month holds; the comparison to date is `totals`.
 */
export function yearCurve(cube: Cube, filters: Filters): YearCurve {
  const ok = passes(cube, filters);
  const last = lastMonth(cube);
  const out: YearCurve = { rev: Array(12).fill(0), revPy: Array(12).fill(0), oi: Array(12).fill(0), oiPy: Array(12).fill(0) };
  const fill = (rows: number[][] | undefined, cy: number[], py: number[]) => {
    for (const r of rows ?? []) {
      if (!ok[r[0]] || r[1] > 1) continue;
      for (let m = 0; m < 12; m++) {
        if (r[1] === 0 && monthOf(0, m) <= last) cy[m] += r[2 + m];
        else if (r[1] === 1) py[m] += r[2 + m];
      }
    }
  };
  fill(cube.revenue, out.rev, out.revPy);
  fill(cube.intake, out.oi, out.oiPy);
  return out;
}

/**
 * This year month by month for every value of one dimension, in one pass (the Figures' cards per person): as
 * byMonth - the month in progress against last year's pro rata - grouped like breakdown (the dimension's own filter
 * left out, so every value shows).
 */
export function byMonthBy(cube: Cube, filters: Filters, dim: Dim): Map<string, MonthFig[]> {
  const ok = passes(cube, filters, dim);
  const gi = DIMS.indexOf(dim);
  const jan = monthOf(0, 0), last = lastMonth(cube);
  const run = partial(cube);
  const pyRun = run ? run.month - 12 : -99, share = run ? run.day / run.days : 1;
  const out = new Map<string, MonthFig[]>();
  const of = (ci: number) => {
    const label = cube.labels[dim][cube.cells[ci][gi]];
    let ms = out.get(label);
    if (!ms) { ms = Array.from({ length: last - jan + 1 }, (_, i) => ({ month: jan + i, rev: 0, revPy: 0, oi: 0, oiPy: 0 })); out.set(label, ms); }
    return ms;
  };
  const add = (rows: number[][] | undefined, cur: "rev" | "oi", prev: "revPy" | "oiPy") => {
    for (const r of rows ?? []) {
      if (!ok[r[0]] || r[1] > 1) continue;
      for (let m = 0; m < 12; m++) {
        const x = r[2 + m];
        if (!x) continue;
        const k = monthOf(r[1], m), kCy = r[1] === 0 ? k : k + 12;
        if (kCy < jan || kCy > last) continue;
        const ms = of(r[0]);
        if (r[1] === 0) ms[kCy - jan][cur] += x;
        else ms[kCy - jan][prev] += x * (k === pyRun ? share : 1);
      }
    }
  };
  add(cube.revenue, "rev", "revPy");
  add(cube.intake, "oi", "oiPy");
  return out;
}

/**
 * The ERP's figures under the filters, grouped by one dimension (its own filter left out, as breakdown) or all
 * together under "" - month and year to date, this year and last.
 */
export function erpBy(cube: Cube, filters: Filters, dim?: Dim): Map<string, ErpAgg> {
  const ok = passes(cube, filters, dim);
  const gi = dim ? DIMS.indexOf(dim) : -1;
  const out = new Map<string, ErpAgg>();
  for (const r of cube.erp ?? []) {
    if (!ok[r[0]]) continue;
    const key = gi < 0 ? "" : cube.labels[dim!][cube.cells[r[0]][gi]];
    let a = out.get(key);
    if (!a) { a = Object.fromEntries(ERP_FIELDS.map((f) => [f, 0])) as ErpAgg; out.set(key, a); }
    ERP_FIELDS.forEach((f, i) => { a![f] += r[1 + i]; });
  }
  return out;
}
export const erpTotals = (cube: Cube, filters: Filters): ErpAgg => erpBy(cube, filters).get("") ?? (Object.fromEntries(ERP_FIELDS.map((f) => [f, 0])) as ErpAgg);

/**
 * A company's Performis SAE as a person: the Map assignment's mapping (SAE value -> owner id, "Pielock Nancy" -> Nancy
 * Pielock, "ESO CH GER" -> Jan Kalt) and the owners' names; a value it does not map stays as Performis writes it.
 */
export function saeLabel(raw: string | null | undefined, sae: Record<string, string>, names: Map<string, string>): { label: string; owner: string | null } {
  const v = (raw ?? "").trim();
  if (!v) return { label: "No SAE", owner: null };
  const id = sae[v] ?? Object.entries(sae).find(([k]) => k.toLowerCase() === v.toLowerCase())?.[1];
  return id ? { label: names.get(String(id)) ?? v, owner: String(id) } : { label: v, owner: null };
}

