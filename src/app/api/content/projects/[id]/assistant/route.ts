// Ask the project's assistant, and accept or dismiss what it proposes.
//
// GET  — the conversation so far.
// POST — { action: "ask", body }      a question or an instruction
//        { action: "accept", turnId } apply the proposal on that turn
//        { action: "dismiss", turnId } refuse it, on the record

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getAnthropic, channelBudget, claudeText } from "@/lib/ai/claude";
import {
  ASSISTANT_SYSTEM, addTurn, contextFor, decideTurn, describeContext, describeHistory,
  getTurn, listTurns, type Proposal,
} from "@/lib/content/assistant";
import { addVariant, getProject } from "@/lib/content/projects";
import { query } from "@/lib/db/client";

export const runtime = "nodejs";
export const maxDuration = 180;
export const dynamic = "force-dynamic";

function idOf(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The shape the model must answer in.
 *
 * `proposal` is nullable on purpose: an assistant that must always propose
 * something will propose something, and most good answers to "why did we drop
 * version two" are sentences rather than edits.
 */
const SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "The answer, in plain prose. Always present." },
    proposal: {
      type: ["object", "null"],
      description: "A change being offered, or null when the answer is just an answer.",
      properties: {
        kind: { type: "string", enum: ["rewrite-section", "new-version", "image"] },
        variantId: { type: ["integer", "null"], description: "rewrite-section: which version." },
        section: { type: ["string", "null"], description: "rewrite-section: the heading, exactly." },
        label: { type: ["string", "null"], description: "new-version: a short name for it." },
        content: { type: ["string", "null"], description: "The replacement section, or the whole draft." },
        brief: { type: ["string", "null"], description: "image: what the picture should show." },
      },
      required: ["kind"],
      additionalProperties: false,
    },
  },
  required: ["reply"],
  additionalProperties: false,
} as const;

type Answer = {
  reply: string;
  proposal: null | {
    kind: Proposal["kind"];
    variantId?: number | null;
    section?: string | null;
    label?: string | null;
    content?: string | null;
    brief?: string | null;
  };
};

/** Only a proposal we can actually carry out is stored as one. */
function toProposal(a: Answer["proposal"], variantIds: number[]): Proposal | null {
  if (!a) return null;
  if (a.kind === "rewrite-section") {
    const id = typeof a.variantId === "number" ? a.variantId : null;
    if (id === null || !variantIds.includes(id) || !a.section || !a.content) return null;
    return { kind: "rewrite-section", variantId: id, section: a.section, content: a.content };
  }
  if (a.kind === "new-version") {
    if (!a.content) return null;
    return { kind: "new-version", label: a.label?.trim() || "Assistant's version", content: a.content };
  }
  if (a.kind === "image") {
    if (!a.brief) return null;
    return { kind: "image", brief: a.brief };
  }
  return null;
}

/**
 * Swap one section inside a markdown body.
 *
 * Matches the heading and replaces to the next heading of the same level or
 * the end. If the heading is not found the edit is refused rather than
 * appended — silently adding a second "Hero" is worse than doing nothing.
 */
