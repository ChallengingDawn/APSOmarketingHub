// OAuth 1.0a for Magento integrations (RFC 5849, HMAC-SHA256). A Magento integration hands out four values - consumer
// key + secret, access token + secret. Its access token alone works as a Bearer token only when the shop allows it
// ("Allow OAuth Access Tokens to be used as standalone Bearer tokens"); ACC does not (08.11.2026: Bearer 401, the
// same read signed 200 - 191 CMS pages). Signing works whatever that setting says, so the hub signs.
//
// The signature covers the method, the address without its query, and every query parameter plus the oauth_* ones,
// sorted - a JSON body is not part of it (Magento reads the body as JSON, not as a form). Pure, so it is tested against
// a signature made independently.

import crypto from "node:crypto";

export type OAuthCreds = { consumer_key: string; consumer_secret: string; access_token: string; access_token_secret: string };

/** RFC 3986 encoding: everything but unreserved characters, as OAuth wants it (encodeURIComponent leaves !'()* alone). */
export const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export function isCreds(x: unknown): x is OAuthCreds {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return ["consumer_key", "consumer_secret", "access_token", "access_token_secret"].every((k) => typeof o[k] === "string" && (o[k] as string).length >= 8);
}

/** The Authorization header for one request. `now` (seconds) and `nonce` only for the tests. */
export function oauthHeader(method: string, url: string, c: OAuthCreds, opts: { now?: number; nonce?: string } = {}): string {
  const u = new URL(url);
  const oauth: Record<string, string> = {
    oauth_consumer_key: c.consumer_key,
    oauth_token: c.access_token,
    oauth_signature_method: "HMAC-SHA256",
    oauth_timestamp: String(opts.now ?? Math.floor(Date.now() / 1000)),
    oauth_nonce: opts.nonce ?? crypto.randomBytes(16).toString("hex"),
    oauth_version: "1.0",
  };
  const params: [string, string][] = [...u.searchParams.entries(), ...Object.entries(oauth)];
  const norm = params.map(([k, v]) => [enc(k), enc(v)] as const).sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
  const baseUrl = `${u.protocol}//${u.host}${u.pathname}`;
  const baseString = [method.toUpperCase(), enc(baseUrl), enc(norm.map(([k, v]) => `${k}=${v}`).join("&"))].join("&");
  const key = `${enc(c.consumer_secret)}&${enc(c.access_token_secret)}`;
  const signature = crypto.createHmac("sha256", key).update(baseString).digest("base64");
  return "OAuth " + Object.entries({ ...oauth, oauth_signature: signature }).map(([k, v]) => `${k}="${enc(v)}"`).join(", ");
}
