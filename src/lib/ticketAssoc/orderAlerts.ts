// ORDER ALERTS (SARCLA, 17.10.2026): an open ESO / TSA ticket names an article, and the customer
// then orders that article - the order is linked to the ticket and the ticket's owner gets a mail
// "please check your ticket" with a Review button. Order-driven, so it answers when the order is
// there, not when the ticket next changes: every 15 minutes the hub reads the orders that got their
// A-number (or changed) since its last look - the ERP's from the chain, the shop's from the Magento
// sync and magento_link - takes its articles (the ERP's order lines, or the Products & Pricing records
// a web order is linked to), finds its company and that company's tickets, and keeps the open
// ESO / TSA tickets opened on or before the order's day that name one of its articles - for orders
// placed in the last 14 days (rules.ts alertArticles). One alert per ticket and order, ever.
//
// Modes (in Ticket associations' settings): off; preview - lists what it would do, links and mails
// nothing; link - links the order to the ticket; mail - links and mails the owner. Switching to mail
// never mails what preview already listed: only what is found from then on.

import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { ASSOC_PIPELINES, ESO, PP_OBJ, TSA, articleCandidates, positionArticles, ticketBlob } from "@/lib/connectors/steps/ticketRules";
import { hubPublicUrl } from "@/lib/content/shareMail";
import { mailConfigured, sendHubMail } from "@/lib/notify/mailer";
import { renderOrderAlert } from "./mail";
import { alertArticles, msOf, nextSince } from "./rules";

export type AlertMode = "off" | "preview" | "link" | "mail";
export type AlertRun = { at: string; seconds: number; mode: AlertMode; read: number; withArticles: number; matched: number; created: number; linked: number; mailed: number; error?: string };

