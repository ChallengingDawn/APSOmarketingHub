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

/* ── cv16: a part's popup on the banner (11.11.2026, the Page builder's element popups) ── */

/** A part taken out ("Take it out"): its words gone everywhere - the banner's and every place's own; the picture's label. */
export function clearPart(d: BannerDoc, part: WordPartKey): BannerDoc {
  if (part === "label") return writePart(d, sizesOfDoc(d)[0], "label", "");
  const own: BannerDoc["own"] = {};
  for (const [k, o] of Object.entries(d.own) as [PresetKey, OwnWords][]) {
    const next = { ...o, [part]: "" };
    if (next.eyebrow || next.headline || next.line || next.button) own[k] = next;
  }
  const content = part === "button" ? { ...d.content, button: { ...d.content.button, label: "" } }
    : part === "headline" ? { ...d.content, headline: "", rotatingWords: [] } : { ...d.content, [part]: "" };
  return { ...d, content, own };
}

/** One part's words as they were in `before` (the Undo of exactly what the AI did to it), everything else as it is now. */
export function restorePart(d: BannerDoc, before: BannerDoc, part: WordPartKey): BannerDoc {
  if (part === "label") return writePart(d, sizesOfDoc(d)[0], "label", readPart(before, sizesOfDoc(before)[0], "label"));
  const content = part === "button" ? { ...d.content, button: { ...d.content.button, label: before.content.button.label } }
    : part === "headline" ? { ...d.content, headline: before.content.headline, rotatingWords: before.content.rotatingWords } : { ...d.content, [part]: before.content[part] };
  const own: BannerDoc["own"] = {};
  const keys = new Set([...Object.keys(d.own), ...Object.keys(before.own)] as PresetKey[]);
  for (const k of keys) {
    const next = { ...(d.own[k] ?? EMPTY_OWN), [part]: before.own[k]?.[part] ?? "" };
    if (next.eyebrow || next.headline || next.line || next.button) own[k] = next;
  }
  return { ...d, content, own };
}

/** "Start again" (the Page builder's): every word out - its design, places, picture and the button's page kept. */
export function clearWords(d: BannerDoc): BannerDoc {
  return { ...d, content: { ...d.content, eyebrow: "", headline: "", rotatingWords: [], line: "", button: { ...d.content.button, label: "" } }, own: {}, accent: "" };
}

const sizesOfDoc = (d: BannerDoc): PresetKey[] => [d.format, ...d.sizes.filter((k) => k !== d.format)];
