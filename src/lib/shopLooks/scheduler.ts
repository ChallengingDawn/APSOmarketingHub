// Every quarter of an hour, copy the shop activity into the hub's database
// before the gateway's 50-line window overwrites it. Both copies of the hub
// tick; a Postgres advisory lock keeps it to one. Read-only against HubSpot, so
// it runs wherever the hub runs - SHOP_LOOKS=off stops it.

import { getPool } from "@/lib/db/client";
import { sweepShopLooks } from "./store";

/** 4107201 DoC, 4107202 Erosion, 4107203 Articles, 4107204 Segmentation. */
const LOOKS_LOCK = 4_107_205;
const TICK_MS = 15 * 60_000;

async function tick() {
  let client;
  try {
    client = await getPool().connect();
  } catch (e) {
    console.warn(`[shoplooks] no database, tick skipped: ${(e as Error).message}`);
    return;
  }
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOOKS_LOCK]);
    if (!got.rows[0]?.ok) return;
    try {
      const s = await sweepShopLooks();
      console.log(`[shoplooks] ${s.companies} companies, ${s.looks} look lines, ${s.days} days kept`);
    } catch (e) {
      console.warn(`[shoplooks] sweep failed: ${(e as Error).message}`);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOOKS_LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

let started = false;

export function startShopLooksScheduler() {
  if (started || String(process.env.SHOP_LOOKS ?? "").toLowerCase() === "off") return;
  started = true;
  const timer = setInterval(() => void tick(), TICK_MS);
  timer.unref?.();
  setTimeout(() => void tick(), 90_000).unref?.();
}
