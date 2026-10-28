import assert from "node:assert/strict";
import { test } from "node:test";
import { POTENTIAL_BANDS, REG_WAY, bandOf, labelOf, regWayOf, rowsOf, statsBy, ymd, type VisitsData } from "../src/lib/reporting/visitsRules";

// two people; four companies: 0 a customer for years, 1 new, registered before the visit and bought after it, 2 new and
// registered on the visit's day, no order, 3 new, its first order on the visit's day and registered a month later
const d: VisitsData = {
  generatedAt: "2026-10-27T08:00:00Z", year: 2026, today: "2026-10-27",
  people: [{ id: "1", name: "Ana", team: "ESO" }, { id: "2", name: "Ben", team: "TSA" }],
  labels: { prio: ["Prio 1", "Prio 2", "Prio 3", "No priority"], category: ["APSOcore", "APSOgrowth", "APSOprospect", "Other"], kind: ["Agreed", "Cold", "Event", "Not recorded"], country: ["Switzerland", "Germany"],
    band: [...POTENTIAL_BANDS] },
  // person, year, month, day, kind, prio, category, country, company, isNew, potential, need, band
  visits: [
    [0, 0, 2, 5, 0, 0, 0, 0, 0, 0, 40000, 0, 1],
    [0, 0, 3, 10, 1, 2, 2, 0, 1, 1, 0, 12000, 5],
    [0, 0, 5, 1, 0, 2, 2, 0, 1, 0, 0, 0, 5], // the second visit, after its first order (no longer new)
    [1, 0, 3, 12, 1, 1, 3, 1, 2, 1, 5000, 2_500_000, 2], // a need over €1m: a placeholder
    [1, 0, 9, 2, 2, 3, 3, 1, -1, 0, 2_000_000, 0, 5], // no company; a placeholder potential
    [0, 1, 4, 4, 0, 0, 0, 0, 0, 0, 40000, 0, 1], // last year
    [0, 0, 6, 7, 0, 1, 2, 0, 3, 1, 0, 0, 5], // ordered on the visit's day: still new
  ],
  // shop registration day, first order, revenue
  companies: [[20180101, 20190101, 120000], [20260301, 20260501, 3000], [20260412, 0, 0], [20260815, 20260707, 800]],
  open: { "0": { "Planned": 2 } },
  coverage: { read: 9, completed: 6, withCompany: 5 },
};

test("visits: a period's rows under the filters, the people of a team, a breakdown's own filter left out", () => {
  assert.equal(ymd("2026-03-05T10:00:00Z"), 20260305);
  assert.equal(rowsOf(d, { from: 0, to: 11 }, {}, null).length, 6);
  assert.equal(rowsOf(d, { from: 3, to: 3 }, {}, null).length, 2);
  assert.equal(rowsOf(d, { from: 0, to: 11 }, {}, new Set([1])).length, 2);
  assert.equal(rowsOf(d, { from: 0, to: 11, year: 1 }, {}, null).length, 1);
  assert.equal(rowsOf(d, { from: 0, to: 11 }, { country: ["Germany"] }, null).length, 2);
  assert.equal(rowsOf(d, { from: 0, to: 11 }, { country: ["Germany"] }, null, "country").length, 6);
  assert.equal(labelOf(d, d.visits[3], "person"), "Ben");
  assert.equal(labelOf(d, d.visits[3], "kind"), "Cold");
  assert.equal(labelOf(d, d.visits[0], "band"), "€25,000 – 99,999");
});

test("visits: potential bands - a placeholder over €1m counts as not set", () => {
  assert.equal(bandOf(100000), "€100,000 and more");
  assert.equal(bandOf(40000), "€25,000 – 99,999");
  assert.equal(bandOf(499), "Under €500");
  assert.equal(bandOf(0), "Not set");
  assert.equal(bandOf(2_000_000), "Not set");
});

test("visits: the shop registration against the visit - before, on its day, later, or not by the period's end", () => {
  assert.equal(regWayOf(20260301, 20260410, 20261027), REG_WAY[2]);
  assert.equal(regWayOf(20260410, 20260410, 20261027), REG_WAY[0]);
  assert.equal(regWayOf(20260411, 20260410, 20261027), REG_WAY[1]);
  assert.equal(regWayOf(20260801, 20260410, 20260430), REG_WAY[3]);
  assert.equal(regWayOf(0, 20260410, 20261027), REG_WAY[3]);
});

test("visits: the figures - companies once each, new ones from their first visit, registered and bought after it", () => {
  const win = { from: 0, to: 11 };
  const all = statsBy(d, rowsOf(d, win, {}, null), win).get("")!;
  assert.equal(all.visits, 6);
  assert.equal(all.companies, 4);
  assert.equal(all.newVisits, 3);
  assert.equal(all.newCompanies, 3);
  assert.equal(all.registeredAfter, 2);
  assert.equal(all.boughtAfter, 2);
  assert.deepEqual([all.agreed, all.cold, all.event], [3, 2, 1]);
  // the placeholders (a potential of €2m, a need of €2.5m) left out
  assert.equal(all.potSum, 45000);
  assert.equal(all.potN, 2);
  assert.equal(all.needSum, 12000);
  assert.equal(all.needN, 1);
  assert.deepEqual(all.regWays, { [REG_WAY[2]]: 1, [REG_WAY[0]]: 1, [REG_WAY[1]]: 1 });
  assert.equal(all.boughtInPeriod, 2);
  assert.equal(all.revenue, 123800);
  assert.equal(all.buyers, 3);
  assert.equal(all.months[3], 2);
  const byPerson = statsBy(d, rowsOf(d, win, {}, null), win, (r) => labelOf(d, r, "person"));
  assert.equal(byPerson.get("Ana")!.boughtAfter, 2);
  assert.equal(byPerson.get("Ben")!.boughtAfter, 0);
  assert.equal(byPerson.get("Ben")!.registeredAfter, 1);
  // a period after the first order: the company was no longer new when visited
  const late = { from: 5, to: 5 };
  assert.equal(statsBy(d, rowsOf(d, late, {}, null), late).get("")!.newCompanies, 0);
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
});
