// APSOconvert > Journeys > Visits - the rules (src/lib/convert/visitRules.ts): page views and the shop's looks cut into
// visits, the steps and their times, how far a visit got, the words for a look, where visits stopped, the list's filter
// and the player's pace.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildVisits, durWords, filterRows, hasPicture, lookReach, lookWords, mergeStops, mostOf, ms, reachOf, replayMs, shopPathOf,
  stopWords, stopsOf, visitLine, zurichTime, type CustomerRow, type Look, type PageView,
} from "../src/lib/convert/visitRules";

const view = (at: string, path: string, contact = "11", source: PageView["source"] = "pages", query: string | null = null): PageView =>
  ({ at, path, query, title: null, contact, source });
const look = (at: string, article: string, product: string | null, x: Partial<Look> = {}): Look =>
  ({ at, article, product, qty: null, carted: false, ordered: false, contact: "11", step: null, name: null, minimum: null, ...x });
const PRODUCT = "/de-CH/12202510-apsovibr-maschinenfuss-nivobloc.html";

test("ms: the gateway's minute is UTC; ISO times as they are", () => {
  assert.equal(ms("2026-11-08T10:21"), Date.UTC(2026, 10, 8, 10, 21));
  assert.equal(ms("2026-11-08T10:21:30.000Z"), Date.UTC(2026, 10, 8, 10, 21, 30));
  assert.ok(Number.isNaN(ms("yesterday")));
});

test("buildVisits: 30 minutes without a page or a look starts a new visit; newest first", () => {
  const v = buildVisits([
    view("2026-11-08T08:00:00Z", "/de-CH/"),
    view("2026-11-08T08:02:00Z", "/de-CH/dichtungstechnik.html"),
    view("2026-11-08T08:40:00Z", "/de-CH/"),
  ], []);
  assert.equal(v.length, 2);
  assert.equal(v[0].start, "2026-11-08T08:40:00.000Z");
  assert.equal(v[1].steps.length, 2);
  assert.equal(v[1].secs, 120);
  assert.equal(v[1].id, String(Date.UTC(2026, 10, 8, 8, 0) / 60_000));
});

test("buildVisits: a step's time runs to the next step; the last is not known", () => {
  const [v] = buildVisits([view("2026-11-08T08:00:00Z", "/de-CH/"), view("2026-11-08T08:01:30Z", "/de-CH/dichtungstechnik.html")], []);
  assert.deepEqual(v.steps.map((s) => s.secs), [90, null]);
  assert.deepEqual(v.steps.map((s) => s.kind), ["home", "category"]);
  assert.equal(v.steps[0].name, "Home page · de-CH");
});

test("buildVisits: the same page straight after (a reload, a filter) stays one step", () => {
  const [v] = buildVisits([
    view("2026-11-08T08:00:00Z", "/de-CH/dichtungstechnik.html"),
    view("2026-11-08T08:01:00Z", "/de-CH/dichtungstechnik.html/"),
    view("2026-11-08T08:03:00Z", "/de-CH/"),
  ], []);
  assert.equal(v.steps.length, 2);
  assert.equal(v.steps[0].secs, 180);
});

test("buildVisits: the last page seen that is also a page-by-page view counts once", () => {
  const [v] = buildVisits([view("2026-11-08T08:00:10Z", "/de-CH/", "11", "pages"), view("2026-11-08T08:00:40Z", "/de-CH/", "11", "last")], []);
  assert.equal(v.steps.length, 1);
});

test("buildVisits: a look joins its product page seen within 10 minutes", () => {
  const [v] = buildVisits(
    [view("2026-11-08T08:00:00Z", "/de-CH/"), view("2026-11-08T08:02:00Z", PRODUCT), view("2026-11-08T08:09:00Z", "/checkout/cart/")],
    [look("2026-11-08T08:06", "1220251001", "12202510", { qty: 50, step: "price", name: "Maschinenfuss Nivobloc 50" })],
  );
  assert.equal(v.steps.length, 3);
  assert.equal(v.steps[1].looks.length, 1);
  assert.equal(v.steps[1].name, "Maschinenfuss Nivobloc 50");
  assert.equal(v.reach, "cart");
  assert.equal(v.articles, 1);
});

test("buildVisits: looks alone make steps on the product pages the hub knows; one product in a row is one step", () => {
  const paths: Record<string, string> = { "12202510": PRODUCT };
  const [v] = buildVisits([], [
    look("2026-11-08T08:00", "1220251001", "12202510"),
    look("2026-11-08T08:03", "1220251002", "12202510", { qty: 20, step: "moq", minimum: 50 }),
    look("2026-11-08T08:07", "3300000001", "33000000", { carted: true, qty: 4 }),
  ], { productPath: (p) => paths[p] ?? null });
  assert.equal(v.steps.length, 2);
  assert.equal(v.steps[0].path, PRODUCT);
  assert.equal(v.steps[0].looks.length, 2);
  assert.equal(v.steps[0].secs, 420);
  assert.equal(v.steps[1].path, null);
  assert.equal(v.steps[1].name, "Product 33000000");
  assert.equal(v.steps[1].source, "shop");
  assert.equal(v.reach, "cart");
  assert.deepEqual(v.sources, ["shop"]);
});

