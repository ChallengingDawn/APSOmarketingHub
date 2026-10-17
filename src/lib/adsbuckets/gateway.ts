// GOOGLE ADS BUCKETS - the hub's page on the Ads Gateway (Railway, project APSOAssistant), the service that holds
// the Google Ads buyer buckets and live shop activity since 17.10.2026 (SARCLA: "Google Ads buckets should be a
// separate microservice"; they ran inside the search bar's gateway before). The hub reads its admin API server to
// server - outgoing from AWS, no entry point needed. Key: the same SMART_BAR_ADMIN_TOKEN (the service's ADMIN_TOKEN
// holds the same value), sent as X-Admin-Token, never to the browser. The address is one setting in the hub's
// database; until somebody sets it, it is the Railway address.

import { kvGet, kvSet } from "@/lib/db/init";
import { adminToken, callGateway } from "@/lib/searchbar/call";

export const DEFAULT_ADS_GATEWAY = "https://ads-gateway-production.up.railway.app";
const KV = "adsbuckets:gateway";

export type AdsGatewaySetting = { url: string; by: string | null; at: string | null; fromDefault: boolean };

export async function adsGatewaySetting(): Promise<AdsGatewaySetting> {
  const s = await kvGet<{ url: string; by: string; at: string }>(KV).catch(() => null);
  return s?.url ? { url: s.url, by: s.by, at: s.at, fromDefault: false } : { url: DEFAULT_ADS_GATEWAY, by: null, at: null, fromDefault: true };
}

export async function setAdsGateway(raw: string, by: string): Promise<AdsGatewaySetting> {
  let origin = "";
  try { origin = new URL(raw.trim()).origin; } catch { /* below */ }
  if (!origin.startsWith("https://")) throw new Error("Give the gateway's https address, e.g. https://ads-gateway-production.up.railway.app");
  const s = { url: origin, by, at: new Date().toISOString() };
  await kvSet(KV, s);
  return { ...s, fromDefault: false };
}

export { adminToken };

export async function adsGateway<T>(path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const key = adminToken();
  if (!key) throw new Error("SMART_BAR_ADMIN_TOKEN is not set on the hub");
  return callGateway<T>((await adsGatewaySetting()).url, key, path, init);
}

/* ── what the Ads Gateway answers (APSOAssistant ads-gateway, GET /admin/status) ─────────────────────── */

export type AdsJob = "ads_buckets" | "shop_activity";
export type AdsSwitch = { label: string; on: boolean; set: boolean; set_at: string | null; default: boolean };
export type AdsStatus = {
  switches: Record<AdsJob, AdsSwitch>;
  buckets: {
    building: boolean; keys_in_memory: number; built_at: string | null; age_hours: number | null; stale_hours: number; active_days: number;
    last_build: { started_at: string | null; finished_at: string | null; ok: boolean | null; keys: number | null; companies: number | null;
      buckets: Record<string, number> | null; error: string | null; duration_s: number | null };
    answers: Record<string, number>;
  };
  shop_activity: {
    accepted: number; unknown_buyer: number; bad_body: number; flushes: number; companies_written: number; write_errors: number;
    last_error: string | null; deferred: number; deferred_recovered: number; deferred_expired: number; last_flush_at: string | null;
    pending_companies: number; switched_off?: number; retry_in_s: number; consecutive_failures: number; cached_companies: number; flush_ms: number;
    dropped: Record<string, number>; emitter_pings: number; emitter_pings_signed_in: number; recorder_errors: number;
    last_recorder_error: string | null; rejected_hosts: Record<string, number>;
  };
};
export type AdsHealth = { status: string; list_ready: boolean; built_at: string | null; building: boolean };
