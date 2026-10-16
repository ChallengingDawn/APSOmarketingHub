// DirectCut: what the c2s-middleware on Railway says about the cut-to-size chain — the open work, what was
// cut, the shelf, and the health of the feed behind it. Read for the hub's page (Website's grant).
//
// READ-ONLY on purpose. The middleware is the reservation authority and single-instance by design (see
// src/lib/directcut/gateway.ts), so nothing here reserves, cancels or moves a stage; acting on a line stays
// in the Railway dashboard. The only change an admin can make is which gateway address the hub reads.
//
// Same three answers as every integration route: not configured, upstream failed (with the reason), or data.
//   GET  ?part=board | status
//   POST { action: "gateway", url }

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { requireUser } from "@/lib/auth/guard";
import { adminKey, board, gatewaySetting, setGateway, status } from "@/lib/directcut/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (err: unknown) => NextResponse.json({
  configured: true,
  ok: false,
  error: String((err as Error)?.message ?? err),
  status: (err as { status?: number })?.status ?? null,
});

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  if (!adminKey()) return NextResponse.json({ configured: false, missing: ["C2S_ADMIN_KEY"] });
  const part = req.nextUrl.searchParams.get("part") || "board";
  try {
    const setting = await gatewaySetting();
    const isAdmin = access.role === "admin";
    if (part === "board") {
      /* the slim projection, built on the server: the middleware's own answer is 967 KB, mostly cut-done
         history and per-plate rows the page never shows (gateway.slim) */
      return NextResponse.json({ configured: true, ok: true, data: { board: await board(), setting, isAdmin } });
    }
    if (part === "status") {
      return NextResponse.json({ configured: true, ok: true, data: await status(setting, isAdmin) });
    }
    return NextResponse.json({ configured: true, ok: false, error: "Unknown part.", status: 400 });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; url?: unknown };
  const me = await requireUser();
  const who = me.full_name || me.username;
  try {
    if (body.action === "gateway") {
      if (typeof body.url !== "string") return NextResponse.json({ ok: false, error: "No address given." }, { status: 400 });
      const setting = await setGateway(body.url, who);
      console.log(`[directcut] gateway address set to ${setting.url} by ${who}`);
      return NextResponse.json({ ok: true, data: { setting } });
    }
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String((err as Error)?.message ?? err) }, { status: 502 });
  }
}
