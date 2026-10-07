// The hub looks at the Compass connector every 15 minutes, read-only, so that
// each step's latest result is remembered even when nobody opens the pages: the
// connector's own record keeps only its last 30-minute check, and most steps
// run once a day. Off without the read key. Nothing here writes to HubSpot.

import { connectorReadKey } from "@/lib/integrations/status";
import { compassSnapshot } from "@/lib/integrations/compassConnector";

const TICK_MS = 15 * 60_000;
let started = false;

export function startConnectorsWatch() {
  if (started || !connectorReadKey()) return;
  started = true;
  const tick = () => { compassSnapshot(true).catch((e) => console.warn(`[connectors] watch: ${(e as Error).message}`)); };
  setTimeout(tick, 90_000).unref?.();
  setInterval(tick, TICK_MS).unref?.();
}
