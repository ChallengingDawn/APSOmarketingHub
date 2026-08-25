// Configuration + readiness for the external integrations (GA4, Search Console,
// HubSpot). Everything here is a pure `process.env` read: no network calls, so
// it is safe to evaluate during a server render or inside a status endpoint.

export const GA4_DEFAULT_PROPERTY_ID = "307036030";
export const GSC_DEFAULT_SITE_URL = "sc-domain:apsoparts.com";

export type IntegrationKey = "ga4" | "gsc" | "hubspot";

export type IntegrationReadiness = {
  configured: boolean;
  missing: string[];
  detail?: string;
};

export type IntegrationStatus = Record<IntegrationKey, IntegrationReadiness>;

export type GoogleServiceAccount = {
  clientEmail: string;
  privateKey: string;
};

/** Upstream failure carrying the HTTP status the provider replied with. */
export class IntegrationError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "IntegrationError";
    this.status = status;
  }
}

/** Turns any thrown value into the { error, status } pair the API routes return. */
export function describeIntegrationError(err: unknown): { error: string; status: number | null } {
  if (err instanceof IntegrationError) return { error: err.message, status: err.status };
  if (err instanceof Error) {
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      return { error: "Upstream request timed out.", status: null };
    }
    return { error: err.message, status: null };
  }
  return { error: "Unknown upstream failure.", status: null };
}

function env(name: string): string | null {
  const value = process.env[name];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Reads GOOGLE_SERVICE_ACCOUNT. The value is the raw service-account JSON, or
 * the same JSON base64-encoded (deployment targets that cannot hold multi-line
 * secrets) — detected by the absence of a leading "{".
 */
export function parseServiceAccount(): GoogleServiceAccount | null {
  const raw = env("GOOGLE_SERVICE_ACCOUNT");
  if (!raw) return null;

  let json = raw;
  if (!json.startsWith("{")) {
    try {
      json = Buffer.from(raw, "base64").toString("utf8");
    } catch {
      return null;
    }
  }

  try {
    const parsed = JSON.parse(json) as { client_email?: unknown; private_key?: unknown };
    if (typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") return null;
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      clientEmail: parsed.client_email,
      // PEM newlines survive most env plumbing as literal "\n".
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

export function ga4PropertyId(): string {
  return env("GA4_PROPERTY_ID") ?? GA4_DEFAULT_PROPERTY_ID;
}

/**
 * Search Console addresses a property either as "sc-domain:example.com" or as
 * the exact url-prefix — which must keep its trailing slash to match.
 */
export function normalizeSiteUrl(raw: string): string {
  const value = raw.trim();
  if (value.startsWith("sc-domain:")) return value;
  return value.endsWith("/") ? value : `${value}/`;
}

export function gscSiteUrl(): string {
  return normalizeSiteUrl(env("GSC_SITE_URL") ?? GSC_DEFAULT_SITE_URL);
}

export function hubspotToken(): string | null {
  return env("HUBSPOT_TOKEN");
}

function googleReadiness(): { missing: string[]; detail?: string } {
  const raw = env("GOOGLE_SERVICE_ACCOUNT");
  if (!raw) return { missing: ["GOOGLE_SERVICE_ACCOUNT"] };
  const sa = parseServiceAccount();
  if (!sa) {
    return {
      missing: ["GOOGLE_SERVICE_ACCOUNT"],
      detail: "GOOGLE_SERVICE_ACCOUNT is set but is not valid service-account JSON (needs client_email and private_key).",
    };
  }
  return { missing: [], detail: sa.clientEmail };
}

export function integrationStatus(): IntegrationStatus {
  const google = googleReadiness();
  const googleOk = google.missing.length === 0;

  const ga4: IntegrationReadiness = {
    configured: googleOk,
    missing: google.missing,
    detail: googleOk
      ? `Property ${ga4PropertyId()} · ${google.detail}`
      : google.detail,
  };

  const gsc: IntegrationReadiness = {
    configured: googleOk,
    missing: google.missing,
    detail: googleOk ? `${gscSiteUrl()} · ${google.detail}` : google.detail,
  };

  const token = hubspotToken();
  const hubspot: IntegrationReadiness = {
    configured: token !== null,
    missing: token ? [] : ["HUBSPOT_TOKEN"],
    detail: token ? "Private-app token present" : undefined,
  };

  return { ga4, gsc, hubspot };
}
