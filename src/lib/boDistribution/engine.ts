// BACK OFFICE DISTRIBUTION - SHADOW MODE (SARCLA 18.10.2026: "it should work seamlessly"). The hub works out, for
// every ticket that enters Back Office "New" / "Redirected from Chat/Helpline" or GQS "New for Back-Office", what
// the HubSpot workflows decide (rules.ts) - and writes NOTHING to HubSpot. Ten minutes later it reads what HubSpot
// really did, so the page can show, ticket by ticket: what the workflow did, what a faithful copy of its rules
// gives ("legacy"), and what the hub would give with the faults fixed ("hub").
//
// Every 2 minutes, one copy of the hub at a time (advisory lock 4107231). Facts are read as the workflow saw them
// one minute after the ticket entered the stage: the category and sub-category from their history, the stages the
// ticket has been in, its associated emails (sales@ split), the sales agent of its companies / contacts, everyone's
// chat status (all pages, and the first page alone - #23 reads only that), and each person's open tickets - this
// ticket left out, since it may already be counted for the person HubSpot gave it to.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { ownerNames } from "@/lib/integrations/erosion";
import { CATEGORIES, DROPDOWN_VALUES, KEYWORDS, classifyTicket, type Classification } from "./classifier";
import {
  BO, BO_OPEN_STAGES, GQS, GQS_OPEN_STAGES_LEGACY, LEGACY, PEOPLE, ROSTER_LABEL, SALES_SPLIT_SENDERS, STAGE, SUB,
  assignBo, assignGqs, findSalesAgent, route,
  type AssignInput, type Availability, type CompanyFacts, type ContactFacts, type Mode, type Person, type Pick as RulePick, type RosterKey, type Route, type Workload,
} from "./rules";

const LOCK = 4_107_231;
const EVERY_MS = 2 * 60_000;
const LIMIT_MS = 8 * 60_000;
/** HubSpot's search index trails a write: each window starts this much earlier (rows are keyed, so no double). */
const OVERLAP_MS = 5 * 60_000;
/** The workflow decides one minute after entry; HubSpot's outcome is read once it has settled. */
const OUTCOME_AFTER_MS = 10 * 60_000;
const DAYS_KEPT = 21;
const MAX_PER_RUN = 40;

/** rosters: the page's lists (hub mode); a list left out = the workflow's own. */
export type Settings = { mode: "off" | "shadow"; rosters: Partial<Record<RosterKey, Person[]>>; by: string | null; at: string | null };
export type Answer = { ownerId: string | null; ownerName: string | null; method: string; reasons: string[] };
export type Actual = {
  at: string; ownerId: string | null; ownerName: string | null; ownerSetBy: string | null;
  pipeline: string | null; stage: string | null; category: string | null; subCategory: string | null; priority: string | null; dispatch: string | null;
};
export type Row = {
  key: string; ticketId: string; pipeline: "bo" | "gqs"; enteredAt: string; seenAt: string;
  subject: string; source: string | null;
  route?: Pick<Route, "path" | "assigner" | "sets" | "classified" | "c2sStageAfter">;
  /** null when the path picks no owner (chat, exclusions, CERTIFICATES...) */
  legacy: Answer | null;
  hub: Answer | null;
  /** replayed from the last 7 days: availability and workload are today's, not the ones at the time */
  approx?: boolean;
  note?: string;
  actual?: Actual;
  error?: string;
};
export type RunInfo = { at: string; seconds: number; read: number; decided: number; checked: number; error?: string };

const KV = { settings: "boDist:settings", last: "boDist:lastRun", cursor: "boDist:cursor", backfill: "boDist:backfill", day: (d: string) => `boDist:rows:${d}` };
/** The replay of the last days (SARCLA 18.10.2026: the page was empty on a quiet Sunday night). */
type Backfill = { from: number; cursor: number; done: boolean; startedAt: string };
const BACKFILL_DAYS = 7;
const BACKFILL_PER_RUN = 15;

