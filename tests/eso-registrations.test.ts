import assert from "node:assert/strict";
import { test } from "node:test";
import { REG_VISIT, addressOf, cutOf, daysBetween, hasDays, labelOf, median, spanOf, statsBy, visitOf, winOf, ymd, type RegData } from "../src/lib/reporting/registrationsRules";

// the read's day 29 Oct 2026; two owners and the "No owner" row; five companies:
// 0 registered 5 Mar 2026, visited the same day, its first shop order 20 Mar
// 1 registered 12 Apr 2026, visited 1 Feb before it, never ordered in the shop
// 2 registered 10 Oct 2025 (last year), first shop order 1 Nov 2025 - after last year's day (29 Oct 2025): not bought by then
// 3 registered 1 Jun 2026, never ordered in the shop, visited in July
// 4 in the shop since 2018: an account opened at it this year is one more, not a company registering
const d: RegData = {
  generatedAt: "2026-10-29T08:00:00Z", year: 2026, today: "2026-10-29",
  people: [{ id: "1", name: "Ana", team: "ESO" }, { id: "2", name: "Ben", team: "TSA" }, { id: "", name: "No owner", team: "Other" }],
  labels: { country: ["Switzerland", "Germany"], prio: ["Prio 1", "Prio 2", "Prio 3", "No priority"], category: ["APSOcore", "APSOgrowth", "APSOprospect", "Other"], type: ["OEM", "MRO"], apic: ["1.3 Machinery", "Not set"] },
  // person, reg, first shop order, first visit, country, prio, category, type, APIC
  companies: [
    [0, 20260305, 20260320, 20260305, 0, 0, 2, 0, 0],
    [0, 20260412, 0, 20260201, 1, 1, 2, 1, 1],
    [1, 20251010, 20251101, 0, 0, 2, 2, 0, 0],
    [1, 20260601, 0, 20260715, 1, 3, 0, 1, 1],
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
});

test("registrations: against the first visit, the labels", () => {
  assert.equal(visitOf(d.companies[0], 20261029), REG_VISIT[0]);
  assert.equal(visitOf(d.companies[1], 20261029), REG_VISIT[1]);
  assert.equal(visitOf(d.companies[3], 20261029), REG_VISIT[2]);
  // a visit after the side's day is not there yet
  assert.equal(visitOf(d.companies[3], 20260630), REG_VISIT[3]);
  assert.equal(visitOf(d.companies[2], 20261029), REG_VISIT[3]);
  assert.equal(labelOf(d, d.companies[3], "person"), "Ben");
  assert.equal(labelOf(d, d.companies[1], "country"), "Germany");
  assert.equal(labelOf(d, d.companies[0], "apic"), "1.3 Machinery");
  assert.equal(labelOf(d, d.companies[3], "visit"), REG_VISIT[2]);
});

test("registrations: the year to date against last year's, to the same day", () => {
  const cy = statsBy(d, YTD, 0, {}, null).get("")!;
  assert.equal(cy.companies, 3);
  assert.equal(cy.bought, 1);
  assert.deepEqual(cy.days, [15]);
  assert.deepEqual(cy.visit, { [REG_VISIT[0]]: 1, [REG_VISIT[1]]: 1, [REG_VISIT[2]]: 1 });
  // six accounts this year: a second at company 0 and one at company 4 (in the shop since 2018) are at companies already in it
  assert.equal(cy.accounts, 6);
  assert.equal(cy.more, 2);
  assert.deepEqual(cy.months, [0, 0, 1, 1, 0, 1, 0, 0, 0, 0]);
  const py = statsBy(d, YTD, 1, {}, null).get("")!;
  assert.equal(py.companies, 1);
  // its first shop order on 1 Nov 2025 - after last year's day, so not yet as far as the comparison goes
  assert.equal(py.bought, 0);
  assert.equal(py.accounts, 1);
  // a shop order dated before the account (it cannot be) never counts as bought since registering
  const odd: RegData = { ...d, companies: [[0, 20260305, 20260301, 0, 0, 0, 0, 0, 0]], accounts: [[0, 20260305]] };
  assert.equal(statsBy(odd, YTD, 0, {}, null).get("")!.bought, 0);
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
  const apic = statsBy(d, YTD, 0, {}, null, "apic");
  assert.equal(apic.get("1.3 Machinery")!.companies, 1);
  assert.equal(apic.get("Not set")!.companies, 2);
  const mar = statsBy(d, { from: 2, to: 2 }, 0, {}, null).get("")!;
  assert.equal(mar.companies, 1);
  assert.equal(mar.accounts, 2);
  assert.deepEqual(mar.months, [1]);
});

