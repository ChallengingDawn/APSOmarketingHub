// Content v11 (SARCLA 10.11.2026): "Fill it with AI" on a module (its dates from the page, never invented; the brand's
// word rules), no module the AI cannot fill offered to a plan (the whole library checked), the switch gallery's types (a
// product module offers every other product module), and an edit of one block changing that block only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULES, moduleDef } from "../src/lib/content/studio/kinds/page/modules/registry";
import { moduleGap, newModule } from "../src/lib/content/studio/kinds/page/modules/model";
import { applyModuleWords, cleanModuleWords, datesIn, moduleSpec, moduleWordsUser, nowWords, pageWordsOf, type WordsCtx } from "../src/lib/content/studio/kinds/page/modules/words";
import { compatibleModules, switchTypes } from "../src/lib/content/studio/kinds/page/modules/switch";
import { PLAN_STORES, aiCanFill, filledAtBest, isPlannable, plannableLibrary } from "../src/lib/content/studio/kinds/page/plan/fillable";
import { fullGap, library, libModule, moduleGapOf } from "../src/lib/content/studio/kinds/page/plan/library";
import { cleanNewPageModules, newPageLibrary } from "../src/lib/content/studio/kinds/page/plan/newpage";
import { cleanPlan, planSystem } from "../src/lib/content/studio/kinds/page/plan/plan";
import { emptyFields, pinGrounds, type Fields } from "../src/lib/content/studio/kinds/page/fields";
import { removeRow, moveRow } from "../src/lib/content/studio/kinds/page/blocklist";
import { renderNewPage } from "../src/lib/content/studio/kinds/page/newpage";
import { BUTTON_LOOK_KEY, TEXT_LOOK_KEY } from "../src/lib/content/studio/kinds/page/modules/looks";
import { packLook } from "../src/lib/content/studio/kinds/page/style";
import { pageDoc } from "../src/lib/content/studio/kinds/page/model";

const B = "https://www.apsoparts.com";
const FFKM = `${B}/en-INT/sealing-technology/o-rings/ffkm.html`;
const KALREZ = "The manufacturer has announced the global discontinuation of parts made from selected Kalrez® compounds. Orders placed through the APSOparts webshop until 27 November 2026 secure your quantities; after that date, orders can only be fulfilled while stocks last.";
const ctx = (over: Partial<WordsCtx> = {}): WordsCtx => ({
  type: "campaign-date", pageText: `${KALREZ} FFKM O-rings`, lang: "en", store: "en-INT", links: [FFKM], linkNames: { [FFKM]: "FFKM O-rings" },
  categories: [], dates: datesIn(KALREZ), ...over,
});
const answer = (o: Record<string, unknown> = {}) => ({ eyebrow: "", title: "", text: "", button: "", link: "", button2: "", link2: "", items: [], extras: [], table: [], fill: "none", category: "", why: "", ...o });

/* ── the dates a page gives ───────────────────────────────────────────── */

test("datesIn: written and numeric dates in the shop's languages, once each", () => {
  const d = datesIn("until 27 November 2026 · bis 27. November 2026 · du 16.11. au 06.12.2026 · November 3, 2026 · 2026-12-24 · le 5 mars 2027 · 1. Dezember");
  assert.deepEqual(d.map((x) => x.label), ["27.11.2026", "16.11.", "06.12.2026", "03.11.2026", "24.12.2026", "05.03.2027", "01.12."]);
  assert.deepEqual(datesIn("O-rings in compounds 6221 and 6230, 70 Shore A, ISO 3601"), []);
});

/* ── "Fill it with AI" on a module ─────────────────────────────────────── */

test("Campaign with its dates: Ends from the page's own words, no start invented, the module full", () => {
  const r = cleanModuleWords(answer({
    eyebrow: "Discontinuation", title: "Order Kalrez® 6221 and 6230 ==until 27 November==", text: "Orders placed until then secure your quantities.",
    button: "To the FFKM O-rings", link: "/en-INT/sealing-technology/o-rings/ffkm.html", extras: [{ key: "to", value: "27.11.2026" }, { key: "from", value: "01.11.2026" }],
  }), ctx());
  assert.deepEqual(r.extras, [{ key: "to", value: "27.11.2026" }]);
  assert.ok(r.problems.some((p) => /Starts left empty: "01\.11\.2026" is not a date the page gives/.test(p)));
  assert.equal(r.link, FFKM);
  const m = applyModuleWords(newModule("campaign-date", "en-INT"), r);
  assert.equal(m.settings.extra.to, "27.11.2026");
  assert.equal(m.settings.extra.from ?? "", "");
  assert.equal(moduleGap(m), "", "it stands on the page");
  assert.equal(fullGap(m), "");
});

