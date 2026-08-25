"use client";

/**
 * Client-side contract for /api/integrations/gsc.
 *
 * The route always answers HTTP 200 with one of three shapes:
 *   { configured: false, missing: string[], detail?: string }
 *   { configured: true, ok: false, error: string, status: number | null }
 *   { configured: true, ok: true, data: <report> }
 *
 * Two report shapes exist, selected by the query string:
 *   ?dimension=query|page  → GscReport      (one key per row)
 *   ?pairs=1               → GscPairReport  (query AND page on the same row)
 *
 * Everything in this file mirrors the real exports of src/lib/integrations/gsc.ts.
 * Nothing here invents a row: if the API returns nothing, the caller renders an
 * explicit empty state.
 */

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

/**
 * One row per query+page combination — the shape `?pairs=1` returns. This is the
 * only shape from which cannibalisation can be measured: two single-dimension
 * lists cannot be rejoined, because nothing in them records which query drove
 * which URL.
 */
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

export type GscApiResponse =
  | { configured: false; missing: string[]; detail?: string }
  | { configured: true; ok: false; error: string; status: number | null }
  | { configured: true; ok: true; data: GscReport };

export type GscPairApiResponse =
  | { configured: false; missing: string[]; detail?: string }
  | { configured: true; ok: false; error: string; status: number | null }
  | { configured: true; ok: true; data: GscPairReport };

/**
 * Single-dimension calls are capped by DEFAULT_ROW_LIMIT in gsc.ts. Surfaced so
 * captions can state the real scope instead of implying site-wide totals.
 */
export const GSC_ROW_LIMIT = 250;

/**
 * Pair calls are capped by PAIR_ROW_LIMIT in gsc.ts. Pairs fan out one row per
 * query×page combination, so the tail needs more headroom than a top-N table.
 */
export const GSC_PAIR_ROW_LIMIT = 500;

/**
 * Whether /api/integrations/gsc can return query AND page on the same row
 * (`?pairs=1`). Cannibalisation is measurable only while this holds — it was
 * false before the route gained pair mode, so the tab checks it rather than
 * assuming. Typed as `boolean` on purpose: it describes a route capability, not
 * a compile-time fact.
 */
export const GSC_SUPPORTS_DIMENSION_PAIR: boolean = true;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function parseRange(value: unknown): { startDate: string; endDate: string } {
  const range = isRecord(value) ? value : {};
  return {
    startDate: typeof range.startDate === "string" ? range.startDate : "",
    endDate: typeof range.endDate === "string" ? range.endDate : "",
  };
}

function parseRows(value: unknown): GscRow[] {
  if (!Array.isArray(value)) return [];
  const out: GscRow[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const key = raw.key;
    if (typeof key !== "string" || key.length === 0) continue;
    out.push({
      key,
      clicks: numOrNull(raw.clicks),
      impressions: numOrNull(raw.impressions),
      ctr: numOrNull(raw.ctr),
      position: numOrNull(raw.position),
    });
  }
  return out;
}

function parsePairRows(value: unknown): GscPairRow[] {
  if (!Array.isArray(value)) return [];
  const out: GscPairRow[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const query = raw.query;
    const page = raw.page;
    // A pair row without both keys is not a pair — dropped rather than half-read.
    if (typeof query !== "string" || query.length === 0) continue;
    if (typeof page !== "string" || page.length === 0) continue;
    out.push({
      query,
      page,
      clicks: numOrNull(raw.clicks),
      impressions: numOrNull(raw.impressions),
      ctr: numOrNull(raw.ctr),
      position: numOrNull(raw.position),
    });
  }
  return out;
}

/** The `configured: false` envelope, identical for every mode of the route. */
function parseNotConfigured(payload: Record<string, unknown>): { configured: false; missing: string[]; detail?: string } {
  const missing = Array.isArray(payload.missing)
    ? payload.missing.filter((m): m is string => typeof m === "string")
    : [];
  return {
    configured: false,
    missing,
    detail: typeof payload.detail === "string" ? payload.detail : undefined,
  };
}

/** The `ok: false` envelope, identical for every mode of the route. */
function parseFailure(payload: Record<string, unknown>): { configured: true; ok: false; error: string; status: number | null } {
  return {
    configured: true,
    ok: false,
    error: typeof payload.error === "string" ? payload.error : "Search Console returned an error.",
    status: numOrNull(payload.status),
  };
}

function parseResponse(payload: unknown): GscApiResponse {
  if (!isRecord(payload)) {
    return { configured: true, ok: false, error: "Malformed response from /api/integrations/gsc.", status: null };
  }

  if (payload.configured === false) return parseNotConfigured(payload);

  if (payload.ok === true && isRecord(payload.data)) {
    const d = payload.data;
    const dimension: GscDimension = d.dimension === "page" ? "page" : "query";
    return {
      configured: true,
      ok: true,
      data: {
        siteUrl: typeof d.siteUrl === "string" ? d.siteUrl : "",
        dimension,
        days: numOrNull(d.days) ?? 0,
        range: parseRange(d.range),
        rows: parseRows(d.rows),
      },
    };
  }

  return parseFailure(payload);
}

function parsePairResponse(payload: unknown): GscPairApiResponse {
  if (!isRecord(payload)) {
    return { configured: true, ok: false, error: "Malformed response from /api/integrations/gsc.", status: null };
  }

  if (payload.configured === false) return parseNotConfigured(payload);

  if (payload.ok === true && isRecord(payload.data)) {
    const d = payload.data;
    return {
      configured: true,
      ok: true,
      data: {
        siteUrl: typeof d.siteUrl === "string" ? d.siteUrl : "",
        days: numOrNull(d.days) ?? 0,
        range: parseRange(d.range),
        rows: parsePairRows(d.rows),
      },
    };
  }

  return parseFailure(payload);
}

type RawResult =
  | { kind: "payload"; payload: unknown }
  | { kind: "failure"; error: string; status: number | null };

/**
 * Shared transport for every mode of the route. Network, auth and non-JSON
 * failures become the `ok: false` envelope; only AbortError is rethrown, so a
 * cancelled window switch never lands in state.
 */
async function requestGsc(url: string, signal?: AbortSignal): Promise<RawResult> {
  let res: Response;
  try {
    res = await fetch(url, { signal, cache: "no-store" });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return {
      kind: "failure",
      error: err instanceof Error ? err.message : "Network request failed.",
      status: null,
    };
  }

  if (res.status === 401) {
    return { kind: "failure", error: "Your session expired — sign in again to read Search Console.", status: 401 };
  }

  try {
    return { kind: "payload", payload: await res.json() };
  } catch {
    return { kind: "failure", error: `Search Console endpoint replied ${res.status} with a non-JSON body.`, status: res.status };
  }
}

export async function fetchGsc(
  params: { dimension: GscDimension; days: number },
  signal?: AbortSignal,
): Promise<GscApiResponse> {
  const raw = await requestGsc(`/api/integrations/gsc?dimension=${params.dimension}&days=${params.days}`, signal);
  if (raw.kind === "failure") {
    return { configured: true, ok: false, error: raw.error, status: raw.status };
  }
  return parseResponse(raw.payload);
}

/** Query+page pairs for one window — at most GSC_PAIR_ROW_LIMIT rows. */
export async function fetchGscPairs(params: { days: number }, signal?: AbortSignal): Promise<GscPairApiResponse> {
  const raw = await requestGsc(`/api/integrations/gsc?pairs=1&days=${params.days}`, signal);
  if (raw.kind === "failure") {
    return { configured: true, ok: false, error: raw.error, status: raw.status };
  }
  return parsePairResponse(raw.payload);
}
