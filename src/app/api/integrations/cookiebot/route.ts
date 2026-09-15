import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { cookiebotApiKey, fetchConsentStats } from "@/lib/integrations/cookiebot";
import { cachedReport } from "@/lib/integrations/hubspotJourney";
import { describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 15_000;
const DAY_MS = 86_400_000;
const MAX_DAYS = 365;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * The reporting window's from/to when both are valid, otherwise the last `days`
 * (30 by default). Cookiebot has no figures for today yet, so the end stops at
 * yesterday, and one call covers a year at most.
 */
function consentRange(sp: URLSearchParams): { from: string; to: string } {
  const yesterday = isoDay(Date.now() - DAY_MS);
  const qFrom = sp.get("from");
  const qTo = sp.get("to");
  if (qFrom && qTo && ISO_DAY.test(qFrom) && ISO_DAY.test(qTo) && qFrom <= qTo) {
    const to = qTo < yesterday ? qTo : yesterday;
    const earliest = isoDay(Date.parse(`${to}T00:00:00Z`) - (MAX_DAYS - 1) * DAY_MS);
    const from = qFrom > to ? to : qFrom < earliest ? earliest : qFrom;
    return { from, to };
  }
  const rawDays = Number.parseInt(sp.get("days") ?? "", 10);
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), MAX_DAYS) : 30;
  return { from: isoDay(Date.now() - days * DAY_MS), to: yesterday };
}

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

  const { from, to } = consentRange(req.nextUrl.searchParams);
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
