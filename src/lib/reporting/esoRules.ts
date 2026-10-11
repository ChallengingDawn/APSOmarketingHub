// THE ESO BENCHMARK'S RULES - pure, so the definitions on the page and the
// numbers under them are tested together (tests/eso-rules.test.ts).
//
// SARCLA, 11.10.2026: the optimal ESO benchmark from the CrystalESO deck, per
// sales rep, this year against last - "everything the data allows". Every
// comparison is like-for-like: this year's completed months against the SAME
// months last year, never a part year against a whole one.

export const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
export const MONTH_LABEL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** This year against last: `months` completed months of `year`, and the same months of `py`. */
export type Window = { year: number; py: number; months: number };

/** The window on a given day: the months of this year that are over. In January, last year whole. */
export function benchmarkWindow(today: Date): Window {
  const y = today.getUTCFullYear();
  const done = today.getUTCMonth();
  return done === 0 ? { year: y - 1, py: y - 2, months: 12 } : { year: y, py: y - 1, months: done };
}

/** First day of a year and the first day after its window, as yyyy-mm-dd. */
export function windowDates(year: number, months: number): { from: string; to: string } {
  const to = months >= 12 ? `${year + 1}-01-01` : `${year}-${String(months + 1).padStart(2, "0")}-01`;
  return { from: `${year}-01-01`, to };
}

/** Is this date (yyyy-mm-dd or ISO) inside the window [from, to)? */
export function inWindow(date: string | null | undefined, w: { from: string; to: string }): boolean {
  if (!date) return false;
  const d = date.slice(0, 10);
  return d >= w.from && d < w.to;
}

/**
 * A company's rev_<year>_pc_monthly blob - {"may": {"dt": 120.5, "unknown": 4}} -
 * as twelve months of revenue by profit centre. Anything unreadable is empty.
 */
export function parsePcMonthly(raw: string | null | undefined): Record<string, number>[] {
  const out: Record<string, number>[] = MONTHS.map(() => ({}));
  if (!raw) return out;
  let j: unknown;
  try { j = JSON.parse(raw); } catch { return out; }
  if (!j || typeof j !== "object") return out;
  for (const [m, v] of Object.entries(j as Record<string, unknown>)) {
    const i = MONTHS.indexOf(m.toLowerCase() as (typeof MONTHS)[number]);
    if (i < 0 || !v || typeof v !== "object") continue;
    for (const [pc, n] of Object.entries(v as Record<string, unknown>)) {
      const x = Number(n);
      if (Number.isFinite(x)) out[i][pc.toLowerCase()] = (out[i][pc.toLowerCase()] ?? 0) + x;
    }
  }
  return out;
}

/** The first `months` months of a parsed blob: the total, and by profit centre. */
export function sumMonths(blob: Record<string, number>[], months: number): { total: number; byPc: Record<string, number> } {
  const byPc: Record<string, number> = {};
  let total = 0;
  for (let i = 0; i < Math.min(months, 12); i++) {
    for (const [pc, n] of Object.entries(blob[i])) { byPc[pc] = (byPc[pc] ?? 0) + n; total += n; }
  }
  return { total, byPc };
}

/** One month of a parsed blob. */
export const monthTotal = (blob: Record<string, number>[], i: number) => Object.values(blob[i] ?? {}).reduce((a, b) => a + b, 0);

/**
 * How many months of a monthly series are loaded. Revenue and order intake are
 * written per company month by month; a month counts once this year has at
 * least 60% as many companies with a figure as the same month last year - a
 * half-loaded month compared whole would read as a collapse.
 */
export function monthsLoaded(cyFilled: number[], pyFilled: number[], upTo: number): number {
  let n = 0;
  for (let i = 0; i < upTo; i++) {
    if (!(cyFilled[i] > 0) || cyFilled[i] < 0.6 * (pyFilled[i] || 0)) break;
    n = i + 1;
  }
  return n;
}

/** A company's revenue in the windows the customer statuses need. */
export type CompanyRevenue = {
  /** this year, completed months */ cy: number;
  /** last year, the same months */ pySame: number;
  /** last year, whole */ pyFull: number;
  /** the year before, the same months */ py2Same: number;
  /** the year before, whole */ py2Full: number;
  /** first order ever, yyyy-mm-dd */ firstOrder: string | null;
};

