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
// in the same run, since the files sit on this copy's disk. The download record is
// saved only when the run is over: a copy that restarts mid-run loses the files with
// its disk, and the next tick fetches and runs the delivery again - twice at most
// (chainTry.ts), then it is given up on, loudly.

import { stat } from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet } from "@/lib/db/init";
import { commitManifest, fetchFiles, forgetManifest, pullDelta } from "./sftp";
import { deliverySig, nextTry, type ChainTry } from "./chainTry";
import { addChainDay, hubChain, setHubChain, type HubChain } from "./chainStatus";
import { writtenCount } from "./summary";
import { STEP_FILES, REGISTRY } from "./steps/registry";
import { INCOMING, connectorSkips, liveSteps, runStepInside, sftpConfigured, withLock } from "./steps/run";

const utcToday = () => new Date().toISOString().slice(0, 10);
const KV_TRY = "connectors:hub:chain-try";
const onDisk = (f: string) => stat(path.join(INCOMING, f)).then(() => true, () => false);

/** The chain steps that are live in the hub. */
export async function liveChainSteps(): Promise<string[]> {
  const live = await liveSteps();
  return REGISTRY.filter((s) => s.cadence === "chain" && live.has(s.key)).map((s) => s.key);
}

/**
 * Run the ERP folder's current delivery again (SARCLA 13.10.2026). When a delivery's run is
 * cut short twice the chain gives up and records its files as processed, so it never comes
 * back by itself (12.10: three deploys in 15 minutes). This forgets that record and the
 * give-up count, then starts the chain at once - it pulls the folder's delivery again and
 * runs the live steps. Refused while a chain run is going.
 */
export async function rerunDelivery(by: string): Promise<{ ok: boolean; note: string }> {
  const c = await hubChain();
  const now = Math.floor(Date.now() / 1000);
  if (c?.status === "running" && now - (c.ts ?? 0) < 3 * 3600) {
    return { ok: false, note: "A chain run is going right now - wait for it to finish." };
  }
  await forgetManifest();
  await kvSet(KV_TRY, null);
  console.log(`[connectors] chain re-run of the ERP folder's delivery, asked by ${by}`);
  void runHubChain(by).catch((e) => console.warn(`[connectors] chain re-run: ${(e as Error).message}`));
  return { ok: true, note: "The ERP folder's delivery runs again now - about 1.5 hours. This page shows each step as it goes. No hub deploy until it says Done." };
}

