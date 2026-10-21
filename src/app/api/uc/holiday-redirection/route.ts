// HOLIDAY REDIRECTION - the HubSpot app that gives an ESO ticket whose owner is out of
// office to the first deputy who is in. It runs on the hub's schedule every 15 minutes
// (the deputy sweep, which used to run beside the Compass connector), but it has nothing
// to do with the ERP data, so it is shown and switched here (SARCLA, 10.10.2026).
// GET: is it on, its last live run and test run. POST (admins): a test run, on, off.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { busy, lastRun, liveSteps, setLive, startStep } from "@/lib/connectors/steps/run";
import { describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "deputy_sweep";
/** The other half: the tasks a deputy should pick up (SARCLA, 21.10.2026). */
const TASK_KEY = "task_deputy_sweep";
const KEYS = new Set([KEY, TASK_KEY]);

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const [live, run, preview, taskRun, taskPreview, b] = await Promise.all([
      liveSteps(), lastRun("live", KEY), lastRun("preview", KEY),
      lastRun("live", TASK_KEY), lastRun("preview", TASK_KEY), busy("sweep"),
    ]);
    return NextResponse.json({ configured: true, ok: true, data: {
      live: live.has(KEY), run, preview,
      tasks: { live: live.has(TASK_KEY), run: taskRun, preview: taskPreview, running: b?.key === TASK_KEY ? b : null },
      running: b?.key === KEY ? b : null,
      otherRunning: !!b && !KEYS.has(b.key), admin: access.role === "admin",
    } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; which?: string };
  // Which half of Holiday redirection: the tickets (default) or the tasks.
  const key = b.which === "tasks" ? TASK_KEY : KEY;
  if (b.action === "preview") return NextResponse.json({ ok: true, data: await startStep(key, "preview", `user ${access.userId}`) });
  if (b.action === "live-on" || b.action === "live-off") {
    const r = await setLive(key, b.action === "live-on");
    return NextResponse.json({ ok: r.ok, data: r, error: r.ok ? undefined : r.note }, { status: r.ok ? 200 : 409 });
  }
  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