test("a written date the page gives is kept in the field's own form; a page with no date leaves the dates empty and says so", () => {
  const ok = cleanModuleWords(answer({ title: "Black Friday", extras: [{ key: "from", value: "16 November" }, { key: "to", value: "6 December 2026" }] }), ctx({ dates: datesIn("From 16 November to 6 December 2026") }));
  assert.deepEqual(ok.extras, [{ key: "from", value: "16.11." }, { key: "to", value: "06.12.2026" }]);
  const none = cleanModuleWords(answer({ title: "New compounds", extras: [{ key: "to", value: "30.12.2026" }] }), ctx({ pageText: "evolast compounds take their place", dates: [] }));
  assert.deepEqual(none.extras, []);
  assert.ok(none.problems.some((p) => /page gives no date/i.test(p)));
});

test("the brand's word rules: no stock or delivery promise, no discount, no Chemours, no figure the page does not give, a button only where its words say", () => {
  const r = cleanModuleWords(answer({
    title: "FFKM O-rings in stock", text: "Now 20% off. Made by Chemours. Resistant up to 327 °C. Orders until 27 November.",
    button: "To the PTFE sheets", link: FFKM,
  }), ctx());
  assert.equal(r.words.title, "");
  assert.doesNotMatch(r.words.text, /20%|Chemours|327/);
  assert.match(r.words.text, /Orders until 27 November/);
  assert.equal(r.words.button, "");
  assert.equal(r.link, "");
  const off = cleanModuleWords(answer({ title: "Order now", button: "Shop", link: `${B}/en-INT/elsewhere.html` }), ctx());
  assert.equal(off.link, "", "an address the page was not given is never a button's");
});

test("a module of questions or points takes them from items; a table only for a module that has one", () => {
  const faq = cleanModuleWords(answer({ title: "Questions", items: [{ title: "Until when can I order?", text: "Until 27 November 2026." }] }), ctx({ type: "faq" }));
  assert.equal(faq.words.faq.length, 1);
  assert.equal(moduleGap(applyModuleWords(newModule("faq", "en-INT"), faq)), "");
  const t = cleanModuleWords(answer({ title: "Compounds", table: [["Compound", "Replaced by"], ["Kalrez 6221", "evolast PN794"], ["Kalrez 6230", "evolast PN795"]] }), ctx({ type: "tech-compare", pageText: `${KALREZ} Kalrez 6221 evolast PN794 Kalrez 6230 evolast PN795` }));
  assert.equal(t.table?.length, 3);
  assert.equal(cleanModuleWords(answer({ table: [["a", "b"], ["c", "d"]] }), ctx()).table, null);
});

test("the question: the module's words with their limits, its dates, the page's dates, the pages a button may go to - and small", () => {
  const lib = libModule("campaign-date")!;
  assert.match(moduleSpec(lib), /to: Ends \(e\.g\. 06\.12\.2026\)/);
  const q = moduleWordsUser({ context: "PROJECT: Kalrez", page: KALREZ, lib, now: nowWords(newModule("campaign-date", "en-INT")), language: "English", store: "en-INT", dates: datesIn(KALREZ), links: [{ url: FFKM, name: "FFKM O-rings" }], tree: [], request: "" });
  assert.match(q, /THE DATES THE PAGE GIVES: 27\.11\.2026/);
  assert.match(q, /ffkm\.html · FFKM O-rings/);
  // what the studio sends stays far under the firewall's 8 KB, a full module of products included
  const big = newModule("bento", "de-CH");
  const filled = { ...big, settings: { ...big.settings, items: Array.from({ length: 12 }, (_, i) => ({ kind: "product" as const, name: `Produkt ${i} mit einem langen Namen`, url: `${B}/de-CH/p${i}.html`, img: `${B}/media/p${i}.jpg`, meta: "12 Artikel", number: `1140010${i % 10}`, children: [] })) } };
  assert.ok(JSON.stringify(nowWords(filled)).length < 2000);
});

