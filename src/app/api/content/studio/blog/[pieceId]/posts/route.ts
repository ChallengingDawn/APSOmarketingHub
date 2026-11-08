// THE BLOG'S POSTS, FOR A BLOG TO-DO'S PREVIEW (08.11.2026): GET answers every blog post of the hub this person can see
// (any project), as the blog's home lists them - for everyone in the to-do's project, so a reviewer who may only
// comment sees the home the post lands on. The studio's own POST route is for editors.
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { accessFor } from "@/lib/content/sharing";
import { getPiece } from "@/lib/content/workflow";
import { studioKindOf } from "@/lib/content/studio/kinds";
import { blogCards } from "@/lib/content/studio/kinds/blog/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function GET(_req: Request, c: { params: Promise<{ pieceId: string }> }) {
  const me = await requireUser();
  const pieceId = Number.parseInt((await c.params).pieceId, 10);
  const piece = Number.isFinite(pieceId) && pieceId > 0 ? await getPiece(pieceId) : null;
  if (!piece || !(await accessFor(piece.projectId, me))) return fail("No such to-do.", 404);
  if (studioKindOf(piece.contentType) !== "blog") return fail("This to-do is not a blog post.");
  const cards = await blogCards({ username: me.username, admin: me.role === "admin" });
  return NextResponse.json({ ok: true, cards }, { headers: { "Cache-Control": "no-store" } });
}
