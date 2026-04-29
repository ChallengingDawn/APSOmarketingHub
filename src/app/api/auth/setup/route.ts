import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureSchema } from '@/lib/db/init';
import { query } from '@/lib/db/client';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';

export const runtime = 'nodejs';

const Body = z.object({
  username: z.string().trim().min(2).max(255),
  password: z.string().min(1),
  email: z.string().email().optional(),
  fullName: z.string().trim().min(1).max(128).optional(),
});

// Bootstrap the very first admin. Idempotent: only fires when apsomh_users
// is empty. Self-disables once a user exists.
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const reason = validatePasswordStrength(parsed.data.password);
    if (reason) return NextResponse.json({ error: reason }, { status: 400 });

    const existing = await query<{ id: number }>(`SELECT id FROM apsomh_users LIMIT 1`);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Setup already completed.' }, { status: 400 });
    }

    const username = parsed.data.username.toLowerCase();
    const email = parsed.data.email?.toLowerCase() ?? null;
    const fullName = parsed.data.fullName ?? username;
    const passwordHash = await hashPassword(parsed.data.password);

    await query(
      `INSERT INTO apsomh_users (username, email, full_name, password_hash, role, is_active, must_change_password)
       VALUES ($1, $2, $3, $4, 'admin', TRUE, FALSE)`,
      [username, email, fullName, passwordHash],
    );

    return NextResponse.json({ ok: true, message: 'Admin user created — please log in.' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[setup] error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
