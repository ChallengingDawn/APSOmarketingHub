import assert from "node:assert/strict";
import { test } from "node:test";
import { barAiTarget } from "../src/lib/content/studio/kinds/page/barAi";

// Content v14c (SARCLA 11.11.2026 ~17:15): "if I click Ask AI on the element it still sends me to block". The bar's Ask AI
// asks about what is selected: an element's own AI box - the block only when the whole block is selected.

test("an element selected: Ask AI is the element's own - a page's own field, a module's text, a button, a card, a date, a picture", () => {
  for (const popKind of ["text", "part", "picture"]) {
    assert.equal(barAiTarget({ selected: true, wholeRow: false, popKind, inRow: true }), "element", popKind);
    assert.equal(barAiTarget({ selected: true, wholeRow: false, popKind, inRow: false }), "element", `${popKind}, no block known`);
  }
});

test("the whole block selected: the block's Ask AI; nothing of a block: the assistant", () => {
  assert.equal(barAiTarget({ selected: true, wholeRow: true, popKind: "text", inRow: true }), "block");
  assert.equal(barAiTarget({ selected: true, wholeRow: false, popKind: "settings", inRow: true }), "block", "a module's settings are the block's");
  assert.equal(barAiTarget({ selected: true, wholeRow: false, popKind: null, inRow: true }), "block", "a block's own ground");
  assert.equal(barAiTarget({ selected: true, wholeRow: false, popKind: null, inRow: false }), "assistant");
  assert.equal(barAiTarget({ selected: false, wholeRow: false, popKind: null, inRow: false }), "assistant");
});
