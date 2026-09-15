// BUYING COMPANIES — how many companies order in each calendar year, from the
// ERP (Compass) values the connector writes on HubSpot companies: order intake
// per year (oi_YYYY) and the year of the first order (compass_first_order_year).
// The Performis E-Shop Data Tracker's yearly login and order counts sit beside
// them. Every figure is a HubSpot search total; a year whose property does not
// exist is null, never 0.

import { companyPropertyNames, countWhere, gt0 } from "./hubspotCounts";

/** Calendar years shown, the current one included. */
export const BUYER_YEARS = 6;

export type BuyerYear = {
  year: number;
  /** Companies with order intake above zero in the year. */
  ordering: number | null;
  /** …that also had order intake the year before. */
  returning: number | null;
  /** Companies whose first ERP order fell in the year (the figure SMEC targets use). */
  firstOrder: number | null;
  /** E-Shop Data Tracker: companies with at least one login / one e-shop order in the year; null for years never loaded. */
  eshopLogins: number | null;
  eshopOrders: number | null;
};

export type BuyerYears = {
  generatedAt: string;
  currentYear: number;
  /** Oldest first. */
  years: BuyerYear[];
  /** Companies ordering in the year before the first one shown, so that year's "not back" can be worked out. */
  orderingBefore: number | null;
};

/** About thirty sequential searches, so the route caches the result for five minutes. */
export async function fetchBuyerYears(params: { currentYear: number; signal?: AbortSignal }): Promise<BuyerYears> {
  const { currentYear, signal } = params;
  const props = await companyPropertyNames(signal);
  const count = async (name: string) => (props.has(name) ? countWhere("companies", [gt0(name)], signal) : null);
  const first = currentYear - BUYER_YEARS + 1;

  const orderingBefore = await count(`oi_${first - 1}`);
  const years: BuyerYear[] = [];
  for (let year = first; year <= currentYear; year++) {
    const oi = `oi_${year}`;
    const oiBefore = `oi_${year - 1}`;
    const ordering = await count(oi);
    const returning = props.has(oi) && props.has(oiBefore) ? await countWhere("companies", [gt0(oiBefore), gt0(oi)], signal) : null;
    const firstOrder = props.has("compass_first_order_year")
      ? await countWhere("companies", [{ propertyName: "compass_first_order_year", operator: "EQ", value: String(year) }], signal)
      : null;
    const eshopLogins = await count(`n_of_logins_datatracker_${year}`);
    const eshopOrders = await count(`orders_datatracker_${year}`);
    years.push({ year, ordering, returning, firstOrder, eshopLogins, eshopOrders });
  }
  return { generatedAt: new Date().toISOString(), currentYear, years, orderingBefore };
}
