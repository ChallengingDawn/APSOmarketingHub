// PRICE-CHECK TICKETS, AS SOON AS THEY QUALIFY.
//
// SARCLA, 10.10: "why are price-check tickets not being created?" - because
// nothing created them on its own: only the Create button on /uc/price-checks
// did, so a day nobody pressed it for passed without a ticket. Asked whether they
// should come every morning or as soon as they qualify: "as soon as they qualify".
//
// So every quarter of an hour the hub runs EXACTLY what the button runs -
// runPriceCheckTickets({ dry: false }): the same rule, the working-day wait, the
// order check, the dedup on price_check_key and the refusal when the `tags`
// option is missing. A day is ticketed on the first tick after its wait has
// passed. Both copies of the hub tick; an advisory lock keeps it to one.
// PRICE_CHECK_TICKETS=off stops it; the button stays for a manual run.

import { getPool } from "@/lib/db/client";
import { kvSet } from "@/lib/db/init";
import { runPriceCheckTickets } from "@/lib/integrations/priceCheckTickets";

/** 4107201 DoC, 4107202 Erosion, 4107203 Articles, 4107204 Segmentation, 4107205 shop looks, 4107206 notify, 4107207 connector steps. */
const PRICE_CHECK_LOCK = 4_107_208;
const TICK_MS = 15 * 60_000;
export const KV_AUTO = "pricecheck:auto:last";

export type AutoRun = { at: string; ok: boolean; created: number; considered: number; error: string | null };

async function tick() {
  let client;
  try {
    client = await getPool().connect();
  } catch (e) {
    console.warn(`[price-checks] no database, tick skipped: ${(e as Error).message}`);
    return;
  }
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [PRICE_CHECK_LOCK]);
    if (!got.rows[0]?.ok) return;
    const at = new Date().toISOString();
    try {
      const r = await runPriceCheckTickets({ dry: false });
      const status: AutoRun = { at, ok: true, created: r.created, considered: r.considered, error: null };
      await kvSet(KV_AUTO, status);
      if (r.created) console.log(`[price-checks] auto: ${r.created} ticket(s) raised of ${r.considered} customer-days`);
    } catch (e) {
      const error = String((e as Error)?.message ?? e);
      await kvSet(KV_AUTO, { at, ok: false, created: 0, considered: 0, error } satisfies AutoRun).catch(() => {});
      console.warn(`[price-checks] auto run failed: ${error}`);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [PRICE_CHECK_LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

let started = false;

export function startPriceCheckScheduler() {
  if (started || String(process.env.PRICE_CHECK_TICKETS ?? "").toLowerCase() === "off") return;
  started = true;
  console.log("[price-checks] scheduler on: tickets raised as soon as a day qualifies (every 15 min)");
  const timer = setInterval(() => void tick(), TICK_MS);
  timer.unref?.();
  // after the boot rush of the other schedulers
  setTimeout(() => void tick(), 3 * 60_000).unref?.();
}
