// TICKET ASSOCIATIONS, RUN BY THE HUB (SARCLA, 17.10.2026: "I wish to delete this app but
// migrate the workflow here"). It replaces the HubSpot workflow "Ticket associations" - a
// custom-code action on the Tickets app's token (sarcla-tickets, "SARCLA - Erosion tickets"),
// run when a ticket was created or moved stage - so that app can be deleted.
//
// Every 3 minutes, one copy of the hub at a time: the Back Office, ESO and TSA tickets changed
// since the last look are read, and the ones new to the hub or moved to another stage since it
// last processed them (rules.ts - the workflow's own two triggers) go through the connector's
// engine (steps/tickets.ts gather + flush) on the hub's own token: linked to the orders and
// Products & Pricing articles they name, empty reference fields filled, C2S flagged. Re-runs are
// harmless - a link the ticket already carries is not written again, a filled field never.
//
// Modes (kv): off; preview - reads and records what it would write, writes nothing (side by
// side with the workflow, which keeps writing); live. Evidence: the ticket's fields, as the
// workflow read them, or extended - its e-mails too, and an ESO / TSA offer matched to the order
// that followed (the connector's full engine).

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { flush, gather, newStats, type Evidence, type Gathered } from "@/lib/connectors/steps/tickets";
import { ASSOC_FIELDS, ASSOC_PIPELINES, BO, ESO, TSA } from "@/lib/connectors/steps/ticketRules";
import { alertsPlan, firstSince, nextSince, reason, type Seen } from "./rules";
import { alertRows, lastAlertRun, MAX_READ as ALERTS_MAX_READ, runOrderAlerts, type AlertMode } from "./orderAlerts";

export type Mode = "off" | "preview" | "live";
/** alerts: the order alerts (orderAlerts.ts) - off / preview / link / mail. */
export type Settings = { mode: Mode; extended: boolean; alerts: AlertMode; by: string | null; at: string | null };
export type LastRun = {
  at: string; seconds: number; mode: "preview" | "live"; read: number; processed: number; skipped: number; retried: number;
  newOrders: number; newArticles: number; filled: number; c2s: number; failed: number; error?: string;
  /** Older tickets re-checked by the backfill. */
  backfilled?: number;
};
/** The re-check of older tickets (SARCLA 17.10.2026: "these tickets are old, it is not running"). */
export type Backfill = { from: string | null; cursor: number | null; processed: number; done: boolean; startedAt: string | null; by: string | null };

const LOCK = 4_107_214;
const EVERY_MS = 3 * 60_000;
/** A run past this is stopped and its lock dropped (the shop-order sync hung 20 h on 14.10). */
const LIMIT_MS = 10 * 60_000;
/** Tickets read per run; the rest come in the next one, oldest change first. */
const MAX_READ = 300;
/** Older tickets re-checked per run. */
const BACKFILL_PER_RUN = 100;
/** HubSpot's search index trails a write by a little: each window starts this much earlier. */
const OVERLAP_MS = 3 * 60_000;
const RETENTION_DAYS = 180;
/** The order alerts run inside the same scheduler and lock, every 15 minutes - every 3 while a backlog waits. */
const ALERTS_EVERY_MS = 15 * 60_000;
const KV = {
  settings: "ticketAssoc:settings",
  backfill: "ticketAssoc:backfill",
  since: (m: string) => `ticketAssoc:since:${m}`,
  last: (m: string) => `ticketAssoc:last:${m}`,
};
const PROPS = [...ASSOC_FIELDS, "hs_pipeline_stage", "hs_lastmodifieddate"];

type Ticket = { id: string; properties?: Record<string, string | null> };
type Page = { results?: Ticket[]; paging?: { next?: { after?: string } } };

const q = async <T>(sql: string, params: unknown[] = []): Promise<T[]> => (await getPool().query(sql, params)).rows as T[];
const tix = <T>(path: string, method: "GET" | "POST" = "GET", body?: unknown) =>
  hubspotRetry<T>({ path, method, body, useTicketsToken: true });

/* ── settings ──────────────────────────────────────────────────────────── */

