// MAP ASSIGNMENT - "Fix N in HubSpot" on a topic of the Differences (SARCLA 25.10.2026, instead of the OK: "this should
// not create new rules on the assignment - it should only correct the new ones because they are not related to
// Performis, so we can fix them - it's more 'fix' for me"). The topic's companies a fix may touch (topics.ts FIXABLE: the
// zip-code ones without an SAE, region responsibility to fill, contacts to follow, key accounts), in the country asked
// for or all: each read and decided again, written as a live country would (engine.ts fixCompanies: owner + region
// responsibility, then its own contacts), only what differs, every write logged (apsomh_map_assign_log, undo = "before").
// The rules are never touched. In the background under its own advisory lock 4107243; how far it is in kv
// mapAssign:fixNow, the last one in mapAssign:fixLast.

import type { PoolClient } from "pg";
import { getPool, query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { ensureMapAssign, fixCompanies, type FixFacts } from "./engine";
import { differingRows } from "./topicsDb";
import { FIXABLE, topicOf, type TopicId } from "./topics";
import type { FixRun, FixState } from "./fixState";

const LOCK = 4_107_243;
const KV = { now: "mapAssign:fixNow", last: "mapAssign:fixLast" };
const LIMIT_MS = 30 * 60_000;
const msg = (e: unknown) => String((e as Error)?.message ?? e).replace(/\s+/g, " ").slice(0, 200);
const ccOf = (country: string | null) => (String(country ?? "").trim() ? String(country).trim().toUpperCase() : "??");

/** Read again at the write: still what the topic's fix was asked for (an SAE that came meanwhile makes it Performis'). */
function stillFixable(topic: TopicId, f: FixFacts): boolean {
  switch (topic) {
    case "rule2": return !String(f.sae ?? "").trim() && (f.via === "zone" || f.via === "default");
    case "region": return String(f.ownerNow ?? "") === String(f.decided);
    case "contacts": return String(f.ownerNow ?? "") === String(f.decided) && String(f.regionNow ?? "") === String(f.decided);
    case "key": return f.via === "key";
    default: return false;
  }
}

let busy = false;

/** Start a fix in the background; false (with why) when one is going or the topic is fixed elsewhere. */
export function kickFix(topic: TopicId, country: string | null, by: string): { started: boolean; why?: string } {
  if (!FIXABLE[topic]) return { started: false, why: "this topic is not fixed from here" };
  if (busy) return { started: false, why: "a fix is going already" };
  busy = true;
  const limit = new AbortController();
  const timer = setTimeout(() => { console.error(`[map-assign] fix still going after ${LIMIT_MS / 60_000} min - stopped`); limit.abort(); busy = false; }, LIMIT_MS);
  timer.unref?.();
  void fix(topic, country, by, limit.signal)
    .catch((e) => console.warn(`[map-assign] fix: ${msg(e)}`))
    .finally(() => { clearTimeout(timer); if (!limit.signal.aborted) busy = false; });
  return { started: true };
}

async function fix(topic: TopicId, country: string | null, by: string, signal: AbortSignal): Promise<void> {
  await ensureMapAssign();
  const client: PoolClient = await getPool().connect();
  let dropped = false;
  const drop = () => { dropped = true; client.release(new Error("map assignment fix: time limit")); };
  signal.addEventListener("abort", drop, { once: true });
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) { console.warn("[map-assign] fix: one is going on the other copy - not started"); return; }
    const t0 = Date.now();
    const can = FIXABLE[topic]!;
    const run: FixRun = { topic, country, by, at: new Date(t0).toISOString(), companies: 0, done: 0, wrote: 0, contacts: 0, failed: 0 };
    try {
      const ids = (await differingRows()).filter((r) => topicOf(r) === topic && (!country || ccOf(r.country) === country) && can(r)).map((r) => r.id);
      run.companies = ids.length;
      await kvSet(KV.now, run);
      const w = await fixCompanies(ids, by, {
        signal, only: (f) => stillFixable(topic, f),
        onBatch: async (x) => {
          run.done = Math.min(ids.length, run.done + 100); run.wrote = x.companies; run.contacts = x.contacts; run.failed = x.failed;
          await kvSet(KV.now, run).catch(() => {});
        },
      });
      run.done = ids.length; run.wrote = w.companies; run.contacts = w.contacts; run.failed = w.failed;
    } catch (e) {
      run.error = msg(e);
    } finally {
      if (!dropped) await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
    run.seconds = Math.round((Date.now() - t0) / 1000);
    await kvSet(KV.last, run).catch(() => {});
    await kvSet(KV.now, null).catch(() => {});
    console.log(`[map-assign] fix ${topic}${country ? ` (${country})` : ""} by ${by}: ${run.wrote} companies, ${run.contacts} contacts written, ${run.failed} not${run.error ? ` - ${run.error}` : ""}`);
  } finally {
    signal.removeEventListener("abort", drop);
    if (!dropped) client.release();
  }
}

/** Is a fix going - here, or on the other copy of the hub (its advisory lock)? */
async function isFixRunning(): Promise<boolean> {
  if (busy) return true;
  const r = await query<{ held: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND classid = 0 AND objid = $1::bigint::oid AND objsubid = 1 AND granted) AS held`, [LOCK],
  );
  return !!r.rows[0]?.held;
}

/** For GET ?topics=1: a fix going (how far) and the last one. */
export async function fixState(): Promise<FixState> {
  const running = await isFixRunning().catch(() => false);
  const now = running ? ((await kvGet<FixRun | null>(KV.now).catch(() => null)) ?? null) : null;
  const last = (await kvGet<FixRun | null>(KV.last).catch(() => null)) ?? null;
  return { running, now, last };
}
