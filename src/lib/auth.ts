import { SignJWT, jwtVerify } from "jose";

/**
 * Lightweight magic-link auth for APSOparts Marketing Hub (Phase 1).
 * No database, no Prisma adapter — uses stateless JWTs for both the magic link
 * token and the session cookie. Swap to Microsoft Entra ID in Phase 2.
 */

export const ALLOWED_DOMAINS = ["angst-pfister.com", "apsoparts.com"] as const;

export const SESSION_COOKIE = "aph_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours
const MAGIC_LINK_TTL_SECONDS = 15 * 60; // 15 minutes

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
 * temporary testing of email delivery from outside the corporate tenant.
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

export async function createMagicLinkToken(email: string): Promise<string> {
  return await new SignJWT({ email: email.toLowerCase(), typ: "magic" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAGIC_LINK_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyMagicLinkToken(
  token: string
): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.typ !== "magic") return null;
    if (typeof payload.email !== "string") return null;
    return { email: payload.email };
  } catch {
    return null;
  }
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
