import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db/client';
import type { UserRow } from '@/lib/db/init';
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/lib/auth/password';
import { currentSid, requireUser } from '@/lib/auth/guard';
import { revokeOtherSessions } from '@/lib/auth/sessions';

export const runtime = 'nodejs';

const Body = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

export async function POST(req: Request) {
  const u = await requireUser();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const r = await query<UserRow>(`SELECT * FROM apsomh_users WHERE id = $1 LIMIT 1`, [u.id]);
  const me = r.rows[0];
  if (!me) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const ok = await verifyPassword(parsed.data.currentPassword, me.password_hash);
  if (!ok) return NextResponse.json({ error: 'Current password is wrong' }, { status: 401 });

  const reason = validatePasswordStrength(parsed.data.newPassword);
  if (reason) return NextResponse.json({ error: reason }, { status: 400 });

  await query(
    `UPDATE apsomh_users SET password_hash = $1, must_change_password = FALSE, updated_at = NOW() WHERE id = $2`,
    [await hashPassword(parsed.data.newPassword), u.id],
  );

  // Changing a password is usually somebody saying "I think somebody else has
  // it". Leaving every other browser signed in made that gesture meaningless.
  // This one stays — nobody expects to be logged out of the window they just
  // typed it into.
  const ended = await revokeOtherSessions(u.id, await currentSid());
  await query(
    `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
    [u.username, 'password.changed', JSON.stringify({ userId: u.id, otherSessionsEnded: ended })],
  ).catch(() => {});

  return NextResponse.json({ ok: true, otherSessionsEnded: ended });
}
