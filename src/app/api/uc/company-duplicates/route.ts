// COMPANY DUPLICATES (src/lib/companyDuplicates). The hub's check of every company, every hour: the same ERP customer
// (merged by the hub once Live and the COMPANIES FULL DUPLICATE CHECK workflow is off), possible duplicates for a person.
// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (up to 365 days): settings, the last read and its groups, the workflow's state, the
//   merges of the period (HubSpot's history), the log.
// GET ?company=ID: one company checked now, nothing stored or written.
// GET ?part=performis: the companies with several customer numbers in a Mandant, each account's new title.
// PUT (admins): mode (off / shadow / live), the rules.
// POST (admins) {action}: "run" read again now; "merge" {key, into?} merge a group of the last read; "apart" {key} keep
//   its companies apart for good.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { getOptionalUser } from "@/lib/auth/guard";
import { describeIntegrationError } from "@/lib/integrations/status";
import { apartCount, askRun, checkCompany, decide, getSettings, history, lastRun, performis, readLog, saveSettings, snapshot, workflowOn, type Mode } from "@/lib/companyDuplicates/engine";
import type { Rules } from "@/lib/companyDuplicates/rules";
import { spanOk } from "@/lib/ticketDuplicates/period";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const c = req.nextUrl.searchParams.get("company");
    if (c && /^\d+$/.test(c)) return NextResponse.json({ configured: true, ok: true, data: await checkCompany(c) });
    // Left alone > Performis: one company, several customer numbers - the accounts' new titles
    if (req.nextUrl.searchParams.get("part") === "performis") return NextResponse.json({ configured: true, ok: true, data: await performis() });
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });
    const span = spanOk(req.nextUrl.searchParams.get("from"), req.nextUrl.searchParams.get("to"), today);
    const [settings, last, snap, wf, log, hist, apart] = await Promise.all([getSettings(), lastRun(), snapshot(), workflowOn(), readLog(), history(), apartCount()]);
    // the merges of the period, as Zurich days
    const day = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });
    const merges = (hist?.events ?? []).filter((e) => { const d = day(e.at); return d >= span.from && d <= span.to; });
    return NextResponse.json({
      configured: true, ok: true,
      data: {
        settings, last, snapshot: snap, workflow: wf, log: log.slice(0, 300), apart, everyMinutes: 60,
        from: span.from, to: span.to, days: span.days,
        history: hist ? { at: hist.at, survivors: hist.survivors, read: hist.read, error: hist.error ?? null, merges } : null,
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
  const b = (await req.json().catch(() => ({}))) as { mode?: Mode; rules?: Partial<Rules> };
  return NextResponse.json({ ok: true, data: await saveSettings(b, `user ${access.userId}`) });
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; key?: string; into?: string };
  try {
    if (b.action === "run") { await askRun(); return NextResponse.json({ ok: true, data: { text: "Reading every company now - a few minutes." } }); }
    if ((b.action === "merge" || b.action === "apart") && typeof b.key === "string" && /^[\d,]+$/.test(b.key)) {
      const u = await getOptionalUser();
      const by = u?.full_name || u?.username || `user ${access.userId}`;
      return NextResponse.json({ ok: true, data: await decide(b.action, b.key, by, typeof b.into === "string" && /^\d+$/.test(b.into) ? b.into : undefined) });
    }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 300) }, { status: 500 });
  }
}
