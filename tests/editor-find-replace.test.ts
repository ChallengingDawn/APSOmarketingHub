import assert from "node:assert/strict";
import { test } from "node:test";
import { applyReplace, literalPattern } from "../src/lib/editor/findReplace";

type Block = { kind: string; text?: string; locked?: boolean };
const text = (t: string, locked = false): Block => ({ kind: "text", text: t, locked });
const shape = (): Block => ({ kind: "rect" });

test("replaces across every text block", () => {
  const { blocks, changed } = applyReplace(
    [text("FFKM seals"), text("why FFKM"), shape()],
    "FFKM",
    "FKM",
  );
  assert.equal(changed, 2);
  assert.equal(blocks[0].text, "FKM seals");
  assert.equal(blocks[1].text, "why FKM");
});

test("finds any casing, writes exactly what was typed", () => {
  const { blocks } = applyReplace([text("ffkm and FFKM and Ffkm")], "FFKM", "Viton");
  assert.equal(blocks[0].text, "Viton and Viton and Viton");
});

test("a product code is literal, not a pattern", () => {
  // This is the case that three hand-written escapes got wrong. With a broken
  // class the dot matches any character and "8001.228" would also rewrite
  // "8001X228" — silently, in somebody's price list.
  const { blocks, changed } = applyReplace(
    [text("part 8001.228"), text("part 8001X228")],
    "8001.228",
    "8001.229",
  );
  assert.equal(changed, 1, "only the real one");
  assert.equal(blocks[0].text, "part 8001.229");
  assert.equal(blocks[1].text, "part 8001X228", "untouched");
});

test("brackets and backslashes do not blow up the search", () => {
  for (const needle of ["a[b]", "c\\d", "(e)", "f+g", "h|i", "$j", "^k", "m{2}"]) {
    assert.doesNotThrow(() => literalPattern(needle), needle);
  }
  const { blocks } = applyReplace([text("size a[b] here")], "a[b]", "a-b");
  assert.equal(blocks[0].text, "size a-b here");
});

test("a locked block is left alone", () => {
  const { blocks, changed } = applyReplace([text("FFKM", true), text("FFKM")], "FFKM", "FKM");
  assert.equal(changed, 1);
  assert.equal(blocks[0].text, "FFKM", "locked means not this one");
  assert.equal(blocks[1].text, "FKM");
});

test("an empty search changes nothing", () => {
  const before = [text("anything")];
  const { blocks, changed } = applyReplace(before, "   ", "x");
  assert.equal(changed, 0);
  assert.equal(blocks, before, "the same array, not a copy");
});

test("replacing with nothing deletes the phrase", () => {
  const { blocks } = applyReplace([text("APSOparts GmbH")], " GmbH", "");
  assert.equal(blocks[0].text, "APSOparts");
});
