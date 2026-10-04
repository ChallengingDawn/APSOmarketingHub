import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureSchema, type UserRow } from '@/lib/db/init';
import { query } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';
import { setPre2faCookie, setSessionCookie, signPre2fa, signSession } from '@/lib/auth/session';
import { checkRateLimit, clientKey, recordFailure, recordSuccess } from '@/lib/auth/rateLimit';
import { mfaRequired, type Role } from '@/lib/auth/access';

export const runtime = 'nodejs';

const Body = z.object({
  identifier: z.string().trim().min(1).max(255).optional(),
  email: z.string().trim().min(1).max(255).optional(),
  username: z.string().trim().min(1).max(255).optional(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const rlKey = clientKey(req, 'login');
  const rl = checkRateLimit(rlKey);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }
  try {
    await ensureSchema();
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      recordFailure(rlKey);
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const id = (parsed.data.identifier ?? parsed.data.email ?? parsed.data.username ?? '')
      .toLowerCase();
    if (!id) {
      recordFailure(rlKey);
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const r = await query<UserRow>(
      `SELECT * FROM apsomh_users WHERE username = $1 OR email = $1 LIMIT 1`,
      [id],
    );
    const u = r.rows[0];
    if (!u || !u.is_active) {
      recordFailure(rlKey);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const ok = await verifyPassword(parsed.data.password, u.password_hash);
    if (!ok) {
      recordFailure(rlKey);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    recordSuccess(rlKey);

    // A role that does not have to carry a second factor is not sent to set one
    // up. Being marched to a QR code before you may read a page is the thing
    // that makes people stop coming back, and a viewer only reads. They can
    // still turn it on themselves from Settings -> Security.
    if (!u.totp_enrolled && !mfaRequired(u.role as Role)) {
      await query(`UPDATE apsomh_users SET last_login = NOW() WHERE id = $1`, [u.id]);
      await setSessionCookie(await signSession({ uid: u.id, username: u.username, role: u.role }));
      return NextResponse.json({ next: u.must_change_password ? '/change-password' : '/' });
    }

    await setPre2faCookie(await signPre2fa(u.id));
    return NextResponse.json({ next: u.totp_enrolled ? '/login/totp' : '/enroll' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[login] error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
