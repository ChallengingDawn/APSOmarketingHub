// Website > Journeys - the ways to the cart, the quick order, and which steps the Preview opens (SARCLA 13.11.2026:
// "Ordered · journey 1: Cart → Check-out → Order placed - how they come to the cart, this is the real question";
// "Preview did not answer (HTTP 400) - env must be prod or acc, and path a shop page").
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CART_KINDS, JKINDS, STEP_KINDS, buildStepGraph, canPreview, cartJourneys, cartWaysOf, journeyKind, journeyWords, journeysOf,
  kindMatches, landingRows, pageName, parseStep, wayInOf, type StepRow,
} from "../src/lib/journeys/model";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const W = "https://www.apsoparts.com";
const RULES = { depth: 6, won: 8, lost: 10, minLost: 0.002, minWon: 0.01 };

/* de-CH: 100 straight onto the home page, 40 from Google onto a product, 10 straight onto the quick order, 6 straight onto
   the cart; the cart from the product, the quick order and the check-out (back); the check-out from the cart and the
   mini cart; the order placed from the check-out and from a payment page (or with no page before - its redirect) */
const ROWS: StepRow[] = [
  { path: "/de-CH/", referrer: "", views: 100 },
  { path: "/de-CH/12345678-o-ring.html", referrer: "https://www.google.com/", views: 40 },
  { path: "/de-CH/12345678-o-ring.html", referrer: `${W}/de-CH/`, views: 30 },
  { path: "/de-CH/catalogsearch/result/", referrer: `${W}/de-CH/`, views: 20 },
  { path: "/de-CH/12345678-o-ring.html", referrer: `${W}/de-CH/catalogsearch/result/`, views: 10 },
  { path: "/de-CH/quickorder/", referrer: "", views: 10 },
  { path: "/de-CH/checkout/cart/", referrer: `${W}/de-CH/12345678-o-ring.html`, views: 24 },
  { path: "/de-CH/checkout/cart/", referrer: `${W}/de-CH/quickorder/`, views: 8 },
  { path: "/de-CH/checkout/cart/", referrer: "", views: 6 },
  { path: "/de-CH/checkout/cart/", referrer: `${W}/de-CH/checkout/`, views: 4 },
  { path: "/de-CH/checkout/", referrer: `${W}/de-CH/checkout/cart/`, views: 20 },
  { path: "/de-CH/checkout/", referrer: `${W}/de-CH/12345678-o-ring.html`, views: 2 },
  { path: "/de-CH/checkout/onepage/success/", referrer: "https://www.datatrans.com/", views: 9 },
  { path: "/de-CH/checkout/onepage/success/", referrer: `${W}/de-CH/checkout/`, views: 3 },
  { path: "/de-CH/checkout/onepage/success/", referrer: "", views: 1 },
  { path: "/fr-CH/12345678-x.html", referrer: "https://www.google.fr/", views: 50 },
];

test("the quick order is a kind of its own: named, a funnel step, Google Analytics' filter says the same", () => {
  assert.equal(journeyKind("/de-CH/quickorder/"), "quickorder");
  assert.equal(journeyKind("/de-CH/eur/quickorder/index/index"), "quickorder");
  assert.equal(pageName("/de-CH/quickorder/"), "Quick order");
  assert.ok(JKINDS.includes("quickorder") && STEP_KINDS.includes("quickorder"));
  assert.deepEqual(parseStep("quickorder"), { type: "kinds", kinds: ["quickorder"] });
  assert.ok(kindMatches("quickorder", "/de-CH/quickorder/"));
  assert.ok(!kindMatches("cms", "/de-CH/quickorder/"));
  assert.ok(!kindMatches("quickorder", "/de-CH/12345678-o-ring.html"));
});

test("canPreview: the shop's public pages only - never a shop function, a way in or another site", () => {
  for (const p of ["/", "/de-CH/", "/de-CH/12345678-o-ring.html", "/de-CH/dichtungen.html", "/de-CH/service/oring-expert", "/de-CH/x.html?p=2"]) {
    assert.ok(canPreview(p), p);
  }
  for (const p of [
    "/de-CH/checkout/cart/", "/de-CH/checkout/", "/de-CH/checkout/onepage/success/", "/de-CH/customer/account/login/",
    "/de-CH/customer/account/logoutSuccess/", "/de-CH/catalogsearch/result/", "/de-CH/quickorder/", "/de-CH/wishlist/",
  ]) assert.ok(!canPreview(p), p);
  for (const p of [null, undefined, "", "Google", "No page before", "//evil.com/x", "https://www.apsoparts.com/de-CH/", "/de-CH/a b.html", "/de-CH/../x"]) {
    assert.ok(!canPreview(p), String(p));
  }
});

test("wayInOf: the other sites as ways in - a payment page is the check-out's way back, not a way in", () => {
  assert.equal(wayInOf("Google"), "google");
  assert.equal(wayInOf("Bing"), "bing");
  assert.equal(wayInOf("ChatGPT"), "ai");
  assert.equal(wayInOf("Gemini"), "ai");
  assert.equal(wayInOf("LinkedIn"), "social");
  assert.equal(wayInOf("Angst+Pfister"), "ap");
  assert.equal(wayInOf("example.org"), "site");
  assert.equal(wayInOf("A payment page"), null);
});

