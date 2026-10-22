// BACK OFFICE DISTRIBUTION - shadow mode (SARCLA 18.10.2026). The hub works out what the HubSpot distribution
// workflows decide for every new Back Office / GQS ticket and compares it with what HubSpot really did; it writes
// nothing to HubSpot (src/lib/boDistribution).
// GET: settings, last run, replay state, figures, the latest tickets (7 days), the tickets waiting for an owner, the
// classifier's lists, the teams.
// GET ?people=1: everyone in a team - chat status, open tickets, deactivated - and the active owners to pick from.
// GET ?ticket=ID: one ticket decided now, nothing stored.
// POST {action: "classify", subject, content}: the classifier on any text (read-only, for everyone with access).
// Admins: PUT {mode?, rosters?} - the teams the hub uses (a list set to null goes back to the workflow's);
// POST {action: "run"} look now; POST {action: "replay"} replay the last 7 days.
// POST {action: "catchup", from, to} (ISO times, at most 24 h apart, within the last 3 days): after an outage, decide
// and write every ticket that entered New inside that window as if it had just arrived (engine.ts catchUp) - runs in
// the background; POST {action: "catchup-state"} reads its outcome.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import {
  backfillState, catchUp, catchUpState, checkTicket, classifierFixes, classifierInfo, getSettings, lastRun, legacyRosters, people, pipelineStages, recentRows, replayFrom,
  rosterLabels, runOnce, saveSettings, strayState, tryClassifier, workflowsOn,
} from "@/lib/boDistribution/engine";
import { DEFAULT_PRIORITY, PEOPLE, PRIORITY_TABLE, type Person, type PrioritySettings, type RosterKey } from "@/lib/boDistribution/rules";
import { DEFAULT_HUB, type HubOptions, type Settings } from "@/lib/boDistribution/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  try {
    if (sp.get("people")) return NextResponse.json({ configured: true, ok: true, data: await people() });
    const t = sp.get("ticket");
    if (t && /^\d+$/.test(t)) return NextResponse.json({ configured: true, ok: true, data: await checkTicket(t) });
    const [settings, last, rows, backfill, stages, strays, workflows] = await Promise.all([getSettings(), lastRun(), recentRows(7), backfillState(), pipelineStages().catch(() => ({ bo: [], gqs: [], eso: [], tsa: [], gqsClosed: [], boClosed: [], esoClosed: [], tsaClosed: [] })), strayState(), workflowsOn().catch(() => ({ bo: null, gqs: null }))]);
    return NextResponse.json({
      configured: true, ok: true,
      data: {
        settings, last, backfill, everyMinutes: 2, rows: rows.slice(0, 1500), strays, workflows, admin: access.role === "admin",
        legacy: legacyRosters, labels: rosterLabels, deactivated: [PEOPLE.adriana, PEOPLE.vanessa], classifier: classifierInfo(), fixes: classifierFixes, stages,
        priorityTable: PRIORITY_TABLE, defaults: { hub: DEFAULT_HUB, priority: DEFAULT_PRIORITY },
      },
    });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as {
    mode?: "off" | "shadow"; rosters?: Partial<Record<RosterKey, Person[] | null>>; live?: Partial<Settings["live"]>;
    hub?: Partial<HubOptions>; priority?: Partial<PrioritySettings>;
  };
  return NextResponse.json({ ok: true, data: await saveSettings(b, `user ${access.userId}`) });
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; subject?: string; content?: string; from?: string; to?: string };
  if (b.action === "classify") {
    if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
    return NextResponse.json({ ok: true, data: tryClassifier(String(b.subject ?? "").slice(0, 2000), String(b.content ?? "").slice(0, 6000)) });
  }
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  try {
    if (b.action === "replay") { await replayFrom(); return NextResponse.json({ ok: true, data: { replay: "started - the next runs replay the last 7 days" } }); }
    if (b.action === "run") return NextResponse.json({ ok: true, data: (await runOnce()) ?? { skipped: "off, or another copy of the hub is running it" } });
    if (b.action === "catchup") {
      const from = Date.parse(String(b.from ?? "")), to = Date.parse(String(b.to ?? ""));
      if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return NextResponse.json({ ok: false, error: "from and to must be ISO times, from before to" }, { status: 400 });
      if (to - from > 24 * 3600_000 || from < Date.now() - 3 * 86400_000 || to > Date.now()) return NextResponse.json({ ok: false, error: "the window must lie within the last 3 days and span at most 24 hours" }, { status: 400 });
      // minutes, not seconds: it answers at once and works on in the background (catchup-state shows the outcome)
      void catchUp(from, to);
      return NextResponse.json({ ok: true, data: { catchup: "started", from: new Date(from).toISOString(), to: new Date(to).toISOString() } });
    }
    if (b.action === "catchup-state") return NextResponse.json({ ok: true, data: await catchUpState() });
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 300) }, { status: 500 });
  }
}
