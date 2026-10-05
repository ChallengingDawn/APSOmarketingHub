// SMART SEGMENTATION'S TIMERS IN THE HUB - only while this deployment OWNS the
// engine (SEGMENTATION_ENGINE=live); unset, nothing runs and the connector's
// watcher and nightly sweep do the work, so the two never both write.
//
//   watcher - every two minutes, new companies and reps' potential edits
//   nightly - once a day after the connector's nightly chain (the revenue_* are
//             fresh then): potential recalc when POTENTIAL_RECALC=1, sweep, web batch
// The first time it runs it takes over the connector's state (the 30-day website memory).

import { chainDoneToday, utcToday } from "@/lib/erosion/run";
import { importConnectorState, loadState, nightly, watchTick } from "@/lib/integrations/segmentation";

const WATCH_MS = 120_000;
const NIGHTLY_TICK_MS = 10 * 60_000;

export const segmentationLive = () => process.env.SEGMENTATION_ENGINE === "live";

async function nightlyTick() {
  try {
    const today = utcToday();
    if ((await loadState()).nightly_day === today) return;
    let ready: boolean;
    try {
      ready = (await chainDoneToday(today)).done;
    } catch {
      ready = new Date().getUTCHours() >= 8;
    }
    if (ready) await nightly();
  } catch (e) {
    console.warn(`[segmentation] nightly tick skipped: ${(e as Error).message}`);
  }
}

let started = false;

export function startSegmentationScheduler() {
  if (started) return;
  started = true;
  if (!segmentationLive()) {
    console.log("[segmentation] scheduler idle: SEGMENTATION_ENGINE is not 'live' - the connector runs the engine");
    return;
  }
  console.log("[segmentation] scheduler on: watcher every 2 min, nightly after the chain");
  void (async () => {
    try {
      if (!(await loadState()).imported_at) {
        const r = await importConnectorState();
        console.log(`[segmentation] took over the connector's state: ${r.attempts} website attempts`);
      }
    } catch (e) {
      console.warn(`[segmentation] connector state not imported (websites may be tried again): ${(e as Error).message}`);
    }
  })();
  const w = setInterval(() => {
    void watchTick().catch((e) => console.warn(`[segwatch] error: ${(e as Error).message.slice(0, 200)}`));
  }, WATCH_MS);
  w.unref?.();
  const n = setInterval(() => void nightlyTick(), NIGHTLY_TICK_MS);
  n.unref?.();
}
