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
import { FIXES, classifyTicketV2, type ClassificationV2 } from "./classifierV2";
import { AI_PER_DAY, AI_PER_RUN, aiClassify, type AiAnswer } from "./aiClassify";
import { getAnthropic } from "@/lib/ai/claude";
import { hubspotToken } from "@/lib/integrations/status";
import { NOTE_NO_O, anysealsToFolder, gqsTaskFor, mergeIntoGqs, note, noteNoMatch, oNumber, salesSplit, type Call } from "./codeSteps";
import {
  BO, BO_OPEN_STAGES, DEFAULT_PRIORITY, GQS, GQS_OPEN_STAGES_LEGACY, LEGACY, PEOPLE, ROSTER_LABEL, SALES_SPLIT_SENDERS, STAGE, SUB,
  assignBo, assignGqs, findSalesAgent, priorityFacts, priorityFor, route,
  type Priority, type PriorityFacts, type PrioritySettings,
  type AssignInput, type Availability, type CompanyFacts, type ContactFacts, type Mode, type Person, type Pick as RulePick, type RosterKey, type Route, type Workload,
} from "./rules";

const LOCK = 4_107_231;
/** Every minute: in live mode the hub must assign before the workflow's safety net (3 minutes) falls back to its own step. */
const EVERY_MS = 60_000;
const LIMIT_MS = 8 * 60_000;
/** HubSpot's search index trails a write: each window starts this much earlier (rows are keyed, so no double). */
const OVERLAP_MS = 5 * 60_000;
/** The workflow decides one minute after entry; HubSpot's outcome is read once it has settled. */
const OUTCOME_AFTER_MS = 10 * 60_000;
const DAYS_KEPT = 21;
const MAX_PER_RUN = 40;

/** rosters: the page's lists (hub mode); a list left out = the workflow's own. */
/** live: the hub WRITES the owner for that pipeline (SARCLA 19.10.2026, "build it now"); off = shadow only.
 *  live.strays: the hub gives the open tickets waiting for an owner one (see "waiting for an owner" below). */
export type Settings = {
  mode: "off" | "shadow"; rosters: Partial<Record<RosterKey, Person[]>>; live: { bo: boolean; gqs: boolean; strays: boolean };
  hub: HubOptions; priority: PrioritySettings; by: string | null; at: string | null;
};
/** The hub's own rules (Settings tab, SARCLA 19.10.2026 "settings should be more developed") - the copy never uses them. */
export type HubOptions = {
  /** who is available: the chat dot (the workflows), HubSpot's out-of-office, or both */
  availability: "chat" | "ooo" | "both";
  /** the stages that count as someone's open tickets */
  boStages: string[]; gqsStages: string[];
  /** at most this many open tickets before the least-busy step passes a person over; null = no limit */
  cap: number | null;
  /** live mode: the steps the hub takes over */
  liveSteps: string[];
  note: boolean;
  breaker: number;
  /** nobody available: "wait" = nobody, the ticket stays in the queue; "leastBusy" = the least busy of everyone (the workflow) */
  whenNobody: "wait" | "leastBusy";
};
/** GQS counted on the real "Waiting on APSO" (6078992599) instead of the deleted 3279663337 the workflow counts. */
export const GQS_OPEN_STAGES_FIXED = ["2338266316", "4704538856", "2964068584", "6078992599"];
export const DEFAULT_HUB: HubOptions = { availability: "chat", boStages: BO_OPEN_STAGES, gqsStages: GQS_OPEN_STAGES_FIXED, cap: null, liveSteps: ["23", "27", "31", "42"], note: true, breaker: 40, whenNobody: "wait" };
export type Answer = { ownerId: string | null; ownerName: string | null; method: string; reasons: string[] };
export type Actual = {
  at: string; ownerId: string | null; ownerName: string | null; ownerSetBy: string | null;
  pipeline: string | null; stage: string | null; category: string | null; subCategory: string | null; priority: string | null; dispatch: string | null;
  /** the owner the DISTRIBUTION step itself set (its app's first write after entry) - what the copy is compared with */
  distOwnerId?: string | null; distOwnerName?: string | null;
  /** a later hand-over by the DUPS workflow (owner of an older ticket on the same order) */
  dupsOwnerId?: string | null; dupsOwnerName?: string | null; dupsNote?: string | null;
  /** the category a PERSON set after entry (CRM_UI) - the truth the classifier is measured against */
  catByPerson?: string | null;
  /** GQS: where the task stands now - its stage, closed or not, its GQS status, and the linked ESO / TSA ticket's stage */
  gqs?: { stage: string | null; closed: boolean; status: string | null; parent: { id: string; pipeline: string; stage: string } | null } | null;
  /** 2 = read with the two above */
  v?: number;
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
  /** GQS: the type of request (DT - New Business, Running Business ...) and the GQS status at entry */
  gqsType?: string | null;
  gqsStatus?: string | null;
  /** the IMPROVED classifier (classifierV2.ts) on the same e-mail, and the way the workflow would have sent the ticket
   *  with its answer - shown beside the workflow's, not used for routing while the workflow files the category */
  v2?: { category: string | null; subCategory: string | null; fixes: string[]; matched?: string[]; explanation?: string; path: string[]; assigner: string | null; priority: string | null; dispatch: string | null } | null;
  /** AI on an e-mail both keyword classifiers leave as Others (aiClassify.ts) - shadow; null = asked twice, no answer */
  ai?: AiAnswer | null;
  aiError?: string;
  aiTries?: number;
  /** a cut-to-size (C2S) ticket: the ticket associations engine's c2s_ticket, a C2S problem order, or the C2S path */
  c2s?: boolean;
  /** the domain the e-mail came from - to see what "Others" are */
  fromDomain?: string | null;
  /** 2 = enriched (c2s, sender, the improved classifier's reasons, priority facts) */
  e?: number;
  /** what the priority signals read in it, and the hub's priority (Priority tab) */
  priorityFacts?: PriorityFacts | null;
  priorityHub?: { value: Priority; base: Priority | null; why: string[] } | null;
  /** the ticket's first company and its sales priority (P1..P4) - the Priority tab's signals */
  company?: { name: string; salesPriority: string | null } | null;
  /** the company the workflow step links when the sales agent came from a contact and the ticket has no company */
  associate?: string | null;
  /** GQS: a task with no contact and no company takes them from its linked ticket (the code's
   *  inherit_associations_from_linked_ticket) - read before deciding, written in live mode */
  inherit?: { from: string; contacts: string[]; companies: string[] } | null;
  /** live mode: what the hub wrote, or why it left the ticket to the workflow */
  wrote?: { at: string; ownerId: string | null; ownerName: string | null; ok: boolean; skipped?: string; error?: string; what?: string };
  note?: string;
  actual?: Actual;
  error?: string;
};
export type RunInfo = { at: string; seconds: number; read: number; decided: number; checked: number; error?: string };

const KV = { settings: "boDist:settings", last: "boDist:lastRun", cursor: "boDist:cursor", backfill: "boDist:backfill", strays: "boDist:strays", catchup: "boDist:catchup", day: (d: string) => `boDist:rows:${d}` };
/** The replay of the last days (SARCLA 18.10.2026: the page was empty on a quiet Sunday night). */
type Backfill = { from: number; cursor: number; done: boolean; startedAt: string };
const BACKFILL_DAYS = 7;
const BACKFILL_PER_RUN = 15;

