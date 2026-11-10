import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyWords, fullGap, isTeaser, libModule, library, listsFrom, makeModule, teaserField, teasersFrom, withWords, type PlanWords } from "../src/lib/content/studio/kinds/page/plan/library";
import { fillTries, needsShop } from "../src/lib/content/studio/kinds/page/plan/newpage";
import { pageMap } from "../src/lib/content/studio/kinds/page/plan/places";
import { cleanPlan, withFill, type CleanCtx } from "../src/lib/content/studio/kinds/page/plan/plan";
import { pageDoc } from "../src/lib/content/studio/kinds/page/model";
import type { Card } from "../src/lib/content/studio/kinds/page/modules/types";

// Content v10 (lead 10.11.2026, from SARCLA's screenshot: a "Three teasers" the AI PLAN put on a page came back empty -
// "Not on the page yet - write its 3 teasers"): a module the plan adds comes out FULL or not at all. Proved with canned
// plans and canned shop cards - no AI call, no shop read.

const B = "https://www.apsoparts.com";
const PAGE = `<!doctype html><html><head><title>Dichtungstechnik</title></head><body>
<main id="maincontent" class="page-main"><div class="page-title-wrapper"><h1 class="page-title"><span>Dichtungstechnik</span></h1></div>
<div class="columns"><div class="column main">
<div data-content-type="row" data-appearance="contained" data-element="main"><div data-element="inner"><div data-content-type="text" data-element="main"><h2>Dichtungen für jede Anwendung</h2><p>O-Ringe, Flachdichtungen und Profile aus EPDM, FKM und Silikon.</p></div></div></div>
<div data-content-type="row" data-appearance="contained" data-element="main"><div data-element="inner"><div data-content-type="text" data-element="main"><h2>Beratung</h2><p>Unsere Ingenieure helfen bei der Auswahl.</p></div></div></div>
</div></div></main></body></html>`;
const ORINGS = `${B}/de-CH/dichtungstechnik/o-ringe.html`;
const map = pageMap(PAGE, pageDoc({ source: "pick", path: "/de-CH/dichtungstechnik.html", store: "de-CH" }));
let n = 0;
const ctx = (store = "de-CH"): CleanCtx => ({
  parts: map.parts, container: map.container, categories: [`${B}/de-CH/dichtungstechnik.html`, ORINGS], pageUrl: `${B}/de-CH/dichtungstechnik.html`, pageKind: "category",
  pageText: map.parts.map((p) => `${p.heading} ${p.text}`).join(" "), newId: () => `cpf${++n}x`, lang: store.slice(0, 2), store,
});
const words = (o: Record<string, unknown> = {}) => ({ eyebrow: "", title: "", text: "", button: "", button2: "", points: [], faq: [], ...o });
const step = (o: Record<string, unknown>) => ({ do: "add", module: "", at: "P2", where: "after", layout: "", why: "Helps buyers", words: words(), extras: [], link: "", link2: "", fill: { how: "none", category: "", numbers: "", count: 0 }, html: "", ...o });
const lib = library();
const card = (name: string, slug: string, img = true): Card => ({ kind: "category", name, url: `${B}/de-CH/dichtungstechnik/${slug}.html`, img: img ? `${B}/media/catalog/category/${slug}.jpg` : "", meta: "31 Produkte", number: "", children: [] });

test("the teaser modules are known by their fields: points that each carry a picture and a page of the shop", () => {
  const trio = libModule("campaign-trio")!;
  assert.equal(trio.name, "Three teasers");
  assert.deepEqual(teaserField(trio.id), { n: 3 });
  assert.ok(isTeaser("campaign-duo"));
  assert.equal(needsShop(trio.id), true, "filled from the shop, never invented");
  // the shop's own tools and brands are not teasers to fill from the catalogue
  assert.ok(lib.filter((m) => m.category === "tools" || m.category === "references").every((m) => !isTeaser(m.id)));
  assert.equal(teaserField("faq"), null);
});

