import assert from "node:assert/strict";
import { test } from "node:test";
import {
  JKINDS, biggestDrop, buildStepGraph, chainFlow, companyFunnel, dropWords, entriesOf, foldFlow, ga4Funnel, journeyKind,
  journeyWords, kindFlow, landingRows, layoutFlow, orderedFunnel, pageFlowOf, pageName, pathKey, reachChances, readReferrer,
  ribbonPath, siteName, storeOf, storesOf, topJourneys, topPagesByKind, transitionsOf, type JKind, type StepRow, type Transitions,
} from "../src/lib/journeys/model";

const kinds = (o: Partial<Record<JKind, number>>) => Object.fromEntries(JKINDS.map((k) => [k, o[k] ?? 0])) as Record<JKind, number>;
const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("journeyKind: the shop functions told apart, the rest as APSOconvert classifies them", () => {
  assert.equal(journeyKind("/de-CH/"), "home");
  assert.equal(journeyKind("/de-CH/dichtungstechnik/o-ringe-x-ringe.html"), "category");
  assert.equal(journeyKind("/de-CH/12202510-apsovibr-maschinenfuss-nivobloc.html"), "product");
  assert.equal(journeyKind("/fr-CH/privacy"), "cms");
  assert.equal(journeyKind("/de-CH/catalogsearch/result/"), "search");
  assert.equal(journeyKind("/de-CH/checkout/cart/"), "cart");
  assert.equal(journeyKind("/de-CH/checkout/"), "checkout");
  assert.equal(journeyKind("/de-CH/checkout/onepage/success/"), "order");
  assert.equal(journeyKind("/de-CH/customer/account/login/"), "account");
  assert.equal(journeyKind("/de-CH/wishlist/"), "account");
  // the quick order is a kind of its own since 13.11.2026 (one of the ways to the cart)
  assert.equal(journeyKind("/de-CH/quickorder/"), "quickorder");
  assert.equal(journeyKind("/de-CH/persistent/index/unsetCookie"), "other");
  assert.equal(journeyKind("(not set)"), "other");
  assert.equal(journeyKind("/de-CH/eur/checkout/cart"), "cart");
  assert.equal(storeOf("/de-CH/eur/antriebstechnik.html"), "de-CH");
  assert.equal(storeOf("/media/x.pdf"), null);
});

test("pathKey and pageName: one key per page, readable names", () => {
  assert.equal(pathKey("/de-CH/"), "/de-CH");
  assert.equal(pathKey("/de-CH"), "/de-CH");
  assert.equal(pathKey("/"), "/");
  assert.equal(pathKey("/de-CH/x.html?p=2"), "/de-CH/x.html");
  assert.equal(pathKey("/de-CH/f%C3%BCr.html"), "/de-CH/für.html");
  assert.equal(pageName("/de-CH/12202510-apsovibr-maschinenfuss-nivobloc.html"), "Apsovibr maschinenfuss nivobloc");
  assert.equal(pageName("/de-CH/dichtungstechnik/o-ringe-x-ringe.html"), "O ringe x ringe");
  assert.equal(pageName("/fr-CH/"), "Home page · fr-CH");
  assert.equal(pageName("/de-CH/catalogsearch/result/"), "Search results");
});

test("readReferrer and siteName: the shop's own pages are steps, the rest are ways in", () => {
  assert.deepEqual(readReferrer("https://www.apsoparts.com/de-CH/x.html?gclid=1"), { type: "page", path: "/de-CH/x.html" });
  assert.deepEqual(readReferrer("https://acc.apsoparts.com/de-CH/"), { type: "page", path: "/de-CH/" });
  assert.deepEqual(readReferrer("https://www.google.ch/"), { type: "site", host: "google.ch" });
  assert.deepEqual(readReferrer(""), { type: "none" });
  assert.deepEqual(readReferrer("(not set)"), { type: "none" });
  assert.equal(readReferrer("not a url"), null);
  assert.deepEqual(readReferrer("android-app://com.google.android.gm/"), { type: "site", host: "com.google.android.gm" });
  assert.equal(siteName("google.ch"), "Google");
  assert.equal(siteName("www.google.co.uk"), "Google");
  assert.equal(siteName("gemini.google.com"), "Gemini");
  assert.equal(siteName("chatgpt.com"), "ChatGPT");
  assert.equal(siteName("example.org"), "example.org");
});

