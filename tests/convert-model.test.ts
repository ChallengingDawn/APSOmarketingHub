import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classify, storeCase, funnelOf, looksByProduct, nameFromRest, parseSitemap, productNumber, rankProblems, sitemapList, sortProblems,
  typicalRates, type ShopLook,
} from "../src/lib/convert/model";

test("classify: home, category, product, CMS page, shop function", () => {
  assert.deepEqual(classify("https://www.apsoparts.com/de-CH/"), { path: "/de-CH/", store: "de-CH", rest: "", kind: "home", product: null });
  assert.equal(classify("https://www.apsoparts.com/de-CH/dichtungstechnik/o-ringe-x-ringe.html").kind, "category");
  const p = classify("https://www.apsoparts.com/de-CH/12202510-apsovibr-maschinenfuss-nivobloc.html");
  assert.equal(p.kind, "product");
  assert.equal(p.product, "12202510");
  assert.equal(classify("/fr-CH/privacy").kind, "cms");
  assert.equal(classify("/de-CH/checkout/cart/").kind, "system");
  assert.equal(classify("/de-CH/catalogsearch/result/").kind, "system");
  assert.equal(classify("/de-CH/catalog/category/view/id/7939").kind, "category");
  // a store view with a currency segment
  assert.deepEqual(classify("/de-CH/eur/antriebstechnik.html").store, "de-CH/eur");
  // nine digits are not a product number
  assert.equal(classify("/de-CH/123456789-x.html").kind, "category");
  assert.equal(classify("/").kind, "home");
});

test("sitemapList: robots.txt's, moved to the environment's host, plus the known names, once each", () => {
  const robots = "User-agent: *\nSitemap: https://www.apsoparts.com/media/sitemaps/switzerland_chf_de.xml\nSitemap: https://www.apsoparts.com/media/sitemaps/france_eur_fr.xml\n";
  const acc = sitemapList(robots, "https://acc.apsoparts.com");
  assert.equal(acc[0], "https://acc.apsoparts.com/media/sitemaps/switzerland_chf_de.xml");
  assert.ok(acc.includes("https://acc.apsoparts.com/media/sitemaps/switzerland_chf_it.xml"));
  assert.equal(new Set(acc).size, acc.length);
  // ACC's robots.txt names none: the known names alone
  assert.equal(sitemapList("User-agent: *\nDisallow: /", "https://acc.apsoparts.com").length, 8);
});

test("parseSitemap: a urlset, an index, and the placeholder picture a missing name answers with", () => {
  const set = `<?xml version="1.0"?><urlset xmlns="x"><url><loc>https://www.apsoparts.com/de-CH/</loc><changefreq>daily</changefreq></url>
    <url><loc>https://www.apsoparts.com/de-CH/a.html?x=1&amp;y=2</loc><lastmod>2021-06-16T14:40:08+00:00</lastmod></url></urlset>`;
  const s = parseSitemap(set);
  assert.equal(s.kind, "urlset");
  assert.equal(s.entries.length, 2);
  assert.equal(s.entries[0].lastmod, null);
  assert.equal(s.entries[1].loc, "https://www.apsoparts.com/de-CH/a.html?x=1&y=2");
  assert.equal(s.entries[1].lastmod, "2021-06-16T14:40:08+00:00");
  const idx = parseSitemap(`<sitemapindex><sitemap><loc>https://x/a.xml</loc></sitemap></sitemapindex>`);
  assert.equal(idx.kind, "index");
  assert.equal(idx.entries[0].loc, "https://x/a.xml");
  assert.equal(parseSitemap("\xff\xd8\xff\xe0 JFIF").kind, "not-a-sitemap");
});

test("productNumber and nameFromRest", () => {
  assert.equal(productNumber("12202510"), "12202510");
  assert.equal(productNumber("6532618"), "06532618");
  assert.equal(productNumber("12202510.0"), "12202510");
  assert.equal(productNumber("1220251012"), null);
  assert.equal(productNumber(null), null);
  assert.equal(nameFromRest("12202510-apsovibr-maschinenfuss-nivobloc.html"), "apsovibr maschinenfuss nivobloc");
});

const L = (company: string, day: string, step: ShopLook["step"], product = "12202510", article = "1220251001"): ShopLook => ({ company, article, product, day, step });

