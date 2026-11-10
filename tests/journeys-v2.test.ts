import assert from "node:assert/strict";
import { test } from "node:test";
import {
  JKINDS, MAX_STEPS, SHOP_PATH, STEP_KINDS, STORE_VIEWS, buildChain, buildStepGraph, chainFunnel, collapseRuns, completeJourneys,
  dropPages, funnelOf, ga4StepExpr, isDevice, isShopPath, journeyKind, journeysOf, kindFlow, kindMatches, landingRows, leavesByKind,
  pagePathPattern, parseStep, parseSteps, periodBefore, readFunnelTable, stepName, stepToken, storeChoices, transitionsOf,
  type JKind, type StepRow,
} from "../src/lib/journeys/model";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const W = "https://www.apsoparts.com";

test("STORE_VIEWS and storeChoices: the shop's 14 store views always offered, the others only with visits", () => {
  assert.equal(STORE_VIEWS.length, 14);
  for (const s of ["de-CH", "de-DE", "de-AT", "de-INT", "fr-CH", "fr-FR", "fr-INT", "it-CH", "it-IT", "it-INT", "en-INT", "nl-NL", "nl-INT", "pl-PL"]) assert.ok(STORE_VIEWS.includes(s), s);
  assert.ok(!STORE_VIEWS.includes("en-CH"));
  const c = storeChoices([{ key: "de-CH", sessions: 900 }, { key: "en-CH", sessions: 12 }, { key: "en-DE", sessions: 0 }, { key: "de-CH", sessions: 100 }]);
  assert.equal(c.length, 15);
  assert.deepEqual(c[0], { key: "de-CH", sessions: 1000, listed: true });
  assert.deepEqual(c.find((x) => x.key === "pl-PL"), { key: "pl-PL", sessions: 0, listed: true });
  assert.deepEqual(c[14], { key: "en-CH", sessions: 12, listed: false });
  assert.ok(!c.some((x) => x.key === "en-DE"));
  assert.ok(isDevice("mobile") && isDevice("desktop") && !isDevice("phone"));
});

test("periodBefore: the same number of days, just before", () => {
  assert.deepEqual(periodBefore("2026-10-13", "2026-11-09"), { from: "2026-09-15", to: "2026-10-12" });
  assert.deepEqual(periodBefore("2026-11-09", "2026-11-09"), { from: "2026-11-08", to: "2026-11-08" });
  assert.deepEqual(periodBefore("2026-03-01", "2026-03-31"), { from: "2026-01-29", to: "2026-02-28" });
});

test("parseSteps, stepToken, stepName: the steps an address keeps, checked", () => {
  const shop = parseSteps([]);
  assert.equal(shop.map(stepToken).join(","), SHOP_PATH.join(","));
  assert.ok(isShopPath(shop));
  assert.deepEqual(shop.map(stepName), ["Way in", "Category or search", "Product", "Cart", "Check-out", "Order placed"]);
  assert.deepEqual(parseStep("search.category"), { type: "kinds", kinds: ["category", "search"] });
  assert.deepEqual(parseStep("page:/de-CH/x.html?p=2"), { type: "page", path: "/de-CH/x.html" });
  assert.equal(parseStep("page://evil.com/x"), null);
  assert.equal(parseStep("other"), null);
  assert.equal(parseStep("product.nothing"), null);
  // the way in only first, no step twice in a row, unknown ones dropped, six at most
  const s = parseSteps(["product", "in", "product", "cart", "bogus", "checkout", "order", "home", "search", "cms"]);
  assert.deepEqual(s.map(stepToken), ["product", "cart", "checkout", "order", "home", "search"]);
  assert.equal(s.length, MAX_STEPS);
  // fewer than two: the shop's path
  assert.ok(isShopPath(parseSteps(["product"])));
  assert.equal(stepName({ type: "page", path: "/de-CH/12202510-apsovibr-maschinenfuss-nivobloc.html" }), "Apsovibr maschinenfuss nivobloc");
  assert.equal(stepName({ type: "kinds", kinds: ["home", "category", "search"] }), "Home page, Category or search");
  assert.ok(!STEP_KINDS.includes("other"));
});

