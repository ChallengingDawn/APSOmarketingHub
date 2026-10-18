// DUPLICATES & MERGES - shadow mode (SARCLA 18.10.2026: "DUPS and merge should be a separate app"). The hub looks for
// each new Back Office ticket's duplicates as the DUPS workflow does, and with the page's exclusions, and compares
// with what HubSpot wrote; it writes nothing to HubSpot (src/lib/ticketDuplicates).
// GET: settings, last run, figures, latest tickets (7 days). GET ?ticket=ID: one ticket checked, nothing stored.
// PUT (admins): mode and exclusions. POST (admins) {action: "run"}: look now.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { checkTicket, getSettings, lastRun, recentRows, runOnce, saveSettings, type Row } from "@/lib/ticketDuplicates/engine";
import type { Exclusions } from "@/lib/ticketDuplicates/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function summary(rows: Row[]) {
  const checked = rows.filter((r) => r.legacy && !r.stopped);
  const withKey = checked.filter((r) => r.legacy!.skip !== "no order key in subject/order_number");
  const settled = checked.filter((r) => r.actual);
  const found = (r: Row) => !!r.legacy?.duplicates.length;
  const hsFound = (r: Row) => !!r.actual?.message && !/^No duplicates found/.test(r.actual.message);
  return {
    seen: rows.length, checked: checked.length, withKey: withKey.length, settled: settled.length,
    legacyFound: checked.filter(found).length, hubspotFound: settled.filter(hsFound).length,
    sameVerdict: settled.filter((r) => found(r) === hsFound(r)).length,
    legacyOwnerChanges: checked.filter((r) => r.legacy?.ownerChange).length,
    hubOwnerChanges: checked.filter((r) => r.hub?.ownerChange).length,
    hubDiffers: checked.filter((r) => JSON.stringify(r.hub?.duplicates) !== JSON.stringify(r.legacy?.duplicates) || r.hub?.ownerChange?.ownerId !== r.legacy?.ownerChange?.ownerId).length,
    stopped: rows.filter((r) => r.stopped).length, errors: rows.filter((r) => r.error).length,
  };
}

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const t = req.nextUrl.searchParams.get("ticket");
    if (t && /^\d+$/.test(t)) return NextResponse.json({ configured: true, ok: true, data: await checkTicket(t) });
    const [settings, last, rows] = await Promise.all([getSettings(), lastRun(), recentRows(7)]);
    return NextResponse.json({ configured: true, ok: true, data: { settings, last, everyMinutes: 3, rows: rows.slice(0, 400), summary: summary(rows), admin: access.role === "admin" } });
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
  if (b.action !== "run") return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, data: (await runOnce()) ?? { skipped: "off, or another copy of the hub is running it" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 300) }, { status: 500 });
  }
}
