// Content v12 (SARCLA 10.11.2026 ~22:40: "on some bento you change the product but the background photo keeps seals"): a
// module's picture follows its products - the fill's picture becomes their own category's photo when it is not theirs, the
// person's picture stays, and words written for other products are flagged, never rewritten silently.
import { test } from "node:test";
import assert from "node:assert/strict";
import { aboutOf, belongsTo, categoryKey, chainKeys, commonCategory, fillHint, followNeedsShop, followPicture, followable, isProductUrl, onLine, pictureFrom, rewordOf, wantsPicture, withoutReword, type FollowInfo } from "../src/lib/content/studio/kinds/page/modules/follow";
import { breadcrumbOf } from "../src/lib/content/studio/kinds/page/modules/parse";
import { newModule, normalizeModule } from "../src/lib/content/studio/kinds/page/modules/model";
import { moduleDef } from "../src/lib/content/studio/kinds/page/modules/registry";
import { renderModule } from "../src/lib/content/studio/kinds/page/modules/render";
import { nowWords } from "../src/lib/content/studio/kinds/page/modules/words";
import { withFill } from "../src/lib/content/studio/kinds/page/plan/plan";
import type { Card, ModuleRef } from "../src/lib/content/studio/kinds/page/modules/types";

const B = "https://www.apsoparts.com/de-CH";
const prod = (number: string, slug: string, name: string, img: string): Card => ({ kind: "product", name, url: `${B}/${number}-${slug}.html`, img, meta: "", number, children: [] });
const cat = (path: string, name: string, img: string, from?: "fill" | "person"): Card => ({ kind: "category", name, url: `${B}/${path}.html`, img, meta: "", number: "", children: [], ...(from ? { from } : {}) });

// the shop's own (de-CH, read 10.11.2026)
const SEALING = cat("dichtungstechnik", "Dichtungstechnik", "https://www.apsoparts.com/media/wysiwyg/1_Sealing_Technology_1.jpg");
const PLASTICS = cat("kunststofftechnik", "Kunststofftechnik", "https://www.apsoparts.com/media/wysiwyg/2_EngeneeringPlasticsTechnology_1.jpg");
const PLATES = cat("kunststofftechnik/platte", "Platte", "https://www.apsoparts.com/media/wysiwyg/3_EngineeringPlasticsTechnology_Plates_1.jpg");
const SEALS = [
  prod("10416001", "normatecr-o-ring-epdm-70-00-02", "NORMATEC® O-Ring EPDM 70.00-02", "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/16/00/10416001.jpg"),
  prod("10416101", "normatecr-o-ring-epdm-80", "NORMATEC® O-Ring EPDM 80", "https://www.apsoparts.com/media/catalog/product/x/10416101.jpg"),
];
const POM = [
  prod("02320001", "pom-c-platte-natur-weiss", "POM-C Platte natur (weiss)", "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/57/19/295719.jpg"),
  prod("02320201", "pom-c-rundstab-natur-weiss", "POM-C Rundstab natur (weiss)", "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/57/21/295721.jpg"),
  prod("02321011", "pom-c-platte-schwarz-2-mm", "POM-C Platte schwarz, 2 mm", "https://www.apsoparts.com/media/catalog/product/x/02321011.jpg"),
  prod("02320211", "pom-c-rundstab-schwarz", "POM-C Rundstab schwarz", "https://www.apsoparts.com/media/catalog/product/x/02320211.jpg"),
];
// their categories, as their pages' breadcrumbs say them
const POM_CATS = ["kunststofftechnik/platte/polyoxymethylen-pom", "kunststofftechnik/rundstab/polyoxymethylen-pom", "kunststofftechnik/platte/polyoxymethylen-pom", "kunststofftechnik/rundstab/polyoxymethylen-pom"];
const POM_INFO: FollowInfo = { cats: POM_CATS, common: { url: `${B}/kunststofftechnik.html`, name: "Kunststofftechnik" }, photo: { ...PLASTICS, from: "fill" } };

/** SARCLA's module: a "Products on a photo" first made for EPDM O-rings, then given POM-C plates and rods. */
function glass(items: Card[], feature: Card | null, over: Partial<ModuleRef["settings"]> = {}): ModuleRef {
  const m = newModule("bento-glass", "de-CH", "mglas");
  return { ...m, settings: { ...m.settings, eyebrow: "Dichtungstechnik", title: "O-Ringe und Dichtungen in ==EPDM==", text: "Für Wasser, Dampf und Lebensmittel.", items, feature, ...over } };
}

/* ── what the shop says ────────────────────────────────────────────────── */

