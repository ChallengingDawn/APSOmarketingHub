import assert from "node:assert/strict";
import { test } from "node:test";
import { absences } from "../src/lib/holiday/people";

test("absences: the one holding today and the next one ahead; junk is ignored", () => {
  const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
  const now = ms("2026-10-10") + 12 * 3600_000;
  const raw = JSON.stringify([
    { startTimestamp: ms("2026-09-01"), endTimestamp: ms("2026-09-05") },
    { startTimestamp: ms("2026-10-09"), endTimestamp: ms("2026-10-14") },
    { startTimestamp: ms("2026-12-22"), endTimestamp: ms("2027-01-02") },
    { startTimestamp: ms("2026-11-02"), endTimestamp: ms("2026-11-06") },
    { startTimestamp: "x", endTimestamp: 1 },
  ]);
  assert.deepEqual(absences(raw, now), {
    now: { from: "2026-10-09", to: "2026-10-14" },
    next: { from: "2026-11-02", to: "2026-11-06" },
  });
  assert.deepEqual(absences(null, now), { now: null, next: null });
  assert.deepEqual(absences("not json", now), { now: null, next: null });
});
