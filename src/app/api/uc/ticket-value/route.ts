// TICKET VALUE - shadow mode (SARCLA 20.10.2026: "bring the workflow SARCLA | TICKET VALUE CALCULATION as a sub app on
// the hub"). The hub works each ticket's value out with the workflow's rules and compares it with what the workflow
// wrote; it writes nothing to HubSpot (src/lib/ticketValue).
// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (the hub's reporting window): settings, last run, the open pipeline, and the ESO and
// TSA tickets created in those days added up per pipeline, path and confidence (figures.ts).
// GET ?list=1&from&to&pipe=both|ESO|TSA&conf=all|high|medium|low|unqualified|(none)&page=N: those tickets, newest first (list.ts).
// GET ?ticket=ID: one ticket worked out now, nothing stored. PUT (admins): mode - off, shadow, or live (writes once the workflow is
// switched off in HubSpot). POST (admins) {action: "run"}: look now.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { betterContext, checkTicket, getSettings, lastRun, liveState, runOnce, saveSettings } from "@/lib/ticketValue/engine";
import { firstOrderState } from "@/lib/ticketValue/firstOrder";
import { pipelineState } from "@/lib/ticketValue/live";
import { figures } from "@/lib/ticketValue/figures";
import { ticketList } from "@/lib/ticketValue/list";
import { sumPeriod, zurichDay, type Pipe } from "@/lib/ticketValue/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const t = req.nextUrl.searchParams.get("ticket");
    if (t && /^\d+$/.test(t)) return NextResponse.json({ configured: true, ok: true, data: await checkTicket(t) });
    const q = req.nextUrl.searchParams;
    const today = zurichDay(Date.now());
    const to = DAY.test(q.get("to") ?? "") ? q.get("to")! : today;
    const from = DAY.test(q.get("from") ?? "") && q.get("from")! <= to ? q.get("from")! : zurichDay(Date.now() - 27 * 86400_000);
    if (q.get("list")) {
      const pipe = (["ESO", "TSA"].includes(q.get("pipe") ?? "") ? q.get("pipe") : "both") as Pipe;
      const page = Math.max(0, Math.min(600, Math.floor(Number(q.get("page")) || 0)));
      return NextResponse.json({ configured: true, ok: true, data: await ticketList(from, to, pipe, q.get("conf") ?? "all", page) });
    }
    const [settings, last, ctx, fo, live, pipeline, figs] = await Promise.all([getSettings(), lastRun(), betterContext(), firstOrderState(), liveState(), pipelineState(), figures()]);
    const period = {
      from, to, readFrom: figs.value?.from ?? null, computing: figs.computing, progress: figs.progress ?? null, error: figs.error ?? null, computedAt: figs.computedAt ?? null,
      sums: figs.value ? sumPeriod(figs.value.buckets, from, to) : null,
    };
    const better = {
      firstOrder: ctx.firstOrder, firstOrderMedian: fo.median, firstOrderN: ctx.firstOrderN, firstOrderAt: ctx.firstOrderAt, pricedArticles: ctx.pricedArticles,
      firstOrderProgress: fo.next ? { done: Object.keys(fo.next.values).length, of: fo.next.companies.length } : null,
    };
    return NextResponse.json({
      configured: true, ok: true,
      data: { settings, last, everyMinutes: 2, better, live, pipeline, period, admin: access.role === "admin" },
    });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { mode?: "off" | "shadow" | "live" };
  return NextResponse.json({ ok: true, data: await saveSettings(b, `user ${access.userId}`) });
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  if (b.action !== "run") return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, data: (await runOnce()) ?? { skipped: "off, or another copy of the hub is running it" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 300) }, { status: 500 });
  }
}
