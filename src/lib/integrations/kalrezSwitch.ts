// KALREZ 6221/6230 -> EVOLAST - the HubSpot side of the one-shot action (see src/lib/oneshot/kalrez.ts).
//
// Reads: the action's tickets (by kalrez_switch_key), the 109 companies' last contact and last
// logged call, and the customers' orders since the start - their Kalrez 6221/6230 and evolast
// PB794/PN794 lines. Writes (admins only, from the page): the action's ticket properties once, then
// one ticket per customer with its company, up to 5 contacts and up to 10 Kalrez orders.
//
// Creating is idempotent: under an advisory lock, a customer is skipped when HubSpot already has a
// ticket with its key OR the hub's done-list (kv) holds one - read inside the lock, written after
// every ticket - so a second click, two tabs or a restart mid-run never make a second ticket.
// "ESO CREATION TICKETS 1.0" has renamed a fresh ESO ticket's subject before (September push,
// 13.09.2026), so the subjects are checked again 45 s and 3 min after a run and put back.

import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotFetchJson } from "./hubspot";
import { IntegrationError } from "./status";
import {
  KZ, KZ_PROPERTIES, KZ_PROPERTY_GROUP, kzKey, kzLinesOf, kzSubject, kzTicketProperties,
  type KzCard, type KzData, type KzLine, type KzTarget, type KzTicket,
} from "../oneshot/kalrez";
import { KZ_ARTICLES, KZ_TARGETS } from "../oneshot/kalrezData";

const LOCK = 4_107_311;
const KV_DONE = "oneshot:kalrez:created";
const KV_LAST_RUN = "oneshot:kalrez:lastRun";
const TTL_MS = 5 * 60_000;
const MAX_PAGES = 100;
const OWN_DOMAINS = /@(angst-pfister\.com|apsoparts\.com)$/i;

type Row = { id: string; properties: Record<string, string | null> };
const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : "") || null;
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const utcMs = (iso: string) => String(Date.parse(`${iso}T00:00:00Z`));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function searchAll(path: string, filters: object[], properties: string[], limit = 100): Promise<Row[]> {
  const out: Row[] = [];
  let cursor = "0";
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await hubspotFetchJson<{ results?: { id: string; properties?: Record<string, string | null> }[] }>({
      path, method: "POST", useTicketsToken: true,
      body: {
        filterGroups: [{ filters: [...filters, { propertyName: "hs_object_id", operator: "GT", value: cursor }] }],
        sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], properties, limit,
      },
    });
    const rows = res.results ?? [];
    for (const r of rows) out.push({ id: r.id, properties: r.properties ?? {} });
    if (rows.length < limit) return out;
    cursor = rows[rows.length - 1].id;
  }
  throw new IntegrationError(`HubSpot search ${path} did not finish in ${MAX_PAGES} pages - refusing a partial read.`);
}

/** The action's key property exists once the first run made it; before that a search on it is a 400. */
async function keyPropertyExists(): Promise<boolean> {
  try {
    await hubspotFetchJson({ path: `/crm/v3/properties/tickets/${KZ.prefix}_key`, useTicketsToken: true });
    return true;
  } catch (e) {
    if (e instanceof IntegrationError && e.status === 404) return false;
    throw e;
  }
}

/** Ticket stage id -> label and whether it is a closed stage. */
async function stages() {
  const res = await hubspotFetchJson<{ results?: { stages?: { id: string; label?: string; metadata?: { ticketState?: unknown } }[] }[] }>({
    path: "/crm/v3/pipelines/tickets", useTicketsToken: true,
  });
  const out = new Map<string, { label: string; closed: boolean }>();
  for (const p of res.results ?? []) {
    for (const s of p.stages ?? []) out.set(s.id, { label: s.label ?? s.id, closed: String(s.metadata?.ticketState ?? "").toUpperCase() === "CLOSED" });
  }
  return out;
}

