import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULE_KINDS, newModule, normalizeModule, type Card, type ModuleRef } from "../src/lib/content/studio/kinds/page/modules/model";
import { renderModule } from "../src/lib/content/studio/kinds/page/modules/render";
import { lookKind, partLook, withPartLook } from "../src/lib/content/studio/kinds/page/modules/elements";
import { TILES_LOOK_KEY, isLookKey } from "../src/lib/content/studio/kinds/page/modules/looks";

// Content v13b (SARCLA 11.11.2026 ~10:28, "Two products side by side": a card's "View product" opened only its words):
// "some buttons still don't have button options". The tiles' button takes the module button's options - style, colour,
// size, arrow, width, tab - kept once in the module's settings ("btn-tiles") and drawn on EVERY tile's button by
// drawModule, so the preview, the thumbnail and Magento's copy agree. Each still leads to its own tile's page.

const B = "https://www.apsoparts.com";
const prod = (n: number): Card => ({ kind: "product", name: `O-Ring ${n}`, url: `${B}/en-INT/p${n}.html`, img: `${B}/media/catalog/product/p${n}.jpg`, meta: `${n} articles`, number: `1034100${n}`, children: [] });
const filled = (type: string, extra: Record<string, string> = {}): ModuleRef => {
  const m = newModule(type, "en-INT", "mtile");
  const k = MODULE_KINDS.find((x) => x.id === type)!;
  return normalizeModule({ ...m, settings: { ...m.settings, title: "O-rings", link: { label: "View all", url: `${B}/en-INT/o-rings.html` }, items: [1, 2, 3, 4, 5, 6].map(prod).slice(0, Math.max(k.max, 1)),
    feature: { kind: "category", name: "O-rings", url: `${B}/en-INT/o-rings.html`, img: `${B}/media/catalog/category/o.jpg`, meta: "31 products", number: "", children: [] }, extra } })!;
};

test("the tiles' button is a button: its look kept once, as a module button's is", () => {
  const m = filled("showcase-duo");
  assert.equal(lookKind(m, "words.go"), "button");
  const looked = withPartLook(m, "words.go", "s=outline;c=red;z=l")!;
  assert.equal(looked.settings.extra[TILES_LOOK_KEY], "s=outline;c=red;z=l");
  assert.equal(partLook(looked, "words.all"), "s=outline;c=red;z=l", "one look for all of a module's tile buttons");
  assert.ok(isLookKey(TILES_LOOK_KEY), "never words: no click lands on it, the AI is never told it");
});

test("drawn on EVERY tile's button - both cards of a duo - never on the module's own button; in Magento's copy alike", () => {
  const m = withPartLook(filled("showcase-duo"), "words.go", "s=outline;c=red")!;
  const html = renderModule(m);
  const tiles = html.match(/<a class="[^"]*\bam-tb\b[^"]*"[^>]*>View product<\/a>/g) ?? [];
  assert.equal(tiles.length, 2, "both cards' buttons");
  assert.ok(tiles.every((t) => /href="\/en-INT\/p[12]\.html"/.test(t)), "each still to its own product");
  assert.match(html, /\.apx-mtile :is\(a,button,span,i,em,b,strong\)\.am-tb\{[^}]*border:2px solid #d80901!important/);
  assert.ok(!/class="[^"]*am-all[^"]*am-tb/.test(html), "the module's own 'View all' keeps its own look");
  assert.equal(renderModule(filled("showcase-duo")), renderModule(normalizeModule(JSON.parse(JSON.stringify(filled("showcase-duo"))))!), "no look: unchanged");
  assert.ok(!renderModule(filled("showcase-duo")).includes("am-tb"), "nothing tagged until a look is set");
});

test("a bento's big tile ('View all' drawn as words inside the tile's link) and the other tile modules take it too", () => {
  let tagged = 0;
  for (const type of ["bento", "bento-dark", "bento-glass", "showcase-spotlight", "showcase-duo"]) {
    if (!MODULE_KINDS.some((k) => k.id === type)) continue;
    const html = renderModule(withPartLook(filled(type), "words.all", "s=filled;c=petrol")!);
    if (/\bam-tb\b/.test(html.replace(/<style>[\s\S]*?<\/style>/, ""))) tagged++;
  }
  assert.ok(tagged >= 3, `the tile modules' buttons take the look (${tagged})`);
});
