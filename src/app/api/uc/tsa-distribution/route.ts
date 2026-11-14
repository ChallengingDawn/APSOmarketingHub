// TSA DISTRIBUTION (src/lib/tsaDistribution) - SARCLA 13-14.11.2026. Reads only for now.
// GET (UC): the funnel of the last 90 days and the routing side by side (last 7 days), as the engine last read them.
// POST (admins) {action: "run"}: read again now (started, not waited for).

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { pageState, runOnce } from "@/lib/tsaDistribution/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const s = await pageState();
    return NextResponse.json({ configured: true, ok: true, data: { state: s, admin: access.role === "admin" } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  if (b.action !== "run") return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  void runOnce().catch((e) => console.warn(`[tsa-distribution] ${(e as Error).message}`));
  return NextResponse.json({ ok: true, data: { started: true } });
}
