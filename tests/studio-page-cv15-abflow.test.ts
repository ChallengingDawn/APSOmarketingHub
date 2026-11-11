import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allocationOf, audienceOf, blocksChanged, blocksOf, differsLine, flowStep, pageVariant, rootParts, sendWhy, sparkPoints, testDefaults, testName, topParts, upliftLine,
} from "../src/lib/content/studio/kinds/page/abFlow";
import { addVersion, emptyPage, lettersOf, openVersion, pageDoc, promoteVersion, versionList, type PageDoc } from "../src/lib/content/studio/kinds/page/model";
import type { Fields } from "../src/lib/content/studio/kinds/page/fields";

// Content v15 (SARCLA 11.11.2026, ~18:00): "I cannot define the test. I should be able in one click to create, with the
// same content, another version to send, and then it sends to AI personalization - this should send to the A/B testing
// sub app, but always be tracked from the page as well, on its tab."

function kalrez(): PageDoc {
  const d = emptyPage("en-INT");
  const f: Fields = {
    ...d.fields,
    hero: { eyebrow: "Discontinuation", title: "Kalrez 6221 and 6230 discontinued", sub: "Order until 27 November 2026.", picture: { url: "/api/content/picture/1-hero", alt: "FFKM O-rings", idea: "" }, button: { label: "To the FFKM O-rings", url: "/en-INT/o-rings.html" } },
    intro: "The manufacturer ends production.",
    sections: [{ id: "s1", title: "The alternatives", text: "evolast PN794 and PN795.", picture: { url: "", alt: "", idea: "" }, side: "right" }] as Fields["sections"],
    cta: { title: "Secure your quantities", text: "Order now.", button: { label: "Order", url: "/en-INT/x" } },
    order: ["hero", "intro", "sections.s1", "cta"],
  };
  return { ...d, source: "new", fields: f } as PageDoc;
}

test("version B of a page made here: the same blocks and words, opened - A kept, one click back", () => {
  const a = kalrez();
  const b = addVersion(a);
  assert.equal(b.letter, "B");
  assert.deepEqual(lettersOf(b), ["A", "B"]);
  assert.deepEqual(b.fields, a.fields, "B starts as the same content");
  assert.notEqual(b.fields, a.fields, "a copy, not the same object");
  const changed = { ...b, fields: { ...b.fields, hero: { ...b.fields.hero, title: "Order Kalrez 6221 and 6230 until 27 November" } } };
  const backToA = openVersion(changed, "A");
  assert.equal(backToA.letter, "A");
  assert.equal(backToA.fields.hero.title, "Kalrez 6221 and 6230 discontinued", "A's own words");
  const againB = openVersion(backToA, "B");
  assert.equal(againB.fields.hero.title, "Order Kalrez 6221 and 6230 until 27 November", "B's change kept under its letter");
  assert.equal(versionList(againB).find((v) => v.letter === "A")?.fields?.hero.title, "Kalrez 6221 and 6230 discontinued");
});

test("a page made here keeps its versions' blocks through the document (saved and read again)", () => {
  const b = addVersion(kalrez());
  const edited = { ...b, fields: { ...b.fields, intro: "B's intro." } };
  const back = pageDoc(JSON.parse(JSON.stringify(openVersion(edited, "A"))), "en-INT");
  assert.equal(back.letter, "A");
  assert.equal(back.fields.intro, "The manufacturer ends production.");
  assert.equal(openVersion(back, "B").fields.intro, "B's intro.");
});

test("a page of the shop: versions stay change lists - no fields carried", () => {
  const shop = { ...emptyPage("de-CH"), source: "pick", path: "/de-CH/x", changes: [{ op: "text", selector: "h1", text: "A" }] } as unknown as PageDoc;
  const b = addVersion(shop);
  assert.equal(versionList(b).some((v) => "fields" in v && v.fields), false);
});

