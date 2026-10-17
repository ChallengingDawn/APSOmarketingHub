import assert from "node:assert/strict";
import { test } from "node:test";
import { describeStyle, readStyle, STYLE_KEYS, styleFor } from "../src/lib/editor/styleClipboard";
import type { DesignNode } from "../src/lib/design-document";

const text = (over: Partial<DesignNode> = {}): DesignNode => ({
  id: "a", kind: "text", x: 10, y: 20, fill: "#ed1b2f",
  text: "Cut to size", width: 400, fontSize: 48, fontKey: "outfit", fontStyle: "bold",
  letterSpacing: 2, shadow: true, ...over,
} as DesignNode);

test("a style is how it looks, not what it says or where it is", () => {
  const s = readStyle(text());
  assert.equal(s.fill, "#ed1b2f");
  assert.equal(s.fontSize, 48);
  assert.equal(s.fontKey, "outfit");
  // The four mistakes this exists to avoid.
  assert.equal("text" in s, false, "copying the words would be a duplicate");
  assert.equal("x" in s, false, "copying the position would move the target onto the source");
  assert.equal("y" in s, false);
  assert.equal("width" in s, false, "copying the box would resize a caption to a headline");
});

test("only properties that are actually set are picked up", () => {
  // Copying an absent property as undefined writes the key into the target
  // document, and the schema is strict about which keys it allows.
  const s = readStyle(text({ stroke: undefined, blur: undefined }));
  assert.equal("stroke" in s, false);
  assert.equal("blur" in s, false);
  assert.equal("shadow" in s, true);
});

test("the id, kind and the source of an image never travel", () => {
  const keys = STYLE_KEYS as readonly string[];
  for (const forbidden of ["id", "kind", "src", "rows", "series", "groupId", "locked", "hidden"]) {
    assert.equal(keys.includes(forbidden), false, forbidden + " must not be part of a style");
  }
});

test("font properties do not land on a rectangle", () => {
  // A fontSize on a rect does nothing, and a document carrying one on every
  // rect is a document whose next reader cannot tell what matters.
  const s = styleFor("rect", readStyle(text()));
  assert.equal("fontSize" in s, false);
  assert.equal("fontKey" in s, false);
  assert.equal("letterSpacing" in s, false);
  assert.equal(s.fill, "#ed1b2f", "the colour still comes across");
  assert.equal(s.shadow, true);
});

test("image adjustments do not land on text", () => {
  const picked = readStyle({ ...text(), kind: "image", mask: "circle", grayscale: true, blur: 8 } as DesignNode);
  const s = styleFor("text", picked);
  assert.equal("mask" in s, false);
  assert.equal("grayscale" in s, false);
  assert.equal("blur" in s, false);
});

test("a corner radius goes where corners exist", () => {
  const picked = { cornerRadius: 12 };
  for (const kind of ["rect", "image", "table", "chart"] as const) {
    assert.equal(styleFor(kind, picked).cornerRadius, 12, kind);
  }
  for (const kind of ["arrow", "ellipse", "text", "scrim"] as const) {
    assert.equal("cornerRadius" in styleFor(kind, picked), false, kind);
  }
});

test("a gradient is not pasted onto type", () => {
  // Konva fills text with a gradient quite happily and it is unreadable at
  // body size every time.
  const picked = { gradient: { from: "#ed1b2f", to: "#8f0f1c", angle: 90 } };
  assert.equal("gradient" in styleFor("text", picked), false);
  assert.equal("gradient" in styleFor("rect", picked), true);
});

test("a table takes both its ink and its surface colour", () => {
  const s = styleFor("table", { fill: "#1a1d21", backgroundFill: "#ffffff", stroke: "#e9ebef" });
  assert.equal(s.fill, "#1a1d21");
  assert.equal(s.stroke, "#e9ebef");
  assert.equal(s.backgroundFill, "#ffffff", "the surface colour is meaningful on a table");
});

test("the paste button can say what it will do", () => {
  assert.match(describeStyle(readStyle(text())), /outfit 48px/);
  assert.match(describeStyle({ shadow: true }), /shadow/);
  assert.equal(describeStyle({}), "that look");
});
