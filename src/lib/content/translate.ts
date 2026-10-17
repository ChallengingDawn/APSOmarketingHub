// TRANSLATE A VERSION (list E10).
//
// "A second language meant starting over" is in the header of projects.ts as
// one of the reasons a project exists, and until now it was still true: you
// generated the Italian landing page from the brief again and got a different
// argument in a different order, which is not a translation of anything.
//
// A translation is a NEW VERSION, never an overwrite. The point of a project
// is that the German and the Italian sit side by side and somebody can see
// that paragraph four went missing.
//
// What must survive the crossing, and why each one bites:
//   - the markdown skeleton: the versions are compared heading by heading, so
//     a translation that merges two sections is unreadable beside its source
//   - article and product numbers: 8001228582 is not a number to localise,
//     and a digit changed in translation is an order for the wrong part
//   - the brand and product names: APSOparts, DirectCut, APSOvib, C2S are
//     names. "TagliaDiretto" is not a product anybody can buy
//   - the units: mm stays mm, and a decimal comma is not a thousands comma

import type Anthropic from "@anthropic-ai/sdk";
import { channelBudget, claudeText, type ClaudeFailure } from "@/lib/ai/claude";
import { LANGUAGE_BY_CODE, languageLabel } from "./languages";

/** Names that are the same word in every language A+P sells in. */
export const KEEP_VERBATIM = [
  "Angst+Pfister",
  "APSOparts",
  "APSOvib",
  "APSOseal",
  "APSOdrive",
  "DirectCut",
  "DirectUP",
  "C2S",
  "Performis",
];

export function translateSystem(targetCode: string): string {
  const target = LANGUAGE_BY_CODE[targetCode.toUpperCase()];
  const instruction = target?.instruction ?? languageLabel(targetCode);
  return [
    `You translate Angst+Pfister marketing copy into ${instruction}.`,
    "",
    "You are translating, not rewriting. The argument, its order and its length stay as they are; only the language changes. Do not improve the text, do not add a sentence that explains something the original left implicit, and do not drop a sentence you think is redundant.",
    "",
    "Keep exactly as they are:",
    "- the markdown structure: the same headings, in the same order, at the same level, and the same number of list items and paragraphs",
    `- these names, spelled this way: ${KEEP_VERBATIM.join(", ")}`,
    "- every article, product and order number, digit for digit",
    "- every URL, email address and file name",
    "- units and their numbers (mm stays mm; 2.5 mm does not become 2,5 mm unless that is how the target language writes a decimal, and then only the separator changes)",
    "",
    "Translate the title as a title, not as a sentence: it has to work as a heading in the target language, which sometimes means a different word order rather than a word-for-word result.",
    "",
    "If a sentence contains a pun or an idiom that has no equivalent, write the plainest sentence that keeps the meaning. A translation that reads as a translation is a worse outcome than losing the joke.",
  ].join("\n");
}

export type Translated = { title: string | null; body: string };

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "The translated title. Empty string if the source had none." },
    body: { type: "string", description: "The translated body, with the markdown structure of the source." },
  },
  required: ["title", "body"],
  additionalProperties: false,
} as const;

/**
 * One version, in another language.
 *
 * The channel budget is the source's, not a translation-specific one: the
 * output is the same length as the input, so a LinkedIn post needs a post's
 * room and a landing page needs a page's.
 */
export async function translateVariant(params: {
  client: Anthropic;
  channel: string;
  targetCode: string;
  sourceLanguage: string | null;
  title: string | null;
  body: string;
}): Promise<{ ok: true; result: Translated } | { ok: false; failure: ClaudeFailure }> {
  const { client, channel, targetCode, sourceLanguage, title, body } = params;
  const from = sourceLanguage ? languageLabel(sourceLanguage) : "the source language";

  const out = await claudeText({
    client,
    system: [{ type: "text", text: translateSystem(targetCode) }],
    user: [
      `Translate this from ${from} into ${languageLabel(targetCode)}.`,
      "",
      `TITLE: ${title ?? "(none)"}`,
      "",
      "BODY:",
      body,
    ].join("\n"),
    budget: channelBudget(channel),
    outputFormat: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> },
  });

  if (!out.ok) return { ok: false, failure: out.failure };

  // A schema-constrained answer is still a string until it parses. A
  // half-written JSON object from a truncated stream must not be saved as a
  // version, because a version is what somebody publishes from.
  try {
    const parsed = JSON.parse(out.text) as { title?: unknown; body?: unknown };
    const outBody = typeof parsed.body === "string" ? parsed.body.trim() : "";
    if (!outBody) {
      return { ok: false, failure: { status: 502, error: "The translation came back empty." } };
    }
    const outTitle = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : null;
    return { ok: true, result: { title: outTitle, body: outBody } };
  } catch {
    return { ok: false, failure: { status: 502, error: "The translation did not come back as readable JSON." } };
  }
}
