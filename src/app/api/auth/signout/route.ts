import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth/session';

export const runtime = 'nodejs';

function signinUrl(req: Request): URL {
  const host =
    req.headers.get('x-forwarded-host') ??
    req.headers.get('host') ??
    new URL(req.url).host;
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  return new URL('/signin', `${proto}://${host}`);
}

export async function GET(req: Request) {
  await clearAuthCookies();
  return NextResponse.redirect(signinUrl(req));
}

export async function POST(req: Request) {
  await clearAuthCookies();
  return NextResponse.redirect(signinUrl(req));
}
