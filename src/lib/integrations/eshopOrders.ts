// SHOP ORDERS IN A PERIOD, PER CUSTOMER.
//
// The desktop E-Shop Data Tracker puts Orders and Total value beside Logins and
// Views. Those do NOT come from the shop activity feed - they come from the
// order records - so a customer who ordered without being seen browsing still
// appears in the list. That is the case that looked like a hole in the live
// feed: Nitrochemie Wimmis AG ordered on 2 October and had no view that day.
//
// Value is `order_total_net_revenue`, the NET figure, because that is what the
// desktop tracker shows. On the same order hs_total_price reads 986.45 and the
// tracker reads 899.55 - the difference is VAT, and quoting the gross number
// beside the tracker's net one would look like a bug in whichever we published.
//
// Dates: `order_order_date` is the real order date and IS filterable. Not
// hs_createdate - the ERP history was bulk-loaded, so its creation dates are
// load dates and any range longer than a few weeks would be nonsense.

import { hubspotFetchJson } from "./hubspot";
import { mergeOrderLines, type OrderDoc, type OrderedLine } from "@/lib/datatracker/orderLines";

const PAGE = 100;
/** A guard, not a quota. Reported rather than applied silently - see `capped`. */
const MAX_ORDERS = 6000;

export type CompanyOrders = { orders: number; value: number };
export type OrdersInPeriod = {
  byCompany: Record<string, CompanyOrders>;
  scanned: number;
  capped: boolean;
  unattributed: number;
  /** Scanned but not counted: orders that did not come through the shop. */
  offChannel: number;
};

/** "YYYY-MM-DD" to UTC midnight, never through local time. */
const dayMs = (iso: string) =>
  Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

type OrderResult = { id: string; properties?: Record<string, string | null> };
type AssocResult = { results?: { from?: { id?: string }; to?: { toObjectId?: string | number }[] }[] };

export async function fetchOrdersByCompany(from: string, to: string, signal?: AbortSignal): Promise<OrdersInPeriod> {
  const orders: OrderResult[] = [];
  let after: string | undefined;
  let capped = false;

  const readAssoc = (slice: OrderResult[]) =>
    hubspotFetchJson<AssocResult>({
      path: "/crm/v4/associations/orders/companies/batch/read",
      method: "POST",
      signal,
      body: { inputs: slice.map((o) => ({ id: String(o.id) })) },
    });
  const assoc: Promise<AssocResult>[] = [];

  try {
    do {
      const res = await hubspotFetchJson<{ results?: OrderResult[]; paging?: { next?: { after?: string } } }>({
        path: "/crm/v3/objects/orders/search",
        method: "POST",
        signal,
        body: {
          filterGroups: [{ filters: [
            { propertyName: "order_order_date", operator: "GTE", value: String(dayMs(from)) },
            // LTE against the END of the closing day, so "today to today" includes today.
            { propertyName: "order_order_date", operator: "LTE", value: String(dayMs(to) + 86_399_999) },
          ] }],
          // The channel decides whether an order belongs on an E-SHOP tracker at
          // all. Read and compared here rather than filtered in the search: the
          // stored casing is not ours to assume, and at this volume the whole
          // window fits inside one scan anyway.
          properties: ["order_total_net_revenue", "order_channel"],
          sorts: [{ propertyName: "order_order_date", direction: "DESCENDING" }],
          limit: PAGE,
          after,
        },
      });
      const page = res.results ?? [];
      orders.push(...page);
      // Fire this page's attribution NOW rather than after the last page. The
      // two endpoints are different rate-limit buckets, so a page's assignment
      // travels while the next page is still being fetched - and a quarter stops
      // costing sixty search calls PLUS sixty association calls end to end.
      if (page.length) assoc.push(readAssoc(page));
      after = res.paging?.next?.after;
      if (orders.length >= MAX_ORDERS) { capped = true; break; }
    } while (after);
  } catch (err) {
    // Drain what is already in flight, or a second failure lands as an
    // unhandled rejection and masks this one.
    await Promise.allSettled(assoc);
    throw err;
  }

  // An order placed anywhere else cannot have a login or a view behind it, so
  // counting it here produced rows that were impossible by construction: a
  // customer with orders, no logins and no views.
  const shop = orders.filter((o) => String(o.properties?.order_channel ?? "").toLowerCase() === "eshop");
  const offChannel = orders.length - shop.length;
  const value = new Map(shop.map((o) => [String(o.id), Number(o.properties?.order_total_net_revenue ?? 0) || 0]));
  const byCompany: Record<string, CompanyOrders> = {};
  let unattributed = 0;

  // One batch read per 100 orders resolves which customer each belongs to. The
  // association is what the order connector maintains; the customer number on
  // the order is often empty, so it cannot be the join. These calls were issued
  // page by page above, so by here most have already come back.
  for (const res of await Promise.all(assoc)) {
    for (const r of res.results ?? []) {
      const companyId = r.to?.[0]?.toObjectId;
      const orderId = r.from?.id;
      // The attribution read covers every order on the page; only the shop ones
      // are in `value`, so anything else drops out here.
      if (orderId == null || !value.has(String(orderId))) continue;
      if (companyId == null) { unattributed++; continue; }
      const key = String(companyId);
      const cur = byCompany[key] ?? { orders: 0, value: 0 };
      cur.orders += 1;
      cur.value += value.get(String(orderId)) ?? 0;
      byCompany[key] = cur;
    }
  }

  return { byCompany, scanned: orders.length, capped, unattributed, offChannel };
}

