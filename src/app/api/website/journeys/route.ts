// Website > Journeys > Main journeys: how visitors move through the shop for the reporting window, by kind of page -
// the flow chained from Google Analytics' page-to-page steps, the main journeys, the ways in, the top pages of each kind
// (src/lib/journeys/read.ts). A store view is cut from the period's read; the read is kept ten minutes.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { integrationStatus } from "@/lib/integrations/status";
import { buildJourneys } from "@/lib/journeys/read";
import { isStoreView } from "@/lib/journeys/model";

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
  if (!ISO.test(from) || !ISO.test(to) || from > to) {
    return NextResponse.json({ configured: true, ok: false, error: "from and to must be YYYY-MM-DD, from first.", status: 400 });
  }
  const rawStore = sp.get("store");
  const store = isStoreView(rawStore) ? rawStore : null;
  try {
    return NextResponse.json({ configured: true, ok: true, data: await buildJourneys(from, to, store) });
  } catch (e) {
    return NextResponse.json({ configured: true, ok: false, error: String((e as Error)?.message ?? e) });
  }
}
