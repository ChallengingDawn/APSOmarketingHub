import assert from "node:assert/strict";
import { test } from "node:test";
import { LOGIN_LIFE_MS, reminderDue } from "../src/lib/integrations/googleLoginDue";

test("the borrowed Google login: a reminder the day before its seven days end, a notice once it has stopped", () => {
  const given = "2026-10-20T08:00:00.000Z", at = Date.parse(given);
  assert.equal(reminderDue(given, at + 3 * 86_400_000, false), null);
  assert.equal(reminderDue(given, at + LOGIN_LIFE_MS - 25 * 3_600_000, false), null);
  assert.equal(reminderDue(given, at + LOGIN_LIFE_MS - 23 * 3_600_000, false), "soon");
  assert.equal(reminderDue(given, at + 2 * 86_400_000, true), "ended"); // revoked early
  assert.equal(reminderDue("not a date", at, false), null);
});
