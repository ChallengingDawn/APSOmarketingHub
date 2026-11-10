import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ORDER, addBlock, asWritten, blockOrder, emptyFields, writtenOrder } from "../src/lib/content/studio/kinds/page/fields";
import { cleanFill, mergeFill } from "../src/lib/content/studio/kinds/page/fill";
import { renderNewPage } from "../src/lib/content/studio/kinds/page/newpage";
import { busyBlocks, busyOf } from "../src/lib/content/studio/kinds/page/outline";
import { newPageRows } from "../src/lib/content/studio/kinds/page/blocklist";
import { emptyWords, libModule } from "../src/lib/content/studio/kinds/page/plan/library";
import {
  EMPTY_PAGE, MAX_MODULES, cleanNewPageModules, composeModules, fillTries, fullOnly, gapWith, needsShop, newPageAddresses, newPageLibrary, newPageUser,
  type NewPageCtx,
} from "../src/lib/content/studio/kinds/page/plan/newpage";

// Content v10 (SARCLA 10.11.2026, points 1 and 7): "it should by default start empty, I should be able to start or the
// block and number of blocks are decided by the AI on the first prompt"; "the AI should really use the modules to build
// the block" - and fill them fully (a "Three teasers" came back empty). Proved with a canned answer - no AI call, no shop.

const B = "https://www.apsoparts.com";
const ORINGS = `${B}/de-CH/dichtungstechnik/o-ringe-x-ringe.html`;
const tree = [{ name: "Dichtungstechnik", url: `${B}/de-CH/dichtungstechnik.html`, depth: 0 }, { name: "O-Ringe & X-Ringe", url: ORINGS, depth: 1 }];
const cands = [{ url: "/de-CH/dichtungstechnik/o-ringe-x-ringe.html", name: "O-Ringe & X-Ringe", kind: "category" }, { url: "/de-CH/kontakt", name: "Kontakt", kind: "cms" }];
const ctx = (store = "de-CH"): NewPageCtx => ({ ...newPageAddresses(tree, cands), pageText: "O-Ringe für Lebensmittelmaschinen, EPDM und FKM, Reinigung", lang: store.slice(0, 2), store });
const lib = newPageLibrary();
const flat = (o: Record<string, unknown>) => ({ at: "intro", how: "after", why: "Helps buyers", eyebrow: "", title: "", text: "", button: "", link: "", items: [], fill: "none", category: "", count: 0, ...o });

/* ── point 1: an empty page has no blocks ─────────────────────────────── */

test("a new page starts EMPTY - no fixed skeleton; the first block added brings the hero (the page's H1)", () => {
  assert.deepEqual(blockOrder(emptyFields()), [], "no Hero, Intro, Proof tiles ... by default");
  assert.deepEqual(newPageRows(emptyFields()), [], "the block list is empty");
  const r = addBlock(emptyFields(), "faq", 1);
  assert.deepEqual(blockOrder(r.fields), ["hero", "faq"]);
  // a page written before, without an order of its own, keeps the order every page had
  const old = mergeFill(emptyFields(), { hero: { eyebrow: "", title: "O-Ringe", sub: "", button: { label: "", url: "" }, pictureIdea: "", pictureAlt: "" } });
  assert.deepEqual(blockOrder(old), [...DEFAULT_ORDER]);
});

test("an empty page in the preview: what it is and its first +; while the AI writes it, the page moves; nothing in Magento's copy", () => {
  const pv = renderNewPage(emptyFields(), { marks: true, adds: true }).html;
  assert.match(pv, /An empty page/);
  assert.match(pv, /data-apx-add="1"/);
  assert.doesNotMatch(pv, /Section heading|apx-np-hero/, "no skeleton blocks");
  assert.deepEqual(busyBlocks("all", emptyFields()), ["seo", "page"]);
  const writing = renderNewPage(emptyFields(), { marks: true, busy: { blocks: busyOf("all", emptyFields()).blocks } }).html;
  assert.match(writing, /Writing the page…/);
  assert.equal(renderNewPage(emptyFields()).html.includes("apx-np-empty"), false, "Magento's copy: nothing");
});

/* ── the first prompt: the AI decides which blocks and how many, mostly modules ── */

