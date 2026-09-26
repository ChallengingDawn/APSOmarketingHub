// CUSTOMER TYPES — every order in the window sorted into new, active or
// reactivated, at COMPANY level, from our own order history.
//
//   new          the company had never ordered before this order
//   active       its previous order was at most 365 days earlier
//   reactivated  its previous order was older than that
//
// This is the same rule the Google Ads tag sends with each purchase, so the
// split here is what smec should see in their account once the three bucket
// conversions are live. Counting it ourselves also shows the part Google never
// sees: orders from store views without a conversion tag, and from customers
// who declined tracking.
//
// Cost: the window plus thirteen months of history have to be read to know what
// came before each order — roughly 400 search calls for a 90-day window. It is
// cached for twelve hours and the window is capped, because this is a shape
// that changes slowly, not a live counter.

import { hubspotFetchJson } from "./hubspot";

export type CustomerTypeMonth = {
  month: string;                 // YYYY-MM
  orders: number;
  new: number;
  active: number;
  reactivated: number;
  unknown: number;               // no company on the order — we refuse to guess
};

export type CustomerTypes = {
  months: CustomerTypeMonth[];
  totals: Omit<CustomerTypeMonth, "month">;
  from: string;
  to: string;
  historyFrom: string;
  webOrders: number;             // how many of the classified orders came from the shop
  generatedAt: string;
};

const DAY_MS = 86_400_000;
const ACTIVE_DAYS = 365;
/** Thirteen months of history is what the 12-month boundary needs, plus a month of slack. */
const HISTORY_MONTHS = 13;
/** A longer window would read most of the order object on every refresh. */
export const MAX_WINDOW_DAYS = 92;

/** What the count is doing right now, so a slow report can say so instead of just spinning. */
export type CustomerTypesProgress = { phase: "orders" | "companies" | "history" | "sorting"; orders: number; linked: number };
let progress: CustomerTypesProgress = { phase: "orders", orders: 0, linked: 0 };

const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

type OrderRow = { id: string; date: string; web: boolean };

/** Orders by order date, in month slices, walking id windows (search stops paging at 10,000). */
async function scanOrders(from: string, to: string, signal?: AbortSignal): Promise<OrderRow[]> {
  const out: OrderRow[] = [];
  for (let cursor = dayMs(from); cursor <= dayMs(to); ) {
    const d = new Date(cursor);
    const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    let lastId = "0";
    for (;;) {
      let after: string | undefined;
      let got = 0;
      let pageLast: string | null = null;
      do {
        const res = await hubspotFetchJson<{
          results?: { id?: string; properties?: Record<string, string | null> }[];
          paging?: { next?: { after?: string } };
        }>({
          path: "/crm/v3/objects/orders/search",
          method: "POST",
          body: {
            filterGroups: [{ filters: [
              { propertyName: "order_order_date", operator: "GTE", value: String(cursor) },
              { propertyName: "order_order_date", operator: "LT", value: String(next) },
              { propertyName: "hs_object_id", operator: "GT", value: lastId },
            ] }],
            properties: ["order_order_date", "order_order_type", "hs_external_order_status", "order_source_system"],
            sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
            limit: 200,
            after,
          },
          signal,
        });
        progress = { ...progress, phase: "orders", orders: out.length };
        for (const row of res.results ?? []) {
          const p = row.properties ?? {};
          const date = (p.order_order_date ?? "").slice(0, 10);
          const status = (p.hs_external_order_status ?? "").toLowerCase();
          const credit = (p.order_order_type ?? "").toLowerCase().includes("credit");
          // A credit note is not a purchase and a cancelled web order never happened.
          if (date && !credit && status !== "canceled" && status !== "cancelled" && row.id) {
            out.push({ id: row.id, date, web: (p.order_source_system ?? "") === "magento" });
          }
          if (row.id) pageLast = row.id;
          got++;
        }
        after = res.paging?.next?.after;
      } while (after && got < 9000);
      if (!got || !pageLast) break;
      lastId = pageLast;
    }
    cursor = next;
  }
  return out;
}

/** order id -> company id, in batches of 1,000. */
async function companiesOf(ids: string[], signal?: AbortSignal): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 1000) {
    const res = await hubspotFetchJson<{
      results?: { from?: { id?: string }; to?: { toObjectId?: number | string }[] }[];
    }>({
      path: "/crm/v4/associations/orders/companies/batch/read",
      method: "POST",
      body: { inputs: ids.slice(i, i + 1000).map((id) => ({ id })) },
      signal,
    });
    for (const row of res.results ?? []) {
      const orderId = row.from?.id;
      const companyId = row.to?.[0]?.toObjectId;
      if (orderId && companyId != null) out.set(orderId, String(companyId));
    }
    progress = { ...progress, phase: "companies", linked: out.size };
  }
  return out;
}

/** The ERP-fed year fields decide new from reactivated for buyers older than the scan. */
async function firstOrderYears(companyIds: string[], signal?: AbortSignal): Promise<Map<string, boolean>> {
  const hasHistory = new Map<string, boolean>();
  for (let i = 0; i < companyIds.length; i += 100) {
    const res = await hubspotFetchJson<{ results?: { id?: string; properties?: Record<string, string | null> }[] }>({
      path: "/crm/v3/objects/companies/batch/read",
      method: "POST",
      body: {
        inputs: companyIds.slice(i, i + 100).map((id) => ({ id })),
        properties: ["compass_first_order_year", "compass_last_order_year"],
      },
      signal,
    });
    for (const row of res.results ?? []) {
      const p = row.properties ?? {};
      if (row.id) hasHistory.set(row.id, Boolean(p.compass_first_order_year || p.compass_last_order_year));
    }
  }
  return hasHistory;
}

