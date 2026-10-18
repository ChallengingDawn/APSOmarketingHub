// CONTACTS & COMPANIES ON A TICKET (SARCLA 18.10.2026: "this could be a new tab on ticket associations so
// then I can turn down the workflow"). Replaces the HubSpot workflow "SARCLA | TICKET ASSOCIATION FIX"
// (flow 4326365411): it started when a ticket entered one of 12 stages of Back Office, ESO, TSA, Special
// Prices Requests and Product Management, waited 5 minutes, and linked the contacts of the ticket's e-mails
// and every company of those contacts. Here: the same five pipelines, every ticket new to the hub or moved
// stage (a superset of the 12 stages), read 5 minutes after its change; existing contacts only, never one
// made; the contact's PRIMARY company. Runs inside the ticket associations' 3-minute scheduler and lock.
// Modes off / preview (default, writes nothing) / live.

import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { BO, ESO, TSA } from "@/lib/connectors/steps/ticketRules";
import { contactAddresses, contactCompanies } from "./contactRules";
import { nextSince } from "./rules";

export type ContactsMode = "off" | "preview" | "live";
export type ContactsRun = {
  at: string; seconds: number; mode: ContactsMode; read: number; processed: number;
  contacts: number; companies: number; notFound: number; error?: string;
};

/** The workflow's five pipelines. */
export const CONTACT_PIPELINES: Record<string, string> = { [BO]: "BO", [ESO]: "ESO", [TSA]: "TSA", "1553929403": "SPR", "1737150687": "PM" };
const KV = { since: "ticketAssoc:contacts:since", last: "ticketAssoc:contacts:last" };
/** The workflow waited 5 minutes: a ticket's e-mail is attached to it a moment after it is made. */
const LAG_MS = 5 * 60_000;
const OVERLAP_MS = 3 * 60_000;
const MAX_READ = 300;
const RETENTION_DAYS = 180;

type Obj = { id: string; properties?: Record<string, string | null> };
type Page = { results?: Obj[]; paging?: { next?: { after?: string } } };
type Assoc = { from: { id: string }; to?: { toObjectId: string | number }[] };

const q = async <T>(sql: string, params: unknown[] = []): Promise<T[]> => (await getPool().query(sql, params)).rows as T[];
const hs = <T>(path: string, method: "GET" | "POST" | "PUT" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body, useTicketsToken: true });

let tables: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  tables ??= (async () => {
    await q(`CREATE TABLE IF NOT EXISTS apsomh_ticket_contacts_seen (
      mode text NOT NULL, ticket_id text NOT NULL, stage text, ok boolean NOT NULL, at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (mode, ticket_id))`);
    await q(`CREATE TABLE IF NOT EXISTS apsomh_ticket_contacts_log (
      id bigserial PRIMARY KEY, mode text NOT NULL, at timestamptz NOT NULL DEFAULT now(), ticket_id text NOT NULL,
      pipeline text, subject text, why text, emails int NOT NULL DEFAULT 0, contacts text[], new_contacts int NOT NULL DEFAULT 0,
      companies text[], new_companies int NOT NULL DEFAULT 0, not_found text[], forwarded text[], ok boolean NOT NULL, error text)`);
    await q("CREATE INDEX IF NOT EXISTS apsomh_ticket_contacts_log_at ON apsomh_ticket_contacts_log (mode, at DESC)");
  })().catch((e) => { tables = null; throw e; });
  return tables;
}

async function assocRead(from: string, to: string, ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 100) {
    const j = await hs<{ results?: Assoc[] }>(`/crm/v4/associations/${from}/${to}/batch/read`, "POST", { inputs: ids.slice(i, i + 100).map((id) => ({ id })) });
    for (const r of j.results ?? []) out.set(String(r.from.id), (r.to ?? []).map((t) => String(t.toObjectId)));
  }
  return out;
}

async function batchRead(obj: string, ids: string[], properties: string[]): Promise<Map<string, Obj>> {
  const out = new Map<string, Obj>();
  for (let i = 0; i < ids.length; i += 100) {
    const j = await hs<{ results?: Obj[] }>(`/crm/v3/objects/${obj}/batch/read`, "POST", { properties, inputs: ids.slice(i, i + 100).map((id) => ({ id })) });
    for (const o of j.results ?? []) out.set(String(o.id), o);
  }
  return out;
}