/** One pass: pull, then the live steps whose inputs arrived. Null when nothing is live or the lock is held. */
export async function runHubChain(by: string): Promise<HubChain | null> {
  const keys = await liveChainSteps();
  if (!keys.length) return null;
  // the hub reads the ERP's files only once the connector has handed the pull over: while it
  // still pulls, it runs the chain itself, and every live step here would be refused anyway
  if (!(await connectorSkips())?.has("sftp_pull")) return null;
  const live = new Set(keys);
  const now = () => Math.floor(Date.now() / 1000);
  if (!sftpConfigured()) {
    const c: HubChain = { status: "failed", step: "pull", ts: now(), day: utcToday(), pulled: 0, steps: [], error: "no SFTP key in the hub" };
    await setHubChain(c);
    return c;
  }
  return withLock("chain", "live", async (beat) => {
    const prevPulledAt = (await hubChain())?.pulledAt;
    const chain: HubChain = { status: "running", step: "pull", ts: now(), day: utcToday(), pulled: 0, steps: [], ...(prevPulledAt ? { pulledAt: prevPulledAt } : {}) };
    const rep = await pullDelta({ dest: INCOMING, defer: true });
    if (rep.error || rep.pulled.length) {
      const mb = rep.pulled.reduce((a, p) => a + p.mb, 0);
      console.log(`[connectors] chain pull: ${rep.pulled.length} files, ${Math.round(mb)} MB in ${rep.seconds ?? "?"} s${rep.incomplete?.length ? `, still being written: ${rep.incomplete.join(", ")}` : ""}${rep.error ? ` - FAILED ${rep.error}` : ""}`);
    }
    if (rep.error) {
      Object.assign(chain, { status: "failed", error: `pull: ${rep.error}`, ts: now() });
      await setHubChain(chain);
      return chain;
    }
    const got = new Set(rep.pulled.map((p) => p.as));
    chain.pulled = got.size;
    // the ERP exported these files before the pull began (chain.ts was set just before it)
    if (got.size) chain.pulledAt = chain.ts;
    chain.files = rep.pulled.map((p) => ({ name: p.as, mb: p.mb }));
    chain.pullSeconds = rep.seconds;
    if (!got.size) {
      if (rep.manifest) await commitManifest(rep.manifest);
      return chain; // nothing new: the last run's status stands
    }
    // a delivery whose run was cut short (the copy restarted) comes back here - twice at most
    const m = rep.manifest ?? {};
    const sig = deliverySig(rep.pulled.map((p) => ({ remote: p.remote, size: m[p.remote]?.[0] ?? 0, mtime: m[p.remote]?.[1] ?? 0 })));
    const t = nextTry((await kvGet<ChainTry>(KV_TRY)) ?? null, sig, now());
    await kvSet(KV_TRY, t.save);
    if (t.giveUp) {
      if (rep.manifest) await commitManifest(rep.manifest);
      Object.assign(chain, {
        status: "failed", step: "pull", ts: now(),
        error: `gave up on this delivery: its run was cut short ${t.save.n} times - a hub server restarted mid-run (a deploy, or out of memory). An admin can run it again on The chain page ("Run this delivery again") - with no hub deploy for the ~1.5 hours it takes.`,
      });
      await setHubChain(chain);
      console.error(`[connectors] chain GAVE UP on a delivery of ${got.size} files after ${t.save.n} cut-short runs`);
      return chain;
    }
    await setHubChain(chain);
    const written: Record<string, number> = {};
    const touched = STEP_FILES.some((f) => got.has(f));
    const dimOrder = await onDisk("dim_order.csv");
    const erpOnDisk = await onDisk("revenue_profit_center.xlsx");
    const orderFiles = (got.has("dim_order.csv") || got.has("fct_orderlinehist.csv")) && dimOrder;
    const due: Record<string, boolean> = {
      magento_stamp: got.has("export.xml"),
      articles: got.has("dim_article.csv"),
      // the ERP stock fact (hub only); it needs dim_article on this copy's disk for its keys
      stock_load: got.has("fct_article_quantity_and_consumption.csv"),
      stages: got.has("dim_order.csv"),
      revenue: got.has("revenue_oi_rollup.csv"),
      customer_agents: got.has("dim_customer.csv"),
      revenue_kpi: touched,
      erp_revenue: got.has("revenue_profit_center.xlsx") || (touched && erpOnDisk),
      revenue_history: touched,
      // the order lines' internal ids, learnt (with dim_article), then the lines still on one repaired
      article_ids: got.has("fct_orderlinehist.csv"),
      orders_daily: got.has("fct_orderlinehist.csv"),
      article_repair: got.has("fct_orderlinehist.csv") || got.has("dim_article.csv"),
      stages_new_orders: got.has("fct_orderlinehist.csv") && dimOrder,
      order_sync: orderFiles,
      company_stats: orderFiles && live.has("order_sync"),
      contact_shipment: orderFiles && live.has("order_sync"),
    };
    // the steps that read the articles need dim_article on THIS copy's disk: a delivery without a new
    // one, after a restart, left none - and every line fell back to the ERP's internal id (17.10.2026)
    if (["article_ids", "orders_daily", "stock_load"].some((k) => live.has(k) && due[k]) && !(await onDisk("dim_article.csv"))) {
      const f = await fetchFiles(INCOMING, ["dim_article.csv"]);
      console.log(`[connectors] chain: dim_article.csv was not on this copy's disk - fetched again: ${f.pulled.length ? `${f.pulled[0].mb} MB` : `nothing${f.error ? ` (${f.error})` : ""}`}`);
    }
    for (const def of REGISTRY) {
      if (def.cadence !== "chain" || !live.has(def.key) || !due[def.key]) continue;
      chain.step = def.key;
      chain.ts = now();
      await setHubChain(chain);
      const r = await runStepInside(def.key, "live", by, beat, { dir: INCOMING });
      chain.steps.push({ step: def.key, ok: !r.error, ...(r.error ? { error: r.error } : {}) });
      if (!r.error) written[def.key] = writtenCount(r.result);
    }
    Object.assign(chain, { status: "done", step: undefined, ts: now(), day: utcToday() });
    await setHubChain(chain);
    await addChainDay({
      day: chain.day, ts: chain.ts, files: chain.pulled, mb: Math.round(rep.pulled.reduce((a, p) => a + p.mb, 0)),
      seconds: rep.seconds, failed: chain.steps.filter((x) => !x.ok).length, written,
    }).catch((e) => console.warn(`[connectors] chain history: ${(e as Error).message}`));
    if (rep.manifest) await commitManifest(rep.manifest);
    console.log(`[connectors] chain by ${by}: pulled ${chain.pulled}, ${chain.steps.length} steps, ${chain.steps.filter((s) => !s.ok).length} failed`);
    return chain;
  });
}
