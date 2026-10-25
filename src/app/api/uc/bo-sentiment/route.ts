// BACK OFFICE SENTIMENT - the hub's half of the HubSpot workflow "SARCLA | BO SENTIMENT AND TONE"
// (flow 4333972706). Shadow by default: the hub works out the customer's tone and whether we
// resolved the matter, stores it beside what the workflow itself wrote, and writes nothing to
// HubSpot until it is switched to live AND the workflow is switched off (src/lib/boSentiment).
//
// GET: settings, last run, today's model usage, whether the workflow is still on, the figures and
//      the latest tickets (7 days).
// GET ?ticket=ID: one ticket scored now, nothing stored - with the words that fired, so the
//      answer can be argued with.
// Admins: PUT {mode?, aiOn?, templateRepliesCount?}; POST {action:"run"} to look now.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { getAnthropic } from "@/lib/ai/claude";
import { setLive } from "@/lib/connectors/steps/run";
import {
  aiUsedToday, checkTicket, getSettings, lastRun, recentRows, runOnce, saveSettings, windowFigures, workflowOn,
  type Mode,
} from "@/lib/boSentiment/engine";
import { AI_PER_DAY, AI_PER_RUN } from "@/lib/boSentiment/ai";
import { headline, summarise } from "@/lib/boSentiment/measure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The model is optional: without a key the keyword layer still answers, and the page says so. */
function client() {
  try {
    return getAnthropic();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  try {
    const t = sp.get("ticket");
    if (t && /^\d+$/.test(t)) {
      return NextResponse.json({ configured: true, ok: true, data: await checkTicket(t, client()) });
    }
    // Two sources on purpose. The FIGURES come from HubSpot for whatever period was asked for,
    // because the two values live on the ticket and the whole history can be counted. The ROWS -
    // which ticket, which words fired, what the model said - exist only in the 21-day store, so
    // the detail tables say the shorter window out loud rather than pretending.
    const days = Math.min(21, Math.max(1, Number(sp.get("days")) || 7));
    const iso = (v: string | null, fallback: Date) => {
      const d = v ? new Date(v) : fallback;
      return (Number.isNaN(d.getTime()) ? fallback : d).toISOString();
    };
    const to = iso(sp.get("to"), new Date());
    const from = iso(sp.get("from"), new Date(Date.now() - days * 86400_000));
    const [settings, last, rows, usedToday, on, figures] = await Promise.all([
      getSettings(), lastRun(), recentRows(days), aiUsedToday(), workflowOn(),
      windowFigures(from, to).catch(() => null),
    ]);
    const summary = summarise(rows);
    return NextResponse.json({
      configured: true, ok: true,
      data: {
        settings, last, rows: rows.slice(0, 1000), summary, headline: headline(summary), days, figures, detailDays: days,
        workflowOn: on, everyMinutes: 15,
        ai: { usedToday, perRun: AI_PER_RUN, perDay: AI_PER_DAY, available: client() !== null },
        admin: access.role === "admin",
      },
    });
  } catch (e) {
    return NextResponse.json({ configured: true, ok: false, error: describeIntegrationError(e) }, { status: 200 });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  let body: { mode?: unknown; aiOn?: unknown; templateRepliesCount?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }
  const patch: { mode?: Mode; aiOn?: boolean; templateRepliesCount?: boolean } = {};
  if (body.mode === "off" || body.mode === "shadow" || body.mode === "live") patch.mode = body.mode;
  if (typeof body.aiOn === "boolean") patch.aiOn = body.aiOn;
  if (typeof body.templateRepliesCount === "boolean") patch.templateRepliesCount = body.templateRepliesCount;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  try {
    const settings = await saveSettings(patch, access.userId ? `user ${access.userId}` : "admin");
    // ONE control, not two. The sweep only gets its 15-minute rhythm while its connectors step is
    // live, which is a switch on a different page - so a mode set here would have looked set and
    // done nothing. The mode on this page is the gate, and it carries the step with it.
    if (patch.mode) {
      const r = await setLive("bo_sentiment_sweep", patch.mode !== "off");
      if (!r.ok) console.warn(`[bo-sentiment] could not switch the step ${patch.mode !== "off" ? "on" : "off"}: ${r.note}`);
    }
    return NextResponse.json({ ok: true, data: { settings, workflowOn: await workflowOn() } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: describeIntegrationError(e) }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }
  if (body.action !== "run") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  try {
    const info = await runOnce(client(), access.userId ? `user ${access.userId}` : "admin");
    return NextResponse.json({ ok: true, data: { last: info } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: describeIntegrationError(e) }, { status: 200 });
  }
}
