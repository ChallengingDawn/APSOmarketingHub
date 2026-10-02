// What one customer ordered — article by article — plus what they buy at all.
//
// Called when a Datatracker row is opened. Two different questions:
//
//  · `lines`  — the articles ordered IN THE WINDOW, with quantity and value.
//    This is the half of the desktop tracker's "Views - Orders" tab that no
//    browser event can supply. Metrohm AG placed the largest order of
//    2 October while the activity feed recorded one login and zero views: the
//    article is chosen on the page and the order is placed from the cart, so
//    the order record is the only thing that knows which article it was.
//
//  · `everOrdered` — the articles on the 100 most recent orders, used to tick
//    "Ordered" against something the customer merely looked at. It also covers
//    an order placed by phone, which no browser event ever sees.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { describeArticles, fetchCompanyOrderLines, fetchOrderedArticles } from "@/lib/integrations/eshopOrders";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hubspot = integrationStatus().hubspot;
  if (!hubspot.configured) return NextResponse.json({ configured: false, missing: hubspot.missing });

  const sp = req.nextUrl.searchParams;
  const companyId = sp.get("companyId") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (!/^\d{1,20}$/.test(companyId)) {
    return NextResponse.json({ ok: false, error: "A numeric companyId is required." }, { status: 400 });
  }
  const windowed = ISO.test(from) && ISO.test(to) && from <= to;

  try {
    const [lines, everOrdered] = await Promise.all([
      windowed ? fetchCompanyOrderLines(companyId, from, to) : Promise.resolve([]),
      fetchOrderedArticles(companyId),
    ]);

    // Fill in the descriptions the ERP lines did not carry.
    const missing = lines.filter((l) => !l.description).map((l) => l.article);
    if (missing.length) {
      const names = await describeArticles(missing).catch(() => ({} as Record<string, string>));
      for (const l of lines) if (!l.description) l.description = names[l.article] ?? null;
    }

    return NextResponse.json({ ok: true, companyId, from, to, lines, articles: everOrdered });
  } catch (err) {
    return NextResponse.json({ ok: false, error: describeIntegrationError(err) }, { status: 502 });
  }
}
