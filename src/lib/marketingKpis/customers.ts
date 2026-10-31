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
//
// A few companies alone (the customer filter, SARCLA 26.10.2026: "customer as well"): read the same way and folded the
// same way, with the whole read's months and days - so every chart draws them as it draws everyone.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { ownerNames } from "@/lib/integrations/erosion";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { chainHistory } from "@/lib/connectors/chainStatus";
import { lastRun } from "@/lib/connectors/steps/run";
import { MONTHS, monthTotal, monthsLoaded, parsePcMonthly, prioOf } from "@/lib/reporting/esoRules";
import { teamOf } from "@/lib/datatracker/rosters";
import { readOwners } from "@/lib/ownerRules/hubspot";
import { DIMS, fold, monthOf, potentialBand, saeLabel, type CompanyIn, type Cube, type Dim } from "./cube";
import { getRules } from "@/lib/mapAssign/engine";
import { SEED } from "@/lib/mapAssign/seed";

// v8: order intake per month beside the revenue, and each sales rep's team (the ESO reports' Figures, 24.10.2026)
// v9: the ERP's own month and year to date per company, the order intake months loaded, the team from HubSpot's teams
// v10: the Performis SAE as a dimension, as its person (the Figures' split next to the company owner, 24.10.2026)
// v11: the revenue kept apart by profit centre too (the Figures' Profit center tab, 25.10.2026)
// (the new customers' revenue since their first order came in under the same key, 29.10.2026, and on 31.10 their first
// invoice instead of their first order, with their order intake: a read without newKind "invoice" is read again, the last
// one shown meanwhile - the ESO New customers; a read without newHistory, from before the revenue since 2015 decided the
// companies whose first order is the ERP's carried-over date, is read again too)
const KEY = "marketingKpis:customers:v11";
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
  // and as soon as the ERP morning workbook has run again on its own - "Run now" on the chain page writes each customer's
  // monthly order intake (SARCLA 31.10.2026: "I've run it" - the Figures would have waited up to 6 hours to see it)
  const erp = await lastRun("live", "erp_revenue").then((r) => (r?.finished && !r.error ? Date.parse(r.finished) : 0)).catch(() => 0);
  return slowReport(KEY, (v: Cube) => ((day && v?.dataDay !== day) || v?.newKind !== "invoice" || v?.newHistory !== HISTORY_FROM || (erp && Date.parse(v?.generatedAt ?? "") < erp) ? 0 : TTL_MS), build);
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
/** The first year HubSpot keeps a company's revenue for (rev_2015_pc_monthly on). */
const HISTORY_FROM = 2015;
/** A first order before HISTORY_FROM: the date the ERP carried the customer over with, not a purchase anyone has on record. */
const carriedOver = (firstOrder: string | null | undefined) => { const y = /^(\d{4})/.exec(firstOrder ?? ""); return !!y && Number(y[1]) < HISTORY_FROM; };
/**
 * A new customer's month as the BSC report counts it (SARCLA 31.10.2026: "why also not the same figures"): its first
 * invoice - the first month with revenue in the three years read - unless HubSpot has a first order from 2015 to before
 * them (an old customer coming back is not new). A carried-over first order (2014 and before) decides nothing: the
 * revenue since 2015 does (withoutHistory). Checked against the BSC's 1,389 new customers of 2026 one by one, 31.10.2026.
 */
function firstInvoiceOf(months: number[][], firstOrder: string | null | undefined, firstYear: number): number | null {
  const y = /^(\d{4})/.exec(firstOrder ?? "");
  if (y && Number(y[1]) >= HISTORY_FROM && Number(y[1]) < firstYear) return null;
  for (let k = 0; k <= 35; k++) if ((months[2 - Math.floor(k / 12)]?.[k % 12] ?? 0) > 0) return k;
  return null;
}
/**
 * The companies with a carried-over first order stay new only without revenue from 2015 to before the three years: the BSC
 * counted 25 of the 239 such companies first invoiced in 2026 - exactly those with none (SARCLA 31.10.2026: "we need to get
 * it right on new customer"). A company HubSpot does not return is left out, as before.
 */
