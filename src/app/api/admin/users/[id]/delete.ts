// Shared guards for removing an account, kept beside the route that uses them
// so the rules and the endpoint cannot drift apart.
//
// Deleting a person is the one admin action with no undo, so it is the one with
// the most refusals: not yourself, not the last admin, and never as a way to
// end a session — that is what suspending is for.

import { query } from "@/lib/db/client";

export type DeleteRefusal = { ok: false; error: string; status: number };

export async function whyNotDelete(meId: number, targetId: number): Promise<DeleteRefusal | null> {
  if (meId === targetId) {
    return { ok: false, error: "You cannot delete your own account. Ask another admin.", status: 400 };
  }
  const t = await query<{ role: string; username: string }>(
    `SELECT role, username FROM apsomh_users WHERE id = $1 LIMIT 1`,
    [targetId],
  );
  const target = t.rows[0];
  if (!target) return { ok: false, error: "That account does not exist.", status: 404 };

  if (target.role === "admin") {
    const admins = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM apsomh_users WHERE role = 'admin' AND is_active`,
    );
    if (Number(admins.rows[0]?.n ?? 0) <= 1) {
      return { ok: false, error: "That is the last admin. Make somebody else an admin first.", status: 400 };
    }
  }
  return null;
}
