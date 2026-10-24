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
import { chainHistory } from "@/lib/connectors/chainStatus";
import { MONTHS, monthTotal, monthsLoaded, parsePcMonthly, prioOf } from "@/lib/reporting/esoRules";
import { teamOf } from "@/lib/datatracker/rosters";
import { readOwners } from "@/lib/ownerRules/hubspot";
import { DIMS, fold, monthOf, potentialBand, type CompanyIn, type Cube, type Dim } from "./cube";

// v8: order intake per month beside the revenue, and each sales rep's team (the ESO reports' Figures, 24.10.2026)
// v9: the ERP's own month and year to date per company, the order intake months loaded, the team from HubSpot's teams
const KEY = "marketingKpis:customers:v9";
/** The ERP file's figures per company (the morning load, erpRevenue.ts), in cube.ts's ERP_FIELDS order. */
const ERP_PROPS = ["erp_rev_mtd_cy", "erp_rev_mtd_py", "erp_rev_ytd_cy", "erp_rev_ytd_py", "erp_oi_mtd_cy", "erp_oi_mtd_py", "erp_oi_ytd_cy", "erp_oi_ytd_py"] as const;
const TTL_MS = 6 * 60 * 60 * 1000;

/**
 * The read moves with the ERP: as soon as a newer delivery is on record than the
 * one the read stands on, it is read again (SARCLA 14.10: "still frozen on 12
 * October - this should go forward as we move"). Otherwise every 6 hours.
 */
export async function customersCube(): Promise<SlowState<Cube>> {
  const day = await lastDelivery();
  return slowReport(KEY, (v: Cube) => (day && v?.dataDay !== day ? 0 : TTL_MS), build);
}

/** The day of the last ERP delivery the chain ran, or nothing when none is on record (or no database here). */
async function lastDelivery(): Promise<string | undefined> {
  try { return (await chainHistory()).map((d) => d.day).sort().pop(); } catch { return undefined; }
}

type Obj = { id: string; properties: Record<string, string | null> };
/** The month number (0 = January of the year before last) of a first order "2026-05-08"; null outside the three years. */
function firstMonthOf(v: string | null | undefined, firstYear: number): number | null {
  const m = /^(\d{4})-(\d{2})/.exec(v ?? "");
  if (!m) return null;
  const k = (Number(m[1]) - firstYear) * 12 + Number(m[2]) - 1;
  return k >= 0 && k <= 35 ? k : null;
}
const num = (v: string | null | undefined) => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** The company properties that place a company in the cube. */
export const DIM_PROPS = ["sales_priority", "apso_customer", "customer_type", "apic_ap", "country_custom", "mandant", "hubspot_owner_id", "yearly_customer_potential"];
/** Where a company sits on each dimension - shared with the online share's read (online.ts), so both place it alike. */
export function labelsOf(p: Record<string, string | null | undefined>, owners: Map<string, string>): Record<Dim, string> {
  return {
    prio: prioOf(p.sales_priority),
    segment: p.apso_customer || "No APSO segment",
    potential: potentialBand(num(p.yearly_customer_potential)),
    country: p.country_custom || "Not set",
    owner: p.hubspot_owner_id ? owners.get(p.hubspot_owner_id) ?? `Owner ${p.hubspot_owner_id}` : "No owner",
    type: p.customer_type || "Not set",
    apic: p.apic_ap || "Not set",
    mandant: p.mandant || "Not set",
  };
}

async function build(): Promise<Cube> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const years = [year, year - 1, year - 2];
  const monthsDone = now.getUTCMonth();
  reportProgress(KEY, "reading the owners");
  const owners = await ownerNames();

  // order intake per month as the nightly revenue load writes it (oi_2026_jan…) - 36 names, well inside the address's 2 KB
  const props = [...DIM_PROPS, "order_first_order_date", ...years.map((y) => `rev_${y}_pc_monthly`), ...years.flatMap((y) => MONTHS.map((m) => `oi_${y}_${m}`)), ...ERP_PROPS, "erp_rev_as_of"];
  const teams: Record<string, string> = {};
  // a sales rep's team: the roster first, else the team HubSpot has them in (as Retain & grow's path does)
  const hsTeam = new Map<string, string>();
  try { for (const o of await readOwners()) if (o.team) hsTeam.set(String(o.id), o.team); } catch { /* the rosters alone */ }
  const teamFor = (id: string) => teamOf(id) ?? (/\bTSA\b/i.test(hsTeam.get(id) ?? "") ? "TSA" : /\bESO\b/i.test(hsTeam.get(id) ?? "") ? "ESO" : "Other");
  const filledOi = years.map(() => Array(12).fill(0));
  const erpDays = new Map<string, number>();
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
      const l = labelsOf(p, owners);
      if (p.hubspot_owner_id && !teams[l.owner]) teams[l.owner] = teamFor(p.hubspot_owner_id);
      const intake = years.map((y, yi) => MONTHS.map((m, mi) => { const x = num(p[`oi_${y}_${m}`]) ?? 0; if (x) filledOi[yi][mi]++; return x; }));
      const erp = ERP_PROPS.map((k) => num(p[k]) ?? 0);
      const erpDay = String(p.erp_rev_as_of ?? "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(erpDay)) erpDays.set(erpDay, (erpDays.get(erpDay) ?? 0) + 1);
      companies.push({
        dims: Object.fromEntries(DIMS.map((d) => [d, index(d, l[d])])) as Record<Dim, number>,
        potential, months,
        firstMonth: firstMonthOf(p.order_first_order_date, years[2]),
        intake, erp: erp.some((x) => x !== 0) ? erp : null,
      });
    }
    reportProgress(KEY, `reading companies: ${companies.length.toLocaleString("en")} so far`);
    after = r.paging?.next?.after;
    if (!after) break;
  }

  const loaded = [monthsLoaded(filled[0], filled[1], monthsDone), 12, 12];
  // The month in progress reaches the day of the last ERP delivery the chain ran
  // (yesterday when no delivery is on record): year to date and month to date end there.
  const day = await lastDelivery();
  const reach = day ? new Date(`${day}T00:00:00Z`) : new Date(Date.now() - 86_400_000);
  const running = reach.getUTCFullYear() === year && reach.getUTCMonth() >= loaded[0]
    ? { month: monthOf(0, reach.getUTCMonth()), day: reach.getUTCDate(), days: new Date(Date.UTC(year, reach.getUTCMonth() + 1, 0)).getUTCDate() }
    : null;
  // the ERP day most companies carry (a straggler from an older file does not move it)
  const erpDay = [...erpDays].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] ?? null;
  return { generatedAt: new Date().toISOString(), years, loaded, running, dataDay: day ?? null, labels, teams, erpDay, oiLoaded: monthsLoaded(filledOi[0], filledOi[1], monthsDone), ...fold(companies) };
}