const ROWS: StepRow[] = [
  // the home page: 100 views, 60 from Google, 30 typed, 10 a reload
  { path: "/de-CH/", referrer: "https://www.google.ch/", views: 60 },
  { path: "/de-CH/", referrer: "", views: 30 },
  { path: "/de-CH/", referrer: "https://www.apsoparts.com/de-CH", views: 10 },
  // a category: 50 views from the home page, 20 more of itself (page 2 of the list)
  { path: "/de-CH/dichtungen.html", referrer: "https://www.apsoparts.com/de-CH/", views: 50 },
  { path: "/de-CH/dichtungen.html", referrer: "https://www.apsoparts.com/de-CH/dichtungen.html?p=2", views: 20 },
  // a product: 40 from the category, 10 from Google
  { path: "/de-CH/12345678-o-ring.html", referrer: "https://www.apsoparts.com/de-CH/dichtungen.html", views: 40 },
  { path: "/de-CH/12345678-o-ring.html", referrer: "https://www.google.de/search", views: 10 },
  // the cart, the order
  { path: "/de-CH/checkout/cart/", referrer: "https://www.apsoparts.com/de-CH/12345678-o-ring.html", views: 10 },
  { path: "/de-CH/checkout/onepage/success/", referrer: "https://www.apsoparts.com/de-CH/checkout/", views: 4 },
  { path: "/de-CH/checkout/", referrer: "https://www.apsoparts.com/de-CH/checkout/cart/", views: 6 },
  // another store view
  { path: "/fr-CH/", referrer: "", views: 25 },
  { path: "/fr-CH/joints.html", referrer: "https://www.apsoparts.com/fr-CH/", views: 5 },
];

test("buildStepGraph: steps inside the shop only, the same page again is not a step, one key per page", () => {
  const g = buildStepGraph(ROWS);
  const home = g.pages.get("/de-CH")!;
  assert.equal(home.views, 100);
  assert.equal(home.again, 10);
  assert.equal(home.none, 30);
  assert.equal(home.sites.get("Google"), 60);
  assert.equal(g.pages.get("/de-CH/dichtungen.html")!.again, 20);
  assert.equal(g.steps.get("/de-CH")!.get("/de-CH/dichtungen.html"), 50);
  assert.equal(g.steps.get("/de-CH/dichtungen.html")!.get("/de-CH/12345678-o-ring.html"), 40);
  assert.equal(g.steps.has("/de-CH/12345678-o-ring.html/"), false);
  assert.equal(g.unreadable, 0);
});

test("kindFlow and transitionsOf: shares of the views, exits the rest, one store view at a time", () => {
  const g = buildStepGraph(ROWS);
  const all = kindFlow(g, null);
  assert.equal(all.views.home, 90 + 25);
  const de = kindFlow(g, "de-CH");
  assert.equal(de.views.home, 90);
  assert.equal(de.views.category, 50);
  assert.equal(de.steps.home.category, 50);
  assert.equal(de.outside.product, 10);
  const t = transitionsOf(de);
  close(t.p.home.category, 50 / 90);
  close(t.exit.home, 40 / 90);
  close(t.p.category.product, 40 / 50);
  close(t.exit.category, 10 / 50);
  close(t.p.product.cart, 10 / 50);
  // the order placed ends a visit
  assert.equal(t.exit.order, 1);
  assert.equal(JKINDS.reduce((a, k) => a + t.p.order[k], 0), 0);
  // more steps out than views (tabs opened): scaled to one, nobody left
  const tabs = transitionsOf({ views: kinds({ category: 10 }), steps: { ...de.steps, category: kinds({ product: 30 }) }, outside: kinds({}) });
  close(tabs.p.category.product, 1);
  close(tabs.exit.category, 0);
});

