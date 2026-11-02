import assert from "node:assert/strict";
import { test } from "node:test";
import { activityDays, activityOf, isSent, type ActivityData } from "../src/lib/reporting/activityRules";

// SARCLA 02.11.2026: "on the ESO reports it missed the activity - just a graph with the number of activities in total, split
// by e-mails, calls, customer visits".
const ADEM = "4", JAN = "7";

test("only the e-mails a person sent count - an answer received is the customer's", () => {
  assert.equal(isSent("EMAIL"), true);
  assert.equal(isSent("FORWARDED_EMAIL"), true);
  assert.equal(isSent("INCOMING_EMAIL"), false);
  assert.equal(isSent(null), false);
});

test("each person's e-mails and calls by day, then in a window of months cut to days", () => {
  const days = activityDays(
    [{ owner: ADEM, day: 20260105 }, { owner: ADEM, day: 20260105 }, { owner: ADEM, day: 20260310 }, { owner: JAN, day: 20260310 }, { owner: "", day: 20260310 }],
    [{ owner: ADEM, day: 20260105 }, { owner: ADEM, day: 20260420 }, { owner: JAN, day: 0 }],
  );
  assert.deepEqual(days[ADEM], [[20260105, 2, 1], [20260310, 1, 0], [20260420, 0, 1]]);
  assert.deepEqual(days[JAN], [[20260310, 1, 0]]);
  assert.equal(days[""], undefined);
  const d: ActivityData = { generatedAt: "", year: 2026, today: "2026-11-02", days, owners: [ADEM, JAN] };
  // the year to date
  assert.deepEqual(activityOf(d, ADEM, { from: 0, to: 10 }), { mails: 3, calls: 2 });
  // March to April
  assert.deepEqual(activityOf(d, ADEM, { from: 2, to: 3 }), { mails: 1, calls: 1 });
  // January cut to the 6th onwards
  assert.deepEqual(activityOf(d, ADEM, { from: 0, to: 0, d0: 20260106 }), { mails: 0, calls: 0 });
  // last year is not read: none, never this year's
  assert.deepEqual(activityOf(d, ADEM, { from: 0, to: 10, year: 1 }), { mails: 0, calls: 0 });
  assert.deepEqual(activityOf(d, "99", { from: 0, to: 10 }), { mails: 0, calls: 0 });
});
