// E-shop activity per customer, live from the Datatracker figures on HubSpot companies.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { ESHOP_YEARS, fetchEshopActivity, fetchEshopFilterOptions, type EshopYear } from "@/lib/integrations/eshopActivity";
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
  const asked = Number(sp.get("year"));
  const year = (ESHOP_YEARS as readonly number[]).includes(asked) ? (asked as EshopYear) : 2026;
  const country = sp.get("country") ?? undefined;
  const mandant = sp.get("mandant") ?? undefined;
  const representative = sp.get("representative") ?? undefined;
  const apsoCustomer = sp.get("apsoCustomer") ?? undefined;
  const priority = sp.get("priority") ?? undefined;
  const after = sp.get("after") ?? undefined;
  const mode = sp.get("mode") === "range" ? "range" : "year";
  const sort = (["views", "logins", "revenue"] as const).find((s) => s === sp.get("sort")) ?? "views";
  const limit = Number(sp.get("limit")) || 100;
  const isDay = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const to = isDay(sp.get("to")) ? (sp.get("to") as string) : undefined;
  const from = isDay(sp.get("from")) ? (sp.get("from") as string) : undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const key = `datatracker:${year}:${country ?? ""}:${mandant ?? ""}:${representative ?? ""}:${apsoCustomer ?? ""}:${priority ?? ""}:${sort}:${limit}:${from ?? ""}:${to ?? ""}:${after ?? ""}:${mode}`;
    const data = await cachedReport(key, () =>
      fetchEshopActivity({ year, country, mandant, representative, apsoCustomer, priority, after, mode, sort, limit, from, to }, controller.signal),
    );
    // The option lists change about once a year; one shared cache entry.
    const options = await cachedReport("datatracker:options", () => fetchEshopFilterOptions(controller.signal));
    return NextResponse.json({ configured: true, ok: true, data, options });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}
