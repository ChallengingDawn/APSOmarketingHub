// Website > Journeys > Funnel: the visits through the steps asked (?step=in&step=category.search&step=product... - the
// shop's path when none; src/lib/journeys/model.ts parseSteps): Google Analytics' own funnel report where it answers, the
// funnel chained from its page-to-page steps always, with the pages that lose the most at each step, both compared with
// the period before; and the signed-in customers' own steps from the shop's record (src/lib/journeys/read.ts). Without
// Google Analytics the shop's half still answers - the page says which is missing.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { buildFunnel } from "@/lib/journeys/read";
import { isDevice, isStoreView, parseSteps } from "@/lib/journeys/model";

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
  const rawDevice = sp.get("device");
  const device = isDevice(rawDevice) ? rawDevice : null;
  const steps = parseSteps(sp.getAll("step"));
  try {
    return NextResponse.json({ configured: true, ok: true, data: await buildFunnel(from, to, store, device, steps) });
  } catch (e) {
    return NextResponse.json({ configured: true, ok: false, error: String((e as Error)?.message ?? e) });
  }
}
