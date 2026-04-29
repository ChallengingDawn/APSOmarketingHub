import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/guard';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';

export const runtime = 'nodejs';

const Body = z.object({
  username: z.string().trim().min(2).max(255).regex(/^[a-z0-9._@+-]+$/i),
  fullName: z.string().trim().min(1).max(128),
  email: z.string().email().optional(),
  initialPassword: z.string().min(10),
  role: z.enum(['admin', 'user', 'viewer']).optional(),
});

export async function GET() {
  await requireAdmin();
  const r = await query(
    `SELECT id, username, email, full_name, role, is_active, totp_enrolled, must_change_password, created_at, last_login
       FROM apsomh_users
      ORDER BY created_at DESC`,
  );
  return NextResponse.json({ users: r.rows });
}

export async function POST(req: Request) {
  await requireAdmin();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const reason = validatePasswordStrength(parsed.data.initialPassword);
  if (reason) return NextResponse.json({ error: reason }, { status: 400 });

  const username = parsed.data.username.toLowerCase();
  const email = parsed.data.email?.toLowerCase() ?? null;

  const existing = await query<{ id: number }>(
    `SELECT id FROM apsomh_users WHERE username = $1 LIMIT 1`,
    [username],
  );
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
  }

  const r = await query<{ id: number }>(
    `INSERT INTO apsomh_users (username, email, full_name, password_hash, role, is_active, must_change_password)
     VALUES ($1, $2, $3, $4, $5, TRUE, TRUE) RETURNING id`,
    [
      username,
      email,
      parsed.data.fullName,
      await hashPassword(parsed.data.initialPassword),
      parsed.data.role ?? 'user',
    ],
  );
  return NextResponse.json({ user: { id: r.rows[0].id, username, email, role: parsed.data.role ?? 'user' } });
}
