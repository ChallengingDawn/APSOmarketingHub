// TICKET VALUE - the comparison (pure): the three properties as the hub would leave them and as the workflow left them,
// the verdict per ticket, and the figures over many tickets. No "@/" imports: the tests load it as it is.

import { toNum, type Patch } from "./rules";
export { firstOrderValue } from "./rules";

export type Values = { sales_potential_estimate: string | null; sales_potential_source: string | null; sales_potential_confidence: string | null };
/** agree = both leave the same value · differ = both wrote, not the same · missed = the hub would write, the workflow did
 *  not · pending = the workflow's writes not read yet */
export type Verdict = "agree" | "differ" | "missed" | "pending" | "error" | "live";

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
  hub: { branch: string; final: Values; link?: string | null; better?: { final: Values; rule?: string } } | null; workflow: { wrote: boolean; final: Values };
  written?: { changed: boolean; error?: string };
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
  /** the hub's own rules: per path (the rule that gave the value) and per confidence - tickets and value */
  byRule: { rule: string; n: number; value: number }[];
  byConfidence: { confidence: string; n: number; value: number }[];
  /** ESO and TSA tickets with a value from the hub's rules */
  valued: number;
  /** looked at before the hub recorded the path (21.10.2026 12:29) - left out of the hub's figures */
  earlier: number;
  /** live: tickets the hub handled, and the ones it changed */
  live: number; written: number;
};

const src = (v: Values) => norm(v.sales_potential_source) ?? "(none)";

