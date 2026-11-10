import assert from "node:assert/strict";
import { test } from "node:test";
import { applyChanges } from "../src/lib/content/studio/kinds/page/apply";
import { pageDoc, type PageChange } from "../src/lib/content/studio/kinds/page/model";
import { renderModule } from "../src/lib/content/studio/kinds/page/modules/render";
import { MODULES } from "../src/lib/content/studio/kinds/page/modules/registry";
import { drawModule, libModule, library, libraryText, makeModule, moduleIdOf, pickModule, withWords, wordsOfModule } from "../src/lib/content/studio/kinds/page/plan/library";
import { mapText, pageMap, partOfSelection } from "../src/lib/content/studio/kinds/page/plan/places";
import { PLAN_SCHEMA, buttonSays, cleanPlan, inLanguage, looksEnglish, noteOf, placeNow, planSystem, planUser, safeWords, stepChange, stepLine, withFill, workedExamples, type CleanCtx } from "../src/lib/content/studio/kinds/page/plan/plan";

// Content v7 (SARCLA 10.11.2026, points 5 and 13): "the quality of generation is far from good" - "the AI could directly
// bring modules and adjust text". The AI composes the page with the module LIBRARY: a plan of steps on the page's real
// parts, filled by the hub from the shop. Proved here with canned answers - no AI call. And point 4 of the night: an AI
// block "added" on /de-CH/privacy that nobody saw - the places a plan uses are made and checked by the hub.

const B = "https://www.apsoparts.com";
// a Magento CMS page as the shop serves it: the header has its own divs and h2s (the outline's "h2" would find them
// first), the main column holds the form key, the hidden login popup, a script, Page Builder's style and two rows
const PAGE = `<!doctype html><html><head><title>Datenschutz</title></head><body>
<header class="page-header"><div class="panel"><div><h2>Menü</h2><p>Kopf</p></div></div><div><div><p>Navigation</p></div></div></header>
<main id="maincontent" class="page-main"><div class="page-title-wrapper"><h1 class="page-title"><span>Datenschutz</span></h1></div>
<div class="columns"><div class="column main"><input name="form_key" type="hidden" value="x"> <div id="authenticationPopup" data-bind="scope:'authenticationPopup'"> <!-- ko template: getTemplate() --><!-- /ko --> </div>
<script type="text/x-magento-init">{"*":{}}</script><style>#html-body [data-pb-style=JVBABTV]{display:flex}</style>
<div data-content-type="row" data-appearance="contained" data-element="main"><div data-element="inner" data-pb-style="JVBABTV"><div data-content-type="text" data-element="main" data-pb-style="RQ76PMG"><h2>Datenschutzerklärung an die Kundinnen und Kunden</h2><p>Wenn Sie uns kontaktieren, beachten Sie unsere <a href="${B}/en-INT/cookie-policy">Cookie Policy</a>.</p><p>Die Angst+Pfister International AG, Zürich, ist ISO 9001 zertifiziert und verantwortlich.</p></div></div></div>
<div data-content-type="row" data-appearance="contained" data-element="main"><div data-element="inner" data-pb-style="IQFEWT3"><div data-content-type="text" data-element="main"><h2>Cookie Policy</h2><p>Informationen über Cookies finden Sie in unserer <a href="${B}/de-CH/dichtungstechnik/o-ringe.html">Cookie Policy</a> und bei <a href="${B}/de-CH/11400101-hitecr-o-ring.html">O-Ringen</a>.</p></div></div></div>
</div></div></main><footer><div><h2>Footer</h2></div></footer></body></html>`;

const view = (changes: PageChange[] = []) => pageDoc({ source: "pick", path: "/de-CH/privacy", store: "de-CH", changes });

const prod = () => pickModule((m) => m.takes === "products")!;
const cats = () => pickModule((m) => m.takes === "categories")!;
const points = () => pickModule((m) => m.takes === "none" && m.words.some((w) => w.key === "points"))!;