const T = (): Transitions => {
  const p = Object.fromEntries(JKINDS.map((k) => [k, kinds({})])) as Transitions["p"];
  const exit = kinds({});
  p.category.product = 0.6; exit.category = 0.4;
  p.product.product = 0.2; p.product.cart = 0.1; exit.product = 0.7;
  p.cart.checkout = 0.5; exit.cart = 0.5;
  p.checkout.order = 0.8; exit.checkout = 0.2;
  exit.order = 1;
  for (const k of JKINDS) if (!["category", "product", "cart", "checkout", "order"].includes(k)) exit[k] = 1;
  return { p, exit };
};

test("reachChances: the chance of getting there, loops included", () => {
  const t = T();
  const cart = reachChances(t, ["cart", "checkout", "order"]);
  // from a product: 0.1 now, plus 0.2 x (again from a product) -> 0.1 / (1 - 0.2)
  close(cart.product, 0.125, 1e-6);
  close(cart.category, 0.6 * 0.125, 1e-6);
  const order = reachChances(t, ["order"]);
  close(order.checkout, 0.8, 1e-9);
  close(order.cart, 0.4, 1e-9);
  close(order.product, 0.125 * 0.4, 1e-6);
});

test("chainFlow: every visit goes on, leaves or orders - nothing is lost between columns", () => {
  const t = T();
  const g = chainFlow(kinds({ category: 1000, product: 500 }), t, 5);
  assert.equal(g.total, 1500);
  const col = (c: number) => g.nodes.filter((n) => n.col === c);
  const sum = (c: number) => col(c).reduce((a, n) => a + n.value, 0);
  const alive = (c: number) => col(c).filter((n) => n.kind !== "left" && n.kind !== "order").reduce((a, n) => a + n.value, 0);
  for (let c = 1; c < 5; c++) close(sum(c), alive(c - 1), 1e-6);
  const left1 = g.nodes.find((n) => n.id === "1:left")!;
  close(left1.value, 1000 * 0.4 + 500 * 0.7, 1e-9);
  // the order placed ends there: nothing leaves it
  assert.equal(g.links.some((l) => l.source.endsWith(":order")), false);
  // out of a node = into the next column, link by link
  const out = g.links.filter((l) => l.source === "0:category").reduce((a, l) => a + l.value, 0);
  close(out, 1000, 1e-9);
});

test("foldFlow: small kinds of a column drawn as other pages, the order and the leaving never", () => {
  const t = T();
  const g = chainFlow(kinds({ category: 1000, product: 500, cms: 5 }), t, 3);
  const f = foldFlow(g, 0.01);
  assert.equal(f.nodes.some((n) => n.id === "0:cms"), false);
  assert.equal(f.nodes.find((n) => n.id === "0:other")!.value, 5);
  // the leaving is never folded, however small: the cms visits that left in column 1 stay "left"
  assert.ok(f.links.some((l) => l.source === "0:other" && l.target === "1:left"));
  const before = g.nodes.reduce((a, n) => a + n.value, 0), after = f.nodes.reduce((a, n) => a + n.value, 0);
  close(before, after, 1e-6);
});

