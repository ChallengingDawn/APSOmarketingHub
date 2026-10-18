// One line of what a KPI shows now - the words a task or a ticket starts from, the same figures
// the card shows (Compare in data.tsx): the year so far, then against target or last year.

import { fmtValue } from "@/lib/marketingKpis/measures";
import type { KpiView } from "../data";

export function kpiSummary(v: KpiView, period: string): string {
  const now = `${fmtValue(v.measure.fmt, v.ytd)} ${period}`.trim();
  if (v.target != null && v.ytd != null && v.target !== 0) return `${now}, ${((v.ytd / v.target) * 100).toFixed(0)}% of target ${fmtValue(v.measure.fmt, v.target)}`;
  if (v.pyYtd != null && v.ytd != null && v.pyYtd !== 0 && !v.pyNote?.includes("whole year")) {
    const same = v.sameYtd != null && v.pyNote?.startsWith("same months");
    const cur = same ? (v.sameYtd as number) : v.ytd;
    const d = ((cur - v.pyYtd) / Math.abs(v.pyYtd)) * 100;
    return `${now}, ${d >= 0 ? "+" : ""}${d.toFixed(0)}% vs ${same ? `last year, ${v.pyNote}` : v.pyNote ?? "last year"}`;
  }
  return now;
}
