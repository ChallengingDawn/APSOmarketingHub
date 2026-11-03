// COMPANY REGIONS - Map assignment > Regions (src/lib/companyRegions). Replaces the HubSpot workflow "SARCLA | REGIONS
// SET", SARCLA 03.11.2026.
// GET: the mode, the last look, the companies changed lately and what they got, the last "Check all" (per country, and
//      the companies to correct - the first PER_LIST of them; the counts are whole).
// PUT (admins) {mode}: off, shadow (works it out, writes nothing) or live (writes once the workflow is switched off).
// POST (admins) {action}: "run" = look now, "check" = check every company, "correct" = write the check's list (Live).

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { pageState, runOnce, saveSettings, startCheck, startCorrect, type Mode } from "@/lib/companyRegions/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The check's companies to correct sent to the page, per country (~3,900 on 03.11.2026, 2,645 of them Swiss): every
 *  country's list has its own rows - the counts are whole. */
const PER_COUNTRY = 600;

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const s = await pageState();
    const fixes = s.check?.fixes ?? [];
    const counts = {
      fix: fixes.length,
      written: fixes.filter((f) => f.written && !f.written.error && !f.written.skipped).length,
      failed: fixes.filter((f) => f.written?.error).length,
      skipped: fixes.filter((f) => f.written?.skipped).length,
      byCountry: Object.fromEntries(Object.keys(s.check?.byCountry ?? {}).map((cc) => [cc, fixes.filter((f) => f.cc === cc && !f.written).length])),
    };
    // the ones still to write first, then the failed ones, then the written ones
    const order = (f: (typeof fixes)[number]) => (!f.written ? 0 : f.written.error ? 1 : 2);
    const sorted = [...fixes].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
    const sent = Object.keys(s.check?.byCountry ?? {}).flatMap((cc) => sorted.filter((f) => f.cc === cc).slice(0, PER_COUNTRY));
    const check = s.check && { ...s.check, fixes: sent, counts };
    return NextResponse.json({ configured: true, ok: true, data: { ...s, check, admin: access.role === "admin" } });
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
      const info = await runOnce();
      return NextResponse.json(info ? { ok: true, data: info } : { ok: false, error: "Not run - switched off, or a look is running" });
    }
    if (b.action === "check" || b.action === "correct") {
      const r = b.action === "check" ? await startCheck(`user ${access.userId}`) : await startCorrect(`user ${access.userId}`);
      return NextResponse.json(r.started ? { ok: true, data: r } : { ok: false, error: r.why ?? "not started" });
    }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) });
  }
}