test("buildVisits: the order page or an ordered article is an order; contacts gathered from pages and looks", () => {
  const [v] = buildVisits(
    [view("2026-11-08T08:00:00Z", "/de-CH/", "11"), view("2026-11-08T08:05:00Z", "/de-CH/checkout/onepage/success/", "11")],
    [look("2026-11-08T08:04", "1220251001", "12202510", { ordered: true, contact: "12" })],
  );
  assert.equal(v.reach, "order");
  assert.deepEqual(v.contacts.sort(), ["11", "12"]);
});

test("lookReach / lookWords: the step the shop saw, in plain words", () => {
  assert.equal(lookReach(look("x", "1", null)), "product");
  assert.equal(lookReach(look("x", "1", null, { qty: 1 })), "product");
  assert.equal(lookReach(look("x", "1", null, { qty: 12 })), "price");
  assert.equal(lookReach(look("x", "1", null, { step: "shelf", qty: 500 })), "price");
  assert.equal(lookReach(look("x", "1", null, { carted: true })), "cart");
  assert.equal(lookReach(look("x", "1", null, { step: "won" })), "order");
  assert.equal(lookWords(look("x", "1", null)), "Opened it");
  assert.equal(lookWords(look("x", "1", null, { step: "moq", qty: 20, minimum: 50 })), "Checked 20 - below the minimum of 50");
  assert.equal(lookWords(look("x", "1", null, { step: "shelf", qty: 500 })), "Checked 500 - not enough in stock");
  assert.equal(lookWords(look("x", "1", null, { step: "price", qty: 2.5 })), "Checked the price for 2.5");
  assert.equal(lookWords(look("x", "1", null, { carted: true, qty: 4 })), "Put 4 in the cart");
  assert.equal(lookWords(look("x", "1", null, { ordered: true, qty: 4, carted: true })), "Ordered 4");
});

test("search words: a search step is named by what was searched", () => {
  const [v] = buildVisits([view("2026-11-08T08:00:00Z", "/de-CH/catalogsearch/result/", "11", "pages", "o-ring 20x2")], []);
  assert.equal(v.steps[0].kind, "search");
  assert.equal(v.steps[0].name, 'Search: "o-ring 20x2"');
  assert.equal(hasPicture(v.steps[0]), false);
});

test("hasPicture: public pages with an address only", () => {
  assert.equal(hasPicture({ kind: "product", path: PRODUCT }), true);
  assert.equal(hasPicture({ kind: "product", path: null }), false);
  assert.equal(hasPicture({ kind: "cart", path: "/checkout/cart/" }), false);
});

test("reachOf: the furthest of the visits", () => {
  assert.equal(reachOf([]), "pages");
  assert.equal(reachOf([{ reach: "price" }, { reach: "cart" }, { reach: "product" }]), "cart");
});

test("stopsOf: where visits without an order stopped, carts first; the cart page itself is no page to change", () => {
  const visits = buildVisits(
    [view("2026-11-08T08:00:00Z", "/de-CH/dichtungstechnik.html"), view("2026-11-08T08:02:00Z", PRODUCT), view("2026-11-08T09:00:00Z", "/de-CH/dichtungstechnik.html"), view("2026-11-08T09:05:00Z", "/checkout/cart/")],
    [look("2026-11-08T08:03", "1220251001", "12202510", { qty: 50, step: "price" }), look("2026-11-08T09:04", "1220251002", "12202510", { qty: 8, carted: true })],
  );
  const stops = stopsOf(visits);
  assert.equal(stops[0].product, "12202510");
  assert.equal(stops[0].asked, 1);
  assert.equal(stops[0].carted, 1);
  assert.equal(stops[0].left, 1);
  assert.ok(!stops.some((s) => s.kind === "cart"));
  assert.equal(stopWords(stops[0]), "left here in 1 visit · price checked 1× · 1 in the cart, not ordered");
});

