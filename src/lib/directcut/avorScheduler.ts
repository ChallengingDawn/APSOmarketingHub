// TELLING AVOR AS SOON AS THE A-NUMBER ARRIVES.
//
// SARCLA, 18.10.2026: "yes automatily!" — the pack-the-leftover mail should not wait for somebody to
// notice an order and press a button. The wording itself says "as soon as the A number arrives", so a
// screen that only tells AVOR when a person happens to look at it is not doing what the wording promises.
//
// So every quarter of an hour the hub runs EXACTLY what the button runs — mailLeftovers({ dry: false }):
// the same rule (every line a whole piece off the shelf), the same wait for the A-number, the same
// held-back when a Lagerplatz is missing, and the same dedupe on the ERP order number.
//
// THREE THINGS KEEP IT FROM SENDING TWICE, and they are not redundant:
//   · the kv log, keyed by A-number — survives a redeploy, which a timer does not;
//   · a Postgres advisory lock — BOTH copies of the hub tick, and without it both would read "not yet
//     sent" in the same instant and both would send. This is mail to a person, so a race is not a
//     cosmetic duplicate;
//   · the lock is released on the same connection before the status is written, because holding one
//     connection while waiting for another is how a tick hung for two hours behind the ERP chain on 10.10.
//
// C2S_AVOR_MAIL=off stops it. The button on the Leftovers tab stays either way, and a rehearsal there
// still reports without sending.

import { getPool } from "@/lib/db/client";
import { kvSet } from "@/lib/db/init";
import { mailLeftovers, type MailReport } from "./leftovers";

/** 4107201 DoC … 4107214 taken; this is the next one. */
const AVOR_LOCK = 4_107_215;
const TICK_MS = 15 * 60_000;
const CONNECT_TIMEOUT_MS = 30_000;
export const KV_AUTO = "directcut:avor:auto:last";

export type AvorRun = {
  at: string; ok: boolean; sent: number; already: number; skipped: number; failed: number;
  error: string | null;
  /** the A-numbers told on this run, so the page can say which without re-reading HubSpot */
  told?: string[];
  /** the first few that could not be sent, word for word */
  failures?: string[];
};

async function connectWithin(ms: number) {
  const pool = getPool();
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      pool.connect(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`no database connection within ${Math.round(ms / 1000)}s`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function tick() {
  let client;
  try {
    client = await connectWithin(CONNECT_TIMEOUT_MS);
  } catch (e) {
    console.warn(`[c2s-avor] tick skipped: ${(e as Error).message}`);
    return;
  }
  const at = new Date().toISOString();
  let status: AvorRun | null = null;
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [AVOR_LOCK]);
    if (!got.rows[0]?.ok) return;          // the other task has it
    try {
      const r: MailReport = await mailLeftovers({ dry: false, who: "the hub (automatic)" });
      const told = r.outcomes.filter((o) => o.outcome === "sent").map((o) => o.erpNo ?? o.orderNo);
      const failures = r.outcomes.filter((o) => o.outcome === "error").slice(0, 3)
        .map((o) => `${o.erpNo ?? o.orderNo}: ${o.error ?? "?"}`);
      status = { at, ok: true, sent: r.sent, already: r.already, skipped: r.skipped, failed: r.failed, error: null, told, failures };
      // only worth a line when something actually happened: this runs 96 times a day
      if (r.sent || r.failed) {
        console.log(`[c2s-avor] auto: ${r.sent} told (${told.join(", ")}) · ${r.already} already · ${r.skipped} not ready · ${r.failed} failed`);
      }
      for (const f of failures) console.warn(`[c2s-avor] send failed — ${f}`);
    } catch (e) {
      const error = String((e as Error)?.message ?? e);
      status = { at, ok: false, sent: 0, already: 0, skipped: 0, failed: 0, error };
      console.warn(`[c2s-avor] auto run failed: ${error}`);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [AVOR_LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
  if (status) await kvSet(KV_AUTO, status).catch((e) => console.warn(`[c2s-avor] status not saved: ${(e as Error).message}`));
}

let started = false;

export function startAvorScheduler() {
  if (started || String(process.env.C2S_AVOR_MAIL ?? "").toLowerCase() === "off") return;
  started = true;
  console.log("[c2s-avor] scheduler on: AVOR is told to pack a leftover as soon as its A-number arrives (every 15 min)");
  const timer = setInterval(() => void tick(), TICK_MS);
  timer.unref?.();
  // after the boot rush of the other schedulers, and after the middleware has had time to settle
  setTimeout(() => void tick(), 4 * 60_000).unref?.();
}
