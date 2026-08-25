// Service-account OAuth for the Google APIs, without pulling in googleapis:
// a self-signed RS256 JWT exchanged for an access token at the token endpoint.
// The private key is never logged and never leaves this module.

import { createSign } from "node:crypto";
import { IntegrationError, parseServiceAccount } from "./status";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const JWT_BEARER_GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const ASSERTION_TTL_SECONDS = 3600;
// Retire cached tokens a minute early so a request never travels with a token
// that expires mid-flight.
const EXPIRY_SKEW_MS = 60_000;

type CachedToken = { token: string; expiresAt: number };

const tokenCache = new Map<string, CachedToken>();

function base64url(input: Buffer | string): string {
  return (typeof input === "string" ? Buffer.from(input, "utf8") : input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function googleConfigured(): boolean {
  return parseServiceAccount() !== null;
}

function signAssertion(scope: string): string {
  const sa = parseServiceAccount();
  if (!sa) {
    throw new IntegrationError(
      "GOOGLE_SERVICE_ACCOUNT is missing or is not valid service-account JSON.",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.clientEmail,
      scope,
      aud: TOKEN_ENDPOINT,
      exp: now + ASSERTION_TTL_SECONDS,
      iat: now,
    }),
  );

  try {
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    signer.end();
    return `${header}.${claims}.${base64url(signer.sign(sa.privateKey))}`;
  } catch {
    // Deliberately generic: the underlying error can echo key material.
    throw new IntegrationError(
      "The service-account private key could not be used to sign (check the PEM formatting of GOOGLE_SERVICE_ACCOUNT).",
    );
  }
}

function extractGoogleError(payload: string): string | null {
  try {
    const parsed = JSON.parse(payload) as {
      error?: unknown;
      error_description?: unknown;
    };
    if (typeof parsed.error_description === "string") return parsed.error_description;
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error && typeof parsed.error === "object") {
      const message = (parsed.error as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
  } catch {
    /* non-JSON body — fall through to the HTTP status text */
  }
  const trimmed = payload.trim();
  return trimmed ? trimmed.slice(0, 400) : null;
}

async function requestAccessToken(scope: string, signal?: AbortSignal): Promise<CachedToken> {
  const assertion = signAssertion(scope);
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: JWT_BEARER_GRANT, assertion }).toString(),
    signal,
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new IntegrationError(
      `Google token exchange failed: ${extractGoogleError(text) ?? res.statusText}`,
      res.status,
    );
  }

  let parsed: { access_token?: unknown; expires_in?: unknown };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new IntegrationError("Google token endpoint returned a non-JSON response.", res.status);
  }

  if (typeof parsed.access_token !== "string" || !parsed.access_token) {
    throw new IntegrationError("Google token endpoint returned no access_token.", res.status);
  }

  const ttl = typeof parsed.expires_in === "number" ? parsed.expires_in : ASSERTION_TTL_SECONDS;
  return { token: parsed.access_token, expiresAt: Date.now() + ttl * 1000 - EXPIRY_SKEW_MS };
}

export async function getGoogleAccessToken(scope: string, signal?: AbortSignal): Promise<string> {
  const cached = tokenCache.get(scope);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const fresh = await requestAccessToken(scope, signal);
  tokenCache.set(scope, fresh);
  return fresh.token;
}

export type GoogleRequest = {
  url: string;
  scope: string;
  /** Prefix for error messages, e.g. "GA4" or "Search Console". */
  label: string;
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
};

export async function googleFetchJson<T>(req: GoogleRequest): Promise<T> {
  const token = await getGoogleAccessToken(req.scope, req.signal);

  const res = await fetch(req.url, {
    method: req.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(req.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: req.body === undefined ? undefined : JSON.stringify(req.body),
    signal: req.signal,
    cache: "no-store",
  });

  const text = await res.text();

  if (!res.ok) {
    // A rejected token is never worth reusing.
    if (res.status === 401) tokenCache.delete(req.scope);
    throw new IntegrationError(
      `${req.label}: ${extractGoogleError(text) ?? res.statusText}`,
      res.status,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new IntegrationError(`${req.label}: upstream returned a non-JSON response.`, res.status);
  }
}
