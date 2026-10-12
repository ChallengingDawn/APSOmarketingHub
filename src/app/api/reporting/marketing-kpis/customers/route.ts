// Who are our customers: the cube of every company (src/lib/marketingKpis/customers.ts).
// Advanced reporting's grant to read, as the rest of the Marketing KPIs.
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { customersCube } from "@/lib/marketingKpis/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, cube: await customersCube() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
