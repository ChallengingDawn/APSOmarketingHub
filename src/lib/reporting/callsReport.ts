// THE TSA CALLS PAGE'S READ (SARCLA 01.11.2026: "TSA don't do visits, they call, they do qualified calls ... build instead
// of visits a sub report for calls"): every call of this year - the qualified ones as rows with what the page slices them
// by (the company, else the company of the call's contact; its priority, category, country and orders), every call with its
// outcome for how many were qualified; of everyone (TSA, ESO and the rest - the page's ESO | TSA | Total and the line
// managers' teams). The rules in ./callsRules.ts and ./visitsRules.ts. Read every hour through slowReport: the first
// visitor starts it, everyone after gets it.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { ownerNames } from "@/lib/integrations/erosion";
import { TSA_OWNERS, teamOf } from "@/lib/datatracker/rosters";
import { readOwners } from "@/lib/ownerRules/hubspot";
import { associations, searchAll } from "@/lib/lifecycle/read";
import { monthTotal, parsePcMonthly, prioBand, prioOf, PRIO_BANDS } from "./esoRules";
import { ymd } from "./visitsRules";
import { DIRECTIONS, NO_COMPANY, OUTCOMES, QUALIFIED, directionOf, type CallsData } from "./callsRules";

const KEY = "tsaCalls:v1";
const TTL_MS = 60 * 60 * 1000;

export function tsaCalls(): Promise<SlowState<CallsData>> {
  return slowReport(KEY, TTL_MS, build);
}

type Row = { id: string; properties?: Record<string, string | null> };

