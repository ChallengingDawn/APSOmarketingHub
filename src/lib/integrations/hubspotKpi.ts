// THE ERP FIGURES, READ FROM HUBSPOT.
//
// Every morning a revenue file from the ERP is loaded into a custom object in
// HubSpot called KPI (2-201387076): one record per category, year, month and
// dimension, carrying a single number. That is where the money lives — revenue,
// order intake, new customers, customers who came back — and this module is how
// this application reads it. Nothing here writes.
//
// ── THE TRAP, AND WHY THIS FILE EXISTS ──────────────────────────────────────
// Several of these series hold a FULL previous year against a PART of this one.
// Summing both sides then reports a collapse that never happened. Measured on
// the live portal, 27 September 2026:
//
//   revenue_geo_monthly   naive: 15.27M vs 19.37M = −21.1%   ← reported to a
//                         like-for-like (Jan–Sep): +1.2%        colleague as a
//                                                               real decline
//   newcust_monthly       naive: 1,000 vs 1,486   = −32.7%
//                         like-for-like (Jan–Sep): −14.2%
//
// revenue_monthly is worse, because it looks safe: both years carry twelve
// rows, but this year's October to December are zeros. The row count matches,
// so nothing warns you.
//
// So no caller gets a raw sum. `likeForLike` intersects the months that exist
// in both years and stops at the last month this year actually has a figure
// for. Every result states which months it used, and the UI prints them.

import { hubspotFetchJson } from "./hubspot";

/** The KPI custom object in portal 26492587. */
export const KPI_OBJECT = "2-201387076";

/** The series this application reads. Names verified against the portal. */
export const KPI_SERIES = {
  /** Revenue by country, both years cut on the same day. The safe revenue series. */
  revenueByCountry: "revenue_geo_erp_monthly",
  /** Order intake by country, same cut. */
  intakeByCountry: "oi_geo_monthly",
  /** Revenue by profit centre — the product families. */
  revenueByFamily: "revenue_pc_monthly",
  /** Revenue by sales priority. */
  revenueByPriority: "revenue_prio_monthly",
  /** Order intake by sales priority. */
  intakeByPriority: "oi_prio_monthly",
  /** Companies placing their first ever order, per month. */
  newCustomers: "newcust_monthly",
  /** Companies that ordered again after thirteen months or more without one. */
  reactivated: "reactivated_monthly",
} as const;

/**
 * Series whose two years do not stop at the same point. They are correct month
 * by month and wrong the moment you add them up, so the safe sibling is named.
 */
export const UNSAFE_TO_TOTAL: Record<string, string> = {
  revenue_monthly: "revenue_geo_erp_monthly",
  revenue_geo_monthly: "revenue_geo_erp_monthly",
  oi_monthly: "oi_geo_monthly",
};

export type KpiRow = {
  year: number | null;
  /** 1–12, parsed from "09 September". */
  month: number | null;
  monthLabel: string | null;
  value: number;
  country: string | null;
  priority: string | null;
  family: string | null;
  /**
   * The loader's own verdict on whether this month can be compared with the same
   * month of the other year. It is NOT decoration: the cohort series mark the
   * current month `no`, because a month counted to the 24th is sitting next to a
   * full month of last year. Ignoring it turned a −7.0% into a −14.2%.
   */
  comparable: boolean;
};

const num = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const str = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

type SearchPage = {
  results?: { properties?: Record<string, unknown> }[];
  paging?: { next?: { after?: string } };
};

const PROPERTIES = [
  "kpi_year",
  "kpi_month_label",
  "metric_value",
  "kpi_country",
  "kpi_priority",
  "kpi_profit_center",
  "kpi_comparable",
];

/**
 * One whole series. The biggest is under 600 records, so paging it is a handful
 * of calls — all of them through the search throttle in hubspotFetchJson.
 */
