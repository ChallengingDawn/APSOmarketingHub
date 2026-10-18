// DUPLICATES & MERGES - shadow mode (SARCLA 18.10.2026: "DUPS and merge should be a separate app"). The hub looks for
// each new Back Office ticket's duplicates as the DUPS workflow does, and with the page's exclusions, and compares
// with what HubSpot wrote; it writes nothing to HubSpot (src/lib/ticketDuplicates).
// GET ?days=7|14|21: settings, last run, the replay, the measurement over every stored row of those days, and the
// latest rows for the table. GET ?ticket=ID: one ticket checked, nothing stored.
// PUT (admins): mode and exclusions. POST (admins) {action: "run"}: look now; {action: "replay"}: the last 7 days again.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { backfillState, checkTicket, getSettings, lastRun, recentRows, replayBackfill, runOnce, saveSettings } from "@/lib/ticketDuplicates/engine";
import { measure } from "@/lib/ticketDuplicates/measure";
import type { Exclusions } from "@/lib/ticketDuplicates/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** the table's rows - the figures are measured over all of them */
const ROWS_SENT = 1000;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const t = req.nextUrl.searchParams.get("ticket");
    if (t && /^\d+$/.test(t)) return NextResponse.json({ configured: true, ok: true, data: await checkTicket(t) });
    const asked = Number(req.nextUrl.searchParams.get("days"));
    const days = [7, 14, 21].includes(asked) ? asked : 14;
    const [settings, last, rows, backfill] = await Promise.all([getSettings(), lastRun(), recentRows(days), backfillState()]);
    return NextResponse.json({
      configured: true, ok: true,
      data: { settings, last, backfill, everyMinutes: 3, days, rows: rows.slice(0, ROWS_SENT), totalRows: rows.length, measure: measure(rows, settings.exclusions), admin: access.role === "admin" },
    });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { mode?: "off" | "shadow"; exclusions?: Partial<Exclusions> };
  return NextResponse.json({ ok: true, data: await saveSettings(b, `user ${access.userId}`) });
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  try {
    if (b.action === "replay") return NextResponse.json({ ok: true, data: await replayBackfill(`user ${access.userId}`) });
    if (b.action !== "run") return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
    return NextResponse.json({ ok: true, data: (await runOnce()) ?? { skipped: "off, or another copy of the hub is running it" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 300) }, { status: 500 });
  }
}
