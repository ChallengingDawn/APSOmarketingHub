// BANNER - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026). Two AI tasks, in the brand's voice (the route puts
// brain.brandSystemPrompt for the "ad" channel before task.system):
//   copy       the words for every size the banner is made in, each within its room, in the banner's language
//   variants   three other headlines for the main size
// Nothing is written anywhere else: the paste block and the PNGs are made in the browser, and nothing goes to Magento.

import type { KindDef, StudioCtx } from "../../contract";
import { LANGUAGE_BY_CODE } from "@/lib/content/languages";
import { COPY_SCHEMA, VARIANTS_SCHEMA, cleanCopy, cleanVariants, sizesBrief } from "./ai";
import { PRESET, bannerText, emptyBanner, normalizeBanner, type BannerDoc } from "./model";

const RULES = [
  "# THIS TASK: WORDS FOR A BANNER OF THE APSOPARTS SHOP",
  "- Answer only in the JSON schema. The HEADLINE/BODY/CTA line format of the ad rules above does not apply here.",
  "- A banner is read in two seconds: a short eyebrow (a topic, not a sentence), one headline, one line of substance, one action.",
  "- Keep every text within its size's room (characters, spaces included). Shorter is better.",
  "- Changing words (only where a size allows them): the headline is the fixed start and each word completes it, e.g. headline \"Want to know more about\" + words [\"sealing technology?\", \"fluid handling?\"]. 3 to 6 words, each grammatical with the start, of similar length. Give none when the banner is better without them.",
  "- Never show a discount value - no percentage, no \"up to\", no amount off. Never name Chemours.",
  "- Nothing invented: no figures, prices, delivery promises, customer names or claims that are not in the brief or the banner's own words. What the shop really offers (standard components, the six technologies, DirectCUT, Quickorder) may be named.",
  "- No exclamation marks, no clichés (\"Discover\", \"Unlock\", \"Revolutionary\"), no emoji.",
].join("\n");

const langOf = (code: string) => LANGUAGE_BY_CODE[code.toUpperCase()]?.instruction ?? code;

function context(ctx: StudioCtx, d: BannerDoc): string {
  const b = ctx.brief;
  const c = d.content;
  return [
    `Project: ${ctx.projectTitle || "(no title)"}`,
    `This banner: ${ctx.piece.title}`,
    b.goal ? `Goal: ${b.goal}` : "", b.audience ? `Audience: ${b.audience}` : "", b.message ? `Key message: ${b.message}` : "",
    b.keywords.length ? `Keywords: ${b.keywords.join(", ")}` : "",
    `Language: write in ${langOf(d.language)}.`,
    "",
    "The sizes this banner is made in, and their room:",
    sizesBrief(d),
    "",
    "Its words now:",
    `- eyebrow: ${c.eyebrow || "(empty)"}`,
    `- headline: ${c.headline || "(empty)"}`,
    `- changing words: ${c.rotatingWords.length ? c.rotatingWords.join(" / ") : "(none)"}`,
    `- line: ${c.line || "(empty)"}`,
    `- button: ${c.button.label || "(empty)"}${c.button.url ? ` (goes to ${c.button.url})` : ""}`,
    d.content.image.label ? `- the photo shows: ${d.content.image.label}` : "",
    d.notes.trim() ? `\nNotes on this banner: ${d.notes.trim().slice(0, 1500)}` : "",
  ].filter((x) => x !== "").join("\n");
}

const ask = (input: Record<string, unknown>) => (typeof input.ask === "string" && input.ask.trim() ? `\n\nWhat the person asks: ${input.ask.trim().slice(0, 1200)}` : "");

export const bannerKind: KindDef = {
  kind: "banner",
  channel: "ad",
  empty: (ctx) => emptyBanner(ctx.piece.language),
  toText: bannerText,
  tasks: {
    copy: {
      label: "Write the words",
      schema: COPY_SCHEMA as unknown as Record<string, unknown>,
      system: `${RULES}\n- "sizes": shorter words for a size only where the main words do not fit its room; leave a field empty to keep the main words. List only the sizes in the question.`,
      user: (ctx, doc, input) => `${context(ctx, normalizeBanner(doc))}\n\nWrite the banner's words for its main size (${PRESET[normalizeBanner(doc).format].label}), then shorter ones for the other sizes where needed.${ask(input)}`,
      maxTokens: 2500,
      clean: (raw, doc) => cleanCopy(raw, normalizeBanner(doc)),
    },
    variants: {
      label: "Three other headlines",
      schema: VARIANTS_SCHEMA as unknown as Record<string, unknown>,
      system: `${RULES}\n- Three headlines from three different angles (the situation, the benefit, the ease). With changing words, each headline is a fixed start the current words still complete.`,
      user: (ctx, doc, input) => {
        const d = normalizeBanner(doc);
        return `${context(ctx, d)}\n\nGive three other headlines for the main size (${PRESET[d.format].label}, ${PRESET[d.format].limits.headline} characters at most).${ask(input)}`;
      },
      maxTokens: 1200,
      clean: (raw, doc) => cleanVariants(raw, normalizeBanner(doc)),
    },
  },
};
