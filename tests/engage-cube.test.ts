import assert from "node:assert/strict";
import { test } from "node:test";
import { engageSeries, engageTable, engageYtd, lostPath, madeToOrderIn, minSec, productTable, searchKind, searchSample, searchTool, siteSearchGa4, toolTotals, viewPage, viewsByPc, type EngageData } from "../src/lib/marketingKpis/engageCube";
import { lostReason } from "../src/lib/datatracker/rules";

const m24 = (cells: Record<number, number>) => Array.from({ length: 24 }, (_, i) => cells[i] ?? 0);

const d: EngageData = {
  generatedAt: "2026-10-19T00:00:00Z", year: 2026, monthsDone: 9,
  months: { "2025-09": [1000, 700, 300000, 500], "2026-09": [1200, 900, 360000, 600] },
  channels: ["Direct", "Organic Search"],
  cube: [
    ["2025-09", "CH", 0, 600, 400, 200000, 300], ["2025-09", "DE", 1, 400, 300, 100000, 200],
    ["2026-09", "CH", 0, 700, 500, 210000, 350], ["2026-09", "DE", 1, 500, 400, 150000, 260],
  ],
  views: { "2025-09": [7000, 900], "2026-09": [5000, 800] },
  products: {
    // index 8 = last September, 20 = this September
    "11400511": { n: "HITEC® O-Ring NBR 70.10-02", pc: "DT", v: m24({ 8: 300, 20: 900 }), b: m24({ 8: 2, 20: 3 }) },
    "11411201": { n: "NORMATEC® O-Ring NBR", pc: "DT", v: m24({ 20: 100 }) },
    "02320011": { n: "POM rod", pc: "KT", v: m24({ 8: 50, 20: 400 }), b: m24({ 19: 1 }) },
    "99999999": { n: "Gone", pc: null, v: m24({ 20: 10 }) },
  },
  lists: { DT: m24({ 8: 1000, 20: 2000 }), search: m24({ 20: 500 }) },
  bought: { DT: m24({ 8: 4, 20: 6 }), KT: m24({ 19: 1 }), other: m24({ 20: 2 }) },
  madeToOrder: m24({ 20: 7 }),
  unmapped: 0,
  events: {
    "2025-09": { directup_form_submit_manualupload: [200, 40], view_search_results: [2000, 300], search_results_click: [500, 120] },
    "2026-09": { directup_form_submit_manualupload: [220, 42], directup_form_submit: [8, 2], oring_expert_add_to_cart: [2, 1], view_search_results: [1500, 260], search_results_click: [600, 150] },
  },
  search: { days: 365, since: "2026-07-05", total: 3000, zero: 300, byMonth: { "2026-09": [400, 340] }, byLocale: [], top: [], gaps: [], sample: null },
  prices: { since: "2026-09-30", byDay: [["2026-10-01", 4, 3], ["2026-10-02", 2, 1]], byTeam: { ESO: 5, TSA: 1 }, companies: 5, moq: { byDay: [], rows: [], total: 0 }, shelf: { byDay: [], rows: [], total: 0 } },
  tools: [],
  errors: {},
};

test("engagement per month: engaged sessions, sessions, seconds, users - exact, or from the cube when filtered", () => {
  const s = engageSeries(d, 2026);
  assert.equal(s.E02N.months[8], 900);
  assert.equal(s.E02D.months[8], 1200);
  assert.equal(s.E01N.months[8], 300);           // bounced = sessions - engaged
  assert.equal(s.E03S.months[8], 360000);
  assert.equal(s.E03U.py[8], 500);
  assert.equal(s.E02.months[8], 0.75);              // the ratios month by month, for the cards
  assert.equal(s.E01.months[8], 0.25);
  assert.equal(s.E03.months[8], 600);
  const de = engageSeries(d, 2026, { country: ["de"] });
  assert.equal(de.E02D.months[8], 500);
  assert.equal(de.E02N.months[8], 400);
  assert.equal(engageSeries(d, 2026, { channel: ["Direct"] }).E03S.months[8], 210000);
});

