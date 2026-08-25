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
  /** Set when the variable arrived but cannot be used — never the same as missing. */
  invalid?: string;
};

export type IntegrationStatus = Record<IntegrationKey, IntegrationReadiness>;

/**
 * What the running container actually sees for each expected variable. Names,
 * lengths and shapes only — never a value. This exists because "not set" and
 * "set but unusable" look identical from the outside, and because the usual
 * deployment mistake is an environment key that still carries the secret's
 * `apso-dev/` name prefix, which this surfaces as a near-miss key.
 */
export type EnvProbe = {
  name: string;
  present: boolean;
  length: number;
  shape: string;
};

export type EnvDiagnostics = {
  probes: EnvProbe[];
  /** Keys that CONTAIN an expected name but are not exactly it. */
  nearMisses: string[];
};

const EXPECTED_ENV = [
  "GOOGLE_SERVICE_ACCOUNT",
  "GA4_PROPERTY_ID",
  "GSC_SITE_URL",
  "HUBSPOT_TOKEN",
] as const;

function shapeOf(name: string, value: string): string {
  const trimmed = value.trim();
  if (name === "GOOGLE_SERVICE_ACCOUNT") {
    if (trimmed.startsWith("{")) {
      return /"private_key"/.test(trimmed) && /"client_email"/.test(trimmed)
        ? "JSON with client_email and private_key"
        : "JSON, but missing client_email and/or private_key — is this the Secrets Manager key/value wrapper rather than the service-account file?";
    }
    return /^[A-Za-z0-9+/=\s]+$/.test(trimmed) ? "base64 (will be decoded)" : "not JSON and not base64";
  }
  if (name === "HUBSPOT_TOKEN") {
    return trimmed.startsWith("pat-") ? "private-app token (pat-…)" : "does not look like a HubSpot private-app token";
  }
  return "set";
}

export function envDiagnostics(): EnvDiagnostics {
  const probes: EnvProbe[] = EXPECTED_ENV.map((name) => {
    const value = process.env[name];
    return {
      name,
      present: typeof value === "string" && value.length > 0,
      length: typeof value === "string" ? value.length : 0,
      shape: typeof value === "string" && value.length > 0 ? shapeOf(name, value) : "absent",
    };
  });

  const nearMisses = Object.keys(process.env).filter(
    (key) => !EXPECTED_ENV.includes(key as (typeof EXPECTED_ENV)[number]) && EXPECTED_ENV.some((name) => key.includes(name)),
  );

  return { probes, nearMisses };
}

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

function googleReadiness(): { missing: string[]; detail?: string; invalid?: string } {
  const raw = env("GOOGLE_SERVICE_ACCOUNT");
  if (!raw) return { missing: ["GOOGLE_SERVICE_ACCOUNT"] };
  const sa = parseServiceAccount();
  if (!sa) {
    // Deliberately NOT reported as missing: the variable arrived, so telling the
    // user it "is not set" would send them to the wrong place entirely.
    return {
      missing: [],
      invalid: "GOOGLE_SERVICE_ACCOUNT arrived but is not valid service-account JSON (it needs client_email and private_key). If you stored the secret as a key/value pair, ECS is passing the JSON wrapper instead of the file contents — store it as plaintext, or point valueFrom at the specific key.",
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
    invalid: google.invalid,
    detail: googleOk
      ? `Property ${ga4PropertyId()} · ${google.detail}`
      : google.detail,
  };

  const gsc: IntegrationReadiness = {
    configured: googleOk,
    missing: google.missing,
    invalid: google.invalid,
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
