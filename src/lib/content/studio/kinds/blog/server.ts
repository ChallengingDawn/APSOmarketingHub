// BLOG POST - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026). Behind the project's own access (the to-do's route).
//
// Actions
//   index   every blog post of the hub this person can see (any project), for the blog's home - also a GET route
//   batch   topics, one per line -> that many blog-post to-dos in this project, written by this person, a week apart
//           (the hub's own tables only - addPiece; each gets its Action plan sub-action when the project page opens,
//           as every to-do does). Each opens its own studio.
//   ping    nothing - the studio waits on it so a big change goes in two steps
// AI tasks (in the brand's voice for the blog, the route adds it)
//   outline  the post from the brief and its topic: title, meta, excerpt, sections, questions - in the post's language
//   section  one section written again from its heading (and a wish)
//   faq      the questions a reader would still have, answered from the post
//   meta     the meta title and description, the excerpt and the address

import type { AiTask, KindDef, ServerAction, StudioCtx } from "../../contract";
import { s } from "../../contract";
import { addEvent, addPiece } from "@/lib/content/workflow";
import { LANGUAGE_NAME, LIMITS, addDays, batchPlan, blogDoc, blogText, emptyBlog, newId, slugify, type BlogDoc } from "./model";
import { blogCards } from "./posts";

const docOf = (ctx: StudioCtx, raw: unknown) => blogDoc(raw, { language: ctx.piece.language, author: ctx.me.name, title: ctx.piece.title });

const RULES = `Hard rules:
- Use only what the brief, the post and the person give, and what is general engineering knowledge. NEVER invent prices,
  stock, delivery times, certificates, approvals, test results, figures, customer names or quotes. A fact that is
  missing is left out, never estimated.
- Never show a discount value. Never name a chemical manufacturer's brand (Chemours in particular). Wherever chemical
  compatibility or resistance comes up, add the line "for information only, no guarantee, no liability" (in the post's
  language).
- Plain, concrete, human words for engineers and buyers; no slogans, no hype, no exclamation marks.`;

const FORMAT = `Section bodies are markdown WITHOUT the section's own heading: paragraphs, "-" lists, "1." lists, a table
("| a | b |" with a "|---|---|" line) where it helps, ### for a sub-heading. **bold** sparingly. ==word== marks a key
word (shown in red on the page) - one or two in the whole post at most.`;

function context(ctx: StudioCtx, d: BlogDoc): string {
  const b = ctx.brief;
  return [
    `PROJECT: ${ctx.projectTitle}`,
    b.goal && `Goal: ${b.goal}`,
    b.audience && `Who for: ${b.audience}`,
    b.message && `Key message: ${b.message}`,
    b.keywords.length ? `Keywords: ${b.keywords.join(", ")}` : null,
    `THE TO-DO: ${ctx.piece.title}`,
    `WRITE IN: ${LANGUAGE_NAME[d.language] ?? d.language} (store view ${d.store})`,
  ].filter(Boolean).join("\n");
}

const postNow = (d: BlogDoc) => (blogText(d).trim() ? `THE POST AS IT IS NOW:\n${blogText(d).slice(0, 40_000)}` : "THE POST: nothing written yet.");

const SECTIONS = { type: "array", items: { type: "object", additionalProperties: false, required: ["heading", "body"], properties: { heading: { type: "string" }, body: { type: "string", description: "markdown" } } } };
const FAQ = { type: "array", items: { type: "object", additionalProperties: false, required: ["q", "a"], properties: { q: { type: "string" }, a: { type: "string" } } } };

const cleanSections = (v: unknown) => (Array.isArray(v) ? v : []).slice(0, 12).map((x: Record<string, unknown>) => ({ id: newId(), heading: s(x?.heading, 200), body: s(x?.body, 20_000) })).filter((x) => x.heading || x.body);
const cleanFaq = (v: unknown) => (Array.isArray(v) ? v : []).slice(0, 10).map((x: Record<string, unknown>) => ({ id: newId(), q: s(x?.q, 300), a: s(x?.a, 3000) })).filter((x) => x.q && x.a);
/** A text within its limit, cut at a word - the AI is asked to keep to it; this only makes sure. */
const within = (t: string, max: number) => (t.length <= max ? t : t.slice(0, max).replace(/\s+\S*$/, ""));

const outline: AiTask = {
  label: "Write the post",
  maxTokens: 16_000,
  schema: {
    type: "object", additionalProperties: false,
    required: ["title", "metaTitle", "metaDescription", "excerpt", "sections", "faq", "tags"],
    properties: {
      title: { type: "string", description: `the post's title, under ${LIMITS.title} characters` },
      metaTitle: { type: "string", description: `under ${LIMITS.metaTitle} characters` },
      metaDescription: { type: "string", description: `under ${LIMITS.metaDescription} characters` },
      excerpt: { type: "string", description: "the lead: one or two sentences that answer the question at once" },
      sections: SECTIONS,
      faq: FAQ,
      tags: { type: "array", items: { type: "string" }, description: "2-4 topics (product families, applications), short" },
    },
  },
  system: `You write one article for the APSOparts blog: an explainer that answers one question properly, for engineers,
purchasers and maintenance people. The short answer comes first (the excerpt); then 3 to 6 sections of real substance,
each ending somewhere useful; then 3 to 5 questions a reader would still have, answered briefly. The title names the
question the way a person would search it. When the post already has text and the person asks for a change, answer with
the whole post and keep, word for word, every part they did not ask to change.

${FORMAT}

${RULES}`,
  user: (ctx, raw, input) => {
    const d = docOf(ctx, raw);
    const topic = s(input.topic, 500) || d.title || ctx.piece.title;
    return `${context(ctx, d)}\n\nTHE TOPIC: ${topic}\n${s(input.request, 2000) ? `THE PERSON ADDS: ${s(input.request, 2000)}\n` : ""}\n${postNow(d)}`;
  },
  clean: (raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const title = within(s(r.title, 300), LIMITS.title);
    return {
      title, slug: slugify(title), metaTitle: within(s(r.metaTitle, 200), LIMITS.metaTitle), metaDescription: within(s(r.metaDescription, 400), LIMITS.metaDescription),
      excerpt: within(s(r.excerpt, 800), LIMITS.excerpt), sections: cleanSections(r.sections), faq: cleanFaq(r.faq),
      tags: (Array.isArray(r.tags) ? r.tags : []).map((t) => s(t, 40)).filter(Boolean).slice(0, 4),
    };
  },
};

