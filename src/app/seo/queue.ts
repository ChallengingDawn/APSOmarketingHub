/**
 * The consolidated work queue: every actionable finding the three analyses
 * produced, merged into one ranked list the user can work top-down.
 *
 * DATA POLICY — this module invents nothing. It does not compute a new metric,
 * it does not model, and it does not estimate. Every item carries the exact
 * analysis output that produced it (see `WorkDetail`), and the only number this
 * file adds is a normalisation of scores the analyses had already computed.
 *
 * ── Why a normalisation is needed at all ──────────────────────────────────
 *
 * The three analyses rank their own findings on three different scales:
 *
 *   quick wins       score    = impressions × proximity      (impressions)
 *   cannibalisation  severity = impressions × closeness      (impressions)
 *   decay            Δ clicks = current − previous clicks    (clicks)
 *
 * Two are in impressions, one is in clicks. There is no honest conversion
 * between them — going from clicks to impressions would require assuming a
 * click-through rate, and an assumed CTR is a fabricated number. So this module
 * does NOT put the three on a shared unit. It does the one thing that is
 * defensible without inventing anything:
 *
 *   priority = 100 × score ÷ (largest score of the SAME analysis in this window)
 *
 * That is a share-of-leader within each analysis. It says "this finding is 40%
 * as big as the biggest finding of its own kind", which is true by arithmetic.
 * It deliberately does NOT claim that a 70 from decay outranks a 60 from quick
 * wins in business terms — the UI states this limitation in full.
 *
 * Ties (including the three leaders, which all normalise to 100) are broken by
 * the impressions attached to the finding — another figure the analyses already
 * reported — and then by id, so the order is stable across renders.
 */

import {
  isDecayed,
  type CannibalGroup,
  type DecayRow,
  type QuickWin,
} from "./analysis";

/* ── create-studio hand-off ────────────────────────────────────────────── */

/**
 * Matches the /create convention: `channel` and `topic` are read by
 * src/app/create/page.tsx. Single definition so every surface in the cockpit
 * hands off identically.
 */
export function createHref(topic: string): string {
  return `/create?channel=blog&topic=${encodeURIComponent(topic)}`;
}

/** A quick win is briefed as the query itself — that is the whole topic. */
export function quickWinTopic(query: string): string {
  return query;
}

export function decayTopic(url: string): string {
  return `Refresh existing page: ${url}`;
}

export function cannibalTopic(group: CannibalGroup): string {
  const rec = group.recommendation;
  if (rec.kind === "consolidate") {
    return `Consolidate cannibalised pages for the query "${group.query}": fold ${rec.fold} into ${rec.keep} and rewrite the surviving page to own the query outright.`;
  }
  if (rec.kind === "assign-intent") {
    return `Split intent for the query "${group.query}": keep ${rec.product} as the transactional page and retune ${rec.editorial} to the informational variant of the query.`;
  }
  return `Differentiate two pages competing for the query "${group.query}": ${rec.keep} and ${rec.retarget} rank comparably — retarget one to an adjacent query or merge them into a single stronger page.`;
}

/* ── sources ───────────────────────────────────────────────────────────── */

export type WorkSource = "quick-win" | "cannibalisation" | "decay";

export const WORK_SOURCES: WorkSource[] = ["quick-win", "cannibalisation", "decay"];

export type SourceMeta = {
  /** Badge text on the row. */
  label: string;
  /** The analysis view this finding came from, named as the user sees it. */
  analysis: string;
  /** The analysis's own score, written out — shown in the score column header. */
  formula: string;
  /** What the score column's raw value means, for the tooltip. */
  unit: string;
};

export const SOURCE_META: Record<WorkSource, SourceMeta> = {
  "quick-win": {
    label: "Quick win",
    analysis: "Quick wins",
    formula: "impressions × proximity",
    unit: "Impressions weighted by how close the query already sits to the top of page one.",
  },
  cannibalisation: {
    label: "Cannibalisation",
    analysis: "Cannibalisation",
    formula: "impressions × closeness",
    unit: "Impressions being split, weighted by how close together the competing URLs rank.",
  },
  decay: {
    label: "Decay",
    analysis: "Decay",
    formula: "previous clicks − current clicks",
    unit: "Clicks the page earned in the previous period and no longer earns.",
  },
};

/** Either the analysis ran, or it could not — never a silent empty list. */
export type SourceInput<T> = { ok: true; rows: T[] } | { ok: false; reason: string };

export type SourceCoverage =
  | { status: "available"; found: number }
  | { status: "unavailable"; reason: string };

/* ── items ─────────────────────────────────────────────────────────────── */

/**
 * The untouched analysis output behind the row. The UI renders its evidence
 * columns straight out of this, so nothing on screen can drift from what the
 * analysis actually computed.
 */
export type WorkDetail =
  | { source: "quick-win"; win: QuickWin }
  | { source: "cannibalisation"; group: CannibalGroup }
  | { source: "decay"; row: DecayRow };

export type WorkItem = {
  id: string;
  /** Position in the default ranking, 1-based. Survives re-sorting the table. */
  rank: number;
  source: WorkSource;
  /** The query or URL the finding is about. */
  subject: string;
  /** What to do, in the imperative — chosen by the analysis, not by this file. */
  action: string;
  /** The analysis's own score, in the analysis's own unit. Always displayed. */
  nativeScore: number;
  /** 0–100 share of the largest native score of the same source in this window. */
  priority: number;
  /** Impressions the analysis reported for this finding. Tie-break only. */
  impressions: number;
  /** Prefilled Create Studio topic. */
  topic: string;
  detail: WorkDetail;
};

