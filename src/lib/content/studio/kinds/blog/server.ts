// BLOG POST - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026). Behind the project's own access (the to-do's route).
//
// Actions
//   index   every blog post of the hub this person can see (any project), for the blog's home - also a GET route
//   batch   topics, one per line -> that many blog-post to-dos in this project, written by this person, a week apart
//           (the hub's own tables only - addPiece; each gets its Action plan sub-action when the project page opens,
//           as every to-do does). Each opens its own studio.
//   ping    nothing - the studio waits on it so a big change goes in two steps
// AI tasks (in the brand's voice for the blog, the route adds it)
//   outline  the post from the brief and its topic: title, meta, lead, "in short", sections (each with a pull quote and
//            a picture idea), questions, the band to the shop, the post's picture idea - in the post's language (or
//            another one: the whole post translated)
//   section  one section again: written from its heading, shorter, more concrete, or translated (and a wish)
//   faq      the questions a reader would still have, answered from the post
//   meta     the meta title and description, the excerpt and the address
// cv16 (11.11.2026): every answer is read against the shop's word rules before it lands (./guard.ts) - a sentence with a
// stock or delivery promise, a price, a discount value, Chemours or a certificate claimed for us without a source goes,
// and the studio says so in the change's line (`note`). "Write it all again" has its ways (input.mode: topic / directly /
// ask - "start again" is the studio's own). A translation takes every part along: the lines under the pictures, what
// they show, the author's role. Actions `pictures` / `store` (the post's pictures in the hub's picture storage, by
// readable names) and `live` (each page of the post read on the shop) serve the last step.

import type { AiTask, KindDef, ServerAction, StudioCtx } from "../../contract";
import { s } from "../../contract";
import { addEvent, addPiece } from "@/lib/content/workflow";
import { defaultReviewerOf } from "@/lib/content/people";
import { shareCandidates } from "@/lib/content/sharing";
import { LANGUAGE_NAME, LIMITS, addDays, batchPlan, blogDoc, blogText, emptyBlog, newId, newSection, slugify, type BlogDoc } from "./model";
import { guardAll, guardPost } from "./guard";
import { livePaths, readPictureFiles, storePictureFiles } from "./publishServer";
import { oneLine, partLabel, partText, sectionOf } from "./parts";
import { blogCards } from "./posts";

const docOf = (ctx: StudioCtx, raw: unknown) => blogDoc(raw, { language: ctx.piece.language, author: ctx.me.name, title: ctx.piece.title });

/** What the rules may take as given (./guard.ts): the brief, the to-do, the topic, the person's words, the post as it is. */
const sourcesOf = (ctx: StudioCtx, raw: unknown, input: Record<string, unknown>) => {
  const b = ctx.brief;
  const d = docOf(ctx, raw);
  return [ctx.projectTitle, ctx.piece.title, b.goal, b.audience, b.message, b.keywords.join(" "), s(input.topic, 500), s(input.request, 2000),
    blogText(d), d.relatedProducts.map((p) => p.name).join(" ")].join("\n");
};
const noteOf = (said: string[]) => (said.length ? { note: [...new Set(said)].slice(0, 6).join("; ") } : {});

const RULES = `Hard rules:
- Use only what the brief, the post and the person give, and what is general engineering knowledge. NEVER invent prices,
  stock, delivery times, certificates, approvals, test results, figures, customer names or quotes. A fact that is
  missing is left out, never estimated.
- Never show a discount value. Never name a chemical manufacturer's brand (Chemours in particular). When chemical
  compatibility or resistance comes up, the line "for information only, no guarantee, no liability" (in the post's
  language) follows it as a paragraph of its own - once in a section, not after every sentence (an answer to a question
  about it carries it too).
- Plain, concrete, human words for engineers and buyers; no slogans, no hype, no exclamation marks.`;

const FORMAT = `Section bodies are markdown WITHOUT the section's own heading: paragraphs, "-" lists, "1." lists, a table
("| a | b |" with a "|---|---|" line) where it helps, ### for a sub-heading. **bold** sparingly. ==word== marks a key
word (shown in red on the page) - one or two in the whole post at most. A line starting with "> " is a callout box (a
practical tip, a check, a caution) - one in a section at most, and not in every section. [words](/<store>/...) links to a
shop page only when the brief or the post gives its address.`;

