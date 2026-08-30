// GA4 Data API (runReport) — read-only traffic overview for the configured
// property. Metrics are `number | null`: a metric the API did not return stays
// null rather than becoming a zero the UI would present as fact.

import { googleFetchJson } from "./google";
import { resolveRange } from "./dateRange";
import { ga4PropertyId } from "./status";

export const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

const DATA_API = "https://analyticsdata.googleapis.com/v1beta";
const BREAKDOWN_LIMIT = 10;
const MAX_DAYS = 365;

type ReportRow = {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
};

type RunReportResponse = {
  rows?: ReportRow[];
  totals?: ReportRow[];
};

export type Ga4Metrics = {
  sessions: number | null;
  totalUsers: number | null;
  engagementRate: number | null;
};

export type Ga4Totals = Ga4Metrics & { newUsers: number | null };
export type Ga4DailyPoint = Ga4Metrics & { date: string };
export type Ga4Breakdown = Ga4Metrics & { key: string };

export type Ga4Overview = {
  propertyId: string;
  days: number;
  range: { startDate: string; endDate: string };
  totals: Ga4Totals | null;
  /** The equivalent window immediately before, for deltas. Null if it did not return. */
  previousTotals: Ga4Totals | null;
  daily: Ga4DailyPoint[];
  landingPages: Ga4Breakdown[];
  channels: Ga4Breakdown[];
};

function metric(row: ReportRow, index: number): number | null {
  const raw = row.metricValues?.[index]?.value;
  if (typeof raw !== "string" || raw.length === 0) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function dimension(row: ReportRow, index: number): string | null {
  const raw = row.dimensionValues?.[index]?.value;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/** GA4 returns the `date` dimension as YYYYMMDD. */
function isoDate(raw: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(raw);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : raw;
}

function coreMetrics(row: ReportRow): Ga4Metrics {
  return {
    sessions: metric(row, 0),
    totalUsers: metric(row, 1),
    engagementRate: metric(row, 2),
  };
}

type ReportRequest = {
  dimensions?: { name: string }[];
  metrics: { name: string }[];
  dateRanges: { startDate: string; endDate: string }[];
  orderBys?: unknown[];
  limit?: string;
};

async function runReport(
  propertyId: string,
  body: ReportRequest,
  signal?: AbortSignal,
): Promise<RunReportResponse> {
  return googleFetchJson<RunReportResponse>({
    url: `${DATA_API}/properties/${encodeURIComponent(propertyId)}:runReport`,
    scope: GA4_SCOPE,
    label: "GA4",
    method: "POST",
    body,
    signal,
  });
}

export async function fetchGa4Overview(params: {
  days?: number;
  from?: string;
  to?: string;
  signal?: AbortSignal;
}): Promise<Ga4Overview> {
  const resolved = resolveRange({ days: params.days, from: params.from, to: params.to }, MAX_DAYS);
  const days = resolved.days;

  const propertyId = ga4PropertyId();
  const dateRanges = [{ startDate: resolved.startDate, endDate: resolved.endDate }];
  const coreMetricNames = [
    { name: "sessions" },
    { name: "totalUsers" },
    { name: "engagementRate" },
  ];

  const previousRanges = [resolved.previous];

  const [totalsRes, previousRes, dailyRes, landingRes, channelRes] = await Promise.all([
    runReport(
      propertyId,
      {
        metrics: [...coreMetricNames, { name: "newUsers" }],
        dateRanges,
      },
      params.signal,
    ),
    runReport(
      propertyId,
      {
        metrics: [...coreMetricNames, { name: "newUsers" }],
        dateRanges: previousRanges,
      },
      params.signal,
    ).catch(() => null),
    runReport(
      propertyId,
      {
        dimensions: [{ name: "date" }],
        metrics: coreMetricNames,
        dateRanges,
        orderBys: [{ dimension: { dimensionName: "date" } }],
      },
      params.signal,
    ),
    runReport(
      propertyId,
      {
        dimensions: [{ name: "landingPagePlusQueryString" }],
        metrics: coreMetricNames,
        dateRanges,
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: String(BREAKDOWN_LIMIT),
      },
      params.signal,
    ),
    runReport(
      propertyId,
      {
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: coreMetricNames,
        dateRanges,
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: String(BREAKDOWN_LIMIT),
      },
      params.signal,
    ),
  ]);

  const totalsRow = totalsRes.rows?.[0] ?? totalsRes.totals?.[0] ?? null;
  const previousRow = previousRes ? (previousRes.rows?.[0] ?? previousRes.totals?.[0] ?? null) : null;

  const daily: Ga4DailyPoint[] = (dailyRes.rows ?? []).flatMap((row) => {
    const key = dimension(row, 0);
    if (!key) return [];
    return [{ date: isoDate(key), ...coreMetrics(row) }];
  });

  const breakdown = (res: RunReportResponse): Ga4Breakdown[] =>
    (res.rows ?? []).flatMap((row) => {
      const key = dimension(row, 0);
      if (!key) return [];
      return [{ key, ...coreMetrics(row) }];
    });

  return {
    propertyId,
    days,
    range: { startDate: dateRanges[0].startDate, endDate: dateRanges[0].endDate },
    totals: totalsRow
      ? { ...coreMetrics(totalsRow), newUsers: metric(totalsRow, 3) }
      : null,
    previousTotals: previousRow
      ? { ...coreMetrics(previousRow), newUsers: metric(previousRow, 3) }
      : null,
    daily,
    landingPages: breakdown(landingRes),
    channels: breakdown(channelRes),
  };
}
