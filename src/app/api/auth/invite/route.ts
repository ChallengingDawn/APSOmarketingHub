// SPENDING AN INVITATION.
//
// Open to anyone holding the token, because the person has no account to sign in
// with yet — the token IS the proof. That is why it is long, single-use, short
// lived and stored only as a hash.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { burnInvite, readInvite } from "@/lib/auth/invite";
import { checkRateLimit, clientKey, recordFailure } from "@/lib/auth/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who it is for, so the page can greet them rather than ask who they are. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const invite = await readInvite(token);
  if (!invite) {
    return NextResponse.json({ ok: false, error: "This link has been used already, or it has expired." }, { status: 404 });
  }
  const r = await query<{ full_name: string; username: string; role: string }>(
    `SELECT full_name, username, role FROM apsomh_users WHERE id = $1`, [invite.userId],
  );
  const u = r.rows[0];
  if (!u) return NextResponse.json({ ok: false, error: "That account no longer exists." }, { status: 404 });
  return NextResponse.json({ ok: true, fullName: u.full_name, username: u.username, role: u.role });
}

const Body = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  // Rate limited like a login: a token is a secret, and a secret that can be
  // tried endlessly is a secret with a deadline.
  const key = clientKey(req, "invite");
  const gate = checkRateLimit(key);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: `Too many attempts. Try again in ${gate.retryAfter} seconds.` },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input." }, { status: 400 });

  const invite = await readInvite(parsed.data.token);
  if (!invite) {
    recordFailure(key);
    return NextResponse.json({ ok: false, error: "This link has been used already, or it has expired." }, { status: 404 });
  }

  const reason = validatePasswordStrength(parsed.data.password);
  if (reason) return NextResponse.json({ ok: false, error: reason }, { status: 400 });

  await ensureSchema();
  await query(
    `UPDATE apsomh_users
        SET password_hash = $1, must_change_password = FALSE, updated_at = NOW()
      WHERE id = $2`,
    [await hashPassword(parsed.data.password), invite.userId],
  );
  // Spent. Even if the same link is opened again from a browser's history.
  await burnInvite(parsed.data.token);

  const r = await query<{ username: string }>(`SELECT username FROM apsomh_users WHERE id = $1`, [invite.userId]);
  await query(
    `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
    [r.rows[0]?.username ?? String(invite.userId), "invite.accepted", JSON.stringify({ userId: invite.userId })],
  ).catch(() => {});

  return NextResponse.json({ ok: true });
}
