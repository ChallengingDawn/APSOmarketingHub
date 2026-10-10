// WRONG OWNERS - the HubSpot app that keeps support tickets in the pipeline of the
// team that owns them. It runs on the hub's schedule every 30 minutes (the same
// engine as the Compass steps, which is where it came from), but it has nothing to
// do with the ERP data, so it is shown and switched here (SARCLA, 10.10.2026).
// GET: is it on, its last live run and test run. POST (admins): a test run, on, off.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { busy, lastRun, liveSteps, setLive, startStep } from "@/lib/connectors/steps/run";
import { describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "wrong_owners";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const [live, run, preview, b] = await Promise.all([liveSteps(), lastRun("live", KEY), lastRun("preview", KEY), busy()]);
    return NextResponse.json({ configured: true, ok: true, data: {
      live: live.has(KEY), run, preview, running: b?.key === KEY ? b : null, otherRunning: !!b && b.key !== KEY, admin: access.role === "admin",
    } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  if (b.action === "preview") return NextResponse.json({ ok: true, data: await startStep(KEY, "preview", `user ${access.userId}`) });
  if (b.action === "live-on" || b.action === "live-off") {
    const r = await setLive(KEY, b.action === "live-on");
    return NextResponse.json({ ok: r.ok, data: r, error: r.ok ? undefined : r.note }, { status: r.ok ? 200 : 409 });
  }
  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