test("layoutFlow and ribbonPath: one scale, everything inside the box, bands stacked in their node", () => {
  const g = chainFlow(kinds({ category: 1000, product: 500 }), T(), 4);
  const L = layoutFlow(g, { width: 1000, height: 400, nodeWidth: 12, gap: 10, top: 20 });
  for (const n of L.nodes) {
    assert.ok(n.y >= 20 - 1e-6 && n.y + n.h <= 400 + 1e-6, `${n.id} outside`);
    assert.ok(n.x >= 0 && n.x <= 1000 - 12);
  }
  const c0 = L.nodes.filter((n) => n.col === 0);
  close(c0[0].h / c0[0].value, c0[1].h / c0[1].value, 1e-9);
  for (const n of L.nodes) {
    const out = L.links.filter((l) => l.source === n.id);
    for (const l of out) assert.ok(l.sy >= n.y - 1e-6 && l.sy + l.value * L.scale <= n.y + n.h + 1e-6);
  }
  assert.match(ribbonPath(0, 10, 100, 50, 8), /^M0,10 C50,10 50,50 100,50 L100,58 C50,58 50,18 0,18 Z$/);
});

test("topJourneys: the most travelled ways first, with their way to the cart and the order", () => {
  const t = T();
  const j = topJourneys(kinds({ category: 1000, product: 500 }), t, { depth: 3, minShare: 0.01, limit: 20 });
  assert.equal(journeyWords(j[0]), "Category → Product, then left");
  close(j[0].visits, 1000 * 0.6 * 0.7, 1e-9);
  close(j[0].share, 420 / 1500, 1e-9);
  assert.equal(j[0].cart, 0);
  // most first
  for (let i = 1; i < j.length; i++) assert.ok(j[i - 1].visits >= j[i].visits);
  const viaCart = j.find((x) => x.kinds.join(">") === "product>cart>checkout")!;
  close(viaCart.visits, 500 * 0.1 * 0.5, 1e-9);
  assert.equal(viaCart.end, "on");
  close(viaCart.cart, viaCart.visits, 1e-9);
  close(viaCart.order, viaCart.visits * 0.8, 1e-9);
  // nothing under the minimum share
  assert.ok(j.every((x) => x.share >= 0.01 - 1e-12));
  assert.equal(journeyWords({ kinds: ["home", "category"], end: "on" }), "Home page → Category → …");
});

test("landingRows, entriesOf, storesOf: the ways in as Google Analytics counts them", () => {
  const rows = landingRows(
    [{ path: "/de-CH/", sessions: 90 }, { path: "/de-CH/dichtungen.html", sessions: 40 }, { path: "/fr-CH", sessions: 25 }, { path: "(not set)", sessions: 3 }],
    [{ path: "/de-CH/", event: "add_to_cart", sessions: 9 }, { path: "/de-CH/", event: "purchase", sessions: 2 }, { path: "/de-CH/dichtungen.html", event: "add_to_cart", sessions: 4 }],
  );
  assert.equal(rows.length, 3);
  const all = entriesOf(rows, null);
  assert.equal(all.home.sessions, 115);
  assert.equal(all.home.carts, 9);
  assert.equal(all.home.orders, 2);
  assert.equal(all.category.carts, 4);
  assert.equal(entriesOf(rows, "fr-CH").home.sessions, 25);
  assert.deepEqual(storesOf(rows), [{ key: "de-CH", sessions: 130 }, { key: "fr-CH", sessions: 25 }]);
});

test("topPagesByKind: the most viewed pages of a kind, where they go next, how many leave", () => {
  const g = buildStepGraph(ROWS);
  const landing = landingRows([{ path: "/de-CH/", sessions: 90 }], []);
  const p = topPagesByKind(g, landing, "de-CH", 10);
  assert.equal(p.home.length, 1);
  assert.equal(p.home[0].entries, 90);
  assert.equal(p.home[0].views, 90);
  assert.deepEqual(p.home[0].next.map((n) => n.kind), ["category"]);
  close(p.home[0].left, 40 / 90);
  assert.equal(p.category[0].name, "Dichtungen");
  assert.equal(topPagesByKind(g, landing, "fr-CH", 10).home[0].path, "/fr-CH/");
});

