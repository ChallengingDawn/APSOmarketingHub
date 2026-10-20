import assert from "node:assert/strict";
import { test } from "node:test";
import { bothPlatforms, funnelRates, toChf } from "../src/lib/marketingKpis/sheetFill";
import { parseMsAdsSheet } from "../src/lib/marketingKpis/msAdsSheet";

test("cart and check-out abandonment from GA4's check-out steps, per month", () => {
  const r = funnelRates([
    { ym: "202609", event: "add_to_cart", sessions: 1000 },
    { ym: "202609", event: "begin_checkout", sessions: 700 },
    { ym: "202609", event: "purchase", sessions: 665 },
    { ym: "202509", event: "add_to_cart", sessions: 800 },
    { ym: "202509", event: "begin_checkout", sessions: 600 },
    { ym: "202509", event: "purchase", sessions: 570 },
    { ym: "202610", event: "purchase", sessions: 5 }, // no cart this month yet: no rate, never a division by 0
  ], 2026);
  assert.equal(r.K02G.months[8], 0.3);   // 300 of 1,000 carts never began the check-out
  assert.equal(r.K03G.months[8], 0.05);  // 35 of 700 check-outs never bought
  assert.equal(r.K02G.py[8], 0.25);
  assert.equal(r.K02G.months[9], null);
  assert.equal(r.K03G.months[9], null);
});

test("SEA cost and revenue: Google and Microsoft in francs, a month only when both platforms have it", () => {
  const fx = { "2026-09": 0.94 };
  assert.equal(toChf(100, "CHF", "2026-09", fx), 100);
  assert.equal(toChf(100, "EUR", "2026-09", fx), 94);
  assert.equal(toChf(100, "USD", "2026-09", fx), null);
  const both = bothPlatforms({ "2026-08": 15000, "2026-09": 16000 }, { "2026-09": 4000 }, 2026);
  assert.equal(both.months[8], 20000);
  assert.equal(both.months[7], null); // Microsoft missing in August: no half figure
});

test("the scripts' sheet with the conversions and their value - and without them, as before", () => {
  const s = parseMsAdsSheet([
    ["month", "impressions", "clicks", "cost", "currency", "campaigns", "account", "through", "written", "conversions", "revenue"],
    ["2026-09", 150000, 3600, 5100.25, "CHF", 6, "APSOparts AG", "2026-10-17", "2026-10-18T06:00:05.000Z", 41, 52000.5],
  ]);
  assert.deepEqual(s.months["2026-09"], { impressions: 150000, clicks: 3600, cost: 5100.25, conversions: 41, revenue: 52000.5 });
  const g = parseMsAdsSheet([
    ["month", "impressions", "clicks", "cost", "currency", "conversions", "revenue", "account", "through", "written"],
    ["2026-09", 300000, 9000, 15000, "EUR", 300, 410000, "APSOparts", "2026-10-19", "2026-10-20T06:00:00.000Z"],
  ]);
  assert.equal(g.months["2026-09"].revenue, 410000);
  assert.equal(g.currency, "EUR");
});
