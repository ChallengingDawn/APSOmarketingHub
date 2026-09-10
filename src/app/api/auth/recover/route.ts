import { NextResponse } from 'next/server';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { ensureSchema } from '@/lib/db/init';
import { query } from '@/lib/db/client';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { checkRateLimit, clientKey, recordFailure } from '@/lib/auth/rateLimit';

export const runtime = 'nodejs';

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

const Body = z.object({
  username: z.string().trim().min(1).max(255),
  password: z.string().min(1),
  resetTotp: z.boolean().optional(),
});

// Break-glass password reset for an operator locked out of every admin
// account. Mirrors the SETUP_TOKEN pattern: the endpoint does not exist
// unless AUTH_RESET_TOKEN is set on the service, and the caller must present
// that exact token. Set the variable, call once, remove the variable. The
// reset forces a password change on next login, and can also clear TOTP
// when the authenticator was lost too.
export async function POST(req: Request) {
  const required = process.env.AUTH_RESET_TOKEN;
  if (!required || required.length < 24) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const rlKey = clientKey(req, 'recover');
  const rl = checkRateLimit(rlKey);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }
  const presented = req.headers.get('x-reset-token') ?? '';
  if (!constantTimeEqual(presented, required)) {
    recordFailure(rlKey);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const reason = validatePasswordStrength(parsed.data.password);
    if (reason) return NextResponse.json({ error: reason }, { status: 400 });

    await ensureSchema();
    const id = parsed.data.username.toLowerCase();
    const sets = ['password_hash = $2', 'must_change_password = TRUE', 'is_active = TRUE', 'updated_at = NOW()'];
    if (parsed.data.resetTotp) sets.push('totp_secret = NULL', 'totp_enrolled = FALSE');
    const r = await query<{ id: number; username: string }>(
      `UPDATE apsomh_users SET ${sets.join(', ')}
       WHERE username = $1 OR email = $1
       RETURNING id, username`,
      [id, await hashPassword(parsed.data.password)],
    );
    if (r.rows.length === 0) {
      return NextResponse.json({ error: 'No such user' }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      user: r.rows[0].username,
      message: 'Password reset. Log in with it now — you will be asked to choose a new one. Then remove AUTH_RESET_TOKEN from the service.',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[recover] error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
