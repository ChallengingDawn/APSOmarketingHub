import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureSchema, type UserRow } from '@/lib/db/init';
import { query } from '@/lib/db/client';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { verifyTotp } from '@/lib/auth/totp';
import { checkRateLimit, clientKey, recordFailure, recordSuccess } from '@/lib/auth/rateLimit';

export const runtime = 'nodejs';

const Body = z.object({
  identifier: z.string().trim().min(1).max(255),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().min(1),
});

// Self-service password reset for someone who still has their authenticator:
// the TOTP code is the proof of identity, the same second factor the normal
// login trusts. Unknown user and wrong code answer identically so the form
// cannot be used to enumerate accounts; accounts without an enrolled
// authenticator must go through an admin (or the break-glass route).
export async function POST(req: Request) {
  const rlKey = clientKey(req, 'reset');
  const rl = checkRateLimit(rlKey);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      recordFailure(rlKey);
      return NextResponse.json({ error: 'Enter your e-mail, the 6-digit code and a new password.' }, { status: 400 });
    }
    const reason = validatePasswordStrength(parsed.data.password);
    if (reason) return NextResponse.json({ error: reason }, { status: 400 });

    await ensureSchema();
    const id = parsed.data.identifier.toLowerCase();
    const r = await query<UserRow>(
      `SELECT * FROM apsomh_users WHERE username = $1 OR email = $1 LIMIT 1`,
      [id],
    );
    const u = r.rows[0];
    if (!u || !u.is_active) {
      recordFailure(rlKey);
      return NextResponse.json({ error: 'Wrong code or unknown account.' }, { status: 401 });
    }
    if (!u.totp_secret || !u.totp_enrolled) {
      recordFailure(rlKey);
      return NextResponse.json(
        { error: 'This account has no authenticator enrolled — ask an admin to reset your password.' },
        { status: 400 },
      );
    }
    if (!verifyTotp(u.totp_secret, parsed.data.code)) {
      recordFailure(rlKey);
      return NextResponse.json({ error: 'Wrong code or unknown account.' }, { status: 401 });
    }

    await query(
      `UPDATE apsomh_users
         SET password_hash = $2, must_change_password = FALSE, updated_at = NOW()
       WHERE id = $1`,
      [u.id, await hashPassword(parsed.data.password)],
    );
    recordSuccess(rlKey);
    return NextResponse.json({ ok: true, next: '/signin' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[reset-totp] error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