test("breadcrumbOf: a product page's categories from its schema.org breadcrumb, else Magento's categoryBreadcrumbs", () => {
  // the POM-C plate's page, 10.11.2026 (its JSON-LD, as the shop writes it)
  const html = `<title>POM-C Platte</title><script type="application/ld+json">{"@context":"https://schema.org/","@type":"WebPage","breadcrumb":{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Kunststofftechnik","item":"https://www.apsoparts.com/de-CH/kunststofftechnik.html"},{"@type":"ListItem","position":2,"name":"Platte","item":"https://www.apsoparts.com/de-CH/kunststofftechnik/platte.html"},{"@type":"ListItem","position":3,"name":"Polyoxymethylen (POM)","item":"https://www.apsoparts.com/de-CH/kunststofftechnik/platte/polyoxymethylen-pom.html"}]}}</script>`;
  const b = breadcrumbOf(html);
  assert.deepEqual(b.map((x) => x.name), ["Kunststofftechnik", "Platte", "Polyoxymethylen (POM)"]);
  assert.equal(categoryKey(b[b.length - 1].url), "kunststofftechnik/platte/polyoxymethylen-pom");
  const magento = `<script type="text/x-magento-init">{".breadcrumbs":{"breadcrumbs":{"categoryUrlSuffix":".html","categoryBreadcrumbs":[{"label":"Dichtungstechnik","name":"category","link":"https:\\/\\/www.apsoparts.com\\/de-CH\\/dichtungstechnik.html"},{"label":"O-Ringe &amp; X-Ringe","name":"category","link":"https:\\/\\/www.apsoparts.com\\/de-CH\\/dichtungstechnik\\/o-ringe-x-ringe.html"}]}}}</script>`;
  assert.deepEqual(breadcrumbOf(magento).map((x) => x.name), ["Dichtungstechnik", "O-Ringe & X-Ringe"]);
  assert.deepEqual(breadcrumbOf("<h1>Home</h1>"), []);
});

test("categories by their address: a product's page carries none, a category's line, the one products share", () => {
  assert.equal(categoryKey(`${B}/kunststofftechnik/platte.html`), "kunststofftechnik/platte");
  assert.equal(categoryKey(POM[0].url), "");
  assert.ok(isProductUrl(POM[0].url));
  assert.equal(categoryKey(`${B}/`), "");
  assert.deepEqual(chainKeys("a/b/c"), ["a", "a/b", "a/b/c"]);
  assert.ok(onLine("kunststofftechnik", "kunststofftechnik/platte/polyoxymethylen-pom"));
  assert.ok(onLine("kunststofftechnik/platte/polyoxymethylen-pom", "kunststofftechnik/platte"));
  assert.ok(!onLine("dichtungstechnik", "kunststofftechnik/platte"));
  assert.ok(!onLine("kunststofftechnik/rundstab", "kunststofftechnik/platte/polyoxymethylen-pom"));
  // plates and rods share their technology; plates only their plate category; a mix goes with most of them
  assert.equal(commonCategory(POM_CATS), "kunststofftechnik");
  assert.equal(commonCategory(["kunststofftechnik/platte/polyoxymethylen-pom", "kunststofftechnik/platte/polyoxymethylen-pom"]), "kunststofftechnik/platte/polyoxymethylen-pom");
  assert.equal(commonCategory(["dichtungstechnik/o-ringe-x-ringe/o-ring-epdm", "kunststofftechnik/platte/a", "kunststofftechnik/rundstab/b", ""]), "kunststofftechnik");
  assert.equal(commonCategory(["", ""]), "");
});

test("belongsTo: the technology's or the plates' photo belongs to POM-C plates, the sealing photo does not", () => {
  assert.equal(belongsTo(PLASTICS, POM, POM_CATS), true);
  assert.equal(belongsTo(PLATES, POM, POM_CATS), true);
  assert.equal(belongsTo(SEALING, POM, POM_CATS), false);
  // nothing known of the products: it cannot be told - the picture stays
  assert.equal(belongsTo(SEALING, POM, ["", ""]), null);
  // a product's photo belongs while that product is one of them
  assert.equal(belongsTo({ ...SEALS[0] }, SEALS, []), true);
  assert.equal(belongsTo({ ...SEALS[0] }, POM, []), false);
});

test("the modules whose picture follows: products or categories with a picture of theirs - not a machine's picture", () => {
  for (const id of ["bento-glass", "bento-dark", "bento-mixed", "bento", "hero-category"]) assert.ok(followable(moduleDef(id)), id);
  for (const id of ["bento-text", "row", "ind-around", "hero-split"]) assert.ok(!followable(moduleDef(id)), id);
});

/* ── the picture follows ──────────────────────────────────────────────── */

