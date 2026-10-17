import assert from "node:assert/strict";
import { test } from "node:test";
import { arcHeight, arcPath, CURVE_MAX, CURVE_MIN } from "../src/lib/editor/curvedText";

test("no curve is a straight line, not a circle of enormous radius", () => {
  const a = arcPath(400, 0);
  assert.equal(a.d, "M 0 0 L 400 0");
  assert.equal(a.midY, 0);
  assert.equal(a.r, Infinity);
  // A bow under 1% is also straight: it is a line that costs an eight
  // thousand pixel radius to express.
  assert.equal(arcPath(400, 0.4).d, "M 0 0 L 400 0");
  assert.equal(arcPath(400, -0.9).r, Infinity);
});

test("a positive curve arches UP, which on a canvas is a negative y", () => {
  const a = arcPath(400, 50);
  assert.ok(a.midY < 0, "the middle of an arch sits above its ends");
  assert.match(a.d, /^M 0 0 A /);
  // Sweep 1: from the left end, clockwise, over the top.
  assert.match(a.d, / 0 1 400 0$/);
});

test("a negative curve hangs DOWN and travels the other way round", () => {
  const a = arcPath(400, -50);
  assert.ok(a.midY > 0);
  assert.match(a.d, / 0 0 400 0$/);
  // Mirror images: same bow, opposite sign.
  assert.equal(a.midY, -arcPath(400, 50).midY);
});

test("100 is the half circle: the bow is half the width and r is half the width", () => {
  const a = arcPath(400, 100);
  assert.equal(a.midY, -200);
  assert.equal(a.r, 200, "a half circle's radius is its own sagitta");
});

test("a gentler curve is a bigger circle", () => {
  const gentle = arcPath(400, 10);
  const strong = arcPath(400, 80);
  assert.ok(gentle.r > strong.r);
  assert.ok(Math.abs(gentle.midY) < Math.abs(strong.midY));
});

test("the sagitta is always the share of half the width that was asked for", () => {
  for (const c of [5, 25, 50, 75, 100]) {
    const a = arcPath(600, c);
    assert.equal(Math.abs(a.midY), (c / 100) * 300, `curve ${c}`);
  }
});

test("the radius is consistent with the chord and the bow", () => {
  // r must satisfy r^2 = (w/2)^2 + (r - sagitta)^2 for the circle to pass
  // through all three points. Wrong radius, visibly wrong arc.
  for (const c of [10, 40, 90]) {
    const w = 500;
    const a = arcPath(w, c);
    const sagitta = Math.abs(a.midY);
    const lhs = a.r * a.r;
    const rhs = (w / 2) * (w / 2) + (a.r - sagitta) * (a.r - sagitta);
    assert.ok(Math.abs(lhs - rhs) < 1, `curve ${c}: ${lhs} vs ${rhs}`);
  }
});

test("curves beyond the range are clamped instead of folding over themselves", () => {
  assert.deepEqual(arcPath(300, 500), arcPath(300, CURVE_MAX));
  assert.deepEqual(arcPath(300, -500), arcPath(300, CURVE_MIN));
});

test("a width of zero does not produce a path with NaN in it", () => {
  for (const w of [0, -10]) {
    const a = arcPath(w, 60);
    assert.equal(a.d.includes("NaN"), false, `width ${w}`);
    assert.ok(Number.isFinite(a.midY));
  }
});

test("an arched line declares the extra height it occupies", () => {
  const straight = arcHeight(400, 0, 40);
  const arched = arcHeight(400, 60, 40);
  assert.ok(arched > straight, "an arch is taller than the line it came from");
  assert.equal(straight, 48);
});