function context(ctx: StudioCtx, d: BlogDoc, language?: string): string {
  const b = ctx.brief;
  return [
    `PROJECT: ${ctx.projectTitle}`,
    b.goal && `Goal: ${b.goal}`,
    b.audience && `Who for: ${b.audience}`,
    b.message && `Key message: ${b.message}`,
    b.keywords.length ? `Keywords: ${b.keywords.join(", ")}` : null,
    `THE TO-DO: ${ctx.piece.title}`,
    language && language !== d.language
      ? `WRITE IN: ${LANGUAGE_NAME[language] ?? language} - a translation of the post as it is now, for that language's readers`
      : `WRITE IN: ${LANGUAGE_NAME[d.language] ?? d.language} (store view ${d.store})`,
  ].filter(Boolean).join("\n");
}

const postNow = (d: BlogDoc) => (blogText(d).trim() ? `THE POST AS IT IS NOW:\n${blogText(d).slice(0, 40_000)}` : "THE POST: nothing written yet.");

const SECTIONS = {
  type: "array",
  items: {
    type: "object", additionalProperties: false, required: ["heading", "body", "quote", "picture", "pictureAlt", "caption"],
    properties: {
      heading: { type: "string" },
      body: { type: "string", description: "markdown" },
      quote: { type: "string", description: "one sentence of this section worth pulling out in large type, said in other words than the text - or \"\" for most sections (two in the post at most)" },
      picture: { type: "string", description: "for one or two sections only: what a photo in the section would show (in English, concrete: the part, the hands, the place, the light) - else \"\"" },
      pictureAlt: { type: "string", description: "what that photo shows, in the post's language, one short line - or \"\"" },
      caption: { type: "string", description: "a translation only: the line under this section's picture, translated - else \"\"" },
    },
  },
};
const FAQ = { type: "array", items: { type: "object", additionalProperties: false, required: ["q", "a"], properties: { q: { type: "string" }, a: { type: "string" } } } };

const cleanSections = (v: unknown) => (Array.isArray(v) ? v : []).slice(0, 12)
  .map((x: Record<string, unknown>) => newSection({
    heading: s(x?.heading, 200), body: s(x?.body, 20_000), quote: s(x?.quote, 300),
    image: { url: "", alt: s(x?.pictureAlt, 200), caption: s(x?.caption, 300), prompt: s(x?.picture, 1000) },
  }))
  .filter((x) => x.heading || x.body);
const cleanFaq = (v: unknown) => (Array.isArray(v) ? v : []).slice(0, 10).map((x: Record<string, unknown>) => ({ id: newId(), q: s(x?.q, 300), a: s(x?.a, 3000) })).filter((x) => x.q && x.a);
/** A text within its limit, cut at a word - the AI is asked to keep to it; this only makes sure. */
const within = (t: string, max: number) => (t.length <= max ? t : t.slice(0, max).replace(/\s+\S*$/, ""));

/** "Write it all again", its ways (cv16, as the Page builder's WriteAgain): what the AI is told. */
const WRITE_MODES: Record<string, string> = {
  topic: "Write the whole post new from the topic and the brief, as if nothing were written: a fresh structure.",
  directly: "Write the whole post again, better: clearer, more concrete, more useful. Keep its structure - EVERY section it has now comes back, in the same order, under its own heading made better (the sections the person added too) - and keep every fact.",
  ask: "Change the whole post as the person asks below: keep, word for word, every part they did not ask to change, and every section it has now in its order (the person's own too) unless they ask otherwise.",
};

