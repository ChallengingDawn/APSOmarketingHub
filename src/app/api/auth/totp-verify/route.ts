import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db/client';
import type { UserRow } from '@/lib/db/init';
import { verifyTotp } from '@/lib/auth/totp';
import {
  clearPre2faCookie,
  readPre2fa,
  setSessionCookie,
  signSession,
} from '@/lib/auth/session';
import { checkRateLimit, clientKey, recordFailure, recordSuccess } from '@/lib/auth/rateLimit';

export const runtime = 'nodejs';

const Body = z.object({ code: z.string().regex(/^\d{6}$/) });

export async function POST(req: Request) {
  const rlKey = clientKey(req, 'totp');
  const rl = checkRateLimit(rlKey);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  const pre = await readPre2fa();
  if (!pre) return NextResponse.json({ error: 'No pending login' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    recordFailure(rlKey);
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  const r = await query<UserRow>(`SELECT * FROM apsomh_users WHERE id = $1 LIMIT 1`, [pre.uid]);
  const u = r.rows[0];
  if (!u || !u.totp_secret) {
    return NextResponse.json({ error: 'No 2FA enrolled' }, { status: 400 });
  }
  if (!verifyTotp(u.totp_secret, parsed.data.code)) {
    recordFailure(rlKey);
    return NextResponse.json({ error: 'Wrong code' }, { status: 401 });
  }

  recordSuccess(rlKey);
  await query(`UPDATE apsomh_users SET last_login = NOW() WHERE id = $1`, [u.id]);
  await clearPre2faCookie();
  await setSessionCookie(
    await signSession({ uid: u.id, username: u.username, role: u.role }),
  );
  return NextResponse.json({ next: u.must_change_password ? '/change-password' : '/personality' });
}