// SARCLA 31.10.2026: "really custom dates with a mini calendar" - a range of days, against the same days a year earlier
test("registrations: the period in the address - whole months as before, or days", () => {
  assert.deepEqual(winOf(d, "2026-03", "2026-05"), { from: 2, to: 4 });
  assert.deepEqual(winOf(d, "2026-05", "2026-03"), { from: 2, to: 4 });
  assert.deepEqual(winOf(d, "2026-03-05", "2026-05-17"), { from: 2, to: 4, d0: 20260305, d1: 20260517 });
  // either order; a month at one end, a day at the other
  assert.deepEqual(winOf(d, "2026-05-17", "2026-03-05"), { from: 2, to: 4, d0: 20260305, d1: 20260517 });
  assert.deepEqual(winOf(d, "2026-03-05", "2026-05"), { from: 2, to: 4, d0: 20260305 });
  // a day on a month's edge is the whole month; the read's day as the last is "to date" - 1 Jan to it the year to date
  assert.deepEqual(winOf(d, "2026-03-01", "2026-05-31"), { from: 2, to: 4 });
  assert.deepEqual(winOf(d, "2026-01-01", "2026-10-29"), { from: 0, to: 9 });
  assert.equal(hasDays(winOf(d, "2026-10-01", "2026-10-29")!), false);
  // nothing after the read's day: the last day the read's, a first after it the running month
  assert.deepEqual(winOf(d, "2026-09-15", "2026-12-24"), { from: 8, to: 9, d0: 20260915 });
  assert.deepEqual(winOf(d, "2026-11", "2026-12"), { from: 9, to: 9 });
  // not this year's, not a day, an end missing: none (the page shows the year to date)
  assert.equal(winOf(d, "2025-03-05", "2026-05-17"), null);
  assert.equal(winOf(d, "2026-02-30", "2026-05-17"), null);
  assert.equal(winOf(d, null, "2026-05"), null);
  // and back into the address
  assert.deepEqual(addressOf(d, { from: 2, to: 4 }), { from: "2026-03", to: "2026-05" });
  assert.deepEqual(addressOf(d, { from: 2, to: 4, d0: 20260305, d1: 20260517 }), { from: "2026-03-05", to: "2026-05-17" });
  assert.deepEqual(addressOf(d, { from: 2, to: 4, d0: 20260305 }), { from: "2026-03-05", to: "2026-05" });
});

test("registrations: a range of days against the same days a year earlier", () => {
  const w = winOf(d, "2026-03-06", "2026-04-12")!;
  assert.deepEqual(spanOf(d, w, 0), { from: 20260306, to: 20260412 });
  assert.deepEqual(spanOf(d, w, 1), { from: 20250306, to: 20250412 });
  const s = statsBy(d, w, 0, {}, null).get("")!;
  // company 0 registered on 5 Mar, the day before; company 1 on 12 Apr, the last day
  assert.equal(s.companies, 1);
  assert.deepEqual(s.months, [0, 1]);
  // the second account at company 0 (10 Mar) is one more; company 1's its first
  assert.equal(s.accounts, 2);
  assert.equal(s.more, 1);
  // last year's side takes the same days: company 2 registered on 10 Oct 2025 - in 1-10 Oct, not in 11 Oct to date
  const early = winOf(d, "2026-10-01", "2026-10-10")!, late = winOf(d, "2026-10-11", "2026-10-29")!;
  assert.deepEqual(early, { from: 9, to: 9, d1: 20261010 });
  assert.deepEqual(late, { from: 9, to: 9, d0: 20261011 });
  assert.equal(statsBy(d, early, 1, {}, null).get("")!.companies, 1);
  assert.equal(statsBy(d, late, 1, {}, null).get(""), undefined);
  assert.equal(statsBy(d, { from: 9, to: 9 }, 1, {}, null).get("")!.companies, 1);
  // whole months stay as they were: the running one to the same day on both sides
  assert.deepEqual(spanOf(d, late, 1), { from: 20251011, to: 20251029 });
  // 29 February has no day a year earlier: its 28th
  const leap: RegData = { ...d, year: 2028, today: "2028-10-29" };
  const feb = winOf(leap, "2028-02-29", "2028-03-10")!;
  assert.deepEqual(feb, { from: 1, to: 2, d0: 20280229, d1: 20280310 });
  assert.deepEqual(spanOf(leap, feb, 1), { from: 20270228, to: 20270310 });
});
