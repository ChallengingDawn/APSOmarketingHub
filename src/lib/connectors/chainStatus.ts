// The hub's own chain status - the twin of the Compass connector's progress.delta_run.
// Kept apart (kv only, no step imports) so erosion, articles and segmentation can ask
// "is tonight's data loaded?" without pulling the whole connector port into their bundle.

import { kvGet, kvSet } from "@/lib/db/init";

export const KV_HUB_CHAIN = "connectors:hub:chain";
const KV_LIVE = "connectors:hub:live";

/** The chain steps (steps/registry.ts, cadence "chain") - listed here so this file stays light; a test holds the two together. */
export const CHAIN_KEYS = [
  "magento_stamp", "articles", "stock_load", "stages", "revenue", "customer_agents", "revenue_kpi", "erp_revenue", "revenue_history",
  "orders_daily", "stages_new_orders", "order_sync", "company_stats", "contact_shipment",
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
  steps: HubChainStep[];
  error?: string;
};

export async function hubChain(): Promise<HubChain | null> {
  return (await kvGet<HubChain>(KV_HUB_CHAIN)) ?? null;
}

export async function setHubChain(c: HubChain): Promise<void> {
  await kvSet(KV_HUB_CHAIN, c);
}