test("article views, smart-bar searches (and those that found nothing), the tools", () => {
  const s = engageSeries(d, 2026);
  assert.equal(s.E04.months[8], 5000);
  assert.equal(s.E04.py[8], 7000);
  assert.equal(s.E05.months[8], 400);
  assert.equal(s.E05N.months[8], 60);
  assert.equal(s.E05Z.months[8], 0.15);
  assert.equal(s.E06.months[8], 230);              // uploads + requests + O-ring
  assert.equal(s.E06.py[8], 200);
  const t = toolTotals(d, 2026, [8]);
  assert.deepEqual(t.map((x) => [x.count, x.pyCount]), [[220, 200], [8, 0], [2, 0]]);
  assert.deepEqual(siteSearchGa4(d, 2026, [8]), { searches: 1500, clicks: 600, pySearches: 2000, pyClicks: 500, searchers: 260 });
});

test("price checks since the tracker started; engagement by channel and country; minutes", () => {
  assert.equal(engageYtd(d).E07.cy, 6);
  assert.equal(engageYtd({ ...d, prices: null }).E07.cy, null);
  const ch = engageTable(d, 2026, [8], "channel");
  assert.deepEqual(ch.map((r) => [r.key, r.sessions, r.engaged, r.pySessions]), [["Direct", 700, 500, 600], ["Organic Search", 500, 400, 400]]);
  assert.deepEqual(engageTable(d, 2026, [8], "country").map((r) => r.label), ["Switzerland", "Germany"]);
  assert.equal(minSec(281), "4 min 41 s");
  assert.equal(minSec(65), "1 min 05 s");
});

test("the page a view_item fired on: a product page, a category list by its profit centre, the search results", () => {
  assert.deepEqual(viewPage("/de-CH/02320001-pom-c-platte-natur-weiss-1-5-100-mm.html"), { kind: "product", product: "02320001" });
  assert.deepEqual(viewPage("/de-DE/eur/dichtungstechnik/o-ringe-x-ringe.html"), { kind: "list", pc: "DT" });
  assert.deepEqual(viewPage("/it-IT/tecnologia-delle-materie-plastiche.html"), { kind: "list", pc: "KT" });
  assert.deepEqual(viewPage("/fr-CH/directcut-configurator"), { kind: "list", pc: "KT" });
  assert.deepEqual(viewPage("/de-CH/catalogsearch/result/?q=pom"), { kind: "search" });
  assert.deepEqual(viewPage("/de-CH/catalog/product/view/id/123"), { kind: "other" });
});

test("article views by profit centre: category lists and product pages, those on a product bought - they add up to every view", () => {
  const rows = viewsByPc(d, 2026, [8]);
  assert.deepEqual(rows.map((r) => [r.key, r.views, r.pyViews, r.productViews, r.products, r.productsBought, r.viewsBought, r.pyViewsBought]), [
    ["DT", 3000, 1300, 1000, 2, 1, 900, 300],   // 2,000 on its category lists + 1,000 on two product pages
    ["KT", 400, 50, 400, 1, 0, 0, 0],           // bought in August, not in September
    ["search", 500, 0, 0, 0, 0, 0, 0],          // the search results: no profit centre, last but one
    ["other", 10, 0, 10, 1, 0, 0, 0],           // a product Products & Pricing does not know: last
  ]);
  assert.equal(rows.reduce((a, r) => a + r.views, 0), 2000 + 500 + 900 + 100 + 400 + 10);
  // the articles bought online by profit centre, their product page viewed or not
  assert.deepEqual(rows.map((r) => [r.key, r.bought, r.pyBought]), [["DT", 6, 4], ["KT", 0, 0], ["search", 0, 0], ["other", 2, 0]]);
  assert.equal(viewsByPc(d, 2026, [7, 8]).find((r) => r.key === "KT")?.viewsBought, 400);
  assert.equal(madeToOrderIn(d, 2026, [8]), 7);
  assert.deepEqual(productTable(d, 2026, [8]).map((r) => [r.id, r.views, r.bought]), [["11400511", 900, 3], ["02320011", 400, 0], ["11411201", 100, 0], ["99999999", 10, 0]]);
  assert.deepEqual(productTable(d, 2026, [8], { bought: false, pc: ["DT"] }).map((r) => r.id), ["11411201"]);
});

