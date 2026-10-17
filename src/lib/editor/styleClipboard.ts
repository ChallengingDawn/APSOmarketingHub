// COPY A LOOK FROM ONE OBJECT TO ANOTHER (canvas list 27).
//
// Somebody gets one heading right - the font, the weight, the tracking, the
// colour, the outline over a photograph - and then has to reproduce it four
// more times from memory, reading numbers off one panel and typing them into
// another. They get it nearly right, and "nearly" is what makes a layout look
// homemade.
//
// What a STYLE is, and what it is not: a style is how a thing looks. It is
// not what it says, where it is, how big its box is, or which group it is in.
// Copying the text itself would be a duplicate; copying the position would
// move the target on top of the source; copying the size would resize a
// caption to a headline's box. Those are the four mistakes this exists to
// avoid, so the list below is deliberately short and deliberately explicit.

import type { DesignNode } from "../design-document";

/** The properties that are "how it looks". */
export const STYLE_KEYS = [
  "fill",
  "fontKey",
  "fontSize",
  "fontStyle",
  "align",
  "lineHeight",
  "letterSpacing",
  "underline",
  "upper",
  "curve",
  "listStyle",
  "background",
  "backgroundFill",
  "stroke",
  "strokeWidth",
  "cornerRadius",
  "shadow",
  "opacity",
  "blend",
  "gradient",
  "mask",
  "grayscale",
  "brightness",
  "contrastVal",
  "blur",
] as const satisfies readonly (keyof DesignNode)[];

export type Style = Partial<Pick<DesignNode, (typeof STYLE_KEYS)[number]>>;

/** What the eyedropper picks up. */
export function readStyle(node: DesignNode): Style {
  const out: Style = {};
  for (const key of STYLE_KEYS) {
    const v = node[key];
    // Only what is actually set: copying an absent property as undefined
    // would write the key into the target document, and the schema is strict
    // about which keys it allows.
    if (v !== undefined) Object.assign(out, { [key]: v });
  }
  return out;
}

/**
 * Which parts of a style make sense on the target.
 *
 * A font size on a rectangle does nothing; a corner radius on an arrow does
 * nothing; a list style on an image does nothing. Dropping them is not
 * tidiness - a document carrying a fontSize on every rectangle is a document
 * whose next reader cannot tell which properties mean anything.
 */
export function styleFor(kind: DesignNode["kind"], style: Style): Style {
  const textOnly = new Set([
    "fontKey", "fontSize", "fontStyle", "align", "lineHeight", "letterSpacing",
    "underline", "upper", "curve", "listStyle", "background",
  ]);
  const imageOnly = new Set(["mask", "grayscale", "brightness", "contrastVal", "blur"]);
  const radiusKinds = new Set(["rect", "image", "table", "chart"]);
  // The fill BEHIND the content: a pill for text, the surface for a table or
  // a chart. The same thing in each, so it travels to all three.
  const surfaceKinds = new Set(["text", "table", "chart"]);

  const out: Style = {};
  for (const [key, value] of Object.entries(style)) {
    if (textOnly.has(key) && kind !== "text") continue;
    if (imageOnly.has(key) && kind !== "image") continue;
    if (key === "cornerRadius" && !radiusKinds.has(kind)) continue;
    if (key === "backgroundFill" && !surfaceKinds.has(kind)) continue;
    if (key === "gradient" && kind === "text") continue;
    Object.assign(out, { [key]: value });
  }
  return out;
}

/** A short description, for the button that pastes it. */
export function describeStyle(style: Style): string {
  const bits: string[] = [];
  if (style.fontKey || style.fontSize) {
    bits.push([style.fontKey, style.fontSize ? `${style.fontSize}px` : null].filter(Boolean).join(" "));
  }
  if (style.fill) bits.push(style.fill);
  if (style.stroke && style.strokeWidth) bits.push("outlined");
  if (style.shadow) bits.push("shadow");
  if (style.gradient) bits.push("gradient");
  return bits.length ? bits.join(" · ") : "that look";
}