/** Existing contacts by e-mail (first match wins on duplicates, as in the workflow). */
async function contactsByEmail(emails: string[]): Promise<Map<string, { id: string; primary: string | null }>> {
  const out = new Map<string, { id: string; primary: string | null }>();
  for (let i = 0; i < emails.length; i += 100) {
    let after: string | undefined;
    do {
      const j = await hs<Page>("/crm/v3/objects/contacts/search", "POST", {
        filterGroups: [{ filters: [{ propertyName: "email", operator: "IN", values: emails.slice(i, i + 100) }] }],
        sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
        properties: ["email", "associatedcompanyid"], limit: 100, ...(after ? { after } : {}),
      });
      for (const c of j.results ?? []) {
        const e = (c.properties?.email ?? "").toLowerCase();
        if (e && !out.has(e)) out.set(e, { id: String(c.id), primary: c.properties?.associatedcompanyid || null });
      }
      after = j.paging?.next?.after;
    } while (after);
  }
  return out;
}

export type ContactPlan = {
  tid: string; pipeline: string | null; subject: string | null; emails: number;
  contacts: { email: string; id: string; isNew: boolean }[]; companies: { id: string; name: string | null; isNew: boolean }[];
  notFound: string[]; forwarded: string[]; error?: string;
};

/**
 * What to link on these tickets, and (live) link it: the e-mails' addresses -> existing contacts -> their
 * company; only what the ticket does not carry yet is written.
 */
async function processTickets(tickets: Obj[], live: boolean): Promise<ContactPlan[]> {
  const ids = tickets.map((t) => t.id);
  const mailIds = await assocRead("tickets", "emails", ids);
  const allMail = [...new Set([...mailIds.values()].flatMap((v) => v.slice(0, 20)))];
  const mails = await batchRead("emails", allMail, ["hs_email_from_email", "hs_email_to_email", "hs_email_cc_email", "hs_email_bcc_email", "hs_email_text"]);
  const addr = new Map<string, ReturnType<typeof contactAddresses>>();
  for (const t of tickets) {
    addr.set(t.id, contactAddresses((mailIds.get(t.id) ?? []).slice(0, 20).map((m) => mails.get(m)?.properties ?? {}).map((p) => ({
      from: p.hs_email_from_email, to: p.hs_email_to_email, cc: p.hs_email_cc_email, bcc: p.hs_email_bcc_email, text: (p.hs_email_text ?? "").slice(0, 20_000),
    }))));
  }
  const found = await contactsByEmail([...new Set([...addr.values()].flatMap((a) => a.external))]);
  const contactIds = [...new Set([...found.values()].map((c) => c.id))];
  const noPrimary = [...new Set([...found.values()].filter((c) => !c.primary).map((c) => c.id))];
  const contactCos = noPrimary.length ? await assocRead("contacts", "companies", noPrimary) : new Map<string, string[]>();
  const haveContacts = contactIds.length ? await assocRead("tickets", "contacts", ids) : new Map<string, string[]>();
  const haveCos = contactIds.length ? await assocRead("tickets", "companies", ids) : new Map<string, string[]>();

  const plans: ContactPlan[] = [];
  for (const t of tickets) {
    const a = addr.get(t.id)!;
    const cs = a.external.filter((e) => found.has(e)).map((e) => ({ email: e, id: found.get(e)!.id }));
    const uniq = [...new Map(cs.map((c) => [c.id, c])).values()];
    const hc = new Set(haveContacts.get(t.id) ?? []);
    const cos = [...new Set(uniq.flatMap((c) => contactCompanies(found.get(c.email)!.primary, contactCos.get(c.id) ?? [])))];
    const hco = new Set(haveCos.get(t.id) ?? []);
    plans.push({
      tid: t.id, pipeline: CONTACT_PIPELINES[t.properties?.hs_pipeline ?? ""] ?? null, subject: t.properties?.subject ?? null,
      emails: (mailIds.get(t.id) ?? []).length,
      contacts: uniq.map((c) => ({ ...c, isNew: !hc.has(c.id) })),
      companies: cos.map((id) => ({ id, name: null, isNew: !hco.has(id) })),
      notFound: a.external.filter((e) => !found.has(e)).slice(0, 12), forwarded: a.forwarded.slice(0, 12),
    });
  }
  // company names, for the page
  const coNames = await batchRead("companies", [...new Set(plans.flatMap((p) => p.companies.map((c) => c.id)))], ["name"]);
  for (const p of plans) for (const c of p.companies) c.name = coNames.get(c.id)?.properties?.name ?? null;

  if (live) {
    const pairs = (to: "contacts" | "companies") => plans.flatMap((p) => p[to].filter((x) => x.isNew).map((x) => ({ from: { id: p.tid }, to: { id: x.id } })));
    for (const to of ["contacts", "companies"] as const) {
      const inputs = pairs(to);
      for (let i = 0; i < inputs.length; i += 100) {
        try {
          await hs(`/crm/v4/associations/tickets/${to}/batch/associate/default`, "POST", { inputs: inputs.slice(i, i + 100) });
        } catch (e) {
          const failed = new Set(inputs.slice(i, i + 100).map((x) => x.from.id));
          for (const p of plans) if (failed.has(p.tid)) p.error = `${to}: ${(e as Error).message.slice(0, 160)}`;
        }
      }
    }
  }
  return plans;
}

