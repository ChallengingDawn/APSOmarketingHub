// SOCIAL POST - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026). The AI runs in the brand's voice (the route puts
// brain.brandSystemPrompt for "linkedin" first - its hook craft, its gold posts), then these tasks:
//   write      the post for every network it goes to, each in its own length and manner
//   adapt      one network's text rewritten for another
//   carousel   the post turned into 5-8 slides, few words each
//   hashtags   3-5 real ones
//   ask        a change to one network's text, in the person's words
// and one action, "export": the whole post as a text to copy. Nothing is posted anywhere - publishing is not connected.

import type { KindDef, StudioCtx } from "../../contract";
import { LANGUAGE_BY_CODE } from "@/lib/content/languages";
import { SHOP_PHOTOS } from "../banner/brand";
import {
  CAROUSEL_SCHEMA, HASHTAG_SCHEMA, TEXT_SCHEMA, WRITE_SCHEMA, askedNetworks, cleanCarousel, cleanTags, cleanText, cleanWrite,
} from "./ai";
import { NETWORK, NETWORKS, emptySocial, enabled, exportPack, isNetwork, normalizeSocial, slidesOf, socialText, type Network, type SocialDoc } from "./model";
import {
  DESIGN_SCHEMA, STYLE_GUIDE, TEMPLATE_CATALOGUE, WORDS_ANSWER_SCHEMA, WORDS_STYLES, cleanDesign, cleanWordsAnswer, describePage, type WordsStyle,
} from "./canvasAi";
import { FORMATS, isFormat, pageIn, pageWords, type FormatKey } from "./design";

const MANNER: Record<Network, string> = {
  linkedin: "LinkedIn: 80-160 words, short paragraphs with a blank line between them. The FIRST line is the hook and must work alone before \"…see more\" (about 210 characters, often less on a phone): a concrete observation, a number we really have, or a situation from the reader's day. End with a light question or a pointer a peer would answer.",
  instagram: "Instagram: the caption supports the picture. The first 125 characters show before \"… more\" - put the point there. 40-120 words, plain and visual, line breaks welcome. A link cannot be clicked in a caption: never paste an address; say \"link in bio\" only if the post really needs the link.",
  facebook: "Facebook: conversational and complete in itself, 40-100 words; the first sentence carries it. A link may sit at the end.",
};

const RULES = [
  "# THIS TASK: A SOCIAL POST FOR APSOPARTS",
  "- Answer only in the JSON schema. Plain text in every text field - no markdown, no asterisks.",
  "- Hashtags go ONLY in the hashtags field, never inside a text. 3 to 5 that people in industry really use (#SealingTechnology, #MRO, #Maintenance) - never hashtag soup, never a made-up tag.",
  "- At most one emoji in a whole text, and only if it truly fits. No emoji bullets.",
  "- Never show a discount value (no percentage, no \"up to\", no amount off). Never name Chemours.",
  "- Nothing invented: no figures, prices, customer names, studies or delivery promises that are not in the brief, the to-do or the post's own words. What the shop really offers may be named (standard components, its six technologies, DirectCUT, Quickorder).",
  "- Each network gets its own text, written for it - not one text cut three ways.",
].join("\n");

const langOf = (code: string | null) => (code ? LANGUAGE_BY_CODE[code.toUpperCase()]?.instruction ?? code : "English, British spelling");

function context(ctx: StudioCtx, d: SocialDoc): string {
  const b = ctx.brief;
  const lines = [
    `Project: ${ctx.projectTitle || "(no title)"}`,
    `This post: ${ctx.piece.title}`,
    b.goal ? `Goal: ${b.goal}` : "", b.audience ? `Audience: ${b.audience}` : "", b.message ? `Key message: ${b.message}` : "",
    b.keywords.length ? `Keywords: ${b.keywords.join(", ")}` : "",
    `Language: write in ${langOf(ctx.piece.language)}.`,
    d.link.url ? `The link it points to: ${d.link.url}${d.link.label ? ` (${d.link.label})` : ""}` : "",
  ];
  for (const n of enabled(d)) if (d.networks[n].text.trim()) lines.push(`\nIts ${NETWORK[n].label} text now:\n${d.networks[n].text.trim().slice(0, 3000)}`);
  // the design's words, page by page - what the post shows
  if (d.design.pages.length) {
    const f = d.design.formats[0];
    lines.push(`\nThe design's words now:\n${d.design.pages.map((p, i) => `${i + 1}. ${pageWords(pageIn(d.design, p, f)).join(" | ") || "(no words)"}`).join("\n")}`);
  }
  const slides = d.design.pages.length ? [] : slidesOf(d);
  if (slides.length) lines.push(`\nIts ${d.media.kind === "card" ? "card" : "slides"} now:\n${slides.map((s, i) => `${i + 1}. ${[s.eyebrow, s.headline, s.text].filter((x) => x.trim()).join(" | ")}`).join("\n")}`);
  if (d.hashtags.length) lines.push(`\nIts hashtags now: ${d.hashtags.join(" ")}`);
  if (d.notes.trim()) lines.push(`\nNotes on this post: ${d.notes.trim().slice(0, 1500)}`);
  return lines.filter((x) => x !== "").join("\n");
}

