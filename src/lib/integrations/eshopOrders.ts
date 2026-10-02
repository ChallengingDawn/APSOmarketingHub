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

const PAGE = 100;
/** A guard, not a quota. Reported rather than applied silently - see `capped`. */
const MAX_ORDERS = 6000;

export type CompanyOrders = { orders: number; value: number };
export type OrdersInPeriod = {
  byCompany: Record<string, CompanyOrders>;
  scanned: number;
  capped: boolean;
  unattributed: number;
};

/** "YYYY-MM-DD" to UTC midnight, never through local time. */
const dayMs = (iso: string) =>
  Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

type OrderResult = { id: string; properties?: Record<string, string | null> };

export async function fetchOrdersByCompany(from: string, to: string, signal?: AbortSignal): Promise<OrdersInPeriod> {
  const orders: OrderResult[] = [];
  let after: string | undefined;
  let capped = false;

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
        properties: ["order_total_net_revenue"],
        sorts: [{ propertyName: "order_order_date", direction: "DESCENDING" }],
        limit: PAGE,
        after,
      },
    });
    orders.push(...(res.results ?? []));
    after = res.paging?.next?.after;
    if (orders.length >= MAX_ORDERS) { capped = true; break; }
  } while (after);

  const value = new Map(orders.map((o) => [String(o.id), Number(o.properties?.order_total_net_revenue ?? 0) || 0]));
  const byCompany: Record<string, CompanyOrders> = {};
  let unattributed = 0;

  // One batch read per 100 orders resolves which customer each belongs to. The
  // association is what the order connector maintains; the customer number on
  // the order is often empty, so it cannot be the join.
  for (let i = 0; i < orders.length; i += PAGE) {
    const slice = orders.slice(i, i + PAGE);
    const res = await hubspotFetchJson<{ results?: { from?: { id?: string }; to?: { toObjectId?: string | number }[] }[] }>({
      path: "/crm/v4/associations/orders/companies/batch/read",
      method: "POST",
      signal,
      body: { inputs: slice.map((o) => ({ id: String(o.id) })) },
    });
    for (const r of res.results ?? []) {
      const companyId = r.to?.[0]?.toObjectId;
      const orderId = r.from?.id;
      if (companyId == null || orderId == null) { unattributed++; continue; }
      const key = String(companyId);
      const cur = byCompany[key] ?? { orders: 0, value: 0 };
      cur.orders += 1;
      cur.value += value.get(String(orderId)) ?? 0;
      byCompany[key] = cur;
    }
  }

  return { byCompany, scanned: orders.length, capped, unattributed };
}

/** Each order carries up to 80 lines, denormalised onto the order record. */
const LINE_FIELDS = ["article", "text", "qty", "revenue"] as const;
const lineProp = (n: number, f: string) => `order_line_${String(n + 1).padStart(2, "0")}_${f}`;

export type OrderedLine = {
  article: string;
  description: string | null;
  qty: number | null;
  revenue: number | null;
  orders: number;
  /** Ordered through the webshop. Such an order went through the cart and a
   *  login by construction - it cannot be placed any other way. */
  eshop: boolean;
};

/**
 * What one customer actually ORDERED in the window, article by article.
 *
 * This is the half of the desktop tracker's "Views - Orders" tab that no
 * browser event can supply: Metrohm AG placed the largest order of 2 October
 * and the activity feed recorded one login and zero views, because the article
 * is chosen on the page and the order is placed from the cart. The order lines
 * know exactly which articles, how many and for how much.
 */
export async function fetchCompanyOrderLines(
  companyId: string, from: string, to: string, signal?: AbortSignal,
): Promise<OrderedLine[]> {
  const props = ["order_order_date", "order_channel"];
  for (let i = 0; i < 80; i++) for (const f of LINE_FIELDS) props.push(lineProp(i, f));

  const res = await hubspotFetchJson<{ results?: { properties?: Record<string, string | null> }[] }>({
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

  const byArticle = new Map<string, OrderedLine>();
  for (const o of res.results ?? []) {
    const p = o.properties ?? {};
    for (let i = 0; i < 80; i++) {
      const article = p[lineProp(i, "article")];
      if (!article) continue;
      const cur = byArticle.get(article)
        ?? { article, description: null, qty: 0, revenue: 0, orders: 0, eshop: false };
      cur.orders += 1;
      cur.qty = (cur.qty ?? 0) + (Number(p[lineProp(i, "qty")]) || 0);
      cur.revenue = (cur.revenue ?? 0) + (Number(p[lineProp(i, "revenue")]) || 0);
      // `text` is often empty on ERP lines; the description is filled in from
      // Products & Pricing afterwards rather than left blank.
      cur.description = cur.description ?? (p[lineProp(i, "text")] || null);
      if (String(p.order_channel ?? "").toLowerCase() === "eshop") cur.eshop = true;
      byArticle.set(article, cur);
    }
  }
  return [...byArticle.values()].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0));
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