export type WorkQueueResult = {
  items: WorkItem[];
  coverage: Record<WorkSource, SourceCoverage>;
  /** Largest native score per source — the denominator behind every priority. */
  leaders: Record<WorkSource, number>;
};

/** Item before ranking: rank and priority are assigned once all sources are in. */
type Draft = Omit<WorkItem, "rank" | "priority">;

function quickWinDrafts(rows: QuickWin[]): Draft[] {
  return rows.map((win) => ({
    id: `quick-win:${win.key}`,
    source: "quick-win" as const,
    subject: win.key,
    action: "Deepen the page that already ranks for this query, then republish.",
    nativeScore: win.score,
    impressions: win.impressions,
    topic: quickWinTopic(win.key),
    detail: { source: "quick-win" as const, win },
  }));
}

function cannibalAction(group: CannibalGroup): string {
  switch (group.recommendation.kind) {
    case "consolidate":
      return "Consolidate: fold the weaker URL into the stronger one.";
    case "assign-intent":
      return "Assign intent: keep the product page transactional, retune the article.";
    case "differentiate":
      return "Differentiate: retarget one of the two URLs, or merge them.";
  }
}

function cannibalDrafts(rows: CannibalGroup[]): Draft[] {
  return rows.map((group) => ({
    id: `cannibalisation:${group.query}`,
    source: "cannibalisation" as const,
    subject: group.query,
    action: cannibalAction(group),
    nativeScore: group.severity,
    impressions: group.totalImpressions,
    topic: cannibalTopic(group),
    detail: { source: "cannibalisation" as const, group },
  }));
}

function decayAction(row: DecayRow): string {
  // Both branches are read off the row's own impressions, never assumed.
  return row.currentImpressions >= row.previousImpressions
    ? "Rewrite the title and meta description — impressions held, clicks did not."
    : "Bring the content back up to date — the page lost impressions as well as clicks.";
}

function decayDrafts(rows: DecayRow[]): Draft[] {
  return rows.filter(isDecayed).map((row) => ({
    id: `decay:${row.key}`,
    source: "decay" as const,
    subject: row.key,
    action: decayAction(row),
    // Δ clicks is negative for a decayed page; the queue ranks on the size of
    // the loss, which is the same number without its sign.
    nativeScore: Math.abs(row.deltaClicks),
    impressions: row.currentImpressions,
    topic: decayTopic(row.key),
    detail: { source: "decay" as const, row },
  }));
}

/**
 * Merges the three analyses into one ranked queue. A source that could not run
 * is recorded in `coverage` with its reason and contributes no rows — it is
 * never treated as "nothing to do".
 */
export function buildWorkQueue(
  quickWins: SourceInput<QuickWin>,
  cannibalisation: SourceInput<CannibalGroup>,
  decay: SourceInput<DecayRow>,
): WorkQueueResult {
  const drafts: Draft[] = [];
  const coverage = {} as Record<WorkSource, SourceCoverage>;

  const collect = (source: WorkSource, made: Draft[]) => {
    coverage[source] = { status: "available", found: made.length };
    drafts.push(...made);
  };

  if (quickWins.ok) collect("quick-win", quickWinDrafts(quickWins.rows));
  else coverage["quick-win"] = { status: "unavailable", reason: quickWins.reason };

  if (cannibalisation.ok) collect("cannibalisation", cannibalDrafts(cannibalisation.rows));
  else coverage.cannibalisation = { status: "unavailable", reason: cannibalisation.reason };

  if (decay.ok) collect("decay", decayDrafts(decay.rows));
  else coverage.decay = { status: "unavailable", reason: decay.reason };

  // The denominator of the normalisation: the biggest finding of each kind in
  // this window. Sources with no rows keep a leader of 0 and produce no items.
  const leaders: Record<WorkSource, number> = { "quick-win": 0, cannibalisation: 0, decay: 0 };
  for (const d of drafts) {
    if (d.nativeScore > leaders[d.source]) leaders[d.source] = d.nativeScore;
  }

  const scored = drafts.map((d) => {
    const leader = leaders[d.source];
    return {
      ...d,
      // A leader of 0 means every finding of that kind scored 0 — there is no
      // share to take, so priority is 0 rather than a division by zero.
      priority: leader > 0 ? (d.nativeScore / leader) * 100 : 0,
    };
  });

  scored.sort((a, b) => b.priority - a.priority || b.impressions - a.impressions || a.id.localeCompare(b.id));

  return {
    items: scored.map((item, i) => ({ ...item, rank: i + 1 })),
    coverage,
    leaders,
  };
}

/* ── coverage helpers ──────────────────────────────────────────────────── */

export function availableSources(coverage: Record<WorkSource, SourceCoverage>): WorkSource[] {
  return WORK_SOURCES.filter((s) => coverage[s].status === "available");
}

export function unavailableSources(coverage: Record<WorkSource, SourceCoverage>): WorkSource[] {
  return WORK_SOURCES.filter((s) => coverage[s].status === "unavailable");
}

/** Joins names as "a, b and c" so captions read as sentences. */
export function listPhrase(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
