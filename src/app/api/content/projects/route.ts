// The project list, and making a new one. The list is the projects this person
// may open (src/lib/content/sharing.ts): ?scope=mine (default) they own,
// shared were shared with them, editable can take a draft, all is admins'.

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { createProject } from "@/lib/content/projects";
import { CONTENT_BY_KEY } from "@/lib/content/contentTypes";
import { listProjectsFor } from "@/lib/content/sharing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const me = await requireUser();
  const raw = req.nextUrl.searchParams.get("scope");
  const scope =
    raw === "shared" || raw === "all" || raw === "editable" || raw === "starred" || raw === "archived"
      ? raw
      : "mine";
  return NextResponse.json({ ok: true, projects: await listProjectsFor(me, scope), me: me.username, isAdmin: me.role === "admin" });
}

export async function POST(req: NextRequest) {
  const me = await requireUser();
  const body = (await req.json().catch(() => ({}))) as { title?: unknown; brief?: unknown; contentType?: unknown };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ ok: false, error: "A project needs a title." }, { status: 400 });

  const brief = typeof body.brief === "string" && body.brief.trim() ? body.brief.trim() : null;
  // Validated against the real list: an unknown type would leave the studio
  // opening on nothing, which is worse than opening on the default.
  const askedType = typeof body.contentType === "string" ? body.contentType : null;
  const contentType = askedType && CONTENT_BY_KEY[askedType] ? askedType : null;
  return NextResponse.json({
    ok: true,
    project: await createProject(title, brief, me.username, contentType),
  });
}
