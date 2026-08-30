import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { fetchGscQueries, fetchGscQueryPagePairs, fetchGscSites, isGscDimension } from "@/lib/integrations/gsc";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";
import { rangeParams } from "@/lib/integrations/dateRange";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 15_000;

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = integrationStatus().gsc;
  if (!status.configured) {
    return NextResponse.json({ configured: false, missing: status.missing, detail: status.detail });
  }

  const sp = req.nextUrl.searchParams;
  const rawDays = Number.parseInt(sp.get("days") ?? "", 10);
  const days = Number.isFinite(rawDays) ? rawDays : 28;
  const { from, to } = rangeParams(sp);
  const rawDimension = sp.get("dimension");
  const dimension = isGscDimension(rawDimension) ? rawDimension : "query";
  const wantSites = sp.get("sites") === "1";

  // pairs=1 returns query+page combinations, which is the only shape that can
  // reveal two URLs competing for the same query.
  const wantPairs = sp.get("pairs") === "1";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    if (wantPairs) {
      const pairs = await fetchGscQueryPagePairs({ days, from, to, signal: controller.signal });
      return NextResponse.json({ configured: true, ok: true, data: pairs });
    }
    const report = await fetchGscQueries({ days, from, to, dimension, signal: controller.signal });
    // The verified-property list is what tells a user their site string is wrong.
    const sites = wantSites ? await fetchGscSites(controller.signal) : undefined;
    return NextResponse.json({ configured: true, ok: true, data: { ...report, sites } });
  } catch (err) {
    const { error, status: upstreamStatus } = describeIntegrationError(err);
    // A failed query is usually an access problem, and the single most useful
    // thing to show then is which properties the service account CAN see — an
    // empty list means it was never added to any Search Console property.
    let sites;
    if (wantSites) {
      try {
        sites = await fetchGscSites(controller.signal);
      } catch {
        sites = undefined;
      }
    }
    return NextResponse.json({ configured: true, ok: false, error, status: upstreamStatus, sites });
  } finally {
    clearTimeout(timer);
  }
}
