// REACH FROM SEARCH CONSOLE, MONTH BY MONTH - pure: Search Console's days folded
// into the months the Reach KPIs show, this year and last (SARCLA 17.10: "Reach -
// connect to Google Search Console, update live, last year against this year").
//
//   R04 impressions, R05 clicks, R06 CTR (clicks / impressions), R07 average
//   position (weighted by impressions, as Search Console weighs it), R08 the
//   share of clicks from brand searches (R08B the brand clicks themselves).
//
// Google keeps 16 months, so last year starts where its days start: a past month
// it holds only in part is left empty rather than shown low. The month in
// progress runs to Google's last day (it lags a day or two).

export type SearchDay = { date: string; clicks: number; impressions: number; position: number | null };
export type Monthly = { months: (number | null)[]; py: (number | null)[] };
export type SearchMonthly = { series: Record<"R04" | "R05" | "R06" | "R07" | "R08" | "R08B", Monthly>; firstDay: string | null; lastDay: string | null };

const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/**
 * `all` is every search day, `brand` the same days for brand queries only.
 * `year` is this year; months after `now`'s month stay empty.
 */
export function monthlyFromDaily(all: SearchDay[], brand: SearchDay[], year: number, now: Date): SearchMonthly {
  const empty = (): Monthly => ({ months: Array(12).fill(null), py: Array(12).fill(null) });
  const series = { R04: empty(), R05: empty(), R06: empty(), R07: empty(), R08: empty(), R08B: empty() };
  type Acc = { days: number; clicks: number; impr: number; posW: number; brand: number };
  const acc = new Map<string, Acc>();
  const at = (ym: string) => { let a = acc.get(ym); if (!a) { a = { days: 0, clicks: 0, impr: 0, posW: 0, brand: 0 }; acc.set(ym, a); } return a; };
  const dates = all.map((d) => d.date).sort();
  for (const d of all) {
    const a = at(d.date.slice(0, 7));
    a.days += 1; a.clicks += d.clicks; a.impr += d.impressions;
    if (d.position != null) a.posW += d.position * d.impressions;
  }
  for (const d of brand) { const a = acc.get(d.date.slice(0, 7)); if (a) a.brand += d.clicks; }

  const curY = now.getUTCFullYear(), curM = now.getUTCMonth();
  for (const [side, y] of [["months", year], ["py", year - 1]] as const) {
    for (let m = 0; m < 12; m++) {
      if (y > curY || (y === curY && m > curM)) continue;
      const a = acc.get(`${y}-${String(m + 1).padStart(2, "0")}`);
      if (!a || !a.impr) continue;
      // a past month Google holds only in part (its 16 months start mid-month) is not a month
      const running = y === curY && m === curM;
      if (!running && a.days < daysIn(y, m)) continue;
      series.R04[side][m] = a.impr;
      series.R05[side][m] = a.clicks;
      series.R06[side][m] = a.clicks / a.impr;
      series.R07[side][m] = a.posW / a.impr;
      series.R08B[side][m] = a.brand;
      series.R08[side][m] = a.clicks ? a.brand / a.clicks : null;
    }
  }
  return { series, firstDay: dates[0] ?? null, lastDay: dates[dates.length - 1] ?? null };
}

/** Brand searches: the queries that name us. Search Console takes RE2. */
export const BRAND_QUERY = "apso|angst|pfister";