export async function getSettings(): Promise<Settings> {
  const x = await kvGet<Partial<Settings>>(KV.settings);
  return {
    mode: x?.mode === "off" ? "off" : "shadow", rosters: x?.rosters ?? {}, live: { bo: !!x?.live?.bo, gqs: !!x?.live?.gqs, strays: !!x?.live?.strays },
    hub: { ...DEFAULT_HUB, ...(x?.hub ?? {}) }, priority: { ...DEFAULT_PRIORITY, ...(x?.priority ?? {}) }, by: x?.by ?? null, at: x?.at ?? null,
  };
}
export async function saveSettings(patch: {
  mode?: "off" | "shadow"; rosters?: Partial<Record<RosterKey, Person[] | null>>; live?: Partial<Settings["live"]>;
  hub?: Partial<HubOptions>; priority?: Partial<PrioritySettings>;
}, by: string): Promise<Settings> {
  const cur = await getSettings();
  const rosters = { ...cur.rosters };
  for (const [k, v] of Object.entries(patch.rosters ?? {}) as [RosterKey, Person[] | null][]) {
    if (!(k in LEGACY)) continue;
    if (v === null) { delete rosters[k]; continue; } // back to the workflow's list
    rosters[k] = v.filter((x) => /^\d+$/.test(String(x.id)) && String(x.name ?? "").trim()).slice(0, 15).map((x) => ({ id: String(x.id), name: String(x.name).trim() }));
  }
  const live = { bo: patch.live?.bo ?? cur.live.bo, gqs: patch.live?.gqs ?? cur.live.gqs, strays: patch.live?.strays ?? cur.live.strays };
  const h = { ...cur.hub, ...(patch.hub ?? {}) };
  const ids = (a: unknown) => (Array.isArray(a) ? a.map(String).filter((x) => /^\d+$/.test(x)).slice(0, 20) : []);
  const hub: HubOptions = {
    availability: h.availability === "ooo" || h.availability === "both" ? h.availability : "chat",
    boStages: ids(h.boStages).length ? ids(h.boStages) : DEFAULT_HUB.boStages, gqsStages: ids(h.gqsStages).length ? ids(h.gqsStages) : DEFAULT_HUB.gqsStages,
    cap: h.cap === null || h.cap === undefined || !Number(h.cap) ? null : Math.min(500, Math.max(1, Math.round(Number(h.cap)))),
    liveSteps: (Array.isArray(h.liveSteps) ? h.liveSteps : DEFAULT_HUB.liveSteps).map(String).filter((x) => ["23", "27", "31", "42"].includes(x)),
    note: h.note !== false, breaker: Math.min(200, Math.max(1, Math.round(Number(h.breaker) || 40))),
    whenNobody: h.whenNobody === "leastBusy" ? "leastBusy" : "wait",
  };
  const pr = { ...cur.priority, ...(patch.priority ?? {}) };
  const words = (a: unknown, d: string[]) => (Array.isArray(a) ? a.map((x) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, 60) : d);
  const priority: PrioritySettings = {
    overrides: Object.fromEntries(Object.entries(pr.overrides ?? {}).filter(([k, v]) => /^[^|]+\|[^|]+$/.test(k) && ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(String(v)))) as Record<string, Priority>,
    raiseOnUrgentWords: !!pr.raiseOnUrgentWords, urgentWords: words(pr.urgentWords, DEFAULT_PRIORITY.urgentWords),
    raiseKeyCustomers: !!pr.raiseKeyCustomers, keyCustomerPriorities: words(pr.keyCustomerPriorities, DEFAULT_PRIORITY.keyCustomerPriorities).map((x) => x.toUpperCase()),
    lowerNewsletters: !!pr.lowerNewsletters, newsletterWords: words(pr.newsletterWords, DEFAULT_PRIORITY.newsletterWords),
  };
  const next: Settings = { mode: patch.mode === "off" ? "off" : patch.mode === "shadow" ? "shadow" : cur.mode, rosters, live, hub, priority, by, at: new Date().toISOString() };
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

const hs = <T>(path: string, method: "GET" | "POST" | "PATCH" | "PUT" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body });
type Hist = { value: string; timestamp: string; sourceType?: string; sourceId?: string; sourceLabel?: string; updatedByUserId?: number };
type TicketFull = {
  id: string; properties: Record<string, string | null>;
  propertiesWithHistory?: Record<string, Hist[]>;
  associations?: Record<string, { results?: { id: string }[] }>;
};

const CAT_PROPS = ["enquiry_category", SUB.website, SUB.price, SUB.delivery, SUB.delivery2, SUB.invoicing, SUB.product];
const READ = ["subject", "content", "source_type", "ai_chat_source", "c2s_problem_order", "hs_pipeline", "hs_pipeline_stage", "hubspot_owner_id",
  "gqs_type_of_request", "status_of_gqs", "c2s_ticket", "hs_ticket_priority", "dispatch", "createdate", "dup_reason_and_id", ...CAT_PROPS];

async function ticket(id: string, withHistory: string[]): Promise<TicketFull> {
  return hs<TicketFull>(`/crm/v3/objects/tickets/${id}?properties=${READ.join(",")}&propertiesWithHistory=${withHistory.join(",")}&associations=contacts,companies,emails`);
}
/** A property's value as it stood at `at` (history is newest first). */
function valueAt(h: Hist[] | undefined, at: number): string | null {
  for (const x of h ?? []) if (Date.parse(x.timestamp) <= at) return x.value || null;
  return null;
}

/** Everyone's chat status: all pages, and the first page alone (code #23 never pages). */
async function availability(): Promise<{ all: Availability; first: Availability; ooo: Set<string> }> {
  const all: Availability = new Map(), first: Availability = new Map(), ooo = new Set<string>();
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    const r = await hs<{ results?: { properties?: Record<string, string | null> }[]; paging?: { next?: { after?: string } } }>(
      `/crm/v3/objects/users?limit=100&properties=hs_availability_status,hubspot_owner_id,hs_is_out_of_office${after ? `&after=${after}` : ""}`);
    for (const u of r.results ?? []) {
      const o = u.properties?.hubspot_owner_id;
      if (!o) continue;
      const st = u.properties?.hs_availability_status ?? null;
      all.set(String(o), st ? st.toLowerCase() : null);
      if (String(u.properties?.hs_is_out_of_office ?? "").toLowerCase() === "true") ooo.add(String(o));
      if (page === 0) first.set(String(o), st ? st.toLowerCase() : null);
    }
    after = r.paging?.next?.after;
    if (!after) break;
  }
  return { all, first, ooo };
}
const isC2s = (p: Record<string, string | null>, path: string[]) =>
  String(p.c2s_ticket ?? "").toLowerCase() === "true" || !!p.c2s_problem_order || path.includes("C2S Problem") || /\b(c2s|zuschnitt|cut[- ]to[- ]size|coupe sur mesure)\b/i.test(p.subject ?? "");

