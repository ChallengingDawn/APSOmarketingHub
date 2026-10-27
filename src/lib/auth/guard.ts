import { redirect } from 'next/navigation';
import { query } from '@/lib/db/client';
import type { UserRow } from '@/lib/db/init';
import { readSession } from './session';
import { touchSession } from './sessions';
import { isSandbox } from '@/lib/sandbox/mode';
import { proxiedUser } from '@/lib/sandbox/door';

export async function getOptionalUser(): Promise<UserRow | null> {
  // A sandbox copy has no sessions of its own: the hub serves it and says who is asking (src/lib/sandbox/proxy.ts).
  if (isSandbox()) return proxiedUser();
  const sess = await readSession();
  if (!sess) return null;
  // A session that has been signed out elsewhere stops being accepted on the
  // next request, not in twelve hours when its token would have expired. The
  // same statement marks it as seen, so the device list stays current.
  if (sess.sid && !(await touchSession(sess.sid))) return null;
  const r = await query<UserRow>(`SELECT * FROM apsomh_users WHERE id = $1 LIMIT 1`, [sess.uid]);
  const u = r.rows[0];
  if (!u || !u.is_active) return null;
  return u;
}

/** The session asking, so a page can say "this device" and leave it alone. */
export async function currentSid(): Promise<string | null> {
  return (await readSession())?.sid ?? null;
}

export async function requireUser(): Promise<UserRow> {
  const u = await getOptionalUser();
  if (!u) redirect('/signin');
  return u;
}

export async function requireAdmin(): Promise<UserRow> {
  const u = await requireUser();
  if (u.role !== 'admin') redirect('/');
  return u;
}