test("a search that found nothing: half typed, or a number, a code, words, pasted text - a password is never shown", () => {
  assert.equal(searchKind("13 0104 3220"), "number");
  assert.equal(searchKind("epgc30"), "code");
  assert.equal(searchKind("distanzscheibe"), "words");
  assert.equal(searchKind("ich brauche ein lager für eine moboil"), "long");
  const at = (s: number) => `2026-10-19T10:00:${String(s).padStart(2, "0")}.000Z`;
  const x = searchSample([
    { text: "haltegri", norm: "haltegri", locale: "de-CH", hits: 0, at: at(1) },
    { text: "haltegriff", norm: "haltegriff", locale: "de-CH", hits: 5, at: at(3) },
    { text: "402055", norm: "402055", locale: "de-CH", hits: 0, at: at(10) },
    { text: "402055", norm: "402055", locale: "de-DE", hits: 0, at: at(20) },
    { text: "passwort: wa24ta08", norm: "passwort: wa24ta08", locale: "de-DE", hits: 0, at: at(30) },
    { text: "pom", norm: "pom", locale: "fr-CH", hits: 12, at: at(40) },
  ])!;
  assert.deepEqual([x.searches, x.nothing, x.typing], [6, 4, 1]);
  assert.deepEqual(x.kinds, { number: 2, code: 1, words: 0, long: 0 });
  assert.deepEqual(x.examples.number, [{ text: "402055", n: 2 }]);
  assert.deepEqual(x.examples.code, []);
});

test("where a look that ended in no order was lost - the first reason that applies", () => {
  const look = (x: Partial<{ qty: number | null; carted: boolean; stock: number | null; minimum: number | null }>) => ({ qty: null, carted: false, stock: null, minimum: null, ...x });
  assert.equal(lostReason(look({ qty: 50, stock: 0, minimum: 100, carted: true })), "shelf");    // nothing on the shelf comes first
  assert.equal(lostReason(look({ qty: 50, stock: 20 })), "shelf");                                // less than asked
  assert.equal(lostReason(look({ qty: 50, stock: null, minimum: 100 })), "moq");                  // an unknown stock is not empty
  assert.equal(lostReason(look({ qty: 500, stock: 1000, carted: true })), "cart");
  assert.equal(lostReason(look({ qty: 5, stock: 1000 })), "price");
  assert.equal(lostReason(look({ stock: 0 })), "shelf");
  assert.equal(lostReason(look({ stock: 1000 })), "looked");
  assert.equal(lostReason(look({ qty: 1, stock: 1000, minimum: 100 })), "looked");                // a bare 1 is no quantity typed
});

test("the search bar as one of the tools: its searches each day and those that found something", () => {
  const t = searchTool({ ...d, search: { ...d.search!, byDay: [["2026-07-05", 100, 70], ["2026-07-06", 50, 40]] } })!;
  assert.deepEqual([t.key, t.since, t.unit, t.unit2, t.days.length, t.onShop], ["search", "2026-07-05", "Searches", "Found something", 2, true]);
  assert.equal(searchTool({ ...d, search: null, errors: {} }), null);
  assert.equal(searchTool({ ...d, search: null, errors: { search: "timeout" } })?.error, "timeout");
});

test("where we lost them as a path: each look stops at one step, the ordered pass every step - each column adds up", () => {
  const p = lostPath({ looks: { shelf: 879, moq: 10, cart: 1077, price: 184, looked: 947 }, ordered: 2285 });
  const v = (from: string, to: string) => p.links.find((x) => x.from === from && x.to === to)?.value;
  assert.equal(p.columns.length, 5);
  assert.equal(v("all", "shelf-ok")! + v("all", "shelf")!, 5382);
  assert.deepEqual([v("shelf-ok", "typed"), v("shelf-ok", "looked")], [5382 - 879 - 947, 947]);
  assert.deepEqual([v("typed", "cart-in"), v("typed", "moq"), v("typed", "price")], [2285 + 1077, 10, 184]);
  assert.deepEqual([v("cart-in", "won"), v("cart-in", "cart")], [2285, 1077]);
  // a step nobody stopped at draws no band and no node
  const q = lostPath({ looks: { shelf: 5, moq: 0, cart: 2, price: 1, looked: 3 }, ordered: 4 });
  assert.equal(q.nodes.some((n) => n.id === "moq"), false);
  assert.equal(q.links.some((x) => x.to === "moq"), false);
});

test("the search bar card falls back to its months when a read has no days", () => {
  const t = searchTool({ ...d, search: { ...d.search!, byDay: undefined, byMonth: { "2026-07": [100, 70], "2026-08": [200, 150] } } })!;
  assert.deepEqual([t.days.length, t.months], [0, [["2026-07", 100, 70], ["2026-08", 200, 150]]]);
});
