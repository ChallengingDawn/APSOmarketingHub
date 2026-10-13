// WHO ARE OUR CUSTOMERS, AS A CUBE - pure, shared by the server that builds it
// and the page that slices it (SARCLA 13.10: "if click, drill down on
// potential / APSO customer / country / owner"; "time filters are also needed").
//
// Every company in HubSpot is counted into one cell per combination of its
// sales priority, APSO segment, potential band, country, owner, customer type
// and mandant. Beside the cells: revenue per cell month by month, for this year
// and the two before; and the companies that bought, by the months they bought
// in - so "who bought between April and June" stays a count of companies, not a
// sum of months. Counts and sums only - no company, no id.

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
  /** [cell, year index, months bought in as a 12-bit mask (Jan = bit 0), companies] */
  buyers: number[][];
};

/** A time window: a year (0 = this year, 1 = last year) and its months, 0-based, both included. */
export type Win = { y: number; from: number; to: number };
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

export const monthMask = (from: number, to: number) => {
  let m = 0;
  for (let i = from; i <= to; i++) m |= 1 << i;
  return m;
};

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
    c.months.forEach((months, y) => {
      let mask = 0;
      months.forEach((x, m) => { if (x > 0) mask |= 1 << m; });
      if (!months.some((x) => x !== 0)) return;
      for (const target of usable ? [rev] : [rev, revNoPot]) {
        const k = `${ci},${y}`;
        let r = target.get(k);
        if (!r) { r = [ci, y, ...Array(12).fill(0)]; target.set(k, r); }
        months.forEach((x, m) => { r![2 + m] += x; });
      }
      if (mask) {
        const k = `${ci},${y},${mask}`;
        const b = buyers.get(k);
        if (b) b[3] += 1; else buyers.set(k, [ci, y, mask, 1]);
      }
    });
  }
  const round = (rows: number[][]) => rows.map((r) => r.map((x, i) => (i < 2 ? x : Math.round(x))));
  return { cells, revenue: round([...rev.values()]), revenueNoPot: round([...revNoPot.values()]), buyers: [...buyers.values()] };
}

/* ── slicing ──────────────────────────────────────────────────────────── */

const zero = (): Agg => ({ n: 0, pot: 0, bought: 0, boughtPy: 0, rev: 0, revPy: 0, revPot: 0 });

/**
 * Everything the filters leave in the window, against the same months a year
 * earlier - grouped by one dimension, or all together. `except` leaves that
 * dimension's own filter out, so a clicked card still shows all its values.
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
  const sum = (r: number[]) => { let s = 0; for (let m = win.from; m <= win.to; m++) s += r[2 + m]; return s; };
  for (const r of cube.revenue) {
    if (!ok[r[0]]) continue;
    if (r[1] === win.y) { const a = at(r[0]); const s = sum(r); a.rev += s; a.revPot += s; }
    else if (r[1] === win.y + 1) at(r[0]).revPy += sum(r);
  }
  for (const r of cube.revenueNoPot) if (ok[r[0]] && r[1] === win.y) at(r[0]).revPot -= sum(r);
  const mask = monthMask(win.from, win.to);
  for (const b of cube.buyers) {
    if (!ok[b[0]] || !(b[2] & mask)) continue;
    if (b[1] === win.y) at(b[0]).bought += b[3];
    else if (b[1] === win.y + 1) at(b[0]).boughtPy += b[3];
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

export type SortKey = "natural" | "n" | "bought" | "rev" | "change" | "name";
export const change = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);
export function sortRows(rows: Row[], key: SortKey, dim: Dim): Row[] {
  const fixed = FIXED[dim];
  const by: Record<Exclude<SortKey, "natural">, (a: Row, b: Row) => number> = {
    n: (a, b) => b.n - a.n,
    bought: (a, b) => b.bought - a.bought,
    rev: (a, b) => b.rev - a.rev,
    change: (a, b) => (change(b.rev, b.revPy) ?? -Infinity) - (change(a.rev, a.revPy) ?? -Infinity),
    name: (a, b) => a.label.localeCompare(b.label),
  };
  const cmp = key === "natural"
    ? fixed ? (a: Row, b: Row) => fixed.indexOf(a.label) - fixed.indexOf(b.label) : by.rev
    : by[key];
  return [...rows].sort((a, b) => cmp(a, b) || b.n - a.n || a.label.localeCompare(b.label));
}

/** Revenue in the window against the yearly potential for as many months. */
export function shareOfWallet(a: Agg, win: Win): number | null {
  const months = win.to - win.from + 1;
  return a.pot > 0 && months > 0 ? a.revPot / (a.pot * (months / 12)) : null;
}

/* ── the window in words ──────────────────────────────────────────────── */

export const yearOf = (cube: Cube, win: Win) => cube.years[win.y];
/** "Jan–Sep 2026", "Sep 2026" */
export function windowLabel(cube: Cube, win: Win, yearIndex = win.y): string {
  const y = cube.years[yearIndex] ?? cube.years[0] - yearIndex;
  return win.from === win.to ? `${MONTH_NAMES[win.from]} ${y}` : `${MONTH_NAMES[win.from]}–${MONTH_NAMES[win.to]} ${y}`;
}
/** The last day the window's figures cover: "30 Sep 2026". */
export function upToDate(cube: Cube, win: Win): string {
  const y = cube.years[win.y];
  const last = new Date(Date.UTC(y, win.to + 1, 0));
  return `${last.getUTCDate()} ${MONTH_NAMES[win.to]} ${y}`;
}
/** The window a page opens on: this year, January to the last loaded month. */
export const defaultWindow = (cube: Cube): Win => ({ y: 0, from: 0, to: Math.max(0, (cube.loaded[0] || 1) - 1) });
/** The months a window may reach in a year: this year only as far as its revenue is loaded. */
export const lastMonth = (cube: Cube, y: number) => Math.max(0, (cube.loaded[y] ?? 12) - 1);
