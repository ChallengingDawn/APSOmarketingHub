// The Back Office's KPIs from the ERP's order lines, kept for the Back-Office Reports (rules in ./boErpLines.ts). Written
// by the chain's ERP revenue step when the morning workbook carries the "KPI LINES" sheet; read by
// /api/reporting/back-office. A workbook without the sheet keeps the last summary.

import { kvGet, kvSet } from "@/lib/db/init";
import { KV_ERP_LINES, summarizeErpLines, type ErpLine, type ErpLinesContext, type ErpLinesKept } from "./boErpLines";
import { zurichToday } from "./boDeliveryStore";

export async function saveErpLines(lines: ErpLine[], ctx: ErpLinesContext = {},
  describe?: (articles: string[]) => Promise<Map<string, string>>): Promise<Record<string, unknown>> {
  const k = summarizeErpLines(lines, zurichToday(), ctx);
  // the late products' descriptions (HubSpot's article_description) - without them the page shows the numbers only
  if (describe && k.lateProducts?.length) {
    const t = await describe(k.lateProducts.map((p) => p.a)).catch(() => new Map<string, string>());
    for (const p of k.lateProducts) { const x = t.get(p.a); if (x) p.text = x; }
  }
  if (k.lines) await kvSet(KV_ERP_LINES, k);
  const known = Object.values(k.supplier ?? {}).reduce((t, m) => t + Object.entries(m).filter(([s]) => s !== "No supplier known").reduce((x, [, v]) => x + v[0], 0), 0);
  return { lines: k.lines, from: k.from, to: k.to, skipped: k.skipped, open_overdue: k.open?.overdue, open_due: k.open?.due,
    otd_lines_with_a_supplier: known, owners: k.ownerPrice ? Object.keys(Object.assign({}, ...Object.values(k.ownerPrice))).length : 0 };
}

export const erpLinesNow = () => kvGet<ErpLinesKept>(KV_ERP_LINES).catch(() => null);
