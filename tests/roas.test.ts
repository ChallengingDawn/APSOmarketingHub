import assert from "node:assert/strict";
import { test } from "node:test";
import { roasRows, type RoasMonths } from "../src/lib/marketingKpis/roas";

const data: RoasMonths = {
  "2025-09": { "Google search": [200000, 500, 8000], "Cross-network": [40000, 100, 9000], microsoft: [50000, 120, 5000], seo: [150000, 400, null] },
  "2026-08": { "Google search": [210000, 520, 7000], "Cross-network": [45000, 90, 6000], microsoft: [60000, 150, 4000], seo: [160000, 410, null] },
  "2026-09": { "Google search": [220000, 540, 8000], "Cross-network": [50000, 110, 6500], microsoft: [70000, 160, 5500], seo: [170000, 420, null] },
};

test("ROAS per channel: Google Ads over its networks, Microsoft, and SEO's revenue without a ROAS", () => {
  const rows = roasRows(data, 2026, [8]);
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  assert.deepEqual(rows.map((r) => r.key), ["google", "Google search", "Cross-network", "Google owned channels", "Search partners", "microsoft", "seo"]);
  assert.equal(by.google.revenue, 270000);
  assert.equal(by.google.cost, 14500);
  assert.equal(by.google.roas, 270000 / 14500);
  assert.equal(by.google.pyRoas, 240000 / 17000);
  assert.equal(by["Google search"].indent, true);
  assert.equal(by.microsoft.roas, 70000 / 5500);
  assert.equal(by.seo.revenue, 170000);
  assert.equal(by.seo.cost, null);
  assert.equal(by.seo.roas, null);
  assert.equal(by["Search partners"].roas, null);          // nothing spent, nothing to divide
});

test("over several months, against the same months a year earlier", () => {
  const by = Object.fromEntries(roasRows(data, 2026, [7, 8]).map((r) => [r.key, r]));
  assert.equal(by.microsoft.revenue, 130000);
  assert.equal(by.microsoft.cost, 9500);
  assert.equal(by.microsoft.pyRevenue, 50000);              // only September has a last year
});
