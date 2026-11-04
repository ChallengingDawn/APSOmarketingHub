import assert from "node:assert/strict";
import { test } from "node:test";
import { TILE_STYLES, isTileStyle, runningTotal, shareOfTarget, styleShown, stylesFor, targetTone, todaysStyle } from "../src/lib/reporting/tileStyles";

// SARCLA 04.11.2026: a KPI's style in the BUC View, picked on its Actions page - the same figures drawn another way;
// none picked = drawn as today. Made-up shapes below.

const MONTHLY = { months: true, additive: true };
const RATE = { months: true, additive: false };
const YTD = { months: false, additive: false };

test("tile styles: each size offers only the styles that fit it", () => {
  assert.deepEqual(stylesFor("tile", MONTHLY), ["columns", "ytd", "trend", "progress"]);
  assert.deepEqual(stylesFor("half", MONTHLY), ["columns", "line", "cumul", "ytd", "trend", "progress"]);
  assert.deepEqual(stylesFor("card", MONTHLY), stylesFor("half", MONTHLY));
});

test("tile styles: a rate is never added up, a count of the year so far has no months", () => {
  assert.ok(!stylesFor("card", RATE).includes("cumul"));
  assert.ok(stylesFor("card", RATE).includes("line"));
  assert.deepEqual(stylesFor("card", YTD), ["ytd", "progress"]);
  assert.deepEqual(stylesFor("tile", YTD), ["ytd", "progress"]);
  assert.equal(todaysStyle(MONTHLY), "columns");
  assert.equal(todaysStyle(YTD), "ytd");
});

test("tile styles: none picked, or one that does not fit, draws it as today", () => {
  assert.equal(styleShown(null, "half", MONTHLY), null);
  assert.equal(styleShown(undefined, "half", MONTHLY), null);
  assert.equal(styleShown("line", "half", MONTHLY), "line");
  assert.equal(styleShown("line", "tile", MONTHLY), null, "a line is too small for a tile");
  assert.equal(styleShown("cumul", "card", RATE), null, "a rate has no running total");
  assert.equal(styleShown("columns", "card", YTD), null);
  assert.ok(isTileStyle("trend") && !isTileStyle("pie") && !isTileStyle(null));
  assert.equal(new Set(TILE_STYLES.map((s) => s.id)).size, TILE_STYLES.length);
});

test("tile styles: the running total stops at the last whole month", () => {
  assert.deepEqual(runningTotal([1, 2, null, 4, 5, 6, null, null, null, null, null, null], 4), [1, 3, 3, 7, null, null, null, null, null, null, null, null]);
  assert.deepEqual(runningTotal([5, 5], 0), [null, null]);
});

test("tile styles: how far toward the target, and its colour", () => {
  assert.equal(shareOfTarget(50, 100), 0.5);
  assert.equal(shareOfTarget(50, 0), null);
  assert.equal(shareOfTarget(null, 100), null);
  assert.equal(shareOfTarget(50, null), null);
  assert.equal(targetTone(1), "good");
  assert.equal(targetTone(0.85), "near");
  assert.equal(targetTone(0.5), "far");
});
