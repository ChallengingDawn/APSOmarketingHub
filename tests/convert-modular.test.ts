// APSOconvert > a version of a content page is built with the Content studio's modules (SARCLA 10.11.2026, on three
// tiny bullets in a dashed box: "generation is really shit - the content agent ... quality is much higher"; asked how:
// "its engine builds versions"). The pure part of src/lib/convert/modular.ts, and one plan step made into the change a
// version keeps with the Content studio's own code - a canned answer, no AI call.
import assert from "node:assert/strict";
import { test } from "node:test";
import { bare, dropIn, inPlanOrder, listingWay, outlineSelectors, pointedAt, revised, tweaksIn, usesModules, withIds, type ModChange } from "../src/lib/convert/modularRules";
import { runtimeSource, validateChanges, type Change } from "../src/lib/convert/versions";
import { riskOf } from "../src/lib/convert/safety";
import { pageDoc, type PageChange } from "../src/lib/content/studio/kinds/page/model";
import { drawModule, fitModuleOf, fullGap, makeModule, pickModule, withWords } from "../src/lib/content/studio/kinds/page/plan/library";
import { mapText, pageMap } from "../src/lib/content/studio/kinds/page/plan/places";
import { cleanPlan, pageWords, stepChange } from "../src/lib/content/studio/kinds/page/plan/plan";

const B = "https://www.apsoparts.com";
// /de-CH/support/about-us as the shop serves it (shortened): the title band, the "Über uns" text, the customers' quote,
// the "Konto erstellen" button
const PAGE = `<!doctype html><html><head><title>Über uns</title></head><body>
<header class="page-header"><div><h2>Menü</h2></div></header>
<main id="maincontent" class="page-main"><div class="page-title-wrapper"><h1 class="page-title"><span>Über uns</span></h1></div>
<div class="columns"><div class="column main">
<div data-content-type="row" data-appearance="contained" data-element="main"><div data-element="inner" data-pb-style="AB12CD3"><div data-content-type="text"><h2>Willkommen bei APSOparts</h2><p>Ihr Onlineshop für Dichtungen und technische Kunststoffprodukte. Echtzeit-Zugriff auf Produktdetails und Preise, Bestell-Upload aus Ihrem ERP-System, Support per E-Mail und Chat in mehreren Sprachen.</p></div></div></div>
<div data-content-type="row" data-appearance="contained" data-element="main"><div data-element="inner" data-pb-style="EF45GH6"><div data-content-type="text"><h2>Warum unsere Kunden immer wieder bestellen</h2><p>Die Website von APSOparts bietet ein einfaches und intuitives Browsing-Erlebnis.</p><p><a class="action primary" href="${B}/de-CH/customer/account/create/">Konto erstellen</a></p></div></div></div>
</div></div></main><footer><h2>Footer</h2></footer></body></html>`;

test("which optimizations take the modules: a content page, not a product page, not a block in the footer", () => {
  assert.equal(usesModules("cms", null), true);
  assert.equal(usesModules("category", null), true);
  assert.equal(usesModules("home", undefined), true);
  assert.equal(usesModules("product", null), false);
  assert.equal(usesModules("system", null), false);
  assert.equal(usesModules("home", "newsletter"), false);
});

test("a plan step on about-us becomes a finished module block after the part, in the page's language - never loose bullets", () => {
  const map = pageMap(PAGE, pageDoc({ source: "pick", path: "/de-CH/support/about-us", store: "de-CH" }));
  assert.ok(map.parts.length >= 2, mapText(map.parts));
  const quote = map.parts.find((p) => p.heading.startsWith("Warum"))!;
  const points = pickModule((m) => m.takes === "none" && !m.needs.includes("picture") && m.words.some((w) => w.key === "points") && m.words.some((w) => w.key === "title"))!;
  assert.ok(points, "the library has a module of points");
  const raw = { note: "Reasons to open a business account, right above the button", steps: [{
    do: "add", module: points.id, at: quote.id, where: "before", layout: "", why: "Reasons before the button", extras: [], link: "", link2: "",
    fill: { how: "none", category: "", numbers: "", count: 0 }, html: "",
    words: { eyebrow: "", title: "Ihre Vorteile mit einem Geschäftskonto", text: "", button: "", button2: "", faq: [],
      points: [{ title: "Echtzeit-Zugriff", text: "auf Produktdetails und Preise" }, { title: "Bestell-Upload", text: "aus Ihrem ERP-System" }, { title: "Support", text: "per E-Mail und Chat in mehreren Sprachen" }] },
  }] };
  let n = 0;
  const plan = cleanPlan(raw, { parts: map.parts, container: map.container, categories: [], pageUrl: `${B}/de-CH/support/about-us`, pageKind: "cms", pageText: pageWords(map.parts), newId: () => `ct${++n}`, lang: "de", store: "de-CH" });
  assert.equal(plan.steps.length, 1, JSON.stringify(plan.problems));
  const s = plan.steps[0];
  assert.equal(s.place.how, "insert");
  const m = withWords(makeModule(s.module, "de-CH")!, s.words, s.link, s.extras, s.link2);
  assert.equal(fullGap(m), "");
  const fit = fitModuleOf(m);
  const html = drawModule(fit.m);
  const ch = stepChange(s, html, fit.m, null) as ModChange;
  assert.equal(ch.op, "insert");
  assert.ok(ch.module && ch.id, "the change keeps its module and id (Content opens it again)");
  // the library's finished design: one element with its own styles, the page's words, nothing of the old dashed box
  assert.match(html, new RegExp(`^<div class="apx-[a-z0-9-]+" data-apx-module="${points.id}">`));
  assert.match(html, /<style>/);
  assert.match(html, /Ihre Vorteile mit einem Geschäftskonto/);
  assert.match(html, /Bestell-Upload/);
  assert.doesNotMatch(html, /dashed/);
  // a change a version may carry, and one that does not touch the shop's own parts
  const v = validateChanges(bare([ch]));
  assert.equal(v.changes.length, 1, v.problems.join("; "));
  assert.deepEqual(riskOf(v.changes), []);
});

