import assert from "node:assert/strict";
import { test } from "node:test";
import { REPORT_CATEGORIES, categoryBySlug, categoryEntry } from "../src/lib/reporting/categories";

test("the categories stand in SARCLA's order (16.10.2026), Customer Reports last", () => {
  assert.deepEqual(REPORT_CATEGORIES.map((c) => c.slug),
    ["marketing", "eso", "tsa", "back-office", "website", "otd", "satisfaction", "customers"]);
  assert.equal(categoryBySlug("marketing")?.name, "Digital Growth Reports");
});

test("a click on a category goes straight into its first report - the overview when it has one", () => {
  // Digital Growth: Marketing KPIs' own page, "In a nutshell" - not the category page
  assert.equal(categoryEntry(categoryBySlug("marketing")!), "/reporting/marketing-kpis");
  assert.equal(categoryEntry(categoryBySlug("eso")!), "/reporting/eso-benchmark/visits");
  assert.equal(categoryEntry(categoryBySlug("website")!), "/website/overview");
  // nothing in it yet: the category's own page, which names what comes first
  assert.equal(categoryEntry(categoryBySlug("tsa")!), "/reporting/tsa");
});

test("the first report the person may open, or the category page when none", () => {
  const website = categoryBySlug("website")!;
  assert.equal(categoryEntry(website, (href) => href !== "/website/overview"), "/website/acquisition");
  assert.equal(categoryEntry(website, () => false), "/reporting/website");
});

test("the Marketing KPIs row itself still opens on Who are our customers (SARCLA 13.10)", () => {
  const kpis = categoryBySlug("marketing")!.reports[0];
  assert.equal(kpis.href, "/reporting/marketing-kpis/customers");
  assert.equal(kpis.overviewHref, "/reporting/marketing-kpis");
});
