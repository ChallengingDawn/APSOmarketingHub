// THE COMPASS CONNECTOR'S STATUS, as the Connectors & Integration app shows it.
//
// Read-only, with the connector's read key: the chain status, the service's
// state (last runs, SFTP pulls, review queue, counts) and its incoming files.
// Nothing here can start a run, upload, resolve or link - those stay on the
// connector's shared key until each step has moved to the hub. A path the read
// key does not open yet (before the connector's 06.10 update is deployed) is
// reported as such rather than failing the page.

import { connect } from "node:net";
import { kvGet, kvSet } from "@/lib/db/init";
import { connectorGet } from "@/lib/erosion/run";
import { IntegrationError } from "./status";
import { CONNECTOR_RETIRED } from "@/lib/connectors/retired";

import type { ChainStatus, IncomingFile, RawState, Snapshot, StepMemo } from "@/lib/connectors/snapshot";

export type { Snapshot };

const TTL_MS = 30_000;
/** Each step's latest result, kept here because the connector's own record holds only the last check. */
const KV_STEPS = "connectors:compass:steps";
let cache: { at: number; p: Promise<Snapshot> } | null = null;

const why = (e: unknown) =>
  e instanceof IntegrationError && e.status === 401
    ? "The connector does not open this to the hub yet - its 06.10 update is not deployed"
    : (e as Error).message.slice(0, 200);

const SFTP_HOST = "b2b.angst-pfister.com";

/**
 * Can the hub reach the ERP's SFTP server at all? A plain TCP connection that
 * reads the server's SSH greeting and hangs up - no key, no login. The server
 * may only accept the connector's fixed Railway address; this answers that
 * before the file steps move here (the hub leaves AWS from 35.156.30.228).
 */
export function sftpReachable(host = SFTP_HOST, port = 22, timeoutMs = 6000): Promise<{ ok: boolean; banner?: string; error?: string; ms: number }> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    let done = false;
    const sock = connect({ host, port });
    const finish = (r: { ok: boolean; banner?: string; error?: string }) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve({ ...r, ms: Date.now() - t0 });
    };
    sock.setTimeout(timeoutMs, () => finish({ ok: false, error: `no answer within ${timeoutMs / 1000} s - likely blocked by a firewall` }));
    sock.once("data", (b) => finish({ ok: true, banner: b.toString("utf8").split(String.fromCharCode(10))[0].trim().slice(0, 80) }));
    sock.once("error", (e) => finish({ ok: false, error: e.message.slice(0, 120) }));
  });
}

/** The hub's own records only - the connector is switched off (retired.ts). */
async function readHub(): Promise<Snapshot> {
  const q = (await kvGet<NonNullable<RawState["review_queue"]>>("connectors:hub:review-queue").catch(() => null)) ?? [];
  return {
    at: new Date().toISOString(),
    chain: null, chainError: null, state: null, stateError: null,
    review: {
      pending: q.filter((i) => (i.status ?? "pending") !== "resolved").length,
      resolved: q.filter((i) => i.status === "resolved").length,
      total: q.length,
      items: [...q].sort((a, b) => (b.revenue_eur ?? 0) - (a.revenue_eur ?? 0)).slice(0, 1000),
    },
    files: null,
    sftpFromHub: undefined,
    stepsLast: (await kvGet<Record<string, StepMemo>>(KV_STEPS).catch(() => null)) ?? {},
  };
}

async function read(): Promise<Snapshot> {
  if (CONNECTOR_RETIRED) return readHub();
  const [chain, state, files, sftp] = await Promise.allSettled([
    connectorGet<ChainStatus>("/chain/status"),
    connectorGet<RawState>("/state"),
    connectorGet<{ files?: IncomingFile[] }>("/files-list"),
    sftpReachable(),
  ]);
  let st: Snapshot["state"] = null;
  let review: Snapshot["review"] = null;
  if (state.status === "fulfilled") {
    const { review_queue, ...rest } = state.value;
    // only what the pages draw - the state also carries the frozen erosion forecast
    st = {
      last_run: rest.last_run, sftp: rest.sftp, kpis: rest.kpis, progress: rest.progress,
      watermarks: rest.watermarks, orders_daily: rest.orders_daily,
    };
    const q = review_queue ?? [];
    review = {
      pending: q.filter((i) => (i.status ?? "pending") !== "resolved").length,
      resolved: q.filter((i) => i.status === "resolved").length,
      total: q.length,
      items: [...q].sort((a, b) => (b.revenue_eur ?? 0) - (a.revenue_eur ?? 0)).slice(0, 1000),
    };
  }
  // once the revenue step runs in the hub, its review queue is the hub's own
  try {
    const live = (await kvGet<Record<string, boolean>>("connectors:hub:live")) ?? {};
    if (live.revenue) {
      const q = (await kvGet<NonNullable<RawState["review_queue"]>>("connectors:hub:review-queue")) ?? [];
      review = {
        pending: q.filter((i) => (i.status ?? "pending") !== "resolved").length,
        resolved: q.filter((i) => i.status === "resolved").length,
        total: q.length,
        items: [...q].sort((a, b) => (b.revenue_eur ?? 0) - (a.revenue_eur ?? 0)).slice(0, 1000),
      };
    }
  } catch (e) {
    console.warn(`[connectors] hub review queue: ${(e as Error).message}`);
  }
  // remember every step the latest check reported - newer wins
  let stepsLast: Record<string, StepMemo> = {};
  try {
    stepsLast = (await kvGet<Record<string, StepMemo>>(KV_STEPS)) ?? {};
    const proc = st?.sftp?.last_processing;
    let changed = false;
    for (const x of proc?.processing ?? []) {
      const at = proc?.ts ?? 0;
      if (!stepsLast[x.step] || stepsLast[x.step].at < at) {
        stepsLast[x.step] = { at, ...(x.error ? { error: x.error } : { result: x.result ?? null }) };
        changed = true;
      }
    }
    if (changed) await kvSet(KV_STEPS, stepsLast);
  } catch (e) {
    console.warn(`[connectors] step memory: ${(e as Error).message}`);
  }
  return {
    at: new Date().toISOString(),
    chain: chain.status === "fulfilled" ? chain.value : null,
    chainError: chain.status === "rejected" ? why(chain.reason) : null,
    state: st,
    stateError: state.status === "rejected" ? why(state.reason) : null,
    review,
    files: files.status === "fulfilled" ? files.value.files ?? [] : null,
    sftpFromHub: sftp.status === "fulfilled" ? sftp.value : { ok: false, error: String(sftp.reason).slice(0, 120), ms: 0 },
    stepsLast,
  };
}

/** The connector's status, held 30 seconds so a busy page does not hammer it. */
export function compassSnapshot(fresh = false): Promise<Snapshot> {
  if (!cache || fresh || Date.now() - cache.at > TTL_MS) {
    const p = read();
    cache = { at: Date.now(), p };
    p.catch(() => { if (cache?.p === p) cache = null; });
  }
  return cache.p;
}
