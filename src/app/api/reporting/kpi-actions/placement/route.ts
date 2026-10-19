// Promote a tile to "In a nutshell" or demote it to its tab - one choice for everyone (SARCLA 18.10.2026);
// a KPI there as a small tile or as its page's full card (format, 19.10).
import { NextRequest, NextResponse } from "next/server";
import { setPlacement, type Placement, type TileFormat, type TileSpec } from "@/lib/reporting/kpiActions";
import { fail, who } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const b = (await req.json().catch(() => ({}))) as { spec?: TileSpec; placement?: Placement; format?: TileFormat };
  const s = b.spec;
  if (!s || typeof s.key !== "string" || !/^[a-z0-9-]+:/i.test(s.key) || typeof s.page !== "string" || !s.title) return fail("the tile is missing", 400);
  if (b.placement !== "nutshell" && b.placement !== "tab") return fail("placement is nutshell or tab", 400);
  const spec: TileSpec = {
    key: s.key.slice(0, 120), page: s.page.slice(0, 40), title: String(s.title).slice(0, 160), kind: s.kind === "card" ? "card" : "kpi",
    ...(s.tab ? { tab: String(s.tab).slice(0, 40) } : {}), ...(s.kpiId ? { kpiId: String(s.kpiId).slice(0, 20) } : {}),
    ...(s.filters ? { filters: s.filters } : {}), ...(s.from ? { from: String(s.from).slice(0, 7) } : {}), ...(s.to ? { to: String(s.to).slice(0, 7) } : {}),
    ...(s.href && String(s.href).startsWith("/reporting/") ? { href: String(s.href).slice(0, 500) } : {}),
  };
  const format = b.format === "tile" || b.format === "half" || b.format === "card" ? b.format : undefined;
  try { await setPlacement(spec, b.placement, w.name, format); return NextResponse.json({ ok: true }); } catch (e) { return fail(e); }
}
