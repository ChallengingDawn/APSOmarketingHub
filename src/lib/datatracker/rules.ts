// The Datatracker's decision rules, kept OUT of the component so they can be
// tested. Both bugs found in the 02.10 audit - a full year leaving the orders
// window on 30 days, and a sort the server could not perform - were invisible
// because they lived inside JSX.

/** The periods the screen offers, with how many days back each reaches. */
export const RANGE_DAYS: Record<string, number> = {
  today: 0, "7d": 6, "30d": 29, "90d": 89, "365d": 364,
};

/**
 * "YYYY-MM-DD" for a LOCAL calendar day.
 *
 * Not toISOString(): that is UTC, so between midnight and 02:00 CEST "today"
 * would silently be yesterday.
 */
export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * The window a period selection means, for BOTH halves of a row.
 *
 * A year has to move the orders window too. It used to fall through to the
 * 30-day default, so one row described a year on the left and a month on the
 * right.
 */
export function periodWindow(
  period: string, customFrom: string, customTo: string, now: Date = new Date(),
): { from: string; to: string } {
  if (period === "custom") return { from: customFrom, to: customTo };

  if (period.startsWith("y")) {
    const year = Number(period.slice(1));
    if (Number.isFinite(year)) {
      const isCurrent = year === now.getFullYear();
      return { from: `${year}-01-01`, to: isCurrent ? isoDay(now) : `${year}-12-31` };
    }
  }

  const days = RANGE_DAYS[period] ?? 29;
  return { from: isoDay(new Date(now.getTime() - days * 86_400_000)), to: isoDay(now) };
}

/**
 * One working day on. The 24 hours before a price-check ticket are working
 * hours: a check on Friday is judged on Monday, never on Saturday - nobody
 * orders at the weekend, so a weekend "no order" proves nothing.
 *
 * Saturday and Sunday only. Public holidays are NOT handled and differ per
 * country; that is an open decision, not an oversight.
 */
export function nextWorkingDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** "2-Prio 2 - Pot btw 2500 & 24999EUR" is a sentence; a cell needs a label. */
export function shortPriority(v: string | null | undefined): string {
  if (!v) return "—";
  const m = /Prio\s*(\d)/i.exec(v);
  return m ? `Prio ${m[1]}` : v.split(" - ")[0];
}

/** Excluded from the price-check rule: C2S and special articles. */
export const isSpecialArticle = (a: string): boolean => /^[38]/.test(a);

/** The article the ERP knows is the ten-digit variant, never the 8-digit page. */
export const isArticle = (v: string): boolean => /^\d{10}$/.test(v);
export const isProduct = (v: string): boolean => /^\d{8}$/.test(v);

/**
 * Does a day's price-checking warrant a ticket?
 *
 * 3+ articles, or 500 EUR - and 500 EUR is a floor either way ("less than 500
 * we can't"), so three cheap articles do not qualify. Only KT and DT count, and
 * an article whose profit centre cannot be determined is SKIPPED rather than
 * assumed - a special has no P&P record at all.
 */
export function priceCheckQualifies(
  articles: { article: string; profitCentre: string | null; value: number | null }[],
): { qualifies: boolean; counted: number; value: number; skipped: number } {
  const FOCUS = new Set(["KT", "DT"]);
  let counted = 0, value = 0, skipped = 0;
  for (const a of articles) {
    if (isSpecialArticle(a.article) || !a.profitCentre || !FOCUS.has(a.profitCentre)) { skipped++; continue; }
    counted++;
    value += a.value ?? 0;
  }
  return { qualifies: counted >= 1 && value >= 500, counted, value, skipped };
}
