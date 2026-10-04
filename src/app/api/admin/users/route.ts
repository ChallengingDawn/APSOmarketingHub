import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/guard';
import { randomBytes } from 'node:crypto';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { createInvite, INVITE_HOURS } from '@/lib/auth/invite';
import { grantStarterApps } from '@/lib/auth/appAccess';

export const runtime = 'nodejs';

const Body = z.object({
  username: z.string().trim().min(2).max(255).regex(/^[a-z0-9._@+-]+$/i),
  fullName: z.string().trim().min(1).max(128),
  email: z.string().email().optional(),
  /** Omitted when the person is to set their own from an invitation link. */
  initialPassword: z.string().min(10).optional(),
  role: z.enum(['admin', 'user', 'viewer']).optional(),
  /**
   * The person sets their own password at first sign-in, from a one-time link.
   * This is the one to use for a new ADMIN: an admin who knows your password is
   * an admin who can act as you, and the audit log cannot then tell you apart.
   */
  setupByUser: z.boolean().optional(),
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
  const me = await requireAdmin();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const setupByUser = parsed.data.setupByUser === true;
  if (!setupByUser) {
    if (!parsed.data.initialPassword) {
      return NextResponse.json({ error: 'Set a password, or let them set their own.' }, { status: 400 });
    }
    const reason = validatePasswordStrength(parsed.data.initialPassword);
    if (reason) return NextResponse.json({ error: reason }, { status: 400 });
  }

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
    `INSERT INTO apsomh_users (username, email, full_name, password_hash, role, is_active, must_change_password, awaiting_setup)
     VALUES ($1, $2, $3, $4, $5, TRUE, TRUE, $6) RETURNING id`,
    [
      username,
      email,
      parsed.data.fullName,
      // No password yet: a hash of something nobody holds, so the account
      // cannot be signed into until the invitation is spent.
      await hashPassword(parsed.data.initialPassword ?? randomBytes(32).toString('base64url')),
      parsed.data.role ?? 'user',
      setupByUser,
    ],
  );
  const id = r.rows[0].id;
  // Everybody who is not an admin starts with the Datatracker, so a new account
  // opens on something rather than on an empty hall.
  const role = parsed.data.role ?? 'user';
  await grantStarterApps(id, role);
  const token = setupByUser ? await createInvite(id) : null;

  await query(
    `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
    [me.username, 'user.create', JSON.stringify({
      userId: id, username, role, setupByUser,
    })],
  ).catch(() => { /* never fail the creation because the log did */ });

  return NextResponse.json({
    user: { id, username, email, role },
    // Shown to the admin once. There is no mail from the hub yet, so they hand
    // it over themselves; it is single-use and expires.
    invitePath: token ? `/invite/${token}` : null,
    inviteHours: token ? INVITE_HOURS : null,
  });
}
