// A shop tool's gateway, for its hub page (Website > Microservices > O-Ring Expert / Shaft-seal expert /
// Compatibility table / Vulcanised O-rings): status, usage, the page snippet, and the live check of its shop page.
// Reads need Website's grant; changes (the gateway's address, the shop page's address) are admins'.
//   GET  ?part=overview&days=30 | snippet | check&shop=www|acc[&refresh=1]
//   POST { action: "gateway", url } | { action: "path", path }

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { requireUser } from "@/lib/auth/guard";
import { adminKey } from "@/lib/directup/gateway";
import { SHOP_TOOLS, isShopTool, type ToolSnippet, type ToolStatus, type ToolUsage } from "@/lib/shopTools/tools";
import { setToolGateway, setToolPath, toolGateway, toolSetting } from "@/lib/shopTools/gateway";
import { checkTool } from "@/lib/shopTools/check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ tool: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const { tool } = await ctx.params;
  if (!isShopTool(tool)) return NextResponse.json({ error: "No such tool" }, { status: 404 });
  if (!adminKey()) return NextResponse.json({ configured: false, missing: ["DIRECTUP_ADMIN_KEY"] });
  const q = req.nextUrl.searchParams;
  const part = q.get("part") || "overview";
  const isAdmin = access.role === "admin";
  try {
    const setting = await toolSetting(tool);
    if (part === "overview") {
      const days = Math.min(400, Math.max(1, parseInt(q.get("days") || "30", 10) || 30));
      const [status, usage] = await Promise.all([toolGateway<ToolStatus>(tool, "/status"), toolGateway<ToolUsage>(tool, `/usage?days=${days}`)]);
      return NextResponse.json({ configured: true, ok: true, data: { setting, status, usage, isAdmin } });
    }
    if (part === "snippet") {
      const snippet = await toolGateway<ToolSnippet>(tool, "/snippets");
      return NextResponse.json({ configured: true, ok: true, data: { setting, snippet, isAdmin } });
    }
    if (part === "check") {
      if (!setting.shopPath) return NextResponse.json({ configured: true, ok: true, data: null });
      const host = q.get("shop") === "acc" ? "acc" : "www";
      const data = await checkTool({ tool, page: SHOP_TOOLS[tool].page, gateway: setting.url, host, path: setting.shopPath, fresh: q.get("refresh") === "1" });
      return NextResponse.json({ configured: true, ok: true, data });
    }
    return NextResponse.json({ configured: true, ok: false, error: "Unknown part.", status: 400 });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, error: String((err as Error)?.message ?? err), status: (err as { status?: number })?.status ?? null });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only." }, { status: 403 });
  const { tool } = await ctx.params;
  if (!isShopTool(tool)) return NextResponse.json({ ok: false, error: "No such tool" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; url?: unknown; path?: unknown };
  const me = await requireUser();
  const who = me.full_name || me.username;
  try {
    if (body.action === "gateway" && typeof body.url === "string") {
      await setToolGateway(tool, body.url, who);
      console.log(`[shop-tools] ${tool} gateway address set by ${who}`);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "path" && typeof body.path === "string") {
      const path = await setToolPath(tool, body.path);
      console.log(`[shop-tools] ${tool} shop page set to ${path} by ${who}`);
      return NextResponse.json({ ok: true, data: { path } });
    }
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String((err as Error)?.message ?? err) }, { status: 400 });
  }
}
