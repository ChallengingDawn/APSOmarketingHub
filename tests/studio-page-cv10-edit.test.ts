import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyFields, normalizeFields, setLook, type Fields } from "../src/lib/content/studio/kinds/page/fields";
import { renderNewPage } from "../src/lib/content/studio/kinds/page/newpage";
import {
  buttonCheck, cleanButtonLook, cleanTextLook, colorKeyOf, labelOn, lookOfShopRules, normHex, packLook, readCheck, shopRulesOf, unpackLook, withShopLook,
} from "../src/lib/content/studio/kinds/page/style";
import { newModule, normalizeModule, type Card, type ModuleRef } from "../src/lib/content/studio/kinds/page/modules/model";
import { moduleDef } from "../src/lib/content/studio/kinds/page/modules/registry";
import { renderModule } from "../src/lib/content/studio/kinds/page/modules/render";
import { canSplit, splitOf, withSplit } from "../src/lib/content/studio/kinds/page/modules/looks";
import {
  compatibleModules, compatibleWithBlock, familyOf, fitNote, moduleFromBlock, plainWords, questionsToggle, switchModule,
} from "../src/lib/content/studio/kinds/page/modules/switch";

// Content v10 (SARCLA 10.11.2026, points 2-5): a text's colour (the shop's palette or one of its own, flagged when it cannot
// be read), the buttons' settings, a block changed into another COMPATIBLE module with its content kept, and the splits a
// drag in the preview sets - each the same in the preview and in what Magento gets.

const B = "https://www.apsoparts.com";
const product = (n: number): Card => ({ kind: "product", name: `O-Ring ${n}`, url: `${B}/de-CH/o-ring-${n}.html`, img: `${B}/media/catalog/product/${n}.jpg`, meta: "", number: `1140010${n}`, children: [] });

/* ── point 2: colours, contrast, a text's look ─────────────────────────── */

test("colours: a typed code read as #rrggbb, the shop's own named back, the words on a filled button chosen to read", () => {
  assert.equal(normHex("274E64"), "#274e64");
  assert.equal(normHex("#abc"), "#aabbcc");
  assert.equal(normHex("petrol"), null);
  assert.equal(normHex("#12345"), null);
  assert.equal(colorKeyOf("#D80901"), "red");
  assert.equal(colorKeyOf("#123456"), "#123456");
  assert.equal(labelOn("#274e64"), "#ffffff", "white words on petrol");
  assert.equal(labelOn("#ffe9a8"), "#1d2326", "ink words on a light yellow");
});

test("the readability guard: a colour that cannot be read on its ground is flagged with the reason, a heading needs 3:1", () => {
  const same = readCheck("petrol", ["#274e64"]);
  assert.equal(same.ok, false);
  assert.match(same.why, /cannot be read/);
  const pale = readCheck("#9fb3c0", ["#ffffff"]);
  assert.equal(pale.ok, false);
  assert.match(pale.why, /needs 4.5:1|need 4.5:1/);
  assert.equal(readCheck("#7a8b96", ["#ffffff"], true).ok, true, "large words need 3:1 only");
  assert.equal(readCheck("#7a8b96", ["#ffffff"], false).ok, false);
  assert.equal(readCheck("white", ["#274e64"]).ok, true);
  assert.equal(readCheck("red", ["#ffffff", "#274e64"]).ok, false, "the worst of its grounds counts");
  const pic = readCheck("#ffffff", []);
  assert.equal(pic.ok, true, "no ground known (a picture): not refused");
  assert.match(pic.why, /picture/);
  // a filled button carries its own words' colour - its fill must stand out from the ground; an outline must read itself
  assert.equal(buttonCheck({ style: "filled", color: "red" }, "red", ["#ffffff"]).ok, true);
  assert.equal(buttonCheck({ style: "filled", color: "#ffffff" }, "red", ["#ffffff"]).ok, false);
  assert.equal(buttonCheck({ style: "filled", color: "red" }, "red", ["#274e64"]).ok, true, "the call to action's red button on petrol: its words read on it");
  assert.equal(buttonCheck({ style: "filled", color: "petrol" }, "red", ["#274e64"]).ok, false, "a petrol button on petrol disappears");
  assert.equal(buttonCheck({ style: "outline", color: "#f2f4f5" }, "petrol", ["#ffffff"]).ok, false);
});

