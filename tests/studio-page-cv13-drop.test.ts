import assert from "node:assert/strict";
import { test } from "node:test";
import { lineOf, moveTarget, moved, slotAt } from "../src/lib/content/studio/kinds/page/dropSlot";
import { emptyPage } from "../src/lib/content/studio/kinds/page/model";
import { moveRow, newPageRows } from "../src/lib/content/studio/kinds/page/blocklist";
import { newModule } from "../src/lib/content/studio/kinds/page/modules/model";

// Content v13 (SARCLA 11.11.2026 ~09:10: "sometimes drag and drop on modules don't put it up"): the place a dragged block
// lands is worked out from the pointer and the rows' boxes, for the whole list - the strip between two rows included.

// five rows of 40 px, one under the other, from y = 100 (a 2 px border between them - the strip a drop was lost on)
const rows = [0, 1, 2, 3, 4].map((i) => ({ top: 100 + i * 42, height: 40 }));

test("the gap under the pointer: above a row's middle is before it, below it after it - the strip between rows too", () => {
  assert.equal(slotAt(rows, 90), 0, "above the list: the first place");
  assert.equal(slotAt(rows, 105), 0, "the top half of the first row");
  assert.equal(slotAt(rows, 125), 1, "the bottom half of the first row");
  assert.equal(slotAt(rows, 141), 1, "the strip between row 1 and row 2 - it was no row, the drop was refused");
  assert.equal(slotAt(rows, 268), 4, "the top half of the last row");
  assert.equal(slotAt(rows, 300), 5, "below the list: the last place");
  assert.equal(slotAt(rows, 105, 1), 1, "the hero stays first: nothing but a module goes above it");
  assert.equal(slotAt([], 50), 0);
});

test("moving UP lands where the line is", () => {
  // the 4th row dropped on the line above the 2nd
  assert.equal(moveTarget(3, 1, 5), 1);
  assert.deepEqual(moved(["a", "b", "c", "d", "e"], 3, 1), ["a", "d", "b", "c", "e"]);
  assert.deepEqual(lineOf(1, 5), { row: 1, edge: "top" });
});

test("moving DOWN lands where the line is (the row taken out first)", () => {
  // the 2nd row dropped on the line under the 4th
  assert.equal(moveTarget(1, 4, 5), 3);
  assert.deepEqual(moved(["a", "b", "c", "d", "e"], 1, 3), ["a", "c", "d", "b", "e"]);
});

test("the first and the last place", () => {
  assert.equal(moveTarget(4, 0, 5), 0, "to the top");
  assert.deepEqual(moved(["a", "b", "c", "d", "e"], 4, 0), ["e", "a", "b", "c", "d"]);
  assert.equal(moveTarget(0, 5, 5), 4, "to the end");
  assert.deepEqual(moved(["a", "b", "c", "d", "e"], 0, 4), ["b", "c", "d", "e", "a"]);
  assert.deepEqual(lineOf(5, 5), { row: 4, edge: "bottom" }, "below the last row, its bottom edge");
});

test("a drop onto itself, or the gap just above or below it, changes nothing", () => {
  assert.equal(moveTarget(2, 2, 5), null);
  assert.equal(moveTarget(2, 3, 5), null);
  assert.equal(moveTarget(-1, 1, 5), null, "a row not in the list");
  assert.equal(moveTarget(2, 99, 5), 4, "a gap past the end is the last place");
});

test("a new page: a module moved up above a block, a block moved down - the page's order follows the drop", () => {
  const f0 = emptyPage("de-CH").fields;
  const f = {
    ...f0,
    hero: { ...f0.hero, title: "Dichtungen" },
    intro: "Ein Text.",
    benefitsTitle: "Vorteile", benefits: [{ id: "b1", title: "Eins", text: "" }],
    cta: { ...f0.cta, title: "Jetzt bestellen" },
    order: ["hero", "intro", "benefits", "cta"],
    modules: [{ id: "m1", after: "cta", module: newModule("row", "de-CH", "mrow1") }],
  } as typeof f0;
  const keys = (x: typeof f) => newPageRows(x).map((r) => r.key);
  assert.deepEqual(keys(f), ["hero", "intro", "benefits", "cta", "np:m1"]);
  // the module (row 5) dropped on the line above "intro" (gap 1)
  const up = moveTarget(4, 1, 5)!;
  assert.deepEqual(keys(moveRow(f, "np:m1", up)), ["hero", "np:m1", "intro", "benefits", "cta"]);
  // "intro" (row 2) dropped under the last row (gap 5)
  const down = moveTarget(1, 5, 5)!;
  assert.deepEqual(keys(moveRow(f, "intro", down)), ["hero", "benefits", "cta", "np:m1", "intro"]);
  // the module to the very first place - above the hero (a module may)
  assert.deepEqual(keys(moveRow(f, "np:m1", moveTarget(4, 0, 5)!)), ["np:m1", "hero", "intro", "benefits", "cta"]);
});
