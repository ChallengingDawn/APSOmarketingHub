// BACK OFFICE DISTRIBUTION - shadow mode (SARCLA 18.10.2026). The hub works out what the HubSpot distribution
// workflows decide for every new Back Office / GQS ticket and compares it with what HubSpot really did; it writes
// nothing to HubSpot (src/lib/boDistribution).
// GET: settings, the last run, the figures, the latest tickets (7 days), the rosters. PUT (admins): mode off / shadow.
// POST (admins) {action: "run"}: look now.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { getSettings, lastRun, recentRows, runOnce, saveSettings, type Row } from "@/lib/boDistribution/engine";
import { LEGACY, PEOPLE } from "@/lib/boDistribution/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The figures: is the copy right (legacy = HubSpot), and what would the fixes change (hub vs legacy). */
function summary(rows: Row[]) {
  const decided = rows.filter((r) => r.legacy?.ownerId);
  const checked = decided.filter((r) => r.actual);
  const sameOwner = checked.filter((r) => r.actual!.ownerId === r.legacy!.ownerId).length;
  const hubDiffers = decided.filter((r) => r.hub?.ownerId !== r.legacy?.ownerId).length;
  const withCat = rows.filter((r) => r.actual && r.route?.sets.enquiry_category);
  const sameCat = withCat.filter((r) => r.route!.sets.enquiry_category === r.actual!.category).length;
  const withPrio = rows.filter((r) => r.actual && r.route?.sets.hs_ticket_priority);
  const samePrio = withPrio.filter((r) => r.route!.sets.hs_ticket_priority === r.actual!.priority).length;
  return {
    seen: rows.length, bo: rows.filter((r) => r.pipeline === "bo").length, gqs: rows.filter((r) => r.pipeline === "gqs").length,
    decided: decided.length, checked: checked.length, sameOwner, hubDiffers,
    categoryChecked: withCat.length, sameCategory: sameCat, priorityChecked: withPrio.length, samePriority: samePrio,
    noDistribution: rows.filter((r) => !r.legacy && !r.error).length, errors: rows.filter((r) => r.error).length,
  };
}

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const [settings, last, rows] = await Promise.all([getSettings(), lastRun(), recentRows(7)]);
    return NextResponse.json({
      configured: true, ok: true,
      data: {
        settings, last, everyMinutes: 2, rows: rows.slice(0, 400), summary: summary(rows), admin: access.role === "admin",
        rosters: { ...LEGACY, deactivated: [PEOPLE.adriana, PEOPLE.vanessa] },
      },
    });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { mode?: "off" | "shadow" };
  return NextResponse.json({ ok: true, data: await saveSettings({ mode: b.mode === "off" ? "off" : "shadow" }, `user ${access.userId}`) });
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  if (b.action !== "run") return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  try {
    const r = await runOnce();
    return NextResponse.json({ ok: true, data: r ?? { skipped: "off, or another copy of the hub is running it" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 300) }, { status: 500 });
  }
}
