import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/guard';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';

export const runtime = 'nodejs';

const Patch = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(['admin', 'user', 'viewer']).optional(),
  fullName: z.string().min(1).max(128).optional(),
  email: z.string().email().nullable().optional(),
  resetPassword: z.string().min(10).optional(),
  resetTotp: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const parsed = Patch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const b = parsed.data;
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
  if (sets.length === 0) return NextResponse.json({ ok: true });

  sets.push(`updated_at = NOW()`);
  vals.push(userId);
  const sql = `UPDATE apsomh_users SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING id`;
  const r = await query<{ id: number }>(sql, vals);
  if (r.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  await query(`DELETE FROM apsomh_users WHERE id = $1`, [userId]);
  return NextResponse.json({ ok: true });
}
