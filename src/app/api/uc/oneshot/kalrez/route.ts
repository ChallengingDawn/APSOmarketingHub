// KALREZ 6221/6230 DISCONTINUED - the one-shot call action (src/lib/oneshot/kalrez.ts).
// GET (anyone who may open UC): the board - tickets, contacts, orders since the start; ?plan=1 = the
// tickets as they would be made, and the last run. POST (admins only) {action: "preview" | "create" | "titles"}:
// count what a run would make, make the missing tickets (idempotent, under a lock), or put renamed titles back.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError, hubspotToken, ticketsToken } from "@/lib/integrations/status";
import { kalrezCreate, kalrezData, kalrezPlan, kalrezRepairTitles } from "@/lib/integrations/kalrezSwitch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!ticketsToken() && !hubspotToken()) return NextResponse.json({ configured: false, missing: ["TICKETS_TOKEN"] });
  try {
    if (req.nextUrl.searchParams.get("plan") === "1") {
      return NextResponse.json({ configured: true, ok: true, data: { ...(await kalrezPlan()), admin: access.role === "admin" } });
    }
    const data = await kalrezData({ refresh: req.nextUrl.searchParams.get("refresh") === "1" });
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // one click makes a ticket for every customer on the list - admins only, like every bulk run in the hub
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  if (b.action !== "preview" && b.action !== "create" && b.action !== "titles") return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  try {
    if (b.action === "titles") {
      const r = await kalrezRepairTitles();
      if (!r) return NextResponse.json({ ok: false, error: "A run is already going - try again in a minute." }, { status: 409 });
      return NextResponse.json({ ok: true, titles: r });
    }
    const run = await kalrezCreate(b.action === "create" ? "apply" : "dry", `user ${access.userId}`);
    if (!run) return NextResponse.json({ ok: false, error: "A run is already going - try again in a minute." }, { status: 409 });
    return NextResponse.json({ ok: true, data: run });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) }, { status: 502 });
  }
}
