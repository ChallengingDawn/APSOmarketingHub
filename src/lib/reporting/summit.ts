// Where APSOparts stands on the way to 30 M€ - the figures summitRules.ts draws, read from HubSpot's KPI
// object: the full years from revenue_year ("13 Full year", built from every company's monthly revenue)
// and the running year from the ERP series, both years cut on the same day. Read again at most once an hour.

import { KPI_SERIES, fetchKpiSeries, likeForLike } from "@/lib/integrations/hubspotKpi";
import { summitOf, type Summit } from "./summitRules";

const HOUR = 3_600_000;
let cache: { at: number; value: Promise<Summit & { generatedAt: string }> } | null = null;

async function read(): Promise<Summit & { generatedAt: string }> {
  const thisYear = new Date().getUTCFullYear();
  const [years, erp] = await Promise.all([
    fetchKpiSeries("revenue_year"),
    fetchKpiSeries(KPI_SERIES.revenueByCountry).catch(() => null),
  ]);
  // "13 Full year" rows of the finished years; the running year's is marked not comparable
  const full = years.filter((r) => r.month === 13 && r.year != null && r.comparable).map((r) => ({ year: r.year as number, value: r.value }));
  const lfl = erp ? likeForLike(erp) : null;
  return { ...summitOf(full, lfl, thisYear), generatedAt: new Date().toISOString() };
}

export function summit(fresh = false): Promise<Summit & { generatedAt: string }> {
  if (fresh || !cache || Date.now() - cache.at > HOUR) {
    const value = read();
    cache = { at: Date.now(), value };
    value.catch(() => { cache = null; });
  }
  return cache.value;
}
