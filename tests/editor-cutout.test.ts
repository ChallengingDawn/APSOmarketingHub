import assert from "node:assert/strict";
import { test } from "node:test";
import { cutoutBackdrop, cutoutVerdict } from "../src/lib/editor/cutout";

/** A picture as a canvas hands it over: RGBA, four bytes a pixel. */
function picture(w: number, h: number, paint: (x: number, y: number) => [number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const [r, g, b] = paint(x, y);
      const i = (y * w + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  return d;
}

const alphaAt = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3];

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [10, 12, 14];

test("a flat backdrop goes and the subject stays", () => {
  // A dark square in the middle of a white field.
  const w = 40, h = 40;
  const d = picture(w, h, (x, y) => (x >= 12 && x < 28 && y >= 12 && y < 28 ? BLACK : WHITE));
  const r = cutoutBackdrop(d, w, h);
  assert.equal(r.ok, true);
  assert.equal(alphaAt(d, w, 0, 0), 0, "the corner is gone");
  assert.equal(alphaAt(d, w, 20, 20), 255, "the middle of the subject is untouched");
  assert.equal(alphaAt(d, w, 12, 12), 255, "and so is its edge");
  // 16x16 of 40x40 is the subject: 1600-256 of 1600 removed.
  assert.ok(Math.abs(r.removed - (1600 - 256) / 1600) < 0.01);
});

test("the subject's own pixels are not touched, only made see-through around", () => {
  const w = 20, h = 20;
  const d = picture(w, h, (x, y) => (x === 10 && y === 10 ? [200, 30, 40] : WHITE));
  cutoutBackdrop(d, w, h);
  const i = (10 * w + 10) * 4;
  assert.deepEqual([d[i], d[i + 1], d[i + 2]], [200, 30, 40], "the colour is the colour that was photographed");
});

test("white INSIDE the subject keeps its white", () => {
  // This is the whole reason it is a flood fill and not "delete every pixel
  // near the corner colour": a white label on a dark part would otherwise be
  // punched into a hole.
  const w = 30, h = 30;
  const d = picture(w, h, (x, y) => {
    const inPart = x >= 8 && x < 22 && y >= 8 && y < 22;
    if (!inPart) return WHITE;
    const inLabel = x >= 13 && x < 17 && y >= 13 && y < 17;
    return inLabel ? WHITE : BLACK;
  });
  cutoutBackdrop(d, w, h);
  assert.equal(alphaAt(d, w, 15, 15), 255, "the white label survives");
  assert.equal(alphaAt(d, w, 0, 0), 0, "the white backdrop does not");
});

test("a subject touching the edge is not eaten through the gap", () => {
  // Four-connected, so the fill cannot slip diagonally past a part that
  // reaches the border.
  const w = 20, h = 20;
  const d = picture(w, h, (x, y) => (y >= 8 && y < 12 ? BLACK : WHITE));
  const r = cutoutBackdrop(d, w, h);
  assert.equal(r.ok, true);
  for (let x = 0; x < w; x += 1) {
    assert.equal(alphaAt(d, w, x, 10), 255, `the band survives at x=${x}`);
  }
});

test("a photographed backdrop with uneven lighting still counts as flat", () => {
  // Demanding four identical corners would refuse every real photograph.
  const w = 30, h = 30;
  const d = picture(w, h, (x, y) => {
    if (x >= 12 && x < 18 && y >= 12 && y < 18) return BLACK;
    const v = 238 + Math.round((x + y) / 6);
    return [v, v, v];
  });
  const r = cutoutBackdrop(d, w, h);
  assert.equal(r.ok, true);
  assert.ok(r.removed > 0.5);
  assert.equal(alphaAt(d, w, 15, 15), 255);
});

test("a picture with four different corners is refused, not mangled", () => {
  const w = 20, h = 20;
  const d = picture(w, h, (x, y) => [x * 12, y * 12, 60]);
  const r = cutoutBackdrop(d, w, h);
  assert.equal(r.ok, false);
  assert.equal(r.removed, 0);
  assert.equal(alphaAt(d, w, 0, 0), 255, "nothing was changed");
  assert.equal(cutoutVerdict(r).good, false);
  assert.match(cutoutVerdict(r).why, /not one flat colour/);
});

test("tolerance decides how much noise counts as backdrop", () => {
  const w = 20, h = 20;
  const noisy = () => picture(w, h, (x, y) =>
    x >= 8 && x < 12 && y >= 8 && y < 12 ? BLACK : [250 - ((x * y) % 20), 250, 250]);
  const tight = noisy();
  const loose = noisy();
  const a = cutoutBackdrop(tight, w, h, { tolerance: 2 });
  const b = cutoutBackdrop(loose, w, h, { tolerance: 40 });
  assert.ok(b.removed >= a.removed, "a looser tolerance removes at least as much");
});

test("a verdict is given rather than a silently useless result", () => {
  assert.equal(cutoutVerdict({ ok: true, removed: 0.005 }).good, false);
  assert.match(cutoutVerdict({ ok: true, removed: 0.005 }).why, /Almost nothing/);
  assert.equal(cutoutVerdict({ ok: true, removed: 0.99 }).good, false);
  assert.match(cutoutVerdict({ ok: true, removed: 0.99 }).why, /nearly the whole picture/);
  const good = cutoutVerdict({ ok: true, removed: 0.62 });
  assert.equal(good.good, true);
  assert.match(good.why, /62%/);
});

test("a megapixel picture does not blow the stack", () => {
  // An explicit stack, not recursion: this is the size of a real photograph
  // and recursion dies at about this point.
  const w = 1200, h = 900;
  const d = picture(w, h, (x, y) =>
    x > 300 && x < 900 && y > 200 && y < 700 ? BLACK : WHITE);
  assert.doesNotThrow(() => cutoutBackdrop(d, w, h));
  assert.equal(alphaAt(d, w, 600, 450), 255);
  assert.equal(alphaAt(d, w, 1, 1), 0);
});

test("nonsense dimensions are refused", () => {
  const d = new Uint8ClampedArray(16);
  assert.deepEqual(cutoutBackdrop(d, 0, 0), { ok: false, removed: 0 });
  assert.deepEqual(cutoutBackdrop(d, 100, 100), { ok: false, removed: 0 }, "shorter than it claims");
});
