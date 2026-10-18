// MICROSOFT ADS FROM THE SCRIPT'S SHEET - pure. A Microsoft Advertising script adds up the
// account's impressions, clicks and cost per month every morning and writes them, through
// the sheet's web app, into a Google Sheet the hub reads with its service account
// (scripts/microsoft-ads; SARCLA 18.10: no typing - "manual, it's shit" - and no Azure app).

/** The sheet the script writes - not a secret: only the hub's service account may read it. */
// "APSOhub – Microsoft Ads", shared with the hub's service account (SARCLA 18.10)
export const MSADS_SHEET_ID = "16QuE9tOmBMEMvAj8mdCLLcgytix9hM4bKONB7iwkcdQ";
export const msAdsSheetId = () => process.env.MSADS_SHEET_ID || MSADS_SHEET_ID;

export type MsAdsMonth = { impressions: number; clicks: number; cost: number };
export type MsAdsSheet = {
  months: Record<string, MsAdsMonth>;
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

/** The sheet's rows (a header, then one month each) as the hub keeps them. */
export function parseMsAdsSheet(values: unknown[][] | undefined): MsAdsSheet {
  const out: MsAdsSheet = { months: {}, currency: null, costPartial: false, through: null, written: null };
  if (!values?.length) return out;
  const head = values[0].map((h) => String(h ?? "").trim().toLowerCase());
  const at = (name: string) => head.indexOf(name);
  const [mi, ii, ci, co, cu, th, wr] = ["month", "impressions", "clicks", "cost", "currency", "through", "written"].map(at);
  if (mi < 0 || ii < 0) return out;
  for (const row of values.slice(1)) {
    const month = String(row[mi] ?? "").trim().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    out.months[month] = { impressions: num(row[ii]), clicks: num(row[ci]), cost: num(row[co]) };
    if (cu >= 0 && row[cu]) {
      // "CHF", or "CHF (others left out of cost)" when accounts in another currency were left out
      const c = String(row[cu]).trim();
      out.currency = c.slice(0, 3).toUpperCase();
      out.costPartial = /left out/i.test(c);
    }
    if (th >= 0 && row[th]) out.through = String(row[th]).trim().slice(0, 10);
    if (wr >= 0 && row[wr]) out.written = String(row[wr]).trim();
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
