// Who are our customers: the cube of every company (src/lib/marketingKpis/customers.ts) - or, with ?companies=id,id, of
// those companies alone (the customer filter, SARCLA 26.10.2026). Advanced reporting's grant to read, as the rest of the
// Marketing KPIs.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { companiesCube, customersCube } from "@/lib/marketingKpis/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const ids = (req.nextUrl.searchParams.get("companies") ?? "").split(",").map((x) => x.trim()).filter((x) => /^\d+$/.test(x)).slice(0, 50);
    if (ids.length) {
      const value = await companiesCube(ids);
      if (!value) return NextResponse.json({ ok: true, cube: await customersCube() });
      return NextResponse.json({ ok: true, cube: { value, computing: false, computedAt: value.generatedAt } });
    }
    return NextResponse.json({ ok: true, cube: await customersCube() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