/** One pass: tickets of the five pipelines changed between the last look and 5 minutes ago. */
export async function runContacts(mode: ContactsMode, signal?: AbortSignal): Promise<ContactsRun> {
  await ensureTables();
  const t0 = Date.now();
  const m = mode === "live" ? "live" : "preview";
  const out: ContactsRun = { at: new Date().toISOString(), seconds: 0, mode, read: 0, processed: 0, contacts: 0, companies: 0, notFound: 0 };
  const stored = (await kvGet<number>(KV.since)) ?? null;
  // the first look after a start, or a long stop: the last half hour
  let since = stored && t0 - stored < 24 * 3_600_000 ? stored : t0 - 30 * 60_000;
  const until = t0 - LAG_MS;
  const changes: number[] = [];
  try {
    let after: string | undefined;
    while (out.read < MAX_READ && since < until) {
      if (signal?.aborted) throw new Error("stopped by the time limit");
      const page = await hs<Page>("/crm/v3/objects/tickets/search", "POST", {
        filterGroups: [{ filters: [
          { propertyName: "hs_pipeline", operator: "IN", values: Object.keys(CONTACT_PIPELINES) },
          { propertyName: "hs_lastmodifieddate", operator: "GTE", value: String(since - OVERLAP_MS) },
          { propertyName: "hs_lastmodifieddate", operator: "LTE", value: String(until) },
        ] }],
        sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }],
        properties: ["subject", "hs_pipeline", "hs_pipeline_stage", "hs_lastmodifieddate"], limit: 100, ...(after ? { after } : {}),
      });
      const res = page.results ?? [];
      if (!res.length) break;
      out.read += res.length;
      for (const t of res) changes.push(Date.parse(t.properties?.hs_lastmodifieddate ?? ""));
      // new to the hub, moved stage, or failed last time - as the workflow's enrolment and re-enrolment
      const seen = new Map((await q<{ ticket_id: string; stage: string | null; ok: boolean }>(
        "SELECT ticket_id, stage, ok FROM apsomh_ticket_contacts_seen WHERE mode=$1 AND ticket_id = ANY($2)", [m, res.map((t) => t.id)])).map((r) => [r.ticket_id, r]));
      const todo = res.filter((t) => { const s = seen.get(t.id); return !s || !s.ok || s.stage !== (t.properties?.hs_pipeline_stage ?? null); });
      if (todo.length) {
        const plans = await processTickets(todo, mode === "live");
        for (const p of plans) {
          const t = todo.find((x) => x.id === p.tid)!;
          const s = seen.get(p.tid);
          const why = !s ? "new" : !s.ok ? "retry" : "stage";
          const ok = !p.error;
          await q(`INSERT INTO apsomh_ticket_contacts_log (mode, ticket_id, pipeline, subject, why, emails, contacts, new_contacts, companies, new_companies, not_found, forwarded, ok, error)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [m, p.tid, p.pipeline, (p.subject ?? "").slice(0, 120) || null, why, p.emails,
              p.contacts.map((c) => c.email), p.contacts.filter((c) => c.isNew).length,
              p.companies.map((c) => c.name ?? c.id), p.companies.filter((c) => c.isNew).length, p.notFound, p.forwarded, ok, p.error ?? null]);
          await q(`INSERT INTO apsomh_ticket_contacts_seen (mode, ticket_id, stage, ok, at) VALUES ($1,$2,$3,$4,now())
                   ON CONFLICT (mode, ticket_id) DO UPDATE SET stage=EXCLUDED.stage, ok=EXCLUDED.ok, at=now()`,
            [m, p.tid, t.properties?.hs_pipeline_stage ?? null, ok]);
          out.processed += 1;
          out.contacts += p.contacts.filter((c) => c.isNew).length;
          out.companies += p.companies.filter((c) => c.isNew).length;
          out.notFound += p.notFound.length;
        }
      }
      after = page.paging?.next?.after;
      if (!after) break;
    }
    since = Math.min(nextSince(since, changes), until);
    await kvSet(KV.since, since);
    if (Math.random() < 0.02) await q(`DELETE FROM apsomh_ticket_contacts_log WHERE at < now() - interval '${RETENTION_DAYS} days'`);
  } catch (e) {
    out.error = (e as Error).message.slice(0, 300);
  }
  out.seconds = Math.round((Date.now() - t0) / 1000);
  await kvSet(KV.last, out);
  if (out.error || out.processed) console.log(`[ticket-assoc] contacts (${mode}): ${out.read} read, ${out.processed} processed, ${out.contacts} contact and ${out.companies} company links${mode === "live" ? "" : " to write"}, ${out.notFound} addresses not in HubSpot${out.error ? ` - ${out.error}` : ""}`);
  return out;
}

/** "Check a ticket": what it would link, read only. */
export async function planContacts(tid: string): Promise<ContactPlan | null> {
  const t = await hs<Obj>(`/crm/v3/objects/tickets/${tid}?properties=subject,hs_pipeline,hs_pipeline_stage`);
  if (!CONTACT_PIPELINES[t.properties?.hs_pipeline ?? ""]) return null;
  return (await processTickets([t], false))[0] ?? null;
}

export async function lastContactsRun(): Promise<ContactsRun | null> {
  return (await kvGet<ContactsRun>(KV.last)) ?? null;
}

export type ContactRow = {
  ticket_id: string; at: string; pipeline: string | null; subject: string | null; contacts: string[]; companies: string[];
  not_found: string[]; forwarded: string[]; new_contacts: number; new_companies: number; ok: boolean; error: string | null;
};
export type ContactTotals = { tickets: number; with_contact: number; new_contacts: number; new_companies: number; not_found_tickets: number; forwarded_tickets: number };

/** The tab: one row per ticket (its latest processing, the links all of them wrote), and the period's totals. */
export async function contactReport(mode: "preview" | "live", from: string, to: string, pipeline: string | null): Promise<{ rows: ContactRow[]; totals: ContactTotals }> {
  await ensureTables();
  const args = [mode, from, to, pipeline];
  const where = "mode=$1 AND at >= $2::date AND at < ($3::date + 1) AND ($4::text IS NULL OR pipeline = $4)";
  const [rows, totals] = await Promise.all([
    q<ContactRow>(
      `WITH p AS (SELECT * FROM apsomh_ticket_contacts_log WHERE ${where}),
            s AS (SELECT ticket_id, coalesce(sum(new_contacts), 0)::int AS new_contacts, coalesce(sum(new_companies), 0)::int AS new_companies FROM p GROUP BY ticket_id),
            l AS (SELECT DISTINCT ON (ticket_id) * FROM p ORDER BY ticket_id, at DESC)
       SELECT l.ticket_id, l.at, l.pipeline, l.subject, coalesce(l.contacts, '{}') AS contacts, coalesce(l.companies, '{}') AS companies,
              coalesce(l.not_found, '{}') AS not_found, coalesce(l.forwarded, '{}') AS forwarded, s.new_contacts, s.new_companies, l.ok, l.error
         FROM l JOIN s USING (ticket_id)
        WHERE cardinality(l.contacts) > 0 OR cardinality(l.not_found) > 0 OR NOT l.ok
        ORDER BY l.at DESC LIMIT 200`, args),
    q<ContactTotals>(
      `SELECT count(DISTINCT ticket_id)::int AS tickets,
              count(DISTINCT ticket_id) FILTER (WHERE cardinality(contacts) > 0)::int AS with_contact,
              coalesce(sum(new_contacts), 0)::int AS new_contacts, coalesce(sum(new_companies), 0)::int AS new_companies,
              count(DISTINCT ticket_id) FILTER (WHERE cardinality(not_found) > 0)::int AS not_found_tickets,
              count(DISTINCT ticket_id) FILTER (WHERE cardinality(forwarded) > 0)::int AS forwarded_tickets
         FROM apsomh_ticket_contacts_log WHERE ${where}`, args),
  ]);
  return { rows, totals: totals[0] };
}