test("KIND_PATTERNS: Google Analytics' filters say the same kind as journeyKind", () => {
  const paths = [
    "/", "/de-CH", "/de-CH/", "/de-CH/eur/", "/de-CH/dichtungstechnik.html", "/de-CH/dichtungstechnik/o-ringe-x-ringe.html",
    "/de-CH/eur/antriebstechnik.html", "/de-CH/catalog/category/view/id/7939", "/de-CH/12202510-apsovibr-maschinenfuss-nivobloc.html",
    "/de-CH/12202510", "/nl-NL/12345678.html", "/de-CH/eur/12345678-x.html", "/fr-CH/privacy", "/de-CH/service/oring-expert",
    "/en-INT/black-friday", "/de-CH/catalogsearch/result/", "/de-CH/checkout/cart/", "/de-CH/checkout/cart", "/de-CH/checkout/",
    "/de-CH/checkout/onepage/success/", "/de-CH/multishipping/checkout/success", "/de-CH/paypal/express/review", "/de-CH/checkout/x.html",
    "/de-CH/customer/account/login/", "/de-CH/wishlist/", "/de-CH/sales/order/history/", "/de-CH/review/product/list", "/de-CH/quickorder/",
    "/de-CH/persistent/index", "/checkout/cart/", "/x.html", "/media/a.pdf",
  ];
  for (const p of paths) {
    const want = journeyKind(p);
    for (const k of JKINDS.filter((x): x is Exclude<JKind, "other"> => x !== "other")) {
      assert.equal(kindMatches(k, p), want === k, `${p}: ${k} (journeyKind says ${want})`);
    }
  }
});

test("ga4StepExpr and pagePathPattern: each step as the funnel report's filter", () => {
  assert.deepEqual(ga4StepExpr({ type: "in" }, null), { funnelEventFilter: { eventName: "session_start" } });
  const inStore = ga4StepExpr({ type: "in" }, "de-CH") as { andGroup: { expressions: unknown[] } };
  assert.equal(inStore.andGroup.expressions.length, 2);
  assert.deepEqual(inStore.andGroup.expressions[1], { funnelFieldFilter: { fieldName: "unifiedPagePathScreen", stringFilter: { matchType: "FULL_REGEXP", value: "/de-CH(?:/.*)?", caseSensitive: false } } });
  const cart = ga4StepExpr({ type: "kinds", kinds: ["cart"] }, null) as { orGroup: { expressions: unknown[] } };
  assert.deepEqual(cart.orGroup.expressions[0], { funnelEventFilter: { eventName: "add_to_cart" } });
  const two = ga4StepExpr({ type: "kinds", kinds: ["category", "search"] }, null) as { orGroup: { expressions: { andGroup: { expressions: unknown[] } }[] } };
  assert.equal(two.orGroup.expressions.length, 2);
  // a category: the page view, an address of a category, not a product, not a shop function
  assert.equal(two.orGroup.expressions[0].andGroup.expressions.length, 4);
  assert.equal(pagePathPattern("/de-CH/x.html"), "/de-CH/x\\.html/?");
  assert.equal(pagePathPattern("/de-CH/f%C3%BCr.html"), "(?:/de-CH/für\\.html|/de-CH/f%C3%BCr\\.html)/?");
  const page = ga4StepExpr({ type: "page", path: "/de-CH/x.html" }, "fr-CH") as { andGroup: { expressions: unknown[] } };
  assert.equal(page.andGroup.expressions.length, 2);
});

