// TEN CODES FOR THE DAY THE PHONE IS GONE.
//
// Losing the authenticator used to mean finding an admin, proving who you are
// over a call, and waiting. Ten one-time codes turn that into something you do
// yourself in two minutes — which is the difference between a safeguard people
// keep and one they route around.
//
// Stored as hashes, like a password: a list an admin could read would be ten
// spare passwords sitting in a database. Issued once, shown once; if they are
// lost, new ones are generated and the old ones stop working the same second.
//
// SHA-256 rather than a slow hash on purpose. These are 25 random characters
// from a 31-letter alphabet — about 123 bits — so there is nothing to brute
// force, and the login path has to stay fast.

import { createHash, randomInt } from "node:crypto";
import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";

/** No 0/O/1/I/L: these get read aloud and written down. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const GROUPS = 5;
const PER_GROUP = 5;
export const CODE_COUNT = 10;

const keyFor = (userId: number) => `recovery:${userId}`;

type Stored = { h: string; used: string | null };

const normalise = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, "");
const hash = (code: string) => createHash("sha256").update(normalise(code)).digest("hex");

function makeCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let s = "";
    for (let i = 0; i < PER_GROUP; i++) s += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(s);
  }
  return groups.join("-");
}

async function read(userId: number): Promise<Stored[]> {
  await ensureSchema();
  const r = await query<{ v: { codes?: Stored[] } }>(
    `SELECT v FROM apsomh_kv WHERE k = $1 LIMIT 1`,
    [keyFor(userId)],
  );
  return r.rows[0]?.v?.codes ?? [];
}

async function write(userId: number, codes: Stored[]): Promise<void> {
  await query(
    `INSERT INTO apsomh_kv (k, v, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = NOW()`,
    [keyFor(userId), JSON.stringify({ codes })],
  );
}

/**
 * A fresh set. Returns the codes in the clear exactly once — this is the only
 * moment they exist outside somebody's hands.
 */
export async function issueRecoveryCodes(userId: number): Promise<string[]> {
  const plain = Array.from({ length: CODE_COUNT }, makeCode);
  await write(userId, plain.map((c) => ({ h: hash(c), used: null })));
  await query(
    `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
    [String(userId), "recovery.issued", JSON.stringify({ userId, count: CODE_COUNT })],
  ).catch(() => {});
  return plain;
}

export async function recoveryStatus(userId: number): Promise<{ total: number; remaining: number }> {
  const codes = await read(userId);
  return { total: codes.length, remaining: codes.filter((c) => !c.used).length };
}

/**
 * Spend one.
 *
 * Marked used before the caller is told it worked, so the same code cannot be
 * replayed — that is the whole of "one-time". Comparison is on the hash, and
 * spacing and case are forgiven because these get typed off paper.
 */
export async function consumeRecoveryCode(userId: number, code: string): Promise<boolean> {
  const typed = normalise(code);
  if (typed.length !== GROUPS * PER_GROUP) return false;
  const codes = await read(userId);
  const h = hash(typed);
  const i = codes.findIndex((c) => c.h === h && !c.used);
  if (i < 0) return false;
  codes[i].used = new Date().toISOString();
  await write(userId, codes);
  await query(
    `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
    [String(userId), "recovery.used", JSON.stringify({ userId, remaining: codes.filter((c) => !c.used).length })],
  ).catch(() => {});
  return true;
}

/** Does this look like a recovery code rather than a six-digit one? */
export function looksLikeRecoveryCode(input: string): boolean {
  return normalise(input).length === GROUPS * PER_GROUP;
}
