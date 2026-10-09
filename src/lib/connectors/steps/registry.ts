// EVERY COMPASS STEP THE HUB CAN RUN - in the Compass connector's own chain order
// (sftp_pull._pull_and_process_inner), with the file it reads and when it runs.
// The keys are the connector's step names: the same names go in its HUB_STEPS
// setting when a step is handed over, and come back on its /chain/status.
//
//   cadence "chain"  runs in the hub's chain, after the hub has pulled the ERP files
//                    (a file step only when its file arrived; the others when any of
//                    the step files arrived - the connector's own "touched" rule)
//   cadence "30min" / "15min"   every 30 / 15 minutes, files or not
//   cadence "manual" only from the page

import path from "node:path";
import { companyStats, contactShipment, mandantSweep, type StepResult } from "./companyFacts";
import { articleCreateMissing, articleLoad, customerAgents, magentoStamp } from "./files";
import { revenueHistory, revenueKpi, revenueLoad } from "./revenue";
import { erpRevenue } from "./erpRevenue";
import { orderSync, ordersDaily, stageLoad } from "./orders";
import { deputySweep, ticketAssoc, wrongOwners } from "./tickets";
import { stockLoad } from "./stock";
import { FCT_FILE } from "./stockRules";

export type Beat = () => Promise<void>;
export type StepCtx = { live: boolean; beat: Beat; full?: boolean; dir: string | null };
export type Cadence = "chain" | "30min" | "15min" | "manual";
export type StepDef = {
  key: string;
  cadence: Cadence;
  /** The ERP file it reads (canonical name, as the pull saves it). */
  file?: string;
  run: (c: StepCtx) => Promise<StepResult>;
  /**
   * A step the Compass connector never had - there is nothing to hand over, so the switch
   * does not wait for the connector's HUB_STEPS. "Never both writing" still holds: nothing
   * else writes what it writes.
   */
  hubOnly?: boolean;
};

/** The files whose steps make the downstream steps run (the connector's `touched`). */
export const STEP_FILES = ["export.xml", "dim_article.csv", "dim_order.csv", "revenue_oi_rollup.csv", "dim_customer.csv"] as const;

const at = (c: StepCtx, file: string) => {
  if (!c.dir) throw new Error(`no folder with the ERP files for ${file}`);
  return path.join(c.dir, file);
};

export const REGISTRY: StepDef[] = [
  { key: "magento_stamp", cadence: "chain", file: "export.xml", run: (c) => magentoStamp(c.live, c.beat, { file: at(c, "export.xml") }) },
  // compare: the first live run reads what HubSpot holds and writes only real differences
  { key: "articles", cadence: "chain", file: "dim_article.csv", run: (c) => articleLoad(c.live, c.beat, { file: at(c, "dim_article.csv"), compare: true }) },
  // HUB ONLY: the ERP stock fact, which the connector never loaded on a schedule. Kilograms into
  // stock_quantity for cross-unit articles, the stock values for all - after "articles", so the
  // units it routes on are the ones the article master has just written
  { key: "stock_load", cadence: "chain", file: FCT_FILE, hubOnly: true, run: (c) => stockLoad(c.live, c.beat, { file: at(c, FCT_FILE), articleFile: at(c, "dim_article.csv") }) },
  { key: "stages", cadence: "chain", file: "dim_order.csv", run: (c) => stageLoad(c.live, c.beat, { file: at(c, "dim_order.csv") }) },
  { key: "revenue", cadence: "chain", file: "revenue_oi_rollup.csv", run: (c) => revenueLoad(c.live, c.beat, { file: at(c, "revenue_oi_rollup.csv") }) },
  { key: "customer_agents", cadence: "chain", file: "dim_customer.csv", run: (c) => customerAgents(c.live, c.beat, { file: at(c, "dim_customer.csv") }) },
  // the monthly KPIs BEFORE the workbook (it realigns their rows), the history AFTER it (it reads them)
  { key: "revenue_kpi", cadence: "chain", run: (c) => revenueKpi(c.live, c.beat) },
  { key: "erp_revenue", cadence: "chain", file: "revenue_profit_center.xlsx", run: (c) => erpRevenue(c.live, c.beat, { file: at(c, "revenue_profit_center.xlsx") }) },
  { key: "revenue_history", cadence: "chain", run: (c) => revenueHistory(c.live, c.beat) },
  { key: "mandant_sweep", cadence: "30min", run: (c) => mandantSweep(c.live, c.beat) },
  { key: "wrong_owners", cadence: "30min", run: (c) => wrongOwners(c.live, c.beat) },
  { key: "orders_daily", cadence: "chain", file: "fct_orderlinehist.csv",
    run: (c) => ordersDaily(c.live, c.beat, { file: at(c, "fct_orderlinehist.csv"), articleFile: c.dir ? path.join(c.dir, "dim_article.csv") : undefined }) },
  { key: "stages_new_orders", cadence: "chain", file: "dim_order.csv", run: (c) => stageLoad(c.live, c.beat, { file: at(c, "dim_order.csv"), onlyChanged: true }) },
  { key: "order_sync", cadence: "chain", file: "dim_order.csv", run: (c) => orderSync(c.live, c.beat, { file: at(c, "dim_order.csv") }) },
  { key: "company_stats", cadence: "chain", run: (c) => companyStats(c.live, c.beat, c.full) },
  { key: "contact_shipment", cadence: "chain", run: (c) => contactShipment(c.live, c.beat, c.full) },
  { key: "deputy_sweep", cadence: "15min", run: (c) => deputySweep(c.live, c.beat, { tsaFallback: process.env.DEPUTY_TSA_FALLBACK === "1" }) },
  { key: "ticket_assoc", cadence: "manual", run: (c) => ticketAssoc(c.live, c.beat, {}) },
  { key: "articles_create_missing", cadence: "manual", file: "dim_article.csv", run: (c) => articleCreateMissing(c.live, c.beat, { file: at(c, "dim_article.csv") }) },
];

export const STEP_KEYS = REGISTRY.map((s) => s.key);
export const stepDef = (key: string) => REGISTRY.find((s) => s.key === key);
