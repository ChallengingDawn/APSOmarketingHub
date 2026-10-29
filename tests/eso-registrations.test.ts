import assert from "node:assert/strict";
import { test } from "node:test";
import { REG_VISIT, STATUS, bandOf, cutOf, daysBetween, labelOf, median, spanOf, statsBy, statusOf, visitOf, ymd, type RegData } from "../src/lib/reporting/registrationsRules";

// the read's day 29 Oct 2026; two owners and the "No owner" row; five companies:
// 0 registered 5 Mar 2026, visited the same day, bought 20 Mar
// 1 registered 12 Apr 2026, visited 1 Feb before it, never bought
// 2 registered 10 Oct 2025 (last year), bought 1 Nov 2025 - after last year's day (29 Oct 2025): not bought by then
// 3 registered 1 Jun 2026, had ordered in 2019 (already a customer), visited in July
// 4 in the shop since 2018: an account opened at it this year is one more, not a company registering
const d: RegData = {
  generatedAt: "2026-10-29T08:00:00Z", year: 2026, today: "2026-10-29",
  people: [{ id: "1", name: "Ana", team: "ESO" }, { id: "2", name: "Ben", team: "TSA" }, { id: "", name: "No owner", team: "Other" }],
  labels: { country: ["Switzerland", "Germany"], prio: ["Prio 1", "Prio 2", "Prio 3", "No priority"], category: ["APSOcore", "APSOgrowth", "APSOprospect", "Other"], type: ["OEM", "MRO"], band: ["Not set"] },
  // person, reg, firstOrder, firstVisit, country, prio, category, type, band
  companies: [
    [0, 20260305, 20260320, 20260305, 0, 0, 2, 0, 0],
    [0, 20260412, 0, 20260201, 1, 1, 2, 1, 0],
    [1, 20251010, 20251101, 0, 0, 2, 2, 0, 0],
    [1, 20260601, 20190101, 20260715, 1, 3, 0, 1, 0],
    [0, 20180101, 20180301, 0, 0, 0, 0, 0, 0],
  ],
  // company, day
  accounts: [[0, 20260305], [0, 20260310], [1, 20260412], [2, 20251010], [3, 20260601], [4, 20260815], [-1, 20260902]],
  coverage: { accounts: 7, noCompany: 1, companies: 5, visits: 3 },
};
const YTD = { from: 0, to: 9 };

test("registrations: the days, the like-for-like spans", () => {
  assert.equal(ymd("2026-03-05T10:00:00Z"), 20260305);
  assert.equal(ymd(null), 0);
  assert.equal(daysBetween(20260305, 20260320), 15);
  assert.equal(daysBetween(20251231, 20260101), 1);
  assert.equal(cutOf(d, 0), 20261029);
  assert.equal(cutOf(d, 1), 20251029);
  // the running month to the same day, last year too; a past month to its end
  assert.deepEqual(spanOf(d, YTD, 0), { from: 20260101, to: 20261029 });
  assert.deepEqual(spanOf(d, YTD, 1), { from: 20250101, to: 20251029 });
  assert.deepEqual(spanOf(d, { from: 1, to: 1 }, 1), { from: 20250201, to: 20250228 });
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  // a potential over €1m is a placeholder
  assert.equal(bandOf(40000), "€25,000 – 99,999");
  assert.equal(bandOf(2_000_000), "Not set");
});

test("registrations: before registering, and against the first visit", () => {
  assert.equal(statusOf(d.companies[0]), STATUS[0]);
  assert.equal(statusOf(d.companies[3]), STATUS[1]);
  // an order on the day of registering is after it
  assert.equal(statusOf([0, 20260305, 20260305, 0, 0, 0, 0, 0, 0]), STATUS[0]);
  assert.equal(visitOf(d.companies[0], 20261029), REG_VISIT[0]);
  assert.equal(visitOf(d.companies[1], 20261029), REG_VISIT[1]);
  assert.equal(visitOf(d.companies[3], 20261029), REG_VISIT[2]);
  // a visit after the side's day is not there yet
  assert.equal(visitOf(d.companies[3], 20260630), REG_VISIT[3]);
  assert.equal(visitOf(d.companies[2], 20261029), REG_VISIT[3]);
  assert.equal(labelOf(d, d.companies[3], "person"), "Ben");
  assert.equal(labelOf(d, d.companies[1], "country"), "Germany");
  assert.equal(labelOf(d, d.companies[3], "visit"), REG_VISIT[2]);
});

test("registrations: the year to date against last year's, to the same day", () => {
  const cy = statsBy(d, YTD, 0, {}, null).get("")!;
  assert.equal(cy.companies, 3);
  assert.equal(cy.already, 1);
  assert.equal(cy.fresh, 2);
  assert.equal(cy.bought, 1);
  assert.deepEqual(cy.days, [15]);
  assert.deepEqual(cy.visit, { [REG_VISIT[0]]: 1, [REG_VISIT[1]]: 1, [REG_VISIT[2]]: 1 });
  // six accounts this year: a second at company 0 and one at company 4 (in the shop since 2018) are at companies already in it
  assert.equal(cy.accounts, 6);
  assert.equal(cy.more, 2);
  assert.deepEqual(cy.months, [0, 0, 1, 1, 0, 1, 0, 0, 0, 0]);
  const py = statsBy(d, YTD, 1, {}, null).get("")!;
  assert.equal(py.companies, 1);
  // bought on 1 Nov 2025 - after last year's day, so not yet as far as the comparison goes
  assert.equal(py.bought, 0);
  assert.equal(py.accounts, 1);
});

test("registrations: the people of a team, the filters, a breakdown's own filter left out", () => {
  const ana = statsBy(d, YTD, 0, {}, new Set([0])).get("")!;
  assert.equal(ana.companies, 2);
  // the account without a company belongs to nobody's team
  assert.equal(ana.accounts, 4);
  const by = statsBy(d, YTD, 0, {}, null, "person");
  assert.equal(by.get("Ana")!.companies, 2);
  assert.equal(by.get("Ben")!.companies, 1);
  assert.equal(by.get("No owner")!.accounts, 1);
  assert.equal(by.get("No owner")!.companies, 0);
  const de = statsBy(d, YTD, 0, { country: ["Germany"] }, null).get("")!;
  assert.equal(de.companies, 2);
  assert.equal(statsBy(d, YTD, 0, { country: ["Germany"] }, null, "country").get("Switzerland")!.companies, 1);
  const fresh = statsBy(d, YTD, 0, { status: [STATUS[0]] }, null).get("")!;
  assert.equal(fresh.companies, 2);
  assert.equal(fresh.already, 0);
  const mar = statsBy(d, { from: 2, to: 2 }, 0, {}, null).get("")!;
  assert.equal(mar.companies, 1);
  assert.equal(mar.accounts, 2);
  assert.deepEqual(mar.months, [1]);
});
