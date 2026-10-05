// The Datatracker's Article tab: ERP order counts from Products & Pricing, with
// what the shop itself reported joined on the article number. Not GA4 - that was
// consent-gated and empty for most visitors.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { fetchArticleActivity } from "@/lib/integrations/articleActivity";
import { cachedReport } from "@/lib/integrations/hubspotJourney";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hubspot = integrationStatus().hubspot;
  if (!hubspot.configured) {
    return NextResponse.json({ configured: false, missing: hubspot.missing, detail: hubspot.detail });
  }

  const sp = req.nextUrl.searchParams;
  const search = sp.get("search") ?? undefined;
  const sort = (["orders", "companies", "stock"] as const).find((s) => s === sp.get("sort")) ?? "orders";
  const limit = Number(sp.get("limit")) || 100;
  const after = sp.get("after") ?? undefined;
  const pcRaw = (sp.get("pc") ?? "").trim().toUpperCase();
  const pc = /^[A-Z]{2}$/.test(pcRaw) ? pcRaw : undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const data = await cachedReport(`articles:${search ?? ""}:${sort}:${pc ?? ""}:${limit}:${after ?? ""}`, () =>
      fetchArticleActivity({ search, sort, pc, limit, after, signal: controller.signal }),
    );
    return NextResponse.json({ configured: true, ok: true, data });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}
