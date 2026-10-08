// THE HUB'S CHAIN - the Compass connector's sftp_pull._pull_and_process_inner, for
// the steps that run in the hub. Pull what is new on the ERP's SFTP folder (the hub
// keeps its own download record, so the connector's pull is not disturbed), then
// run the hub's live chain steps in the connector's order:
//   a file step        when its file arrived
//   revenue_kpi,       when any of the step files arrived (the connector's "touched")
//   revenue_history
//   erp_revenue        when the workbook arrived, or the step files did and it is on disk
//   orders_daily       when the order fact arrived
//   stages_new_orders  after it, when dim_order is on disk
//   order_sync         when dim_order or the fact arrived and dim_order is on disk
//   company_stats,     after order_sync - here only when order_sync runs in the hub too;
//   contact_shipment   otherwise the scheduler runs them after the connector's chain
// One run at a time across both copies of the hub (the step lock); pull and process
// in the same run, since the files sit on this copy's disk.

import { stat } from "node:fs/promises";
import path from "node:path";
import { pullDelta } from "./sftp";
import { setHubChain, type HubChain } from "./chainStatus";
import { STEP_FILES, REGISTRY } from "./steps/registry";
import { INCOMING, liveSteps, runStepInside, sftpConfigured, withLock } from "./steps/run";

const utcToday = () => new Date().toISOString().slice(0, 10);
const onDisk = (f: string) => stat(path.join(INCOMING, f)).then(() => true, () => false);

/** The chain steps that are live in the hub. */
export async function liveChainSteps(): Promise<string[]> {
  const live = await liveSteps();
  return REGISTRY.filter((s) => s.cadence === "chain" && live.has(s.key)).map((s) => s.key);
}

/** One pass: pull, then the live steps whose inputs arrived. Null when nothing is live or the lock is held. */
export async function runHubChain(by: string): Promise<HubChain | null> {
  const keys = await liveChainSteps();
  if (!keys.length) return null;
  const live = new Set(keys);
  const now = () => Math.floor(Date.now() / 1000);
  if (!sftpConfigured()) {
    const c: HubChain = { status: "failed", step: "pull", ts: now(), day: utcToday(), pulled: 0, steps: [], error: "no SFTP key in the hub" };
    await setHubChain(c);
    return c;
  }
  return withLock("chain", "live", async (beat) => {
    const chain: HubChain = { status: "running", step: "pull", ts: now(), day: utcToday(), pulled: 0, steps: [] };
    const rep = await pullDelta({ dest: INCOMING });
    if (rep.error) {
      Object.assign(chain, { status: "failed", error: `pull: ${rep.error}`, ts: now() });
      await setHubChain(chain);
      return chain;
    }
    const got = new Set(rep.pulled.map((p) => p.as));
    chain.pulled = got.size;
    if (!got.size) return chain; // nothing new: the last run's status stands
    await setHubChain(chain);
    const touched = STEP_FILES.some((f) => got.has(f));
    const dimOrder = await onDisk("dim_order.csv");
    const erpOnDisk = await onDisk("revenue_profit_center.xlsx");
    const orderFiles = (got.has("dim_order.csv") || got.has("fct_orderlinehist.csv")) && dimOrder;
    const due: Record<string, boolean> = {
      magento_stamp: got.has("export.xml"),
      articles: got.has("dim_article.csv"),
      stages: got.has("dim_order.csv"),
      revenue: got.has("revenue_oi_rollup.csv"),
      customer_agents: got.has("dim_customer.csv"),
      revenue_kpi: touched,
      erp_revenue: got.has("revenue_profit_center.xlsx") || (touched && erpOnDisk),
      revenue_history: touched,
      orders_daily: got.has("fct_orderlinehist.csv"),
      stages_new_orders: got.has("fct_orderlinehist.csv") && dimOrder,
      order_sync: orderFiles,
      company_stats: orderFiles && live.has("order_sync"),
      contact_shipment: orderFiles && live.has("order_sync"),
    };
    for (const def of REGISTRY) {
      if (def.cadence !== "chain" || !live.has(def.key) || !due[def.key]) continue;
      chain.step = def.key;
      chain.ts = now();
      await setHubChain(chain);
      const r = await runStepInside(def.key, "live", by, beat, { dir: INCOMING });
      chain.steps.push({ step: def.key, ok: !r.error, ...(r.error ? { error: r.error } : {}) });
    }
    Object.assign(chain, { status: "done", step: undefined, ts: now(), day: utcToday() });
    await setHubChain(chain);
    console.log(`[connectors] chain by ${by}: pulled ${chain.pulled}, ${chain.steps.length} steps, ${chain.steps.filter((s) => !s.ok).length} failed`);
    return chain;
  });
}
