import assert from "node:assert/strict";
import { test } from "node:test";
import { validateChanges } from "../src/lib/convert/versions";
import {
  MODULE_KINDS, moduleChange, moduleGap, moduleOfChange, newModule, normalizeModule, shopAddress, type Card, type ModuleRef, type ModuleType,
} from "../src/lib/content/studio/kinds/page/modules/model";
import { MODULE_MAX, href, minifyCss, moduleParts, renderModule, sharpImg } from "../src/lib/content/studio/kinds/page/modules/render";
import { countOf, findNode, numbersIn, parseCategory, parseMenu, parseProduct, tilePhotos } from "../src/lib/content/studio/kinds/page/modules/parse";
import { candidatesIn, cleanPick, moduleFillUser } from "../src/lib/content/studio/kinds/page/modules/ai";
import { blockOrder, normalizeFields } from "../src/lib/content/studio/kinds/page/fields";
import { renderNewPage } from "../src/lib/content/studio/kinds/page/newpage";

// Content v6 (SARCLA 09.11.2026, points 7-9): "a gallery of forms like bentos and much more", "fill ... by hierarchy, most
// viewed / most bought, by article or product number, with AI". Modules from the home page kit, drawn as ONE element with
// every rule under its own class, filled with the shop's own products only.

const B = "https://www.apsoparts.com";
const IMG = `${B}/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/01/01/11400101.jpg`;
const product = (n: number): Card => ({
  kind: "product", name: `HITEC® O-Ring NBR 70.10-0${n} Hochleistungsdichtung`,
  url: `${B}/de-CH/1140010${n}-hitecr-o-ring-dw-epdm-70-503-00-nachfolge-von-hitecr-o-ring-epdm-70-10-02.html`, img: IMG, meta: "702 Artikel", number: `1140010${n}`, children: [],
});
const category = (n: number, kids: Card[]): Card => ({
  kind: "category", name: `Kategorie ${n}`, url: `${B}/de-CH/dichtungstechnik/kategorie-${n}.html`,
  img: `${B}/media/catalog/category/std.lang.all/43/98/resize/540-null/31439${n}.jpg`, meta: "31 Produkte", number: "", children: kids,
});

function filled(type: ModuleType): ModuleRef {
  const m = newModule(type, "de-CH", "mtest");
  const s = m.settings;
  s.eyebrow = "Sortiment"; s.title = "Dichtungstechnik"; s.text = "Zeile darunter."; s.link = { label: "Alle anzeigen", url: `${B}/de-CH/dichtungstechnik.html` };
  s.link2 = { label: "Schnellbestellung", url: `${B}/de-CH/quickorder/` };
  const k = MODULE_KINDS.find((x) => x.id === type)!;
  if (k.takes === "products") s.items = [1, 2, 3, 4, 5, 6, 7, 8].map(product).slice(0, k.max);
  if (k.takes === "categories") s.items = [1, 2, 3, 4, 5, 6].map((n) => category(n, [1, 2, 3, 4].map(product))).slice(0, type === "finder" ? 5 : k.max);
  s.feature = category(9, []);
  s.faq = [{ q: "Gibt es Zuschläge?", a: "Nein.\n\n- Keine Zuschläge\n- Echtzeit-Preise" }];
  return normalizeModule(m)!;
}

