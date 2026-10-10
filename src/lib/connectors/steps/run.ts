// RUNNING THE CONNECTOR'S STEPS IN THE HUB - one at a time across both copies of
// the hub (a Postgres advisory lock), as a PREVIEW (reads, writes nothing) or LIVE.
//
// The switch, per step, is "never both writing, never neither": the hub runs a
// step live only while the Compass connector reports, on its /chain/status, that
// it skips that step (its HUB_STEPS setting). Turning a step live here without
// that is refused; a step the connector skips but the hub does not run is shown
// as a gap on the page.
//
// A file step reads the ERP's files: the hub's chain passes the folder it has just
// pulled into; a preview fetches the latest files into a folder of its own (the
// download record is left alone, so a preview never makes the chain skip a file).

import { stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { connectorGet } from "@/lib/erosion/run";
import { fetchLatest } from "../sftp";
import type { StepResult } from "./companyFacts";
import { REGISTRY, STEP_KEYS, stepDef } from "./registry";
import { stepName } from "../compass";
import { CONNECTOR_RETIRED } from "../retired";

export const HUB_STEPS = STEP_KEYS;
export type HubStep = string;
export type Mode = "preview" | "live";
export type HubRun = { key: HubStep; mode: Mode; by: string; started: string; finished?: string; result?: StepResult; error?: string };

/** Where the hub's chain keeps the ERP files it pulled, and where previews fetch theirs. */
export const INCOMING = path.join(os.tmpdir(), "compass-incoming");
export const PREVIEW_DIR = path.join(os.tmpdir(), "compass-preview");
const PREVIEW_FRESH_MS = 6 * 3_600_000;

// Two lanes, one run at a time in each across both copies of the hub. The ERP lane takes the
// chain, the file steps and the hand-started steps - a chain can take an hour. The sweeps
// (mandant, wrong owners, holiday redirection: every 15/30 minutes, HubSpot only) have their
// own, so they keep their rhythm beside it, as on the connector (10.10.2026).
export type Lane = "erp" | "sweep";
const LOCK: Record<Lane, number> = { erp: 4_107_207, sweep: 4_107_209 };
const KV = {
  live: "connectors:hub:live",
  run: (mode: Mode, key: HubStep) => `connectors:hub:${mode}:${key}`,
  busy: { erp: "connectors:hub:busy", sweep: "connectors:hub:busy-sweep" } as Record<Lane, string>,
};

/** The lane a step runs in: the 15/30-minute sweeps have their own. */
export function laneOf(key: HubStep): Lane {
  const c = stepDef(key)?.cadence;
  return c === "30min" || c === "15min" ? "sweep" : "erp";
}

export const isHubStep = (k: string): boolean => STEP_KEYS.includes(k);
export const sftpConfigured = () => !!process.env.SFTP_KEY;

/** Steps the hub runs live. */
export async function liveSteps(): Promise<Set<HubStep>> {
  const m = (await kvGet<Record<string, boolean>>(KV.live)) ?? {};
  return new Set(STEP_KEYS.filter((k) => m[k]));
}

/** Steps the Compass connector says it leaves to the hub (its HUB_STEPS setting). */
export async function connectorSkips(): Promise<Set<string> | null> {
  // the connector is switched off: every step - and the pull - is the hub's
  if (CONNECTOR_RETIRED) return new Set([...STEP_KEYS, "sftp_pull"]);
  try {
    const s = await connectorGet<{ hub_steps?: string[] }>("/chain/status");
    return new Set(s.hub_steps ?? []);
  } catch {
    return null;
  }
}

/** Turn a step live in the hub - only when the connector already skips it. */
export async function setLive(key: HubStep, on: boolean): Promise<{ ok: boolean; note: string }> {
  const def = stepDef(key);
  if (!def) return { ok: false, note: `unknown step ${key}` };
  if (on) {
    if (def.file && !sftpConfigured()) return { ok: false, note: `${stepName(key)} reads the ERP's files - the hub has no SFTP key yet` };
    // a step the connector never had (hubOnly) has nothing to hand over - nothing to ask it
    const skips = def.hubOnly ? new Set<string>([key]) : await connectorSkips();
    if (!skips) return { ok: false, note: "The connector cannot be asked - not switching" };
    if (!skips.has(key) && def.cadence !== "manual") return { ok: false, note: `The connector still runs "${stepName(key)}" - hand it over in the connector's HUB_STEPS first, or both would write` };
  }
  const m = (await kvGet<Record<string, boolean>>(KV.live)) ?? {};
  m[key] = on;
  await kvSet(KV.live, m);
  return { ok: true, note: `${stepName(key)} ${on ? "runs in the hub now" : "no longer runs in the hub"}` };
}

export async function lastRun(mode: Mode, key: HubStep): Promise<HubRun | null> {
  return (await kvGet<HubRun>(KV.run(mode, key))) ?? null;
}

export async function busy(lane: Lane = "erp"): Promise<{ key: string; mode: Mode; started: string; heartbeat: string } | null> {
  const b = await kvGet<{ key: string; mode: Mode; started: string; heartbeat: string }>(KV.busy[lane]);
  if (!b || Date.now() - Date.parse(b.heartbeat) > 2 * 3_600_000) return null;
  return b;
}

/** Under the step lock, across both copies of the hub; null when another run holds it. */
export async function withLock<T>(label: string, mode: Mode, fn: (beat: () => Promise<void>) => Promise<T>, lane: Lane = "erp"): Promise<T | null> {
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK[lane]]);
    if (!got.rows[0]?.ok) return null;
    const started = new Date().toISOString();
    const beat = () => kvSet(KV.busy[lane], { key: label, mode, started, heartbeat: new Date().toISOString() });
    try {
      await beat();
      return await fn(beat);
    } finally {
      await kvSet(KV.busy[lane], null).catch(() => {});
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK[lane]]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

