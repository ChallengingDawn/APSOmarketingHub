import assert from "node:assert/strict";
import { test } from "node:test";
import {
  benchmarkWindow, windowDates, inWindow, parsePcMonthly, sumMonths, monthTotal, monthsLoaded,
  customerStatus, median, hoursBetween, prioOf, mainAssortment, change, ORDERED_RESOLUTIONS, sturdyMedians,
} from "../src/lib/reporting/esoRules";

// Like-for-like: the months of this year that are over, against the same months last year.
test("the window is this year's completed months, and last year whole in January", () => {
  assert.deepEqual(benchmarkWindow(new Date(Date.UTC(2026, 9, 11))), { year: 2026, py: 2025, months: 9 });
  assert.deepEqual(benchmarkWindow(new Date(Date.UTC(2027, 0, 5))), { year: 2026, py: 2025, months: 12 });
  assert.deepEqual(windowDates(2026, 9), { from: "2026-01-01", to: "2026-10-01" });
  assert.deepEqual(windowDates(2026, 12), { from: "2026-01-01", to: "2027-01-01" });
  assert.equal(inWindow("2026-09-30T23:00:00Z", windowDates(2026, 9)), true);
  assert.equal(inWindow("2026-10-01", windowDates(2026, 9)), false);
  assert.equal(inWindow(null, windowDates(2026, 9)), false);
});

test("a monthly revenue blob reads by month and profit centre, and junk reads empty", () => {
  const b = parsePcMonthly(JSON.stringify({ jan: { dt: 100, kt: "50" }, may: { DT: 10 }, xyz: { dt: 1 } }));
  assert.equal(monthTotal(b, 0), 150);
  assert.equal(monthTotal(b, 4), 10);
  assert.deepEqual(sumMonths(b, 4), { total: 150, byPc: { dt: 100, kt: 50 } });
  assert.deepEqual(sumMonths(b, 5).byPc, { dt: 110, kt: 50 });
  assert.equal(sumMonths(parsePcMonthly("not json"), 12).total, 0);
  assert.equal(sumMonths(parsePcMonthly(null), 12).total, 0);
});

test("a half-loaded month is not compared", () => {
  // July has half the companies June had and last July had: stop at June.
  const cy = [2486, 2356, 2473, 2405, 2153, 2353, 1174, 0, 0];
  const py = [2258, 2234, 2262, 2126, 2119, 2079, 2176, 1883, 2146];
  assert.equal(monthsLoaded(cy, py, 9), 6);
  assert.equal(monthsLoaded([0], [10], 1), 0);
  assert.equal(monthsLoaded([10, 10], [10, 10], 2), 2);
});

const W = { year: 2026, py: 2025, months: 9 };
const co = (o: Partial<Parameters<typeof customerStatus>[0]>) => ({ cy: 0, pySame: 0, pyFull: 0, py2Same: 0, py2Full: 0, firstOrder: null, ...o });

test("customer statuses, this year and last year measured the same way", () => {
  const fresh = customerStatus(co({ cy: 500, firstOrder: "2026-03-02" }), W);
  assert.equal(fresh.newCy, true);
  assert.equal(fresh.activeCy, true);
  assert.equal(fresh.reactivatedCy, false);

  const back = customerStatus(co({ cy: 500, pyFull: 0, firstOrder: "2019-05-01" }), W);
  assert.equal(back.reactivatedCy, true);
  assert.equal(back.newCy, false);

  const slow = customerStatus(co({ cy: 400, pySame: 1000, pyFull: 1500, firstOrder: "2018-01-01" }), W);
  assert.equal(slow.slowingCy, true);
  assert.equal(slow.lostCy, false);

  const gone = customerStatus(co({ cy: 0, pySame: 800, pyFull: 900, firstOrder: "2018-01-01" }), W);
  assert.equal(gone.lostCy, true);
  assert.equal(gone.baseCy, true);
  assert.equal(gone.activePy, true);

  // last year's side: new in 2025's same months, lost relative to 2024
  const lastYear = customerStatus(co({ pySame: 300, firstOrder: "2025-02-10" }), W);
  assert.equal(lastYear.newPy, true);
  const lostLastYear = customerStatus(co({ pySame: 0, py2Full: 700, firstOrder: "2015-01-01" }), W);
  assert.equal(lostLastYear.lostPy, true);
  assert.equal(lostLastYear.basePy, true);
});

test("credit notes alone do not make a customer active", () => {
  const st = customerStatus(co({ cy: -120, pyFull: 200, firstOrder: "2017-01-01" }), W);
  assert.equal(st.activeCy, false);
  assert.equal(st.lostCy, true);
});

test("medians, durations, priorities and assortments", () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
  assert.equal(hoursBetween("2026-01-01T00:00:00Z", "2026-01-02T12:00:00Z"), 36);
  assert.equal(hoursBetween("2026-01-02T00:00:00Z", "2026-01-01T00:00:00Z"), null);
  assert.equal(hoursBetween(null, "2026-01-01"), null);
  assert.equal(prioOf("1-Prio 1 - Pot >25000€"), "Prio 1");
  assert.equal(prioOf("4- No priority for sales, Pot. <500€"), "No priority");
  assert.equal(prioOf(null), "Not set");
  assert.equal(mainAssortment({ dt: 10, kt: 40, unknown: 5 }), "kt");
  assert.equal(mainAssortment({}), null);
  assert.equal(change({ cy: 110, py: 100 }), 0.1);
  assert.equal(change({ cy: 5, py: 0 }), null);
  assert.ok(ORDERED_RESOLUTIONS.has("One-shot C2S order"));
  assert.ok(!ORDERED_RESOLUTIONS.has("Price issue"));
});

test("a median on too few tickets is left empty", () => {
  const many = Array.from({ length: 200 }, (_, i) => i);
  assert.deepEqual(sturdyMedians({ cy: many, py: many.slice(0, 15) }), { cy: 99.5, py: null });
  assert.deepEqual(sturdyMedians({ cy: many, py: many.slice(0, 19) }).py, null);
  assert.equal(sturdyMedians({ cy: many, py: many.slice(0, 40) }).py, 19.5);
  assert.deepEqual(sturdyMedians({ cy: [], py: [] }), { cy: null, py: null });
});
