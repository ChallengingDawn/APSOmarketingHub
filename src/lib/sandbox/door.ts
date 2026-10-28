// WHO IS IN A SANDBOX - the one person whose computer it runs on (SARCLA 28.10.2026). A sandbox has no password, no TOTP
// and no sign-in page: `npm run sandbox` starts it on 127.0.0.1 for the person named in SANDBOX_PEOPLE (from their
// .env.local), and the middleware answers nobody but localhost.

import { randomBytes } from "node:crypto";
import { getPool } from "../db/client";
import { APP_KEYS } from "../auth/access";
import { hashPassword } from "../auth/password";
import type { UserRow } from "../db/init";
import { ensureSchema } from "../db/init";
import { parsePeople, type Person } from "./peopleList";
import { isSandbox } from "./mode";

/** The person's account in the sandbox's own database: found by address, or made now - every app, nothing to set up. */
export async function userFor(p: Person): Promise<UserRow> {
  await ensureSchema();
  const pool = getPool();
  const found = await pool.query<UserRow>(`SELECT * FROM apsomh_users WHERE lower(email) = $1 LIMIT 1`, [p.email]);
  let u = found.rows[0];
  if (!u) {
    const r = await pool.query<UserRow>(
      `INSERT INTO apsomh_users (username, email, full_name, password_hash, role, is_active, must_change_password, awaiting_setup)
       VALUES ($1, $1, $2, $3, $4, TRUE, FALSE, FALSE) RETURNING *`,
      [p.email, p.name, await hashPassword(randomBytes(32).toString("base64url")), p.role]);
    u = r.rows[0];
  }
  if (p.role === "user") {
    for (const app of APP_KEYS) {
      await pool.query(`INSERT INTO apsomh_user_app_access (user_id, app_key, level) VALUES ($1, $2, 'write')
        ON CONFLICT (user_id, app_key) DO UPDATE SET level = 'write'`, [u.id, app]);
    }
  }
  return u;
}

// the account, for a minute: a page is a dozen requests, and each one asks who it is
let held: { until: number; user: UserRow } | null = null;

/** In a sandbox, the one person it runs for; anywhere else nobody (the hub has its own sessions). */
export async function localUser(): Promise<UserRow | null> {
  if (!isSandbox()) return null;
  const p = parsePeople(process.env.SANDBOX_PEOPLE).people[0];
  if (!p) return null;
  if (held && Date.now() < held.until) return held.user;
  const user = await userFor(p);
  held = { until: Date.now() + 60_000, user };
  return user.is_active ? user : null;
}
