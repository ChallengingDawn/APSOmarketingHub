import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isoDay, periodWindow, nextWorkingDay, shortPriority,
  isArticle, isProduct, isSpecialArticle, priceCheckQualifies, priceCheckShortfall, VALUE_FLOOR_ACTIVE, companyPasses,
} from "../src/lib/datatracker/rules";
import { sumRange } from "../src/lib/integrations/eshopActivity";
import { teamOf, ownerName } from "../src/lib/datatracker/rosters";
import { governingSize, rankAlternatives } from "../src/lib/datatracker/similar";

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

test("priceCheckQualifies with the 500 EUR floor ON: a floor, specials and off-focus skipped", () => {
  const on = { valueFloor: true };
  // two KT/DT catalogue articles worth 10'406 at list price -> a ticket
  const sati = priceCheckQualifies([
    { article: "1120072140", profitCentre: "DT", value: 9909.6 },
    { article: "0110150035", profitCentre: "KT", value: 496.7 },
  ], on);
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
  ], on);
  assert.equal(berset.qualifies, false, "specials are excluded, so this is below the floor");
  assert.equal(berset.counted, 0);
  assert.equal(berset.skipped, 5);

  // Apr: five DT articles but only 158 EUR -> below the floor, no ticket
  const apr = priceCheckQualifies(
    ["1141600190", "1120030008", "1141600194", "1120030142", "1141600198"]
      .map((a) => ({ article: a, profitCentre: "DT", value: 31.6 })),
    on,
  );
  assert.equal(apr.counted, 5);
  assert.equal(apr.qualifies, false, "three or more articles still has to clear 500 EUR");

  // an off-focus profit centre never counts
  const ft = priceCheckQualifies([{ article: "1120072140", profitCentre: "FT", value: 9000 }], on);
  assert.equal(ft.qualifies, false);
  assert.equal(ft.skipped, 1);
});

test("priceCheckQualifies while the floor is PAUSED (default): three KT/DT articles, no price needed", () => {
  assert.equal(VALUE_FLOOR_ACTIVE, false, "the floor stays paused until the ERP price unit is in P&P");
  // Sati's two articles: 9,910 EUR was 20 O-rings priced per 100 - not a ticket on value any more
  const sati = priceCheckQualifies([
    { article: "1120072140", profitCentre: "DT", value: 9909.6 },
    { article: "0110150035", profitCentre: "KT", value: 496.7 },
  ]);
  assert.equal(sati.qualifies, false);
  assert.equal(priceCheckShortfall(sati), "2 of 3 articles");
  // three KT/DT articles qualify whatever the (unknown-unit) value says
  const three = priceCheckQualifies(["1141600190", "1120030008", "0110150035"]
    .map((a) => ({ article: a, profitCentre: a.startsWith("011") ? "KT" : "DT", value: 1 })));
  assert.equal(three.qualifies, true);
  // specials still do not count towards the three
  const withSpecials = priceCheckQualifies([
    { article: "1120072140", profitCentre: "DT", value: null },
    { article: "8001227954", profitCentre: "KT", value: null },
    { article: "3000000001", profitCentre: "DT", value: null },
  ]);
  assert.equal(withSpecials.counted, 1);
  assert.equal(withSpecials.qualifies, false);
  assert.equal(priceCheckShortfall({ counted: 0, value: 0 }), "No KT/DT article");
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


// Routing is data, not a rule, but a wrong roster sends a ticket to somebody who
// never asked for it - and an owner on NEITHER roster must produce a visible
// skip rather than a plausible guess.
test("teamOf: an owner off both rosters gets no team, never a default", () => {
  assert.equal(teamOf("32968527"), "ESO");        // Yani Alioua
  assert.equal(teamOf("1202569408"), "TSA");      // TSA Team
  assert.equal(teamOf("99999999"), null);
  assert.equal(teamOf(""), null);
  assert.equal(teamOf(null), null);
});

test("ownerName falls back to the id rather than inventing a person", () => {
  assert.equal(ownerName("1229976033"), "Claudio Saraiva");
  assert.equal(ownerName("99999999"), "99999999");
});

// Offering a Ø 6 round bar against a Ø 45 is what made the alternatives list
// look like it had been picked at random.
test("governingSize reads the size a part is chosen by", () => {
  assert.equal(governingSize("POM-C round bar black Ø 45 +1.3/+0.3 mm -"), 45);
  assert.equal(governingSize("POM-C round bar natural (white) Ø 6 +0.6/+0.1 mm -"), 6);
  assert.equal(governingSize("UNIPRESS™ Industrial hose ID 6.3 x OD 14.3 mm -"), 6.3);
  assert.equal(governingSize("HITEC® O-ring FKM 75.16-04 ID 3.68 x 1.78 mm -"), 3.68);
  // No measurement at all - rankable only behind everything that has one.
  assert.equal(governingSize("BAND-IT® Scru-Seal lock M 211; stain. steel AISI 301; 10 pce -"), null);
  assert.equal(governingSize(null), null);
});

test("rankAlternatives drops the sizes nobody would accept", () => {
  const target = { description: "POM-C round bar black Ø 45 +1.3/+0.3 mm -" };
  const pool = [
    { description: "POM-C round bar natural (white) Ø 6 +0.6/+0.1 mm -", stock: 821 },
    { description: "POM-C round bar black Ø 40 +1.2/+0.2 mm -", stock: 10 },
    { description: "POM-C round bar black Ø 55 +1.3/+0.3 mm -", stock: 338 },
    { description: "POM-C round bar natural (white) Ø 40 +1.2/+0.2 mm -", stock: 392 },
  ];
  const out = rankAlternatives(target, pool);
  // Ø 6 is 87% away from Ø 45 and is gone, however much of it we hold.
  assert.equal(out.some((r) => r.description?.includes("Ø 6 ")), false);
  // Ø 40 is closest; of the two at Ø 40 the one in the right colour leads.
  assert.equal(out[0].description, "POM-C round bar black Ø 40 +1.2/+0.2 mm -");
  assert.equal(out.length, 3);
});

test("rankAlternatives keeps everything when the target has no readable size", () => {
  const out = rankAlternatives({ description: "BAND-IT® Scru-Seal lock M 211 -" },
    [{ description: "Anything at all", stock: 5 }]);
  assert.equal(out.length, 1);
});
