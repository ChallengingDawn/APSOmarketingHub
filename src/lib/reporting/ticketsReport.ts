// THE ESO TICKETS PAGES' READ (SARCLA 29.10.2026, rebuilt like Visits; 30.10.2026: Incoming tickets and System tickets,
// how they are handled): every ticket of the ESO pipeline from January last year, of everyone who owns one, each as one
// small row with what the pages slice it by - and what the team did on it (the reply in the ticket, the e-mails sent, the
// calls, meetings, notes and tasks logged on it). The rules in ./ticketsRules.ts. Read every hour through slowReport:
// the first visitor starts it, everyone after gets it.

import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { ownerNames } from "@/lib/integrations/erosion";
import { teamOf } from "@/lib/datatracker/rosters";
import { readOwners } from "@/lib/ownerRules/hubspot";
import { UCS } from "@/lib/lifecycle/config";
import { associations, batchRead, read, searchAll, ticketStages } from "@/lib/lifecycle/read";
import { workingHours } from "@/lib/marketingKpis/handoverCube";
import { prioBand, prioOf } from "./esoRules";
import { firstContact, kindOf, outcomeIndex, startLabels, type TicketsData } from "./ticketsRules";

// v2: incoming and system tickets, the first contact and the activities, the outcome (30.10.2026)
// v3: the resolution as set and its "more information" text; e-mail and the Back Office redirects as one channel (31.10.2026)
const KEY = "esoTickets:v3";
const TTL_MS = 60 * 60 * 1000;
const ESO_PIPELINE = "1726599376";
const PROPS = [
  "subject", "createdate", "hs_pipeline_stage", "hubspot_owner_id", "source_type", "hs_object_source", "hs_object_source_detail_1",
  "hs_outbound_ticket", "hs_tag_ids", "ticket_resolution_eso", "first_agent_reply_date", "hs_primary_company_id",
  "more_information_about_the_ticket_resolution_eso",
];
/** A resolution text is kept to this length - enough to read why, small enough for the read */
const TEXT_MAX = 400;

/** The labels people pick for the ticket resolution, by the stored value (as Hand-over reads them). */
async function resolutionLabels(): Promise<(v: string) => string> {
  try {
    const p = await read<{ options?: { value: string; label: string }[] }>({ path: "/crm/v3/properties/tickets/ticket_resolution_eso", useTicketsToken: true });
    const m = new Map((p.options ?? []).map((o) => [o.value, o.label.trim()]));
    return (v) => m.get(v) ?? v;
  } catch {
    return (v) => v;
  }
}

export function esoTickets(): Promise<SlowState<TicketsData>> {
  return slowReport(KEY, TTL_MS, buildTickets);
}

const ms = (v: string | null | undefined): number | null => {
  const t = (v ?? "").trim();
  if (!t) return null;
  const n = /^\d+$/.test(t) ? Number(t) : Date.parse(t);
  return Number.isFinite(n) ? n : null;
};

