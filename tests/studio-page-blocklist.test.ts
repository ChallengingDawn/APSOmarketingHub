import assert from "node:assert/strict";
import { test } from "node:test";
import { addItem, blockOrder, emptyFields, setField, type Fields } from "../src/lib/content/studio/kinds/page/fields";
import { duplicateRow, moveRow, moveRowBy, newPageRows, removeRow, rowOfSelection, selectionOfRow, shopRowOf, shopRows, type FoundBlock } from "../src/lib/content/studio/kinds/page/blocklist";
import { newModule } from "../src/lib/content/studio/kinds/page/modules/model";
import type { PageChange } from "../src/lib/content/studio/kinds/page/model";

// SARCLA 10.11.2026 (Content v8, points 1-4): "on the left side leave only the blocks", "a module should be counted as a
// block - a normal block". The Build pane's list: a new page's blocks and its modules in one numbered list, moved,
// duplicated and taken out; a page of the shop's own blocks and what the hub put on it.

const page = (): { f: Fields; s1: string; s2: string } => {
  let f = emptyFields();
  f = { ...f, hero: { ...f.hero, title: "O-Ringe" }, intro: "Kurz." };
  const a = addItem(f, "sections"); f = a.fields;
  f = setField(f, `sections.${a.id}.title`, "Werkstoffe");
  const b = addItem(f, "sections"); f = b.fields;
  f = setField(f, `sections.${b.id}.title`, "Grössen");
  f = { ...f, modules: [{ id: "m1", after: "intro", module: newModule("row", "de-CH", "mrow1") }] };
  return { f, s1: a.id, s2: b.id };
};

