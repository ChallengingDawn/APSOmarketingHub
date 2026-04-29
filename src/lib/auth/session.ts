import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

const SESSION_COOKIE = 'apsomarketinghub_session';
const PRE_2FA_COOKIE = 'apsomarketinghub_pre2fa';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const PRE_2FA_TTL_SECONDS = 5 * 60;

export interface SessionPayload {
  uid: number;
  username: string;
  role: 'admin' | 'user' | 'viewer';
}

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET (or AUTH_SECRET) must be set and ≥ 32 chars.');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ ...p, typ: 'session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.typ !== 'session') return null;
    if (typeof payload.uid !== 'number') return null;
    return {
      uid: payload.uid,
      username: payload.username as string,
      role: (payload.role as SessionPayload['role']) ?? 'user',
    };
  } catch {
    return null;
  }
}

export async function signPre2fa(uid: number): Promise<string> {
  return new SignJWT({ uid, typ: 'pre2fa' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${PRE_2FA_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function readPre2fa(): Promise<{ uid: number } | null> {
  const c = (await cookies()).get(PRE_2FA_COOKIE)?.value;
  if (!c) return null;
  try {
    const { payload } = await jwtVerify(c, getSecret());
    if (payload.typ !== 'pre2fa') return null;
    return { uid: payload.uid as number };
  } catch {
    return null;
  }
}

export async function readSession(): Promise<SessionPayload | null> {
  const c = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!c) return null;
  return verifySession(c);
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
  });
}

export async function setPre2faCookie(token: string) {
  (await cookies()).set(PRE_2FA_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: PRE_2FA_TTL_SECONDS,
    path: '/',
  });
}

export async function clearAuthCookies() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
  c.delete(PRE_2FA_COOKIE);
}

export async function clearPre2faCookie() {
  (await cookies()).delete(PRE_2FA_COOKIE);
}

export { SESSION_COOKIE, PRE_2FA_COOKIE };
