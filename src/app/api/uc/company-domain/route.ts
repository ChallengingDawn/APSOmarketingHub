// COMPANY DOMAIN - Map assignment > Domains (src/lib/companyDomain). Replaces the HubSpot workflow "SARCLA | COMPANY
// SETS DOMAIN", SARCLA 25.10.2026.
// GET: the mode, the last run, every company without a domain and what the hub gives it, the old name guesses.
// PUT (admins) {mode}: off, shadow (works it out, writes nothing) or live (writes once the workflow is switched off).
// POST (admins) {action}: "run" = look now, "scan" = find the old guesses, "clear" = clear the ones that do not exist.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { pageState, runOnce, saveSettings, startClear, startGuessScan, type Mode } from "@/lib/companyDomain/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** the guesses that exist are many and only to look at: the first ones are sent */
const ALIVE_SENT = 1500;

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const s = await pageState();
    const g = s.guesses;
    const rows = g?.rows ?? [];
    const guesses = g && {
      ...g,
      counts: {
        total: rows.length, dead: rows.filter((r) => r.exists === false).length, alive: rows.filter((r) => r.exists === true).length,
        unsure: rows.filter((r) => r.exists === null).length, deadWithReal: rows.filter((r) => r.exists === false && r.real).length,
        cleared: rows.filter((r) => r.cleared && !r.cleared.error).length,
      },
      rows: [...rows.filter((r) => r.exists !== true), ...rows.filter((r) => r.exists === true).slice(0, ALIVE_SENT)],
    };
    return NextResponse.json({ configured: true, ok: true, data: { ...s, guesses, admin: access.role === "admin" } });
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
    if (b.action === "scan") { const r = await startGuessScan(`user ${access.userId}`); return NextResponse.json({ ok: r.started, data: r, error: r.why }); }
    if (b.action === "clear") { const r = await startClear(`user ${access.userId}`); return NextResponse.json({ ok: r.started, data: r, error: r.why }); }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) });
  }
}