test("readFunnelTable: visitors per step, in all and by device", () => {
  const noTotals = readFunnelTable([
    { step: "1. Way in", by: "desktop", users: 100 }, { step: "1. Way in", by: "mobile", users: 50 },
    { step: "2. Product", by: "desktop", users: 40 }, { step: "garbage", by: "desktop", users: 9 }, { step: "9. Too far", by: "desktop", users: 9 },
  ], 2);
  assert.deepEqual(noTotals.all, [150, 40]);
  assert.deepEqual(noTotals.by.desktop, [100, 40]);
  assert.deepEqual(noTotals.by.mobile, [50, null]);
  const withTotals = readFunnelTable([
    { step: "1. Way in", by: "RESERVED_TOTAL", users: 140 }, { step: "1. Way in", by: "desktop", users: 100 }, { step: "1. Way in", by: "mobile", users: 50 },
    { step: "2. Product", by: "RESERVED_TOTAL", users: 38 },
  ], 2);
  assert.deepEqual(withTotals.all, [140, 38]);
  assert.deepEqual(readFunnelTable([{ step: "1. Way in", by: null, users: 7 }], 2).all, [7, null]);
});

/* a small shop: 150 visits, a way through home, a category, a product, the cart (or the mini cart), the check-out, the order */
const ROWS: StepRow[] = [
  { path: "/de-CH/", referrer: "", views: 100 },
  { path: "/de-CH/dichtungen.html", referrer: `${W}/de-CH/`, views: 60 },
  { path: "/de-CH/dichtungen.html", referrer: "", views: 50 },
  { path: "/de-CH/12345678-o-ring.html", referrer: `${W}/de-CH/dichtungen.html`, views: 66 },
  { path: "/de-CH/checkout/cart/", referrer: `${W}/de-CH/12345678-o-ring.html`, views: 20 },
  { path: "/de-CH/checkout/", referrer: `${W}/de-CH/checkout/cart/`, views: 10 },
  { path: "/de-CH/checkout/", referrer: `${W}/de-CH/12345678-o-ring.html`, views: 5 },
  { path: "/de-CH/checkout/onepage/success/", referrer: `${W}/de-CH/checkout/`, views: 12 },
  { path: "/fr-CH/", referrer: "", views: 30 },
];
const LANDING = landingRows(
  [{ path: "/de-CH/", sessions: 100, transactions: 5 }, { path: "/de-CH/dichtungen.html", sessions: 50, transactions: 4 }, { path: "/fr-CH/", sessions: 30 }],
  [{ path: "/de-CH/", event: "add_to_cart", sessions: 12 }, { path: "/de-CH/", event: "purchase", sessions: 5 }],
);

test("chainFunnel: the shop's path chained from the steps - the mini cart counts as the cart", () => {
  const g = buildStepGraph(ROWS);
  const c = buildChain(g, LANDING, "de-CH");
  const n = chainFunnel(c, parseSteps(SHOP_PATH));
  [150, 110, 66, 25, 15, 12].forEach((v, i) => close(n[i], v));
  // without the way in: the first step counts the page they came in on
  const n2 = chainFunnel(c, parseSteps(["category", "product", "order"]));
  [110, 66, 12].forEach((v, i) => close(n2[i], v));
  // all store views: the French visits come in and leave
  close(chainFunnel(buildChain(g, LANDING, null), parseSteps(SHOP_PATH))[0], 180);
  // a page as a step: that page's own node
  const withPage = buildChain(g, LANDING, "de-CH", ["/de-CH/12345678-o-ring.html"]);
  const n3 = chainFunnel(withPage, parseSteps(["in", "page:/de-CH/12345678-o-ring.html", "cart"]));
  [150, 66, 25].forEach((v, i) => close(n3[i], v));
  // a step nobody reaches is nobody, never more than the step before
  const n4 = chainFunnel(c, parseSteps(["in", "account", "order"]));
  assert.deepEqual(n4.map((x) => Math.round(x)), [150, 0, 0]);
});

