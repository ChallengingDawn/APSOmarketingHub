import assert from "node:assert/strict";
import { test } from "node:test";
import { clearanceOf, galleryOf, parseCategory } from "../src/lib/content/studio/kinds/page/modules/parse";
import { photoBad, photoFlaws } from "../src/lib/content/studio/kinds/page/modules/photo";
import { cleanCards, cleanedNote, knowGallery } from "../src/lib/content/studio/kinds/page/modules/source";
import type { Card } from "../src/lib/content/studio/kinds/page/modules/types";

// Content v7 (the lead 10.11.2026, after builder A's real runs filled a module with "(Nur solange Vorrat ...)", "(Nachfolge
// von ...)", "Liquidation" and photos with NEW!/LIQUIDATION stickers): an automatic fill never shows them - another photo of
// the product's own page when it has a clean one, else the product is left out, and the fill says how many.

const B = "https://www.apsoparts.com/de-CH/";
const IMG = (n: string) => `https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/${n}.jpg`;
const prod = (name: string, slug: string, img = IMG("01/01/1")): Card => ({ kind: "product", name, url: `${B}${slug}.html`, img, meta: "12 Artikel", number: slug.slice(0, 8), children: [] });

test("clearance or replaced, by the name or the address - in the shop's languages; an outlet tap is not one", () => {
  assert.ok(clearanceOf("PERTEC® O-Ring CIP FKM 75.501-04 (Nur solange der Vorrat reicht)"));
  assert.ok(clearanceOf("HITEC® O-Ring DW EPDM 70.503-00 (Nachfolge von HITEC® O-Ring EPDM 70.10-02)"));
  assert.ok(clearanceOf("Flachdichtung Liquidation"));
  assert.ok(clearanceOf("Joint torique (Jusqu'à épuisement du stock)"));
  assert.ok(clearanceOf("O-ring (solo fino ad esaurimento scorte)"));
  assert.ok(clearanceOf("O-Ring EPDM (Only while stocks last)"));
  assert.ok(clearanceOf("O-Ring EPDM 70 (Successor of O-Ring EPDM 70.10-02)"));
  assert.ok(clearanceOf("Rundschnur, ersetzt durch 11400101"));
  assert.ok(clearanceOf("O-Ring EPDM", `${B}11400601-hitecr-o-ring-epdm-70-10-02-nur-solange-der-vorrat-reicht.html`), "by its address");
  assert.ok(!clearanceOf("HITEC® O-Ring NBR 70.10-02", `${B}11400201-hitecr-o-ring-nbr-70-10-02.html`));
  assert.ok(!clearanceOf("Auslaufhahn aus Edelstahl"), "an outlet tap is not on clearance");
});

test("a category's products: those on clearance are still read, the fill leaves them out", () => {
  const html = `<h1 class="page-title"><span>O-Ringe</span></h1><ol>
<li class="item product product-item"><a class="product-item-link" href="${B}11430401-pertecr-o-ring-cip-fkm-75-501-04-nur-solange-der-vorrat-reicht.html">PERTEC® O-Ring CIP FKM 75.501-04 (Nur solange der Vorrat reicht)</a></li>
<li class="item product product-item"><a class="product-item-link" href="${B}11400201-hitecr-o-ring-nbr-70-10-02.html">HITEC® O-Ring NBR 70.10-02</a></li></ol>`;
  const c = parseCategory(html, `${B}dichtungstechnik/o-ringe-x-ringe.html`);
  assert.equal(c.products.length, 2);
  assert.deepEqual(c.products.filter((p) => !clearanceOf(p.name, p.url)).map((p) => p.number), ["11400201"]);
});

test("a product page's gallery: its photos in order, the escaped slashes read", () => {
  const html = `"img":"https:\\/\\/www.apsoparts.com\\/media\\/catalog\\/product\\/cache\\/e65cbd4f894347b40651eab73facc10f\\/std.lang.all\\/01\\/01\\/11400101.jpg","full":"x"},{"img":"https:\\/\\/www.apsoparts.com\\/media\\/catalog\\/product\\/cache\\/e65cbd4f894347b40651eab73facc10f\\/std.lang.all\\/49\\/dr\\/AuP000949DR.jpg"`;
  assert.deepEqual(galleryOf(html), [IMG("01/01/11400101"), IMG("49/dr/AuP000949DR")]);
});

/** A 100 x 100 picture: white, a grey part in the middle; then what each test lays over it. */
function picture(paint?: (x: number, y: number) => [number, number, number] | null): Uint8Array {
  const w = 100, h = 100, px = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    const d = Math.hypot(x - 50, y - 55);
    // a part with soft shading (a photo, not a flat drawing)
    let c: [number, number, number] = d < 28 ? [Math.round(90 + d * 3), Math.round(95 + d * 3), Math.round(100 + d * 3)] : [255, 255, 255];
    const p = paint?.(x, y);
    if (p) c = p;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
  }
  return px;
}

test("a photo: clean; a red sticker in a top corner; a coloured card behind the part; a drawing", () => {
  const clean = photoFlaws(picture(), 100, 100, 3);
  assert.deepEqual(clean, { badge: false, colored: false, drawing: false });
  const sticker = photoFlaws(picture((x, y) => (x > 80 && y < 14 ? [220, 20, 30] : null)), 100, 100, 3);
  assert.equal(sticker.badge, true, "NEW! / LIQUIDATION in the top right corner");
  const pink = photoFlaws(picture((x, y) => (Math.hypot(x - 50, y - 55) >= 28 ? [236, 160, 190] : null)), 100, 100, 3);
  assert.equal(pink.colored, true, "the shop's pink cart picture");
  assert.equal(photoFlaws(picture(), 100, 100, 3, IMG("49/dr/AuP000949DR")).drawing, true, "a ...DR.jpg is a drawing");
  assert.ok(photoBad(sticker) && photoBad(pink) && !photoBad(clean));
});

test("an automatic fill: clearance out, a sticker photo swapped for a clean one of its own page, else the product out - and said", async () => {
  const bad = new Set([IMG("01/01/2"), IMG("01/01/3"), IMG("01/01/3b")]);
  const check = async (img: string) => !bad.has(img);
  const list = [
    prod("PERTEC® O-Ring CIP FKM 75.501-04 (Nur solange der Vorrat reicht)", "11430401-pertec"),
    prod("HITEC® O-Ring NBR 70.10-02", "11400201-hitec-nbr", IMG("01/01/1")),
    prod("HITEC® O-Ring FKM 75.16-04", "11400301-hitec-fkm", IMG("01/01/2")),
    prod("FFKM O-Ring evolast® PN896", "11400401-ffkm", IMG("01/01/3")),
    prod("PEEK Rundstab natur", "22334455-peek", IMG("01/01/4")),
  ];
  knowGallery(list[2].url, [IMG("01/01/2"), IMG("01/01/2b")]);
  knowGallery(list[3].url, [IMG("01/01/3"), IMG("01/01/3b")]);
  const r = await cleanCards(list, 3, check);
  assert.deepEqual(r.cards.map((c) => c.number), ["11400201", "11400301", "22334455"]);
  assert.equal(r.cards[1].img, IMG("01/01/2b"), "its clean photo instead of the one with the sticker");
  assert.equal(r.clearance, 1);
  assert.equal(r.photo, 1);
  assert.equal(cleanedNote(r), " 2 left out: 1 on clearance or replaced, 1 whose photo has a sticker, a coloured card or is a drawing.");
  assert.equal(cleanedNote({ clearance: 0, photo: 0 }), "");
});
