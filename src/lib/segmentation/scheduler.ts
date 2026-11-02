// SMART SEGMENTATION'S TIMERS IN THE HUB - only while this deployment OWNS the
// engine (SEGMENTATION_ENGINE=live); unset, nothing runs and the connector's
// watcher and nightly sweep do the work, so the two never both write.
//
//   watcher - every two minutes, new companies and reps' potential edits
//   nightly - once a day after the connector's nightly chain (the revenue_* are
//             fresh then): potential recalc when POTENTIAL_RECALC=1, sweep, web batch; then the companies created in
//             the last two years are read again for the New companies tab
// The first time it runs it takes over the connector's state (the 30-day website memory).

import { chainDoneToday, utcToday } from "@/lib/erosion/run";
import { importConnectorState, loadState, nightly, potentialEditsData, startAction, watchTick } from "@/lib/integrations/segmentation";
import { followDue, startFollow } from "@/lib/integrations/newCompanies";
import { pcMix } from "@/lib/integrations/segmentationCompanies";

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
    // the new companies are followed once a day, after the nightly (their priority and revenue are fresh then)
    if ((await loadState()).nightly_day === today && (await followDue())) await startFollow("nightly");
    // the profit centres moved in the night: counted again for the Profit center tab
    if ((await loadState()).nightly_day === today) void pcMix(true).catch(() => {});
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
    // the "Potential changes" measure needs one full history scan; the nightly
    // recalculation does it, but a fresh hub should not wait a night - a preview
    // (read-only) fills it now
    try {
      if (!(await potentialEditsData()).scannedAt) {
        const r = await startAction("potential", { dry: true, by: "first history scan" });
        console.log(`[segmentation] potential history: ${r.note}`);
      }
    } catch (e) {
      console.warn(`[segmentation] first history scan not started: ${(e as Error).message}`);
    }
  })();
  // a hub that has not read the new companies today reads them a few minutes after it starts, not at the next night
  setTimeout(() => {
    void followDue().then((due) => (due ? startFollow("first start") : null)).catch((e) => console.warn(`[segmentation] new companies not read: ${(e as Error).message}`));
    // the Profit center tab's counts, kept in the database: counted now if there are none or they are old
    void pcMix().catch(() => {});
  }, 5 * 60_000).unref?.();
  const w = setInterval(() => {
    void watchTick().catch((e) => console.warn(`[segwatch] error: ${(e as Error).message.slice(0, 200)}`));
  }, WATCH_MS);
  w.unref?.();
  const n = setInterval(() => void nightlyTick(), NIGHTLY_TICK_MS);
  n.unref?.();
}
