// THE PROJECT'S ASSISTANT.
//
// What was there before was a button. You filled a brief, pressed Generate,
// received a wall of text, and the only follow-up was "Refine" with one
// sentence. That is a vending machine: it knows nothing about the project it
// is standing in, forgets every exchange, and can only ever replace the whole
// thing.
//
// An assistant holds the project — its type and the sections that type
// requires, the brief, every version already made, and what people said about
// them — and takes instructions against it. "The hero is too long." "Write
// the six proofs." "Make the German one match this." "Why did we drop version
// two?"
//
// Two decisions SARCLA made, and they shape everything here:
//
//   1. It PROPOSES; a person accepts. Several people share a project, and an
//      assistant that rewrites section four while somebody else is reading it
//      is not help. A proposal is visible, attributable and refusable. It can
//      still produce a whole draft or a whole image when that is what was
//      asked for — proposing is about applying the change, not about how much
//      it may write.
//
//   2. The conversation lives on the PROJECT, not on the person. It is part
//      of the record, like the comments beside each version: six months on,
//      "why is the headline like that" should be answerable from the project
//      rather than from somebody's memory.

import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";
import { CONTENT_BY_KEY, inferContentType, type ContentType } from "@/lib/content/contentTypes";
import { getProject, type Comment, type Project, type Variant } from "@/lib/content/projects";

/** What the assistant is offering to do. Nothing happens until it is accepted. */
export type Proposal =
  | {
      kind: "rewrite-section";
      /** The variant it edits, and the section heading inside it. */
      variantId: number;
      section: string;
      /** The replacement text for that section only. */
      content: string;
    }
  | {
      kind: "new-version";
      /** A whole draft, saved as another variation when accepted. */
      label: string;
      content: string;
    }
  | {
      kind: "image";
      /** A prompt for the image generator, not an image. */
      brief: string;
    };

export type ChatTurn = {
  id: number;
  projectId: number;
  /** A username, or "assistant". */
  author: string;
  body: string;
  proposal: Proposal | null;
  /** pending until somebody accepts or dismisses it. */
  status: "none" | "pending" | "accepted" | "dismissed";
  decidedBy: string | null;
  createdAt: string;
};

type Row = {
  id: number; project_id: number; author: string; body: string;
  proposal: Proposal | null; status: string; decided_by: string | null; created_at: Date;
};

