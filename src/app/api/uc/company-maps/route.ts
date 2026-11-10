// COMPANY DATA > Google Maps link (src/lib/companyMaps). Replaces the HubSpot workflow "SARCLA | GMAPS QUERY WITH CODE",
// SARCLA 10.11.2026.
// GET: how it runs, the figures, the companies still without a link and the links the hub wrote (30 days).
// PUT (admins) {mode}: live / shadow / off. POST (admins) {action: "run"}: look now (started, not waited for).

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { pageState, runOnce, saveSettings, type Mode } from "@/lib/companyMaps/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PER_LIST = 1500;

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const s = await pageState();
    const rows = s.state?.rows ?? [];
    const done = rows.filter((r) => r.written && !r.written.error).sort((a, b) => b.written!.at.localeCompare(a.written!.at));
    const waiting = rows.filter((r) => !(r.written && !r.written.error)).sort((a, b) => b.created.localeCompare(a.created));
    return NextResponse.json({ configured: true, ok: true, data: {
      settings: s.settings, last: s.last, workflowOn: s.workflowOn, writing: s.writing, admin: access.role === "admin",
      at: s.state?.at ?? null, companies: s.state?.companies ?? null, withLink: s.state?.withLink ?? null,
      waiting: waiting.slice(0, PER_LIST), waitingCount: waiting.length, done: done.slice(0, PER_LIST), doneCount: done.length,
    } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { mode?: Mode };
  if (!b.mode || !["off", "shadow", "live"].includes(b.mode)) return NextResponse.json({ ok: false, error: "Unknown mode" }, { status: 400 });
  return NextResponse.json({ ok: true, data: await saveSettings(b.mode, `user ${access.userId}`) });
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  if (b.action !== "run") return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  void runOnce().catch((e) => console.warn(`[company-maps] ${(e as Error).message}`));
  return NextResponse.json({ ok: true, data: { started: true } });
}