/** every selector of a stylesheet (inside @media too) */
function selectors(css: string): string[] {
  const out: string[] = [];
  const body = css.replace(/@media[^{]+\{/g, "");
  for (const m of body.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    // split at the commas between selectors, not those inside :is( , ) or :has( , )
    let depth = 0, cur = "";
    for (const ch of m[1]) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && !depth) { out.push(cur.trim()); cur = ""; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}

test("every module is ONE element, every rule under its own class, no script - a version takes it as it is", () => {
  for (const k of MODULE_KINDS) {
    const m = filled(k.id);
    for (const layout of k.layouts.map((l) => l.key)) {
      const mm = { ...m, settings: { ...m.settings, layout } };
      const html = renderModule(mm);
      assert.match(html, /^<div class="apx-mtest" data-apx-module="[a-z0-9-]+"><style>/, `${k.id}: one root with its style first`);
      assert.ok(html.endsWith("</div>"));
      const css = /<style>([\s\S]*?)<\/style>/.exec(html)![1];
      for (const sel of selectors(css)) assert.ok(sel.startsWith(".apx-mtest"), `${k.id}/${layout}: "${sel}" is not under the module's class`);
      assert.doesNotMatch(html, /<script|\son[a-z]+=|javascript:/i, `${k.id}: no script`);
      assert.match(css, /@media \(max-width:900px\)/, `${k.id}: a phone rule`);
      const v = validateChanges([{ op: "insert", selector: "#maincontent .column.main", where: "prepend", html }]);
      assert.deepEqual(v.problems, [], `${k.id}/${layout}: ${v.problems.join("; ")}`);
      assert.ok(html.length <= MODULE_MAX, `${k.id}/${layout}: ${html.length} bytes - over a version's 20 KB per element`);
      assert.doesNotMatch(html.replace(/<style>[\s\S]*?<\/style>/, ""), /CHF|EUR|€|\d+\s*%/, `${k.id}: never a price or a discount`);
    }
  }
});

test("the finder's panels follow the mouse with CSS only: one panel per category, the first shown", () => {
  const html = renderModule(filled("finder"));
  assert.equal((html.match(/class="am-pn"/g) ?? []).length, 5);
  assert.equal((html.match(/class="am-it"/g) ?? []).length, 5);
  assert.match(html, /\.apx-mtest \.am-pn:first-child\{clip-path:inset\(-30px\)\}/);
  assert.match(html, /:has\(\.am-it:nth-child\(5\):is\(:hover,:focus-visible\)\) \.am-pn:nth-child\(5\)/);
});

test("links are written from the page's own host, pictures stay on www (ACC lacks media); product photos the sharp 500 px", () => {
  assert.equal(href(`${B}/de-CH/x.html`), "/de-CH/x.html");
  assert.equal(href("https://acc.apsoparts.com/de-CH/x.html"), "/de-CH/x.html");
  const html = renderModule(filled("row"));
  assert.match(html, /href="\/de-CH\/11400101-/);
  assert.match(html, /src="https:\/\/www\.apsoparts\.com\/media\/catalog\/product\/cache\/74c1057f7991b4edb2bc7bdaa94de933\//);
  assert.equal(sharpImg(IMG).includes("74c1057f"), true);
  // a type number never breaks at its hyphen
  assert.match(html, /70\.10‑01/);
});

test("the interface words follow the store view's language", () => {
  assert.match(moduleParts(filled("row")).css, /content:"Zum Produkt"/);
  const en = filled("row"); en.settings.store = "en-INT";
  assert.match(moduleParts(en).css, /content:"View product"/);
  const fr = filled("mosaic"); fr.settings.store = "fr-CH";
  assert.match(renderModule(fr), /Tous les produits/);
});

test("a module keeps only the shop's addresses and pictures; lists capped; an unknown layout put right", () => {
  const raw = filled("row");
  const bad = {
    ...raw, settings: {
      ...raw.settings, layout: "zigzag",
      items: [...raw.settings.items, { kind: "product", name: "Fake", url: "https://evil.example.com/x", img: IMG, meta: "", number: "", children: [] },
        { kind: "product", name: "Bad pic", url: `${B}/de-CH/12345678-x.html`, img: "javascript:alert(1)", meta: "", number: "12345678", children: [] }],
    },
  };
  const n = normalizeModule(bad)!;
  assert.equal(n.settings.layout, "scroll");
  assert.ok(!n.settings.items.some((c) => c.url.includes("evil")));
  assert.ok(n.settings.items.length <= 12);
  assert.equal(shopAddress("https://www.apsoparts.com/de-CH/a.html"), "https://www.apsoparts.com/de-CH/a.html");
  assert.equal(shopAddress("/de-CH/a.html"), "/de-CH/a.html");
  assert.equal(shopAddress("https://example.com/"), "");
  assert.equal(normalizeModule({ type: "nope", settings: {} }), null);
});

test("a module says what it still needs; empty ones are never ready", () => {
  assert.match(moduleGap(newModule("row", "de-CH")), /products/);
  assert.match(moduleGap(newModule("finder", "de-CH")), /categories/);
  assert.match(moduleGap(newModule("banner", "de-CH")), /headline/);
  assert.match(moduleGap(newModule("faq", "de-CH")), /question/);
  assert.equal(moduleGap(newModule("usp", "de-CH")), "", "the shop's four promises are there from the start (de)");
  assert.equal(moduleGap(filled("row")), "");
});

test("on a page of the shop a module is a change with its settings beside it (the shared interface)", () => {
  const m = filled("bento");
  const html = renderModule(m);
  const ins = moduleChange(m, { how: "insert", selector: ".category-tiles", where: "after" }, html);
  assert.equal(ins.op, "insert");
  assert.equal(moduleOfChange(ins)?.type, "bento");
  const rep = moduleChange(m, { how: "replace", selector: ".page-title-wrapper" }, html);
  assert.equal(rep.op, "replace");
  assert.equal(moduleOfChange(rep)?.settings.title, "Dichtungstechnik");
  assert.equal(moduleOfChange({ op: "css", css: "a{}" }), null);
  // what goes to the shop is the validated change - without the settings
  assert.equal("module" in validateChanges([ins]).changes[0], false);
});

test("CSS written readably, sent small", () => {
  assert.equal(minifyCss("@@ .a { color : red ; }\n/* x */\n@@ .b > .c , @@ .d{ x: y }"), "@@ .a{color : red}@@ .b>.c,@@ .d{x: y}");
});

/* ── the shop's pages, read ──────────────────────────────────────────── */

const MENU = `<ul><li class="level0 nav-1 category-item first parent level-top"><a href="https://www.apsoparts.com/de-CH/dichtungstechnik.html" class="level-top"><span>Dichtungstechnik</span></a>
<ul class="level0 submenu"><li class="level1 nav-1-1 category-item first parent"><a href="https://www.apsoparts.com/de-CH/dichtungstechnik/o-ringe-x-ringe.html"><span>O-Ringe / X-Ringe</span></a>
<ul><li class="level2 nav-1-1-1 category-item first"><a href="https://www.apsoparts.com/de-CH/dichtungstechnik/o-ringe-x-ringe/o-ring-ffkm.html"><span>O-Ring FFKM</span></a></li>
<li class="level3 nav-1-1-1-1 category-item"><a href="https://www.apsoparts.com/de-CH/deep.html"><span>Deep</span></a></li></ul></li></ul></li>
<li class="level0 nav-2 category-item parent level-top"><a href="https://www.apsoparts.com/de-CH/kunststofftechnik.html"><span>Kunststofftechnik</span></a></li>
<li class="level0 nav-1 category-item"><a href="https://www.apsoparts.com/de-CH/dichtungstechnik.html"><span>Dichtungstechnik</span></a></li></ul>`;

test("the category tree comes from the shop's own menu - three levels, each once", () => {
  const t = parseMenu(MENU);
  assert.deepEqual(t.map((n) => n.name), ["Dichtungstechnik", "Kunststofftechnik"]);
  assert.equal(t[0].children[0].name, "O-Ringe / X-Ringe");
  assert.equal(t[0].children[0].children.length, 1, "level 3 left out");
  assert.equal(findNode(t, `${B}/de-CH/dichtungstechnik/o-ringe-x-ringe/o-ring-ffkm.html`)?.name, "O-Ring FFKM");
});

const CATEGORY = `<h1 class="page-title"><span class="base">O-Ringe / X-Ringe</span></h1>
<div class="filter-product-count container">31 Produkte / 31.264 Artikel</div>
<div class="category-tiles"><div><a href="https://www.apsoparts.com/de-CH/dichtungstechnik/o-ringe-x-ringe/o-ring-ffkm.html" data-link-type="default"><div class="pagebuilder-banner-wrapper" style="background-image: url('https://www.apsoparts.com/media/catalog/category/std.lang.all/43/98/resize/540-null/314398.jpg')"><div><h3 class="subcategory-image-label">O-Ring FFKM</h3></div></div></a></div></div>
<ol class="products list"><li class="item product product-item"><div class="product-item-info"><a href="https://www.apsoparts.com/de-CH/11400101-hitecr-o-ring.html" class="product photo product-item-photo"><img class="product-image-photo" src="https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/01/01/11400101.jpg" alt="x"/></a>
<strong class="product name product-item-name"><a class="product-item-link" href="https://www.apsoparts.com/de-CH/11400101-hitecr-o-ring.html">HITEC&reg; O-Ring DW EPDM 70.503-00</a></strong><div class="product-item-article-count">Dieses Produkt hat 702 Artikel.</div><span class="price">CHF 1.20</span></div></li></ol>`;

test("a category page: its name, count, subcategory tiles and products - never a price", () => {
  const c = parseCategory(CATEGORY, `${B}/de-CH/dichtungstechnik/o-ringe-x-ringe.html`);
  assert.equal(c.name, "O-Ringe / X-Ringe");
  assert.equal(c.count, "31 Produkte");
  assert.equal(c.subs.length, 1);
  assert.equal(c.subs[0].img, `${B}/media/catalog/category/std.lang.all/43/98/resize/540-null/314398.jpg`);
  assert.equal(c.products.length, 1);
  assert.deepEqual({ ...c.products[0], children: undefined }, {
    kind: "product", name: "HITEC® O-Ring DW EPDM 70.503-00", url: `${B}/de-CH/11400101-hitecr-o-ring.html`,
    img: `${B}/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/01/01/11400101.jpg`, meta: "702 Artikel", number: "11400101", children: undefined,
  });
  assert.doesNotMatch(JSON.stringify(c), /CHF/);
  assert.equal(countOf("This product has 1,560 articles."), "1,560 articles");
});

test("a product page: its own name, photo, address and article count", () => {
  const html = `<meta property="og:type" content="product"><meta property="og:title" content="PTFE Rundstab natur (weiss)">
<meta property="og:image" content="https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/22/33/22334455.jpg">
<meta property="og:url" content="https://www.apsoparts.com/de-CH/22334455-ptfe-rundstab.html">
<div class="product-item-article-count">Dieses Produkt hat 9 Artikel.</div>
<div class="articles" data-sticky-id="1"><div class="product__section__headline__wrapper"><h2 class="product__section__headline product__section__headline--technical">42 Artikel</h2></div></div>`;
  const p = parseProduct(html, `${B}/de-CH/22334455-ptfe-rundstab.html`)!;
  assert.equal(p.name, "PTFE Rundstab natur (weiss)");
  assert.equal(p.number, "22334455");
  assert.equal(p.meta, "42 Artikel", "its own count, not a related product's");
  assert.equal(parseProduct(`<meta property="og:type" content="website"><meta property="og:title" content="Home">`, `${B}/de-CH/`), null);
});

test("the photos a page puts on its links (the home page's technology tiles)", () => {
  const home = `<a href="https://www.apsoparts.com/de-CH/dichtungstechnik.html" class="level-top"><span>Dichtungstechnik</span></a>
<a href="https://www.apsoparts.com/de-CH/dichtungstechnik.html" data-element="link"><div class="pagebuilder-banner-wrapper" data-background-images='{\\"desktop_image\\":\\"https://www.apsoparts.com/media/wysiwyg/1_Sealing_Technology_1.jpg\\"}'><div>${"x".repeat(1500)}</div></div></a>`;
  assert.equal(tilePhotos(home)[`${B}/de-CH/dichtungstechnik.html`], `${B}/media/wysiwyg/1_Sealing_Technology_1.jpg`);
});

test("pasted numbers: 8-digit products, 10-digit articles (dots and spaces inside ignored), the rest said", () => {
  assert.deepEqual(numbersIn("11400101, 1140010100\n12.20.25.10; abc 11400101"), { products: ["11400101", "12202510"], articles: ["1140010100"], other: ["abc"] });
});

/* ── Fill with AI: only what it was shown ─────────────────────────────── */

test("Fill with AI keeps only the numbers it was shown, once each, at most as many as asked; no price or discount words", () => {
  const cands = candidatesIn([
    { number: "11400101", name: "HITEC O-Ring", views: 900, bought: 40, from: "bought" },
    { number: "22334455", name: "PTFE Rundstab", views: 300, bought: 2, from: "viewed" },
    { number: "33445566", name: "POM-C Platte", views: 10, bought: 0, from: "category" },
    { number: "bad", name: "x" },
  ]);
  assert.equal(cands.length, 3);
  // a canned answer: an invented number, a repeat, one too many
  const canned = { picks: [{ number: "99999999" }, { number: "22334455" }, { number: "22334455" }, { number: "11400101" }, { number: "33445566" }], eyebrow: "Beliebt", title: "Jetzt 20% Rabatt", why: "The best sellers." };
  const r = cleanPick(canned, cands, 2);
  assert.deepEqual(r.picks, ["22334455", "11400101"]);
  assert.equal(r.title, "", "a discount is never written");
  assert.equal(r.eyebrow, "Beliebt");
  const user = moduleFillUser("PAGE: x", { type: "row", count: 4, ask: "für Lebensmittel", candidates: cands });
  assert.match(user, /11400101 · HITEC O-Ring · 900 views · 40 bought · bought/);
  assert.match(user, /it shows 4 products/);
  assert.match(user, /für Lebensmittel/);
});

/* ── a new page: its modules after its blocks ─────────────────────────── */

test("a new page keeps its modules, each after a block; a module still lacking something is a slot in the preview, absent in Magento", () => {
  const f = normalizeFields({
    hero: { title: "O-Ringe" }, intro: "Kurz.", order: ["hero", "intro"],
    modules: [
      { id: "ab12", after: "intro", module: filled("row") },
      { id: "cd34", after: "", module: newModule("row", "de-CH", "mempty") },
      { id: "ef56", after: "faq", module: filled("usp") },
      { id: "bad id!", after: "intro", module: filled("row") },
      { id: "gh78", after: "intro", module: { type: "nope" } },
    ],
  });
  assert.deepEqual(f.modules!.map((x) => x.id), ["ab12", "cd34", "ef56"]);
  const preview = renderNewPage(f, { marks: true }).html;
  const magento = renderNewPage(f).html;
  // after the intro block, the row; the empty one at the top only as a slot; one whose block is gone at the end
  assert.ok(magento.indexOf('data-apx-module="row"') > magento.indexOf("Kurz."));
  assert.equal((magento.match(/data-apx-module="row"/g) ?? []).length, 1, "the empty row is not in Magento's copy");
  assert.match(preview, /data-apx-mod="cd34" class="apx-np-in"><span class="apx-np-slot">Product row - fill it with products first/);
  assert.ok(magento.lastIndexOf('data-apx-module="usp"') > magento.indexOf('data-apx-module="row"'));
  assert.doesNotMatch(magento, /data-apx-mod=/, "the studio's marks stay out of Magento");
  assert.deepEqual(blockOrder(f), ["hero", "intro"], "the blocks' order is the blocks'");
  assert.equal(normalizeFields({ hero: { title: "x" } }).modules, undefined, "a page without modules has none");
});

test("a store view in another currency keeps its visitors there (the Swiss shop's EUR)", () => {
  const m = filled("row");
  m.settings.store = "de-CH/eur";
  const html = renderModule(m);
  assert.match(html, /href="\/de-CH\/eur\/11400101-/);
  assert.match(html, /content:"Zum Produkt/);
  assert.equal(href(`${B}/de-CH/x.html`), "/de-CH/x.html", "outside a drawing, links stay as they are");
});
