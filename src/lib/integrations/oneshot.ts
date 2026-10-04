// ONE-SHOT ACTIONS - where the rows come from.
//
// The target lists were built once, by hand, and uploaded to the Compass
// connector; the hub imports each one ONCE over the connector's read-only key and
// keeps it in its own database, so after that first read nothing here needs the
// connector. Tickets, the customers' companies and their orders are read live out
// of HubSpot with the tickets token, the way service/sept_push.py and
// service/marc_push.py read them - with one change: searches page by object id,
// so a month with more than 10,000 orders is read to the end instead of stopping.

import { kvGet, kvSet } from "@/lib/db/init";
import { connectorGet } from "@/lib/erosion/run";
import { hubspotFetchJson } from "./hubspot";
import { IntegrationError } from "./status";
import {
  CAMPAIGNS, isoDay,
  type CampaignId, type Order, type PushCard, type PushData, type PushMeta, type PushOrder, type PushTarget,
  type PushTicket, type ReCard, type ReTarget, type ReTicket, type ReactivationData,
} from "../oneshot/model";

const TTL_MS: Record<CampaignId, number> = { sept: 30 * 60_000, marc: 5 * 60_000, nancy: 5 * 60_000 };
const MAX_PAGES = 400;

type SearchPage = { results?: { id: string; properties?: Record<string, string | null> }[] };
type TargetsDoc<T> = { meta: Record<string, unknown>; items: T[] };
export type Held<T> = { at: string; doc: TargetsDoc<T> };

const targetsKey = (c: CampaignId) => `oneshot:targets:${c}`;
const utcMs = (iso: string) => String(Date.parse(`${iso}T00:00:00Z`));
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : "") || null;

/** The target list: the hub's own copy, imported from the connector the first time it is asked for. */
export async function targets<T>(c: CampaignId): Promise<Held<T>> {
  const held = await kvGet<Held<T>>(targetsKey(c));
  if (held?.doc?.items?.length) return held;
  const doc = await connectorGet<TargetsDoc<T> & { error?: string }>(CAMPAIGNS[c].targetsPath);
  if (!Array.isArray(doc.items) || !doc.items.length) {
    throw new IntegrationError(`The connector has no target list for ${CAMPAIGNS[c].name}${doc.error ? `: ${doc.error}` : ""}.`);
  }
  const fresh = { at: new Date().toISOString(), doc: { meta: doc.meta ?? {}, items: doc.items } };
  await kvSet(targetsKey(c), fresh);
  return fresh;
}

/** Search every page, by object id - no 10,000-result ceiling. */
async function searchAll(path: string, filters: object[], properties: string[], signal?: AbortSignal, limit = 200) {
  const out: { id: string; properties: Record<string, string | null> }[] = [];
  let cursor = "0";
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await hubspotFetchJson<SearchPage>({
      path, method: "POST", useTicketsToken: true, signal,
      body: {
        filterGroups: [{ filters: [...filters, { propertyName: "hs_object_id", operator: "GT", value: cursor }] }],
        sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
        properties, limit,
      },
    });
    const rows = res.results ?? [];
    for (const r of rows) out.push({ id: r.id, properties: r.properties ?? {} });
    if (rows.length < limit) return out;
    cursor = rows[rows.length - 1].id;
  }
  throw new IntegrationError(`HubSpot search ${path} did not finish in ${MAX_PAGES} pages - refusing a partial read.`);
}

/** Stage id -> label and both "closed" readings the two scoreboards used. */
async function stages(signal?: AbortSignal) {
  const res = await hubspotFetchJson<{
    results?: { stages?: { id: string; label?: string; metadata?: { ticketState?: unknown; isClosed?: unknown } }[] }[];
  }>({ path: "/crm/v3/pipelines/tickets", useTicketsToken: true, signal });
  const out = new Map<string, { label: string; stateClosed: boolean; isClosed: boolean }>();
  for (const p of res.results ?? []) {
    for (const s of p.stages ?? []) {
      out.set(s.id, {
        label: s.label ?? s.id,
        stateClosed: String(s.metadata?.ticketState ?? "").toUpperCase() === "CLOSED",
        isClosed: s.metadata?.isClosed === true || s.metadata?.isClosed === "true",
      });
    }
  }
  return out;
}

/* ── reactivation ──────────────────────────────────────────────────────── */

