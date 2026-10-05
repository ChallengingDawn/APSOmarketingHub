// WHERE YOU ARE SIGNED IN, AND HOW TO STOP BEING.
//
// The session cookie is a signed token: it proves itself arithmetically and asks
// nothing. That is fast, and it has two consequences nobody wants — changing
// your password leaves every other browser signed in, and there is no list of
// where "every other browser" even is.
//
// So every session now has a row. The token carries its `sid`; the row says
// whether that sid is still allowed. Revoking is a single UPDATE, and it takes
// effect on the next request rather than in twelve hours.
//
// A token minted before this existed has no sid. Those are honoured until they
// expire — a deploy that signs everybody out at once is its own small outage.

import { randomBytes } from "node:crypto";
import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";
import { setSessionCookie, signSession } from "./session";
import type { UserRow } from "@/lib/db/init";

export type SessionRow = {
  sid: string;
  created_at: string;
  last_seen: string;
  user_agent: string | null;
  ip: string | null;
};

/** What the browser told us, trimmed — it is a label, never a credential. */
function describe(req: Request | null): { ua: string | null; ip: string | null } {
  if (!req) return { ua: null, ip: null };
  const ua = req.headers.get("user-agent");
  // Behind the load balancer the client address is the first hop in the chain.
  const fwd = req.headers.get("x-forwarded-for");
  return {
    ua: ua ? ua.slice(0, 400) : null,
    ip: fwd ? fwd.split(",")[0].trim().slice(0, 60) : null,
  };
}

/**
 * Sign somebody in: one row, one token, one cookie.
 *
 * Everything that completes a login goes through here, so there is no second
 * way to get a session that the list would not know about.
 */
export async function beginSession(u: UserRow, req: Request | null): Promise<string> {
  await ensureSchema();
  const sid = randomBytes(24).toString("base64url");
  const { ua, ip } = describe(req);
  await query(
    `INSERT INTO apsomh_sessions (sid, user_id, user_agent, ip) VALUES ($1, $2, $3, $4)`,
    [sid, u.id, ua, ip],
  );
  await setSessionCookie(await signSession({ uid: u.id, username: u.username, role: u.role, sid }));
  return sid;
}

/**
 * Is this session still allowed — and say it is alive while we are here.
 *
 * One statement rather than a read and a write: the UPDATE returns a row only
 * if the session exists and has not been revoked, so liveness and "last seen"
 * cost the same single round trip that checking alone would.
 */
export async function touchSession(sid: string): Promise<boolean> {
  const r = await query(
    `UPDATE apsomh_sessions SET last_seen = NOW()
      WHERE sid = $1 AND revoked_at IS NULL
      RETURNING sid`,
    [sid],
  );
  return r.rows.length > 0;
}

export async function listSessions(userId: number): Promise<SessionRow[]> {
  await ensureSchema();
  const r = await query<SessionRow>(
    `SELECT sid, created_at, last_seen, user_agent, ip
       FROM apsomh_sessions
      WHERE user_id = $1 AND revoked_at IS NULL
      ORDER BY last_seen DESC
      LIMIT 50`,
    [userId],
  );
  return r.rows;
}

export async function revokeSession(userId: number, sid: string): Promise<number> {
  const r = await query(
    `UPDATE apsomh_sessions SET revoked_at = NOW()
      WHERE user_id = $1 AND sid = $2 AND revoked_at IS NULL RETURNING sid`,
    [userId, sid],
  );
  return r.rows.length;
}

/**
 * Everywhere but here.
 *
 * `keep` is the session asking, so signing out the others does not sign out the
 * person doing it — and a password change can call this without the one who
 * changed it having to sign in again.
 */
export async function revokeOtherSessions(userId: number, keep: string | null): Promise<number> {
  const r = await query(
    `UPDATE apsomh_sessions SET revoked_at = NOW()
      WHERE user_id = $1 AND revoked_at IS NULL AND ($2::text IS NULL OR sid <> $2)
      RETURNING sid`,
    [userId, keep],
  );
  return r.rows.length;
}

/** A readable name for a browser, from the one string it gives us. */
export function deviceLabel(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser =
    /edg\//i.test(ua) ? "Edge"
      : /chrome\//i.test(ua) && !/chromium/i.test(ua) ? "Chrome"
        : /firefox\//i.test(ua) ? "Firefox"
          : /safari\//i.test(ua) && !/chrome/i.test(ua) ? "Safari"
            : "Browser";
  const os =
    /windows nt 10|windows nt 11/i.test(ua) ? "Windows"
      : /windows/i.test(ua) ? "Windows"
        : /iphone|ipad/i.test(ua) ? "iPhone or iPad"
          : /android/i.test(ua) ? "Android"
            : /mac os x/i.test(ua) ? "Mac"
              : /linux/i.test(ua) ? "Linux"
                : "";
  return os ? `${browser} on ${os}` : browser;
}
