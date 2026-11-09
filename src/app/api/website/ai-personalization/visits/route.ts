// APSOconvert > Journeys > Visits: the customers seen on the shop in the period, the latest first, with how far they got
// and the pages where most stopped (src/lib/convert/visits.ts), and the kept AI reading of the period. GET ?from&to.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { listVisitors } from "@/lib/convert/visits";
import { getPeriodReading } from "@/lib/convert/visitsAi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const VISITS_PAGE = "/website/ai-personalization/journeys/visits";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (!ISO.test(from) || !ISO.test(to) || from > to) {
    return NextResponse.json({ configured: true, ok: false, error: "from and to must be YYYY-MM-DD, from first." }, { status: 400 });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const [list, reading] = await Promise.all([
      listVisitors(from, to, controller.signal),
      getPeriodReading(from, to).catch(() => null),
    ]);
    return NextResponse.json({
      configured: true, ok: true,
      data: { ...list, reading, canAsk: access.levelAt(VISITS_PAGE) === "write", ai: Boolean(process.env.ANTHROPIC_API_KEY) },
    });
  } catch (e) {
    return NextResponse.json({ configured: true, ok: false, error: String((e as Error)?.message ?? e) });
  } finally {
    clearTimeout(timer);
  }
}