const outline: AiTask = {
  label: "Write the post",
  maxTokens: 16_000,
  schema: {
    type: "object", additionalProperties: false,
    required: ["title", "metaTitle", "metaDescription", "excerpt", "takeaways", "sections", "faq", "tags", "cta", "picture", "pictureAlt", "heroCaption", "authorRole"],
    properties: {
      title: { type: "string", description: `the post's title, under ${LIMITS.title} characters` },
      metaTitle: { type: "string", description: `under ${LIMITS.metaTitle} characters` },
      metaDescription: { type: "string", description: `under ${LIMITS.metaDescription} characters` },
      excerpt: { type: "string", description: "the lead: one or two sentences that answer the question at once" },
      takeaways: { type: "array", items: { type: "string" }, description: "3 to 4 short lines a reader takes away (each under 110 characters, no markdown)" },
      sections: SECTIONS,
      faq: FAQ,
      tags: { type: "array", items: { type: "string" }, description: "2-4 topics (product families, applications), short" },
      cta: {
        type: "object", additionalProperties: false, required: ["title", "text", "label"],
        properties: {
          title: { type: "string", description: "the band after the article that leads to the shop: a short title naming what the reader can now order (no price, no discount)" },
          text: { type: "string", description: "one sentence: what they find in the shop (only what the brief or general shop facts say)" },
          label: { type: "string", description: "the button: two to four words, a verb first" },
        },
      },
      picture: { type: "string", description: "the post's main photo: what it shows, in English, concrete (the part in use, hands and tools, the setting, the light)" },
      pictureAlt: { type: "string", description: "what that photo shows, in the post's language, one short line" },
      heroCaption: { type: "string", description: "a translation only: the line under the post's picture, translated - else \"\"" },
      authorRole: { type: "string", description: "a translation only: the author's role, translated - else \"\"" },
    },
  },
  system: `You write one article for the APSOparts blog: an explainer that answers one question properly, for engineers,
purchasers and maintenance people. The short answer comes first (the excerpt), then 3 to 4 "in short" lines; then 4 to 6
sections of real substance (each 120 to 300 words: the reasoning, a list or a table where it helps, an ending that leads
somewhere useful); then 3 to 5 questions a reader would still have, answered briefly; then the band to the shop. Give one
or two sections a pull quote and one or two a photo idea; the post a main photo idea (real, honest workshop or plant
scenes, natural light, no lettering, never a product shot on white). The title names the question the way a person would
search it. When the post already has text and the person asks for a change, answer with the whole post and keep, word
for word, every part they did not ask to change. When asked to translate, translate everything faithfully - meaning,
structure and markdown kept - and write the topics and the meta texts for the new language's readers; the lines under
the pictures, what they show and the author's role go along.

${FORMAT}

${RULES}`,
  user: (ctx, raw, input) => {
    const d = docOf(ctx, raw);
    const topic = s(input.topic, 500) || d.title || ctx.piece.title;
    const lang = s(input.language, 4).toUpperCase();
    const mode = WRITE_MODES[s(input.mode, 20)] ? s(input.mode, 20) : "";
    // a translation: the words around the pictures and the author's role go along (cv16 - "a translation takes EVERY part")
    const extras = lang ? [
      d.hero.url ? `The post's picture shows: ${d.hero.alt || "-"}` : "",
      d.hero.caption.trim() ? `The line under the post's picture: ${d.hero.caption.trim()}` : "",
      ...d.sections.map((x, i) => (x.image.url ? `Section ${i + 1}'s picture shows: ${x.image.alt || "-"}${x.image.caption.trim() ? ` / the line under it: ${x.image.caption.trim()}` : ""}` : "")),
      d.authorRole.trim() ? `The author's role: ${d.authorRole.trim()}` : "",
    ].filter(Boolean) : [];
    // the post's sections as they are, in their order (Directly / Ask: every one of them comes back, the person's own too)
    const keep = (mode === "directly" || mode === "ask") && d.sections.length
      ? `THE SECTIONS NOW, IN ORDER (${d.sections.length}): ${d.sections.map((x, i) => `${i + 1}. ${x.heading || "(no heading yet)"}`).join(" | ")}\n`
      : "";
    const also = extras.length ? `ALSO TRANSLATE (into pictureAlt, heroCaption, authorRole and each section's pictureAlt and caption):\n${extras.join("\n")}\n` : "";
    const now = mode === "topic" ? "THE POST: write it new from the topic and the brief - what is written now is not a source." : postNow(d);
    return `${context(ctx, d, lang || undefined)}\n\nTHE TOPIC: ${topic}\n${mode ? `HOW: ${WRITE_MODES[mode]}\n` : ""}${s(input.request, 2000) ? `THE PERSON ADDS: ${s(input.request, 2000)}\n` : ""}${keep}${also}\n${now}`;
  },
  clean: (raw, doc, ctx, input) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const src = sourcesOf(ctx, doc, input);
    const said: string[] = [];
    const k = (t: string) => { const x = guardPost(t, src); said.push(...x.said); return x.text; };
    const title = within(k(s(r.title, 300)), LIMITS.title);
    const sections = cleanSections(r.sections)
      .map((x) => ({ ...x, heading: k(x.heading), body: k(x.body), quote: k(x.quote), image: { ...x.image, alt: k(x.image.alt), caption: k(x.image.caption) } }))
      .filter((x) => x.heading || x.body);
    const faq = cleanFaq(r.faq).map((f) => ({ ...f, q: k(f.q), a: k(f.a) })).filter((f) => f.q && f.a);
    const c = (r.cta ?? {}) as Record<string, unknown>;
    const cta = guardAll({ title: s(c.title, 120), text: s(c.text, 300), label: s(c.label, 40) }, src);
    said.push(...cta.said);
    return {
      title, slug: slugify(title), metaTitle: within(k(s(r.metaTitle, 200)), LIMITS.metaTitle), metaDescription: within(k(s(r.metaDescription, 400)), LIMITS.metaDescription),
      excerpt: within(k(s(r.excerpt, 800)), LIMITS.excerpt), sections, faq,
      takeaways: (Array.isArray(r.takeaways) ? r.takeaways : []).map((t) => k(s(t, 200))).filter(Boolean).slice(0, 5),
      tags: (Array.isArray(r.tags) ? r.tags : []).map((t) => s(t, 40)).filter(Boolean).slice(0, 4),
      cta: cta.texts,
      picture: s(r.picture, 1000), pictureAlt: k(s(r.pictureAlt, 200)), heroCaption: k(s(r.heroCaption, 300)), authorRole: s(r.authorRole, 120),
      ...noteOf(said),
    };
  },
};