/** Ticket -> company, then the company's last contact and last logged call. Best effort: the board says so when it fails. */
async function companySignals(ticketIds: string[], signal?: AbortSignal) {
  const company = new Map<string, string>();
  for (let i = 0; i < ticketIds.length; i += 100) {
    const r = await hubspotFetchJson<{ results?: { from?: { id?: string }; to?: { toObjectId?: number | string }[] }[] }>({
      path: "/crm/v4/associations/tickets/companies/batch/read", method: "POST", useTicketsToken: true, signal,
      body: { inputs: ticketIds.slice(i, i + 100).map((id) => ({ id })) },
    });
    for (const row of r.results ?? []) {
      const to = row.to?.[0]?.toObjectId;
      if (row.from?.id && to !== undefined) company.set(String(row.from.id), String(to));
    }
  }
  const ids = [...new Set(company.values())];
  const props = new Map<string, { lastContacted: string | null; lastCall: string | null }>();
  for (let i = 0; i < ids.length; i += 100) {
    const r = await hubspotFetchJson<{ results?: { id: string; properties?: Record<string, string | null> }[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST", useTicketsToken: true, signal,
      body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: ["notes_last_contacted", "hs_last_logged_call_date"] },
    });
    for (const row of r.results ?? []) {
      props.set(row.id, { lastContacted: day(row.properties?.notes_last_contacted), lastCall: day(row.properties?.hs_last_logged_call_date) });
    }
  }
  return { company, props };
}

export async function loadReactivation(
  c: "marc" | "nancy", held: Held<ReTarget>, signal?: AbortSignal,
): Promise<ReactivationData & { contactSignal: boolean }> {
  const camp = CAMPAIGNS[c];
  const px = camp.prefix!;
  const items = new Map(held.doc.items.map((i) => [i.un, i]));

  const st = await stages(signal);
  const rows = await searchAll("/crm/v3/objects/tickets/search", [{ propertyName: `${px}_key`, operator: "HAS_PROPERTY" }], [
    "subject", "hs_pipeline_stage", "closed_date", "ticket_resolution_eso", "hs_last_activity_date", "hs_num_times_contacted", `${px}_key`,
  ], signal, 100);
  const tickets = new Map<string, ReTicket>();
  for (const r of rows) {
    const p = r.properties;
    const un = (p[`${px}_key`] ?? "").split("|")[0];
    const s = st.get(p.hs_pipeline_stage ?? "");
    tickets.set(un, {
      id: r.id,
      stage: s?.label ?? p.hs_pipeline_stage ?? "",
      closed: (s?.stateClosed ?? false) || !!p.closed_date,
      resolution: p.ticket_resolution_eso ?? null,
      lastActivity: day(p.hs_last_activity_date),
      contacted: Math.trunc(num(p.hs_num_times_contacted)),
    });
  }

  let signals: Awaited<ReturnType<typeof companySignals>> | null = null;
  try {
    signals = await companySignals([...tickets.values()].map((t) => t.id), signal);
  } catch (e) {
    console.warn(`[oneshot] ${c}: company contact dates unavailable: ${(e as Error).message}`);
  }

  const orders = new Map<string, Order[]>();
  const orderRows = await searchAll("/crm/v3/objects/orders/search", [
    { propertyName: "order_order_date", operator: "GTE", value: utcMs(camp.start) },
    { propertyName: "order_order_type", operator: "EQ", value: "Order" },
  ], ["order_order_number", "order_order_date", "order_mandant", "order_customer_number", "order_total_net_revenue", "order_order_source"], signal);
  for (const r of orderRows) {
    const p = r.properties;
    const un = `${p.order_mandant}-${p.order_customer_number}`;
    if (!items.has(un)) continue;
    const list = orders.get(un) ?? [];
    list.push({ no: p.order_order_number ?? "", date: day(p.order_order_date) ?? "", rev: num(p.order_total_net_revenue), src: p.order_order_source ?? null });
    orders.set(un, list);
  }

  const cards: ReCard[] = [...items.values()].map((i) => {
    const t = tickets.get(i.un) ?? null;
    const companyId = t ? signals?.company.get(t.id) ?? null : null;
    const sig = companyId ? signals?.props.get(companyId) : undefined;
    return {
      un: i.un, name: i.name, value: num(i.value), potential: num(i.potential), reason: i.reason ?? "", source: i.source ?? "",
      ticket: t, companyId, lastContacted: sig?.lastContacted ?? null, lastCall: sig?.lastCall ?? null,
      orders: (orders.get(i.un) ?? []).sort((a, b) => b.date.localeCompare(a.date)),
    };
  });

  return {
    campaign: c, today: isoDay(Date.now()), generated: new Date().toISOString(), targetsImported: held.at,
    ticketsFound: tickets.size, cards, contactSignal: signals !== null,
  };
}