test("a picture that belongs to the products stays", () => {
  const m = glass(POM, { ...PLASTICS, from: "fill" });
  const r = followPicture(m, POM_INFO, { reword: true });
  assert.equal(r.did, "");
  assert.equal(r.reword, false);
  assert.deepEqual(r.m, m);
  // the plates' photo over POM-C plates and rods: still theirs
  assert.equal(followPicture(glass(POM, { ...PLATES, from: "fill" }), POM_INFO).did, "");
});

test("SARCLA's bento: POM-C products under the sealing photo - the photo becomes Kunststofftechnik's, the words are flagged", () => {
  const m = glass(POM, SEALING); // the old module: no mark on its picture - a shop photo is the fill's
  assert.equal(pictureFrom(SEALING), "fill");
  assert.ok(wantsPicture(m, POM_CATS));
  const r = followPicture(m, POM_INFO, { reword: true });
  assert.equal(r.did, "photo");
  assert.equal(r.m.settings.feature?.url, PLASTICS.url);
  assert.equal(r.m.settings.feature?.img, PLASTICS.img);
  assert.equal(r.m.settings.feature?.from, "fill");
  assert.match(r.line, /follows its products: Kunststofftechnik/);
  // its words went with the seals: flagged, not rewritten
  assert.equal(r.reword, true);
  assert.equal(r.m.settings.title, "O-Ringe und Dichtungen in ==EPDM==");
  assert.deepEqual(rewordOf(r.m), { name: "Kunststofftechnik" });
  // drawn: the plastics photo behind the products, no sealing photo left
  const html = renderModule(r.m);
  assert.ok(html.includes("2_EngeneeringPlasticsTechnology_1.jpg"));
  assert.ok(!html.includes("1_Sealing_Technology_1.jpg"));
  // the flag ends with any change of the words (the AI's, the person's), or "Keep them"
  const rewritten = { ...r.m, settings: { ...r.m.settings, title: "Technische ==Kunststoffe== aus POM-C" } };
  assert.equal(rewordOf(rewritten), null);
  assert.equal(rewordOf(withoutReword(r.m)), null);
  // and its old mark never goes to the AI
  assert.ok(!JSON.stringify(nowWords(r.m)).includes("reword"));
});

test("the person's picture stays: marked, or of the hub's picture store (uploaded, from the pictures, made by AI)", () => {
  const picked = glass(POM, { ...SEALING, from: "person" });
  const r1 = followPicture(picked, POM_INFO, { reword: true });
  assert.equal(r1.did, "");
  assert.equal(r1.m.settings.feature?.url, SEALING.url);
  const upload: Card = { kind: "category", name: "Unsere Halle", url: `${B}/`, img: "/api/content/picture/abc123-k1", meta: "", number: "", children: [] };
  assert.equal(pictureFrom(upload), "person");
  const r2 = followPicture(glass(POM, upload), POM_INFO);
  assert.equal(r2.did, "");
  assert.equal(r2.m.settings.feature?.img, upload.img);
  // its words are still checked against the products when they changed (the category it was filled from before)
  const r3 = followPicture(picked, POM_INFO, { reword: true, about: "dichtungstechnik/o-ringe-x-ringe/o-ring-epdm" });
  assert.equal(r3.m.settings.feature?.url, SEALING.url);
  assert.equal(r3.reword, true);
});

test("nothing known of the products: the picture stays as it is", () => {
  const m = glass(POM, SEALING);
  const r = followPicture(m, { cats: ["", "", "", ""], common: null, photo: null }, { reword: true });
  assert.equal(r.did, "");
  assert.equal(r.m.settings.feature?.url, SEALING.url);
});

test("no category photo to be had: a big tile that draws a product lets the first product stand big; a module that needs a picture shows the first product's", () => {
  const noPhoto: FollowInfo = { ...POM_INFO, photo: null };
  const mixed = newModule("bento-mixed", "de-CH", "mmixd");
  const r = followPicture({ ...mixed, settings: { ...mixed.settings, items: POM.slice(0, 3), feature: SEALING } }, noPhoto);
  assert.equal(r.did, "out");
  assert.equal(r.m.settings.feature, null);
  // a "Products on a photo" without a picture (switched into from another product module): their first product's
  const r2 = followPicture(glass(POM, null), noPhoto);
  assert.equal(r2.did, "product");
  assert.equal(r2.m.settings.feature?.url, POM[0].url);
  // ... and their category's photo when there is one
  assert.equal(followPicture(glass(POM, null), POM_INFO).m.settings.feature?.url, PLASTICS.url);
  // a bento whose big tile is its first product until one is picked: none added
  const bento = newModule("bento", "de-CH", "mbent");
  assert.equal(followPicture({ ...bento, settings: { ...bento.settings, items: POM } }, POM_INFO).did, "");
});