test("cartWaysOf: the page right before the cart, measured - the moves inside the cart and the payment's way back are no way to it", () => {
  const w = cartWaysOf(buildStepGraph(ROWS), "de-CH");
  // onto the cart: 24 from the product (and 2 straight onto the check-out: the mini cart), 8 from the quick order,
  // 6 with no page before - the 4 from the check-out back to the cart are not a way to it
  assert.equal(w.toCart, 40);
  assert.deepEqual(w.before.map((b) => b.key), ["kind:product", "kind:quickorder", "way:direct"]);
  assert.equal(w.before[0].views, 26);
  assert.equal(w.before[0].checkout, 2);
  close(w.before[0].share, 26 / 40);
  assert.equal(w.before[2].way, "direct");
  assert.equal(w.before[2].kind, null);
  // the ways in: no page before onto the home page, the quick order and the cart; Google onto the product
  assert.equal(w.arrivals.direct.home, 100);
  assert.equal(w.arrivals.direct.quickorder, 10);
  assert.equal(w.arrivals.direct.cart, 6);
  assert.equal(w.arrivals.google.product, 40);
  // the order placed from a payment page or with no page before: the check-out's next step, never a way in
  assert.equal(w.arrivals.direct.order, 0);
  assert.equal(w.arrivals.site.order, 0);
  assert.equal(w.flow.steps.checkout.order, 13);
  // the other store view stays out
  assert.equal(w.arrivals.google.product + w.arrivals.direct.home, 140);
  assert.equal(cartWaysOf(buildStepGraph(ROWS), null).arrivals.google.product, 90);
});

test("cartJourneys: from the way in through the pages to the cart, then the order or lost", () => {
  const w = cartWaysOf(buildStepGraph(ROWS), "de-CH");
  const j = cartJourneys(w, RULES);
  assert.equal(j.total, 156);
  // the first journey to an order: Google, the product, the cart, the check-out, the order placed - chained
  assert.equal(j.won[0].way, "google");
  assert.deepEqual(j.won[0].kinds, ["product", "cart", "checkout", "order"]);
  close(j.won[0].visits, 40 * (24 / 80) * (20 / 42) * (13 / 22));
  assert.equal(journeyWords(j.won[0]), "Google → Product → Cart → Check-out → Order placed");
  assert.ok(j.won.every((x) => x.end === "order" && x.kinds[x.kinds.length - 1] === "order" && x.way));
  // the quick order and straight onto the cart are ways too
  assert.ok(j.won.some((x) => x.way === "direct" && x.kinds.join(",") === "quickorder,cart,checkout,order"));
  assert.ok(j.won.some((x) => x.way === "direct" && x.kinds.join(",") === "cart,checkout,order"));
  // no journey starts on the order placed: the payment's way back is not a way in
  for (const x of [...j.won, ...j.lost, ...j.lostCart]) assert.notEqual(x.kinds[0], "order");
  // lost: the most first - 50 of the 100 on the home page leave there
  assert.equal(j.lost[0].way, "direct");
  assert.deepEqual(j.lost[0].kinds, ["home"]);
  close(j.lost[0].visits, 50);
  for (const list of [j.won, j.lost, j.lostCart]) for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].visits >= list[i].visits);
  // lost after the cart: every one has been to the cart, Google's first
  assert.ok(j.lostCart.length > 0 && j.lostCart.every((x) => x.end === "left" && x.kinds.some((k) => CART_KINDS.includes(k)) && x.cart > 0));
  assert.equal(j.lostCart[0].way, "google");
  assert.deepEqual(j.lostCart[0].kinds, ["product", "cart"]);
  close(j.lostCart[0].visits, 40 * (24 / 80) * (22 / 42));
  assert.ok(j.orders > 0 && j.orders < j.carts && j.carts < j.total);
  close(j.cartLost, j.carts - j.orders);
  assert.ok(j.covered > 0 && j.covered <= 1);
  // nothing to walk: nothing
  const none = cartJourneys(cartWaysOf(buildStepGraph([]), null), RULES);
  assert.equal(none.total, 0);
  assert.equal(none.won.length + none.lost.length + none.lostCart.length, 0);
});

test("journeysOf: the main journeys start at the way in, with the page right before the cart", () => {
  const landing = landingRows([{ path: "/de-CH/checkout/cart/", sessions: 500 }, { path: "/de-CH/", sessions: 100 }], []);
  const de = journeysOf(buildStepGraph(ROWS), landing, "de-CH");
  // Google Analytics' landing page says 500 visits came in on the cart; the steps say 6 did - the journeys follow the steps
  assert.equal(de.journeys.total, 156);
  assert.ok(de.journeys.won.length > 0 && de.journeys.won.every((x) => x.way));
  assert.equal(de.cart.toCart, 40);
  assert.equal(de.cart.before[0].kind, "product");
});
