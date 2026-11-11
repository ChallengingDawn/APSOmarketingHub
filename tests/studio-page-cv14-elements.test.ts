import assert from "node:assert/strict";
import { test } from "node:test";
import { newModule, normalizeModule, type ModuleRef } from "../src/lib/content/studio/kinds/page/modules/model";
import { MODULES, drawModule, fieldOf } from "../src/lib/content/studio/kinds/page/modules/registry";
import { renderModule } from "../src/lib/content/studio/kinds/page/modules/render";
import { SAMPLES2 } from "../src/lib/content/studio/kinds/page/modules/library2";
import {
  duplicatePart, itemOfLink, listOfPart, lookKind, movePart, partAt, partInfo, partLookKey, partOrder, takeOutPart, withPartLook, withPartPicture, type Probe,
} from "../src/lib/content/studio/kinds/page/modules/elements";
import { DATE_PANEL_KEY, PART_LOOK_KEY, isLookKey, withLooks } from "../src/lib/content/studio/kinds/page/modules/looks";
import { packLook } from "../src/lib/content/studio/kinds/page/style";

// Content v14 (SARCLA 11.11.2026 ~13:40): "some elements still don't have editable options, or not much. Can you review in
// depth the element options and popups, to make them more dynamic and really well structured: link, product, photos,
// element text, everywhere we can make it more." Every element of the same kind gets the same options everywhere: a
// list's words their look (every one alike), a list's item Duplicate and Move, a point's picture and a card's photo the
// one picture popup, a campaign's dates their look and their panel's colour - and what Magento gets stays byte-identical
// until one of them is set.

const B = "https://www.apsoparts.com";
const prod = (n: number) => ({ kind: "product" as const, name: `Produkt ${n}`, url: `${B}/de-CH/produkt-${n}.html`, img: `${B}/media/catalog/product/p${n}.jpg`, meta: `${10 + n} Artikel`, number: `1140010${n}`, children: [] });
const probe = (p: Partial<Probe>): Probe => ({ tag: "p", text: "", words: false, href: null, src: null, inLink: null, cls: "", srcs: [], hrefs: [], ...p });
const withSettings = (type: string, patch: Partial<ModuleRef["settings"]>): ModuleRef => { const m = newModule(type, "de-CH", "mtest"); return normalizeModule({ type, settings: { ...m.settings, ...patch } })!; };

/** The gallery's sample of a module, as the harness fills it. */
function sample(id: string): ModuleRef {
  const d = MODULES.find((x) => x.id === id)!;
  const m = newModule(id, "de-CH", "mtest");
  const s = { ...m.settings, ...(d.sample ?? {}), ...(SAMPLES2[id]?.("de-CH") ?? {}) } as ModuleRef["settings"];
  if (d.takes === "products" && !s.items.length) s.items = Array.from({ length: Math.max(d.min, Math.min(d.max || 6, 6)) }, (_, i) => prod(i + 1));
  if (!s.title) s.title = "Der Titel";
  return normalizeModule({ type: id, settings: s })!;
}

test("nothing set, nothing laid over: every module of the library draws exactly as before (old documents byte-identical)", () => {
  let n = 0;
  for (const d of MODULES) {
    const m = sample(d.id);
    const drawn = d.render(m, {});
    // no look of this round in its settings: what it drew is what Magento gets, the very same object
    assert.equal(withLooks(m, drawn), drawn, d.id);
    n++;
  }
  assert.ok(n >= 90, `${n} modules`);
});

