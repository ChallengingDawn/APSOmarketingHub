// SEARCH BAR - the stock refresh after a shop order, sent by the hub's Magento connector (SARCLA 17.10.2026: "the
// order-triggered refresh through the hub's Magento connector"). The connector sees the shop's changed orders every
// minute; it sends their articles to the search bar's gateway, which re-reads their stock (shop -> bar -> HubSpot)
// at once - before, the gateway found the order in HubSpot a minute or more later. The stock reads stay on Railway:
// nothing here calls the shop. Fire-and-forget: a sweep never waits on it; the gateway's HubSpot look stays the
// safety net (every 10 minutes while this arrives, every minute if it stops).

import { adminToken, gateway } from "./gateway";

/** The articles of the orders the shop just changed. Never throws, never waits. */
export function notifyOrderStock(skus: string[], orders: number): void {
  const list = [...new Set(skus.map((s) => String(s).trim()).filter((s) => /^\d{10}$/.test(s)))].slice(0, 300);
  if (!list.length || !adminToken()) return;
  gateway<{ queued?: number; already_fresh?: number; skipped?: string }>("/api/order-stock/refresh", {
    method: "POST", body: { skus: list, orders }, timeoutMs: 10_000,
  })
    .then((r) => console.log(`[search-bar] order stock: ${list.length} articles of ${orders} shop ${orders === 1 ? "order" : "orders"} sent - ${r.skipped ? `not refreshed (${r.skipped})` : `${r.queued ?? 0} to refresh, ${r.already_fresh ?? 0} fresh already`}`))
    .catch((e) => console.warn(`[search-bar] order stock not sent: ${(e as Error).message}`));
}
