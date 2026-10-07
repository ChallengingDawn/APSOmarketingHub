// The hub looks at the Compass connector every 15 minutes, read-only, so that
// each step's latest result is remembered even when nobody opens the pages: the
// connector's own record keeps only its last 30-minute check, and most steps
// run once a day. Off without the read key.
//
// The same tick runs the steps that are LIVE in the hub, once a day each:
//   mandant_sweep     from 05:00 UTC (the connector ran it every 30 minutes)
//   company_stats,    once the night's chain is done (the orders and their
//   contact_shipment  shipment dates are loaded), or after 09:00 UTC if the
//                     chain cannot be asked
// A day counts as done when a run succeeded; a failed one is tried again on the
// next tick, three times a day at most.

import { kvGet, kvSet } from "@/lib/db/init";
import { chainDoneToday, utcToday } from "@/lib/erosion/run";
import { connectorReadKey } from "@/lib/integrations/status";
import { compassSnapshot } from "@/lib/integrations/compassConnector";
import { HUB_STEPS, lastRun, liveSteps, runNow, type HubStep } from "./steps/run";

const TICK_MS = 15 * 60_000;
const MAX_TRIES = 3;
let started = false;
let ticking = false;

type Day = { day: string; done: boolean; tries: number };
const dayKey = (k: HubStep) => `connectors:hub:day:${k}`;

async function due(k: HubStep, today: string): Promise<boolean> {
  const d = await kvGet<Day>(dayKey(k));
  return !d || d.day !== today || (!d.done && d.tries < MAX_TRIES);
}

async function runDaily(k: HubStep, today: string) {
  const prev = await kvGet<Day>(dayKey(k));
  const tries = prev?.day === today ? prev.tries + 1 : 1;
  const r = await runNow(k, "live", "schedule");
  if (r === null) return; // another step holds the lock - next tick
  await kvSet(dayKey(k), { day: today, done: !r.error, tries });
}

/**
 * A ported step that has never been previewed gets one full preview by itself -
 * reads only - after 10:00 UTC, clear of the morning's chain and reports. The
 * comparison with the connector is then on the page without anyone asking.
 */
async function firstPreviews() {
  if (new Date().getUTCHours() < 10) return;
  const live = await liveSteps();
  for (const k of HUB_STEPS) {
    if (live.has(k) || (await lastRun("preview", k))) continue;
    await runNow(k, "preview", "first preview", true);
    return; // one per tick
  }
}

async function stepsTick() {
  await firstPreviews();
  const live = await liveSteps();
  if (!live.size) return;
  const today = utcToday();
  const hour = new Date().getUTCHours();
  if (live.has("mandant_sweep") && hour >= 5 && (await due("mandant_sweep", today))) await runDaily("mandant_sweep", today);
  const after = (["company_stats", "contact_shipment"] as HubStep[]).filter((k) => live.has(k));
  if (!after.length) return;
  let ready = hour >= 9;
  if (!ready) {
    try { ready = (await chainDoneToday(today)).done; } catch { ready = false; }
  }
  if (!ready) return;
  for (const k of after) if (await due(k, today)) await runDaily(k, today);
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
