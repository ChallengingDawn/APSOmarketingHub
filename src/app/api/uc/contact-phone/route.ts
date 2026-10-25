// CONTACT PHONE - Map assignment > Phone numbers (src/lib/contactPhone). Replaces the HubSpot workflow "SARCLA | Contact
// phone number correction", SARCLA 25.10.2026.
// GET: the mode, the last run, every contact with the shop's phone and no phone and what the hub gives it, and the
// phones in HubSpot that are not valid (checked once a day).
// PUT (admins) {mode}: off, shadow (works it out, writes nothing) or live (writes once the workflow is switched off).
// POST (admins) {action}: "run" = look now, "scan" = check every phone again, "repair" = write the certain repairs.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { pageState, repairCertain, runOnce, saveSettings, startScan, type BadRow, type Mode } from "@/lib/contactPhone/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The rows of each list of phones that are not valid sent to the page - the counts are always whole. */
const PER_LIST = 1500;
const fixed = (x: BadRow) => !!x.repaired && !x.repaired.error;
const BAD: Record<string, (x: BadRow) => boolean> = {
  all: (x) => !fixed(x), repair: (x) => !!x.repair && !fixed(x), person: (x) => !x.repair && !fixed(x), repaired: fixed,
};

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const s = await pageState();
    const rows = [...s.state.rows].sort((a, b) => b.created.localeCompare(a.created));
    let bad = null;
    if (s.bad) {
      const newest = [...s.bad.rows].sort((a, b) => b.created.localeCompare(a.created));
      const counts: Record<string, number> = {};
      const keep = new Set<string>();
      for (const [k, f] of Object.entries(BAD)) {
        const hit = newest.filter(f);
        counts[k] = hit.length;
        for (const x of hit.slice(0, PER_LIST)) keep.add(x.id);
      }
      bad = { at: s.bad.at, scanned: s.bad.scanned, counts, rows: newest.filter((x) => keep.has(x.id)) };
    }
    return NextResponse.json({ configured: true, ok: true, data: { ...s, state: { at: s.state.at, rows }, bad, admin: access.role === "admin" } });
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
  try {
    if (b.action === "run") {
      const r = await runOnce();
      return NextResponse.json({ ok: true, data: r ?? { skipped: "Off, or a run is already going" } });
    }
    if (b.action === "scan") { const r = await startScan(); return NextResponse.json({ ok: r.started, data: r, error: r.why }); }
    if (b.action === "repair") { const r = await repairCertain(); return NextResponse.json({ ok: r.ok, data: r, error: r.why }); }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) });
  }
}
