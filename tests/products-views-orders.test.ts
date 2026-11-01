import assert from "node:assert/strict";
import { test } from "node:test";
import { clampWin, placesOf, productPage, productsOf, rateOf, summaryOf, vFiltersOf, NONE, NO_PC } from "../src/lib/products/viewsOrders";
import type { EngageData } from "../src/lib/marketingKpis/engageCube";

// SARCLA 01.11.2026 on Products Reports: "we should really create subtabs" - his pick "Views against orders": the product pages
// viewed against the articles bought online, by profit centre, product hierarchy and product, month by month.

const m24 = (cells: Record<number, number>) => Array.from({ length: 24 }, (_, i) => cells[i] ?? 0);
// index 0..11 = last year's January to December, 12..23 = this year's; the read is of 1 Nov 2026: Jan-Oct are whole
const D: Pick<EngageData, "generatedAt" | "year" | "monthsDone" | "products" | "lists" | "madeToOrder" | "unmapped"> = {
  generatedAt: "2026-11-01T06:00:00Z", year: 2026, monthsDone: 10,
  products: {
    // viewed both years, bought this September only
    "11400511": { n: "O-Ring NBR", pc: "DT", v: m24({ 8: 300, 20: 900, 21: 100 }), b: m24({ 20: 3 }) },
    // viewed this year, never bought
    "11411201": { n: "O-Ring FKM", pc: "DT", v: m24({ 20: 100 }) },
    // viewed and bought last year and this year
    "02320011": { n: "POM rod", pc: "KT", v: m24({ 8: 50, 20: 400 }), b: m24({ 8: 1, 20: 2 }) },
    // not in Products & Pricing
    "99999999": { n: "", pc: null, v: m24({ 20: 10 }) },
    // bought this year, its page not viewed in the months chosen
    "02320099": { n: "PEEK plate", pc: "KT", v: m24({ 2: 5 }), b: m24({ 19: 1 }) },
  },
  lists: { DT: m24({ 8: 1000, 20: 2000 }), KT: m24({ 20: 50 }), search: m24({ 20: 500 }), other: m24({ 20: 7 }) },
  madeToOrder: m24({ 8: 3, 20: 7 }),
  unmapped: 4,
};
// Articles CY/LY's rows: the hierarchy of the products ordered (any channel) since January last year
const PLACES = placesOf([
  { product: "11400511", group: "O-rings", sub: "NBR", productName: "O-Ring NBR 70" },
  { product: "11400511", group: "", sub: "", productName: "" },
  { product: "11411201", group: "O-rings", sub: "FKM", productName: "" },
  { product: "02320011", group: "Plastics rods", sub: "POM", productName: "POM-C rod" },
  { product: "", group: "Nothing", sub: "x" },
]);
const SEP = { start: 8, end: 8 };

test("each product's place: the article that names a main group wins; an article without a product is not a place", () => {
  assert.deepEqual(PLACES["11400511"], { group: "O-rings", sub: "NBR", name: "O-Ring NBR 70" });
  assert.equal(PLACES["11411201"].group, "O-rings");
  assert.equal(Object.keys(PLACES).length, 3);
});

test("the window: this year's whole months - the year so far when none or one past them is given", () => {
  assert.deepEqual(clampWin(10), { start: 0, end: 9 });
  assert.deepEqual(clampWin(10, { start: 8, end: 11 }), { start: 8, end: 9 });
  assert.deepEqual(clampWin(10, { start: 5 }), { start: 5, end: 9 });
  assert.deepEqual(clampWin(0), { start: 0, end: 0 });
});

test("the figures: product page views, products viewed, bought online or not - against the same months a year earlier", () => {
  const s = summaryOf(D, PLACES, {}, SEP);
  assert.deepEqual(s.win, SEP);
  const f = s.figures;
  assert.equal(f.views, 900 + 100 + 400 + 10);
  assert.equal(f.viewsPy, 300 + 50);
  assert.equal(f.products, 4);
  assert.equal(f.bought, 2);                       // the NBR O-ring and the POM rod
  assert.equal(f.notBought, 2);
  assert.equal(f.boughtPy, 1);                     // last September: the POM rod
  assert.equal(f.notBoughtPy, 1);
  assert.equal(f.articles, 5);                     // 3 + 2 - the PEEK plate bought in August is outside the window
  assert.equal(f.articlesPy, 1);
  assert.equal(rateOf(f.bought, f.products), 0.5);
  assert.equal(rateOf(0, 0), null);
  // made to order and the views on the search results are apart
  assert.equal(s.madeToOrder, 7);
  assert.equal(s.madeToOrderPy, 3);
  assert.deepEqual(s.apart, { search: 500, searchPy: 0, other: 7, otherPy: 0 });
});

