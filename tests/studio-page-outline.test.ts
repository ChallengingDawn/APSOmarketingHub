import assert from "node:assert/strict";
import { test } from "node:test";
import { addItem, emptyFields, setField } from "../src/lib/content/studio/kinds/page/fields";
import { renderNewPage } from "../src/lib/content/studio/kinds/page/newpage";
import { busyOf, partOfPath, partsOf, picturesToMake } from "../src/lib/content/studio/kinds/page/outline";

// SARCLA 08.11.2026: "The UX and the Build on the left: can we improve it to be more fluid, subdivided" and "AI wrote the
// whole page ... It's not generating photos". The outline of a new page, its parts' states, what the AI is writing, and
// the pictures to make once it wrote.

const written = () => {
  let f = emptyFields();
  f = { ...f, hero: { ...f.hero, title: "O-Ringe für Lebensmittel", picture: { url: "", alt: "", idea: "a technician fitting a seal" } }, intro: "Kurz gesagt." };
  const s1 = addItem(f, "sections"); f = s1.fields;
  f = setField(f, `sections.${s1.id}.title`, "Werkstoffe");
  f = setField(f, `sections.${s1.id}.text`, "NBR, EPDM, FKM.");
  f = setField(f, `sections.${s1.id}.picture`, { url: "", alt: "", idea: "o-rings on steel" });
  const s2 = addItem(f, "sections"); f = s2.fields;
  f = setField(f, `sections.${s2.id}.title`, "Lieferung");
  f = setField(f, `sections.${s2.id}.text`, "Schnell.");
  f = setField(f, `sections.${s2.id}.picture`, { url: "/api/content/picture/9-k", alt: "", idea: "a parcel" });
  return { f, s1: s1.id, s2: s2.id };
};

test("each part says how far it is", () => {
  const empty = partsOf(emptyFields());
  assert.deepEqual(empty.map((p) => p.key), ["hero", "intro", "benefits", "sections", "links", "faq", "cta", "seo"]);
  assert.ok(empty.every((p) => p.state === "empty"));
  const { f } = written();
  const by = Object.fromEntries(partsOf(f).map((p) => [p.key, p]));
  assert.equal(by.hero.state, "picture", "written, its picture still to make");
  assert.equal(by.hero.summary, "O-Ringe für Lebensmittel");
  assert.equal(by.intro.state, "written");
  assert.equal(by.sections.state, "picture");
  assert.equal(by.sections.missing, 1, "one of two sections has its picture");
  assert.equal(by.sections.count, 2);
  assert.equal(by.sections.summary, "Werkstoffe · Lieferung");
  assert.equal(by.cta.state, "empty");
  const half = partsOf({ ...f, seo: { title: "Meta", description: "", urlKey: "" } });
  assert.equal(half.find((p) => p.key === "seo")?.state, "partly");
});

test("a field or a block belongs to its part", () => {
  assert.equal(partOfPath("hero.button.label"), "hero");
  assert.equal(partOfPath("intro-block"), "intro");
  assert.equal(partOfPath("benefitsTitle"), "benefits");
  assert.equal(partOfPath("sections.ab12.picture"), "sections");
  assert.equal(partOfPath("faqTitle"), "faq");
  assert.equal(partOfPath("seo.description"), "seo");
  assert.equal(partOfPath("nonsense"), null);
});

test("what the AI is writing shimmers - in the outline and in the page", () => {
  const { f, s1 } = written();
  const all = busyOf("all", f);
  assert.equal(all.parts.length, 8);
  assert.ok(all.blocks.includes("hero") && all.blocks.includes(`sections.${s1}`) && all.blocks.includes("intro-block"));
  assert.deepEqual(busyOf("hero", f), { parts: ["hero"], blocks: ["hero"], fields: [] });
  assert.deepEqual(busyOf(`section:${s1}`, f), { parts: ["sections"], blocks: [`sections.${s1}`], fields: [] });
  assert.deepEqual(busyOf("field:hero.title", f), { parts: ["hero"], blocks: [], fields: ["hero.title"] });
  assert.deepEqual(busyOf("rewrite", f), { parts: [], blocks: [], fields: [] }, "an existing page's rewrite is not a part");
  assert.deepEqual(busyOf(null, f).parts, []);
  const html = renderNewPage(f, { marks: true, busy: { blocks: ["hero"], fields: ["intro"], pictures: ["hero.picture"] } }).html;
  assert.match(html, /data-apx-b="hero" data-apx-busy/);
  assert.match(html, /data-apx-f="intro" data-apx-busy/);
  assert.match(html, /data-apx-f="hero.picture" data-apx-making><span>Making the picture…/);
  const paste = renderNewPage(f, { busy: { blocks: ["hero"], pictures: ["hero.picture"] } }).html;
  assert.doesNotMatch(paste, /data-apx/, "Magento never gets the studio's marks");
});

test("after the AI wrote, the pictures it had an idea for are made - never one the person chose", () => {
  const { f, s1 } = written();
  assert.deepEqual(picturesToMake(f, "all").map((j) => j.path), ["hero.picture", `sections.${s1}.picture`], "the second section has its picture");
  assert.deepEqual(picturesToMake(f, "hero").map((j) => j.path), ["hero.picture"]);
  assert.deepEqual(picturesToMake(f, "sections").map((j) => j.path), [`sections.${s1}.picture`]);
  assert.deepEqual(picturesToMake(f, "section", s1).map((j) => j.idea), ["o-rings on steel"]);
  assert.deepEqual(picturesToMake(f, "intro"), [], "a part without pictures");
  assert.deepEqual(picturesToMake(f, "all", null, 1).length, 1, "at most so many at once");
  assert.equal(picturesToMake(f, "all")[0].aspect, "3:2");
  const noIdea = { ...f, hero: { ...f.hero, picture: { url: "", alt: "", idea: " " } } };
  assert.deepEqual(picturesToMake(noIdea, "hero"), [], "no idea, no picture");
});