test("a new page's words for the AI: its blocks and its other modules, not the module asked about", () => {
  const f: Fields = { ...emptyFields(), intro: KALREZ, modules: [
    { id: "m1", after: "intro", module: { ...newModule("cta", "en-INT"), settings: { ...newModule("cta", "en-INT").settings, title: "Secure your quantities" } } },
    { id: "m2", after: "intro", module: newModule("campaign-date", "en-INT") },
  ] };
  const w = pageWordsOf(f, "m2");
  assert.match(w, /intro: The manufacturer/);
  assert.match(w, /Secure your quantities/);
});

/* ── no module the AI cannot fill is ever planned (the whole library) ──── */

test("every module of the library: the fill rules fill it in every store view - or no plan ever picks it", () => {
  assert.ok(MODULES.length >= 113);
  const offered = new Set([...newPageLibrary().map((m) => m.id), ...plannableLibrary().map((m) => m.id)]);
  const left: string[] = [];
  for (const d of MODULES) {
    const fills = PLAN_STORES.every((s) => aiCanFill(d.id, s));
    if (fills) {
      for (const s of PLAN_STORES) { const m = filledAtBest(d.id, s)!; assert.equal(moduleGapOf(m), "", `${d.id} in ${s}`); assert.equal(fullGap(m), "", `${d.id} in ${s}`); }
    } else {
      left.push(d.id);
      assert.ok(!offered.has(d.id), `${d.id} cannot be filled, yet a plan is offered it`);
      assert.ok(!isPlannable(d.id));
      assert.doesNotMatch(planSystem(plannableLibrary()), new RegExp(`"${d.id}"`));
    }
  }
  // the modules of a table of figures and the shop's quote pictures - a person fills those in their settings
  assert.deepEqual(left.sort(), ["brand-quotes", "ind-matrix", "tech-compare", "tech-specs"]);
  assert.equal(library().length, MODULES.length);
});

