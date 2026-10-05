// YOUR RECOVERY CODES.
//
// GET says how many are left. POST issues a fresh set and returns it in the
// clear — the only time that happens — and the old set stops working the same
// second.
//
// Generating requires your current password. Whoever is at the keyboard already
// has your session; asking for the password is what stops a borrowed laptop from
// quietly minting ten permanent ways back in.

import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db/client";
import type { UserRow } from "@/lib/db/init";
import { getOptionalUser } from "@/lib/auth/guard";
import { verifyPassword } from "@/lib/auth/password";
import { CODE_COUNT, issueRecoveryCodes, recoveryStatus } from "@/lib/auth/recoveryCodes";
import { checkRateLimit, clientKey, recordFailure } from "@/lib/auth/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ password: z.string().min(1) });

export async function GET() {
  const u = await getOptionalUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = await recoveryStatus(u.id);
  return NextResponse.json({ ok: true, ...status, size: CODE_COUNT });
}

export async function POST(req: Request) {
  const u = await getOptionalUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = clientKey(req, "recovery");
  const gate = checkRateLimit(key);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: `Too many attempts. Try again in ${gate.retryAfter} seconds.` },
      { status: 429 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter your password." }, { status: 400 });
  }

  const r = await query<UserRow>(`SELECT * FROM apsomh_users WHERE id = $1 LIMIT 1`, [u.id]);
  const me = r.rows[0];
  if (!me || !(await verifyPassword(parsed.data.password, me.password_hash))) {
    recordFailure(key);
    return NextResponse.json({ ok: false, error: "That password is wrong." }, { status: 401 });
  }

  const codes = await issueRecoveryCodes(u.id);
  return NextResponse.json({ ok: true, codes });
}