export function measure(rows: RowLike[]): Measure {
  const m: Measure = { rows: rows.length, checked: 0, agree: 0, differ: 0, missed: 0, errors: 0, pending: 0, late: 0, agreeShare: null, notTaken: 0, links: 0, workflowWrote: 0, bySource: [], byBranch: [], scoredBySource: [], pairs: [], byPipeline: [], valueWorkflow: 0, valueHub: 0, improved: 0, improvedBy: [], valueBetter: 0, byRule: [], byConfidence: [], valued: 0, earlier: 0, live: 0, written: 0 };
  const bySource = new Map<string, { workflow: number; hub: number }>();
  const pairs = new Map<string, number>();
  const branches = new Map<string, number>();
  const improvedBy = new Map<string, number>();
  const byRule = new Map<string, { n: number; value: number }>();
  const byConf = new Map<string, { n: number; value: number }>();
  const add = (mp: Map<string, { n: number; value: number }>, k: string, v: number) => { const e = mp.get(k) ?? { n: 0, value: 0 }; e.n++; e.value += v; mp.set(k, e); };
  const scored = new Map<string, number>();
  const pipes = new Map<string, { checked: number; agree: number; differ: number; missed: number }>();
  for (const r of rows) {
    if (r.verdict === "error") { m.errors++; continue; }
    if (r.verdict === "pending") { m.pending++; continue; }
    if (r.late) { m.late++; continue; }
    const hubFinal = r.hub?.final ?? r.workflow.final;
    // ---- the hub's own rules (shadow and live): only tickets whose path was recorded
    const rule = r.hub?.better?.rule;
    const betterFinal = r.hub?.better?.final ?? hubFinal;
    const outside = rule === "not-eso-tsa";
    if (r.hub?.better && !rule) m.earlier++;
    if (rule) {
      const v = outside ? 0 : toNum(betterFinal.sales_potential_estimate);
      add(byRule, rule, v);
      if (!outside) { add(byConf, norm(betterFinal.sales_potential_confidence) ?? "(none)", v); m.valueBetter += v; m.valued++; }
    }
    if (r.verdict === "live") {
      m.live++;
      if (r.written?.changed) m.written++;
      continue;
    }
    // ---- the copy against the workflow (shadow only)
    m.checked++;
    m[r.verdict]++;
    if (!r.enrols) m.notTaken++;
    if (r.hub?.link) m.links++;
    if (r.workflow.wrote) m.workflowWrote++;
    const br = r.enrols ? r.hub?.branch ?? "score" : "not taken";
    branches.set(br, (branches.get(br) ?? 0) + 1);
    if (br === "score" && r.hub) scored.set(src(r.hub.final), (scored.get(src(r.hub.final)) ?? 0) + 1);
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
    if (rule && !outside && !sameValue(betterFinal, hubFinal)) {
      m.improved++;
      improvedBy.set(br, (improvedBy.get(br) ?? 0) + 1);
    }
  }
  m.agreeShare = m.checked ? m.agree / m.checked : null;
  m.bySource = [...bySource].map(([source, e]) => ({ source, ...e })).sort((x, y) => y.workflow + y.hub - (x.workflow + x.hub));
  m.scoredBySource = [...scored].map(([source, n]) => ({ source, n })).sort((x, y) => y.n - x.n);
  m.byRule = [...byRule].map(([rule, e]) => ({ rule, ...e })).sort((x, y) => y.n - x.n);
  m.byConfidence = [...byConf].map(([confidence, e]) => ({ confidence, ...e })).sort((x, y) => y.n - x.n);
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

// ---------------- the period figures: a ticket's path, read from what is on it (24.10.2026) ----------------

type TicketProps = Record<string, string | null | undefined>;
const LOST_LEAD = /^\s*lost\s*lead\b/i, SECOND_PURCHASE = /^\s*push\s*for\s*second\s*purchase\b/i, PUSH = /\bpush\b/i, CART = /abandoned\s*cart/i;
const NEW_CUSTOMER = ["43412670", "43412983"];
/**
 * Where the value on a ticket comes from, from the ticket itself (its source, confidence, keys and subject) - the
 * same paths as the hub's rules, so a month before the hub took over reads the same way. "none" = no value yet.
 */
export function pathOf(p: TicketProps): string {
  const src = (p.sales_potential_source ?? "").trim(), conf = (p.sales_potential_confidence ?? "").trim(), subject = p.subject ?? "";
  if (!src) return "none";
  if (src === "manual_override") return "manual";
  if (src === "unqualified") return "unqualified";
  if (p.erosion_key) return "erosion";
  if (p.price_check_key) return "pricecheck";
  if (src === "direct_field") return CART.test(subject) ? "cart" : p.sept_push_target || PUSH.test(subject) ? "push" : "direct";
  if (src === "company_baseline") {
    if ((p.hs_tag_ids ?? "").split(";").some((t) => NEW_CUSTOMER.includes(t.trim()))) return "registrant";
    if (LOST_LEAD.test(subject)) return "lostlead";
    if (SECOND_PURCHASE.test(subject) && conf === "medium") return "secondpurchase";
    return "company";
  }
  return ({ child_gqs: "gqs", text_qty_price: "textqty", product_lookup: "product", unknown: "unknown" } as Record<string, string>)[src] ?? "unknown";
}

/** A ticket's day of creation, in Zurich: YYYY-MM-DD. */
export const zurichDay = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" });

/** The tickets of one day, one pipeline, one path, one confidence: how many, their value. */
export type DayBucket = [day: string, pipe: "ESO" | "TSA", path: string, conf: string, n: number, value: number];
export type Sum = { n: number; value: number };
export type PeriodSum = { total: Sum; byPath: Record<string, Sum>; byConf: Record<string, Sum> };
export type Pipe = "both" | "ESO" | "TSA";
const emptySum = (): PeriodSum => ({ total: { n: 0, value: 0 }, byPath: {}, byConf: {} });
const add = (m: Record<string, Sum>, k: string, n: number, v: number) => { const e = (m[k] ??= { n: 0, value: 0 }); e.n += n; e.value += v; };

/** The days from..to (inclusive, YYYY-MM-DD) added up, each pipeline on its own. */
export function sumPeriod(b: DayBucket[], from: string, to: string): { ESO: PeriodSum; TSA: PeriodSum } {
  const out = { ESO: emptySum(), TSA: emptySum() };
  for (const x of b) {
    if (!Array.isArray(x)) continue; // never an older shape's bucket
    const [day, pipe, path, conf, n, value] = x;
    if (day < from || day > to || (pipe !== "ESO" && pipe !== "TSA")) continue;
    const s = out[pipe];
    s.total.n += n;
    s.total.value += value;
    add(s.byPath, path, n, value);
    add(s.byConf, conf || "(none)", n, value);
  }
  return out;
}

/** One pipeline's sums, or both added. */
export function pickPipe(s: { ESO: PeriodSum; TSA: PeriodSum }, pipe: Pipe): PeriodSum {
  if (pipe !== "both") return s[pipe];
  const out = emptySum();
  for (const x of [s.ESO, s.TSA]) {
    out.total.n += x.total.n;
    out.total.value += x.total.value;
    for (const [k, v] of Object.entries(x.byPath)) add(out.byPath, k, v.n, v.value);
    for (const [k, v] of Object.entries(x.byConf)) add(out.byConf, k, v.n, v.value);
  }
  return out;
}
