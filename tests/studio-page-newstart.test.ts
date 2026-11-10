import test from "node:test";
import assert from "node:assert/strict";
import { appBriefOf, autoWriteOf, ideaOfProject, pageHasContent, startLine, writesItself } from "../src/lib/content/studio/kinds/page/appBrief";
import { emptyFields, type Fields } from "../src/lib/content/studio/kinds/page/fields";

// Content v9 (SARCLA 10.11.2026: "also new page should be empty and then we start to build, only not when they come from
// ideas"): a new page opens EMPTY unless its to-do came from an idea of the Ideas board - any source - and then it writes
// itself from that idea's brief, only while nothing is on the page.

const EMPTY = { fields: emptyFields(), newPage: { body: "" }, inserts: [] as unknown[] };
const withF = (patch: (f: Fields) => Fields, extra: Partial<typeof EMPTY> = {}) => ({ ...EMPTY, ...extra, fields: patch(emptyFields()) });
const project = (notes: string | null, source: string | null = null, goal = "", title = "Seals for food machines") => ({ source, goal, notes, title });

/* ── no idea: it opens empty ──────────────────────────────────────────── */

test("a to-do that came from no idea opens empty - even with a goal and words in its brief", () => {
  assert.equal(autoWriteOf(project(null, null, "O-rings for food machines"), false), false);
  assert.equal(autoWriteOf(project("Our own notes: a page about FDA o-rings for maintenance buyers.", null, "FDA o-rings"), false), false);
  assert.equal(appBriefOf(project("Some notes", null, "A goal")).idea, null);
  assert.equal(appBriefOf(project("Some notes", null, "A goal")).app, null, "no app's brief box");
  assert.equal(startLine(appBriefOf(project(null)), "empty"), "It starts empty - this to-do did not come from an idea.");
  assert.equal(autoWriteOf(project(null, "something-else", "A goal"), false), false, "an unknown source is no idea");
});

/* ── an idea, whatever its source: it writes itself ───────────────────── */

