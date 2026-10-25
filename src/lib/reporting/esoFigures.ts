// THE ESO REPORTS' FIGURES - the company's own series (SARCLA 24.10.2026: the forecast "on total per month, as it is
// today on the dashboard, this data is HubSpot"): the KPI object's revenue_geo_erp_monthly and oi_geo_monthly (both
// years cut on the same day) and forecast_monthly (the ERP's forecast, per mandant - the whole company only). The rest
// of the page - per sales rep, country, priority… - is the customers' cube (marketingKpis/customers.ts).

import { fetchKpiSeries } from "@/lib/integrations/hubspotKpi";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { familiesOf, monthsOfSeries, type EsoFigures } from "./esoFiguresRules";

export type { EsoFigures, Family, MPair } from "./esoFiguresRules";

// v2: the series only - the customers' figures moved into the cube; v3: the revenue per profit centre beside them
const KEY = "esoFigures:v3";
/** the ERP file arrives once a morning; read again after six hours */
const TTL_MS = 6 * 60 * 60 * 1000;

export const esoFigures = (): Promise<SlowState<EsoFigures>> => slowReport(KEY, TTL_MS, build);

async function build(): Promise<EsoFigures> {
  const errors: string[] = [];
  const year = new Date().getUTCFullYear();
  reportProgress(KEY, "the company's series (KPI)");
  const series = async (cat: string) => { try { return await fetchKpiSeries(cat); } catch (e) { errors.push(`${cat} not read: ${String((e as Error).message).slice(0, 120)}`); return []; } };
  const [rev, oi, fc, pc] = [await series("revenue_geo_erp_monthly"), await series("oi_geo_monthly"), await series("forecast_monthly"), await series("revenue_pc_monthly")];
  return { generatedAt: new Date().toISOString(), year, py: year - 1, total: { rev: monthsOfSeries(rev, year), oi: monthsOfSeries(oi, year), forecast: monthsOfSeries(fc, year).map((m) => m.cy) }, pc: familiesOf(pc, year), errors };
}