/** The action's tickets in HubSpot, by customer number. */
async function actionTickets(): Promise<Map<string, KzTicket>> {
  const out = new Map<string, KzTicket>();
  if (!(await keyPropertyExists())) return out;
  const st = await stages();
  const rows = await searchAll("/crm/v3/objects/tickets/search", [{ propertyName: `${KZ.prefix}_key`, operator: "HAS_PROPERTY" }], [
    "subject", "hs_pipeline_stage", "closed_date", "ticket_resolution_eso", "hs_last_activity_date", "hs_num_times_contacted", `${KZ.prefix}_key`,
  ]);
  for (const r of rows) {
    const p = r.properties;
    const un = (p[`${KZ.prefix}_key`] ?? "").split("|")[0];
    if (!un) continue;
    const s = st.get(p.hs_pipeline_stage ?? "");
    out.set(un, {
      id: r.id, subject: p.subject ?? "", stage: s?.label ?? p.hs_pipeline_stage ?? "",
      closed: (s?.closed ?? false) || !!p.closed_date, resolution: p.ticket_resolution_eso ?? null,
      lastActivity: day(p.hs_last_activity_date), contacted: Math.trunc(num(p.hs_num_times_contacted)),
    });
  }
  return out;
}

/* ── the board ─────────────────────────────────────────────────────────── */

async function load(): Promise<KzData> {
  const tickets = await actionTickets();

  // the companies: last call / e-mail / meeting, and last logged call
  const signals = new Map<string, { lastContacted: string | null; lastCall: string | null }>();
  let contactSignal = true;
  try {
    const ids = KZ_TARGETS.map((t) => t.companyId);
    for (let i = 0; i < ids.length; i += 100) {
      const r = await hubspotFetchJson<{ results?: Row[] }>({
        path: "/crm/v3/objects/companies/batch/read", method: "POST", useTicketsToken: true,
        body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: ["notes_last_contacted", "hs_last_logged_call_date"] },
      });
      for (const row of r.results ?? []) {
        signals.set(row.id, { lastContacted: day(row.properties?.notes_last_contacted), lastCall: day(row.properties?.hs_last_logged_call_date) });
      }
    }
  } catch (e) {
    contactSignal = false;
    console.warn(`[oneshot] kalrez: company contact dates unavailable: ${(e as Error).message}`);
  }

  // their orders since the start - only the Kalrez 6221/6230 and evolast PB794/PN794 lines matter,
  // one search per mandant (customer numbers are per mandant)
  const byUn = new Map<string, KzLine[]>();
  const target = new Map(KZ_TARGETS.map((t) => [t.un, t]));
  const mandants = new Map<string, string[]>();
  for (const t of KZ_TARGETS) {
    const [m, n] = t.un.split("-");
    if (m && n) mandants.set(m, [...(mandants.get(m) ?? []), n]);
  }
  for (const [mandant, numbers] of mandants) {
    for (let i = 0; i < numbers.length; i += 90) {
      const rows = await searchAll("/crm/v3/objects/orders/search", [
        { propertyName: "order_mandant", operator: "EQ", value: mandant },
        { propertyName: "order_customer_number", operator: "IN", values: numbers.slice(i, i + 90) },
        { propertyName: "order_order_date", operator: "GTE", value: utcMs(KZ.start) },
      ], ["order_order_number", "order_order_date", "order_mandant", "order_customer_number", "order_positions_json", "hs_currency_code"], 200);
      for (const r of rows) {
        const p = r.properties;
        const un = `${p.order_mandant}-${p.order_customer_number}`;
        const t = target.get(un);
        if (!t) continue;
        const lines = kzLinesOf({ no: p.order_order_number ?? "", date: day(p.order_order_date) ?? "", currency: p.hs_currency_code, positionsJson: p.order_positions_json }, KZ_ARTICLES, t.cur);
        if (lines.length) byUn.set(un, [...(byUn.get(un) ?? []), ...lines]);
      }
    }
  }

  const cards: KzCard[] = KZ_TARGETS.map((t) => {
    const sig = signals.get(t.companyId);
    return {
      ...t, ticket: tickets.get(t.un) ?? null, lastContacted: sig?.lastContacted ?? null, lastCall: sig?.lastCall ?? null,
      lines: (byUn.get(t.un) ?? []).sort((a, b) => b.date.localeCompare(a.date)),
    };
  });
  return { today: new Date().toISOString().slice(0, 10), generated: new Date().toISOString(), ticketsFound: tickets.size, contactSignal, cards };
}