test("the first write of an empty page is told to decide its blocks, mostly from the library, every module full", () => {
  const u = newPageUser({ tree, candidates: cands, language: "German", store: "de-CH", decide: true });
  assert.ok(u.includes(EMPTY_PAGE));
  assert.match(EMPTY_PAGE, /YOU DECIDE ITS BLOCKS/);
  assert.match(EMPTY_PAGE, /MOSTLY FROM THE MODULE LIBRARY: 3 to 6 modules/);
  assert.match(EMPTY_PAGE, /Every module you bring is FULL/);
  assert.doesNotMatch(newPageUser({ tree, candidates: cands, language: "German", store: "de-CH" }), /THE PAGE IS EMPTY/, "a page with blocks keeps them");
  assert.equal(MAX_MODULES, 6);
});

test("a canned answer: the page is exactly the blocks the AI wrote, and its modules among them", () => {
  const row = lib.find((m) => m.takes === "products" && m.max >= 4 && !m.needs.includes("picture"))!;
  const faq = lib.find((m) => m.takes === "none" && m.words.some((w) => w.key === "faq") && !m.words.some((w) => w.key === "points"))!;
  const cta = lib.find((m) => m.category === "cta" && m.takes === "none" && m.words.some((w) => w.key === "button") && m.words.some((w) => w.key === "title"))!;
  const raw = {
    summary: "A page on seals for food machines",
    hero: { eyebrow: "Lebensmittel", title: "Dichtungen für Lebensmittelmaschinen", sub: "EPDM und FKM für Anlagen, die täglich gereinigt werden.", button: { label: "", url: "" }, pictureIdea: "Seals on steel", pictureAlt: "Dichtungen" },
    intro: "Lebensmittelmaschinen brauchen Dichtungen, die Reinigung und Medien standhalten.",
    benefits: { title: "", items: [] },
    sections: { items: [{ title: "Werkstoffe", text: "EPDM und FKM - je nach Medium.", pictureIdea: "", pictureAlt: "" }, { title: "Reinigung", text: "Beständig gegen Reinigungsmittel.", pictureIdea: "", pictureAlt: "" }] },
    links: { title: "", items: [] }, faq: { title: "", items: [] }, cta: { title: "", text: "", button: { label: "", url: "" } },
    seo: { title: "Dichtungen für Lebensmittelmaschinen", description: "EPDM und FKM Dichtungen.", urlKey: "dichtungen-lebensmittel" },
    modules: [
      flat({ module: row.id, at: "intro", title: "O-Ringe im Shop", button: "Alle O-Ringe", link: cands[0].url, fill: "category", category: cands[0].url, count: 6 }),
      flat({ module: faq.id, at: "faq", how: "instead", title: "Häufige Fragen", items: [{ title: "Welche Werkstoffe gibt es?", text: "EPDM und FKM, je nach Medium." }, { title: "Sind sie reinigungsbeständig?", text: "Ja, gegen gängige Reinigungsmittel." }] }),
      flat({ module: cta.id, at: "cta", how: "instead", title: "Passende Dichtung gesucht?", text: "Unser Team hilft bei der Auswahl.", button: "Kontakt", link: "/de-CH/kontakt" }),
    ],
  };
  // the text blocks: exactly those with words - no proof tiles, links, questions or call to action of the skeleton
  const f = asWritten(mergeFill(emptyFields(), cleanFill(raw, cands).answer));
  const secs = f.sections.map((s) => `sections.${s.id}`);
  assert.deepEqual(blockOrder(f), ["hero", "intro", ...secs]);
  assert.deepEqual(writtenOrder(f), ["hero", "intro", ...secs]);
  assert.equal(secs.length, 2);
  // the modules: kept, full, among the blocks - the questions and the call to action as modules, after the last section
  const m = cleanNewPageModules(raw.modules, ctx());
  assert.deepEqual(m.modules.map((x) => x.module), [row.id, faq.id, cta.id]);
  const full = fullOnly(m.modules, "de-CH");
  assert.equal(full.left.length, 0);
  let n = 0;
  const c = composeModules(f, full.kept, "de-CH", () => `ai${++n}`);
  assert.deepEqual(newPageRows(c.fields).map((r) => r.key), ["hero", "intro", "np:ai1", secs[0], secs[1], "np:ai2", "np:ai3"]);
  assert.equal(newPageRows(c.fields).filter((r) => r.kind === "module").length, 3, "built mostly with modules: 3 modules, 4 text blocks");
});

/* ── point 7: every module the AI brings is FULL ──────────────────────── */

