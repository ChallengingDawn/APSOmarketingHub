import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isoDay, periodWindow, nextWorkingDay, shortPriority,
  isArticle, isProduct, isSpecialArticle, priceCheckQualifies, companyPasses,
} from "../src/lib/datatracker/rules";
import { sumRange } from "../src/lib/integrations/eshopActivity";

test("isoDay uses the LOCAL day, not UTC", () => {
  // 00:30 local on the 2nd. toISOString() would say the 1st in any zone east of
  // UTC, which is how "Today" quietly became yesterday.
  const d = new Date(2026, 9, 2, 0, 30, 0);
  assert.equal(isoDay(d), "2026-10-02");
  assert.equal(isoDay(new Date(2026, 0, 1)), "2026-01-01");
  assert.equal(isoDay(new Date(2026, 11, 31)), "2026-12-31");
});

test("periodWindow: a full year moves BOTH halves of the row", () => {
  const now = new Date(2026, 9, 2, 12, 0, 0);
  // the bug: "y2026" fell through to the 30-day default
  assert.deepEqual(periodWindow("y2026", "", "", now), { from: "2026-01-01", to: "2026-10-02" });
  // a past year runs to its own 31 December, never to today
  assert.deepEqual(periodWindow("y2025", "", "", now), { from: "2025-01-01", to: "2025-12-31" });
});

test("periodWindow: ranges, custom and an unknown id", () => {
  const now = new Date(2026, 9, 2, 12, 0, 0);
  assert.deepEqual(periodWindow("today", "", "", now), { from: "2026-10-02", to: "2026-10-02" });
  assert.deepEqual(periodWindow("7d", "", "", now), { from: "2026-09-26", to: "2026-10-02" });
  assert.deepEqual(periodWindow("30d", "", "", now), { from: "2026-09-03", to: "2026-10-02" });
  assert.deepEqual(periodWindow("custom", "2026-05-01", "2026-05-31", now),
    { from: "2026-05-01", to: "2026-05-31" });
  // an id nobody defined must not produce a window of NaN
  assert.deepEqual(periodWindow("nonsense", "", "", now), { from: "2026-09-03", to: "2026-10-02" });
});

test("nextWorkingDay skips the weekend", () => {
  assert.equal(nextWorkingDay("2026-10-01"), "2026-10-02"); // Thu -> Fri
  assert.equal(nextWorkingDay("2026-10-02"), "2026-10-05"); // Fri -> Mon, not Sat
  assert.equal(nextWorkingDay("2026-10-03"), "2026-10-05"); // Sat -> Mon
  assert.equal(nextWorkingDay("2026-10-04"), "2026-10-05"); // Sun -> Mon
  assert.equal(nextWorkingDay("2026-10-05"), "2026-10-06"); // Mon -> Tue
  assert.equal(nextWorkingDay("not a date"), "not a date");
});

test("shortPriority turns a sentence into a label", () => {
  assert.equal(shortPriority("2-Prio 2 - Pot btw 2500 & 24999€"), "Prio 2");
  assert.equal(shortPriority("1-Prio 1 - Pot >25000€"), "Prio 1");
  // Tier 4 of the same ranked set, labelled like the other three.
  assert.equal(shortPriority("4- No priority for sales, Pot. <500€"), "Prio 4");
  assert.equal(shortPriority(null), "—");
});

test("article is ten digits, product is eight, 3xxx/8xxx are specials", () => {
  assert.ok(isArticle("0232001116"));
  assert.ok(!isArticle("02320011"));      // the bug: this is a PRODUCT page
  assert.ok(isProduct("02320011"));
  assert.ok(!isProduct("0232001116"));
  assert.ok(isSpecialArticle("8001227954"));
  assert.ok(isSpecialArticle("3001227954"));
  assert.ok(!isSpecialArticle("1120072140"));
});

