import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureSchema, type UserRow } from '@/lib/db/init';
import { query } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';
import { setPre2faCookie, signPre2fa } from '@/lib/auth/session';

export const runtime = 'nodejs';

const Body = z.object({
  identifier: z.string().trim().min(1).max(255).optional(),
  email: z.string().trim().min(1).max(255).optional(),
  username: z.string().trim().min(1).max(255).optional(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    await ensureSchema();
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const id = (parsed.data.identifier ?? parsed.data.email ?? parsed.data.username ?? '')
      .toLowerCase();
    if (!id) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const r = await query<UserRow>(
      `SELECT * FROM apsomh_users WHERE username = $1 OR email = $1 LIMIT 1`,
      [id],
    );
    const u = r.rows[0];
    if (!u || !u.is_active) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const ok = await verifyPassword(parsed.data.password, u.password_hash);
    if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    await setPre2faCookie(await signPre2fa(u.id));
    return NextResponse.json({ next: u.totp_enrolled ? '/login/totp' : '/enroll' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[login] error', err);
    return NextResponse.json(
      { error: 'Server error — likely the database is not initialized.' },
      { status: 500 },
    );
  }
}
