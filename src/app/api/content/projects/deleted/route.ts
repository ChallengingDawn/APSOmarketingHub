// DELETED PROJECTS (SARCLA 08.11.2026: "I should be able to delete projects") - lib/content/deleting.ts. Admins only.
//   GET                          every deleted project, the newest first
//   POST restore { id }          brought back as it was: its to-dos, their studio documents, its place on the board

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { deletedProjects, restoreProject } from "@/lib/content/deleting";
import { mayRestore } from "@/lib/content/deleteRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const refuse = () => NextResponse.json({ ok: false, error: "Deleted projects are an admin's to bring back." }, { status: 403 });

export async function GET() {
  const me = await requireUser();
  if (!mayRestore(me)) return refuse();
  return NextResponse.json({ ok: true, projects: await deletedProjects() });
}

export async function POST(req: NextRequest) {
  const me = await requireUser();
  if (!mayRestore(me)) return refuse();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.action !== "restore") return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  const id = Number(b.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Which project?" }, { status: 400 });
  const done = await restoreProject(id, me.username);
  return done ? NextResponse.json({ ok: true, id }) : NextResponse.json({ ok: false, error: "That project is not deleted." }, { status: 404 });
}
