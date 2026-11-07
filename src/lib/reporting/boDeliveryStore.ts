// The delivery speed's summary, kept for the Back-Office Reports (rules in ./boDelivery.ts). Written by the Compass chain's
// order_sync once its pass over the ERP's order file is done; read by /api/reporting/back-office.

import { kvGet, kvSet } from "@/lib/db/init";
import { query } from "@/lib/db/client";
import { KV_DELIVERY, summarize, type Delivery, type DeliveryKept } from "./boDelivery";

const ZURICH_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" });
/** today in Zurich, yyyy-mm-dd */
export const zurichToday = () => ZURICH_DAY.format(new Date());

/** The collector's deliveries -> kv; the slowest named with their customer (the chain's copy of the HubSpot order's title). */
export async function saveDelivery(c: { found: Map<string, Delivery>; skipped: Record<string, number> }, today: string): Promise<number> {
  if (!c.found.size) return 0; // a file that gave none keeps the last summary
  const k = summarize(c.found.values(), today, c.skipped);
  const nums = k.slow.map((r) => r[0]);
  if (nums.length) {
    try {
      const r = await query<{ num: string; title: string }>("SELECT num, title FROM apsomh_cx_order_snapshot WHERE num = ANY($1)", [nums]);
      const title = new Map(r.rows.map((x) => [x.num, x.title]));
      // "A26.123456.001 | Person | Company": the company is the last part
      for (const s of k.slow) {
        const parts = (title.get(s[0]) ?? "").split(" | ").map((x) => x.trim()).filter(Boolean);
        s[7] = parts.length >= 2 ? parts[parts.length - 1] : "";
      }
    } catch { /* the names are a help, never the summary's problem */ }
  }
  await kvSet(KV_DELIVERY, k);
  return k.deliveries;
}

export const deliveryNow = () => kvGet<DeliveryKept>(KV_DELIVERY).catch(() => null);