/** Each order carries up to 80 lines, denormalised onto the order record. */
const LINE_FIELDS = ["article", "text", "qty", "revenue"] as const;
const lineProp = (n: number, f: string) => `order_line_${String(n + 1).padStart(2, "0")}_${f}`;

export type { OrderedLine } from "@/lib/datatracker/orderLines";

/**
 * What one customer actually ORDERED in the window, article by article, and
 * from which order.
 *
 * This is the half of the desktop tracker's "Views - Orders" tab that no
 * browser event can supply: Metrohm AG placed the largest order of 2 October
 * and the activity feed recorded one login and zero views, because the article
 * is chosen on the page and the order is placed from the cart. The order lines
 * know exactly which articles, how many and for how much - and the order knows
 * the day, its number and who placed it.
 */
export async function fetchCompanyOrderLines(
  companyId: string, from: string, to: string, signal?: AbortSignal,
): Promise<OrderedLine[]> {
  const props = ["order_order_date", "order_channel", "order_order_number", "hs_order_name", "hs_billing_address_email", "order_web_order_number"];
  for (let i = 0; i < 80; i++) for (const f of LINE_FIELDS) props.push(lineProp(i, f));

  const res = await hubspotFetchJson<{ results?: { id?: string; properties?: Record<string, string | null> }[] }>({
    path: "/crm/v3/objects/orders/search",
    method: "POST",
    signal,
    body: {
      filterGroups: [{ filters: [
        { propertyName: "associations.company", operator: "EQ", value: companyId },
        { propertyName: "order_order_date", operator: "GTE", value: String(dayMs(from)) },
        { propertyName: "order_order_date", operator: "LTE", value: String(dayMs(to) + 86_399_999) },
      ] }],
      properties: props,
      sorts: [{ propertyName: "order_order_date", direction: "DESCENDING" }],
      limit: 100,
    },
  });
  const results = (res.results ?? []).filter((o) => o.id);

  // Who placed each order: one batch read for the whole window. A failure costs
  // the names and nothing else - the reference on the title still names most.
  const contactOf = new Map<string, string>();
  if (results.length) {
    try {
      const assoc = await hubspotFetchJson<AssocResult>({
        path: "/crm/v4/associations/orders/contacts/batch/read",
        method: "POST",
        signal,
        body: { inputs: results.map((o) => ({ id: String(o.id) })) },
      });
      for (const r of assoc.results ?? []) {
        const to = r.to?.[0]?.toObjectId;
        if (r.from?.id && to != null) contactOf.set(String(r.from.id), String(to));
      }
    } catch { /* the names are a courtesy; the lines stand without them */ }
  }

  const docs: OrderDoc[] = results.map((o) => {
    const p = o.properties ?? {};
    const lines: OrderDoc["lines"] = [];
    for (let i = 0; i < 80; i++) {
      const article = p[lineProp(i, "article")];
      if (!article) continue;
      lines.push({
        article,
        // `text` is often empty on ERP lines; the description is filled in from
        // Products & Pricing afterwards rather than left blank.
        text: p[lineProp(i, "text")] || null,
        qty: Number(p[lineProp(i, "qty")]) || 0,
        revenue: Number(p[lineProp(i, "revenue")]) || 0,
      });
    }
    return {
      id: String(o.id),
      number: p.order_order_number || null,
      web: p.order_web_order_number || null,
      date: (p.order_order_date ?? "").slice(0, 10) || null,
      eshop: String(p.order_channel ?? "").toLowerCase() === "eshop",
      title: p.hs_order_name ?? null,
      contactId: contactOf.get(String(o.id)) ?? null,
      email: p.hs_billing_address_email || null,
      lines,
    };
  });
  return mergeOrderLines(docs);
}

/** Fills in the descriptions the order lines did not carry. */
export async function describeArticles(articles: string[], signal?: AbortSignal): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < articles.length; i += 100) {
    const slice = articles.slice(i, i + 100);
    const res = await hubspotFetchJson<{ results?: { properties?: Record<string, string | null> }[] }>({
      path: "/crm/v3/objects/2-200042439/search",
      method: "POST",
      signal,
      body: {
        filterGroups: [{ filters: [{ propertyName: "article_number", operator: "IN", values: slice }] }],
        properties: ["article_number", "article_description"],
        limit: 100,
      },
    });
    for (const r of res.results ?? []) {
      const a = r.properties?.article_number;
      const d = r.properties?.article_description;
      if (a && d) out[a] = d;
    }
  }
  return out;
}

/**
 * Which articles this customer buys at all — the 100 most recent orders.
 *
 * Used to tick "Ordered" against something they merely looked at. Deliberately
 * bounded: a customer with ten years of history does not need a full scan to
 * answer whether today's look is something they buy, and this runs once, when
 * a row is opened.
 */
export async function fetchOrderedArticles(companyId: string, signal?: AbortSignal): Promise<string[]> {
  const props: string[] = [];
  for (let i = 0; i < 80; i++) props.push(lineProp(i, "article"));
  const res = await hubspotFetchJson<{ results?: { properties?: Record<string, string | null> }[] }>({
    path: "/crm/v3/objects/orders/search",
    method: "POST",
    signal,
    body: {
      filterGroups: [{ filters: [{ propertyName: "associations.company", operator: "EQ", value: companyId }] }],
      properties: props,
      sorts: [{ propertyName: "hs_createdate", direction: "DESCENDING" }],
      limit: 100,
    },
  });
  const out = new Set<string>();
  for (const o of res.results ?? []) for (const k of props) {
    const v = o.properties?.[k];
    if (v) out.add(String(v));
  }
  return [...out];
}
