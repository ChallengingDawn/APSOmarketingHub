// WHO ARE OUR CUSTOMERS - every company in HubSpot, read once every 6 hours and
// folded into the cube the customers stage slices (cube.ts). The list API, page
// by page: no search cap, and not the throttled search endpoint. About 600 pages,
// two to three minutes; the page says how far it is.
//
// Revenue is like for like: this year's loaded months against the same months
// last year (a month counts once it is at least 60% loaded, as on the ESO
// benchmark). "Bought" is invoiced revenue this year so far, the figure the
// Active companies KPI shows; last year's is the whole year, shown as context.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { ownerNames } from "@/lib/integrations/erosion";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { monthTotal, monthsLoaded, parsePcMonthly, prioOf } from "@/lib/reporting/esoRules";
import { DIMS, addCompany, potentialBand, type Cube, type Dim } from "./cube";

const KEY = "marketingKpis:customers:v1";
const TTL_MS = 6 * 60 * 60 * 1000;

export function customersCube(): Promise<SlowState<Cube>> {
  return slowReport(KEY, TTL_MS, build);
}

type Obj = { id: string; properties: Record<string, string | null> };
const num = (v: string | null | undefined) => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

async function build(): Promise<Cube> {
  const now = new Date();
  const year = now.getUTCFullYear(), py = year - 1;
  const monthsDone = now.getUTCMonth();
  reportProgress(KEY, "reading the owners");
  const owners = await ownerNames();

  const props = ["sales_priority", "apso_customer", "customer_type", "country_custom", "mandant", "hubspot_owner_id",
    "yearly_customer_potential", `revenue_${year}`, `revenue_${py}`, `rev_${year}_pc_monthly`, `rev_${py}_pc_monthly`];
  type Company = { dims: Record<Dim, string>; bought: boolean; boughtPy: boolean; cy: number[]; py: number[]; potential: number | null };
  const companies: Company[] = [];
  const cyFilled = Array(12).fill(0), pyFilled = Array(12).fill(0);

  let after: string | undefined;
  for (;;) {
    const qs = `limit=100&archived=false&properties=${props.join(",")}${after ? `&after=${after}` : ""}`;
    const r = await hubspotFetchJson<{ results?: Obj[]; paging?: { next?: { after?: string } } }>({ path: `/crm/v3/objects/companies?${qs}` });
    for (const o of r.results ?? []) {
      const p = o.properties;
      const cyB = parsePcMonthly(p[`rev_${year}_pc_monthly`]), pyB = parsePcMonthly(p[`rev_${py}_pc_monthly`]);
      const cy = cyB.map((_, i) => monthTotal(cyB, i)), pyM = pyB.map((_, i) => monthTotal(pyB, i));
      cy.forEach((x, i) => { if (x) cyFilled[i]++; });
      pyM.forEach((x, i) => { if (x) pyFilled[i]++; });
      const potential = num(p.yearly_customer_potential);
      const owner = p.hubspot_owner_id ? owners.get(p.hubspot_owner_id) ?? `Owner ${p.hubspot_owner_id}` : "No owner";
      companies.push({
        dims: {
          prio: prioOf(p.sales_priority),
          segment: p.apso_customer || "No APSO segment",
          potential: potentialBand(potential),
          country: p.country_custom || "Not set",
          owner,
          type: p.customer_type || "Not set",
          mandant: p.mandant || "Not set",
        },
        bought: (num(p[`revenue_${year}`]) ?? 0) > 0,
        boughtPy: (num(p[`revenue_${py}`]) ?? 0) > 0,
        cy, py: pyM, potential,
      });
    }
    reportProgress(KEY, `reading companies: ${companies.length.toLocaleString("en")} so far`);
    after = r.paging?.next?.after;
    if (!after) break;
  }

  // like for like: the months of this year that are loaded, and the same months last year
  const revenueMonths = monthsLoaded(cyFilled, pyFilled, monthsDone);
  const labels = Object.fromEntries(DIMS.map((d) => [d, [] as string[]])) as Record<Dim, string[]>;
  const index = (d: Dim, v: string) => {
    let i = labels[d].indexOf(v);
    if (i < 0) i = labels[d].push(v) - 1;
    return i;
  };
  const acc = new Map<string, number[]>();
  const sum = (xs: number[]) => xs.slice(0, revenueMonths).reduce((a, b) => a + b, 0);
  for (const c of companies) {
    const dims = Object.fromEntries(DIMS.map((d) => [d, index(d, c.dims[d])])) as Record<Dim, number>;
    addCompany(acc, dims, { bought: c.bought, boughtPy: c.boughtPy, rev: sum(c.cy), revPy: sum(c.py), potential: c.potential });
  }
  return { generatedAt: new Date().toISOString(), year, revenueMonths, labels, cells: [...acc.values()].map((c) => c.map(Math.round)) };
}
