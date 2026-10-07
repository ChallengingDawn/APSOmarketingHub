// RUNNING THE CONNECTOR'S STEPS IN THE HUB - one at a time across both copies of
// the hub (a Postgres advisory lock), as a PREVIEW (reads, writes nothing) or LIVE.
//
// The switch, per step, is "never both writing, never neither": the hub runs a
// step live only while the Compass connector reports, on its /chain/status, that
// it skips that step (its HUB_STEPS setting). Turning a step live here without
// that is refused; a step the connector skips but the hub does not run is shown
// as a gap on the page.

import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { connectorGet } from "@/lib/erosion/run";
import { companyStats, contactShipment, mandantSweep, type StepResult } from "./companyFacts";

export const HUB_STEPS = ["mandant_sweep", "company_stats", "contact_shipment"] as const;
export type HubStep = (typeof HUB_STEPS)[number];
export type Mode = "preview" | "live";
export type HubRun = { key: HubStep; mode: Mode; by: string; started: string; finished?: string; result?: StepResult; error?: string };

const LOCK = 4_107_207;
const KV = {
  live: "connectors:hub:live",
  run: (mode: Mode, key: HubStep) => `connectors:hub:${mode}:${key}`,
  busy: "connectors:hub:busy",
};

const STEP_FN: Record<HubStep, (live: boolean, beat: () => Promise<void>, full?: boolean) => Promise<StepResult>> = {
  mandant_sweep: (live, beat) => mandantSweep(live, beat),
  company_stats: (live, beat, full) => companyStats(live, beat, full),
  contact_shipment: (live, beat, full) => contactShipment(live, beat, full),
};

export const isHubStep = (k: string): k is HubStep => (HUB_STEPS as readonly string[]).includes(k);

/** Steps the hub runs live. */
export async function liveSteps(): Promise<Set<HubStep>> {
  const m = (await kvGet<Record<string, boolean>>(KV.live)) ?? {};
  return new Set(HUB_STEPS.filter((k) => m[k]));
}

/** Steps the Compass connector says it leaves to the hub (its HUB_STEPS setting). */
export async function connectorSkips(): Promise<Set<string> | null> {
  try {
    const s = await connectorGet<{ hub_steps?: string[] }>("/chain/status");
    return new Set(s.hub_steps ?? []);
  } catch {
    return null;
  }
}

/** Turn a step live in the hub - only when the connector already skips it. */
export async function setLive(key: HubStep, on: boolean): Promise<{ ok: boolean; note: string }> {
  if (on) {
    const skips = await connectorSkips();
    if (!skips) return { ok: false, note: "The connector cannot be asked - not switching" };
    if (!skips.has(key)) return { ok: false, note: `The connector still runs ${key} - set it in its HUB_STEPS first, or both would write` };
  }
  const m = (await kvGet<Record<string, boolean>>(KV.live)) ?? {};
  m[key] = on;
  await kvSet(KV.live, m);
  return { ok: true, note: `${key} ${on ? "runs in the hub now" : "no longer runs in the hub"}` };
}

export async function lastRun(mode: Mode, key: HubStep): Promise<HubRun | null> {
  return (await kvGet<HubRun>(KV.run(mode, key))) ?? null;
}

export async function busy(): Promise<{ key: string; mode: Mode; started: string; heartbeat: string } | null> {
  const b = await kvGet<{ key: string; mode: Mode; started: string; heartbeat: string }>(KV.busy);
  if (!b || Date.now() - Date.parse(b.heartbeat) > 2 * 3_600_000) return null;
  return b;
}

/** Run a step under the lock and record it; null when another step holds the lock. */
async function locked(key: HubStep, mode: Mode, by: string, full: boolean): Promise<HubRun | null> {
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    const started = new Date().toISOString();
    const beat = () => kvSet(KV.busy, { key, mode, started, heartbeat: new Date().toISOString() });
    const run: HubRun = { key, mode, by, started };
    try {
      await beat();
      // a live run re-checks the switch at the last moment: never write while the connector does
      if (mode === "live") {
        const skips = await connectorSkips();
        if (!skips?.has(key)) throw new Error("the connector does not skip this step (HUB_STEPS) - live run refused");
      }
      run.result = await STEP_FN[key](mode === "live", beat, full);
    } catch (e) {
      run.error = (e as Error).message.slice(0, 400);
    } finally {
      run.finished = new Date().toISOString();
      await kvSet(KV.run(mode, key), run).catch(() => {});
      await kvSet(KV.busy, null).catch(() => {});
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
    console.log(`[connectors] ${key} ${mode} by ${by}: ${run.error ? `FAILED ${run.error}` : JSON.stringify({ ...run.result, examples: undefined }).slice(0, 400)}`);
    return run;
  } finally {
    client.release();
  }
}

/** Start a step in the background; false when one is already running. */
export async function startStep(key: HubStep, mode: Mode, by: string, full = false): Promise<{ started: boolean; note: string }> {
  if (await busy()) return { started: false, note: "another step is running - try again when it has finished" };
  void locked(key, mode, by, full);
  return { started: true, note: `${key} ${mode === "preview" ? "preview" : "run"} started` };
}

/** For the scheduler: run and wait. */
export function runNow(key: HubStep, mode: Mode, by: string, full = false): Promise<HubRun | null> {
  return locked(key, mode, by, full);
}
