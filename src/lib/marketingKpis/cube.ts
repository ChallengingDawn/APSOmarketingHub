// WHO ARE OUR CUSTOMERS, AS A CUBE - pure, shared by the server that builds it
// and the page that slices it (SARCLA 13.10: "if click, drill down on
// potential / APSO customer / country / owner").
//
// Every company in HubSpot is counted into one cell per combination of its
// sales priority, APSO segment, potential band, country, owner, customer type
// and mandant. A cell holds counts and sums only - no company, no id - so the
// page can filter on any of them and break the rest down without asking
// HubSpot again.

export const DIMS = ["prio", "segment", "potential", "country", "owner", "type", "mandant"] as const;
export type Dim = (typeof DIMS)[number];

/** Where each measure sits in a cell, after the dimension indexes. */
export const CELL = {
  /** companies */ n: 7,
  /** invoiced revenue this year so far (revenue_<year> > 0) */ bought: 8,
  /** invoiced revenue last year, whole (revenue_<year-1> > 0) */ boughtPy: 9,
  /** revenue in this year's loaded months */ rev: 10,
  /** revenue in the same months last year */ revPy: 11,
  /** yearly potential, companies with a usable one */ pot: 12,
  /** revenue in the loaded months, of the companies with a usable potential */ revPot: 13,
} as const;
const WIDTH = 14;

export type Cube = {
  generatedAt: string;
  year: number;
  /** months this year whose revenue is loaded - this year's and last year's revenue cover the same months */
  revenueMonths: number;
  labels: Record<Dim, string[]>;
  cells: number[][];
};

export type Filters = Partial<Record<Dim, string>>;
export type Agg = { n: number; bought: number; boughtPy: number; rev: number; revPy: number; pot: number; revPot: number };
export type Row = Agg & { label: string };

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

/** Adds one company to the cube under construction. */
export function addCompany(
  acc: Map<string, number[]>,
  dims: Record<Dim, number>,
  m: { bought: boolean; boughtPy: boolean; rev: number; revPy: number; potential: number | null },
): void {
  const idx = DIMS.map((d) => dims[d]);
  const key = idx.join(",");
  let c = acc.get(key);
  if (!c) { c = [...idx, ...Array(WIDTH - DIMS.length).fill(0)]; acc.set(key, c); }
  c[CELL.n] += 1;
  if (m.bought) c[CELL.bought] += 1;
  if (m.boughtPy) c[CELL.boughtPy] += 1;
  c[CELL.rev] += m.rev;
  c[CELL.revPy] += m.revPy;
  if (usablePotential(m.potential)) { c[CELL.pot] += m.potential!; c[CELL.revPot] += m.rev; }
}

const zero = (): Agg => ({ n: 0, bought: 0, boughtPy: 0, rev: 0, revPy: 0, pot: 0, revPot: 0 });
function add(a: Agg, c: number[]): void {
  a.n += c[CELL.n]; a.bought += c[CELL.bought]; a.boughtPy += c[CELL.boughtPy];
  a.rev += c[CELL.rev]; a.revPy += c[CELL.revPy]; a.pot += c[CELL.pot]; a.revPot += c[CELL.revPot];
}

/** The filters as label indexes; a value the cube does not know matches nothing. */
function compile(cube: Cube, filters: Filters, except?: Dim): [number, number][] {
  const out: [number, number][] = [];
  DIMS.forEach((d, i) => {
    const v = filters[d];
    if (v == null || d === except) return;
    out.push([i, cube.labels[d].indexOf(v)]);
  });
  return out;
}
const matches = (c: number[], f: [number, number][]) => f.every(([i, v]) => c[i] === v);

/** Everything the filters leave. */
export function totals(cube: Cube, filters: Filters): Agg {
  const f = compile(cube, filters);
  const a = zero();
  for (const c of cube.cells) if (matches(c, f)) add(a, c);
  return a;
}

/**
 * One dimension broken down under every OTHER filter - so the dimension a
 * person clicked still shows all its values, theirs marked, and they can
 * switch to a neighbour without clearing first.
 */
export function breakdown(cube: Cube, dim: Dim, filters: Filters, sortBy: "n" | "rev" = "n"): Row[] {
  const di = DIMS.indexOf(dim);
  const f = compile(cube, filters, dim);
  const rows = cube.labels[dim].map((label) => ({ label, ...zero() }));
  for (const c of cube.cells) if (matches(c, f)) add(rows[c[di]], c);
  const fixed = FIXED[dim];
  const used = rows.filter((r) => r.n > 0);
  return fixed ? used.sort((a, b) => fixed.indexOf(a.label) - fixed.indexOf(b.label)) : used.sort((a, b) => b[sortBy] - a[sortBy] || a.label.localeCompare(b.label));
}

/** Revenue in the loaded months against the yearly potential, both for the same months. */
export function shareOfWallet(a: Agg, revenueMonths: number): number | null {
  return a.pot > 0 && revenueMonths > 0 ? a.revPot / (a.pot * (revenueMonths / 12)) : null;
}
