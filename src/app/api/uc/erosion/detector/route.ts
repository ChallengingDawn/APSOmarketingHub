// The hub's erosion detector: who owns it, what its last run did, and - for an
// admin - a preview of what it would raise today (read-only, takes a few minutes,
// so it runs in the background and its result appears here when done).

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { kvGet } from "@/lib/db/init";
import { KV, runErosion, utcToday } from "@/lib/erosion/run";
import { erosionLive } from "@/lib/erosion/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let previewRunning = false;

export async function GET() {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [last, preview, imported, tried] = await Promise.all([
    kvGet(KV.last), kvGet(KV.lastPreview), kvGet<{ keys: string[]; at: string }>(KV.imported), kvGet(KV.tried),
  ]);
  return NextResponse.json({
    configured: true, ok: true,
    data: {
      owner: erosionLive() ? "hub" : "connector",
      today: utcToday(),
      lastRun: last ?? null,
      lastTry: tried ?? null,
      lastPreview: preview ?? null,
      previewRunning,
      importedKeys: imported ? { count: imported.keys.length, at: imported.at } : null,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  if (req.nextUrl.searchParams.get("mode") !== "preview") {
    // live runs belong to the scheduler alone: one writer, once a day
    return NextResponse.json({ error: "Only mode=preview can be started by hand." }, { status: 400 });
  }
  if (previewRunning) return NextResponse.json({ configured: true, ok: true, data: { started: false, note: "a preview is already running" } });
  previewRunning = true;
  void runErosion("preview")
    .catch((e) => console.warn(`[erosion] preview failed: ${(e as Error).message}`))
    .finally(() => { previewRunning = false; });
  return NextResponse.json({ configured: true, ok: true, data: { started: true, note: "check GET in a few minutes" } });
}
