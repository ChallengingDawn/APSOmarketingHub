// THE ESO CUSTOMER DEVELOPMENT PAGE'S READ (SARCLA 29.10.2026: "work on ESO Reports -> customer development" - rebuilt
// like Visits): every company that bought in the last four years, of everyone (ESO, TSA and the rest - the Figures'
// ESO | TSA | Total and the line managers' teams), each as one small row: its Performis SAE as a person (as the Figures
// split revenue), what the page slices it by, its revenue by month for four years (rev_<year>_pc_monthly - lost needs the
// 24 months before last year's same day) and its orders by month for this year and the last (HubSpot's orders, counted
// as the company's "total orders" counts them). The rules in ./customerDevRules.ts. Read again when a newer ERP delivery
// is on record, else every 12 hours, through slowReport: the first visitor starts it, everyone after gets it.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { ownerNames } from "@/lib/integrations/erosion";
import { chainHistory } from "@/lib/connectors/chainStatus";
import { ORDER_PIPELINE, STAGE, day } from "@/lib/connectors/steps/rules";
import { teamOf } from "@/lib/datatracker/rosters";
import { readOwners } from "@/lib/ownerRules/hubspot";
import { getRules } from "@/lib/mapAssign/engine";
import { SEED } from "@/lib/mapAssign/seed";
import { saeLabel } from "@/lib/marketingKpis/cube";
import { CATEGORY_BANDS, PRIO_BANDS, categoryBand, monthTotal, monthsLoaded, parsePcMonthly, prioBand, prioOf } from "./esoRules";
import { CY0, FIRST_BEFORE, FIRST_NONE, POTENTIAL_BANDS, bandOf, monthNo, orderBase, usable, type CustDevData } from "./customerDevRules";

const KEY = "esoCustomerDev:v1";
const TTL_MS = 12 * 60 * 60 * 1000;

export async function esoCustomerDev(): Promise<SlowState<CustDevData>> {
  const day = await lastDelivery();
  return slowReport(KEY, (v: CustDevData) => (day && v?.dataDay !== day ? 0 : TTL_MS), readCustomerDev);
}

/** The day of the last ERP delivery the chain ran, or nothing when none is on record (or no database here). */
async function lastDelivery(): Promise<string | undefined> {
  try { return (await chainHistory()).map((d) => d.day).sort().pop(); } catch { return undefined; }
}

type Row = { id: string; properties?: Record<string, string | null> };
type Filter = { propertyName: string; operator: string; value?: string; values?: string[] };
const num = (v: string | null | undefined) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const ms = (d: string) => String(Date.parse(`${d}T00:00:00Z`));

/** Every row of a search, past HubSpot's 10,000 cap: an id cursor in each group (any group's match is a row). */
async function searchAll(object: string, groups: Filter[][], properties: string[], label: string): Promise<Row[]> {
  const out: Row[] = [];
  let lastId = "0";
  for (let page = 0; page < 5000; page++) {
    const r = await hubspotFetchJson<{ results?: Row[] }>({
      path: `/crm/v3/objects/${object}/search`, method: "POST",
      body: {
        limit: 200, properties, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
        filterGroups: groups.map((filters) => ({ filters: [...filters, { propertyName: "hs_object_id", operator: "GT", value: lastId }] })),
      },
    });
    const rows = r.results ?? [];
    out.push(...rows);
    reportProgress(KEY, `${label} · ${out.length.toLocaleString("en")}`);
    if (rows.length < 200) break;
    lastId = rows[rows.length - 1].id;
  }
  return out;
}