const ask = (input: Record<string, unknown>) => (typeof input.ask === "string" && input.ask.trim() ? `\n\nWhat the person asks: ${input.ask.trim().slice(0, 1200)}` : "");
const netOf = (v: unknown, fallback: Network): Network => (isNetwork(v) ? v : fallback);

/** The canvas's rules for the model: what it may do, how our designs look, what it must never do. */
const CANVAS_RULES = [
  "# THIS TASK: CHANGE THE POST'S DESIGN ON THE CANVAS",
  "You work on a design canvas for an APSOparts social post. Answer only in the JSON schema: a short reply (in English, whatever the post's language: it is for the person in the studio) and the operations that do what the person asks. The studio applies them on the canvas at once (with undo).",
  "- Do exactly what is asked, nothing more. A small ask (\"shorter headline\") is one operation on the object it names (set_text with its id).",
  "- Refer to objects by their id from the list. Change words with set_text (keep the key words' stars), never by removing and adding.",
  "- Our look, as in our motion-graphics films: Futura-like bold type, few words, ONE or two key words per text between *stars* (drawn in APSOparts red), ink on the light blueprint grid or white on petrol, the logo top left, clean margins. A headline has at most about 8 words.",
  "- A new page layout or a page from scratch: use a template (op template) with its words - never build a page from many add_text operations. A carousel: op pages, 4 to 8 pages - first a cover, then one idea per page (slide, tip, checklist, stat, fact, quote ...), the last one points to the shop.",
  "- Pictures: op picture (into a frame by its id with position frame, a new one at a position, or position background) or background with a prompt. The prompt says what the photo shows - industrial, real, no text, no logos, no faces in close-up. At most two pictures per ask: they take time and cost money.",
  "- Our logo: op logo with a position (it replaces the logo there).",
  "- Formats: op format switches the canvas to that size (landscape 1200x627, square 1080x1080, portrait 1080x1350, story 1080x1920, wide 1600x900).",
  "- Unused fields: empty strings, none, 1, an empty list and empty words.",
  "- Never show a discount value (no percentage, no \"up to\", no amount off). Never name Chemours. Never invent figures, prices, delivery times, certificates, customers or quotes: use what the brief and the post say, or what the shop really offers (standard components, its six technologies, DirectCUT cut to size, Quickorder); otherwise leave a placeholder the person replaces.",
  "",
  "# THE TEMPLATES",
  TEMPLATE_CATALOGUE,
].join("\n");

const WORDS_RULES = [
  "# THIS TASK: THE WORDS OF A SOCIAL POST'S DESIGN",
  "Write the words that go ON the picture of an APSOparts social post, from the person's description. Answer only in the JSON schema.",
  "- The person's description says what the words are about: it wins over the project's brief and over the words on the design now (those are only context).",
  "- A call to action names a real place or step (apsoparts.com, the shop, a search) - never a feature the description does not name.",
  "- Few words, as in our motion-graphics films: every word earns its place; sentence case, no exclamation marks, no emojis, no hashtags.",
  "- Mark the one or two key words of a text between *stars* - they are drawn in APSOparts red.",
  "- Never show a discount value. Never name Chemours. Never invent figures, prices, delivery times, certificates, customers or quotes - only what the description, the brief or the shop's real offer says.",
].join("\n");

const pageOf = (d: SocialDoc, input: Record<string, unknown>) => {
  const i = typeof input.page === "number" && Number.isInteger(input.page) ? Math.max(0, Math.min(d.design.pages.length - 1, input.page)) : 0;
  const f: FormatKey = isFormat(input.format) ? input.format : d.design.formats[0];
  return { i, f, page: d.design.pages[i] };
};

