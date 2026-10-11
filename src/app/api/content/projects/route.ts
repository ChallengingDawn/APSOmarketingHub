// The project list, and making a new one.

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { createProject, listProjects } from "@/lib/content/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireUser();
  return NextResponse.json({ ok: true, projects: await listProjects() });
}

export async function POST(req: NextRequest) {
  const me = await requireUser();
  const body = (await req.json().catch(() => ({}))) as { title?: unknown; brief?: unknown };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ ok: false, error: "A project needs a title." }, { status: 400 });

  const brief = typeof body.brief === "string" && body.brief.trim() ? body.brief.trim() : null;
  return NextResponse.json({ ok: true, project: await createProject(title, brief, me.username) });
}
