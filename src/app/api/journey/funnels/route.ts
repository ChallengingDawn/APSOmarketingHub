// The lifecycle funnels the workbook asks for, counted in HubSpot.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { fetchJourneyFunnels } from "@/lib/journey/funnels";
import { loadJourney } from "@/lib/journey/store";
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
  if (!hubspot.configured) return NextResponse.json({ configured: false, missing: hubspot.missing, detail: hubspot.detail });

  const model = await loadJourney();
  if (!model?.funnels?.length) return NextResponse.json({ configured: true, ok: true, data: null });

  const sp = req.nextUrl.searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const to = isDay(sp.get("to")) ? (sp.get("to") as string) : today;
  const from = isDay(sp.get("from"))
    ? (sp.get("from") as string)
    : new Date(Date.parse(`${to}T00:00:00Z`) - (DEFAULT_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const data = await cachedReport(`journeyFunnels:${from}:${to}`, () =>
      fetchJourneyFunnels({ from, to, paths: model.funnels, signal: controller.signal }),
    );
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}
