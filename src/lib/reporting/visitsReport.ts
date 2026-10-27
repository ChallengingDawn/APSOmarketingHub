// THE ESO VISITS PAGE'S READ (SARCLA 27.10.2026: "review completely the visits" - rebuilt like Figures): every completed
// customer visit of this year and the last, of everyone (ESO, TSA and the rest - the Figures' ESO | TSA | Total and the
// line managers' teams), each as one small row with what the page slices it by; the rules in ./visitsRules.ts. Read
// every hour (the benchmark's was every 12), through slowReport: the first visitor starts it, everyone after gets it.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { ownerNames } from "@/lib/integrations/erosion";
import { teamOf } from "@/lib/datatracker/rosters";
import { readOwners } from "@/lib/ownerRules/hubspot";
import { categoryBand, monthTotal, parsePcMonthly, prioBand, prioOf, visitKind, CATEGORY_BANDS, PRIO_BANDS, VISIT_KINDS } from "./esoRules";
import { bandOf, usable, ymd, POTENTIAL_BANDS, type VisitsData } from "./visitsRules";

// v2: the visit report's annual need, the potential band (placeholders over €1m left out), how each company registered
const KEY = "esoVisits:v2";
const TTL_MS = 60 * 60 * 1000;
const VISIT_OBJ = "2-139767037";
const VISIT_PIPELINE = "2904105208";
/** "Visit and Report complete": the only visits that count (SARCLA 12.10). */
const VISIT_DONE = "3972587738";

export function esoVisits(): Promise<SlowState<VisitsData>> {
  return slowReport(KEY, TTL_MS, build);
}

type Row = { id: string; properties?: Record<string, string | null> };
const num = (v: string | null | undefined) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

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

  // 2. the company each completed visit is of
  const visitCompany = new Map<string, string>();
  for (let i = 0; i < completed.length; i += 100) {
    const r = await hubspotFetchJson<{ results?: { from?: { id?: string }; to?: { toObjectId?: number | string }[] }[] }>({
      path: `/crm/v4/associations/${VISIT_OBJ}/companies/batch/read`, method: "POST", useTicketsToken: true,
      body: { inputs: completed.slice(i, i + 100).map((v) => ({ id: v.id })) },
    });
    for (const row of r.results ?? []) { const to = row.to?.[0]?.toObjectId; if (row.from?.id && to != null) visitCompany.set(String(row.from.id), String(to)); }
    reportProgress(KEY, `linking visits to companies · ${Math.min(i + 100, completed.length).toLocaleString("en")}`);
  }

  // 3. those companies' facts
  type Co = { prio: string; category: string; country: string; potential: number; registeredAfter: boolean; regWay: string; firstOrder: number; revenue: number };
  const companies = new Map<string, Co>();
  const ids = [...new Set(visitCompany.values())];
  for (let i = 0; i < ids.length; i += 100) {
    const r = await hubspotFetchJson<{ results?: Row[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST",
      body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: ["sales_priority", "apso_customer", "country_custom", "yearly_customer_potential", "registration_details_eso__company", "order_first_order_date", `rev_${year}_pc_monthly`] },
    });
    for (const row of r.results ?? []) {
      const p = row.properties ?? {};
      const blob = parsePcMonthly(p[`rev_${year}_pc_monthly`]);
      let revenue = 0;
      for (let m = 0; m < 12; m++) revenue += monthTotal(blob, m);
      companies.set(String(row.id), {
        prio: prioBand(prioOf(p.sales_priority)), category: categoryBand(p.apso_customer), country: p.country_custom || "Not set",
        // a potential over €1m is a placeholder, not a figure (as the customers' cube reads it)
        potential: usable(num(p.yearly_customer_potential)) ? num(p.yearly_customer_potential) : 0,
        registeredAfter: p.registration_details_eso__company === "Meeting before registration", regWay: (p.registration_details_eso__company ?? "").trim(),
        firstOrder: ymd(p.order_first_order_date), revenue: Math.round(revenue),
      });
    }
    reportProgress(KEY, `reading visited companies · ${Math.min(i + 100, ids.length).toLocaleString("en")}`);
  }

  // 4. the people: their names, and their team - the rosters, else the team HubSpot has them in
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

  // 5. the rows
  const labels: VisitsData["labels"] = { prio: [...PRIO_BANDS], category: [...CATEGORY_BANDS], kind: [...VISIT_KINDS], country: [], band: [...POTENTIAL_BANDS], regWay: [""] };
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
      if (ci < 0) { ci = coRows.push([co.registeredAfter ? 1 : 0, co.firstOrder, co.revenue, at(labels.regWay, co.regWay)]) - 1; coIdx.set(cid, ci); }
    }
    const day = ymd(when);
    rows.push([
      person(owner), y, Number(when.slice(5, 7)) - 1, Number(when.slice(8, 10)),
      at(labels.kind, visitKind(p.type_of_visit)), at(labels.prio, co?.prio ?? "No priority"), at(labels.category, co?.category ?? "Other"), at(labels.country, co?.country ?? "Not set"),
      ci, co ? (!co.firstOrder || co.firstOrder > day ? 1 : 0) : 0, co && co.potential > 0 ? Math.round(co.potential) : 0,
      usable(num(p.annual_need_in__)) ? Math.round(num(p.annual_need_in__)) : 0, at(labels.band, bandOf(co?.potential ?? 0)),
    ]);
  }
  return {
    generatedAt: new Date().toISOString(), year, today, people, labels, visits: rows, companies: coRows, open,
    coverage: { read: inScope.length, completed: completed.length, withCompany: completed.filter((v) => visitCompany.has(v.id)).length },
  };
}
