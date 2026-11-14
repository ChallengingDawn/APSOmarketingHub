import assert from "node:assert/strict";
import { test } from "node:test";
import { armLetterOf, needsDecide, withWon, wonDue, wonHow, type WonMark } from "../src/lib/content/studio/kinds/page/abFlow";
import { emptyPage, pageDoc, storesOfView, viewOf, withView } from "../src/lib/content/studio/kinds/page/model";
import { isOwnTest, pageTestsQuery } from "../src/lib/content/studio/kinds/page/publishView";

// Content v19 (14.11.2026): the Page builder's A/B section on dev-eb's side of the loop - each letter its own version in
// A/B testing, a test labelled and made the page by ITS letter (origin.letter, never the letter open in the studio), and
// a test whose version was made the page closed as published once production is written for its store view.

const mark = (testId: string, view = "de-CH", letter = "C"): WonMark => ({ testId, letter, view, at: "2026-11-14T10:00:00Z", by: "SARCLA" });

test("a test's arm is the letter A/B testing made its version under - never the letter open here", () => {
  assert.equal(armLetterOf({ letter: "C" }, ["A", "B", "C"]), "C", "C's test is C even while B is open");
  assert.equal(armLetterOf({ letter: "B" }, ["A", "B", "C"]), "B");
  // an older test (its version made before letters were sent reads "A"): the page's only other version, if just one
  assert.equal(armLetterOf({ letter: "A" }, ["A", "B"]), "B");
  assert.equal(armLetterOf(null, ["A", "B"]), "B");
  assert.equal(armLetterOf({ letter: null }, ["A", "B", "C"]), null, "two candidates: not known, never a guess");
  assert.equal(armLetterOf({ letter: "A" }, ["A"]), null);
  assert.equal(armLetterOf({ letter: "Z" }, ["A", "B", "C"]), null, "an unknown letter is not taken");
});

test("Make C the page decides the test for the version first - unless A/B testing has it decided so already", () => {
  assert.equal(needsDecide({ status: "running", winner: null }), true);
  assert.equal(needsDecide({ status: "paused", winner: null }), true);
  assert.equal(needsDecide({ status: "stopped", winner: null }), true);
  assert.equal(needsDecide({ status: "stopped", winner: "a" }), true, "decided for the page: decided again, for the version");
  assert.equal(needsDecide({ status: "stopped", winner: "b" }), false, "decided for the version already: nothing asked twice");
  assert.equal(needsDecide({ status: "draft" }), false);
  assert.equal(needsDecide({ status: "shipped", winner: "b" }), false);
});

test("the waiting tests: one each, the newest first, ten at most - closed by production written for their store view", () => {
  let list: WonMark[] = [];
  for (let i = 1; i <= 12; i++) list = withWon(list, mark(String(i)));
  assert.equal(list.length, 10);
  assert.equal(list[0].testId, "12");
  list = withWon(list, mark("5", "fr-CH", "B"));
  assert.deepEqual(list.filter((m) => m.testId === "5").map((m) => m.view), ["fr-CH"], "the same test again: replaced, never twice");
  assert.equal(list[0].testId, "5");

  const marks = [mark("1", "de-CH"), mark("2", "fr-CH"), mark("3", "it-CH")];
  const storesOf = (v: string) => (v === "fr-CH" ? ["fr-CH", "fr-FR"] : [v]);
  // de-CH written, fr-FR (one of fr-CH's store views) written, it-CH refused
  const due = wonDue(marks, [{ view: "de-CH", ok: true }, { view: "fr-FR", ok: true }, { view: "it-CH", ok: false }], storesOf);
  assert.deepEqual(due.map((m) => m.testId), ["1", "2"]);
  assert.deepEqual(wonDue(marks, [], storesOf), []);
  const how = wonHow(mark("1", "fr-CH", "C"), ["fr-CH", "fr-FR"]);
  assert.equal(how, "Made C the page in the Page builder and wrote it into Magento production (fr-CH, fr-FR)");
  assert.ok(wonHow(mark("1"), Array.from({ length: 80 }, (_, i) => `xx-${i}`)).length <= 300, "A/B testing keeps 300 characters");
});

test("the page keeps its waiting tests - through a save, and from any language's view", () => {
  const d = pageDoc({ ...emptyPage("DE"), abWon: [mark("41"), { testId: "x1" }, mark("41"), "junk", mark("42", "de-CH", "B")] });
  assert.deepEqual(d.abWon.map((m) => m.testId), ["41", "42"], "a bad one or a second of the same test is dropped");
  assert.deepEqual(pageDoc(JSON.parse(JSON.stringify(d))).abWon, d.abWon);
  assert.deepEqual(pageDoc({ ...emptyPage("DE") }).abWon, []);
  // "Make C the page" in the French view writes the mark on the whole page
  const fr = viewOf(d, "fr-CH");
  const back = pageDoc(withView(d, "fr-CH", { ...fr, abWon: withWon(fr.abWon, mark("43", "fr-CH")) }));
  assert.deepEqual(back.abWon.map((m) => m.testId), ["43", "41", "42"]);
  assert.ok(storesOfView(back, "fr-CH").includes("fr-CH"));
});

test("the A/B section asks for every test of the to-do OR on its published pages, in one query - and promotes its own only", () => {
  const rec = (env: "acc" | "prod", store: string, action: "created" | "updated" | "switched-off" = "updated") =>
    ({ env, store, pageId: "7", identifier: "black-friday", action, at: "2026-11-14T10:00:00Z", url: "" });
  const q = pageTestsQuery(42, [rec("acc", "de-CH"), rec("acc", "fr-CH"), rec("prod", "de-CH"), rec("acc", "de-CH", "created"), rec("prod", "it-CH", "switched-off")]);
  assert.equal(q, `?piece=42&page=${encodeURIComponent("acc:/de-CH/black-friday")}&page=${encodeURIComponent("acc:/fr-CH/black-friday")}&page=${encodeURIComponent("prod:/de-CH/black-friday")}`,
    "each live page once (the newest record per store view), a page switched off left out");
  assert.equal(pageTestsQuery(42, []), "?piece=42", "not published: the to-do's tests alone");
  const many = Array.from({ length: 30 }, (_, i) => rec("acc", `xx-${i}`)).concat(Array.from({ length: 30 }, (_, i) => rec("prod", `xx-${i}`)));
  assert.equal(pageTestsQuery(1, many).split("&page=").length - 1, 40, "40 pages at most");
  assert.equal(isOwnTest({ piece: "42" }, 42), true);
  assert.equal(isOwnTest({ piece: 43 }, 42), false);
  assert.equal(isOwnTest({ piece: null }, 42), false, "a test made in A/B testing itself is followed, never promoted from here");
});
