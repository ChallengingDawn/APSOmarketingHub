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
