import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_ORDER, addBlock, addItem, blockOrder, emptyFields, moveBlock, moveBlockTo, moveItemTo, normalizeFields, onlyOnPage, removeBlock, setField,
  type Fields,
} from "../src/lib/content/studio/kinds/page/fields";
import { renderNewPage } from "../src/lib/content/studio/kinds/page/newpage";
import { blockOfPath, blocksOf, busyBlocks, itemOfPath, itemsOf } from "../src/lib/content/studio/kinds/page/outline";

// Content v5 (SARCLA 09.11.2026): "each block should be a section - for example block 4 should be subdivided" and "I should
// be able to add more elements by + next to sections, or in the photo". A page's blocks in an order; old pages keep theirs.

const page = () => {
  let f: Fields = emptyFields();
  f = { ...f, hero: { ...f.hero, title: "O-Ringe", picture: { url: "", alt: "", idea: "a seal" } }, intro: "Kurz.", benefitsTitle: "Warum wir" };
  f = { ...f, benefits: [{ id: "b1", title: "Lager", text: "Viel." }, { id: "b2", title: "Schnell", text: "Ja." }] };
  const s1 = addItem(f, "sections"); f = s1.fields;
  f = setField(f, `sections.${s1.id}.title`, "Werkstoffe");
  const s2 = addItem(f, "sections"); f = s2.fields;
  f = setField(f, `sections.${s2.id}.title`, "Lieferung");
  f = { ...f, faq: [{ id: "q1", q: "Wie?", a: "So." }], cta: { title: "Jetzt", text: "", button: { label: "Los", url: "" } } };
  return { f, s1: s1.id, s2: s2.id };
};

test("a page from before keeps its order: hero, intro, tiles, its sections, links, questions, call to action", () => {
  const { f, s1, s2 } = page();
  assert.equal(f.order, undefined);
  assert.deepEqual(blockOrder(f), ["hero", "intro", "benefits", `sections.${s1}`, `sections.${s2}`, "links", "faq", "cta"]);
  assert.deepEqual(blockOrder(emptyFields()), [...DEFAULT_ORDER], "an empty page: the sections' empty slot where they go");
  // drawn exactly as with the order spelled out - and the same as before the order existed (no + in Magento's copy)
  const spelled = { ...f, order: [...DEFAULT_ORDER] };
  assert.equal(renderNewPage(spelled).html, renderNewPage(f).html);
  assert.equal(renderNewPage(spelled, { marks: true }).html, renderNewPage(f, { marks: true }).html);
  assert.ok(!renderNewPage(f).html.includes("apx-np-add"), "no + in Magento's copy");
  assert.ok(!renderNewPage(f, { marks: true }).html.includes("apx-np-add"), "no + without `adds`");
});

test("the stored order is put right: unknown and gone blocks out, the hero first, new sections where they belong", () => {
  const { f, s1, s2 } = page();
  const odd = { ...f, order: ["cta", "nonsense", "hero", "cta", `sections.${s2}`, "sections.gone", "faq"] };
  assert.deepEqual(blockOrder(odd), ["hero", "cta", `sections.${s2}`, `sections.${s1}`, "faq"], "s1 after the last section placed");
  const none = { ...f, order: ["hero", "faq", "cta"] };
  assert.deepEqual(blockOrder(none), ["hero", `sections.${s1}`, `sections.${s2}`, "faq", "cta"], "no section placed: before the questions");
  assert.deepEqual(normalizeFields({ ...f, order: ["hero", 7, "x y", "faq"] }).order, ["hero", "faq"]);
  assert.equal(normalizeFields(f).order, undefined);
});

test("a block added at a place: a new section there, a single block moved there", () => {
  const { f, s1, s2 } = page();
  const a = addBlock(f, "text", 2);
  assert.match(a.key, /^sections\.[a-z0-9]+$/);
  assert.deepEqual(blockOrder(a.fields), ["hero", "intro", a.key, "benefits", `sections.${s1}`, `sections.${s2}`, "links", "faq", "cta"]);
  assert.equal(a.fields.sections[0].id, a.key.slice(9), "the sections' list follows the page (its numbers too)");
  const html = renderNewPage(a.fields, { marks: true }).html;
  assert.ok(html.indexOf('data-apx-b="intro-block"') < html.indexOf(`data-apx-b="${a.key}"`) && html.indexOf(`data-apx-b="${a.key}"`) < html.indexOf('data-apx-b="benefits"'), "drawn where it was added");
  const moved = addBlock(f, "faq", 1);
  assert.deepEqual(blockOrder(moved.fields).slice(0, 3), ["hero", "faq", "intro"], "the questions moved up under the hero");
  const first = addBlock(emptyFields(), "text", 3);
  assert.deepEqual(blockOrder(first.fields), ["hero", "intro", "benefits", first.key, "links", "faq", "cta"], "the empty slot gives way to the first section");
  assert.equal(addBlock(f, "cta", 0).fields.order?.[0], "hero", "never above the hero");
});

