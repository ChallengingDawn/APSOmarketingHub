// SEARCH BAR - the hub's page on the shop's search bar (SARCLA, 16.10.2026: the search bar's dashboard
// moves from the APSOAssistant dashboard on Railway to the hub, under Website, "follow the pattern already
// on the HUB by tabs"; read-only first, the on/off switches at the end).
//
// The search bar itself stays on Railway: every customer's browser on apsoparts.com calls it, so it needs a
// public address, and the hub has none (its load balancer only lets the A+P network in). The hub READS the
// gateway's admin API, server to server - outgoing from AWS, so no entry point is needed. Key:
// SMART_BAR_ADMIN_TOKEN (the gateway's own, sent as X-Admin-Token; it never reaches the browser). The address
// is one setting in the hub's database, like DirectUP's; until somebody sets it, it is the Railway address.

import { kvGet, kvSet } from "@/lib/db/init";
import { adminToken, callGateway } from "./call";

export const DEFAULT_GATEWAY = "https://smart-search-production-15d5.up.railway.app";
const KV = "searchbar:gateway";

export type GatewaySetting = { url: string; by: string | null; at: string | null; fromDefault: boolean };

export async function gatewaySetting(): Promise<GatewaySetting> {
  const s = await kvGet<{ url: string; by: string; at: string }>(KV).catch(() => null);
  return s?.url ? { url: s.url, by: s.by, at: s.at, fromDefault: false } : { url: DEFAULT_GATEWAY, by: null, at: null, fromDefault: true };
}

/** https only, no path. */
export async function setGateway(raw: string, by: string): Promise<GatewaySetting> {
  let origin = "";
  try { origin = new URL(raw.trim()).origin; } catch { /* below */ }
  if (!origin.startsWith("https://")) throw new Error("Give the gateway's https address, e.g. https://smart-search-production-15d5.up.railway.app");
  const s = { url: origin, by, at: new Date().toISOString() };
  await kvSet(KV, s);
  return { ...s, fromDefault: false };
}

export { adminToken };

/** One call to the gateway (path from its root, e.g. "/api/smart-bar/report?days=30"). Throws with the gateway's own sentence. */
export async function gateway<T>(path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const key = adminToken();
  if (!key) throw new Error("SMART_BAR_ADMIN_TOKEN is not set on the hub");
  return callGateway<T>((await gatewaySetting()).url, key, path, init);
}

/* ── what the gateway answers (APSOAssistant smart-bar/gateway) ─────────────────────────────────────── */

export type Metrics = {
  window: string; total: number; direct_count: number; assistant_count: number; gap_count: number;
  by_tier: Record<string, number>; by_locale: Record<string, number>; ts: string;
};
export type ReportRow = { query: string; searches: number; success_pct: number; ai_fallbacks: number; avg_results: number; locales: string };
export type Report = {
  days: number; generated_at: string; logged_events: number; settled_searches: number; success_pct: number;
  zero_result_searches: number; ai_turns: number; ai_conversations: number; ai_fallback_searches: number;
  by_day: { day: string; searches: number; ok: number }[];
  by_locale: { locale: string; searches: number; ok: number; success_pct: number }[];
  keywords_top: ReportRow[]; keywords_ai: ReportRow[]; keywords_all_count: number;
};
export type LogRow = {
  query_id: string; query_raw: string; query_norm: string; locale: string; tier: string; degraded: boolean;
  hit_count: number; top_score: number | null; score_margin: number | null; latency_ms: number;
  fallback_reason: string | null; created_at: string;
};
export type Gaps = { window: string; total: number; gaps: { query_norm: string; count: number; last_seen: string; reason?: string; locale?: string }[] };
export type AiTurn = { role: "user" | "assistant" | string; text: string; ts: string };
export type AiConversation = { query_id: string; ts: string; locale: string; turns: AiTurn[] };
export type AiConversations = { total: number; conversations: AiConversation[] };
export type Brand = { brand: string; material: string; vendor: string; notes: string; added?: boolean; added_by?: string | null; added_at?: string | null };
/** The materials a brand can stand for (the bar's material keys). */
export type BrandMaterial = { key: string; label: string };
export type Brands = { total: number; brands: Brand[]; materials?: BrandMaterial[] };
/** The shop-side switches: the maintenance switch, same-tab links, the bar's two buttons. */
export type Switches = {
  killSwitch: boolean; killSwitchAt: string | null; sameTab: boolean;
  buttons: { ai: boolean; feedback: boolean };
};
export type FeatureText = { tag: string; material: string; temp: string; use: string };
export type Feature = {
  id: string; sku: string; title: string; code: string; hf: string; tag: string; spec: string; photo_url: string;
  link_url: string; copy: string; i18n?: Record<string, FeatureText>; active?: boolean; sort_order?: number; alternates?: string[];
};
export type StockSummary = { total: number; with_stock: number; in_stock: number; no_stock: number; no_data: number; external: number };
export type StockRow = {
  sku: string; product_number: string; description: string; material: string | null; stock_qty: number | null;
  stock_unit: string | null; sales_unit: string | null; stock_sales: number | null; stock_synced_at: string | null;
  moq: number | null; published: boolean; article_type: string | null; stock_anyseals: number | null; state: string;
};
export type Stock = { summary: StockSummary; filtered_total: number; rows: StockRow[]; limit: number; offset: number; q: string };
export type SweepStatus = {
  running: boolean; elapsedSec: number; rate_skus_per_sec: number; avg_request_ms: number; remaining: number | null; eta_min: number | null;
  nightly: { on: boolean; window: string; scope: string; concurrent: number; hubspot: boolean; local_hour: number; ran_today: boolean };
};
export type SweepRun = {
  id: number; started_at: string; finished_at: string | null; scope: string; hubspot: boolean; trigger: string;
  target: number; processed: number; applied_rows: number; with_qty: number; errors: number; elapsed_sec: number; status: string; hs_pushed: number;
};
export type OrderWatch = { on: boolean; stock_enabled: boolean; source: string; cursor: string; last: { at: string; orders: number; skus: number; refreshed: number; hs: number } | null };
export type StockCalls = { calls: { id: string; called_at: string; skus: string[]; n: number; locale: string }[]; total: number };
export type Health = {
  status: string; db: boolean;
  published?: {
    count: number; synced_at: string; age_hours: number; stale: boolean; names: boolean;
    page_moves?: { articles_listed: number; merged_pages: number; window: string; in_window: boolean; running: boolean; last_round: Record<string, unknown> | null };
    last_sync_error: string | null;
  };
};
export type Migration = { num: string; name: string; description: string; applied?: boolean; applied_at?: string | null };

/** The search bar's HubSpot jobs (gateway hubspot-jobs.js): their switches and what each last did. */
export type HubspotJobName = "live_on_shop" | "stock_copy";   // (ads_buckets, shop_activity: the Ads Gateway since 17.10.2026)
export type JobSwitch = { label: string; on: boolean; set: boolean; set_at: string | null; default: boolean };
export type HubspotJobs = {
  switches: Record<HubspotJobName, JobSwitch>;
  live_on_shop: { pending: number | null; live: number | null; sync: { running: boolean; since: string | null; last: { at: string; done?: number; wrote?: number; batches?: number; error?: string; skipped?: string } | null } };
  stock_copy: { running: boolean; every_min: number; watermark: string | null; last: { at: string; pages?: number; seen?: number; updated?: number; watermark?: string; error?: string } | null };
};
