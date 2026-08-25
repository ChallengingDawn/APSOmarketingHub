/**
 * The IMPROVE half of the GEO cockpit, expressed as arithmetic.
 *
 * The auditor (`./audit.ts`) already decides which fix matters most for a single
 * piece — `geoFixList` sorts the failing and warning checks by the weighted
 * points each one costs. Nothing here re-decides that. `geoFixRanking` *reads*
 * `geoFixList`'s output and attaches the number behind each line, so the queue
 * on screen and the brief handed to the Create studio can never fall out of
 * order with one another.
 *
 * Every figure below is derived from real audits of real stored bodies. There
 * is no projection, no estimate and no benchmark: "points recoverable" is
 * literally the score a check is not currently earning.
 */

import {
  geoCheckDefinition,
  geoFixList,
  type GeoAuditResult,
  type GeoCheckId,
  type GeoCheckResult,
} from "./audit";

/* ─────────────────────────────── per piece ────────────────────────────────── */

export type GeoFixEntry = {
  check: GeoCheckResult;
  /**
   * Points of this piece's 0-100 score that the check is not earning.
   * A check scoring 40 of 100 at weight 20 is forfeiting 12 points.
   */
  points: number;
};

/** Points a single check is currently forfeiting. Zero when it already passes. */
export function recoverablePoints(check: GeoCheckResult): number {
  return ((100 - check.score) * check.weight) / 100;
}

/**
 * The auditor's own fix ordering, with the points attached.
 *
 * The order is taken verbatim from `geoFixList` — each line it emits is matched
 * back to the check that produced it — so the queue, the row's chip order and
 * the `geoFixes` hand-off param are all one list.
 */
export function geoFixRanking(audit: GeoAuditResult, includeWarnings = true): GeoFixEntry[] {
  const byLine = new Map<string, GeoCheckResult>();
  for (const c of audit.checks) byLine.set(`${c.label}: ${c.fix}`, c);

  const entries: GeoFixEntry[] = [];
  for (const line of geoFixList(audit, includeWarnings)) {
    const check = byLine.get(line);
    if (!check) continue;
    entries.push({ check, points: recoverablePoints(check) });
  }
  return entries;
}

/**
 * Everything a piece would regain if every failing and warning check were
 * brought to a pass. Because a passing check always scores 100, this is the
 * distance from the piece's current score to 100 — stated, not approximated.
 */
export function totalRecoverable(audit: GeoAuditResult): number {
  return audit.checks.reduce((sum, c) => sum + recoverablePoints(c), 0);
}

/* ──────────────────────────────── portfolio ───────────────────────────────── */

/** One check, summed across every audited piece. */
export type GeoPortfolioFix = {
  id: GeoCheckId;
  label: string;
  /** Dense-table label from the check catalogue, e.g. "Opening". */
  short: string;
  weight: number;
  /** Pieces where this check is not passing. */
  pieces: number;
  /** Of those, how many fail outright rather than warn. */
  failing: number;
  /** Total score points the library is forfeiting on this check. */
  points: number;
  /**
   * What the portfolio average would gain if this one check were fixed
   * everywhere: `points / audited pieces`. The honest unit for "biggest win".
   */
  averageLift: number;
};

/**
 * Ranks the seven checks by the points the whole library is losing on each.
 * Checks that already pass everywhere are omitted — an empty array means the
 * portfolio has nothing left to recover, not that the data is missing.
 */
export function geoPortfolioFixes(audits: readonly GeoAuditResult[]): GeoPortfolioFix[] {
  if (!audits.length) return [];

  const acc = new Map<GeoCheckId, GeoPortfolioFix>();
  for (const audit of audits) {
    for (const c of audit.checks) {
      const points = recoverablePoints(c);
      const row =
        acc.get(c.id) ??
        {
          id: c.id,
          label: c.label,
          short: geoCheckDefinition(c.id).short,
          weight: c.weight,
          pieces: 0,
          failing: 0,
          points: 0,
          averageLift: 0,
        };
      if (c.verdict !== "pass") row.pieces += 1;
      if (c.verdict === "fail") row.failing += 1;
      row.points += points;
      acc.set(c.id, row);
    }
  }

  return Array.from(acc.values())
    .filter((r) => r.points > 0)
    .map((r) => ({ ...r, averageLift: r.points / audits.length }))
    .sort((a, b) => b.points - a.points);
}

/* ────────────────────────────── studio hand-off ───────────────────────────── */

/** Keeps the /create hand-off URL inside every browser's address-bar limit. */
export const FIX_PARAM_MAX_CHARS = 1400;

/**
 * Builds the Create-studio link for one piece.
 *
 * The parameter contract is fixed and read by `src/app/create/page.tsx`:
 * `channel`, `geoPieceId`, `geoScore`, `geoChecks`, `geoFixes`. The fix text is
 * `geoFixList`'s output joined with " | " — the same list, in the same order,
 * that the queue shows on screen.
 */
export function geoImproveHref(args: {
  channel: string;
  pieceId: number;
  audit: GeoAuditResult;
}): string {
  const fixes = geoFixList(args.audit).join(" | ").slice(0, FIX_PARAM_MAX_CHARS);
  const params = new URLSearchParams({
    channel: args.channel,
    geoPieceId: String(args.pieceId),
    geoScore: String(args.audit.score),
    geoChecks: [...args.audit.failing, ...args.audit.warning].join(","),
    geoFixes: fixes,
  });
  return `/create?${params.toString()}`;
}
