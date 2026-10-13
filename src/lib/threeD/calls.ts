// THE 3D GATEWAY'S COUNTS, KEPT BY THE HUB (SARCLA, 13.10.2026: "the number of calls to AP-Link, and
// where they came from"). The gateway (Railway, APSOAssistant project) counts in memory only - every
// request and every AP-Link call by day, source, store view and kind, no customer data. Every quarter
// of an hour the hub reads those counts through its admin API (THREED_ADMIN_KEY) and adds what is new
// to apsomh_threed_usage, so the history lives here and a gateway restart costs at most 15 minutes.
//
// Delta, not copy: the gateway's counters are cumulative since its start (`bootId`), so the hub keeps
// the last numbers it saw and adds only the difference; a new bootId starts from zero.

import { getPool, query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { deltas, type Count } from "./counts";

export type { Count } from "./counts";

/** 4107212 owner-redirection publish; this one is the 3D counts. */
const LOCK = 4_107_213;
const TICK_MS = 15 * 60_000;
const KV_SEEN = "threeD:usage-seen";
const KV_CALLERS = "threeD:callers";
const KV_STATUS = "threeD:gateway-status";

/** The 3D Gateway's admin API - the new service, whatever address the shop uses meanwhile. */
export const gatewayAdminUrl = () => (process.env.THREED_GATEWAY_URL || "https://3d-gateway-production.up.railway.app").replace(/\/+$/, "");
export const adminKeySet = () => !!(process.env.THREED_ADMIN_KEY || "").trim();

async function gw<T>(path: string): Promise<T> {
  const key = (process.env.THREED_ADMIN_KEY || "").trim();
  if (!key) throw new Error("THREED_ADMIN_KEY is not set on the hub");
  const res = await fetch(`${gatewayAdminUrl()}/api/admin${path}`, { headers: { "x-admin-key": key }, signal: AbortSignal.timeout(60_000), cache: "no-store" });
  if (res.status === 403) throw new Error("The 3D Gateway refused the hub's key (THREED_ADMIN_KEY differs)");
  if (!res.ok) throw new Error(`The 3D Gateway answered ${res.status}`);
  return (await res.json()) as T;
}

export type Caller = { source: string; locale: string | null; what: string; lastAt: string; n: number };
export type GatewayStatus = {
  commit: string; bootId: string; bootedAt: string; uptime_s: number;
  aplink: { configured: boolean; reachable: boolean | null; ms: number | null; checkedAt: string | null; error: string | null };
  catalogue: { articles: number; categories: number };
};

let ready = false;
async function ensureTable(): Promise<void> {
  if (ready) return;
  await query(`CREATE TABLE IF NOT EXISTS apsomh_threed_usage (
    day date NOT NULL, source text NOT NULL, locale text NOT NULL DEFAULT '', kind text NOT NULL, n integer NOT NULL DEFAULT 0,
    PRIMARY KEY (day, source, locale, kind))`);
  ready = true;
}

/** One collection: counts (as deltas), callers and status. Returns how many count rows grew. */
export async function collect(): Promise<number> {
  await ensureTable();
  const u = await gw<{ bootId: string; counts: Count[] }>("/usage");
  const prev = await kvGet<{ bootId: string; counts: Record<string, number> }>(KV_SEEN);
  const { add, seen } = deltas(prev ?? null, u.bootId, u.counts);
  for (const c of add) {
    await query(`INSERT INTO apsomh_threed_usage (day, source, locale, kind, n) VALUES ($1,$2,$3,$4,$5)
                 ON CONFLICT (day, source, locale, kind) DO UPDATE SET n = apsomh_threed_usage.n + EXCLUDED.n`,
      [c.day, c.source, c.locale ?? "", c.kind, c.n]);
  }
  await kvSet(KV_SEEN, { bootId: u.bootId, counts: seen, at: new Date().toISOString() });
  const [callers, status] = await Promise.all([
    gw<{ callers: Caller[] }>("/callers").catch(() => null),
    gw<GatewayStatus>("/status").catch(() => null),
  ]);
  if (callers) await kvSet(KV_CALLERS, { at: new Date().toISOString(), callers: callers.callers });
  if (status) await kvSet(KV_STATUS, { at: new Date().toISOString(), status });
  return add.length;
}

let lastRun = 0;
/** A collection under the lock (one copy of the hub at a time); skipped if one ran in the last two minutes. */
export async function collectNow(): Promise<void> {
  if (!adminKeySet() || Date.now() - lastRun < 2 * 60_000) return;
  lastRun = Date.now();
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return;
    try {
      const n = await collect();
      if (n) console.log(`[3d] gateway counts: ${n} rows grew`);
    } catch (e) {
      console.warn(`[3d] gateway counts not read: ${(e as Error).message}`);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

let started = false;
export function startThreeDCollector() {
  if (started || !adminKeySet() || String(process.env.THREED_COLLECT ?? "").toLowerCase() === "off") return;
  started = true;
  const timer = setInterval(() => void collectNow().catch(() => {}), TICK_MS);
  timer.unref?.();
  setTimeout(() => void collectNow().catch(() => {}), 60_000).unref?.();
}

export type CallsReport = {
  from: string; to: string;
  rows: { source: string; locale: string; kind: string; n: number }[];
  daily: { day: string; aplink: number; requests: number }[];
  callers: Caller[]; callersAt: string | null;
  status: GatewayStatus | null; statusAt: string | null;
  collectedAt: string | null;
};

/** The counts between two days (inclusive), with the last callers and status the hub collected. */
export async function readCalls(from: string, to: string): Promise<CallsReport> {
  await ensureTable();
  const rows = (await query<{ source: string; locale: string; kind: string; n: string }>(
    `SELECT source, locale, kind, SUM(n)::text AS n FROM apsomh_threed_usage WHERE day BETWEEN $1 AND $2 GROUP BY 1,2,3`, [from, to])).rows;
  const daily = (await query<{ day: string; aplink: string; requests: string }>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, SUM(CASE WHEN kind = 'aplink' THEN n ELSE 0 END)::text AS aplink,
            SUM(CASE WHEN kind <> 'aplink' THEN n ELSE 0 END)::text AS requests
       FROM apsomh_threed_usage WHERE day BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1`, [from, to])).rows;
  const callers = await kvGet<{ at: string; callers: Caller[] }>(KV_CALLERS);
  const status = await kvGet<{ at: string; status: GatewayStatus }>(KV_STATUS);
  const seen = await kvGet<{ at?: string }>(KV_SEEN);
  return {
    from, to,
    rows: rows.map((r) => ({ ...r, n: Number(r.n) })),
    daily: daily.map((d) => ({ day: d.day, aplink: Number(d.aplink), requests: Number(d.requests) })),
    callers: callers?.callers ?? [], callersAt: callers?.at ?? null,
    status: status?.status ?? null, statusAt: status?.at ?? null,
    collectedAt: seen?.at ?? null,
  };
}