/** The read itself (exported for a local check; the pages go through esoTickets). */
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

  // 2. what each is - as the Hand-over page sorts them, the pushes kept as system tickets
  const lifecycle: Record<string, string> = {};
  for (const u of UCS) for (const t of u.tickets) lifecycle[t.name] = u.key;
  const left: Record<string, number> = {};
  type Kept = { id: string; p: Record<string, string | null>; group: number; channel: string; newLead: boolean; created: number };
  const kept: Kept[] = [];
  for (const t of found) {
    const p = t.properties ?? {};
    const created = ms(p.createdate);
    const y = created == null ? 0 : new Date(created).getUTCFullYear();
    if (created == null || (y !== year && y !== year - 1)) continue;
    const what = kindOf({ subject: p.subject, sourceType: p.source_type, objectSource: p.hs_object_source, workflow: p.hs_object_source_detail_1, outbound: p.hs_outbound_ticket, tags: p.hs_tag_ids, resolution: p.ticket_resolution_eso }, lifecycle);
    if ("skip" in what) { left[what.skip] = (left[what.skip] ?? 0) + 1; continue; }
    kept.push({ id: String(t.id), p, group: what.group === "incoming" ? 0 : 1, channel: what.channel, newLead: what.newLead, created });
  }

  // 3. what the team did on them: the e-mails (sent ones are a contact, received ones are not), calls, meetings, notes, tasks
  const ids = kept.map((k) => k.id);
  const on: Record<"emails" | "calls" | "meetings" | "notes" | "tasks", Map<string, string[]>> = { emails: new Map(), calls: new Map(), meetings: new Map(), notes: new Map(), tasks: new Map() };
  for (const to of Object.keys(on) as (keyof typeof on)[]) {
    reportProgress(KEY, `reading the ${to} on the tickets`);
    on[to] = await associations("tickets", to, ids);
  }
  const when = new Map<string, number | null>();
  const outgoing = new Set<string>();
  const emailIds = [...new Set([...on.emails.values()].flat())];
  for (const e of await batchRead("emails", emailIds, ["hs_timestamp", "hs_email_direction"], [], (n) => reportProgress(KEY, `reading the e-mails, ${n.toLocaleString("en")} of ${emailIds.length.toLocaleString("en")}`))) {
    when.set(`e${e.id}`, ms(e.properties?.hs_timestamp));
    if ((e.properties?.hs_email_direction ?? "") !== "INCOMING_EMAIL") outgoing.add(String(e.id));
  }
  const callIds = [...new Set([...on.calls.values()].flat())];
  for (const c of await batchRead("calls", callIds, ["hs_timestamp"], [], (n) => reportProgress(KEY, `reading the calls, ${n.toLocaleString("en")} of ${callIds.length.toLocaleString("en")}`))) when.set(`c${c.id}`, ms(c.properties?.hs_timestamp));
  const meetingIds = [...new Set([...on.meetings.values()].flat())];
  for (const m of await batchRead("meetings", meetingIds, ["hs_meeting_start_time", "hs_timestamp"])) when.set(`m${m.id}`, ms(m.properties?.hs_meeting_start_time) ?? ms(m.properties?.hs_timestamp));

  // 4. their companies' facts
  type Co = { prio: string; category: string; country: string };
  const companies = new Map<string, Co>();
  const coIds = [...new Set(kept.map((k) => k.p.hs_primary_company_id).filter((x): x is string => !!x))];
  const recs = await batchRead("companies", coIds, ["sales_priority", "apso_customer", "country_custom"], [],
    (n) => reportProgress(KEY, `reading the tickets' companies · ${n.toLocaleString("en")} of ${coIds.length.toLocaleString("en")}`));
  for (const c of recs) {
    const p = c.properties ?? {};
    companies.set(String(c.id), { prio: prioBand(prioOf(p.sales_priority)), category: (p.apso_customer ?? "").trim() || "Not set", country: (p.country_custom ?? "").trim() || "Not set" });
  }

  // 5. the people: their names, and their team - the rosters, else the team HubSpot has them in (as Visits)
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

  // 6. the rows
  const resLabel = await resolutionLabels();
  const labels = startLabels();
  const texts: TicketsData["texts"] = {};
  const at = (list: string[], v: string) => { let i = list.indexOf(v); if (i < 0) i = list.push(v) - 1; return i; };
  const rows: number[][] = [];
  for (const { id, p, group, channel, newLead, created } of kept) {
    const d = new Date(created);
    const co = companies.get(p.hs_primary_company_id ?? "");
    const emails = on.emails.get(id) ?? [], calls = on.calls.get(id) ?? [], meetings = on.meetings.get(id) ?? [];
    const sent = emails.filter((e) => outgoing.has(e));
    const first = firstContact(created, [
      { at: ms(p.first_agent_reply_date), kind: 0 },
      ...sent.map((e) => ({ at: when.get(`e${e}`) ?? null, kind: 1 })),
      ...calls.map((c) => ({ at: when.get(`c${c}`) ?? null, kind: 2 })),
      ...meetings.map((m) => ({ at: when.get(`m${m}`) ?? null, kind: 3 })),
    ]);
    const closed = !!stages.get(p.hs_pipeline_stage ?? "")?.closed;
    const res = closed ? (p.ticket_resolution_eso ?? "").trim() : "";
    const text = (p.more_information_about_the_ticket_resolution_eso ?? "").replace(/\s+/g, " ").trim();
    if (text && d.getUTCFullYear() === year) texts[String(rows.length)] = text.length > TEXT_MAX ? `${text.slice(0, TEXT_MAX - 1)}…` : text;
    rows.push([
      person(p.hubspot_owner_id ?? ""), d.getUTCFullYear() === year ? 0 : 1, d.getUTCMonth(), d.getUTCDate(), group, at(labels.channel, channel),
      at(labels.prio, co?.prio ?? "No priority"), at(labels.category, co?.category ?? "Not set"), at(labels.country, co?.country ?? "Not set"),
      outcomeIndex(closed, p.ticket_resolution_eso, newLead),
      first ? Math.round(workingHours(created, first.at) * 10) : -1, first ? first.kind : -1,
      sent.length, calls.length, meetings.length, (on.notes.get(id) ?? []).length + (on.tasks.get(id) ?? []).length,
      res ? at(labels.resolution, resLabel(res)) : -1,
    ]);
  }
  return {
    generatedAt: new Date().toISOString(), year, today, people, labels, tickets: rows, texts,
    coverage: { read: found.length, kept: kept.length, withCompany: kept.filter((k) => companies.has(k.p.hs_primary_company_id ?? "")).length, left },
  };
}
