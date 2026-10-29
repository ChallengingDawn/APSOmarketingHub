import assert from "node:assert/strict";
import { test } from "node:test";
import {
  C, FIRST_BEFORE, POTENTIAL_BANDS, bandOf, churn, customerIn, labelOf, monthNo, namedOf, orderBase, rowsOf, statsBy, type CustDevData,
} from "../src/lib/reporting/customerDevRules";

// months from January 2023 (0): 2024 = 12…, 2025 = 24…, 2026 = 36…; October 2026 (45) runs, to the 15th of 31
// six customers: 0 steady for years, 1 new this year, 2 lost (last bought May 2025), 3 reactivated (Nov 2023, then May
// 2026), 4 slowing (Jul 2025 €10,000, Jul 2026 €3,000), 5 bought only in October last year
const d: CustDevData = {
  generatedAt: "2026-10-29T08:00:00Z", year: 2026, today: "2026-10-29", loaded: 9, running: { month: 45, day: 15, days: 31 }, dataDay: "2026-10-15", ordersFrom: 24,
  people: [{ name: "Ana", team: "ESO" }, { name: "Ben", team: "TSA" }],
  labels: { prio: ["Prio 1", "Prio 2", "Prio 3", "No priority"], category: ["APSOcore", "APSOgrowth", "APSOprospect", "Other"], type: ["OEM", "MRO"], country: ["Switzerland", "Germany"], band: [...POTENTIAL_BANDS] },
  // person, prio, category, type, country, band, potential, first order
  companies: [
    [0, 0, 0, 0, 0, 1, 40000, FIRST_BEFORE],
    [0, 2, 2, 1, 0, 5, 0, 38],
    [1, 1, 0, 0, 1, 1, 30000, FIRST_BEFORE],
    [0, 3, 3, 1, 0, 5, 0, FIRST_BEFORE],
    [1, 0, 1, 0, 1, 5, 0, FIRST_BEFORE],
    [1, 3, 3, 1, 1, 5, 0, FIRST_BEFORE],
  ],
  revenue: [
    [3, 1000, 15, 1000, 27, 1000, 39, 1200],
    [38, 500],
    [28, 2000],
    [10, 300, 40, 400],
    [30, 10000, 42, 3000],
    [33, 800],
  ],
  orders: [[27, 2, 39, 3], [38, 1], [], [40, 1], [30, 4, 42, 1], [33, 1]],
  names: ["Steady AG", "New GmbH", "Lost SA", "Back AG", "Slow AG", "October SA"], ids: ["1", "2", "3", "4", "5", "6"],
  coverage: { companies: 6, orders: 10, ordersLinked: 10 },
};
const all = d.companies.map((_, i) => i);
const ytd = { from: 0, to: 9 };
const share = 15 / 31;
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test("customer development: the months, an order's base number, the potential bands", () => {
  assert.equal(monthNo("2023-01-05", 2026), 0);
  assert.equal(monthNo("2026-10-29", 2026), 45);
  assert.equal(monthNo("2022-12-31", 2026), null);
  assert.equal(monthNo(null, 2026), null);
  assert.equal(orderBase("A123.001.002"), "A123.001");
  assert.equal(orderBase("A123.001"), "A123.001");
  assert.equal(bandOf(30000), POTENTIAL_BANDS[1]);
  assert.equal(bandOf(2_000_000), "Not set");
});

test("customer development: each customer's status, the year to date against last year's same months", () => {
  const s = (i: number) => customerIn(d, i, ytd);
  // steady: bought both years, not new, not back, not slowing, not lost
  assert.deepEqual([s(0).activeCy, s(0).activePy, s(0).newCy, s(0).reactCy, s(0).slowCy, s(0).lostCy, s(0).baseCy], [true, 1, false, false, false, false, true]);
  assert.equal(s(0).ordCy, 3);
  assert.equal(s(0).ordPy, 2);
  // new this year
  assert.equal(s(1).newCy, true);
  assert.equal(s(1).reactCy, false);
  // lost: bought in the 12 months before the last 12, nothing since; its revenue of that year
  assert.equal(s(2).lostCy, true);
  assert.equal(s(2).lostRevCy, 2000);
  assert.equal(s(2).activeCy, false);
  // back after more than a year without - and last year it was the lost one
  assert.equal(s(3).reactCy, true);
  assert.equal(s(3).lostPy, true);
  // less than half of the same months last year
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
  assert.equal(t.lost.cy, 2);
  assert.equal(t.lost.rev, 2800);
  assert.equal(t.lost.pot, 30000);
  assert.equal(t.base.cy, 4);
  assert.equal(t.lost.py, 1);
  assert.equal(t.base.py, 2);
  assert.deepEqual(churn(t), { cy: 0.5, py: 0.5 });
  // customers who bought, month by month: March, April, May, July this year; last October as its share
  assert.deepEqual(t.months.cy, [0, 0, 1, 1, 1, 0, 1, 0, 0, 0]);
  assert.deepEqual(t.months.py.slice(0, 9), [0, 0, 0, 1, 1, 0, 1, 0, 0]);
  close(t.months.py[9], share);
});

test("customer development: a month alone, a breakdown, the people of a team, the filters", () => {
  // October to date: nobody bought yet; last October's buyer as its share
  const oct = statsBy(d, all, { from: 9, to: 9 }).get("")!;
  assert.equal(oct.active.cy, 0);
  close(oct.active.py, share);
  // by person
  const by = statsBy(d, all, ytd, (r) => labelOf(d, r, "person"));
  assert.equal(by.get("Ana")!.active.cy, 3);
  assert.equal(by.get("Ben")!.lost.cy, 2);
  // Ana's customers only, then Germany only
  assert.deepEqual(rowsOf(d, {}, new Set([0])), [0, 1, 3]);
  assert.deepEqual(rowsOf(d, { country: ["Germany"] }, null), [2, 4, 5]);
  // grouping by country leaves the country filter out
  assert.deepEqual(rowsOf(d, { country: ["Germany"] }, null, "country"), all);
  assert.equal(d.companies[0][C.potential], 40000);
});

test("customer development: the lost and the slowing by name", () => {
  const lost = namedOf(d, all, ytd, "lost");
  assert.deepEqual(lost.map((x) => [x.name, x.rev, x.potential, x.last]), [["Lost SA", 2000, 30000, 28], ["October SA", 800, 0, 33]]);
  const slow = namedOf(d, all, ytd, "slow");
  assert.deepEqual(slow.map((x) => [x.name, x.rev, x.revPy]), [["Slow AG", 3000, 10000]]);
});
