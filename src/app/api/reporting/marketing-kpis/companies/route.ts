// The customer filter's companies (SARCLA 26.10.2026: "customer as well"): ?q=text searches by name or ERP customer
// number; ?ids=id,id names the ones an address carries. Advanced reporting's grant, as the cube.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { companyNames, searchCompanies } from "@/lib/marketingKpis/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  try {
    const ids = (sp.get("ids") ?? "").split(",").map((x) => x.trim()).filter((x) => /^\d+$/.test(x));
    if (ids.length) return NextResponse.json({ ok: true, companies: await companyNames(ids) });
    return NextResponse.json({ ok: true, companies: await searchCompanies(String(sp.get("q") ?? "").slice(0, 80)) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
