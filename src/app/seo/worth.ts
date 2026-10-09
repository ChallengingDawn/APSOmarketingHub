// WHAT A FINDING IS WORTH, IN EUROS A YEAR.
//
// The work queue could already tell you what was wrong. It could not tell you
// what to do first, and said so in its own comments: three analyses on three
// scales, and no honest way to claim a 70 from decay beats a 60 from quick
// wins. This file is the one scale they were missing.
//
// Every finding becomes the same thing: the clicks it would ADD in a year, times
// what a click is worth here. Then ordered by what it returns for the work it
// costs —
//
//     order = euros per year × probability ÷ effort
//
// Three honest statements about this, which the page repeats to the reader
// rather than hiding in a tooltip:
//
//   1. The CTR curve is industry data, not ours. It is the one number in the
//      calculation that does not come from APSOparts, and it is a multiplier on
//      everything, so every euro figure here is an ESTIMATE and is labelled as
//      one. Positions move it a lot: rank 3 earns roughly six times rank 10.
//
//   2. Value per click comes from the shop, not from a sector average. The
//      caller passes it in. Nobody has to guess what a visit is worth when the
//      order book knows.
//
//   3. Effort and probability are judgements, not measurements. They are
//      written down here, per kind of finding, so they can be argued with. A
//      hidden judgement is worse than a wrong one.

import type { CannibalGroup, DecayRow, QuickWin } from "./analysis";
import type { WorkDetail, WorkSource } from "./queue";

/**
 * Share of searches that click a result at each position, 1-10.
 *
 * Industry averages, used because no site can measure the CTR of a position it
 * does not hold. Below 10 the curve is flat and small; above 1 it is steep.
 * These are deliberately conservative: a model that flatters itself produces a
 * work queue nobody trusts twice.
 */
const CTR_BY_POSITION = [0.27, 0.15, 0.11, 0.08, 0.06, 0.045, 0.035, 0.03, 0.025, 0.022];

/** Beyond the first page, clicks are rare enough to treat as one small number. */
const CTR_BEYOND = 0.01;

export function ctrAt(position: number): number {
  if (!Number.isFinite(position) || position < 1) return CTR_BY_POSITION[0];
  if (position > CTR_BY_POSITION.length) return CTR_BEYOND;
  return CTR_BY_POSITION[Math.round(position) - 1];
}

/**
 * Where a finding could realistically get to — not where it would go in a
 * perfect world.
 *
 * A page at 12 can reach the bottom of page one with on-page work; a page at 4
 * can reach 2. Nothing is promised position 1: that usually needs links and
 * time, and promising it is how these models lose their credibility.
 */
export function targetPosition(current: number): number {
  if (current <= 3) return Math.max(1, current - 1);
  if (current <= 6) return 2;
  if (current <= 10) return 4;
  if (current <= 20) return 8;
  return 12;
}

/** How much of the year the gain applies to, for work done today. */
const YEAR_FRACTION = 0.75;

export type Effort = "small" | "medium" | "large";

const EFFORT_WEIGHT: Record<Effort, number> = { small: 1, medium: 2.5, large: 6 };

/**
 * What each kind of finding costs and how often the work pays off.
 *
 * Quick wins are first because they are nearly free and usually work: the page
 * already ranks, Google already understands it. Decay is cheap but less
 * certain — a page can fall because the market moved, and no amount of
 * rewriting brings that back. Cannibalisation is the most work, because it
 * means merging or retargeting real pages, and the most certain, because the
 * demand is already proven and is simply being split.
 */
const JUDGEMENT: Record<WorkSource, { effort: Effort; probability: number; why: string }> = {
  "quick-win": {
    effort: "small",
    probability: 0.5,
    why: "The page already ranks on page one or just below, so this is on-page work on something Google already understands.",
  },
  decay: {
    effort: "medium",
    probability: 0.35,
    why: "Refreshing a page that has slipped. Lower odds than a quick win: some pages fall because the demand moved, and nothing brings that back.",
  },
  cannibalisation: {
    effort: "large",
    probability: 0.6,
    why: "Merging or retargeting real pages — the most work here, and the most likely to pay, because the demand is proven and is only being split.",
  },
};