test("a point's picture is its own element - the picture popup - and taking it out keeps the point", () => {
  const def = MODULES.find((d) => fieldOf(d, "points")?.pictures);
  assert.ok(def, "a module whose points carry pictures");
  const m = withSettings(def!.id, { points: [{ title: "Eins", text: "", icon: "check", img: `${B}/media/wysiwyg/a.jpg` }, { title: "Zwei", text: "", icon: "check" }] });
  assert.equal(partAt(m, probe({ tag: "img", src: `${B}/media/wysiwyg/cache/x/a.jpg` })), "points.0.img");
  const info = partInfo(m, "points.0.img")!;
  assert.equal(info.kind, "picture");
  assert.equal(info.img, `${B}/media/wysiwyg/a.jpg`);
  const t = takeOutPart(m, "points.0.img")!;
  assert.equal(t.label, "Take the picture out");
  assert.equal(t.module.settings.points.length, 2, "the point stays");
  assert.equal(t.module.settings.points[0].img, undefined);
  assert.equal(t.module.settings.points[0].title, "Eins");
  const put = withPartPicture(m, "points.1.img", { url: "/api/content/picture/7-abc" })!;
  assert.equal(put.settings.points[1].img, "/api/content/picture/7-abc");
});

test("a card's photo: another photo keeps the card that product (the person's); a product picked puts the whole product", () => {
  const m = withSettings("row", { items: [prod(1), prod(2)] });
  const info = partInfo(m, "items.1.img")!;
  assert.equal(info.kind, "picture");
  assert.equal(info.card!.name, "Produkt 2");
  const own = withPartPicture(m, "items.1.img", { url: "/api/content/picture/9-xyz" })!;
  const c = own.settings.items[1];
  assert.deepEqual([c.name, c.url, c.number, c.img, c.from], ["Produkt 2", `${B}/de-CH/produkt-2.html`, "11400102", "/api/content/picture/9-xyz", "person"]);
  const other = withPartPicture(m, "items.1.img", { url: `${B}/media/catalog/product/z.jpg`, name: "O-Ring Z", product: { number: "10341004", url: `${B}/de-CH/z.html` } })!;
  assert.deepEqual([other.settings.items[1].name, other.settings.items[1].number, other.settings.items[1].url], ["O-Ring Z", "10341004", `${B}/de-CH/z.html`]);
  assert.equal(takeOutPart(m, "items.1.img"), null, "a card always shows a photo");
});

test("a list's item: Duplicate and Move up / down - points, questions, products, a table's rows (its head stays first)", () => {
  const pts = withSettings("tool-oring", { points: [{ title: "A", text: "a", icon: "check" }, { title: "B", text: "b", icon: "check" }, { title: "C", text: "c", icon: "check" }] });
  assert.deepEqual(listOfPart("points.1.title"), { list: "points", i: 1, rest: ".title" });
  const o = partOrder(pts, "points.0.title")!;
  assert.deepEqual([o.up, o.down], [false, true]);
  const mv = movePart(pts, "points.0.title", 1)!;
  assert.equal(mv.part, "points.1.title", "its popup follows it");
  assert.deepEqual(mv.module.settings.points.map((p) => p.title), ["B", "A", "C"]);
  assert.equal(movePart(pts, "points.2", 1), null, "the last goes no further");
  const dup = duplicatePart(pts, "points.1")!;
  assert.equal(dup.part, "points.2");
  assert.deepEqual(dup.module.settings.points.map((p) => p.title), ["A", "B", "B", "C"]);
  assert.notEqual(dup.module.settings.points[1], dup.module.settings.points[2], "a copy, not the same object");

  const row = withSettings("row", { items: [prod(1), prod(2), prod(3)], fill: { how: "category", category: `${B}/de-CH/o-ringe.html`, ask: "", at: "" } as never });
  const dc = duplicatePart(row, "items.0")!;
  assert.equal(dc.part, "items.1");
  assert.deepEqual(dc.module.settings.items.map((c) => c.name), ["Produkt 1", "Produkt 1", "Produkt 2", "Produkt 3"]);
  assert.equal(dc.module.settings.fill?.how, "hand", "put by hand from now on");
  assert.equal(partOrder(row, "items.2")!.word, "product");

  const def = MODULES.find((d) => fieldOf(d, "table"));
  if (def) {
    const t = withSettings(def.id, { table: [["Werkstoff", "Härte"], ["NBR", "70"], ["FKM", "75"]] });
    assert.equal(partOrder(t, "table.0.1"), null, "the head row is not moved");
    assert.equal(movePart(t, "table.1.0", -1), null, "nothing goes above the head");
    assert.deepEqual(movePart(t, "table.1.0", 1)!.module.settings.table.map((r) => r[0]), ["Werkstoff", "FKM", "NBR"]);
  }
  // full: no more
  const max = fieldOf(MODULES.find((d) => d.id === "tool-oring")!, "points")?.max ?? 12;
  const full = withSettings("tool-oring", { points: Array.from({ length: max }, (_, i) => ({ title: `P${i}`, text: "", icon: "check" })) });
  assert.equal(duplicatePart(full, "points.0"), null);
  assert.equal(partOrder(full, "points.0")!.dup, false);
});

