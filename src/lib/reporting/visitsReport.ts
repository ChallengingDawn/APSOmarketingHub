// THE ESO VISITS PAGE'S READ (SARCLA 27.10.2026: "review completely the visits" - rebuilt like Figures): every completed
// customer visit of this year and the last, of everyone (ESO, TSA and the rest - the Figures' ESO | TSA | Total and the
// line managers' teams), each as one small row with what the page slices it by; the rules in ./visitsRules.ts. Read
// every hour (the benchmark's was every 12), through slowReport: the first visitor starts it, everyone after gets it.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { ownerNames } from "@/lib/integrations/erosion";
import { ESO_OWNERS, teamOf } from "@/lib/datatracker/rosters";
import { readOwners } from "@/lib/ownerRules/hubspot";
import { monthTotal, parsePcMonthly, prioBand, prioOf, visitKind, PRIO_BANDS, VISIT_KINDS } from "./esoRules";
import { NO_COMPANY, ymd, type VisitsData } from "./visitsRules";

// v2: the visit report's annual need, the potential band (placeholders over €1m left out), how each company registered
// v3: the shop registration's day instead of the qualification's answer; an order on the visit's day counts as after it
// v4 (29.10): the company through the visit's contact when the visit has none; the real customer categories; each company's
// owner, last order and months bought in; each person's companies by priority; last year's customer meetings; no potential
const KEY = "esoVisits:v4";
const TTL_MS = 60 * 60 * 1000;
const VISIT_OBJ = "2-139767037";
const VISIT_PIPELINE = "2904105208";
/** "Visit and Report complete": the only visits that count (SARCLA 12.10). */
const VISIT_DONE = "3972587738";
/** Marc Frech, the one TSA person who visits */
const MARC = "817497321";

export function esoVisits(): Promise<SlowState<VisitsData>> {
  return slowReport(KEY, TTL_MS, build);
}

type Row = { id: string; properties?: Record<string, string | null> };
type Assoc = { results?: { from?: { id?: string }; to?: { toObjectId?: number | string; associationTypes?: { typeId?: number; label?: string | null }[] }[] }[] };
const num = (v: string | null | undefined) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** from -> its first associated record of a type (the primary one when marked), 100 at a time */
async function linked(from: string, to: string, ids: string[], tickets: boolean, step: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    const r = await hubspotFetchJson<Assoc>({ path: `/crm/v4/associations/${from}/${to}/batch/read`, method: "POST", useTicketsToken: tickets, body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })) } });
    for (const row of r.results ?? []) {
      const all = row.to ?? [];
      const hit = all.find((t) => (t.associationTypes ?? []).some((a) => a.label === "Primary" || a.typeId === 1)) ?? all[0];
      if (row.from?.id && hit?.toObjectId != null) out.set(String(row.from.id), String(hit.toObjectId));
    }
    reportProgress(KEY, `${step} · ${Math.min(i + 100, ids.length).toLocaleString("en")}`);
  }
  return out;
}

