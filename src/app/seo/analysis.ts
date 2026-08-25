/**
 * Derivations over real Search Console rows. Every number produced here is a
 * pure function of rows the API returned — nothing is invented, and anything
 * that cannot be computed from the available rows is returned as null so the
 * UI can render an em-dash instead of a guess.
 */

import type { GscPairRow, GscRow } from "./gscClient";

/* ── headline totals ───────────────────────────────────────────────────── */

export type Totals = {
  clicks: number;
  impressions: number;
  /** clicks / impressions across the returned rows — not a mean of per-row CTRs. */
  ctr: number | null;
  /** Impression-weighted mean position — the only correct way to average position. */
  position: number | null;
  rowCount: number;
};

export function totalsOf(rows: GscRow[]): Totals {
  let clicks = 0;
  let impressions = 0;
  let weighted = 0;
  let weight = 0;

  for (const r of rows) {
    clicks += r.clicks ?? 0;
    impressions += r.impressions ?? 0;
    if (r.position !== null && r.impressions !== null && r.impressions > 0) {
      weighted += r.position * r.impressions;
      weight += r.impressions;
    }
  }

  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : null,
    position: weight > 0 ? weighted / weight : null,
    rowCount: rows.length,
  };
}

/* ── quick wins ────────────────────────────────────────────────────────── */

/** Positions inside this band are one ranking nudge away from real traffic. */
export const QW_POSITION_MIN = 5;
export const QW_POSITION_MAX = 15;
/** Below this, a ranking gain moves too few people to be worth a brief. */
export const QW_MIN_IMPRESSIONS = 50;

export type QuickWin = {
  key: string;
  clicks: number | null;
  impressions: number;
  ctr: number | null;
  position: number;
  /** (16 − position) / 11 → 1.00 at position 5, 0.09 at position 15. */
  proximity: number;
  /** impressions × proximity. Shown alongside its inputs so it is never a black box. */
  score: number;
};

export function proximityOf(position: number): number {
  const raw = (QW_POSITION_MAX + 1 - position) / (QW_POSITION_MAX + 1 - QW_POSITION_MIN);
  return Math.min(Math.max(raw, 0), 1);
}