async function withoutHistory(list: { id: string; c: CompanyIn }[], firstYear: number): Promise<void> {
  const props = Array.from({ length: firstYear - HISTORY_FROM }, (_, i) => `rev_${HISTORY_FROM + i}_pc_monthly`);
  for (let i = 0; i < list.length; i += 100) {
    const part = list.slice(i, i + 100);
    const r = await hubspotFetchJson<{ results?: Obj[] }>({ path: "/crm/v3/objects/companies/batch/read", method: "POST", body: { properties: props, inputs: part.map((e) => ({ id: e.id })) } });
    const clean = new Set((r.results ?? []).filter((o) => !props.some((k) => { const b = parsePcMonthly(o.properties[k]); return b.some((_, m) => monthTotal(b, m) > 0); })).map((o) => String(o.id)));
    for (const e of part) if (!clean.has(e.id)) e.c.firstInvoiceMonth = null;
  }
}
const num = (v: string | null | undefined) => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** The company properties that place a company in the cube. */
export const DIM_PROPS = ["sales_priority", "apso_customer", "customer_type", "apic_ap", "country_custom", "mandant", "hubspot_owner_id", "yearly_customer_potential", "sae_performis"];
/** Where a company sits on each dimension - shared with the online share's read (online.ts), so both place it alike. */
/** The Performis SAE as a person: the cube's read passes the Map assignment's mapping; without one, the value as written. */
export function labelsOf(p: Record<string, string | null | undefined>, owners: Map<string, string>, sae: Record<string, string> = {}): Record<Dim, string> {
  return {
    prio: prioOf(p.sales_priority),
    segment: p.apso_customer || "No APSO segment",
    potential: potentialBand(num(p.yearly_customer_potential)),
    country: p.country_custom || "Not set",
    owner: p.hubspot_owner_id ? owners.get(p.hubspot_owner_id) ?? `Owner ${p.hubspot_owner_id}` : "No owner",
    type: p.customer_type || "Not set",
    apic: p.apic_ap || "Not set",
    mandant: p.mandant || "Not set",
    sae: saeLabel(p.sae_performis, sae, owners).label,
  };
}

/** Everything a company is read with: its dimensions, the revenue (and by profit centre) and order intake months, the ERP's figures. */
const propsOf = (years: number[]) => [...DIM_PROPS, "order_first_order_date", ...years.map((y) => `rev_${y}_pc_monthly`), ...years.flatMap((y) => MONTHS.map((m) => `oi_${y}_${m}`)), ...ERP_PROPS, "erp_rev_as_of"];

