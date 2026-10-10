// THE COMPASS SYNC'S CLOCK - every 15 minutes, in the hub (the connector on Railway is
// retired since 10.10.2026, retired.ts):
//   mandant_sweep, wrong_owners   every 30 minutes  } the sweeps' own lane, beside the chain
//   deputy_sweep                  every 15 minutes  }
//   the chain steps               in the hub's chain (chain.ts): pull the ERP's new files,
//                                 then the steps whose files arrived - started beside the
//                                 ticks, since a chain can take an hour
//   the review queue's check      every 30 minutes, in the background (reviewCheck.ts)
// and one PREVIEW of each step that has never been previewed (reads only), after
// 10:00 UTC, one per tick. Not the file steps: their test runs download the ERP's
// files and are started by hand.

import { kvGet, kvSet } from "@/lib/db/init";
import { chainDoneToday, utcToday } from "@/lib/erosion/run";
import { connectorReadKey } from "@/lib/integrations/status";
import { compassSnapshot } from "@/lib/integrations/compassConnector";
import { CONNECTOR_RETIRED } from "./retired";
import { checkRunning, heldCheck, refreshCheck } from "./reviewCheck";
import { runHubChain } from "./chain";
import { REGISTRY } from "./steps/registry";
import { lastRun, liveSteps, runNow, type HubStep } from "./steps/run";

const TICK_MS = 15 * 60_000;
const MAX_TRIES = 3;
let started = false;
let ticking = false;
let chainRunning = false;

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
    if (live.has(def.key) || def.file) continue;
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
  // the chain can take an hour: it runs beside the ticks, so the sweeps above keep their
  // rhythm on their own lane (one chain per copy; the lock keeps it to one across both)
  if (!chainRunning) {
    chainRunning = true;
    void runHubChain("schedule")
      .catch((e) => console.warn(`[connectors] chain: ${(e as Error).message}`))
      .finally(() => { chainRunning = false; });
  }
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
    if (!CONNECTOR_RETIRED) await compassSnapshot(true).catch((e) => console.warn(`[connectors] watch: ${(e as Error).message}`));
    await stepsTick().catch((e) => console.warn(`[connectors] steps: ${(e as Error).message}`));
    await reviewTick().catch((e) => console.warn(`[connectors] review check: ${(e as Error).message}`));
  } finally {
    ticking = false;
  }
}

/** The review queue's check, kept fresh without anybody opening the page: every 30 minutes. */
async function reviewTick() {
  const h = await heldCheck();
  if (checkRunning(h) || (h?.at && Date.now() - Date.parse(h.at) < 30 * 60_000)) return;
  const s = await compassSnapshot();
  const uns = (s.review?.items ?? []).filter((i) => i.status !== "resolved" && i.un).map((i) => i.un as string);
  if (uns.length) refreshCheck(uns);
}

export function startConnectorsWatch() {
  if (started || (!CONNECTOR_RETIRED && !connectorReadKey())) return;
  started = true;
  setTimeout(() => void tick(), 90_000).unref?.();
  setInterval(() => void tick(), TICK_MS).unref?.();
}
