import assert from "node:assert/strict";
import { test } from "node:test";
import { newModule, normalizeModule, type Card } from "../src/lib/content/studio/kinds/page/modules/model";
import { renderModule } from "../src/lib/content/studio/kinds/page/modules/render";
import { cardOfProduct, withCard, withPartPicture } from "../src/lib/content/studio/kinds/page/modules/elements";

// Content v13, part 6 (SARCLA 11.11.2026 ~09:20, screenshot 27 - a duo's two product cards, the second a white ring on a
// hard grey square): "here the picture is not correct and links have not updated when I select the specific product".
// One product put on a card replaces the WHOLE card - number, name, count, page, photo - whatever way it was picked.

const B = "https://www.apsoparts.com";
const prod = (n: string, name: string, meta = ""): Card => ({ kind: "product", name, url: `${B}/en-INT/${n}.html`, img: `${B}/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/${n}.jpg`, meta, number: n, children: [] });
const duo = () => normalizeModule({ ...newModule("showcase-duo", "en-INT", "mduo1"), settings: { ...newModule("showcase-duo", "en-INT", "mduo1").settings, items: [prod("10341003", "FFKM O-ring evolast® PN794", "477 articles"), prod("10341002", "FFKM O-ring old", "12 articles")] } })!;

test("a product picked for one card: its number, name, count, page and photo - all of them", () => {
  const card = cardOfProduct({ name: "FFKM O-ring evolast® PB794", number: "10341004", url: `${B}/en-INT/10341004.html`, img: `${B}/media/catalog/product/p/b/pb794.jpg`, meta: "502 articles" })!;
  const m = withCard(duo(), "items.1", card)!;
  const c = m.settings.items[1];
  assert.deepEqual([c.number, c.name, c.meta, c.url, c.img], ["10341004", "FFKM O-ring evolast® PB794", "502 articles", `${B}/en-INT/10341004.html`, `${B}/media/catalog/product/p/b/pb794.jpg`]);
  assert.equal(m.settings.items[0].number, "10341003", "the other card stays");
  const html = renderModule(m);
  // the card's every link goes to the new product, in the module's store view; none to the old one
  assert.equal((html.match(/href="\/en-INT\/10341004\.html"/g) ?? []).length, 3, "photo, name and button");
  assert.ok(!html.includes("10341002"), "nothing of the old product is left");
  assert.match(html, />502 articles</);
});

test("the Products tab of a picture puts the whole product on the card, not its photo alone", () => {
  const m = withPartPicture(duo(), "items.1", { url: `${B}/media/catalog/product/p/b/pb794.jpg`, alt: "FFKM O-ring evolast® PB794", name: "FFKM O-ring evolast® PB794", product: { number: "10341004", url: `${B}/en-INT/10341004.html` } })!;
  assert.equal(m.settings.items[1].url, `${B}/en-INT/10341004.html`);
  assert.equal(m.settings.items[1].number, "10341004");
  // a module's own picture: the product, and it stays the person's pick
  const spot = newModule("showcase-spotlight", "en-INT", "mspot1");
  const s2 = withPartPicture(spot, "feature", { url: `${B}/media/catalog/product/p/b/pb794.jpg`, name: "FFKM O-ring evolast® PB794", product: { number: "10341004", url: `${B}/en-INT/10341004.html` } });
  if (s2) {
    assert.equal(s2.settings.feature!.url, `${B}/en-INT/10341004.html`);
    assert.equal(s2.settings.feature!.from, "person");
  }
});

test("not a product of the shop: no card", () => {
  assert.equal(cardOfProduct({ name: "", url: `${B}/x.html` }), null);
  assert.equal(cardOfProduct({ name: "X", url: "https://example.com/x" }), null);
  assert.equal(withCard(duo(), "items.7", prod("10341005", "Y")), null);
});

// "Two products side by side" (the Kalrez page, LIVE 30af2745 11.11.2026): each photo one rounded tile it fills - a white
// photo a white tile, a grey one a grey tile; the other product modules: a round fade, never the old oversized ellipse
test("product photos of every shape sit alike on a card: a tile the photo fills (duo), never a hard square", () => {
  const html = renderModule(duo());
  assert.match(html, /\.am-dp img\{[^}]*aspect-ratio:1;object-fit:cover;border-radius:20px/);
  assert.ok(!/ellipse 80% 80%/.test(html));
  assert.ok(!/\.am-dp img\{[^}]*mix-blend-mode/.test(html), "no blend that hides only white backgrounds");
});