/** What placing a company needs - the owners' names and teams, the SAE mapping - and what the read counts on the way. */
type Ctx = {
  years: number[]; owners: Map<string, string>; saeMap: Record<string, string>; teamFor: (id: string) => string;
  labels: Record<Dim, string[]>; teams: Record<string, string>; saeTeams: Record<string, string>;
  filled: number[][]; filledOi: number[][]; erpDays: Map<string, number>;
};
async function contextOf(years: number[]): Promise<Ctx> {
  const owners = await ownerNames();
  // a sales rep's team: the roster first, else the team HubSpot has them in (as Retain & grow's path does)
  const hsTeam = new Map<string, string>();
  try { for (const o of await readOwners()) if (o.team) hsTeam.set(String(o.id), o.team); } catch { /* the rosters alone */ }
  const teamFor = (id: string) => teamOf(id) ?? (/\bTSA\b/i.test(hsTeam.get(id) ?? "") ? "TSA" : /\bESO\b/i.test(hsTeam.get(id) ?? "") ? "ESO" : "Other");
  // the SAE -> person mapping Map assignment keeps (its saved rules, else its seed)
  let saeMap: Record<string, string> = SEED.sae;
  try { saeMap = (await getRules()).value.sae ?? SEED.sae; } catch { /* the seed */ }
  return {
    years, owners, saeMap, teamFor,
    labels: Object.fromEntries(DIMS.map((d) => [d, [] as string[]])) as Record<Dim, string[]>,
    teams: {}, saeTeams: {}, filled: years.map(() => Array(12).fill(0)), filledOi: years.map(() => Array(12).fill(0)), erpDays: new Map(),
  };
}
/** One company as the cube takes it. */
function companyOf(p: Record<string, string | null>, x: Ctx): CompanyIn {
  const index = (d: Dim, v: string) => {
    let i = x.labels[d].indexOf(v);
    if (i < 0) i = x.labels[d].push(v) - 1;
    return i;
  };
  // the revenue by profit centre too, this year and last (the ESO Figures' Profit center tab)
  const pcMonths: Record<string, number>[][] = [];
  const months = x.years.map((y, yi) => {
    const blob = parsePcMonthly(p[`rev_${y}_pc_monthly`]);
    if (yi < 2) pcMonths.push(blob);
    return blob.map((_, m) => {
      const v = monthTotal(blob, m);
      if (v) x.filled[yi][m]++;
      return v;
    });
  });
  const l = labelsOf(p, x.owners, x.saeMap);
  if (!x.saeTeams[l.sae]) { const s = saeLabel(p.sae_performis, x.saeMap, x.owners); x.saeTeams[l.sae] = s.owner ? x.teamFor(s.owner) : /^TSA\b/i.test(l.sae) ? "TSA" : /^ESO\b/i.test(l.sae) ? "ESO" : "Other"; }
  if (p.hubspot_owner_id && !x.teams[l.owner]) x.teams[l.owner] = x.teamFor(p.hubspot_owner_id);
  const intake = x.years.map((y, yi) => MONTHS.map((m, mi) => { const v = num(p[`oi_${y}_${m}`]) ?? 0; if (v) x.filledOi[yi][mi]++; return v; }));
  const erp = ERP_PROPS.map((k) => num(p[k]) ?? 0);
  const erpDay = String(p.erp_rev_as_of ?? "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(erpDay)) x.erpDays.set(erpDay, (x.erpDays.get(erpDay) ?? 0) + 1);
  return {
    dims: Object.fromEntries(DIMS.map((d) => [d, index(d, l[d])])) as Record<Dim, number>,
    potential: num(p.yearly_customer_potential), months,
    firstMonth: firstMonthOf(p.order_first_order_date, x.years[2]),
    firstInvoiceMonth: firstInvoiceOf(months, p.order_first_order_date, x.years[2]),
    intake, erp: erp.some((v) => v !== 0) ? erp : null, pcMonths,
  };
}

async function build(): Promise<Cube> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const years = [year, year - 1, year - 2];
  const monthsDone = now.getUTCMonth();
  reportProgress(KEY, "reading the owners");
  const x = await contextOf(years);
  // order intake per month as the nightly revenue load writes it (oi_2026_jan…) - 36 names, well inside the address's 2 KB
  const props = propsOf(years);
  const companies: CompanyIn[] = [];
  const carried: { id: string; c: CompanyIn }[] = [];

  let after: string | undefined;
  for (;;) {
    const qs = `limit=100&archived=false&properties=${props.join(",")}${after ? `&after=${after}` : ""}`;
    const r = await hubspotFetchJson<{ results?: Obj[]; paging?: { next?: { after?: string } } }>({ path: `/crm/v3/objects/companies?${qs}` });
    for (const o of r.results ?? []) {
      const c = companyOf(o.properties, x);
      companies.push(c);
      if (c.firstInvoiceMonth != null && carriedOver(o.properties.order_first_order_date)) carried.push({ id: String(o.id), c });
    }
    reportProgress(KEY, `reading companies: ${companies.length.toLocaleString("en")} so far`);
    after = r.paging?.next?.after;
    if (!after) break;
  }
  reportProgress(KEY, `reading the revenue since ${HISTORY_FROM} of ${carried.length.toLocaleString("en")} customers from before it`);
  await withoutHistory(carried, years[2]);

  const loaded = [monthsLoaded(x.filled[0], x.filled[1], monthsDone), 12, 12];
  // The month in progress reaches the day of the last ERP delivery the chain ran
  // (yesterday when no delivery is on record): year to date and month to date end there.
  const day = await lastDelivery();
  const reach = day ? new Date(`${day}T00:00:00Z`) : new Date(Date.now() - 86_400_000);
  const running = reach.getUTCFullYear() === year && reach.getUTCMonth() >= loaded[0]
    ? { month: monthOf(0, reach.getUTCMonth()), day: reach.getUTCDate(), days: new Date(Date.UTC(year, reach.getUTCMonth() + 1, 0)).getUTCDate() }
    : null;
  // the ERP day most companies carry (a straggler from an older file does not move it)
  const erpDay = [...x.erpDays].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] ?? null;
  return { generatedAt: new Date().toISOString(), years, loaded, running, dataDay: day ?? null, labels: x.labels, teams: x.teams, saeTeams: x.saeTeams, erpDay, oiLoaded: monthsLoaded(x.filledOi[0], x.filledOi[1], monthsDone), newKind: "invoice", newHistory: HISTORY_FROM, ...fold(companies) };
}

