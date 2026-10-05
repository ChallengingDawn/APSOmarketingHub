// The yearly reclassification as an Excel file: what the last preview would change
// (or what the last real run changed - its "before" columns are the backup), every
// company with its rule and reason, so the list can be checked before it is written.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { yearlyPlan } from "@/lib/integrations/segmentation";
import { YEARLY_RULES } from "@/lib/segmentation/yearly";
import { xlsx, type Cell, type Column } from "@/lib/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const which = req.nextUrl.searchParams.get("which") === "applied" ? "applied" : "preview";
  const plan = await yearlyPlan(which);
  if (!plan) return NextResponse.json({ error: which === "applied" ? "The yearly run has not been done yet." : "No preview yet - run one first." }, { status: 404 });

  const stamp = plan.at.slice(0, 10);
  const title = `Yearly reclassification ${plan.year} - ${which === "preview" ? "preview, nothing written" : `run of ${stamp}, ${plan.written} companies written`}`;
  const ruleText = Object.fromEntries(YEARLY_RULES.map((r) => [r.key, r.text]));
  const segments = [...new Set([...Object.keys(plan.before), ...Object.keys(plan.after)])].sort((a, b) => (plan.after[b] ?? 0) - (plan.after[a] ?? 0));

  const changeCols: Column[] = [
    { header: "Company", width: 36 }, { header: "HubSpot id", width: 13 },
    { header: "Segment before", width: 18 }, { header: "Segment after", width: 18 },
    { header: "Priority before", width: 13 }, { header: "Priority after", width: 13 },
    { header: "Rule", width: 14 }, { header: "Why", width: 60 },
    { header: "APIC before", width: 30 }, { header: "APIC after", width: 30 },
    { header: "Industry before", width: 24 }, { header: "Industry after", width: 24 },
  ];
  const changeRows: Cell[][] = plan.rows.map((r) => [
    r.name, r.id, r.segFrom, r.segTo, r.prioFrom, r.prioTo, r.rule, r.reason, r.apicFrom, r.apicTo, r.indFrom, r.indTo,
  ]);

  const file = xlsx([
    {
      name: "Summary", table: false,
      preamble: [title, `${plan.scanned} companies read · ${plan.rows.length} with a new segment, priority, APIC or industry · the potential is never written`],
      columns: [{ header: "", width: 34 }, { header: "Companies", width: 12, format: "int" }, { header: "", width: 14, format: "int" }],
      rows: [
        ["What changes", null, null],
        ...Object.entries(plan.stats).filter(([, v]) => v).map(([k, v]): Cell[] => [k.replace(/_/g, " "), v, null]),
        [null, null, null],
        ["APSO segment", "Before", "After"],
        ...segments.map((s): Cell[] => [s, plan.before[s] ?? 0, plan.after[s] ?? 0]),
        [null, null, null],
        ["Moves", "Companies", null],
        ...Object.entries(plan.transitions).sort((a, b) => b[1] - a[1]).map(([t, n]): Cell[] => [t, n, null]),
      ],
    },
    { name: "Changes", columns: changeCols, rows: changeRows, preamble: [title] },
    {
      name: "Rules", columns: [{ header: "Rule", width: 16 }, { header: "Segment", width: 30 }, { header: "When", width: 90 }, { header: "Companies", width: 12, format: "int" }],
      rows: YEARLY_RULES.map((r): Cell[] => [r.key, r.segment, ruleText[r.key], plan.byRule[r.key] ?? 0]),
      preamble: ["The waterfall: the first rule that fits decides"],
    },
  ]);
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="yearly-reclassification-${plan.year}-${which}-${stamp}.xlsx"`,
    },
  });
}
