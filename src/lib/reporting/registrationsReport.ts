// THE ESO REGISTRATIONS PAGE'S READ - rebuilt like the Visits and the Figures: every shop account opened this year and
// the last (the contact's Magento "customer since") with its first order in the shop (Magento's "oldest order date"), the
// companies they belong to with their first shop account, first shop order and first completed visit, of everyone (ESO, TSA and the rest - the page's ESO | TSA | Total and the line
// managers' teams, by the company's owner). The rules in ./registrationsRules.ts. Read every hour through slowReport: the
// first visitor starts it, everyone after gets it.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { ownerNames } from "@/lib/integrations/erosion";
import { teamOf } from "@/lib/datatracker/rosters";
import { readOwners } from "@/lib/ownerRules/hubspot";
import { categoryBand, prioBand, prioOf, CATEGORY_BANDS, PRIO_BANDS } from "./esoRules";
import { typeShort, ymd, type RegData } from "./registrationsRules";

// v2: the shop's own first order (the ERP's counted orders outside the shop: "already customers" that cannot be), APIC
// instead of the potential
const KEY = "esoRegistrations:v2";
const TTL_MS = 60 * 60 * 1000;
const VISIT_OBJ = "2-139767037";
/** "Visit and Report complete": the only visits that count (SARCLA 12.10). */
const VISIT_DONE = "3972587738";

export function esoRegistrations(): Promise<SlowState<RegData>> {
  return slowReport(KEY, TTL_MS, build);
}

type Row = { id: string; properties?: Record<string, string | null> };