function toTurn(r: Row): ChatTurn {
  return {
    id: r.id,
    projectId: r.project_id,
    author: r.author,
    body: r.body,
    proposal: r.proposal ?? null,
    status: (r.status as ChatTurn["status"]) ?? "none",
    decidedBy: r.decided_by,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function listTurns(projectId: number): Promise<ChatTurn[]> {
  await ensureSchema();
  const r = await query<Row>(
    `SELECT * FROM apsomh_content_chat WHERE project_id = $1 ORDER BY created_at ASC, id ASC`,
    [projectId],
  );
  return r.rows.map(toTurn);
}

export async function addTurn(t: {
  projectId: number;
  author: string;
  body: string;
  proposal?: Proposal | null;
}): Promise<ChatTurn> {
  await ensureSchema();
  const r = await query<Row>(
    `INSERT INTO apsomh_content_chat (project_id, author, body, proposal, status)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      t.projectId,
      t.author,
      t.body,
      t.proposal ? JSON.stringify(t.proposal) : null,
      t.proposal ? "pending" : "none",
    ],
  );
  return toTurn(r.rows[0]);
}

export async function decideTurn(
  turnId: number,
  status: "accepted" | "dismissed",
  by: string,
): Promise<void> {
  await ensureSchema();
  await query(
    `UPDATE apsomh_content_chat SET status = $2, decided_by = $3 WHERE id = $1 AND status = 'pending'`,
    [turnId, status, by],
  );
}

export async function getTurn(turnId: number): Promise<ChatTurn | null> {
  await ensureSchema();
  const r = await query<Row>(`SELECT * FROM apsomh_content_chat WHERE id = $1`, [turnId]);
  return r.rows[0] ? toTurn(r.rows[0]) : null;
}

/* ── the context the assistant actually gets ───────────────────────────── */

/** Enough of a version to reason about, without posting a novel per turn. */
const VARIANT_CHARS = 2500;

export type AssistantContext = {
  project: Project;
  type: ContentType | null;
  variants: Variant[];
  comments: Comment[];
  turns: ChatTurn[];
};

export async function contextFor(projectId: number): Promise<AssistantContext | null> {
  const found = await getProject(projectId);
  if (!found) return null;
  const key = found.project.contentType ?? inferContentType(found.project.title);
  return {
    project: found.project,
    type: key ? CONTENT_BY_KEY[key] ?? null : null,
    variants: found.variants,
    comments: found.comments,
    turns: await listTurns(projectId),
  };
}

/**
 * The project, written out for the model.
 *
 * Deliberately verbose about the TYPE: its sections, their jobs and their
 * rules are the difference between an assistant that can say "the six proofs
 * are missing" and one that can only say "looks good". The old Refine box
 * passed none of this, which is why its answers were generic.
 */
export function describeContext(ctx: AssistantContext): string {
  const lines: string[] = [];

  lines.push(`PROJECT: ${ctx.project.title}`);
  if (ctx.project.brief) lines.push(`BRIEF: ${ctx.project.brief}`);

  if (ctx.type) {
    lines.push(``, `TYPE: ${ctx.type.label} — ${ctx.type.blurb}`);
    lines.push(`It must have exactly these sections:`);
    ctx.type.sections.forEach((s, i) =>
      lines.push(`  ${i + 1}. ${s.heading} (~${s.words} words) — ${s.job}`),
    );
    if (ctx.type.constraints?.length) {
      lines.push(`Rules that override anything more general:`);
      ctx.type.constraints.forEach((c) => lines.push(`  - ${c}`));
    }
  }

  if (ctx.variants.length === 0) {
    lines.push(``, `VERSIONS: none yet. Nothing has been written.`);
  } else {
    lines.push(``, `VERSIONS (${ctx.variants.length}), oldest first:`);
    for (const v of ctx.variants) {
      const chosen = ctx.project.chosenVariantId === v.id ? " [CHOSEN]" : "";
      lines.push(
        ``,
        `--- version id=${v.id} "${v.label ?? "unlabelled"}" by ${v.createdBy ?? "?"}${chosen}`,
        v.body.slice(0, VARIANT_CHARS),
        v.body.length > VARIANT_CHARS ? `[...truncated]` : ``,
      );
    }
  }

  if (ctx.comments.length) {
    lines.push(``, `WHAT PEOPLE SAID:`);
    for (const c of ctx.comments) {
      const on = c.variantId ? ` on version ${c.variantId}` : "";
      lines.push(`  ${c.author}${on}: ${c.body}`);
    }
  }

  return lines.filter((l) => l !== undefined).join("\n");
}

/** The last few exchanges, so a follow-up like "shorter" means something. */
export function describeHistory(turns: ChatTurn[], keep = 10): string {
  const recent = turns.slice(-keep);
  if (recent.length === 0) return "";
  return recent
    .map((t) => {
      const decided =
        t.proposal && t.status !== "pending" ? ` (proposal ${t.status})` : t.proposal ? " (proposal pending)" : "";
      return `${t.author}${decided}: ${t.body}`;
    })
    .join("\n");
}

export const ASSISTANT_SYSTEM = `You are the assistant inside a content project at Angst+Pfister, an industrial
sealing and polymer supplier. You are not a chatbot and not a generator: you work on ONE project, you can see
everything in it, and the people using you are marketers and engineers who are short on time.

How to answer:
- Answer the question asked. If somebody asks why a version was rejected, read the comments and say why; do not
  offer to rewrite it.
- Be concrete. Every claim about the content should point at a section, a version or a comment that exists.
- Say when something is missing. A landing page without its six proofs is incomplete and you should name that
  rather than praise what is there.
- Never invent a customer name, a certification, a tolerance or a figure. If a number is not in the project,
  write the sentence without one.

When a change to the content is wanted, attach a proposal. You do NOT apply changes — a person accepts them,
because several people share this project. Choose the smallest proposal that does the job:
- "rewrite-section" when one section is wrong. Give the section heading exactly as it appears and the
  replacement text for that section ONLY.
- "new-version" when a whole draft is wanted, or when the change is too wide to be one section.
- "image" when a picture is wanted: give the brief, not an image.
Attach no proposal when the answer is an answer.`;