export async function getSettings(): Promise<Settings> {
  const x = await kvGet<Partial<Settings>>(KV.settings);
  return { mode: x?.mode === "off" ? "off" : "shadow", rosters: x?.rosters ?? {}, by: x?.by ?? null, at: x?.at ?? null };
}
export async function saveSettings(patch: { mode?: "off" | "shadow"; rosters?: Partial<Record<RosterKey, Person[] | null>> }, by: string): Promise<Settings> {
  const cur = await getSettings();
  const rosters = { ...cur.rosters };
  for (const [k, v] of Object.entries(patch.rosters ?? {}) as [RosterKey, Person[] | null][]) {
    if (!(k in LEGACY)) continue;
    if (v === null) { delete rosters[k]; continue; } // back to the workflow's list
    rosters[k] = v.filter((x) => /^\d+$/.test(String(x.id)) && String(x.name ?? "").trim()).slice(0, 15).map((x) => ({ id: String(x.id), name: String(x.name).trim() }));
  }
  const next: Settings = { mode: patch.mode === "off" ? "off" : patch.mode === "shadow" ? "shadow" : cur.mode, rosters, by, at: new Date().toISOString() };
  await kvSet(KV.settings, next);
  return next;
}
export const replayFrom = async () => kvSet(KV.backfill, { from: Date.now() - BACKFILL_DAYS * 86400_000, cursor: Date.now() - BACKFILL_DAYS * 86400_000, done: false, startedAt: new Date().toISOString() } satisfies Backfill);
export const backfillState = async () => (await kvGet<Backfill>(KV.backfill)) ?? null;
export const lastRun = async () => (await kvGet<RunInfo>(KV.last)) ?? null;

const day = (iso: string) => iso.slice(0, 10);
export async function rowsOfDay(d: string): Promise<Row[]> { return (await kvGet<Row[]>(KV.day(d))) ?? []; }
export async function recentRows(days = 7): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < days; i++) out.push(...(await rowsOfDay(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10))));
  return out.sort((a, b) => b.enteredAt.localeCompare(a.enteredAt));
}

/* ── HubSpot reads ───────────────────────────────────────────────────────── */

const hs = <T>(path: string, method: "GET" | "POST" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body });
type Hist = { value: string; timestamp: string; sourceType?: string; sourceId?: string; sourceLabel?: string; updatedByUserId?: number };
type TicketFull = {
  id: string; properties: Record<string, string | null>;
  propertiesWithHistory?: Record<string, Hist[]>;
  associations?: Record<string, { results?: { id: string }[] }>;
};

const CAT_PROPS = ["enquiry_category", SUB.website, SUB.price, SUB.delivery, SUB.delivery2, SUB.invoicing, SUB.product];
const READ = ["subject", "content", "source_type", "ai_chat_source", "c2s_problem_order", "hs_pipeline", "hs_pipeline_stage", "hubspot_owner_id",
  "gqs_type_of_request", "hs_ticket_priority", "dispatch", "createdate", ...CAT_PROPS];

async function ticket(id: string, withHistory: string[]): Promise<TicketFull> {
  return hs<TicketFull>(`/crm/v3/objects/tickets/${id}?properties=${READ.join(",")}&propertiesWithHistory=${withHistory.join(",")}&associations=contacts,companies,emails`);
}
/** A property's value as it stood at `at` (history is newest first). */
function valueAt(h: Hist[] | undefined, at: number): string | null {
  for (const x of h ?? []) if (Date.parse(x.timestamp) <= at) return x.value || null;
  return null;
}

/** Everyone's chat status: all pages, and the first page alone (code #23 never pages). */
async function availability(): Promise<{ all: Availability; first: Availability }> {
  const all: Availability = new Map(), first: Availability = new Map();
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    const r = await hs<{ results?: { properties?: Record<string, string | null> }[]; paging?: { next?: { after?: string } } }>(
      `/crm/v3/objects/users?limit=100&properties=hs_availability_status,hubspot_owner_id${after ? `&after=${after}` : ""}`);
    for (const u of r.results ?? []) {
      const o = u.properties?.hubspot_owner_id;
      if (!o) continue;
      const st = u.properties?.hs_availability_status ?? null;
      all.set(String(o), st ? st.toLowerCase() : null);
      if (page === 0) first.set(String(o), st ? st.toLowerCase() : null);
    }
    after = r.paging?.next?.after;
    if (!after) break;
  }
  return { all, first };
}

