// SETTING THE PASSWORD ON AN ACCOUNT THAT HAS NEVER HAD ONE.
//
// SARCLA's flow: the sign-up page asks who you are, and if that account exists
// and is still waiting to be set up, you choose a password. No link to pass
// around, which is the point — an admin creates the account and tells you it is
// there.
//
// The one rule that keeps this from being account takeover: it works ONLY while
// `awaiting_setup` is true. An account anybody has ever signed into is not
// claimable here, whatever is typed.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { checkRateLimit, clientKey, recordFailure } from "@/lib/auth/rateLimit";
import { revokeInvitesFor } from "@/lib/auth/invite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Who = z.object({ identifier: z.string().trim().min(1).max(255) });
const Claim = Who.extend({ password: z.string().min(1) });

type Row = { id: number; username: string; full_name: string; role: string; awaiting_setup: boolean; is_active: boolean };

/** By username or by email — people remember one or the other, not reliably both. */
async function find(identifier: string): Promise<Row | null> {
  await ensureSchema();
  const r = await query<Row>(
    `SELECT id, username, full_name, role, awaiting_setup, is_active
       FROM apsomh_users
      WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
      LIMIT 1`,
    [identifier.trim()],
  );
  return r.rows[0] ?? null;
}

/**
 * Is there an account here still waiting for a password?
 *
 * Deliberately vague when the answer is no. "No account" and "that account is
 * already in use" are the same reply, or this becomes a way to find out who has
 * an account and who does not.
 */
export async function POST(req: NextRequest) {
  const key = clientKey(req, "claim");
  const gate = checkRateLimit(key);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: `Too many attempts. Try again in ${gate.retryAfter} seconds.` },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  const body = await req.json().catch(() => null);

  // Step one: who are you?
  const asWho = Who.safeParse(body);
  const asClaim = Claim.safeParse(body);
  if (!asWho.success) return NextResponse.json({ ok: false, error: "Enter your username or email." }, { status: 400 });

  const row = await find(asWho.data.identifier);
  const claimable = !!row && row.is_active && row.awaiting_setup;

  if (!asClaim.success) {
    if (!claimable) {
      recordFailure(key);
      return NextResponse.json({
        ok: false,
        error: "There is nothing to set up for that. If you already have a password, sign in; otherwise ask an admin to create your account.",
      }, { status: 404 });
    }
    return NextResponse.json({ ok: true, stage: "password", fullName: row!.full_name, username: row!.username, role: row!.role });
  }

  // Step two: the password.
  if (!claimable) {
    recordFailure(key);
    return NextResponse.json({ ok: false, error: "There is nothing to set up for that." }, { status: 404 });
  }
  const reason = validatePasswordStrength(asClaim.data.password);
  if (reason) return NextResponse.json({ ok: false, error: reason }, { status: 400 });

  await query(
    `UPDATE apsomh_users
        SET password_hash = $1, awaiting_setup = FALSE, must_change_password = FALSE, updated_at = NOW()
      WHERE id = $2 AND awaiting_setup = TRUE`,
    [await hashPassword(asClaim.data.password), row!.id],
  );
  // Any invitation link for this person is now pointing at a claimed account.
  await revokeInvitesFor(row!.id);
  await query(
    `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
    [row!.username, "account.claimed", JSON.stringify({ userId: row!.id })],
  ).catch(() => {});

  return NextResponse.json({ ok: true, stage: "done", username: row!.username });
}