async function build(): Promise<CallsData> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const today = now.toISOString().slice(0, 10);
  const todayN = ymd(today);

  // 1. every call of this year - qualified calls are in HubSpot since January 2026, so last year has none to compare with
  const read = await searchAll("calls", [[{ propertyName: "hs_timestamp", operator: "GTE", value: String(Date.UTC(year, 0, 1)) }]],
    ["hubspot_owner_id", "hs_timestamp", "hs_call_disposition", "hs_call_direction"], (n) => reportProgress(KEY, `reading this year's calls · ${n.toLocaleString("en")}`));
  const calls = read.filter((c) => { const day = ymd(c.properties?.hs_timestamp); return day >= year * 10000 + 101 && day <= todayN; });
  const qualifiedId = Object.keys(OUTCOMES).find((k) => OUTCOMES[k] === QUALIFIED)!;
  const qualified = calls.filter((c) => c.properties?.hs_call_disposition === qualifiedId);

  // 2. the company of each qualified call - else the company of its contact (as a visit's)
  reportProgress(KEY, `linking ${qualified.length.toLocaleString("en")} qualified calls to companies`);
  const callCompany = new Map<string, string>();
  for (const [id, cos] of await associations("calls", "companies", qualified.map((c) => c.id))) if (cos[0]) callCompany.set(id, cos[0]);
  let viaContact = 0;
  try {
    const bare = qualified.filter((c) => !callCompany.has(c.id)).map((c) => c.id);
    reportProgress(KEY, `the contacts of ${bare.length.toLocaleString("en")} calls without a company`);
    const callContact = new Map<string, string>();
    for (const [id, cts] of await associations("calls", "contacts", bare)) if (cts[0]) callContact.set(id, cts[0]);
    const contactCompany = new Map<string, string>();
    for (const [id, cos] of await associations("contacts", "companies", [...new Set(callContact.values())])) if (cos[0]) contactCompany.set(id, cos[0]);
    for (const [call, ct] of callContact) { const co = contactCompany.get(ct); if (co) { callCompany.set(call, co); viaContact++; } }
  } catch (e) { console.log(`[tsa-calls] the calls' contacts not read: ${(e as Error).message}`); }

  // 3. the people: their names, and their team - the rosters, else the team HubSpot has them in
  const names = await ownerNames().catch(() => new Map<string, string>());
  const hsTeam = new Map<string, string>();
  try { for (const o of await readOwners()) if (o.team) hsTeam.set(String(o.id), o.team); } catch { /* the rosters alone */ }
  const teamFor = (id: string) => teamOf(id) ?? (/\bTSA\b/i.test(hsTeam.get(id) ?? "") ? "TSA" : /\bESO\b/i.test(hsTeam.get(id) ?? "") ? "ESO" : "Other");
  const people: CallsData["people"] = [];
  const personIdx = new Map<string, number>();
  const person = (id: string) => {
    let i = personIdx.get(id);
    if (i === undefined) { i = people.push({ id, name: names.get(id) ?? (id ? `Owner ${id}` : "No owner"), team: id ? teamFor(id) : "Other" }) - 1; personIdx.set(id, i); }
    return i;
  };
  // who calls: this year's qualified calls' owners and the TSA roster - their companies by priority are read
  const callers = [...new Set([...qualified.map((c) => c.properties?.hubspot_owner_id ?? ""), ...Object.keys(TSA_OWNERS)].filter(Boolean))];
  for (const id of callers) person(id);

  // 4. those companies' facts
  type Co = { name: string; prio: string; category: string; country: string; shopSince: number; firstOrder: number; lastOrder: number; revenue: number; owner: string; bought: number };
  const companies = new Map<string, Co>();
  const ids = [...new Set(callCompany.values())];
  for (let i = 0; i < ids.length; i += 100) {
    const r = await hubspotFetchJson<{ results?: Row[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST",
      body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: ["name", "sales_priority", "apso_customer", "country_custom", "hubspot_owner_id", "magento_customer_since", "order_first_order_date", "order_last_order_date", `rev_${year - 1}_pc_monthly`, `rev_${year}_pc_monthly`] },
    });
    for (const row of r.results ?? []) {
      const p = row.properties ?? {};
      const py = parsePcMonthly(p[`rev_${year - 1}_pc_monthly`]), cy = parsePcMonthly(p[`rev_${year}_pc_monthly`]);
      let revenue = 0, bought = 0;
      for (let m = 0; m < 12; m++) {
        const a = monthTotal(py, m), b = monthTotal(cy, m);
        revenue += b;
        if (a > 0) bought |= 1 << m;
        if (b > 0) bought |= 1 << (12 + m);
      }
      companies.set(String(row.id), {
        name: p.name || `Company ${row.id}`,
        prio: prioBand(prioOf(p.sales_priority)), category: (p.apso_customer ?? "").trim() || "Not set", country: p.country_custom || "Not set",
        // the day the shop says it registered - not "Registration Details (ESO)", a qualification's answer
        shopSince: ymd(p.magento_customer_since), firstOrder: ymd(p.order_first_order_date), lastOrder: ymd(p.order_last_order_date),
        revenue: Math.round(revenue), owner: (p.hubspot_owner_id ?? "").trim(), bought,
      });
    }
    reportProgress(KEY, `reading the companies called · ${Math.min(i + 100, ids.length).toLocaleString("en")}`);
  }

  // 5. each caller's companies now, by priority - how much of each priority the qualified calls reach
  const portfolio: CallsData["portfolio"] = {};
  const prioOpts = await hubspotFetchJson<{ options?: { value: string }[] }>({ path: "/crm/v3/properties/companies/sales_priority" }).then((x) => x.options ?? []).catch(() => [] as { value: string }[]);
  const count = async (filters: Record<string, unknown>[]) =>
    (await hubspotFetchJson<{ total?: number }>({ path: "/crm/v3/objects/companies/search", method: "POST", body: { filterGroups: [{ filters }], limit: 1 } })).total ?? 0;
  try {
    for (const [n, id] of callers.entries()) {
      const row = PRIO_BANDS.map(() => 0);
      const own = { propertyName: "hubspot_owner_id", operator: "EQ", value: id };
      for (const o of prioOpts) { const b = PRIO_BANDS.indexOf(prioBand(prioOf(o.value)) as (typeof PRIO_BANDS)[number]); if (b >= 0) row[b] += await count([own, { propertyName: "sales_priority", operator: "EQ", value: o.value }]); }
      row[PRIO_BANDS.indexOf("No priority")] += await count([own, { propertyName: "sales_priority", operator: "NOT_HAS_PROPERTY" }]);
      if (row.some((x) => x > 0)) portfolio[String(person(id))] = row;
      reportProgress(KEY, `counting each person's companies by priority · ${n + 1} of ${callers.length}`);
    }
  } catch (e) { console.log(`[tsa-calls] companies by priority not read: ${(e as Error).message}`); }

  // 6. the rows: each qualified call as a visit row, the direction in the visit type's place; every call with its outcome
  const labels: CallsData["labels"] = { prio: [...PRIO_BANDS], category: ["APSOcore", "APSOgrowth", "APSOprospect", "APSOmicro", "APSOlost"], kind: [...DIRECTIONS], country: [] };
  const at = (list: string[], v: string) => { let i = list.indexOf(v); if (i < 0) i = list.push(v) - 1; return i; };
  const coIdx = new Map<string, number>();
  const coRows: number[][] = [];
  const coIds: string[] = [], coNames: string[] = [];
  const rows: number[][] = [];
  for (const call of qualified) {
    const p = call.properties ?? {};
    const when = p.hs_timestamp ?? "";
    const cid = callCompany.get(call.id);
    const co = cid ? companies.get(cid) : undefined;
    let ci = -1;
    if (cid && co) {
      ci = coIdx.get(cid) ?? -1;
      if (ci < 0) { ci = coRows.push([co.shopSince, co.firstOrder, co.revenue, co.owner ? person(co.owner) : -1, co.lastOrder, co.bought]) - 1; coIdx.set(cid, ci); coIds.push(cid); coNames.push(co.name); }
    }
    const day = ymd(when);
    rows.push([
      person(p.hubspot_owner_id ?? ""), 0, Number(when.slice(5, 7)) - 1, Number(when.slice(8, 10)),
      at(labels.kind, directionOf(p.hs_call_direction)), at(labels.prio, co?.prio ?? NO_COMPANY), at(labels.category, co?.category ?? NO_COMPANY), at(labels.country, co?.country ?? NO_COMPANY),
      ci, co ? (!co.firstOrder || co.firstOrder >= day ? 1 : 0) : 0,
    ]);
  }
  const outcomes: string[] = [QUALIFIED];
  const all = calls.map((c) => {
    const p = c.properties ?? {};
    const when = p.hs_timestamp ?? "";
    const o = p.hs_call_disposition ? OUTCOMES[p.hs_call_disposition] ?? "Other outcome" : "No outcome";
    return [person(p.hubspot_owner_id ?? ""), Number(when.slice(5, 7)) - 1, Number(when.slice(8, 10)), at(outcomes, o)];
  });
  return {
    generatedAt: new Date().toISOString(), year, today, people, labels, visits: rows, companies: coRows, companyIds: coIds, companyNames: coNames, open: {}, portfolio, lastYear: [],
    all, outcomes,
    coverage: { read: calls.length, completed: qualified.length, withCompany: qualified.filter((c) => callCompany.has(c.id)).length, viaContact, lastYearRead: false },
  };
}