test("Make B the page: B's content becomes A, B goes, A open", () => {
  const b = addVersion(kalrez());
  const edited = { ...b, fields: { ...b.fields, hero: { ...b.fields.hero, title: "B's headline" } } };
  const fromB = promoteVersion(edited, "B");
  assert.equal(fromB.letter, "A");
  assert.equal(fromB.fields.hero.title, "B's headline");
  assert.deepEqual(lettersOf(fromB), ["A"]);
  assert.equal(fromB.versions.length, 0, "the page alone again");
  // from A open, too
  const fromA = promoteVersion(openVersion(edited, "A"), "B");
  assert.equal(fromA.fields.hero.title, "B's headline");
  assert.equal(promoteVersion(kalrez(), "B").fields.hero.title, "Kalrez 6221 and 6230 discontinued", "no B: nothing changes");
});

test("what B changes, in a person's words: the blocks changed, added, taken out, the order", () => {
  const a = kalrez().fields;
  assert.deepEqual(blocksOf(a), ["hero", "intro", "sections.s1", "cta"]);
  assert.deepEqual(blocksChanged(a, a), []);
  const b1 = { ...a, hero: { ...a.hero, title: "New headline" }, looks: { "cta.title": { color: "red" } } } as Fields;
  assert.deepEqual(blocksChanged(a, b1), ["the hero", "the call to action"]);
  const b2 = { ...a, order: ["hero", "sections.s1", "intro", "cta"] } as Fields;
  assert.deepEqual(blocksChanged(a, b2), ["the order of the blocks"]);
  const b3 = { ...a, sections: [], order: ["hero", "intro", "cta"], modules: [{ id: "m1", after: "intro", module: { type: "bento", settings: { title: "O-rings ==for every== seal" } } }] } as unknown as Fields;
  assert.deepEqual(blocksChanged(a, b3), ["module «O-rings for every seal» added", "section «The alternatives» taken out"]);
  assert.equal(differsLine([]), "Version B is the same as A so far - change what you want to test (a headline, the hero, a block) on the page.");
  assert.equal(differsLine(["the hero"]), "Version B changes the hero.");
  assert.equal(differsLine(["a", "b", "c", "d", "e", "f"]), "Version B changes a, b, c, d and 2 more.");
});

const page = (blocks: string[], css = ".apx-np{x:1}") => `<div class="apx-pb-row"><div data-content-type="html"><style>\n${css}\n</style>\n<div class="apx-np">\n${blocks.join("\n")}\n</div></div></div>`;
const HERO = '<section class="apx-np-hero"><h1>Kalrez</h1><img src="https://x/a.jpg" alt=""><p>Order</p></section>';
const INTRO = '<div class="apx-np-intro"><p>Intro <br> text</p><!-- note --></div>';
const CTA = '<section class="apx-np-cta"><h2>Secure</h2><a href="/x">Order</a></section>';

test("the page's blocks as the shop has them: the top-level elements of its root, void tags and comments read", () => {
  assert.deepEqual(topParts(`${HERO}\n${INTRO}\n${CTA}`), [HERO, INTRO, CTA]);
  assert.deepEqual(rootParts(page([HERO, INTRO, CTA])), [HERO, INTRO, CTA]);
  assert.equal(rootParts("<div>no root</div>"), null);
  assert.deepEqual(topParts('<style>.a>b{c:d}</style><div><div></div></div>'), ['<style>.a>b{c:d}</style>', '<div><div></div></div>']);
});

test("B's change list: changed blocks replaced (the last first), blocks added or taken out, B's own style", () => {
  const HERO2 = HERO.replace("Kalrez", "Order Kalrez until 27 November");
  const CTA2 = CTA.replace("Secure", "Secure them now");
  assert.deepEqual(pageVariant(page([HERO, INTRO, CTA]), page([HERO2, INTRO, CTA2])).changes, [
    { op: "replace", selector: ".apx-np > :nth-child(3)", html: CTA2 },
    { op: "replace", selector: ".apx-np > :nth-child(1)", html: HERO2 },
  ]);
  assert.deepEqual(pageVariant(page([HERO, INTRO, CTA]), page([HERO, CTA])).changes, [{ op: "hide", selector: ".apx-np > :nth-child(2)" }]);
  assert.deepEqual(pageVariant(page([HERO, CTA]), page([HERO, INTRO, CTA])).changes, [{ op: "insert", selector: ".apx-np > :nth-child(1)", where: "after", html: INTRO }]);
  assert.deepEqual(pageVariant(page([HERO]), page([INTRO, HERO])).changes, [{ op: "insert", selector: ".apx-np", where: "prepend", html: INTRO }]);
  const styled = pageVariant(page([HERO]), page([HERO], ".apx-np{x:1}\n.apx-np-hx-123456{color:#123456}"));
  assert.deepEqual(styled.changes, [{ op: "css", css: ".apx-np-hx-123456{color:#123456}" }]);
  assert.deepEqual(pageVariant(page([HERO]), page([HERO])).changes, []);
  assert.match(pageVariant("<p>x</p>", page([HERO])).problem ?? "", /not found/);
});