let cache: { at: number; p: Promise<KzData> } | null = null;
export function kalrezData(opts: { refresh?: boolean } = {}): Promise<KzData> {
  if (cache && !opts.refresh && Date.now() - cache.at < TTL_MS) return cache.p;
  const p = load();
  cache = { at: Date.now(), p };
  p.catch(() => { if (cache?.p === p) cache = null; });
  return p;
}

/* ── the tickets ───────────────────────────────────────────────────────── */

export type KzPlanRow = {
  un: string; name: string; subject: string; owner: string; team: string; value: number; cur: string; orders: number; ticketId: string | null;
};
export type KzRun = {
  at: string; by: string; mode: "dry" | "apply"; created: number; skipped: number; failed: { un: string; error: string }[];
  propertiesCreated: string[]; warnings: string[];
};

type Done = Record<string, string>; // key -> ticket id

/** What a run would do: every customer, its title and owner, and its ticket when it already has one. */
export async function kalrezPlan(): Promise<{ rows: KzPlanRow[]; lastRun: KzRun | null }> {
  const [tickets, done, lastRun] = await Promise.all([actionTickets(), kvGet<Done>(KV_DONE), kvGet<KzRun>(KV_LAST_RUN)]);
  const rows = KZ_TARGETS.map((t) => ({
    un: t.un, name: t.name, subject: kzSubject(t), owner: t.ownerId ? t.ownerName : "Unassigned (TSA Team = helpline inbox)",
    team: t.team, value: t.value, cur: t.cur, orders: t.orderIds.length, ticketId: tickets.get(t.un)?.id ?? done?.[kzKey(t)] ?? null,
  }));
  return { rows, lastRun: lastRun ?? null };
}

/** The property group and the seven properties - only what is missing is made (the hub's own token, as ticketDuplicates). */
async function ensureProperties(): Promise<string[]> {
  const r = await hubspotFetchJson<{ results?: { name: string }[] }>({ path: "/crm/v3/properties/tickets" });
  const have = new Set((r.results ?? []).map((x) => x.name));
  const missing = KZ_PROPERTIES.filter((p) => !have.has(p.name));
  if (!missing.length) return [];
  const made: string[] = [];
  try {
    await hubspotFetchJson({ path: "/crm/v3/properties/tickets/groups", method: "POST", body: { ...KZ_PROPERTY_GROUP, displayOrder: -1 } });
    made.push(`group ${KZ_PROPERTY_GROUP.name}`);
  } catch (e) {
    if (!(e instanceof IntegrationError && e.status === 409)) throw e; // already there
  }
  for (const p of missing) {
    await hubspotFetchJson({
      path: "/crm/v3/properties/tickets", method: "POST",
      body: { ...p, groupName: KZ_PROPERTY_GROUP.name, description: "APSOhub: Kalrez 6221/6230 discontinued - one-shot call action, 11.2026." },
    });
    made.push(p.name);
  }
  return made;
}

/** Up to 5 people of the company to link - never our own colleagues. */
async function contactsOf(companyId: string): Promise<string[]> {
  const a = await hubspotFetchJson<{ results?: { toObjectId: number | string }[] }>({
    path: `/crm/v4/objects/companies/${companyId}/associations/contacts?limit=100`, useTicketsToken: true,
  });
  const ids = (a.results ?? []).map((r) => String(r.toObjectId)).slice(0, 50);
  if (!ids.length) return [];
  const r = await hubspotFetchJson<{ results?: Row[] }>({
    path: "/crm/v3/objects/contacts/batch/read", method: "POST", useTicketsToken: true,
    body: { inputs: ids.map((id) => ({ id })), properties: ["email", "lastmodifieddate"] },
  });
  return (r.results ?? [])
    .filter((c) => !OWN_DOMAINS.test(c.properties?.email ?? ""))
    .sort((x, y) => String(y.properties?.lastmodifieddate ?? "").localeCompare(String(x.properties?.lastmodifieddate ?? "")))
    .slice(0, 5).map((c) => c.id);
}

