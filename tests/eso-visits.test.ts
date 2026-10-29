import assert from "node:assert/strict";
import { test } from "node:test";
import { BEFORE, NO_COMPANY, REG_WAY, coverageOf, labelOf, lastYearOf, median, needOk, regWayOf, rowsOf, statsBy, ymd, type VisitsData } from "../src/lib/reporting/visitsRules";

// two people; five companies: 0 a customer for years and still buying, 1 new, registered before the visit and bought after
// it, 2 new and registered on the visit's day, no order, 3 new, its first order on the visit's day and registered a month
// later, 4 a customer that had stopped buying (not retained) and ordered again after the visit
const d: VisitsData = {
  generatedAt: "2026-10-27T08:00:00Z", year: 2026, today: "2026-10-27",
  people: [{ id: "1", name: "Ana", team: "ESO" }, { id: "2", name: "Ben", team: "TSA" }],
  labels: { prio: ["Prio 1", "Prio 2", "Prio 3", "No priority", NO_COMPANY], category: ["APSOcore", "APSOgrowth", "APSOprospect", "APSOmicro", "APSOlost", NO_COMPANY],
    kind: ["Agreed", "Cold", "Event", "Not recorded"], country: ["Switzerland", "Germany", NO_COMPANY] },
  // person, year, month, day, kind, prio, category, country, company, isNew, need
  visits: [
    [0, 0, 2, 5, 0, 0, 0, 0, 0, 0, 40000],
    [0, 0, 3, 10, 1, 2, 2, 0, 1, 1, 12000],
    [0, 0, 5, 1, 0, 2, 2, 0, 1, 0, 0], // the second visit, after its first order (no longer new)
    [1, 0, 3, 12, 1, 1, 3, 1, 2, 1, 2_500_000], // a need over €1m: a placeholder
    [1, 0, 9, 2, 2, 4, 5, 2, -1, 0, 3], // no company; a need of "3": typed in thousands
    [0, 1, 4, 4, 0, 0, 0, 0, 0, 0, 0], // last year
    [0, 0, 6, 7, 0, 1, 2, 0, 3, 1, 0], // ordered on the visit's day: still new
    [1, 0, 7, 20, 0, 0, 4, 1, 4, 0, 5000], // not retained: its last order before was January 2025
  ],
  // shop registration day, first order, revenue, owner now, last order, months bought in (bit 0 = January last year)
  companies: [
    [20180101, 20190101, 120000, 0, 20260901, (1 << 21) - 1],
    [20260301, 20260501, 3000, 0, 20260501, 1 << 16],
    [20260412, 0, 0, 1, 0, 0],
    [20260815, 20260707, 800, 0, 20260707, 1 << 18],
    [20150101, 20150301, 2000, 1, 20260910, (1 << 0) | (1 << 20)],
  ],
  open: { "0": { "Planned": 2 } },
  portfolio: { "0": [10, 20, 30, 5], "1": [2, 0, 0, 0] },
  // last year's customer meetings: person, month, day
  lastYear: [[0, 6, 3], [0, 6, 20], [1, 9, 30], [0, 9, 1]],
  coverage: { read: 11, completed: 8, withCompany: 7, viaContact: 1, lastYearRead: true },
};

test("visits: a period's rows under the filters, the people of a team, a breakdown's own filter left out on asking", () => {
  assert.equal(ymd("2026-03-05T10:00:00Z"), 20260305);
  assert.equal(rowsOf(d, { from: 0, to: 11 }, {}, null).length, 7);
  assert.equal(rowsOf(d, { from: 3, to: 3 }, {}, null).length, 2);
  assert.equal(rowsOf(d, { from: 0, to: 11 }, {}, new Set([1])).length, 3);
  assert.equal(rowsOf(d, { from: 0, to: 11, year: 1 }, {}, null).length, 1);
  assert.equal(rowsOf(d, { from: 0, to: 11 }, { country: ["Germany"] }, null).length, 2);
  assert.equal(rowsOf(d, { from: 0, to: 11 }, { country: ["Germany"] }, null, "country").length, 7);
  assert.equal(labelOf(d, d.visits[3], "person"), "Ben");
  assert.equal(labelOf(d, d.visits[3], "kind"), "Cold");
  assert.equal(labelOf(d, d.visits[7], "category"), "APSOlost");
  assert.equal(labelOf(d, d.visits[4], "country"), NO_COMPANY);
});

test("visits: the shop registration against the visit - before, on its day, later, or not by the period's end", () => {
  assert.equal(regWayOf(20260301, 20260410, 20261027), REG_WAY[2]);
  assert.equal(regWayOf(20260410, 20260410, 20261027), REG_WAY[0]);
  assert.equal(regWayOf(20260411, 20260410, 20261027), REG_WAY[1]);
  assert.equal(regWayOf(20260801, 20260410, 20260430), REG_WAY[3]);
  assert.equal(regWayOf(0, 20260410, 20261027), REG_WAY[3]);
});