async function build(): Promise<RegData> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const today = now.toISOString().slice(0, 10);
  const todayN = ymd(today);

  // 1. every shop account opened since 1 January last year, by the shop's own date - page by page on the id, so no
  // search cap applies
  const contacts: Row[] = [];
  let lastId = "0";
  for (let page = 0; page < 500; page++) {
    const r = await hubspotFetchJson<{ results?: Row[] }>({
      path: "/crm/v3/objects/contacts/search", method: "POST",
      body: {
        limit: 200, properties: ["eyemagine_lifetime_customer_since", "eyemagine_lifetime_first_order_date", "associatedcompanyid"],
        filterGroups: [{ filters: [
          { propertyName: "eyemagine_lifetime_customer_since", operator: "GTE", value: String(Date.UTC(year - 1, 0, 1)) },
          { propertyName: "hs_object_id", operator: "GT", value: lastId },
        ] }],
        sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
      },
    });
    const rows = r.results ?? [];
    contacts.push(...rows);
    reportProgress(KEY, `reading shop registrations · ${contacts.length.toLocaleString("en")}`);
    if (rows.length < 200) break;
    lastId = rows[rows.length - 1].id;
  }
  const accounts = contacts.map((c) => ({ company: c.properties?.associatedcompanyid ?? "", day: ymd(c.properties?.eyemagine_lifetime_customer_since), order: ymd(c.properties?.eyemagine_lifetime_first_order_date) }))
    .filter((a) => a.day && a.day <= todayN);

  // 2. their companies: the owner, the first shop account (the company's "customer since", or its earliest contact's if
  // that is earlier - HubSpot copies a contact's onto the company, now and then a later one), the first order in the shop
  // (the earliest of its accounts')
  type Co = { owner: string; reg: number; firstOrder: number; firstVisit: number; country: string; prio: string; category: string; type: string; apic: string };
  const companies = new Map<string, Co>();
  const ids = [...new Set(accounts.map((a) => a.company).filter(Boolean))];
  for (let i = 0; i < ids.length; i += 100) {
    const r = await hubspotFetchJson<{ results?: Row[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST",
      body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: ["hubspot_owner_id", "magento_customer_since", "country_custom", "sales_priority", "apso_customer", "customer_type", "apic_ap"] },
    });
    for (const row of r.results ?? []) {
      const p = row.properties ?? {};
      companies.set(String(row.id), {
        owner: p.hubspot_owner_id ?? "", reg: ymd(p.magento_customer_since), firstOrder: 0, firstVisit: 0,
        country: p.country_custom || "Not set", prio: prioBand(prioOf(p.sales_priority)), category: categoryBand(p.apso_customer),
        type: p.customer_type ? typeShort(p.customer_type) : "Not set", apic: p.apic_ap || "Not set",
      });
    }
    reportProgress(KEY, `reading their companies · ${Math.min(i + 100, ids.length).toLocaleString("en")}`);
  }
  for (const a of accounts) {
    const co = companies.get(a.company);
    if (co && (!co.reg || a.day < co.reg)) co.reg = a.day;
    if (co && a.order && (!co.firstOrder || a.order < co.firstOrder)) co.firstOrder = a.order;
  }

  // 3. the first completed customer visit of each of those companies - visits are in HubSpot since 2026
  const visits: Row[] = [];
  let after: string | undefined;
  for (let page = 0; page < 500; page++) {
    const r = await hubspotFetchJson<{ results?: Row[]; paging?: { next?: { after?: string } } }>({
      path: `/crm/v3/objects/${VISIT_OBJ}?limit=100&properties=meeting_date_with_time,hs_pipeline_stage${after ? `&after=${after}` : ""}`, useTicketsToken: true,
    });
    visits.push(...(r.results ?? []));
    reportProgress(KEY, `reading customer visits · ${visits.length.toLocaleString("en")}`);
    after = r.paging?.next?.after;
    if (!after) break;
  }
  const done = visits.filter((v) => v.properties?.hs_pipeline_stage === VISIT_DONE && ymd(v.properties?.meeting_date_with_time) && ymd(v.properties?.meeting_date_with_time) <= todayN);
  const dayOf = new Map(done.map((v) => [v.id, ymd(v.properties?.meeting_date_with_time)]));
  for (let i = 0; i < done.length; i += 100) {
    const r = await hubspotFetchJson<{ results?: { from?: { id?: string }; to?: { toObjectId?: number | string }[] }[] }>({
      path: `/crm/v4/associations/${VISIT_OBJ}/companies/batch/read`, method: "POST", useTicketsToken: true,
      body: { inputs: done.slice(i, i + 100).map((v) => ({ id: v.id })) },
    });
    for (const row of r.results ?? []) {
      const day = dayOf.get(String(row.from?.id ?? ""));
      for (const to of row.to ?? []) {
        const co = companies.get(String(to.toObjectId));
        if (co && day && (!co.firstVisit || day < co.firstVisit)) co.firstVisit = day;
      }
    }
    reportProgress(KEY, `linking visits to companies · ${Math.min(i + 100, done.length).toLocaleString("en")}`);
  }

  // 4. the people: the companies' owners, their names, and their team - the rosters, else the team HubSpot has them in
  const names = await ownerNames().catch(() => new Map<string, string>());
  const hsTeam = new Map<string, string>();
  try { for (const o of await readOwners()) if (o.team) hsTeam.set(String(o.id), o.team); } catch { /* the rosters alone */ }
  const teamFor = (id: string) => teamOf(id) ?? (/\bTSA\b/i.test(hsTeam.get(id) ?? "") ? "TSA" : /\bESO\b/i.test(hsTeam.get(id) ?? "") ? "ESO" : "Other");
  const people: RegData["people"] = [];
  const personIdx = new Map<string, number>();
  const person = (id: string) => {
    let i = personIdx.get(id);
    if (i === undefined) { i = people.push({ id, name: id ? names.get(id) ?? `Owner ${id}` : "No owner", team: id ? teamFor(id) : "Other" }) - 1; personIdx.set(id, i); }
    return i;
  };

  // 5. the rows
  const labels: RegData["labels"] = { country: [], prio: [...PRIO_BANDS], category: [...CATEGORY_BANDS], type: [], apic: [] };
  const at = (list: string[], v: string) => { let i = list.indexOf(v); if (i < 0) i = list.push(v) - 1; return i; };
  const coIdx = new Map<string, number>();
  const coRows: number[][] = [];
  for (const [id, co] of companies) {
    if (!co.reg) continue;
    coIdx.set(id, coRows.push([person(co.owner), co.reg, co.firstOrder, co.firstVisit, at(labels.country, co.country), at(labels.prio, co.prio), at(labels.category, co.category), at(labels.type, co.type), at(labels.apic, co.apic)]) - 1);
  }
  person("");
  const accRows = accounts.map((a) => [coIdx.get(a.company) ?? -1, a.day]);
  return {
    generatedAt: new Date().toISOString(), year, today, people, labels, companies: coRows, accounts: accRows,
    coverage: { accounts: accRows.length, noCompany: accRows.filter((a) => a[0] < 0).length, companies: coRows.length, visits: done.length },
  };
}
