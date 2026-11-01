// The Products Reports' shop read - Availability, Price checks, Minimum order (src/lib/productSignals): started by the
// first request, answered from the finished read after that; ?kind= sends one page's part only. Advanced reporting's own
// grant, like the pages.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { productSignals } from "@/lib/productSignals/read";
import { isKind, kindOf } from "@/lib/productSignals/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const kind = req.nextUrl.searchParams.get("kind");
  if (!isKind(kind)) return NextResponse.json({ ok: false, error: "kind must be availability, price or moq." }, { status: 400 });
  try {
    const st = await productSignals();
    return NextResponse.json({ ok: true, state: { ...st, value: st.value ? kindOf(st.value, kind) : undefined } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
