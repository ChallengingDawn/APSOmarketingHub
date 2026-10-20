// MICROSOFT ADS FROM THE SCRIPT'S SHEET - pure. A Microsoft Advertising script adds up the
// account's impressions, clicks and cost per month every morning and writes them, through
// the sheet's web app, into a Google Sheet the hub reads with its service account
// (scripts/microsoft-ads; SARCLA 18.10: no typing - "manual, it's shit" - and no Azure app).

/** The sheet the script writes - not a secret: only the hub's service account may read it. */
// "APSOhub – Microsoft Ads", shared with the hub's service account (SARCLA 18.10)
export const MSADS_SHEET_ID = "16QuE9tOmBMEMvAj8mdCLLcgytix9hM4bKONB7iwkcdQ";
export const msAdsSheetId = () => process.env.MSADS_SHEET_ID || MSADS_SHEET_ID;

/** conversions and their value (revenue) only when the script writes them - SEA revenue, P05 (20.10.2026) */
export type MsAdsMonth = { impressions: number; clicks: number; cost: number; conversions?: number; revenue?: number };
export type MsAdsSheet = {
  months: Record<string, MsAdsMonth>;
  /** "YYYY-MM" -> campaign type (Search, Performance Max, Shopping...) -> its month - rows "2026-09|Search" */
  kinds: Record<string, Record<string, MsAdsMonth>>;
  /** the cost's currency code, "CHF" */
  currency: string | null;
  /** some accounts were in another currency and left out of the cost (impressions and clicks are all) */
  costPartial: boolean;
  /** the last day the script counted, "2026-10-17" */
  through: string | null;
  /** when the sheet was last written, ISO */
  written: string | null;
};

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/**
 * A day as the sheet hands it back: Google Sheets turns "2026-10-17" into a date, which the
 * API answers as a serial number (days since 30 Dec 1899) - 18.10.2026: "counted up to 46312".
 */
function sheetDate(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return new Date(Math.round((v - 25569) * 86_400_000)).toISOString();
  const s = String(v ?? "").trim();
  return s || null;
}

/** The sheet's rows (a header, then one month each) as the hub keeps them. */
export function parseMsAdsSheet(values: unknown[][] | undefined): MsAdsSheet {
  const out: MsAdsSheet = { months: {}, kinds: {}, currency: null, costPartial: false, through: null, written: null };
  if (!values?.length) return out;
  const head = values[0].map((h) => String(h ?? "").trim().toLowerCase());
  const at = (name: string) => head.indexOf(name);
  const [mi, ii, ci, co, cu, th, wr, cv, rv] = ["month", "impressions", "clicks", "cost", "currency", "through", "written", "conversions", "revenue"].map(at);
  if (mi < 0 || ii < 0) return out;
  for (const row of values.slice(1)) {
    const [key, kind] = String(row[mi] ?? "").trim().split("|");
    const month = key.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    // the Microsoft script's month value row ("2026-09|#value"): its conversions where the impressions are and
    // their value where the cost is - so the sheet's web app did not have to change (20.10.2026)
    if (kind?.trim() === "#value") {
      const t = (out.months[month] ??= { impressions: 0, clicks: 0, cost: 0 });
      t.conversions = num(row[ii]);
      t.revenue = num(row[co]);
      continue;
    }
    const m: MsAdsMonth = { impressions: num(row[ii]), clicks: num(row[ci]), cost: num(row[co]) };
    if (cv >= 0) m.conversions = num(row[cv]);
    if (rv >= 0) m.revenue = num(row[rv]);
    // a value row written before its month's total keeps its figures
    const had = out.months[month];
    if (!kind && had?.revenue != null) { m.conversions ??= had.conversions; m.revenue ??= had.revenue; }
    // a campaign type's share of the month ("2026-09|Performance Max"), or the month's total
    if (kind) (out.kinds[month] ??= {})[kind.trim()] = m;
    else out.months[month] = m;
    if (cu >= 0 && row[cu]) {
      // "CHF", or "CHF (others left out of cost)" when accounts in another currency were left out
      const c = String(row[cu]).trim();
      out.currency = c.slice(0, 3).toUpperCase();
      out.costPartial = /left out/i.test(c);
    }
    if (th >= 0 && row[th]) out.through = sheetDate(row[th])?.slice(0, 10) ?? null;
    if (wr >= 0 && row[wr]) out.written = sheetDate(row[wr]);
  }
  return out;
}

type Monthly = { months: (number | null)[]; py: (number | null)[] };
/**
 * Impressions (R01M), clicks (R02M) and cost (X01M) per month, this year and last; the
 * cost through `toEur` (francs at the month's rate), else as the sheet has it.
 */
export function msAdsSeries(sheet: MsAdsSheet, year: number, toEur?: (amount: number, month: string) => number | null): { R01M: Monthly; R02M: Monthly; X01M: Monthly } {
  const empty = (): Monthly => ({ months: Array(12).fill(null), py: Array(12).fill(null) });
  const out = { R01M: empty(), R02M: empty(), X01M: empty() };
  for (const [month, m] of Object.entries(sheet.months)) {
    const y = Number(month.slice(0, 4)), i = Number(month.slice(5, 7)) - 1;
    const side = y === year ? "months" : y === year - 1 ? "py" : null;
    if (!side || !(i >= 0 && i < 12)) continue;
    out.R01M[side][i] = m.impressions;
    out.R02M[side][i] = m.clicks;
    out.X01M[side][i] = toEur ? toEur(m.cost, month) : m.cost;
  }
  return out;
}

/** Whether the script has stopped writing: the sheet older than `days` days. */
export function msAdsStale(sheet: MsAdsSheet, now: Date, days = 3): boolean {
  const t = sheet.written ? Date.parse(sheet.written) : NaN;
  return !Number.isFinite(t) || now.getTime() - t > days * 86_400_000;
}

/**
 * Microsoft Ads by campaign type per month - impressions, clicks and cost (through `toEur`, or
 * null when the cost cannot be shown in euros) - for Reach's table beside Google's networks.
 */
export function msAdsKindMonths(sheet: MsAdsSheet, toEur?: (amount: number, month: string) => number | null, costOk = true): Record<string, Record<string, [number, number, number | null]>> {
  const out: Record<string, Record<string, [number, number, number | null]>> = {};
  for (const [month, kinds] of Object.entries(sheet.kinds)) {
    for (const [kind, m] of Object.entries(kinds)) {
      (out[month] ??= {})[kind] = [m.impressions, m.clicks, !costOk ? null : toEur ? toEur(m.cost, month) : m.cost];
    }
  }
  return out;
}
