import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/guard';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { whyNotDelete } from './delete';
import { asCross, asRole, type Cross } from '@/lib/auth/access';
import { grantStarterApps } from '@/lib/auth/appAccess';
import { revokeOtherSessions } from '@/lib/auth/sessions';

export const runtime = 'nodejs';

const Patch = z.object({
  isActive: z.boolean().optional(),
  // 'viewer' is the user of before 01.11.2026, still understood
  role: z.enum(['admin', 'sales_leader', 'user', 'viewer']).transform(asRole).optional(),
  fullName: z.string().min(1).max(128).optional(),
  email: z.string().email().nullable().optional(),
  resetPassword: z.string().min(10).optional(),
  resetTotp: z.boolean().optional(),
  // cross access (src/lib/auth/access.ts): a person of Angst+Pfister - 'user', 'admin' - or null for nobody's
  cross: z.enum(['user', 'admin']).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requireAdmin();
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const parsed = Patch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const b = parsed.data;

  // Cross access and the role move together (access.ts Cross): a cross-admin IS an admin; a cross-user never is one,
  // and an admin made cross-user becomes a user; a role given to a cross person keeps their mark in step with it.
  const now = (await query<{ role: string; cross_access: string | null }>(
    `SELECT role, cross_access FROM apsomh_users WHERE id = $1`, [userId],
  )).rows[0];
  if (!now) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const crossNow = asCross(now.cross_access);
  let cross: Cross | null | undefined = b.cross;
  if (cross === 'admin') b.role = 'admin';
  else if (cross === 'user' && (b.role ?? asRole(now.role)) === 'admin') b.role = 'user';
  else if (cross === undefined && crossNow && b.role !== undefined) cross = b.role === 'admin' ? 'admin' : 'user';
  if (cross !== undefined && cross === crossNow) cross = undefined;

  // Block self-lockout: an admin must not be able to demote or disable
  // themselves through this endpoint. They can still change their own
  // password via /api/auth/change-password and rotate their TOTP from
  // the enrolment flow.
  if (userId === me.id) {
    if (b.isActive === false) {
      return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 });
    }
    if (b.role !== undefined && b.role !== 'admin') {
      return NextResponse.json({ error: 'Cannot demote yourself' }, { status: 400 });
    }
  }
  const sets: string[] = [];
  const vals: unknown[] = [];
  const push = (col: string, val: unknown) => {
    vals.push(val);
    sets.push(`${col} = $${vals.length}`);
  };

  if (b.isActive !== undefined) push('is_active', b.isActive);
  if (b.role !== undefined) push('role', b.role);
  if (b.fullName !== undefined) push('full_name', b.fullName);
  if (b.email !== undefined) push('email', b.email?.toLowerCase() ?? null);
  if (b.resetPassword !== undefined) {
    const reason = validatePasswordStrength(b.resetPassword);
    if (reason) return NextResponse.json({ error: reason }, { status: 400 });
    push('password_hash', await hashPassword(b.resetPassword));
    push('must_change_password', true);
  }
  if (b.resetTotp) {
    push('totp_secret', null);
    push('totp_enrolled', false);
  }
  if (cross !== undefined) push('cross_access', cross);
  if (sets.length === 0) return NextResponse.json({ ok: true });

  sets.push(`updated_at = NOW()`);
  vals.push(userId);
  const sql = `UPDATE apsomh_users SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING id`;
  const r = await query<{ id: number }>(sql, vals);
  if (r.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // made a user with nothing granted (an admin or a sales leader of before needed no rows): the Datatracker, as every
  // new user starts - never over a grant already there, nor back onto one taken away
  if (b.role === 'user') {
    const any = await query(`SELECT 1 FROM apsomh_user_app_access WHERE user_id = $1 LIMIT 1`, [userId]);
    if (any.rows.length === 0) await grantStarterApps(userId, 'user');
  }

  // A new mark signs them out everywhere: their session carries the mark to the door (src/middleware.ts), and a
  // cross-user must not keep a session that may still change things - nor lose one the hour they are let in.
  if (cross !== undefined) await revokeOtherSessions(userId, null);

  // Who changed whose role, who reset whose password — exactly what an audit
  // log is for, and this endpoint was writing none of it. The new password is
  // NOT recorded; only that one was set.
  await query(
    `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
    [me.username, 'user.update', JSON.stringify({
      userId,
      role: b.role,
      isActive: b.isActive,
      passwordReset: b.resetPassword !== undefined || undefined,
      totpReset: b.resetTotp || undefined,
      cross: cross === undefined ? undefined : cross ?? 'none',
    })],
  ).catch(() => { /* never fail the change because the log did */ });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requireAdmin();
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  // The one admin action with no undo, so it has the most refusals: not
  // yourself, not the last admin, and never as a way to end somebody's session
  // — suspending does that and keeps the audit trail attached to a name.
  const no = await whyNotDelete(me.id, userId);
  if (no) return NextResponse.json({ ok: false, error: no.error }, { status: no.status });

  const gone = await query<{ username: string; role: string }>(
    `DELETE FROM apsomh_users WHERE id = $1 RETURNING username, role`,
    [userId],
  );
  if (!gone.rows[0]) return NextResponse.json({ ok: false, error: 'That account does not exist.' }, { status: 404 });

  // Their grants and sessions go with the row (ON DELETE CASCADE); the audit
  // entry does not, because what they did stays on the record.
  await query(
    `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
    [me.username, 'user.delete', JSON.stringify({ userId, username: gone.rows[0].username, role: gone.rows[0].role })],
  ).catch(() => {});

  return NextResponse.json({ ok: true, deleted: gone.rows[0].username });
}
