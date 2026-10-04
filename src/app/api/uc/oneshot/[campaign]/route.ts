// One one-shot action's rows - targets, tickets, contact dates, orders - for the
// board to turn into KPIs for the viewer's period. The same three answers as
// every integration route: not configured, upstream failed (with the reason), or the data.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { oneShotData } from "@/lib/integrations/oneshot";
import { connectorReadKey, describeIntegrationError, hubspotToken, ticketsToken } from "@/lib/integrations/status";
import { isCampaign } from "@/lib/oneshot/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ campaign: string }> }) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaign } = await params;
  if (!isCampaign(campaign)) return NextResponse.json({ error: "Unknown action" }, { status: 404 });

  const missing = [
    ...(!ticketsToken() && !hubspotToken() ? ["TICKETS_TOKEN"] : []),
    // only for the first read of a target list; after that the hub holds its own copy
    ...(!connectorReadKey() ? ["CONNECTOR_READ_KEY"] : []),
  ];
  if (missing.includes("TICKETS_TOKEN")) return NextResponse.json({ configured: false, missing });

  try {
    const data = await oneShotData(campaign, { refresh: req.nextUrl.searchParams.get("refresh") === "1" });
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}