/** What each of a section's own buttons asks. */
const SECTION_ASK: Record<string, string> = {
  write: "Write this section (again) from its heading and the rest of the post: substance, an engineer's precision, an ending that leads somewhere.",
  shorter: "Make this section about a third shorter: keep every fact, the structure and the language; cut repetition and padding.",
  concrete: "Make this section more concrete: replace general statements with the specific mechanism, typical values (SI units, ranges where general engineering knowledge gives them), an example from a plant or a workshop, a check the reader can do. Never invent figures about APSOparts.",
  translate: "Translate this section faithfully into the language named, keeping the markdown, the meaning and the length.",
};

const section: AiTask = {
  label: "Write this section",
  maxTokens: 6000,
  schema: {
    type: "object", additionalProperties: false, required: ["heading", "body", "quote"],
    properties: {
      heading: { type: "string" }, body: { type: "string" },
      quote: { type: "string", description: "the section's pull quote in the same language - the one it has, made to fit, or \"\" when it has none" },
    },
  },
  system: `You work on ONE section of an APSOparts blog article, so it fits the rest of the post.

${FORMAT}

${RULES}`,
  user: (ctx, raw, input) => {
    const d = docOf(ctx, raw);
    const i = Math.max(0, Math.floor(Number(input.index) || 0));
    const sec = d.sections[i];
    const mode = SECTION_ASK[s(input.mode, 20)] ? s(input.mode, 20) : "write";
    const lang = s(input.language, 4).toUpperCase();
    const ask = `${SECTION_ASK[mode]}${mode === "translate" ? ` Into: ${LANGUAGE_NAME[lang] ?? lang}.` : ""}`;
    const now = sec ? `THE SECTION NOW:\n## ${sec.heading}\n\n${sec.body}${sec.quote ? `\n\nPull quote: ${sec.quote}` : ""}` : "";
    return `${context(ctx, d)}\n\n${postNow(d)}\n\nTHE TASK, for section ${i + 1} ("${sec?.heading ?? ""}"): ${ask}\n${now}${s(input.request, 2000) ? `\nTHE PERSON ADDS: ${s(input.request, 2000)}` : ""}`;
  },
  clean: (raw, doc, ctx, input) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const g = guardAll({ heading: s(r.heading, 200), body: s(r.body, 20_000), quote: s(r.quote, 300) }, sourcesOf(ctx, doc, input));
    return { ...g.texts, ...noteOf(g.said) };
  },
};

const faq: AiTask = {
  label: "Questions and answers",
  maxTokens: 4000,
  schema: { type: "object", additionalProperties: false, required: ["faq"], properties: { faq: FAQ } },
  system: `You write the questions a reader of this APSOparts blog article would still have, each answered in two to
four sentences from what the post says and general engineering knowledge. Questions are phrased the way people search.
Answers are plain text (no markdown headings).

${RULES}`,
  // input.add: one or two questions the post's own questions do not cover yet (the studio adds them under those)
  user: (ctx, raw, input) => {
    const d = docOf(ctx, raw);
    const ask = input.add === true
      ? `Write ONE or TWO new questions the questions below do not cover yet. The questions the post has:\n${d.faq.map((f) => `- ${f.q}`).join("\n") || "(none)"}`
      : "Write 3 to 5 questions.";
    return `${context(ctx, d)}\n\n${postNow(d)}\n\n${ask}${s(input.request, 1000) ? `\nTHE PERSON ADDS: ${s(input.request, 1000)}` : ""}`;
  },
  clean: (raw, doc, ctx, input) => {
    const src = sourcesOf(ctx, doc, input);
    const said: string[] = [];
    const faq = cleanFaq((raw as Record<string, unknown>)?.faq).map((f) => { const g = guardAll({ q: f.q, a: f.a }, src); said.push(...g.said); return { ...f, ...g.texts }; }).filter((f) => f.q && f.a);
    return { faq, ...noteOf(said) };
  },
};

