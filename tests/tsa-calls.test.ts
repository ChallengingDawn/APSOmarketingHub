import assert from "node:assert/strict";
import { test } from "node:test";
import { DIRECTIONS, QUALIFIED, WITH_ESO, allCallsOf, directionOf, esoBy, esoSideOf, overlapOf, sameDayOf, type CallsData } from "../src/lib/reporting/callsRules";
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

// the overlap and ESO's part (SARCLA 01.11.2026): Tom, Eva and Ana (TSA); company 0 called by Tom and Eva, company 1 by all
// three, company 2 by Ana alone; one call without a company. Company 1 had an ESO visit on 2 Jun, company 0 none.
const o: CallsData = {
  ...d,
  people: [{ id: "1", name: "Tom", team: "TSA" }, { id: "2", name: "Eva", team: "TSA" }, { id: "3", name: "Ana", team: "TSA" }],
  visits: [
    [0, 0, 2, 5, 0, 2, 0, 0, 0, 1],
    [1, 0, 3, 12, 0, 2, 0, 0, 1, 1],
  ],
  // shop since, first order, revenue, owner, last order, months bought, ESO's first contact
  companies: [[20260305, 20260320, 1200, 0, 20260320, 0, 0], [0, 20260801, 0, 1, 20260801, 0, 20260602], [0, 0, 0, 2, 0, 0, 0]],
  companyIds: ["901", "902", "903"], companyNames: ["Kern GmbH", "Lutz AG", "Moser SA"],
  // person, month, day, outcome, company
  all: [[0, 2, 5, 0, 0], [1, 2, 9, 1, 0], [0, 3, 1, 1, 1], [1, 3, 12, 0, 1], [2, 4, 2, 2, 1], [2, 4, 3, 2, 1], [2, 5, 1, 2, 2], [0, 6, 1, 1, -1]],
};

test("calls: the same company called by several people - every call with a company, whatever its outcome", () => {
  const x = overlapOf(o, YTD, new Set([0, 1, 2]));
  assert.deepEqual(x.bands.map((b) => [b.people, b.companies, b.calls]), [[1, 1, 1], [2, 1, 2], [3, 1, 4]]);
  assert.equal(x.noCompany, 1);
  assert.deepEqual(x.persons.get(2), { calls: 3, companies: 2, shared: 1, sharedCalls: 2 });
  assert.equal(x.pairs.get("0|1"), 2);
  assert.equal(x.pairs.get("1|2"), 1);
  assert.equal(x.pairs.has("0|2"), true);
  // the list: the most people first
  assert.deepEqual(x.shared.map((y) => [y.ci, y.by.size, y.calls]), [[1, 3, 4], [0, 2, 2]]);
  // only the people shown: Tom and Ana share company 1 only
  const ta = overlapOf(o, YTD, new Set([0, 2]));
  assert.deepEqual(ta.bands.map((b) => b.companies), [2, 1, 0]);
  // the period: in April Tom and Eva both called company 1
  assert.deepEqual(overlapOf(o, { from: 3, to: 3 }, new Set([0, 1, 2])).shared.map((y) => y.ci), [1]);
});

test("calls: only TSA, or ESO too - ESO's first contact by the period's end", () => {
  assert.equal(esoSideOf(o, o.visits[0], 20261029), WITH_ESO[0]);
  assert.equal(esoSideOf(o, o.visits[1], 20261029), WITH_ESO[1]);
  // ESO came after the period's end: TSA's alone in it
  assert.equal(esoSideOf(o, o.visits[1], 20260531), WITH_ESO[0]);
  assert.equal(esoBy(o, 1, 20260602), true);
  // a read before ESO's contacts (six columns) has none
  assert.equal(esoBy(d, 0, 20261029), false);
});

test("calls: the same company on the same day, by person - again, or as a colleague, qualified or not", () => {
  // Ana called company 1 on 2 and 3 May - not the same day
  assert.deepEqual(sameDayOf(o, YTD, new Set([0, 1, 2])).get(2), { calls: 3, again: 0, againQ: 0, colleague: 0, colleagueQ: 0 });
  // 2 May: Ana calls company 1 a second time (no answer), and Eva calls it too, qualified
  const o2: CallsData = { ...o, all: [...o.all, [2, 4, 2, 1, 1], [1, 4, 2, 0, 1]] };
  const x = sameDayOf(o2, YTD, new Set([0, 1, 2]));
  assert.deepEqual(x.get(2), { calls: 4, again: 2, againQ: 0, colleague: 2, colleagueQ: 0 });
  assert.deepEqual(x.get(1), { calls: 3, again: 0, againQ: 0, colleague: 1, colleagueQ: 1 });
  // only the people shown count as colleagues
  assert.equal(sameDayOf(o2, YTD, new Set([0, 2])).get(2)!.colleague, 0);
});