test("a text's look: kept clean, said back, and as a page of the shop's CSS rules (other rules of the element kept)", () => {
  assert.deepEqual(cleanTextLook({ color: "#ABCDEF", size: "xl", weight: "bold", italic: true, underline: "yes", align: "right", junk: 1 }),
    { color: "#abcdef", size: "xl", weight: "bold", italic: true, align: "right" });
  assert.deepEqual(cleanTextLook({ color: "chartreuse", size: "m" }), {}, "an unknown colour and the normal size are no look");
  const rules = shopRulesOf({ color: "petrol", size: "l", weight: "bold", italic: true, underline: true, align: "center" });
  assert.deepEqual(rules, { color: "#274e64", "font-size": "1.2em", "font-weight": "700", "font-style": "italic", "text-decoration": "underline", "text-align": "center" });
  assert.deepEqual(lookOfShopRules(rules), { color: "petrol", size: "l", weight: "bold", italic: true, underline: true, align: "center" });
  assert.deepEqual(withShopLook({ background: "#f2f4f5", color: "#000000" }, { color: "red" }), { background: "#f2f4f5", color: "#d80901" });
  assert.deepEqual(cleanTextLook(unpackLook(packLook({ color: "#123456", size: "s", weight: "regular", underline: true, align: "center" }))),
    { color: "#123456", size: "s", weight: "regular", underline: true, align: "center" });
});

function page(): Fields {
  return normalizeFields({
    ...emptyFields(),
    hero: { eyebrow: "Lebensmittel", title: "O-Ringe", sub: "Dichtungen.", picture: { url: `${B}/media/x/hero.jpg`, alt: "O-Ringe", idea: "" }, button: { label: "Zu den O-Ringen", url: "/de-CH/o-ringe.html" } },
    benefits: [{ id: "b1", title: "Ab 1 Stück", text: "Die Menge, die Sie brauchen." }, { id: "b2", title: "Werkstoffe", text: "Mit Datenblatt." }],
    sections: [{ id: "s1", title: "Der Werkstoff", text: "EPDM für **Heisswasser**.\n\n- Beständig", picture: { url: "/api/content/picture/12-ab", alt: "Proben", idea: "" }, side: "left" }],
    faq: [{ id: "q1", q: "Wie wähle ich?", a: "Nach *Medium* und Temperatur." }, { id: "q2", q: "Ab wann?", a: "Ab Stückzahl 1." }],
    faqTitle: "Fragen",
    cta: { title: "Jetzt finden", text: "Filtern Sie.", button: { label: "Filtern", url: "/de-CH/o-ringe.html" } },
    order: ["hero", "benefits", "sections.s1", "faq", "cta"],
  });
}

