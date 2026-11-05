// THE SALES ACTIVITY PAGE'S READ (SARCLA 05.11.2026: "build this report as a sub report on ESO and TSA master dashboard"):
// every company in HubSpot - the base of Diana's dashboard is all of them - as one small row: its owner (the dashboard
// splits by the company owner), priority, customer category, country, Diana's eight flags "Sales Activity in <year>
// (...)" for last year and this one, whether it ever bought, its revenue of both years (revenue_<year>, the dashboard's
// "(Sum) REVENUE") and its yearly potential. The rules in ./salesActivityRules.ts. Read every 6 hours through slowReport:
// the first visitor starts it, everyone after gets it.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { IntegrationError } from "@/lib/integrations/status";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { ownerNames } from "@/lib/integrations/erosion";
import { teamOf } from "@/lib/datatracker/rosters";
import { readOwners } from "@/lib/ownerRules/hubspot";
import { searchAll } from "@/lib/lifecycle/read";
import { PRIOS } from "./customerDevRules";
import { DEFS, flagName, potentialOf, prioLabel, reachedBits, type SalesActData } from "./salesActivityRules";

const KEY = "salesActivity:v1";
const TTL_MS = 6 * 60 * 60 * 1000;

export function salesActivity(): Promise<SlowState<SalesActData>> {
  return slowReport(KEY, TTL_MS, readSalesActivity);
}

/** Whether a company property is in HubSpot - a flag for a year Diana has not set up yet is not. */
async function hasProperty(name: string): Promise<boolean> {
  try {
    await hubspotFetchJson({ path: `/crm/v3/properties/companies/${name}` });
    return true;
  } catch (e) {
    if (e instanceof IntegrationError && e.status === 404) return false;
    throw e;
  }
}

const num = (v: string | null | undefined) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** The read - exported for a local check against HubSpot (scratchpad); the page reads it through salesActivity. */
export async function readSalesActivity(): Promise<SalesActData> {
  const now = new Date();
  const year = now.getUTCFullYear(), py = year - 1;

  // 1. Diana's flags: which are in HubSpot, for last year and this one
  reportProgress(KEY, "looking up the Sales Activity flags");
  const read = { py: [] as boolean[], cy: [] as boolean[] };
  for (let i = 0; i < DEFS.length; i++) {
    read.py.push(await hasProperty(flagName(py, i)));
    read.cy.push(await hasProperty(flagName(year, i)));
  }
  const flags = DEFS.flatMap((_, i) => [...(read.py[i] ? [flagName(py, i)] : []), ...(read.cy[i] ? [flagName(year, i)] : [])]);

  // 2. the owners: their names, and their team - the rosters, else the team HubSpot has them in
  reportProgress(KEY, "reading the owners");
  const names = await ownerNames().catch(() => new Map<string, string>());
  const hsTeam = new Map<string, string>();
  try { for (const o of await readOwners()) if (o.team) hsTeam.set(String(o.id), o.team); } catch { /* the rosters alone */ }
  const teamFor = (id: string) => teamOf(id) ?? (/\bTSA\b/i.test(hsTeam.get(id) ?? "") ? "TSA" : /\bESO\b/i.test(hsTeam.get(id) ?? "") ? "ESO" : "Other");

  // 3. every company
  const props = ["name", "hubspot_owner_id", "sales_priority", "apso_customer", "country_custom", "yearly_customer_potential", "order_first_order_date",
    `revenue_${py}`, `revenue_${year}`, ...flags];
  const rows = await searchAll("companies", [[]], props, (n) => reportProgress(KEY, `reading every company · ${n.toLocaleString("en")}`));

  const people: SalesActData["people"] = [];
  const personIdx = new Map<string, number>();
  const labels: SalesActData["labels"] = { prio: [...PRIOS], category: [], country: [] };
  const at = (list: string[], v: string) => { let i = list.indexOf(v); if (i < 0) i = list.push(v) - 1; return i; };
  const companies: number[][] = [], ids: string[] = [], cos: string[] = [];
  const seen = new Set<string>();
  let noOwner = 0, prioWorkedOut = 0;
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const p = r.properties ?? {};
    const owner = (p.hubspot_owner_id ?? "").trim();
    let pi = -1;
    if (owner) {
      const known = personIdx.get(owner);
      pi = known ?? people.push({ name: names.get(owner) ?? `Owner ${owner}`, team: teamFor(owner) }) - 1;
      if (known === undefined) personIdx.set(owner, pi);
    } else noOwner++;
    const revPy = Math.round(num(p[`revenue_${py}`])), revCy = Math.round(num(p[`revenue_${year}`]));
    const pot = potentialOf(p.yearly_customer_potential);
    const pr = prioLabel(p.sales_priority, pot, Math.max(revPy, revCy));
    if (pr.worked) prioWorkedOut++;
    companies.push([
      pi, at(labels.prio, pr.prio), at(labels.category, (p.apso_customer ?? "").trim() || "Not set"), at(labels.country, (p.country_custom ?? "").trim() || "Not set"),
      reachedBits(p, py), reachedBits(p, year), p.order_first_order_date || revPy > 0 || revCy > 0 ? 1 : 0, revPy, revCy, pot,
    ]);
    ids.push(r.id);
    cos.push(p.name ?? "");
  }
  return {
    generatedAt: new Date().toISOString(), year, today: now.toISOString().slice(0, 10), read, people, labels, companies, names: cos, ids,
    coverage: { companies: companies.length, noOwner, prioWorkedOut },
  };
}
