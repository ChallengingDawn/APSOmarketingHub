import { NextResponse } from 'next/server';
import { clearAuthCookies, readSession } from '@/lib/auth/session';
import { revokeSession } from '@/lib/auth/sessions';

export const runtime = 'nodejs';

function signinUrl(req: Request): URL {
  const host =
    req.headers.get('x-forwarded-host') ??
    req.headers.get('host') ??
    new URL(req.url).host;
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  return new URL('/signin', `${proto}://${host}`);
}

/** Drop the cookie AND close the row, or the device list keeps the ghost. */
async function end() {
  const s = await readSession().catch(() => null);
  if (s?.sid) await revokeSession(s.uid, s.sid).catch(() => {});
  await clearAuthCookies();
}

export async function GET(req: Request) {
  await end();
  return NextResponse.redirect(signinUrl(req));
}

export async function POST(req: Request) {
  await end();
  return NextResponse.redirect(signinUrl(req));
}
