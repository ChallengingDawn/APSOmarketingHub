// The hub looks at the Compass connector every 15 minutes, read-only, so that
// each step's latest result is remembered even when nobody opens the pages: the
// connector's own record keeps only its last 30-minute check, and most steps
// run once a day. Off without the read key.
//
// The same tick runs the steps that are LIVE in the hub:
//   mandant_sweep, wrong_owners   every 30 minutes, as the connector ran them
//   deputy_sweep                  every 15 minutes
//   the chain steps               in the hub's chain (chain.ts): pull, then the
//                                 steps whose files arrived
//   company_stats,                when the connector still titles the orders
//   contact_shipment              (order_sync not in the hub): once a day after
//                                 its chain is done, or after 09:00 UTC
// and one PREVIEW of each step that has never been previewed (reads only), after
// 10:00 UTC, one per tick - the comparison with the connector without a click.

import { kvGet, kvSet } from "@/lib/db/init";
import { chainDoneToday, utcToday } from "@/lib/erosion/run";
import { connectorReadKey } from "@/lib/integrations/status";
import { compassSnapshot } from "@/lib/integrations/compassConnector";
import { runHubChain } from "./chain";
import { REGISTRY } from "./steps/registry";
import { lastRun, liveSteps, runNow, sftpConfigured, type HubStep } from "./steps/run";

const TICK_MS = 15 * 60_000;
const MAX_TRIES = 3;
let started = false;
let ticking = false;

type Day = { day: string; done: boolean; tries: number };
const dayKey = (k: HubStep) => `connectors:hub:day:${k}`;
const lastKey = (k: HubStep) => `connectors:hub:last-at:${k}`;

/** A live step on a fixed rhythm: due when its last scheduled run is that long ago. */
async function every(k: HubStep, live: Set<string>, ms: number) {
  if (!live.has(k)) return;
  const last = await kvGet<{ at: number }>(lastKey(k));
  if (last && Date.now() - last.at < ms - 60_000) return;
  const r = await runNow(k, "live", "schedule");
  if (r) await kvSet(lastKey(k), { at: Date.now() });
}

async function dailyAfterChain(k: HubStep, today: string) {
  const prev = await kvGet<Day>(dayKey(k));
  if (prev && prev.day === today && (prev.done || prev.tries >= MAX_TRIES)) return;
  const tries = prev?.day === today ? prev.tries + 1 : 1;
  const r = await runNow(k, "live", "schedule");
  if (r === null) return; // another step holds the lock - next tick
  await kvSet(dayKey(k), { day: today, done: !r.error, tries });
}

async function firstPreviews(live: Set<string>) {
  if (new Date().getUTCHours() < 10) return;
  for (const def of REGISTRY) {
    if (live.has(def.key) || (def.file && !sftpConfigured())) continue;
    if (await lastRun("preview", def.key)) continue;
    await runNow(def.key, "preview", "first preview", true);
    return; // one per tick
  }
}

async function stepsTick() {
  const live = await liveSteps();
  await firstPreviews(live);
  if (!live.size) return;
  await every("mandant_sweep", live, 30 * 60_000);
  await every("wrong_owners", live, 30 * 60_000);
  await every("deputy_sweep", live, 15 * 60_000);
  await runHubChain("schedule");
  if (!live.has("order_sync")) {
    const after = (["company_stats", "contact_shipment"] as HubStep[]).filter((k) => live.has(k));
    if (after.length) {
      const today = utcToday();
      let ready = new Date().getUTCHours() >= 9;
      if (!ready) {
        try { ready = (await chainDoneToday(today)).done; } catch { ready = false; }
      }
      if (ready) for (const k of after) await dailyAfterChain(k, today);
    }
  }
}

async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    await compassSnapshot(true).catch((e) => console.warn(`[connectors] watch: ${(e as Error).message}`));
    await stepsTick().catch((e) => console.warn(`[connectors] steps: ${(e as Error).message}`));
  } finally {
    ticking = false;
  }
}

export function startConnectorsWatch() {
  if (started || !connectorReadKey()) return;
  started = true;
  setTimeout(() => void tick(), 90_000).unref?.();
  setInterval(() => void tick(), TICK_MS).unref?.();
}
