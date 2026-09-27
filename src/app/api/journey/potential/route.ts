// Sales potential carried by tickets, over the screen's window.
//
// A quarter is around ten thousand ticket rows, so this runs as a background
// report: the first call starts it and answers `computing`, later calls get the
// figure. The screen shows the progress line rather than a spinner with no news.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { fetchSalesPotential } from "@/lib/journey/salesPotential";
import { slowReport } from "@/lib/integrations/slowReport";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 90;
const TTL_MS = 6 * 60 * 60 * 1000;      // the load is nightly; six hours is generous
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

  try {
    const state = await slowReport(`potential:${from}:${to}`, TTL_MS, () => fetchSalesPotential({ from, to }));
    return NextResponse.json({ configured: true, ok: true, ...state });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) }, { status: 200 });
  }
}
