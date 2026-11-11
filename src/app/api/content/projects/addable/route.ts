// THE PROJECTS A PERSON MAY ADD A PAGE TO - for AI testing & personalization's "Add to a project" (SARCLA 10.11.2026:
// "upon sending to Content allow to create a new project or associate to the current one + the ticket").
//   GET   { ok, projects: [{ id, title, stage, stageLabel, owner, ownerName, role, updatedAt, pages }] }
//         the projects whose to-dos this person may add to (the work route's rule: their own, the ones shared with them to
//         edit, every one for an admin), never an archived or deleted one - their own first, then the newest; `pages` the
//         shop's pages each holds already (the project's own marker, pieceId null, and each to-do's).
// The page itself is added by POST /api/content/projects/<id>/work { action: "piece-add-convert", ... }.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { addableProjects } from "@/lib/content/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await requireUser();
  return NextResponse.json({ ok: true, projects: await addableProjects(me) });
}
