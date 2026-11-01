// Put a nutshell panel's tiles in order - dragged there by holding the mouse on a tile; one order for
// everyone, as promote and demote are (SARCLA 19.10.2026).
import { NextRequest, NextResponse } from "next/server";
import { reportPathOfPage } from "@/lib/auth/tree";
import { setOrder } from "@/lib/reporting/kpiActions";
import { fail, who } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as { scope?: unknown; keys?: unknown };
  const w = await who(true, typeof b.scope === "string" ? reportPathOfPage(b.scope) : null);
  if (w instanceof NextResponse) return w;
  const scope = typeof b.scope === "string" ? b.scope.trim() : "";
  if (!/^nutshell:[a-z0-9-]+$/i.test(scope) || scope.length > 60) return fail("scope is nutshell:<stage>", 400);
  if (!Array.isArray(b.keys) || b.keys.length > 80 || !b.keys.every((k) => typeof k === "string" && k.length > 0 && k.length <= 120)) return fail("keys are the tiles' keys, first to last", 400);
  try { await setOrder(scope, [...new Set(b.keys as string[])], w.name); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
