import assert from "node:assert/strict";
import { test } from "node:test";
import { bannerChange, bannerModule, bannerOn, changeIdFor, hubPicturesAbsolute, shopLinkFor, withBanner, SLIDER_SELECTOR, MAIN_SELECTOR, type BannerOnPage } from "../src/lib/content/studio/kinds/banner/topage";
import { placesIn } from "../src/lib/content/studio/kinds/banner/pagePlaces";
import { moduleOfChange } from "../src/lib/content/studio/kinds/page/modules/model";
import { gapOf } from "../src/lib/content/studio/kinds/page/modules/registry";
import { applyChanges } from "../src/lib/content/studio/kinds/page/apply";
import { validateChanges } from "../src/lib/convert/versions";

// Content v7 (10.11.2026, SARCLA point 11: "allow to push the banner directly on a page after editing"): the banner goes
// onto a page of the shop as the module library's campaign banner, drawn as one picture - in the Page builder to-do's
// change list, never into Magento from the banner studio.

const B: BannerOnPage = {
  pieceId: 42, store: "de-CH", desktop: "/api/content/picture/12-abcdEFGH12", phone: "/api/content/picture/13-ijklMNOP34",
  alt: "Finden Sie schneller den richtigen O-Ring", link: "o-ring-auswahlleitfaden", where: "slider",
};

const PAGE = `<html><body><header><h2>Menu</h2></header><main id="maincontent"><div class="columns"><div class="column main">
<div data-content-type="row" data-pb-style="AAA111"><div class="pagebuilder-slider" data-content-type="slider">
<div data-content-type="slide"><a href="/de-CH/x"><div class="pagebuilder-slide-wrapper">Slide one</div></a></div>
<div data-content-type="slide"><a href="/de-CH/y"><div class="pagebuilder-slide-wrapper">Slide two</div></a></div></div></div>
<div data-content-type="row" data-pb-style="BBB222"><h2>Top-Produkte</h2><p>Die meistgekauften Artikel</p></div>
<div data-content-type="row"><h2>Tools</h2><p>DirectCUT und mehr</p></div>
<div data-content-type="row"><h2>Weitere Produkte</h2></div>
</div></div></main></body></html>`;

test("the banner as the campaign banner module: one picture, its phone picture, its link in the page's store view, its alt", () => {
  const m = bannerModule(B);
  assert.equal(m.type, "banner");
  assert.equal(m.settings.layout, "picture");
  assert.equal(m.settings.id, "bn42");
  assert.equal(m.settings.feature?.img, B.desktop);
  assert.equal(m.settings.extra.phone, B.phone);
  assert.equal(m.settings.extra.place, "slider");
  assert.equal(m.settings.feature?.url, "https://www.apsoparts.com/de-CH/o-ring-auswahlleitfaden");
  assert.equal(gapOf(m), "", "it stands on a page as it is");
  // the links a module takes are the shop's only
  assert.equal(shopLinkFor("https://example.com/x", "de-CH"), "");
  assert.equal(shopLinkFor("https://www.apsoparts.com/fr-CH/black-friday", "de-CH"), "https://www.apsoparts.com/fr-CH/black-friday");
  assert.equal(shopLinkFor("/fr-CH/black-friday", "de-CH"), "https://www.apsoparts.com/fr-CH/black-friday");
  assert.equal(shopLinkFor("black-friday", "it-CH"), "https://www.apsoparts.com/it-CH/black-friday");
});

test("the change: first in the slider, at the top, or after a block - with its module beside it, valid for the shop", () => {
  const s = bannerChange(B);
  assert.equal(s.op, "insert");
  assert.equal((s as { selector: string }).selector, SLIDER_SELECTOR);
  assert.equal((s as { where: string }).where, "prepend");
  assert.equal(s.id, changeIdFor(42));
  const html = (s as { html: string }).html;
  assert.match(html, /<picture><source media="\(max-width:767px\)" srcset="\/api\/content\/picture\/13-ijklMNOP34"><img src="\/api\/content\/picture\/12-abcdEFGH12" alt="Finden Sie schneller den richtigen O-Ring"/);
  assert.match(html, /href="\/de-CH\/o-ring-auswahlleitfaden"/);
  assert.match(html, /class="apx-bn42"/);
  assert.equal(moduleOfChange(s)?.settings.extra.phone, B.phone, "the page studio opens the module again");
  const top = bannerChange({ ...B, where: "top" });
  assert.equal((top as { selector: string }).selector, MAIN_SELECTOR);
  const after = bannerChange({ ...B, where: "after" }, { selector: 'div[data-pb-style="BBB222"]' });
  assert.equal((after as { where: string }).where, "after");
  for (const c of [s, top, after]) {
    const v = validateChanges([c]);
    assert.deepEqual(v.problems, [], JSON.stringify(v.problems));
  }
  // the same banner put again moves: one change for it on the page
  const list = withBanner(withBanner([], s), top);
  assert.equal(list.length, 1);
  assert.equal((list[0] as { selector: string }).selector, MAIN_SELECTOR);
  assert.ok(bannerOn(list, 42));
  assert.ok(!bannerOn(list, 43));
});

test("the places a page offers: its slider, and its blocks by their headings, each found by a selector that finds only it", () => {
  const p = placesIn(PAGE);
  assert.equal(p.slider, true);
  assert.deepEqual(p.blocks.map((b) => b.name), ["The slider", "Top-Produkte", "Tools", "Weitere Produkte"]);
  assert.equal(p.blocks[1].selector, 'div[data-pb-style="BBB222"]');
  assert.match(p.blocks[2].selector, /^#maincontent \.column\.main > div:nth-of-type\(3\)$/);
  assert.equal(p.blocks[1].text, "Die meistgekauften Artikel");
  // a page without a slider says so
  assert.equal(placesIn("<main id=\"maincontent\"><div class=\"column main\"><h2>Datenschutz</h2><p>Text</p></div></main>").slider, false);
});

test("in the page as the preview lays it: the banner is the slider's first, the old first slide after it; after a block, after it", () => {
  const s = applyChanges(PAGE, [bannerChange(B) as never]).html;
  const slider = s.slice(s.indexOf('data-content-type="slider"'));
  assert.ok(slider.indexOf("apx-bn42") < slider.indexOf("Slide one"), "first in the slider");
  const p = placesIn(PAGE);
  const a = applyChanges(PAGE, [bannerChange({ ...B, where: "after" }, { selector: p.blocks[2].selector }) as never]).html;
  assert.ok(a.indexOf("DirectCUT und mehr") < a.indexOf("apx-bn42") && a.indexOf("apx-bn42") < a.indexOf("Weitere Produkte"), "after Tools, before the next block");
});

test("a page drawn outside the hub reads the hub's pictures from the hub", () => {
  const h = hubPicturesAbsolute('<img src="/api/content/picture/1-abcd"><source srcset="/api/content/picture/2-efgh">', "https://hub.example");
  assert.equal(h, '<img src="https://hub.example/api/content/picture/1-abcd"><source srcset="https://hub.example/api/content/picture/2-efgh">');
});
