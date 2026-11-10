// THE NEW CUSTOMER CONTEST'S READ (Diana Fehr 06.11.2026 - the rules and why in ./contestRules.ts): the companies whose
// first order is on or after 5 October (Compass's day, or - with no Compass day - October to December order intake), each
// checked against Compass's whole history on the company; their calls, sent e-mails, meetings and completed visits by
// someone in ESO before the first order, on the company or one of its contacts; the people the Performis SAE names, their unit (Settings >
// Hierarchy) and their line manager's team (Map assignment). Read every hour through slowReport: the first visitor starts it, everyone after gets it.

import { query } from "@/lib/db/client";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { ownerNames } from "@/lib/integrations/erosion";
import { hierarchyNow } from "@/lib/hierarchy/store";
import { reportsOfUnit } from "@/lib/hierarchy/rules";
import { associations, batchRead, dayMs, searchAll, type Filter } from "@/lib/lifecycle/read";
import { getLeads, getTeams } from "@/lib/mapAssign/leads";
import { getRules } from "@/lib/mapAssign/engine";
import { SEED } from "@/lib/mapAssign/seed";
import { saeLabel } from "@/lib/marketingKpis/cube";
import { MONTHS } from "./esoRules";
import {
  CONTEST, CONTEST_MONTHS, NO_TEAM, addAction, actionDay, beforeOrder, companyProps, intakeOf, noActions, orderBound, standingOf,
  type ActionKind, type Actions, type ContestCompany, type ContestData, type ContestPerson, type LeftOut,
} from "./contestRules";

export type { ContestData } from "./contestRules";

// v2: only the actions someone in ESO logged; v3: HubSpot's meetings too; v4: only those before the first order; v5: its day
// too; v6: an e-mail only from the address of someone in ESO; v7: the earlier of Compass's and the shop's first order, the
// TSA Team's customers left out (10.11.2026)
const KEY = "mySalesContest:v7";
const TTL_MS = 60 * 60 * 1000;
const VISIT_OBJ = "2-139767037";

export function mySalesContest(): Promise<SlowState<ContestData>> {
  return slowReport(KEY, TTL_MS, readContest);
}

const ACTION_OBJECTS: { kind: ActionKind; object: string; props: string[] }[] = [
  { kind: "call", object: "calls", props: ["hubspot_owner_id", "hs_timestamp"] },
  { kind: "email", object: "emails", props: ["hubspot_owner_id", "hs_timestamp", "hs_email_direction", "hs_email_from_email"] },
  { kind: "meeting", object: "meetings", props: ["hubspot_owner_id", "hs_timestamp", "hs_meeting_outcome"] },
  { kind: "visit", object: VISIT_OBJ, props: ["hubspot_owner_id", "hs_pipeline_stage", "meeting_date_with_time", "hs_createdate"] },
];

