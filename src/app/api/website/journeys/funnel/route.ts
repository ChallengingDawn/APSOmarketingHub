// Website > Journeys > Funnel: the visits through the shop's steps (Google Analytics: sessions with each event, and its
// own in-order funnel where it answers) beside the signed-in customers' own steps (the shop's record), for the reporting
// window (src/lib/journeys/read.ts). Without Google Analytics the shop's half still answers - the page says which is missing.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { buildFunnel } from "@/lib/journeys/read";
import { isStoreView } from "@/lib/journeys/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (!ISO.test(from) || !ISO.test(to) || from > to) {
    return NextResponse.json({ configured: true, ok: false, error: "from and to must be YYYY-MM-DD, from first.", status: 400 });
  }
  const rawStore = sp.get("store");
  const store = isStoreView(rawStore) ? rawStore : null;
  try {
    return NextResponse.json({ configured: true, ok: true, data: await buildFunnel(from, to, store) });
  } catch (e) {
    return NextResponse.json({ configured: true, ok: false, error: String((e as Error)?.message ?? e) });
  }
}