/** One part of the post changed as asked (Content v3: the part clicked in the preview - a paragraph, the lead, a
 *  question's answer, the button). Its words are read here from the saved post, never sent by the browser. */
const part: AiTask = {
  label: "Change this part",
  maxTokens: 5000,
  schema: {
    type: "object", additionalProperties: false, required: ["text"],
    properties: { text: { type: "string", description: "the part's new words only, in the post's language and in the same form" } },
  },
  system: `You change ONE part of an APSOparts blog article as the person asks, so that it still fits the rest of the post.
Answer with that part's new words only - never the whole post, never a heading the part did not have. Keep every fact
unless asked otherwise; keep the language of the post.

${FORMAT}

${RULES}`,
  user: (ctx, raw, input) => {
    const d = docOf(ctx, raw);
    const key = s(input.key, 80);
    const now = partText(d, key);
    if (now === null) throw new Error("That part is not in the post any more.");
    const form = oneLine(key) ? "ONE line, no markdown, no full stop at the end of a heading or a button"
      : key === "short" ? "3 to 4 short lines, one per line, no list marks, each under 110 characters"
      : key.includes(":b:") ? "markdown: a paragraph, a list or a table, as the part is now (more than one block only when asked)"
      : "plain sentences (**bold** sparingly)";
    const sid = sectionOf(key);
    const sec = sid ? d.sections.find((x) => x.id === sid) : null;
    return [
      context(ctx, d),
      postNow(d),
      sec ? `THE SECTION IT IS IN:\n## ${sec.heading}\n\n${sec.body}` : "",
      `THE PART: ${partLabel(d, key)}\nIts form: ${form}\nIts words now:\n${now || "(empty - write it)"}`,
      `WHAT THE PERSON ASKS: ${s(input.request, 2000) || "Write it better: clearer and more concrete."}`,
    ].filter(Boolean).join("\n\n");
  },
  clean: (raw, doc, ctx, input) => {
    const g = guardPost(s((raw as Record<string, unknown>)?.text, 20_000), sourcesOf(ctx, doc, input));
    return { text: g.text, ...noteOf(g.said) };
  },
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
  clean: (raw, doc, ctx, input) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const g = guardAll({ metaTitle: s(r.metaTitle, 200), metaDescription: s(r.metaDescription, 400), excerpt: s(r.excerpt, 800) }, sourcesOf(ctx, doc, input));
    return {
      metaTitle: within(g.texts.metaTitle, LIMITS.metaTitle), metaDescription: within(g.texts.metaDescription, LIMITS.metaDescription),
      excerpt: within(g.texts.excerpt, LIMITS.excerpt), slug: slugify(s(r.slug, 120)), ...noteOf(g.said),
    };
  },
};

const index: ServerAction = async (ctx) => ({ cards: await blogCards({ username: ctx.me.username, admin: ctx.me.admin }) });

const batch: ServerAction = async (ctx, _raw, input) => {
  const start = typeof input.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.start) ? input.start : addDays(new Date().toISOString().slice(0, 10), 7);
  const plan = batchPlan(String(input.topics ?? ""), start);
  if (!plan.length) throw new Error("Write the topics, one per line.");
  const made: { id: number; title: string; dueDate: string | null }[] = [];
  // each new post's people prefilled as every new to-do's (SARCLA 10.11.2026): its owner who makes it, the reviewer this
  // post's - or Claudio when it has none (lib/content/people.ts)
  const reviewer = ctx.piece.reviewer ?? defaultReviewerOf(await shareCandidates());
  for (const p of plan) {
    const piece = await addPiece({
      projectId: ctx.projectId, contentType: "blog-article", language: ctx.piece.language, title: p.title,
      writer: ctx.me.username, reviewer, dueDate: p.dueDate, by: ctx.me.username,
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
  tasks: { outline, section, faq, meta, part },
  actions: {
    index, batch, ping: async () => ({ ok: true }),
    // the last step (cv16): the post's pictures in the hub's picture storage, and its pages read on the shop
    pictures: async (_ctx, _raw, input) => readPictureFiles(input.pictures),
    store: async (ctx, _raw, input) => {
      if (!ctx.canEdit) throw new Error("Only the people who can edit the post can store its pictures.");
      return storePictureFiles(input.pictures);
    },
    live: async (_ctx, _raw, input) => ({ pages: await livePaths(input.paths) }),
  },
};