export async function fetchKpiSeries(category: string, signal?: AbortSignal): Promise<KpiRow[]> {
  const rows: KpiRow[] = [];
  let after: string | undefined;
  // A guard, not a limit: 30 pages is five times the largest series we read.
  for (let page = 0; page < 30; page++) {
    const res = await hubspotFetchJson<SearchPage>({
      path: `/crm/v3/objects/${KPI_OBJECT}/search`,
      method: "POST",
      body: {
        filterGroups: [{ filters: [{ propertyName: "kpi_category", operator: "EQ", value: category }] }],
        properties: PROPERTIES,
        limit: 100,
        ...(after ? { after } : {}),
      },
      signal,
    });
    for (const record of res.results ?? []) {
      const p = record.properties ?? {};
      const label = str(p.kpi_month_label);
      rows.push({
        year: num(p.kpi_year),
        month: label ? num(label.slice(0, 2)) : null,
        monthLabel: label,
        value: num(p.metric_value) ?? 0,
        country: str(p.kpi_country),
        priority: str(p.kpi_priority),
        family: str(p.kpi_profit_center),
        // Absent means nobody made a judgement, which is not the same as "no".
        comparable: str(p.kpi_comparable) !== "no",
      });
    }
    after = res.paging?.next?.after;
    if (!after) break;
  }
  return rows;
}

