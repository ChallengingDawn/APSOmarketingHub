/**
 * Side-by-side arithmetic for the competitor comparison.
 *
 * Nothing here re-scores anything: it reads two `GeoAuditResult`s produced by
 * the same auditor and states, per check, who an answer engine would rather
 * quote and by how many weighted points. The gap is the only number invented,
 * and it is a subtraction.
 */

import {
  geoCheckDefinition,
  GEO_CHECKS,
  type GeoAuditResult,
  type GeoCheckId,
  type GeoCheckResult,
} from "./audit";

export type ComparisonSide = "ours" | "theirs" | "tie";

export type GeoComparisonRow = {
  id: GeoCheckId;
  label: string;
  short: string;
  weight: number;
  ours: GeoCheckResult | null;
  theirs: GeoCheckResult | null;
  winner: ComparisonSide;
  /**
   * Weighted points of the 100-point score this check hands to the competitor.
   * Positive when they are ahead, negative when we are.
   */
  gap: number;
};

export type GeoComparison = {
  ourScore: number;
  theirScore: number;
  /** Their score minus ours: positive means we are behind. */
  scoreGap: number;
  winner: ComparisonSide;
  rows: GeoComparisonRow[];
  /** Only the checks they beat us on, worst gap first. */
  losses: GeoComparisonRow[];
  /** Only the checks we beat them on, biggest lead first. */
  wins: GeoComparisonRow[];
  /** One plain-language sentence stating where the comparison is decided. */
  verdict: string;
};

function findCheck(audit: GeoAuditResult, id: GeoCheckId): GeoCheckResult | null {
  return audit.checks.find((c) => c.id === id) ?? null;
}

export function compareGeoAudits(ours: GeoAuditResult, theirs: GeoAuditResult): GeoComparison {
  const rows: GeoComparisonRow[] = GEO_CHECKS.map((def) => {
    const a = findCheck(ours, def.id);
    const b = findCheck(theirs, def.id);
    const gap = (((b?.score ?? 0) - (a?.score ?? 0)) * def.weight) / 100;
    const winner: ComparisonSide = Math.abs(gap) < 0.05 ? "tie" : gap > 0 ? "theirs" : "ours";
    return {
      id: def.id,
      label: def.label,
      short: geoCheckDefinition(def.id).short,
      weight: def.weight,
      ours: a,
      theirs: b,
      winner,
      gap,
    };
  });

  const losses = rows.filter((r) => r.winner === "theirs").sort((x, y) => y.gap - x.gap);
  const wins = rows.filter((r) => r.winner === "ours").sort((x, y) => x.gap - y.gap);

  const scoreGap = theirs.score - ours.score;
  const winner: ComparisonSide = scoreGap === 0 ? "tie" : scoreGap > 0 ? "theirs" : "ours";

  return {
    ourScore: ours.score,
    theirScore: theirs.score,
    scoreGap,
    winner,
    rows,
    losses,
    wins,
    verdict: buildVerdict({ scoreGap, losses, wins }),
  };
}

function points(n: number): string {
  const rounded = Math.abs(n);
  return `${rounded.toFixed(1)} point${rounded >= 0.95 && rounded < 1.05 ? "" : "s"}`;
}

function buildVerdict(args: {
  scoreGap: number;
  losses: GeoComparisonRow[];
  wins: GeoComparisonRow[];
}): string {
  const { scoreGap, losses, wins } = args;
  const worst = losses[0];
  const best = wins[0];

  if (losses.length === 0) {
    return best
      ? `We are ahead on every check that separates the two pages, led by ${best.label.toLowerCase()} (${points(best.gap)}). An answer engine has no structural reason to prefer theirs.`
      : "The two pages score identically on all seven checks — neither page gives an answer engine a reason to prefer the other.";
  }

  const lead = `We lose ${points(worst.gap)} on ${worst.label.toLowerCase()}${
    losses.length > 1
      ? `, then ${losses
          .slice(1, 3)
          .map((l) => `${l.label.toLowerCase()} (${points(l.gap)})`)
          .join(" and ")}`
      : ""
  }.`;

  if (scoreGap > 0) {
    return `${lead} That is what puts their page ${points(scoreGap)} ahead overall — fix those checks first and the gap closes.`;
  }
  if (scoreGap === 0) {
    return `${lead} The overall scores are level, so these checks are where the tie breaks against us.`;
  }
  return `${lead} We still lead overall by ${points(scoreGap)}, but those checks are the ones they could take from us.`;
}
