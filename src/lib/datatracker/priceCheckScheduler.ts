// PRICE-CHECK TICKETS, AS SOON AS THEY QUALIFY.
//
// SARCLA, 10.10: "why are price-check tickets not being created?" - because
// nothing created them on its own: only the Create button on /uc/price-checks
// did, so a day nobody pressed it for passed without a ticket. Asked whether they
// should come every morning or as soon as they qualify: "as soon as they qualify".
//
// So every quarter of an hour the hub runs EXACTLY what the button runs -
// runPriceCheckTickets({ dry: false }): the same rule, the working-day wait, the
// order check and the dedup on price_check_key. A day is ticketed on the first
// tick after its wait has passed. Both copies of the hub tick; an advisory lock
// keeps it to one. PRICE_CHECK_TICKETS=off stops it; the button stays.
//
// Every run says what became of each day - created, already there, ordered
// since, owner off roster, failed - in the log and on the page. "4 created of
// 317" with no reasons was not an answer anybody could act on.

import { getPool } from "@/lib/db/client";
import { kvSet } from "@/lib/db/init";
import { runPriceCheckTickets, type RunReport } from "@/lib/integrations/priceCheckTickets";

/** 4107201 DoC, 4107202 Erosion, 4107203 Articles, 4107204 Segmentation, 4107205 shop looks, 4107206 notify, 4107207 connector steps. */
const PRICE_CHECK_LOCK = 4_107_208;
const TICK_MS = 15 * 60_000;
/** A pool that cannot hand out a connection in this long is busy - skip the tick, never queue behind it. */
const CONNECT_TIMEOUT_MS = 30_000;
export const KV_AUTO = "pricecheck:auto:last";

export type AutoRun = {
  at: string; ok: boolean; created: number; considered: number; error: string | null;
  /** What became of every day the run looked at, by outcome. */
  outcomes?: Record<string, number>;
  /** The first few creation errors, word for word. */
  failures?: string[];
};

/** "waiting until 2026-10-12" and "2 of 3 articles" are one bucket each, not one per day. */
export function outcomeBuckets(report: Pick<RunReport, "rows">): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of report.rows) {
    const k = r.outcome.startsWith("waiting until") ? "waiting a working day"
      : r.outcome.startsWith("excluded") ? "excluded (APSOmicro, Prio 3/4)"
      : / of \d+ articles$/.test(r.outcome) ? "below the rule"
      : r.outcome === "exists" ? "ticket already there"
      : r.outcome;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

async function connectWithin(ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`no database connection within ${ms / 1000}s`)), ms); });
  const pending = getPool().connect();
  try {
    return await Promise.race([pending, timeout]);
  } catch (e) {
    // a connection that arrives after we gave up goes straight back
    pending.then((c) => c.release()).catch(() => {});
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function tick() {
  let client;
  try {
    client = await connectWithin(CONNECT_TIMEOUT_MS);
  } catch (e) {
    console.warn(`[price-checks] tick skipped: ${(e as Error).message}`);
    return;
  }
  const at = new Date().toISOString();
  let status: AutoRun | null = null;
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [PRICE_CHECK_LOCK]);
    if (!got.rows[0]?.ok) return;
    try {
      const r = await runPriceCheckTickets({ dry: false });
      const outcomes = outcomeBuckets(r);
      const failures = r.rows.filter((x) => x.outcome === "failed").slice(0, 3).map((x) => `${x.company ?? x.key}: ${x.error ?? "?"}`);
      status = { at, ok: true, created: r.created, considered: r.considered, error: null, outcomes, failures };
      const parts = Object.entries(outcomes).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ");
      console.log(`[price-checks] auto: ${r.created} raised of ${r.considered} customer-days · ${parts}`);
      for (const f of failures) console.warn(`[price-checks] create failed - ${f}`);
    } catch (e) {
      const error = String((e as Error)?.message ?? e);
      status = { at, ok: false, created: 0, considered: 0, error };
      console.warn(`[price-checks] auto run failed: ${error}`);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [PRICE_CHECK_LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
  // Written AFTER the lock's connection is back in the pool: holding one
  // connection while waiting for another is how the 13:29 tick on 10.10 hung
  // for two hours behind the ERP chain, lock and all.
  if (status) await kvSet(KV_AUTO, status).catch((e) => console.warn(`[price-checks] status not saved: ${(e as Error).message}`));
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
