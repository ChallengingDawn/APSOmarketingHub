import { SignJWT, jwtVerify } from "jose";

/**
 * Lightweight password-based auth for APSOparts Marketing Hub (Phase 1).
 * No database — uses a shared master password + email domain allow-list.
 * Sessions are stateless JWTs stored in an HTTP-only cookie.
 * Swap to Microsoft Entra ID SSO in Phase 2.
 */

export const ALLOWED_DOMAINS = ["angst-pfister.com", "apsoparts.com"] as const;

export const SESSION_COOKIE = "aph_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET environment variable must be set and at least 32 characters long"
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Returns the list of allow-listed domains, extended with any domains configured
 * via the AUTH_EXTRA_ALLOWED_DOMAINS env var (comma-separated). Intended for
 * temporary testing from outside the corporate tenant.
 * Example: AUTH_EXTRA_ALLOWED_DOMAINS=gmail.com,proton.me
 */
function getAllowedDomains(): string[] {
  const base: string[] = [...ALLOWED_DOMAINS];
  const extra = (process.env.AUTH_EXTRA_ALLOWED_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return [...base, ...extra];
}

export function isEmailAllowed(raw: string): boolean {
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  return getAllowedDomains().some((d) => email.endsWith(`@${d}`));
}

/**
 * Verify the master password against AUTH_MASTER_PASSWORD env var.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyPassword(input: string): boolean {
  const master = process.env.AUTH_MASTER_PASSWORD;
  if (!master || !input) return false;

  // Constant-time comparison
  if (master.length !== input.length) return false;
  let mismatch = 0;
  for (let i = 0; i < master.length; i++) {
    mismatch |= master.charCodeAt(i) ^ input.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function createSessionToken(email: string): Promise<string> {
  return await new SignJWT({ email: email.toLowerCase(), typ: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string
): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.typ !== "session") return null;
    if (typeof payload.email !== "string") return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}
