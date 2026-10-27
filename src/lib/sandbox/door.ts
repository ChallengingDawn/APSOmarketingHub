// THE ONLY WAY INTO A SANDBOX IS THROUGH THE HUB (SARCLA 27.10.2026: "how can we access the sandbox from outside if
// this should be inside of the hub? ... the TOTP, we can reuse the one on the hub to not double set").
//
// A sandbox has no password and no TOTP of its own. The person signs in to the hub (its TOTP), and:
//  - the browser: the hub's Sandbox app gives this sandbox a one-time ticket over its own link (only its SHA-256), and
//    sends the person to /sso?t=<ticket>; the ticket opens a session once, within a minute;
//  - the CLI: `sbx login` gets a short code here; the person confirms it on the hub's Sandbox app, the hub tells this
//    sandbox who confirmed it (over the link), and the CLI - polling with its own secret - gets its 12-hour token.
// Either way the sandbox only lets in people its SANDBOX_PEOPLE names, in the role given there.

import { createHash, randomBytes, randomInt } from "node:crypto";
import { getPool } from "../db/client";
import { APP_KEYS } from "../auth/access";
import { hashPassword } from "../auth/password";
import type { UserRow } from "../db/init";
import { ensureSchema } from "../db/init";
import { ensureSandboxTables } from "./store";
import { parsePeople, type Person } from "./peopleList";

const TICKET_MS = 60_000;
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

// ---- the browser -------------------------------------------------------------------------------------------------

/** The hub hands over a ticket (its SHA-256 only) for a person. Refused for anyone SANDBOX_PEOPLE does not name. */
export async function acceptTicket(hash: string, email: string): Promise<string | null> {
  if (!/^[0-9a-f]{64}$/.test(hash)) return "not a ticket";
  if (!personFor(email)) return "this sandbox does not name that person";
  await put(`ticket:${hash}`, { email: email.toLowerCase(), exp: Date.now() + TICKET_MS });
  return null;
}

/** /sso?t=<ticket>: once, within a minute, for a person this sandbox still names. */
export async function useTicket(ticket: string): Promise<Person | null> {
  if (!ticket || ticket.length < 32) return null;
  const t = (await take(`ticket:${sha(ticket)}`)) as { email: string; exp: number } | null;
  if (!t || Date.now() > t.exp) return null;
  return personFor(t.email);
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

/** Boot: the sandbox's own sign-up links (from before it opened only through the hub) are gone. */
export async function dropOldLinks(): Promise<number> {
  await ensureSandboxTables();
  await ensureSchema();
  const a = await getPool().query(`DELETE FROM apsomh_kv WHERE k LIKE 'invite:%'`);
  const b = await getPool().query(`DELETE FROM sandbox_cli WHERE k LIKE 'invite-mail:%'`);
  return (a.rowCount ?? 0) + (b.rowCount ?? 0);
}