/* ── September push ────────────────────────────────────────────────────── */

export async function loadPush(held: Held<PushTarget>, signal?: AbortSignal): Promise<PushData> {
  const meta = held.doc.meta as unknown as PushMeta;
  const m0 = meta.month_start;
  const m1 = isoDay(Date.UTC(+m0.slice(0, 4), +m0.slice(5, 7), 1));
  const wanted = new Set(held.doc.items.map((i) => i.un));

  const orderRows = await searchAll("/crm/v3/objects/orders/search", [
    { propertyName: "order_order_date", operator: "GTE", value: utcMs(m0) },
    { propertyName: "order_order_date", operator: "LT", value: utcMs(m1) },
  ], ["order_order_number", "order_order_date", "order_mandant", "order_customer_number", "order_total_net_revenue", "order_order_source", "order_profit_center"], signal);
  const daily = new Map<string, { rev: number; orders: number }>();
  const byUn = new Map<string, PushOrder[]>();
  for (const r of orderRows) {
    const p = r.properties;
    const o: PushOrder = {
      no: p.order_order_number ?? "", date: day(p.order_order_date) ?? "", rev: num(p.order_total_net_revenue),
      src: p.order_order_source ?? null, pc: p.order_profit_center ?? null,
    };
    if (o.date) {
      const d = daily.get(o.date) ?? { rev: 0, orders: 0 };
      d.rev += o.rev; d.orders += 1;
      daily.set(o.date, d);
    }
    const un = `${p.order_mandant}-${p.order_customer_number}`;
    if (wanted.has(un) && o.date >= meta.start) byUn.set(un, [...(byUn.get(un) ?? []), o]);
  }

  const st = await stages(signal);
  const rows = await searchAll("/crm/v3/objects/tickets/search", [{ propertyName: "sept_push_key", operator: "HAS_PROPERTY" }], [
    "subject", "hs_pipeline_stage", "closed_date", "ticket_resolution_eso", "more_information_about_the_ticket_resolution_eso",
    "sept_push_key", "hs_last_activity_date",
  ], signal, 100);
  const tickets = new Map<string, PushTicket>();
  for (const r of rows) {
    const p = r.properties;
    const s = st.get(p.hs_pipeline_stage ?? "");
    tickets.set((p.sept_push_key ?? "").split("|")[0], {
      id: r.id,
      stage: s?.label ?? p.hs_pipeline_stage ?? "",
      closed: (s?.isClosed ?? false) || !!p.closed_date,
      resolution: p.ticket_resolution_eso ?? null,
      resolutionDetail: p.more_information_about_the_ticket_resolution_eso ?? null,
      lastActivity: day(p.hs_last_activity_date),
    });
  }

  const cards: PushCard[] = held.doc.items.map((i) => ({
    ...i,
    to_get: num(i.to_get), target: num(i.target), baseline: num(i.baseline), booked_before: num(i.booked_before),
    r25: num(i.r25), r26: num(i.r26), sep25: num(i.sep25), offer_amt: num(i.offer_amt), ero_amt: num(i.ero_amt),
    reasons: Array.isArray(i.reasons) ? i.reasons : [],
    ticket: tickets.get(i.un) ?? null,
    orders: (byUn.get(i.un) ?? []).sort((a, b) => b.date.localeCompare(a.date)),
  }));

  return {
    campaign: "sept", today: isoDay(Date.now()), generated: new Date().toISOString(), targetsImported: held.at,
    meta, ticketsFound: tickets.size,
    daily: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, ...d })),
    cards,
  };
}

/* ── the cache in front of both ────────────────────────────────────────── */

export type OneShotData = (ReactivationData & { contactSignal: boolean }) | PushData;

const cache = new Map<CampaignId, { at: number; p: Promise<OneShotData> }>();

export async function oneShotData(c: CampaignId, opts: { refresh?: boolean } = {}): Promise<OneShotData> {
  const hit = cache.get(c);
  if (hit && !opts.refresh && Date.now() - hit.at < TTL_MS[c]) return hit.p;
  // the shared read is not tied to one viewer's request: closing a tab must not abort it for everyone
  const p = c === "sept"
    ? targets<PushTarget>("sept").then((h) => loadPush(h))
    : targets<ReTarget>(c).then((h) => loadReactivation(c, h));
  cache.set(c, { at: Date.now(), p });
  p.catch(() => { if (cache.get(c)?.p === p) cache.delete(c); });
  return p;
}
