// One project: the brief, every variation under it, and the conversation.
//
// POST covers the three things that happen to an open project — a variation
// is saved, somebody says something, somebody decides. One route because they
// are one screen, and because a second round-trip to find out whether the
// save landed is how a collaborative page ends up out of date.

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import {
  addComment, addVariant, archiveProject, attachVariant, chooseVariant, duplicateVariant,
  getProject, labelVariant, removeVariant, setFolder, starProject, updateProject,
} from "@/lib/content/projects";
import { accessFor, membersOf } from "@/lib/content/sharing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function idOf(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const id = idOf((await ctx.params).id);
  if (id === null) return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });

  // A project is its owner's and the people it was shared with - for anyone
  // else it does not exist, rather than existing behind a refusal.
  const access = await accessFor(id, me);
  const found = access ? await getProject(id) : null;
  if (!access || !found) return NextResponse.json({ ok: false, error: "No such project." }, { status: 404 });
  return NextResponse.json({ ok: true, ...found, access, members: await membersOf(id), me: me.username });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const id = idOf((await ctx.params).id);
  if (id === null) return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });

  const access = await accessFor(id, me);
  if (!access) return NextResponse.json({ ok: false, error: "No such project." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : null);

  // Commenters read and comment; saving, attaching and choosing are editing.
  // A star is the reader's own bookmark, not a change to the project, so a
  // commenter may set one.
  if (action !== "comment" && action !== "star" && !access.canEdit) {
    return NextResponse.json({ ok: false, error: "You can comment on this project, not change it." }, { status: 403 });
  }

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

  if (action === "rename") {
    const title = str("title")?.trim();
    if (!title) return NextResponse.json({ ok: false, error: "A project needs a name." }, { status: 400 });
    await updateProject(id, { title });
    return NextResponse.json({ ok: true });
  }

  if (action === "brief") {
    // An empty brief is a real answer — "there isn't one" — so it is stored
    // as null rather than refused.
    const brief = str("brief");
    await updateProject(id, { brief: brief && brief.trim() ? brief.trim() : null });
    return NextResponse.json({ ok: true });
  }

  if (action === "archive") {
    await archiveProject(id, body.archived !== false);
    return NextResponse.json({ ok: true });
  }

  if (action === "folder") {
    // An empty name means "out of every folder", which is a real answer.
    await setFolder(id, str("folder") ?? null);
    return NextResponse.json({ ok: true });
  }

  if (action === "star") {
    // The only action here that does NOT need edit rights: starring is about
    // the person's own list, and anyone who can open a project may keep it.
    await starProject(id, me.username, body.starred !== false);
    return NextResponse.json({ ok: true });
  }

  if (action === "label-variant") {
    const variantId = typeof body.variantId === "number" ? body.variantId : null;
    if (variantId === null) return NextResponse.json({ ok: false, error: "Which version?" }, { status: 400 });
    await labelVariant(variantId, str("label") ?? "", me.username);
    return NextResponse.json({ ok: true });
  }

  if (action === "remove-variant") {
    const variantId = typeof body.variantId === "number" ? body.variantId : null;
    if (variantId === null) return NextResponse.json({ ok: false, error: "Which version?" }, { status: 400 });
    await removeVariant(id, variantId);
    return NextResponse.json({ ok: true });
  }

  if (action === "duplicate-variant") {
    const variantId = typeof body.variantId === "number" ? body.variantId : null;
    if (variantId === null) return NextResponse.json({ ok: false, error: "Which version?" }, { status: 400 });
    const made = await duplicateVariant(id, variantId, me.username);
    return made
      ? NextResponse.json({ ok: true, variant: made })
      : NextResponse.json({ ok: false, error: "That version is not in this project." }, { status: 404 });
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
