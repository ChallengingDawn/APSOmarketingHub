// WHO ARE OUR CUSTOMERS - every company in HubSpot, read once every 6 hours and
// folded into the cube the customers page slices (cube.ts). The list API, page
// by page: no search cap, and not the throttled search endpoint. About 600 pages,
// two to three minutes; the page says how far it is, and shows the last read
// while a new one runs.
//
// Revenue per month for this year and the two before, from each company's
// rev_<year>_pc_monthly; this year's months count once they are loaded (at
// least 60% as many companies with a figure as the same month last year, as on
// the ESO benchmark), so a window never compares a half-loaded month.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { ownerNames } from "@/lib/integrations/erosion";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { monthTotal, monthsLoaded, parsePcMonthly, prioOf } from "@/lib/reporting/esoRules";
import { DIMS, fold, potentialBand, type CompanyIn, type Cube, type Dim } from "./cube";

const KEY = "marketingKpis:customers:v3";
const TTL_MS = 6 * 60 * 60 * 1000;

export function customersCube(): Promise<SlowState<Cube>> {
  return slowReport(KEY, TTL_MS, build);
}

type Obj = { id: string; properties: Record<string, string | null> };
const num = (v: string | null | undefined) => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

async function build(): Promise<Cube> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const years = [year, year - 1, year - 2];
  const monthsDone = now.getUTCMonth();
  reportProgress(KEY, "reading the owners");
  const owners = await ownerNames();

  const props = ["sales_priority", "apso_customer", "customer_type", "country_custom", "mandant", "hubspot_owner_id",
    "yearly_customer_potential", ...years.map((y) => `rev_${y}_pc_monthly`)];
  const labels = Object.fromEntries(DIMS.map((d) => [d, [] as string[]])) as Record<Dim, string[]>;
  const index = (d: Dim, v: string) => {
    let i = labels[d].indexOf(v);
    if (i < 0) i = labels[d].push(v) - 1;
    return i;
  };
  const companies: CompanyIn[] = [];
  const filled = years.map(() => Array(12).fill(0));

  let after: string | undefined;
  for (;;) {
    const qs = `limit=100&archived=false&properties=${props.join(",")}${after ? `&after=${after}` : ""}`;
    const r = await hubspotFetchJson<{ results?: Obj[]; paging?: { next?: { after?: string } } }>({ path: `/crm/v3/objects/companies?${qs}` });
    for (const o of r.results ?? []) {
      const p = o.properties;
      const months = years.map((y, yi) => {
        const blob = parsePcMonthly(p[`rev_${y}_pc_monthly`]);
        return blob.map((_, m) => {
          const x = monthTotal(blob, m);
          if (x) filled[yi][m]++;
          return x;
        });
      });
      const potential = num(p.yearly_customer_potential);
      const owner = p.hubspot_owner_id ? owners.get(p.hubspot_owner_id) ?? `Owner ${p.hubspot_owner_id}` : "No owner";
      companies.push({
        dims: {
          prio: index("prio", prioOf(p.sales_priority)),
          segment: index("segment", p.apso_customer || "No APSO segment"),
          potential: index("potential", potentialBand(potential)),
          country: index("country", p.country_custom || "Not set"),
          owner: index("owner", owner),
          type: index("type", p.customer_type || "Not set"),
          mandant: index("mandant", p.mandant || "Not set"),
        },
        potential, months,
      });
    }
    reportProgress(KEY, `reading companies: ${companies.length.toLocaleString("en")} so far`);
    after = r.paging?.next?.after;
    if (!after) break;
  }

  const loaded = [monthsLoaded(filled[0], filled[1], monthsDone), 12, 12];
  return { generatedAt: new Date().toISOString(), years, loaded, labels, ...fold(companies) };
}
