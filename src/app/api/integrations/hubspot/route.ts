import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { fetchHubspotAccount, fetchHubspotSummary, fetchHubspotWeekly } from "@/lib/integrations/hubspot";
import { fetchCompaniesActiveOnSite, fetchCompanyDetail, fetchContactsCreated, fetchCustomerJourneys, fetchSegmentCounts } from "@/lib/integrations/hubspotJourney";
import { rangeParams, resolveRange } from "@/lib/integrations/dateRange";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 15_000;

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = integrationStatus().hubspot;
  if (!status.configured) {
    return NextResponse.json({ configured: false, missing: status.missing, detail: status.detail });
  }

  const rawDays = Number.parseInt(req.nextUrl.searchParams.get("days") ?? "", 10);
  const days = Number.isFinite(rawDays) ? rawDays : 30;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS * 4);
  try {
    if (req.nextUrl.searchParams.get("report") === "journey") {
      const { from, to } = rangeParams(req.nextUrl.searchParams);
      const range = resolveRange({ days, from, to }, 365);
      // Sequential on purpose: these fan out into many search calls, and the
      // search endpoint's per-second limit punishes bursts with 429s.
      const companies = await fetchCompaniesActiveOnSite({ from: range.startDate, to: range.endDate, signal: controller.signal });
      const contacts = await fetchContactsCreated({ from: range.startDate, to: range.endDate, signal: controller.signal });
      const segments = await fetchSegmentCounts({ from: range.startDate, to: range.endDate, signal: controller.signal });
      return NextResponse.json({ configured: true, ok: true, data: { companies, contacts, segments } });
    }
    if (req.nextUrl.searchParams.get("report") === "customerJourneys") {
      const { from, to } = rangeParams(req.nextUrl.searchParams);
      const range = resolveRange({ days, from, to }, 365);
      const data = await fetchCustomerJourneys({ from: range.startDate, to: range.endDate, signal: controller.signal });
      return NextResponse.json({ configured: true, ok: true, data });
    }
    if (req.nextUrl.searchParams.get("report") === "companyDetail") {
      const id = req.nextUrl.searchParams.get("id") ?? "";
      if (!/^\d{1,20}$/.test(id)) {
        return NextResponse.json({ configured: true, ok: false, error: "companyDetail needs a numeric id.", status: 400 });
      }
      const data = await fetchCompanyDetail({ id, signal: controller.signal });
      return NextResponse.json({ configured: true, ok: true, data });
    }
    if (req.nextUrl.searchParams.get("report") === "weekly") {
      const rawWeeks = Number.parseInt(req.nextUrl.searchParams.get("weeks") ?? "", 10);
      const weekly = await fetchHubspotWeekly({
        weeks: Number.isFinite(rawWeeks) ? rawWeeks : undefined,
        signal: controller.signal,
      });
      return NextResponse.json({ configured: true, ok: true, data: weekly });
    }
    // Account details need their own scope. Losing the portal id is a cosmetic
    // loss, so it must not fail an integration whose CRM reads work — only the
    // summary below decides whether HubSpot is genuinely reachable.
    let account = null;
    let accountUnavailable: string | undefined;
    try {
      account = await fetchHubspotAccount(controller.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      accountUnavailable = describeIntegrationError(err).error;
    }
    const summary = await fetchHubspotSummary({ days, signal: controller.signal });
    return NextResponse.json({
      configured: true,
      ok: true,
      data: { account, accountUnavailable, summary },
    });
  } catch (err) {
    const { error, status: upstreamStatus } = describeIntegrationError(err);
    return NextResponse.json({ configured: true, ok: false, error, status: upstreamStatus });
  } finally {
    clearTimeout(timer);
  }
}
