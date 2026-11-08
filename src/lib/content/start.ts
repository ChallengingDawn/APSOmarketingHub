// STARTING A PROJECT (SARCLA 08.11.2026: "creating a project you should select the type of content you need and the task
// assignment - an action - for each one, as a ticket"; "review ideas from multiple apps and then create a project").
//
//   proposeProject  the AI reads the goal (and the ideas it comes from) and proposes the project: its name, its brief and
//                   its lines - each a content type of the ones offered, or a plain action - with why
//   startProject    makes it in one go: the project, its brief, where it came from, its place in the action plan (admins),
//                   every line as a to-do with its owner, reviewer and day (each its plan sub-action), the people in the
//                   project, and - when asked - each line's ticket in "From Scroll to Sale"
// The AI only proposes; nothing is made until the person presses Start.

import { claudeText, getAnthropic } from "@/lib/ai/claude";
import { brandSystemPrompt, readBrain } from "@/lib/brain";
import { OFFERED_CONTENT_TYPES } from "@/lib/content/contentTypes";
import { LANGUAGES } from "@/lib/content/languages";
import { TASK_KIND } from "@/lib/content/pieceRules";
import { createProject } from "@/lib/content/projects";
import { share } from "@/lib/content/sharing";
import { createTodoTicket, movePlace, planPlaces, syncPieceTasks, ticketDraft } from "@/lib/content/todos";
import { addEvent, addPiece, cleanBrief, setBrief, setPlanItem, setSource } from "@/lib/content/workflow";
import { markIdeas } from "@/lib/content/ideas";

export type IdeaRef = { key?: string; source: string; title: string; why?: string; url?: string };
export type Line = { contentType: string; title: string; language: string | null; writer: string | null; reviewer: string | null; dueDate: string | null; why?: string };
export type Proposal = { title: string; goal: string; audience: string; message: string; lines: (Omit<Line, "writer" | "reviewer" | "dueDate"> & { why: string })[] };

const KIND_KEYS = [...OFFERED_CONTENT_TYPES.map((t) => t.key), TASK_KIND];
const LANG_CODES = LANGUAGES.map((l) => l.code);

const ideasText = (ideas: IdeaRef[]) => ideas.map((i) => `- [${i.source}] ${i.title}${i.why ? ` - ${i.why}` : ""}${i.url ? ` (${i.url})` : ""}`).join("\n");

export async function proposeProject(p: { goal: string; ideas: IdeaRef[]; languages: string[] }): Promise<Proposal | null> {
  const client = getAnthropic();
  if (!client) return null;
  const brain = await readBrain();
  const kinds = OFFERED_CONTENT_TYPES.map((t) => `${t.key}: ${t.label} - ${t.blurb}`).join("\n");
  const schema = {
    type: "object", additionalProperties: false, required: ["title", "goal", "audience", "message", "lines"],
    properties: {
      title: { type: "string" }, goal: { type: "string" }, audience: { type: "string" }, message: { type: "string" },
      lines: {
        type: "array",
        items: {
          type: "object", additionalProperties: false, required: ["contentType", "title", "language", "why"],
          properties: {
            contentType: { type: "string", enum: KIND_KEYS }, title: { type: "string" },
            language: { type: "string", enum: [...LANG_CODES, "none"] }, why: { type: "string" },
          },
        },
      },
    },
  };
  const r = await claudeText({
    client,
    system: [{ type: "text", text: `${brandSystemPrompt(brain)}\n\nYou plan content projects for the APSOparts marketing team. From a goal and the ideas it comes from, propose ONE project: a short name (at most 8 words), its goal (one sentence), who it is for, its key message, and the to-dos that make it - each a content type from the list, or "${TASK_KIND}" for a plain action around them (brief the agency, get product photos, check with product management...). Between 3 and 8 lines; one line per language only where the languages asked need it. Titles are short and concrete (what it is, not its type). "why" = one sentence. English. Never invent product facts or figures.\n\nContent types:\n${kinds}\n${TASK_KIND}: an action (no content of its own)` }],
    user: [`Goal: ${p.goal || "(none given - read the ideas)"}`, p.ideas.length ? `Ideas it comes from:\n${ideasText(p.ideas)}` : "", `Languages wanted: ${p.languages.length ? p.languages.join(", ") : "DE"}`].filter(Boolean).join("\n\n"),
    budget: { maxTokens: 2500, effort: "low" },
    outputFormat: { type: "json_schema", schema },
  });
  if (!r.ok) throw new Error(r.failure.error);
  const out = JSON.parse(r.text) as { title: string; goal: string; audience: string; message: string; lines: { contentType: string; title: string; language: string; why: string }[] };
  return {
    title: out.title.slice(0, 120), goal: out.goal.slice(0, 600), audience: out.audience.slice(0, 300), message: out.message.slice(0, 300),
    lines: out.lines.filter((l) => KIND_KEYS.includes(l.contentType)).slice(0, 12).map((l) => ({
      contentType: l.contentType, title: l.title.slice(0, 160), why: l.why.slice(0, 240),
      language: l.contentType === TASK_KIND || l.language === "none" || !LANG_CODES.includes(l.language) ? null : l.language,
    })),
  };
}

