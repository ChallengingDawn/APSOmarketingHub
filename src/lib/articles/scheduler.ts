// ARTICLES CY/LY REBUILDS ITSELF once a day, after the connector's nightly chain
// has loaded the night's orders - the same signal erosion waits for - and after
// erosion's own run of the day. When the chain cannot be asked, it rebuilds
// after 08:00 UTC instead. The first time
// the hub runs with no report at all, it builds one straight away. Read-only
// against HubSpot, so it runs wherever the hub runs.

import { kvGet, kvSet } from "@/lib/db/init";
import { chainDoneToday, utcToday } from "@/lib/erosion/run";
import { loadReport, startBuild } from "@/lib/integrations/articleReport";

const KV_DAY = "articles:auto-day";
const TICK_MS = 15 * 60_000;

async function tick() {
  try {
    const today = utcToday();
    if (!(await loadReport())) {
      if ((await kvGet<string>(KV_DAY)) !== `first-${today}`) {
        await kvSet(KV_DAY, `first-${today}`);
        await startBuild("first build");
      }
      return;
    }
    if ((await kvGet<string>(KV_DAY)) === today) return;
    let ready: boolean;
    try {
      ready = (await chainDoneToday(today)).done;
    } catch {
      ready = new Date().getUTCHours() >= 8;
    }
    if (!ready) return;
    // after the hub's own erosion run, never beside it: both read the same orders
    // and two at once would double the memory - unless erosion is idle by midday
    if (process.env.EROSION_DETECTOR === "live" && new Date().getUTCHours() < 12) {
      const ero = await kvGet<{ today?: string }>("erosion:hub:last");
      if (ero?.today !== today) return;
    }
    // claim the day first - both copies tick, the build's own lock keeps it to one
    await kvSet(KV_DAY, today);
    await startBuild("after the nightly chain");
  } catch (e) {
    console.warn(`[articles] scheduler tick skipped: ${(e as Error).message}`);
  }
}

let started = false;

export function startArticlesScheduler() {
  if (started) return;
  started = true;
  const timer = setInterval(() => void tick(), TICK_MS);
  timer.unref?.();
  setTimeout(() => void tick(), 60_000).unref?.();
}
