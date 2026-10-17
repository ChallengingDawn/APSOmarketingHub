// TICKET/ORDER/ARTICLE ASSOCIATIONS - the HubSpot app that links Back Office, ESO and TSA tickets to their
// orders and articles, run by the hub every 3 minutes (src/lib/ticketAssoc/run.ts) in place of
// the HubSpot workflow on the Tickets app (SARCLA, 17.10.2026).
// GET ?from&to: the settings, the last runs, the figures and the latest tickets of the period.
// GET ?ticket=ID: one ticket checked - read and planned, never written.
// GET ?workflows=1: the HubSpot workflows whose custom code still reads TICKETS_TOKEN (needs the
// hub app's "automation" scope).
// PUT (admins): mode (off / preview / live), the extended evidence, the order alerts (off / preview /
// link / mail). POST (admins): run now - tickets and order alerts.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { checkTicket, report, runOnce, setBackfill, setSettings, type Mode } from "@/lib/ticketAssoc/run";
import { lookBack, type AlertMode } from "@/lib/ticketAssoc/orderAlerts";
import { flowsUsingProperty, flowsUsingSecret } from "@/lib/ticketAssoc/workflows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  try {
    if (sp.get("workflows")) return NextResponse.json({ configured: true, ok: true, data: await flowsUsingSecret("TICKETS_TOKEN", sp.get("refresh") === "1") });
    if (sp.get("articleFlows")) return NextResponse.json({ configured: true, ok: true, data: await flowsUsingProperty("article", sp.get("refresh") === "1") });
    const ticket = sp.get("ticket");
    if (ticket) return NextResponse.json({ configured: true, ok: true, data: await checkTicket(ticket) });
    const to = ISO.test(sp.get("to") ?? "") ? sp.get("to")! : today();
    const from = ISO.test(sp.get("from") ?? "") ? sp.get("from")! : to;
    return NextResponse.json({ configured: true, ok: true, data: { ...(await report(from, to, sp.get("pipeline"))), from, to, admin: access.role === "admin" } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { mode?: Mode; extended?: boolean; alerts?: AlertMode; copyArticles?: boolean; backfill?: { from: string | null }; alertsLookBack?: number };
  try {
    // the order alerts read the last N days' orders again (at most 14)
    if (typeof b.alertsLookBack === "number") return NextResponse.json({ ok: true, data: { since: await lookBack(b.alertsLookBack) } });
    // the re-check of older tickets: start from a day, or stop (from null)
    if (b.backfill) return NextResponse.json({ ok: true, data: await setBackfill(b.backfill.from, `user ${access.userId}`) });
    const s = await setSettings({ mode: b.mode, extended: typeof b.extended === "boolean" ? b.extended : undefined, alerts: b.alerts, copyArticles: typeof b.copyArticles === "boolean" ? b.copyArticles : undefined }, `user ${access.userId}`);
    return NextResponse.json({ ok: true, data: s });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  if (b.action !== "run") return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  try {
    const r = await runOnce(AbortSignal.timeout(50_000), true);
    return NextResponse.json({ ok: true, data: r ?? { skipped: "off, or a run is already going" } });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) }, { status: 500 });
  }
}