let archivedCache: { at: number; ids: Set<string> } | null = null;
async function archivedOwners(): Promise<Set<string>> {
  if (archivedCache && Date.now() - archivedCache.at < 60 * 60_000) return archivedCache.ids;
  const ids = new Set<string>();
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    const r = await hs<{ results?: { id: string }[]; paging?: { next?: { after?: string } } }>(`/crm/v3/owners?archived=true&limit=100${after ? `&after=${after}` : ""}`);
    for (const o of r.results ?? []) ids.add(String(o.id));
    after = r.paging?.next?.after;
    if (!after) break;
  }
  archivedCache = { at: Date.now(), ids };
  return ids;
}

/** Open tickets per owner in a pipeline's counted stages; null when the count failed. */
async function counts(pipeline: string, stages: string[], people: Person[]): Promise<Workload> {
  const w: Workload = new Map();
  for (const p of people) {
    try {
      const r = await hs<{ total?: number }>("/crm/v3/objects/tickets/search", "POST", {
        filterGroups: [{ filters: [
          { propertyName: "hs_pipeline", operator: "EQ", value: pipeline },
          { propertyName: "hs_pipeline_stage", operator: "IN", values: stages },
          { propertyName: "hubspot_owner_id", operator: "EQ", value: p.id },
        ] }], properties: ["hs_object_id"], limit: 1,
      });
      w.set(p.id, r.total ?? 0);
    } catch { w.set(p.id, null); }
    await new Promise((res) => setTimeout(res, 260)); // the search API allows about 4 a second
  }
  return w;
}
const uniq = (lists: Person[][]) => [...new Map(lists.flat().map((p) => [p.id, p])).values()];

async function salesAgentFacts(t: TicketFull): Promise<{ companies: CompanyFacts[]; contacts: ContactFacts[] }> {
  const companies: CompanyFacts[] = [], contacts: ContactFacts[] = [];
  for (const { id } of t.associations?.companies?.results ?? []) {
    try {
      const c = await hs<{ properties: Record<string, string | null> }>(`/crm/v3/objects/companies/${id}?properties=name,domain,website,sa__sales_agent,sales_agent_sub`);
      const p = c.properties;
      companies.push({ id, name: p.name ?? `Company ${id}`, domain: p.domain, website: p.website, sa: p.sa__sales_agent, saSub: p.sales_agent_sub });
    } catch { /* the code skips a company it cannot read */ }
  }
  for (const { id } of t.associations?.contacts?.results ?? []) {
    try {
      const c = await hs<{ properties: Record<string, string | null> }>(`/crm/v3/objects/contacts/${id}?properties=email,firstname,lastname,sa__sales_agent,associatedcompanyid`);
      const p = c.properties;
      contacts.push({ id, email: p.email, name: `${p.firstname ?? ""} ${p.lastname ?? ""}`.trim() || p.email || id, sa: p.sa__sales_agent, companyId: p.associatedcompanyid });
    } catch { /* idem */ }
  }
  return { companies, contacts };
}

