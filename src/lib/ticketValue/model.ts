// TICKET VALUE - the comparison (pure): the three properties as the hub would leave them and as the workflow left them,
// the verdict per ticket, and the figures over many tickets. No "@/" imports: the tests load it as it is.

import { toNum, type Patch } from "./rules";

export type Values = { sales_potential_estimate: string | null; sales_potential_source: string | null; sales_potential_confidence: string | null };
/** agree = both leave the same value · differ = both wrote, not the same · missed = the hub would write, the workflow did
 *  not · pending = the workflow's writes not read yet */
export type Verdict = "agree" | "differ" | "missed" | "pending" | "error";

/** The values after a patch. */
export function finalOf(before: Values, patch: Patch | null): Values {
  const out = { ...before };
  if (patch) for (const [k, v] of Object.entries(patch)) out[k as keyof Values] = v === undefined || v === null ? null : String(v);
  return out;
}

const norm = (s: string | null | undefined) => (s === null || s === undefined || String(s).trim() === "" ? null : String(s).trim());
/** Same source, same confidence, and the value within a cent (the Python rounds to 2 places; "0.0" is 0). */
export function sameValue(a: Values, b: Values): boolean {
  if (norm(a.sales_potential_source) !== norm(b.sales_potential_source)) return false;
  if (norm(a.sales_potential_confidence) !== norm(b.sales_potential_confidence)) return false;
  const x = norm(a.sales_potential_estimate), y = norm(b.sales_potential_estimate);
  if (x === null || y === null) return x === y;
  return Math.abs(toNum(x) - toNum(y)) <= 0.011;
}

type RowLike = {
  verdict: Verdict; pipeline: string; trigger: "created" | "stage"; enrols: boolean; late?: boolean;
  hub: { branch: string; final: Values; link?: string | null; better?: { final: Values } } | null; workflow: { wrote: boolean; final: Values };
};
export type Measure = {
  rows: number; checked: number; agree: number; differ: number; missed: number; errors: number; pending: number;
  /** looked at late (the first day's replay) - left out of the figures below */
  late: number;
  /** share of the checked tickets on which both end with the same value */
  agreeShare: number | null;
  notTaken: number; links: number; workflowWrote: number;
  bySource: { source: string; workflow: number; hub: number }[];
  /** the workflow's branch each ticket took (the hub's copy of it); "not taken" = a stage entry the workflow does not take again */
  byBranch: { branch: string; n: number }[];
  /** the rule that gave the value, for the tickets the Python step scored (the hub's copy) */
  scoredBySource: { source: string; n: number }[];
  pairs: { workflow: string; hub: string; n: number }[];
  byPipeline: { pipeline: string; checked: number; agree: number; differ: number; missed: number }[];
  valueWorkflow: number; valueHub: number;
  /** the hub's own rules: tickets where they give another value than the copy, by branch, and the value they leave */
  improved: number; improvedBy: { branch: string; n: number }[]; valueBetter: number;
};

const src = (v: Values) => norm(v.sales_potential_source) ?? "(none)";