test("a new page: a text's own colour, weight, italic, underline and alignment drawn the same for the preview and for Magento", () => {
  let f = page();
  f = setLook(f, "hero.title", { hex: "#7a1fa2", weight: "regular", italic: true, underline: true, align: "right", size: "xl" });
  f = setLook(f, "sections.s1.text", { color: "white" });
  const shop = renderNewPage(f);
  const prev = renderNewPage(f, { marks: true });
  for (const r of [shop, prev]) {
    assert.match(r.html, /<h1 class="apx-np-h1 apx-np-s-xl apx-np-ar apx-np-hx-7a1fa2 apx-np-wr apx-np-it apx-np-ul"/);
    assert.match(r.css, /\.apx-np \.apx-np-blk \.apx-np-hx-7a1fa2\{color:#7a1fa2!important\}/, "its own colour is a rule of the page");
    assert.match(r.html, /class="apx-np-p apx-np-c-white"/);
  }
  assert.doesNotMatch(shop.html, /style="/, "no style attribute in Magento's copy");
  assert.deepEqual(normalizeFields(JSON.parse(JSON.stringify(f))).looks["hero.title"], { size: "xl", align: "right", hex: "#7a1fa2", weight: "regular", italic: true, underline: true }, "it is kept as it is saved");
});

/* ── point 3: buttons ──────────────────────────────────────────────────── */

test("a new page's button: style, colour of its own, size, no arrow, a new tab - and a page from before keeps its look", () => {
  const before = renderNewPage(setLook(page(), "hero.button", { button: "outline" }));
  assert.match(before.html, /class="apx-np-btn apx-np-btn-outline apx-np-bc-petrol"/, "v8's outline is an outline in petrol");
  assert.match(renderNewPage(page()).html, /class="apx-np-btn apx-np-btn-filled apx-np-bc-red"[^>]*>Zu den O-Ringen<svg/, "a button is red with its arrow by default");
  const f = setLook(page(), "hero.button", { style: "link", hex: "#0a7d55", bsize: "l", arrow: false, tab: true });
  const r = renderNewPage(f);
  assert.match(r.html, /<a class="apx-np-btn apx-np-btn-link apx-np-bx-0a7d55 apx-np-bs-l" href="\/de-CH\/o-ringe.html" target="_blank" rel="noopener">Zu den O-Ringen<\/a>/);
  assert.match(r.css, /\.apx-np-bx-0a7d55\{--b:#0a7d55;--bt:#ffffff\}/);
  // on the call to action's petrol ground an outline is white unless a colour is chosen
  assert.match(renderNewPage(setLook(page(), "cta.button", { style: "outline" })).html, /apx-np-btn-outline apx-np-bc-white/);
  assert.deepEqual(cleanButtonLook({ style: "outline", color: "PETROL", size: "l", arrow: true, tab: 1 }), { style: "outline", size: "l", arrow: true });
});

test("a module's button and words: their look kept in its settings and laid over what it draws (a new tab too)", () => {
  const m = newModule("cta", "de-CH", "mcta1");
  m.settings.title = "Den passenden O-Ring finden";
  m.settings.link = { label: "Jetzt filtern", url: "/de-CH/o-ringe.html" };
  m.settings.extra = { "btn-link": packLook({ style: "outline", color: "#0a7d55", size: "l", tab: true, arrow: false }), "look-title": packLook({ color: "red", weight: "regular", align: "center" }) };
  const html = renderModule(normalizeModule(m)!);
  assert.match(html, /<a class="[^"]*am-b1"[^>]*target="_blank" rel="noopener">Jetzt filtern<\/a>/);
  assert.match(html, /\.apx-mcta1 a\.am-b1\{[^}]*border:2px solid #0a7d55!important/);
  assert.match(html, /\.apx-mcta1 a\.am-b1::after\{display:none!important\}/);
  assert.match(html, /class="[^"]*am-l-title"[^>]*>Den passenden O-Ring finden</);
  assert.match(html, /\.am-l-title\{color:#d80901!important/);
});

/* ── point 4: change it into another module ────────────────────────────── */

test("compatible modules: a Questions module lists every Q&A module, a product row the product showcases - never itself", () => {
  const faq = newModule("faq", "de-CH");
  const qa = compatibleModules(faq).map((o) => o.def.id);
  assert.ok(qa.includes("help-faq-side") && qa.includes("help-faq-open"), qa.join(" "));
  assert.ok(!qa.includes("faq"));
  assert.ok(qa.every((id) => familyOf(moduleDef(id)!) === "questions"));
  const row = newModule("row", "de-CH");
  row.settings.items = [1, 2, 3, 4, 5, 6].map(product);
  const opts = compatibleModules(row);
  assert.ok(opts.length >= 10, `${opts.length} product modules`);
  assert.ok(opts.every((o) => moduleDef(o.def.id)!.takes === "products"));
  assert.equal(opts[0].def.category, "showcases", "its own category first");
  const duo = opts.find((o) => o.def.id === "showcase-duo")!;
  assert.equal(duo.note, "Shows 2 of your 6 products");
  const wall = fitNote(moduleDef("showcase-wall")!, { ...row.settings, items: row.settings.items.slice(0, 3) });
  assert.equal(wall.short, true);
  assert.match(wall.note, /Needs 6 products - you have 3/);
  const textpic = compatibleModules(newModule("textpic", "de-CH")).map((o) => o.def.id);
  assert.ok(textpic.includes("story-feature") && textpic.includes("hero-split"), textpic.join(" "));
});

test("switching keeps the content - questions, products, words and picture - and changes only the look", () => {
  const faq = newModule("faq", "de-CH", "mfaq1");
  faq.settings.title = "Fragen";
  faq.settings.faq = [{ q: "Wie wähle ich?", a: "Nach Medium." }, { q: "Ab wann?", a: "Ab 1 Stück." }];
  faq.settings.extra = { open: "1", split: "one:33" };
  const side = switchModule(faq, "help-faq-side");
  assert.equal(side.type, "help-faq-side");
  assert.deepEqual(side.settings.faq, faq.settings.faq);
  assert.equal(side.settings.title, "Fragen");
  assert.equal(side.settings.id, "mfaq1", "the same module on the page");
  assert.equal(side.settings.extra.open, "1", "all open stays all open");
  assert.equal(side.settings.extra.split, undefined, "a split belongs to its own columns");
  const row = newModule("row", "de-CH");
  row.settings.items = [1, 2, 3, 4].map(product);
  row.settings.title = "Beliebt";
  const car = switchModule(row, "bento");
  assert.deepEqual(car.settings.items.map((c) => c.number), row.settings.items.map((c) => c.number));
  assert.equal(car.settings.title, "Beliebt");
  assert.equal(switchModule(row, "showcase-duo").settings.items.length, 2, "a module that shows fewer keeps the first ones");
});

test("a new page's own blocks become a module of their family, their words carried in", () => {
  const f = page();
  assert.ok(compatibleWithBlock(f, "faq", "de-CH").some((o) => o.def.id === "faq"));
  assert.deepEqual(compatibleWithBlock(f, "hero", "de-CH"), [], "the hero holds the page's title: it stays");
  const q = moduleFromBlock(f, "faq", "help-faq-side", "de-CH")!;
  assert.equal(q.settings.title, "Fragen");
  assert.deepEqual(q.settings.faq, [{ q: "Wie wähle ich?", a: "Nach Medium und Temperatur." }, { q: "Ab wann?", a: "Ab Stückzahl 1." }]);
  const s = moduleFromBlock(f, "sections.s1", "textpic", "de-CH")!;
  assert.equal(s.settings.title, "Der Werkstoff");
  assert.equal(s.settings.text, "EPDM für Heisswasser.\n\n- Beständig");
  assert.equal(s.settings.feature?.img, "/api/content/picture/12-ab");
  assert.equal(s.settings.layout, "left", "the picture stays on its side");
  assert.equal(moduleFromBlock(setLook(f, "faq", { open: true }), "faq", "faq", "de-CH")!.settings.extra.open, "1", "all open stays all open");
  const t = moduleFromBlock(f, "benefits", "trust-reasons", "de-CH")!;
  assert.deepEqual(t.settings.points.map((p) => p.title), ["Ab 1 Stück", "Werkstoffe"]);
  const c = moduleFromBlock(f, "cta", "cta", "de-CH")!;
  assert.deepEqual(c.settings.link, { label: "Filtern", url: "/de-CH/o-ringe.html" });
  assert.equal(plainWords("**fett** und *schräg* mit [Link](/de-CH/x)"), "fett und schräg mit Link");
});

test("questions: all closed or all open - on a new page's Questions block and on a Q&A module, Magento's copy too", () => {
  assert.doesNotMatch(renderNewPage(page()).html, /<details[^>]*open/, "all closed: each opens on a click");
  assert.doesNotMatch(renderNewPage(page(), { marks: true }).html, /<details[^>]*open/, "the preview shows it as the shop will");
  const open = setLook(page(), "faq", { open: true });
  assert.equal((renderNewPage(open).html.match(/<details class="apx-np-q" open/g) ?? []).length, 2);
  assert.equal(questionsToggle("faq"), true);
  assert.equal(questionsToggle("help-faq-open"), false, "already all open, nothing to set");
  const m = newModule("help-faq-side", "de-CH");
  m.settings.title = "Fragen";
  m.settings.faq = [{ q: "Eins?", a: "Ja." }, { q: "Zwei?", a: "Nein." }, { q: "Drei?", a: "Vielleicht." }];
  const opened = renderModule({ ...m, settings: { ...m.settings, extra: { open: "1" } } });
  assert.equal((opened.match(/<details\b[^>]*\sopen/g) ?? []).length, 3);
  const closed = renderModule({ ...m, settings: { ...m.settings, extra: { open: "0" } } });
  assert.equal((closed.match(/<details\b[^>]*\sopen/g) ?? []).length, 0, "its first one closed too");
});

/* ── point 5: drag to resize ───────────────────────────────────────────── */

test("a split: the picture's share kept on the block (snapped), drawn for the desktop, the phone stacked as before", () => {
  const f = setLook(setLook(page(), "sections.s1", { split: 33 }), "hero", { split: 66 });
  const r = renderNewPage(f);
  assert.match(r.html, /class="apx-np-blk apx-np-sec apx-np-bg-white is-left apx-np-split-33"/);
  assert.match(r.html, /class="apx-np-blk apx-np-hero apx-np-bg-grey apx-np-split-66"/);
  assert.match(r.css, /\.apx-np-sec\.is-left\.apx-np-split-33 \.apx-np-in\{grid-template-columns:minmax\(0,33fr\) minmax\(0,67fr\)\}/);
  assert.match(r.css, /@media \(max-width:767px\)\{[\s\S]*\.apx-np-sec \.apx-np-in\{grid-template-columns:minmax\(0,1fr\)!important/, "a phone stacks");
  assert.equal(normalizeFields({ ...f, looks: { "sections.s1": { split: 41 } } }).looks["sections.s1"], undefined, "only the snapped steps are kept");
  const tiles = renderNewPage(setLook(page(), "benefits.b1", { span: 2 }));
  assert.match(tiles.html, /class="apx-np-card apx-np-span-2"/);
});

test("a module's two columns: dragged per layout, the module's own CSS untouched, a phone stacked", () => {
  const m: ModuleRef = newModule("textpic", "de-CH", "mtp001");
  m.settings.title = "Werkstoffe";
  m.settings.text = "Text.";
  m.settings.feature = { kind: "category", name: "Bild", url: `${B}/de-CH/`, img: `${B}/media/x.jpg`, meta: "", number: "", children: [] };
  assert.equal(canSplit(m), true);
  assert.equal(canSplit({ ...m, settings: { ...m.settings, feature: null } }), false, "no picture, one column");
  const s = withSplit(m, 33);
  assert.equal(splitOf(s), 33);
  assert.equal(splitOf({ ...s, settings: { ...s.settings, layout: "left" } }), null, "another layout keeps its own");
  assert.match(renderModule(s), /@media \(min-width:901px\)\{\.apx-mtp001 \.am-tp\{grid-template-columns:minmax\(0,33fr\) minmax\(0,67fr\)!important\}\}/);
  assert.equal(splitOf(withSplit(s, null)), null);
});
