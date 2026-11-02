// DUPLICATES & MERGES (src/lib/ticketDuplicates). The hub's check - the same request twice (100% sure ones merged by the
// hub, the rest for a person), another open ticket on the same order - for every ticket entering Back Office; live, it
// writes on the tickets and carries out the decisions people take on the ticket card.
// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (up to 365 days): settings, the last runs, the year build, the figures of the period,
// the tickets of its lists, the workflows' state, the properties, the decisions waiting and the log.
// GET ?ticket=ID: one ticket checked, nothing stored or written.
// PUT (admins): mode (off / shadow / live), merging (off / on), the types' settings.
// POST (admins) {action}: "run" look now; "year" build the last 365 days again; "properties" create the missing
// properties; "decisions" carry out the waiting decisions now.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { checkTicket, decisionsOnce, getSettings, lastDecisions, lastRun, runOnce, saveSettings, type Mode } from "@/lib/ticketDuplicates/engine";
import { figures, isElsewhereOnly, isHistoryOnly } from "@/lib/ticketDuplicates/figures";
import { createProps, propsState } from "@/lib/ticketDuplicates/properties";
import { mergingWorkflowOn, pendingDecisions, readLog, workflowOn } from "@/lib/ticketDuplicates/live";
import { rowsBetween, spanOk } from "@/lib/ticketDuplicates/store";
import { askYear, yearState } from "@/lib/ticketDuplicates/year";
import type { Row } from "@/lib/ticketDuplicates/model";
import type { TypeSettings } from "@/lib/ticketDuplicates/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** the tickets the lists can show: flagged, never compared, shown only - each with what the lists read */
const LISTED = 6000;
const listed = (r: Row) => !!r.v && (!!r.v.status || !!r.v.excludedBy || isHistoryOnly(r) || isElsewhereOnly(r));
const slim = (r: Row): Row => ({
  key: r.key, ticketId: r.ticketId, enteredAt: r.enteredAt, seenAt: "", subject: r.subject, orderNumber: null, keys: r.keys, sender: r.sender ?? null,
  ownerNames: r.ownerNames, ownerAtCheck: r.ownerAtCheck, v: r.v, dups: r.dups, ...(r.merge ? { merge: { state: r.merge.state, checkedAt: r.merge.checkedAt, checks: r.merge.checks, final: r.merge.final } } : {}),
  ...(r.mergedIn ? { mergedIn: r.mergedIn } : {}), ...(r.live ? { live: r.live } : {}), ...(r.backfill ? { backfill: true as const } : {}),
});

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const t = req.nextUrl.searchParams.get("ticket");
    if (t && /^\d+$/.test(t)) return NextResponse.json({ configured: true, ok: true, data: await checkTicket(t) });
    // the day in Zurich - the time frame on the page is the person's day, not UTC's
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });
    const span = spanOk(req.nextUrl.searchParams.get("from"), req.nextUrl.searchParams.get("to"), today);
    const settings = await getSettings();
    const [last, decided, rows, year, dups, merging, props, log] = await Promise.all([
      lastRun(), lastDecisions(), rowsBetween(span.from, span.to), yearState(), workflowOn(), mergingWorkflowOn(), propsState(), readLog(),
    ]);
    // the decisions waiting: only once the property exists
    const pending = props.have.includes("dup_decision") ? await pendingDecisions().catch(() => []) : [];
    return NextResponse.json({
      configured: true, ok: true,
      data: {
        settings, last, decided, year, everyMinutes: 3, from: span.from, to: span.to, days: span.days,
        figures: figures(rows, span.days), rows: rows.filter(listed).slice(0, LISTED).map(slim),
        workflows: { dups, merging }, props, pending, log: log.slice(0, 300), admin: access.role === "admin",
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
    if (b.action === "year") return NextResponse.json({ ok: true, data: await askYear(`user ${access.userId}`) });
    if (b.action === "properties") return NextResponse.json({ ok: true, data: await createProps() });
    if (b.action === "decisions") return NextResponse.json({ ok: true, data: (await decisionsOnce()) ?? { skipped: "merging is off, the properties are missing, or another copy of the hub is at it" } });
    if (b.action !== "run") return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
    return NextResponse.json({ ok: true, data: (await runOnce()) ?? { skipped: "off, or another copy of the hub is running it" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 300) }, { status: 500 });
  }
}