export const socialKind: KindDef = {
  kind: "social",
  channel: "linkedin",
  empty: (ctx) => emptySocial({ contentType: ctx.piece.contentType, dueDate: ctx.piece.dueDate }),
  toText: socialText,
  tasks: {
    write: {
      label: "Write the post",
      schema: WRITE_SCHEMA as unknown as Record<string, unknown>,
      system: `${RULES}\n\n# EACH NETWORK'S MANNER\n${Object.values(MANNER).map((m) => `- ${m}`).join("\n")}\n- Write only for the networks the question names; give an empty text for the others.`,
      user: (ctx, doc, input) => {
        const d = normalizeSocial(doc);
        const nets = askedNetworks(input, enabled(d));
        return `${context(ctx, d)}\n\nWrite the post for: ${nets.map((n) => NETWORK[n].label).join(", ")}.${d.networks.linkedin.text.trim() || d.networks.instagram.text.trim() || d.networks.facebook.text.trim() ? " Keep what works in the texts it has; make them better." : ""}${ask(input)}`;
      },
      maxTokens: 3500,
      // the cleaning cannot see which networks were asked (contract: clean has no input) - every text is kept, and the
      // studio applies the networks it asked for
      clean: (raw) => cleanWrite(raw, [...NETWORKS]),
    },
    adapt: {
      label: "Adapt for another network",
      schema: TEXT_SCHEMA as unknown as Record<string, unknown>,
      system: `${RULES}\n\n# EACH NETWORK'S MANNER\n${Object.values(MANNER).map((m) => `- ${m}`).join("\n")}\n- Rewrite the text for the target network: the same idea and facts, its manner and length - not a copy.`,
      user: (ctx, doc, input) => {
        const d = normalizeSocial(doc);
        const from = netOf(input.from, "linkedin");
        const to = netOf(input.to, "instagram");
        return `${context(ctx, d)}\n\nRewrite the ${NETWORK[from].label} text for ${NETWORK[to].label}:\n\n${d.networks[from].text.trim()}${ask(input)}`;
      },
      maxTokens: 2000,
      // cut to the longest network here; the studio cuts to the target's own length
      clean: (raw) => cleanText(raw, "facebook"),
    },
    carousel: {
      label: "Make a carousel",
      schema: CAROUSEL_SCHEMA as unknown as Record<string, unknown>,
      system: `${RULES}\n\n# A CAROUSEL\n- 5 to 8 slides. Slide 1 is the cover: the hook as a headline, an eyebrow naming the topic. Then one idea per slide. The last slide (layout "end") asks the reader something or points to the shop.\n- Few words: a headline of at most about 8 words, at most two short sentences under it. A "list" slide has one point per line in its text (3 to 5 points).\n- Layouts: cover (first), statement (one strong point), photo (a point with one of the shop's photos), list, end (last).\n- Photos: only the shop's own (${SHOP_PHOTOS.map((p) => `${p.key} = ${p.label.EN}`).join(", ")}) and only where the slide is about that technology; else "none".`,
      user: (ctx, doc, input) => `${context(ctx, normalizeSocial(doc))}\n\nTurn this post into a carousel.${ask(input)}`,
      maxTokens: 3000,
      clean: (raw) => cleanCarousel(raw),
    },
    hashtags: {
      label: "Suggest hashtags",
      schema: HASHTAG_SCHEMA as unknown as Record<string, unknown>,
      system: `${RULES}\n- Give 3 to 5 hashtags for this post, most specific first. Real ones people in industry search and follow - in the post's language where a tag in that language is really used, else English.`,
      user: (ctx, doc, input) => `${context(ctx, normalizeSocial(doc))}\n\nSuggest the hashtags.${ask(input)}`,
      maxTokens: 600,
      clean: (raw) => ({ hashtags: cleanTags((raw as { hashtags?: unknown })?.hashtags) }),
    },
    design: {
      label: "Change the design",
      schema: DESIGN_SCHEMA as unknown as Record<string, unknown>,
      system: CANVAS_RULES,
      user: (ctx, doc, input) => {
        const d = normalizeSocial(doc);
        const { i, f, page } = pageOf(d, input);
        const board = page
          ? describePage(pageIn(d.design, page, f), i, d.design.pages.length, f)
          : `The canvas is empty (format ${f}${f === "custom" ? "" : `, ${FORMATS[f].w} x ${FORMATS[f].h}`}).`;
        return `${context(ctx, d)}\n\n${board}${ask(input)}`;
      },
      maxTokens: 6000,
      clean: (raw) => cleanDesign(raw),
    },
    words: {
      label: "Write the words on the design",
      schema: WORDS_ANSWER_SCHEMA as unknown as Record<string, unknown>,
      system: WORDS_RULES,
      user: (ctx, doc, input) => {
        const d = normalizeSocial(doc);
        const style: WordsStyle = (WORDS_STYLES as readonly string[]).includes(String(input.style)) ? (input.style as WordsStyle) : "headline";
        const what = typeof input.describe === "string" ? input.describe.trim().slice(0, 1500) : "";
        return `${context(ctx, d)}\n\nThe shape of the words: ${STYLE_GUIDE[style]}\n\nWhat the person describes: ${what || "(nothing - use the post's brief)"}`;
      },
      maxTokens: 1500,
      clean: (raw) => cleanWordsAnswer(raw),
    },
    ask: {
      label: "Change the text",
      schema: TEXT_SCHEMA as unknown as Record<string, unknown>,
      system: `${RULES}\n\n# EACH NETWORK'S MANNER\n${Object.values(MANNER).map((m) => `- ${m}`).join("\n")}\n- Change the network's text as the person asks; keep the rest of it.`,
      user: (ctx, doc, input) => {
        const d = normalizeSocial(doc);
        const n = netOf(input.network, "linkedin");
        return `${context(ctx, d)}\n\nThe ${NETWORK[n].label} text to change:\n\n${d.networks[n].text.trim() || "(empty - write it)"}${ask(input)}`;
      },
      maxTokens: 2000,
      clean: (raw) => cleanText(raw, "facebook"),
    },
  },
  actions: {
    /** The whole post as one text, ready to copy - nothing is sent anywhere. */
    export: async (ctx, doc) => ({ text: exportPack(doc, ctx.piece.title) }),
  },
};
