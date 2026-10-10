// GRADING AN SEO ACTION — the rules, with no database in sight.
//
// Split from actions.ts so it can be tested: the test compiler does not resolve
// the "@/" alias, so anything importing the db client cannot be covered. These
// are the decisions worth covering — what counts as better, what is too small
// to call, when a thing is old enough to judge.

export type SeoActionInput = {
  itemId: string;
  source: string;
  subject: string;
  action: string;
  eurosEstimated: number | null;
  baselineClicks: number | null;
  baselineImpressions: number | null;
  baselinePosition: number | null;
  windowDays: number;
};

export type SeoAction = SeoActionInput & {
  id: number;
  startedBy: string;
  startedAt: string;
  measuredAt: string | null;
  afterClicks: number | null;
  afterImpressions: number | null;
  afterPosition: number | null;
  droppedAt: string | null;
  droppedReason: string | null;
};

/** Search needs time to react; anything sooner is noise read as a result. */
export const WAIT_DAYS = 28;

/* ── reading the result ────────────────────────────────────────────────── */

export type Verdict = "better" | "flat" | "worse" | "waiting" | "dropped" | "unmeasurable";

export const daysSince = (iso: string, now = Date.now()) =>
  Math.floor((now - new Date(iso).getTime()) / 86_400_000);

/**
 * What happened, in one word.
 *
 * "Flat" needs a band, or ordinary week-to-week wobble reads as a result: a
 * change under a fifth of the starting clicks is not a change. Below ten
 * clicks even that is noise, so those say so rather than pretending.
 */
export function verdictOf(a: SeoAction, now = Date.now()): Verdict {
  if (a.droppedAt) return "dropped";
  if (!a.measuredAt) return daysSince(a.startedAt, now) >= WAIT_DAYS ? "waiting" : "waiting";
  const before = a.baselineClicks;
  const after = a.afterClicks;
  if (before === null || after === null) return "unmeasurable";
  if (before < 10 && after < 10) return "unmeasurable";
  const band = Math.max(2, before * 0.2);
  if (after - before > band) return "better";
  if (before - after > band) return "worse";
  return "flat";
}

export const isDue = (a: SeoAction, now = Date.now()) =>
  !a.measuredAt && !a.droppedAt && daysSince(a.startedAt, now) >= WAIT_DAYS;

/**
 * What changed, in clicks.
 *
 * Deliberately NOT converted back into euros. The estimate was a year of clicks
 * at a price per click; one window after the work is neither a year nor the
 * same window, and multiplying it back out would produce a confident-looking
 * figure that compares with nothing. Clicks before, clicks after, and the
 * difference is what can be said honestly — the euro estimate sits beside it as
 * what was PREDICTED, which is the comparison worth making.
 */
export function outcomeOf(a: SeoAction): { deltaClicks: number | null; deltaPct: number | null } {
  if (a.baselineClicks === null || a.afterClicks === null) {
    return { deltaClicks: null, deltaPct: null };
  }
  const deltaClicks = a.afterClicks - a.baselineClicks;
  return {
    deltaClicks,
    deltaPct: a.baselineClicks > 0 ? deltaClicks / a.baselineClicks : null,
  };
}