/** Until somebody chooses: preview, fields only, order alerts listed but not sent - the hub watches. */
export async function getSettings(): Promise<Settings> {
  const s = await kvGet<Settings>(KV.settings).catch(() => undefined);
  return { mode: s?.mode ?? "preview", extended: !!s?.extended, alerts: s?.alerts ?? "preview", by: s?.by ?? null, at: s?.at ?? null };
}

export async function setSettings(change: { mode?: Mode; extended?: boolean; alerts?: AlertMode }, by: string): Promise<Settings> {
  const cur = await getSettings();
  const mode = change.mode && ["off", "preview", "live"].includes(change.mode) ? change.mode : cur.mode;
  const alerts = change.alerts && ["off", "preview", "link", "mail"].includes(change.alerts) ? change.alerts : cur.alerts;
  const next: Settings = { mode, extended: change.extended ?? cur.extended, alerts, by, at: new Date().toISOString() };
  // going live: the live window starts at the last half hour, not at whenever live last ran
  if (mode === "live" && cur.mode !== "live") await kvSet(KV.since("live"), Date.now() - 30 * 60_000);
  await kvSet(KV.settings, next);
  return next;
}

export async function getBackfill(): Promise<Backfill> {
  const b = await kvGet<Backfill>(KV.backfill).catch(() => undefined);
  return { from: b?.from ?? null, cursor: b?.cursor ?? null, processed: b?.processed ?? 0, done: !!b?.done, startedAt: b?.startedAt ?? null, by: b?.by ?? null };
}

/** Start the re-check from a day (newest tickets first, down to that day), or stop it (from null). */
export async function setBackfill(from: string | null, by: string): Promise<Backfill> {
  const b: Backfill = from && /^\d{4}-\d{2}-\d{2}$/.test(from)
    ? { from, cursor: null, processed: 0, done: false, startedAt: new Date().toISOString(), by }
    : { ...(await getBackfill()), done: true };
  await kvSet(KV.backfill, b);
  return b;
}

// the ticket's e-mails are always read (SARCLA 17.10.2026: "it should detect from mails and shop links
// as well"); the extended evidence adds the ESO / TSA offer matched to the order that followed
const evidence = (s: Settings): Evidence => ({ emails: true, offers: s.extended });

/* ── the hub's own tables (created on first use, never in ensureSchema) ── */

let tables: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  tables ??= (async () => {
    // the stage each ticket was last processed in, per mode - what "moved stage" is measured by
    await q(`CREATE TABLE IF NOT EXISTS apsomh_ticket_assoc_seen (
      mode text NOT NULL, ticket_id text NOT NULL, stage text, ok boolean NOT NULL, at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (mode, ticket_id))`);
    // every processing, for the page: what was found and what was (or would be) written
    await q(`CREATE TABLE IF NOT EXISTS apsomh_ticket_assoc_log (
      id bigserial PRIMARY KEY, mode text NOT NULL, at timestamptz NOT NULL DEFAULT now(), ticket_id text NOT NULL,
      pipeline text, stage text, why text, subject text, orders text[], articles text[], offer_orders text[],
      new_orders int NOT NULL DEFAULT 0, new_articles int NOT NULL DEFAULT 0, filled text[], c2s boolean NOT NULL DEFAULT false,
      ok boolean NOT NULL, error text)`);
    await q("CREATE INDEX IF NOT EXISTS apsomh_ticket_assoc_log_at ON apsomh_ticket_assoc_log (mode, at DESC)");
    // the Articles tab (17.10.2026): numbers the catalogue did not know, eight-digit numbers seen
    await q("ALTER TABLE apsomh_ticket_assoc_log ADD COLUMN IF NOT EXISTS rejected text[], ADD COLUMN IF NOT EXISTS products text[]");
    // where an order or article came from beyond the ticket's fields: email, shop (17.10.2026)
    await q("ALTER TABLE apsomh_ticket_assoc_log ADD COLUMN IF NOT EXISTS sources text[]");
  })().catch((e) => { tables = null; throw e; });
  return tables;
}

/* ── one run ───────────────────────────────────────────────────────────── */

function stopIfOver(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error(`stopped after ${LIMIT_MS / 60_000} minutes`);
}

