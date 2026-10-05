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
  if (m) return `Prio ${m[1]}`;
  // Tier 4 is "4- No priority for sales, Pot. <500EUR" - a rank whose label
  // never repeats the word Prio, so the old code returned the whole sentence and
  // that one cell truncated while its neighbours read cleanly. It is the fourth
  // step of the same ranked set, so it is labelled like the other three; the
  // cell carries the full text on hover.
  const ranked = /^(\d+)\s*-/.exec(v);
  return ranked ? `Prio ${ranked[1]}` : v.split(" - ")[0].trim();
}

/** The profit centres an article belongs to (P&P `profit_center`), for the filter. */
export const PROFIT_CENTRES = [
  { code: "DT", label: "DT · Sealing" },
  { code: "KT", label: "KT · Plastics" },
  { code: "FT", label: "FT · Hoses & fluid" },
  { code: "AT", label: "AT · Drive belts" },
  { code: "ST", label: "ST · Anti-vibration" },
  { code: "PW", label: "PW · Power & electronics" },
] as const;

/**
 * APSOparts' and Angst + Pfister's own companies. They log in, price and order
 * like customers - tests, intercompany - and showed up as the biggest price
 * check of the day. SARCLA, 05.10: "exclude APSOparts companies from the boards
 * and tickets". By name, because HubSpot carries no internal flag.
 */
export function isInternalCompany(name: string | null | undefined): boolean {
  return /^\s*(apso\s*parts|angst\s*\+?\s*pfister)\b/i.test(String(name ?? ""));
}

/** Excluded from the price-check rule: C2S and special articles. */
export const isSpecialArticle = (a: string): boolean => /^[38]/.test(a);

/** The article the ERP knows is the ten-digit variant, never the 8-digit page. */
export const isArticle = (v: string): boolean => /^\d{10}$/.test(v);
export const isProduct = (v: string): boolean => /^\d{8}$/.test(v);

/**
 * THE 500 EUR FLOOR IS PAUSED (SARCLA, 05.10.2026). Products & Pricing keeps list
 * prices per ERP price unit - per 1, 100 or 1,000 pieces - and does not store the
 * unit, so price x quantity can be 100 or 1,000 times too high: twenty O-rings read
 * 9,910 EUR. A sample of 600 KT/DT articles put list price / standard cost in three
 * groups (1-10, 300-1,000, over 1,000), so the unit cannot be guessed either.
 * Until the ERP's price unit is in P&P, a day qualifies on 3 or more KT/DT
 * articles, which needs no price at all. Set to true once the unit is there and
 * values are divided by it.
 */
export const VALUE_FLOOR_ACTIVE = false;
/** Articles a day needs while the value floor is paused. */
export const MIN_ARTICLES = 3;

/**
 * Does a day's price-checking warrant a ticket?
 *
 * With the floor active: 500 EUR, as a floor either way ("less than 500 we
 * can't"), so three cheap articles do not qualify. While it is paused: three or
 * more articles. Only KT and DT count, and an article whose profit centre cannot
 * be determined is SKIPPED rather than assumed - a special has no P&P record at all.
 */
export function priceCheckQualifies(
  articles: { article: string; profitCentre: string | null; value: number | null }[],
  opts: { valueFloor?: boolean } = {},
): { qualifies: boolean; counted: number; value: number; skipped: number } {
  const valueFloor = opts.valueFloor ?? VALUE_FLOOR_ACTIVE;
  const FOCUS = new Set(["KT", "DT"]);
  let counted = 0, value = 0, skipped = 0;
  for (const a of articles) {
    if (isSpecialArticle(a.article) || !a.profitCentre || !FOCUS.has(a.profitCentre)) { skipped++; continue; }
    counted++;
    value += a.value ?? 0;
  }
  const qualifies = valueFloor ? counted >= 1 && value >= 500 : counted >= MIN_ARTICLES;
  return { qualifies, counted, value, skipped };
}

/** The reason a day does not qualify, in the words the screens use. */
export function priceCheckShortfall(r: { counted: number; value: number }, valueFloor = VALUE_FLOOR_ACTIVE): string {
  if (r.counted === 0) return "No KT/DT article";
  return valueFloor ? "Under €500" : `${r.counted} of ${MIN_ARTICLES} articles`;
}

/**
 * The minimum order quantity, when there really is one.
 *
 * P&P flags `moq` YES on about a quarter of the articles but fills
 * `moq_minimum_quantity` on about 3%, so a YES with 0 or nothing behind it is
 * not a minimum anybody could have run into - the MOQ screen listed those as
 * "Has a minimum" over a minimum of 0 (SARCLA, 05.10). One piece is no minimum
 * either.
 */
export function knownMinimum(flag: string | null | undefined, minimum: number | null | undefined): number | null {
  if (!/^y/i.test(String(flag ?? ""))) return null;
  return minimum != null && Number.isFinite(minimum) && minimum > 1 ? minimum : null;
}

/**
 * The five company filters, applied the way the activity search applies them.
 *
 * The customers table is fed from two reads. The activity read is filtered by
 * HubSpot; the orders read is not, because it starts from orders and knows
 * nothing about the dropdowns. So a customer who ordered without browsing has
 * to be filtered here, against the SAME raw properties the search compares -
 * `hubspot_owner_id` rather than the owner's name, which is only resolved for
 * display. Getting that wrong is what put an M110 customer at the top of a
 * table filtered to M100.
 *
 * An empty filter matches everything. A set filter excludes a company with no
 * value for it, exactly as an EQ condition does.
 */
export type CompanyFilters = {
  mandant?: string;
  country?: string;
  apsoCustomer?: string;
  priority?: string;
  representative?: string;
};

export type FilterableCompany = {
  mandant?: string | null;
  country?: string | null;
  apsoCustomer?: string | null;
  salesPriority?: string | null;
  /** The raw owner id, not the resolved name. */
  ownerId?: string | null;
};

export function companyPasses(c: FilterableCompany, f: CompanyFilters): boolean {
  const eq = (value: string | null | undefined, want: string | undefined) =>
    !want || (value ?? "") === want;
  return eq(c.mandant, f.mandant)
    && eq(c.country, f.country)
    && eq(c.apsoCustomer, f.apsoCustomer)
    && eq(c.salesPriority, f.priority)
    && eq(c.ownerId, f.representative);
}
