// SMART SUB-TICKETS - the hub's page for the HubSpot app that creates sub-tickets from a ticket (cards in the hub's
// HubSpot app since 18.10.2026). GET ?from&to: the sub-tickets created in the period, by pipeline, GQS complete or not.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { smartTicketReport } from "@/lib/smartTickets/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const to = ISO.test(sp.get("to") ?? "") ? sp.get("to")! : today();
  const from = ISO.test(sp.get("from") ?? "") ? sp.get("from")! : to;
  try {
    return NextResponse.json({ configured: true, ok: true, data: { ...(await smartTicketReport(from, to)), from, to } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}