/**
 * The cube of the companies chosen (at most 50): the same read and fold as everyone's, with the whole read's years,
 * loaded months, running month and ERP day - so a chart compares them exactly as it compares everyone. Null until the
 * whole read exists.
 */
export async function companiesCube(ids: string[]): Promise<Cube | null> {
  const base = (await customersCube()).value;
  if (!base) return null;
  const x = await contextOf(base.years);
  const companies: CompanyIn[] = [];
  const props = propsOf(base.years);
  const carried: { id: string; c: CompanyIn }[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await hubspotFetchJson<{ results?: Obj[] }>({ path: "/crm/v3/objects/companies/batch/read", method: "POST", body: { properties: props, inputs: ids.slice(i, i + 50).map((id) => ({ id })) } });
    for (const o of r.results ?? []) {
      const c = companyOf(o.properties, x);
      companies.push(c);
      if (c.firstInvoiceMonth != null && carriedOver(o.properties.order_first_order_date)) carried.push({ id: String(o.id), c });
    }
  }
  await withoutHistory(carried, base.years[2]);
  // its own read time: the pages keep their sums per cube by it, and these companies were read just now
  return { ...base, generatedAt: new Date().toISOString(), labels: x.labels, teams: x.teams, saeTeams: x.saeTeams, ...fold(companies) };
}

export type CompanyHit = { id: string; name: string; country: string | null; erpId: string | null };
/** Companies by name, or by ERP customer number - for the customer filter's search box. */
export async function searchCompanies(q: string): Promise<CompanyHit[]> {
  const text = q.trim().replace(/[*"]/g, "");
  if (text.length < 2) return [];
  const groups = [{ filters: [{ propertyName: "name", operator: "CONTAINS_TOKEN", value: `*${text}*` }] }];
  if (/^\d{3,}$/.test(text)) groups.push({ filters: [{ propertyName: "erp_customer_id", operator: "EQ", value: text }] });
  const r = await hubspotFetchJson<{ results?: Obj[] }>({ path: "/crm/v3/objects/companies/search", method: "POST", body: {
    filterGroups: groups, properties: ["name", "country_custom", "erp_customer_id"], limit: 20, sorts: [{ propertyName: "name", direction: "ASCENDING" }],
  } });
  return (r.results ?? []).map((o) => ({ id: String(o.id), name: o.properties.name || `Company ${o.id}`, country: o.properties.country_custom ?? null, erpId: o.properties.erp_customer_id ?? null }));
}

/** The names of companies chosen (an address carries only their ids). */
export async function companyNames(ids: string[]): Promise<CompanyHit[]> {
  if (!ids.length) return [];
  const r = await hubspotFetchJson<{ results?: Obj[] }>({ path: "/crm/v3/objects/companies/batch/read", method: "POST", body: { properties: ["name", "country_custom", "erp_customer_id"], inputs: ids.slice(0, 50).map((id) => ({ id })) } });
  return (r.results ?? []).map((o) => ({ id: String(o.id), name: o.properties.name || `Company ${o.id}`, country: o.properties.country_custom ?? null, erpId: o.properties.erp_customer_id ?? null }));
}
