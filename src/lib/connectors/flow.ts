// IS THE ERP DATA FLOWING? - the new ERP orders that reached HubSpot each day, last 30
// days, counted in HubSpot itself: orders created that day that carry no shop order id
// (hs_external_order_id is the Magento connector's), i.e. the Compass sync's own. A day
// with none is a day the ERP delivered nothing - or the sync stood still. Counted in the
// background (one search per day, under HubSpot's search limit) and kept for an hour, so
// the overview reads it at once.

import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";

const KV_FLOW = "connectors:hub:flow";
const DAYS = 30;
const FRESH_MS = 60 * 60_000;

export type FlowDay = { day: string; orders: number };
export type Flow = { at: string; days: FlowDay[]; running?: string; error?: string };

let running: Promise<void> | null = null;

export async function heldFlow(): Promise<Flow | null> {
  return (await kvGet<Flow>(KV_FLOW).catch(() => null)) ?? null;
}

export const flowStale = (f: Flow | null) => !f?.at || Date.now() - Date.parse(f.at) > FRESH_MS;
export const flowRunning = (f: Flow | null) => !!running || (!!f?.running && Date.now() - Date.parse(f.running) < 10 * 60_000);

async function countDay(start: number): Promise<number> {
  const r = await hubspotFetchJson<{ total?: number }>({
    path: "/crm/v3/objects/orders/search", method: "POST",
    body: {
      filterGroups: [{ filters: [
        { propertyName: "hs_createdate", operator: "GTE", value: String(start) },
        { propertyName: "hs_createdate", operator: "LT", value: String(start + 86_400_000) },
        { propertyName: "hs_external_order_id", operator: "NOT_HAS_PROPERTY" },
      ] }],
      limit: 1, properties: ["hs_object_id"],
    },
  });
  return r.total ?? 0;
}

/** Count the last 30 UTC days again, in the background; a running count is not started twice. */
export function refreshFlow(): void {
  if (running) return;
  running = (async () => {
    const before = await heldFlow();
    await kvSet(KV_FLOW, { ...(before ?? { at: "", days: [] }), running: new Date().toISOString() });
    try {
      const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
      const days: FlowDay[] = [];
      for (let i = DAYS - 1; i >= 0; i--) {
        const start = today - i * 86_400_000;
        days.push({ day: new Date(start).toISOString().slice(0, 10), orders: await countDay(start) });
      }
      await kvSet(KV_FLOW, { at: new Date().toISOString(), days });
    } catch (e) {
      await kvSet(KV_FLOW, { ...(before ?? { at: "", days: [] }), error: String((e as Error).message ?? e).slice(0, 200) });
    }
  })().catch(() => {}).finally(() => { running = null; });
}
