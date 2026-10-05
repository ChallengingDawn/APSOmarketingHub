// Every price-check ticket with its live ESO/TSA status, straight out of HubSpot.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { describeTicketsError } from "@/lib/integrations/erosion";
import { fetchPriceCheckTickets } from "@/lib/integrations/priceCheckOutcomes";
import { hubspotToken, ticketsToken } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ticketsToken() && !hubspotToken()) return NextResponse.json({ configured: false, missing: ["TICKETS_TOKEN"] });
  try {
    const data = await fetchPriceCheckTickets({ refresh: req.nextUrl.searchParams.get("refresh") === "1" });
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeTicketsError(err) });
  }
}