export type StartInput = {
  title: string; goal: string; audience: string; message: string; ideas: IdeaRef[]; planItem: number | null; tickets: boolean; lines: Line[];
};
export type StartResult = { id: number; pieces: number; tickets: { made: number; refused: string[] } };

export async function startProject(input: StartInput, me: { username: string; admin: boolean }): Promise<StartResult> {
  const title = input.title.trim() || input.lines[0]?.title || "New project";
  const first = input.lines.find((l) => l.contentType !== TASK_KIND)?.contentType ?? null;
  // where it came from: the ideas, one line each with its key (as APSOconvert and AEO mark theirs), in the project's notes
  const notes = input.ideas.length ? input.ideas.map((i) => `[idea ${i.key ?? i.source}] ${i.title}${i.why ? ` - ${i.why}` : ""}`).join("\n").slice(0, 4000) : null;
  const project = await createProject(title, notes, me.username, first);
  const id = project.id;
  await setBrief(id, cleanBrief({ goal: input.goal, audience: input.audience, message: input.message, keywords: [], channels: [] }));
  // the source column is short ("seo", "aeo", "team"...): the first idea's app
  if (input.ideas.length) await setSource(id, input.ideas[0].source.slice(0, 16));
  const keys = input.ideas.map((i) => i.key).filter((k): k is string => !!k);
  if (keys.length) await markIdeas(keys, "project", me.username, id);
  await addEvent(id, null, me.username, "created", { ideas: input.ideas.length });
  if (me.admin && input.planItem != null && (await planPlaces()).some((p) => p.id === input.planItem)) {
    await setPlanItem(id, input.planItem);
    await movePlace(id, input.planItem);
    await addEvent(id, null, me.username, "place", { planItem: input.planItem });
  }
  const made: number[] = [];
  for (const l of input.lines.slice(0, 20)) {
    const task = l.contentType === TASK_KIND;
    if (task && !l.title.trim()) continue;
    const piece = await addPiece({
      projectId: id, contentType: l.contentType, title: l.title.trim() || null, language: task ? null : l.language,
      writer: l.writer, reviewer: task ? null : l.reviewer, dueDate: l.dueDate, by: me.username,
    });
    made.push(piece.id);
    await addEvent(id, piece.id, me.username, "piece", { piece: piece.title });
  }
  // everyone given a line joins the project, so their links open
  const editors = [...new Set(input.lines.map((l) => l.writer).filter((u): u is string => !!u && u !== me.username))];
  const reviewers = [...new Set(input.lines.map((l) => l.reviewer).filter((u): u is string => !!u && u !== me.username && !editors.includes(u)))];
  if (editors.length) await share(id, me.username, editors, "editor", null);
  if (reviewers.length) await share(id, me.username, reviewers, "commenter", null);
  // each line its plan sub-action
  const pieces = await syncPieceTasks(id, me.username);
  const tickets = { made: 0, refused: [] as string[] };
  if (input.tickets) {
    for (const p of pieces.filter((x) => made.includes(x.id) && x.taskId)) {
      try {
        const d = await ticketDraft(id, p.taskId!);
        if (!d.ok) { tickets.refused.push(`${p.title}: ${d.error}`); continue; }
        const t = await createTodoTicket(id, p.taskId!, d.values, me.username);
        if (t.ok) tickets.made += 1; else tickets.refused.push(`${p.title}: ${t.error}`);
      } catch (e) {
        tickets.refused.push(`${p.title}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return { id, pieces: made.length, tickets };
}
