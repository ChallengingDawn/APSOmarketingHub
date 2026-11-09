// APSOconvert > Journeys > Visits > ONE CUSTOMER: their visits step by step (src/lib/convert/visits.ts), where they
// stopped, and the kept AI reading. GET ?id=<HubSpot company id>&from&to - an id only, never a name in an address.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { customerVisits } from "@/lib/convert/visits";
import { getCustomerReading } from "@/lib/convert/visitsAi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PAGE = "/website/ai-personalization/journeys/visits";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const id = sp.get("id") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (!/^\d{1,20}$/.test(id)) return NextResponse.json({ configured: true, ok: false, error: "id must be a HubSpot company id." }, { status: 400 });
  if (!ISO.test(from) || !ISO.test(to) || from > to) {
    return NextResponse.json({ configured: true, ok: false, error: "from and to must be YYYY-MM-DD, from first." }, { status: 400 });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const [visits, reading] = await Promise.all([
      customerVisits(id, from, to, controller.signal),
      getCustomerReading(id, from, to).catch(() => null),
    ]);
    return NextResponse.json({
      configured: true, ok: true,
      data: { ...visits, reading, canAsk: access.levelAt(PAGE) === "write", ai: Boolean(process.env.ANTHROPIC_API_KEY) },
    });
  } catch (e) {
    return NextResponse.json({ configured: true, ok: false, error: String((e as Error)?.message ?? e) });
  } finally {
    clearTimeout(timer);
  }
}
