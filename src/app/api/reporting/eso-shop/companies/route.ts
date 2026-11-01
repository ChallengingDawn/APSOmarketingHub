// The companies behind the ESO Shop behaviour page's rows - HubSpot id and name by row - for its Companies lists
// (src/app/reporting/CompanyList.tsx): read once when a list first opens, not with every look at the page. From the last
// join the page was answered with; pending until there is one. Advanced reporting's own grant, like the page.
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { esoShopCompanies } from "@/lib/reporting/shopReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const who = await esoShopCompanies();
  return NextResponse.json(who ? { ok: true, ...who } : { ok: true, pending: true });
}
