import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyPage } from "../src/lib/content/studio/kinds/page/model";
import { blockOrder, heroBack, normalizeFields } from "../src/lib/content/studio/kinds/page/fields";
import { h1ModuleOf, moduleKeyOf, moveRow, newPageRows, removeRow } from "../src/lib/content/studio/kinds/page/blocklist";
import { renderNewPage } from "../src/lib/content/studio/kinds/page/newpage";
import { renderModule } from "../src/lib/content/studio/kinds/page/modules/render";
import { compatibleWithBlock, moduleFromBlock } from "../src/lib/content/studio/kinds/page/modules/switch";

// Content v12 (SARCLA 10.11.2026, screenshot 23 - the hero's menu greyed out): "also you should delete here if you want to
// replace by another hero". The page's own hero can go; a hero module takes its place and carries the H1.

const page = () => {
  const f = emptyPage("en-INT").fields;
  return normalizeFields({
    ...f, hero: { ...f.hero, eyebrow: "Discontinuation", title: "Kalrez 6221 and 6230 discontinued", sub: "Order until 27 November 2026.", button: { label: "To the FFKM O-rings", url: "/en-INT/ffkm.html" }, picture: { url: "https://www.apsoparts.com/media/wysiwyg/1_Sealing_Technology_1.jpg", alt: "O-rings", idea: "" } },
    intro: "The manufacturer has announced the discontinuation.", order: ["hero", "intro"],
  });
};

test("the hero taken out: off the page, its words kept, back as it was; a module may stand first", () => {
  const f = removeRow(page(), "hero");
  assert.equal(f.noHero, true);
  assert.deepEqual(blockOrder(f), ["intro"]);
  assert.ok(!newPageRows(f).some((r) => r.key === "hero"), "no hero row in the list");
  assert.equal(f.hero.title, "Kalrez 6221 and 6230 discontinued", "its words kept for when it comes back");
  assert.equal(normalizeFields(JSON.parse(JSON.stringify(f))).noHero, true, "kept when saved");
  const back = heroBack(f);
  assert.equal(back.noHero, undefined);
  assert.deepEqual(blockOrder(back), ["hero", "intro"]);
});

test("the hero changed into a hero module: its title, line, button carried in; that module's headline is the page's H1", () => {
  const f = page();
  const opts = compatibleWithBlock(f, "hero", "en-INT");
  assert.ok(opts.length >= 5 && opts.every((o) => o.def.category === "heroes"), "every hero module of the library");
  const m = moduleFromBlock(f, "hero", "hero-split", "en-INT")!;
  assert.equal(m.settings.title, "Kalrez 6221 and 6230 discontinued");
  assert.equal(m.settings.link.label, "To the FFKM O-rings");
  let g = removeRow(f, "hero");
  g = { ...g, modules: [{ id: "mhero", after: "", module: m }] };
  g = moveRow(g, moduleKeyOf("mhero"), 0);
  assert.equal(h1ModuleOf(g), "mhero");
  assert.equal(h1ModuleOf(f), null, "the hero there: its title is the H1");
  const { html } = renderNewPage(g);
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, "one H1 on the page");
  assert.match(html, /<h1 class="am-[\w-]+">Kalrez 6221 and 6230 discontinued<\/h1>/);
  // its h2 rules hold for the h1
  const drawn = renderModule(m, { h1: true });
  assert.match(drawn, /:is\(h1,h2\)/);
  assert.doesNotMatch(renderModule(m), /<h1/);
});
