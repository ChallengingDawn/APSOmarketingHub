// What the signed-in person may open.
//
// The front page needs it to lock the tiles they cannot use. It is a courtesy,
// not the rule — requireApp on each app's layout is what actually stops them —
// but a wall of apps that all turn you away is a worse front door than one that
// says so first.
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { APP_KEYS } from "@/lib/auth/access";
import { appOpen, firstOpenPage } from "@/lib/auth/tree";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    ok: true,
    role: access.role,
    cross: access.cross,
    // an app is open when anything in it is - its front page or one sub-app
    open: Object.fromEntries(APP_KEYS.map((k) => [k, appOpen(k, access.levels)])),
    // every app and sub-app (src/lib/auth/tree.ts), so the side panel and the report lists hide what is not theirs
    levels: access.levels,
    // where an app's tile leads when its front page is not theirs but a sub-app is
    first: Object.fromEntries(APP_KEYS.map((k) => [k, firstOpenPage(k, access.levels)]).filter(([, v]) => v)),
  });
}
