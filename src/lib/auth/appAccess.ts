// ENFORCING WHO MAY OPEN WHICH APP.
//
// The grants were being stored, audited and drawn, and read by nothing: any
// signed-in person could open any app, and a viewer could walk into one through
// a sub-page even when the tile said no access. This is the half that bites.
//
// Server-side on purpose. A hidden tile is a courtesy; a guard is the rule. Both
// exist, and only this one is load-bearing.

import { redirect } from "next/navigation";
import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";
import { getOptionalUser } from "./guard";
import { APP_KEYS, STARTER_GRANTS, canOpen, canWrite, type AppKey, type Level, type Role } from "./access";

export type MyAccess = {
  userId: number;
  role: Role;
  /** app key -> what they were granted. Absent means nothing. */
  grants: Record<string, Level>;
  canOpen: (app: AppKey) => boolean;
  canWrite: (app: AppKey) => boolean;
};

/** The signed-in person's role and grants, or null when nobody is signed in. */
export async function myAccess(): Promise<MyAccess | null> {
  const u = await getOptionalUser();
  if (!u) return null;
  await ensureSchema();
  const r = await query<{ app_key: string; level: Level }>(
    `SELECT app_key, level FROM apsomh_user_app_access WHERE user_id = $1`,
    [u.id],
  );
  const grants: Record<string, Level> = {};
  for (const row of r.rows) grants[row.app_key] = row.level;
  const role = u.role as Role;
  return {
    userId: u.id,
    role,
    grants,
    canOpen: (app) => canOpen(role, grants[app]),
    canWrite: (app) => canWrite(role, grants[app]),
  };
}

/**
 * Give a brand-new account the apps everybody starts with.
 *
 * Written once, at creation, and never re-applied: a grant an admin has since
 * taken away must stay taken away, so this is not a floor the account keeps
 * falling back to. An admin needs no rows at all.
 */
export async function grantStarterApps(userId: number, role: Role): Promise<void> {
  if (role === "admin") return;
  await ensureSchema();
  for (const [app, level] of Object.entries(STARTER_GRANTS)) {
    await query(
      `INSERT INTO apsomh_user_app_access (user_id, app_key, level)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, app_key) DO NOTHING`,
      [userId, app, level],
    );
  }
}

/**
 * Gate a page on an app.
 *
 * Sends somebody who may not be here back to the front door with the reason, so
 * they get "you do not have this one" rather than a blank screen or a crash.
 */
export async function requireApp(app: AppKey): Promise<MyAccess> {
  const access = await myAccess();
  if (!access) redirect("/signin");
  if (!access.canOpen(app)) redirect(`/?denied=${app}`);
  return access;
}

export { appForPath } from "./access";
export { APP_KEYS };

