// Start a segmentation run (admins). A preview (dry=1) writes nothing and is always
// allowed; a real run only once the hub owns the engine (SEGMENTATION_ENGINE=live) -
// before that the connector's engine runs, and two writers would race.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { startAction, type Action } from "@/lib/integrations/segmentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: Action[] = ["run-new", "sweep", "potential", "web", "watch", "recheck"];

export async function POST(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const action = sp.get("do") as Action;
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const dry = sp.get("dry") === "1";
  if (!dry && process.env.SEGMENTATION_ENGINE !== "live") {
    return NextResponse.json({ error: "The Compass connector still runs segmentation - only previews here until the switch." }, { status: 409 });
  }
  if (dry && (action === "watch" || action === "web")) {
    return NextResponse.json({ error: "This one has no preview." }, { status: 400 });
  }
  const r = await startAction(action, {
    dry, limit: Number(sp.get("limit")) || undefined, windowMin: Number(sp.get("window")) || undefined, by: user.username,
  });
  return NextResponse.json({ configured: true, ok: true, data: r });
}
