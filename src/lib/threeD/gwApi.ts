// The 3D Gateway's admin API (Railway, APSOAssistant project), x-admin-key = THREED_ADMIN_KEY. One
// module for the reads (counts, callers, status) and the one write (the AP-Link switch), so the
// collector and the switch share them without importing each other.

import { isSandbox } from "@/lib/sandbox/mode";
import { doorGet } from "@/lib/sandbox/viewer";
import { kvSet } from "@/lib/db/init";

/** The 3D Gateway's admin API - the new service, whatever address the shop uses meanwhile. */
export const gatewayAdminUrl = () => (process.env.THREED_GATEWAY_URL || "https://3d-gateway-production.up.railway.app").replace(/\/+$/, "");
export const adminKeySet = () => !!((isSandbox() ? process.env.SANDBOX_VIEWER_KEY : process.env.THREED_ADMIN_KEY) || "").trim();

export const KV_STATUS = "threeD:gateway-status";

export type AplinkTarget = "production" | "test";
export const isAplinkTarget = (v: unknown): v is AplinkTarget => v === "production" || v === "test";

/** One AP-Link system as the gateway last asked it (a known article's web-shop STEP). */
export type AplinkProbe = {
  configured: boolean; host: string | null; ok: boolean | null; ms: number | null;
  status: number | null; error: string | null; checkedAt: string | null;
};

export type GatewayStatus = {
  commit: string; bootId: string; bootedAt: string; uptime_s: number;
  // the first five: the system in use. target/targets: since the switch (gateway, 06.11.2026)
  aplink: {
    configured: boolean; reachable: boolean | null; ms: number | null; checkedAt: string | null; error: string | null;
    target?: AplinkTarget; targets?: Record<AplinkTarget, AplinkProbe>;
  };
  catalogue: { articles: number; categories: number };
};

function key(): string {
  const k = (process.env.THREED_ADMIN_KEY || "").trim();
  if (!k) throw new Error("THREED_ADMIN_KEY is not set on the hub");
  return k;
}

async function answer<T>(res: Response): Promise<T> {
  if (res.status === 403) throw new Error("The 3D Gateway refused the hub's key (THREED_ADMIN_KEY differs)");
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(j?.error ? `The 3D Gateway: ${j.error}` : `The 3D Gateway answered ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function gw<T>(path: string): Promise<T> {
  // a sandbox reads through the door and holds no key (src/lib/sandbox/viewer.ts)
  if (isSandbox()) return doorGet<T>("3d", path, { timeoutMs: 60_000 });
  const res = await fetch(`${gatewayAdminUrl()}/api/admin${path}`, { headers: { "x-admin-key": key() }, signal: AbortSignal.timeout(60_000), cache: "no-store" });
  return answer<T>(res);
}

export async function gwPost<T>(path: string, body: unknown): Promise<T> {
  if (isSandbox()) throw new Error("The sandbox only reads the 3D Gateway - switch on the hub itself");
  const res = await fetch(`${gatewayAdminUrl()}/api/admin${path}`, {
    method: "POST", headers: { "x-admin-key": key(), "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(60_000), cache: "no-store",
  });
  return answer<T>(res);
}

export async function saveStatus(status: GatewayStatus): Promise<void> {
  await kvSet(KV_STATUS, { at: new Date().toISOString(), status });
}