test("a module the AI cannot fill, named anyway, is left out of a new page and of a plan", () => {
  const np = cleanNewPageModules([{ module: "tech-compare", at: "intro", how: "after", why: "x", eyebrow: "", title: "Compare", text: "Two compounds.", button: "", link: "", items: [], fill: "none", category: "", count: 0 }],
    { categories: [], links: [], linkNames: {}, pageText: "", lang: "en", store: "en-INT" });
  assert.equal(np.modules.length, 0);
  assert.ok(np.problems.some((p) => /not one the AI can fill/.test(p)));
  const parts = [{ id: "P1", kind: "page" as const, selector: "#maincontent .p1", tag: "div", heading: "O-rings", text: "O-rings", h1: true, change: "", module: "", holds: { pictures: 0, links: 0 }, pb: "" }];
  const plan = cleanPlan({ note: "x", steps: [{ do: "add", module: "tech-compare", at: "P1", where: "after", layout: "", why: "x", words: { eyebrow: "", title: "Compare", text: "", button: "", button2: "", points: [], faq: [] }, extras: [], link: "", link2: "", fill: { how: "none", category: "", numbers: "", count: 0 }, html: "" }] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { parts: parts as any, container: "#maincontent", categories: [], pageUrl: "", pageKind: "cms", pageText: "", newId: () => "c1", lang: "en", store: "en-INT", plannable: isPlannable });
  assert.equal(plan.steps.length, 0);
  assert.ok(plan.problems.some((p) => /not one the AI can fill/.test(p)));
});

/* ── the switch gallery: types, every product module ───────────────────── */

test("a product module can become every other product module - its own type first, the types listed with how many", () => {
  const products = MODULES.filter((d) => d.takes === "products").map((d) => d.id);
  assert.ok(products.length >= 8);
  for (const id of products) {
    const opts = compatibleModules(newModule(id, "de-CH")).map((o) => o.def.id);
    assert.deepEqual([...opts].sort(), products.filter((x) => x !== id).sort(), id);
    const own = moduleDef(id)!.category;
    const types = switchTypes(compatibleModules(newModule(id, "de-CH")));
    assert.equal(types[0].key, "all");
    assert.equal(types[0].count, products.length - 1);
    if (products.some((x) => x !== id && moduleDef(x)!.category === own)) assert.equal(types[1].key, own, `${id}: its own type first`);
    assert.equal(types.slice(1).reduce((n, t) => n + t.count, 0), products.length - 1);
  }
});

/* ── an edit of one block changes that block only ──────────────────────── */

const modOf = (html: string, id: string) => { const i = html.indexOf(`data-apx-mod="${id}"`); const j = html.indexOf("data-apx-mod=", i + 10); return html.slice(i, j < 0 ? undefined : j); };

test("two modules of the same type: one's button colour, title colour and size never touch the other's HTML or CSS", () => {
  const cta = (id: string) => { const m = newModule("cta", "de-CH", id); return { ...m, settings: { ...m.settings, title: "Den passenden O-Ring finden", text: "Unser Team hilft.", link: { label: "Kontakt", url: `${B}/de-CH/kontakt` } } }; };
  const f0: Fields = { ...emptyFields(), hero: { ...emptyFields().hero, title: "O-Ringe" }, modules: [{ id: "a1", after: "hero", module: cta("mone") }, { id: "a2", after: "hero", module: cta("mtwo") }] };
  const before = renderNewPage(f0, { marks: true });
  const styled = { ...f0.modules![0].module, settings: { ...f0.modules![0].module.settings, extra: { [BUTTON_LOOK_KEY.link]: packLook({ color: "#2e7d32", size: "l" }), [TEXT_LOOK_KEY.title]: packLook({ color: "#c22c6e", size: "xl" }) } } };
  const f1: Fields = { ...f0, modules: [{ ...f0.modules![0], module: styled }, f0.modules![1]] };
  const after = renderNewPage(f1, { marks: true });
  assert.notEqual(modOf(after.html, "a1"), modOf(before.html, "a1"), "the edited one changed");
  assert.equal(modOf(after.html, "a2"), modOf(before.html, "a2"), "the other one is byte-identical");
  assert.equal(after.css, before.css, "the page's own stylesheet is untouched");
  // every rule the edit added hangs under the edited module's own class - nothing for the shop's page around it
  const added = modOf(after.html, "a1").match(/<style>([\s\S]*?)<\/style>/)![1];
  for (const rule of added.replace(/@media[^{]+\{/g, "").split("}").map((r) => r.split("{")[0].trim()).filter((r) => r && !r.startsWith("@") && !/^(from|to|\d+%)$/.test(r))) {
    for (const sel of rule.split(/,(?![^(]*\))/)) assert.match(sel.trim(), /^\.apx-mone\b/, sel);
  }
});

test("two modules stored with one id get ids of their own - a look given one never reaches the other", () => {
  const m = newModule("cta", "de-CH", "msame");
  const d = pageDoc({ source: "new", store: "de-CH", fields: { ...emptyFields(), modules: [{ id: "a1", after: "", module: m }, { id: "a2", after: "", module: m }] } }, "de-CH");
  const ids = (d.fields.modules ?? []).map((x) => x.module.settings.id);
  assert.equal(new Set(ids).size, 2);
  assert.equal(ids[0], "msame");
  // the same id each time the page is read
  const again = pageDoc({ source: "new", store: "de-CH", fields: { ...emptyFields(), modules: [{ id: "a1", after: "", module: m }, { id: "a2", after: "", module: m }] } }, "de-CH");
  assert.deepEqual((again.fields.modules ?? []).map((x) => x.module.settings.id), ids);
});

test("a section taken out or moved never turns the grounds of the others", () => {
  const sec = (id: string) => ({ id, title: `T ${id}`, text: "x", side: "right" as const, picture: { url: "", alt: "", idea: "" } });
  const f: Fields = { ...emptyFields(), hero: { ...emptyFields().hero, title: "H" }, sections: [sec("s1"), sec("s2"), sec("s3")], order: ["hero", "sections.s1", "sections.s2", "sections.s3"] };
  const ground = (x: Fields, id: string) => new RegExp(`apx-np-bg-(\\w+)[^"]*"[^>]*data-apx-b="sections\\.${id}"`).exec(renderNewPage(x, { marks: true }).html)?.[1];
  const was = { s2: ground(f, "s2"), s3: ground(f, "s3") };
  assert.deepEqual(was, { s2: "grey", s3: "white" });
  const gone = removeRow(f, "sections.s1");
  assert.deepEqual({ s2: ground(gone, "s2"), s3: ground(gone, "s3") }, was);
  const moved = moveRow(f, "sections.s3", 1);
  assert.equal(ground(moved, "s2"), "grey");
  assert.equal(ground(moved, "s3"), "white");
  assert.equal(pinGrounds(pinGrounds(f)).looks["sections.s1"].bg, "white");
});