/** The hub's availability (Settings): the chat dot as the workflows, out of office, or both. */
function hubAvailability(a: { all: Availability; ooo: Set<string> }, how: HubOptions["availability"]): Availability {
  if (how === "chat") return a.all;
  const out: Availability = new Map();
  for (const [id, st] of a.all) out.set(id, a.ooo.has(id) ? "away" : how === "ooo" ? "available" : st);
  return out;
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

async function salesAgentFacts(t: TicketFull): Promise<{ companies: (CompanyFacts & { salesPriority?: string | null })[]; contacts: ContactFacts[] }> {
  const companies: (CompanyFacts & { salesPriority?: string | null })[] = [], contacts: ContactFacts[] = [];
  for (const { id } of t.associations?.companies?.results ?? []) {
    try {
      const c = await hs<{ properties: Record<string, string | null> }>(`/crm/v3/objects/companies/${id}?properties=name,domain,website,sa__sales_agent,sales_agent_sub,sales_priority`);
      const p = c.properties;
      companies.push({ id, name: p.name ?? `Company ${id}`, domain: p.domain, website: p.website, sa: p.sa__sales_agent, saSub: p.sales_agent_sub, salesPriority: p.sales_priority ?? null });
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

/** The code's inherit_associations_from_linked_ticket: the first linked ticket with a contact or a company gives all of its
 *  contacts and companies. */
async function linkedParty(id: string): Promise<{ from: string; contacts: string[]; companies: string[] } | null> {
  const a = await hs<{ results?: { toObjectId: number | string }[] }>(`/crm/v4/objects/tickets/${id}/associations/tickets`);
  for (const lid of [...new Set((a.results ?? []).map((x) => String(x.toObjectId)))].slice(0, 10)) {
    try {
      const t = await hs<TicketFull>(`/crm/v3/objects/tickets/${lid}?properties=subject&associations=contacts,companies`);
      const contacts = [...new Set((t.associations?.contacts?.results ?? []).map((x) => String(x.id)))];
      const companies = [...new Set((t.associations?.companies?.results ?? []).map((x) => String(x.id)))];
      if (contacts.length || companies.length) return { from: lid, contacts, companies };
    } catch { /* the code skips a ticket it cannot read */ }
  }
  return null;
}

/* ── one ticket ──────────────────────────────────────────────────────────── */

const answer = (p: RulePick): Answer => ({ ownerId: p.owner?.id ?? null, ownerName: p.owner?.name ?? null, method: p.method, reasons: p.reasons });
const fixed = (owner: Person | null, method: string): Answer => ({ ownerId: owner?.id ?? null, ownerName: owner?.name ?? null, method, reasons: [] });

type Shared = { settings?: Settings; avail?: { all: Availability; first: Availability; ooo: Set<string> }; archived?: Set<string>; boLoad?: Workload; gqsLoad?: Workload; boLoadHub?: Workload; gqsLoadHub?: Workload };
const BO_KEYS: RosterKey[] = ["team27", "team31", "team23", "team50", "primary23", "saToOwnerBo"];
const GQS_KEYS: RosterKey[] = ["gqsTeam", "gqsDt", "saToOwnerGqs"];
/** Everyone a list names - the workflow's and the page's. */
function everyone(settings: Settings, keys: RosterKey[]): Person[] {
  return uniq(keys.flatMap((k) => [LEGACY[k], settings.rosters[k] ?? []]));
}

/** stray: a ticket waiting for an owner - its facts as they are now, routed as if it entered New, and a path that
 *  picks nobody (chat, exclusions, the sales split, Rose) falls to General Distribution: it must get someone. */
async function decide(id: string, pipeline: "bo" | "gqs", enteredAt: string, shared: Shared, opts: { stray?: boolean } = {}): Promise<Row> {
  const t = await ticket(id, ["hs_pipeline_stage", ...CAT_PROPS]);
  const p = t.properties;
  const asOf = Date.parse(enteredAt) + 45_000; // the workflow reads the ticket one minute after entry
  const row: Row = {
    key: `${id}:${enteredAt}`, ticketId: id, pipeline, enteredAt, seenAt: new Date().toISOString(),
    subject: p.subject ?? "", source: p.source_type ?? null, legacy: null, hub: null,
  };
  shared.settings ??= await getSettings();
  const settings = shared.settings;
  const people = everyone(settings, pipeline === "bo" ? BO_KEYS : GQS_KEYS);
  shared.avail ??= await availability();
  shared.archived ??= await archivedOwners();
  const load = pipeline === "bo"
    ? (shared.boLoad ??= await counts(BO, BO_OPEN_STAGES, people))
    : (shared.gqsLoad ??= await counts(GQS, GQS_OPEN_STAGES_LEGACY, people));
  const hubStages = pipeline === "bo" ? settings.hub.boStages : settings.hub.gqsStages;
  const legacyStages = pipeline === "bo" ? BO_OPEN_STAGES : GQS_OPEN_STAGES_LEGACY;
  const sameStages = hubStages.join() === legacyStages.join();
  const loadHub = sameStages ? load : pipeline === "bo"
    ? (shared.boLoadHub ??= await counts(BO, hubStages, people))
    : (shared.gqsLoadHub ??= await counts(GQS, hubStages, people));
  // leave this ticket out of its current owner's count - it may already be assigned
  const cur = p.hubspot_owner_id ?? "";
  const without = (l: Workload, stages: string[]) => {
    const w: Workload = new Map(l);
    if (cur && stages.includes(p.hs_pipeline_stage ?? "") && typeof w.get(cur) === "number") w.set(cur, Math.max(0, (w.get(cur) as number) - 1));
    return w;
  };
  const workload = without(load, legacyStages);
  const workloadHub = without(loadHub, hubStages);

  // GQS: a task with no contact and no company takes them from its linked ticket FIRST, as the workflow's code does -
  // its Sales Agent then comes from them (SARCLA 19.10.2026: migrate the GQS distribution to the hub)
  if (pipeline === "gqs" && !t.associations?.companies?.results?.length && !t.associations?.contacts?.results?.length) {
    const inh = await linkedParty(id).catch(() => null);
    if (inh) {
      row.inherit = inh;
      t.associations = { ...(t.associations ?? {}), contacts: { results: inh.contacts.map((x) => ({ id: x })) }, companies: { results: inh.companies.map((x) => ({ id: x })) } };
    }
  }
  const { companies, contacts } = await salesAgentFacts(t);
  const firstCo = companies.find((c) => !/apsoparts|angst/i.test(`${c.name} ${c.domain ?? ""}`));
  row.company = firstCo ? { name: firstCo.name, salesPriority: firstCo.salesPriority ?? null } : null;
  const input = (saKey: "saToOwnerBo" | "saToOwnerGqs"): AssignInput => ({
    sa: findSalesAgent(companies, contacts, LEGACY[saKey]),
    saHub: findSalesAgent(companies, contacts, settings.rosters[saKey] ?? LEGACY[saKey]),
    availability: shared.avail!.all, availabilityFirstPage: shared.avail!.first, workload, archived: shared.archived!, pools: settings.rosters,
    availabilityHub: hubAvailability(shared.avail!, settings.hub.availability), workloadHub, cap: settings.hub.cap,
    waitWhenNobody: settings.hub.whenNobody === "wait",
  });

  if (pipeline === "gqs") {
    const inp = input("saToOwnerGqs");
    row.associate = inp.saHub?.companyToAssociate ?? inp.sa.companyToAssociate ?? null;
    (row as Row & { hasParty?: boolean }).hasParty = !!(t.associations?.companies?.results?.length || t.associations?.contacts?.results?.length);
    const gqsType = p.gqs_type_of_request ?? "";
    row.gqsType = gqsType || null;
    row.gqsStatus = p.status_of_gqs ?? null;
    row.legacy = answer(assignGqs(gqsType, inp, "legacy"));
    row.hub = answer(assignGqs(gqsType, inp, "hub"));
    return row;
  }

  const stageHist = t.propertiesWithHistory?.hs_pipeline_stage ?? [];
  const mail = await emails(t);
  const facts = {
    subject: p.subject ?? "", sourceType: p.source_type ?? null, aiChatSource: p.ai_chat_source ?? null, c2sProblemOrder: !!p.c2s_problem_order,
    stage: opts.stray ? STAGE.boNew : valueAt(stageHist, asOf) ?? p.hs_pipeline_stage ?? "",
    stagesEver: opts.stray ? [STAGE.boNew] : [...new Set(stageHist.filter((h) => Date.parse(h.timestamp) <= asOf).map((h) => h.value))],
    category: valueAt(t.propertiesWithHistory?.enquiry_category, asOf),
    subs: Object.fromEntries(CAT_PROPS.slice(1).map((k) => [k, valueAt(t.propertiesWithHistory?.[k], asOf)])),
    emailToSales: mail.to.includes("sales@apsoparts.com"),
    emailFromSalesRep: mail.from.some((f) => SALES_SPLIT_SENDERS.includes(f)),
  };
  // as the live step gets them: an empty subject or body comes as null, and the step then writes nothing
  const r = route(facts, () => classifyTicket({ subject: p.subject, content: p.content }));
  row.route = { path: r.path, assigner: r.assigner, sets: r.sets, classified: r.classified, c2sStageAfter: r.c2sStageAfter };
  if (r.classified) {
    const c2 = classifyTicketV2({ subject: p.subject, content: p.content });
    const r2 = route(facts, () => c2);
    row.v2 = { category: c2.category, subCategory: c2.subCategory, fixes: c2.fixes, matched: c2.matched.slice(0, 12), explanation: c2.explanation, path: r2.path, assigner: r2.assigner, priority: r2.sets.hs_ticket_priority ?? null, dispatch: r2.sets.dispatch ?? null };
  }
  row.c2s = isC2s(p, r.path);
  row.fromDomain = mail.latestFrom?.split("@")[1] ?? null;
  row.e = 2;
  // the priority: what the signals read, and the hub's priority with the Priority tab's rules
  const text = `${p.subject ?? ""} ${String(p.content ?? "").replace(/<[^>]+>/g, " ")}`;
  row.priorityFacts = priorityFacts(text, row.company?.salesPriority ?? null, settings.priority);
  const cat = r.sets.enquiry_category ?? facts.category;
  const subKey = { "Website Issue": SUB.website, "Product Price": SUB.price, Delivery: SUB.delivery, "Invoicing & Accounting": SUB.invoicing, "Product Information": SUB.product }[cat ?? ""];
  const sub = subKey ? r.sets[subKey] ?? facts.subs[subKey] ?? null : null;
  row.priorityHub = priorityFor((r.sets.hs_ticket_priority as Priority | undefined) ?? null, cat ?? null, sub, row.priorityFacts, settings.priority);
  const strayStep = opts.stray && (!r.assigner || r.assigner === "75" || r.assigner === "50" || !!r.sets.hubspot_owner_id) ? "27" as const : null;
  if (!strayStep) {
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
  }
  const step = strayStep ?? (r.assigner as "23" | "27" | "31" | "42" | "50");
  const inp = input("saToOwnerBo");
  row.associate = inp.saHub?.companyToAssociate ?? inp.sa.companyToAssociate ?? null;
  row.legacy = answer(assignBo(step, inp, "legacy"));
  row.hub = answer(assignBo(step, inp, "hub"));
  return row;
}

/** Fill in what rows decided before 19.10.2026 11:30 lack: C2S, sender, the improved classifier, the priority facts. */
async function enrich(row: Row, shared: Shared): Promise<void> {
  shared.settings ??= await getSettings();
  const t = await ticket(row.ticketId, ["hs_pipeline_stage"]);
  const p = t.properties;
  const mail = await emails(t).catch(() => ({ to: [], from: [], latestFrom: null as string | null }));
  if (row.route?.classified) {
    const c2 = classifyTicketV2({ subject: p.subject, content: p.content });
    row.v2 = { ...(row.v2 ?? { path: [], assigner: null, priority: null, dispatch: null }), category: c2.category, subCategory: c2.subCategory, fixes: c2.fixes, matched: c2.matched.slice(0, 12), explanation: c2.explanation };
  }
  if (!row.company) {
    const { companies } = await salesAgentFacts(t);
    const firstCo = companies.find((c) => !/apsoparts|angst/i.test(`${c.name} ${c.domain ?? ""}`));
    row.company = firstCo ? { name: firstCo.name, salesPriority: firstCo.salesPriority ?? null } : null;
  }
  const text = `${p.subject ?? ""} ${String(p.content ?? "").replace(/<[^>]+>/g, " ")}`;
  row.priorityFacts = priorityFacts(text, row.company?.salesPriority ?? null, shared.settings.priority);
  const base = (row.route?.sets.hs_ticket_priority as Priority | undefined) ?? null;
  const cat = row.route?.sets.enquiry_category ?? p.enquiry_category ?? null;
  const subKey = { "Website Issue": SUB.website, "Product Price": SUB.price, Delivery: SUB.delivery, "Invoicing & Accounting": SUB.invoicing, "Product Information": SUB.product }[cat ?? ""];
  row.priorityHub = priorityFor(base, cat, subKey ? row.route?.sets[subKey] ?? p[subKey] ?? null : null, row.priorityFacts, shared.settings.priority);
  row.c2s = isC2s(p, row.route?.path ?? []);
  row.fromDomain = mail.latestFrom?.split("@")[1] ?? null;
  row.e = 2;
}

/** What HubSpot really did: owner (and who set it), stage, category, priority, dispatch. */
/** A GQS task now: its stage (named), closed or not, its GQS status, and the stage of the ESO / TSA ticket it belongs to. */
async function gqsState(id: string, p: Record<string, string | null>): Promise<NonNullable<Actual["gqs"]>> {
  const st = await pipelineStages();
  const named = (list: { id: string; label: string }[], sid: string | null) => list.find((x) => x.id === sid)?.label ?? sid;
  const a = await hs<{ results?: { toObjectId: number | string }[] }>(`/crm/v4/objects/tickets/${id}/associations/tickets`);
  const ids = (a.results ?? []).map((x) => String(x.toObjectId)).slice(0, 10);
  let parent: { id: string; pipeline: string; stage: string } | null = null;
  if (ids.length) {
    const b = await hs<{ results?: { id: string; properties: Record<string, string | null> }[] }>("/crm/v3/objects/tickets/batch/read", "POST", {
      properties: ["hs_pipeline", "hs_pipeline_stage"], inputs: ids.map((x) => ({ id: x })),
    });
    const sales = (b.results ?? []).find((x) => ["1726599376", "1726599377"].includes(x.properties.hs_pipeline ?? ""));
    if (sales) {
      const pipe = sales.properties.hs_pipeline === "1726599376" ? "ESO" : "TSA";
      parent = { id: sales.id, pipeline: pipe, stage: named(pipe === "ESO" ? st.eso : st.tsa, sales.properties.hs_pipeline_stage) ?? "" };
    }
  }
  const stage = p.hs_pipeline_stage ?? null;
  return { stage: named(st.gqs, stage) ?? null, closed: st.gqsClosed.includes(stage ?? ""), status: p.status_of_gqs ?? null, parent };
}

const ESO = "1726599376", TSA = "1726599377";
/** The apps behind the workflows' code steps: the distribution steps (secret DISTRIBUTION) and DUPS (HUBSPOT_API_KEY). */
const DISTRIBUTION_APP = "30109717", DUPS_APP = "22343290";

async function outcome(row: Row): Promise<Actual> {
  const t = await ticket(row.ticketId, ["hubspot_owner_id", "dup_reason_and_id", "enquiry_category"]);
  const p = t.properties;
  const hist = t.propertiesWithHistory?.hubspot_owner_id ?? [];
  const last = hist[0];
  const by = last ? `${last.sourceType ?? ""}${last.sourceId ? ` ${last.sourceId}` : ""}${last.sourceLabel ? ` (${last.sourceLabel})` : ""}`.trim() : null;
  // SARCLA 19.10.2026 "why does it differ?": the copy is the DISTRIBUTION step, so it is compared with what that step
  // wrote - a ticket on an order that already has one is handed on 4 minutes later by DUPS, which is shown apart
  const since = Date.parse(row.enteredAt) - 5_000;
  const after = [...hist].reverse().filter((h) => Date.parse(h.timestamp) >= since);
  const dist = after.find((h) => h.sourceType === "INTEGRATION" && h.sourceId === DISTRIBUTION_APP);
  const dups = after.find((h) => h.sourceType === "INTEGRATION" && h.sourceId === DUPS_APP && (!dist || Date.parse(h.timestamp) >= Date.parse(dist.timestamp)));
  const names = await ownerNames();
  const cat = p.enquiry_category ?? null;
  const subProp = { "Website Issue": SUB.website, "Product Price": SUB.price, Delivery: SUB.delivery, "Invoicing & Accounting": SUB.invoicing, "Product Information": SUB.product }[cat ?? ""];
  return {
    at: new Date().toISOString(), ownerId: p.hubspot_owner_id ?? null, ownerName: p.hubspot_owner_id ? (await ownerNames()).get(p.hubspot_owner_id) ?? p.hubspot_owner_id : null,
    ownerSetBy: by, pipeline: p.hs_pipeline ?? null, stage: p.hs_pipeline_stage ?? null, category: cat, subCategory: subProp ? p[subProp] ?? null : null,
    priority: p.hs_ticket_priority ?? null, dispatch: p.dispatch ?? null,
    distOwnerId: dist?.value || null, distOwnerName: dist?.value ? names.get(dist.value) ?? dist.value : null,
    dupsOwnerId: dups?.value || null, dupsOwnerName: dups?.value ? names.get(dups.value) ?? dups.value : null,
    dupsNote: dups ? (/\(owner of ticket (\d+)\)/.exec(p.dup_reason_and_id ?? "")?.[0] ?? null) : null,
    catByPerson: [...(t.propertiesWithHistory?.enquiry_category ?? [])].find((h) => h.sourceType === "CRM_UI" && Date.parse(h.timestamp) >= since)?.value || null,
    gqs: row.pipeline === "gqs" ? await gqsState(row.ticketId, p).catch(() => null) : undefined,
    v: 2,
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

/* ── live mode: the hub writes the owner ───────────────────────────────────── */

/** Steps the hub takes over; #50 (Task Status Report merge) and #75 (sales split to ESO) stay with the workflow. */
const LIVE_STEPS = new Set(["23", "27", "31", "42"]);

/** The HubSpot workflows the hub replaces. SARCLA 19.10.2026: the hub takes a pipeline over by the workflow being
 *  switched OFF in HubSpot - while it is ON the hub writes nothing there (two owners on 5 tickets that afternoon), so
 *  switching the workflow back on is the whole roll-back. Read every 2 minutes; unreadable = the hub's switch decides. */
export const WORKFLOWS = { bo: { id: "3678508243", name: "SARCLA | BACK OFFICE MAIN ROUTING" }, gqs: { id: "3680656607", name: "SARCLA | NEW FOR BACK-OFFICE GQS DISTRIBUTION" } } as const;
let wfCache: { at: number; on: Record<"bo" | "gqs", boolean | null> } | null = null;
export async function workflowsOn(): Promise<Record<"bo" | "gqs", boolean | null>> {
  if (wfCache && Date.now() - wfCache.at < 2 * 60_000) return wfCache.on;
  const on = { bo: null, gqs: null } as Record<"bo" | "gqs", boolean | null>;
  for (const k of ["bo", "gqs"] as const) {
    try { on[k] = !!(await hs<{ isEnabled?: boolean }>(`/automation/v4/flows/${WORKFLOWS[k].id}`)).isEnabled; } catch { on[k] = null; }
  }
  wfCache = { at: Date.now(), on };
  return on;
}
const ENTRY_STAGES = { bo: [STAGE.boNew, STAGE.boRedirectedFromChat], gqs: [STAGE.gqsNewForBo] } as const;
const ASSIGNED_STAGE = { bo: STAGE.assigned, gqs: STAGE.gqsWaitingOnApso } as const;
const LIVE_MAX_AGE_MS = 20 * 60_000;
const LIVE_MAX_PER_HOUR = 40;

async function writesThisHour(add = 0): Promise<number> {
  const k = `boDist:writes:${new Date().toISOString().slice(0, 13)}`;
  const n = ((await kvGet<number>(k)) ?? 0) + add;
  if (add) await kvSet(k, n);
  return n;
}

/** Write the hub's pick, exactly what the workflow step writes: owner, stage, the company link, a note. Every guard
 *  that fails leaves the ticket to the workflow, whose safety net runs its own step 3 minutes later. */
/** catchUp: an admin's catch-up of an outage window (see catchUp below) - neither the 20-minute rule nor the hourly
 *  breaker applies, and its writes do not count toward the breaker (so live routing keeps its budget); every other guard does. */
type ActOpts = { catchUp?: boolean };

async function act(row: Row, settings: Settings, opts: ActOpts = {}): Promise<NonNullable<Row["wrote"]>> {
  const at = new Date().toISOString();
  const skip = (why: string) => ({ at, ownerId: null, ownerName: null, ok: false, skipped: why });
  if (!settings.live[row.pipeline]) return skip("live mode off for this pipeline");
  if ((await workflowsOn())[row.pipeline] === true) return skip(`the HubSpot workflow "${WORKFLOWS[row.pipeline].name}" is still on - it assigns; switch it off to hand over`);
  if (row.approx || (!opts.catchUp && Date.now() - Date.parse(row.enteredAt) > LIVE_MAX_AGE_MS)) return skip("older than 20 minutes");
  // Back Office: with "SARCLA | BACK OFFICE MAIN ROUTING" off, the hub writes everything it wrote (actBo)
  if (row.pipeline === "bo") return actBo(row, settings, opts);
  // GQS without a contact or company of its own: the hub copies them from the linked ticket (row.inherit) before writing;
  // with none anywhere it still assigns - the code does too (no Sales Agent, then the GQS team)
  const owner = row.hub?.ownerId ?? null;
  if (!owner) return skip("the hub found nobody");
  const breaker = settings.hub.breaker || LIVE_MAX_PER_HOUR;
  if (!opts.catchUp && (await writesThisHour()) >= breaker) return skip(`breaker: ${breaker} writes this hour - look at the page before raising it`);
  // the ticket as it is NOW: still in its entry stage, still nobody's (Backoffice Team or empty)
  const now = await hs<{ properties: Record<string, string | null> }>(`/crm/v3/objects/tickets/${row.ticketId}?properties=hubspot_owner_id,hs_pipeline_stage,status_of_gqs`);
  const cur = now.properties.hubspot_owner_id ?? "";
  if (cur && cur !== PEOPLE.backofficeTeam.id) return skip(`already owned (${(await ownerNames()).get(cur) ?? cur})`);
  if (!(ENTRY_STAGES[row.pipeline] as readonly string[]).includes(now.properties.hs_pipeline_stage ?? "")) return skip("no longer in its entry stage");
  try {
    if (row.pipeline === "gqs" && row.inherit) {
      for (const c of row.inherit.contacts) await hs(`/crm/v4/objects/tickets/${row.ticketId}/associations/default/contacts/${c}`, "PUT").catch(() => null);
      for (const c of row.inherit.companies) await hs(`/crm/v4/objects/tickets/${row.ticketId}/associations/default/companies/${c}`, "PUT").catch(() => null);
    }
    const props: Record<string, string> = { hubspot_owner_id: owner, hs_pipeline_stage: ASSIGNED_STAGE[row.pipeline] };
    // GQS: the workflow sets the status before its owner step - "Approved by Line Manager" unless auto-approved. With the
    // hub assigning, the workflow's safety net skips that branch, so the hub sets it the same way.
    if (row.pipeline === "gqs" && now.properties.status_of_gqs !== "Automatically Approved") props.status_of_gqs = "Approved by Line Manager";
    await hs(`/crm/v3/objects/tickets/${row.ticketId}`, "PATCH", { properties: props });
    if (!opts.catchUp) await writesThisHour(1);
    if (row.associate) await hs(`/crm/v4/objects/tickets/${row.ticketId}/associations/default/companies/${row.associate}`, "PUT").catch(() => null);
    const body = [
      `✅ Auto-Assigned to ${row.hub!.ownerName}`, "", `Method: ${row.hub!.method}`,
      ...(row.hub!.reasons.length ? [`Why: ${row.hub!.reasons.join("; ")}`] : []),
      ...(row.route ? [`Path: ${row.route.path.join(" > ")}`] : []),
      ...(row.inherit ? [`Contact and company copied from linked ticket ${row.inherit.from}`] : []),
      "", "---", "Auto-assigned by APSOhub (Back Office distribution)",
    ].join("<br>");
    if (settings.hub.note) await hs("/crm/v3/objects/notes", "POST", {
      properties: { hs_timestamp: at, hs_note_body: body },
      associations: [{ to: { id: row.ticketId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 228 }] }],
    }).catch(() => null);
    return { at, ownerId: owner, ownerName: row.hub!.ownerName, ok: true };
  } catch (e) {
    return { at, ownerId: owner, ownerName: row.hub!.ownerName, ok: false, error: (e as Error).message.slice(0, 200) };
  }
}

/**
 * Back Office, the workflow off (SARCLA 19.10.2026: "I want to migrate them"): everything "SARCLA | BACK OFFICE MAIN
 * ROUTING" writes, from the same routing copy (rules.ts route()) - the properties of the path (category, sub-categories,
 * order number, priority, dispatch, comment, the Rose subject), its stage, and the owner: the hub's pick for the
 * distribution steps (#23 #27 #31 #42), Rose for a chat TSA sent back, and the code steps the hub took over -
 * #50 Task Status Report into its GQS task, #75 the sales@ split to ESO, #67 the Anyseals stock file (codeSteps.ts).
 * A ticket a person already owns keeps its owner (the workflow overwrote it); nobody available = it waits, the
 * properties are written and "waiting for an owner" gives it one later.
 */
async function actBo(row: Row, settings: Settings, opts: ActOpts = {}): Promise<NonNullable<Row["wrote"]>> {
  const at = new Date().toISOString();
  const skip = (why: string) => ({ at, ownerId: null, ownerName: null, ok: false, skipped: why });
  const r = row.route;
  if (!r) return skip("not routed");
  const breaker = settings.hub.breaker || LIVE_MAX_PER_HOUR;
  if (!opts.catchUp && (await writesThisHour()) >= breaker) return skip(`breaker: ${breaker} writes this hour - look at the page before raising it`);
  const now = await hs<{ properties: Record<string, string | null> }>(`/crm/v3/objects/tickets/${row.ticketId}?properties=hubspot_owner_id,hs_pipeline,hs_pipeline_stage,subject`);
  if (now.properties.hs_pipeline !== BO || !(ENTRY_STAGES.bo as readonly string[]).includes(now.properties.hs_pipeline_stage ?? "")) return skip("no longer in its entry stage");
  const cur = now.properties.hubspot_owner_id ?? "";
  const free = !cur || cur === PEOPLE.backofficeTeam.id;
  const call: Call = <T,>(path: string, method: "GET" | "POST" | "PATCH" | "PUT" = "GET", body?: unknown) => hs<T>(path, method, body);
  const names = await ownerNames();
  const done: string[] = [];
  const finish = (ownerId: string | null, extra: string[] = []) => ({ at, ownerId, ownerName: ownerId ? names.get(ownerId) ?? ownerId : null, ok: true, what: [...done, ...extra].join(" · ") || undefined });
  try {
    if (!opts.catchUp) await writesThisHour(1);
    // 1. the path's properties, as the workflow's "set property" actions and its classifier (#22) write them
    const props: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.sets)) if (k !== "hubspot_owner_id" && k !== "hs_pipeline_stage") props[k] = v;
    if (Object.keys(props).length) { await hs(`/crm/v3/objects/tickets/${row.ticketId}`, "PATCH", { properties: props }); done.push(Object.keys(props).join(", ")); }

    // 2. the code steps the hub took over
    if (r.path.includes("ANYSEALS")) {
      const a = await anysealsToFolder(call, hubspotToken() ?? "", row.ticketId).catch((e) => ({ ok: false, what: "Anyseals stock file: the copy broke off", error: (e as Error).message }));
      const err = "error" in a && a.error ? ` (${a.error})` : "";
      if (a.ok) {
        await hs(`/crm/v3/objects/tickets/${row.ticketId}`, "PATCH", { properties: { hs_pipeline_stage: STAGE.resolved } });
        await note(call, row.ticketId, `✅ ${a.what}\nResolved.\n\n---\nAPSOhub (Back Office distribution - Anyseals stock file)`);
        return finish(null, [a.what, "resolved"]);
      }
      // SARCLA 19.10.2026: a failed copy must not be silent (the workflow resolved the ticket whatever happened) - the
      // ticket stays open in New, says what to do, and "waiting for an owner" gives it to a person within 15 minutes
      console.warn(`[bo-distribution] Anyseals ticket ${row.ticketId}: ${a.what}${err}`);
      await note(call, row.ticketId, [
        "⚠️ ANYSEALS STOCK FILE NOT COPIED", "", `${a.what}${err}`, "",
        "The Anyseals stock sync keeps using the last good file until this one is in the folder.", "", "Action Required:",
        "- Download the CSV from this e-mail",
        "- Upload it on APSOPricingHub > Anyseals Stock (or into the HubSpot File Manager folder 397778236611)",
        "- Then close this ticket", "", "---", "APSOhub (Back Office distribution - Anyseals stock file)",
      ].join("\n"));
      return { ...finish(null, [a.what, "NOT resolved - left open for a person"]), ok: false, error: `Anyseals copy failed${err}` };
    }
    if (r.assigner === "75") {
      const s75 = await salesSplit(call, row.ticketId);
      if (s75.ok) await note(call, row.ticketId, `✅ ${s75.what}\n\n---\nAPSOhub (Back Office distribution - sales split)`);
      return finish(s75.ownerId ?? null, [s75.what]);
    }
    if (r.assigner === "50") {
      const o = oNumber(now.properties.subject);
      if (o) {
        const task = await gqsTaskFor(call, o, row.ticketId);
        if (task === undefined) return { ...finish(null, ["GQS task search failed - left for the next look"]), ok: false };
        if (task) { const m = await mergeIntoGqs(call, row.ticketId, o, task); return { ...finish(m.ownerId ?? null, [m.what]), ok: m.ok, error: m.error }; }
        await note(call, row.ticketId, noteNoMatch(o));
      } else await note(call, row.ticketId, NOTE_NO_O);
    }

    // 3. the owner and the stage
    const pick = r.sets.hubspot_owner_id ?? (r.assigner && ["23", "27", "31", "42", "50"].includes(r.assigner) ? row.hub?.ownerId ?? null : null);
    const owner = free ? pick : null;
    const stage = r.sets.hs_pipeline_stage ?? (pick ? (r.c2sStageAfter ? STAGE.cutToSizeIssue : STAGE.assigned) : null);
    const move: Record<string, string> = {};
    if (owner) move.hubspot_owner_id = owner;
    if (stage && (owner || !pick || !free)) move.hs_pipeline_stage = stage;
    if (Object.keys(move).length) await hs(`/crm/v3/objects/tickets/${row.ticketId}`, "PATCH", { properties: move });
    if (owner && row.associate) await hs(`/crm/v4/objects/tickets/${row.ticketId}/associations/default/companies/${row.associate}`, "PUT").catch(() => null);
    if (!free && pick) done.push(`kept ${names.get(cur) ?? cur} (already owned)`);
    if (!pick && r.assigner) done.push("nobody available - waits for an owner");
    const c = r.classified;
    if (settings.hub.note && (owner || c?.category)) await note(call, row.ticketId, [
      ...(owner ? [`✅ Auto-Assigned to ${names.get(owner) ?? owner}`, "", `Method: ${row.hub?.method ?? "fixed"}`, ...(row.hub?.reasons.length ? [`Why: ${row.hub.reasons.join("; ")}`] : [])] : []),
      ...(c?.category ? ["", `Category: ${c.category}${c.subCategory ? ` / ${c.subCategory}` : ""}${(c as { matched?: string[] }).matched?.length ? ` (keywords: ${(c as { matched?: string[] }).matched!.slice(0, 8).join(", ")})` : ""}`] : []),
      `Path: ${r.path.join(" > ")}`, "", "---", "APSOhub (Back Office distribution)",
    ].join("\n"));
    return finish(owner);
  } catch (e) {
    return { at, ownerId: null, ownerName: null, ok: false, error: (e as Error).message.slice(0, 200), what: done.join(" · ") || undefined };
  }
}

/* ── waiting for an owner ─────────────────────────────────────────────────── */
// SARCLA 19.10.2026: "the unassigned tickets should always be distributed, as well as Backoffice Team". The entry
// flow decides a ticket once, when it enters New - one that loses its owner later never comes back: when a person is
// deactivated, the inbox clears the owner on the customer's next reply (12 tickets of Leart's old account sat in
// "Customer/Internal replied" with nobody for weeks), and a re-entry can leave the Backoffice Team queue on it.
// Every 5 minutes the hub lists the open Back Office and GQS tickets with no owner, Backoffice Team or a deactivated
// owner - 15 minutes in their stage, so the entry flow and the workflow's safety net go first - and works out who
// gets each: the person who had it (or the same person's new account) when on the team's lists and available, else
// the distribution's own pick with the hub's rules. Nobody available: it waits and is looked at again 5 minutes
// later. ESO / TSA (SARCLA: "yes of course" they go to the company owner; "should also use the contact"): no owner or
// a deactivated one -> the company's owner, else the contact's owner; neither active = it waits until one has an
// owner (the Backoffice Team queue on a sales ticket is the wrong-owners check's: back to Back Office). Live
// (Settings, its own switch) writes the owner only - never the stage - and a note.

export type Stray = {
  ticketId: string; pipeline: "bo" | "gqs" | "eso" | "tsa"; subject: string; stage: string | null; stageLabel: string | null;
  /** in its stage since */
  since: string | null;
  why: "no owner" | "Backoffice Team" | "deactivated owner";
  /** the person who had it last (a deactivated account included) */
  was: string | null;
  hub: Answer | null;
  /** GQS: the linked ticket's contact / company to copy first (decide's row.inherit) */
  inherit?: Row["inherit"];
  wrote?: Row["wrote"];
  error?: string;
};
export type StrayState = { at: string; total: number; items: Stray[] };
const STRAYS_EVERY_MS = 5 * 60_000;
const STRAY_GRACE_MS = 15 * 60_000;
const STRAYS_PER_PASS = 25;
const STRAY_WRITES_PER_PASS = 10;
export const strayState = async () => (await kvGet<StrayState>(KV.strays)) ?? null;

type StrayPipe = Stray["pipeline"];
const STRAY_PIPE: Record<StrayPipe, string> = { bo: BO, gqs: GQS, eso: ESO, tsa: TSA };
async function strayCandidates(archived: Set<string>): Promise<{ id: string; pipeline: StrayPipe; p: Record<string, string | null> }[]> {
  const st = await pipelineStages();
  const props = ["subject", "hs_pipeline", "hs_pipeline_stage", "hubspot_owner_id", "hs_v2_date_entered_current_stage", "createdate"];
  const gone = [...archived].filter((x) => /^\d+$/.test(x));
  const out = new Map<string, { id: string; pipeline: StrayPipe; p: Record<string, string | null> }>();
  // ESO / TSA moved to the wrong-owner check the same evening (SARCLA: "should this not be handled via the wrong owner?")
  for (const [pid, kind, closed] of [[BO, "bo", st.boClosed], [GQS, "gqs", st.gqsClosed]] as const) {
    if (!closed.length) continue; // stages unread: better nothing than closed tickets
    const base = [{ propertyName: "hs_pipeline", operator: "EQ", value: pid }, { propertyName: "hs_pipeline_stage", operator: "NOT_IN", values: closed }];
    const owners: object[] = [
      { propertyName: "hubspot_owner_id", operator: "NOT_HAS_PROPERTY" },
      ...(kind === "bo" || kind === "gqs" ? [{ propertyName: "hubspot_owner_id", operator: "EQ", value: PEOPLE.backofficeTeam.id }] : []),
      ...Array.from({ length: Math.ceil(gone.length / 100) }, (_, i) => ({ propertyName: "hubspot_owner_id", operator: "IN", values: gone.slice(i * 100, i * 100 + 100) })),
    ];
    for (const f of owners) {
      let after: string | undefined;
      for (let page = 0; page < 3; page++) {
        const r = await hs<{ results?: { id: string; properties: Record<string, string | null> }[]; paging?: { next?: { after?: string } } }>("/crm/v3/objects/tickets/search", "POST", {
          filterGroups: [{ filters: [...base, f] }], properties: props, sorts: [{ propertyName: "createdate", direction: "ASCENDING" }], limit: 100, ...(after ? { after } : {}),
        });
        for (const t of r.results ?? []) out.set(t.id, { id: t.id, pipeline: kind, p: t.properties });
        after = r.paging?.next?.after;
        if (!after) break;
      }
    }
  }
  return [...out.values()].filter((c) => Date.now() - Date.parse(c.p.hs_v2_date_entered_current_stage ?? c.p.createdate ?? "") >= STRAY_GRACE_MS);
}

/** The person who had the ticket last (not the queue), and that person's active account: the same one, or - for a
 *  deactivated account - an active owner with exactly the same name (Leart Asllani's new account, 14.09.2026). */
async function lastRealOwner(id: string, shared: Shared, names: Map<string, string>): Promise<{ name: string | null; active: Person | null; moved: boolean }> {
  const t = await hs<TicketFull>(`/crm/v3/objects/tickets/${id}?properties=hubspot_owner_id&propertiesWithHistory=hubspot_owner_id`);
  const h = (t.propertiesWithHistory?.hubspot_owner_id ?? []).find((x) => x.value && x.value !== PEOPLE.backofficeTeam.id);
  if (!h) return { name: null, active: null, moved: false };
  const name = names.get(h.value) ?? h.value;
  if (!shared.archived!.has(h.value)) return { name, active: { id: h.value, name }, moved: false };
  const key = name.trim().toLowerCase();
  const twin = [...shared.avail!.all.keys()].find((oid) => oid !== h.value && !shared.archived!.has(oid) && (names.get(oid) ?? "").trim().toLowerCase() === key);
  return { name: `${name} (deactivated)`, active: twin ? { id: twin, name: names.get(twin) ?? name } : null, moved: !!twin };
}

/** ESO / TSA: the owner of the ticket's company, else of its contact - active people only. `company`: the first one's name. */
async function companyOwner(id: string, archived: Set<string>, names: Map<string, string>): Promise<{ owner: { id: string; name: string; method: string } | null; company: string | null }> {
  const t = await hs<TicketFull>(`/crm/v3/objects/tickets/${id}?properties=hs_pipeline&associations=companies,contacts`);
  const active = (o: string | null | undefined): o is string => !!o && /^\d+$/.test(o) && names.has(o) && !archived.has(o) && o !== PEOPLE.backofficeTeam.id;
  let company: string | null = null;
  for (const { id: cid } of (t.associations?.companies?.results ?? []).slice(0, 5)) {
    const c = await hs<{ properties: Record<string, string | null> }>(`/crm/v3/objects/companies/${cid}?properties=name,domain,hubspot_owner_id`);
    const p = c.properties;
    if (/apsoparts|angst/i.test(`${p.name ?? ""} ${p.domain ?? ""}`)) continue;
    company ??= p.name ?? cid;
    if (active(p.hubspot_owner_id)) return { owner: { id: p.hubspot_owner_id, name: names.get(p.hubspot_owner_id)!, method: `Company owner (${p.name ?? cid})` }, company };
  }
  for (const { id: kid } of (t.associations?.contacts?.results ?? []).slice(0, 3)) {
    const c = await hs<{ properties: Record<string, string | null> }>(`/crm/v3/objects/contacts/${kid}?properties=email,hubspot_owner_id`);
    if (/apsoparts|angst/i.test(c.properties.email ?? "")) continue;
    if (active(c.properties.hubspot_owner_id)) return { owner: { id: c.properties.hubspot_owner_id, name: names.get(c.properties.hubspot_owner_id)!, method: `Contact owner (${c.properties.email ?? kid})` }, company };
  }
  return { owner: null, company };
}

async function strays(shared: Shared, started: number, signal?: AbortSignal): Promise<void> {
  const prev = await kvGet<StrayState>(KV.strays);
  if (prev && Date.now() - Date.parse(prev.at) < STRAYS_EVERY_MS) return;
  shared.settings ??= await getSettings();
  const settings = shared.settings;
  shared.archived ??= await archivedOwners();
  shared.avail ??= await availability();
  const [found, names, st] = await Promise.all([strayCandidates(shared.archived), ownerNames(), pipelineStages()]);
  const avail = hubAvailability(shared.avail, settings.hub.availability);
  const items: Stray[] = [];
  let writes = 0;
  for (const c of found.slice(0, STRAYS_PER_PASS)) {
    if (signal?.aborted || Date.now() - started > 4 * 60_000) break;
    const owner = c.p.hubspot_owner_id ?? "";
    const item: Stray = {
      ticketId: c.id, pipeline: c.pipeline, subject: c.p.subject ?? "", stage: c.p.hs_pipeline_stage ?? null,
      stageLabel: ({ bo: st.bo, gqs: st.gqs, eso: st.eso, tsa: st.tsa }[c.pipeline]).find((x) => x.id === c.p.hs_pipeline_stage)?.label ?? null,
      since: c.p.hs_v2_date_entered_current_stage ?? c.p.createdate ?? null,
      why: !owner ? "no owner" : owner === PEOPLE.backofficeTeam.id ? "Backoffice Team" : "deactivated owner", was: null, hub: null,
    };
    try {
      if (c.pipeline === "eso" || c.pipeline === "tsa") {
        item.was = (await lastRealOwner(c.id, shared, names)).name;
        const { owner: pick, company } = await companyOwner(c.id, shared.archived, names);
        item.hub = pick ? { ownerId: pick.id, ownerName: pick.name, method: pick.method, reasons: [] }
          : { ownerId: null, ownerName: null, method: company ? `${company} and its contact have no owner - give the company one, the ticket follows` : "No company or contact owner - a person decides", reasons: [] };
        if (settings.live.strays && writes < STRAY_WRITES_PER_PASS) {
          item.wrote = await actStray(item, null, settings, shared.archived);
          if (item.wrote.ok) writes++;
        }
        items.push(item);
        continue;
      }
      const team = everyone(settings, c.pipeline === "bo" ? BO_KEYS : GQS_KEYS);
      const back = await lastRealOwner(c.id, shared, names);
      item.was = back.name;
      const onTeam = !!back.active && team.some((x) => x.id === back.active!.id);
      if (back.active && onTeam && avail.get(back.active.id) === "available") {
        item.hub = { ownerId: back.active.id, ownerName: back.active.name, method: "Back to the person who had it", reasons: back.moved ? [`${back.active.name}'s new account`] : [] };
      } else {
        const row = await decide(c.id, c.pipeline, new Date(Date.now() - 45_000).toISOString(), shared, { stray: true });
        item.inherit = row.inherit ?? null;
        const not = !back.name ? null : !back.active ? `${back.name}: no active account` : !onTeam ? `${back.active.name} is not on the team's lists` : `${back.active.name} is away`;
        item.hub = row.hub ? { ...row.hub, reasons: [...(not ? [not] : []), ...row.hub.reasons] } : null;
      }
      if (settings.live.strays && writes < STRAY_WRITES_PER_PASS) {
        item.wrote = await actStray(item, team, settings, shared.archived);
        if (item.wrote.ok) writes++;
      }
    } catch (e) { item.error = (e as Error).message.slice(0, 200); }
    items.push(item);
  }
  await kvSet(KV.strays, { at: new Date().toISOString(), total: found.length, items } satisfies StrayState);
}

/** Live: the owner only (the stage stays), after reading the ticket again - still nobody's, still where it was. */
/** team: Back Office / GQS - the pick must be on the lists; null for ESO / TSA (the company's owner). */
async function actStray(s: Stray, team: Person[] | null, settings: Settings, archived: Set<string>): Promise<NonNullable<Row["wrote"]>> {
  const at = new Date().toISOString();
  const skip = (why: string) => ({ at, ownerId: null, ownerName: null, ok: false, skipped: why });
  const owner = s.hub?.ownerId ?? null;
  if (!owner) return skip(team ? "nobody available - it waits" : "neither company nor contact has an owner - it waits for one");
  if (team && !team.some((x) => x.id === owner)) return skip("the pick is not on the team's lists");
  const breaker = settings.hub.breaker || LIVE_MAX_PER_HOUR;
  if ((await writesThisHour()) >= breaker) return skip(`breaker: ${breaker} writes this hour - look at the page before raising it`);
  const now = await hs<{ properties: Record<string, string | null> }>(`/crm/v3/objects/tickets/${s.ticketId}?properties=hubspot_owner_id,hs_pipeline,hs_pipeline_stage`);
  const cur = now.properties.hubspot_owner_id ?? "";
  if (cur && cur !== PEOPLE.backofficeTeam.id && !archived.has(cur)) return skip(`owned meanwhile (${(await ownerNames()).get(cur) ?? cur})`);
  if (now.properties.hs_pipeline !== STRAY_PIPE[s.pipeline] || now.properties.hs_pipeline_stage !== s.stage) return skip("moved on meanwhile");
  try {
    // a GQS task still in "New for Back-Office" (it waited for someone available): the whole GQS step, as live mode writes
    // it - contact / company from the linked ticket, the stage and the GQS status - since the workflow may be off
    const props: Record<string, string> = { hubspot_owner_id: owner };
    if (s.pipeline === "gqs" && s.stage === STAGE.gqsNewForBo) {
      for (const c of s.inherit?.contacts ?? []) await hs(`/crm/v4/objects/tickets/${s.ticketId}/associations/default/contacts/${c}`, "PUT").catch(() => null);
      for (const c of s.inherit?.companies ?? []) await hs(`/crm/v4/objects/tickets/${s.ticketId}/associations/default/companies/${c}`, "PUT").catch(() => null);
      props.hs_pipeline_stage = ASSIGNED_STAGE.gqs;
      const st = await hs<{ properties: Record<string, string | null> }>(`/crm/v3/objects/tickets/${s.ticketId}?properties=status_of_gqs`);
      if (st.properties.status_of_gqs !== "Automatically Approved") props.status_of_gqs = "Approved by Line Manager";
    }
    await hs(`/crm/v3/objects/tickets/${s.ticketId}`, "PATCH", { properties: props });
    await writesThisHour(1);
    const had = s.why === "no owner" ? "had no owner" : s.why === "Backoffice Team" ? "had only the Backoffice Team queue" : `had a deactivated owner (${s.was ?? "?"})`;
    const body = [
      `✅ Owner given: ${s.hub!.ownerName}`, "", `The ticket ${had}${s.since ? ` since ${s.since.slice(0, 10)}` : ""}.`, `Method: ${s.hub!.method}`,
      ...(s.hub!.reasons.length ? [`Why: ${s.hub!.reasons.join("; ")}`] : []),
      "", "---", "APSOhub (Back Office distribution - waiting for an owner)",
    ].join("<br>");
    if (settings.hub.note) await hs("/crm/v3/objects/notes", "POST", {
      properties: { hs_timestamp: at, hs_note_body: body },
      associations: [{ to: { id: s.ticketId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 228 }] }],
    }).catch(() => null);
    return { at, ownerId: owner, ownerName: s.hub!.ownerName, ok: true };
  } catch (e) {
    return { at, ownerId: owner, ownerName: s.hub!.ownerName, ok: false, error: (e as Error).message.slice(0, 200) };
  }
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
type StageList = { id: string; label: string }[];
let stagesCache: { at: number; data: { bo: StageList; gqs: StageList; eso: StageList; tsa: StageList; gqsClosed: string[]; boClosed: string[]; esoClosed: string[]; tsaClosed: string[] } } | null = null;
/** Back Office and GQS stages with their names - the Settings tab's workload pickers. */
export async function pipelineStages() {
  if (stagesCache && Date.now() - stagesCache.at < 60 * 60_000) return stagesCache.data;
  const r = await hs<{ results?: { id: string; stages?: { id: string; label: string; metadata?: { isClosed?: string } }[] }[] }>("/crm/v3/pipelines/tickets");
  const of = (id: string) => (r.results ?? []).find((x) => x.id === id)?.stages?.map((x) => ({ id: x.id, label: x.label })) ?? [];
  const closedOf = (id: string) => ((r.results ?? []).find((x) => x.id === id)?.stages ?? []).filter((x) => String(x.metadata?.isClosed) === "true").map((x) => x.id);
  stagesCache = { at: Date.now(), data: { bo: of(BO), gqs: of(GQS), eso: of("1726599376"), tsa: of("1726599377"), gqsClosed: closedOf(GQS), boClosed: closedOf(BO), esoClosed: closedOf(ESO), tsaClosed: closedOf(TSA) } };
  return stagesCache.data;
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
/** The page's "try it": a subject and a body through the workflow's classifier and through the improved one. */
export const tryClassifier = (subject: string, content: string): { v1: Classification; v2: ClassificationV2 } =>
  ({ v1: classifyTicket({ subject, content }), v2: classifyTicketV2({ subject, content }) });
export const classifierFixes = FIXES;

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

/** The e-mails of the last 7 days that NEITHER keyword classifier recognised, through the AI - newest days first. */
async function aiPass(rowsFor: (d: string) => Promise<Row[]>, started: number, signal?: AbortSignal): Promise<void> {
  const client = getAnthropic();
  if (!client) return;
  const k = `boDist:ai:${day(new Date().toISOString())}`;
  let used = (await kvGet<number>(k)) ?? 0;
  let n = 0;
  outer: for (let i = 0; i < 7; i++) {
    for (const r of await rowsFor(day(new Date(Date.now() - i * 86400_000).toISOString()))) {
      if (n >= AI_PER_RUN || used >= AI_PER_DAY || signal?.aborted || Date.now() - started > 6 * 60_000) break outer;
      if (r.pipeline !== "bo" || r.ai !== undefined || r.error || !r.route?.classified || r.route.classified.category || !r.v2 || r.v2.category) continue;
      n++; used++;
      try {
        const t = await hs<{ properties: Record<string, string | null> }>(`/crm/v3/objects/tickets/${r.ticketId}?properties=subject,content`);
        r.ai = await aiClassify(client, t.properties.subject, t.properties.content);
        delete r.aiError;
      } catch (e) {
        r.aiError = (e as Error).message.slice(0, 160);
        r.aiTries = (r.aiTries ?? 0) + 1;
        if (r.aiTries >= 2) r.ai = null; // asked twice: not again
        break outer; // an error is rarely alone - the next run tries again
      }
    }
  }
  await kvSet(k, used);
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
    // the workflow reads the ticket a minute after entry: so does the hub (the next run, 5-minute overlap, picks it up)
    if (Date.now() - Date.parse(e.enteredAt) < 50_000) continue;
    newest = Math.max(newest, Date.parse(e.enteredAt));
    if (rows.some((r) => r.key === key)) continue;
    try {
      const row = await decide(e.id, e.pipeline, e.enteredAt, shared);
      if (shared.settings!.live[row.pipeline]) row.wrote = await act(row, shared.settings!);
      rows.push(row);
      info.decided++;
    }
    catch (err) { rows.push({ key, ticketId: e.id, pipeline: e.pipeline, enteredAt: e.enteredAt, seenAt: new Date().toISOString(), subject: "", source: null, legacy: null, hub: null, error: (err as Error).message.slice(0, 200) }); }
  }
  // tickets waiting for an owner (no owner, Backoffice Team, a deactivated owner; ESO / TSA too): every 5 minutes
  if (!signal?.aborted) await strays(shared, started, signal).catch((e) => console.warn(`[bo-distribution] waiting for an owner: ${(e as Error).message}`));
  // AI for what both keyword classifiers leave as Others: a few a run, AI_PER_DAY a day (SARCLA: "spend as less as possible")
  if (!signal?.aborted && process.env.BO_AI !== "off") await aiPass(rowsFor, started, signal).catch((e) => console.warn(`[bo-distribution] ai: ${(e as Error).message}`));
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
  // rows decided before 19.10.2026 11:30 lack the C2S flag, the sender, the improved classifier's reasons and the priority
  // facts: fill them in once, 30 a run
  let enriched = 0;
  for (let i = 0; i < 7 && enriched < 30 && !signal?.aborted && Date.now() - started < 5 * 60_000; i++) {
    for (const r of await rowsFor(day(new Date(Date.now() - i * 86400_000).toISOString()))) {
      if (enriched >= 30 || signal?.aborted) break;
      if (r.e === 2 || r.error || r.pipeline !== "bo") continue;
      try { await enrich(r, shared); enriched++; } catch { /* next run */ }
    }
  }
  // GQS tasks move on for days: their stage, status and ESO ticket are read again every 6 hours for 14 days
  let gqsRead = 0;
  for (let i = 0; i < 14 && gqsRead < 20 && !signal?.aborted && Date.now() - started < 6 * 60_000; i++) {
    for (const r of await rowsFor(day(new Date(Date.now() - i * 86400_000).toISOString()))) {
      if (gqsRead >= 20) break;
      if (r.pipeline !== "gqs" || !r.actual || r.error || r.actual.gqs?.closed) continue;
      if (r.actual.gqs !== undefined && Date.now() - Date.parse(r.actual.at) < 6 * 3600_000) continue;
      try { r.actual = await outcome(r); gqsRead++; } catch { /* next run */ }
    }
  }
  // rows read before 19.10.2026 lack the distribution's own owner: read them once more, 40 a run
  let reread = 0;
  for (let i = 0; i < 7 && reread < 40 && !signal?.aborted && Date.now() - started < 6 * 60_000; i++) {
    for (const r of await rowsFor(day(new Date(Date.now() - i * 86400_000).toISOString()))) {
      if (reread >= 40 || signal?.aborted) break;
      if (!r.actual || r.actual.v === 2 || r.error) continue;
      try { r.actual = await outcome(r); reread++; } catch { /* next run */ }
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

/* ── catch-up after an outage ─────────────────────────────────────────────── */
// 22.10.2026: the HubSpot token was revoked at 06:47 UTC and the hub got the new one only at 12:18. Every run in
// between failed at its first search, and once the token worked every ticket of that window was older than the
// 20-minute rule: act() skipped them all and stored the skip, so nothing looked at them again. Back Office "New"
// filled up with tickets that had an owner (the stray sweep) but no category, no stage move and no code steps -
// and the stray sweep then used up the hourly breaker, so tickets arriving after it got an owner only, too.
// catchUp decides every ticket that entered its entry stage inside [from, to] again and writes it the normal way.
// Left out: the 20-minute rule and the hourly breaker (a bounded set an admin asked for; its writes are not counted,
// so live routing keeps its budget). Everything else stands: act()/actBo() read each ticket again first (still in
// its entry stage, else it is left alone - a ticket already routed is skipped; the owner only when it is nobody's,
// so a person who took a ticket keeps it), live mode and the workflow lock still decide.
// Admin only, under the distribution's own lock, in the background; the outcome is logged and kept in kv boDist:catchup.

export type CatchUp = { at: string; from: string; to: string; found: number; written: number; skipped: Record<string, number>; errors: number; done: boolean; seconds?: number; error?: string };
let catching = false;

export async function catchUp(from: number, to: number): Promise<CatchUp> {
  const out: CatchUp = { at: new Date().toISOString(), from: new Date(from).toISOString(), to: new Date(to).toISOString(), found: 0, written: 0, skipped: {}, errors: 0, done: false };
  if (catching) return { ...out, error: "a catch-up is already running on this copy of the hub" };
  catching = true;
  const started = Date.now();
  let client: PoolClient | null = null;
  let locked = false;
  try {
    client = await getPool().connect();
    // the minute run holds the lock for seconds at a time: wait for a gap, up to 90 s
    for (let i = 0; i < 30 && !locked; i++) {
      locked = !!(await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK])).rows[0]?.ok;
      if (!locked) await new Promise((res) => setTimeout(res, 3_000));
    }
    if (!locked) throw new Error("the distribution's lock stayed taken for 90 s - start it again");
    const settings = await getSettings();
    const shared: Shared = { settings };
    const found = (await entries(from)).filter((e) => Date.parse(e.enteredAt) <= to);
    out.found = found.length;
    await kvSet(KV.catchup, out);
    const touched = new Map<string, Row[]>();
    for (const e of found) {
      const d = day(e.enteredAt);
      const rows = touched.get(d) ?? (touched.set(d, await rowsOfDay(d)), touched.get(d)!);
      let row: Row;
      try {
        row = await decide(e.id, e.pipeline, e.enteredAt, shared);
        if (settings.live[row.pipeline]) row.wrote = await act(row, settings, { catchUp: true });
      } catch (err) {
        row = { key: `${e.id}:${e.enteredAt}`, ticketId: e.id, pipeline: e.pipeline, enteredAt: e.enteredAt, seenAt: new Date().toISOString(), subject: "", source: null, legacy: null, hub: null, error: (err as Error).message.slice(0, 200) };
      }
      const w = row.wrote;
      if (w?.ok) out.written++;
      else if (w?.skipped) out.skipped[w.skipped] = (out.skipped[w.skipped] ?? 0) + 1;
      else if (row.error || w?.error) out.errors++;
      const i = rows.findIndex((x) => x.key === row.key);
      if (i >= 0) rows[i] = row; else rows.push(row);
    }
    for (const [d, rows] of touched) await kvSet(KV.day(d), rows);
    out.done = true;
    out.seconds = Math.round((Date.now() - started) / 1000);
    await kvSet(KV.catchup, out);
    console.log(`[bo-distribution] catch-up ${out.from} - ${out.to}: ${out.found} found, ${out.written} written, ${out.errors} errors, skipped ${JSON.stringify(out.skipped)} (${out.seconds} s)`);
    return out;
  } catch (e) {
    out.error = (e as Error).message.slice(0, 300);
    await kvSet(KV.catchup, out).catch(() => {});
    console.warn(`[bo-distribution] catch-up failed: ${out.error}`);
    return out;
  } finally {
    if (locked) await client?.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    client?.release();
    catching = false;
  }
}
export const catchUpState = async () => (await kvGet<CatchUp>(KV.catchup)) ?? null;

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
