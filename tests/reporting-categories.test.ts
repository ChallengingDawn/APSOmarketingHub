import assert from "node:assert/strict";
import { test } from "node:test";
import { REPORT_CATEGORIES, categoryBySlug, categoryEntry } from "../src/lib/reporting/categories";

test("the categories stand in SARCLA's order (16.10.2026), then Customer and Products Reports; Sales Leader Reports and My Sales Reports at the bottom (01.11.2026)", () => {
  assert.deepEqual(REPORT_CATEGORIES.map((c) => c.slug),
    ["marketing", "eso", "tsa", "back-office", "website", "otd", "satisfaction", "customers", "products", "sales-leader", "my-sales"]);
  assert.equal(categoryBySlug("marketing")?.name, "Digital Growth Reports");
  // its team's targets first (SARCLA 02.11.2026: "the table for overall and for its team on the targets first page")
  assert.equal(categoryEntry(categoryBySlug("sales-leader")!), "/reporting/sales-leader/targets");
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
  // ESO, built as Digital Growth (SARCLA 21.10.2026): its BUC View first
  assert.equal(categoryEntry(categoryBySlug("eso")!), "/reporting/eso-benchmark");
  assert.equal(categoryEntry(categoryBySlug("website")!), "/website/overview");
  // Articles CY/LY moved in from UC & HubSpot Apps, its address unchanged - the first of Product KPIs' pages
  assert.equal(categoryEntry(categoryBySlug("products")!), "/uc/articles");
  // TSA, built as ESO (SARCLA 01.11.2026: "move BUC view with the same principle to TSA reports"): its BUC View first
  assert.equal(categoryEntry(categoryBySlug("tsa")!), "/reporting/tsa-benchmark");
  // the Back Office's KPI workbook live (SARCLA 02.11.2026): its BUC View first (03.11.2026), then a page per part
  const bo = categoryBySlug("back-office")!;
  assert.equal(categoryEntry(bo), "/reporting/back-office");
  assert.deepEqual(bo.reports[0].children!.map((r) => r.href.replace("/reporting/back-office/", "")), ["figures", "topics", "sales-tickets", "gqs", "otd", "autonomy", "stopped"]);
  // the workbook's blocks, in its order (SARCLA 03.11.2026: "rethink based on the excel file all the view")
  assert.deepEqual(bo.reports[0].children!.map((r) => r.name), ["Team totals", "Topics", "ESO & TSA tickets", "GQS", "OTD", "KPI autonomy", "Stopped orders"]);
  // nothing in it yet: the category's own page, which names what comes first
  assert.equal(categoryEntry(categoryBySlug("otd")!), "/reporting/otd");
});

test("TSA Reports as ESO's: its BUC View first, then its pages in ESO's order - Calls where ESO has Visits - at TSA's own addresses, not ESO's, so the side panel stays TSA's (SARCLA 01.11.2026: \"the order of apps on TSA is not the same as in ESO\")", () => {
  const tsa = categoryBySlug("tsa")!;
  assert.equal(tsa.reports.length, 1);
  assert.equal(tsa.reports[0].overview, "BUC View");
  assert.equal(tsa.reports[0].overviewHref, "/reporting/tsa-benchmark");
  assert.deepEqual(tsa.reports[0].children!.map((r) => [r.name, r.href]), [
    ["Figures", "/reporting/tsa-benchmark/figures"],
    ["Calls", "/reporting/tsa-benchmark/calls"],
    ["Registrations", "/reporting/tsa-benchmark/registrations"],
    ["Shop behaviour", "/reporting/tsa-benchmark/shop"],
    ["New customers", "/reporting/tsa-benchmark/new-customers"],
    ["Customer development", "/reporting/tsa-benchmark/customers"],
    ["Incoming tickets", "/reporting/tsa-benchmark/tickets"],
    ["System tickets", "/reporting/tsa-benchmark/system-tickets"],
  ]);
  // the same order as ESO's, Calls standing for Visits
  const eso = categoryBySlug("eso")!.reports[0].children!;
  assert.deepEqual(tsa.reports[0].children!.map((r) => (r.name === "Calls" ? "Visits" : r.name)), eso.map((r) => r.name));
  assert.equal(tsa.next, undefined);
  assert.ok(!eso.some((k) => k.href.startsWith("/reporting/tsa-benchmark/")));
});

test("ESO's side panel as Digital Growth's: one report, BUC View first, then the sub-apps in SARCLA's order - the tickets as two, incoming and system, no Revenue & order intake (SARCLA 21-24.10, 30-31.10.2026)", () => {
  const eso = categoryBySlug("eso")!;
  assert.equal(eso.reports.length, 1);
  assert.equal(eso.reports[0].overview, "BUC View");
  assert.deepEqual(eso.reports[0].children!.map((k) => k.name), ["Figures", "Visits", "Registrations", "Shop behaviour", "New customers", "Customer development", "Incoming tickets", "System tickets"]);
  assert.ok(eso.reports[0].children!.every((k) => k.href.startsWith("/reporting/eso-benchmark/")));
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

test("Customer Reports: one report, Customer KPIs - Customer base its own page, the four KPI pages beneath it, the four reports of before under Other reports at their old addresses (SARCLA 01.11.2026)", () => {
  const cust = categoryBySlug("customers")!;
  assert.equal(cust.reports.length, 1);
  const r = cust.reports[0];
  assert.equal(r.name, "Customer KPIs");
  assert.equal(r.overview, "Customer base");
  assert.equal(r.overviewHref, "/reporting/customers/base");
  assert.equal(categoryEntry(cust), "/reporting/customers/base");
  assert.deepEqual(r.children!.filter((k) => !k.group).map((k) => [k.name, k.href]), [
    ["Revenue concentration", "/reporting/customers/concentration"],
    ["Cross-selling", "/reporting/customers/cross-selling"],
    ["Recency & risk", "/reporting/customers/recency"],
    ["Retention", "/reporting/customers/retention"],
  ]);
  assert.deepEqual(r.children!.filter((k) => k.group === "Other reports").map((k) => [k.name, k.href]), [
    ["KPIs", "/journey/kpis"], ["New customers", "/analytics/new-customers"], ["Buying companies", "/analytics/buyers"], ["Contact requests", "/analytics/contact-requests"],
  ]);
});

test("Products Reports: one report, Product KPIs - Articles CY/LY first, then a page each for what customers looked for and did not get (SARCLA 01.11.2026: \"we should really create subtabs\", \"all by sub app\")", () => {
  const products = categoryBySlug("products")!;
  assert.equal(products.reports.length, 1);
  assert.equal(products.reports[0].overview, "Articles CY/LY");
  assert.equal(products.reports[0].overviewHref, "/uc/articles");
  assert.deepEqual(products.reports[0].children!.map((r) => [r.name, r.href]), [
    ["Availability", "/reporting/products/availability"],
    ["Price checks", "/reporting/products/price-checks"],
    ["Minimum order", "/reporting/products/minimum-order"],
    ["Views against orders", "/reporting/products/views"],
    ["Search", "/reporting/products/search"],
  ]);
});

test("Sales Leader Reports: Targets, Team, then ESO's pages as My Sales Reports has them - no tagged-KPI view (SARCLA 02.11.2026)", () => {
  const r = categoryBySlug("sales-leader")!.reports[0];
  const mine = categoryBySlug("my-sales")!.reports[0].children!.map((k) => k.name);
  assert.equal(r.overview, "Targets");
  assert.deepEqual(r.children!.map((k) => k.name), ["Team", ...mine]);
  assert.ok(r.children!.every((k) => k.href.startsWith("/reporting/sales-leader/") && !k.group));
});