async function build(): Promise<VisitsData> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const today = now.toISOString().slice(0, 10);

  // 1. every visit, the list API page by page (no search cap)
  const visits: Row[] = [];
  let after: string | undefined;
  const vProps = ["hubspot_owner_id", "meeting_date_with_time", "type_of_visit", "hs_pipeline_stage", "annual_need_in__"];
  for (let page = 0; page < 500; page++) {
    const r = await hubspotFetchJson<{ results?: Row[]; paging?: { next?: { after?: string } } }>({
      path: `/crm/v3/objects/${VISIT_OBJ}?limit=100&properties=${vProps.join(",")}${after ? `&after=${after}` : ""}`, useTicketsToken: true,
    });
    visits.push(...(r.results ?? []));
    reportProgress(KEY, `reading customer visits · ${visits.length.toLocaleString("en")}`);
    after = r.paging?.next?.after;
    if (!after) break;
  }
  const stages = await hubspotFetchJson<{ stages?: { id: string; label: string }[] }>({ path: `/crm/v3/pipelines/${VISIT_OBJ}/${VISIT_PIPELINE}`, useTicketsToken: true })
    .catch(() => ({ stages: [] as { id: string; label: string }[] }));
  const stageLabel = new Map((stages.stages ?? []).map((s) => [s.id, s.label.trim()]));
  const yearOf = (v: Row) => Number((v.properties?.meeting_date_with_time ?? "").slice(0, 4));
  const inScope = visits.filter((v) => { const y = yearOf(v); return (y === year || y === year - 1) && (v.properties?.meeting_date_with_time ?? "").slice(0, 10) <= today; });
  const completed = inScope.filter((v) => v.properties?.hs_pipeline_stage === VISIT_DONE);

  // 2. the company each completed visit is of - else its contact's company (SARCLA 29.10: "a visit should always have a company")
  const visitCompany = await linked(VISIT_OBJ, "companies", completed.map((v) => v.id), true, "linking visits to companies");
  const bare = completed.filter((v) => !visitCompany.has(v.id)).map((v) => v.id);
  const visitContact = await linked(VISIT_OBJ, "contacts", bare, true, "the contacts of the visits without a company")
    .catch(() => linked(VISIT_OBJ, "contacts", bare, false, "the contacts of the visits without a company"))
    .catch((e) => { console.log(`[eso-visits] the visits' contacts not read: ${(e as Error).message}`); return new Map<string, string>(); });
  const contactCompany = await linked("contacts", "companies", [...new Set(visitContact.values())], false, "their contacts' companies")
    .catch((e) => { console.log(`[eso-visits] the contacts' companies not read: ${(e as Error).message}`); return new Map<string, string>(); });
  let viaContact = 0;
  for (const [v, ct] of visitContact) { const co = contactCompany.get(ct); if (co) { visitCompany.set(v, co); viaContact++; } }

  // 3. the people: their names, and their team - the rosters, else the team HubSpot has them in
  const names = await ownerNames().catch(() => new Map<string, string>());
  const hsTeam = new Map<string, string>();
  try { for (const o of await readOwners()) if (o.team) hsTeam.set(String(o.id), o.team); } catch { /* the rosters alone */ }
  const teamFor = (id: string) => teamOf(id) ?? (/\bTSA\b/i.test(hsTeam.get(id) ?? "") ? "TSA" : /\bESO\b/i.test(hsTeam.get(id) ?? "") ? "ESO" : "Other");
  const people: VisitsData["people"] = [];
  const personIdx = new Map<string, number>();
  const person = (id: string) => {
    let i = personIdx.get(id);
    if (i === undefined) { i = people.push({ id, name: names.get(id) ?? (id ? `Owner ${id}` : "No owner"), team: id ? teamFor(id) : "Other" }) - 1; personIdx.set(id, i); }
    return i;
  };
  // who visits: this year's visit owners, the ESO roster and Marc Frech - their companies and last year's meetings are read
  const visitors = [...new Set([...completed.filter((v) => yearOf(v) === year).map((v) => v.properties?.hubspot_owner_id ?? ""), ...Object.keys(ESO_OWNERS), MARC].filter(Boolean))];
  for (const id of visitors) person(id);

  // 4. those companies' facts
  type Co = { prio: string; category: string; country: string; shopSince: number; firstOrder: number; lastOrder: number; revenue: number; owner: string; bought: number };
  const companies = new Map<string, Co>();
  const ids = [...new Set(visitCompany.values())];
  for (let i = 0; i < ids.length; i += 100) {
    const r = await hubspotFetchJson<{ results?: Row[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST",
      body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: ["sales_priority", "apso_customer", "country_custom", "hubspot_owner_id", "magento_customer_since", "order_first_order_date", "order_last_order_date", `rev_${year - 1}_pc_monthly`, `rev_${year}_pc_monthly`] },
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
        prio: prioBand(prioOf(p.sales_priority)), category: (p.apso_customer ?? "").trim() || "Not set", country: p.country_custom || "Not set",
        // the day the shop says it registered - not "Registration Details (ESO)", a qualification's answer
        shopSince: ymd(p.magento_customer_since), firstOrder: ymd(p.order_first_order_date), lastOrder: ymd(p.order_last_order_date),
        revenue: Math.round(revenue), owner: (p.hubspot_owner_id ?? "").trim(), bought,
      });
    }
    reportProgress(KEY, `reading visited companies · ${Math.min(i + 100, ids.length).toLocaleString("en")}`);
  }

  // 5. each visitor's companies now, by priority - how much of each priority the visits reach
  const portfolio: VisitsData["portfolio"] = {};
  const prioOpts = await hubspotFetchJson<{ options?: { value: string }[] }>({ path: "/crm/v3/properties/companies/sales_priority" }).then((x) => x.options ?? []).catch(() => [] as { value: string }[]);
  const count = async (filters: Record<string, unknown>[]) =>
    (await hubspotFetchJson<{ total?: number }>({ path: "/crm/v3/objects/companies/search", method: "POST", body: { filterGroups: [{ filters }], limit: 1 } })).total ?? 0;
  try {
    for (const [n, id] of visitors.entries()) {
      const row = PRIO_BANDS.map(() => 0);
      const own = { propertyName: "hubspot_owner_id", operator: "EQ", value: id };
      for (const o of prioOpts) { const b = PRIO_BANDS.indexOf(prioBand(prioOf(o.value)) as (typeof PRIO_BANDS)[number]); if (b >= 0) row[b] += await count([own, { propertyName: "sales_priority", operator: "EQ", value: o.value }]); }
      row[PRIO_BANDS.indexOf("No priority")] += await count([own, { propertyName: "sales_priority", operator: "NOT_HAS_PROPERTY" }]);
      if (row.some((x) => x > 0)) portfolio[String(person(id))] = row;
      reportProgress(KEY, `counting each person's companies by priority · ${n + 1} of ${visitors.length}`);
    }
  } catch (e) { console.log(`[eso-visits] companies by priority not read: ${(e as Error).message}`); }

  // 6. last year's customer meetings of the same people: a meeting with a company (each became a visit from December 2025)
  const lastYear: number[][] = [];
  let lastYearRead = false;
  try {
    const met: { id: string; owner: string; when: string }[] = [];
    for (let m = 0; m < 12; m++) {
      const from = new Date(Date.UTC(year - 1, m, 1)).toISOString(), to = new Date(Date.UTC(year - 1, m + 1, 1) - 1).toISOString();
      let cur: string | undefined;
      for (let page = 0; page < 60; page++) {
        const r = await hubspotFetchJson<{ results?: Row[]; paging?: { next?: { after?: string } } }>({
          path: "/crm/v3/objects/meetings/search", method: "POST",
          body: { filterGroups: [{ filters: [{ propertyName: "hs_meeting_start_time", operator: "BETWEEN", value: from, highValue: to }, { propertyName: "hubspot_owner_id", operator: "IN", values: visitors }] }], properties: ["hubspot_owner_id", "hs_meeting_start_time"], limit: 200, ...(cur ? { after: cur } : {}) },
        });
        for (const x of r.results ?? []) met.push({ id: x.id, owner: x.properties?.hubspot_owner_id ?? "", when: x.properties?.hs_meeting_start_time ?? "" });
        cur = r.paging?.next?.after;
        if (!cur) break;
      }
      reportProgress(KEY, `reading ${year - 1}'s customer meetings · ${met.length.toLocaleString("en")}`);
    }
    const withCo = await linked("meetings", "companies", met.map((x) => x.id), false, `${year - 1}'s meetings with a company`);
    for (const x of met) if (withCo.has(x.id) && personIdx.has(x.owner)) lastYear.push([personIdx.get(x.owner)!, Number(x.when.slice(5, 7)) - 1, Number(x.when.slice(8, 10))]);
    lastYearRead = true;
  } catch (e) { console.log(`[eso-visits] last year's meetings not read: ${(e as Error).message}`); }

  // 7. the rows
  const labels: VisitsData["labels"] = { prio: [...PRIO_BANDS], category: ["APSOcore", "APSOgrowth", "APSOprospect", "APSOmicro", "APSOlost"], kind: [...VISIT_KINDS], country: [] };
  const at = (list: string[], v: string) => { let i = list.indexOf(v); if (i < 0) i = list.push(v) - 1; return i; };
  const coIdx = new Map<string, number>();
  const coRows: number[][] = [];
  const rows: number[][] = [];
  const open: VisitsData["open"] = {};
  for (const v of inScope) {
    const p = v.properties ?? {};
    const when = p.meeting_date_with_time ?? "";
    const owner = p.hubspot_owner_id ?? "";
    const y = Number(when.slice(0, 4)) === year ? 0 : 1;
    if (p.hs_pipeline_stage !== VISIT_DONE) {
      if (y === 0) { const o = (open[person(owner)] ??= {}); const st = stageLabel.get(p.hs_pipeline_stage ?? "") ?? "No stage"; o[st] = (o[st] ?? 0) + 1; }
      continue;
    }
    const cid = visitCompany.get(v.id);
    const co = cid ? companies.get(cid) : undefined;
    let ci = -1;
    if (cid && co) {
      ci = coIdx.get(cid) ?? -1;
      if (ci < 0) { ci = coRows.push([co.shopSince, co.firstOrder, co.revenue, co.owner ? person(co.owner) : -1, co.lastOrder, co.bought]) - 1; coIdx.set(cid, ci); }
    }
    const day = ymd(when);
    rows.push([
      person(owner), y, Number(when.slice(5, 7)) - 1, Number(when.slice(8, 10)),
      at(labels.kind, visitKind(p.type_of_visit)), at(labels.prio, co?.prio ?? NO_COMPANY), at(labels.category, co?.category ?? NO_COMPANY), at(labels.country, co?.country ?? NO_COMPANY),
      ci, co ? (!co.firstOrder || co.firstOrder >= day ? 1 : 0) : 0, Math.max(0, Math.round(num(p.annual_need_in__))),
    ]);
  }
  return {
    generatedAt: new Date().toISOString(), year, today, people, labels, visits: rows, companies: coRows, open, portfolio, lastYear,
    coverage: { read: inScope.length, completed: completed.length, withCompany: completed.filter((v) => visitCompany.has(v.id)).length, viaContact, lastYearRead },
  };
}