test("a module of words the AI did not fill is never put on the page: another of its kind that its words fill, or left out", () => {
  // a module the AI's words do not fill (it shows more points than came back): one of its kind that they fill, in its place
  const pts = [{ title: "Declarations", text: "With the delivery." }, { title: "Advice", text: "From engineers." }];
  const W = { ...emptyWords(), title: "Why order here", points: pts };
  const step = (id: string, w = W) => ({ module: id, words: w, link: "", link2: "", extras: [], layout: "" });
  const words = lib.filter((m) => !needsShop(m.id));
  const a = words.find((m) => gapWith(step(m.id), "en-INT") && words.some((o) => o.id !== m.id && o.category === m.category && !gapWith(step(o.id), "en-INT") && gapWith(step(o.id, emptyWords()), "en-INT")))!;
  assert.ok(a, "the library has such a module");
  // (the words as the plan gives them: points stay points)
  const r = cleanNewPageModules([{ module: a.id, at: "intro", how: "after", why: "Helps buyers", words: W, extras: [], link: "", link2: "", fill: { how: "none", category: "", numbers: "", count: 0 }, layout: "" }], ctx("en-INT"));
  const kept = r.modules[0];
  assert.ok(kept, `"${a.name}" replaced, not dropped`);
  assert.notEqual(kept.module, a.id, "not the module that was not full");
  assert.equal(libModule(kept.module)!.category, a.category, "one of its kind");
  assert.equal(gapWith(kept, "en-INT"), "", "full with the AI's words");
  assert.match(kept.problems.join(" "), /could not be filled .* in its place/);
  // nothing to fill it with: left out, and said
  const faq = lib.find((m) => m.id === "faq")!;
  const none = cleanNewPageModules([flat({ module: faq.id, at: "intro" })], ctx("en-INT"));
  assert.equal(none.modules.length, 0);
  assert.match(none.problems.join(" "), new RegExp(`"${faq.name}" left out: `));
  // the studio checks again before it puts one on the page
  const f2 = fullOnly([{ module: faq.id, words: emptyWords(), link: "", link2: "", extras: [], layout: "" }], "en-INT");
  assert.equal(f2.kept.length, 0);
  assert.match(f2.left[0], /left out: write at least one question/);
});

test("a module of words is full only with its headline and its points or questions - never just its frame", () => {
  const withPoints = lib.find((m) => m.takes === "none" && !m.needs.includes("picture") && m.words.some((w) => w.key === "points") && m.words.some((w) => w.key === "title") && !libModule(m.id)!.words.some((w) => w.key === "faq"))!;
  const s = (w: Partial<ReturnType<typeof emptyWords>>) => ({ module: withPoints.id, words: { ...emptyWords(), ...w }, link: "", link2: "", extras: [], layout: "" });
  assert.notEqual(gapWith(s({ title: "Why order here" }), "en-INT"), "", "a headline over nothing is not full");
  assert.notEqual(gapWith(s({ points: [{ title: "From stock", text: "x" }] }), "en-INT"), "", "points without a headline are not full");
  assert.equal(gapWith(s({ title: "Why order here", points: [{ title: "Declarations", text: "With the delivery." }, { title: "Advice", text: "From engineers." }, { title: "Small quantities", text: "From one piece." }] }), "en-INT"), "");
});

test("a module of the shop that comes back empty is tried another way, in turn - then left out", () => {
  const row = lib.find((m) => m.takes === "products" && !m.needs.includes("picture"))!;
  const none = { how: "none" as const, category: "", numbers: "", count: 0 };
  const t1 = fillTries({ module: row.id, fill: { how: "category", category: ORINGS, numbers: "", count: 6 }, layout: "" });
  assert.deepEqual(t1.map((t) => `${t.module}:${t.fill.how}:${t.fill.category}`), [`${row.id}:category:${ORINGS}`, `${row.id}:bought:${ORINGS}`, `${row.id}:viewed:${ORINGS}`]);
  const cats = lib.find((m) => m.takes === "categories" && !m.needs.includes("picture"))!;
  const t2 = fillTries({ module: cats.id, fill: { how: "category", category: ORINGS, numbers: "", count: 6 }, layout: "" });
  assert.equal(t2[0].module, cats.id);
  assert.ok(t2.length === 3 && libModule(t2[1].module)!.takes === "products", "a category with no subcategories: a module of its products in its place");
  assert.equal(t2[1].fill.category, ORINGS);
  assert.match(t2[1].why, /in its place$/);
  const words = lib.find((m) => !needsShop(m.id))!;
  assert.equal(fillTries({ module: words.id, fill: none, layout: "" }).length, 1, "a module of words is not filled from the shop");
});