test("a module without a picture: its words flagged when its products are no longer those they went with", () => {
  const t = newModule("bento-text", "de-CH", "mtext");
  const m: ModuleRef = { ...t, settings: { ...t.settings, title: "O-Ringe aus EPDM", items: POM, fill: { how: "category", category: `${B}/kunststofftechnik/platte/polyoxymethylen-pom.html`, numbers: "", ask: "", at: "", missing: [] } } };
  assert.equal(followPicture(m, POM_INFO, { reword: true, about: "dichtungstechnik/o-ringe-x-ringe/o-ring-epdm" }).reword, true);
  assert.equal(followPicture(m, POM_INFO, { reword: true, about: "kunststofftechnik" }).reword, false);
  // no words yet: nothing to flag
  assert.equal(followPicture({ ...m, settings: { ...m.settings, title: "" } }, POM_INFO, { reword: true, about: "dichtungstechnik" }).reword, false);
});

/* ── when the shop is asked ───────────────────────────────────────────── */

test("followNeedsShop: only when something can come of it - a module filled from a category tells by itself", () => {
  const fill = (category: string) => ({ how: "category" as const, category, numbers: "", ask: "", at: "", missing: [] });
  const pomFill = fill(`${B}/kunststofftechnik/platte/polyoxymethylen-pom.html`);
  assert.equal(followNeedsShop(glass([], SEALING), null), false);
  assert.equal(followNeedsShop(glass(POM, { ...PLATES, from: "fill" }, { fill: pomFill }), null), false);
  assert.equal(followNeedsShop(glass(POM, SEALING, { fill: pomFill }), null), true);
  assert.equal(followNeedsShop(glass(POM, { ...SEALING, from: "person" }, { fill: pomFill }), null), false);
  assert.equal(followNeedsShop(glass(POM, { ...SEALING, from: "person" }, { fill: pomFill }), "dichtungstechnik"), true);
  // filled by numbers or by the AI: their pages tell
  assert.equal(followNeedsShop(glass(POM, { ...PLASTICS, from: "fill" }, { fill: { ...pomFill, how: "numbers", category: "" } }), null), true);
  assert.equal(fillHint(glass(POM, null, { fill: pomFill })), pomFill.category);
  assert.equal(aboutOf(glass(POM, SEALING, { fill: pomFill })), "dichtungstechnik");
});

/* ── a plan's fill, the document ──────────────────────────────────────── */

test("withFill: a plan's fill keeps the person's picture and moves the fill's", () => {
  const spec = { how: "category" as const, category: `${B}/kunststofftechnik/platte/polyoxymethylen-pom.html`, numbers: "", count: 4 };
  const person = withFill(glass(SEALS, { ...SEALING, from: "person" }), { items: POM, feature: PLASTICS, follow: POM_INFO }, spec);
  assert.equal(person.settings.feature?.url, SEALING.url);
  assert.equal(person.settings.items[0].url, POM[0].url);
  const fill = withFill(glass(SEALS, SEALING), { items: POM, feature: PLASTICS, follow: POM_INFO }, spec);
  assert.equal(fill.settings.feature?.url, PLASTICS.url);
  assert.equal(fill.settings.feature?.from, "fill");
  // a plan's fill comes with its words: not flagged
  assert.equal(rewordOf(fill), null);
  // without what the products are (an older answer): the picture the fill found, the person's still kept
  assert.equal(withFill(glass(SEALS, SEALING), { items: POM, feature: PLASTICS }, spec).settings.feature?.url, PLASTICS.url);
  assert.equal(withFill(glass(SEALS, { ...SEALING, from: "person" }), { items: POM, feature: PLASTICS }, spec).settings.feature?.url, SEALING.url);
});

test("a picture's origin is kept with the module; the AI is told what the module shows", () => {
  const m = normalizeModule(JSON.parse(JSON.stringify(glass(POM, { ...SEALING, from: "person" }))));
  assert.equal(m?.settings.feature?.from, "person");
  assert.equal(normalizeModule({ type: "bento-glass", settings: { items: [], feature: { ...SEALING, from: "x" } } })?.settings.feature?.from, undefined);
  const now = nowWords(glass(POM, PLASTICS)) as { shows?: string[]; picture?: string };
  assert.deepEqual(now.shows?.slice(0, 2), ["POM-C Platte natur (weiss)", "POM-C Rundstab natur (weiss)"]);
  assert.equal(now.picture, "Kunststofftechnik");
});