/** The ticket first, then its links one by one (as erosionWriter): a link that fails never costs the ticket. */
async function createOne(t: KzTarget, warn: (w: string) => void): Promise<string> {
  const res = await hubspotFetchJson<{ id: string }>({
    path: "/crm/v3/objects/tickets", method: "POST", useTicketsToken: true, body: { properties: kzTicketProperties(t) },
  });
  const tid = res.id;
  const link = async (what: string, path: string) => {
    try {
      await hubspotFetchJson({ path: `/crm/v4/objects/tickets/${tid}/associations/default/${path}`, method: "PUT", useTicketsToken: true });
    } catch (e) {
      warn(`${t.un} ${what}: ${String((e as Error).message).slice(0, 160)}`);
    }
  };
  await link("company", `companies/${t.companyId}`);
  for (const cid of t.alsoCompanyIds ?? []) await link(`company ${cid}`, `companies/${cid}`);
  for (const oid of t.orderIds.slice(0, 10)) await link(`order ${oid}`, `orders/${oid}`);
  const contacts = await contactsOf(t.companyId).catch((e) => { warn(`${t.un} contacts: ${(e as Error).message}`); return [] as string[]; });
  for (const cid of contacts) await link(`contact ${cid}`, `contacts/${cid}`);
  return tid;
}

/** Put a renamed subject back (a workflow has renamed fresh ESO tickets before). */
async function guardSubjects(ids: Map<string, KzTarget>) {
  if (!ids.size) return;
  const r = await hubspotFetchJson<{ results?: Row[] }>({
    path: "/crm/v3/objects/tickets/batch/read", method: "POST", useTicketsToken: true,
    body: { inputs: [...ids.keys()].map((id) => ({ id })), properties: ["subject"] },
  });
  for (const row of r.results ?? []) {
    const t = ids.get(row.id);
    if (!t) continue;
    const want = kzSubject(t);
    if ((row.properties?.subject ?? "") !== want) {
      await hubspotFetchJson({ path: `/crm/v3/objects/tickets/${row.id}`, method: "PATCH", useTicketsToken: true, body: { properties: { subject: want } } })
        .then(() => console.log(`[oneshot] kalrez: subject of ticket ${row.id} put back`))
        .catch((e) => console.warn(`[oneshot] kalrez: could not put back the subject of ${row.id}: ${(e as Error).message}`));
    }
  }
}

/** Create the missing tickets. null = another run holds the lock. */
export async function kalrezCreate(mode: "dry" | "apply", by: string): Promise<KzRun | null> {
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      const run: KzRun = { at: new Date().toISOString(), by, mode, created: 0, skipped: 0, failed: [], propertiesCreated: [], warnings: [] };
      if (mode === "apply") run.propertiesCreated = await ensureProperties();
      // read inside the lock: HubSpot's tickets AND the hub's own list
      const existing = await actionTickets();
      const done: Done = (await kvGet<Done>(KV_DONE)) ?? {};
      const made = new Map<string, KzTarget>();
      for (const t of KZ_TARGETS) {
        const key = kzKey(t);
        if (existing.has(t.un) || done[key]) { run.skipped += 1; continue; }
        if (mode === "dry") { run.created += 1; continue; }
        try {
          const id = await createOne(t, (w) => run.warnings.push(w));
          done[key] = id;
          await kvSet(KV_DONE, done);
          made.set(id, t);
          run.created += 1;
          await sleep(250);
        } catch (e) {
          run.failed.push({ un: t.un, error: String((e as Error).message ?? e).slice(0, 300) });
        }
      }
      if (mode === "apply") {
        await kvSet(KV_LAST_RUN, run);
        cache = null;
        // the subject guard runs after the answer, twice
        if (made.size) {
          setTimeout(() => { void guardSubjects(made).catch(() => {}); }, 45_000);
          setTimeout(() => { void guardSubjects(made).catch(() => {}); }, 180_000);
        }
      }
      return run;
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}
