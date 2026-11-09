// BANNER - A PART'S WORDS, READ AND WRITTEN THE SAME WAY EVERYWHERE (09.11.2026; the flow standard: the words are typed
// right on the banner, and the left card follows). Pure: tests/studio-flow-banvid.test.ts.
// A place shows its own words where it has them ("Only the home band"), else the banner's - so the words typed on the
// banner go where the words shown came from, exactly as the left card writes them.

import type { BannerDoc, OwnWords, PresetKey } from "./model";

/** The parts whose words can be typed on the banner. */
export const WORD_PARTS = ["eyebrow", "headline", "line", "button", "label"] as const;
export type WordPartKey = (typeof WORD_PARTS)[number];
export const isWordPart = (p: unknown): p is WordPartKey => typeof p === "string" && (WORD_PARTS as readonly string[]).includes(p);

const EMPTY_OWN: OwnWords = { eyebrow: "", headline: "", line: "", button: "" };

/** The words a part shows in a place. */
export function readPart(d: BannerDoc, k: PresetKey, part: WordPartKey): string {
  if (part === "label") return d.content.photos.length >= 2 ? d.content.photos[0].label : d.content.image.label;
  const own = d.own[k]?.[part] ?? "";
  if (own.trim()) return own;
  return part === "button" ? d.content.button.label : d.content[part];
}

/** Where a part's words come from in a place: its own words, or the banner's. Fixed when an edit starts. */
export type Target = "own" | "banner";
export const targetOf = (d: BannerDoc, k: PresetKey, part: WordPartKey): Target => (part !== "label" && (d.own[k]?.[part] ?? "").trim() ? "own" : "banner");

/** The words of a part written where they came from (`target`, else as the place shows them now). */
export function writePart(d: BannerDoc, k: PresetKey, part: WordPartKey, text: string, target: Target = targetOf(d, k, part)): BannerDoc {
  const v = part === "line" ? text : text.replace(/\s*\n\s*/g, " ");
  if (part === "label") {
    const label = v.slice(0, 80);
    return d.content.photos.length >= 2
      ? { ...d, content: { ...d.content, photos: d.content.photos.map((x, i) => (i === 0 ? { ...x, label } : x)) } }
      : { ...d, content: { ...d.content, image: { ...d.content.image, label } } };
  }
  if (target === "own") return { ...d, own: { ...d.own, [k]: { ...(d.own[k] ?? EMPTY_OWN), [part]: v } } };
  return part === "button"
    ? { ...d, content: { ...d.content, button: { ...d.content.button, label: v } } }
    : { ...d, content: { ...d.content, [part]: v } };
}
