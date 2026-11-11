// UC12's Revenue drop: who today's run tickets and the calendar per person (src/lib/lifecycle/revenueDropRead.ts).
// The first request starts a read and is told it is running; the page asks again until it is done. UC & HubSpot
// Apps' own grant, like the pages.

import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { hubspotToken } from "@/lib/integrations/status";
import { revenueDropState } from "@/lib/lifecycle/revenueDropRead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!hubspotToken()) return NextResponse.json({ ok: false, configured: false, missing: ["HUBSPOT_TOKEN"] });
  try {
    const s = await revenueDropState();
    return NextResponse.json({
      ok: true, configured: true, data: s.value ?? null,
      state: { computing: s.computing, progress: s.progress ?? null, computedAt: s.computedAt ?? null, error: s.error ?? null },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, configured: true, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
