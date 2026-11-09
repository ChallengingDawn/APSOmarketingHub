// Website > Journeys > Page flow: one page of the shop - where its visitors came from and where they went next, from
// Google Analytics' page-to-page steps on that page alone (src/lib/journeys/read.ts), for the reporting window and a
// device (?device=desktop|mobile|tablet, all when none).
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";
import { buildPageFlow } from "@/lib/journeys/read";
import { isDevice } from "@/lib/journeys/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const ga4 = integrationStatus().ga4;
  if (!ga4.configured) return NextResponse.json({ configured: false, missing: ga4.missing, detail: ga4.detail ?? null });
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const path = (sp.get("path") ?? "").trim();
  if (!ISO.test(from) || !ISO.test(to) || from > to) {
    return NextResponse.json({ configured: true, ok: false, error: "from and to must be YYYY-MM-DD, from first.", status: 400 });
  }
  // a path of the shop, no host, no query: "/de-CH/dichtungstechnik.html"
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 300 || /[?#\s]/.test(path)) {
    return NextResponse.json({ configured: true, ok: false, error: "path must be a page of the shop, like /de-CH/dichtungstechnik.html.", status: 400 });
  }
  const rawDevice = sp.get("device");
  const device = isDevice(rawDevice) ? rawDevice : null;
  try {
    return NextResponse.json({ configured: true, ok: true, data: await buildPageFlow(path, from, to, device) });
  } catch (e) {
    const { error, status } = describeIntegrationError(e);
    return NextResponse.json({ configured: true, ok: false, error, status });
  }
}