test("pageFlowOf: one page's two sides, the rest grouped, the same page again apart", () => {
  const inRows: StepRow[] = [
    { path: "/de-CH/dichtungen.html", referrer: "https://www.apsoparts.com/de-CH/", views: 50 },
    { path: "/de-CH/dichtungen.html/", referrer: "https://www.apsoparts.com/de-CH/dichtungen.html?p=2", views: 20 },
    { path: "/de-CH/dichtungen.html", referrer: "https://www.google.ch/", views: 30 },
    { path: "/de-CH/dichtungen.html", referrer: "", views: 5 },
    { path: "/de-CH/other.html", referrer: "", views: 99 },
  ];
  const outRows: StepRow[] = [
    { path: "/de-CH/12345678-o-ring.html", referrer: "https://www.apsoparts.com/de-CH/dichtungen.html", views: 40 },
    { path: "/de-CH/22345678-x.html", referrer: "https://www.apsoparts.com/de-CH/dichtungen.html?p=3", views: 15 },
    { path: "/de-CH/dichtungen.html", referrer: "https://www.apsoparts.com/de-CH/dichtungen.html", views: 7 },
    { path: "/de-CH/zzz.html", referrer: "https://www.apsoparts.com/de-CH/dichtungen-alt.html", views: 9 },
  ];
  const f = pageFlowOf("/de-CH/dichtungen.html", inRows, outRows, 1);
  assert.equal(f.views, 105);
  assert.equal(f.again, 20);
  assert.equal(f.kind, "category");
  assert.deepEqual(f.from.map((x) => [x.label, x.views]), [["Home page · de-CH", 50], ["Google", 30], ["No page before (typed, a bookmark, an app)", 5]]);
  assert.deepEqual(f.to.map((x) => x.views), [40, 15]);
  assert.equal(f.to[1].path, null);
  assert.equal(f.left, 105 - 20 - 55);
});

test("ga4Funnel, biggestDrop, dropWords: steps the shop does not send are named, never shown as nobody", () => {
  const { steps, notSent } = ga4Funnel(10_000, { view_item: 6000, add_to_cart: 300, begin_checkout: 120, purchase: 80 });
  assert.deepEqual(notSent, ["view_item_list"]);
  assert.deepEqual(steps.map((s) => s.key), ["visit", "view_item", "add_to_cart", "begin_checkout", "purchase"]);
  const d = biggestDrop(steps)!;
  assert.equal(d.from.key, "view_item");
  assert.equal(d.to.key, "add_to_cart");
  assert.equal(d.lost, 5700);
  assert.equal(dropWords(d), "Of the 6,000 visits that saw articles, 95% did not put something in the cart.");
  // nothing after it: a zero is a zero
  const none = ga4Funnel(100, { view_item_list: 10, view_item: 20 });
  assert.deepEqual(none.notSent, []);
  assert.equal(none.steps.find((s) => s.key === "purchase")!.n, 0);
  // a step with more than the one before is no drop
  assert.equal(biggestDrop([{ key: "a", label: "a", who: "a", did: "a", n: 10 }, { key: "b", label: "b", who: "b", did: "b", n: 20 }]), null);
  const o = orderedFunnel([{ event: "view_item", n: 900 }, { event: "add_to_cart", n: 40 }]);
  assert.equal(o[0].who, "visitors who saw articles");
});

test("companyFunnel: each company once, at the furthest step it reached", () => {
  const f = companyFunnel([
    { company: "a", step: "looked" }, { company: "a", step: "price" },
    { company: "b", step: "shelf" },
    { company: "c", step: "cart" }, { company: "c", step: "won" },
    { company: "d", step: "looked" },
    { company: "e", step: "moq" },
  ]);
  assert.equal(f.companies, 5);
  assert.deepEqual(f.steps.map((s) => s.n), [5, 4, 3, 2, 1, 1]);
  assert.equal(f.stopped.looked, 1);
  assert.equal(f.stopped.price, 1);
  const d = biggestDrop(f.steps)!;
  assert.equal(d.to.key, "cart");
  assert.equal(dropWords(d), "Of the 2 companies that met the minimum and saw their price, 50% did not put it in the cart.");
});
