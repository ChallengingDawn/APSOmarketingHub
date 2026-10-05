import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db/client';
import type { UserRow } from '@/lib/db/init';
import { verifyTotp } from '@/lib/auth/totp';
import { clearPre2faCookie, readPre2fa } from '@/lib/auth/session';
import { beginSession } from '@/lib/auth/sessions';
import { consumeRecoveryCode, looksLikeRecoveryCode } from '@/lib/auth/recoveryCodes';
import { checkRateLimit, clientKey, recordFailure, recordSuccess } from '@/lib/auth/rateLimit';

export const runtime = 'nodejs';

// Six digits from the app, or one of the ten codes issued when they enrolled.
// Both arrive in the same box, because somebody holding a sheet of paper should
// not have to find a different page first.
const Body = z.object({ code: z.string().trim().min(6).max(40) });

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

  const typed = parsed.data.code;
  const ok = looksLikeRecoveryCode(typed)
    ? await consumeRecoveryCode(u.id, typed)
    : /^\d{6}$/.test(typed) && verifyTotp(u.totp_secret, typed);
  if (!ok) {
    recordFailure(rlKey);
    return NextResponse.json({ error: 'Wrong code' }, { status: 401 });
  }

  recordSuccess(rlKey);
  await query(`UPDATE apsomh_users SET last_login = NOW() WHERE id = $1`, [u.id]);
  await clearPre2faCookie();
  await beginSession(u, req);
  // The front door, not the brain. Landing on Personality is a leftover from
  // when this was the marketing app; now it is one app of five, and most people
  // signing in cannot even open it.
  return NextResponse.json({ next: u.must_change_password ? '/change-password' : '/' });
}
