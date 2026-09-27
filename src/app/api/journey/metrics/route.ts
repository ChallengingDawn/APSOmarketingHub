// Numbers for the journey steps, over the window the screen asks for.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { fetchJourneyMetrics } from "@/lib/journey/metrics";
import { cachedReport } from "@/lib/integrations/hubspotJourney";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 90;
const isDay = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ga4 = integrationStatus().ga4;
  if (!ga4.configured) return NextResponse.json({ configured: false, missing: ga4.missing, detail: ga4.detail });

  const sp = req.nextUrl.searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const to = isDay(sp.get("to")) ? (sp.get("to") as string) : today;
  const from = isDay(sp.get("from"))
    ? (sp.get("from") as string)
    : new Date(Date.parse(`${to}T00:00:00Z`) - (DEFAULT_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
  if (from > to) return NextResponse.json({ ok: false, error: "from is after to" }, { status: 400 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const data = await cachedReport(`journeyMetrics:${from}:${to}`, () =>
      fetchJourneyMetrics({ from, to, signal: controller.signal }),
    );
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    const described = describeIntegrationError(err);
    return NextResponse.json({ configured: true, ok: false, ...described }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}
