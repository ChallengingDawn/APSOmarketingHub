// SATISFACTION KPIs (Reporting > Satisfaction Reports): every HubSpot survey answer of the period from the hub's copy
// (src/lib/satisfaction) - CSAT and NPS, per touchpoint, country, language and locale, the customers' words.
//   GET ?days=365&tp=order,chat  (tp optional: only those touchpoints)
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { satisfactionData } from "@/lib/satisfaction/figures";
import { TOUCHPOINT_LABEL, type Touchpoint } from "@/lib/satisfaction/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const q = req.nextUrl.searchParams;
  const days = Math.min(800, Math.max(1, parseInt(q.get("days") || "365", 10) || 365));
  const tp = (q.get("tp") || "").split(",").filter((x): x is Touchpoint => x in TOUCHPOINT_LABEL);
  try {
    const from = new Date(Date.now() - days * 86_400_000).toISOString();
    return NextResponse.json({ ok: true, data: await satisfactionData(from, tp.length ? tp : null) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