/** The tickets of the three pipelines changed since `since`, oldest change first, one page. */
function changedSince(since: number, after?: string) {
  return tix<Page>("/crm/v3/objects/tickets/search", "POST", {
    filterGroups: [{ filters: [
      { propertyName: "hs_pipeline", operator: "IN", values: [BO, ESO, TSA] },
      { propertyName: "hs_lastmodifieddate", operator: "GTE", value: String(since - OVERLAP_MS) },
    ] }],
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }],
    properties: PROPS, limit: 100, ...(after ? { after } : {}),
  });
}

/** Tickets whose last processing failed (a day back at most): asked again, changed or not. */
async function retries(mode: string): Promise<Ticket[]> {
  const ids = (await q<{ ticket_id: string }>(
    `SELECT ticket_id FROM apsomh_ticket_assoc_seen WHERE mode=$1 AND NOT ok AND at > now() - interval '1 day' ORDER BY at LIMIT 50`, [mode])).map((r) => r.ticket_id);
  if (!ids.length) return [];
  const j = await tix<{ results?: Ticket[] }>("/crm/v3/objects/tickets/batch/read", "POST", { properties: PROPS, inputs: ids.map((id) => ({ id })) });
  return j.results ?? [];
}

async function seenOf(mode: string, ids: string[]): Promise<Map<string, Seen>> {
  if (!ids.length) return new Map();
  const rows = await q<{ ticket_id: string; stage: string | null; ok: boolean }>(
    "SELECT ticket_id, stage, ok FROM apsomh_ticket_assoc_seen WHERE mode=$1 AND ticket_id = ANY($2)", [mode, ids]);
  return new Map(rows.map((r) => [r.ticket_id, { stage: r.stage, ok: r.ok }]));
}

