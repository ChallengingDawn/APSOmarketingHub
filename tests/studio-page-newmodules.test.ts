import assert from "node:assert/strict";
import { test } from "node:test";
import { blockOrder, emptyFields, removeBlock, type Fields } from "../src/lib/content/studio/kinds/page/fields";
import { mergeFill } from "../src/lib/content/studio/kinds/page/fill";
import { renderNewPage } from "../src/lib/content/studio/kinds/page/newpage";
import { library } from "../src/lib/content/studio/kinds/page/plan/library";
import {
  MAX_MODULES, NEWPAGE_SCHEMA, NEWPAGE_SKIP_CATEGORIES, blockKeyOf, cleanNewPageModules, composeModules, guardFill, guardText, isAiModule, needsShop,
  newPageAddresses, newPageExample, newPageLibrary, newPageSystem, newPageUser, ownPoints, type NewPageCtx, type NewPageModule,
} from "../src/lib/content/studio/kinds/page/plan/newpage";

// Content v8 (SARCLA 10.11.2026, point 5): "When the AI is generating a new page it should also generate the modules".
// The whole-page write answers with the text blocks AND modules of the library among them; the hub checks them, places
// them, fills them from the shop. Proved here with canned answers - no AI call, no shop read.

const B = "https://www.apsoparts.com";
const FKM = `${B}/de-CH/dichtungstechnik/o-ringe-x-ringe/o-ring-fkm.html`;
const ORINGS = `${B}/de-CH/dichtungstechnik/o-ringe-x-ringe.html`;
const tree = [{ name: "Dichtungstechnik", url: `${B}/de-CH/dichtungstechnik.html`, depth: 0 }, { name: "O-Ringe & X-Ringe", url: ORINGS, depth: 1 }];
const cands = [{ url: "/de-CH/dichtungstechnik/o-ringe-x-ringe/o-ring-fkm.html", name: "O-Ring FKM", kind: "category" }, { url: "/de-CH/kontakt", name: "Kontakt", kind: "cms" }];
const ctx: NewPageCtx = { ...newPageAddresses(tree, cands), pageText: "O-Ringe aus FKM für Chemie und Hitze", lang: "de" };

const lib = newPageLibrary();
const prod = lib.find((m) => m.takes === "products" && m.max >= 4)!;
const faq = lib.find((m) => m.takes === "none" && m.words.some((w) => w.key === "faq") && !m.words.some((w) => w.key === "points"))!;
const cta = lib.find((m) => m.category === "cta" && m.takes === "none" && m.words.some((w) => w.key === "button"))!;
const tool = lib.find((m) => m.category === "tools" && m.takes === "none")!;
const hero = library().find((m) => m.category === "heroes")!;
const words = (o: Record<string, unknown> = {}) => ({ eyebrow: "", title: "", text: "", button: "", button2: "", points: [], faq: [], ...o });
const none = { how: "none", category: "", numbers: "", count: 0 };
const step = (o: Record<string, unknown>) => ({ layout: "", why: "Helps buyers", words: words(), extras: [], link: "", link2: "", fill: none, how: "after", ...o });

