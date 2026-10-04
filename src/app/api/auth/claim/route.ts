// THE ACCOUNT STEP OF SIGNING IN.
//
// One question — "who are you?" — and three honest answers:
//
//   signin   you have an account with a password. Type it.
//   password you have an account that has never been signed into. Choose one.
//   create   you have no account, but your address is ours. Make one.
//
// No link anywhere. SARCLA's rule: the page looks at the address and works out
// what to ask for. An admin creating an account tells the person it exists; a
// colleague at one of our own domains does not need telling at all.
//
// Two rules keep this from being account takeover:
//
//   a password may only be SET on an account that has never been signed into
//   (`awaiting_setup`), whatever is typed; and
//
//   an account may only be CREATED for an address at one of our domains, as a
//   viewer, with the apps everybody starts with and nothing else.
//
// It does tell you whether an address has an account. That is the price of
// asking one question instead of three, and it is the flow SARCLA asked for; on
// a hub whose domains may self-register, "is there an account at this address"
// is answerable by trying to make one anyway. It is rate-limited per client.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { checkRateLimit, clientKey, recordFailure } from "@/lib/auth/rateLimit";
import { revokeInvitesFor } from "@/lib/auth/invite";
import { grantStarterApps } from "@/lib/auth/appAccess";
import { SELF_SIGNUP_DOMAINS, SELF_SIGNUP_ROLE, maySelfRegister } from "@/lib/auth/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Who = z.object({ identifier: z.string().trim().min(1).max(255) });
const SetPassword = Who.extend({ password: z.string().min(1) });
const Create = SetPassword.extend({ fullName: z.string().trim().min(1).max(128) });

type Row = {
  id: number; username: string; full_name: string; role: string;
  awaiting_setup: boolean; is_active: boolean;
};

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

/** "daniel.wieland@apsoparts.com" -> "Daniel Wieland", as a first guess they can correct. */
function nameFromEmail(email: string): string {
  const local = email.slice(0, email.lastIndexOf("@"));
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const DOMAINS = SELF_SIGNUP_DOMAINS.join(" or ");
const NO_WAY_IN =
  `We have no account for that, and only a ${DOMAINS} address can create one. ` +
  `Ask an admin to create yours.`;

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
  const asWho = Who.safeParse(body);
  if (!asWho.success) {
    return NextResponse.json({ ok: false, error: "Enter your email or username." }, { status: 400 });
  }
  const identifier = asWho.data.identifier.trim();
  const row = await find(identifier);
  const mayRegister = !row && maySelfRegister(identifier);

  /* ── step one: which of the three is this? ───────────────────────────── */

  const asSet = SetPassword.safeParse(body);
  if (!asSet.success) {
    if (row && !row.is_active) {
      recordFailure(key);
      return NextResponse.json(
        { ok: false, error: "That account is suspended. An admin has to restore it." },
        { status: 403 },
      );
    }
    if (row && row.awaiting_setup) {
      return NextResponse.json({
        ok: true, stage: "password",
        fullName: row.full_name, username: row.username, role: row.role,
      });
    }
    if (row) {
      return NextResponse.json({ ok: true, stage: "signin", fullName: row.full_name, username: row.username });
    }
    if (mayRegister) {
      return NextResponse.json({
        ok: true, stage: "create",
        email: identifier.toLowerCase(),
        suggestedName: nameFromEmail(identifier.toLowerCase()),
      });
    }
    recordFailure(key);
    return NextResponse.json({ ok: false, error: NO_WAY_IN }, { status: 404 });
  }

  const reason = validatePasswordStrength(asSet.data.password);
  if (reason) return NextResponse.json({ ok: false, error: reason }, { status: 400 });

  /* ── step two, first case: an account waiting to be set up ───────────── */

  if (row) {
    if (!row.is_active || !row.awaiting_setup) {
      recordFailure(key);
      return NextResponse.json(
        { ok: false, error: "That account already has a password. Sign in, or reset it with your authenticator." },
        { status: 409 },
      );
    }
    await query(
      `UPDATE apsomh_users
          SET password_hash = $1, awaiting_setup = FALSE, must_change_password = FALSE, updated_at = NOW()
        WHERE id = $2 AND awaiting_setup = TRUE`,
      [await hashPassword(asSet.data.password), row.id],
    );
    // Any invitation for this person now points at an account that is claimed.
    await revokeInvitesFor(row.id);
    await query(
      `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
      [row.username, "account.claimed", JSON.stringify({ userId: row.id })],
    ).catch(() => {});
    return NextResponse.json({ ok: true, stage: "done", username: row.username });
  }

  /* ── step two, second case: a colleague making their own account ─────── */

  if (!mayRegister) {
    recordFailure(key);
    return NextResponse.json({ ok: false, error: NO_WAY_IN }, { status: 404 });
  }
  const asCreate = Create.safeParse(body);
  if (!asCreate.success) {
    return NextResponse.json({ ok: false, error: "Tell us your name." }, { status: 400 });
  }

  const username = identifier.toLowerCase();
  const inserted = await query<{ id: number }>(
    `INSERT INTO apsomh_users (username, email, full_name, password_hash, role, is_active, must_change_password, awaiting_setup)
     VALUES ($1, $1, $2, $3, $4, TRUE, FALSE, FALSE)
     ON CONFLICT (username) DO NOTHING
     RETURNING id`,
    [username, asCreate.data.fullName, await hashPassword(asSet.data.password), SELF_SIGNUP_ROLE],
  );
  // Somebody got there between the lookup and here. Theirs stands; this is not
  // a way to overwrite it.
  if (inserted.rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: "That account already exists. Sign in instead." },
      { status: 409 },
    );
  }
  const id = inserted.rows[0].id;
  await grantStarterApps(id, SELF_SIGNUP_ROLE);
  await query(
    `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
    [username, "account.self_register", JSON.stringify({ userId: id, role: SELF_SIGNUP_ROLE })],
  ).catch(() => {});

  return NextResponse.json({ ok: true, stage: "done", username, created: true });
}
