// IS THE ERP DATA FLOWING? - the new ERP orders that reached HubSpot each day, last 30
// days, counted in HubSpot itself: orders created that day that carry no shop order id
// (hs_external_order_id is the Magento connector's), i.e. the Compass sync's own. A day
// with none is a day the ERP delivered nothing - or the sync stood still. Counted in the
// background (one search per day, under HubSpot's search limit) and kept for an hour, so
// the overview reads it at once. The same count, for the orders that DO carry a shop order
// id, is the Shop orders overview's "web orders reaching HubSpot".

import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";

const KV_FLOW = "connectors:hub:flow";
const KV_SHOP_FLOW = "connectors:magento:flow";
const DAYS = 30;
const FRESH_MS = 60 * 60_000;

export type FlowDay = { day: string; orders: number };
export type Flow = { at: string; days: FlowDay[]; running?: string; error?: string };

export const flowStale = (f: Flow | null) => !f?.at || Date.now() - Date.parse(f.at) > FRESH_MS;

/** One daily count, kept in kv: what it holds, whether it is being made, and a fresh count in the background. */
function counter(kv: string, which: object) {
  let running: Promise<void> | null = null;

  const held = async (): Promise<Flow | null> => (await kvGet<Flow>(kv).catch(() => null)) ?? null;
  const isRunning = (f: Flow | null) => !!running || (!!f?.running && Date.now() - Date.parse(f.running) < 10 * 60_000);

  async function countDay(start: number): Promise<number> {
    const r = await hubspotFetchJson<{ total?: number }>({
      path: "/crm/v3/objects/orders/search", method: "POST",
      body: {
        filterGroups: [{ filters: [
          { propertyName: "hs_createdate", operator: "GTE", value: String(start) },
          { propertyName: "hs_createdate", operator: "LT", value: String(start + 86_400_000) },
          which,
        ] }],
        limit: 1, properties: ["hs_object_id"],
      },
    });
    return r.total ?? 0;
  }

  /** Count the last 30 UTC days again, in the background; a running count is not started twice. */
  function refresh(): void {
    if (running) return;
    running = (async () => {
      const before = await held();
      await kvSet(kv, { ...(before ?? { at: "", days: [] }), running: new Date().toISOString() });
      try {
        const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
        const days: FlowDay[] = [];
        for (let i = DAYS - 1; i >= 0; i--) {
          const start = today - i * 86_400_000;
          days.push({ day: new Date(start).toISOString().slice(0, 10), orders: await countDay(start) });
        }
        await kvSet(kv, { at: new Date().toISOString(), days });
      } catch (e) {
        await kvSet(kv, { ...(before ?? { at: "", days: [] }), error: String((e as Error).message ?? e).slice(0, 200) });
      }
    })().catch(() => {}).finally(() => { running = null; });
  }

  return { held, running: isRunning, refresh };
}

// the Compass sync's orders: no shop order id
const erp = counter(KV_FLOW, { propertyName: "hs_external_order_id", operator: "NOT_HAS_PROPERTY" });
export const heldFlow = erp.held;
export const flowRunning = erp.running;
export const refreshFlow = erp.refresh;

/** The shop's orders reaching HubSpot per day - those with a web order number (the Shop orders overview). */
export const shopFlow = counter(KV_SHOP_FLOW, { propertyName: "hs_external_order_id", operator: "HAS_PROPERTY" });
