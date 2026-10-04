// Price checks: priced in the shop, not put in the cart. The detection half of
// the HubSpot ticket of the same name, reading the same rules so the two cannot
// drift apart.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { fetchPriceChecks } from "@/lib/integrations/priceChecks";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hubspot = integrationStatus().hubspot;
  if (!hubspot.configured) {
    return NextResponse.json({ configured: false, missing: hubspot.missing, detail: hubspot.detail });
  }

  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  if ((from && !ISO.test(from)) || (to && !ISO.test(to))) {
    return NextResponse.json({ ok: false, error: "from and to must be YYYY-MM-DD." }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const data = await fetchPriceChecks({
      from: from ?? undefined,
      to: to ?? undefined,
      signal: controller.signal,
    });
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    // 200 with ok:false, like its siblings: the client reads the reason out of
    // the body rather than guessing from a status code.
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}
