// THE PEOPLE, AND WHAT EACH MAY OPEN.
//
// Real accounts out of apsomh_users, real grants out of apsomh_user_app_access.
// Admin only — this screen is how access is given, so reading it is already
// privileged information about who can see what.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth/guard";
import { ensureSchema } from "@/lib/db/init";
import { query } from "@/lib/db/client";
import { APP_KEYS, type Level, type Role } from "@/lib/auth/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type Person = {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  role: Role;
  is_active: boolean;
  totp_enrolled: boolean;
  last_login: string | null;
  created_at: string | null;
  /** app key -> what they were granted. Absent means nothing. */
  access: Record<string, Level>;
};

async function admin() {
  const u = await getOptionalUser();
  if (!u) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (u.role !== "admin") return { error: NextResponse.json({ error: "Admins only" }, { status: 403 }) };
  return { user: u };
}

export async function GET() {
  const gate = await admin();
  if (gate.error) return gate.error;
  await ensureSchema();

  const people = await query<Omit<Person, "access">>(
    `SELECT id, username, full_name, email, role, is_active, totp_enrolled, last_login, created_at
       FROM apsomh_users ORDER BY is_active DESC, full_name ASC`,
  );
  const grants = await query<{ user_id: number; app_key: string; level: Level }>(
    `SELECT user_id, app_key, level FROM apsomh_user_app_access`,
  );

  const byUser = new Map<number, Record<string, Level>>();
  for (const g of grants.rows) {
    const m = byUser.get(g.user_id) ?? {};
    m[g.app_key] = g.level;
    byUser.set(g.user_id, m);
  }

  return NextResponse.json({
    ok: true,
    people: people.rows.map((p) => ({ ...p, access: byUser.get(p.id) ?? {} })),
  });
}

const Change = z.object({
  userId: z.number().int().positive(),
  appKey: z.enum(APP_KEYS),
  level: z.enum(["none", "read", "write"]),
});

export async function PUT(req: NextRequest) {
  const gate = await admin();
  if (gate.error) return gate.error;

  const parsed = Change.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "That change is not valid." }, { status: 400 });
  }
  const { userId, appKey, level } = parsed.data;
  await ensureSchema();

  const target = await query<{ role: Role }>(`SELECT role FROM apsomh_users WHERE id = $1`, [userId]);
  if (!target.rows[0]) return NextResponse.json({ ok: false, error: "No such person." }, { status: 404 });
  // An admin already has every app; a grant would be a row that means nothing
  // and a UI that implies it could be taken away one app at a time.
  if (target.rows[0].role === "admin") {
    return NextResponse.json({
      ok: false,
      error: "An admin already has every app. Change the role instead.",
    }, { status: 400 });
  }

  if (level === "none") {
    await query(`DELETE FROM apsomh_user_app_access WHERE user_id = $1 AND app_key = $2`, [userId, appKey]);
  } else {
    await query(
      `INSERT INTO apsomh_user_app_access (user_id, app_key, level, granted_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, app_key)
       DO UPDATE SET level = EXCLUDED.level, granted_by = EXCLUDED.granted_by, updated_at = NOW()`,
      [userId, appKey, level, gate.user!.username],
    );
  }

  // Access changes are exactly what an audit log is for.
  await query(
    `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
    [gate.user!.username, "access.change", JSON.stringify({ userId, appKey, level })],
  ).catch(() => { /* never fail the change because the log did */ });

  return NextResponse.json({ ok: true });
}