const section: AiTask = {
  label: "Write this section",
  maxTokens: 6000,
  schema: { type: "object", additionalProperties: false, required: ["heading", "body"], properties: { heading: { type: "string" }, body: { type: "string" } } },
  system: `You write ONE section of an APSOparts blog article again, so it fits the rest of the post: substance, an engineer's
precision, an ending that leads somewhere.

${FORMAT}

${RULES}`,
  user: (ctx, raw, input) => {
    const d = docOf(ctx, raw);
    const i = Math.max(0, Math.floor(Number(input.index) || 0));
    const sec = d.sections[i];
    return `${context(ctx, d)}\n\n${postNow(d)}\n\nWRITE AGAIN: section ${i + 1}, "${sec?.heading ?? ""}"${s(input.request, 2000) ? `\nTHE PERSON ASKS: ${s(input.request, 2000)}` : ""}`;
  },
  clean: (raw) => ({ heading: s((raw as Record<string, unknown>)?.heading, 200), body: s((raw as Record<string, unknown>)?.body, 20_000) }),
};

const faq: AiTask = {
  label: "Questions and answers",
  maxTokens: 4000,
  schema: { type: "object", additionalProperties: false, required: ["faq"], properties: { faq: FAQ } },
  system: `You write the 3 to 5 questions a reader of this APSOparts blog article would still have, each answered in two to
four sentences from what the post says and general engineering knowledge. Questions are phrased the way people search.
Answers are plain text (no markdown headings).

${RULES}`,
  user: (ctx, raw) => { const d = docOf(ctx, raw); return `${context(ctx, d)}\n\n${postNow(d)}`; },
  clean: (raw) => ({ faq: cleanFaq((raw as Record<string, unknown>)?.faq) }),
};

const meta: AiTask = {
  label: "Title and description for Google",
  maxTokens: 1500,
  schema: {
    type: "object", additionalProperties: false, required: ["metaTitle", "metaDescription", "excerpt", "slug"],
    properties: {
      metaTitle: { type: "string", description: `at most ${LIMITS.metaTitle} characters, the question or the topic first` },
      metaDescription: { type: "string", description: `at most ${LIMITS.metaDescription} characters: the answer in short, a reason to click` },
      excerpt: { type: "string", description: "the lead: one or two sentences" },
      slug: { type: "string", description: "the address: 3-6 words, lower case, dashes" },
    },
  },
  system: `You write what Google shows for an APSOparts blog article: the meta title (at most ${LIMITS.metaTitle} characters),
the meta description (at most ${LIMITS.metaDescription} characters), the lead, and a short address. Count the
characters. In the post's language.

${RULES}`,
  user: (ctx, raw) => { const d = docOf(ctx, raw); return `${context(ctx, d)}\n\n${postNow(d)}`; },
  clean: (raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    return {
      metaTitle: within(s(r.metaTitle, 200), LIMITS.metaTitle), metaDescription: within(s(r.metaDescription, 400), LIMITS.metaDescription),
      excerpt: within(s(r.excerpt, 800), LIMITS.excerpt), slug: slugify(s(r.slug, 120)),
    };
  },
};

const index: ServerAction = async (ctx) => ({ cards: await blogCards({ username: ctx.me.username, admin: ctx.me.admin }) });

const batch: ServerAction = async (ctx, _raw, input) => {
  const start = typeof input.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.start) ? input.start : addDays(new Date().toISOString().slice(0, 10), 7);
  const plan = batchPlan(String(input.topics ?? ""), start);
  if (!plan.length) throw new Error("Write the topics, one per line.");
  const made: { id: number; title: string; dueDate: string | null }[] = [];
  for (const p of plan) {
    const piece = await addPiece({
      projectId: ctx.projectId, contentType: "blog-article", language: ctx.piece.language, title: p.title,
      writer: ctx.me.username, reviewer: ctx.piece.reviewer, dueDate: p.dueDate, by: ctx.me.username,
    });
    await addEvent(ctx.projectId, piece.id, ctx.me.username, "piece", { piece: piece.title });
    made.push({ id: piece.id, title: piece.title, dueDate: piece.dueDate });
  }
  return { made };
};

export const blogKind: KindDef = {
  kind: "blog",
  channel: "blog",
  empty: (ctx) => emptyBlog({ title: ctx.piece.title, language: ctx.piece.language, author: ctx.me.name }),
  toText: blogText,
  tasks: { outline, section, faq, meta },
  actions: { index, batch, ping: async () => ({ ok: true }) },
};
