// SETUP INVITATIONS.
//
// An account an admin creates without a password: the person sets their own at
// first sign-in, from a one-time link. That is the version to use for a new
// admin — an admin who knows your password is an admin who can act as you, and
// the audit log then cannot tell the two of you apart.
//
// The token is random, single-use and short-lived, and only its HASH is stored:
// a dump of the key-value table yields no working invitations.

import { createHash, randomBytes } from "node:crypto";
import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";

/** Long enough that guessing is not a strategy. */
const BYTES = 32;
export const INVITE_HOURS = 72;

const keyFor = (hash: string) => `invite:${hash}`;
const hashOf = (token: string) => createHash("sha256").update(token).digest("hex");

export type Invite = { userId: number; expires: string };

/** Mint one. The raw token is returned once and never stored. */
export async function createInvite(userId: number): Promise<string> {
  await ensureSchema();
  const token = randomBytes(BYTES).toString("base64url");
  const expires = new Date(Date.now() + INVITE_HOURS * 3_600_000).toISOString();
  await query(
    `INSERT INTO apsomh_kv (k, v, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = NOW()`,
    [keyFor(hashOf(token)), JSON.stringify({ userId, expires } satisfies Invite)],
  );
  return token;
}

/**
 * Who this token is for, or null.
 *
 * An expired row is deleted on sight rather than left to accumulate — an
 * invitation nobody used is not worth keeping, and a stale row is one more
 * thing that could be made to work again.
 */
export async function readInvite(token: string): Promise<Invite | null> {
  if (!token) return null;
  await ensureSchema();
  const k = keyFor(hashOf(token));
  const r = await query<{ v: Invite }>(`SELECT v FROM apsomh_kv WHERE k = $1 LIMIT 1`, [k]);
  const row = r.rows[0]?.v;
  if (!row) return null;
  if (new Date(row.expires).getTime() < Date.now()) {
    await query(`DELETE FROM apsomh_kv WHERE k = $1`, [k]).catch(() => {});
    return null;
  }
  return row;
}

/** Single use: burn it the moment it is spent. */
export async function burnInvite(token: string): Promise<void> {
  await query(`DELETE FROM apsomh_kv WHERE k = $1`, [keyFor(hashOf(token))]).catch(() => {});
}

/** Every outstanding invitation for this person, gone. */
export async function revokeInvitesFor(userId: number): Promise<void> {
  await ensureSchema();
  await query(
    `DELETE FROM apsomh_kv WHERE k LIKE 'invite:%' AND (v->>'userId')::int = $1`,
    [userId],
  ).catch(() => {});
}
