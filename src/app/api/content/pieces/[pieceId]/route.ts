// A TO-DO'S STUDIO (08.11.2026: "each type of content should be different"). One route for every kind:
//   GET                     the to-do, its project's brief, its studio document (made empty the first time), its versions
//   POST ops                small changes laid over the document (studio/doc.ts - never the whole document: 8 KB limit)
//   POST version / restore  a version of the document into the project's versions; one brought back
//   POST ai                 one of the kind's AI tasks, in the brand's voice, with the brief and the to-do in front of it
//   POST act                one of the kind's server actions (send to HubSpot, read the shop's pages, ...)
// Behind the project's own access: editors change it; anyone in the project reads it.

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { claudeText, getAnthropic } from "@/lib/ai/claude";
import { brandSystemPrompt, readBrain } from "@/lib/brain";
import { accessFor, shareCandidates } from "@/lib/content/sharing";
import { addEvent, getPiece, projectBrief, projectHead } from "@/lib/content/workflow";
import { cleanOps } from "@/lib/content/studio/doc";
import { studioKindOf } from "@/lib/content/studio/kinds";
import { KIND_DEFS } from "@/lib/content/studio/registry";
import { docOrNew, readDoc, saveOps, saveVersion, studioVersions } from "@/lib/content/studio/store";
import type { StudioCtx } from "@/lib/content/studio/contract";
import { describeIntegrationError } from "@/lib/integrations/status";
import { keepAlive } from "@/lib/http/keepAlive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/** The studios' AI asks a day, for this process - a loop or a stuck button must not spend the month (as APSOconvert's). */
const AI_PER_DAY = Number(process.env.STUDIO_AI_PER_DAY ?? 400);
let aiDay = { day: "", asked: 0 };
function aiAllowed(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (aiDay.day !== today) aiDay = { day: today, asked: 0 };
  if (aiDay.asked >= AI_PER_DAY) return false;
  aiDay.asked += 1;
  return true;
}
const errText = (e: unknown) => describeIntegrationError(e).error;

async function open(rawId: string) {
  const me = await requireUser();
  const pieceId = Number.parseInt(rawId, 10);
  const piece = Number.isFinite(pieceId) && pieceId > 0 ? await getPiece(pieceId) : null;
  if (!piece) return { error: fail("No such to-do.", 404) } as const;
  const access = await accessFor(piece.projectId, me);
  if (!access) return { error: fail("No such to-do.", 404) } as const;
  const kind = studioKindOf(piece.contentType);
  if (!kind) return { error: fail("This kind of to-do has no studio of its own - it opens in Create Studio.", 400) } as const;
  const [head, brief] = await Promise.all([projectHead(piece.projectId), projectBrief(piece.projectId)]);
  const ctx: StudioCtx = {
    projectId: piece.projectId, pieceId: piece.id, projectTitle: head?.project.title ?? "", projectNotes: head?.project.brief ?? null, brief: brief.brief, piece,
    me: { username: me.username, name: me.full_name || me.username, email: me.email, admin: me.role === "admin" }, canEdit: access.canEdit,
  };
  return { me, piece, access, kind, def: KIND_DEFS[kind], ctx, head } as const;
}

export async function GET(_req: NextRequest, c: { params: Promise<{ pieceId: string }> }) {
  const o = await open((await c.params).pieceId);
  if ("error" in o) return o.error;
  const stored = await docOrNew(o.piece.id, o.kind, () => o.def.empty(o.ctx), o.me.username);
  const [versions, people] = await Promise.all([studioVersions(o.piece.id), shareCandidates()]);
  return NextResponse.json({
    ok: true, kind: o.kind, me: o.me.username, isAdmin: o.me.role === "admin", access: o.access,
    project: o.head?.project ?? null, brief: o.ctx.brief, piece: o.piece, doc: stored.doc, rev: stored.rev,
    updatedBy: stored.updatedBy, updatedAt: stored.updatedAt,
    versions: versions.map((v) => ({ id: v.id, label: v.label, by: v.by, at: v.at })),
    people: people.map((p) => ({ username: p.username, name: p.name })),
    ai: !!getAnthropic(), tasks: Object.entries(o.def.tasks).map(([k, t]) => ({ key: k, label: t.label })),
  });
}

