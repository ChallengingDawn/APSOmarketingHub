import { NextResponse } from 'next/server';
import { getOptionalUser } from '@/lib/auth/guard';

export const runtime = 'nodejs';

export async function GET() {
  const u = await getOptionalUser();
  if (!u) return NextResponse.json({ user: null }, { status: 401 });
  const { password_hash: _ph, totp_secret: _ts, ...safe } = u;
  void _ph; void _ts;
  return NextResponse.json({ user: safe });
}