test("every text of a module has its look: a point's title and line, a question, an answer, a date, a badge, a cell", () => {
  const m = sample("campaign-date");
  for (const p of ["points.0.title", "points.0.text", "faq.1.q", "faq.0.a", "table.1.2", "extra.badge", "extra.from", "extra.until"]) assert.equal(lookKind(m, p), "text", p);
  assert.equal(partLookKey("points.3.title"), PART_LOOK_KEY.pointTitle);
  assert.equal(partLookKey("faq.0.a"), PART_LOOK_KEY.answer);
  assert.equal(partLookKey("extra.to"), PART_LOOK_KEY.dates, "every date one look");
  assert.equal(partLookKey("extra.badge"), "look-x-badge");
  for (const k of Object.values(PART_LOOK_KEY)) assert.ok(isLookKey(k), `${k} is a look, never words`);
  assert.ok(isLookKey(DATE_PANEL_KEY) && isLookKey("look-x-badge"));
});

test("a list's look is laid over every one of them, and only then", () => {
  const m = withSettings("tool-oring", { points: [{ title: "Nach Größe", text: "Innen", icon: "ruler" }, { title: "Nach Werkstoff", text: "NBR", icon: "layers" }] });
  const before = renderModule(m);
  const set = withPartLook(m, "points.0.title", packLook({ color: "petrol", size: "l" }))!;
  assert.equal(set.settings.extra[PART_LOOK_KEY.pointTitle], packLook({ color: "petrol", size: "l" }));
  const html = renderModule(set);
  assert.notEqual(html, before);
  assert.equal((html.match(/am-look-pt/g) ?? []).length >= 3, true, "both titles marked, and the rule");
  assert.match(html, /\.am-look-pt\.am-look-pt\{color:#274e64!important/);
  assert.equal(renderModule(withPartLook(set, "points.0.title", "")!), before, "taken off: as before, byte for byte");
});

test("a campaign's dates: their look and their panel's colour", () => {
  const m = sample("campaign-date");
  const before = renderModule(m);
  const panel = { ...m, settings: { ...m.settings, extra: { ...m.settings.extra, [DATE_PANEL_KEY]: "petrol" } } };
  assert.match(renderModule(panel), /\.am-dk\{background:#274e64!important;color:#ffffff\}/);
  const look = withPartLook(m, "extra.from", packLook({ color: "white", size: "xl" }))!;
  assert.match(renderModule(look), /\.am-dk b\{font-size:60px!important\}/);
  assert.equal(renderModule({ ...m, settings: { ...m.settings, extra: { ...m.settings.extra } } }), before);
  // a module without a dates' panel never gets its rules
  const row = withSettings("row", { items: [prod(1)], extra: { [DATE_PANEL_KEY]: "petrol" } });
  assert.doesNotMatch(drawModule(row).css ?? "", /am-dk/);
});

test("a tile's button tells the tile it stands on (its product: Pick another product)", () => {
  const m = withSettings("bento", { items: [prod(1), prod(2)] });
  assert.equal(itemOfLink(m, `${B}/fr-CH/produkt-2.html`), "items.1");
  assert.equal(itemOfLink(m, "/de-CH/andere.html"), null);
  assert.equal(itemOfLink(m, null), null);
});
