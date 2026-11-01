// Articles CY/LY: the build's status, and - for the filters in the address - the page's figures, every breakdown and the
// movers (SARCLA 01.11.2026: "Articles rebuilt like Figures"). The article list is paged by ./rows, the companies behind a
// graph by ./companies; the files come from ./export.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { buildStatus, loadBuyers, loadReport } from "@/lib/integrations/articleReport";
import { exploreOf, filtersOf, type Explore } from "@/lib/articles/explore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The same filters on the same build answer at once - a click back to a view already seen. */
const kept = new Map<string, Explore>();

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [status, report] = await Promise.all([buildStatus(), loadReport()]);
  if (!report) return NextResponse.json({ configured: true, ok: true, data: { status, report: null, explore: null, filters: {} } });
  const sp = req.nextUrl.searchParams;
  const filters = filtersOf((d) => sp.getAll(d));
  const buyers = await loadBuyers(report);
  const key = `${report.generated}|${buyers ? 1 : 0}|${JSON.stringify(filters)}`;
  let explore = kept.get(key);
  if (!explore) {
    explore = exploreOf(report.rows, filters, buyers);
    if (kept.size >= 40) kept.delete(kept.keys().next().value!);
    kept.set(key, explore);
  }
  return NextResponse.json({
    configured: true, ok: true,
    data: {
      status,
      report: {
        generated: report.generated, cy: report.cy, ly: report.ly, today: report.today, ordersRead: report.ordersRead,
        articles: report.rows.length, documentsBasis: report.documentsBasis, catalogueFilled: report.catalogueFilled,
        hierarchy: !!report.hierarchy, buyers: !!buyers,
      },
      explore,
      // the filters these figures are of - the page draws them together, while the next answer comes
      filters,
    },
  });
}
