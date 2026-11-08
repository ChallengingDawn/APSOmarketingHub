// A PAGE TO-DO'S PREVIEW, FOR EVERYONE IN THE PROJECT (08.11.2026): GET ?side=before|after[&fresh=1] answers the page as
// a still picture - the shop's page with the stored changes laid over it, as one HTML document in JSON (the studio shows
// it in a srcDoc frame). A GET, so a reviewer who may only comment sees what they review: the studio's own POST route
// is for editors. Built from the stored document, never from a body sent here (the hub's 8 KB limit).
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { accessFor } from "@/lib/content/sharing";
import { getPiece } from "@/lib/content/workflow";
import { studioKindOf } from "@/lib/content/studio/kinds";
import { readDoc } from "@/lib/content/studio/store";
import { previewOf } from "@/lib/content/studio/kinds/page/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function GET(req: NextRequest, c: { params: Promise<{ pieceId: string }> }) {
  const me = await requireUser();
  const pieceId = Number.parseInt((await c.params).pieceId, 10);
  const piece = Number.isFinite(pieceId) && pieceId > 0 ? await getPiece(pieceId) : null;
  if (!piece || !(await accessFor(piece.projectId, me))) return fail("No such to-do.", 404);
  if (studioKindOf(piece.contentType) !== "page") return fail("This to-do is not a page.");
  const sp = req.nextUrl.searchParams;
  const stored = await readDoc(piece.id);
  const out = await previewOf(stored?.doc ?? null, sp.get("side") === "before" ? "before" : "after", sp.get("fresh") === "1");
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
