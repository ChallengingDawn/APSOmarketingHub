import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FIRST_BEFORE, PRIOS, churn, customerIn, labelOf, monthNo, namedOf, orderBase, prioFrom, rowsOf, statsBy, ymd, type CustDevData,
} from "../src/lib/reporting/customerDevRules";

// months from January 2023 (0): 2024 = 12…, 2025 = 24…, 2026 = 36…; October 2026 (45) runs, to the 15th of 31
// seven customers: 0 steady for years, 1 new this year, 2 last bought May 2025, 3 reactivated (Nov 2023, then May 2026),
// 4 slowing (Jul 2025 €10,000, Jul 2026 €3,000), 5 bought only in October last year, 6 last ordered in 2019
const d: CustDevData = {
  generatedAt: "2026-10-29T08:00:00Z", year: 2026, today: "2026-10-29", loaded: 9, running: { month: 45, day: 15, days: 31 }, dataDay: "2026-10-15", ordersFrom: 24,
  people: [{ name: "Ana", team: "ESO" }, { name: "Ben", team: "TSA" }],
  labels: { prio: [...PRIOS], category: ["APSOcore", "APSOgrowth", "APSOmicro"], type: ["OEM", "MRO"], apic: ["1.1", "2.3"], country: ["Switzerland", "Germany"] },
  // person, prio, category, type, apic, country, first order, last order
  companies: [
    [0, 0, 0, 0, 0, 0, FIRST_BEFORE, 20260412],
    [0, 2, 2, 1, 1, 0, 38, 20260310],
    [1, 1, 0, 0, 0, 1, FIRST_BEFORE, 20250520],
    [0, 3, 1, 1, 1, 0, FIRST_BEFORE, 20260505],
    [1, 0, 1, 0, 0, 1, FIRST_BEFORE, 20260702],
    [1, 3, 2, 1, 1, 1, FIRST_BEFORE, 20251006],
    [1, 2, 2, 1, 1, 1, FIRST_BEFORE, 20190614],
  ],
  revenue: [
    [3, 1000, 15, 1000, 27, 1000, 39, 1200],
    [38, 500],
    [28, 2000],
    [10, 300, 40, 400],
    [30, 10000, 42, 3000],
    [33, 800],
    [],
  ],
  orders: [[27, 2, 39, 3], [38, 1], [], [40, 1], [30, 4, 42, 1], [33, 1], []],
  names: ["Steady AG", "New GmbH", "May SA", "Back AG", "Slow AG", "October SA", "Gone AG"], ids: ["1", "2", "3", "4", "5", "6", "7"],
  coverage: { companies: 7, orders: 10, ordersLinked: 10, prioWorkedOut: 0 },
};
const all = d.companies.map((_, i) => i);
const ytd = { from: 0, to: 9 };
const share = 15 / 31;
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test("customer development: the months, an order's base number, a priority for every company", () => {
  assert.equal(monthNo("2023-01-05", 2026), 0);
  assert.equal(monthNo("2026-10-29", 2026), 45);
  assert.equal(monthNo("2022-12-31", 2026), null);
  assert.equal(ymd("2019-06-14"), 20190614);
  assert.equal(orderBase("A123.001.002"), "A123.001");
  assert.equal(orderBase("A123.001"), "A123.001");
  // Smart Segmentation's rule: the larger of the potential and the best year's revenue
  assert.equal(prioFrom(30000, 0), "Prio 1");
  assert.equal(prioFrom(0, 3000), "Prio 2");
  assert.equal(prioFrom(0, 25000), "Prio 2");
  assert.equal(prioFrom(400, 600), "Prio 3");
  assert.equal(prioFrom(2_000_000, 100), "No priority"); // a placeholder potential counts as none
});

test("customer development: each customer's status, the year to date against last year's same months", () => {
  const s = (i: number) => customerIn(d, i, ytd);
  assert.deepEqual([s(0).activeCy, s(0).activePy, s(0).newCy, s(0).reactCy, s(0).slowCy, s(0).lostCy, s(0).baseCy], [true, 1, false, false, false, false, true]);
  assert.equal(s(0).ordCy, 3);
  assert.equal(s(0).ordPy, 2);
  assert.equal(s(1).newCy, true);
  assert.equal(s(1).lostCy, false);
  // lost: no order in the 12 months up to the period's end - however long ago the last one
  assert.equal(s(2).lostCy, true);
  assert.equal(s(2).churnedCy, true);
  assert.equal(s(6).lostCy, true);
  assert.equal(s(6).lostPy, true);
  assert.equal(s(6).baseCy, false);
  // back after more than a year without - and a year earlier it was lost
  assert.equal(s(3).reactCy, true);
  assert.equal(s(3).lostPy, true);
  assert.equal(s(3).lostCy, false);
  assert.equal(s(4).slowCy, true);
  // last year only in October, the month in progress now: a share of a customer, its revenue and orders pro rata
  close(s(5).activePy, share);
  close(s(5).revPy, 800 * share);
  close(s(5).ordPy, share);
  assert.equal(s(5).lostCy, true);
});

test("customer development: the figures together, the churn rate, the months", () => {
  const t = statsBy(d, all, ytd).get("")!;
  assert.equal(t.active.cy, 4);
  close(t.active.py, 3 + share);
  assert.equal(t.active.rev, 1200 + 500 + 400 + 3000);
  assert.equal(t.active.ord, 3 + 1 + 1 + 1);
  assert.equal(t.new.cy, 1);
  assert.equal(t.react.cy, 1);
  assert.equal(t.slow.cy, 1);
  assert.deepEqual(t.lost, { cy: 3, py: 2 });
  assert.deepEqual(t.base, { cy: 4, py: 2 });
  assert.deepEqual(t.churned, { cy: 2, py: 1 });
  assert.deepEqual(churn(t), { cy: 0.5, py: 0.5 });
  assert.deepEqual(t.months.cy, [0, 0, 1, 1, 1, 0, 1, 0, 0, 0]);
  assert.deepEqual(t.months.py.slice(0, 9), [0, 0, 0, 1, 1, 0, 1, 0, 0]);
  close(t.months.py[9], share);
});

test("customer development: a month alone, a breakdown, the people of a team, the filters", () => {
  const oct = statsBy(d, all, { from: 9, to: 9 }).get("")!;
  assert.equal(oct.active.cy, 0);
  close(oct.active.py, share);
  const by = statsBy(d, all, ytd, (r) => labelOf(d, r, "person"));
  assert.equal(by.get("Ana")!.active.cy, 3);
  assert.equal(by.get("Ben")!.lost.cy, 3);
  assert.equal(labelOf(d, d.companies[3], "apic"), "2.3");
  assert.deepEqual(rowsOf(d, {}, new Set([0])), [0, 1, 3]);
  // only what is filtered; the Filters window's lists leave their own filter out
  assert.deepEqual(rowsOf(d, { country: ["Germany"] }, null), [2, 4, 5, 6]);
  assert.deepEqual(rowsOf(d, { country: ["Germany"] }, null, "country"), all);
});

test("customer development: the lost and the slowing by name", () => {
  const lost = namedOf(d, all, ytd, "lost");
  assert.deepEqual(lost.map((x) => [x.name, x.last, x.rev, x.lastDay]), [["May SA", 28, 2000, 20250520], ["October SA", 33, 800, 20251006], ["Gone AG", null, 0, 20190614]]);
  const slow = namedOf(d, all, ytd, "slow");
  assert.deepEqual(slow.map((x) => [x.name, x.rev, x.revPy]), [["Slow AG", 3000, 10000]]);
});
