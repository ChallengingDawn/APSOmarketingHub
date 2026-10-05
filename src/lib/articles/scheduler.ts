// ARTICLES CY/LY REBUILDS ITSELF once a day, after the connector's nightly chain
// has loaded the night's orders - the same signal erosion waits for - and after
// erosion's own run of the day. When the chain cannot be asked, it rebuilds
// after 08:00 UTC instead. The first time the hub runs with no report at all,
// it builds one straight away. Read-only against HubSpot, so it runs wherever
// the hub runs.
//
// A day counts as done only when a report built TODAY exists - an attempt that
// could not take the lock or failed is tried again on the next tick, four
// times a day at most, never lost (05.10.2026: the morning mail shared the lock id).

import { kvGet, kvSet } from "@/lib/db/init";
import { chainDoneToday, utcToday } from "@/lib/erosion/run";
import { buildStatus, loadReport, startBuild } from "@/lib/integrations/articleReport";

const KV_TRIES = "articles:auto-tries";
const TICK_MS = 15 * 60_000;
const MAX_TRIES = 4;

async function tick() {
  try {
    const today = utcToday();
    const report = await loadReport();
    if (report?.today === today) return; // built today
    if ((await buildStatus()).status === "running") return;
    if (report) {
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
    }
    const tries = await kvGet<{ day: string; count: number }>(KV_TRIES);
    const count = tries?.day === today ? tries.count : 0;
    if (count >= MAX_TRIES) return;
    await kvSet(KV_TRIES, { day: today, count: count + 1 });
    await startBuild(report ? "after the nightly chain" : "first build");
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
