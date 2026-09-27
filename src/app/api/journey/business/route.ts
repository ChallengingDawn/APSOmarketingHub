// The money behind the journey, read from the ERP series in HubSpot's KPI object.
//
// It takes the screen's window, but only as the WHOLE calendar months inside it:
// the series are monthly and cannot answer "the last 28 days". A window with no
// whole month falls back to the year to date and says so in the payload.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { fetchJourneyBusiness } from "@/lib/journey/business";
import { cachedReport } from "@/lib/integrations/hubspotJourney";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 90;
const isDay = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hubspot = integrationStatus().hubspot;
  if (!hubspot.configured) {
    return NextResponse.json({ configured: false, missing: hubspot.missing, detail: hubspot.detail });
  }

  const sp = req.nextUrl.searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const to = isDay(sp.get("to")) ? (sp.get("to") as string) : today;
  const from = isDay(sp.get("from"))
    ? (sp.get("from") as string)
    : new Date(Date.parse(`${to}T00:00:00Z`) - (DEFAULT_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    // The file is reloaded once a morning, so a shared cache per window is
    // generous: six series is around twenty throttled search calls.
    const data = await cachedReport(`journeyBusiness:${from}:${to}`, () =>
      fetchJourneyBusiness({ from, to, signal: controller.signal }),
    );
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}
