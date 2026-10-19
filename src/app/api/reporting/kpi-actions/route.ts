// The tile toolbar's state for one page in one read: per tile its tasks and tickets counted, every
// tile someone promoted or demoted, the page's saved views and the nutshell panels' order. ?page=<slug>, or "nutshell".
import { NextRequest, NextResponse } from "next/server";
import { orders, pageCounts, placements, viewsOf } from "@/lib/reporting/kpiActions";
import { fail, who } from "./guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const w = await who();
  if (w instanceof NextResponse) return w;
  const page = (req.nextUrl.searchParams.get("page") ?? "").trim();
  if (!page) return fail("page is missing", 400);
  try {
    const [counts, placed, views, order] = await Promise.all([pageCounts(page === "nutshell" ? "*" : page), placements(), viewsOf(page, w.userId), orders()]);
    return NextResponse.json({ ok: true, canWrite: w.canWrite, counts, placements: placed, views, orders: order });
  } catch (e) {
    return fail(e);
  }
}