test("the test's defaults: its name from what B changes, add to cart, the language's store views, half and half, ACC first", () => {
  assert.equal(testName("Kalrez page", "B", ["the hero", "the call to action", "the intro"]), "Kalrez page – B: the hero, the call to action");
  assert.equal(testName("", "B", []), "This page – B");
  const d = testDefaults({ page: "Kalrez page", letter: "B", changed: ["the hero"], stores: ["en-INT", "en-CH"] });
  assert.deepEqual(d, { name: "Kalrez page – B: the hero", goal: "add_to_cart", who: "stores", stores: ["en-INT", "en-CH"], split: "half", env: "acc" });
  assert.deepEqual(allocationOf("half"), { mode: "split", split: { a: 50, b: 50 }, floor: 10 });
  assert.equal(allocationOf("bandit").mode, "bandit");
  assert.deepEqual(audienceOf(d), { stores: ["en-INT", "en-CH"], device: "any", visitor: "any", login: "any", source: "any" });
  assert.deepEqual(audienceOf({ ...d, who: "all" }).stores, []);
});

test("Send to A/B testing waits for: the write level, the page on that shop, a B that changes something, a name", () => {
  const base = { canEdit: true, changes: 2, onShop: { acc: true, prod: false }, env: "acc" as const, name: "x", sending: false };
  assert.equal(sendWhy(base), null);
  assert.match(sendWhy({ ...base, canEdit: false }) ?? "", /write level/);
  assert.match(sendWhy({ ...base, env: "prod" }) ?? "", /production first/);
  assert.match(sendWhy({ ...base, onShop: { acc: false, prod: false } }) ?? "", /ACC first/);
  assert.match(sendWhy({ ...base, changes: 0 }) ?? "", /does nothing/);
  assert.match(sendWhy({ ...base, name: " " }) ?? "", /name/);
});

test("where the person stands: make B, change it, define the test, track it", () => {
  assert.equal(flowStep({ hasB: false, changed: 0, tests: [] }), "make");
  assert.equal(flowStep({ hasB: true, changed: 0, tests: [] }), "change");
  assert.equal(flowStep({ hasB: true, changed: 1, tests: [{ status: "stopped" }] }), "define");
  assert.equal(flowStep({ hasB: true, changed: 1, tests: [{ status: "draft" }] }), "track");
  assert.equal(flowStep({ hasB: false, changed: 0, tests: [{ status: "running" }] }), "track");
});

test("a test followed here: its uplift with its range in words, its day-by-day line", () => {
  assert.equal(upliftLine(null), "No visitor counted yet.");
  assert.equal(upliftLine({ counted: true, a: { rate: 0.025, visitors: 1240 }, b: { rate: 0.0367, visitors: 1198 }, uplift: { mid: 0.469, low: -0.05, high: 1.2 } }), "B: 3.7% add to cart, A: 2.5% - +46.9% (−5.0% to +120.0%)");
  const s = sparkPoints([{ rateA: 0.02, rateB: 0.03 }, { rateA: 0.025, rateB: 0.035 }, { rateA: null, rateB: 0.04 }]);
  assert.equal(s.a.split(" ").length, 2);
  assert.equal(s.b.split(" ").length, 3);
  assert.deepEqual(sparkPoints([{ rateA: 0.1, rateB: 0.1 }]), { a: "", b: "" });
});
