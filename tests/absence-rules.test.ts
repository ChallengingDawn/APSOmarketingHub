import assert from "node:assert/strict";
import { test } from "node:test";
import { newWindow, windowsOf, withWindow, withoutWindow, zurichDay, zurichDayEnd, zurichDayStart, comingWindows } from "../src/lib/holiday/absenceRules";

test("a whole day in Zurich, as HubSpot stores the windows people enter (00:00 to 23:59)", () => {
  // winter: UTC+1 - 16.11.2026 00:00 Zurich = 15.11 23:00 UTC, its end 23:59 Zurich = 22:59 UTC
  assert.equal(new Date(zurichDayStart("2026-11-16")).toISOString(), "2026-11-15T23:00:00.000Z");
  assert.equal(new Date(zurichDayEnd("2026-11-16")).toISOString(), "2026-11-16T22:59:00.000Z");
  // summer: UTC+2
  assert.equal(new Date(zurichDayStart("2026-07-17")).toISOString(), "2026-07-16T22:00:00.000Z");
  assert.equal(zurichDay(Date.parse("2026-11-15T23:30:00Z")), "2026-11-16");
});

test("windows read as HubSpot keeps them; a broken one left out", () => {
  const raw = JSON.stringify([
    { startTimestamp: Date.parse("2026-11-10T23:00:00Z"), endTimestamp: Date.parse("2026-11-16T22:59:00Z"), _clientEventId: "clientEventId1", eventTitle: "Vacation" },
    { startTimestamp: "x", endTimestamp: 1 },
  ]);
  const w = windowsOf(raw);
  assert.equal(w.length, 1);
  assert.deepEqual([w[0].from, w[0].to, w[0].title, w[0].id], ["2026-11-11", "2026-11-16", "Vacation", "clientEventId1"]);
  assert.equal(comingWindows(w, Date.parse("2026-11-20T10:00:00Z")).length, 0);
  assert.equal(comingWindows(w, Date.parse("2026-11-13T10:00:00Z")).length, 1);
  assert.deepEqual(windowsOf("not json"), []);
});

test("a new absence: checked, titled with who entered it, added without touching the others", () => {
  const now = Date.parse("2026-11-13T21:00:00Z");
  assert.deepEqual(newWindow("2026-11-20", "2026-11-18", "", "Claudio", now), { error: "The last day is before the first" });
  assert.deepEqual(newWindow("2026-11-01", "2026-11-02", "", "Claudio", now), { error: "That absence is over already" });
  const w = newWindow("2026-11-23", "2026-11-27", " Vacation ", "Claudio Saraiva", now);
  assert.ok(!("error" in w));
  if ("error" in w) return;
  assert.equal(w.title, "Vacation (entry by Claudio Saraiva)");
  assert.equal(newWindow("2026-11-23", "2026-11-23", "", "Claudio", now).hasOwnProperty("title") && (newWindow("2026-11-23", "2026-11-23", "", "Claudio", now) as { title: string }).title, "Away - entry by Claudio");
  const before = JSON.stringify([{ startTimestamp: 1, endTimestamp: 2, _clientEventId: "clientEventId7", eventTitle: "OOO", extra: true }]);
  const after = JSON.parse(withWindow(before, w));
  assert.equal(after.length, 2);
  assert.deepEqual(after[0], { startTimestamp: 1, endTimestamp: 2, _clientEventId: "clientEventId7", eventTitle: "OOO", extra: true });
  assert.deepEqual(Object.keys(after[1]), ["startTimestamp", "endTimestamp", "_clientEventId", "eventTitle"]);
  const gone = withoutWindow(JSON.stringify(after), w.id);
  assert.equal(gone.removed, true);
  assert.deepEqual(JSON.parse(gone.raw), [after[0]]);
  assert.equal(withoutWindow(before, "nope").removed, false);
});
