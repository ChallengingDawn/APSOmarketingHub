// A NEW POST STARTS CLEAN (night of 09.11.2026, the lead's review: "A brand-new post should not start on the spotlight
// template's DirectCUT words: start from a clean layout with placeholders that say what goes there, greyed, like the page
// studio's empty parts, so 'Write the whole post with AI' or typing fills them").
//
// The placeholders are words that say what goes there, drawn in two greys: one where the headline goes (it becomes the
// template's ink once it holds real words), one where the small line and the sentence go (they become its muted grey).
// The button keeps its white on red. The picture is an empty frame. Pure: tests/studio-social-canvas.test.ts.

import type { DesignNode } from "../../../../design-document";
import { plainText } from "../../../../editor/richText";
import { C } from "./design";
import type { Words } from "./templates";

/** The greys of words not written yet - each stands for the colour the words take once written. */
export const PH_INK = "#A9B1BA";
export const PH_MUTE = "#BCC3CB";

export const PLACEHOLDER_WORDS: Words = {
  eyebrow: "The topic",
  headline: "Your headline: what the post says, in a few words",
  body: "One or two sentences that back it up - what the reader gets out of it.",
  cta: "The button",
};
const PLACEHOLDERS = new Set(Object.values(PLACEHOLDER_WORDS).map((t) => plainText(String(t)).trim()));

/** Words that are still a placeholder (or no words at all). */
export const isPlaceholder = (text: string | undefined | null) => { const t = plainText(text).trim(); return !t || PLACEHOLDERS.has(t); };

/** A start page's texts in their placeholder greys (the button's words stay white). */
export function greyPlaceholders(nodes: DesignNode[]): DesignNode[] {
  return nodes.map((n) => {
    if (n.kind !== "text" || !isPlaceholder(n.text) || plainText(n.text).trim() === PLACEHOLDER_WORDS.cta) return n;
    const fill = (n.fill ?? "").toUpperCase() === C.ink.toUpperCase() ? PH_INK : PH_MUTE;
    return { ...n, fill };
  });
}

/** Texts that now hold real words take their real colour; null when nothing changes. */
export function realColours(nodes: DesignNode[]): DesignNode[] | null {
  let changed = false;
  const out = nodes.map((n) => {
    if (n.kind !== "text" || isPlaceholder(n.text)) return n;
    const f = (n.fill ?? "").toUpperCase();
    if (f !== PH_INK && f !== PH_MUTE) return n;
    changed = true;
    return { ...n, fill: f === PH_INK ? C.ink : C.mute };
  });
  return changed ? out : null;
}

/** The post has words of its own on any page (the start card leaves then). */
export function hasOwnWords(pages: DesignNode[][]): boolean {
  return pages.some((nodes) => nodes.some((n) => n.kind === "text" && !n.hidden && !isPlaceholder(n.text)));
}
