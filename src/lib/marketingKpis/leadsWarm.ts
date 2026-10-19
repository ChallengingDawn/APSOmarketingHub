// LEAD GENERATION (AND THE HAND-OVER TO ESO/TSA) READ THEMSELVES (SARCLA 19.10.2026: "this should load once and then save, and be
// reloaded so nobody waits"). The read keeps its answer in the database and shows it while a new one
// runs (slowReport), but the FIRST visit after a start or a new version of the read still waited a few
// minutes. Now the hub reads it in the background a few minutes after it starts, and again whenever the
// answer is older than its 6 hours - a reader only ever sees the last finished read. Read-only against
// HubSpot; never beside an ERP chain (its steps share the rate limit). LEADS_WARM=off stops it.

import { hubChain } from "@/lib/connectors/chainStatus";
import { leadsData } from "./leads";
import { handoverData } from "./handover";

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

let busy = false;

async function tick() {
  if (busy || process.env.LEADS_WARM === "off") return;
  busy = true;
  try {
    if (await chainRunning()) return;
    // a fresh answer comes back at once; a stale or missing one starts the read - wait for it to finish;
    // Lead Generation, then the Hand-over to ESO/TSA (19.10), one after the other
    for (const get of [leadsData, handoverData]) {
      if (await chainRunning()) return;
      const until = Date.now() + MAX_WAIT_MS;
      while (Date.now() < until && (await get()).computing) await sleep(10_000);
    }
  } catch (e) {
    console.warn(`[leads] warm-up tick skipped: ${(e as Error).message}`);
  } finally {
    busy = false;
  }
}

let started = false;

export function startLeadsWarm() {
  if (started) return;
  started = true;
  // the two servers start seconds apart: a different first tick each, so one finds the other's read running
  setTimeout(() => void tick(), 60_000 + Math.floor(Math.random() * 120_000)).unref?.();
  setInterval(() => void tick(), TICK_MS).unref?.();
}
