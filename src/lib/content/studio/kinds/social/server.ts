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
  const slides = slidesOf(d);
  if (slides.length) lines.push(`\nIts ${d.media.kind === "card" ? "card" : "slides"} now:\n${slides.map((s, i) => `${i + 1}. ${[s.eyebrow, s.headline, s.text].filter((x) => x.trim()).join(" | ")}`).join("\n")}`);
  if (d.hashtags.length) lines.push(`\nIts hashtags now: ${d.hashtags.join(" ")}`);
  if (d.notes.trim()) lines.push(`\nNotes on this post: ${d.notes.trim().slice(0, 1500)}`);
  return lines.filter((x) => x !== "").join("\n");
}

const ask = (input: Record<string, unknown>) => (typeof input.ask === "string" && input.ask.trim() ? `\n\nWhat the person asks: ${input.ask.trim().slice(0, 1200)}` : "");
const netOf = (v: unknown, fallback: Network): Network => (isNetwork(v) ? v : fallback);

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
