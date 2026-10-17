// TICKET ASSOCIATIONS - the HubSpot app that links Back Office, ESO and TSA tickets to their
// orders and articles, run by the hub every 3 minutes (src/lib/ticketAssoc/run.ts) in place of
// the HubSpot workflow on the Tickets app (SARCLA, 17.10.2026).
// GET ?from&to: the settings, the last runs, the figures and the latest tickets of the period.
// GET ?ticket=ID: one ticket checked - read and planned, never written.
// PUT (admins): mode (off / preview / live) and the extended evidence. POST (admins): run now.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { checkTicket, report, runOnce, setSettings, type Mode } from "@/lib/ticketAssoc/run";

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
    const ticket = sp.get("ticket");
    if (ticket) return NextResponse.json({ configured: true, ok: true, data: await checkTicket(ticket) });
    const to = ISO.test(sp.get("to") ?? "") ? sp.get("to")! : today();
    const from = ISO.test(sp.get("from") ?? "") ? sp.get("from")! : to;
    return NextResponse.json({ configured: true, ok: true, data: { ...(await report(from, to)), from, to, admin: access.role === "admin" } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { mode?: Mode; extended?: boolean };
  try {
    const s = await setSettings({ mode: b.mode, extended: typeof b.extended === "boolean" ? b.extended : undefined }, `user ${access.userId}`);
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
    const r = await runOnce(AbortSignal.timeout(50_000));
    return NextResponse.json({ ok: true, data: r ?? { skipped: "off, or a run is already going" } });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) }, { status: 500 });
  }
}