test("bare: the browser gets the change without the hub's module; the runtime leaves it out by itself", () => {
  const c = { op: "insert", selector: "#a", where: "after", html: "<div class=\"apx-x\">x</div>", id: "c1", module: { type: "x", settings: { big: "y".repeat(500) } } } as ModChange;
  assert.deepEqual(bare([c]), [{ op: "insert", selector: "#a", where: "after", html: "<div class=\"apx-x\">x</div>" }]);
  const js = runtimeSource([c as Change], { report: false });
  assert.doesNotMatch(js, /yyyyy/);
  assert.match(js, /apx-x/);
});

test("two modules after the same part stand in the plan's order (the browser would put the later one first)", () => {
  const a: ModChange = { op: "insert", selector: "#p3", where: "after", html: "<div>A</div>", note: "Add A", id: "1" };
  const b: ModChange = { op: "insert", selector: "#p3", where: "after", html: "<div>B</div>", note: "Add B", id: "2" };
  const c: ModChange = { op: "insert", selector: "#p4", where: "after", html: "<div>C</div>", id: "3" };
  const out = inPlanOrder([a, b, c]);
  assert.equal(out.length, 2);
  assert.equal((out[0] as { html: string }).html, "<div>A</div><div>B</div>");
  assert.equal(out[0].note, "Add A; Add B");
  // "before" lays them in order already
  assert.equal(inPlanOrder([{ ...a, where: "before" }, { ...b, where: "before" }]).length, 2);
});

test("a revision: a module given new words keeps its place, a new one is added, the rest stays", () => {
  const cur = withIds([{ op: "css", css: ".apx-a{color:red}" }, { op: "insert", selector: "#p1", where: "after", html: "<div>old</div>" }] as Change[]);
  assert.deepEqual(cur.map((c) => c.id), ["v1", "v2"]);
  const out = revised(cur, [{ op: "insert", selector: "#p1", where: "after", html: "<div>new words</div>", id: "v2" }, { op: "insert", selector: "#p2", where: "before", html: "<div>more</div>", id: "n1" }]);
  assert.deepEqual(out.map((c) => c.id), ["v1", "v2", "n1"]);
  assert.equal((out[1] as { html: string }).html, "<div>new words</div>");
  // "move it higher": the block taken out (its M id) and added again elsewhere; a part of the page is never taken out
  const parts = [{ id: "P1", kind: "page", change: "" }, { id: "M1", kind: "module", change: "v2" }];
  const drop = dropIn(["m1", "P1", "M9"], parts);
  assert.deepEqual(drop, ["v2"]);
  const moved = revised(cur, [{ op: "insert", selector: "#p0", where: "before", html: "<div>old</div>", id: "n2" }], drop);
  assert.deepEqual(moved.map((c) => c.id), ["v1", "n2"]);
});

test("tweaks: new words for an element the page lists - no price, no placeholder, at most 3", () => {
  const sels = outlineSelectors(["div.column.main · ", "    a.action.primary · Konto erstellen", "  h2 · Warum unsere Kunden"]);
  assert.deepEqual(sels, ["div.column.main", "a.action.primary", "h2"]);
  const t = tweaksIn([
    { selector: "a.action.primary", text: "Geschäftskonto erstellen", note: "The button says what it opens" },
    { selector: "a.nope", text: "Hallo", note: "" },
    { selector: "h2", text: "10 % Rabatt", note: "" },
    { selector: "a.action.primary", text: "twice", note: "" },
  ], sels);
  assert.deepEqual(t.changes, [{ op: "text", selector: "a.action.primary", text: "Geschäftskonto erstellen", note: "The button says what it opens" }]);
  assert.equal(t.problems.length, 2);
});

test("the element a person pointed at is read from the AI helper's words", () => {
  assert.deepEqual(pointedAt("Change this element - div.x > a.y (it reads “Konto erstellen”): make it red"), { selector: "div.x > a.y", text: "Konto erstellen" });
  assert.deepEqual(pointedAt("Change this element - #hero: bigger"), { selector: "#hero", text: "" });
  assert.equal(pointedAt("Make it stand out more"), null);
});

test("a module of products is last filled with the category's listed products - the AI's category, or the category page itself", () => {
  const way = (how: string, category: string) => ({ module: "bento", fill: { how, category, numbers: "", count: 5 }, layout: "", why: "" });
  // the night run of 11.11.2026: bought / viewed within the category were too few for a bento
  const page = "/de-DE/kunststofftechnik/platte.html";
  const tries = [way("bought", ""), way("viewed", "")];
  const last = listingWay(tries, true, page);
  assert.equal(last?.fill.how, "category");
  assert.equal(last?.fill.category, page);
  assert.equal(last?.module, "bento");
  // the AI's own category first
  assert.equal(listingWay([way("bought", "/de-DE/dichtungstechnik/o-ringe.html")], true, page)?.fill.category, "/de-DE/dichtungstechnik/o-ringe.html");
  // the studio tried that listing already, or no category at all, or not a module of products: nothing more
  assert.equal(listingWay([way("category", page), way("bought", page)], true, page), null);
  assert.equal(listingWay(tries, true, null), null);
  assert.equal(listingWay(tries, false, page), null);
  assert.equal(listingWay([], true, page), null);
});