test("an idea of any source on the Ideas board writes the new page - Own ideas and the chat too", () => {
  const cases: [string, string][] = [
    ["team:5", "Own ideas"],
    ["convert:12", "AI testing & personalization"],
    ["buyers:w3:0", "AI testing & personalization"],
    ["aeo:77", "AEO & LLM Optimizer"],
    ["aeo-q:9", "AEO & LLM Optimizer"],
    ["seo:3", "SEO"],
    ["search:fda o-ring", "Search bar"],
    ["chat:seals:food", "APSOassistant Chat"],
    ["brand:term:viton", "Personality"],
  ];
  for (const [key, app] of cases) {
    const p = project(`[idea ${key}] Seals for food machines - buyers search it and find nothing`, key.split(":")[0].replace("aeo-q", "aeo"));
    assert.equal(autoWriteOf(p, false), true, `${key} writes itself`);
    assert.equal(autoWriteOf({ ...p, source: null }, false), true, `${key}: the idea line alone is enough`);
    const b = appBriefOf(p);
    assert.equal(b.app, app, key);
    assert.equal(b.idea?.title, "Seals for food machines", key);
    assert.doesNotMatch(b.text, /\[idea /, "the idea's key is not shown as words");
    assert.match(b.text, /buyers search it/, "its why is the brief");
  }
});

test("a page sent straight from an app (its marker, no idea line) came from that app's idea", () => {
  const convert = project("A NEW SEO landing page to write. From APSOconvert ...\n\n[APSOconvert page prod:/de-CH/dichtungstechnik.html v:12]", null, "", "O-rings for food");
  assert.equal(autoWriteOf(convert, false), true);
  assert.equal(appBriefOf(convert).app, "AI testing & personalization");
  assert.equal(appBriefOf(convert).idea?.title, "O-rings for food", "the idea's name is the project's");
  assert.doesNotMatch(appBriefOf(convert).text, /APSOconvert page/);
  const aeo = project("Recommended by HubSpot's AEO: content the AI assistants should find.\n\nTopic: FKM seals\n\n[AEO recommendation 4711]", null, "", "FKM seals");
  assert.equal(autoWriteOf(aeo, false), true);
  assert.equal(appBriefOf(aeo).app, "AEO & LLM Optimizer");
  assert.doesNotMatch(appBriefOf(aeo).text, /AEO recommendation 4711/, "the marker is not shown as words");
});

test("the source column alone (the first idea's app) is the idea's link too - as before for SEO", () => {
  assert.equal(autoWriteOf(project(null, "seo", "Seals"), false), true);
  assert.equal(autoWriteOf(project(null, "team", "Seals"), false), true, "an own idea of the board too");
  assert.equal(appBriefOf(project(null, "team", "Seals")).app, "Own ideas");
  assert.equal(appBriefOf(project(null, "geo", "Seals")).app, "GEO", "the board's older sources");
});

test("an idea with no words to write from does not write itself, and says why", () => {
  const b = appBriefOf(project("[APSOconvert page prod:/de-CH/x.html]", null, "", ""));
  assert.ok(b.idea, "it came from an idea");
  assert.equal(b.auto, false);
  assert.equal(writesItself(b, false), false);
  assert.match(startLine(b, "empty"), /no words to write from, so it starts empty\.$/);
});

/* ── nothing that has content is touched ──────────────────────────────── */

test("a page with anything on it is never written by itself - a word, a picture, a block, a module, a banner, a draft", () => {
  const idea = project("[idea seo:3] Seals for food machines - close to page one", "seo");
  assert.equal(autoWriteOf(idea, pageHasContent(EMPTY)), true, "empty: written");
  const full: [string, ReturnType<typeof withF>][] = [
    ["the hero's title", withF((f) => ({ ...f, hero: { ...f.hero, title: "Seals" } }))],
    ["a small line above", withF((f) => ({ ...f, hero: { ...f.hero, eyebrow: "New" } }))],
    ["the hero's picture only", withF((f) => ({ ...f, hero: { ...f.hero, picture: { url: "/api/content/picture/12-ab", alt: "", idea: "" } } }))],
    ["an empty text-and-picture block added", withF((f) => ({ ...f, sections: [{ id: "s1", title: "", text: "", picture: { url: "", alt: "", idea: "" }, side: "right" }] }))],
    ["a question", withF((f) => ({ ...f, faq: [{ id: "q1", q: "", a: "" }] }))],
    ["a module only", withF((f) => ({ ...f, modules: [{ id: "m1", after: "hero", module: { type: "x", settings: {} } as never }] }))],
    ["the search engine fields only", withF((f) => ({ ...f, seo: { title: "", description: "", urlKey: "fda-o-rings" } }))],
    ["a banner put in", withF((f) => f, { inserts: [{ id: "b1" }] })],
    ["an earlier draft (one block of HTML)", withF((f) => f, { newPage: { body: "<p>Draft</p>" } })],
  ];
  for (const [what, d] of full) {
    assert.equal(pageHasContent(d), true, what);
    assert.equal(autoWriteOf(idea, pageHasContent(d)), false, `${what}: not touched`);
  }
  assert.equal(pageHasContent(withF((f) => ({ ...f, order: ["hero", "intro", "cta"] }))), false, "the bare skeleton, blocks taken out: still empty");
  assert.equal(pageHasContent(withF((f) => ({ ...f, hero: { ...f.hero, title: "   " } }))), false, "spaces are no words");
});

/* ── the start card's one line ───────────────────────────────────────── */

test("the start card says in one short line why the page is empty or why it wrote itself", () => {
  const b = appBriefOf(project("[idea seo:3] Seals for food machines - close to page one", "seo"));
  assert.equal(startLine(b, "wrote"), "From the idea “Seals for food machines” - written from its brief.");
  assert.equal(startLine(b, "writing"), "From the idea “Seals for food machines” - writing it from its brief.");
  assert.equal(startLine(b, "noAi"), "From the idea “Seals for food machines” - the AI is not set up on this hub, so it starts empty.");
  assert.match(startLine(b, "failed", "The AI did not answer in time."), /^From the idea “Seals for food machines” - it could not be written from its brief \(The AI did not answer in time\)\.$/);
  const three = appBriefOf(project("[idea seo:3] Seals for food machines - a\n[idea search:fda] A page for “fda” - b\n[idea team:2] Food seals - c", "seo"));
  assert.equal(three.idea?.more, 2);
  assert.equal(startLine(three, "wrote"), "From the idea “Seals for food machines” and 2 more - written from its brief.");
  for (const st of ["empty", "writing", "wrote", "failed", "noAi", "readOnly"] as const) assert.ok(startLine(b, st, "x".repeat(400)).length <= 200, `${st}: one short line`);
  assert.equal(ideaOfProject({ source: null, notes: null, title: "x" }), null);
});
