// The Back Office's KPIs from the ERP's order lines, kept for the Back-Office Reports (rules in ./boErpLines.ts). Written
// by the chain's ERP revenue step when the morning workbook carries the "KPI LINES" sheet; read by
// /api/reporting/back-office. A workbook without the sheet keeps the last summary.

import { kvGet, kvSet } from "@/lib/db/init";
import { KV_ERP_LINES, summarizeErpLines, type ErpLine, type ErpLinesKept } from "./boErpLines";
import { zurichToday } from "./boDeliveryStore";

export async function saveErpLines(lines: ErpLine[]): Promise<{ lines: number; from: string; to: string; skipped: Record<string, number> }> {
  const k = summarizeErpLines(lines, zurichToday());
  if (k.lines) await kvSet(KV_ERP_LINES, k);
  return { lines: k.lines, from: k.from, to: k.to, skipped: k.skipped };
}

export const erpLinesNow = () => kvGet<ErpLinesKept>(KV_ERP_LINES).catch(() => null);
