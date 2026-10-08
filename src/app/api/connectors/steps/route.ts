// The connector steps that have moved to the hub: their last preview and live
// run, whether they are live, and what the connector says it skips (GET); start a
// preview or a run, or switch a step live (POST, admins only).

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { HUB_STEPS, busy, connectorSkips, isHubStep, lastRun, liveSteps, setLive, sftpConfigured, startStep } from "@/lib/connectors/steps/run";
import { stepDef } from "@/lib/connectors/steps/registry";
import { hubChain } from "@/lib/connectors/chainStatus";
import { describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("connectors")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const [live, skips, running] = await Promise.all([liveSteps(), connectorSkips(), busy()]);
    const steps = await Promise.all(HUB_STEPS.map(async (k) => ({
      key: k, live: live.has(k), connectorSkips: skips ? skips.has(k) : null,
      file: stepDef(k)?.file ?? null, cadence: stepDef(k)?.cadence ?? null,
      preview: await lastRun("preview", k), run: await lastRun("live", k),
    })));
    return NextResponse.json({ configured: true, ok: true, data: {
      steps, running, connectorReachable: skips !== null, sftpConfigured: sftpConfigured(),
      connectorPulls: skips ? !skips.has("sftp_pull") : null, chain: await hubChain(),
    } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { key?: string; action?: string; full?: boolean };
  if (!b.key || !isHubStep(b.key)) return NextResponse.json({ ok: false, error: "Unknown step" }, { status: 400 });
  const by = `user ${access.userId}`;
  if (b.action === "preview") return NextResponse.json({ ok: true, data: await startStep(b.key, "preview", by, !!b.full) });
  if (b.action === "run") {
    if (!(await liveSteps()).has(b.key)) return NextResponse.json({ ok: false, error: "This step is not live in the hub - preview only" }, { status: 409 });
    return NextResponse.json({ ok: true, data: await startStep(b.key, "live", by, !!b.full) });
  }
  if (b.action === "live-on" || b.action === "live-off") {
    const r = await setLive(b.key, b.action === "live-on");
    return NextResponse.json({ ok: r.ok, data: r, error: r.ok ? undefined : r.note }, { status: r.ok ? 200 : 409 });
  }
  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
