import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { fetchGa4Realtime } from "@/lib/integrations/ga4Realtime";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";
import { hubActivity } from "@/lib/hubActivity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 15_000;

// ?source=shop → GA4 realtime for the property (last 30 minutes)
// ?source=hub  → this app's own audit trail (last 60 minutes)
// Same three-state envelope as every integration route.
export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const source = req.nextUrl.searchParams.get("source") ?? "shop";

  if (source === "hub") {
    try {
      const data = await hubActivity(60);
      return NextResponse.json({ configured: true, ok: true, data });
    } catch (err) {
      const { error, status } = describeIntegrationError(err);
      return NextResponse.json({ configured: true, ok: false, error, status });
    }
  }

  const status = integrationStatus().ga4;
  if (!status.configured) {
    return NextResponse.json({ configured: false, missing: status.missing, detail: status.detail });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const data = await fetchGa4Realtime(controller.signal);
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    const { error, status: upstreamStatus } = describeIntegrationError(err);
    return NextResponse.json({ configured: true, ok: false, error, status: upstreamStatus });
  } finally {
    clearTimeout(timer);
  }
}
