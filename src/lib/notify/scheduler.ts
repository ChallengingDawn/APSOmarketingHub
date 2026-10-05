// THE MORNING POST.
//
// Once a day, at seven, about the day that just finished. Production runs two
// copies of the hub, so the tick takes a Postgres advisory lock first and the
// copy that does not get it does nothing — otherwise everybody gets the mail
// twice, which is how a useful notification becomes one people filter.
//
// A day is attempted once. If the scan fails, nobody gets yesterday's mail and
// the log says so; retrying into the afternoon would deliver "yesterday" to
// people who have already had lunch.

import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { runPriceCheckNotifications } from "./priceChecks";

const NOTIFY_LOCK = 4_107_203;
const TICK_MS = 10 * 60_000;
const SEND_HOUR = 7;
const KV_DONE = "notify:priceChecks:done";

/** Off unless asked for, like the other schedulers. */
export const notifyLive = () => process.env.NOTIFY_SCHEDULER === "live";

async function withLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [NOTIFY_LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await fn();
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [NOTIFY_LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function tick() {
  if (new Date().getHours() < SEND_HOUR) return;
  await withLock(async () => {
    const done = (await kvGet(KV_DONE)) as { day?: string } | null;
    const day = today();
    if (done?.day === day) return;
    // Marked before sending, not after: a crash halfway through a round must not
    // mean everybody who already had the mail gets a second one on the next tick.
    await kvSet(KV_DONE, { day, at: new Date().toISOString() });
    try {
      await runPriceCheckNotifications();
    } catch (e) {
      console.warn(`[notify] round failed: ${String(e)}`);
    }
  });
}

export function startNotifyScheduler() {
  if (!notifyLive()) return;
  setTimeout(() => { void tick(); }, 60_000).unref?.();
  setInterval(() => { void tick(); }, TICK_MS).unref?.();
  console.log("[notify] scheduler on: price-check summaries at %d:00", SEND_HOUR);
}
