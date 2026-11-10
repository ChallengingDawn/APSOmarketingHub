// OTD Reports' figures, kept (rules in ./otdRules.ts). Two sources, each its own kv entry:
// - "erp": the morning workbook's order lines (the same sheet as the Back Office's KPIs), every run of the chain's ERP
//   revenue step - the date at the customer from the shipment and the ERP's transport time;
// - "file": the OTD analysis file's lines (otd_history.csv, made once from its "Data Input" sheet and dropped with the
//   morning files), read again only when the file changes - the months before the morning lines begin, the planned flag,
//   the product groups and the customers' comments.
// Read by /api/reporting/otd as one cube (mergeCubes: the morning lines' months first).

import { promises as fs } from "node:fs";
import path from "node:path";
import { kvGet, kvSet } from "@/lib/db/init";
import { buildOtdCube, fromErpLines, HISTORY_FILE, mergeCubes, otdMainOf, parseHistory, type OtdCube, type OtdMain } from "./otdRules";
import { transitOf, type ErpLine } from "./boErpLines";
import { zurichToday } from "./boDeliveryStore";

export const KV_OTD_ERP = "otd:cube:erp";
export const KV_OTD_FILE = "otd:cube:file";
/** the Back Office's share (otdMainOf), a few KB - kept apart so its page never reads the cubes */
export const KV_OTD_MAIN = "otd:main";
const KV_OTD_FILE_SEEN = "otd:history:seen";

export type OtdErpContext = {
  supplierOf?: (article: string) => string | undefined;
  /** article -> [planned "J"/"N", replenishment days] (the articles sheet's ConsumptionDriven, ReplenishmentDays) */
  planningOf?: (article: string) => [string, number] | undefined;
  /** customer -> its company's name and owner in HubSpot - asked for the customers kept only */
  customerOf?: (customer: string) => { name?: string; owner?: string };
};

/** the morning lines -> the "erp" cube; nothing kept when no line qualifies */
export async function saveOtdFromErp(lines: ErpLine[], ctx: OtdErpContext = {}): Promise<Record<string, unknown>> {
  const { lines: otd, skipped, exactDays } = fromErpLines(lines, transitOf, ctx.supplierOf, ctx.planningOf);
  const k = buildOtdCube(otd, "erp", zurichToday());
  for (const [w, n] of Object.entries(skipped)) k.skipped[w] = (k.skipped[w] ?? 0) + n;
  for (const c of k.customers ?? []) {
    const x = ctx.customerOf?.(c.c);
    if (x?.name) c.name = x.name;
    if (x?.owner) c.owner = x.owner;
  }
  if (k.lines) { await kvSet(KV_OTD_ERP, k); await saveMain(); }
  return { lines: k.lines, first: k.first, last: k.last, skipped: k.skipped, suppliers: k.suppliers.length, kept: k.lines > 0,
    erp_date_at_customer: exactDays, planned_known: otd.filter((l) => l.planned).length, wish_dates: otd.filter((l) => l.wishDay).length,
    customers_kept: k.customers?.length ?? 0, customers_named: (k.customers ?? []).filter((c) => c.name).length };
}

/** otd_history.csv beside the morning workbook -> the "file" cube, once per version of the file (its size and time) */
export async function loadOtdHistory(dir: string): Promise<Record<string, unknown> | string> {
  const p = path.join(dir, HISTORY_FILE);
  const st = await fs.stat(p).catch(() => null);
  if (!st) return "no history file";
  const sig = `${st.size}:${st.mtimeMs}`;
  if ((await kvGet<string>(KV_OTD_FILE_SEEN).catch(() => null)) === sig) return "history already read";
  const k = buildOtdCube(parseHistory(await fs.readFile(p, "utf8")), "file", zurichToday());
  if (!k.lines) return "history file without a line";
  await kvSet(KV_OTD_FILE, k);
  await kvSet(KV_OTD_FILE_SEEN, sig);
  await saveMain();
  return { lines: k.lines, first: k.first, last: k.last, skipped: k.skipped, kept: true };
}

async function saveMain() {
  const main = otdMainOf(await otdNow());
  if (main) await kvSet(KV_OTD_MAIN, main);
}
export const otdMainNow = () => kvGet<OtdMain>(KV_OTD_MAIN).catch(() => null);

/** the two as one, for the pages */
export async function otdNow(): Promise<OtdCube | null> {
  const [erp, file] = await Promise.all([kvGet<OtdCube>(KV_OTD_ERP).catch(() => null), kvGet<OtdCube>(KV_OTD_FILE).catch(() => null)]);
  return mergeCubes(erp ?? null, file ?? null);
}
