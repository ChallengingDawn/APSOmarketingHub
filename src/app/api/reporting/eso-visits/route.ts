// The ESO Visits page's read (src/lib/reporting/visitsReport.ts): started by the first request, answered from the
// finished read after that. Advanced reporting's own grant, like the page.
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { esoVisits } from "@/lib/reporting/visitsReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, state: await esoVisits() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
