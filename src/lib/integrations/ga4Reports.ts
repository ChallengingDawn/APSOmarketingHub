// Named GA4 reports for the Analytics sub-apps. Each is one runReport call
// with a fixed dimension/metric set, so a report the property cannot answer
// (a metric the API does not know, a permission gap) fails on its own and is
// reported precisely, without taking the other cards down with it.
//
// Rows come back generically — dimension keys plus metric values in the order
// declared below — and the client formats them. Nothing here estimates a value
// the API did not return: a missing metric is null.

import { googleFetchJson } from "./google";
import { ga4PropertyId } from "./status";
import { GA4_SCOPE } from "./ga4";
import { resolveRange } from "./dateRange";

const DATA_API = "https://analyticsdata.googleapis.com/v1beta";
const MAX_DAYS = 365;

export type Ga4ReportName =
  | "acquisitionChannels"
  | "acquisitionSources"
  | "pages"
  | "landingPages"
  | "devices"
  | "countries"
  | "newVsReturning"
  | "engagementDaily"
  | "keyEventsByName"
  | "channelsDaily"
  | "conversionTotals";

type ReportSpec = {
  dimensions: string[];
  metrics: string[];
  /** Absent on dimensionless reports — GA4 rejects an orderBy there. */
  orderBy?: { metric?: string; dimension?: string; desc?: boolean };
  limit: number;
};

export const GA4_REPORTS: Record<Ga4ReportName, ReportSpec> = {
  acquisitionChannels: {
    dimensions: ["sessionDefaultChannelGroup"],
    metrics: ["sessions", "newUsers", "engagedSessions", "engagementRate", "keyEvents"],
    orderBy: { metric: "sessions", desc: true },
    limit: 12,
  },
  acquisitionSources: {
    dimensions: ["sessionSourceMedium"],
    metrics: ["sessions", "newUsers", "engagementRate", "keyEvents"],
    orderBy: { metric: "sessions", desc: true },
    limit: 20,
  },
  pages: {
    dimensions: ["pagePath"],
    metrics: ["screenPageViews", "sessions", "engagementRate", "averageSessionDuration"],
    orderBy: { metric: "screenPageViews", desc: true },
    limit: 25,
  },
  landingPages: {
    dimensions: ["landingPagePlusQueryString"],
    metrics: ["sessions", "newUsers", "engagementRate", "keyEvents"],
    orderBy: { metric: "sessions", desc: true },
    limit: 25,
  },
  devices: {
    dimensions: ["deviceCategory"],
    metrics: ["sessions", "engagementRate", "averageSessionDuration"],
    orderBy: { metric: "sessions", desc: true },
    limit: 5,
  },
  countries: {
    dimensions: ["country"],
    metrics: ["sessions", "newUsers", "engagementRate"],
    orderBy: { metric: "sessions", desc: true },
    limit: 10,
  },
  newVsReturning: {
    dimensions: ["newVsReturning"],
    metrics: ["sessions", "engagementRate"],
    orderBy: { metric: "sessions", desc: true },
    limit: 3,
  },
  engagementDaily: {
    dimensions: ["date"],
    metrics: ["engagementRate", "averageSessionDuration", "screenPageViewsPerSession", "bounceRate", "keyEvents", "engagedSessions"],
    orderBy: { dimension: "date" },
    limit: 400,
  },
  keyEventsByName: {
    dimensions: ["eventName"],
    metrics: ["keyEvents", "eventCount"],
    orderBy: { metric: "keyEvents", desc: true },
    limit: 10,
  },
  channelsDaily: {
    dimensions: ["date", "sessionDefaultChannelGroup"],
    metrics: ["sessions"],
    orderBy: { dimension: "date" },
    limit: 4000,
  },
  conversionTotals: {
    dimensions: [],
    metrics: ["sessions", "totalUsers", "newUsers", "keyEvents", "sessionKeyEventRate"],
    limit: 1,
  },
};

export function isGa4ReportName(value: unknown): value is Ga4ReportName {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(GA4_REPORTS, value);
}

export type Ga4TableRow = { keys: string[]; values: (number | null)[] };

export type Ga4TableReport = {
  name: Ga4ReportName;
  propertyId: string;
  days: number;
  range: { startDate: string; endDate: string };
  dimensions: string[];
  metrics: string[];
  rows: Ga4TableRow[];
  /** True when the API capped the result at `limit` — the table is the head, not the whole. */
  truncated: boolean;
};

type RunReportResponse = {
  rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
  rowCount?: number;
};

function num(raw: string | undefined): number | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** GA4 returns the `date` dimension as YYYYMMDD; everything downstream wants ISO. */
function normaliseKey(dimension: string, value: string): string {
  if (dimension !== "date") return value;
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : value;
}

export async function fetchGa4Report(params: {
  name: Ga4ReportName;
  days?: number;
  from?: string;
  to?: string;
  signal?: AbortSignal;
}): Promise<Ga4TableReport> {
  const spec = GA4_REPORTS[params.name];
  const resolved = resolveRange({ days: params.days, from: params.from, to: params.to }, MAX_DAYS);
  const days = resolved.days;
  const propertyId = ga4PropertyId();
  const range = { startDate: resolved.startDate, endDate: resolved.endDate };

  const res = await googleFetchJson<RunReportResponse>({
    url: `${DATA_API}/properties/${encodeURIComponent(propertyId)}:runReport`,
    scope: GA4_SCOPE,
    label: "GA4",
    method: "POST",
    body: {
      ...(spec.dimensions.length ? { dimensions: spec.dimensions.map((name) => ({ name })) } : {}),
      metrics: spec.metrics.map((name) => ({ name })),
      dateRanges: [range],
      ...(spec.orderBy
        ? {
            orderBys: [
              spec.orderBy.metric
                ? { metric: { metricName: spec.orderBy.metric }, desc: spec.orderBy.desc ?? false }
                : { dimension: { dimensionName: spec.orderBy.dimension }, desc: spec.orderBy.desc ?? false },
            ],
          }
        : {}),
      limit: String(spec.limit),
    },
    signal: params.signal,
  });

  const rows: Ga4TableRow[] = (res.rows ?? []).map((row) => ({
    keys: spec.dimensions.map((d, i) => normaliseKey(d, row.dimensionValues?.[i]?.value ?? "")),
    values: spec.metrics.map((_, i) => num(row.metricValues?.[i]?.value)),
  }));

  return {
    name: params.name,
    propertyId,
    days,
    range,
    dimensions: spec.dimensions,
    metrics: spec.metrics,
    rows,
    truncated: typeof res.rowCount === "number" ? res.rowCount > rows.length : false,
  };
}
