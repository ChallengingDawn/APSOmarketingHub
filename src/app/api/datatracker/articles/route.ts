// Articles: how often each part was looked at and bought.
//
// Item-scoped GA4, so it covers the sessions that accepted analytics cookies.
// The Datatracker's own article figures are counted by the shop on an
// essential-cookie basis and are therefore larger and complete — they are not
// in HubSpot, so they are not here. The screen says which is which.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { fetchGa4Report } from "@/lib/integrations/ga4Reports";
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const report = await fetchGa4Report({ name: "itemActivity", from, to, signal: controller.signal });
    const rows = report.rows.map((r) => ({
      articleNumber: r.keys[0] ?? "",
      name: r.keys[1] ?? "",
      views: r.values[0] ?? null,
      purchased: r.values[1] ?? null,
      revenue: r.values[2] ?? null,
    }));
    return NextResponse.json({ configured: true, ok: true, data: { from, to, rows } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}