export async function fetchCustomerTypes(params: {
  from: string;
  to: string;
  signal?: AbortSignal;
}): Promise<CustomerTypes> {
  const to = params.to;
  const from = isoDay(Math.max(dayMs(params.from), dayMs(to) - (MAX_WINDOW_DAYS - 1) * DAY_MS));
  const historyStart = new Date(dayMs(from));
  historyStart.setUTCMonth(historyStart.getUTCMonth() - HISTORY_MONTHS);
  historyStart.setUTCDate(1);
  const historyFrom = isoDay(historyStart.getTime());

  const orders = await scanOrders(historyFrom, to, params.signal);
  const byOrder = await companiesOf(orders.map((o) => o.id), params.signal);

  // Every company's order days, sorted, so "the one before this order" is a lookup.
  const byCompany = new Map<string, string[]>();
  for (const o of orders) {
    const cid = byOrder.get(o.id);
    if (!cid) continue;
    const list = byCompany.get(cid);
    if (list) list.push(o.date);
    else byCompany.set(cid, [o.date]);
  }
  for (const list of byCompany.values()) list.sort();

  const inWindow = orders.filter((o) => o.date >= from && o.date <= to);

  // Companies whose first order inside the scan falls in the window could be new —
  // ask the ERP year fields whether they were buying before the scan began.
  const candidates = new Set<string>();
  for (const o of inWindow) {
    const cid = byOrder.get(o.id);
    if (!cid) continue;
    const days = byCompany.get(cid) ?? [];
    if (!days.some((d) => d < o.date)) candidates.add(cid);
  }
  progress = { ...progress, phase: "history" };
  const olderHistory = candidates.size
    ? await firstOrderYears([...candidates], params.signal)
    : new Map<string, boolean>();
  progress = { ...progress, phase: "sorting" };

  const months = new Map<string, CustomerTypeMonth>();
  const blank = (month: string): CustomerTypeMonth =>
    ({ month, orders: 0, new: 0, active: 0, reactivated: 0, unknown: 0 });
  let webOrders = 0;

  for (const o of inWindow) {
    const month = o.date.slice(0, 7);
    const row = months.get(month) ?? blank(month);
    row.orders++;
    if (o.web) webOrders++;
    const cid = byOrder.get(o.id);
    if (!cid) {
      row.unknown++;
      months.set(month, row);
      continue;
    }
    const days = byCompany.get(cid) ?? [];
    let previous: string | null = null;
    for (const d of days) {
      if (d < o.date) previous = d;      // sorted ascending: the last one below wins
      else break;
    }
    if (previous) {
      const age = (dayMs(o.date) - dayMs(previous)) / DAY_MS;
      if (age <= ACTIVE_DAYS) row.active++;
      else row.reactivated++;
    } else if (olderHistory.get(cid)) {
      row.reactivated++;                  // bought before our scan window, long ago
    } else {
      row.new++;
    }
    months.set(month, row);
  }

  const list: CustomerTypeMonth[] = [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
  const totals = list.reduce(
    (acc, m) => ({
      orders: acc.orders + m.orders,
      new: acc.new + m.new,
      active: acc.active + m.active,
      reactivated: acc.reactivated + m.reactivated,
      unknown: acc.unknown + m.unknown,
    }),
    { orders: 0, new: 0, active: 0, reactivated: 0, unknown: 0 },
  );

  return { months: list, totals, from, to, historyFrom, webOrders, generatedAt: new Date().toISOString() };
}

/* ── caching ──────────────────────────────────────────────────────────────
 * Four hundred search calls take minutes, far longer than a request may wait,
 * and the answer barely moves within a day. So a request starts the work,
 * says "computing", and a later one gets the finished result. One window is
 * computed at a time — the HubSpot search limit punishes parallel bursts.
 */

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

type Entry = { at: number; value?: CustomerTypes; error?: string; running: boolean };
type Store = { entries: Map<string, Entry>; queue: Promise<unknown> };
// On the global on purpose: in development Next re-evaluates this module on every
// edit, and a module-level Map would lose a count that is minutes from finishing —
// every poll would start it again and it would never land.
const store: Store = ((globalThis as { __apsoCustomerTypes?: Store }).__apsoCustomerTypes ??= {
  entries: new Map(),
  queue: Promise.resolve(),
});

export type CustomerTypesPayload = CustomerTypes & {
  computing: boolean;
  error?: string;
  progress?: CustomerTypesProgress;
};

const EMPTY = (from: string, to: string): CustomerTypes => ({
  months: [], totals: { orders: 0, new: 0, active: 0, reactivated: 0, unknown: 0 },
  from, to, historyFrom: from, webOrders: 0, generatedAt: new Date().toISOString(),
});

/** The current state of this window, starting the computation if it is missing or old. */
export function customerTypes(from: string, to: string): CustomerTypesPayload {
  const key = `${from}:${to}`;
  const hit = store.entries.get(key);
  const fresh = hit?.value && Date.now() - hit.at < CACHE_TTL_MS;

  if (!fresh && !hit?.running) {
    store.entries.set(key, { at: Date.now(), value: hit?.value, running: true });
    store.queue = store.queue
      .catch(() => {})
      .then(() => fetchCustomerTypes({ from, to }))
      .then((value) => { store.entries.set(key, { at: Date.now(), value, running: false }); })
      .catch((err: unknown) => {
        store.entries.set(key, { at: Date.now(), value: hit?.value, error: String((err as Error)?.message ?? err), running: false });
      });
  }

  const now = store.entries.get(key);
  const running = Boolean(now?.running);
  const shown = running ? { progress } : {};
  if (now?.value) return { ...now.value, computing: running, error: now.error, ...shown };
  return { ...EMPTY(from, to), computing: running, error: now?.error, ...shown };
}