export type LikeForLike = {
  /** The newer year and the one before it. */
  year: number | null;
  priorYear: number | null;
  /** The months both years are counted over, 1–12. */
  months: number[];
  /** "January–September", for printing next to the figure. */
  monthsLabel: string;
  value: number | null;
  priorValue: number | null;
  /** Change as a fraction, null when the prior side is zero. */
  change: number | null;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const spell = (months: number[]): string => {
  if (months.length === 0) return "no comparable month";
  const first = MONTH_NAMES[months[0] - 1] ?? String(months[0]);
  const last = MONTH_NAMES[months[months.length - 1] - 1] ?? String(months[months.length - 1]);
  return months.length === 1 ? first : `${first}–${last}`;
};

/**
 * The only way this application is allowed to total a KPI series.
 *
 * The month set is the intersection of the two years, cut at the last month the
 * newer year has a non-zero figure for — which stops this year's empty October
 * to December from being compared with last year's real ones — and then with
 * every month either side has marked NOT comparable removed.
 *
 * That last filter is not belt and braces. The cohort series (`newcust_monthly`,
 * `reactivated_monthly`) count the current month to the day the scan ran and put
 * it beside a FULL month of last year: September 2026 read 28 first orders
 * against 121, and including it reported −14.2% where the complete months say
 * −7.0%. The loader flags that month `kpi_comparable = no`. Believe it.
 */
export function likeForLike(rows: KpiRow[], pick?: (row: KpiRow) => boolean): LikeForLike {
  const scoped = pick ? rows.filter(pick) : rows;
  const years = [...new Set(rows.map((r) => r.year).filter((y): y is number => y != null))].sort((a, b) => a - b);
  const year = years.length ? years[years.length - 1] : null;
  const priorYear = year != null ? year - 1 : null;
  if (year == null || priorYear == null) {
    return { year, priorYear, months: [], monthsLabel: spell([]), value: null, priorValue: null, change: null };
  }

  // The cut comes from the whole series, not the slice: a single country can
  // legitimately have nothing in August without that shortening the year.
  const cut = rows
    .filter((r) => r.year === year && r.value !== 0 && r.month != null)
    .reduce((max, r) => Math.max(max, r.month as number), 0);
  const monthsOf = (y: number) => new Set(rows.filter((r) => r.year === y && r.month != null).map((r) => r.month as number));
  // A month either side may be declared incomparable, and one row saying so is
  // enough — the series is written a row per dimension, all carrying the flag.
  const refused = new Set(
    rows.filter((r) => !r.comparable && r.month != null && (r.year === year || r.year === priorYear)).map((r) => r.month as number),
  );
  const later = monthsOf(year);
  const earlier = monthsOf(priorYear);
  const months = [...later].filter((m) => earlier.has(m) && m <= cut && !refused.has(m)).sort((a, b) => a - b);

  const sum = (y: number) =>
    scoped.filter((r) => r.year === y && r.month != null && months.includes(r.month)).reduce((s, r) => s + r.value, 0);
  const value = months.length ? sum(year) : null;
  const priorValue = months.length ? sum(priorYear) : null;

  return {
    year,
    priorYear,
    months,
    monthsLabel: spell(months),
    value,
    priorValue,
    change: value != null && priorValue ? value / priorValue - 1 : null,
  };
}

/** Short month names, for a chart axis where "September" will not fit. */
export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The two years month by month, over exactly the months `likeForLike` accepted.
 * A chart drawn off this cannot show last October against a month this year
 * does not have, which is the whole failure mode this module exists for.
 */
export function monthlyPair(
  rows: KpiRow[],
  comparison: LikeForLike,
  pick?: (row: KpiRow) => boolean,
): { month: number; label: string; current: number | null; prior: number | null }[] {
  const scoped = pick ? rows.filter(pick) : rows;
  const sumOf = (year: number | null, month: number): number | null => {
    if (year == null) return null;
    const matching = scoped.filter((r) => r.year === year && r.month === month);
    return matching.length === 0 ? null : matching.reduce((s, r) => s + r.value, 0);
  };
  return comparison.months.map((month) => ({
    month,
    label: MONTH_SHORT[month - 1] ?? String(month),
    current: sumOf(comparison.year, month),
    prior: sumOf(comparison.priorYear, month),
  }));
}

/** The same comparison, split by one of the dimensions, biggest first. */
export function likeForLikeBy(
  rows: KpiRow[],
  dimension: "country" | "priority" | "family",
): (LikeForLike & { key: string })[] {
  const keys = [...new Set(rows.map((r) => r[dimension]).filter((k): k is string => !!k))];
  return keys
    .map((key) => ({ key, ...likeForLike(rows, (r) => r[dimension] === key) }))
    .filter((r) => r.value != null || r.priorValue != null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
}

/**
 * Whole calendar months inside an inclusive window. A monthly series cannot
 * answer "the last 28 days", so anything window-scoped asks this first and
 * admits the gap when it comes back empty.
 */
export function monthsFullyInside(from: string, to: string): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;

  let year = start.getUTCFullYear();
  let month = start.getUTCMonth() + 1;
  for (let guard = 0; guard < 400; guard++) {
    const firstDay = Date.UTC(year, month - 1, 1);
    const lastDay = Date.UTC(year, month, 0);
    if (firstDay > end.getTime()) break;
    if (firstDay >= start.getTime() && lastDay <= end.getTime()) out.push({ year, month });
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return out;
}

/** Sum a series over an explicit list of months. */
export function sumMonths(rows: KpiRow[], months: { year: number; month: number }[]): number | null {
  if (months.length === 0) return null;
  const wanted = new Set(months.map((m) => `${m.year}-${m.month}`));
  const matching = rows.filter((r) => r.year != null && r.month != null && wanted.has(`${r.year}-${r.month}`));
  if (matching.length === 0) return null;
  return matching.reduce((s, r) => s + r.value, 0);
}

/** "July–August 2026", or "August 2026" — what a window-scoped figure covers. */
export function spellMonths(months: { year: number; month: number }[]): string {
  if (months.length === 0) return "";
  const name = (m: { year: number; month: number }) => `${MONTH_NAMES[m.month - 1]} ${m.year}`;
  if (months.length === 1) return name(months[0]);
  const first = months[0];
  const last = months[months.length - 1];
  return first.year === last.year
    ? `${MONTH_NAMES[first.month - 1]}–${MONTH_NAMES[last.month - 1]} ${first.year}`
    : `${name(first)} – ${name(last)}`;
}
