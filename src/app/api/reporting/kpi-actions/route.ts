// The tile toolbar's state for one page in one read: per tile its tasks and tickets counted, every
// tile someone promoted or demoted, the page's saved views, the nutshell panels' order and every chart's target.
// ?page=<slug>, or "nutshell".
import { NextRequest, NextResponse } from "next/server";
import { orders, pageCounts, placements, targets, viewsOf } from "@/lib/reporting/kpiActions";
import { reportPathOfPage } from "@/lib/auth/tree";
import { fail, who } from "./guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const page0 = (req.nextUrl.searchParams.get("page") ?? "").trim();
  // whether the toolbar offers its edits: that page's report - for a BUC View ("nutshell"), the one it is drawn on
  // (ESO's and TSA's say so in the address they are read from; a hint for the screen, every write asks again)
  const from = (() => { try { return new URL(req.headers.get("referer") ?? "").pathname; } catch { return ""; } })();
  const w = await who(false, page0 === "nutshell" ? (from.startsWith("/reporting/") ? from : "/reporting/marketing-kpis") : reportPathOfPage(page0));
  if (w instanceof NextResponse) return w;
  const page = (req.nextUrl.searchParams.get("page") ?? "").trim();
  if (!page) return fail("page is missing", 400);
  try {
    const [counts, placed, views, order, target] = await Promise.all([pageCounts(page === "nutshell" ? "*" : page), placements(), viewsOf(page, w.userId), orders(), targets()]);
    return NextResponse.json({ ok: true, canWrite: w.canWrite, counts, placements: placed, views, orders: order, targets: target });
  } catch (e) {
    return fail(e);
  }
}
