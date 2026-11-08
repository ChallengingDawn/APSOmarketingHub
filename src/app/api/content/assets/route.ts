// THE HUB'S PICTURES (08.11.2026) - lib/content/assets.ts.
//   GET  ?scope=mine|project|logos|all [&project=<id>] [&before=<id>]   the gallery, newest first
//   POST generate        { prompt, aspect?, overlaySpace?, projectId?, pieceId? }  a picture from a few words
//   POST upload-start    { }                                                   -> a token for the parts
//   POST upload-part     { token, n, data }                                    one part (base64, < 6000 chars)
//   POST upload-finish   { token, parts, kind?, name?, projectId?, pieceId? }  joined, checked, kept
//   POST remove          { id }                                                your own picture (an admin: any)
// Every body stays under the 8 KB limit; a picture's bytes are read from /api/content/assets/<id>.

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { accessFor } from "@/lib/content/sharing";
import {
  addUploadPart, ASPECTS, finishUpload, generatePicture, imagesReady, listAssets, newUploadToken, removeAsset,
  type Aspect, type AssetKind,
} from "@/lib/content/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const int = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

export async function GET(req: NextRequest) {
  const me = await requireUser();
  const sp = req.nextUrl.searchParams;
  const scope = sp.get("scope") ?? "mine";
  const before = int(sp.get("before"));
  const project = int(sp.get("project"));
  if (scope === "project") {
    if (!project || !(await accessFor(project, me))) return fail("No such project.", 404);
    return NextResponse.json({ ok: true, images: imagesReady(), assets: await listAssets({ projectId: project, before }) });
  }
  if (scope === "logos") return NextResponse.json({ ok: true, images: imagesReady(), assets: await listAssets({ kind: "logo", before }) });
  if (scope === "all") return NextResponse.json({ ok: true, images: imagesReady(), assets: await listAssets({ before }) });
  return NextResponse.json({ ok: true, images: imagesReady(), assets: await listAssets({ by: me.username, before }) });
}

export async function POST(req: NextRequest) {
  const me = await requireUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof b.action === "string" ? b.action : "";
  const projectId = int(b.projectId);
  const pieceId = int(b.pieceId);
  // a picture made for a project belongs to it - only someone who may change the project files one there
  if (projectId) {
    const access = await accessFor(projectId, me);
    if (!access?.canEdit) return fail("You cannot add pictures to this project.", 403);
  }
  try {
    if (action === "generate") {
      const aspect = (ASPECTS as readonly string[]).includes(String(b.aspect)) ? (b.aspect as Aspect) : "1:1";
      const r = await generatePicture({ prompt: String(b.prompt ?? ""), aspect, overlaySpace: b.overlaySpace === true, projectId, pieceId, by: me.username });
      return r.ok ? NextResponse.json({ ok: true, asset: r.asset }) : fail(r.error, 502);
    }
    if (action === "upload-start") return NextResponse.json({ ok: true, token: newUploadToken() });
    if (action === "upload-part") {
      await addUploadPart(String(b.token ?? ""), Number(b.n), String(b.data ?? ""), me.username);
      return NextResponse.json({ ok: true });
    }
    if (action === "upload-finish") {
      const kind: AssetKind = b.kind === "logo" ? "logo" : "upload";
      const asset = await finishUpload({
        token: String(b.token ?? ""), parts: Number(b.parts), kind, name: typeof b.name === "string" ? b.name : null, projectId, pieceId, by: me.username,
      });
      return NextResponse.json({ ok: true, asset });
    }
    if (action === "remove") {
      const id = int(b.id);
      if (!id) return fail("Which picture?");
      const ok = await removeAsset(id, { username: me.username, admin: me.role === "admin" });
      return ok ? NextResponse.json({ ok: true }) : fail("Only the person who added a picture removes it.", 403);
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  return fail("Unknown action.");
}
