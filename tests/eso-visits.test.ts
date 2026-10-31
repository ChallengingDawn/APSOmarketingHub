import assert from "node:assert/strict";
import { test } from "node:test";
import { BEFORE, KINDS, NO_COMPANY, REG_WAY, coverageOf, dayWin, daysOf, isoOf, kindOf, labelOf, lastYearOf, regWayOf, rowsOf, statsBy, ymd, type VisitsData } from "../src/lib/reporting/visitsRules";

// two people; five companies: 0 a customer for years and still buying, 1 new, registered before the visit and bought after
// it, 2 new and registered on the visit's day, no order, 3 new, its first order on the visit's day and registered a month
// later, 4 a customer that had stopped buying (not retained) and ordered again after the visit
const d: VisitsData = {
  generatedAt: "2026-10-27T08:00:00Z", year: 2026, today: "2026-10-27",
  people: [{ id: "1", name: "Ana", team: "ESO" }, { id: "2", name: "Ben", team: "TSA" }],
  labels: { prio: ["Prio 1", "Prio 2", "Prio 3", "No priority", NO_COMPANY], category: ["APSOcore", "APSOgrowth", "APSOprospect", "APSOmicro", "APSOlost", NO_COMPANY],
    kind: [...KINDS], country: ["Switzerland", "Germany", NO_COMPANY] },
  // person, year, month, day, kind, prio, category, country, company, isNew
  visits: [
    [0, 0, 2, 5, 0, 0, 0, 0, 0, 0],
    [0, 0, 3, 10, 1, 2, 2, 0, 1, 1],
    [0, 0, 5, 1, 0, 2, 2, 0, 1, 0], // the second visit, after its first order (no longer new)
    [1, 0, 3, 12, 1, 1, 3, 1, 2, 1],
    [1, 0, 9, 2, 2, 4, 5, 2, -1, 0], // no company
    [0, 1, 4, 4, 0, 0, 0, 0, 0, 0], // last year
    [0, 0, 6, 7, 0, 1, 2, 0, 3, 1], // ordered on the visit's day: still new
    [1, 0, 7, 20, 0, 0, 4, 1, 4, 0], // not retained: its last order before was January 2025
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

test("visits: the type of visit as the report says - scheduled, not agreed", () => {
  assert.equal(kindOf("SCHEDULED VISIT"), "Scheduled");
  assert.equal(kindOf("COLD VISIT"), "Cold");
  assert.equal(kindOf("EVENT VISIT"), "Event");
  assert.equal(kindOf("SYNCED FROM OUTLOOK"), "Not recorded");
  assert.equal(labelOf(d, d.visits[0], "kind"), "Scheduled");
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
  assert.deepEqual([all.scheduled, all.cold, all.event], [4, 2, 1]);
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

// SARCLA 31.10.2026: "really custom dates with a mini calendar" - a visit has its day, so a period can be any days
test("visits: a range of days - either order, kept to this year and the read's day, whole months as the months alone", () => {
  assert.deepEqual(dayWin(d, 20260305, 20260517), { from: 2, to: 4, d0: 20260305, d1: 20260517 });
  assert.deepEqual(dayWin(d, 20260517, 20260305), { from: 2, to: 4, d0: 20260305, d1: 20260517 });
  assert.deepEqual(dayWin(d, 20260401, 20260630), { from: 3, to: 5 });
  // to the read's day: the year to date; past it: cut there
  assert.deepEqual(dayWin(d, 20260101, 20261027), { from: 0, to: 9 });
  assert.deepEqual(dayWin(d, 20261001, 20261231), { from: 9, to: 9 });
  assert.deepEqual(dayWin(d, 20250601, 20260110), { from: 0, to: 0, d0: 20260101, d1: 20260110 });
  // a day past its month's end rolls on
  assert.deepEqual(dayWin(d, 20260231, 20260305), { from: 2, to: 2, d0: 20260303, d1: 20260305 });
  assert.equal(isoOf(20260305), "2026-03-05");
  assert.deepEqual(daysOf(d, { from: 3, to: 5 }), [20260401, 20260630]);
  assert.deepEqual(daysOf(d, { from: 0, to: 9 }), [20260101, 20261027]);
  assert.deepEqual(daysOf(d, { from: 3, to: 3, d0: 20260411, d1: 20260420 }), [20260411, 20260420]);
});

test("visits: a range of days - the visits of those days, the figures by its last day", () => {
  assert.equal(rowsOf(d, dayWin(d, 20260411, 20260430), {}, null).length, 1);
  assert.equal(rowsOf(d, { from: 2, to: 3, d0: 20260305, d1: 20260410 }, {}, null).length, 2);
  assert.equal(rowsOf(d, dayWin(d, 20260401, 20260430), {}, null).length, 2);
  assert.equal(rowsOf(d, dayWin(d, 20260305, 20260410), {}, new Set([1])).length, 0);
  // 1 July - 10 August: ordered on the visit's day, registered on 15 August - not by the range's end
  const a = dayWin(d, 20260701, 20260810);
  const s = statsBy(d, rowsOf(d, a, {}, null), a).get("")!;
  assert.deepEqual([s.visits, s.newCompanies, s.boughtInPeriod, s.registeredAfter], [1, 1, 1, 0]);
  assert.deepEqual(s.regWays, { [REG_WAY[3]]: 1 });
  assert.deepEqual(s.months, [1, 0]);
  // to 20 August: registered by then; the not retained one visited on the 20th, its order after the visit in September
  const b = dayWin(d, 20260701, 20260820);
  const t = statsBy(d, rowsOf(d, b, {}, null), b).get("")!;
  assert.deepEqual([t.visits, t.registeredAfter, t.lapsed, t.lapsedAgain], [2, 1, 1, 0]);
  assert.deepEqual(t.regWays, { [REG_WAY[1]]: 1 });
  assert.deepEqual(t.months, [1, 1]);
  // 1 March - 15 April: the customer still buying ordered in April (by the month only) - not counted, it may be after the
  // 15th; the whole of March and April counts it. The new ones: bought after the visit, not by the 15th
  const c = dayWin(d, 20260301, 20260415);
  const u = statsBy(d, rowsOf(d, c, {}, null), c).get("")!;
  assert.deepEqual([u.stillBuying, u.stillBuyingAgain], [1, 0]);
  assert.deepEqual([u.newCompanies, u.registeredAfter, u.boughtInPeriod, u.boughtAfter], [2, 1, 0, 1]);
  const ma = { from: 2, to: 3 };
  assert.equal(statsBy(d, rowsOf(d, ma, {}, null), ma).get("")!.stillBuyingAgain, 1);
  const whole = { from: 2, to: 3, d0: 20260301, d1: 20260430 };
  assert.equal(statsBy(d, rowsOf(d, whole, {}, null), whole).get("")!.stillBuyingAgain, 1);
  // last year's meetings: the same days a year earlier
  assert.deepEqual(lastYearOf(d, { from: 6, to: 9, d0: 20260710, d1: 20261015 }, null), [1, 0, 0, 1]);
});
