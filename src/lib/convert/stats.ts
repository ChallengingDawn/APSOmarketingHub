// APSOconvert > THE FIGURES OF A PAGE TEST - pure (no "@/" imports), so the tests compile it as it is.
//
// Two variants: "a" the page as it is, "b" the version. Per variant the gateway counts the visitors who took part (one
// per browser, with statistics consent) and those who put something in the cart on that page view (the goal). Here:
//   - each variant's cart rate with its 95% interval (Wilson - honest at small numbers and near 0%);
//   - the uplift of b over a (b's rate / a's rate - 1) with its 95% interval, from the two Beta posteriors;
//   - P(b best): the chance b's true rate is above a's - exact for Beta(1 + carts, 1 + visitors - carts) priors
//     (Evan Miller's sum), the same model the gateway's bandit samples from;
//   - the expected loss of picking each one (how much cart rate we give away if it is the wrong pick);
//   - a verdict in plain words, and the visitors still needed to see the smallest uplift worth having.
// The Monte Carlo draws are seeded: the same counts give the same figures on every screen and in every test.
//
// RULES (SARCLA / the contract, 08.11.2026): a winner needs P >= 95%, >= 300 visitors in each variant and >= 7 days;
// the version is stopped as harmful when P(b worse) >= 99% with >= 200 visitors in each variant (no wait for the days).

export type Arm = { visitors: number; carts: number };
export type Interval = { mid: number | null; low: number | null; high: number | null };
export type ArmStats = Arm & { rate: number | null; low: number | null; high: number | null };

export const RULES = { winP: 0.95, minVisitors: 300, minDays: 7, harmP: 0.99, harmMinVisitors: 200 } as const;
/** The smallest uplift worth having, by default: +10% on the original's cart rate. */
export const DEFAULT_MDE = 0.1;
const Z95 = 1.959963984540054;
const Z80 = 0.8416212335729143;

const clean = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : typeof n === "string" && Number(n) > 0 ? Math.floor(Number(n)) : 0);
/** Counts as the gateway gives them (Postgres counts can arrive as strings); carts never above visitors. */
export function arm(visitors: unknown, carts: unknown): Arm {
  const v = clean(visitors);
  return { visitors: v, carts: Math.min(v, clean(carts)) };
}

/** Wilson score interval of x out of n at 95%. */
export function wilson(x: number, n: number, z = Z95): ArmStats {
  if (n <= 0) return { visitors: 0, carts: 0, rate: null, low: null, high: null };
  const p = x / n;
  const z2 = z * z;
  const den = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return { visitors: n, carts: x, rate: p, low: x === 0 ? 0 : Math.max(0, centre - half), high: x === n ? 1 : Math.min(1, centre + half) };
}

/* ── the numbers underneath ─────────────────────────────────────────── */

/** log Γ(x), Lanczos (g = 7, n = 9), good to ~15 digits for x > 0. */
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
export function lgamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  const y = x - 1;
  let a = LANCZOS[0];
  const t = y + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (y + i);
  return 0.5 * Math.log(2 * Math.PI) + (y + 0.5) * Math.log(t) - t + Math.log(a);
}
const lbeta = (a: number, b: number) => lgamma(a) + lgamma(b) - lgamma(a + b);

/**
 * P(rate of b > rate of a) for Beta(1 + carts, 1 + visitors - carts) on each side - exact (Evan Miller, "Formulas for
 * Bayesian A/B testing"): a sum of 1 + b.carts terms, each in logarithms so large counts do not overflow.
 */
export function probBBeatsA(a: Arm, b: Arm): number {
  const aA = 1 + a.carts, bA = 1 + a.visitors - a.carts;
  const aB = 1 + b.carts, bB = 1 + b.visitors - b.carts;
  // the sum runs over b's successes: when b has more, swap the sides and take the complement (same value, fewer terms)
  if (aB > aA + 2000) return 1 - probBBeatsA(b, a);
  let total = 0;
  const base = lbeta(aA, bA);
  for (let i = 0; i < aB; i++) {
    total += Math.exp(lbeta(aA + i, bA + bB) - Math.log(bB + i) - lbeta(1 + i, bB) - base);
  }
  return Math.min(1, Math.max(0, total));
}

