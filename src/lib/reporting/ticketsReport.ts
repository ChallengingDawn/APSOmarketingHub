// THE ESO TICKETS PAGE'S READ (SARCLA 29.10.2026: "work on ESO Reports > Tickets" - rebuilt like Visits, tickets ->
// orders per person): every ticket of the ESO pipeline from January last year, of everyone who owns one, each as one
// small row with what the page slices it by; the rules in ./ticketsRules.ts. Read every hour through slowReport: the
// first visitor starts it, everyone after gets it.

import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { ownerNames } from "@/lib/integrations/erosion";
import { teamOf } from "@/lib/datatracker/rosters";
import { readOwners } from "@/lib/ownerRules/hubspot";
import { UCS } from "@/lib/lifecycle/config";
import { batchRead, searchAll, ticketStages } from "@/lib/lifecycle/read";
import { categoryBand, prioBand, prioOf } from "./esoRules";
import { bandOf, kindOf, startLabels, stateOf, usable, type TicketsData } from "./ticketsRules";

const KEY = "esoTickets:v1";
const TTL_MS = 60 * 60 * 1000;
const ESO_PIPELINE = "1726599376";
const PROPS = [
  "subject", "createdate", "hs_pipeline_stage", "hubspot_owner_id", "source_type", "hs_object_source", "hs_object_source_detail_1",
  "hs_outbound_ticket", "hs_tag_ids", "ticket_resolution_eso", "sales_potential_estimate", "hs_primary_company_id",
];

export function esoTickets(): Promise<SlowState<TicketsData>> {
  return slowReport(KEY, TTL_MS, buildTickets);
}

const num = (v: string | null | undefined) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** The read itself (exported for a local check; the page goes through esoTickets). */
export async function buildTickets(): Promise<TicketsData> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const today = now.toISOString().slice(0, 10);

  // 1. every ticket of the ESO pipeline since January last year
  reportProgress(KEY, "reading the ticket stages");
  const stages = await ticketStages();
  const found = await searchAll("tickets",
    [[{ propertyName: "hs_pipeline", operator: "EQ", value: ESO_PIPELINE }, { propertyName: "createdate", operator: "GTE", value: String(Date.UTC(year - 1, 0, 1)) }]],
    PROPS, (n) => reportProgress(KEY, `reading the ESO tickets · ${n.toLocaleString("en")}`));

  // 2. what each is - as the Hand-over page sorts them, the pushes kept
  const lifecycle: Record<string, string> = {};
  for (const u of UCS) for (const t of u.tickets) lifecycle[t.name] = u.key;
  const left: Record<string, number> = {};
  type Kept = { p: Record<string, string | null>; kind: string; channel: string };
  const kept: Kept[] = [];
  for (const t of found) {
    const p = t.properties ?? {};
    const when = p.createdate ?? "";
    const y = Number(when.slice(0, 4));
    if (y !== year && y !== year - 1) continue;
    const what = kindOf({ subject: p.subject, sourceType: p.source_type, objectSource: p.hs_object_source, workflow: p.hs_object_source_detail_1, outbound: p.hs_outbound_ticket, tags: p.hs_tag_ids, resolution: p.ticket_resolution_eso }, lifecycle);
    if ("skip" in what) { left[what.skip] = (left[what.skip] ?? 0) + 1; continue; }
    kept.push({ p, kind: what.kind, channel: what.channel });
  }

  // 3. their companies' facts
  type Co = { prio: string; category: string; country: string; band: string };
  const companies = new Map<string, Co>();
  const ids = [...new Set(kept.map((k) => k.p.hs_primary_company_id).filter((x): x is string => !!x))];
  const recs = await batchRead("companies", ids, ["sales_priority", "apso_customer", "country_custom", "yearly_customer_potential"], [],
    (n) => reportProgress(KEY, `reading the tickets' companies · ${n.toLocaleString("en")} of ${ids.length.toLocaleString("en")}`));
  for (const c of recs) {
    const p = c.properties ?? {};
    const pot = num(p.yearly_customer_potential);
    companies.set(String(c.id), { prio: prioBand(prioOf(p.sales_priority)), category: categoryBand(p.apso_customer), country: p.country_custom || "Not set", band: bandOf(usable(pot) ? pot : 0) });
  }

  // 4. the people: their names, and their team - the rosters, else the team HubSpot has them in (as Visits)
  const names = await ownerNames().catch(() => new Map<string, string>());
  const hsTeam = new Map<string, string>();
  try { for (const o of await readOwners()) if (o.team) hsTeam.set(String(o.id), o.team); } catch { /* the rosters alone */ }
  const teamFor = (id: string) => teamOf(id) ?? (/\bTSA\b/i.test(hsTeam.get(id) ?? "") ? "TSA" : /\bESO\b/i.test(hsTeam.get(id) ?? "") ? "ESO" : "Other");
  const people: TicketsData["people"] = [];
  const personIdx = new Map<string, number>();
  const person = (id: string) => {
    let i = personIdx.get(id);
    if (i === undefined) { i = people.push({ id, name: names.get(id) ?? (id ? `Owner ${id}` : "No owner"), team: id ? teamFor(id) : "Other" }) - 1; personIdx.set(id, i); }
    return i;
  };

  // 5. the rows
  const labels = startLabels();
  const at = (list: string[], v: string) => { let i = list.indexOf(v); if (i < 0) i = list.push(v) - 1; return i; };
  const rows: number[][] = [];
  for (const { p, kind, channel } of kept) {
    const when = p.createdate ?? "";
    const co = companies.get(p.hs_primary_company_id ?? "");
    const value = num(p.sales_potential_estimate);
    rows.push([
      person(p.hubspot_owner_id ?? ""), Number(when.slice(0, 4)) === year ? 0 : 1, Number(when.slice(5, 7)) - 1, Number(when.slice(8, 10)),
      at(labels.kind, kind), at(labels.channel, channel),
      at(labels.prio, co?.prio ?? "No priority"), at(labels.category, co?.category ?? "Other"), at(labels.country, co?.country ?? "Not set"), at(labels.band, co?.band ?? "Not set"),
      stateOf(!!stages.get(p.hs_pipeline_stage ?? "")?.closed, p.ticket_resolution_eso), value > 0 ? Math.round(value) : 0,
    ]);
  }
  return {
    generatedAt: new Date().toISOString(), year, today, people, labels, tickets: rows,
    coverage: { read: found.length, kept: kept.length, withCompany: kept.filter((k) => companies.has(k.p.hs_primary_company_id ?? "")).length, left },
  };
}