test("blocks move and go; the hero stays", () => {
  const { f, s1, s2 } = page();
  assert.deepEqual(blockOrder(moveBlock(f, "faq", -1)).slice(-3), ["faq", "links", "cta"]);
  assert.deepEqual(blockOrder(moveBlock(f, "intro", -1)), blockOrder(f), "nothing above the hero");
  assert.deepEqual(blockOrder(moveBlock(f, "hero", 1)), blockOrder(f));
  assert.deepEqual(blockOrder(moveBlockTo(f, `sections.${s2}`, 1)).slice(0, 2), ["hero", `sections.${s2}`]);
  const noFaq = removeBlock(f, "faq");
  assert.deepEqual(noFaq.faq, []);
  assert.ok(!blockOrder(noFaq).includes("faq"));
  assert.ok(!renderNewPage(noFaq, { marks: true }).html.includes('data-apx-b="faq"'), "gone from the page, its empty slot too");
  const noSec = removeBlock(f, `sections.${s1}`);
  assert.deepEqual(noSec.sections.map((s) => s.id), [s2]);
  assert.equal(removeBlock(f, "hero"), f);
  const bare = removeBlock(removeBlock(f, `sections.${s1}`), `sections.${s2}`);
  assert.ok(!blockOrder(bare).some((k) => k.startsWith("sections")), "the last section gone: no empty slot comes back");
});

test("the AI writes only the blocks the page has", () => {
  const { f } = page();
  const order = blockOrder(removeBlock(f, "faq"));
  const wrote = { ...f, faq: [{ id: "n", q: "Neu?", a: "Ja." }], intro: "Neu." };
  const kept = onlyOnPage(wrote, order);
  assert.deepEqual(kept.faq, []);
  assert.equal(kept.intro, "Neu.");
  const noSections = onlyOnPage(f, ["hero", "intro", "cta"]);
  assert.deepEqual(noSections.sections, []);
});

test("the map: every block its own numbered row, then the search engine fields; items as rows", () => {
  const { f, s1 } = page();
  const b = blocksOf(f);
  assert.deepEqual(b.map((x) => x.num), [1, 2, 3, 4, 5, 6, 7, 8, null]);
  assert.deepEqual(b.map((x) => x.name), ["Hero", "Intro", "Proof tiles", "Text and picture", "Text and picture", "Links to the shop", "Questions", "Call to action", "Search engine fields"]);
  assert.equal(b[2].count, 2);
  assert.equal(b[2].line, "Warum wir");
  assert.equal(b[3].line, "Werkstoffe");
  assert.equal(b[3].state, "partly");
  assert.equal(b[1].preview, "intro-block");
  assert.deepEqual(itemsOf(f, "benefits").map((i) => [i.name, i.sel]), [["Tile 1", "b:benefits.b1"], ["Tile 2", "b:benefits.b2"]]);
  assert.equal(blockOfPath(`sections.${s1}.picture`), `sections.${s1}`);
  assert.equal(blockOfPath("benefits.b1.title"), "benefits");
  assert.equal(blockOfPath("faqTitle"), "faq");
  assert.equal(blockOfPath("intro-block"), "intro");
  assert.equal(blockOfPath("nope"), null);
  assert.equal(itemOfPath("benefits.b1.title"), "benefits.b1");
  assert.equal(itemOfPath("links.l1"), "links.l1");
  assert.equal(itemOfPath("benefitsTitle"), null);
  assert.deepEqual(busyBlocks(`section:${s1}`, f), [`sections.${s1}`]);
  assert.deepEqual(busyBlocks("field:faq.q1.a", f), ["faq"]);
  assert.equal(busyBlocks("all", f).length, 9);
  assert.deepEqual(moveItemTo(f, "benefits", "b2", 0).benefits.map((x) => x.id), ["b2", "b1"]);
});

test("the +: between blocks and in a block with items, in the studio's preview only", () => {
  const { f } = page();
  const html = renderNewPage(f, { marks: true, adds: true }).html;
  assert.equal((html.match(/data-apx-add="/g) ?? []).length, blockOrder(f).length, "one after each block");
  assert.ok(html.includes('data-apx-add="1"'), "right under the hero = place 1");
  assert.ok(html.includes('data-apx-additem="benefits"') && html.includes('data-apx-additem="faq"'));
  assert.ok(!renderNewPage(f, { adds: true }).html.includes("data-apx-add"), "never in Magento's copy");
});

test("a picture being fine-tuned stays in view, veiled", () => {
  const { f } = page();
  const g = setField(f, "hero.picture", { url: "/api/content/picture/3-abc", alt: "", idea: "x" });
  const html = renderNewPage(g, { marks: true, busy: { tuning: ["hero.picture"] } }).html;
  assert.ok(html.includes("data-apx-making-over") && html.includes("Fine-tuning the picture") && html.includes("/api/content/picture/3-abc"));
  assert.ok(!renderNewPage(g, { busy: { tuning: ["hero.picture"] } }).html.includes("Fine-tuning"), "not in Magento's copy");
});
