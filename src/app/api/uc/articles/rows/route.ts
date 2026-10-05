// Every article, a page at a time - sorted, filtered by profit centre and searched on the server.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { loadReport } from "@/lib/integrations/articleReport";
import { filterRows, sortRows, type SortKey } from "@/lib/articles/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const report = await loadReport();
  if (!report) return NextResponse.json({ configured: true, ok: true, data: { total: 0, offset: 0, rows: [] } });
  const sp = req.nextUrl.searchParams;
  const limit = Math.max(1, Math.min(200, Number(sp.get("limit")) || 50));
  const offset = Math.max(0, Number(sp.get("offset")) || 0);
  const rows = sortRows(filterRows(report.rows, { pc: sp.get("pc"), q: sp.get("q") }), (sp.get("order") as SortKey) || "revenueCy");
  return NextResponse.json({ configured: true, ok: true, data: { total: rows.length, offset, rows: rows.slice(offset, offset + limit) } });
}
