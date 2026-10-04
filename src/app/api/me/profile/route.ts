// YOUR OWN NAME AND EMAIL.
//
// Deliberately narrow: a person may change what they are called and where they
// are reachable, and nothing else. Role, active state and username are not here
// — those decide what you can do, so they belong to an admin, and a route that
// let you PATCH your own role would be the whole access model undone.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth/guard";
import { ensureSchema } from "@/lib/db/init";
import { query } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  full_name: z.string().trim().min(1, "A name cannot be empty.").max(128),
  email: z.string().trim().email("That does not look like an email address.").max(255)
    .or(z.literal("")).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That could not be saved.",
    }, { status: 400 });
  }

  await ensureSchema();
  const email = parsed.data.email?.trim() ? parsed.data.email.trim() : null;

  // Two people reachable at one address makes "who did this" unanswerable.
  if (email) {
    const clash = await query<{ id: number }>(
      `SELECT id FROM apsomh_users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1`,
      [email, user.id],
    );
    if (clash.rows[0]) {
      return NextResponse.json({ ok: false, error: "Somebody else already uses that address." }, { status: 409 });
    }
  }

  await query(
    `UPDATE apsomh_users SET full_name = $1, email = $2, updated_at = NOW() WHERE id = $3`,
    [parsed.data.full_name.trim(), email, user.id],
  );
  await query(
    `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
    [user.username, "profile.update", JSON.stringify({ full_name: parsed.data.full_name.trim(), email })],
  ).catch(() => { /* never fail the change because the log did */ });

  return NextResponse.json({ ok: true });
}
