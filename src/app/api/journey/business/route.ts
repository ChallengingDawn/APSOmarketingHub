// The money behind the journey, read from the ERP series in HubSpot's KPI object.
//
// No window parameters: the series are monthly and answer a year-to-date
// comparison, not an arbitrary range. The payload names the months it covers so
// the screen can print them.

import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { fetchJourneyBusiness } from "@/lib/journey/business";
import { cachedReport } from "@/lib/integrations/hubspotJourney";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hubspot = integrationStatus().hubspot;
  if (!hubspot.configured) {
    return NextResponse.json({ configured: false, missing: hubspot.missing, detail: hubspot.detail });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    // The file is reloaded once a morning, so a shared half-hour cache is
    // generous: six series is around twenty throttled search calls.
    const data = await cachedReport("journeyBusiness:v1", () => fetchJourneyBusiness(controller.signal));
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}