test("filterRows: by how far they got, by store view, by name, number or contact", () => {
  const row = (id: string, x: Partial<CustomerRow>): CustomerRow => ({
    id, name: null, number: null, country: null, segment: null, priority: null, owner: null, store: null, lastAt: null,
    contacts: [], visits: 1, articles: 0, reach: "pages", sources: [], strip: [], stop: null, ...x,
  });
  const rows = [
    row("1", { name: "Muster AG", reach: "cart", store: "de-CH", number: "100123" }),
    row("2", { name: "Exemple SA", reach: "order", store: "fr-CH", contacts: [{ id: "9", name: "Anne Dupont", lastAt: null }] }),
    row("3", { name: "Rossi Srl", reach: "cart", store: null }),
  ];
  assert.deepEqual(filterRows(rows, { reach: "cart", store: "all", q: "" }).map((r) => r.id), ["1", "3"]);
  assert.deepEqual(filterRows(rows, { reach: "all", store: "fr-CH", q: "" }).map((r) => r.id), ["2"]);
  assert.deepEqual(filterRows(rows, { reach: "all", store: "all", q: "1001" }).map((r) => r.id), ["1"]);
  assert.deepEqual(filterRows(rows, { reach: "all", store: "all", q: "dupont" }).map((r) => r.id), ["2"]);
});

test("stopsOf: a product page is named by the product, a step by its article", () => {
  const visits = buildVisits([], [look("2026-11-08T08:00", "1220251001", "12202510", { qty: 5, step: "price", name: "Nivobloc 50, M10", page: "Maschinenfuss Nivobloc" })], { productPath: () => PRODUCT });
  assert.equal(visits[0].steps[0].name, "Nivobloc 50, M10");
  assert.equal(stopsOf(visits)[0].name, "Maschinenfuss Nivobloc");
});

test("mergeStops: the same page across customers - how many stopped there, their stops added", () => {
  const a = stopsOf(buildVisits([view("2026-11-08T08:00:00Z", PRODUCT)], [look("2026-11-08T08:01", "1220251001", "12202510", { qty: 5, step: "price" })]));
  const b = stopsOf(buildVisits([], [look("2026-11-07T08:01", "1220251002", "12202510", { carted: true })], { productPath: () => PRODUCT }));
  const m = mergeStops([a, b]);
  assert.equal(m.length, 1);
  assert.equal(m[0].companies, 2);
  assert.equal(m[0].asked, 1);
  assert.equal(m[0].carted, 1);
  assert.equal(m[0].left, 2);
  assert.equal(m[0].path, PRODUCT);
});

test("shopPathOf: the shop's own addresses only, the search words kept", () => {
  assert.deepEqual(shopPathOf("https://www.apsoparts.com/de-CH/catalogsearch/result/?q=o-ring+20x2"), { path: "/de-CH/catalogsearch/result/", query: "o-ring 20x2" });
  assert.deepEqual(shopPathOf("https://apsoparts.com/de-CH/;jsessionid=AB12"), { path: "/de-CH/", query: null });
  assert.equal(shopPathOf("https://acc.apsoparts.com/de-CH/"), null);
  assert.equal(shopPathOf("https://campaigns.apsoparts.com/x"), null);
  assert.equal(shopPathOf(null), null);
});

test("mostOf: the most common, the first by name on a tie", () => {
  assert.equal(mostOf(["de-CH", "fr-CH", "de-CH", null]), "de-CH");
  assert.equal(mostOf(["fr-CH", "de-CH"]), "de-CH");
  assert.equal(mostOf([null]), null);
});

test("replayMs: ten times faster than the visit, 3 to 12 s at 1x, divided by the speed", () => {
  assert.equal(replayMs(10, 1), 3000);
  assert.equal(replayMs(60, 1), 6000);
  assert.equal(replayMs(600, 1), 12000);
  assert.equal(replayMs(null, 1), 4000);
  assert.equal(replayMs(60, 2), 3000);
  assert.equal(replayMs(60, 4), 1500);
});

test("durWords", () => {
  assert.equal(durWords(null), "-");
  assert.equal(durWords(42), "42 s");
  assert.equal(durWords(150), "3 min");
  assert.equal(durWords(3900), "1 h 05");
});

test("zurichTime / visitLine: Swiss time, contacts as letters, every step with its time", () => {
  assert.equal(zurichTime("2026-11-08T10:21"), "2026-11-08 11:21");
  assert.equal(zurichTime("2026-07-08T10:21:00Z"), "2026-07-08 12:21");
  const [v] = buildVisits([view("2026-11-08T08:00:00Z", "/de-CH/dichtungstechnik.html", "11"), view("2026-11-08T08:02:00Z", PRODUCT, "11")],
    [look("2026-11-08T08:03", "1220251001", "12202510", { qty: 20, step: "moq", minimum: 50, name: "Nivobloc 50" })]);
  const line = visitLine(v, (c) => (c === "11" ? "A" : "?"));
  assert.match(line, /^2026-11-08 09:00 · contact A · 2 min · reached: Checked a price · /);
  assert.match(line, /category "Dichtungstechnik" \(2 min\) > product 12202510 "Nivobloc 50" \[1220251001: Checked 20 - below the minimum of 50\] \(last\)$/);
});
