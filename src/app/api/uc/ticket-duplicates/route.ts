// DUPLICATES & MERGES (src/lib/ticketDuplicates). The hub's check by type - the same request twice, the same order, the
// same erosion win-back - beside the copy of the DUPS workflow; live, it writes the verdict and carries out the decisions
// people take on the ticket card (merge, not a duplicate).
// GET ?days=7|14|21: settings, last runs, the replay, the figures by type and against the workflow, the stored rows,
// the workflows' state, the properties, the decisions waiting and the log. GET ?ticket=ID: one ticket checked, nothing
// stored or written.
// PUT (admins): mode (off / shadow / live), merging (off / on), the types' settings.
// POST (admins) {action}: "run" look now; "replay" the last 7 days again; "properties" create the missing properties;
// "decisions" carry out the waiting decisions now.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { backfillState, checkTicket, decisionsOnce, getSettings, lastDecisions, lastRun, recentRows, replayBackfill, runOnce, saveSettings, type Mode } from "@/lib/ticketDuplicates/engine";
import { measure } from "@/lib/ticketDuplicates/measure";
import { figures } from "@/lib/ticketDuplicates/figures";
import { createProps, propsState } from "@/lib/ticketDuplicates/properties";
import { mergingWorkflowOn, pendingDecisions, readLog, workflowOn } from "@/lib/ticketDuplicates/live";
import type { TypeSettings } from "@/lib/ticketDuplicates/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** the table's rows - the figures are counted over all of them */
const ROWS_SENT = 1000;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const t = req.nextUrl.searchParams.get("ticket");
    if (t && /^\d+$/.test(t)) return NextResponse.json({ configured: true, ok: true, data: await checkTicket(t) });
    const asked = Number(req.nextUrl.searchParams.get("days"));
    const days = [7, 14, 21].includes(asked) ? asked : 14;
    const [settings, last, decided, rows, backfill, dups, merging, props, log] = await Promise.all([
      getSettings(), lastRun(), lastDecisions(), recentRows(days), backfillState(), workflowOn(), mergingWorkflowOn(), propsState(), readLog(),
    ]);
    // the decisions waiting: only once the property exists
    const pending = props.have.includes("dup_decision") ? await pendingDecisions().catch(() => []) : [];
    return NextResponse.json({
      configured: true, ok: true,
      data: {
        settings, last, decided, backfill, everyMinutes: 3, days, rows: rows.slice(0, ROWS_SENT), totalRows: rows.length,
        figures: figures(rows), measure: measure(rows, settings.exclusions), workflows: { dups, merging }, props, pending, log: log.slice(0, 200),
        admin: access.role === "admin",
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
  const b = (await req.json().catch(() => ({}))) as { mode?: Mode; merging?: "off" | "on"; types?: Partial<TypeSettings> };
  return NextResponse.json({ ok: true, data: await saveSettings(b, `user ${access.userId}`) });
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  try {
    if (b.action === "replay") return NextResponse.json({ ok: true, data: await replayBackfill(`user ${access.userId}`) });
    if (b.action === "properties") return NextResponse.json({ ok: true, data: await createProps() });
    if (b.action === "decisions") return NextResponse.json({ ok: true, data: (await decisionsOnce()) ?? { skipped: "merging is off, the properties are missing, or another copy of the hub is at it" } });
    if (b.action !== "run") return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
    return NextResponse.json({ ok: true, data: (await runOnce()) ?? { skipped: "off, or another copy of the hub is running it" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 300) }, { status: 500 });
  }
}
