import assert from "node:assert/strict";
import { test } from "node:test";
import { isFullBleed, reflow, scaleFor, sizeLabel, type Reflowable } from "../src/lib/editor/resize";

const LI = { w: 1200, h: 627 };
const SQ = { w: 1080, h: 1080 };
const STORY = { w: 1080, h: 1920 };

const node = (over: Partial<Reflowable> = {}): Reflowable => ({
  kind: "text", x: 100, y: 100, width: 400, height: 80, fontSize: 40, ...over,
});

const near = (a: number, b: number, msg?: string) =>
  assert.ok(Math.abs(a - b) < 0.5, msg ?? `${a} is not ${b}`);

test("the same size is not a change", () => {
  const nodes = [node()];
  assert.equal(reflow(nodes, LI, { ...LI }), nodes, "same array, so no undo step");
});

test("an empty design resizes without throwing", () => {
  assert.deepEqual(reflow([], LI, SQ), []);
});

test("a board with no size does not divide by zero", () => {
  const nodes = [node()];
  assert.equal(reflow(nodes, { w: 0, h: 0 }, SQ), nodes);
  assert.equal(reflow(nodes, LI, { w: 0, h: 100 }), nodes);
  assert.equal(scaleFor({ w: 0, h: 0 }, SQ), 1);
});

test("one factor for sizes, so type never distorts", () => {
  // 1200x627 to 1080x1080: the width ratio is 0.9, the height ratio is 1.72.
  // The smaller one wins, or a headline comes out 90% as tall and 170% as
  // wide as it should be.
  assert.equal(scaleFor(LI, SQ), 0.9);
  const [out] = reflow([node({ fontSize: 40, width: 400, height: 80 })], LI, SQ);
  assert.equal(out.fontSize, 36, "40 * 0.9");
  near(out.width ?? 0, 360);
  near(out.height ?? 0, 72);
});

test("doubling the board doubles the type", () => {
  const [out] = reflow([node({ fontSize: 30 })], { w: 600, h: 400 }, { w: 1200, h: 800 });
  assert.equal(out.fontSize, 60);
});

test("the gap between two objects survives the resize", () => {
  // The whole point of one uniform factor: a kicker sitting 24px above a
  // headline still sits proportionally 24px above it.
  const before = [node({ y: 100, height: 40 }), node({ y: 164, height: 40 })];
  const after = reflow(before, LI, SQ);
  const gapBefore = before[1].y - (before[0].y + (before[0].height ?? 0));
  const gapAfter = after[1].y - (after[0].y + (after[0].height ?? 0));
  near(gapAfter, gapBefore * 0.9);
});

test("a full-bleed scrim still covers the whole board", () => {
  // Every seeded layout has one. Scaled like an ordinary object it shrinks
  // and leaves a bare band down one side, which looks like a rendering fault.
  const scrim = node({ kind: "scrim", x: 0, y: 0, width: LI.w, height: LI.h, fontSize: undefined });
  const [out] = reflow([scrim], LI, STORY);
  assert.deepEqual([out.x, out.y, out.width, out.height], [0, 0, STORY.w, STORY.h]);
});

test("a nearly-full-bleed layer counts as full bleed", () => {
  const almost = node({ kind: "rect", x: 4, y: 4, width: 1190, height: 620, fontSize: undefined });
  assert.equal(isFullBleed(almost, LI), true);
  // ...but an object that merely spans the width does not.
  const band = node({ kind: "rect", x: 0, y: 300, width: 1200, height: 60, fontSize: undefined });
  assert.equal(isFullBleed(band, LI), false);
  // Nor does a node with no size at all.
  assert.equal(isFullBleed(node({ width: undefined, height: undefined }), LI), false);
});

test("the composition is centred on the new board", () => {
  const nodes = [
    node({ x: 80, y: 80, width: 400, height: 60 }),
    node({ x: 80, y: 160, width: 400, height: 60 }),
  ];
  const out = reflow(nodes, LI, STORY);
  const top = Math.min(...out.map((n) => n.y));
  const bottom = Math.max(...out.map((n) => n.y + (n.height ?? 0)));
  near((top + bottom) / 2, STORY.h / 2, "vertically centred");
  const left = Math.min(...out.map((n) => n.x));
  const right = Math.max(...out.map((n) => n.x + (n.width ?? 0)));
  near((left + right) / 2, STORY.w / 2, "horizontally centred");
});

test("a scrim does not drag the centring", () => {
  // If the scrim counted towards the bounds, the bounds would be the whole
  // board every time and the centring would do nothing.
  const scrim = node({ kind: "scrim", x: 0, y: 0, width: LI.w, height: LI.h, fontSize: undefined });
  const text = node({ x: 80, y: 500, width: 300, height: 50 });
  const out = reflow([scrim, text], LI, STORY);
  const t = out[1];
  near(t.y + (t.height ?? 0) / 2, STORY.h / 2, "the text is centred, not left near the bottom");
});

test("nothing ends up off the board", () => {
  const nodes = [
    node({ x: -500, y: -500, width: 200, height: 200 }),
    node({ x: 3000, y: 3000, width: 200, height: 200 }),
  ];
  for (const n of reflow(nodes, LI, SQ)) {
    assert.ok(n.x + (n.width ?? 0) > 0, "something of it is on the board horizontally");
    assert.ok(n.y + (n.height ?? 0) > 0, "and vertically");
    assert.ok(n.x < SQ.w, "and it has not run off the right");
    assert.ok(n.y < SQ.h, "or the bottom");
  }
});

test("type never scales below readable", () => {
  const [out] = reflow([node({ fontSize: 9 })], { w: 2000, h: 2000 }, { w: 100, h: 100 });
  assert.ok((out.fontSize ?? 0) >= 8, "8px is the floor");
});

test("font sizes come back as whole numbers", () => {
  // A style panel showing 23.4 is a panel that looks broken.
  const [out] = reflow([node({ fontSize: 26 })], LI, SQ);
  assert.equal(Number.isInteger(out.fontSize), true);
});

test("the other scaled properties come along", () => {
  const [out] = reflow(
    [node({ strokeWidth: 4, letterSpacing: 3, cornerRadius: 10, blur: 20 })],
    { w: 600, h: 600 },
    { w: 1200, h: 1200 },
  );
  near(out.strokeWidth ?? 0, 8);
  near(out.letterSpacing ?? 0, 6);
  near(out.cornerRadius ?? 0, 20);
  near(out.blur ?? 0, 40);
});

test("a property that was never set stays unset", () => {
  // Writing width: undefined into the node would put the key in the document
  // and the schema is strict about what it allows.
  const bare: Reflowable = { kind: "rect", x: 10, y: 10 };
  const [out] = reflow([bare], LI, SQ);
  assert.equal("width" in out, false);
  assert.equal("fontSize" in out, false);
});

test("the size reads the way a designer writes it", () => {
  assert.equal(sizeLabel(LI), "1200 × 627");
  assert.equal(sizeLabel({ w: 1080.4, h: 1079.5 }), "1080 × 1080");
});
