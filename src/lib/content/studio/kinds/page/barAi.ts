// PAGE - WHAT "ASK AI" IN THE BAR OVER THE SELECTION ASKS ABOUT (Content v14c). Pure: no imports.
//
// SARCLA 11.11.2026 ~17:15 (the page's own hero, "Line under the title" selected, its popup open): "if I click Ask AI on
// the element it still sends me to block". The dark bar's "Ask AI" acts on what is SELECTED: an element (a module's text,
// a button, a card, a date, a page's own field, a picture) opens its own popup - if it is not open yet - and the cursor
// goes into that popup's own "Ask AI for this text…" box. Only when the WHOLE block is selected does it ask about the
// block (its "Ask AI about this block" popup); with no block at all, the assistant on the right.

export type BarAiTarget = "element" | "block" | "assistant";

export function barAiTarget(o: {
  /** something is selected in the page */
  selected: boolean;
  /** the whole block is selected, not an element in it */
  wholeRow: boolean;
  /** the popup of what is selected ("text", "part", "picture", "settings"...) - null when it has none */
  popKind: string | null;
  /** the block the selection is in is known */
  inRow: boolean;
}): BarAiTarget {
  if (o.selected && !o.wholeRow && o.popKind && o.popKind !== "settings" && o.popKind !== "ask" && o.popKind !== "switch") return "element";
  return o.inRow ? "block" : "assistant";
}

/** The element popup's own AI box is marked so (its input): the bar's "Ask AI" puts the cursor there. */
export const AI_BOX_ATTR = "data-ai-box";
