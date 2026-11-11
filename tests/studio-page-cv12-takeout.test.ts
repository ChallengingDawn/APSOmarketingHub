import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyPage } from "../src/lib/content/studio/kinds/page/model";
import { newModule, normalizeModule } from "../src/lib/content/studio/kinds/page/modules/model";
import { takeOutField, takeOutOfModule } from "../src/lib/content/studio/kinds/page/blocklist";

// Content v12 (SARCLA 10.11.2026, screenshot 22: four proof tiles and an empty fifth): "here on tile I cannot take out - also
// other small elements, I should be able to delete them". What "Take it out" does where the click landed.

const page = () => {
  const f = emptyPage("en-INT").fields;
  return {
    ...f,
    hero: { ...f.hero, eyebrow: "Discontinuation", title: "Kalrez 6221 and 6230 discontinued", sub: "Order until 27 November 2026.", button: { label: "To the FFKM O-rings", url: "/en-INT/ffkm.html" }, picture: { url: "/api/content/picture/1-a", alt: "O-ring", idea: "" } },
    benefits: [{ id: "b1", title: "Clear last order date", text: "Until 27 November 2026." }, { id: "b5", title: "", text: "" }],
    faq: [{ id: "q1", q: "Until when?", a: "27 November 2026." }],
  } as typeof f;
};

test("a new page: a tile (the empty fifth too), a question - the whole item out; a small line, a button, a picture emptied", () => {
  const f = page();
  const tile = takeOutField(f, "benefits.b5.title")!;
  assert.equal(tile.label, "Take the tile out");
  assert.deepEqual(tile.fields.benefits.map((b) => b.id), ["b1"]);
  assert.deepEqual(takeOutField(f, "benefits.b1")!.fields.benefits.map((b) => b.id), ["b5"], "the tile itself selected");
  assert.equal(takeOutField(f, "faq.q1.a")!.fields.faq.length, 0);
  assert.equal(takeOutField(f, "hero.eyebrow")!.fields.hero.eyebrow, "");
  assert.equal(takeOutField(f, "hero.eyebrow")!.label, "Take the small line out");
  assert.deepEqual(takeOutField(f, "hero.button")!.fields.hero.button, { label: "", url: "" });
  assert.equal(takeOutField(f, "hero.picture")!.fields.hero.picture.url, "");
  assert.equal(takeOutField(f, "hero.title"), null, "never the page's title - its H1");
  assert.equal(takeOutField({ ...f, hero: { ...f.hero, eyebrow: "" } }, "hero.eyebrow"), null, "nothing there: nothing to take out");
});

test("a module: its small line, its button, a date, a point, one of its products - never its headline", () => {
  const m0 = newModule("campaign-date", "en-INT", "mcamp");
  const m = normalizeModule({ ...m0, settings: { ...m0.settings, eyebrow: "Discontinuation", title: "Order until 27 November", link: { label: "To the O-rings", url: "/en-INT/o.html" }, extra: { to: "27.11.2026" } } })!;
  assert.equal(takeOutOfModule(m, "eyebrow")!.module.settings.eyebrow, "");
  assert.deepEqual(takeOutOfModule(m, "link")!.module.settings.link, { label: "", url: "" });
  assert.equal(takeOutOfModule(m, "extra.to")!.module.settings.extra.to, undefined);
  assert.equal(takeOutOfModule(m, "title"), null);
  const g0 = newModule("bento-glass", "en-INT", "mglass");
  const card = (n: number) => ({ kind: "product" as const, name: `O-Ring ${n}`, url: `/en-INT/p${n}.html`, img: "", meta: "", number: "", children: [] });
  const g = normalizeModule({ ...g0, settings: { ...g0.settings, items: [card(1), card(2), card(3)], points: [{ title: "A", text: "a", icon: "check" }, { title: "B", text: "b", icon: "check" }] } })!;
  const out = takeOutOfModule(g, null, "O-Ring 2")!;
  assert.equal(out.label, "Take this product out");
  assert.deepEqual(out.module.settings.items.map((c) => c.name), ["O-Ring 1", "O-Ring 3"]);
  assert.deepEqual(takeOutOfModule(g, "points.0.text")!.module.settings.points.map((p) => p.title), ["B"]);
  assert.equal(takeOutOfModule(g, null, "words of nobody"), null);
});
