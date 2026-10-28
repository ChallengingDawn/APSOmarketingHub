// WHO IS IN A SANDBOX (SARCLA 27.10.2026: "the TOTP, we can reuse the one on the hub to not double set"; 28.10.2026:
// the sandbox runs on the person's own computer and pulls its data from Railway).
//
// A sandbox has no password and no TOTP of its own.
//  - The relay (Railway): `sbx login` gets a short code here; the person confirms it on the hub's Sandbox app, behind
//    the hub's sign-in and TOTP; the hub tells the relay who confirmed it (over the link), and the CLI - polling with
//    its own secret - gets its 12-hour token. Only people its SANDBOX_PEOPLE names, in the role given there.
//  - The person's computer: `npm run sbx -- dev` runs the sandbox there for the one person signed in on the CLI
//    (SANDBOX_PEOPLE holds only them) - localUser() below. The relay serves no page, so it has nobody.

import { createHash, randomBytes, randomInt } from "node:crypto";
import { getPool } from "../db/client";
import { APP_KEYS } from "../auth/access";
import { hashPassword } from "../auth/password";
import type { UserRow } from "../db/init";
import { ensureSchema } from "../db/init";
import { ensureSandboxTables } from "./store";
import { parsePeople, type Person } from "./peopleList";
import { isLocalSandbox } from "./mode";

const CODE_MS = 10 * 60_000;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Who SANDBOX_PEOPLE lets in, by address. */
export function personFor(email: string, env: NodeJS.ProcessEnv = process.env): Person | null {
  return parsePeople(env.SANDBOX_PEOPLE).people.find((p) => p.email === email.trim().toLowerCase()) ?? null;
}

async function put(k: string, v: unknown) {
  await ensureSandboxTables();
  await getPool().query(`INSERT INTO sandbox_cli (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, at = now()`, [k, JSON.stringify(v)]);
}
async function take(k: string): Promise<unknown | null> {
  await ensureSandboxTables();
  const r = await getPool().query<{ v: string }>(`DELETE FROM sandbox_cli WHERE k = $1 RETURNING v`, [k]);
  return r.rows[0] ? JSON.parse(r.rows[0].v) : null;
}

/** The person's account here: found by address, or made now - no usable password, nothing to set up (the hub did). */
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
  } else {
    // an account from the sandbox's old sign-up links: nothing left to set up here, and the role is SANDBOX_PEOPLE's
    const r = await pool.query<UserRow>(`UPDATE apsomh_users SET awaiting_setup = FALSE, must_change_password = FALSE, role = $2, is_active = TRUE,
      updated_at = NOW() WHERE id = $1 RETURNING *`, [u.id, p.role]);
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

// ---- the person's computer -----------------------------------------------------------------------------------------

// the account, for a minute: a page is a dozen requests, and each one asks who it is
let held: { until: number; user: UserRow } | null = null;

/** On the person's own computer, the one person signed in on its CLI; on the relay, nobody - it serves no page. */
export async function localUser(): Promise<UserRow | null> {
  if (!isLocalSandbox()) return null;
  const p = parsePeople(process.env.SANDBOX_PEOPLE).people[0];
  if (!p) return null;
  if (held && Date.now() < held.until) return held.user;
  const user = await userFor(p);
  held = { until: Date.now() + 60_000, user };
  return user.is_active ? user : null;
}

// ---- the CLI ------------------------------------------------------------------------------------------------------

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I: read off a screen and typed nowhere, but compared by eye

/** A code to confirm on the hub, readable at a glance: XXXX-XXXX. */
export function newCode(): string {
  const pick = () => ALPHABET[randomInt(ALPHABET.length)];
  return `${Array.from({ length: 4 }, pick).join("")}-${Array.from({ length: 4 }, pick).join("")}`;
}

/** `sbx login` begins: a code for the person to confirm on the hub, and the CLI's own secret to collect the answer with. */
export async function startCli(): Promise<{ code: string; poll: string; expiresAt: string }> {
  const code = newCode();
  const poll = randomBytes(32).toString("base64url");
  const exp = Date.now() + CODE_MS;
  await put(`cli-code:${code}`, { poll: sha(poll), exp, state: "waiting" });
  return { code, poll, expiresAt: new Date(exp).toISOString() };
}

/** The hub says who confirmed the code. Refused for anyone SANDBOX_PEOPLE does not name, or a code that ran out. */
export async function grantCli(code: string, email: string): Promise<string | null> {
  const p = personFor(email);
  if (!p) return "this sandbox does not name that person";
  await ensureSandboxTables();
  const r = await getPool().query<{ v: string }>(`SELECT v FROM sandbox_cli WHERE k = $1`, [`cli-code:${code.toUpperCase()}`]);
  const c = r.rows[0] ? (JSON.parse(r.rows[0].v) as { poll: string; exp: number; state: string }) : null;
  if (!c || Date.now() > c.exp) return "no such code, or it ran out - run npm run sbx -- login again";
  if (c.state !== "waiting") return "this code was already used";
  const u = await userFor(p);
  await put(`cli-code:${code.toUpperCase()}`, { ...c, state: "granted", uid: u.id, user: u.username });
  return null;
}

/** The CLI collects its answer with its secret: waiting, or - once - the user id to sign a CLI token for. */
export async function pollCli(poll: string): Promise<{ state: "waiting" | "expired" } | { state: "granted"; uid: number; user: string }> {
  await ensureSandboxTables();
  const rows = await getPool().query<{ k: string; v: string }>(`SELECT k, v FROM sandbox_cli WHERE k LIKE 'cli-code:%'`);
  const mine = rows.rows.map((r) => ({ k: r.k, c: JSON.parse(r.v) as { poll: string; exp: number; state: string; uid?: number; user?: string } }))
    .find((x) => x.c.poll === sha(poll));
  if (!mine || Date.now() > mine.c.exp) return { state: "expired" };
  if (mine.c.state !== "granted" || !mine.c.uid) return { state: "waiting" };
  await take(mine.k);
  return { state: "granted", uid: mine.c.uid, user: mine.c.user ?? "" };
}

/** Boot: what the sandbox no longer hands out is gone - its own sign-up links (from before it opened only through the
 *  hub) and the Railway token its CLI once deployed with (28.10.2026: nobody deploys to Railway from a sandbox). */
export async function dropOldLinks(): Promise<number> {
  await ensureSandboxTables();
  await ensureSchema();
  const a = await getPool().query(`DELETE FROM apsomh_kv WHERE k LIKE 'invite:%'`);
  const b = await getPool().query(`DELETE FROM sandbox_cli WHERE k LIKE 'invite-mail:%' OR k = 'railway_token'`);
  return (a.rowCount ?? 0) + (b.rowCount ?? 0);
}
