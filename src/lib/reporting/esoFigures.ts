// THE ESO REPORTS' FIGURES - revenue and order intake per month, per person, ESO | TSA | Total (SARCLA 24.10.2026:
// "revenue per month per ESO; a toggle ESO | TSA | TOTAL, on click change all; OI MTD, OI YTD as the revenue; to
// forecast" - the forecast "on total per month, as it is today on the dashboard, this data is HubSpot").
//
//   Total        the KPI object's series, exactly what SARCLA's HubSpot dashboard reads: revenue_geo_erp_monthly and
//                oi_geo_monthly (both years cut on the same day, so the running month is month-to-date on both
//                sides) and forecast_monthly (the ERP's forecast, per mandant, for the whole company)
//   ESO, TSA     each customer's own figures, summed under its owner today: the ERP's month-to-date and year-to-date
//                (erp_rev_* / erp_oi_*, written every morning from the ERP file), the months before the running one
//                from the monthly revenue (rev_YYYY_pc_monthly) and order intake (oi_YYYY_mmm) - so a person's months
//                add up to the ERP's figure within the lag of the monthly loads, which the page says
//   team         ESO and TSA by the rosters (src/lib/datatracker/rosters.ts); everyone else "Other", no owner "None"
//
// Kept as aggregates per owner: no company, contact or customer number leaves this file.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { fetchKpiSeries } from "@/lib/integrations/hubspotKpi";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { readOwners } from "@/lib/ownerRules/hubspot";
import { asOfOf, booksOf, companyProps, monthsOfSeries, oiLoaded, type CompanyIn, type EsoFigures } from "./esoFiguresRules";

export type { Book, EsoFigures, MPair, Team } from "./esoFiguresRules";

const KEY = "esoFigures:v1";
/** the ERP file arrives once a morning; read again after six hours */
const TTL_MS = 6 * 60 * 60 * 1000;

export const esoFigures = (): Promise<SlowState<EsoFigures>> => slowReport(KEY, TTL_MS, build);

/* ── the read ──────────────────────────────────────────────────────────── */

type Row = { id: string; properties?: CompanyIn };

async function build(): Promise<EsoFigures> {
  const errors: string[] = [];
  const now = new Date();
  // the companies the ERP file carries: its figures, their months, their owner
  const year0 = now.getUTCFullYear();
  const props = companyProps(year0);
  const companies: CompanyIn[] = [];
  let lastId = "0";
  for (let page = 0; page < 400; page++) {
    const r = await hubspotFetchJson<{ results?: Row[] }>({
      path: "/crm/v3/objects/companies/search", method: "POST",
      body: {
        limit: 200, properties: props,
        filterGroups: [{ filters: [{ propertyName: "erp_rev_as_of", operator: "HAS_PROPERTY" }, { propertyName: "hs_object_id", operator: "GT", value: lastId }] }],
        sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
      },
    });
    const rows = r.results ?? [];
    for (const x of rows) companies.push(x.properties ?? {});
    reportProgress(KEY, `the customers with ERP figures · ${companies.length.toLocaleString("en")}`);
    if (rows.length < 200) break;
    lastId = rows[rows.length - 1].id;
  }
  if (!companies.length) throw new Error("No company carries ERP figures - the morning ERP load has not run, nothing to show");
  const asOf = asOfOf(companies);
  const year = asOf ? Number(asOf.slice(0, 4)) : year0;
  const month = asOf ? Number(asOf.slice(5, 7)) : now.getUTCMonth() + 1;
  if (year !== year0) errors.push(`The ERP figures are of ${asOf}, a year before today - the months shown are that year's.`);

  const names = new Map<string, { name: string; active: boolean }>();
  try { for (const o of await readOwners()) names.set(String(o.id), { name: o.name, active: o.active }); } catch (e) { errors.push(`Owner names not read: ${String((e as Error).message).slice(0, 120)}`); }
  const books = booksOf(companies, year, month, names);

  reportProgress(KEY, "the company's series (KPI)");
  const series = async (cat: string) => { try { return await fetchKpiSeries(cat); } catch (e) { errors.push(`${cat} not read: ${String((e as Error).message).slice(0, 120)}`); return []; } };
  const [rev, oi, fc] = [await series("revenue_geo_erp_monthly"), await series("oi_geo_monthly"), await series("forecast_monthly")];
  return {
    generatedAt: new Date().toISOString(), asOf, year, py: year - 1, month, oiMonths: oiLoaded(books, month),
    books, total: { rev: monthsOfSeries(rev, year), oi: monthsOfSeries(oi, year), forecast: monthsOfSeries(fc, year).map((m) => m.cy) },
    companies: companies.length, errors,
  };
}