test("visits: the annual need - €100 to €1m, the middle value", () => {
  assert.equal(needOk(99), false);
  assert.equal(needOk(100), true);
  assert.equal(needOk(1_000_001), false);
  assert.equal(median([1, 3, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test("visits: the figures - companies once each, new ones and earlier customers from their first visit", () => {
  const win = { from: 0, to: 11 };
  const all = statsBy(d, rowsOf(d, win, {}, null), win).get("")!;
  assert.equal(all.visits, 7);
  assert.equal(all.companies, 5);
  assert.equal(all.noCompany, 1);
  assert.equal(all.newVisits, 3);
  assert.equal(all.newCompanies, 3);
  assert.equal(all.registeredAfter, 2);
  assert.deepEqual(all.regWays, { [REG_WAY[2]]: 1, [REG_WAY[0]]: 1, [REG_WAY[1]]: 1 });
  assert.equal(all.boughtAfter, 2);
  assert.equal(all.boughtInPeriod, 2);
  // the earlier customers: one still buying, one not retained - both ordered after the visit
  assert.deepEqual([all.oldCompanies, all.stillBuying, all.lapsed, all.stillBuyingAgain, all.lapsedAgain], [2, 1, 1, 1, 1]);
  assert.deepEqual([all.agreed, all.cold, all.event], [4, 2, 1]);
  // the needs: €2.5m (a placeholder) and "3" (typed in thousands) left out
  assert.deepEqual(all.needs, [40000, 12000, 5000]);
  assert.equal(all.needOut, 2);
  assert.equal(median(all.needs), 12000);
  assert.equal(all.revenue, 125800);
  assert.equal(all.buyers, 4);
  assert.equal(all.months[3], 2);
  const byPerson = statsBy(d, rowsOf(d, win, {}, null), win, (r) => labelOf(d, r, "person"));
  assert.equal(byPerson.get("Ana")!.boughtAfter, 2);
  assert.equal(byPerson.get("Ben")!.registeredAfter, 1);
  assert.equal(byPerson.get("Ben")!.lapsedAgain, 1);
  assert.equal(byPerson.get("Ben")!.noCompany, 1);
  // June only: visited after its first order - an earlier customer, still buying (May), no order after the visit
  const jun = { from: 5, to: 5 };
  const j6 = statsBy(d, rowsOf(d, jun, {}, null), jun).get("")!;
  assert.deepEqual([j6.newCompanies, j6.stillBuying, j6.stillBuyingAgain], [0, 1, 0]);
  // April only: visited new, its first order in May - bought after the visit, not in the period
  const apr = { from: 3, to: 3 };
  const a = statsBy(d, rowsOf(d, apr, {}, null), apr).get("")!;
  assert.equal(a.newCompanies, 2);
  assert.equal(a.boughtAfter, 1);
  assert.equal(a.boughtInPeriod, 0);
  assert.equal(a.registeredAfter, 1);
  // July only: ordered on the visit's day - bought; registered in August - not by the period's end
  const jul = { from: 6, to: 6 };
  const j = statsBy(d, rowsOf(d, jul, {}, null), jul).get("")!;
  assert.equal(j.newCompanies, 1);
  assert.equal(j.boughtInPeriod, 1);
  assert.equal(j.registeredAfter, 0);
  assert.deepEqual(j.regWays, { [REG_WAY[3]]: 1 });
  // August only: not retained, its order after the visit in September - not by the period's end
  const aug = { from: 7, to: 7 };
  const g = statsBy(d, rowsOf(d, aug, {}, null), aug).get("")!;
  assert.deepEqual([g.lapsed, g.lapsedAgain], [1, 0]);
  assert.equal(BEFORE.length, 2);
});

test("visits: how much of each priority was visited - the owners' companies now, the ones a visit reached", () => {
  const rows = rowsOf(d, { from: 0, to: 11 }, {}, null);
  assert.deepEqual(coverageOf(d, rows, new Set([0, 1])).map((x) => [x.label, x.visited, x.owned]), [["Prio 1", 2, 12], ["Prio 2", 2, 20], ["Prio 3", 1, 30], ["No priority", 0, 5]]);
  assert.deepEqual(coverageOf(d, rows, new Set([0])).map((x) => [x.visited, x.owned]), [[1, 10], [1, 20], [1, 30], [0, 5]]);
});

test("visits: last year's customer meetings by month - the running month to the same day", () => {
  assert.deepEqual(lastYearOf(d, { from: 0, to: 9 }, null), [0, 0, 0, 0, 0, 0, 2, 0, 0, 1]);
  assert.deepEqual(lastYearOf(d, { from: 6, to: 9 }, new Set([1])), [0, 0, 0, 0]);
});
