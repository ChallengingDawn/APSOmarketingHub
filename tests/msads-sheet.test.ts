import assert from "node:assert/strict";
import { test } from "node:test";
import { msAdsSeries, msAdsStale, parseMsAdsSheet } from "../src/lib/marketingKpis/msAdsSheet";

const values = [
  ["month", "impressions", "clicks", "cost", "currency", "campaigns", "account", "through", "written"],
  ["2025-09", 120000, 3100, 4200.5, "CHF", 6, "APSOparts AG", "2026-10-17", "2026-10-18T06:00:05.000Z"],
  ["2026-09", "150,000", "3,600", "5,100.25", "CHF", 6, "APSOparts AG", "2026-10-17", "2026-10-18T06:00:05.000Z"],
  ["2026-10", 80000, 1900, 2600, "CHF", 6, "APSOparts AG", "2026-10-17", "2026-10-18T06:00:05.000Z"],
  ["", "", "", "", "", "", "", "", ""],
];

test("the script's sheet: months, currency, how far it counted and when it wrote", () => {
  const s = parseMsAdsSheet(values);
  assert.deepEqual(Object.keys(s.months), ["2025-09", "2026-09", "2026-10"]);
  assert.deepEqual(s.months["2026-09"], { impressions: 150000, clicks: 3600, cost: 5100.25 });
  assert.equal(s.currency, "CHF");
  assert.equal(s.through, "2026-10-17");
  assert.equal(parseMsAdsSheet([]).currency, null);
  const partial = parseMsAdsSheet([values[0], ["2026-09", 1, 1, 1, "CHF (others left out of cost)", 1, "a", "2026-10-17", "x"]]);
  assert.equal(partial.currency, "CHF");
  assert.equal(partial.costPartial, true);
  assert.equal(parseMsAdsSheet(values).costPartial, false);
  // Sheets hands dates back as serial numbers: 46312 is 17 Oct 2026
  const serial = parseMsAdsSheet([values[0], ["2026-09", 1, 1, 1, "CHF", 1, "a", 46312, 46313.25]]);
  assert.equal(serial.through, "2026-10-17");
  assert.equal(serial.written, "2026-10-18T06:00:00.000Z");
  assert.deepEqual(parseMsAdsSheet([["nothing"], ["2026-01"]]).months, {});
});

test("impressions, clicks and cost per month, the cost in euros at the month's rate", () => {
  const s = msAdsSeries(parseMsAdsSheet(values), 2026, (chf) => chf / 0.94);
  assert.equal(s.R01M.months[8], 150000);
  assert.equal(s.R02M.py[8], 3100);
  assert.equal(Math.round(s.X01M.months[9]!), Math.round(2600 / 0.94));
  assert.equal(s.R01M.months[0], null);
  assert.equal(msAdsSeries(parseMsAdsSheet(values), 2026).X01M.months[8], 5100.25);   // no rate: as the sheet has it
});

test("a script that stopped writing is noticed after three days", () => {
  const s = parseMsAdsSheet(values);
  assert.equal(msAdsStale(s, new Date("2026-10-19T08:00:00Z")), false);
  assert.equal(msAdsStale(s, new Date("2026-10-22T08:00:00Z")), true);
  assert.equal(msAdsStale({ ...s, written: null }, new Date()), true);
});

import { msAdsKindMonths } from "../src/lib/marketingKpis/msAdsSheet";

test("the campaign types beside each month's total, and their costs in euros", () => {
  const s = parseMsAdsSheet([
    values[0],
    ["2026-09", 389509, 8140, 5581.66, "CHF", 23, "APSOparts AG", 46312, "2026-10-18T15:30:19.481Z"],
    ["2026-09|Performance Max", 300000, 2000, 2000, "CHF", 1, "APSOparts AG", 46312, "2026-10-18T15:30:19.481Z"],
    ["2026-09|Search", 89509, 6140, 3581.66, "CHF", 22, "APSOparts AG", 46312, "2026-10-18T15:30:19.481Z"],
  ]);
  assert.equal(s.months["2026-09"].impressions, 389509);              // the total stays the total
  assert.deepEqual(Object.keys(s.kinds["2026-09"]), ["Performance Max", "Search"]);
  const k = msAdsKindMonths(s, (chf) => chf / 0.94);
  assert.deepEqual(k["2026-09"]["Search"].slice(0, 2), [89509, 6140]);
  assert.equal(Math.round(k["2026-09"]["Performance Max"][2]!), Math.round(2000 / 0.94));
  assert.equal(msAdsKindMonths(s, undefined, false)["2026-09"]["Search"][2], null);   // a cost not shown in euros
});
