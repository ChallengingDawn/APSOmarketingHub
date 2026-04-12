import { SignJWT, jwtVerify } from "jose";

/**
 * Lightweight email-code auth for APSOparts Marketing Hub (Phase 1).
 * No database — uses stateless JWTs. A 6-digit code is emailed to the user;
 * a short-lived JWT cookie stores the code server-side for verification.
 * Swap to Microsoft Entra ID in Phase 2.
 */

export const ALLOWED_DOMAINS = ["angst-pfister.com", "apsoparts.com"] as const;

export const SESSION_COOKIE = "aph_session";
export const CODE_COOKIE = "aph_code_token";
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours
const CODE_TTL_SECONDS = 15 * 60; // 15 minutes

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

/** Generate a random 6-digit numeric code. */
export function createVerificationCode(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return n.toString();
}

/** Create a JWT that embeds the email + code (15-min TTL). */
export async function createCodeToken(
  email: string,
  code: string
): Promise<string> {
  return await new SignJWT({ email: email.toLowerCase(), code, typ: "code" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CODE_TTL_SECONDS}s`)
    .sign(getSecret());
}

/** Verify the code JWT and check that the user-submitted code matches. */
export async function verifyCodeToken(
  token: string,
  inputCode: string
): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.typ !== "code") return null;
    if (typeof payload.email !== "string") return null;
    if (payload.code !== inputCode) return null;
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
