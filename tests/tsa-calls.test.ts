import assert from "node:assert/strict";
import { test } from "node:test";
import { DIRECTIONS, QUALIFIED, allCallsOf, directionOf, type CallsData } from "../src/lib/reporting/callsRules";
import { V, labelOf, rowsOf, statsBy, visitedCompanies } from "../src/lib/reporting/visitsRules";

// the read's day 29 Oct 2026; Tom (TSA) and Eva (ESO); three qualified calls - two by Tom to a prospect (company 0) that
// registered in the shop on the day of his first call and ordered after it, one by Eva without a company - and every
// call of the year: Tom's two qualified ones and one with no answer, Eva's qualified one and two connected
const d: CallsData = {
  generatedAt: "2026-10-29T08:00:00Z", year: 2026, today: "2026-10-29",
  people: [{ id: "1", name: "Tom", team: "TSA" }, { id: "2", name: "Eva", team: "ESO" }],
  labels: { prio: ["Prio 1", "Prio 2", "Prio 3", "No priority", "No company on the call"], category: ["APSOprospect", "No company on the call"], kind: [...DIRECTIONS], country: ["Germany", "No company on the call"] },
  // person, year, month, day, direction, prio, category, country, company, never ordered before
  visits: [
    [0, 0, 2, 5, 0, 2, 0, 0, 0, 1],
    [0, 0, 3, 9, 1, 2, 0, 0, 0, 1],
    [1, 0, 3, 12, 0, 4, 1, 1, -1, 0],
  ],
  // shop since, first order, revenue, owner, last order, months bought
  companies: [[20260305, 20260320, 1200, 0, 20260320, 1 << 14]],
  companyIds: ["901"], companyNames: ["Kern GmbH"],
  open: {}, portfolio: { 0: [0, 0, 4, 0] }, lastYear: [],
  all: [[0, 2, 5, 0], [0, 3, 9, 0], [0, 3, 10, 1], [1, 3, 12, 0], [1, 4, 2, 2], [1, 9, 1, 2]],
  outcomes: [QUALIFIED, "No answer", "Connected"],
  coverage: { read: 6, completed: 3, withCompany: 2, viaContact: 0, lastYearRead: false },
};
const YTD = { from: 0, to: 9 };

test("calls: the direction as HubSpot logs it", () => {
  assert.equal(directionOf("OUTBOUND"), "Outbound");
  assert.equal(directionOf("INBOUND"), "Inbound");
  assert.equal(directionOf(null), "Not recorded");
  assert.equal(labelOf(d, d.visits[1], "kind"), "Inbound");
});

test("calls: a qualified call counts as a completed visit does - the prospect called, registered and ordered after it", () => {
  const t = statsBy(d, rowsOf(d, YTD, {}, null), YTD).get("")!;
  assert.equal(t.visits, 3);
  assert.equal(t.companies, 1);
  assert.equal(t.noCompany, 1);
  assert.equal(t.newCompanies, 1);
  // registered on the day of the first call, its first order after it
  assert.equal(t.registeredAfter, 1);
  assert.equal(t.boughtInPeriod, 1);
  const { companies, noCompany } = visitedCompanies(d, rowsOf(d, YTD, {}, new Set([0])));
  assert.deepEqual(companies.map((x) => [x.ci, x.visits, x.last]), [[0, 2, 20260409]]);
  assert.equal(noCompany, 0);
  assert.equal(rowsOf(d, YTD, { kind: ["Inbound"] }, null).length, 1);
  assert.equal(d.visits[0][V.company], 0);
});

test("calls: how many of a person's calls were qualified - by the call's day, the people shown", () => {
  const all = allCallsOf(d, YTD, new Set([0, 1]));
  assert.deepEqual(all.get(0), { calls: 3, qualified: 2 });
  assert.deepEqual(all.get(1), { calls: 3, qualified: 1 });
  // April only: Tom's second qualified call and the unanswered one, Eva's qualified one
  const apr = allCallsOf(d, { from: 3, to: 3 }, new Set([0, 1]));
  assert.deepEqual(apr.get(0), { calls: 2, qualified: 1 });
  assert.deepEqual(apr.get(1), { calls: 1, qualified: 1 });
  // a range of days: 5 Mar - 9 Apr
  assert.deepEqual(allCallsOf(d, { from: 2, to: 3, d0: 20260305, d1: 20260409 }, new Set([0])).get(0), { calls: 2, qualified: 2 });
  // only the people shown
  assert.equal(allCallsOf(d, YTD, new Set([1])).has(0), false);
});