test("by profit centre: the products' views and the category lists; a product not in Products & Pricing on its own row", () => {
  const s = summaryOf(D, PLACES, {}, SEP);
  const dt = s.by.pc.find((r) => r.key === "DT")!;
  assert.equal(dt.views, 1000);
  assert.equal(dt.products, 2);
  assert.equal(dt.bought, 1);
  assert.equal(dt.lists, 2000);
  assert.equal(dt.listsPy, 1000);
  assert.ok(s.by.pc.some((r) => r.key === NO_PC && r.views === 10));
  // no category list for a product Products & Pricing does not know: its cell stays empty, not 0
  assert.equal(s.by.pc.find((r) => r.key === NO_PC)!.lists, undefined);
  // the search results and other pages are no profit centre
  assert.ok(!s.by.pc.some((r) => r.key === "search" || r.key === "other"));
  // a lower level chosen: the lists cannot follow it, so they are not given
  const g = summaryOf(D, PLACES, { group: ["O-rings"] }, SEP);
  assert.ok(g.by.pc.every((r) => r.lists === undefined));
  assert.equal(g.figures.views, 1000);
});

test("the hierarchy: a level's own filter left out of its chart; a product with no main group known", () => {
  const s = summaryOf(D, PLACES, { group: ["O-rings"] }, SEP);
  assert.deepEqual(s.by.group.map((r) => r.key).sort(), ["-", "O-rings", "Plastics rods"].sort());
  assert.equal(s.by.sub.length, 2);                // NBR and FKM under O-rings
  assert.ok(summaryOf(D, PLACES, {}, SEP).by.group.some((r) => r.key === NONE && r.views === 10));
});

test("bought online or not: each side on its own terms; the lists of the most viewed", () => {
  const not = summaryOf(D, PLACES, { sold: "not" }, SEP);
  assert.equal(not.figures.products, 2);
  assert.equal(not.figures.views, 110);
  assert.equal(not.figures.articles, 0);
  assert.equal(not.figures.productsPy, 1);         // last September: the NBR O-ring, viewed and not bought then
  assert.deepEqual(not.top.notBought.map((p) => p.id), ["11411201", "99999999"]);
  assert.equal(not.top.bought.length, 0);
  const all = summaryOf(D, PLACES, {}, SEP);
  assert.deepEqual(all.top.bought.map((p) => p.id), ["11400511", "02320011"]);
});

test("month by month: each month's products viewed and of them those bought that month", () => {
  const s = summaryOf(D, PLACES, {}, { start: 8, end: 9 });
  assert.equal(s.months.length, 2);
  assert.equal(s.months[0].bought, 2);
  assert.equal(s.months[1].views, 100);
  assert.equal(s.months[1].bought, 0);             // October: the NBR O-ring viewed, nothing bought
});

test("every product viewed: filtered, searched, sorted, a page at a time", () => {
  const ps = productsOf(D, PLACES, SEP);
  const p = productPage(ps, {}, { size: 2 });
  assert.equal(p.total, 4);
  assert.deepEqual(p.rows.map((r) => r.id), ["11400511", "02320011"]);
  assert.equal(productPage(ps, {}, { size: 2, page: 1 }).rows.length, 2);
  assert.deepEqual(productPage(ps, {}, { q: "fkm" }).rows.map((r) => r.id), ["11411201"]);
  assert.deepEqual(productPage(ps, { pc: ["KT"] }).rows.map((r) => r.id), ["02320011"]);
  assert.deepEqual(productPage(ps, { sold: "not" }, { sort: "views", desc: false }).rows.map((r) => r.id), ["99999999", "11411201"]);
  assert.equal(productPage(ps, {}, { sort: "name", size: 1 }).rows[0].id, "99999999");      // no name: by its number, first
  assert.equal(productPage(ps, {}, { page: 99, size: 3 }).page, 1);
});

test("the filters out of an address: known levels, each value once, the sold choice", () => {
  const q = new URLSearchParams("pc=DT&pc=DT&group=O-rings&sold=not&bogus=1");
  assert.deepEqual(vFiltersOf((d) => q.getAll(d)), { pc: ["DT"], group: ["O-rings"], sold: "not" });
  assert.deepEqual(vFiltersOf((d) => (d === "sold" ? "maybe" : [])), {});
});
