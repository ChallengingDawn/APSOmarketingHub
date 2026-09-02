import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { fetchHubspotAccount, fetchHubspotSummary, fetchHubspotWeekly } from "@/lib/integrations/hubspot";
import { fetchAudience, fetchCompaniesActiveOnSite, fetchCompanyDetail, fetchContactsCreated, fetchCustomerJourneys, cachedReport, fetchGclidStatus, fetchPageAudience, fetchRecentPeople, fetchSegmentCounts } from "@/lib/integrations/hubspotJourney";
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
      // search endpoint's per-second limit punishes bursts with 429s. The
      // companies list is its own report now, so it can page and filter.
      const data = await cachedReport(`journey:${range.startDate}:${range.endDate}`, async () => {
        const contacts = await fetchContactsCreated({ from: range.startDate, to: range.endDate, signal: controller.signal });
        const segments = await fetchSegmentCounts({ from: range.startDate, to: range.endDate, signal: controller.signal });
        return { contacts, segments };
      });
      return NextResponse.json({ configured: true, ok: true, data });
    }
    if (req.nextUrl.searchParams.get("report") === "companies") {
      const { from, to } = rangeParams(req.nextUrl.searchParams);
      const range = resolveRange({ days, from, to }, 365);
      const sp = req.nextUrl.searchParams;
      const rawLimit = Number.parseInt(sp.get("limit") ?? "", 10);
      const after = sp.get("after") ?? undefined;
      const segment = sp.get("segment") ?? undefined;
      const priority = sp.get("priority") ?? undefined;
      const data = await fetchCompaniesActiveOnSite({
        from: range.startDate,
        to: range.endDate,
        limit: Number.isFinite(rawLimit) ? rawLimit : 20,
        after: after && /^[\w=-]{1,200}$/.test(after) ? after : undefined,
        segment: segment && segment.length <= 64 ? segment : undefined,
        priority: priority && priority.length <= 64 ? priority : undefined,
        signal: controller.signal,
      });
      return NextResponse.json({ configured: true, ok: true, data });
    }
    if (req.nextUrl.searchParams.get("report") === "audience") {
      const { from, to } = rangeParams(req.nextUrl.searchParams);
      const range = resolveRange({ days, from, to }, 365);
      const data = await cachedReport(`audience:${range.startDate}:${range.endDate}`, () =>
        fetchAudience({ from: range.startDate, to: range.endDate, signal: controller.signal }),
      );
      return NextResponse.json({ configured: true, ok: true, data });
    }
    if (req.nextUrl.searchParams.get("report") === "customerJourneys") {
      const { from, to } = rangeParams(req.nextUrl.searchParams);
      const range = resolveRange({ days, from, to }, 365);
      const data = await cachedReport(`journeys:${range.startDate}:${range.endDate}`, () =>
        fetchCustomerJourneys({ from: range.startDate, to: range.endDate, signal: controller.signal }),
      );
      return NextResponse.json({ configured: true, ok: true, data });
    }
    if (req.nextUrl.searchParams.get("report") === "gclidStatus") {
      const data = await cachedReport("gclidStatus", () => fetchGclidStatus(controller.signal));
      return NextResponse.json({ configured: true, ok: true, data });
    }
    if (req.nextUrl.searchParams.get("report") === "recentPeople") {
      const sp = req.nextUrl.searchParams;
      const rawLimit = Number.parseInt(sp.get("limit") ?? "", 10);
      const rawMinutes = Number.parseInt(sp.get("minutes") ?? "", 10);
      const minutes = Number.isFinite(rawMinutes) ? Math.min(Math.max(rawMinutes, 5), 24 * 60) : undefined;
      const { from, to } = rangeParams(sp);
      const range = minutes ? null : resolveRange({ days, from, to }, 365);
      const after = sp.get("after") ?? undefined;
      const data = await fetchRecentPeople({
        from: range?.startDate,
        to: range?.endDate,
        sinceMinutes: minutes,
        limit: Number.isFinite(rawLimit) ? rawLimit : 12,
        after: after && /^[\w=-]{1,200}$/.test(after) ? after : undefined,
        signal: controller.signal,
      });
      return NextResponse.json({ configured: true, ok: true, data });
    }
    if (req.nextUrl.searchParams.get("report") === "pageAudience") {
      const raw = req.nextUrl.searchParams.get("path") ?? "";
      let path = "";
      try {
        path = decodeURIComponent(raw);
      } catch {
        path = raw;
      }
      if (!path.startsWith("/") || path.length > 300 || !/^[\w\-./%~:+()]{1,300}$/.test(path)) {
        return NextResponse.json({ configured: true, ok: false, error: "pageAudience needs a plain site path.", status: 400 });
      }
      const rawLimit = Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "", 10);
      const data = await fetchPageAudience({ path, limit: Number.isFinite(rawLimit) ? rawLimit : 12, signal: controller.signal });
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
      const { from, to } = rangeParams(req.nextUrl.searchParams);
      const weekly = await cachedReport(`weekly:${from ?? ""}:${to ?? ""}:${rawWeeks}`, () =>
        fetchHubspotWeekly({
          weeks: Number.isFinite(rawWeeks) ? rawWeeks : undefined,
          from,
          to,
          signal: controller.signal,
        }),
      );
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
