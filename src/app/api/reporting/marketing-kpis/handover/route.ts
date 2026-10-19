// Hand-over to ESO/TSA: how the teams handle the incoming leads (src/lib/marketingKpis/handover.ts).
// Advanced reporting's grant to read.
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { handoverData } from "@/lib/marketingKpis/handover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, handover: await handoverData() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