export type Status = {
  activeCy: boolean; activePy: boolean;
  newCy: boolean; newPy: boolean;
  reactivatedCy: boolean; reactivatedPy: boolean;
  slowingCy: boolean; slowingPy: boolean;
  lostCy: boolean; lostPy: boolean;
  /** bought in the year before - the base a churn rate is taken over */
  baseCy: boolean; basePy: boolean;
};

/**
 * Where a customer stands, this year and - measured the same way - last year.
 *
 *   active       bought in the window
 *   new          first order ever inside the window
 *   reactivated  bought in the window, nothing the whole year before, bought before that
 *   slowing      bought in both windows, less than half of the year before's same months
 *   lost         bought the year before, nothing in the window
 */
export function customerStatus(c: CompanyRevenue, w: Window): Status {
  const cyWin = windowDates(w.year, w.months);
  const pyWin = windowDates(w.py, w.months);
  const first = c.firstOrder ? c.firstOrder.slice(0, 10) : null;
  const activeCy = c.cy > 0;
  const activePy = c.pySame > 0;
  const newCy = inWindow(first, cyWin);
  const newPy = inWindow(first, pyWin);
  return {
    activeCy, activePy, newCy, newPy,
    reactivatedCy: activeCy && !newCy && c.pyFull <= 0 && !!first && first < `${w.py}-01-01`,
    reactivatedPy: activePy && !newPy && c.py2Full <= 0 && !!first && first < `${w.py - 1}-01-01`,
    slowingCy: activeCy && c.pySame > 0 && c.cy < 0.5 * c.pySame,
    slowingPy: activePy && c.py2Same > 0 && c.pySame < 0.5 * c.py2Same,
    lostCy: c.pyFull > 0 && c.cy <= 0,
    lostPy: c.py2Full > 0 && c.pySame <= 0,
    baseCy: c.pyFull > 0,
    basePy: c.py2Full > 0,
  };
}

/** The middle value, or null for none. */
export function median(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Hours from one timestamp to a later one; null when either is missing or the order is wrong. */
export function hoursBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from), b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return (b - a) / 3_600_000;
}

/** Resolutions that are an order. "One-shot" orders are orders too. */
export const ORDERED_RESOLUTIONS: ReadonlySet<string> = new Set(["Ordered", "One-shot order", "One-shot C2S order"]);

/** "1-Prio 1 - Pot >25000€" -> "Prio 1"; "4- No priority…" -> "No priority". */
export function prioOf(v: string | null | undefined): string {
  const d = (v ?? "").trim().charAt(0);
  if (d === "1" || d === "2" || d === "3") return `Prio ${d}`;
  if (d === "4") return "No priority";
  return "Not set";
}

/** The profit centre that carried most of a company's revenue in a window, or null. */
export function mainAssortment(byPc: Record<string, number>): string | null {
  let best: string | null = null, max = 0;
  for (const [pc, n] of Object.entries(byPc)) if (n > max) { max = n; best = pc; }
  return best;
}

/** This year against last. */
export type Pair = { cy: number; py: number };
export const pair = (): Pair => ({ cy: 0, py: 0 });

/** Add to one side of a Pair kept under a key. */
export function bump(rec: Record<string, Pair>, key: string, side: "cy" | "py", n = 1): void {
  (rec[key] ??= pair())[side] += n;
}

/** Change from last year to this, as a ratio; null when there is nothing to compare with. */
export function change(p: Pair): number | null {
  return p.py ? (p.cy - p.py) / Math.abs(p.py) : null;
}

/**
 * Medians for this year and last, each left empty when it rests on fewer than
 * 20 values or under a tenth of the other side's - a median of a handful of
 * tickets reads as a trend it is not.
 */
export function sturdyMedians(l: { cy: number[]; py: number[] }): { cy: number | null; py: number | null } {
  const ok = (a: number[], b: number[]) => a.length >= 20 && a.length >= 0.1 * b.length;
  return { cy: ok(l.cy, l.py) ? median(l.cy) : null, py: ok(l.py, l.cy) ? median(l.py) : null };
}
