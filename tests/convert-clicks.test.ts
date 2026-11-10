// APSOconvert > the click map's rules (src/lib/convert/clickRules.ts): the gateway's counts made into one heat item per
// element, the element named in words, one map id per page, the days read.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CLICKMAP, dayRange, elementLabel, heatOf, mapIdFor, untilDay, type ClickRow } from "../src/lib/convert/clickRules";

const ROWS: ClickRow[] = [
  { s: "#product-addtocart-button", x: 2, y: 7, dev: "d", n: 30 },
  { s: "#product-addtocart-button", x: 3, y: 7, dev: "m", n: 12 },
  { s: "div.page-title-wrapper > h1.page-title > span.base", x: 0, y: 1, dev: "d", n: 3 },
  { s: "html > body > footer", x: 0, y: 0, dev: "m", n: 1 },
];

test("heatOf: one item per element, the most clicked first, its tenths row by row", () => {
  const h = heatOf(ROWS);
  assert.equal(h.total, 46);
  assert.equal(h.desktop, 33);
  assert.equal(h.phone, 13);
  assert.equal(h.max, 42);
  assert.deepEqual(h.list.map((i) => [i.s, i.n]), [["#product-addtocart-button", 42], ["div.page-title-wrapper > h1.page-title > span.base", 3], ["html > body > footer", 1]]);
  const btn = h.list[0];
  assert.equal(btn.c.length, 100);
  assert.equal(btn.c[7 * 10 + 2], 30);
  assert.equal(btn.c[7 * 10 + 3], 12);
  assert.equal(btn.c.reduce((a, b) => a + b, 0), 42);
});

test("heatOf: desktop or phone only - the split stays the whole page's", () => {
  const d = heatOf(ROWS, "d");
  assert.equal(d.total, 33);
  assert.equal(d.list[0].n, 30);
  assert.equal(d.desktop, 33);
  assert.equal(d.phone, 13);
  const m = heatOf(ROWS, "m");
  assert.deepEqual(m.list.map((i) => i.n), [12, 1]);
});

test("heatOf: bad rows dropped, 40 elements at most, nothing gives an empty heat", () => {
  const bad = [{ s: "a", x: 12, y: 0, dev: "d", n: 5 }, { s: "a", x: 1, y: 1, dev: "d", n: 0 }, { s: 3, x: 1, y: 1, dev: "d", n: 2 }] as unknown as ClickRow[];
  assert.equal(heatOf(bad).list.length, 0);
  const many = Array.from({ length: 60 }, (_, i) => ({ s: `a#e${i}`, x: 1, y: 1, dev: "d" as const, n: i + 1 }));
  const h = heatOf(many);
  assert.equal(h.list.length, CLICKMAP.maxItems);
  assert.equal(h.list[0].n, 60);
  assert.equal(h.total, (60 * 61) / 2, "the total counts every element, shown or not");
  assert.deepEqual(heatOf([]), { list: [], max: 0, total: 0, desktop: 0, phone: 0 });
});

test("elementLabel: what the element is, and its own name", () => {
  assert.equal(elementLabel("#product-addtocart-button"), "Element · product addtocart button");
  assert.equal(elementLabel("form > button#product-addtocart-button"), "Button · product addtocart button");
  assert.equal(elementLabel("div.page-title-wrapper > h1.page-title > span.base"), "Text · base");
  assert.equal(elementLabel("html > body > footer"), "Page footer");
  assert.equal(elementLabel("div.product-info-main > a"), "Link · product info main");
  assert.equal(elementLabel("img"), "Picture");
  // the theme's extra classes stay out of the name
  assert.equal(elementLabel("ul.ui-menu.ui-widget > li.level0.nav-9 > a.level-top.ui-menu-item-wrapper"), "Link · level top");
});

test("mapIdFor: one id per page and host, the gateway's letters, the same every time", () => {
  const a = mapIdFor("www.apsoparts.com", "/de-CH/x.html");
  assert.match(a, /^p-[0-9a-f]{20}$/);
  assert.equal(a, mapIdFor("WWW.apsoparts.com", "/de-CH/x.html"));
  assert.notEqual(a, mapIdFor("acc.apsoparts.com", "/de-CH/x.html"));
  assert.notEqual(a, mapIdFor("www.apsoparts.com", "/fr-CH/x.html"));
});

test("dayRange and untilDay: Swiss days, 1-90 back, 30 ahead", () => {
  assert.deepEqual(dayRange("2026-11-09", 30), { from: "2026-10-11", to: "2026-11-09" });
  assert.deepEqual(dayRange("2026-11-09", 1), { from: "2026-11-09", to: "2026-11-09" });
  assert.deepEqual(dayRange("2026-03-30", 400), { from: "2025-12-31", to: "2026-03-30" });
  assert.equal(untilDay("2026-11-09"), "2026-12-09");
  assert.equal(untilDay("2026-03-20", 30), "2026-04-19", "over the clock change");
});

test("every page (10.11.2026): a page no person switched on is counted by the shop's 'every page'", async () => {
  const { mapOn, everyPage } = await import("../src/lib/convert/clickRules");
  const m = mapOn([], "prod", "/de-CH/any.html", "2026-11-10");
  assert.equal(m.id, "everywhere-www");
  assert.deepEqual(m.paths, ["*"]);
  assert.equal(everyPage("acc").host, "acc.apsoparts.com");
  const own = { id: "x", host: "www.apsoparts.com", paths: ["/de-CH/a.html"], until: "2026-12-01", by: "Claudio" };
  assert.equal(mapOn([own], "prod", "/de-CH/a.html", "2026-11-10").id, "x", "a person's map still says who switched it on");
});
