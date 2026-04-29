import { redirect } from 'next/navigation';
import { query } from '@/lib/db/client';
import type { UserRow } from '@/lib/db/init';
import { readSession } from './session';

export async function getOptionalUser(): Promise<UserRow | null> {
  const sess = await readSession();
  if (!sess) return null;
  const r = await query<UserRow>(`SELECT * FROM apsomh_users WHERE id = $1 LIMIT 1`, [sess.uid]);
  const u = r.rows[0];
  if (!u || !u.is_active) return null;
  return u;
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