/** The read - exported for a local check against HubSpot (scratchpad), the page reads it through esoCustomerDev. */
export async function readCustomerDev(): Promise<CustDevData> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const years = [year - 3, year - 2, year - 1, year];

  // 1. the people: owners' names and teams, the SAE -> person mapping Map assignment keeps (as the customers' cube)
  reportProgress(KEY, "reading the owners");
  const owners = await ownerNames().catch(() => new Map<string, string>());
  const hsTeam = new Map<string, string>();
  try { for (const o of await readOwners()) if (o.team) hsTeam.set(String(o.id), o.team); } catch { /* the rosters alone */ }
  const teamFor = (id: string) => teamOf(id) ?? (/\bTSA\b/i.test(hsTeam.get(id) ?? "") ? "TSA" : /\bESO\b/i.test(hsTeam.get(id) ?? "") ? "ESO" : "Other");
  let saeMap: Record<string, string> = SEED.sae;
  try { saeMap = (await getRules()).value.sae ?? SEED.sae; } catch { /* the seed */ }

  // 2. every company that bought in the four years: a last order since then, or revenue in one of them
  const props = ["sae_performis", "sales_priority", "apso_customer", "customer_type", "country_custom", "yearly_customer_potential", "order_first_order_date", "name",
    ...years.map((y) => `rev_${y}_pc_monthly`)];
  const groups: Filter[][] = [
    [{ propertyName: "order_last_order_date", operator: "GTE", value: ms(`${years[0]}-01-01`) }],
    ...years.map((y) => [{ propertyName: `rev_${y}_pc_monthly`, operator: "HAS_PROPERTY" }]),
  ];
  const rows = await searchAll("companies", groups, props, "reading the companies that bought");

  const people: CustDevData["people"] = [];
  const personIdx = new Map<string, number>();
  const labels: CustDevData["labels"] = { prio: [...PRIO_BANDS], category: [...CATEGORY_BANDS], type: [], country: [], band: [...POTENTIAL_BANDS] };
  const at = (list: string[], v: string) => { let i = list.indexOf(v); if (i < 0) i = list.push(v) - 1; return i; };
  const filled = { cy: Array(12).fill(0), py: Array(12).fill(0) };
  const companies: number[][] = [], revenue: number[][] = [], names: string[] = [], ids: string[] = [];
  const coIdx = new Map<string, number>();
  for (const r of rows) {
    if (coIdx.has(r.id)) continue;
    const p = r.properties ?? {};
    const rev: number[] = [];
    let bought = false;
    years.forEach((y, yi) => {
      const blob = parsePcMonthly(p[`rev_${y}_pc_monthly`]);
      for (let m = 0; m < 12; m++) {
        const v = Math.round(monthTotal(blob, m));
        if (!v) continue;
        rev.push(yi * 12 + m, v);
        if (v > 0) bought = true;
        if (yi === 3) filled.cy[m]++;
        if (yi === 2) filled.py[m]++;
      }
    });
    const firstDay = day(p.order_first_order_date);
    const k = monthNo(firstDay, year);
    const first = k != null ? k : firstDay && firstDay < `${years[0]}-01-01` ? FIRST_BEFORE : FIRST_NONE;
    // kept: bought in the four years, or a first order in them not invoiced yet (a new customer all the same)
    if (!bought && first < 0) continue;
    const s = saeLabel(p.sae_performis, saeMap, owners);
    let pi = personIdx.get(s.label);
    if (pi === undefined) {
      pi = people.push({ name: s.label, team: s.owner ? teamFor(s.owner) : /^TSA\b/i.test(s.label) ? "TSA" : /^ESO\b/i.test(s.label) ? "ESO" : "Other" }) - 1;
      personIdx.set(s.label, pi);
    }
    const pot = num(p.yearly_customer_potential);
    coIdx.set(r.id, companies.length);
    companies.push([
      pi, at(labels.prio, prioBand(prioOf(p.sales_priority))), at(labels.category, categoryBand(p.apso_customer)), at(labels.type, p.customer_type || "Not set"),
      at(labels.country, p.country_custom || "Not set"), at(labels.band, bandOf(pot)), usable(pot) ? Math.round(pot) : 0, first,
    ]);
    revenue.push(rev);
    names.push(p.name ?? "");
    ids.push(r.id);
  }

  // 3. the orders of this year and the last, counted as the company's "total orders" counts them (companyFacts): the
  //    order pipeline, an ERP number, no credit note ("G…", or its stage) and nothing cancelled; one order per base number
  const ordersFrom = CY0 - 12;
  const orderRows = await searchAll("orders", [[{ propertyName: "order_order_date", operator: "GTE", value: ms(`${year - 1}-01-01`) }]],
    ["order_order_number", "order_order_date", "hs_pipeline", "hs_pipeline_stage"], "reading this year's and last year's orders");
  const bases = new Map<string, { id: string; k: number; d: string }>();
  for (const o of orderRows) {
    const p = o.properties ?? {};
    if (p.hs_pipeline && p.hs_pipeline !== ORDER_PIPELINE) continue;
    const n = (p.order_order_number ?? "").trim();
    const st = p.hs_pipeline_stage ?? null;
    if (!n || n.startsWith("G") || st === STAGE.creditNote || st === STAGE.cancelled) continue;
    const d = day(p.order_order_date);
    const k = monthNo(d, year);
    if (!d || k == null || k < ordersFrom) continue;
    const b = orderBase(n), was = bases.get(b);
    if (!was || d < was.d) bases.set(b, { id: o.id, k, d });
  }
  // each order's company - one record per base number is enough
  const reps = [...bases.values()];
  const perCo = new Map<number, Map<number, number>>();
  let linked = 0;
  for (let i = 0; i < reps.length; i += 1000) {
    const chunk = reps.slice(i, i + 1000);
    const byId = new Map(chunk.map((x) => [x.id, x.k]));
    const r = await hubspotFetchJson<{ results?: { from?: { id?: string }; to?: { toObjectId?: number | string }[] }[] }>({
      path: "/crm/v4/associations/orders/companies/batch/read", method: "POST", body: { inputs: chunk.map((x) => ({ id: x.id })) },
    });
    for (const row of r.results ?? []) {
      const k = byId.get(String(row.from?.id ?? ""));
      if (k == null) continue;
      let any = false;
      for (const t of row.to ?? []) {
        const ci = coIdx.get(String(t.toObjectId));
        if (ci === undefined) continue;
        any = true;
        let m = perCo.get(ci);
        if (!m) { m = new Map(); perCo.set(ci, m); }
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      if (any) linked++;
    }
    reportProgress(KEY, `linking orders to companies · ${Math.min(i + 1000, reps.length).toLocaleString("en")}`);
  }
  const orders = companies.map((_, ci) => [...(perCo.get(ci) ?? new Map<number, number>())].sort((a, b) => a[0] - b[0]).flat());

  // 4. how far the revenue reaches: complete months (the customers' cube's 60% rule), and the month in progress up to
  //    the day of the last ERP delivery the chain ran (yesterday when none is on record)
  const loaded = monthsLoaded(filled.cy, filled.py, now.getUTCMonth());
  const delivered = await lastDelivery();
  const reach = delivered ? new Date(`${delivered}T00:00:00Z`) : new Date(Date.now() - 86_400_000);
  const running = reach.getUTCFullYear() === year && reach.getUTCMonth() >= loaded
    ? { month: CY0 + reach.getUTCMonth(), day: reach.getUTCDate(), days: new Date(Date.UTC(year, reach.getUTCMonth() + 1, 0)).getUTCDate() }
    : null;
  return {
    generatedAt: new Date().toISOString(), year, today: now.toISOString().slice(0, 10), loaded, running, dataDay: delivered ?? null, ordersFrom,
    people, labels, companies, revenue, orders, names, ids,
    coverage: { companies: companies.length, orders: bases.size, ordersLinked: linked },
  };
}
