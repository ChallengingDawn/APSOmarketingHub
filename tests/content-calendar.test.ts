import assert from "node:assert/strict";
import { test } from "node:test";
import {
  byDueDate,
  daysInMonth,
  isPast,
  isoDate,
  isoFromLocal,
  monthGrid,
  monthLabel,
  shiftMonth,
  unscheduled,
  weekdayIndex,
  WEEKDAYS,
} from "../src/lib/content/calendar";

test("the week starts on Monday", () => {
  assert.equal(WEEKDAYS[0], "Mon");
  // 1 October 2026 is a Thursday.
  assert.equal(weekdayIndex(2026, 10, 1), 3);
  // 5 October 2026 is a Monday.
  assert.equal(weekdayIndex(2026, 10, 5), 0);
  // 4 October 2026 is a Sunday, which is the LAST column, not the first.
  assert.equal(weekdayIndex(2026, 10, 4), 6);
});

test("month lengths, including the leap year rule", () => {
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2000, 2), 29, "divisible by 400");
  assert.equal(daysInMonth(1900, 2), 28, "divisible by 100 but not 400");
  assert.equal(daysInMonth(2026, 10), 31);
  assert.equal(daysInMonth(2026, 11), 30);
});

test("the grid is whole weeks and every day of the month is in it once", () => {
  for (const [y, m] of [[2026, 10], [2026, 2], [2024, 2], [2026, 8], [2027, 1]] as const) {
    const weeks = monthGrid(y, m);
    const flat = weeks.flat();
    assert.equal(flat.length % 7, 0, `${y}-${m} is whole weeks`);
    const own = flat.filter((d) => d.inMonth);
    assert.equal(own.length, daysInMonth(y, m), `${y}-${m} day count`);
    assert.equal(new Set(own.map((d) => d.iso)).size, own.length, "no day twice");
    assert.equal(own[0].day, 1);
    assert.equal(own[own.length - 1].day, daysInMonth(y, m));
  }
});

test("the days either side are shown, not left blank", () => {
  // October 2026 starts on a Thursday, so Mon-Wed come from September.
  const weeks = monthGrid(2026, 10);
  const first = weeks[0];
  assert.equal(first[0].inMonth, false);
  assert.equal(first[0].iso, "2026-09-28");
  assert.equal(first[3].iso, "2026-10-01", "Thursday is the 1st");
  const last = weeks[weeks.length - 1];
  const trailing = last.filter((d) => !d.inMonth);
  assert.ok(trailing.every((d) => d.iso.startsWith("2026-11")), "and November closes it");
});

test("a month that starts on a Monday has no lead-in", () => {
  // 1 June 2026 is a Monday.
  const weeks = monthGrid(2026, 6);
  assert.equal(weeks[0][0].iso, "2026-06-01");
  assert.equal(weeks[0][0].inMonth, true);
});

test("the grid crosses a year boundary in both directions", () => {
  const jan = monthGrid(2027, 1);
  assert.ok(jan[0].some((d) => d.iso.startsWith("2026-12")));
  const dec = monthGrid(2026, 12);
  assert.ok(dec[dec.length - 1].some((d) => d.iso.startsWith("2027-01")));
});

test("paging through months rolls the year over", () => {
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth(2026, 10, 0), { year: 2026, month: 10 });
  assert.deepEqual(shiftMonth(2026, 6, 12), { year: 2027, month: 6 });
  assert.deepEqual(shiftMonth(2026, 6, -18), { year: 2024, month: 12 });
});

test("the month reads as a month, not as a number", () => {
  assert.equal(monthLabel(2026, 10), "October 2026");
  assert.equal(monthLabel(2027, 1), "January 2027");
});

test("dates are padded, so they sort as strings", () => {
  assert.equal(isoDate(2026, 1, 5), "2026-01-05");
  // String order IS date order once they are padded, which is the whole
  // reason nothing here uses a Date object.
  assert.deepEqual(
    [isoDate(2026, 10, 2), isoDate(2026, 2, 10), isoDate(2026, 1, 1)].sort(),
    ["2026-01-01", "2026-02-10", "2026-10-02"],
  );
});

test("projects group onto their day, and a timestamp does not shift one", () => {
  const items = [
    { id: 1, dueDate: "2026-10-20" },
    { id: 2, dueDate: "2026-10-20" },
    // A full timestamp arriving by accident must land on the 21st, not the
    // 20th: midnight UTC read as a local time is the bug this guards.
    { id: 3, dueDate: "2026-10-21T00:00:00.000Z" },
    { id: 4, dueDate: null },
  ];
  const map = byDueDate(items);
  assert.equal(map.get("2026-10-20")?.length, 2);
  assert.equal(map.get("2026-10-21")?.length, 1);
  assert.equal(map.has("null"), false);
  assert.deepEqual(unscheduled(items).map((i) => i.id), [4]);
});

test("the past is a string comparison, which no time zone can knock over", () => {
  assert.equal(isPast("2026-10-16", "2026-10-17"), true);
  assert.equal(isPast("2026-10-17", "2026-10-17"), false, "today is not late");
  assert.equal(isPast("2026-10-18", "2026-10-17"), false);
  assert.equal(isPast("2025-12-31", "2026-01-01"), true);
});

test("today is the local day, not the UTC one", () => {
  // 1 June 2026, 00:30 local in a +02:00 zone is still 31 May in UTC.
  // toISOString() would hand back the wrong square to highlight.
  const d = new Date(2026, 5, 1, 0, 30, 0);
  assert.equal(isoFromLocal(d), "2026-06-01");
  assert.equal(isoFromLocal(new Date(2026, 0, 9)), "2026-01-09", "padded");
});
