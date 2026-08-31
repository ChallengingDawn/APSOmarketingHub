import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { fetchGa4Overview } from "@/lib/integrations/ga4";
import { fetchGa4Report, isGa4ReportName } from "@/lib/integrations/ga4Reports";
import { rangeParams } from "@/lib/integrations/dateRange";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 15_000;

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Missing credentials is a normal state the UI renders as "Connect", not an error.
  const status = integrationStatus().ga4;
  if (!status.configured) {
    return NextResponse.json({ configured: false, missing: status.missing, detail: status.detail });
  }

  const rawDays = Number.parseInt(req.nextUrl.searchParams.get("days") ?? "", 10);
  const days = Number.isFinite(rawDays) ? rawDays : 28;
  const { from, to } = rangeParams(req.nextUrl.searchParams);

  // ?report=<name> runs one named report; without it the overview is returned.
  const rawReport = req.nextUrl.searchParams.get("report");
  if (rawReport !== null && !isGa4ReportName(rawReport)) {
    return NextResponse.json({ configured: true, ok: false, error: `Unknown report "${rawReport}".`, status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let pagePath: string | undefined;
    if (rawReport === "pageTrend") {
      const rawPath = req.nextUrl.searchParams.get("path") ?? "";
      let decoded = "";
      try {
        decoded = decodeURIComponent(rawPath);
      } catch {
        decoded = rawPath;
      }
      if (!decoded.startsWith("/") || decoded.length > 300) {
        return NextResponse.json({ configured: true, ok: false, error: "pageTrend needs a plain site path.", status: 400 });
      }
      pagePath = decoded;
    }
    const data = isGa4ReportName(rawReport)
      ? await fetchGa4Report({ name: rawReport, days, from, to, pagePath, signal: controller.signal })
      : await fetchGa4Overview({ days, from, to, signal: controller.signal });
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    const { error, status: upstreamStatus } = describeIntegrationError(err);
    return NextResponse.json({ configured: true, ok: false, error, status: upstreamStatus });
  } finally {
    clearTimeout(timer);
  }
}
