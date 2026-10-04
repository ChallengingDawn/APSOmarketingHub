// DoC - the timer, and the lock that makes it safe on more than one task.
//
// Production runs two copies of the hub. Without a lock both would sweep the same
// "waiting" order in the same minute, both would claim it, and the customer would
// get two emails - the claim-before-send stamp only stops a resend AFTER a crash,
// not a race. So every run takes a Postgres advisory lock first; the copy that
// does not get it skips that tick. No database, no lock, no run: the work waits,
// it is never done twice.
//
// "Is a run due" is read from the shared run record, not a per-process timer, so
// the two copies together still capture every 15 minutes and sweep every hour.

import { getPool } from "@/lib/db/client";
import { CAPTURE_EVERY_MIN, SWEEP_EVERY_MIN, captureOn, sendingOn } from "./config";
import { capture, readRuns, sweep, writeRuns } from "./engine";

/** Arbitrary constant naming the DoC lock in pg_advisory_lock's single key space. */
const DOC_LOCK = 4_107_201;
const TICK_MS = 60_000;

/** Runs `fn` only if this process gets the DoC lock; null when another copy holds it. */
export async function withDocLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [DOC_LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await fn();
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [DOC_LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

const due = (last: string | undefined, everyMin: number) =>
  !last || Date.now() - Date.parse(last) >= everyMin * 60_000 - 5_000;

async function tick() {
  await withDocLock(async () => {
    const runs = await readRuns();
    if (captureOn() && due(runs.captureTriedAt, CAPTURE_EVERY_MIN)) {
      const at = new Date().toISOString();
      await writeRuns({ captureTriedAt: at });
      try {
        await capture();
      } catch (e) {
        const error = (e as Error).message;
        console.warn(`[doc] capture failed: ${error}`);
        await writeRuns({ lastCapture: { at, error } });
      }
    }
    if (sendingOn() && due(runs.sweepTriedAt, SWEEP_EVERY_MIN)) {
      const at = new Date().toISOString();
      await writeRuns({ sweepTriedAt: at });
      try {
        await sweep();
      } catch (e) {
        const error = (e as Error).message;
        console.warn(`[doc] sweep failed: ${error}`);
        await writeRuns({ lastSweep: { at, error } });
      }
    }
  }).catch((e) => console.warn(`[doc] no run this minute: ${(e as Error).message}`));
}

let started = false;

/**
 * Started once per server process (src/instrumentation.ts). It only ever writes to
 * HubSpot when this deployment OWNS DoC: capture needs DOC_CAPTURE_FROM, the sweep
 * needs DOC_SEND_EMAIL=1. With neither set - every local run, and the hub while
 * C2S V1 still does the work - it does nothing at all.
 */
export function startDocScheduler() {
  if (started) return;
  started = true;
  if (!captureOn() && !sendingOn()) {
    console.log("[doc] scheduler idle: neither DOC_CAPTURE_FROM nor DOC_SEND_EMAIL is set");
    return;
  }
  console.log(`[doc] scheduler on: capture ${captureOn() ? "ON" : "off"}, sending ${sendingOn() ? "ON" : "off"}`);
  const t = setInterval(() => void tick(), TICK_MS);
  t.unref?.();
  void tick();
}
