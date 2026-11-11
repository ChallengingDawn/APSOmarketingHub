import assert from "node:assert/strict";
import { test } from "node:test";
import { moduleLinks, relinkModule } from "../src/lib/content/studio/kinds/page/links";

// Content v13 (SARCLA 11.11.2026, screenshot 34: a button added in "Campaign with its dates" kept the en-INT product page
// in every language): "button only have one page, not for all the shop"
test("a button added in a module, and its points' links, follow the page's language like its own buttons", () => {
  const en = "https://www.apsoparts.com/en-INT/10341003-ffkm-o-ring-evolastr-pn794.html";
  const de = "https://www.apsoparts.com/de-CH/10341003-o-ring-ffkm-evolast-pn794.html";
  const s = {
    link: { label: "x", url: "" }, link2: { label: "", url: "" },
    points: [{ title: "a", text: "", icon: "", url: en }],
    adds: [{ id: "a1", kind: "button" as const, text: "View evolast PN794", url: en, img: "", look: "" }, { id: "a2", kind: "text" as const, text: "Hello", url: "", img: "", look: "" }],
  };
  assert.deepEqual(moduleLinks(s), [en]);
  const out = relinkModule(s, { [en]: de });
  assert.equal(out.adds[0].url, de);
  assert.equal(out.adds[1].url, "", "a line without an address stays without one");
  assert.equal(out.points[0].url, de);
  assert.equal(s.adds[0].url, en, "the main language's module is not changed");
});
