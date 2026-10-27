import assert from "node:assert/strict";
import { test } from "node:test";
import { labelOf, rowsOf, statsBy, ymd, type VisitsData } from "../src/lib/reporting/visitsRules";

// two people; three companies: 0 a customer for years, 1 new and bought after the visit, 2 new and registered, no order
const d: VisitsData = {
  generatedAt: "2026-10-27T08:00:00Z", year: 2026, today: "2026-10-27",
  people: [{ id: "1", name: "Ana", team: "ESO" }, { id: "2", name: "Ben", team: "TSA" }],
  labels: { prio: ["Prio 1", "Prio 2", "Prio 3", "No priority"], category: ["APSOcore", "APSOgrowth", "APSOprospect", "Other"], kind: ["Agreed", "Cold", "Event", "Not recorded"], country: ["Switzerland", "Germany"] },
  // person, year, month, day, kind, prio, category, country, company, isNew, potential
  visits: [
    [0, 0, 2, 5, 0, 0, 0, 0, 0, 0, 40000],
    [0, 0, 3, 10, 1, 2, 2, 0, 1, 1, 0],
    [0, 0, 5, 1, 0, 2, 2, 0, 1, 0, 0], // the second visit, after its first order (no longer new)
    [1, 0, 3, 12, 1, 1, 3, 1, 2, 1, 5000],
    [1, 0, 9, 2, 2, 3, 3, 1, -1, 0, 0], // no company
    [0, 1, 4, 4, 0, 0, 0, 0, 0, 0, 40000], // last year
  ],
  companies: [[0, 20190101, 120000], [0, 20260501, 3000], [1, 0, 0]],
  open: { "0": { "Planned": 2 } },
  coverage: { read: 9, completed: 6, withCompany: 5 },
};

test("visits: a period's rows under the filters, the people of a team, a breakdown's own filter left out", () => {
  assert.equal(ymd("2026-03-05T10:00:00Z"), 20260305);
  assert.equal(rowsOf(d, { from: 0, to: 11 }, {}, null).length, 5);
  assert.equal(rowsOf(d, { from: 3, to: 3 }, {}, null).length, 2);
  assert.equal(rowsOf(d, { from: 0, to: 11 }, {}, new Set([1])).length, 2);
  assert.equal(rowsOf(d, { from: 0, to: 11, year: 1 }, {}, null).length, 1);
  assert.equal(rowsOf(d, { from: 0, to: 11 }, { country: ["Germany"] }, null).length, 2);
  assert.equal(rowsOf(d, { from: 0, to: 11 }, { country: ["Germany"] }, null, "country").length, 5);
  assert.equal(labelOf(d, d.visits[3], "person"), "Ben");
  assert.equal(labelOf(d, d.visits[3], "kind"), "Cold");
});

test("visits: the figures - companies once each, new ones from their first visit, registered and bought after it", () => {
  const win = { from: 0, to: 11 };
  const all = statsBy(d, rowsOf(d, win, {}, null), win).get("")!;
  assert.equal(all.visits, 5);
  assert.equal(all.companies, 3);
  assert.equal(all.newVisits, 2);
  assert.equal(all.newCompanies, 2);
  assert.equal(all.registeredAfter, 1);
  assert.equal(all.boughtAfter, 1);
  assert.deepEqual([all.agreed, all.cold, all.event], [2, 2, 1]);
  assert.equal(all.potSum, 45000);
  assert.equal(all.potN, 2);
  assert.equal(all.revenue, 123000);
  assert.equal(all.months[3], 2);
  const byPerson = statsBy(d, rowsOf(d, win, {}, null), win, (r) => labelOf(d, r, "person"));
  assert.equal(byPerson.get("Ana")!.boughtAfter, 1);
  assert.equal(byPerson.get("Ben")!.boughtAfter, 0);
  assert.equal(byPerson.get("Ben")!.registeredAfter, 1);
  // a period after the first order: the company was no longer new when visited
  const late = { from: 5, to: 11 };
  assert.equal(statsBy(d, rowsOf(d, late, {}, null), late).get("")!.newCompanies, 0);
});
