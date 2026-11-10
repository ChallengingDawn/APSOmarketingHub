import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/guard';
import { randomBytes } from 'node:crypto';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { createInvite, INVITE_HOURS } from '@/lib/auth/invite';
import { grantStarterApps } from '@/lib/auth/appAccess';
import { asRole } from '@/lib/auth/access';
import { sendInviteMail } from '@/lib/auth/inviteMail';

export const runtime = 'nodejs';

const Body = z.object({
  username: z.string().trim().min(2).max(255).regex(/^[a-z0-9._@+-]+$/i),
  fullName: z.string().trim().min(1).max(128),
  email: z.string().email().optional(),
  /** Omitted when the person is to set their own from an invitation link. */
  initialPassword: z.string().min(10).optional(),
  // 'viewer' is the user of before 01.11.2026, still understood
  role: z.enum(['admin', 'sales_leader', 'user', 'viewer']).transform(asRole).optional(),
  /**
   * The person sets their own password at first sign-in, from a one-time link.
   * This is the one to use for a new ADMIN: an admin who knows your password is
   * an admin who can act as you, and the audit log cannot then tell you apart.
   */
  setupByUser: z.boolean().optional(),
  /** The Angst+Pfister hub's mark, given at creation (SARCLA 10.11.2026): a cross-admin is an admin, a cross-user a user. */
  cross: z.enum(['user', 'admin']).optional(),
  /** Mail them the way in - the hub's address and theirs (src/lib/auth/inviteMail.ts); only with setupByUser and an email. */
  sendMail: z.boolean().optional(),
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

  // the mark decides the role it goes with, as on the person's panel (./[id]/route.ts): cross-admin = admin, cross-user = user
  const cross = parsed.data.cross ?? null;
  const role = cross === 'admin' ? 'admin' : cross === 'user' ? 'user' : parsed.data.role ?? 'user';
  const r = await query<{ id: number }>(
    `INSERT INTO apsomh_users (username, email, full_name, password_hash, role, is_active, must_change_password, awaiting_setup, cross_access)
     VALUES ($1, $2, $3, $4, $5, TRUE, TRUE, $6, $7) RETURNING id`,
    [
      username,
      email,
      parsed.data.fullName,
      // No password yet: a hash of something nobody holds, so the account
      // cannot be signed into until the invitation is spent.
      await hashPassword(parsed.data.initialPassword ?? randomBytes(32).toString('base64url')),
      role,
      setupByUser,
      cross,
    ],
  );
  const id = r.rows[0].id;
  // Everybody who is not an admin starts with the Datatracker, so a new account
  // opens on something rather than on an empty hall.
  await grantStarterApps(id, role);
  const token = setupByUser ? await createInvite(id) : null;

  await query(
    `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
    [me.username, 'user.create', JSON.stringify({
      userId: id, username, role, setupByUser, ...(cross ? { cross } : {}),
    })],
  ).catch(() => { /* never fail the creation because the log did */ });

  // The way in by mail, when asked for: the hub's address and the one to sign in with - never a password, never a
  // link that signs in (src/lib/auth/inviteMail.ts). A mail that fails leaves the account as it is, and says why.
  const sent = setupByUser && parsed.data.sendMail && email
    ? await sendInviteMail(
      { fullName: parsed.data.fullName, email, signInWith: email, role, cross },
      { fullName: me.full_name || me.username, email: me.email },
    )
    : { mailed: null, mailError: null };
  if (sent.mailed || sent.mailError) {
    await query(
      `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
      [me.username, sent.mailed ? 'user.invite_mailed' : 'user.invite_mail_failed', JSON.stringify({ userId: id, ...sent })],
    ).catch(() => {});
  }

  return NextResponse.json({
    user: { id, username, email, role, cross },
    // Shown to the admin once, for handing over by hand; it is single-use and expires.
    invitePath: token ? `/invite/${token}` : null,
    inviteHours: token ? INVITE_HOURS : null,
    mailed: sent.mailed,
    mailError: sent.mailError,
  });
}
