import assert from "node:assert/strict";
import { test } from "node:test";
import { addChange, changesOf, madeLanguages, versionLabel, versionOf, whenOf } from "../src/lib/content/studio/kinds/blog/changes";
import { blogDoc } from "../src/lib/content/studio/kinds/blog/model";
import { asNewsletter } from "../src/lib/content/studio/kinds/newsletter/model";

// Content v4 (09.11.2026), the lead: "Changes made here survives a reload in both studios" - kept in the document, small,
// the newest first, at most 20; what a change replaced is the version saved just before it, found by its number.

test("the list kept with the document: newest first, at most 20, short, no picture or copy of the text", () => {
  let list: ReturnType<typeof changesOf> = [];
  for (let i = 1; i <= 25; i++) list = addChange(list, { id: 1000 + i, text: `Change ${i}`, at: "2026-11-09T04:00:00.000Z" });
  assert.equal(list.length, 20);
  assert.equal(list[0].text, "Change 25");
  assert.equal(list[19].text, "Change 6");
  const odd = changesOf([{ id: 5, text: `Picture data:image/png;base64,${"A".repeat(5000)} kept`, at: "x" }, { id: "no", text: "bad id" }, { id: 6, text: "" }, "junk", { id: 7, text: "Into German", at: "y", lang: "DE" }, { id: 8, text: "x", lang: "German" }]);
  assert.deepEqual(odd.map((c) => c.id), [8, 7, 5]);
  assert.ok(odd.find((c) => c.id === 5)!.text.length < 300 && !odd.find((c) => c.id === 5)!.text.includes("base64"));
  assert.equal(odd.find((c) => c.id === 7)!.lang, "DE");
  assert.equal(odd.find((c) => c.id === 8)!.lang, undefined, "a language is its two-letter code");
  assert.ok(new TextEncoder().encode(JSON.stringify(list)).length < 8000, "the whole list fits one save");
});

test("the version saved before a change is found by its number", () => {
  const c = { id: 1731127000123, text: "Shorter: the lead." };
  const versions = [{ id: 3, label: "Before going back" }, { id: 2, label: versionLabel(c) }, { id: 1, label: null }];
  assert.equal(versionOf(versions, c.id)?.id, 2);
  assert.equal(versionOf(versions, 42), null);
  assert.ok(versionLabel({ id: 1, text: "x".repeat(400) }).length < 120);
});

test("the languages made: its own first, then those translated into here", () => {
  const list = changesOf([{ id: 3, text: "Into French", at: "", lang: "FR", from: "DE" }, { id: 2, text: "Shorter", at: "" }, { id: 1, text: "Into German", at: "", lang: "DE", from: "EN" }]);
  assert.deepEqual(madeLanguages(list, "fr"), ["FR", "DE", "EN"], "the language it was translated from counts as made too");
});

test("both documents keep the list through their own reading (it survives a reload)", () => {
  const changes = [{ id: 2, text: "Into German: the whole post.", at: "2026-11-09T04:19:00.000Z", lang: "DE" }, { id: 1, text: "Shorter: the lead.", at: "2026-11-09T03:56:00.000Z" }];
  assert.deepEqual(blogDoc({ title: "A post", changes }).changes, changes);
  assert.deepEqual(asNewsletter({ subject: "Hi", blocks: [], changes }).changes, changes);
  assert.deepEqual(blogDoc({ title: "A post" }).changes, []);
});

test("when: the hour today, the day before", () => {
  const now = new Date("2026-11-09T12:00:00");
  assert.match(whenOf("2026-11-09T09:05:00", now), /^09:05$/);
  assert.match(whenOf("2026-11-08T22:10:00", now), /^8 Nov 22:10$/);
  assert.equal(whenOf("not a date", now), "");
});
