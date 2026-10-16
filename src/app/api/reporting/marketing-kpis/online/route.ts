// Online share of orders (KPI C06): web and all orders' value by the customers cube's
// dimensions (src/lib/marketingKpis/online.ts). Advanced reporting's grant to read.
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { onlineCube } from "@/lib/marketingKpis/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, online: await onlineCube() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