test("dropPages: where they dropped - the pages of a step that lose the most to the next", () => {
  const g = buildStepGraph(ROWS);
  const c = buildChain(g, LANDING, "de-CH");
  const steps = parseSteps(SHOP_PATH);
  const atIn = dropPages(g, LANDING, c, steps, 0, "de-CH");
  assert.equal(atIn.length, 1);
  assert.equal(atIn[0].path, "/de-CH/");
  close(atIn[0].views, 100);
  close(atIn[0].on, 0.6);
  close(atIn[0].lost, 40);
  const atProduct = dropPages(g, LANDING, c, steps, 2, "de-CH");
  assert.equal(atProduct[0].kind, "product");
  close(atProduct[0].on, 25 / 66);
  close(atProduct[0].left, 41 / 66);
  close(atProduct[0].lost, 41);
  assert.deepEqual(dropPages(g, LANDING, c, steps, 5, "de-CH"), []);
  const f = funnelOf(g, LANDING, "de-CH", steps);
  assert.equal(f.drops.length, steps.length - 1);
  close(f.n[5], 12);
});

test("completeJourneys and leavesByKind: from the way in to the order, or to where they leave", () => {
  const g = buildStepGraph(ROWS);
  const kf = kindFlow(g, "de-CH");
  const t = transitionsOf(kf);
  const entries = { ...Object.fromEntries(JKINDS.map((k) => [k, 0])), home: 100, category: 50 } as Record<JKind, number>;
  const j = completeJourneys(entries, t, { depth: 6, won: 8, lost: 10, minLost: 0.002, minWon: 0.01 });
  assert.equal(j.total, 150);
  assert.ok(j.won.length >= 2 && j.won.every((x) => x.end === "order" && x.kinds[x.kinds.length - 1] === "order"));
  assert.deepEqual(j.won[0].kinds, ["home", "category", "product", "cart", "checkout", "order"]);
  close(j.won[0].visits, 100 * 0.6 * 0.6 * (20 / 66) * 0.5 * 0.8);
  assert.deepEqual(j.won[1].kinds, ["category", "product", "cart", "checkout", "order"]);
  assert.ok(j.lost.every((x) => x.end === "left"));
  assert.deepEqual(j.lost[0].kinds, ["home"]);
  close(j.lost[0].visits, 40);
  assert.deepEqual(j.lost[1].kinds, ["home", "category"]);
  for (let i = 1; i < j.lost.length; i++) assert.ok(j.lost[i - 1].visits >= j.lost[i].visits);
  // the orders chained: the same 12 the funnel reaches
  close(j.orders, 12);
  assert.ok(j.covered > 0.5 && j.covered <= 1);
  // a step's runs: category to category is one step
  const loop = transitionsOf(kindFlow(buildStepGraph([
    { path: "/de-CH/a.html", referrer: "", views: 100 },
    { path: "/de-CH/b.html", referrer: `${W}/de-CH/a.html`, views: 50 },
    { path: "/de-CH/12345678-x.html", referrer: `${W}/de-CH/b.html`, views: 25 },
  ]), null));
  const r = collapseRuns(loop);
  close(r.p.category.category, 0);
  close(r.p.category.product, (25 / 150) / (1 - 50 / 150));
  const leaves = leavesByKind(kf);
  assert.deepEqual(leaves.map((x) => x.kind), ["category", "product", "home", "cart", "checkout"]);
  close(leaves[0].visits, 44);
  close(leaves.reduce((a, x) => a + x.share, 0), 1);
});

test("journeysOf: the whole page's answer from the rows", () => {
  const g = buildStepGraph(ROWS);
  const all = journeysOf(g, LANDING, null);
  assert.deepEqual(all.totals, { visits: 180, carts: 12, orders: 5, transactions: 9 });
  assert.equal(all.entries[0].kind, "home");
  const de = journeysOf(g, LANDING, "de-CH");
  assert.equal(de.totals.visits, 150);
  assert.ok(de.journeys.won.length > 0 && de.journeys.lost.length > 0);
  assert.equal(de.flow.total, 150);
});
