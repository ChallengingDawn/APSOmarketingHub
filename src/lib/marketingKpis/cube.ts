// WHO ARE OUR CUSTOMERS, AS A CUBE - pure, shared by the server that builds it
// and the page that slices it (SARCLA 13.10: "if click, drill down on
// potential / APSO customer / country / owner"; "time filters", "a custom time
// filter").
//
// Every company in HubSpot is counted into one cell per combination of its
// sales priority, APSO segment, potential band, country, owner, customer type
// and mandant. Beside the cells: revenue per cell month by month over three
// years, and the companies that bought, by the months they bought in across all
// three - so "who bought between October and March" counts each company once,
// over a year end too. Counts and sums only - no company, no id.

export const DIMS = ["prio", "segment", "potential", "country", "owner", "type", "mandant"] as const;
export type Dim = (typeof DIMS)[number];

/** A cell: the dimension indexes in DIMS order, then these. */
export const CELL = { n: 7, pot: 8 } as const;

export type Cube = {
  generatedAt: string;
  /** this year, last year, the year before */
  years: number[];
  /** months each year has loaded: this year's complete months with their revenue in, 12 for the others */
  loaded: number[];
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
};

/**
 * A time window: its first and last month, both included, counted from January
 * of the year before last (0) - so January this year is 24. It is compared with
 * the same months a year earlier, so it may start no earlier than 12.
 */
export type Win = { start: number; end: number };
export type Filters = Partial<Record<Dim, string>>;
export type Agg = { n: number; pot: number; bought: number; boughtPy: number; rev: number; revPy: number; revPot: number };
export type Row = Agg & { label: string };

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Potential bands, the same thresholds as the sales priority (Smart Segmentation). */
export const POTENTIAL_BANDS = ["€100K and more", "€25K – 100K", "€2.5K – 25K", "€500 – 2.5K", "Under €500", "Not set"] as const;
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
};

/** Folds companies into a cube's cells, revenue and buyers. */
export function fold(companies: Iterable<CompanyIn>): Pick<Cube, "cells" | "revenue" | "revenueNoPot" | "buyers"> {
  const cellIx = new Map<string, number>();
  const cells: number[][] = [];
  const rev = new Map<string, number[]>(), revNoPot = new Map<string, number[]>(), buyers = new Map<string, number[]>();
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
  }
  const round = (rows: number[][]) => rows.map((r) => r.map((x, i) => (i < 2 ? x : Math.round(x))));
  return { cells, revenue: round([...rev.values()]), revenueNoPot: round([...revNoPot.values()]), buyers: [...buyers.values()] };
}

/* ── slicing ──────────────────────────────────────────────────────────── */

const zero = (): Agg => ({ n: 0, pot: 0, bought: 0, boughtPy: 0, rev: 0, revPy: 0, revPot: 0 });

/**
 * Everything the filters leave in the window, against the same months a year
 * earlier - grouped by one dimension, or all together. Grouping leaves that
 * dimension's own filter out, so the clicked view still shows all its values.
 */