export async function POST(req: NextRequest, c: { params: Promise<{ pieceId: string }> }) {
  const o = await open((await c.params).pieceId);
  if ("error" in o) return o.error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof b.action === "string" ? b.action : "";
  if (!o.access.canEdit) return fail("You can comment on this project, not change it.", 403);
  const input = (b.input && typeof b.input === "object" ? b.input : {}) as Record<string, unknown>;

  if (action === "ops") {
    const ops = cleanOps(b.ops);
    if (!ops) return fail("Those changes could not be read.");
    await docOrNew(o.piece.id, o.kind, () => o.def.empty(o.ctx), o.me.username);
    const r = await saveOps(o.piece.id, ops, o.me.username);
    return r.ok ? NextResponse.json({ ok: true, rev: r.rev }) : fail(r.error);
  }

  if (action === "version" || action === "restore") {
    const stored = await readDoc(o.piece.id);
    if (!stored) return fail("Nothing to keep yet.");
    if (action === "restore") {
      const v = (await studioVersions(o.piece.id)).find((x) => x.id === Number(b.versionId));
      if (!v) return fail("That version is not this to-do's.", 404);
      const r = await saveOps(o.piece.id, [{ op: "set", path: ["$root"], value: v.doc }], o.me.username);
      if (r.ok) await addEvent(o.piece.projectId, o.piece.id, o.me.username, "version-restored", { piece: o.piece.title, label: v.label });
      return r.ok ? NextResponse.json({ ok: true, rev: r.rev, doc: r.doc }) : fail(r.error);
    }
    const label = typeof b.label === "string" && b.label.trim() ? b.label.trim().slice(0, 120) : null;
    const id = await saveVersion({
      projectId: o.piece.projectId, pieceId: o.piece.id, contentType: o.piece.contentType, language: o.piece.language, label,
      title: o.piece.title, text: o.def.toText(stored.doc), doc: stored.doc, channel: o.def.channel, by: o.me.username,
    });
    await addEvent(o.piece.projectId, o.piece.id, o.me.username, "version", { piece: o.piece.title, label });
    return NextResponse.json({ ok: true, id });
  }

  // the slow ones (an AI writing, HubSpot, a picture...) are kept alive past the load balancer's 60 s (lib/http/keepAlive)
  if (action === "ai" || action === "act") return keepAlive(() => slowAction(o, action, b, input));
  return fail(`Unknown action "${action}".`);
}

type Opened = Exclude<Awaited<ReturnType<typeof open>>, { error: unknown }>;

async function slowAction(o: Opened, action: string, b: Record<string, unknown>, input: Record<string, unknown>): Promise<Response> {
  if (action === "ai") {
    const task = o.def.tasks[String(b.task ?? "")];
    if (!task) return fail("This studio has no such AI task.");
    const client = getAnthropic();
    if (!client) return fail("The AI is not set up on this hub.", 503);
    if (!aiAllowed()) return fail("The studios have used today's AI asks - it opens again tomorrow, or an admin raises STUDIO_AI_PER_DAY.", 429);
    const stored = await readDoc(o.piece.id);
    try {
      const brain = await readBrain();
      const system = `${brandSystemPrompt(brain, o.def.channel)}\n\n${task.system}`;
      const r = await claudeText({
        client, system: [{ type: "text", text: system }], user: task.user(o.ctx, stored?.doc, input),
        budget: { maxTokens: task.maxTokens ?? 4000, effort: task.effort ?? ((task.maxTokens ?? 4000) >= 12_000 ? "medium" : "low") }, outputFormat: { type: "json_schema", schema: task.schema },
      });
      if (!r.ok) return fail(r.failure.error, r.failure.status);
      let raw: unknown;
      try { raw = JSON.parse(r.text); } catch { return fail("The AI's answer could not be read - try again.", 502); }
      console.log(`[studio] ${o.kind}.${String(b.task)} for piece ${o.piece.id} by ${o.me.username}: ${r.usage.input_tokens}+${r.usage.output_tokens} tokens`);
      return NextResponse.json({ ok: true, result: task.clean ? task.clean(raw, stored?.doc, o.ctx, input) : raw });
    } catch (e) { return fail(errText(e), 502); }
  }

  if (action === "act") {
    const fn = o.def.actions?.[String(b.name ?? "")];
    if (!fn) return fail("This studio has no such action.");
    const stored = await readDoc(o.piece.id);
    try { return NextResponse.json({ ok: true, result: await fn(o.ctx, stored?.doc, input) }); } catch (e) { return fail(errText(e), 502); }
  }

  return fail(`Unknown action "${action}".`);
}
