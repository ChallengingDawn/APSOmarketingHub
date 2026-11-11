// SOCIAL POST - THE SHOP'S WORD RULES ON EVERY TEXT THE AI WRITES (cv16, SARCLA 11.11.2026: "compare the evolution of this
// page to the other content types and improve them"). Pure: relative imports only - the social server (./server.ts) and
// tests/studio-social-cv16.test.ts.
//
// The Page builder's rule (page/plan/newpage.ts guardText, Content v12): a sentence the AI wrote with a price, a discount,
// a stock or delivery-time promise, "Chemours", a certificate nobody named, or a placeholder is TAKEN OUT - not only
// flagged under "Before it goes out" - and said. The social post had the warnings only (model.ts checks); its captions,
// first comment, the words on its pages, a carousel and a translation now go through the same rule before they land.
// "Named" = the brief, the to-do, the post's own words or the person's ask: a certificate the person asked for stays.

import { guardText } from "../page/plan/newpage";
import type { AiOp, AiSlide, DesignAnswer } from "./canvasAi";
import type { Words } from "./templates";

/** One text under the word rules; what was taken out goes into `said`. Hashtags at a text's end are kept as they are. */
export function guardPost(text: string, known: string, said: string[]): string {
  if (!text.trim()) return text;
  return guardText(text, known, said, "");
}

/** A design's words (a template's or a slide's) under the rules - a word left empty is dropped (the template's own stays out). */
export function guardWords(w: Words, known: string, said: string[]): Words {
  const out: Words = {};
  for (const k of ["eyebrow", "headline", "body", "cta", "number", "who"] as const) {
    const v = w[k];
    if (!v) continue;
    const g = guardPost(v, known, said);
    if (g.trim()) out[k] = g;
  }
  if (w.items?.length) {
    const items = w.items.map((x) => guardPost(x, known, said)).filter((x) => x.trim());
    if (items.length) out.items = items;
  }
  return out;
}

/** The canvas AI's answer under the rules: its words, its templates' and pages' words. A text change left with no words
 * is dropped (never an empty headline on the post). */
export function guardDesign(a: DesignAnswer, known: string): DesignAnswer & { leftOut: string[] } {
  const said: string[] = [];
  const ops: AiOp[] = [];
  for (const op of a.ops) {
    const text = op.text ? guardPost(op.text, known, said) : op.text;
    if ((op.do === "set_text" || op.do === "add_text") && op.text && !text.trim()) continue;
    const slides: AiSlide[] = op.slides.map((s) => ({ ...s, words: guardWords(s.words, known, said) }));
    ops.push({ ...op, text, words: guardWords(op.words, known, said), slides });
  }
  return { ...a, ops, leftOut: [...new Set(said)].slice(0, 8) };
}
