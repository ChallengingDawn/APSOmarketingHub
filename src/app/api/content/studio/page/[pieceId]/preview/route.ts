// A PAGE TO-DO'S PREVIEW, FOR EVERYONE IN THE PROJECT (08.11.2026): GET ?side=before|after|shell[&lang=fr-CH][&fresh=1] answers the page as
// a still picture - the shop's page with the stored changes laid over it, as one HTML document in JSON (the studio shows
// it in a srcDoc frame). A GET, so a reviewer who may only comment sees what they review: the studio's own POST route
// is for editors. Built from the stored document, never from a body sent here (the hub's 8 KB limit). `lang` = one
// store view of the page; `shell` = the store's page a new page shows in (the studio draws the page into it as it is typed).
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { accessFor } from "@/lib/content/sharing";
import { getPiece } from "@/lib/content/workflow";
import { studioKindOf } from "@/lib/content/studio/kinds";
import { readDoc, studioVersions } from "@/lib/content/studio/store";
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
  // ?version=<id>: one of its versions, looked at before it is brought back (09.11.2026)
  const version = Number(sp.get("version") ?? "");
  const stored = version > 0 ? await studioVersions(piece.id).then((all) => all.find((x) => x.id === version) ?? null) : await readDoc(piece.id);
  if (version > 0 && !stored) return fail("That version is not this to-do's.", 404);
  const side = sp.get("side") === "before" ? "before" : sp.get("side") === "shell" ? "shell" : "after";
  // a store view ("fr-CH") - or, from an older page, a language ("fr")
  const lang = /^[a-z]{2}(-[A-Z]{2,3})?$/.test(sp.get("lang") ?? "") ? sp.get("lang") : null;
  const out = await previewOf(stored?.doc ?? null, side, sp.get("fresh") === "1", lang);
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
