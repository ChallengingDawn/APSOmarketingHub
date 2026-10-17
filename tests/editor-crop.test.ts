import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampCrop,
  coverCrop,
  cropToPixels,
  isWholeImage,
  panCrop,
  zoomCrop,
  zoomOf,
} from "../src/lib/editor/crop";

const near = (a: number, b: number, msg?: string) =>
  assert.ok(Math.abs(a - b) < 0.0005, msg ?? `${a} is not ${b}`);

test("a wide photo in a square box keeps its height and loses its sides", () => {
  // 2000x1000 into 400x400: half the width is used, all the height.
  const c = coverCrop(2000, 1000, 400, 400);
  near(c.w, 0.5);
  near(c.h, 1);
  near(c.x, 0.25, "centred, so a quarter is trimmed from each side");
  near(c.y, 0);
});

test("a tall photo in a wide box keeps its width and loses top and bottom", () => {
  const c = coverCrop(1000, 2000, 800, 400);
  near(c.w, 1);
  near(c.h, 0.25);
  near(c.y, 0.375);
});

test("a photo already the right shape is used whole", () => {
  const c = coverCrop(1200, 600, 400, 200);
  near(c.w, 1);
  near(c.h, 1);
  assert.equal(isWholeImage(c), true);
});

test("zoom 2 shows half as much in each direction, from the same centre", () => {
  const one = coverCrop(2000, 1000, 400, 400);
  const two = coverCrop(2000, 1000, 400, 400, 2);
  near(two.w, one.w / 2);
  near(two.h, one.h / 2);
  near(two.x + two.w / 2, one.x + one.w / 2, "the centre does not move");
  near(two.y + two.h / 2, one.y + one.h / 2);
});

test("zoom never goes below 1 - there is no more picture to show", () => {
  const c = coverCrop(2000, 1000, 400, 400, 0.2);
  near(c.w, 0.5);
  assert.equal(zoomOf(c, 2000, 1000, 400, 400), 1);
});

test("dragging the photo right shows more of its left side", () => {
  const start = coverCrop(2000, 1000, 400, 400);
  const panned = panCrop(start, 40, 0, 400, 400);
  // The window moved LEFT across the source: towards 0.
  assert.ok(panned.x < start.x, "window must move the opposite way to the drag");
  near(panned.x, start.x - (40 / 400) * start.w);
});

test("panning stops at the edge of the picture instead of running off it", () => {
  const start = coverCrop(2000, 1000, 400, 400);
  const far = panCrop(start, 100000, 100000, 400, 400);
  near(far.x, 0);
  near(far.y, 0);
  const other = panCrop(start, -100000, -100000, 400, 400);
  near(other.x, 1 - start.w);
  near(other.y, 1 - start.h, "a full-height window cannot move vertically");
});

test("zooming back out from a corner brings the subject back into the frame", () => {
  const tight = panCrop(coverCrop(2000, 1000, 400, 400, 4), -100000, 0, 400, 400);
  near(tight.x + tight.w, 1, "we are hard against the right edge");
  const out = zoomCrop(tight, 2000, 1000, 400, 400, 1);
  const k = clampCrop(out);
  assert.ok(k.x >= 0 && k.x + k.w <= 1.0001, "still inside the picture");
  near(k.w, 0.5);
});

test("the slider reads back the zoom that produced the crop", () => {
  for (const z of [1, 1.5, 2, 3.25]) {
    const c = coverCrop(1600, 1200, 500, 300, z);
    near(zoomOf(c, 1600, 1200, 500, 300), z, `zoom ${z}`);
  }
});

test("pixels are whole numbers inside the image", () => {
  const px = cropToPixels({ x: 0.25, y: 0, w: 0.5, h: 1 }, 2001, 1001);
  assert.deepEqual(px, { x: 500, y: 0, width: 1001, height: 1001 });
  assert.equal(cropToPixels(undefined, 100, 100), undefined);
  // An image whose size is not known yet must not produce a zero-size crop.
  assert.equal(cropToPixels({ x: 0, y: 0, w: 1, h: 1 }, 0, 0), undefined);
});

test("a nonsense crop is clamped rather than trusted", () => {
  const c = clampCrop({ x: -3, y: 9, w: 5, h: 0 });
  assert.ok(c.x >= 0 && c.y >= 0);
  assert.ok(c.w > 0 && c.w <= 1);
  assert.ok(c.h > 0 && c.h <= 1);
  assert.ok(c.x + c.w <= 1.0001);
  assert.ok(c.y + c.h <= 1.0001);
});

test("a box or an image with no size does not divide by zero", () => {
  assert.deepEqual(coverCrop(0, 0, 400, 400), { x: 0, y: 0, w: 1, h: 1 });
  assert.deepEqual(coverCrop(100, 100, 0, 0), { x: 0, y: 0, w: 1, h: 1 });
  const c = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 };
  assert.deepEqual(panCrop(c, 10, 10, 0, 0), clampCrop(c));
});

test("no crop at all reads as the whole image", () => {
  assert.equal(isWholeImage(undefined), true);
  assert.equal(isWholeImage({ x: 0, y: 0, w: 1, h: 1 }), true);
  assert.equal(isWholeImage({ x: 0.1, y: 0, w: 0.9, h: 1 }), false);
});
