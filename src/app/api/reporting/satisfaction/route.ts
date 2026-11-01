// SATISFACTION KPIs (Reporting > Satisfaction Reports): every HubSpot survey answer of this year and the two before from
// the hub's copy (src/lib/satisfaction), one small row each - the page picks the period, the filters and the companies
// itself (SARCLA 01.11.2026: "rebuild like Visits").
//   GET ?tp=order,chat  (optional: only those touchpoints)
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
  const tp = (req.nextUrl.searchParams.get("tp") || "").split(",").filter((x): x is Touchpoint => x in TOUCHPOINT_LABEL);
  try {
    return NextResponse.json({ ok: true, data: await satisfactionData(null, tp.length ? tp : null) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
