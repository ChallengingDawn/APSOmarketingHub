// 3D files > Settings > AP-Link: which AP-Link system the 3D files come from, and how each one answers.
// GET: Website's grant (it only reads the gateway's status). PUT: admins only - it changes where the
// shop's downloads, the product pages' 3D button and the HubSpot card get their files.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { requireUser } from "@/lib/auth/guard";
import { isSandbox } from "@/lib/sandbox/mode";
import { aplinkSetting, liveStatus, switchAplink } from "@/lib/threeD/aplink";
import { isAplinkTarget } from "@/lib/threeD/gwApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const [status, setting] = await Promise.all([liveStatus(req.nextUrl.searchParams.get("refresh") === "1"), aplinkSetting()]);
    return NextResponse.json({
      configured: true, ok: true,
      data: { aplink: status.aplink, setting, isAdmin: access.role === "admin" && !isSandbox(), at: new Date().toISOString() },
    });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, error: String((err as Error)?.message ?? err), status: null });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { target?: unknown };
  if (!isAplinkTarget(body.target)) return NextResponse.json({ ok: false, error: "Choose production or test." }, { status: 400 });
  const me = await requireUser();
  const by = me.full_name || me.username;
  try {
    const { setting, status } = await switchAplink(body.target, by);
    console.log(`[3d] AP-Link switched to ${setting.target} by ${by}`);
    return NextResponse.json({ ok: true, data: { aplink: status.aplink, setting } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String((err as Error)?.message ?? err) }, { status: 502 });
  }
}
