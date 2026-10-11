// One project: the brief, every variation under it, and the conversation.
//
// POST covers the three things that happen to an open project — a variation
// is saved, somebody says something, somebody decides. One route because they
// are one screen, and because a second round-trip to find out whether the
// save landed is how a collaborative page ends up out of date.

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { addComment, addVariant, attachVariant, chooseVariant, getProject } from "@/lib/content/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function idOf(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = idOf((await ctx.params).id);
  if (id === null) return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });

  const found = await getProject(id);
  if (!found) return NextResponse.json({ ok: false, error: "No such project." }, { status: 404 });
  return NextResponse.json({ ok: true, ...found });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const id = idOf((await ctx.params).id);
  if (id === null) return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : null);

  if (action === "variant") {
    const text = str("body");
    if (!text || !text.trim()) {
      return NextResponse.json({ ok: false, error: "A variation needs some content." }, { status: 400 });
    }
    const variant = await addVariant({
      projectId: id,
      channel: str("channel") ?? "studio",
      contentType: str("contentType"),
      language: str("language"),
      label: str("label"),
      title: str("title"),
      body: text,
      imageUrl: str("imageUrl"),
      by: me.username,
    });
    return NextResponse.json({ ok: true, variant });
  }

  if (action === "attach") {
    const contentId = typeof body.contentId === "number" ? body.contentId : null;
    if (contentId === null) {
      return NextResponse.json({ ok: false, error: "Which draft?" }, { status: 400 });
    }
    const variant = await attachVariant(id, contentId, str("label"), me.username);
    return variant
      ? NextResponse.json({ ok: true, variant })
      : NextResponse.json({ ok: false, error: "No such draft." }, { status: 404 });
  }

  if (action === "comment") {
    const text = str("body");
    if (!text || !text.trim()) {
      return NextResponse.json({ ok: false, error: "An empty comment helps nobody." }, { status: 400 });
    }
    const variantId = typeof body.variantId === "number" ? body.variantId : null;
    return NextResponse.json({ ok: true, comment: await addComment(id, variantId, me.username, text.trim()) });
  }

  if (action === "choose") {
    const variantId = typeof body.variantId === "number" ? body.variantId : null;
    await chooseVariant(id, variantId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action "${action}".` }, { status: 400 });
}