export function quickWinsOf(rows: GscRow[]): QuickWin[] {
  const out: QuickWin[] = [];
  for (const r of rows) {
    const { position, impressions } = r;
    if (position === null || impressions === null) continue;
    if (position < QW_POSITION_MIN || position > QW_POSITION_MAX) continue;
    if (impressions < QW_MIN_IMPRESSIONS) continue;
    const proximity = proximityOf(position);
    out.push({
      key: r.key,
      clicks: r.clicks,
      impressions,
      ctr: r.ctr,
      position,
      proximity,
      score: impressions * proximity,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/* ── period-over-period (decay) ────────────────────────────────────────── */

export type DecayRow = {
  key: string;
  currentClicks: number;
  previousClicks: number;
  deltaClicks: number;
  deltaPct: number | null;
  currentImpressions: number;
  previousImpressions: number;
  currentPosition: number | null;
};

export type DecayResult = {
  rows: DecayRow[];
  /** Keys comparable in both windows. */
  comparable: number;
  /**
   * Keys present in the current window but absent from the wider window's
   * truncated row set — not comparable, and never silently zero-filled.
   */
  notComparable: string[];
};

/**
 * Search Console's API (as wrapped by /api/integrations/gsc) only accepts a
 * single `days` lookback ending today — there is no explicit comparison window.
 * The previous period is therefore derived by subtraction:
 *
 *   previous[key] = rows(days = 2 × window)[key] − rows(days = window)[key]
 *
 * That is exact arithmetic on real totals for clicks and impressions (both are
 * sums over days). It is NOT valid for CTR or position, which are averages, so
 * this function never subtracts those.
 */
export function decayOf(current: GscRow[], extended: GscRow[]): DecayResult {
  const ext = new Map<string, GscRow>();
  for (const r of extended) ext.set(r.key, r);

  const rows: DecayRow[] = [];
  const notComparable: string[] = [];
  let comparable = 0;

  for (const cur of current) {
    const wide = ext.get(cur.key);
    const currentClicks = cur.clicks ?? 0;
    const currentImpressions = cur.impressions ?? 0;

    if (!wide) {
      notComparable.push(cur.key);
      continue;
    }

    const previousClicks = (wide.clicks ?? 0) - currentClicks;
    const previousImpressions = (wide.impressions ?? 0) - currentImpressions;

    // A negative remainder means the two windows disagree (row-limit truncation
    // in the wider window). Not comparable rather than clamped to a fake zero.
    if (previousClicks < 0 || previousImpressions < 0) {
      notComparable.push(cur.key);
      continue;
    }

    comparable += 1;
    const deltaClicks = currentClicks - previousClicks;
    rows.push({
      key: cur.key,
      currentClicks,
      previousClicks,
      deltaClicks,
      deltaPct: previousClicks > 0 ? (deltaClicks / previousClicks) * 100 : null,
      currentImpressions,
      previousImpressions,
      currentPosition: cur.position,
    });
  }

  // Worst first: the biggest absolute click loss is the biggest business loss.
  return { rows: rows.sort((a, b) => a.deltaClicks - b.deltaClicks), comparable, notComparable };
}

/** A page has decayed when it lost at least one click against a period that had traffic. */
export function isDecayed(row: DecayRow): boolean {
  return row.previousClicks > 0 && row.deltaClicks < 0;
}

/* ── cannibalisation ───────────────────────────────────────────────────── */

/**
 * Cannibalisation = two or more of YOUR OWN URLs taking impressions for the same
 * query. It is measurable only from query+page pair rows (see fetchGscPairs);
 * two separate single-dimension lists carry nothing that says which query drove
 * which URL, so they can never be rejoined.
 *
 * SEVERITY — stated in full so nothing is hidden:
 *
 *   spread     = position(2nd best-ranked URL) − position(best-ranked URL)
 *   closeness  = clamp((CANNIBAL_SPREAD_TOLERANCE − spread) / CANNIBAL_SPREAD_TOLERANCE, 0, 1)
 *   severity   = totalImpressions × closeness
 *
 * Two ideas, both of them measured rather than assumed:
 *
 *   1. Damage rises as the competing URLs sit CLOSER TOGETHER in position. Two
 *      URLs a fraction of a position apart are alternating in the same result
 *      set and splitting one pool of clicks between them; a URL ten positions
 *      behind is a separate, deeper listing that is not taking clicks from the
 *      leader in any meaningful way.
 *   2. Damage rises with TOTAL IMPRESSIONS, because a split costs traffic in
 *      proportion to the demand being split.
 *
 * Every input is exposed as a column in the UI, so severity is never a black
 * box: impressions, best position and spread are all visible on the row.
 */

/**
 * A URL only counts as competing once Search Console actually showed it for the
 * query. Zero-impression rows are presence in the API, not presence in results.
 */
export const CANNIBAL_MIN_IMPRESSIONS_PER_PAGE = 1;

/** Cannibalisation needs at least two URLs; one URL per query is the healthy case. */
export const CANNIBAL_MIN_COMPETING_PAGES = 2;

/**
 * Positions this far apart (~one page of results) mean the two URLs are no
 * longer trading places in the same result set, so closeness reaches 0 there.
 * The group is still listed — it is simply ranked below the real splits.
 */
export const CANNIBAL_SPREAD_TOLERANCE = 10;

/**
 * Closeness used when fewer than two competing URLs have a reported position:
 * the spread cannot be measured, so it is scored 0 rather than guessed. Such
 * groups sink to the bottom of the ranking but are never dropped.
 */
export const CANNIBAL_CLOSENESS_WHEN_UNMEASURABLE = 0;

/**
 * Share of the query's clicks the leading URL must take before it counts as the
 * obvious page to keep. Below this the clicks are genuinely split and picking a
 * winner would be arbitrary.
 */
export const CANNIBAL_CLICK_DOMINANCE = 0.6;

/**
 * Positions the leading URL must be ahead of the runner-up before its lead
 * counts as clear — roughly half a page of results. Inside this band the two
 * URLs swap places week to week and neither is the settled winner.
 */
export const CANNIBAL_POSITION_LEAD = 3;

/** URL path segments that mark a transactional page. Matched as whole segments. */
const PRODUCT_PATH_SEGMENTS = new Set([
  "product",
  "products",
  "produkt",
  "produkte",
  "artikel",
  "shop",
  "store",
  "catalog",
  "catalogue",
  "category",
  "categories",
  "collection",
  "collections",
  "buy",
  "pricing",
]);

/** URL path segments that mark an informational/editorial page. */
const EDITORIAL_PATH_SEGMENTS = new Set([
  "blog",
  "news",
  "article",
  "articles",
  "guide",
  "guides",
  "insight",
  "insights",
  "resource",
  "resources",
  "knowledge",
  "magazine",
  "story",
  "stories",
  "wiki",
  "faq",
  "learn",
  "academy",
  "ratgeber",
]);

export type PageKind = "product" | "editorial" | "unknown";

/**
 * Classifies a URL from its path segments only — this cockpit never sees page
 * content, so nothing else is available to classify on. A path that matches
 * both vocabularies, or neither, returns "unknown" instead of guessing, and an
 * "unknown" never triggers an intent recommendation.
 */
export function pageKindOf(url: string): PageKind {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    // Not an absolute URL — fall back to matching the raw string's segments.
  }

  let product = false;
  let editorial = false;
  for (const segment of path.toLowerCase().split("/")) {
    if (segment.length === 0) continue;
    if (PRODUCT_PATH_SEGMENTS.has(segment)) product = true;
    if (EDITORIAL_PATH_SEGMENTS.has(segment)) editorial = true;
  }

  // Both or neither → not classifiable.
  if (product === editorial) return "unknown";
  return product ? "product" : "editorial";
}

export type CompetingPage = {
  page: string;
  /** A missing clicks field is read as 0; Search Console reports 0 explicitly. */
  clicks: number;
  impressions: number;
  /** clicks ÷ impressions for this URL on this query — never a mean of CTRs. */
  ctr: number | null;
  /** Impression-weighted average position, so a repeated pair row cannot skew it. */
  position: number | null;
};

/**
 * What to do about the split, decided from the numbers in the group. The three
 * variants name their URLs by role so the UI cannot mix them up.
 */
export type CannibalRecommendation =
  | { kind: "consolidate"; keep: string; fold: string }
  | { kind: "differentiate"; keep: string; retarget: string }
  | { kind: "assign-intent"; product: string; editorial: string };

export type CannibalGroup = {
  query: string;
  /** Competing URLs, strongest first: clicks desc, impressions desc, position asc, url asc. */
  pages: CompetingPage[];
  pageCount: number;
  totalClicks: number;
  totalImpressions: number;
  /** Lowest (best) average position among the competing URLs. */
  bestPosition: number | null;
  /** Gap between best and second-best position; null when it cannot be measured. */
  positionSpread: number | null;
  /** 0–1 — see CANNIBAL_SPREAD_TOLERANCE. */
  closeness: number;
  /** totalImpressions × closeness. */
  severity: number;
  recommendation: CannibalRecommendation;
};

/** Ascending by position with unknown positions sinking last. */
function comparePosition(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function recommendationOf(pages: CompetingPage[], totalClicks: number): CannibalRecommendation {
  // Guaranteed by CANNIBAL_MIN_COMPETING_PAGES: the two URLs actually splitting
  // the query are the strongest and the next strongest.
  const leader = pages[0];
  const runnerUp = pages[1];

  // 1. Different intents first. A product page and an article must not be merged
  //    at all — merging destroys one of the two intents the query serves.
  const leaderKind = pageKindOf(leader.page);
  const runnerKind = pageKindOf(runnerUp.page);
  if (leaderKind === "product" && runnerKind === "editorial") {
    return { kind: "assign-intent", product: leader.page, editorial: runnerUp.page };
  }
  if (leaderKind === "editorial" && runnerKind === "product") {
    return { kind: "assign-intent", product: runnerUp.page, editorial: leader.page };
  }

  // 2. One URL wins on both clicks and position → the weaker one only splits the
  //    signal. When the query earned no clicks at all there is no click evidence
  //    either way, so the decision falls to position alone.
  const dominatesClicks = totalClicks > 0 ? leader.clicks / totalClicks >= CANNIBAL_CLICK_DOMINANCE : true;
  const leadsPosition =
    leader.position !== null &&
    runnerUp.position !== null &&
    runnerUp.position - leader.position >= CANNIBAL_POSITION_LEAD;

  if (dominatesClicks && leadsPosition) {
    return { kind: "consolidate", keep: leader.page, fold: runnerUp.page };
  }

  // 3. Neither URL is clearly stronger — two answers to one intent.
  return { kind: "differentiate", keep: leader.page, retarget: runnerUp.page };
}

/**
 * Groups pair rows by query and keeps only the queries answered by two or more
 * distinct URLs that received impressions. Worst-first by severity; ties break on
 * total impressions, then on the query itself so the order is stable.
 */
export function cannibalisationOf(rows: GscPairRow[]): CannibalGroup[] {
  type Acc = { clicks: number; impressions: number; weighted: number; weight: number };

  // query → page → running totals. Search Console does not repeat a pair, but
  // accumulating rather than overwriting means a repeated row cannot silently
  // discard data.
  const byQuery = new Map<string, Map<string, Acc>>();

  for (const row of rows) {
    const impressions = row.impressions ?? 0;
    if (impressions < CANNIBAL_MIN_IMPRESSIONS_PER_PAGE) continue;

    let pageMap = byQuery.get(row.query);
    if (!pageMap) {
      pageMap = new Map<string, Acc>();
      byQuery.set(row.query, pageMap);
    }

    const acc: Acc = pageMap.get(row.page) ?? { clicks: 0, impressions: 0, weighted: 0, weight: 0 };
    acc.clicks += row.clicks ?? 0;
    acc.impressions += impressions;
    if (row.position !== null) {
      acc.weighted += row.position * impressions;
      acc.weight += impressions;
    }
    pageMap.set(row.page, acc);
  }

  const groups: CannibalGroup[] = [];

  for (const [query, pageMap] of byQuery) {
    if (pageMap.size < CANNIBAL_MIN_COMPETING_PAGES) continue;

    const pages: CompetingPage[] = [];
    for (const [page, acc] of pageMap) {
      pages.push({
        page,
        clicks: acc.clicks,
        impressions: acc.impressions,
        ctr: acc.impressions > 0 ? acc.clicks / acc.impressions : null,
        position: acc.weight > 0 ? acc.weighted / acc.weight : null,
      });
    }

    // Strongest first, with deterministic tie-breaks so a query that earned no
    // clicks still has a well-defined leader (the URL with most impressions).
    pages.sort(
      (a, b) =>
        b.clicks - a.clicks ||
        b.impressions - a.impressions ||
        comparePosition(a.position, b.position) ||
        a.page.localeCompare(b.page),
    );

    let totalClicks = 0;
    let totalImpressions = 0;
    for (const p of pages) {
      totalClicks += p.clicks;
      totalImpressions += p.impressions;
    }

    const knownPositions = pages
      .map((p) => p.position)
      .filter((p): p is number => p !== null)
      .sort((a, b) => a - b);

    const bestPosition = knownPositions.length > 0 ? knownPositions[0] : null;
    const positionSpread = knownPositions.length >= 2 ? knownPositions[1] - knownPositions[0] : null;
    const closeness =
      positionSpread === null
        ? CANNIBAL_CLOSENESS_WHEN_UNMEASURABLE
        : Math.min(Math.max((CANNIBAL_SPREAD_TOLERANCE - positionSpread) / CANNIBAL_SPREAD_TOLERANCE, 0), 1);

    groups.push({
      query,
      pages,
      pageCount: pages.length,
      totalClicks,
      totalImpressions,
      bestPosition,
      positionSpread,
      closeness,
      severity: totalImpressions * closeness,
      recommendation: recommendationOf(pages, totalClicks),
    });
  }

  return groups.sort(
    (a, b) =>
      b.severity - a.severity || b.totalImpressions - a.totalImpressions || a.query.localeCompare(b.query),
  );
}
