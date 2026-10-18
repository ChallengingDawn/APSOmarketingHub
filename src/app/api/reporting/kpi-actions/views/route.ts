// Saved views - a named set of a page's filters (its URL query), personal unless shared (SARCLA 18.10.2026).
import { NextRequest, NextResponse } from "next/server";
import { deleteView, saveView, updateView, viewsOf } from "@/lib/reporting/kpiActions";
import { fail, who } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// the query a view keeps: the page's own parameters, never a full address
const cleanQuery = (q: unknown) => String(q ?? "").replace(/^\?/, "").slice(0, 2000);

export async function GET(req: NextRequest) {
  const w = await who();
  if (w instanceof NextResponse) return w;
  const page = req.nextUrl.searchParams.get("page") ?? "";
  if (!page) return fail("page is missing", 400);
  try { return NextResponse.json({ ok: true, views: await viewsOf(page, w.userId) }); } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const b = (await req.json().catch(() => ({}))) as { page?: string; name?: string; query?: string; shared?: boolean };
  if (!b.page || !b.name?.trim()) return fail("a view needs its page and a name", 400);
  try {
    const id = await saveView({ page: b.page.slice(0, 40), name: b.name.trim(), query: cleanQuery(b.query), shared: !!b.shared, ownerId: w.userId, ownerName: w.name });
    return NextResponse.json({ ok: true, id });
  } catch (e) { return fail(e); }
}

export async function PATCH(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const b = (await req.json().catch(() => ({}))) as { id?: number; name?: string; shared?: boolean; query?: string };
  if (!Number.isInteger(b.id)) return fail("id is missing", 400);
  try {
    const ok = await updateView(b.id as number, w.userId, { name: b.name?.trim() || undefined, shared: b.shared, query: b.query === undefined ? undefined : cleanQuery(b.query) });
    return ok ? NextResponse.json({ ok: true }) : fail("only its owner changes a view", 403);
  } catch (e) { return fail(e); }
}

export async function DELETE(req: NextRequest) {
  const w = await who(true);
  if (w instanceof NextResponse) return w;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return fail("id is missing", 400);
  try {
    const ok = await deleteView(id, w.userId);
    return ok ? NextResponse.json({ ok: true }) : fail("only its owner removes a view", 403);
  } catch (e) { return fail(e); }
}
