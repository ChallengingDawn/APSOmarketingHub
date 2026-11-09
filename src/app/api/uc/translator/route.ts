// APSO TRANSLATOR (src/lib/translator) - the Railway translator brought into the hub, SARCLA 08.11.2026.
// GET: settings, the last run, the figures by day (language, inbox, channel, agent, hour), how fast the comment came,
// DeepL's characters this period, the inboxes and the agents by name; ?part=rows adds every comment and reply it made
// (or would make in Preview), with the texts - the Conversations page; ?thread=<id> one conversation as the Help Desk
// shows it (read only).
// PUT (admins): mode (off / preview / live), the inboxes it reads (null = all), replies with "!" (on / off).
// POST (admins) {action: "run"}: look now.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { describeIntegrationError } from "@/lib/integrations/status";
import { pageState, runOnce, saveSettings, threadPreview, type Mode } from "@/lib/translator/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  // ?thread=<id>: one conversation as the Help Desk shows it (the Conversations page's preview)
  const thread = req.nextUrl.searchParams.get("thread");
  if (thread) {
    try {
      return NextResponse.json({ configured: true, ok: true, data: await threadPreview(thread) });
    } catch (err) {
      return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
    }
  }
  // ?part=rows: Conversations, with the texts; else the figures (Overview, Settings)
  const part = req.nextUrl.searchParams.get("part") === "rows" ? "rows" : "overview";
  try {
    return NextResponse.json({ configured: true, ok: true, data: { ...(await pageState(part)), admin: access.role === "admin" } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { mode?: Mode; inboxes?: string[] | null; replies?: boolean };
  return NextResponse.json({ ok: true, data: await saveSettings(b, `user ${access.userId}`) });
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  if (b.action !== "run") return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, data: (await runOnce()) ?? { skipped: "off, or another copy of the hub is at it" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 300) }, { status: 500 });
  }
}