test("priceCheckQualifies: 500 EUR is a floor, specials and off-focus are skipped", () => {
  // Sati: two KT/DT catalogue articles worth 10'406 -> a ticket
  const sati = priceCheckQualifies([
    { article: "1120072140", profitCentre: "DT", value: 9909.6 },
    { article: "0110150035", profitCentre: "KT", value: 496.7 },
  ]);
  assert.equal(sati.qualifies, true);
  assert.equal(sati.counted, 2);
  assert.equal(sati.skipped, 0);

  // Berset: four 8xxx specials plus one KT at 208 -> NO ticket
  const berset = priceCheckQualifies([
    { article: "8001227954", profitCentre: "KT", value: 207.75 },
    { article: "8000959148", profitCentre: null, value: null },
    { article: "8001263296", profitCentre: null, value: null },
    { article: "8001262716", profitCentre: null, value: null },
    { article: "8001262721", profitCentre: null, value: null },
  ]);
  assert.equal(berset.qualifies, false, "specials are excluded, so this is below the floor");
  assert.equal(berset.counted, 0);
  assert.equal(berset.skipped, 5);

  // Apr: five DT articles but only 158 EUR -> below the floor, no ticket
  const apr = priceCheckQualifies(
    ["1141600190", "1120030008", "1141600194", "1120030142", "1141600198"]
      .map((a) => ({ article: a, profitCentre: "DT", value: 31.6 })),
  );
  assert.equal(apr.counted, 5);
  assert.equal(apr.qualifies, false, "three or more articles still has to clear 500 EUR");

  // an off-focus profit centre never counts
  const ft = priceCheckQualifies([{ article: "1120072140", profitCentre: "FT", value: 9000 }]);
  assert.equal(ft.qualifies, false);
  assert.equal(ft.skipped, 1);
});

test("sumRange totals only the days inside the window", () => {
  const raw = JSON.stringify({
    days: {
      "2026-09-30": { v: 1, l: 3 },
      "2026-10-01": { v: 2, l: 1 },
      "2026-10-02": { v: 5, l: 2 },
    },
  });
  assert.deepEqual(sumRange(raw, "2026-10-02", "2026-10-02"), { views: 5, logins: 2, days: 1 });
  assert.deepEqual(sumRange(raw, "2026-10-01", "2026-10-02"), { views: 7, logins: 3, days: 2 });
  assert.deepEqual(sumRange(raw, "2026-09-01", "2026-12-31"), { views: 8, logins: 6, days: 3 });
  // a window with nothing in it is NOT zero - it is "we have no reading"
  assert.deepEqual(sumRange(raw, "2026-08-01", "2026-08-31"), { views: null, logins: null, days: 0 });
});

test("sumRange survives junk instead of throwing the screen away", () => {
  assert.deepEqual(sumRange("not json", "2026-10-01", "2026-10-02"), { views: null, logins: null, days: 0 });
  assert.deepEqual(sumRange(null, "2026-10-01", "2026-10-02"), { views: null, logins: null, days: 0 });
  assert.deepEqual(sumRange(JSON.stringify({ days: null }), "2026-10-01", "2026-10-02"),
    { views: null, logins: null, days: 0 });
  // a day present but with no counters must read 0, not NaN
  assert.deepEqual(sumRange(JSON.stringify({ days: { "2026-10-02": {} } }), "2026-10-02", "2026-10-02"),
    { views: 0, logins: 0, days: 1 });
});

// A customer who ordered without browsing arrives from the orders read, which
// HubSpot never filtered. These are the cases that put an M110 row at the top
// of a table filtered to M100.
test("companyPasses: no filter set lets everything through", () => {
  assert.equal(companyPasses({ mandant: "M110" }, {}), true);
  assert.equal(companyPasses({}, {}), true);
});

test("companyPasses: mandant excludes the other mandant", () => {
  assert.equal(companyPasses({ mandant: "M100" }, { mandant: "M100" }), true);
  assert.equal(companyPasses({ mandant: "M110" }, { mandant: "M100" }), false);
});

test("companyPasses: a missing value is excluded, as an EQ condition excludes it", () => {
  assert.equal(companyPasses({ mandant: null }, { mandant: "M100" }), false);
  assert.equal(companyPasses({}, { country: "Switzerland" }), false);
});

test("companyPasses: representative compares the owner id, never the name", () => {
  assert.equal(companyPasses({ ownerId: "77777" }, { representative: "77777" }), true);
  // The resolved name must not satisfy it - that is the shape of the bug.
  assert.equal(companyPasses({ ownerId: "Raffaello Lon" }, { representative: "77777" }), false);
});

test("companyPasses: every filter must hold, not just one", () => {
  const c = { mandant: "M100", country: "Switzerland", apsoCustomer: "APSOgrowth", salesPriority: "Prio 2", ownerId: "77777" };
  assert.equal(companyPasses(c, { mandant: "M100", country: "Switzerland" }), true);
  assert.equal(companyPasses(c, { mandant: "M100", country: "Italy" }), false);
  assert.equal(companyPasses(c, { mandant: "M100", priority: "Prio 1" }), false);
  assert.equal(companyPasses(c, { mandant: "M100", apsoCustomer: "APSOgrowth", priority: "Prio 2", representative: "77777" }), true);
});

