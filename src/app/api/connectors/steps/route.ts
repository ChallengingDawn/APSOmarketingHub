// The connector steps that have moved to the hub: their last preview and live
// run, whether they are live, and what the connector says it skips (GET); start a
// preview or a run, or switch a step live - or every step the connector has handed
// over at once (POST, admins only).

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { HUB_STEPS, busy, connectorSkips, isHubStep, lastRun, liveSteps, setLive, sftpConfigured, startStep } from "@/lib/connectors/steps/run";
import { stepDef } from "@/lib/connectors/steps/registry";
import { STEPS } from "@/lib/connectors/compass";
import { addChainDay, chainHistory, hubChain, type ChainDay, type HubChain } from "@/lib/connectors/chainStatus";
import { flowRunning, flowStale, heldFlow, refreshFlow } from "@/lib/connectors/flow";
import { writtenCount } from "@/lib/connectors/summary";
import { REGISTRY } from "@/lib/connectors/steps/registry";
import { lastPull } from "@/lib/connectors/sftp";
import { describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The first history entry, from each chain step's last live run - the run before the history began. */
async function seed(c: HubChain): Promise<ChainDay> {
  const written: Record<string, number> = {};
  for (const def of REGISTRY.filter((d) => d.cadence === "chain")) {
    const r = await lastRun("live", def.key);
    if (r?.finished && !r.error && r.finished.slice(0, 10) === c.day) written[def.key] = writtenCount(r.result);
  }
  return { day: c.day, ts: c.ts, files: c.pulled, mb: Math.round((c.files ?? []).reduce((a, f) => a + f.mb, 0)), seconds: c.pullSeconds, failed: c.steps.filter((x) => !x.ok).length, written };
}

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
      pull: (await lastPull().catch(() => null))?.last ?? null,
      history: await history(),
      flow: await flow(),
    } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

async function history(): Promise<ChainDay[]> {
  let h = await chainHistory().catch(() => [] as ChainDay[]);
  const c = await hubChain();
  if (!h.length && c?.status === "done") {
    const first = await seed(c);
    await addChainDay(first).catch(() => {});
    h = [first];
  }
  return h;
}

async function flow() {
  const f = await heldFlow();
  if (flowStale(f) && !flowRunning(f)) refreshFlow();
  return { days: f?.days ?? [], at: f?.at || null, counting: flowRunning(f) || flowStale(f), error: f?.error ?? null };
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { key?: string; action?: string; full?: boolean };
  if (b.action === "live-on-all") {
    // only what the connector has let go: setLive asks it again for each step
    const [skips, live] = await Promise.all([connectorSkips(), liveSteps()]);
    if (!skips) return NextResponse.json({ ok: false, error: "The connector cannot be asked - not switching" }, { status: 409 });
    const on: string[] = [];
    const refused: string[] = [];
    for (const k of HUB_STEPS) {
      // Compass steps only: wrong owners has its own page in UC & HubSpot Apps
      if (live.has(k) || !skips.has(k) || !STEPS.some((s) => s.key === k)) continue;
      const r = await setLive(k, true);
      if (r.ok) on.push(k);
      else refused.push(r.note);
    }
    console.log(`[connectors] switch-over by user ${access.userId}: ${on.length} steps on in the hub (${on.join(", ")})${refused.length ? `; refused: ${refused.join(" | ")}` : ""}`);
    const note = `${on.length} step${on.length === 1 ? "" : "s"} switched on in the hub${refused.length ? ` - ${refused.length} refused: ${refused.join("; ")}` : ""}`;
    return NextResponse.json({ ok: true, data: { note, on, refused } });
  }
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
