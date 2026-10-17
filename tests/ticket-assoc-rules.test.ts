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

import { alertArticles, msOf, normArticle } from "../src/lib/ticketAssoc/rules";

test("an order alerts an open ESO / TSA ticket it shares an article with, placed on or after the ticket's day", () => {
  const base = { orderArticles: ["1120030724", "254001102"], orderDayMs: Date.parse("2026-10-17"), ticketCreatedMs: Date.parse("2026-10-10T15:00:00Z"), ticketArticles: ["0254001102"], open: true, pipeline: "ESO" };
  assert.deepEqual(alertArticles(base), ["0254001102"]);
  // the same day counts (the order may come in the morning after an afternoon ticket's offer, or the reverse)
  assert.deepEqual(alertArticles({ ...base, orderDayMs: Date.parse("2026-10-10") }), ["0254001102"]);
  assert.deepEqual(alertArticles({ ...base, orderDayMs: Date.parse("2026-10-09") }), []);
  assert.deepEqual(alertArticles({ ...base, open: false }), []);
  assert.deepEqual(alertArticles({ ...base, pipeline: "BO" }), []);
  assert.deepEqual(alertArticles({ ...base, ticketArticles: ["9999999999"] }), []);
  assert.deepEqual(alertArticles({ ...base, orderDayMs: NaN }), []);
  // an order placed weeks ago that only changed now is old news
  assert.deepEqual(alertArticles({ ...base, now: Date.parse("2026-11-20") }), []);
  assert.deepEqual(alertArticles({ ...base, now: Date.parse("2026-10-20") }), ["0254001102"]);
});

test("article numbers compare with the leading zero the order lines drop; dates read as ms or ISO", () => {
  assert.equal(normArticle("254001102"), "0254001102");
  assert.equal(normArticle(" 1120-030-724 "), "1120030724");
  assert.equal(msOf("1760659200000"), 1760659200000);
  assert.equal(msOf("2026-10-17"), Date.parse("2026-10-17"));
  assert.ok(Number.isNaN(msOf(null)));
});