const PORTAL = "26492587";
const ticketUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-5/${id}`;
const KV = { since: "ticketAssoc:orders:since", last: "ticketAssoc:orders:last" };
const MAX_READ = 300;
const OVERLAP_MS = 5 * 60_000;
const TPROPS = ["subject", "content", "order_number", "order_id", "article", "article_number", "articles_on_the_ticket", "hs_pipeline", "hs_pipeline_stage", "createdate", "hubspot_owner_id"];

type Obj = { id: string; properties?: Record<string, string | null> };
type Assoc = { from: { id: string }; to?: { toObjectId: string | number }[] };

const q = async <T>(sql: string, params: unknown[] = []): Promise<T[]> => (await getPool().query(sql, params)).rows as T[];
const hs = <T>(path: string, method: "GET" | "POST" | "PUT" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body, useTicketsToken: true });

let table: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  table ??= q(`CREATE TABLE IF NOT EXISTS apsomh_ticket_order_alerts (
      ticket_id text NOT NULL, order_id text NOT NULL, order_number text, order_date text, articles text[],
      company_id text, company text, pipeline text, ticket_subject text, owner_id text, owner_email text,
      mode text NOT NULL, linked boolean NOT NULL DEFAULT false, mailed_at timestamptz, error text,
      at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (ticket_id, order_id))`)
    .then(() => undefined)
    .catch((e) => { table = null; throw e; });
  return table;
}

/** The open stages of ESO and TSA (HubSpot's own ticketState). */
async function openStages(): Promise<Set<string>> {
  const out = new Set<string>();
  for (const pid of [ESO, TSA]) {
    const p = await hs<{ stages?: { id: string; metadata?: { ticketState?: string } }[] }>(`/crm/v3/pipelines/tickets/${pid}`);
    for (const s of p.stages ?? []) if (s.metadata?.ticketState === "OPEN") out.add(s.id);
  }
  return out;
}

/** One association batch read, from -> the first or every `to` id. */
async function assocRead(from: string, to: string, ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 100) {
    const j = await hs<{ results?: Assoc[] }>(`/crm/v4/associations/${from}/${to}/batch/read`, "POST", { inputs: ids.slice(i, i + 100).map((id) => ({ id })) });
    for (const r of j.results ?? []) out.set(String(r.from.id), (r.to ?? []).map((t) => String(t.toObjectId)));
  }
  return out;
}

async function batchRead(obj: string, ids: string[], properties: string[], cache: Map<string, Obj>): Promise<void> {
  const missing = ids.filter((id) => !cache.has(id));
  for (let i = 0; i < missing.length; i += 100) {
    const j = await hs<{ results?: Obj[] }>(`/crm/v3/objects/${obj}/batch/read`, "POST", { properties, inputs: missing.slice(i, i + 100).map((id) => ({ id })) });
    for (const o of j.results ?? []) cache.set(String(o.id), o);
  }
}

const owners = new Map<string, { email: string | null; first: string | null }>();
async function ownerOf(id: string): Promise<{ email: string | null; first: string | null }> {
  if (!owners.has(id)) {
    try {
      const o = await hs<{ email?: string; firstName?: string }>(`/crm/v3/owners/${id}?idProperty=id`);
      owners.set(id, { email: o.email ?? null, first: o.firstName ?? null });
    } catch {
      owners.set(id, { email: null, first: null });
    }
  }
  return owners.get(id)!;
}

export async function runOrderAlerts(mode: AlertMode, signal?: AbortSignal): Promise<AlertRun> {
  await ensureTable();
  const t0 = Date.now();
  const out: AlertRun = { at: new Date().toISOString(), seconds: 0, mode, read: 0, withArticles: 0, matched: 0, created: 0, linked: 0, mailed: 0 };
  const stored = (await kvGet<number>(KV.since)) ?? null;
  let since = stored && Date.now() - stored < 3 * 86_400_000 ? stored : Date.now() - 86_400_000;
  const changes: number[] = [];
  const tickets = new Map<string, Obj>();
  const companies = new Map<string, Obj>();
  const products = new Map<string, Obj>();
  try {
    const open = await openStages();
    let after: string | undefined;
    while (out.read < MAX_READ) {
      if (signal?.aborted) throw new Error("stopped by the time limit");
      const page = await hs<{ results?: Obj[]; paging?: { next?: { after?: string } } }>("/crm/v3/objects/orders/search", "POST", {
        filterGroups: [{ filters: [
          { propertyName: "order_order_number", operator: "HAS_PROPERTY" },
          { propertyName: "hs_lastmodifieddate", operator: "GTE", value: String(since - OVERLAP_MS) },
        ] }],
        sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }],
        properties: ["order_order_number", "order_order_date", "order_positions_json", "hs_createdate", "hs_lastmodifieddate"], limit: 100, ...(after ? { after } : {}),
      });
      const orders = page.results ?? [];
      if (!orders.length) break;
      out.read += orders.length;
      for (const o of orders) changes.push(msOf(o.properties?.hs_lastmodifieddate));
      // an ERP order lists its articles in order_positions_json; a web order has none there, its
      // articles are linked to it as Products & Pricing records (the Magento sync links them by SKU)
      const arts = new Map(orders.map((o) => [o.id, positionArticles(o.properties?.order_positions_json)]));
      const bare = orders.filter((o) => !arts.get(o.id)!.length).map((o) => o.id);
      if (bare.length) {
        const orderPP = await assocRead("orders", PP_OBJ, bare);
        await batchRead(PP_OBJ, [...new Set([...orderPP.values()].flat())], ["article_number"], products);
        for (const [oid, pps] of orderPP) arts.set(oid, pps.map((id) => products.get(id)?.properties?.article_number ?? "").filter(Boolean));
      }
      const withArts = orders.map((o) => ({ o, arts: arts.get(o.id) ?? [] })).filter((x) => x.arts.length);
      out.withArticles += withArts.length;
      if (withArts.length) {
        const orderCo = await assocRead("orders", "companies", withArts.map((x) => x.o.id));
        const coIds = [...new Set([...orderCo.values()].map((v) => v[0]).filter(Boolean))];
        const coTickets = coIds.length ? await assocRead("companies", "tickets", coIds) : new Map<string, string[]>();
        await batchRead("tickets", [...new Set([...coTickets.values()].flat())], TPROPS, tickets);
        await batchRead("companies", coIds, ["name"], companies);
        // every (order, ticket) the rules accept, that has not been alerted before
        const found: { o: Obj; t: Obj; arts: string[]; co: string }[] = [];
        for (const { o, arts } of withArts) {
          const co = orderCo.get(o.id)?.[0];
          if (!co) continue;
          const orderDay = msOf(o.properties?.order_order_date) || msOf(o.properties?.hs_createdate);
          for (const tid of coTickets.get(co) ?? []) {
            const t = tickets.get(tid);
            const p = t?.properties ?? {};
            if (!t) continue;
            const hit = alertArticles({
              orderArticles: arts, orderDayMs: orderDay, ticketCreatedMs: msOf(p.createdate), now: Date.now(),
              ticketArticles: articleCandidates(ticketBlob(p)), open: open.has(p.hs_pipeline_stage ?? ""), pipeline: ASSOC_PIPELINES[p.hs_pipeline ?? ""] ?? null,
            });
            if (hit.length) found.push({ o, t, arts: hit, co });
          }
        }
        out.matched += found.length;
        const known = found.length
          ? new Set((await q<{ k: string }>("SELECT ticket_id || ':' || order_id AS k FROM apsomh_ticket_order_alerts WHERE ticket_id = ANY($1)", [found.map((f) => f.t.id)])).map((r) => r.k))
          : new Set<string>();
        for (const f of found) {
          if (known.has(`${f.t.id}:${f.o.id}`)) continue;
          known.add(`${f.t.id}:${f.o.id}`);
          const p = f.t.properties ?? {};
          const orderNumber = f.o.properties?.order_order_number ?? f.o.id;
          const orderDate = f.o.properties?.order_order_date?.slice(0, 10) ?? null;
          const company = companies.get(f.co)?.properties?.name ?? null;
          const ownerId = p.hubspot_owner_id ?? null;
          let linked = false, mailedAt: string | null = null, ownerEmail: string | null = null, error: string | null = null;
          if (mode === "link" || mode === "mail") {
            try {
              await hs(`/crm/v4/objects/tickets/${f.t.id}/associations/default/orders/${f.o.id}`, "PUT");
              linked = true;
              out.linked += 1;
            } catch (e) { error = `link: ${(e as Error).message.slice(0, 160)}`; }
          }
          if (ownerId) {
            const ow = await ownerOf(ownerId);
            ownerEmail = ow.email;
            if (mode === "mail" && linked) {
              if (!ow.email) error = "the ticket's owner has no e-mail address";
              else if (!mailConfigured()) error = "the hub's mail relay is not set up";
              else {
                try {
                  const m = renderOrderAlert({ ownerName: ow.first, ticketSubject: p.subject ?? null, ticketUrl: ticketUrl(f.t.id), orderNumber, orderDate, articles: f.arts, company, hubUrl: hubPublicUrl() });
                  await sendHubMail({ to: ow.email, ...m });
                  mailedAt = new Date().toISOString();
                  out.mailed += 1;
                } catch (e) { error = `mail: ${(e as Error).message.slice(0, 160)}`; }
              }
            }
          } else if (mode === "mail") error = "the ticket has no owner";
          await q(
            `INSERT INTO apsomh_ticket_order_alerts (ticket_id, order_id, order_number, order_date, articles, company_id, company, pipeline, ticket_subject, owner_id, owner_email, mode, linked, mailed_at, error)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (ticket_id, order_id) DO NOTHING`,
            [f.t.id, f.o.id, orderNumber, orderDate, f.arts, f.co, company, ASSOC_PIPELINES[p.hs_pipeline ?? ""] ?? null, (p.subject ?? "").slice(0, 160) || null,
              ownerId, ownerEmail, mode, linked, mailedAt, error]);
          out.created += 1;
        }
      }
      after = page.paging?.next?.after;
      if (!after) break;
    }
    since = nextSince(since, changes);
    await kvSet(KV.since, since);
  } catch (e) {
    out.error = (e as Error).message.slice(0, 300);
  }
  out.seconds = Math.round((Date.now() - t0) / 1000);
  await kvSet(KV.last, out);
  if (out.error || out.created) console.log(`[ticket-assoc] order alerts (${mode}): ${out.read} orders read, ${out.matched} matched, ${out.created} new, ${out.linked} linked, ${out.mailed} mailed${out.error ? ` - ${out.error}` : ""}`);
  return out;
}

export async function lastAlertRun(): Promise<AlertRun | null> {
  return (await kvGet<AlertRun>(KV.last)) ?? null;
}

export type AlertRow = {
  ticket_id: string; order_id: string; order_number: string | null; order_date: string | null; articles: string[]; company: string | null;
  pipeline: string | null; ticket_subject: string | null; owner_email: string | null; mode: string; linked: boolean; mailed_at: string | null; error: string | null; at: string;
};

export async function alertRows(from: string, to: string): Promise<AlertRow[]> {
  await ensureTable();
  return q<AlertRow>(
    `SELECT ticket_id, order_id, order_number, order_date, articles, company, pipeline, ticket_subject, owner_email, mode, linked, mailed_at, error, at
       FROM apsomh_ticket_order_alerts WHERE at >= $1::date AND at < ($2::date + 1) ORDER BY at DESC LIMIT 200`, [from, to]);
}
