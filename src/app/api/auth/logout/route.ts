import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST() {
  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