let n = 0;
const ctxOf = (parts: ReturnType<typeof pageMap>, extra: Partial<CleanCtx> = {}): CleanCtx => ({
  parts: parts.parts, container: parts.container, categories: [`${B}/de-CH/dichtungstechnik.html`, `${B}/de-CH/dichtungstechnik/o-ringe.html`],
  pageUrl: `${B}/de-CH/privacy`, pageKind: "cms", pageText: parts.parts.map((p) => `${p.heading} ${p.text}`).join(" "), newId: () => `cplan${++n}x`, ...extra,
});
const words = (o: Record<string, unknown> = {}) => ({ eyebrow: "", title: "", text: "", button: "", button2: "", points: [], faq: [], ...o });
const step = (o: Record<string, unknown>) => ({ do: "add", module: "", at: "P1", where: "after", layout: "", why: "Helps buyers", words: words(), extras: [], link: "", fill: { how: "none", category: "", numbers: "", count: 0 }, html: "", ...o });

test("the library is the registry's: every module, by category, never a name written in the plan's code", () => {
  const lib = library();
  assert.equal(lib.length, MODULES.length);
  assert.ok(lib.every((m) => m.id && m.category && m.name));
  const text = libraryText();
  for (const m of lib) assert.match(text, new RegExp(`"${m.id}" ${m.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  // the worked plans are made from the library's own modules
  const ex = workedExamples();
  for (const id of [...ex.matchAll(/"module":"([^"]+)"/g)].map((x) => x[1])) assert.ok(libModule(id), `${id} is in the library`);
  assert.match(planSystem(), /THE LIBRARY/);
  assert.match(planSystem(), /never the name "Chemours"/);
  assert.equal(moduleIdOf(prod().name), prod().id);
  assert.equal(moduleIdOf("no such module"), null);
  // the schema asks for every field (the model answers in it)
  const item = (PLAN_SCHEMA.properties.steps as { items: { required: string[] } }).items;
  assert.deepEqual(item.required.sort(), ["at", "do", "extras", "fill", "html", "layout", "link", "link2", "module", "where", "why", "words"]);
});

test("the page's parts: the main column's blocks in order, each with a selector the hub made and checked (point 4)", () => {
  const m = pageMap(PAGE, view());
  assert.deepEqual(m.parts.map((p) => p.id), ["P1", "P2"]);
  // the hidden login popup, the form key, the script and the style are no parts
  assert.equal(m.parts[0].heading, "Datenschutzerklärung an die Kundinnen und Kunden");
  assert.equal(m.parts[1].holds.products, 1);
  assert.equal(m.parts[1].holds.categories, 1);
  assert.equal(m.container, "div.column.main");
  // each selector finds exactly its part - "h2" or "div" alone would find the header's first
  for (const p of m.parts) {
    const r = applyChanges(PAGE, [{ op: "insert", selector: p.selector, where: "before", html: `<div class="apx-probe">X${p.id}</div>` }]);
    assert.equal(r.hits[0].state, "found");
    const at = r.html.indexOf(`X${p.id}`);
    assert.ok(at > r.html.indexOf("column main"), `${p.id} lands in the main column`);
    assert.ok(r.html.slice(at, at + 400).includes(p.id === "P1" ? "Datenschutzerkl" : "Cookie Policy</h2>"));
  }
  assert.match(mapText(m.parts), /P1 · <div> · heading "Datenschutzerklärung/);
});

test("what the hub put on the page is a part of its own (M1), and a part it replaced is not listed", () => {
  const m0 = pageMap(PAGE, view());
  const mod = makeModule(points().id, "de-CH")!;
  const html = renderModule(mod);
  const first = { op: "insert", selector: m0.parts[0].selector, where: "after", html, id: "cmod1x", module: mod } as PageChange;
  // the second change aims at P2 as the page is once the first is on it (a block before it moves its place by position)
  const p2 = pageMap(PAGE, view([first])).parts.find((p) => p.kind === "page" && p.heading === "Cookie Policy")!;
  const changes: PageChange[] = [first, { op: "replace", selector: p2.selector, html: `<style>.apx-r1{color:#1d2326}</style><div class="apx-r1"><p>Neu</p></div>`, id: "crep1x" } as PageChange];
  const m = pageMap(PAGE, view(changes));
  assert.deepEqual(m.parts.map((p) => `${p.id}:${p.kind}`), ["P1:page", "M1:module", "B1:block"]);
  assert.equal(m.parts[1].change, "cmod1x");
  assert.equal(m.parts[1].module, points().id);
  // a selection inside the first part is that part; a click in the module names its change
  assert.equal(partOfSelection(PAGE, view(changes), m.parts, { selector: `${m.parts[0].selector} p` })?.id, "P1");
  assert.equal(partOfSelection(PAGE, view(changes), m.parts, { change: "cmod1x" })?.id, "M1");
});

test("a canned plan is kept where it makes sense: library ids, real parts, places that land exactly there", () => {
  const map = pageMap(PAGE, view());
  const plan = cleanPlan({
    note: "Promises and best sellers added to the privacy page",
    steps: [
      step({ do: "add", module: points().id, at: "P1", where: "before", words: words({ points: [{ title: "Keine Zuschläge", text: "für Kleinbestellungen" }] }) }),
      step({ do: "add", module: prod().id, at: "p2", where: "after", words: words({ title: "Beliebte O-Ringe", eyebrow: "Beliebt", button: "Alle O-Ringe" }), link: `${B}/de-CH/dichtungstechnik/o-ringe.html`, fill: { how: "bought", category: `${B}/de-CH/dichtungstechnik/o-ringe.html`, numbers: "", count: 99 } }),
      step({ do: "add", module: "hero-of-dreams", at: "P1" }),
      step({ do: "add", module: prod().id, at: "P9" }),
    ],
  }, ctxOf(map));
  assert.equal(plan.note, "Promises and best sellers added to the privacy page");
  assert.equal(plan.steps.length, 2);
  assert.deepEqual(plan.steps[0].place, { how: "insert", selector: map.parts[0].selector, where: "before" });
  assert.deepEqual(plan.steps[1].place, { how: "insert", selector: map.parts[1].selector, where: "after" });
  // its count within the module's range, its category one the AI was shown
  assert.equal(plan.steps[1].fill.how, "bought");
  assert.equal(plan.steps[1].fill.count, libModule(prod().id)!.max);
  assert.equal(plan.steps[1].link, `${B}/de-CH/dichtungstechnik/o-ringe.html`);
  assert.match(plan.problems.join(" "), /"hero-of-dreams" is not a module of the library/);
  assert.match(plan.problems.join(" "), /"P9", which is not a part of the page/);
  // the lines SARCLA reads: short, English, concrete
  assert.match(plan.steps[0].line, /^Add an? .+ before "Datenschutzerklärung an die…"$/);
  assert.ok(!/ uSP /.test(plan.steps[0].line));
  assert.match(plan.steps[1].line, /^Add (an? )?.+ after "Cookie Policy"$/);
});

test("beside a module the hub put: before the next part of the page's own, or at the end of the content", () => {
  const m0 = pageMap(PAGE, view());
  const mod = makeModule(points().id, "de-CH")!;
  const changes: PageChange[] = [{ op: "insert", selector: m0.parts[1].selector, where: "after", html: renderModule(mod), id: "cmod2x", module: mod } as PageChange];
  const map = pageMap(PAGE, view(changes));
  assert.deepEqual(map.parts.map((p) => p.id), ["P1", "P2", "M1"]);
  const plan = cleanPlan({ note: "x", steps: [
    step({ do: "add", module: prod().id, at: "M1", where: "after", fill: { how: "bought", category: "", numbers: "", count: 5 } }),
    step({ do: "add", module: cats().id, at: "M1", where: "before", fill: { how: "technologies", category: "", numbers: "", count: 4 } }),
    step({ do: "words", module: "whatever", at: "M1", words: words({ title: "Kurz" }) }),
  ] }, ctxOf(map));
  assert.deepEqual(plan.steps[0].place, { how: "insert", selector: "div.column.main", where: "append" });
  assert.deepEqual(plan.steps[1].place, { how: "insert", selector: map.parts[1].selector, where: "after" });
  // words: only the words change - its module and its place stay (the change it rewrites)
  assert.deepEqual(plan.steps[2].place, { how: "change", change: "cmod2x" });
  assert.equal(plan.steps[2].module, points().id);
  assert.match(plan.steps[2].line, /^New words for the /);
  // applied in order after the page's changes, the module appended lands after M1
  const c0 = stepChange(plan.steps[0], `<div class="apx-z9">ROW</div>`, null)!;
  const html = applyChanges(PAGE, [...changes, c0]).html;
  assert.ok(html.indexOf("ROW") > html.indexOf("apx-" + mod.settings.id));
});

test("a plan's step is found again when it is applied: an earlier step's block before it never shifts its place (point 4)", () => {
  const m0 = pageMap(PAGE, view());
  const plan = cleanPlan({ note: "x", steps: [
    step({ do: "add", module: points().id, at: "P1", where: "after", words: words({ points: [{ title: "Keine Zuschläge", text: "für Kleinbestellungen" }] }) }),
    step({ do: "replace", module: cats().id, at: "P2", where: "", fill: { how: "technologies", category: "", numbers: "", count: 4 } }),
  ] }, ctxOf(m0));
  const mod = makeModule(points().id, "de-CH")!;
  const c1 = stepChange(plan.steps[0], renderModule(mod), mod)!;
  // the second step's place as planned: by position - after the first block it would aim at that block (and miss)
  const stale = applyChanges(PAGE, [c1, stepChange(plan.steps[1], "<div class='apx-q2'>NEW</div>", null)!]);
  assert.equal(stale.hits[1].state, "missing");
  // found again on the page as it is now: it lands in place of "Cookie Policy"
  const now = placeNow(plan.steps[1], pageMap(PAGE, view([c1])));
  assert.equal(now.place?.how, "replace");
  const fresh = applyChanges(PAGE, [c1, stepChange({ ...plan.steps[1], place: now.place! }, "<div class='apx-q2'>NEW</div>", null)!]);
  assert.equal(fresh.hits[1].state, "found");
  assert.ok(fresh.html.indexOf("NEW") < fresh.html.indexOf("Cookie Policy</h2>"));
  assert.match(fresh.html.slice(fresh.html.indexOf("NEW"), fresh.html.indexOf("Cookie Policy</h2>")), /display:none !important/);
  // a part that is gone is said
  assert.equal(placeNow({ ...plan.steps[1], target: { kind: "page", fp: "div|Weg|nichts" } }, m0).place, null);
});

test("the page's H1 part keeps its title: a module goes after it, not in its place", () => {
  const H1PAGE = PAGE.replace("<h2>Datenschutzerklärung an die Kundinnen und Kunden</h2>", "<h1>Datenschutzerklärung</h1>");
  const map = pageMap(H1PAGE, view());
  assert.equal(map.parts[0].h1, true);
  const plan = cleanPlan({ note: "x", steps: [step({ do: "replace", module: cats().id, at: "P1", where: "", fill: { how: "technologies", category: "", numbers: "", count: 6 } })] }, ctxOf(map));
  assert.equal(plan.steps[0].do, "add");
  assert.deepEqual(plan.steps[0].place, { how: "insert", selector: map.parts[0].selector, where: "after" });
  assert.match(plan.steps[0].problems.join(" "), /holds the page's title/);
});

test("words that may not stand on the shop are left out - and said", () => {
  const said: string[] = [];
  const page = "Die Angst+Pfister International AG ist ISO 9001 zertifiziert.";
  assert.equal(safeWords("Jetzt 20% sparen. Gute Dichtungen.", page, said), "Gute Dichtungen.");
  assert.equal(safeWords("Nur CHF 4.90 pro Stück.", page, said), "");
  assert.equal(safeWords("Lieferung innerhalb von 24 Stunden. Klar beschrieben.", page, said), "Klar beschrieben.");
  assert.equal(safeWords("Kompatibel laut Chemours. Für Information.", page, said), "Für Information.");
  assert.equal(safeWords("FDA-konform und sicher. ISO 9001 zertifiziert.", page, said), "ISO 9001 zertifiziert.");
  assert.equal(safeWords("[Intro paragraph in German]", page, said), "");
  assert.equal(safeWords("Auf Lager und sofort lieferbar.", page, said), "");
  assert.ok(said.length >= 6);
  // the plan's own words go through it
  const map = pageMap(PAGE, view());
  const plan = cleanPlan({ note: "x", steps: [step({ module: prod().id, words: words({ title: "Bis zu 30% Rabatt", eyebrow: "Beliebt" }), fill: { how: "bought", category: "", numbers: "", count: 5 } })] }, ctxOf(map));
  assert.equal(plan.steps[0].words.title, "");
  assert.equal(plan.steps[0].words.eyebrow, "Beliebt");
  assert.match(plan.steps[0].problems.join(" "), /left out/);
});

test("the note SARCLA reads is ONE short English line - tonight's long German one is replaced by the steps' line", () => {
  assert.equal(looksEnglish("Promises and best sellers added"), true);
  assert.equal(looksEnglish("Ein ruhiger Einstiegsblock mit den wichtigsten Fakten"), false);
  assert.equal(looksEnglish("Un bloc calme pour la page"), false);
  const map = pageMap(PAGE, view());
  const german = "Ein ruhiger Einstiegsblock fasst die wichtigsten Punkte zusammen. Bildmaterial wurde bewusst weggelassen, da die Seite rein textlich ist.";
  const plan = cleanPlan({ note: german, steps: [step({ module: points().id, words: words({ points: [{ title: "Keine Zuschläge", text: "für Kleinbestellungen" }] }) })] }, ctxOf(map));
  assert.equal(plan.note, plan.steps[0].line);
  assert.ok(!/[äöü]/.test(plan.note.replace(/"[^"]*"/g, "")));
  assert.equal(noteOf("Added a product row.\nAnd more lines that go on", []), "Added a product row");
  assert.match(noteOf("x".repeat(200), plan.steps), /^Add /);
});

test("a free block (no module fits) is cleaned the kit's way, under its own prefix", () => {
  const map = pageMap(PAGE, view());
  const plan = cleanPlan({ note: "A short summary above the legal text", steps: [step({ do: "block", module: "", at: "P1", where: "before",
    html: `<style>.apx-blk{background:#f3f4f5;color:#1d2326;padding:20px}.apx-blk h2{color:#274e64}@media (max-width:767px){.apx-blk{padding:12px}}</style><div class="apx-blk"><h2>Kurz gesagt</h2><p>Wir bearbeiten Ihre Daten nur für Ihre Bestellung.</p></div>` })] }, ctxOf(map));
  const s = plan.steps[0];
  assert.equal(s.do, "block");
  assert.ok(!s.html.includes("apx-blk"), "its prefix is its own, not the example's");
  assert.match(s.html, /^<style>/);
  assert.match(s.line, /^Add a block before/);
});

test("a step becomes the change the page keeps; a module filled from the shop keeps how", () => {
  const map = pageMap(PAGE, view());
  const plan = cleanPlan({ note: "x", steps: [
    step({ module: prod().id, at: "P2", where: "after", fill: { how: "category", category: `${B}/de-CH/dichtungstechnik/o-ringe.html`, numbers: "", count: 5 } }),
    step({ do: "replace", module: cats().id, at: "P2", where: "", fill: { how: "technologies", category: "", numbers: "", count: 4 } }),
  ] }, ctxOf(map));
  const m = makeModule(prod().id, "de-CH")!;
  const card = { kind: "product" as const, name: "HITEC® O-Ring", url: `${B}/de-CH/11400101-hitecr-o-ring.html`, img: `${B}/media/x.jpg`, meta: "702 Artikel", number: "11400101", children: [] };
  const filled = withFill(m, { items: [card, card], feature: null, missing: [] }, plan.steps[0].fill, "2026-11-10T08:00:00Z");
  assert.equal(filled.settings.items.length, 2);
  assert.equal(filled.settings.fill?.how, "category");
  const c = stepChange(plan.steps[0], drawModule(filled), filled)!;
  assert.equal(c.op, "insert");
  assert.equal(c.id, plan.steps[0].id);
  assert.equal((c as { module?: { type: string } }).module?.type, prod().id);
  const r = stepChange(plan.steps[1], "<div class='apx-q1'>R</div>", null)!;
  assert.equal(r.op, "replace");
  // its words go only where the module takes them
  const w = withWords(m, { title: "Beliebte O-Ringe", faq: [{ q: "Frage?", a: "Antwort." }] });
  assert.equal(w.settings.title, "Beliebte O-Ringe");
  assert.equal(libModule(prod().id)!.words.some((x) => x.key === "faq") ? w.settings.faq.length : 0, w.settings.faq.length);
  assert.equal(wordsOfModule(w).title, "Beliebte O-Ringe");
});

test("the question carries the page's parts, the shop's categories, the language, the selection and the ask", () => {
  const map = pageMap(PAGE, view());
  const q = planUser({
    context: "PROJECT: Datenschutz", page: `PAGE: ${B}/de-CH/privacy · cms page · store view de-CH (German)`, parts: map.parts, partsText: mapText(map.parts),
    tree: [{ name: "Dichtungstechnik", url: `${B}/de-CH/dichtungstechnik.html`, depth: 0 }, { name: "O-Ringe", url: `${B}/de-CH/dichtungstechnik/o-ringe.html`, depth: 1 }],
    language: "German", store: "de-CH", mode: "part", request: "Kürzer", selected: map.parts[1],
  });
  assert.match(q, /THE PAGE'S PARTS, IN THEIR ORDER/);
  assert.match(q, /P2 · <div> · heading "Cookie Policy" · 1 product links, 1 category links/);
  assert.match(q, /\n  https:\/\/www\.apsoparts\.com\/de-CH\/dichtungstechnik\/o-ringe\.html · O-Ringe/);
  assert.match(q, /WRITE THE MODULES' WORDS IN: German \(store view de-CH\)\. The note and each "why": English\./);
  assert.match(q, /THE PERSON SELECTED: P2 \(heading "Cookie Policy"\)/);
  assert.match(q, /Work on THE SELECTED PART only/);
  assert.match(q, /THE PERSON ASKS: Kürzer/);
});

test("stepLine says each kind of step plainly", () => {
  const map = pageMap(PAGE, view());
  const p2 = map.parts[1];
  assert.match(stepLine({ do: "replace", module: cats().id, at: "P2", where: "", place: { how: "replace", selector: p2.selector } }, map.parts), /^Replace "Cookie Policy" with (an? )?[a-z]/);
  assert.match(stepLine({ do: "add", module: prod().id, at: "P2", where: "after", place: { how: "insert", selector: p2.selector, where: "after" } }, map.parts), /^Add (an? )?.+ after "Cookie Policy"$/);
});


test("a button goes where its words say, and every word is in the page's language", () => {
  assert.equal(buttonSays("Alle O-Ringe", `O-Ringe / X-Ringe ${B}/de-CH/dichtungstechnik/o-ringe-x-ringe.html`), true);
  assert.equal(buttonSays("Kontakt aufnehmen", `Kontakt / Retouren ${B}/de-CH/support/contact`), true);
  assert.equal(buttonSays("Zu Tools & Services", `Tools & Services ${B}/de-CH/service`), true);
  assert.equal(buttonSays("Alle Technologien", `Dichtungstechnik ${B}/de-CH/dichtungstechnik.html`), false);
  assert.equal(inLanguage("Engineering solutions. One click away.", "de"), false);
  assert.equal(inLanguage("Wir sind für Sie da", "de"), true);
  assert.equal(inLanguage("APSOseal® O-Ringe", "de"), true);
  assert.equal(inLanguage("Engineering solutions. One click away.", "en"), true);
  const map = pageMap(PAGE, view());
  const cat = `${B}/de-CH/dichtungstechnik.html`;
  const plan = cleanPlan({ note: "x", steps: [step({ module: prod().id, at: "P2", words: words({ title: "Engineering solutions. One click away.", eyebrow: "Beliebt", button: "Alle Technologien" }), link: cat, fill: { how: "bought", category: "", numbers: "", count: 5 } })] },
    ctxOf(map, { lang: "de", linkNames: { [cat]: "Dichtungstechnik" } }));
  const st = plan.steps[0];
  assert.equal(st.words.title, "");
  assert.equal(st.words.button, "");
  assert.equal(st.link, "");
  assert.match(st.problems.join(" "), /not in the page's language/);
});
