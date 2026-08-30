// Client-side access to /api/integrations/*.
//
// Every one of those routes answers HTTP 200 with one of three shapes:
//   { configured: false, missing: [...] }         — credentials absent
//   { configured: true, ok: false, error }        — upstream refused / failed
//   { configured: true, ok: true, data }          — real data
// plus HTTP 401 when the session is gone. `fetchIntegration` collapses all of
// that into one discriminated union so a page cannot forget a branch.
//
// Nothing here invents values: a metric the API did not return stays `null` and
// the UI renders it as "not reported", never as 0.

export type IntegrationResult<T> =
  | { state: "not-configured"; missing: string[]; detail: string | null }
  // `sites` rides along on Search Console failures: when a query is refused,
  // the list of properties the service account can actually see is the fastest
  // diagnosis — an empty list means it was never granted access to any.
  | { state: "error"; error: string; status: number | null; sites?: { siteUrl: string; permissionLevel: string | null }[] }
  | { state: "ok"; data: T };

/* ── GA4 (mirrors src/lib/integrations/ga4.ts) ── */

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
  daily: Ga4DailyPoint[];
  landingPages: Ga4Breakdown[];
  channels: Ga4Breakdown[];
};

/* ── HubSpot (mirrors src/lib/integrations/hubspot.ts) ── */

export type HubspotAccount = {
  portalId: number | null;
  accountType: string | null;
  timeZone: string | null;
  companyCurrency: string | null;
  uiDomain: string | null;
};

export type HubspotSummary = {
  contacts: number | null;
  companies: number | null;
  newContacts: number | null;
  days: number;
  since: string;
};

export type HubspotPayload = {
  /** Null when the token lacks the account-info scope; CRM reads still work. */
  account: HubspotAccount | null;
  accountUnavailable?: string;
  summary: HubspotSummary;
};

/* ── Search Console (mirrors src/lib/integrations/gsc.ts) ── */

export type GscRow = {
  key: string;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
};

export type GscPayload = {
  siteUrl: string;
  dimension: "query" | "page";
  days: number;
  range: { startDate: string; endDate: string };
  rows: GscRow[];
  sites?: { siteUrl: string; permissionLevel: string | null }[];
};

/* ── Readiness (mirrors src/lib/integrations/status.ts) ── */

export type IntegrationKey = "ga4" | "gsc" | "hubspot";

export type IntegrationReadiness = {
  configured: boolean;
  missing: string[];
  detail?: string;
  /** Present but unusable — deliberately distinct from missing. */
  invalid?: string;
};

export type EnvProbe = { name: string; present: boolean; length: number; shape: string; optional: boolean; fallback: string | null };
export type EnvDiagnostics = { probes: EnvProbe[]; nearMisses: string[] };

export type IntegrationStatusPayload = {
  integrations: Record<IntegrationKey, IntegrationReadiness>;
  /** Names, lengths and shapes of the expected variables — never values. */
  env: EnvDiagnostics | null;
};

/* ── fetch ── */

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function fetchIntegration<T>(
  url: string,
  signal?: AbortSignal,
): Promise<IntegrationResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return {
      state: "error",
      error: err instanceof Error ? err.message : "The request to the API route failed.",
      status: null,
    };
  }

  if (res.status === 401) {
    return {
      state: "error",
      error: "Not signed in — this session is no longer authenticated, so live data cannot be loaded.",
      status: 401,
    };
  }

  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return {
      state: "error",
      error: `The API route returned a non-JSON response (HTTP ${res.status}).`,
      status: res.status,
    };
  }

  if (typeof body !== "object" || body === null) {
    return { state: "error", error: "The API route returned an unexpected payload.", status: res.status };
  }

  const payload = body as Record<string, unknown>;

  if (payload.configured === false) {
    return {
      state: "not-configured",
      missing: stringArray(payload.missing),
      detail: optionalString(payload.detail),
    };
  }

  if (payload.ok === true && payload.data !== undefined) {
    return { state: "ok", data: payload.data as T };
  }

  const error =
    optionalString(payload.error) ??
    `The API route returned neither data nor an error (HTTP ${res.status}).`;
  const status = typeof payload.status === "number" ? payload.status : res.status;
  const sites = Array.isArray(payload.sites)
    ? payload.sites.flatMap((entry) => {
        if (typeof entry !== "object" || entry === null) return [];
        const row = entry as Record<string, unknown>;
        const siteUrl = optionalString(row.siteUrl);
        if (!siteUrl) return [];
        return [{ siteUrl, permissionLevel: optionalString(row.permissionLevel) }];
      })
    : undefined;
  return { state: "error", error, status, sites };
}

/** /api/integrations/status has its own shape: { integrations: {...} }. */
export async function fetchIntegrationStatus(
  signal?: AbortSignal,
): Promise<IntegrationResult<IntegrationStatusPayload>> {
  let res: Response;
  try {
    res = await fetch("/api/integrations/status", { cache: "no-store", signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return {
      state: "error",
      error: err instanceof Error ? err.message : "The request to /api/integrations/status failed.",
      status: null,
    };
  }

  if (res.status === 401) {
    return {
      state: "error",
      error: "Not signed in — this session is no longer authenticated.",
      status: 401,
    };
  }

  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return {
      state: "error",
      error: `/api/integrations/status returned a non-JSON response (HTTP ${res.status}).`,
      status: res.status,
    };
  }

  const integrations = (body as { integrations?: unknown } | null)?.integrations;
  if (typeof integrations !== "object" || integrations === null) {
    return {
      state: "error",
      error: "/api/integrations/status returned no readiness object.",
      status: res.status,
    };
  }

  const rawEnv = (body as { env?: unknown } | null)?.env;
  let env: EnvDiagnostics | null = null;
  if (typeof rawEnv === "object" && rawEnv !== null) {
    const e = rawEnv as Record<string, unknown>;
    const probes = Array.isArray(e.probes)
      ? e.probes.flatMap((entry) => {
          if (typeof entry !== "object" || entry === null) return [];
          const row = entry as Record<string, unknown>;
          const name = optionalString(row.name);
          if (!name) return [];
          return [
            {
              name,
              present: row.present === true,
              length: typeof row.length === "number" ? row.length : 0,
              shape: optionalString(row.shape) ?? "unknown",
              optional: row.optional === true,
              fallback: optionalString(row.fallback),
            },
          ];
        })
      : [];
    env = { probes, nearMisses: stringArray(e.nearMisses) };
  }

  return {
    state: "ok",
    data: { integrations: integrations as Record<IntegrationKey, IntegrationReadiness>, env },
  };
}

/* ── formatting ── */

const NUMBER = new Intl.NumberFormat("en-US");

/** A metric the source did not return must never be rendered as a number. */
export function formatCount(value: number | null): string {
  return value === null ? "—" : NUMBER.format(Math.round(value));
}

/** GA4 engagementRate and GSC ctr arrive as a 0–1 ratio. */
export function formatRatioAsPercent(value: number | null, digits = 1): string {
  return value === null ? "—" : `${(value * 100).toFixed(digits)}%`;
}

/** GA4 `date` dimension is already normalised to YYYY-MM-DD by the lib. */
export function formatIsoDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
