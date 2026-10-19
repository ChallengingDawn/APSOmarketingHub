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
// nothing; link - links the order to the ticket; mail - links and mails the owner. Switching to link
// or mail also acts on what preview listed, while it still counts - the ticket still open, the order
// at most 14 days old (SARCLA 17.10.2026: "I have activated it but the mail did not go out").
//
// One mail per ticket and purchase, ever, and the ticket closed when it goes (SARCLA 19.10.2026: "on
// order detection on ESO/TSA pipeline we send the mail twice ... we need to also CLOSE the ticket").
// A purchase is the A-number without its delivery part (rules.ts purchaseOf): the shop's .000 and the
// ERP's .001 are one order, and each was a mail. The mail is claimed in apsomh_ticket_order_mails
// (ticket, purchase) BEFORE it is sent - an INSERT only one check can win, whichever copy of the hub
// runs it - and the alert's own row is written before it acts, not after. When the mail went out the
// ticket moves to its pipeline's closed stage with "Ticket resolution ESO | TSA" = Ordered (a person's
// own resolution is kept); a closed ticket gets no further alert. A credit note or a cancelled order
// is never an alert.

import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { ASSOC_PIPELINES, ESO, PP_OBJ, TSA, articleCandidates, positionArticles, ticketBlob } from "@/lib/connectors/steps/ticketRules";
import { hubPublicUrl } from "@/lib/content/shareMail";
import { mailConfigured, sendHubMail } from "@/lib/notify/mailer";
import { renderOrderAlert } from "./mail";
import { alertArticles, alertsPlan, closeProps, closedStageOf, countsAsOrder, mailBlock, msOf, nextSince, purchaseOf } from "./rules";

export type AlertMode = "off" | "preview" | "link" | "mail";
export type AlertRun = { at: string; seconds: number; mode: AlertMode; read: number; withArticles: number; matched: number; created: number; promoted: number; linked: number; mailed: number; closed?: number; error?: string };

