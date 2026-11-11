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
