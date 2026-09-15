// WEB ORDER SYNC — web shop orders the Magento connector writes into HubSpot
// server to server (order_source_system = magento), counted per Monday-to-Sunday
// week by order_order_date, a UTC calendar day as the connector writes it. The
// page sets them against GA4 purchases, which count only visitors who allowed
// statistics: a week with fewer records than GA4 purchases is missing orders.

import { countWhere } from "./hubspotCounts";
import { IntegrationError } from "./status";

/** The connector has written web orders live since Monday 6 July 2026; earlier records are its backfill. */
export const WEB_ORDERS_LIVE_FROM = "2026-07-06";
const DAY_MS = 86_400_000;
const MAX_WEEKS = 53;

export type WebOrderWeek = { week: string; records: number | null };
export type WebOrders = { weeks: WebOrderWeek[]; liveFrom: string };

const mondayOf = (ms: number) => ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY_MS;

/** Every whole week that overlaps from..to, from the live date on. */
export async function fetchWebOrders(params: { from: string; to: string; signal?: AbortSignal }): Promise<WebOrders> {
  const lastMonday = mondayOf(Date.parse(`${params.to}T00:00:00Z`));
  const start = Math.max(
    Date.parse(`${WEB_ORDERS_LIVE_FROM}T00:00:00Z`),
    mondayOf(Date.parse(`${params.from}T00:00:00Z`)),
    lastMonday - (MAX_WEEKS - 1) * 7 * DAY_MS,
  );
  const weeks: WebOrderWeek[] = [];
  try {
    for (let wk = start; wk <= lastMonday; wk += 7 * DAY_MS) {
      const records = await countWhere(
        "orders",
        [
          { propertyName: "order_source_system", operator: "EQ", value: "magento" },
          { propertyName: "order_order_date", operator: "GTE", value: String(wk) },
          { propertyName: "order_order_date", operator: "LT", value: String(wk + 7 * DAY_MS) },
        ],
        params.signal,
      );
      weeks.push({ week: new Date(wk).toISOString().slice(0, 10), records });
    }
  } catch (err) {
    if (err instanceof IntegrationError && err.status === 403) {
      throw new IntegrationError(
        "HubSpot: the hub's private app cannot read Orders yet. It needs the read-only scope crm.objects.orders.read on the SARCLA - APSOMarketingHub app.",
        403,
      );
    }
    throw err;
  }
  return { weeks, liveFrom: WEB_ORDERS_LIVE_FROM };
}
