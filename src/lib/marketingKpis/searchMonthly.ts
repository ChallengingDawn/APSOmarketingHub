// REACH FROM SEARCH CONSOLE, MONTH BY MONTH - pure: Search Console's days folded
// into the months the Reach KPIs show, this year and last (SARCLA 17.10: "Reach -
// connect to Google Search Console, update live, last year against this year").
//
//   R04 impressions, R05 clicks, R06 CTR (clicks / impressions), R07 average
//   position (weighted by impressions, as Search Console weighs it), R08 the
//   share of clicks from brand searches (R08B the brand clicks themselves).
//
// Google keeps 16 months, so last year starts where its days start: a past month
// it holds only in part is left empty rather than shown low. The hub keeps every
// complete month it has read (mergeHistory, SARCLA 17.10: "keep the months"), so
// from January 2027 the whole of last year compares. The month in progress runs
// to Google's last day (it lags a day or two).

export type SearchDay = { date: string; clicks: number; impressions: number; position: number | null };
export type Monthly = { months: (number | null)[]; py: (number | null)[] };
/** One month's sums: its days in Search Console, clicks, impressions, position x impressions, brand clicks. */
export type MonthAcc = { days: number; clicks: number; impr: number; posW: number; brand: number };
export type SearchMonthly = { series: Record<"R04" | "R05" | "R06" | "R07" | "R08" | "R08B", Monthly>; firstDay: string | null; lastDay: string | null };

export const daysIn = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();

/** Days into months. */
export function monthsFromDays(all: SearchDay[], brand: SearchDay[]): Record<string, MonthAcc> {
  const acc: Record<string, MonthAcc> = {};
  for (const d of all) {
    const a = (acc[d.date.slice(0, 7)] ??= { days: 0, clicks: 0, impr: 0, posW: 0, brand: 0 });
    a.days += 1; a.clicks += d.clicks; a.impr += d.impressions;
    if (d.position != null) a.posW += d.position * d.impressions;
  }
  for (const d of brand) { const a = acc[d.date.slice(0, 7)]; if (a) a.brand += d.clicks; }
  return acc;
}

/**
 * What the hub keeps and what it just read, together: per month the one with more
 * days (a month Google has begun to drop stays whole in the hub), the fresh read
 * on a tie (Google revises its last days).
 */
export function mergeHistory(kept: Record<string, MonthAcc>, fresh: Record<string, MonthAcc>): Record<string, MonthAcc> {
  const out: Record<string, MonthAcc> = { ...kept };
  for (const [ym, a] of Object.entries(fresh)) if (!out[ym] || a.days >= out[ym].days) out[ym] = a;
  return out;
}

/** The complete months only - what the hub keeps. */
export const completeOnly = (months: Record<string, MonthAcc>) =>
  Object.fromEntries(Object.entries(months).filter(([ym, a]) => a.days >= daysIn(ym)));

/** Months into the Reach series; months after `now`'s stay empty, past months held only in part too. */
export function seriesFromMonths(months: Record<string, MonthAcc>, year: number, now: Date): SearchMonthly["series"] {
  const empty = (): Monthly => ({ months: Array(12).fill(null), py: Array(12).fill(null) });
  const series = { R04: empty(), R05: empty(), R06: empty(), R07: empty(), R08: empty(), R08B: empty() };
  const curY = now.getUTCFullYear(), curM = now.getUTCMonth();
  for (const [side, y] of [["months", year], ["py", year - 1]] as const) {
    for (let m = 0; m < 12; m++) {
      if (y > curY || (y === curY && m > curM)) continue;
      const ym = `${y}-${String(m + 1).padStart(2, "0")}`;
      const a = months[ym];
      if (!a || !a.impr) continue;
      const running = y === curY && m === curM;
      if (!running && a.days < daysIn(ym)) continue;
      series.R04[side][m] = a.impr;
      series.R05[side][m] = a.clicks;
      series.R06[side][m] = a.clicks / a.impr;
      series.R07[side][m] = a.posW / a.impr;
      series.R08B[side][m] = a.brand;
      series.R08[side][m] = a.clicks ? a.brand / a.clicks : null;
    }
  }
  return series;
}

/** `all` is every search day, `brand` the same days for brand queries only; `year` is this year. */
export function monthlyFromDaily(all: SearchDay[], brand: SearchDay[], year: number, now: Date): SearchMonthly {
  const dates = all.map((d) => d.date).sort();
  return { series: seriesFromMonths(monthsFromDays(all, brand), year, now), firstDay: dates[0] ?? null, lastDay: dates[dates.length - 1] ?? null };
}

/** Brand searches: the queries that name us. Search Console takes RE2. */
export const BRAND_QUERY = "apso|angst|pfister";
