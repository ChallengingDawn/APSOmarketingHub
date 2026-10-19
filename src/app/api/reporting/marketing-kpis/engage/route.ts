// Engage: GA4's engagement, article views and the tools' and search's events, the search bar's own
// log and the price checks (src/lib/marketingKpis/engage.ts). Advanced reporting's grant to read.
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { engageData } from "@/lib/marketingKpis/engage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, engage: await engageData() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