export type Worth = {
  /** Extra clicks a year, if the work lands. */
  clicksPerYear: number;
  /** Those clicks in euros, at the value the caller supplied. */
  eurosPerYear: number;
  effort: Effort;
  probability: number;
  /** euros × probability ÷ effort weight. The only number the queue sorts on. */
  score: number;
  /** One sentence naming the arithmetic for THIS row, with its real numbers. */
  basis: string;
  why: string;
};

const round = (n: number) => Math.round(n);

/**
 * A finding's worth.
 *
 * `valuePerClick` is euros, and is the caller's business: the SEO pages pass
 * what the shop actually earns per visit rather than a sector figure.
 * `windowDays` scales the window's impressions up to a year.
 */
export function worthOf(
  detail: WorkDetail,
  opts: { valuePerClick: number; windowDays: number },
): Worth {
  const perYear = 365 / Math.max(1, opts.windowDays);
  const judgement = JUDGEMENT[detail.source];

  let clicksPerYear = 0;
  let basis = "";

  if (detail.source === "quick-win") {
    const w: QuickWin = detail.win;
    const target = targetPosition(w.position);
    const gainPerImpression = Math.max(0, ctrAt(target) - ctrAt(w.position));
    clicksPerYear = w.impressions * perYear * gainPerImpression * YEAR_FRACTION;
    basis =
      `${round(w.impressions * perYear).toLocaleString("en-GB")} impressions a year at position ` +
      `${w.position.toFixed(1)} (${(ctrAt(w.position) * 100).toFixed(1)}% click through). ` +
      `At position ${target} that is ${(ctrAt(target) * 100).toFixed(1)}%.`;
  } else if (detail.source === "decay") {
    const r: DecayRow = detail.row;
    // What it used to earn and no longer does. Recovery is the ceiling, not a
    // new high — claiming a decayed page will beat its own best is wishful.
    clicksPerYear = Math.max(0, r.deltaClicks) * perYear * YEAR_FRACTION;
    basis =
      `It earned ${r.previousClicks.toLocaleString("en-GB")} clicks in the previous window and ` +
      `${r.currentClicks.toLocaleString("en-GB")} in this one. Recovering the difference is the ceiling.`;
  } else {
    const g: CannibalGroup = detail.group;
    // Two pages splitting one query lose to a single stronger one. The gain
    // taken here is the CTR of the best position they already hold applied to
    // the impressions currently divided between them, less what they earn now.
    const best = g.bestPosition ?? 10;
    const couldEarn = g.totalImpressions * ctrAt(Math.max(1, best - 1));
    clicksPerYear = Math.max(0, couldEarn - g.totalClicks) * perYear * YEAR_FRACTION;
    basis =
      `${g.pageCount} pages split ${g.totalImpressions.toLocaleString("en-GB")} impressions for this query and ` +
      `earn ${g.totalClicks.toLocaleString("en-GB")} clicks between them. One page at position ` +
      `${Math.max(1, Math.round(best - 1))} would earn more.`;
  }

  const eurosPerYear = clicksPerYear * opts.valuePerClick;
  return {
    clicksPerYear,
    eurosPerYear,
    effort: judgement.effort,
    probability: judgement.probability,
    score: (eurosPerYear * judgement.probability) / EFFORT_WEIGHT[judgement.effort],
    basis,
    why: judgement.why,
  };
}

/**
 * What one visit from search is worth, from the shop's own numbers.
 *
 * Revenue divided by sessions. Returns null rather than a default when the
 * figures are missing: a euro column built on an invented constant is worse
 * than no euro column, because it looks like it came from somewhere.
 */
export function valuePerClickFrom(revenue: number | null, sessions: number | null): number | null {
  if (!revenue || !sessions || sessions <= 0 || revenue <= 0) return null;
  return revenue / sessions;
}

export const WORTH_NOTES = {
  ctr: "Click-through by position is an industry average — the one figure here that is not ours. It multiplies every estimate, so treat the euros as an order of magnitude, not a forecast.",
  year: `Gains are counted over ${Math.round(YEAR_FRACTION * 100)}% of a year, because work done today does not earn from January.`,
  judgement: "Effort and likelihood are judgements, written down per kind of finding so they can be argued with.",
} as const;

export { EFFORT_WEIGHT, JUDGEMENT, YEAR_FRACTION };