async function record(mode: "preview" | "live", live: boolean, rows: { g: Gathered; why: string; stage: string | null; ok: boolean; error?: string }[]) {
  for (const { g, why, stage, ok, error } of rows) {
    const d = g.detail;
    const filled = live ? d.filled : g.plan?.filled ?? [];
    await q(
      `INSERT INTO apsomh_ticket_assoc_log (mode, ticket_id, pipeline, stage, why, subject, orders, articles, offer_orders, new_orders, new_articles, filled, c2s, ok, error, rejected, products, sources)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [mode, g.tid, ASSOC_PIPELINES[g.p.hs_pipeline ?? ""] ?? null, stage, why, (g.p.subject ?? "").slice(0, 120) || null,
        d.orders, d.articles, d.offer_orders, d.new_orders ?? 0, d.new_articles ?? 0, filled, !!g.plan?.props?.c2s_ticket, ok, error ?? null,
        d.rejected ?? [], d.products ?? [], d.sources ?? []]);
    await q(
      `INSERT INTO apsomh_ticket_assoc_seen (mode, ticket_id, stage, ok, at) VALUES ($1,$2,$3,$4,now())
       ON CONFLICT (mode, ticket_id) DO UPDATE SET stage=EXCLUDED.stage, ok=EXCLUDED.ok, at=now()`,
      [mode, g.tid, stage, ok]);
  }
}

/** Read what changed, process what is new or moved stage, write (live) or only record (preview). */
async function run(settings: Settings, signal?: AbortSignal): Promise<LastRun> {
  await ensureTables();
  const t0 = Date.now();
  const mode = settings.mode === "live" ? "live" : "preview";
  const live = mode === "live";
  const ev = evidence(settings);
  const out: LastRun = { at: new Date().toISOString(), seconds: 0, mode, read: 0, processed: 0, skipped: 0, retried: 0, newOrders: 0, newArticles: 0, filled: 0, c2s: 0, failed: 0 };
  const stats = newStats();
  const pp = new Map<string, string | null>();
  const errors: string[] = [];
  let since = firstSince((await kvGet<number>(KV.since(mode))) ?? null, Date.now());
  const changes: number[] = [];

  const handle = async (batch: Ticket[], forced: boolean, forcedWhy = "retry") => {
    const seen = await seenOf(mode, batch.map((t) => t.id));
    const todo: { t: Ticket; why: string }[] = [];
    for (const t of batch) {
      const why = forced ? forcedWhy : reason(t.properties?.hs_pipeline_stage ?? null, seen.get(t.id));
      if (why) todo.push({ t, why });
      else out.skipped += 1;
    }
    const gathered: { g: Gathered; why: string; stage: string | null }[] = [];
    for (const { t, why } of todo) {
      stopIfOver(signal);
      const p = t.properties ?? {};
      const name = ASSOC_PIPELINES[p.hs_pipeline ?? ""];
      if (!name) continue;
      gathered.push({ g: await gather(t.id, p, name, stats, pp, ev), why, stage: p.hs_pipeline_stage ?? null });
      if (why === "retry") out.retried += 1;
    }
    const okSet = await flush(gathered.map((x) => x.g), live, stats, errors);
    await record(mode, live, gathered.map(({ g, why, stage }) => {
      const ok = live ? okSet.has(g.tid) : !!g.plan;
      // a failure keeps no stage, so the ticket is asked again (retries) even if nothing changes
      return { g, why, stage: ok ? stage : null, ok, error: g.error ?? (ok ? undefined : errors[0]) };
    }));
    out.processed += gathered.length;
  };

  const handleForced = (batch: Ticket[]) => handle(batch, true, "backfill");
  try {
    await handle(await retries(mode), true);
    let after: string | undefined;
    while (out.read < MAX_READ) {
      stopIfOver(signal);
      const page = await changedSince(since, after);
      const res = page.results ?? [];
      if (!res.length) break;
      out.read += res.length;
      for (const t of res) changes.push(Date.parse(t.properties?.hs_lastmodifieddate ?? ""));
      await handle(res, false);
      after = page.paging?.next?.after;
      if (!after) break;
    }
    // the window moves on to the newest change this run read - all of it, or up to its cap
    since = nextSince(since, changes);
    await kvSet(KV.since(mode), since);
    if (live) {
      out.backfilled = await backfill(handleForced, signal);
    }
  } catch (e) {
    out.error = (e as Error).message.slice(0, 300);
  }
  out.newOrders = stats.order_links_new;
  out.newArticles = stats.article_links_new;
  out.filled = live ? stats.fields_filled : stats.fields_to_fill;
  out.c2s = stats.c2s_to_set;
  out.failed = stats.write_failed + stats.read_failed;
  if (!out.error && errors.length) out.error = errors[0];
  out.seconds = Math.round((Date.now() - t0) / 1000);
  await kvSet(KV.last(mode), out);
  if (Math.random() < 0.02) await q(`DELETE FROM apsomh_ticket_assoc_log WHERE at < now() - interval '${RETENTION_DAYS} days'`);
  if (out.error || out.processed) console.log(`[ticket-assoc] ${mode}: ${out.read} read, ${out.processed} processed (${out.retried} again, ${out.backfilled ?? 0} older), ${out.newOrders} order and ${out.newArticles} article links, ${out.filled} fields, ${out.c2s} C2S${out.error ? ` - ${out.error}` : ""}`);
  return out;
}

/**
 * One run under the lock (one copy of the hub at a time); null when it is off or the other
 * copy has the lock. When `signal` aborts, the lock's connection is closed so Postgres frees
 * the lock even if the run never comes back.
 */
export async function runOnce(signal?: AbortSignal, forceAlerts = false): Promise<LastRun | null> {
  const settings = await getSettings();
  if (settings.mode === "off" && settings.alerts === "off") return null;
  const client: PoolClient = await getPool().connect();
  let dropped = false;
  const drop = () => { dropped = true; client.release(new Error("ticket associations: time limit")); };
  if (signal?.aborted) drop(); else signal?.addEventListener("abort", drop, { once: true });
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      const res = settings.mode !== "off" ? await run(settings, signal) : null;
      // the order alerts: every 15 minutes (or now, from the page)
      if (settings.alerts !== "off") {
        const last = await lastAlertRun();
        if (forceAlerts || alertsPlan(last, Date.now(), ALERTS_EVERY_MS, ALERTS_MAX_READ, 0).due) await runOrderAlerts(settings.alerts, signal);
      }
      return res;
    } finally {
      if (!dropped) await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    signal?.removeEventListener("abort", drop);
    if (!dropped) client.release();
  }
}

/** The re-check of older tickets: the next 50, newest first, down to the chosen day; done when none is left. */
async function backfill(handleForced: (batch: Ticket[]) => Promise<void>, signal?: AbortSignal): Promise<number> {
  const b = await getBackfill();
  if (!b.from || b.done) return 0;
  stopIfOver(signal);
  const filters: object[] = [
    { propertyName: "hs_pipeline", operator: "IN", values: [BO, ESO, TSA] },
    { propertyName: "createdate", operator: "GTE", value: String(Date.parse(`${b.from}T00:00:00Z`)) },
  ];
  if (b.cursor) filters.push({ propertyName: "createdate", operator: "LT", value: String(b.cursor) });
  const j = await tix<Page>("/crm/v3/objects/tickets/search", "POST", {
    filterGroups: [{ filters }], sorts: [{ propertyName: "createdate", direction: "DESCENDING" }], properties: PROPS, limit: BACKFILL_PER_RUN,
  });
  const res = j.results ?? [];
  if (res.length) await handleForced(res);
  const last = res.length ? Date.parse(res[res.length - 1].properties?.createdate ?? "") : NaN;
  await kvSet(KV.backfill, {
    ...b, processed: b.processed + res.length,
    cursor: Number.isFinite(last) ? last : b.cursor,
    done: res.length < BACKFILL_PER_RUN,
  });
  return res.length;
}

/** One ticket, read and planned but never written - the page's "check a ticket". */
export async function checkTicket(id: string) {
  const tid = id.replace(/\D/g, "");
  if (!tid) throw new Error("Give the ticket's number (its id in HubSpot).");
  const t = await tix<Ticket>(`/crm/v3/objects/tickets/${tid}?properties=${PROPS.join(",")}`);
  const p = t.properties ?? {};
  const name = ASSOC_PIPELINES[p.hs_pipeline ?? ""];
  if (!name) return { ticket: tid, pipeline: null, note: "Not a Back Office, ESO or TSA ticket - the hub leaves it alone." };
  const settings = await getSettings();
  const stats = newStats();
  const g = await gather(tid, p, name, stats, new Map(), evidence(settings));
  if (g.plan) await flush([g], false, stats, []);
  return {
    ticket: tid, pipeline: name, subject: p.subject ?? null, extended: settings.extended,
    orders: g.detail.orders, articles: g.detail.articles, offerOrders: g.detail.offer_orders, c2s: g.detail.c2s,
    newOrders: g.detail.new_orders ?? 0, newArticles: g.detail.new_articles ?? 0,
    fill: g.plan?.props ?? {}, error: g.error ?? null,
  };
}

/* ── the page's figures ────────────────────────────────────────────────── */

export async function report(from: string, to: string, pipeline: string | null = null) {
  await ensureTables();
  const settings = await getSettings();
  const mode = settings.mode === "live" ? "live" : "preview";
  // the page's pipeline filter: BO / ESO / TSA, or all
  const pipe = pipeline && ["BO", "ESO", "TSA"].includes(pipeline) ? pipeline : null;
  const [byPipeline, recent, lastPreview, lastLive, nothing] = await Promise.all([
    q<{ pipeline: string | null; tickets: number; orders: number; articles: number; filled: number; c2s: number; failed: number }>(
      `SELECT pipeline, count(DISTINCT ticket_id)::int AS tickets, sum(new_orders)::int AS orders, sum(new_articles)::int AS articles,
              sum(coalesce(cardinality(filled), 0))::int AS filled, count(*) FILTER (WHERE c2s)::int AS c2s, count(*) FILTER (WHERE NOT ok)::int AS failed
         FROM apsomh_ticket_assoc_log WHERE mode=$1 AND at >= $2::date AND at < ($3::date + 1) AND ($4::text IS NULL OR pipeline = $4) GROUP BY pipeline ORDER BY pipeline`, [mode, from, to, pipe]),
    q<{ ticket_id: string; at: string; pipeline: string | null; why: string; subject: string | null; orders: string[]; articles: string[]; offer_orders: string[]; new_orders: number; new_articles: number; filled: string[]; c2s: boolean; ok: boolean; error: string | null }>(
      // the tickets where something was found, or that failed - a ticket that names no order and no
      // article (a newsletter, an invoice) is counted below, not listed (SARCLA 17.10.2026: "how can
      // you backfill without data on columns")
      `SELECT ticket_id, at, pipeline, why, subject, orders, articles, offer_orders, new_orders, new_articles, filled, c2s, ok, error, coalesce(sources, '{}') AS sources
         FROM apsomh_ticket_assoc_log WHERE mode=$1 AND at >= $2::date AND at < ($3::date + 1) AND ($4::text IS NULL OR pipeline = $4)
          AND (NOT ok OR c2s OR cardinality(orders) > 0 OR cardinality(articles) > 0 OR cardinality(offer_orders) > 0 OR cardinality(filled) > 0)
        ORDER BY at DESC LIMIT 60`, [mode, from, to, pipe]),
    kvGet<LastRun>(KV.last("preview")),
    kvGet<LastRun>(KV.last("live")),
    q<{ n: number }>(
      `SELECT count(*)::int AS n FROM (SELECT ticket_id FROM apsomh_ticket_assoc_log
          WHERE mode=$1 AND at >= $2::date AND at < ($3::date + 1) AND ($4::text IS NULL OR pipeline = $4) GROUP BY ticket_id
         HAVING bool_and(ok AND NOT c2s AND coalesce(cardinality(orders), 0) = 0 AND coalesce(cardinality(articles), 0) = 0
                         AND coalesce(cardinality(offer_orders), 0) = 0 AND coalesce(cardinality(filled), 0) = 0)) x`,
      [mode, from, to, pipe]),
  ]);
  // the Articles tab: every processed ticket that named an article, a number the catalogue did not
  // know, or an eight-digit number - what the detection saw, ticket by ticket
  const [articles, alerts, lastAlerts, orderRows, totals] = await Promise.all([
    q<{ ticket_id: string; at: string; pipeline: string | null; subject: string | null; articles: string[]; rejected: string[]; products: string[]; filled: string[]; orders: string[] }>(
      // one row per ticket - its latest processing; Article(s) "filled" when any processing filled it
      `WITH p AS (SELECT * FROM apsomh_ticket_assoc_log WHERE mode=$1 AND at >= $2::date AND at < ($3::date + 1)
                    AND (cardinality(articles) > 0 OR cardinality(coalesce(rejected, '{}')) > 0 OR cardinality(coalesce(products, '{}')) > 0)
                    AND ($4::text IS NULL OR pipeline = $4)),
            s AS (SELECT ticket_id, coalesce(bool_or('article' = ANY(filled)), false) AS art FROM p GROUP BY ticket_id),
            l AS (SELECT DISTINCT ON (ticket_id) * FROM p ORDER BY ticket_id, at DESC)
       SELECT l.ticket_id, l.at, l.pipeline, l.subject, l.articles, coalesce(l.rejected, '{}') AS rejected, coalesce(l.products, '{}') AS products,
              CASE WHEN s.art AND NOT coalesce('article' = ANY(l.filled), false) THEN array_append(coalesce(l.filled, '{}'), 'article') ELSE coalesce(l.filled, '{}') END AS filled,
              l.orders, coalesce(l.sources, '{}') AS sources
         FROM l JOIN s USING (ticket_id) ORDER BY l.at DESC LIMIT 200`, [mode, from, to, pipe]),
    alertRows(from, to, pipe),
    lastAlertRun(),
    // the Orders tab (SARCLA 17.10.2026: "I don't see the order association, only the alerts"):
    // every processed ticket linked to an order - named in it, or an ESO / TSA offer's order
    q<{ ticket_id: string; at: string; pipeline: string | null; why: string; subject: string | null; orders: string[]; offer_orders: string[]; new_orders: number; filled: string[]; ok: boolean }>(
      // one row per ticket - its latest processing, with the links and the Order Number all of them wrote
      `WITH p AS (SELECT * FROM apsomh_ticket_assoc_log WHERE mode=$1 AND at >= $2::date AND at < ($3::date + 1)
                    AND (cardinality(orders) > 0 OR cardinality(offer_orders) > 0) AND ($4::text IS NULL OR pipeline = $4)),
            s AS (SELECT ticket_id, coalesce(sum(new_orders), 0)::int AS new_orders, coalesce(bool_or('order_number' = ANY(filled)), false) AS num FROM p GROUP BY ticket_id),
            l AS (SELECT DISTINCT ON (ticket_id) * FROM p ORDER BY ticket_id, at DESC)
       SELECT l.ticket_id, l.at, l.pipeline, l.why, l.subject, l.orders, l.offer_orders, s.new_orders,
              CASE WHEN s.num THEN ARRAY['order_number']::text[] ELSE '{}'::text[] END AS filled, l.ok
         FROM l JOIN s USING (ticket_id) ORDER BY l.at DESC LIMIT 200`, [mode, from, to, pipe]),
    // the tabs' tiles: counted over the whole period, each ticket once - the tables show only the
    // latest 200 tickets (SARCLA 17.10.2026: "I don't understand the top number logic" - every tile
    // read 200, the table's cap, and a ticket processed twice counted twice)
    q<{ order_tickets: number; named: number; offer: number; new_links: number; order_number: number;
        article_tickets: number; distinct_articles: number; rejected_tickets: number; article_filled: number }>(
      `SELECT count(DISTINCT ticket_id) FILTER (WHERE cardinality(orders) > 0 OR cardinality(offer_orders) > 0)::int AS order_tickets,
              count(DISTINCT ticket_id) FILTER (WHERE cardinality(orders) > 0)::int AS named,
              count(DISTINCT ticket_id) FILTER (WHERE cardinality(offer_orders) > 0)::int AS offer,
              coalesce(sum(new_orders), 0)::int AS new_links,
              count(DISTINCT ticket_id) FILTER (WHERE 'order_number' = ANY(filled))::int AS order_number,
              count(DISTINCT ticket_id) FILTER (WHERE cardinality(articles) > 0)::int AS article_tickets,
              (SELECT count(DISTINCT a)::int FROM apsomh_ticket_assoc_log l2, unnest(l2.articles) a
                 WHERE l2.mode=$1 AND l2.at >= $2::date AND l2.at < ($3::date + 1) AND ($4::text IS NULL OR l2.pipeline = $4)) AS distinct_articles,
              count(DISTINCT ticket_id) FILTER (WHERE cardinality(coalesce(rejected, '{}')) > 0)::int AS rejected_tickets,
              count(DISTINCT ticket_id) FILTER (WHERE 'article' = ANY(filled))::int AS article_filled
         FROM apsomh_ticket_assoc_log WHERE mode=$1 AND at >= $2::date AND at < ($3::date + 1) AND ($4::text IS NULL OR pipeline = $4)`,
      [mode, from, to, pipe]),
  ]);
  const backfillState = await getBackfill();
  return { settings, mode, pipeline: pipe, backfill: backfillState, byPipeline, recent, nothingFound: nothing[0]?.n ?? 0, articles, orderRows, totals: totals[0], alerts, lastAlerts, last: { preview: lastPreview ?? null, live: lastLive ?? null }, everyMinutes: EVERY_MS / 60_000, alertsEveryMinutes: ALERTS_EVERY_MS / 60_000 };
}

/* ── the schedule ──────────────────────────────────────────────────────── */

let started = false;
let running = false;

/** Every 3 minutes, from the first minute after boot. TICKET_ASSOC=off stops it entirely. */
export function startTicketAssoc() {
  if (started || process.env.TICKET_ASSOC === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const limit = new AbortController();
    const timer = setTimeout(() => {
      console.error(`[ticket-assoc] run still going after ${LIMIT_MS / 60_000} min - stopped and its lock dropped`);
      limit.abort();
      running = false;
    }, LIMIT_MS);
    timer.unref?.();
    void runOnce(limit.signal)
      .catch((e) => console.warn(`[ticket-assoc] ${(e as Error).message}`))
      .finally(() => {
        clearTimeout(timer);
        if (!limit.signal.aborted) running = false;
      });
  };
  setTimeout(tick, 60_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}
