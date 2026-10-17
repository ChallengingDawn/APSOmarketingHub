import assert from "node:assert/strict";
import { test } from "node:test";
import { firstSince, nextSince, reason } from "../src/lib/ticketAssoc/rules";

test("the workflow's two triggers: a ticket new to the hub, or one that moved stage", () => {
  assert.equal(reason("1", undefined), "new");
  assert.equal(reason("2", { stage: "1", ok: true }), "stage");
  // an edit, or the hub's own write coming back: left alone, as the workflow left it
  assert.equal(reason("1", { stage: "1", ok: true }), null);
  // a failed processing is asked again whatever happened since
  assert.equal(reason("1", { stage: null, ok: false }), "retry");
});

test("the window moves on to the newest change read, never back", () => {
  assert.equal(nextSince(1000, [1500, 1200, 1800]), 1800);
  assert.equal(nextSince(2000, [1500]), 2000);
  assert.equal(nextSince(2000, []), 2000);
  assert.equal(nextSince(2000, [NaN, 0]), 2000);
});

test("after a start or a long stop the first look goes back half an hour, not days", () => {
  const now = Date.parse("2026-10-17T10:00:00Z");
  assert.equal(firstSince(null, now), now - 30 * 60_000);
  assert.equal(firstSince(now - 5 * 60_000, now), now - 5 * 60_000);
  assert.equal(firstSince(now - 3 * 86_400_000, now), now - 30 * 60_000);
});
