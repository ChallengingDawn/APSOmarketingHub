// 3D files: the 3D service's state on Railway, the 3D form's submissions with their tickets, and
// every 3D-request ticket. Read-only, Website's grant. The same three answers as every
// integration route: not configured, upstream failed (with the reason), or the data.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError, hubspotToken } from "@/lib/integrations/status";
import { cachedReport } from "@/lib/integrations/hubspotJourney";
import { readThreeD } from "@/lib/threeD/read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

let bump = 0;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!hubspotToken()) return NextResponse.json({ configured: false, missing: ["HUBSPOT_TOKEN"] });
  // Refresh asks again; otherwise the five-minute report cache answers
  if (req.nextUrl.searchParams.get("refresh") === "1") bump++;
  try {
    const data = await cachedReport(`threeD:${bump}`, readThreeD);
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}