/** A small seeded random source (mulberry32): the same seed, the same draws. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rnd: () => number): number {
  let u = 0;
  while (u === 0) u = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}
/** Gamma(shape >= 1) by Marsaglia and Tsang. */
function gamma(shape: number, rnd: () => number): number {
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do { x = gauss(rnd); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = rnd();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
function betaDraw(a: number, b: number, rnd: () => number): number {
  const x = gamma(a, rnd);
  return x / (x + gamma(b, rnd));
}
function quantile(sorted: number[], q: number): number {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/* ── one comparison ───────────────────────────────────────────────────── */

export type Comparison = {
  a: ArmStats;
  b: ArmStats;
  /** b's rate / a's rate - 1: mid from the counts, the interval from the posteriors */
  uplift: Interval;
  /** b's rate - a's rate, in points of cart rate */
  diff: Interval;
  /** the chance each variant is the better one; null before both have a visitor */
  pBest: { a: number; b: number } | null;
  /** expected cart rate given away by picking each (absolute, e.g. 0.002 = 0.2 points) */
  loss: { a: number; b: number } | null;
};

export const SEED = 20261108;
export const DRAWS = 20_000;

export function compare(aIn: Arm, bIn: Arm, opts: { draws?: number; seed?: number } = {}): Comparison {
  const a = wilson(aIn.carts, aIn.visitors);
  const b = wilson(bIn.carts, bIn.visitors);
  const none: Interval = { mid: null, low: null, high: null };
  if (!a.visitors || !b.visitors) return { a, b, uplift: none, diff: { ...none, mid: a.rate !== null && b.rate !== null ? b.rate - a.rate : null }, pBest: null, loss: null };
  const pb = probBBeatsA(aIn, bIn);
  const rnd = seeded(opts.seed ?? SEED);
  const n = Math.max(1000, Math.min(200_000, opts.draws ?? DRAWS));
  const ups: number[] = new Array(n);
  const ds: number[] = new Array(n);
  let lossA = 0, lossB = 0;
  for (let i = 0; i < n; i++) {
    const ra = betaDraw(1 + aIn.carts, 1 + aIn.visitors - aIn.carts, rnd);
    const rb = betaDraw(1 + bIn.carts, 1 + bIn.visitors - bIn.carts, rnd);
    ups[i] = rb / ra - 1;
    ds[i] = rb - ra;
    if (ra > rb) lossB += ra - rb; else lossA += rb - ra;
  }
  ups.sort((x, y) => x - y);
  ds.sort((x, y) => x - y);
  return {
    a, b,
    uplift: { mid: a.rate ? (b.rate as number) / a.rate - 1 : null, low: quantile(ups, 0.025), high: quantile(ups, 0.975) },
    diff: { mid: (b.rate as number) - (a.rate as number), low: quantile(ds, 0.025), high: quantile(ds, 0.975) },
    pBest: { a: 1 - pb, b: pb },
    loss: { a: lossA / n, b: lossB / n },
  };
}

/* ── how many visitors it takes ───────────────────────────────────────── */

/**
 * Visitors per variant to see a relative uplift `mde` on a base cart rate (two-sided 5%, power 80%, two proportions).
 * Null when the base rate is not known (0 or missing) - we do not guess one.
 */
export function visitorsNeeded(baseRate: number | null | undefined, mde: number): number | null {
  if (!baseRate || baseRate <= 0 || baseRate >= 1 || !(mde > 0)) return null;
  const p1 = baseRate;
  const p2 = Math.min(0.999, baseRate * (1 + mde));
  const pBar = (p1 + p2) / 2;
  const top = Z95 * Math.sqrt(2 * pBar * (1 - pBar)) + Z80 * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  return Math.ceil((top * top) / ((p2 - p1) * (p2 - p1)));
}

/** Whole days between the start and now (a test started this morning has run 0 days). */
export function daysRunning(since: string | null | undefined, now: Date | string = new Date()): number {
  if (!since) return 0;
  const s = Date.parse(since);
  const n = typeof now === "string" ? Date.parse(now) : now.getTime();
  if (!Number.isFinite(s) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor((n - s) / 86_400_000));
}

/* ── the verdict ─────────────────────────────────────────────────────── */

export type VerdictKey = "running" | "b-wins" | "a-wins" | "no-difference" | "harm";
export const VERDICT_TEXT: Record<VerdictKey, string> = {
  running: "Keep it running",
  "b-wins": "The version wins",
  "a-wins": "The original wins",
  "no-difference": "No real difference",
  harm: "Stop: the version hurts",
};
export const VERDICT_TINT: Record<VerdictKey, "slate" | "green" | "amber" | "blue" | "pink"> = {
  running: "blue", "b-wins": "green", "a-wins": "amber", "no-difference": "slate", harm: "pink",
};

export type Verdict = {
  key: VerdictKey;
  text: string;
  /** one sentence: why this verdict, in plain words */
  why: string;
  /** visitors per variant to see the smallest uplift (null while the original's rate is unknown) */
  needed: number | null;
  /** visitors still to come in each variant before a verdict can be given (the minimum and `needed`) */
  more: { a: number; b: number };
  /** about how many more days at the traffic so far (null when it cannot be said) */
  moreDays: number | null;
  /** decided = a winner, a harm stop or no real difference: the test can end */
  decided: boolean;
};

const pctTxt = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;
const certainty = (p: number) => `${Math.round(p * 100)}%`;

/**
 * The verdict of a comparison after `days` days. `mde` = the smallest uplift worth having (relative, 0.1 = +10%);
 * `baseRate` = the original's cart rate to plan with before the test has its own (e.g. the page's rate in Analytics).
 */
export function verdictOf(c: Comparison, days: number, opts: { mde?: number; baseRate?: number | null } = {}): Verdict {
  const mde = opts.mde && opts.mde > 0 ? opts.mde : DEFAULT_MDE;
  const base = c.a.visitors >= 100 && c.a.rate ? c.a.rate : opts.baseRate ?? c.a.rate;
  const needed = visitorsNeeded(base, mde);
  const target = Math.max(RULES.minVisitors, needed ?? 0);
  const more = { a: Math.max(0, target - c.a.visitors), b: Math.max(0, target - c.b.visitors) };
  const perDay = days > 0 ? { a: c.a.visitors / days, b: c.b.visitors / days } : null;
  const moreDays = (() => {
    const dayGap = Math.max(0, RULES.minDays - days);
    if (!more.a && !more.b) return dayGap;
    if (!perDay || (!perDay.a && more.a) || (!perDay.b && more.b)) return null;
    const v = Math.max(more.a ? more.a / perDay.a : 0, more.b ? more.b / perDay.b : 0);
    return Math.max(dayGap, Math.ceil(v));
  })();
  const base_ = { needed, more, moreDays };
  const minN = Math.min(c.a.visitors, c.b.visitors);
  const p = c.pBest;
  const ok = (k: VerdictKey, why: string, decided: boolean): Verdict => ({ key: k, text: VERDICT_TEXT[k], why, decided, ...base_ });

  if (p && minN >= RULES.harmMinVisitors && p.a >= RULES.harmP) {
    return ok("harm", `With ${certainty(p.a)} certainty the version makes fewer visitors put something in the cart (${pctTxt(c.b.rate ?? 0)} against ${pctTxt(c.a.rate ?? 0)}) - stop it.`, true);
  }
  const enough = minN >= RULES.minVisitors && days >= RULES.minDays;
  if (p && enough && p.b >= RULES.winP) {
    return ok("b-wins", `With ${certainty(p.b)} certainty the version brings more add-to-carts: ${pctTxt(c.b.rate ?? 0)} against ${pctTxt(c.a.rate ?? 0)}.`, true);
  }
  if (p && enough && p.a >= RULES.winP) {
    return ok("a-wins", `With ${certainty(p.a)} certainty the page as it is does better: ${pctTxt(c.a.rate ?? 0)} against ${pctTxt(c.b.rate ?? 0)} for the version.`, true);
  }
  const narrow = c.uplift.low !== null && c.uplift.high !== null && c.uplift.low > -mde && c.uplift.high < mde;
  const powered = needed !== null && minN >= needed;
  if (p && enough && (narrow || powered)) {
    return ok("no-difference", `After ${Math.min(c.a.visitors, c.b.visitors).toLocaleString("en-US")}+ visitors each, any difference is smaller than the ${Math.round(mde * 100)}% worth having - the version changes nothing that counts.`, true);
  }
  // still running: say what is missing
  const missing: string[] = [];
  if (days < RULES.minDays) missing.push(`${RULES.minDays - days} more ${RULES.minDays - days === 1 ? "day" : "days"} (a full week of shop days)`);
  if (more.a || more.b) {
    const f = (x: number) => x.toLocaleString("en-US");
    missing.push(more.a && more.b
      ? `${f(more.a)} more visitors on the original and ${f(more.b)} on the version`
      : more.a ? `${f(more.a)} more visitors on the original` : `${f(more.b)} more visitors on the version`);
  }
  if (p && missing.length === 0) missing.push(`more certainty - ${certainty(Math.max(p.a, p.b))} now, ${certainty(RULES.winP)} needed`);
  const why = !p
    ? "No visitor counted in both variants yet."
    : `${missing.length ? `Needs ${missing.join(", ")}.` : ""}${p.b >= 0.5 ? ` So far the version leads: ${certainty(p.b)} likely better.` : ` So far the original leads: ${certainty(p.a)} likely better.`}`.trim();
  return ok("running", why, false);
}

/* ── the whole result of a test ──────────────────────────────────────── */

export type DailyRow = { day: string; key: "a" | "b"; visitors: number; carts: number };
export type DailyPoint = {
  day: string;
  /** visitors counted that day */
  a: number; b: number;
  /** the cart rate so far (all days up to this one) */
  rateA: number | null; rateB: number | null;
  /** the version's share of that day's visitors */
  shareB: number | null;
};

/** One point per day from the first to the last, with the cart rate so far and the version's share of the day. */
export function dailySeries(rows: DailyRow[]): DailyPoint[] {
  const by = new Map<string, { a: Arm; b: Arm }>();
  for (const r of rows) {
    const day = String(r.day).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const e = by.get(day) ?? { a: { visitors: 0, carts: 0 }, b: { visitors: 0, carts: 0 } };
    const k = r.key === "b" ? "b" : "a";
    const x = arm(r.visitors, r.carts);
    e[k] = { visitors: e[k].visitors + x.visitors, carts: e[k].carts + x.carts };
    by.set(day, e);
  }
  const days = [...by.keys()].sort();
  if (!days.length) return [];
  // fill the days without visitors, so the line keeps time
  const all: string[] = [];
  for (let t = Date.parse(`${days[0]}T00:00:00Z`), end = Date.parse(`${days[days.length - 1]}T00:00:00Z`); t <= end && all.length < 400; t += 86_400_000) {
    all.push(new Date(t).toISOString().slice(0, 10));
  }
  const cum = { a: { visitors: 0, carts: 0 }, b: { visitors: 0, carts: 0 } };
  return all.map((day) => {
    const e = by.get(day) ?? { a: { visitors: 0, carts: 0 }, b: { visitors: 0, carts: 0 } };
    for (const k of ["a", "b"] as const) { cum[k].visitors += e[k].visitors; cum[k].carts += e[k].carts; }
    const tot = e.a.visitors + e.b.visitors;
    return {
      day, a: e.a.visitors, b: e.b.visitors,
      rateA: cum.a.visitors ? cum.a.carts / cum.a.visitors : null,
      rateB: cum.b.visitors ? cum.b.carts / cum.b.visitors : null,
      shareB: tot ? e.b.visitors / tot : null,
    };
  });
}

export type SegmentDim = "device" | "store" | "login" | "visitor" | "source";
export const SEGMENT_DIMS: SegmentDim[] = ["device", "store", "login", "visitor", "source"];
export const SEGMENT_LABEL: Record<SegmentDim, string> = {
  device: "Device", store: "Store view", login: "Signed in or not", visitor: "New or returning", source: "Came from",
};
const VALUE_LABEL: Record<string, string> = {
  desktop: "Desktop", phone: "Phone", guest: "Guest", customer: "Signed-in customer", new: "New", returning: "Returning",
  search: "Search engine", ads: "Ads", direct: "Direct", email: "E-mail", other: "Other site", "": "Not known",
};
export const valueLabel = (v: string | null | undefined) => VALUE_LABEL[v ?? ""] ?? String(v);

export type SegmentRow = {
  dim: SegmentDim; value: string; label: string;
  a: ArmStats; b: ArmStats;
  uplift: number | null;
  /** P(b better) in this segment - null with nobody on one side */
  pB: number | null;
  /** fewer than 100 visitors in a variant: the uplift says little */
  few: boolean;
};
export const SEGMENT_MIN = 100;

/** Per segment value: both variants' rates, b's uplift and P(b better); the biggest segments first. */
export function segmentRows(segments: Partial<Record<SegmentDim, { value: string; key: "a" | "b"; visitors: number; carts: number }[]>> | null | undefined): SegmentRow[] {
  const out: SegmentRow[] = [];
  for (const dim of SEGMENT_DIMS) {
    const list = segments?.[dim] ?? [];
    const by = new Map<string, { a: Arm; b: Arm }>();
    for (const r of list) {
      const v = r.value === null || r.value === undefined ? "" : String(r.value);
      const e = by.get(v) ?? { a: { visitors: 0, carts: 0 }, b: { visitors: 0, carts: 0 } };
      const k = r.key === "b" ? "b" : "a";
      const x = arm(r.visitors, r.carts);
      e[k] = { visitors: e[k].visitors + x.visitors, carts: e[k].carts + x.carts };
      by.set(v, e);
    }
    const rows = [...by].map(([value, e]) => {
      const a = wilson(e.a.carts, e.a.visitors), b = wilson(e.b.carts, e.b.visitors);
      return {
        dim, value, label: valueLabel(value), a, b,
        uplift: a.rate && b.rate !== null ? b.rate / a.rate - 1 : null,
        pB: e.a.visitors && e.b.visitors ? probBBeatsA(e.a, e.b) : null,
        few: e.a.visitors < SEGMENT_MIN || e.b.visitors < SEGMENT_MIN,
      };
    });
    rows.sort((x, y) => y.a.visitors + y.b.visitors - (x.a.visitors + x.b.visitors));
    out.push(...rows);
  }
  return out;
}

/** What the page shows of a test's results: the comparison, the verdict, the days, the segments. */
export type Analysis = {
  comparison: Comparison;
  verdict: Verdict;
  days: number;
  daily: DailyPoint[];
  segments: SegmentRow[];
};

export function analyse(input: {
  variants: { key: "a" | "b"; visitors: number; carts: number }[];
  daily?: DailyRow[];
  segments?: Partial<Record<SegmentDim, { value: string; key: "a" | "b"; visitors: number; carts: number }[]>> | null;
  since: string | null;
}, now: Date | string = new Date(), opts: { mde?: number; baseRate?: number | null; seed?: number } = {}): Analysis {
  const get = (k: "a" | "b") => {
    const rows = input.variants.filter((v) => v.key === k);
    return rows.reduce((s, r) => { const x = arm(r.visitors, r.carts); return { visitors: s.visitors + x.visitors, carts: s.carts + x.carts }; }, { visitors: 0, carts: 0 });
  };
  const comparison = compare(get("a"), get("b"), { seed: opts.seed });
  const days = daysRunning(input.since, now);
  return {
    comparison,
    verdict: verdictOf(comparison, days, opts),
    days,
    daily: dailySeries(input.daily ?? []),
    segments: segmentRows(input.segments),
  };
}
