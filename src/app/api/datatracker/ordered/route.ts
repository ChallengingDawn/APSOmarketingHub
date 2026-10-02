// Which articles a given customer has actually ordered.
//
// Called when a Datatracker row is opened, so the "Ordered" column can say
// something the shop's purchase event cannot: that the customer buys this
// article at all, including when the order came by phone or e-mail.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { fetchOrderedArticles } from "@/lib/integrations/eshopActivity";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hubspot = integrationStatus().hubspot;
  if (!hubspot.configured) return NextResponse.json({ configured: false, missing: hubspot.missing });

  const companyId = req.nextUrl.searchParams.get("companyId") ?? "";
  if (!/^\d{1,20}$/.test(companyId)) {
    return NextResponse.json({ ok: false, error: "A numeric companyId is required." }, { status: 400 });
  }

  try {
    const articles = await fetchOrderedArticles(companyId);
    return NextResponse.json({ ok: true, companyId, articles });
  } catch (err) {
    return NextResponse.json({ ok: false, error: describeIntegrationError(err) }, { status: 502 });
  }
}