async function emails(t: TicketFull): Promise<{ to: string[]; from: string[]; latestFrom: string | null }> {
  const ids = (t.associations?.emails?.results ?? []).map((x) => x.id).slice(0, 50);
  if (!ids.length) return { to: [], from: [], latestFrom: null };
  const r = await hs<{ results?: { properties: Record<string, string | null> }[] }>("/crm/v3/objects/emails/batch/read", "POST", {
    properties: ["hs_email_to_email", "hs_email_from_email", "hs_timestamp"], inputs: ids.map((id) => ({ id })),
  });
  const rows = (r.results ?? []).map((e) => e.properties).sort((a, b) => String(b.hs_timestamp ?? "").localeCompare(String(a.hs_timestamp ?? "")));
  const split = (v: string | null | undefined) => String(v ?? "").toLowerCase().split(/[;,\s]+/).filter(Boolean);
  return { to: rows.flatMap((e) => split(e.hs_email_to_email)), from: rows.flatMap((e) => split(e.hs_email_from_email)), latestFrom: split(rows[0]?.hs_email_from_email)[0] ?? null };
}

async function ownerByEmail(email: string): Promise<Person | null> {
  try {
    const r = await hs<{ results?: { id: string; firstName?: string; lastName?: string }[] }>(`/crm/v3/owners/?email=${encodeURIComponent(email)}`);
    const o = r.results?.[0];
    return o ? { id: String(o.id), name: `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim() || email } : null;
  } catch { return null; }
}
async function gqsTaskOwner(oNumber: string): Promise<Person | null> {
  const r = await hs<{ results?: { properties: Record<string, string | null> }[] }>("/crm/v3/objects/tickets/search", "POST", {
    filterGroups: [{ filters: [{ propertyName: "hs_pipeline", operator: "EQ", value: GQS }, { propertyName: "o_number", operator: "EQ", value: oNumber }] }],
    properties: ["hubspot_owner_id"], sorts: [{ propertyName: "createdate", direction: "DESCENDING" }], limit: 1,
  });
  const id = r.results?.[0]?.properties.hubspot_owner_id;
  return id ? { id, name: (await ownerNames()).get(id) ?? id } : null;
}

/* ── one ticket ──────────────────────────────────────────────────────────── */

const answer = (p: RulePick): Answer => ({ ownerId: p.owner?.id ?? null, ownerName: p.owner?.name ?? null, method: p.method, reasons: p.reasons });
const fixed = (owner: Person | null, method: string): Answer => ({ ownerId: owner?.id ?? null, ownerName: owner?.name ?? null, method, reasons: [] });

type Shared = { settings?: Settings; avail?: { all: Availability; first: Availability }; archived?: Set<string>; boLoad?: Workload; gqsLoad?: Workload };
/** Everyone a list names - the workflow's and the page's. */
function everyone(settings: Settings, keys: RosterKey[]): Person[] {
  return uniq(keys.flatMap((k) => [LEGACY[k], settings.rosters[k] ?? []]));
}

async function decide(id: string, pipeline: "bo" | "gqs", enteredAt: string, shared: Shared): Promise<Row> {
  const t = await ticket(id, ["hs_pipeline_stage", ...CAT_PROPS]);
  const p = t.properties;
  const asOf = Date.parse(enteredAt) + 45_000; // the workflow reads the ticket one minute after entry
  const row: Row = {
    key: `${id}:${enteredAt}`, ticketId: id, pipeline, enteredAt, seenAt: new Date().toISOString(),
    subject: p.subject ?? "", source: p.source_type ?? null, legacy: null, hub: null,
  };
  shared.settings ??= await getSettings();
  const settings = shared.settings;
  const people = pipeline === "bo"
    ? everyone(settings, ["team27", "team31", "team23", "team50", "primary23", "saToOwnerBo"])
    : everyone(settings, ["gqsTeam", "gqsDt", "saToOwnerGqs"]);
  shared.avail ??= await availability();
  shared.archived ??= await archivedOwners();
  const load = pipeline === "bo"
    ? (shared.boLoad ??= await counts(BO, BO_OPEN_STAGES, people))
    : (shared.gqsLoad ??= await counts(GQS, GQS_OPEN_STAGES_LEGACY, people));
  // leave this ticket out of its current owner's count - it may already be assigned
  const workload: Workload = new Map(load);
  const cur = p.hubspot_owner_id ?? "";
  const counted = pipeline === "bo" ? BO_OPEN_STAGES : GQS_OPEN_STAGES_LEGACY;
  if (cur && counted.includes(p.hs_pipeline_stage ?? "") && typeof workload.get(cur) === "number") workload.set(cur, Math.max(0, (workload.get(cur) as number) - 1));

  const { companies, contacts } = await salesAgentFacts(t);
  const input = (saKey: "saToOwnerBo" | "saToOwnerGqs"): AssignInput => ({
    sa: findSalesAgent(companies, contacts, LEGACY[saKey]),
    saHub: findSalesAgent(companies, contacts, settings.rosters[saKey] ?? LEGACY[saKey]),
    availability: shared.avail!.all, availabilityFirstPage: shared.avail!.first, workload, archived: shared.archived!, pools: settings.rosters,
  });

  if (pipeline === "gqs") {
    const inp = input("saToOwnerGqs");
    const gqsType = p.gqs_type_of_request ?? "";
    row.legacy = answer(assignGqs(gqsType, inp, "legacy"));
    row.hub = answer(assignGqs(gqsType, inp, "hub"));
    return row;
  }

  const stageHist = t.propertiesWithHistory?.hs_pipeline_stage ?? [];
  const mail = await emails(t);
  const facts = {
    subject: p.subject ?? "", sourceType: p.source_type ?? null, aiChatSource: p.ai_chat_source ?? null, c2sProblemOrder: !!p.c2s_problem_order,
    stage: valueAt(stageHist, asOf) ?? p.hs_pipeline_stage ?? "",
    stagesEver: [...new Set(stageHist.filter((h) => Date.parse(h.timestamp) <= asOf).map((h) => h.value))],
    category: valueAt(t.propertiesWithHistory?.enquiry_category, asOf),
    subs: Object.fromEntries(CAT_PROPS.slice(1).map((k) => [k, valueAt(t.propertiesWithHistory?.[k], asOf)])),
    emailToSales: mail.to.includes("sales@apsoparts.com"),
    emailFromSalesRep: mail.from.some((f) => SALES_SPLIT_SENDERS.includes(f)),
  };
  // as the live step gets them: an empty subject or body comes as null, and the step then writes nothing
  const r = route(facts, () => classifyTicket({ subject: p.subject, content: p.content }));
  row.route = { path: r.path, assigner: r.assigner, sets: r.sets, classified: r.classified, c2sStageAfter: r.c2sStageAfter };
  if (r.sets.hubspot_owner_id) {
    const rose = fixed({ id: r.sets.hubspot_owner_id, name: (await ownerNames()).get(r.sets.hubspot_owner_id) ?? r.sets.hubspot_owner_id }, "Chat request resent by TSA");
    row.legacy = rose; row.hub = rose; return row;
  }
  if (!r.assigner) { row.note = "no distribution on this path"; return row; }
  if (r.assigner === "75") {
    const rep = mail.latestFrom ? await ownerByEmail(mail.latestFrom) : null;
    row.legacy = fixed(rep, `To ESO with the forwarding rep (${mail.latestFrom ?? "sender unknown"})`);
    row.hub = row.legacy; row.note = "sales split - ESO New"; return row;
  }
  if (r.assigner === "50") {
    const o = /O2\d\.\d{8}/.exec(p.subject ?? "")?.[0];
    const gqsOwner = o ? await gqsTaskOwner(o) : null;
    if (gqsOwner) { row.legacy = fixed(gqsOwner, `Merged into GQS task ${o}`); row.hub = row.legacy; return row; }
  }
  const inp = input("saToOwnerBo");
  row.legacy = answer(assignBo(r.assigner, inp, "legacy"));
  row.hub = answer(assignBo(r.assigner, inp, "hub"));
  return row;
}

/** What HubSpot really did: owner (and who set it), stage, category, priority, dispatch. */
async function outcome(row: Row): Promise<Actual> {
  const t = await ticket(row.ticketId, ["hubspot_owner_id"]);
  const p = t.properties;
  const last = (t.propertiesWithHistory?.hubspot_owner_id ?? [])[0];
  const by = last ? `${last.sourceType ?? ""}${last.sourceId ? ` ${last.sourceId}` : ""}${last.sourceLabel ? ` (${last.sourceLabel})` : ""}`.trim() : null;
  const cat = p.enquiry_category ?? null;
  const subProp = { "Website Issue": SUB.website, "Product Price": SUB.price, Delivery: SUB.delivery, "Invoicing & Accounting": SUB.invoicing, "Product Information": SUB.product }[cat ?? ""];
  return {
    at: new Date().toISOString(), ownerId: p.hubspot_owner_id ?? null, ownerName: p.hubspot_owner_id ? (await ownerNames()).get(p.hubspot_owner_id) ?? p.hubspot_owner_id : null,
    ownerSetBy: by, pipeline: p.hs_pipeline ?? null, stage: p.hs_pipeline_stage ?? null, category: cat, subCategory: subProp ? p[subProp] ?? null : null,
    priority: p.hs_ticket_priority ?? null, dispatch: p.dispatch ?? null,
  };
}

/** One ticket checked now - decided and compared, nothing stored, nothing written (the page's "check a ticket"). */
export async function checkTicket(id: string, settings?: Settings): Promise<Row> {
  const t = await hs<{ properties: Record<string, string | null> }>(
    `/crm/v3/objects/tickets/${id}?properties=hs_pipeline,hs_v2_date_entered_${STAGE.boNew},hs_v2_date_entered_${STAGE.boRedirectedFromChat},hs_v2_date_entered_${STAGE.gqsNewForBo},createdate`);
  const p = t.properties;
  const gqs = p.hs_pipeline === GQS;
  const entered = gqs ? p[`hs_v2_date_entered_${STAGE.gqsNewForBo}`] : p[`hs_v2_date_entered_${STAGE.boNew}`] ?? p[`hs_v2_date_entered_${STAGE.boRedirectedFromChat}`];
  const row = await decide(id, gqs ? "gqs" : "bo", new Date(Date.parse(entered ?? p.createdate ?? new Date().toISOString())).toISOString(), { settings });
  row.actual = await outcome(row);
  return row;
}

/* ── the People tab and the Detection tab ─────────────────────────────────── */

export type PersonRow = Person & {
  lists: RosterKey[]; inWorkflow: RosterKey[]; deactivated: boolean; chat: string | null;
  boOpen: number | null; gqsOpen: number | null; gqsOpenFixed: number | null;
};
let peopleCache: { at: number; data: { people: PersonRow[]; owners: Person[] } } | null = null;
/** Everyone in a list (the workflow's or the page's): chat status, open Back Office / GQS tickets, deactivated. */
export async function people(): Promise<{ people: PersonRow[]; owners: Person[]; at: string }> {
  if (peopleCache && Date.now() - peopleCache.at < 5 * 60_000) return { ...peopleCache.data, at: new Date(peopleCache.at).toISOString() };
  const settings = await getSettings();
  const keys = Object.keys(LEGACY) as RosterKey[];
  const all = everyone(settings, keys);
  const [avail, archived, names] = await Promise.all([availability(), archivedOwners(), ownerNames()]);
  const bo = await counts(BO, BO_OPEN_STAGES, all);
  const gqs = await counts(GQS, GQS_OPEN_STAGES_LEGACY, all);
  const gqsFixed = await counts(GQS, ["2338266316", "4704538856", "2964068584", "6078992599"], all);
  const rows: PersonRow[] = all.map((x) => ({
    ...x, name: names.get(x.id) ?? x.name,
    lists: keys.filter((k) => (settings.rosters[k] ?? LEGACY[k]).some((y) => y.id === x.id)),
    inWorkflow: keys.filter((k) => LEGACY[k].some((y) => y.id === x.id)),
    deactivated: archived.has(x.id), chat: avail.all.get(x.id) ?? null,
    boOpen: bo.get(x.id) ?? null, gqsOpen: gqs.get(x.id) ?? null, gqsOpenFixed: gqsFixed.get(x.id) ?? null,
  }));
  const owners = [...names].filter(([id]) => !archived.has(id)).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  peopleCache = { at: Date.now(), data: { people: rows, owners } };
  return { people: rows, owners, at: new Date().toISOString() };
}
export const rosterLabels = ROSTER_LABEL;
export const legacyRosters = LEGACY;
export { PEOPLE };

/** What the classifier knows: categories, their keywords (counts and a sample), the sub-categories it can write. */
export function classifierInfo() {
  return CATEGORIES.map((c) => ({
    category: c,
    keywords: KEYWORDS[c].main.length,
    sample: KEYWORDS[c].main.slice(0, 24),
    subs: Object.entries(KEYWORDS[c].sub).map(([k, words]) => ({ key: k, value: DROPDOWN_VALUES[c]?.[k] ?? k, keywords: words.length, sample: words.slice(0, 12) })),
  }));
}
/** The page's "try it": a subject and a body through the classifier, exactly as the workflow step would read them. */
export const tryClassifier = (subject: string, content: string): Classification => classifyTicket({ subject, content });

/* ── the run ─────────────────────────────────────────────────────────────── */

async function entries(since: number): Promise<{ id: string; pipeline: "bo" | "gqs"; enteredAt: string }[]> {
  const out: { id: string; pipeline: "bo" | "gqs"; enteredAt: string }[] = [];
  const probe = async (pipeline: string, stage: string, kind: "bo" | "gqs") => {
    const prop = `hs_v2_date_entered_${stage}`;
    const r = await hs<{ results?: { id: string; properties: Record<string, string | null> }[] }>("/crm/v3/objects/tickets/search", "POST", {
      filterGroups: [{ filters: [{ propertyName: "hs_pipeline", operator: "EQ", value: pipeline }, { propertyName: prop, operator: "GTE", value: String(since) }] }],
      properties: [prop], sorts: [{ propertyName: prop, direction: "ASCENDING" }], limit: 100,
    });
    for (const t of r.results ?? []) if (t.properties[prop]) out.push({ id: t.id, pipeline: kind, enteredAt: new Date(Date.parse(t.properties[prop]!)).toISOString() });
  };
  await probe(BO, STAGE.boNew, "bo");
  await probe(BO, STAGE.boRedirectedFromChat, "bo");
  await probe(GQS, STAGE.gqsNewForBo, "gqs");
  return out.sort((a, b) => a.enteredAt.localeCompare(b.enteredAt));
}

async function run(signal?: AbortSignal): Promise<RunInfo> {
  const started = Date.now();
  const info: RunInfo = { at: new Date().toISOString(), seconds: 0, read: 0, decided: 0, checked: 0 };
  const cursor = (await kvGet<number>(KV.cursor)) ?? Date.now() - 30 * 60_000;
  const found = await entries(cursor - OVERLAP_MS);
  info.read = found.length;
  const shared: Shared = {};
  const touched = new Map<string, Row[]>();
  const rowsFor = async (d: string) => touched.get(d) ?? (touched.set(d, await rowsOfDay(d)), touched.get(d)!);
  let newest = cursor;
  for (const e of found.slice(0, MAX_PER_RUN)) {
    if (signal?.aborted) break;
    const rows = await rowsFor(day(e.enteredAt));
    const key = `${e.id}:${e.enteredAt}`;
    newest = Math.max(newest, Date.parse(e.enteredAt));
    if (rows.some((r) => r.key === key)) continue;
    try { rows.push(await decide(e.id, e.pipeline, e.enteredAt, shared)); info.decided++; }
    catch (err) { rows.push({ key, ticketId: e.id, pipeline: e.pipeline, enteredAt: e.enteredAt, seenAt: new Date().toISOString(), subject: "", source: null, legacy: null, hub: null, error: (err as Error).message.slice(0, 200) }); }
  }
  // the replay of the last 7 days, oldest first, while the run has time: today's availability and workload
  const bf = await kvGet<Backfill>(KV.backfill) ?? { from: Date.now() - BACKFILL_DAYS * 86400_000, cursor: Date.now() - BACKFILL_DAYS * 86400_000, done: false, startedAt: new Date().toISOString() };
  if (!bf.done && !signal?.aborted && Date.now() - started < 3 * 60_000) {
    const older = (await entries(bf.cursor)).filter((e) => Date.parse(e.enteredAt) < cursor - OVERLAP_MS);
    let n = 0;
    for (const e of older) {
      if (signal?.aborted || n >= BACKFILL_PER_RUN || Date.now() - started > 5 * 60_000) break;
      bf.cursor = Math.max(bf.cursor, Date.parse(e.enteredAt));
      const rows = await rowsFor(day(e.enteredAt));
      const key = `${e.id}:${e.enteredAt}`;
      if (rows.some((r) => r.key === key)) continue;
      n++;
      try {
        const row = await decide(e.id, e.pipeline, e.enteredAt, shared);
        row.approx = true;
        row.actual = await outcome(row);
        rows.push(row);
        info.decided++;
      } catch (err) { rows.push({ key, ticketId: e.id, pipeline: e.pipeline, enteredAt: e.enteredAt, seenAt: new Date().toISOString(), subject: "", source: null, legacy: null, hub: null, approx: true, error: (err as Error).message.slice(0, 200) }); }
    }
    if (n < BACKFILL_PER_RUN && !signal?.aborted) bf.done = true;
    await kvSet(KV.backfill, bf);
  }
  // HubSpot's outcome for the rows that have settled (today and yesterday)
  for (const d of [day(new Date().toISOString()), day(new Date(Date.now() - 86400_000).toISOString())]) {
    const rows = await rowsFor(d);
    for (const r of rows) {
      if (signal?.aborted) break;
      if (r.actual || r.error || Date.now() - Date.parse(r.enteredAt) < OUTCOME_AFTER_MS) continue;
      try { r.actual = await outcome(r); info.checked++; } catch (err) { r.error = `outcome: ${(err as Error).message.slice(0, 160)}`; }
    }
  }
  for (const [d, rows] of touched) await kvSet(KV.day(d), rows);
  await kvSet(KV.cursor, found.length > MAX_PER_RUN ? newest : Math.max(newest, Date.now() - OVERLAP_MS));
  await kvSet(KV.day(new Date(Date.now() - DAYS_KEPT * 86400_000).toISOString().slice(0, 10)), null);
  info.seconds = Math.round((Date.now() - started) / 1000);
  await kvSet(KV.last, info);
  return info;
}

export async function runOnce(signal?: AbortSignal): Promise<RunInfo | null> {
  if ((await getSettings()).mode === "off") return null;
  const client: PoolClient = await getPool().connect();
  let dropped = false;
  const drop = () => { dropped = true; client.release(new Error("bo distribution: time limit")); };
  if (signal?.aborted) drop(); else signal?.addEventListener("abort", drop, { once: true });
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await run(signal).catch(async (e) => {
        const info: RunInfo = { at: new Date().toISOString(), seconds: 0, read: 0, decided: 0, checked: 0, error: (e as Error).message.slice(0, 300) };
        await kvSet(KV.last, info);
        return info;
      });
    } finally {
      if (!dropped) await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    signal?.removeEventListener("abort", drop);
    if (!dropped) client.release();
  }
}

let started = false, running = false;
export function startBoDistribution() {
  if (started || process.env.BO_DISTRIBUTION === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const limit = new AbortController();
    const timer = setTimeout(() => {
      console.error(`[bo-distribution] run still going after ${LIMIT_MS / 60_000} min - stopped and its lock dropped`);
      limit.abort();
      running = false;
    }, LIMIT_MS);
    timer.unref?.();
    void runOnce(limit.signal)
      .catch((e) => console.warn(`[bo-distribution] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); if (!limit.signal.aborted) running = false; });
  };
  setTimeout(tick, 75_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

export type { Mode };
