// TICKET VALUE - shadow mode (SARCLA 20.10.2026: "bring the workflow SARCLA | TICKET VALUE CALCULATION as a sub app on
// the hub"). The hub works each ticket's value out with the workflow's rules and compares it with what the workflow
// wrote; it writes nothing to HubSpot (src/lib/ticketValue).
// GET ?days=1|7|14|21: settings, last run, the figures over every stored row of those days, the latest rows.
// GET ?ticket=ID: one ticket worked out now, nothing stored. PUT (admins): mode - off, shadow, or live (writes once the workflow is
// switched off in HubSpot). POST (admins) {action: "run"}: look now.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { betterContext, checkTicket, getSettings, lastRun, liveState, recentRows, runOnce, saveSettings } from "@/lib/ticketValue/engine";
import { firstOrderState } from "@/lib/ticketValue/firstOrder";
import { pipelineState } from "@/lib/ticketValue/live";
import { measure } from "@/lib/ticketValue/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** the table's rows - the figures are measured over all of them */
const ROWS_SENT = 1500;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const t = req.nextUrl.searchParams.get("ticket");
    if (t && /^\d+$/.test(t)) return NextResponse.json({ configured: true, ok: true, data: await checkTicket(t) });
    const asked = Number(req.nextUrl.searchParams.get("days"));
    const days = [1, 7, 14, 21].includes(asked) ? asked : 7;
    const [settings, last, rows, ctx, fo, live, pipeline] = await Promise.all([getSettings(), lastRun(), recentRows(days), betterContext(), firstOrderState(), liveState(), pipelineState()]);
    const better = {
      firstOrder: ctx.firstOrder, firstOrderMedian: fo.median, firstOrderN: ctx.firstOrderN, firstOrderAt: ctx.firstOrderAt, pricedArticles: ctx.pricedArticles,
      firstOrderProgress: fo.next ? { done: Object.keys(fo.next.values).length, of: fo.next.companies.length } : null,
    };
    return NextResponse.json({
      configured: true, ok: true,
      data: { settings, last, everyMinutes: 2, days, rows: rows.slice(0, ROWS_SENT), totalRows: rows.length, measure: measure(rows), better, live, pipeline, admin: access.role === "admin" },
    });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { mode?: "off" | "shadow" | "live" };
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