test("the write's schema carries the text blocks and the modules; the library a new page takes has no hero of its own", () => {
  assert.ok(NEWPAGE_SCHEMA.required.includes("modules"));
  assert.ok(NEWPAGE_SCHEMA.required.includes("hero") && NEWPAGE_SCHEMA.required.includes("sections"));
  assert.ok(lib.length > 60, "most of the library");
  assert.ok(lib.every((m) => !(NEWPAGE_SKIP_CATEGORIES as readonly string[]).includes(m.category)));
  // the prompt lists the library by its own ids, and the example is made of them
  const sys = newPageSystem();
  assert.match(sys, new RegExp(`"${prod.id}"`));
  assert.doesNotMatch(sys, new RegExp(`"${hero.id}" `));
  const ex = newPageExample();
  for (const id of [...ex.matchAll(/"module":"([^"]+)"/g)].map((m) => m[1])) assert.ok(lib.some((m) => m.id === id), `${id} is in the library`);
  const user = newPageUser({ tree, candidates: cands, language: "German", store: "de-CH" });
  assert.match(user, /WRITE THE MODULES' WORDS IN: German \(store view de-CH\)/);
  assert.match(user, /o-ringe-x-ringe\.html · O-Ringe & X-Ringe/);
});

test("the AI's modules kept where they make sense - every refusal said", () => {
  const r = cleanNewPageModules([
    step({ module: prod.id, at: "intro", words: words({ title: "FKM O-Ringe im Shop", button: "Alle FKM O-Ringe" }), link: cands[0].url, fill: { how: "category", category: cands[0].url, numbers: "", count: 6 } }),
    step({ module: "not-a-module", at: "intro" }),
    step({ module: hero.id, at: "hero" }),
    step({ module: prod.id, at: "faq" }),
    step({ module: faq.id, at: "faq", how: "instead", words: words({ title: "Häufige Fragen", faq: [{ q: "Ist FKM ab Lager?", a: "Ja, ab Lager in 24 h." }, { q: "Wofür eignet sich FKM?", a: "Für Öle, Kraftstoffe und hohe Temperaturen." }] }) }),
    step({ module: cta.id, at: "hero", how: "instead", words: words({ title: "Fragen zu FKM?", button: "Zum Kontakt" }), link: "/de-CH/kontakt" }),
    step({ module: tool.id, at: "nowhere" }),
  ], ctx);
  assert.deepEqual(r.modules.map((m) => m.module), [prod.id, faq.id, cta.id]);
  assert.ok(r.problems.some((p) => /not-a-module/.test(p)));
  assert.ok(r.problems.some((p) => /not one a new page takes/.test(p)));
  assert.ok(r.problems.some((p) => /came twice/.test(p)));
  assert.ok(r.problems.some((p) => /not a block of the page/.test(p)));
  const [p, q, c] = r.modules;
  // the subject's category, made whole; the button goes where it says
  assert.equal(p.fill.how, "category");
  assert.equal(p.fill.category, FKM);
  assert.equal(p.link, FKM);
  assert.match(p.line, /^Add a .* after the intro$/);
  // a question with a stock or delivery promise is left out ("ab Lager" too), the other kept
  assert.deepEqual(q.words.faq.map((x) => x.q), ["Wofür eignet sich FKM?"]);
  assert.equal(q.how, "instead");
  // never in place of the hero: after it
  assert.equal(c.how, "after");
  assert.equal(c.link, `${B}/de-CH/kontakt`);
  assert.equal(c.words.button, "Zum Kontakt");
});

test("a module whose points are the shop's own pages keeps them; a button that goes elsewhere loses its words", () => {
  const pointsLinked = lib.find((m) => m.category === "tools" && m.words.some((w) => w.key === "points"))!;
  const r = cleanNewPageModules([
    step({ module: pointsLinked.id, at: "section 2", words: words({ title: "Werkzeuge", points: [{ title: "Erfunden", text: "x" }] }) }),
    step({ module: cta.id, at: "cta", how: "instead", words: words({ title: "Weiter", button: "Alle Werkstoffe" }), link: "/de-CH/kontakt" }),
  ], ctx);
  assert.deepEqual(r.modules[0].words.points, []);
  assert.equal(r.modules[1].words.button, "");
  assert.equal(r.modules[1].link, "");
});

test("the answer's flat shape (one grammar the model takes) read into the plan's: points or questions from `items`", () => {
  const flat = (o: Record<string, unknown>) => ({ at: "intro", how: "after", why: "Helps", eyebrow: "", title: "", text: "", button: "", link: "", items: [], fill: "none", category: "", count: 0, ...o });
  const r = cleanNewPageModules([
    flat({ module: prod.id, at: "Section 1", title: "FKM O-Ringe", button: "Alle FKM O-Ringe", link: cands[0].url, fill: "bought", category: cands[0].url, count: 5 }),
    flat({ module: faq.id, at: "faq", how: "instead", title: "Häufige Fragen", items: [{ title: "Wofür eignet sich FKM?", text: "Für Öle und Kraftstoffe." }] }),
  ], ctx);
  assert.equal(r.modules[0].at, "section 1");
  assert.deepEqual(r.modules[0].fill, { how: "bought", category: FKM, numbers: "", count: 5 });
  assert.equal(r.modules[0].words.title, "FKM O-Ringe");
  assert.deepEqual(r.modules[1].words.faq, [{ q: "Wofür eignet sich FKM?", a: "Für Öle und Kraftstoffe." }]);
  assert.deepEqual(r.modules[1].words.points, []);
});

test("the modules that keep the shop's own points are named with those points - their words must fit them", () => {
  const own = ownPoints("de-CH");
  assert.ok(own.length > 0);
  const t = own.find((x) => x.id === lib.find((m) => m.category === "tools" && own.some((o) => o.id === m.id))?.id)!;
  assert.ok(t.titles.length > 0);
  const user = newPageUser({ tree, candidates: cands, language: "German", store: "de-CH" });
  assert.match(user, /THE MODULES THAT SHOW THE SHOP'S OWN POINTS/);
  assert.ok(user.includes(`"${t.id}": ${t.titles.join(" · ")}`));
});

test(`at most ${MAX_MODULES} modules`, () => {
  const ids = lib.filter((m) => m.takes === "none").slice(0, 6).map((m) => m.id);
  const r = cleanNewPageModules(ids.map((id) => step({ module: id, at: "intro", words: words({ title: "Titel für den Block" }) })), ctx);
  assert.equal(r.modules.length, MAX_MODULES);
});

/* ── placed on the page ── */

function written(): Fields {
  const f = mergeFill(emptyFields(), {
    hero: { eyebrow: "Dichtungstechnik", title: "O-Ringe aus FKM", sub: "Für Öl, Kraftstoff und Hitze.", button: { label: "", url: "" }, pictureIdea: "", pictureAlt: "" },
    intro: "FKM-O-Ringe dichten dort, wo NBR an seine Grenzen kommt.",
    sections: { items: [{ title: "Beständig", text: "Gegen Öle.", pictureIdea: "", pictureAlt: "" }, { title: "Temperatur", text: "Bis in hohe Bereiche.", pictureIdea: "", pictureAlt: "" }] },
    faq: { title: "Fragen", items: [{ q: "Was ist FKM?", a: "Ein Fluorkautschuk." }] },
    cta: { title: "Kontakt", text: "Wir helfen.", button: { label: "", url: "" } },
  });
  return f;
}
const mod = (o: Partial<NewPageModule> & { module: string; at: NewPageModule["at"] }): NewPageModule => ({ how: "after", layout: "", words: words() as NewPageModule["words"], extras: [], link: "", link2: "", fill: { how: "none", category: "", numbers: "", count: 0 }, line: "", why: "", problems: [], ...o });

test("each module after its block; one in place of a block takes that block's place; the AI's earlier modules give way", () => {
  let n = 0;
  // a page whose proof tiles and links were taken out
  const f0 = removeBlock(removeBlock(written(), "benefits"), "links");
  const order0 = blockOrder(f0);
  assert.equal(blockKeyOf("section 2", order0), order0.filter((k) => k.startsWith("sections."))[1]);
  assert.equal(blockKeyOf("section 5", order0), order0.filter((k) => k.startsWith("sections."))[1]);
  assert.equal(blockKeyOf("benefits", order0), null);
  // a module the person put stays; one the AI put before gives way
  const before: Fields = { ...f0, modules: [{ id: "m1x", after: "hero", module: { type: tool.id, settings: {} as never } }, { id: "aiold1", after: "intro", module: { type: tool.id, settings: {} as never } }] };
  const c = composeModules(before, [
    mod({ module: prod.id, at: "intro" }),
    mod({ module: tool.id, at: "section 2" }),
    mod({ module: faq.id, at: "faq", how: "instead" }),
    mod({ module: cta.id, at: "cta", how: "instead" }),
    mod({ module: lib.find((m) => m.category === "trust" && m.takes === "none")!.id, at: "benefits" }),
  ], "de-CH", () => `ai${++n}`);
  const order = blockOrder(c.fields);
  assert.ok(!order.includes("faq") && !order.includes("cta"), "the blocks the modules took the place of are out");
  assert.deepEqual(c.fields.faq, []);
  const after = Object.fromEntries((c.fields.modules ?? []).map((m) => [m.id, m.after]));
  const secs = order.filter((k) => k.startsWith("sections."));
  assert.equal(after.ai1, "intro");
  assert.equal(after.ai2, secs[1]);
  // in place of the questions and the call to action: after the last block still there, in their order
  assert.equal(after.ai3, secs[1]);
  assert.equal(after.ai4, secs[1]);
  // a block the page has not (no proof tiles): after the one before where it would stand
  assert.equal(after.ai5, "intro");
  assert.deepEqual((c.fields.modules ?? []).map((m) => m.id), ["m1x", "ai1", "ai2", "ai3", "ai4", "ai5"]);
  assert.ok(isAiModule({ id: "ai3" }) && !isAiModule({ id: "m1x" }));
  assert.deepEqual(c.placed.map((p) => p.id), ["ai1", "ai2", "ai3", "ai4", "ai5"]);
  assert.equal(needsShop(prod.id), true);
  assert.equal(needsShop(faq.id), false);
});

test("in the preview a module filling shows its skeleton moving; in Magento's copy nothing until it is filled", () => {
  let n = 0;
  const c = composeModules(written(), [mod({ module: prod.id, at: "intro", words: words({ title: "FKM O-Ringe" }) as NewPageModule["words"] })], "de-CH", () => `ai${++n}`);
  const pv = renderNewPage(c.fields, { marks: true, busy: { modules: { ai1: "Filling it from the shop…" } } }).html;
  assert.match(pv, /data-apx-mod="ai1"/);
  assert.match(pv, /Filling it from the shop…/);
  const why = renderNewPage(c.fields, { marks: true, busy: { moduleWhy: { ai1: "It could not be filled from the shop: busy." } } }).html;
  assert.match(why, /It could not be filled from the shop: busy\./);
  const magento = renderNewPage(c.fields).html;
  assert.doesNotMatch(magento, /data-apx-mod|Filling/);
  // the module stands right after the intro in the page
  assert.ok(pv.indexOf('data-apx-mod="ai1"') > pv.indexOf('data-apx-b="intro-block"'));
  assert.ok(pv.indexOf('data-apx-mod="ai1"') < pv.indexOf('data-apx-b="sections.'));
});

/* ── the text blocks under the same word rules ── */

test("the text blocks' words under the shop's rules - a list stays a list", () => {
  const said: string[] = [];
  assert.equal(guardText("Sofort ab Lager lieferbar. Für Öle und Kraftstoffe.\n\n- Beständig gegen Öl\n- Nur 4.50 CHF pro Stück\n- Hohe Temperaturen", "", said, "de"),
    "Für Öle und Kraftstoffe.\n\n- Beständig gegen Öl\n- Hohe Temperaturen");
  assert.equal(said.length, 2);
  // a real write's tile (10.11.2026): a stock and delivery-time promise, slash and all
  assert.equal(guardText("Lagerartikel in 48/72 h europaweit, kein Mindermengenzuschlag.", "", [], "de"), "");
  assert.equal(guardText("Lieferung 24/48h in die Schweiz.", "", [], "de"), "");
  assert.equal(guardText("Härten von 70 bis 90 Shore A, Masse nach Tabelle.", "", [], "de"), "Härten von 70 bis 90 Shore A, Masse nach Tabelle.");
  const g = guardFill({
    hero: { eyebrow: "", title: "O-Ringe aus FKM", sub: "Jetzt 20% Rabatt auf FKM.", button: { label: "Zum Shop", url: "" }, pictureIdea: "", pictureAlt: "" },
    faq: { title: "Fragen", items: [{ q: "Ist FKM FDA-konform?", a: "Ja, FDA-konform." }, { q: "Was ist FKM?", a: "Ein Fluorkautschuk von Chemours." }, { q: "Wofür?", a: "Für Öle." }] },
  }, "O-Ringe FKM", "de");
  assert.equal(g.answer.hero?.sub, "");
  assert.equal(g.answer.hero?.title, "O-Ringe aus FKM");
  // a certificate nobody named and the brand we never write: those answers go, the question with them
  assert.deepEqual(g.answer.faq?.items.map((x) => x.q), ["Wofür?"]);
  assert.ok(g.problems.length >= 3);
});
