// EROSION'S TIMER IN THE HUB.
//
// Once a day, after the connector's nightly chain has finished - the same night's
// order data the connector's own erosion step used to read. Only while this
// deployment OWNS erosion: EROSION_DETECTOR=live. Unset, it does nothing at all and
// the connector raises the tickets, so the two never both write.
//
// Production runs two copies of the hub, so every tick takes a Postgres advisory
// lock first; the copy that does not get it skips the tick. A day is tried at most
// three times, half an hour apart - a failure that repeats is reported, not hammered.

import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { KV, chainDoneToday, importConnectorKeys, runErosion, utcToday } from "./run";

const EROSION_LOCK = 4_107_202;
const TICK_MS = 10 * 60_000;
const MAX_TRIES = 3;
const RETRY_AFTER_MS = 30 * 60_000;

export const erosionLive = () => process.env.EROSION_DETECTOR === "live";

async function withErosionLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [EROSION_LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await fn();
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [EROSION_LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

type Tried = { today: string; count: number; at: string; error?: string };

async function tick() {
  await withErosionLock(async () => {
    // the connector's memory first, on the first tick after the switch - not at the
    // first run - so the import can be checked in the logs the moment the hub takes over
    if (!(await kvGet(KV.imported))) {
      try {
        console.log(`[erosion] imported ${await importConnectorKeys()} erosion keys from the connector`);
      } catch (e) {
        console.warn(`[erosion] key import failed, will retry: ${(e as Error).message}`);
        return;
      }
    }
    const today = utcToday();
    const last = await kvGet<{ today: string }>(KV.last);
    if (last?.today === today) return;                       // already ran today
    const tried = await kvGet<Tried>(KV.tried);
    const t = tried?.today === today ? tried : { today, count: 0, at: "" };
    if (t.count >= MAX_TRIES) return;
    if (t.at && Date.now() - Date.parse(t.at) < RETRY_AFTER_MS) return;
    const chain = await chainDoneToday(today);
    if (!chain.done) return;                                 // tonight's data is not in yet
    const at = new Date().toISOString();
    await kvSet(KV.tried, { today, count: t.count + 1, at });
    try {
      const run = await runErosion("live", today);
      console.log(`[erosion] ${today}: created ${run.created}, merged ${run.merged}, failed ${run.failed}, held ${run.heldOpenOrder} on open orders`);
    } catch (e) {
      const error = (e as Error).message;
      console.warn(`[erosion] run failed (try ${t.count + 1}/${MAX_TRIES}): ${error}`);
      await kvSet(KV.tried, { today, count: t.count + 1, at, error });
    }
  }).catch((e) => console.warn(`[erosion] no run this tick: ${(e as Error).message}`));
}

let started = false;

export function startErosionScheduler() {
  if (started) return;
  started = true;
  if (!erosionLive()) {
    console.log("[erosion] scheduler idle: EROSION_DETECTOR is not 'live' - the connector raises the tickets");
    return;
  }
  console.log("[erosion] scheduler on: the hub raises the erosion tickets after each nightly chain");
  const timer = setInterval(() => void tick(), TICK_MS);
  timer.unref?.();
  void tick();
}