/** The read - exported for a local check against HubSpot; the page reads it through mySalesContest. */
export async function readContest(): Promise<ContestData> {
  const now = new Date();
  const { year, start } = CONTEST;
  // a sales action up to today while the contest runs - a meeting still to come is not one held
  const today = now.toISOString().slice(0, 10);
  const upTo = today < CONTEST.end ? today : CONTEST.end;

  // 1. the companies that may be new: a Compass first order on or after the start, or none on record and order intake in
  //    one of the contest's months (the shop's customers whose orders are not on the company - their day is the shop's)
  reportProgress(KEY, "reading the companies with a first order since 5 October");
  const none: Filter = { propertyName: "order_first_order_date", operator: "NOT_HAS_PROPERTY" };
  const groups: Filter[][] = [
    [{ propertyName: "order_first_order_date", operator: "GTE", value: dayMs(start) }],
    ...CONTEST_MONTHS.map((m) => [none, { propertyName: `oi_${year}_${MONTHS[m]}`, operator: "GT", value: "0" }]),
  ];
  const rows = await searchAll("companies", groups, companyProps(year), (n) => reportProgress(KEY, `reading the companies · ${n}`));

  // 2. the people: the SAE as Map assignment maps it to an owner (as the ESO reports), their unit, their team
  reportProgress(KEY, "reading the people and their teams");
  const names = await ownerNames().catch(() => new Map<string, string>());
  let saeMap: Record<string, string> = SEED.sae;
  try { saeMap = (await getRules()).value.sae ?? SEED.sae; } catch { /* the seed */ }
  const { unitOf, teamOf, teams, ownerOfEmail } = await placesOf();
  const ownerByName = new Map([...names].map(([id, n]) => [n.toLowerCase(), id]));
  const isEso = (owner: string) => reportsOfUnit(unitOf(owner)) === "eso";

  const people: ContestPerson[] = [];
  const personIdx = new Map<string, number>();
  const companies: ContestCompany[] = [];
  const left: Partial<Record<LeftOut, number>> = {};
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const p = r.properties ?? {};
    const st = standingOf(p);
    if ("out" in st) { left[st.out] = (left[st.out] ?? 0) + 1; continue; }
    const s = saeLabel(p.sae_performis, saeMap, names);
    // an SAE written as a person's name goes to that person (SARCLA 24.10.2026, src/lib/mapAssign/seed.ts) - Performis
    // writes "Anna Muster" beside the SAE table's "Muster Anna"
    const owner = s.owner ?? ownerByName.get(s.label.toLowerCase()) ?? null;
    let pi = personIdx.get(s.label);
    if (pi === undefined) pi = people.push({ name: s.label, ownerId: null, team: NO_TEAM, eso: false }) - 1;
    personIdx.set(s.label, pi);
    if (owner && !people[pi].ownerId) people[pi] = { name: s.label, ownerId: owner, team: teamOf(owner) || NO_TEAM, eso: reportsOfUnit(unitOf(owner)) === "eso" };
    companies.push({ id: r.id, name: p.name ?? "", person: pi, day: st.day, from: st.from, intake: intakeOf(p, year), actions: noActions() });
  }

  // 3. their sales actions: on the company, or on one of its contacts - each call, e-mail, visit once per company
  const ids = companies.map((c) => c.id);
  reportProgress(KEY, "reading the companies' contacts");
  const contactsOf = await associations("companies", "contacts", ids);
  const contacts = [...new Set([...contactsOf.values()].flat())];
  const tally = new Map<string, Actions>(companies.map((c) => [c.id, c.actions]));
  // only the sales actions before the company's first order count
  const boundOf = new Map(companies.map((c) => [c.id, orderBound(c, year)]));
  for (const a of ACTION_OBJECTS) {
    reportProgress(KEY, `reading the ${a.kind === "visit" ? "visits" : `${a.kind}s`}`);
    const fromCo = await associations("companies", a.object, ids);
    const fromContact = contacts.length ? await associations("contacts", a.object, contacts) : new Map<string, string[]>();
    const perCo = new Map<string, Set<string>>();
    for (const id of ids) perCo.set(id, new Set([...(fromCo.get(id) ?? []), ...(contactsOf.get(id) ?? []).flatMap((ct) => fromContact.get(ct) ?? [])]));
    const all = [...new Set([...perCo.values()].flatMap((s) => [...s]))];
    const recs = await batchRead(a.object, all, a.props, [], (n) => reportProgress(KEY, `reading the ${a.kind === "visit" ? "visits" : `${a.kind}s`} · ${n} of ${all.length}`));
    const dayOf = new Map(recs.map((x) => [x.id, actionDay(a.kind, x.properties ?? {}, isEso, upTo, ownerOfEmail)]));
    for (const [co, set] of perCo) {
      const until = boundOf.get(co) ?? null;
      for (const x of set) { const d = dayOf.get(x); if (d && beforeOrder(d, until)) addAction(tally.get(co)!, a.kind, d); }
    }
  }

  return { generatedAt: now.toISOString(), today, people, teams, companies, left, read: seen.size };
}

/**
 * Each owner's unit as Settings > Hierarchy has it, and their line manager's team: Map assignment's SAE table, else the
 * team whose line manager they are or report to (a team's id is its line manager's hub username - RABE, SARCLA, FALU).
 */
async function placesOf() {
  const h = await hierarchyNow();
  const teamList = await getTeams().catch(() => []);
  const leads = await getLeads(teamList).catch(() => ({} as Record<string, string>));
  const nameOf = new Map(teamList.map((t) => [t.id, t.name]));
  const ledBy = new Map<string, string>();
  // an e-mail's sender as an owner: the address HubSpot has for them
  const ownerByEmail = new Map(h.people.filter((p) => p.email).map((p) => [p.email!.toLowerCase(), p.id]));
  try {
    const users = await query<{ username: string; email: string | null }>(`SELECT username, email FROM apsomh_users`);
    for (const t of teamList) {
      const u = users.rows.find((x) => x.username.toLowerCase() === t.id.toLowerCase());
      const id = u?.email ? ownerByEmail.get(u.email.toLowerCase()) : undefined;
      if (id) ledBy.set(id, t.id);
    }
  } catch { /* the SAE table alone */ }
  const teamOf = (id: string): string | null => {
    const lead = leads[id];
    if (lead && nameOf.has(lead)) return nameOf.get(lead)!;
    const seen = new Set<string>();
    for (let x: string | null = id; x && !seen.has(x); x = h.placed[x]?.manager ?? null) {
      seen.add(x);
      const t = ledBy.get(x);
      if (t) return nameOf.get(t) ?? t;
    }
    return null;
  };
  return { unitOf: (id: string) => h.placed[id]?.unit ?? null, teamOf, teams: teamList.map((t) => t.name), ownerOfEmail: (e: string) => ownerByEmail.get(e) ?? null };
}
