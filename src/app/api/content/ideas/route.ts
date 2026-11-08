// IDEAS FROM EVERY APP (08.11.2026) - lib/content/ideas.ts.
//   GET                   the sources this person may read (each by its own app's grant), named as the menus name them
//   GET ?source=<key>     one source's ideas, each with where exactly it comes from and what the team did with it
//   POST write            { words }                   "Write it with AI": a few words -> title, why, kinds (not kept yet)
//   POST add              { title, why?, kinds[] }    an idea of the team's own
//   POST remove           { id }                      one's own idea (an admin: any)
//   POST mark             { keys[], status, projectId? }  "dismissed" (not now), "project" (added to a project), null (back in the list)

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { keepAlive } from "@/lib/http/keepAlive";
import { myAccess } from "@/lib/auth/appAccess";
import { accessFor } from "@/lib/content/sharing";
import { addTeamIdea, cleanKinds, ideasFrom, markIdeas, removeTeamIdea, SOURCES, writeIdea, type IdeaSource } from "@/lib/content/ideas";
import { describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function allowedSources() {
  const acc = await myAccess();
  if (!acc) return [];
  return SOURCES.filter((s) => acc.role === "admin" || acc.canOpen(s.app));
}

export async function GET(req: NextRequest) {
  const me = await requireUser();
  const sources = await allowedSources();
  const want = req.nextUrl.searchParams.get("source");
  if (!want) return NextResponse.json({ ok: true, me: me.username, sources: sources.map(({ key, label, note, slow }) => ({ key, label, note, slow: !!slow })) });
  const s = sources.find((x) => x.key === want);
  if (!s) return fail("That source is not open to you.", 403);
  return keepAlive(async () => {
    try {
      return NextResponse.json({ ok: true, ideas: await ideasFrom(s.key as IdeaSource) });
    } catch (e) {
      return fail(describeIntegrationError(e).error, 502);
    }
  });
}

export async function POST(req: NextRequest) {
  const me = await requireUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(b.action ?? "");
  if (action === "write") {
    const words = String(b.words ?? "").trim().slice(0, 1200);
    if (words.length < 3) return fail("Write a few words first.");
    return keepAlive(async () => {
      try {
        const idea = await writeIdea(words);
        return idea ? NextResponse.json({ ok: true, idea }) : fail("The AI is not set up on this hub.", 503);
      } catch (e) {
        return fail(describeIntegrationError(e).error, 502);
      }
    });
  }
  if (action === "add") {
    const title = String(b.title ?? "").trim();
    if (!title) return fail("Say the idea in a few words.");
    // kinds[] (several); kind (one) from an older page
    const kinds = cleanKinds(Array.isArray(b.kinds) ? b.kinds : typeof b.kind === "string" ? [b.kind] : []);
    const id = await addTeamIdea({ title, why: String(b.why ?? ""), kinds, by: me.username });
    return NextResponse.json({ ok: true, id, key: `team:${id}` });
  }
  if (action === "remove") {
    const ok = await removeTeamIdea(Number(b.id), { username: me.username, admin: me.role === "admin" });
    return ok ? NextResponse.json({ ok: true }) : fail("Only the person who wrote an idea removes it.", 403);
  }
  if (action === "mark") {
    const keys = Array.isArray(b.keys) ? b.keys.map(String) : [];
    // "project": the idea went into a project the person may change (added as a line there)
    if (b.status === "project") {
      const projectId = Number(b.projectId);
      const access = Number.isInteger(projectId) && projectId > 0 ? await accessFor(projectId, me) : null;
      if (!access?.canEdit) return fail("You cannot add to that project.", 403);
      await markIdeas(keys, "project", me.username, projectId);
      return NextResponse.json({ ok: true });
    }
    const status = b.status === "dismissed" ? "dismissed" : null;
    await markIdeas(keys, status, me.username);
    return NextResponse.json({ ok: true });
  }
  return fail("Unknown action.");
}