function aggregate(cube: Cube, filters: Filters, win: Win, groupBy?: Dim): Map<number, Agg> {
  const f: [number, number][] = [];
  DIMS.forEach((d, i) => {
    const v = filters[d];
    if (v != null && d !== groupBy) f.push([i, cube.labels[d].indexOf(v)]);
  });
  const gi = groupBy ? DIMS.indexOf(groupBy) : -1;
  const ok = cube.cells.map((c) => f.every(([i, v]) => c[i] === v));
  const out = new Map<number, Agg>();
  const at = (ci: number) => {
    const g = gi < 0 ? 0 : cube.cells[ci][gi];
    let a = out.get(g);
    if (!a) { a = zero(); out.set(g, a); }
    return a;
  };
  cube.cells.forEach((c, ci) => { if (ok[ci]) { const a = at(ci); a.n += c[CELL.n]; a.pot += c[CELL.pot]; } });
  const { start, end } = win, ps = start - 12, pe = end - 12;
  for (const r of cube.revenue) {
    if (!ok[r[0]]) continue;
    const base = monthOf(r[1], 0);
    let cur = 0, prev = 0;
    for (let m = 0; m < 12; m++) {
      const k = base + m;
      if (k >= start && k <= end) cur += r[2 + m];
      if (k >= ps && k <= pe) prev += r[2 + m];
    }
    if (cur || prev) { const a = at(r[0]); a.rev += cur; a.revPot += cur; a.revPy += prev; }
  }
  for (const r of cube.revenueNoPot) {
    if (!ok[r[0]]) continue;
    const base = monthOf(r[1], 0);
    let cur = 0;
    for (let m = 0; m < 12; m++) { const k = base + m; if (k >= start && k <= end) cur += r[2 + m]; }
    if (cur) at(r[0]).revPot -= cur;
  }
  const [wl, wh] = masks(start, end), [pl, ph] = masks(ps, pe);
  for (const b of cube.buyers) {
    if (!ok[b[0]]) continue;
    if ((b[1] & wl) || (b[2] & wh)) at(b[0]).bought += b[3];
    if ((b[1] & pl) || (b[2] & ph)) at(b[0]).boughtPy += b[3];
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

export type SortKey = "natural" | "label" | "n" | "bought" | "boughtPy" | "rev" | "revPy" | "diff" | "change" | "share" | "sow";
export const change = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);
/** Every sort is largest first except the name; `desc: false` turns it round. */
export function sortRows(rows: Row[], key: SortKey, dim: Dim, desc = true): Row[] {
  const fixed = FIXED[dim];
  const val: Partial<Record<SortKey, (r: Row) => number>> = {
    n: (r) => r.n, bought: (r) => r.bought, boughtPy: (r) => r.boughtPy, rev: (r) => r.rev, revPy: (r) => r.revPy,
    diff: (r) => r.rev - r.revPy, change: (r) => change(r.rev, r.revPy) ?? -Infinity, share: (r) => r.rev,
    sow: (r) => (r.pot > 0 ? r.revPot / r.pot : -Infinity),
  };
  const dir = desc ? 1 : -1;
  const cmp = key === "label" ? (a: Row, b: Row) => dir * a.label.localeCompare(b.label)
    : key === "natural" ? (fixed ? (a: Row, b: Row) => fixed.indexOf(a.label) - fixed.indexOf(b.label) : (a: Row, b: Row) => b.rev - a.rev)
      : (a: Row, b: Row) => dir * (val[key]!(b) - val[key]!(a));
  return [...rows].sort((a, b) => cmp(a, b) || b.n - a.n || a.label.localeCompare(b.label));
}

/** Revenue in the window against the yearly potential for as many months. */
export function shareOfWallet(a: Agg, win: Win): number | null {
  const months = win.end - win.start + 1;
  return a.pot > 0 && months > 0 ? a.revPot / (a.pot * (months / 12)) : null;
}

/* ── windows: which, and in words ─────────────────────────────────────── */

export const yearOfMonth = (cube: Cube, k: number) => cube.years[2] + Math.floor(k / 12);
/** "Sep 2026" */
export const monthLabel = (cube: Cube, k: number) => `${MONTH_NAMES[((k % 12) + 12) % 12]} ${yearOfMonth(cube, k)}`;
/** The last month a window may reach: this year's last loaded month. */
export const lastMonth = (cube: Cube) => monthOf(0, Math.max(0, (cube.loaded[0] || 1) - 1));
/** The first: January last year, so the comparison stays inside the three years read. */
export const FIRST_MONTH = 12;

/** "2025", "Jan–Sep 2026", "Mar 2026", "Oct 2025 – Sep 2026"; `yearsBack` 1 = the comparison. */
export function windowLabel(cube: Cube, win: Win, yearsBack = 0): string {
  const s = win.start - 12 * yearsBack, e = win.end - 12 * yearsBack;
  const ys = yearOfMonth(cube, s), ye = yearOfMonth(cube, e);
  if (s === e) return monthLabel(cube, s);
  if (ys === ye) return s % 12 === 0 && e % 12 === 11 ? String(ys) : `${MONTH_NAMES[s % 12]}–${MONTH_NAMES[e % 12]} ${ys}`;
  return `${monthLabel(cube, s)} – ${monthLabel(cube, e)}`;
}
/** The last day the window's figures cover: "30 Sep 2026". */
export function upToDate(cube: Cube, win: Win): string {
  const y = yearOfMonth(cube, win.end), m = win.end % 12;
  return `${new Date(Date.UTC(y, m + 1, 0)).getUTCDate()} ${MONTH_NAMES[m]} ${y}`;
}

/** The ready-made windows; the first is the one a page opens on. */
export function presets(cube: Cube): { id: string; label: string; win: Win }[] {
  const last = lastMonth(cube), jan = monthOf(0, 0);
  const out = [
    { id: "ytd", label: "This year to date", win: { start: jan, end: last } },
    { id: "12m", label: "Last 12 months", win: { start: Math.max(FIRST_MONTH, last - 11), end: last } },
    { id: "ly", label: `Last year (${cube.years[1]})`, win: { start: monthOf(1, 0), end: monthOf(1, 11) } },
  ];
  for (let q = 0; q < 4; q++) {
    const w = { start: jan + q * 3, end: jan + q * 3 + 2 };
    if (w.end <= last) out.push({ id: `q${q + 1}`, label: `Q${q + 1} ${cube.years[0]}`, win: w });
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