test("funnelOf: each company once, at the furthest step it reached", () => {
  const f = funnelOf([
    L("a", "2026-10-03", "looked"), L("a", "2026-10-04", "price"),
    L("b", "2026-10-03", "cart"), L("b", "2026-10-05", "won"),
    L("c", "2026-10-06", "price"),
    L("d", "2026-10-06", "shelf"),
  ]);
  assert.equal(f.companies, 4);
  assert.equal(f.looks, 6);
  assert.deepEqual(f.furthest, { shelf: 1, looked: 0, moq: 0, price: 2, cart: 0, won: 1 });
  assert.equal(f.lost, 3);
  assert.equal(f.topLoss, "price");
});

test("looksByProduct keeps the period only", () => {
  const m = looksByProduct([L("a", "2026-10-01", "price"), L("a", "2026-10-10", "price"), L("b", "2026-10-31", "won", "11111111")], "2026-10-02", "2026-10-31");
  assert.equal(m.get("12202510")?.length, 1);
  assert.equal(m.get("11111111")?.length, 1);
});

test("typicalRates: the views-weighted median per kind, pages with enough views only", () => {
  const t = typicalRates([
    { kind: "product", views: 1000, addToCarts: 100 },
    { kind: "product", views: 100, addToCarts: 50 },
    { kind: "product", views: 50, addToCarts: 50 }, // too few views
    { kind: "category", views: 500, addToCarts: 5 },
  ], 100);
  assert.equal(t.product, 0.1);
  assert.equal(t.category, 0.01);
  assert.equal(t.cms, null);
});

test("rankProblems: a product is one page across its languages, the reasons say why, shop functions are left out", () => {
  const traffic = [
    { path: "/de-CH/12202510-maschinenfuss.html", views: 900, sessions: 800, addToCarts: 9 },
    { path: "/fr-CH/12202510-pied-de-machine.html", views: 300, sessions: 280, addToCarts: 3 },
    { path: "/de-CH/33333333-good.html", views: 1000, sessions: 900, addToCarts: 150 },
    { path: "/de-CH/44444444-fine.html", views: 800, sessions: 700, addToCarts: 100 },
    { path: "/de-CH/checkout/cart/", views: 5000, sessions: 4000, addToCarts: 0 },
  ];
  const shop = new Map<string, ShopLook[]>([["12202510", [L("a", "2026-10-03", "price"), L("b", "2026-10-03", "price"), L("c", "2026-10-03", "won"), L("d", "2026-10-04", "looked")]]]);
  const { pages, typical } = rankProblems(traffic, shop, { minViews: 100, minCompanies: 3 });
  assert.equal(pages.find((p) => p.path.includes("checkout")), undefined);
  const p = pages.find((x) => x.key === "product:12202510")!;
  assert.equal(p.views, 1200);
  assert.equal(p.addToCarts, 12);
  assert.equal(p.paths.length, 2);
  assert.equal(p.path, "/de-CH/12202510-maschinenfuss.html");
  assert.ok(typical.product! > 0.1);
  assert.equal(p.reasons.length, 2);
  assert.match(p.reasons[0], /1,200 views, 1\.0% put something in the cart/);
  assert.match(p.reasons[1], /3 of 4 customers who opened it did not order - 2 stopped at "priced and left"/);
  assert.ok(p.missed > 100);
  const good = pages.find((x) => x.key === "product:33333333")!;
  assert.equal(good.reasons.length, 0);
  assert.equal(good.missed, 0);
  assert.equal(sortProblems(pages, "missed")[0].key, "product:12202510");
  assert.equal(sortProblems(pages, "lost")[0].key, "product:12202510");
});

test("rankProblems: a product only the shop's record knows is still on the list", () => {
  const shop = new Map<string, ShopLook[]>([["55555555", [L("a", "2026-10-03", "cart", "55555555"), L("b", "2026-10-03", "cart", "55555555"), L("c", "2026-10-03", "cart", "55555555")]]]);
  const { pages } = rankProblems([], shop, { minViews: 100, minCompanies: 3 });
  assert.equal(pages.length, 1);
  assert.equal(pages[0].views, 0);
  assert.equal(pages[0].rate, null);
  assert.match(pages[0].reasons[0], /3 of 3 customers .* "left in the cart"/);
});

test("storeCase: a store code in small letters is written as the shop writes it", () => {
  assert.equal(storeCase("/de-ch/o-ringe.html"), "/de-CH/o-ringe.html");
  assert.equal(storeCase("/fr-ch/"), "/fr-CH/");
  assert.equal(storeCase("/de-ch"), "/de-CH");
  assert.equal(storeCase("/de-CH/12202510-x.html"), "/de-CH/12202510-x.html");
  assert.equal(storeCase("/media/x.jpg"), "/media/x.jpg");
});