const PORTAL = "26492587";
const ticketUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-5/${id}`;
const KV = { since: "ticketAssoc:orders:since", last: "ticketAssoc:orders:last" };
export const MAX_READ = 300;
const OVERLAP_MS = 5 * 60_000;
const TPROPS = ["subject", "content", "order_number", "order_id", "article", "article_number", "articles_on_the_ticket", "hs_pipeline", "hs_pipeline_stage", "createdate", "hubspot_owner_id", "ticket_resolution_eso"];

type Obj = { id: string; properties?: Record<string, string | null> };
type Assoc = { from: { id: string }; to?: { toObjectId: string | number }[] };

const q = async <T>(sql: string, params: unknown[] = []): Promise<T[]> => (await getPool().query(sql, params)).rows as T[];
const hs = <T>(path: string, method: "GET" | "POST" | "PUT" | "PATCH" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body, useTicketsToken: true });

let table: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  table ??= q(`CREATE TABLE IF NOT EXISTS apsomh_ticket_order_alerts (
      ticket_id text NOT NULL, order_id text NOT NULL, order_number text, order_date text, articles text[],
      company_id text, company text, pipeline text, ticket_subject text, owner_id text, owner_email text,
      mode text NOT NULL, linked boolean NOT NULL DEFAULT false, mailed_at timestamptz, error text,
      at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (ticket_id, order_id))`)
    // 19.10.2026: the purchase the alert belongs to, and when the hub closed the ticket
    .then(() => q("ALTER TABLE apsomh_ticket_order_alerts ADD COLUMN IF NOT EXISTS purchase text, ADD COLUMN IF NOT EXISTS closed_at timestamptz"))
    .then(() => q(`UPDATE apsomh_ticket_order_alerts SET purchase = ${PURCHASE_SQL} WHERE purchase IS NULL`))
    // the mails: one per ticket and purchase - claimed before it is sent, so no second check can send it too
    .then(() => q(`CREATE TABLE IF NOT EXISTS apsomh_ticket_order_mails (
      ticket_id text NOT NULL, purchase text NOT NULL, order_id text NOT NULL, at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (ticket_id, purchase))`))
    // the mails sent before the claims existed count as claimed
    .then(() => q(`INSERT INTO apsomh_ticket_order_mails (ticket_id, purchase, order_id, at)
      SELECT DISTINCT ON (ticket_id, purchase) ticket_id, purchase, order_id, mailed_at FROM apsomh_ticket_order_alerts
       WHERE mailed_at IS NOT NULL ORDER BY ticket_id, purchase, mailed_at ON CONFLICT DO NOTHING`))
    .then(() => undefined)
    .catch((e) => { table = null; throw e; });
  return table;
}

/** rules.ts purchaseOf in SQL, for the rows written before the purchase column. */
const PURCHASE_SQL = String.raw`CASE WHEN btrim(order_number) ~ '^[AG][0-9]{2}\.[0-9]{6}\.[0-9]{3}$' THEN left(btrim(order_number), 10)
  ELSE coalesce(nullif(btrim(order_number), ''), 'order ' || order_id) END`;

/** The mail of a ticket and purchase, claimed: true for the one check that may send it. */
async function claimMail(ticketId: string, purchase: string, orderId: string): Promise<boolean> {
  return (await q("INSERT INTO apsomh_ticket_order_mails (ticket_id, purchase, order_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING ticket_id", [ticketId, purchase, orderId])).length > 0;
}

type Stages = { open: Set<string>; closed: Map<string, string | null> };

/** The open stages of ESO and TSA (HubSpot's own ticketState), and the stage each pipeline closes in. */
async function ticketStages(): Promise<Stages> {
  const out: Stages = { open: new Set(), closed: new Map() };
  for (const pid of [ESO, TSA]) {
    const p = await hs<{ stages?: { id: string; archived?: boolean; metadata?: { ticketState?: string } }[] }>(`/crm/v3/pipelines/tickets/${pid}`);
    for (const s of p.stages ?? []) if (s.metadata?.ticketState === "OPEN") out.open.add(s.id);
    out.closed.set(pid, closedStageOf(p.stages ?? []));
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

type Act = {
  ticketId: string; orderId: string; ownerId: string | null; subject: string | null; orderNumber: string; orderDate: string | null; articles: string[]; company: string | null;
  /** The ticket's pipeline and its "Ticket resolution ESO | TSA" - what closing it needs. */
  pipelineId: string | null; resolution: string | null;
};
/** One check's shared state: the stages, the tickets mailed in it (ticket -> purchase), its time limit. */
type Ctx = { stages: Stages; mailedNow: Map<string, string>; signal?: AbortSignal };
type ActResult = { linked: boolean; mailedAt: string | null; closedAt: string | null; ownerEmail: string | null; error: string | null };

/** Close the ticket its alert just mailed about: the pipeline's closed stage, resolution Ordered. */
async function closeTicket(a: Act, ctx: Ctx, out: AlertRun): Promise<{ closedAt: string | null; error: string | null }> {
  const stage = ctx.stages.closed.get(a.pipelineId ?? "") ?? null;
  if (!stage) return { closedAt: null, error: "close: the ticket's pipeline has no single closed stage - left open" };
  try {
    await hs(`/crm/v3/objects/tickets/${a.ticketId}`, "PATCH", { properties: closeProps(stage, a.resolution) });
    out.closed = (out.closed ?? 0) + 1;
    return { closedAt: new Date().toISOString(), error: null };
  } catch (e) { return { closedAt: null, error: `close: ${(e as Error).message.slice(0, 160)}` }; }
}

/**
 * Link (link, mail), mail the owner and close the ticket (mail) - what one alert does; counts into
 * `out`. The mail is claimed for the ticket and purchase before it is sent; a send that fails gives
 * the claim back, so a later check may try again. The ticket is closed only once the mail went out.
 */
async function act(mode: AlertMode, a: Act, out: AlertRun, ctx: Ctx): Promise<ActResult> {
  // past the time limit the lock is gone and the other copy of the hub may read these orders too: stop
  if (ctx.signal?.aborted) throw new Error("stopped by the time limit");
  let linked = false, mailedAt: string | null = null, closedAt: string | null = null, error: string | null = null;
  if (mode === "link" || mode === "mail") {
    try {
      await hs(`/crm/v4/objects/tickets/${a.ticketId}/associations/default/orders/${a.orderId}`, "PUT");
      linked = true;
      out.linked += 1;
    } catch (e) { error = `link: ${(e as Error).message.slice(0, 160)}`; }
  }
  const ow = a.ownerId ? await ownerOf(a.ownerId) : null;
  const ownerEmail = ow?.email ?? null;
  if (mode === "mail" && linked) {
    const purchase = purchaseOf(a.orderNumber, a.orderId);
    const block = mailBlock({ ownerId: a.ownerId, ownerEmail, relay: mailConfigured(), mailedNow: ctx.mailedNow.get(a.ticketId) ?? null });
    if (block) error = block;
    else if (!(await claimMail(a.ticketId, purchase, a.orderId))) error = `not mailed: the owner already had the alert for ${purchase} on this ticket`;
    else {
      try {
        const m = renderOrderAlert({ ownerName: ow?.first ?? null, ticketSubject: a.subject, ticketUrl: ticketUrl(a.ticketId), orderNumber: a.orderNumber, orderDate: a.orderDate, articles: a.articles, company: a.company, hubUrl: hubPublicUrl() });
        await sendHubMail({ to: ownerEmail!, ...m });
        mailedAt = new Date().toISOString();
        out.mailed += 1;
        ctx.mailedNow.set(a.ticketId, purchase);
      } catch (e) {
        error = `mail: ${(e as Error).message.slice(0, 160)}`;
        await q("DELETE FROM apsomh_ticket_order_mails WHERE ticket_id=$1 AND purchase=$2 AND order_id=$3", [a.ticketId, purchase, a.orderId]).catch(() => {});
      }
      if (mailedAt) ({ closedAt, error } = await closeTicket(a, ctx, out));
    }
  }
  return { linked, mailedAt, closedAt, ownerEmail, error };
}

/**
 * What preview listed, acted on now that the mode links or mails: each alert of the last 14 days
 * not linked yet (or, in mail, not mailed yet) whose ticket is still open - read again from HubSpot.
 * In mail, also an alert mailed whose ticket was not closed (the close failed): only closed now.
 */
async function promote(mode: AlertMode, out: AlertRun, ctx: Ctx): Promise<void> {
  if (mode !== "link" && mode !== "mail") return;
  const rows = await q<{ ticket_id: string; order_id: string; order_number: string | null; order_date: string | null; articles: string[]; company: string | null; ticket_subject: string | null; linked: boolean; mailed_at: string | null }>(
    `SELECT ticket_id, order_id, order_number, order_date, articles, company, ticket_subject, linked, mailed_at FROM apsomh_ticket_order_alerts
      WHERE at > now() - interval '14 days' AND (
            (mailed_at IS NULL AND (NOT linked OR $1 = 'mail') AND (error IS NULL OR error LIKE 'mail:%' OR error LIKE 'link:%'))
         OR ($1 = 'mail' AND mailed_at IS NOT NULL AND closed_at IS NULL AND error LIKE 'close:%'))
      ORDER BY at LIMIT 100`, [mode]);
  if (!rows.length) return;
  const tickets = new Map<string, Obj>();
  await batchRead("tickets", [...new Set(rows.map((r) => r.ticket_id))], ["subject", "hs_pipeline", "hs_pipeline_stage", "hubspot_owner_id", "ticket_resolution_eso"], tickets);
  for (const r of rows) {
    const p = tickets.get(r.ticket_id)?.properties ?? {};
    if (!ctx.stages.open.has(p.hs_pipeline_stage ?? "")) {
      await q("UPDATE apsomh_ticket_order_alerts SET error=$4, mode=$3 WHERE ticket_id=$1 AND order_id=$2",
        [r.ticket_id, r.order_id, mode, r.mailed_at ? "the ticket was closed in HubSpot before the hub closed it" : "the ticket was closed before the alert went out"]);
      continue;
    }
    const a: Act = {
      ticketId: r.ticket_id, orderId: r.order_id, ownerId: p.hubspot_owner_id ?? null, subject: p.subject ?? r.ticket_subject,
      orderNumber: r.order_number ?? r.order_id, orderDate: r.order_date, articles: r.articles, company: r.company,
      pipelineId: p.hs_pipeline ?? null, resolution: p.ticket_resolution_eso ?? null,
    };
    // mailed, not closed: the close is done again, never the mail
    if (r.mailed_at) {
      if (ctx.signal?.aborted) throw new Error("stopped by the time limit");
      const c = await closeTicket(a, ctx, out);
      await q("UPDATE apsomh_ticket_order_alerts SET mode=$3, closed_at=$4, error=$5 WHERE ticket_id=$1 AND order_id=$2", [r.ticket_id, r.order_id, mode, c.closedAt, c.error]);
      out.promoted += 1;
      continue;
    }
    // in mail mode an alert already linked is only mailed: link again is harmless (PUT), so act() does both
    const res = await act(mode, a, out, ctx);
    await q("UPDATE apsomh_ticket_order_alerts SET mode=$3, linked=$4, mailed_at=$5, owner_email=COALESCE($6, owner_email), error=$7, closed_at=$8 WHERE ticket_id=$1 AND order_id=$2",
      [r.ticket_id, r.order_id, mode, res.linked || r.linked, res.mailedAt, res.ownerEmail, res.error, res.closedAt]);
    out.promoted += 1;
  }
}

export async function runOrderAlerts(mode: AlertMode, signal?: AbortSignal): Promise<AlertRun> {
  await ensureTable();
  const t0 = Date.now();
  const out: AlertRun = { at: new Date().toISOString(), seconds: 0, mode, read: 0, withArticles: 0, matched: 0, created: 0, promoted: 0, linked: 0, mailed: 0, closed: 0 };
  const stored = (await kvGet<number>(KV.since)) ?? null;
  const { overlapMs } = alertsPlan((await kvGet<AlertRun>(KV.last)) ?? null, Date.now(), 0, MAX_READ, OVERLAP_MS);
  // a look back (lookBack) may set it up to 14 days back; anything older, or nothing, starts one day back
  let since = stored && Date.now() - stored <= 15 * 86_400_000 ? stored : Date.now() - 86_400_000;
  const changes: number[] = [];
  const tickets = new Map<string, Obj>();
  const companies = new Map<string, Obj>();
  const products = new Map<string, Obj>();
  try {
    const ctx: Ctx = { stages: await ticketStages(), mailedNow: new Map(), signal };
    const open = ctx.stages.open;
    await promote(mode, out, ctx);
    let after: string | undefined;
    while (out.read < MAX_READ) {
      if (signal?.aborted) throw new Error("stopped by the time limit");
      const page = await hs<{ results?: Obj[]; paging?: { next?: { after?: string } } }>("/crm/v3/objects/orders/search", "POST", {
        filterGroups: [{ filters: [
          { propertyName: "order_order_number", operator: "HAS_PROPERTY" },
          { propertyName: "hs_lastmodifieddate", operator: "GTE", value: String(since - overlapMs) },
        ] }],
        sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }],
        properties: ["order_order_number", "order_order_date", "order_positions_json", "hs_pipeline_stage", "hs_createdate", "hs_lastmodifieddate"], limit: 100, ...(after ? { after } : {}),
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
      // a credit note or a cancelled order is not the customer ordering
      const withArts = orders.filter((o) => countsAsOrder(o.properties?.order_order_number, o.properties?.hs_pipeline_stage))
        .map((o) => ({ o, arts: arts.get(o.id) ?? [] })).filter((x) => x.arts.length);
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
          // the alert's row first, then what it does: only the check whose INSERT wins acts on it (a
          // second copy of the hub that got the lock past the time limit finds it taken), and one that
          // stops half-way leaves a row promote() finishes
          const won = await q(
            `INSERT INTO apsomh_ticket_order_alerts (ticket_id, order_id, order_number, order_date, articles, company_id, company, pipeline, ticket_subject, owner_id, mode, purchase)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (ticket_id, order_id) DO NOTHING RETURNING ticket_id`,
            [f.t.id, f.o.id, orderNumber, orderDate, f.arts, f.co, company, ASSOC_PIPELINES[p.hs_pipeline ?? ""] ?? null, (p.subject ?? "").slice(0, 160) || null,
              ownerId, mode, purchaseOf(orderNumber, f.o.id)]);
          if (!won.length) continue;
          const res = await act(mode, {
            ticketId: f.t.id, orderId: f.o.id, ownerId, subject: p.subject ?? null, orderNumber, orderDate, articles: f.arts, company,
            pipelineId: p.hs_pipeline ?? null, resolution: p.ticket_resolution_eso ?? null,
          }, out, ctx);
          await q("UPDATE apsomh_ticket_order_alerts SET owner_email=$3, linked=$4, mailed_at=$5, closed_at=$6, error=$7 WHERE ticket_id=$1 AND order_id=$2",
            [f.t.id, f.o.id, res.ownerEmail, res.linked, res.mailedAt, res.closedAt, res.error]);
          out.created += 1;
        }
      }
      after = page.paging?.next?.after;
      if (!after) break;
    }
    since = nextSince(since, changes);
    // a look back set while this check ran wins over the mark this check reached
    if (((await kvGet<number>(KV.since)) ?? null) === stored) await kvSet(KV.since, since);
  } catch (e) {
    out.error = (e as Error).message.slice(0, 300);
  }
  out.seconds = Math.round((Date.now() - t0) / 1000);
  await kvSet(KV.last, out);
  if (out.error || out.created || out.promoted) console.log(`[ticket-assoc] order alerts (${mode}): ${out.read} orders read, ${out.matched} matched, ${out.created} new, ${out.promoted} listed before and acted on, ${out.linked} linked, ${out.mailed} mailed, ${out.closed ?? 0} closed${out.error ? ` - ${out.error}` : ""}`);
  return out;
}

/**
 * Look back: the next checks read the orders of the last `days` again (SARCLA 17.10.2026: "still only
 * 2 alerts" - the watcher only sees orders as they get their A-number, and looked back one day when it
 * started). Alerts already made are never made twice; in mail mode every new match mails its owner -
 * once per ticket and purchase - and closes the ticket.
 */
export async function lookBack(days = 14): Promise<number> {
  const since = Date.now() - Math.max(1, Math.min(days, 14)) * 86_400_000;
  await kvSet(KV.since, since);
  return since;
}

export async function lastAlertRun(): Promise<AlertRun | null> {
  return (await kvGet<AlertRun>(KV.last)) ?? null;
}

export type AlertRow = {
  ticket_id: string; order_id: string; order_number: string | null; order_date: string | null; articles: string[]; company: string | null;
  pipeline: string | null; ticket_subject: string | null; owner_email: string | null; mode: string; linked: boolean; mailed_at: string | null; error: string | null; at: string;
  /** When the hub closed the ticket after its mail (19.10.2026). */
  closed_at: string | null;
};

export async function alertRows(from: string, to: string, pipeline: string | null = null): Promise<AlertRow[]> {
  await ensureTable();
  return q<AlertRow>(
    `SELECT ticket_id, order_id, order_number, order_date, articles, company, pipeline, ticket_subject, owner_email, mode, linked, mailed_at, error, at, closed_at
       FROM apsomh_ticket_order_alerts WHERE at >= $1::date AND at < ($2::date + 1) AND ($3::text IS NULL OR pipeline = $3) ORDER BY at DESC LIMIT 200`, [from, to, pipeline]);
}
