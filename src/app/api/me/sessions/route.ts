// WHERE YOU ARE SIGNED IN.
//
// Yours only — there is no way to ask about anybody else's, by id or otherwise.
// An admin who needs to end somebody's session suspends the account, which is
// visible in the audit log; this is the self-service half.

import { NextRequest, NextResponse } from "next/server";
import { currentSid, getOptionalUser } from "@/lib/auth/guard";
import { query } from "@/lib/db/client";
import { deviceLabel, listSessions, revokeOtherSessions, revokeSession } from "@/lib/auth/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const u = await getOptionalUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const here = await currentSid();
  const rows = await listSessions(u.id);
  return NextResponse.json({
    ok: true,
    // The sid is not sent back. The browser needs to tell the rows apart and
    // name one of them, not to hold a handle on a session it is not using.
    sessions: rows.map((s, i) => ({
      id: String(i),
      sid: s.sid,
      label: deviceLabel(s.user_agent),
      ip: s.ip,
      since: s.created_at,
      lastSeen: s.last_seen,
      current: !!here && s.sid === here,
    })),
    // Sessions from before the device list existed carry no row, so somebody
    // may be signed in somewhere this cannot see until that token expires.
    legacy: !here,
  });
}

/** `?sid=` ends one; no sid ends everything except the browser asking. */
export async function DELETE(req: NextRequest) {
  const u = await getOptionalUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const here = await currentSid();
  const sid = req.nextUrl.searchParams.get("sid");

  if (sid && sid === here) {
    return NextResponse.json(
      { ok: false, error: "That is this browser. Use Sign out." },
      { status: 400 },
    );
  }

  const ended = sid ? await revokeSession(u.id, sid) : await revokeOtherSessions(u.id, here);
  await query(
    `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
    [u.username, "session.revoked", JSON.stringify({ userId: u.id, ended, one: !!sid })],
  ).catch(() => {});
  return NextResponse.json({ ok: true, ended });
}
