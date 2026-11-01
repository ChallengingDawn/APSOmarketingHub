import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GQS_STAGE, byKey, byMonth, daysToOffer, inPeriod, median, outcomeOf, ownerOf, refusedBy, resultOf, sentIn, stageTimes, sumOf, typeOf, wonShare, type GqsRow,
} from "../src/lib/gqsFigures/figures";

const DAY = 86_400_000;
const row = (over: Partial<GqsRow> = {}): GqsRow => ({
  id: "1", created: "2026-10-05T08:00:00Z", stage: GQS_STAGE.open, status: null, type: null, owner: null, ownerName: null,
  offerAt: null, refusedAt: null, t: {}, eso: null, reason: null, subject: "", ...over,
});

test("where a GQS task ended, and what came of the offer", () => {
  assert.equal(outcomeOf(row({ stage: GQS_STAGE.offer })), "offer");
  assert.equal(outcomeOf(row({ stage: GQS_STAGE.refused })), "refused");
  assert.equal(outcomeOf(row({ stage: GQS_STAGE.waitingCustomer })), "open");
  assert.equal(resultOf(row({ status: "WON" })), "won");
  assert.equal(resultOf(row({ status: " lost " })), "lost");
  assert.equal(resultOf(row({ status: "Offer Sent to Sales" })), null);
  assert.equal(refusedBy(row({ status: "Refused by GQS" })), "Refused by GQS");
  assert.equal(refusedBy(row({ status: "LOST" })), "Refused");
});

test("HubSpot's labels are tidied, and nobody or no type is named", () => {
  assert.equal(typeOf(row({ type: "DT -  New Business" })), "DT - New Business");
  assert.equal(typeOf(row()), "No type");
  assert.equal(ownerOf(row({ owner: "7", ownerName: "Sara" })), "Sara");
  assert.equal(ownerOf(row({ owner: "7" })), "Owner 7");
  assert.equal(ownerOf(row()), "Nobody");
});

test("a set of tasks summed up: the outcomes, the won share of the known ones, the days to the offer", () => {
  const c = Date.parse("2026-10-01T00:00:00Z");
  const rows = [
    row({ stage: GQS_STAGE.offer, status: "WON", created: new Date(c).toISOString(), offerAt: new Date(c + 4 * DAY).toISOString() }),
    row({ stage: GQS_STAGE.offer, status: "LOST", created: new Date(c).toISOString(), offerAt: new Date(c + 10 * DAY).toISOString() }),
    row({ stage: GQS_STAGE.offer, status: "Offer Sent to Sales", created: new Date(c).toISOString(), offerAt: new Date(c + 13 * DAY).toISOString() }),
    row({ stage: GQS_STAGE.refused, status: "Refused by Back-Office" }),
    row(),
  ];
  const s = sumOf(rows);
  assert.deepEqual([s.n, s.offer, s.refused, s.open, s.won, s.lost, s.waiting], [5, 3, 1, 1, 1, 1, 1]);
  // WON on a task whose stage was never moved counts as won, not as waiting
  const t = sumOf([row({ stage: GQS_STAGE.waitingGqs, status: "WON" })]);
  assert.deepEqual([t.won, t.open, t.waiting], [1, 1, 0]);
  assert.equal(wonShare(s), 0.5);
  assert.equal(median(s.days), 10);
  assert.equal(wonShare(sumOf([row()])), null);
  assert.equal(daysToOffer(row({ offerAt: "2026-10-01T00:00:00Z", created: "2026-10-05T00:00:00Z" })), null); // never backwards
});

test("the period is Swiss days, months are in order, a breakdown is largest first", () => {
  const rows = [row({ id: "a", created: "2026-09-30T22:30:00Z", type: "Running Business" }), row({ id: "b", created: "2026-10-31T12:00:00Z", type: "Running Business" }), row({ id: "c", created: "2026-10-02T12:00:00Z", type: "KT -  New Business" })];
  assert.deepEqual(inPeriod(rows, "2026-10-01", "2026-10-31").map((r) => r.id), ["a", "b", "c"]); // 00:30 on 1 Oct in Zurich
  assert.deepEqual(byMonth(rows).map((m) => [m.label, m.s.n]), [["2026-10", 3]]);
  assert.deepEqual(byKey(rows, typeOf).map((x) => [x.label, x.s.n]), [["Running Business", 2], ["KT - New Business", 1]]);
});

test("offers count by the day they were sent, whenever they were asked for", () => {
  const rows = [row({ id: "a", created: "2026-09-20T08:00:00Z", offerAt: "2026-10-03T08:00:00Z" }), row({ id: "b", created: "2026-10-02T08:00:00Z", offerAt: "2026-11-02T08:00:00Z" }), row({ id: "c" })];
  assert.deepEqual(sentIn(rows, "2026-10-01", "2026-10-31").map((r) => r.id), ["a"]);
});

test("the time in each stage: the median over the tasks that were there", () => {
  const rows = [row({ t: { [GQS_STAGE.open]: 2 * DAY } }), row({ t: { [GQS_STAGE.open]: 6 * DAY, [GQS_STAGE.waitingGqs]: DAY } }), row()];
  const t = stageTimes(rows);
  assert.deepEqual(t.find((x) => x.stage === GQS_STAGE.open), { stage: GQS_STAGE.open, tasks: 2, days: 4 });
  assert.deepEqual(t.find((x) => x.stage === GQS_STAGE.waitingGqs), { stage: GQS_STAGE.waitingGqs, tasks: 1, days: 1 });
  assert.deepEqual(t.find((x) => x.stage === GQS_STAGE.remind), { stage: GQS_STAGE.remind, tasks: 0, days: null });
});
