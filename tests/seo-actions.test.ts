import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WAIT_DAYS, daysSince, isDue, outcomeOf, verdictOf, type SeoAction,
} from "../src/lib/seo/actionModel";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 10);
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

const action = (over: Partial<SeoAction> = {}): SeoAction => ({
  id: 1, itemId: "quick-win:shaft seals", source: "quick-win", subject: "shaft seals",
  action: "Deepen the page", eurosEstimated: 400,
  baselineClicks: 100, baselineImpressions: 5000, baselinePosition: 8,
  windowDays: 28, startedBy: "claudio", startedAt: ago(40),
  measuredAt: null, afterClicks: null, afterImpressions: null, afterPosition: null,
  droppedAt: null, droppedReason: null,
  ...over,
});

test("work is not graded before search has had time to react", () => {
  assert.equal(isDue(action({ startedAt: ago(WAIT_DAYS - 1) }), NOW), false);
  assert.equal(isDue(action({ startedAt: ago(WAIT_DAYS) }), NOW), true);
  assert.equal(verdictOf(action({ startedAt: ago(3) }), NOW), "waiting");
});

test("a measured action reads better, flat or worse", () => {
  const measured = (after: number) =>
    verdictOf(action({ measuredAt: ago(1), afterClicks: after }), NOW);
  assert.equal(measured(140), "better");
  assert.equal(measured(60), "worse");
  // Within a fifth of where it started is ordinary wobble, not a result.
  assert.equal(measured(110), "flat");
  assert.equal(measured(90), "flat");
});

// A page with a handful of clicks cannot prove anything either way, and saying
// "better" about 3 clicks becoming 5 is how a measurement loop loses its
// credibility.
test("small numbers say so instead of claiming a result", () => {
  const tiny = action({ baselineClicks: 4, measuredAt: ago(1), afterClicks: 8 });
  assert.equal(verdictOf(tiny, NOW), "unmeasurable");
  // Once either side is real, it is gradeable again.
  const grew = action({ baselineClicks: 4, measuredAt: ago(1), afterClicks: 40 });
  assert.equal(verdictOf(grew, NOW), "better");
});

test("an abandoned action is dropped, never silently waiting", () => {
  const d = action({ droppedAt: ago(2), droppedReason: "the product was discontinued" });
  assert.equal(verdictOf(d, NOW), "dropped");
  assert.equal(isDue(d, NOW), false);
});

test("a missing baseline is unmeasurable, not zero", () => {
  const a = action({ baselineClicks: null, measuredAt: ago(1), afterClicks: 90 });
  assert.equal(verdictOf(a, NOW), "unmeasurable");
  assert.deepEqual(outcomeOf(a), { deltaClicks: null, deltaPct: null });
});

test("the outcome is clicks, and is never converted back into euros", () => {
  const a = action({ measuredAt: ago(1), afterClicks: 150 });
  const o = outcomeOf(a);
  assert.equal(o.deltaClicks, 50);
  assert.ok(Math.abs((o.deltaPct ?? 0) - 0.5) < 1e-9);
  assert.equal("eurosRealised" in o, false);
});

test("days since counts whole days", () => {
  assert.equal(daysSince(ago(0), NOW), 0);
  assert.equal(daysSince(ago(29), NOW), 29);
});