test("a new page's list: its blocks with each module after its block, numbered as on the page", () => {
  const { f, s1, s2 } = page();
  const rows = newPageRows(f);
  assert.deepEqual(rows.map((r) => r.key), ["hero", "intro", "np:m1", "benefits", `sections.${s1}`, `sections.${s2}`, "links", "faq", "cta"]);
  assert.deepEqual(rows.map((r) => r.num), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const m = rows[2];
  assert.equal(m.kind, "module");
  assert.equal(m.module?.type, "row");
  assert.ok(m.note, "a module without its products says what it needs");
  assert.equal(rows[0].movable, false, "the hero stays first");
  assert.equal(rows[4].copyable, true);
  assert.equal(rows[1].copyable, false, "a page has one intro");
});

test("a module whose block is gone stands at the end; one at the top before the hero", () => {
  const { f } = page();
  const g = { ...f, modules: [...(f.modules ?? []), { id: "m2", after: "", module: newModule("row", "de-CH", "mrow2") }, { id: "m3", after: "gone", module: newModule("row", "de-CH", "mrow3") }] };
  const keys = newPageRows(g).map((r) => r.key);
  assert.equal(keys[0], "np:m2");
  assert.equal(keys[keys.length - 1], "np:m3");
});

test("a row dragged: blocks change order, a module takes the block above it", () => {
  const { f, s1, s2 } = page();
  // the module below the second text block
  const g = moveRow(f, "np:m1", newPageRows(f).findIndex((r) => r.key === `sections.${s2}`));
  assert.equal(g.modules?.[0].after, `sections.${s2}`);
  assert.deepEqual(newPageRows(g).map((r) => r.key).slice(4, 7), [`sections.${s2}`, "np:m1", "links"]);
  // a block dragged above the module: the module now follows it
  const h = moveRow(f, `sections.${s2}`, 2);
  assert.deepEqual(blockOrder(h).slice(0, 3), ["hero", "intro", `sections.${s2}`]);
  assert.equal(h.modules?.[0].after, `sections.${s2}`);
  assert.equal(h.sections[0].id, s2, "the sections' list follows the page");
  void s1;
});

test("nothing goes above the hero but a module; the hero never moves", () => {
  const { f } = page();
  assert.deepEqual(blockOrder(moveRow(f, "intro", 0)).slice(0, 2), ["hero", "intro"]);
  assert.equal(moveRow(f, "hero", 4), f);
  const g = moveRow(f, "np:m1", 0);
  assert.equal(g.modules?.[0].after, "");
  assert.equal(newPageRows(g)[0].key, "np:m1");
});

test("up / down by one", () => {
  const { f } = page();
  const g = moveRowBy(f, "np:m1", -1);
  assert.equal(g.modules?.[0].after, "hero");
  const h = moveRowBy(f, "np:m1", 1);
  assert.equal(h.modules?.[0].after, "benefits");
});

test("taken out: a block's modules stay where they stood, a module goes alone", () => {
  const { f } = page();
  const g = removeRow(f, "intro");
  assert.equal(g.intro, "");
  assert.equal(g.modules?.[0].after, "hero");
  assert.ok(!blockOrder(g).includes("intro"));
  assert.equal(removeRow(f, "np:m1").modules?.length, 0);
  assert.equal(removeRow(f, "hero"), f);
});

test("duplicated: a text-and-picture block right after itself, its look with it; a module with new ids; the hero not", () => {
  const { f, s1 } = page();
  const g0 = { ...f, looks: { [`sections.${s1}`]: { bg: "sand" as const }, [`sections.${s1}.title`]: { size: "l" as const } } };
  const r = duplicateRow(g0, `sections.${s1}`);
  assert.ok(r);
  const order = blockOrder(r.fields);
  assert.equal(order[order.indexOf(`sections.${s1}`) + 1], r.key);
  const id = r.key.slice(9);
  assert.equal(r.fields.sections.find((s) => s.id === id)?.title, "Werkstoffe");
  assert.equal(r.fields.looks[`sections.${id}`]?.bg, "sand");
  assert.equal(r.fields.looks[`sections.${id}.title`]?.size, "l");
  const m = duplicateRow(f, "np:m1");
  assert.ok(m);
  assert.equal(m.fields.modules?.length, 2);
  assert.notEqual(m.fields.modules?.[1].module.settings.id, f.modules?.[0].module.settings.id);
  assert.equal(m.fields.modules?.[1].after, "intro");
  assert.equal(duplicateRow(f, "hero"), null);
});

test("a selection in the page is its row, and the other way round", () => {
  assert.equal(rowOfSelection("f:hero.title"), "hero");
  assert.equal(rowOfSelection("b:intro-block"), "intro");
  assert.equal(rowOfSelection("f:intro"), "intro");
  assert.equal(rowOfSelection("b:benefits.x1"), "benefits");
  assert.equal(rowOfSelection("f:sections.ab.picture"), "sections.ab");
  assert.equal(rowOfSelection("f:faqTitle"), "faq");
  assert.equal(rowOfSelection("np:m1"), "np:m1");
  assert.equal(rowOfSelection("e:#x"), null);
  assert.equal(selectionOfRow("intro"), "b:intro-block");
  assert.equal(selectionOfRow("np:m1"), "np:m1");
});

test("a page of the shop: its own blocks, what the hub put, and what is not on the page at the end", () => {
  const mod = newModule("row", "de-CH", "mrowz");
  const changes = [
    { op: "insert", selector: "div.x", where: "after", html: "<div></div>", id: "c1", module: mod },
    { op: "text", selector: "h2.t", text: "Neu", id: "c2" },
    { op: "insert", selector: "div.gone", where: "after", html: "<div></div>", id: "c3", note: "Help is near", off: "Looks wrong - not applied: grey on petrol" },
    { op: "hide", selector: "div.z", id: "c4" },
  ] as unknown as PageChange[];
  const found: FoundBlock[] = [
    { selector: "div.slider", tag: "div", heading: "", text: "", pictures: 3, pb: "slider", change: null, touched: [], hidden: false },
    { selector: "div.x", tag: "div", heading: "Top-Produkte", text: "O-Ringe, Dichtungen", pictures: 4, pb: "", change: null, touched: [1], hidden: false },
    { selector: "", tag: "div", heading: "", text: "Beliebte", pictures: 0, pb: "", change: 0, touched: [], hidden: false },
    { selector: "div.z", tag: "div", heading: "", text: "Alt", pictures: 0, pb: "", change: null, touched: [3], hidden: true },
  ];
  const rows = shopRows(found, changes);
  assert.deepEqual(rows.map((r) => r.key), ["p:div.slider", "p:div.x", "c:c1", "p:div.z", "c:c3"]);
  assert.equal(rows[0].name, "Slider");
  assert.equal(rows[1].name, "Top-Produkte");
  assert.equal(rows[1].state, "changed");
  assert.equal(rows[2].kind, "module");
  assert.equal(rows[2].movable, true);
  assert.equal(rows[3].state, "hidden");
  assert.equal(rows[4].state, "held");
  assert.match(rows[4].note, /Looks wrong/);
  assert.equal(rows[0].movable, false, "the shop's own blocks keep their order");
  assert.equal(shopRowOf(rows, { change: 0 }), "c:c1");
  assert.equal(shopRowOf(rows, { block: "div.x" }), "p:div.x");
});
