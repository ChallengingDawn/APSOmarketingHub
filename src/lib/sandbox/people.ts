// WHO MAY USE A SANDBOX COPY - its people come from SANDBOX_PEOPLE on its Railway service, and nobody hands a password
// round: a missing person is created WITHOUT one (the hub's own "they set their own" accounts), with a one-time
// link; the hub mails that link on its next round (the sandbox holds no mail credentials) and the link is dropped
// here once sent. The person sets a password and enrols TOTP from it - the same login for the web and `sbx`.
//
//   SANDBOX_PEOPLE="diana.fehr@apsoparts.com|user|Diana Fehr; claudio.saraiva@apsoparts.com|admin|Claudio Saraiva"
//
// A user gets write on every app (they build across the hub); an admin needs no grant.

import { randomBytes } from "node:crypto";
import { getPool } from "../db/client";
import { ensureSchema } from "../db/init";
import { APP_KEYS } from "../auth/access";
import { hashPassword } from "../auth/password";
import { createInvite } from "../auth/invite";
import { ensureSandboxTables } from "./store";
import { parsePeople, publicUrl, type PendingInvite } from "./peopleList";

/** Create whoever is missing, each with a one-time link parked for the hub to mail. Returns how many were created. */
export async function seedPeople(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const { people, bad } = parsePeople(env.SANDBOX_PEOPLE);
  if (bad.length) console.warn(`[sandbox] SANDBOX_PEOPLE entries skipped (need email|admin or user|name): ${bad.join(", ")}`);
  if (!people.length) return 0;
  const base = publicUrl(env);
  if (!base) { console.warn("[sandbox] no SANDBOX_PUBLIC_URL / RAILWAY_PUBLIC_DOMAIN - people not created (their links would lead nowhere)"); return 0; }
  await ensureSchema();
  await ensureSandboxTables();
  const p = getPool();
  let made = 0;
  for (const person of people) {
    const exists = await p.query(`SELECT 1 FROM apsomh_users WHERE lower(email) = $1 OR username = $1`, [person.email]);
    if (exists.rowCount) continue;
    const r = await p.query<{ id: number }>(
      `INSERT INTO apsomh_users (username, email, full_name, password_hash, role, is_active, must_change_password, awaiting_setup)
       VALUES ($1, $1, $2, $3, $4, TRUE, TRUE, TRUE) RETURNING id`,
      [person.email, person.name, await hashPassword(randomBytes(32).toString("base64url")), person.role]);
    const id = r.rows[0].id;
    if (person.role === "user") {
      for (const app of APP_KEYS) {
        await p.query(`INSERT INTO apsomh_user_app_access (user_id, app_key, level) VALUES ($1, $2, 'write')
          ON CONFLICT (user_id, app_key) DO UPDATE SET level = 'write'`, [id, app]);
      }
    }
    const token = await createInvite(id);
    const invite: PendingInvite = { userId: id, email: person.email, name: person.name, url: `${base}/invite/${token}` };
    await p.query(`INSERT INTO sandbox_cli (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, at = now()`,
      [`invite-mail:${id}`, JSON.stringify(invite)]);
    made++;
  }
  if (made) console.log(`[sandbox] ${made} ${made === 1 ? "person" : "people"} created - the hub mails their links on its next round`);
  return made;
}
