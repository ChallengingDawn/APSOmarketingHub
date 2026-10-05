// Articles CY/LY: the build's status, the headline figures and the movers.
// The full article list is paged by ./rows; the files come from ./export.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { buildStatus, loadReport } from "@/lib/integrations/articleReport";
import { filterRows, kpis, movers } from "@/lib/articles/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [status, report] = await Promise.all([buildStatus(), loadReport()]);
  if (!report) return NextResponse.json({ configured: true, ok: true, data: { status, report: null } });
  const sp = req.nextUrl.searchParams;
  const rows = filterRows(report.rows, { pc: sp.get("pc"), q: sp.get("q") });
  const { rows: _all, ...meta } = report;
  void _all;
  return NextResponse.json({
    configured: true, ok: true,
    data: {
      status,
      report: { ...meta, filtered: sp.get("pc") || sp.get("q") ? kpis(rows) : null, movers: movers(rows) },
    },
  });
}
