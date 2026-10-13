// THE USE CASE PAGES FILL THEMSELVES (SARCLA 13.10.2026: "these loading times are
// crazy"). Each page's HubSpot read took a minute or more the first time anyone
// opened it, and longer when it queued behind another report. Now the hub reads
// every page in the background - a few minutes after it starts, and again when a
// read is older than its 12 hours - one page after the other, so a reader only
// ever sees the last finished read. Read-only against HubSpot.
//
// Never beside an ERP chain: a chain's steps write through the same HubSpot rate
// limit, so the warm-up waits for the next tick. LIFECYCLE_WARM=off stops it.

import { hubChain } from "@/lib/connectors/chainStatus";
import type { SlowState } from "@/lib/integrations/slowReport";
import { UCS } from "./config";
import { emailState, overviewState, ucState } from "./build";

const TICK_MS = 10 * 60_000;
/** One read never holds the warm-up longer than this; the next tick picks up where it stopped. */
const MAX_WAIT_MS = 15 * 60_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function chainRunning(): Promise<boolean> {
  try {
    const c = await hubChain();
    return c?.status === "running" && Date.now() / 1000 - (c.ts ?? 0) < 3 * 3600;
  } catch {
    return false;
  }
}

/** Ask for a read - a fresh one answers at once, else it starts - and wait until it is done. */
async function settle(get: () => Promise<SlowState<unknown>>): Promise<void> {
  const until = Date.now() + MAX_WAIT_MS;
  while (Date.now() < until) {
    if (!(await get()).computing) return;
    await sleep(10_000);
  }
}

let busy = false;

async function tick() {
  if (busy || process.env.LIFECYCLE_WARM === "off") return;
  busy = true;
  try {
    const reads: (() => Promise<SlowState<unknown>>)[] = [
      ...UCS.map((u) => () => ucState(u.key)),
      () => overviewState(),
      () => emailState(),
    ];
    for (const get of reads) {
      if (await chainRunning()) return;
      await settle(get);
    }
  } catch (e) {
    console.warn(`[lifecycle] warm-up tick skipped: ${(e as Error).message}`);
  } finally {
    busy = false;
  }
}

let started = false;

export function startLifecycleWarm() {
  if (started) return;
  started = true;
  // the two servers start seconds apart: a different first tick each, so one finds the other's read running
  setTimeout(() => void tick(), 90_000 + Math.floor(Math.random() * 120_000)).unref?.();
  setInterval(() => void tick(), TICK_MS).unref?.();
}
