// The hub's own chain status - the twin of the Compass connector's progress.delta_run.
// Kept apart (kv only, no step imports) so erosion, articles and segmentation can ask
// "is tonight's data loaded?" without pulling the whole connector port into their bundle.

import { kvGet, kvSet } from "@/lib/db/init";

export const KV_HUB_CHAIN = "connectors:hub:chain";
const KV_LIVE = "connectors:hub:live";

/** The chain steps (steps/registry.ts, cadence "chain") - listed here so this file stays light; a test holds the two together. */
export const CHAIN_KEYS = [
  "magento_stamp", "articles", "directup_names", "stock_load", "stages", "revenue", "customer_agents", "revenue_kpi", "erp_revenue", "revenue_history",
  "article_ids", "orders_daily", "article_repair", "stages_new_orders", "order_sync", "company_stats", "contact_shipment",
];

/** Does the hub run any chain step live? */
export async function hubRunsChainSteps(): Promise<boolean> {
  const m = (await kvGet<Record<string, boolean>>(KV_LIVE)) ?? {};
  return CHAIN_KEYS.some((k) => m[k]);
}

export type HubChainStep = { step: string; ok: boolean; error?: string };
export type HubChain = {
  status: "running" | "done" | "failed";
  /** The step running now, or what failed. */
  step?: string;
  /** Epoch seconds of the last change. */
  ts: number;
  /** UTC day of the last run that had files. */
  day: string;
  pulled: number;
  /** Epoch seconds the newest delivery's pull began - the shop sync creates transferred orders placed after it. */
  pulledAt?: number;
  /** The delivery this run processed: the files and how long they took to come down. */
  files?: { name: string; mb: number }[];
  pullSeconds?: number;
  steps: HubChainStep[];
  error?: string;
};

export async function hubChain(): Promise<HubChain | null> {
  return (await kvGet<HubChain>(KV_HUB_CHAIN)) ?? null;
}

export async function setHubChain(c: HubChain): Promise<void> {
  await kvSet(KV_HUB_CHAIN, c);
}

/* ── the run history, for the overview's charts ─────────────────────────── */

const KV_HISTORY = "connectors:hub:chain-history";
const KEEP = 120;

/** One ERP delivery the hub ran: what came in, and how many records each step wrote. */
export type ChainDay = { day: string; ts: number; files: number; mb: number; seconds?: number; failed: number; written: Record<string, number> };

export async function chainHistory(): Promise<ChainDay[]> {
  return (await kvGet<ChainDay[]>(KV_HISTORY)) ?? [];
}

export async function addChainDay(d: ChainDay): Promise<void> {
  const h = await chainHistory();
  h.push(d);
  await kvSet(KV_HISTORY, h.slice(-KEEP));
}
