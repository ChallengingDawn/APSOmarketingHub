// Turn the qualifying price checks into tickets.
//
// Writing needs the `tickets` scope on the hub's private app - a checkbox on the
// app, not a second token to deploy. Without it HubSpot refuses and the refusal
// is returned as it came, which is the clearest thing we can say about a scope.
//
// POST with ?dry=1 (the default) computes and reports; ?dry=0 writes. Signed-in
// users only, or a scheduler carrying INTERNAL_API_KEY - so a daily EventBridge
// rule can call exactly the same path the button calls, and there is one code
// path rather than two that can disagree.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { runPriceCheckTickets } from "@/lib/integrations/priceCheckTickets";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const key = process.env.INTERNAL_API_KEY;
  const viaKey = !!key && req.headers.get("x-internal-key") === key;
  if (!viaKey && !(await getOptionalUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hubspot = integrationStatus().hubspot;
  if (!hubspot.configured) {
    return NextResponse.json({ configured: false, missing: hubspot.missing });
  }

  // Writing is the only thing that needs the second token, so a dry run still
  // works on a deployment that has not been given it yet.
  const dry = req.nextUrl.searchParams.get("dry") !== "0";

  try {
    const data = await runPriceCheckTickets({ dry });
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) }, { status: 200 });
  }
}