export function measure(rows: RowLike[]): Measure {
  const m: Measure = { rows: rows.length, checked: 0, agree: 0, differ: 0, missed: 0, errors: 0, pending: 0, late: 0, agreeShare: null, notTaken: 0, links: 0, workflowWrote: 0, bySource: [], byBranch: [], scoredBySource: [], pairs: [], byPipeline: [], valueWorkflow: 0, valueHub: 0, improved: 0, improvedBy: [], valueBetter: 0 };
  const bySource = new Map<string, { workflow: number; hub: number }>();
  const pairs = new Map<string, number>();
  const branches = new Map<string, number>();
  const improvedBy = new Map<string, number>();
  const scored = new Map<string, number>();
  const pipes = new Map<string, { checked: number; agree: number; differ: number; missed: number }>();
  for (const r of rows) {
    if (r.verdict === "error") { m.errors++; continue; }
    if (r.verdict === "pending") { m.pending++; continue; }
    if (r.late) { m.late++; continue; }
    m.checked++;
    m[r.verdict]++;
    if (!r.enrols) m.notTaken++;
    if (r.hub?.link) m.links++;
    if (r.workflow.wrote) m.workflowWrote++;
    const br = r.enrols ? r.hub?.branch ?? "score" : "not taken";
    branches.set(br, (branches.get(br) ?? 0) + 1);
    if (br === "score" && r.hub) scored.set(src(r.hub.final), (scored.get(src(r.hub.final)) ?? 0) + 1);
    const hubFinal = r.hub?.final ?? r.workflow.final;
    const a = src(r.workflow.final), b = src(hubFinal);
    for (const [k, side] of [[a, "workflow"], [b, "hub"]] as const) {
      const e = bySource.get(k) ?? { workflow: 0, hub: 0 };
      e[side]++;
      bySource.set(k, e);
    }
    if (r.verdict !== "agree") pairs.set(`${a}\u0000${b}`, (pairs.get(`${a}\u0000${b}`) ?? 0) + 1);
    const p = pipes.get(r.pipeline) ?? { checked: 0, agree: 0, differ: 0, missed: 0 };
    p.checked++;
    p[r.verdict]++;
    pipes.set(r.pipeline, p);
    m.valueWorkflow += toNum(r.workflow.final.sales_potential_estimate);
    m.valueHub += toNum(hubFinal.sales_potential_estimate);
    const betterFinal = r.hub?.better?.final ?? hubFinal;
    m.valueBetter += toNum(betterFinal.sales_potential_estimate);
    if (r.hub?.better && !sameValue(betterFinal, hubFinal)) {
      m.improved++;
      improvedBy.set(br, (improvedBy.get(br) ?? 0) + 1);
    }
  }
  m.agreeShare = m.checked ? m.agree / m.checked : null;
  m.bySource = [...bySource].map(([source, e]) => ({ source, ...e })).sort((x, y) => y.workflow + y.hub - (x.workflow + x.hub));
  m.scoredBySource = [...scored].map(([source, n]) => ({ source, n })).sort((x, y) => y.n - x.n);
  m.improvedBy = [...improvedBy].map(([branch, n]) => ({ branch, n })).sort((x, y) => y.n - x.n);
  m.byBranch = [...branches].map(([branch, n]) => ({ branch, n })).sort((x, y) => y.n - x.n);
  m.pairs = [...pairs].map(([k, n]) => { const [workflow, hub] = k.split("\u0000"); return { workflow, hub, n }; }).sort((x, y) => y.n - x.n);
  m.byPipeline = [...pipes].map(([pipeline, e]) => ({ pipeline, ...e })).sort((x, y) => y.checked - x.checked);
  return m;
}

/** 00:00 in Zurich on the day of `ms`, `add` days later. */
export function zurichMidnight(ms: number, add = 0): number {
  const d = new Date(ms).toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" });
  const base = Date.parse(`${d}T00:00:00Z`) + add * 86400_000;
  for (const off of [2, 1]) {
    const t = base - off * 3600_000;
    if (new Date(t).toLocaleTimeString("en-GB", { timeZone: "Europe/Zurich", hour12: false }).startsWith("00:00")) return t;
  }
  return base - 3600_000;
}

/** The workflow's enrolment on a stage entry: value unknown, OR written since yesterday 00:00, OR not in the last 10 days. */
export function enrolsOnStage(value: string | null, writtenAt: string | null, at: number): boolean {
  if (value === null || value === "") return true;
  const t = writtenAt ? Date.parse(writtenAt) : NaN;
  if (!Number.isFinite(t)) return true;
  return t >= zurichMidnight(at, -1) || t < zurichMidnight(at, -10);
}

// ---------------- the hub's figures for its improvements ----------------

/** One company's first order: its orders of that day, one figure per order number. */
export function firstOrderValue(orders: { name: string; net: number; status: string }[]): number | null {
  const byBase = new Map<string, { whole: number | null; parts: number }>();
  for (const o of orders) {
    if (/credit/i.test(o.status)) continue;
    const num = o.name.split("|")[0].trim();
    const m = /^(.*)\.(\d{3})$/.exec(num);
    const base = m ? m[1] : num, pos = m ? m[2] : "000";
    const e = byBase.get(base) ?? { whole: null, parts: 0 };
    if (pos === "000") e.whole = (e.whole ?? 0) + o.net; else e.parts += o.net;
    byBase.set(base, e);
  }
  if (!byBase.size) return null;
  let sum = 0;
  for (const e of byBase.values()) sum += e.whole ?? e.parts;
  return sum > 0 ? sum : null;
}

export function averageOf(values: (number | null)[]): { avg: number | null; median: number | null; n: number } {
  const v = values.filter((x): x is number => x !== null && x > 0).sort((a, b) => a - b);
  if (!v.length) return { avg: null, median: null, n: 0 };
  const mid = Math.floor(v.length / 2);
  return { avg: v.reduce((a, b) => a + b, 0) / v.length, median: v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2, n: v.length };
}

/** Each article's price per piece from what it sold for: revenue / quantity, this year and last; out of bounds = none. */
export function pricesOf(rows: { article: string; revenueCy: number; revenueLy: number; qtyCy: number; qtyLy: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    const qty = (r.qtyCy || 0) + (r.qtyLy || 0), rev = (r.revenueCy || 0) + (r.revenueLy || 0);
    if (!(qty > 0) || !(rev > 0)) continue;
    const pp = rev / qty;
    if (pp > 0.0005 && pp < 10000) out.set(r.article, pp);
  }
  return out;
}
