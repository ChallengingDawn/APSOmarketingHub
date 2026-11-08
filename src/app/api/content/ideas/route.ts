// IDEAS FROM EVERY APP (08.11.2026) - lib/content/ideas.ts.
//   GET                   the sources this person may read (each by its own app's grant; the plan's for admins)
//   GET ?source=<key>     one source's ideas, each with what the team did with it
//   POST add              { title, why?, kind? }      an idea of the team's own
//   POST remove           { id }                      one's own idea (an admin: any)
//   POST mark             { keys[], status }          "dismissed" (not now), null (back in the list)

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { myAccess } from "@/lib/auth/appAccess";
import { addTeamIdea, ideasFrom, markIdeas, removeTeamIdea, SOURCES, type IdeaSource } from "@/lib/content/ideas";
import { describeIntegrationError } from "@/lib/integrations/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function allowedSources() {
  const acc = await myAccess();
  if (!acc) return [];
  const admin = acc.role === "admin";
  return SOURCES.filter((s) => (s.app === "admin" ? admin : admin || acc.canOpen(s.app)));
}

export async function GET(req: NextRequest) {
  await requireUser();
  const sources = await allowedSources();
  const want = req.nextUrl.searchParams.get("source");
  if (!want) return NextResponse.json({ ok: true, sources: sources.map(({ key, label, note, slow }) => ({ key, label, note, slow: !!slow })) });
  const s = sources.find((x) => x.key === want);
  if (!s) return fail("That source is not open to you.", 403);
  try {
    return NextResponse.json({ ok: true, ideas: await ideasFrom(s.key as IdeaSource) });
  } catch (e) {
    return fail(describeIntegrationError(e).error, 502);
  }
}

export async function POST(req: NextRequest) {
  const me = await requireUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(b.action ?? "");
  if (action === "add") {
    const title = String(b.title ?? "").trim();
    if (!title) return fail("Say the idea in a few words.");
    const id = await addTeamIdea({ title, why: String(b.why ?? ""), kind: typeof b.kind === "string" && b.kind ? b.kind.slice(0, 48) : null, by: me.username });
    return NextResponse.json({ ok: true, id });
  }
  if (action === "remove") {
    const ok = await removeTeamIdea(Number(b.id), { username: me.username, admin: me.role === "admin" });
    return ok ? NextResponse.json({ ok: true }) : fail("Only the person who wrote an idea removes it.", 403);
  }
  if (action === "mark") {
    const keys = Array.isArray(b.keys) ? b.keys.map(String) : [];
    const status = b.status === "dismissed" ? "dismissed" : null;
    await markIdeas(keys, status, me.username);
    return NextResponse.json({ ok: true });
  }
  return fail("Unknown action.");
}
