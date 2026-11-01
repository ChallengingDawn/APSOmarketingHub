// MY SALES REPORTS' TARGETS (SARCLA 01.11.2026: "introduce the file VPP ESO 2026 BORJER - these are the sales targets;
// don't put the target, allow the sales to set its own target percentage; understand the file, how it's calculated").
//
// The VPP sheet has five targets, each reckoned the same way: last year's figure, the growth set on it, the year's
// target - split into quarters by the plan's weights - and each quarter's result measured against its part. Here the
// person sets their own growth (an amount for the new customers' revenue, a number for the visits, as the sheet has
// them); the figures they are measured on are the hub's. No pay and no bonus: his pick, "targets only" - the sheet's
// salary and incentive never enter the hub.
//
// No HubSpot or database here, so the page and the tests read it as it is.

export type TargetId = "own" | "dt" | "kt" | "new" | "visits";
/** growth: a % on last year's figure; eur: an amount for the year; count: a number for the year */
export type TargetKind = "growth" | "eur" | "count";
export type TargetDef = { id: TargetId; name: string; kind: TargetKind; note: string };

/** The sheet's five targets, in its order. */
export const TARGETS: TargetDef[] = [
  { id: "own", name: "Net revenue, own area", kind: "growth", note: "The revenue of the customers Performis gives you as their SAE" },
  { id: "dt", name: "Net revenue, Sealing Technology (DT)", kind: "growth", note: "Your customers' revenue in the sealing assortment" },
  { id: "kt", name: "Net revenue, Engineering Plastics (KT)", kind: "growth", note: "Your customers' revenue in the plastics assortment" },
  { id: "new", name: "Net revenue of new customers", kind: "eur", note: "What your customers who first bought this year were invoiced" },
  { id: "visits", name: "Customer visits", kind: "count", note: "Your completed visit reports" },
];
export const targetDef = (id: TargetId) => TARGETS.find((t) => t.id === id)!;
export const isTargetId = (x: unknown): x is TargetId => TARGETS.some((t) => t.id === x);

/**
 * The plan's quarters - the sheet's "Period weighting": a year's revenue target falls 25.6 / 25 / 24.6 / 24.8 % on the
 * quarters, its visits 26.5 / 27.5 / 22 / 24 %.
 */
export const QUARTER_WEIGHT: Record<"revenue" | "visits", readonly number[]> = {
  revenue: [0.256, 0.25, 0.246, 0.248],
  visits: [0.265, 0.275, 0.22, 0.24],
};

/** What a person set: per target, the growth in % (growth) or the year's amount / number; who set it last, and when. */
export type PersonTargets = Partial<Record<TargetId, number>> & { by?: string; at?: string };

/** The sheet's maximum: a target counts up to 120 % of itself (its "Max (%)" column) - 100 % is the target, 120 % the most. */
export const MAX_SHARE = 1.2;

/** The year's target: last year's figure and the growth on it, or the amount / number set. Nothing set: none. */
export function yearTarget(id: TargetId, set: number | undefined, py: number): number | null {
  if (set == null || !Number.isFinite(set)) return null;
  return targetDef(id).kind === "growth" ? py * (1 + set / 100) : set;
}

/** The year's target split into its four quarters. */
export const quarterTargets = (id: TargetId, year: number): number[] =>
  (id === "visits" ? QUARTER_WEIGHT.visits : QUARTER_WEIGHT.revenue).map((w) => year * w);

/** The quarters' targets up to and including quarter q (0-3) - what the year to date is measured against. */
export const targetToQuarter = (id: TargetId, year: number, q: number): number =>
  quarterTargets(id, year).slice(0, q + 1).reduce((a, x) => a + x, 0);

/** What may be set: a growth of -100 % to +1,000 %, an amount up to €100 million, up to 10,000 visits. */
const LIMIT: Record<TargetKind, [number, number]> = { growth: [-100, 1000], eur: [0, 100_000_000], count: [0, 10_000] };

/** A value as it may be kept - rounded to what the field shows - or why not. null clears it. */
export function checkTarget(id: TargetId, value: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === null || value === "") return { ok: true, value: null };
  const n = typeof value === "number" ? value : Number(String(value).replace(/[\s,'’]/g, ""));
  if (!Number.isFinite(n)) return { ok: false, error: "That is not a number." };
  const kind = targetDef(id).kind;
  const [lo, hi] = LIMIT[kind];
  if (n < lo || n > hi) return { ok: false, error: kind === "growth" ? `A growth between ${lo} % and ${hi} %.` : `Between ${lo.toLocaleString("en")} and ${hi.toLocaleString("en")}.` };
  // a growth to two decimals - the sheet's own are such (29.45 %)
  return { ok: true, value: kind === "growth" ? Math.round(n * 100) / 100 : Math.round(n) };
}

/** Everyone's targets as kept, cleaned: owner id -> what they set (anything not a known target, or out of bounds, dropped). */
export function cleanAll(x: unknown): Record<string, PersonTargets> {
  const out: Record<string, PersonTargets> = {};
  if (!x || typeof x !== "object") return out;
  for (const [owner, raw] of Object.entries(x as Record<string, unknown>)) {
    if (!/^\d+$/.test(owner) || !raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const t: PersonTargets = {};
    for (const d of TARGETS) {
      const c = checkTarget(d.id, r[d.id] ?? null);
      if (c.ok && c.value != null) t[d.id] = c.value;
    }
    if (typeof r.by === "string") t.by = r.by.slice(0, 120);
    if (typeof r.at === "string") t.at = r.at.slice(0, 40);
    out[owner] = t;
  }
  return out;
}

/** The quarter (0-3) a month (0-11) is in. */
export const quarterOf = (month: number) => Math.floor(month / 3);
