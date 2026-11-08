// STARTING A PROJECT (08.11.2026) - lib/content/start.ts.
//   GET            what the page needs: the people, the kinds offered, the languages, AI on?
//   POST propose   { goal, ideas[], languages[] }   the AI's project: name, brief, lines
//   POST start     { title, goal, audience, message, ideas[], planItem, tickets, lines[] }   made, in one go; answers its id
//                  and its to-dos' ids (Make > X opens the studio of its one to-do at once)
// The action plan is not asked here any more (SARCLA 08.11.2026: "Action plan should not be visible here"): the pages
// send planItem null and no tickets, and a to-do's "Plan & ticket" places it later. The route still takes them.

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { myAccess } from "@/lib/auth/appAccess";
import { getAnthropic } from "@/lib/ai/claude";
import { OFFERED_CONTENT_TYPES } from "@/lib/content/contentTypes";
import { LANGUAGES } from "@/lib/content/languages";
import { TASK_KIND } from "@/lib/content/pieceRules";
import { shareCandidates } from "@/lib/content/sharing";
import { proposeProject, startProject, type IdeaRef, type Line } from "@/lib/content/start";
import { describeIntegrationError } from "@/lib/integrations/status";
import { keepAlive } from "@/lib/http/keepAlive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const KINDS = new Set([...OFFERED_CONTENT_TYPES.map((t) => t.key), TASK_KIND]);
const LANGS = new Set(LANGUAGES.map((l) => l.code));

function ideasOf(v: unknown): IdeaRef[] {
  return (Array.isArray(v) ? v : []).slice(0, 20).map((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    return { key: str(o.key, 300) || undefined, source: str(o.source, 16) || "team", title: str(o.title, 200), why: str(o.why, 400) || undefined, url: str(o.url, 300) || undefined };
  }).filter((i) => i.title);
}

async function canStart() {
  const acc = await myAccess();
  return !!acc && (acc.role === "admin" || acc.canWrite("marketing"));
}

export async function GET() {
  const me = await requireUser();
  const admin = me.role === "admin";
  const people = await shareCandidates();
  return NextResponse.json({
    ok: true, me: me.username, admin, ai: !!getAnthropic(), canStart: await canStart(),
    people: people.map((p) => ({ username: p.username, name: p.name })),
    kinds: [...OFFERED_CONTENT_TYPES.map((t) => ({ key: t.key, label: t.label, blurb: t.blurb, language: true })), { key: TASK_KIND, label: "Action", blurb: "Something to do around the content - brief the agency, get photos, check with product management", language: false }],
    languages: LANGUAGES.map((l) => ({ code: l.code, label: l.label })),
  });
}

export async function POST(req: NextRequest) {
  const me = await requireUser();
  if (!(await canStart())) return fail("Starting a project needs Edit on Marketing & Content.", 403);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(b.action ?? "");
  const admin = me.role === "admin";

  if (action === "propose") return keepAlive(async () => {
    const ideas = ideasOf(b.ideas);
    const goal = str(b.goal, 1200);
    if (!goal && !ideas.length) return fail("Say what the project should achieve, or start from ideas.");
    const languages = (Array.isArray(b.languages) ? b.languages : []).map(String).filter((l) => LANGS.has(l));
    try {
      const proposal = await proposeProject({ goal, ideas, languages });
      if (!proposal) return fail("The AI is not set up on this hub.", 503);
      return NextResponse.json({ ok: true, proposal });
    } catch (e) {
      return fail(describeIntegrationError(e).error, 502);
    }
  });

  if (action === "start") return keepAlive(async () => {
    const lines: Line[] = (Array.isArray(b.lines) ? b.lines : []).slice(0, 20).map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const kind = KINDS.has(String(o.contentType)) ? String(o.contentType) : TASK_KIND;
      const lang = String(o.language ?? "").toUpperCase();
      return {
        contentType: kind, title: str(o.title, 200), language: kind === TASK_KIND || !LANGS.has(lang) ? null : lang,
        writer: str(o.writer, 255) || null, reviewer: str(o.reviewer, 255) || null, dueDate: day(o.dueDate),
      };
    }).filter((l) => l.contentType !== TASK_KIND || l.title);
    if (!lines.length) return fail("Add at least one line - a piece of content or an action.");
    try {
      const r = await startProject({
        title: str(b.title, 200), goal: str(b.goal, 1200), audience: str(b.audience, 400), message: str(b.message, 400),
        ideas: ideasOf(b.ideas), planItem: b.planItem == null || b.planItem === "" ? null : Number(b.planItem), tickets: b.tickets === true, lines,
      }, { username: me.username, admin });
      return NextResponse.json({ ok: true, ...r });
    } catch (e) {
      return fail(describeIntegrationError(e).error, 502);
    }
  });
  return fail("Unknown action.");
}