/** The latest ERP files for a preview - fetched at most every 6 hours. */
async function previewFiles(file: string): Promise<string> {
  const p = path.join(PREVIEW_DIR, file);
  const fresh = await stat(p).then((s) => Date.now() - s.mtimeMs < PREVIEW_FRESH_MS, () => false);
  if (!fresh) {
    const r = await fetchLatest(PREVIEW_DIR);
    console.log(`[connectors] preview files: ${r.pulled.length} files, ${Math.round(r.pulled.reduce((t, x) => t + x.mb, 0))} MB in ${r.seconds ?? "?"} s${r.error ? ` - FAILED ${r.error}` : ""}`);
    if (r.error) throw new Error(`fetching the ERP files for the preview: ${r.error}`);
  }
  return PREVIEW_DIR;
}

/** One step, inside a lock the caller holds; recorded for the page. */
export async function runStepInside(key: HubStep, mode: Mode, by: string, beat: () => Promise<void>, opts: { full?: boolean; dir?: string | null } = {}): Promise<HubRun> {
  const def = stepDef(key);
  const run: HubRun = { key, mode, by, started: new Date().toISOString() };
  try {
    if (!def) throw new Error(`unknown step ${key}`);
    // a live run re-checks the switch at the last moment: never write while the connector does
    if (mode === "live" && def.cadence !== "manual" && !def.hubOnly) {
      const skips = await connectorSkips();
      if (!skips?.has(key)) throw new Error("the connector does not skip this step (HUB_STEPS) - live run refused");
    }
    let dir = opts.dir ?? null;
    if (def.file && !dir) {
      if (!sftpConfigured()) throw new Error("this step reads the ERP's files - the hub has no SFTP key yet");
      dir = mode === "preview" ? await previewFiles(def.file) : INCOMING;
    }
    run.result = await def.run({ live: mode === "live", beat, full: opts.full, dir });
  } catch (e) {
    run.error = (e as Error).message.slice(0, 400);
  }
  run.finished = new Date().toISOString();
  await kvSet(KV.run(mode, key), run).catch(() => {});
  console.log(`[connectors] ${key} ${mode} by ${by}: ${run.error ? `FAILED ${run.error}` : JSON.stringify({ ...run.result, examples: undefined }).slice(0, 400)}`);
  return run;
}

/** Run a step under the lock and record it; null when another step holds the lock. */
function locked(key: HubStep, mode: Mode, by: string, opts: { full?: boolean; dir?: string | null }): Promise<HubRun | null> {
  return withLock(key, mode, (beat) => runStepInside(key, mode, by, beat, opts), laneOf(key));
}

/** Start a step in the background; false when one is already running. */
export async function startStep(key: HubStep, mode: Mode, by: string, full = false): Promise<{ started: boolean; note: string }> {
  if (await busy(laneOf(key))) return { started: false, note: "another step is running - try again when it has finished" };
  void locked(key, mode, by, { full });
  return { started: true, note: `${stepName(key)}: ${mode === "preview" ? "test run started - it writes nothing" : "live run started"}` };
}

/** For the scheduler: run and wait. */
export function runNow(key: HubStep, mode: Mode, by: string, full = false): Promise<HubRun | null> {
  return locked(key, mode, by, { full });
}

export { REGISTRY };
