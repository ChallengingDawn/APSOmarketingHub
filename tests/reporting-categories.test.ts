import assert from "node:assert/strict";
import { test } from "node:test";
import { REPORT_CATEGORIES, categoryBySlug, categoryEntry } from "../src/lib/reporting/categories";

test("the categories stand in SARCLA's order (16.10.2026), then Customer and Products Reports; the Sales Leader View after Digital Growth (20.10.2026)", () => {
  assert.deepEqual(REPORT_CATEGORIES.map((c) => c.slug),
    ["marketing", "sales-leader", "eso", "tsa", "back-office", "website", "otd", "satisfaction", "customers", "products"]);
  assert.equal(categoryBySlug("marketing")?.name, "Digital Growth Reports");
  assert.equal(categoryEntry(categoryBySlug("sales-leader")!), "/reporting/sales-leader");
});

test("Digital Growth's side panel: the stages, then Other reports - Monthly inputs, SMEC targets, Use Cases Overview; no Sales leader view, no Efficiency (SARCLA 20-21.10.2026)", () => {
  const kids = categoryBySlug("marketing")!.reports[0].children!;
  assert.deepEqual(kids.filter((k) => k.group === "Other reports").map((k) => k.name), ["Monthly inputs", "SMEC targets", "Use Cases Overview"]);
  assert.equal(kids.find((k) => k.name === "Use Cases Overview")!.href, "/uc/lifecycle");
  assert.ok(!kids.some((k) => /sales leader|efficiency/i.test(k.name)));
  assert.equal(categoryBySlug("marketing")!.reports.length, 1);
});

test("a click on a category goes straight into its first report - the overview when it has one", () => {
  // Digital Growth: Marketing KPIs' own page, "In a nutshell" - not the category page
  assert.equal(categoryEntry(categoryBySlug("marketing")!), "/reporting/marketing-kpis");
  assert.equal(categoryEntry(categoryBySlug("eso")!), "/reporting/eso-benchmark/visits");
  assert.equal(categoryEntry(categoryBySlug("website")!), "/website/overview");
  // Articles CY/LY moved in from UC & HubSpot Apps, its address unchanged
  assert.equal(categoryEntry(categoryBySlug("products")!), "/uc/articles");
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