test("a plan's Three teasers is filled from the shop's cards - each a picture and a page - never left empty", () => {
  const trio = makeModule("campaign-trio", "de-CH")!;
  const m0 = withWords(trio, words({ title: "Dichtungen nach Form", points: [{ title: "Flachdichtungen", text: "Aus Platten geschnitten." }] }));
  assert.notEqual(fullGap(m0), "", "as the AI wrote it: not full (\"write its 3 teasers\")");
  const cards = [card("O-Ringe", "o-ringe"), card("Ohne Bild", "x", false), card("Flachdichtungen", "flachdichtungen"), card("Profile", "profile"), card("Wellendichtungen", "wellendichtungen")];
  const m = withFill(m0, { items: cards, feature: null }, { how: "category", category: `${B}/de-CH/dichtungstechnik.html`, numbers: "", count: 3 });
  assert.equal(fullGap(m), "");
  assert.equal(m.settings.points.length, 3);
  assert.ok(m.settings.points.every((p) => p.img?.startsWith(`${B}/media/`) && p.url?.startsWith(`${B}/de-CH/`)), "each its shop picture and its shop page");
  // the AI's words stay with the card they name; the others carry the shop's own name and line
  assert.deepEqual(m.settings.points.map((p) => p.title), ["O-Ringe", "Flachdichtungen", "Profile"]);
  assert.equal(m.settings.points[1].text, "Aus Platten geschnitten.");
  assert.equal(m.settings.points[0].text, "31 Produkte");
  assert.deepEqual(m.settings.items, [], "its cards are its teasers, not a product list");
  // a teaser that already has its picture and page (the shop's own) stays
  const kept = teasersFrom([{ title: "Eigen", text: "", icon: "check", img: `${B}/media/a.jpg`, url: `${B}/de-CH/a.html` }], cards, 3);
  assert.equal(kept[0].title, "Eigen");
  assert.equal(kept.length, 3);
  // too few cards: not full - the studio tries another way, then leaves the step out
  assert.notEqual(fullGap(withFill(m0, { items: cards.slice(0, 1), feature: null }, { how: "category", category: ORINGS, numbers: "", count: 3 })), "");
  assert.deepEqual(fillTries({ module: "campaign-trio", fill: { how: "category", category: ORINGS, numbers: "", count: 3 }, layout: "" }).map((t) => t.fill.how), ["category", "technologies"]);
});

test("a canned plan: a module of words the AI did not fill is swapped for one of its kind its words fill, or the step is left out and said", () => {
  // the questions module given no questions: nothing of its kind is filled by those words - left out, said under "Left out"
  const faq = libModule("faq")!;
  const p1 = cleanPlan({ note: "Answers for buyers", steps: [step({ module: faq.id, words: words({ title: "Häufige Fragen" }) })] }, ctx("en-INT"));
  assert.equal(p1.steps.length, 0);
  assert.match(p1.problems.join(" "), /"Questions?.*" left out: write at least one question/i);
  // points that a module of its kind cannot take as they are (it shows more): one of its kind that they fill, in its place
  const pts = [{ title: "Declarations", text: "With the delivery." }, { title: "Advice", text: "From engineers." }];
  const W: PlanWords = { ...emptyWords(), title: "Why order here", points: pts };
  const fills = (id: string, w: PlanWords = W) => { const m = makeModule(id, "en-INT"); return m ? fullGap(withWords(m, w)) : "x"; };
  const own = (id: string) => { const f = libModule(id)!; return f.words.some((x) => x.key === "points") && (makeModule(id, "en-INT")?.settings.points.some((p) => p.url || p.img) ?? false); };
  const words0 = lib.filter((m) => !needsShop(m.id));
  const a = words0.find((m) => fills(m.id) && words0.some((o) => o.id !== m.id && o.category === m.category && !own(o.id) && listsFrom(o.id, W) && !fills(o.id) && fills(o.id, emptyWords())))!;
  assert.ok(a, "the library has such a module");
  const p2 = cleanPlan({ note: "Reasons to order here", steps: [step({ module: a.id, words: W })] }, ctx("en-INT"));
  assert.equal(p2.steps.length, 1, `"${a.name}" swapped, not dropped`);
  const s = p2.steps[0];
  assert.notEqual(s.module, a.id);
  assert.equal(libModule(s.module)!.category, a.category, "one of its kind");
  assert.equal(fills(s.module, s.words), "", "full with the AI's words");
  assert.match(s.problems.join(" "), /could not be filled .* in its place/);
  // a module that is full as written goes as it is
  const p3 = cleanPlan({ note: "Answers for buyers", steps: [step({ module: faq.id, words: words({ title: "FAQ", faq: [{ q: "Which materials?", a: "EPDM, FKM and silicone." }] }) })] }, ctx("en-INT"));
  assert.equal(p3.steps[0]?.module, faq.id);
});

test("a canned plan with modules of the shop: kept for the studio to fill, with the ways to try when one comes back empty", () => {
  const row = lib.find((m) => m.takes === "products" && !m.needs.includes("picture"))!;
  const cats = lib.find((m) => m.takes === "categories" && !m.needs.includes("picture"))!;
  const p = cleanPlan({ note: "The products", steps: [
    step({ module: row.id, words: words({ title: "O-Ringe" }), fill: { how: "category", category: ORINGS, numbers: "", count: 6 } }),
    step({ module: cats.id, at: "P1", words: words({ title: "Dichtungen nach Art" }), fill: { how: "category", category: ORINGS, numbers: "", count: 4 } }),
    step({ module: "campaign-trio", at: "P2", words: words({ title: "Aus dem Sortiment" }), fill: { how: "category", category: `${B}/de-CH/dichtungstechnik.html`, numbers: "", count: 3 } }),
  ] }, ctx());
  assert.deepEqual(p.steps.map((s) => s.module), [row.id, cats.id, "campaign-trio"], "not judged before the shop fills them");
  assert.deepEqual(fillTries(p.steps[0]).map((t) => t.fill.how), ["category", "bought", "viewed"]);
  const t2 = fillTries(p.steps[1]);
  assert.equal(libModule(t2[1].module)!.takes, "products", "a category with no subcategories: a module of its products in its place");
});
