// ASSOCIATIONS > GQS follow-ups (src/lib/ticketAssoc/gqsType.ts, SARCLA 04.11.2026): ESO / TSA tickets linked to a GQS
// request carry "Type of sales ticket" = GQS. GET: the mode, the last look and the links the hub found since it started.
// The mode is set with the app's other modes (PUT /api/uc/ticket-associations {gqs}).

import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { getSettings } from "@/lib/ticketAssoc/run";
import { gqsReport } from "@/lib/ticketAssoc/gqsType";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const [settings, report] = await Promise.all([getSettings(), gqsReport()]);
    return NextResponse.json({ configured: true, ok: true, data: { mode: settings.gqs, ...report, admin: access.role === "admin" } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}
