// 3D files > Settings: the gateway's address, and every place that names it, read live.
// GET: Website's grant (the checks only read public pages and files). PUT: admins only - it
// changes where the hub reads the 3D service. Nothing on the shop or in HubSpot is written:
// the tab hands out the snippets, a person pastes them.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { requireUser } from "@/lib/auth/guard";
import { checkPlaces, gatewaySetting, setGateway, type Place } from "@/lib/threeD/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Six shop pages and two files per check: held ten minutes, unless somebody asks again. */
const HOLD_MS = 10 * 60_000;
let held: { gateway: string; at: number; places: Place[] } | null = null;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const setting = await gatewaySetting();
    const fresh = held && held.gateway === setting.url && Date.now() - held.at < HOLD_MS;
    if (!fresh || req.nextUrl.searchParams.get("refresh") === "1") {
      held = { gateway: setting.url, at: Date.now(), places: await checkPlaces(setting.url) };
    }
    return NextResponse.json({
      configured: true, ok: true,
      data: { setting, places: held!.places, checkedAt: new Date(held!.at).toISOString(), isAdmin: access.role === "admin" },
    });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, error: String((err as Error)?.message ?? err), status: null });
  }
}

export async function PUT(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { url?: unknown };
  if (typeof body.url !== "string") return NextResponse.json({ ok: false, error: "No address given." }, { status: 400 });
  const me = await requireUser();
  try {
    const setting = await setGateway(body.url, me.full_name || me.username);
    held = null;
    console.log(`[3d] gateway address set to ${setting.url} by ${setting.by}`);
    return NextResponse.json({ ok: true, data: { setting } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String((err as Error)?.message ?? err) }, { status: 400 });
  }
}
