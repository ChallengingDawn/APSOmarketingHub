// Google Search Console — searchAnalytics.query for the configured property,
// plus the verified-site list (the fastest way to diagnose "wrong site" and
// "service account not added as a user" errors).

import { googleFetchJson } from "./google";
import { gscSiteUrl } from "./status";
import { resolveRange } from "./dateRange";

export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

const SEARCH_CONSOLE_API = "https://searchconsole.googleapis.com/webmasters/v3";
const DEFAULT_ROW_LIMIT = 250;
// Query+page pairs fan out one row per combination, so the tail needs headroom.
const PAIR_ROW_LIMIT = 500;
const MAX_ROW_LIMIT = 500;
const MAX_DAYS = 490;

export type GscDimension = "query" | "page";

export type GscRow = {
  key: string;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
};

export type GscReport = {
  siteUrl: string;
  dimension: GscDimension;
  days: number;
  range: { startDate: string; endDate: string };
  rows: GscRow[];
};

export type GscSite = {
  siteUrl: string;
  permissionLevel: string | null;
};

type QueryResponse = {
  rows?: {
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  }[];
};

type SitesResponse = {
  siteEntry?: { siteUrl?: string; permissionLevel?: string }[];
};


function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function isGscDimension(value: unknown): value is GscDimension {
  return value === "query" || value === "page";
}

export async function fetchGscQueries(params: {
  days?: number;
  from?: string;
  to?: string;
  dimension?: GscDimension;
  rowLimit?: number;
  signal?: AbortSignal;
}): Promise<GscReport> {
  const resolved = resolveRange({ days: params.days, from: params.from, to: params.to }, MAX_DAYS);
  const days = resolved.days;
  const dimension: GscDimension = params.dimension ?? "query";
  const rowLimit = Math.min(Math.max(params.rowLimit ?? DEFAULT_ROW_LIMIT, 1), MAX_ROW_LIMIT);

  const siteUrl = gscSiteUrl();
  // Search Console data lags ~2 days; asking through today simply yields fewer
  // rows for the tail rather than an error.
  const range = { startDate: resolved.startDate, endDate: resolved.endDate };

  const res = await googleFetchJson<QueryResponse>({
    url: `${SEARCH_CONSOLE_API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    scope: GSC_SCOPE,
    label: "Search Console",
    method: "POST",
    body: { ...range, dimensions: [dimension], rowLimit },
    signal: params.signal,
  });

  const rows: GscRow[] = (res.rows ?? []).flatMap((row) => {
    const key = row.keys?.[0];
    if (typeof key !== "string" || key.length === 0) return [];
    return [
      {
        key,
        clicks: num(row.clicks),
        impressions: num(row.impressions),
        ctr: num(row.ctr),
        position: num(row.position),
      },
    ];
  });

  return { siteUrl, dimension, days, range, rows };
}

export type GscPairRow = {
  query: string;
  page: string;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
};

export type GscPairReport = {
  siteUrl: string;
  days: number;
  range: { startDate: string; endDate: string };
  rows: GscPairRow[];
};

/**
 * Query AND page in a single request. Cannibalisation can only be detected from
 * the pair — two separate single-dimension lists cannot be rejoined, because
 * nothing in them says which query drove which URL.
 */
export async function fetchGscQueryPagePairs(params: {
  days?: number;
  from?: string;
  to?: string;
  rowLimit?: number;
  signal?: AbortSignal;
}): Promise<GscPairReport> {
  const resolved = resolveRange({ days: params.days, from: params.from, to: params.to }, MAX_DAYS);
  const days = resolved.days;
  // Cannibalisation lives in the long tail, so this needs far more rows than a
  // top-N table does.
  const rowLimit = Math.min(Math.max(params.rowLimit ?? PAIR_ROW_LIMIT, 1), MAX_ROW_LIMIT);

  const siteUrl = gscSiteUrl();
  const range = { startDate: resolved.startDate, endDate: resolved.endDate };

  const res = await googleFetchJson<QueryResponse>({
    url: `${SEARCH_CONSOLE_API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    scope: GSC_SCOPE,
    label: "Search Console",
    method: "POST",
    body: { ...range, dimensions: ["query", "page"], rowLimit },
    signal: params.signal,
  });

  const rows: GscPairRow[] = (res.rows ?? []).flatMap((row) => {
    const query = row.keys?.[0];
    const page = row.keys?.[1];
    if (typeof query !== "string" || !query || typeof page !== "string" || !page) return [];
    return [
      {
        query,
        page,
        clicks: num(row.clicks),
        impressions: num(row.impressions),
        ctr: num(row.ctr),
        position: num(row.position),
      },
    ];
  });

  return { siteUrl, days, range, rows };
}

export async function fetchGscSites(signal?: AbortSignal): Promise<GscSite[]> {
  const res = await googleFetchJson<SitesResponse>({
    url: `${SEARCH_CONSOLE_API}/sites`,
    scope: GSC_SCOPE,
    label: "Search Console",
    signal,
  });

  return (res.siteEntry ?? []).flatMap((entry) => {
    if (typeof entry.siteUrl !== "string" || entry.siteUrl.length === 0) return [];
    return [
      {
        siteUrl: entry.siteUrl,
        permissionLevel: typeof entry.permissionLevel === "string" ? entry.permissionLevel : null,
      },
    ];
  });
}
