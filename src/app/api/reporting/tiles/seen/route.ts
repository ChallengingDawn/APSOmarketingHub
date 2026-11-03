// A report page's graphs, said as it draws them (reportTiles.ts) - whoever can open the page; nothing else is kept.
import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { tilesSeen, type SeenTile } from "@/lib/reporting/reportTiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await getOptionalUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { tiles?: unknown };
  const tiles = (Array.isArray(b.tiles) ? b.tiles : []).filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t): SeenTile => ({ path: String(t.path ?? ""), key: String(t.key ?? ""), title: String(t.title ?? ""), kind: String(t.kind ?? "card"), kpiId: typeof t.kpiId === "string" ? t.kpiId : null }));
  try { return NextResponse.json({ ok: true, seen: await tilesSeen(tiles) }); }
  catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 }); }
}