function replaceSection(body: string, heading: string, content: string): string | null {
  const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^(#{1,6})\\s*${esc}\\s*$`, "im");
  const m = re.exec(body);
  if (!m) return null;

  const level = m[1].length;
  const start = m.index;
  const after = start + m[0].length;
  const next = new RegExp(`^#{1,${level}}\\s+\\S`, "m").exec(body.slice(after));
  const end = next ? after + next.index : body.length;

  return `${body.slice(0, start)}${m[0]}\n\n${content.trim()}\n\n${body.slice(end)}`.replace(/\n{4,}/g, "\n\n\n");
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = idOf((await ctx.params).id);
  if (id === null) return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });
  return NextResponse.json({ ok: true, turns: await listTurns(id) });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const id = idOf((await ctx.params).id);
  if (id === null) return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "ask";

  /* ── accept / dismiss ─────────────────────────────────────────────── */

  if (action === "accept" || action === "dismiss") {
    const turnId = typeof body.turnId === "number" ? body.turnId : null;
    if (turnId === null) return NextResponse.json({ ok: false, error: "Which proposal?" }, { status: 400 });

    const turn = await getTurn(turnId);
    if (!turn || turn.projectId !== id) {
      return NextResponse.json({ ok: false, error: "No such proposal." }, { status: 404 });
    }
    if (turn.status !== "pending") {
      return NextResponse.json({ ok: false, error: `That proposal was already ${turn.status}.` }, { status: 409 });
    }

    if (action === "dismiss") {
      await decideTurn(turnId, "dismissed", me.username);
      return NextResponse.json({ ok: true });
    }

    const p = turn.proposal;
    if (!p) return NextResponse.json({ ok: false, error: "Nothing to apply." }, { status: 400 });

    if (p.kind === "rewrite-section") {
      const found = await getProject(id);
      const target = found?.variants.find((v) => v.id === p.variantId);
      if (!target) return NextResponse.json({ ok: false, error: "That version is gone." }, { status: 404 });

      const next = replaceSection(target.body, p.section, p.content);
      if (next === null) {
        return NextResponse.json(
          { ok: false, error: `Could not find a "${p.section}" heading in that version any more.` },
          { status: 409 },
        );
      }
      await query(
        `UPDATE apsomh_content SET body = $2, updated_by = $3, updated_at = NOW() WHERE id = $1`,
        [target.id, next, me.username],
      );
      await decideTurn(turnId, "accepted", me.username);
      return NextResponse.json({ ok: true, variantId: target.id });
    }

    if (p.kind === "new-version") {
      const found = await getProject(id);
      const variant = await addVariant({
        projectId: id,
        channel: "studio",
        contentType: found?.project.contentType ?? null,
        language: null,
        label: p.label,
        title: null,
        body: p.content,
        by: me.username,
      });
      await decideTurn(turnId, "accepted", me.username);
      return NextResponse.json({ ok: true, variant });
    }

    // An image proposal is a brief: accepting it hands that brief to the
    // studio, which owns the generator. Nothing is drawn here.
    await decideTurn(turnId, "accepted", me.username);
    return NextResponse.json({ ok: true, imageBrief: p.brief });
  }

  /* ── ask ──────────────────────────────────────────────────────────── */

  const question = typeof body.body === "string" ? body.body.trim() : "";
  if (!question) return NextResponse.json({ ok: false, error: "Ask something." }, { status: 400 });

  const context = await contextFor(id);
  if (!context) return NextResponse.json({ ok: false, error: "No such project." }, { status: 404 });

  await addTurn({ projectId: id, author: me.username, body: question });

  const client = getAnthropic();
  if (!client) {
    const turn = await addTurn({
      projectId: id,
      author: "assistant",
      body: "ANTHROPIC_API_KEY is not set on this hub, so I cannot answer yet.",
    });
    return NextResponse.json({ ok: true, turns: await listTurns(id), turn });
  }

  const history = describeHistory(context.turns);
  const result = await claudeText({
    client,
    system: [{ type: "text", text: ASSISTANT_SYSTEM }],
    user: [
      describeContext(context),
      history ? `\nTHE CONVERSATION SO FAR:\n${history}` : "",
      `\nTHEY NOW SAY:\n${question}`,
    ].join("\n"),
    budget: channelBudget("studio"),
    outputFormat: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> },
  });

  if (!result.ok) {
    const turn = await addTurn({
      projectId: id,
      author: "assistant",
      body: `I could not answer: ${result.failure.error}`,
    });
    return NextResponse.json({ ok: true, turns: await listTurns(id), turn });
  }

  let answer: Answer;
  try {
    answer = JSON.parse(result.text) as Answer;
  } catch {
    answer = { reply: result.text, proposal: null };
  }

  const turn = await addTurn({
    projectId: id,
    author: "assistant",
    body: answer.reply?.trim() || "(no answer)",
    proposal: toProposal(answer.proposal ?? null, context.variants.map((v) => v.id)),
  });

  return NextResponse.json({ ok: true, turns: await listTurns(id), turn });
}
