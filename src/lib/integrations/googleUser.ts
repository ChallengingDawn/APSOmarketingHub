// SIGNING IN WITH A PERSON'S GOOGLE ACCOUNT, WHEN THE SERVICE ACCOUNT CANNOT GET IN.
//
// The hub normally reads Google as itself, with a service account. That is the
// right way round: it belongs to nobody, survives people leaving, and an admin
// grants it once. Search Console is the exception at APSOparts — the domain
// property is owned by whoever verified the DNS, and until they add the service
// account the hub gets a flat 403.
//
// So this is a deliberate stopgap: one person connects their own Google account
// and the hub borrows their access. It is worth being honest about what that
// means, and the Integrations page says all of it out loud:
//
//   · The data everyone sees is read with ONE person's permissions. If theirs
//     change, so does everyone's view.
//   · Changing that person's Google password revokes the token. The SEO pages
//     stop, for everybody, until somebody reconnects.
//   · Google expires the refresh token after seven days while the OAuth app is
//     in "Testing". Published, it lasts — but publishing is Google's review.
//
// None of that applies to the service account, which is why the banner keeps
// pointing at the proper fix rather than letting this settle in as normal.

import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const KV_KEY = "google:user-token";

/**
 * Carries the OAuth state between the redirect out and the way back, so a link
 * somebody was sent cannot complete a connection in their session. It lives
 * here rather than in the route because a route file may only export the
 * handlers Next recognises.
 */
export const STATE_COOKIE = "apsomh_google_oauth_state";
const EXPIRY_SKEW_MS = 60_000;

export type UserConnection = {
  /** Whose account the hub is borrowing. Shown wherever the data is. */
  email: string;
  scopes: string[];
  connectedBy: string;
  connectedAt: string;
};

type Stored = UserConnection & { refreshToken: string };

export function oauthConfigured(): boolean {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

/**
 * Where Google sends the person back.
 *
 * Derived from the request rather than configured, so dev and any future host
 * work without a second variable to keep in step — but it must match a redirect
 * URI registered on the OAuth client EXACTLY, or Google refuses with
 * redirect_uri_mismatch before the person sees a consent screen.
 */
export function redirectUri(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/api/integrations/google/callback`;
}

export function consentUrl(origin: string, scope: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope,
    // Without both of these Google returns an access token and no refresh
    // token, and the connection dies in an hour with no way to renew it.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

async function readStored(): Promise<Stored | null> {
  await ensureSchema();
  const r = await query<{ v: Stored }>(
    `SELECT v FROM apsomh_kv WHERE k = $1 LIMIT 1`,
    [KV_KEY],
  );
  return r.rows[0]?.v ?? null;
}

/** What the Integrations page may show. Never the token itself. */
export async function userConnection(): Promise<UserConnection | null> {
  const s = await readStored();
  if (!s) return null;
  const { refreshToken: _r, ...safe } = s;
  void _r;
  return safe;
}

export async function disconnectUser(): Promise<void> {
  await ensureSchema();
  await query(`DELETE FROM apsomh_kv WHERE k = $1`, [KV_KEY]);
  cached = null;
}

/** Exchange the one-time code for a refresh token, and record whose it is. */
export async function completeConnection(
  code: string,
  origin: string,
  connectedBy: string,
): Promise<UserConnection> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }).toString(),
  });
  const body = (await res.json().catch(() => ({}))) as {
    refresh_token?: string; access_token?: string; scope?: string;
    error?: string; error_description?: string;
  };
  if (!res.ok || !body.refresh_token) {
    throw new Error(
      body.error_description ??
        body.error ??
        (res.ok
          ? "Google returned no refresh token. That happens when the account has already granted access — revoke the hub at myaccount.google.com/permissions and connect again."
          : `Google refused the exchange (HTTP ${res.status}).`),
    );
  }

  // Whose account this is, asked of Google rather than assumed from the hub's
  // own user — they may well sign in with a different Google identity.
  let email = "unknown";
  try {
    const who = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${body.access_token}` },
    });
    const info = (await who.json()) as { email?: string };
    if (info.email) email = info.email;
  } catch { /* the connection still works; only the label is missing */ }

  const stored: Stored = {
    refreshToken: body.refresh_token,
    email,
    scopes: (body.scope ?? "").split(" ").filter(Boolean),
    connectedBy,
    connectedAt: new Date().toISOString(),
  };
  await ensureSchema();
  await query(
    `INSERT INTO apsomh_kv (k, v, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = NOW()`,
    [KV_KEY, JSON.stringify(stored)],
  );
  cached = null;
  const { refreshToken: _r, ...safe } = stored;
  void _r;
  return safe;
}

let cached: { token: string; expiresAt: number } | null = null;

/**
 * An access token for the connected person, or null when nobody is connected.
 *
 * Null is a normal answer: the caller falls back to the service account. A
 * FAILED refresh is not null — it throws, because "the person's token was
 * revoked" and "nobody ever connected" need different words on the screen.
 */
export async function userAccessToken(scope: string): Promise<string | null> {
  if (!oauthConfigured()) return null;
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const stored = await readStored();
  if (!stored) return null;
  if (stored.scopes.length > 0 && !stored.scopes.includes(scope)) return null;

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: stored.refreshToken,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }).toString(),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string; expires_in?: number; error?: string; error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(
      `The Google account connected by ${stored.connectedBy} (${stored.email}) can no longer be used: ` +
        `${body.error_description ?? body.error ?? `HTTP ${res.status}`}. ` +
        `Somebody has to reconnect it on Settings → Integrations — or better, have the service account added ` +
        `to the Search Console property so the hub stops depending on one person's login.`,
    );
  }
  cached = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 - EXPIRY_SKEW_MS,
  };
  return cached.token;
}
