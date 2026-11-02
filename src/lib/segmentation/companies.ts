// SMART SEGMENTATION - the companies behind the tabs: the shapes and the pure helpers (client-safe; the reads are in
// ../integrations/segmentationCompanies.ts).

export const PAGE = 25;
/** HubSpot's search reaches the first 10,000 of any order */
export const SEARCH_CAP = 10_000;
export const SORTS = { basis: "max_pot_or_turnover", potential: "yearly_customer_potential", best: "max_revenue_2015_2026", revenue: "revenue", name: "name" } as const;
export type SortKey = keyof typeof SORTS;
export const NO_SEGMENT = "No APSO segment";

export type CompanyRow = {
  id: string; name: string; country: string; segment: string; prio: string; major: string; split: string;
  potential: number | null; basis: number | null; best: number | null; revenue: number | null; owner: string;
};
export type CompaniesPage = { total: number; page: number; rows: CompanyRow[]; year: number };
export type CompanyFilter = { seg?: string; prio?: string; major?: string; split?: string; q?: string; sort?: SortKey; dir?: "asc" | "desc"; page?: number };

export type PcMix = { at: string; total: number; major: { value: string; n: number }[]; split: { value: string; n: number }[] };
/** The kind of split a value is: no orders, one centre (>80 % or 100 %), two centres, three or more. */
export type SplitKind = "none" | "one" | "two" | "more" | "empty";
export function splitKind(v: string): SplitKind {
  const s = v.trim();
  if (!s) return "empty";
  if (/^no sales$/i.test(s)) return "none";
  if (/^(>\s*80\s*%|100\s*%)/i.test(s)) return "one";
  if (/mix/i.test(s)) return "more";
  if (/^majo[rt]\s+\w+,\s*then\s+\w+$/i.test(s)) return "two";
  return "more";
}
