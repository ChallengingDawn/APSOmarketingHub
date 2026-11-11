import assert from "node:assert/strict";
import { test } from "node:test";
import { newModule, normalizeModule } from "../src/lib/content/studio/kinds/page/modules/model";
import { moduleStrings, modulesStrings, withModulesStrings } from "../src/lib/content/studio/kinds/page/modules/translate";

// Content v13 (SARCLA 11.11.2026, screenshot 29): "translation didn't translate the modules in any languages" - the Kalrez
// page in German kept its modules' questions, headline and buttons in English.

const faq = () => normalizeModule({
  type: "faq", settings: {
    ...newModule("faq", "en-INT", "m1").settings,
    eyebrow: "Need to know", title: "Kalrez 6221 and 6230", link: { label: "See evolast PB794", url: "https://www.apsoparts.com/en-INT/x.html" },
    faq: [{ q: "Until when can I order?", a: "Until 27 November 2026." }],
    extra: { "w-go": "View product", "look-title": "c=#274e64", to: "27.11.2026", bg: "petrol" },
  },
})!;

test("a module's words go with the page's translation; dates, looks, addresses and its ground do not", () => {
  const m = faq();
  const ids = moduleStrings("m1", m).map((x) => x.id);
  for (const id of ["mod.m1.eyebrow", "mod.m1.title", "mod.m1.link.label", "mod.m1.faq.0.q", "mod.m1.faq.0.a", "mod.m1.extra.w-go"]) assert.ok(ids.includes(id), id);
  for (const id of ["mod.m1.extra.look-title", "mod.m1.extra.to", "mod.m1.extra.bg"]) assert.ok(!ids.includes(id), id);
  assert.ok(!moduleStrings("m1", m).some((x) => /apsoparts\.com/.test(x.text)), "never an address");
});

test("the translation lands in the module's settings, everything else kept", () => {
  const m = faq();
  const mods = [{ id: "m1", after: "", module: m }];
  const items = modulesStrings(mods).map((x) => ({ id: x.id, text: `DE:${x.text}` }));
  items.push({ id: "mod.m1.extra.to", text: "nicht" }, { id: "mod.m1.link.url", text: "https://evil.example" }, { id: "mod.other.title", text: "x" });
  const out = withModulesStrings(mods, items)![0].module.settings;
  assert.equal(out.title, "DE:Kalrez 6221 and 6230");
  assert.equal(out.eyebrow, "DE:Need to know");
  assert.equal(out.link.label, "DE:See evolast PB794");
  assert.equal(out.link.url, "https://www.apsoparts.com/en-INT/x.html", "the address is never set by a translation");
  assert.equal(out.faq[0].q, "DE:Until when can I order?");
  assert.equal(out.extra["w-go"], "DE:View product");
  assert.equal(out.extra.to, "27.11.2026", "a date stays");
  assert.equal(out.extra["look-title"], "c=#274e64");
  assert.equal(m.settings.title, "Kalrez 6221 and 6230", "the main language's module is not changed");
});

test("a page without modules, and an empty answer, change nothing", () => {
  assert.deepEqual(modulesStrings(undefined), []);
  assert.equal(withModulesStrings(undefined, []), undefined);
  const m = faq();
  assert.equal(withModulesStrings([{ id: "m1", after: "", module: m }], [])![0].module, m);
});

// screenshot 30: the German page's products kept the English address key, name and count - read again by their numbers
import { itemsAs, productNumbersOf } from "../src/lib/content/studio/kinds/page/modules/translate";
const card = (number: string, name: string, url: string) => ({ kind: "product" as const, name, url, img: "", meta: "", number, children: [] });

test("a translated page's products are the new store view's own, in the same order", () => {
  const m = normalizeModule({ type: "showcase-duo", settings: { ...newModule("showcase-duo", "en-INT", "d1").settings,
    items: [card("10341003", "FFKM O-ring evolast PN794", "https://www.apsoparts.com/en-INT/10341003-ffkm-o-ring-evolastr-pn794.html"), card("10341004", "FFKM O-ring evolast PB794", "https://www.apsoparts.com/en-INT/10341004-x.html")] } })!;
  assert.deepEqual(productNumbersOf(m), ["10341003", "10341004"]);
  const de = [card("10341004", "O-Ring FFKM evolast PB794", "https://www.apsoparts.com/de-CH/10341004-o-ring-ffkm-pb794.html"), card("10341003", "O-Ring FFKM evolast PN794", "https://www.apsoparts.com/de-CH/10341003-o-ring-ffkm-pn794.html")];
  const got = itemsAs(m.settings.items, de);
  assert.deepEqual(got.items.map((c) => c.number), ["10341003", "10341004"], "the order kept");
  assert.match(got.items[0].url, /\/de-CH\/10341003-o-ring-ffkm-pn794\.html$/);
  assert.equal(got.items[0].name, "O-Ring FFKM evolast PN794");
  assert.equal(got.missing, 0);
  const one = itemsAs(m.settings.items, [de[0]]);
  assert.equal(one.missing, 1);
  assert.match(one.items[0].url, /en-INT/, "a product the store view does not have keeps its card");
});

test("a module of categories or without numbers is not read again", () => {
  const cats = normalizeModule({ type: "showcase-duo", settings: { ...newModule("showcase-duo", "en-INT", "d2").settings, items: [{ ...card("", "O-rings", "https://www.apsoparts.com/en-INT/o-rings.html"), kind: "category" as const }] } })!;
  assert.deepEqual(productNumbersOf(cats), []);
});
