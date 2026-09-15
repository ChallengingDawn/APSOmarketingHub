import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { cookiebotApiKey, fetchConsentStats } from "@/lib/integrations/cookiebot";
import { cachedReport } from "@/lib/integrations/hubspotJourney";
import { describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 15_000;
const DAY_MS = 86_400_000;

// Same three-state contract as every /api/integrations route: not configured,
// upstream failed (verbatim message), or data.
export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!cookiebotApiKey()) {
    return NextResponse.json({
      configured: false,
      missing: ["COOKIEBOT_API_KEY"],
      detail: "The API key is in the Cookiebot Manager under Settings → Your scripts.",
    });
  }

  const rawDays = Number.parseInt(req.nextUrl.searchParams.get("days") ?? "", 10);
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 365) : 30;
  const to = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
  const from = new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const data = await cachedReport(`cookiebot:${from}:${to}`, () => fetchConsentStats({ from, to, signal: controller.signal }));
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    const { error, status } = describeIntegrationError(err);
    return NextResponse.json({ configured: true, ok: false, error, status });
  } finally {
    clearTimeout(timer);
  }
}
