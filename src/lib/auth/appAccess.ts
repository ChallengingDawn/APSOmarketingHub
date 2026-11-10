// ENFORCING WHO MAY OPEN WHICH APP.
//
// The grants were being stored, audited and drawn, and read by nothing: any
// signed-in person could open any app, and a viewer could walk into one through
// a sub-page even when the tile said no access. This is the half that bites.
//
// Server-side on purpose. A hidden tile is a courtesy; a guard is the rule. Both
// exist, and only this one is load-bearing.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";
import { getOptionalUser } from "./guard";
import { APP_KEYS, STARTER_GRANTS, asCross, asRole, crossHiddenApi, type AppKey, type Cross, type Level, type Role } from "./access";
import { accessAt, levelsOf, opensAt, type Grants } from "./tree";

export type MyAccess = {
  userId: number;
  role: Role;
  /** Cross access (access.ts): a person of Angst+Pfister, or null. */
  cross: Cross | null;
  /** node key (an app, a sub-app - tree.ts) -> what they were granted. Absent means their parent's. */
  grants: Grants;
  /** Every node of the tree, as it comes to for them. */
  levels: Record<string, Level>;
  /**
   * May they open / change things in this app - HERE: on the page or API being asked for (the middleware hands its
   * address over, x-hub-path), when a sub-app answers for it; else in the app as such. So every guard that names its
   * app is a sub-app's guard too, without naming the sub-app.
   */
  canOpen: (app: AppKey) => boolean;
  canWrite: (app: AppKey) => boolean;
  /** A page's own level, wherever the menus list it. */
  levelAt: (path: string) => Level;
};

/** The address this request is for, as the middleware wrote it - never the browser's own header (it is overwritten). */
async function requestPath(): Promise<string | null> {
  try { return (await headers()).get("x-hub-path"); } catch { return null; }
}

/** The signed-in person's role and grants, or null when nobody is signed in. */
export async function myAccess(): Promise<MyAccess | null> {
  const u = await getOptionalUser();
  if (!u) return null;
  await ensureSchema();
  const r = await query<{ app_key: string; level: Level }>(
    `SELECT app_key, level FROM apsomh_user_app_access WHERE user_id = $1`,
    [u.id],
  );
  const grants: Grants = {};
  for (const row of r.rows) grants[row.app_key] = row.level;
  const role = asRole(u.role);
  const cross = asCross(u.cross_access);
  const levels = levelsOf(role, grants, cross);
  const path = await requestPath();
  const here = path ? accessAt(path, levels) : null;
  // a sub-app answers for this page or API: its own level decides
  const sub = here?.specific ? here.level : null;
  // a cross-user changes nothing anywhere, and reads none of the hidden reports' data by its address (access.ts)
  const viewOnly = cross === "user" && role !== "admin";
  return {
    userId: u.id,
    role,
    cross,
    grants,
    levels,
    canOpen: (app) => !(viewOnly && path !== null && crossHiddenApi(path)) && opensAt(app, path, levels),
    canWrite: (app) => !viewOnly && (sub !== null ? sub === "write" : levels[app] === "write"),
    levelAt: (p) => accessAt(p, levels).level,
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
  // an admin has every app, a sales leader views every app: neither needs a row
  if (role !== "user") return;
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
 * Can this person change something somewhere - an Edit given on an app or a sub-app? A user who can must carry a
 * second factor, as the editor of before did; one who only views may go without (access.ts mfaRequired).
 */
export async function editsSomewhere(userId: number): Promise<boolean> {
  await ensureSchema();
  const r = await query(`SELECT 1 FROM apsomh_user_app_access WHERE user_id = $1 AND level = 'write' LIMIT 1`, [userId]);
  return r.rows.length > 0;
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
  // A PAGE is the sub-app it is, or the app's own page (its front page, a page its menu does not list) - never "something
  // else in this app is theirs": a person given one sub-app opens that one, and the app's tile leads them into it
  // (tree.ts firstOpenPage). The same rule the side panel and the shell draw with. An API is more lenient (canOpen):
  // a sub-app's page reads its data from its app's APIs.
  const path = await requestPath();
  const here = path ? accessAt(path, access.levels) : null;
  const ok = here && here.specific !== null ? here.level !== "none" : access.canOpen(app);
  if (!ok) redirect(`/?denied=${app}`);
  return access;
}

export { appForPath } from "./access";
export { APP_KEYS };

