// Every erosion ticket with its live ESO/TSA status, straight out of HubSpot.
// The same three answers as every integration route: not configured, upstream
// failed (with the reason), or the data.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { describeTicketsError, fetchErosionTickets } from "@/lib/integrations/erosion";
import { hubspotToken, ticketsToken } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ticketsToken() && !hubspotToken()) {
    return NextResponse.json({ configured: false, missing: ["HUBSPOT_TOKEN"] });
  }

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const data = await fetchErosionTickets({ refresh, signal: controller.signal });
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeTicketsError(err) });
  } finally {
    clearTimeout(timer);
  }
}
