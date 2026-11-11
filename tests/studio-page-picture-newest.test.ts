import assert from "node:assert/strict";
import { test } from "node:test";
import { isNewest, madeFrom, makeButton, startJob, type SlotJobs } from "../src/lib/content/studio/kinds/page/pictureJobs";

// Content v13 (SARCLA 11.11.2026, screenshot 26): "make another on photo don't take into account new prompt" - the hero's
// picture was being made, his new words sat in "What should the picture show?" and were never used.

test("the newest ask for a slot wins - an older ask's picture never lands in it", () => {
  const jobs: SlotJobs = {};
  const a = startJob(jobs, "en|hero.picture");
  assert.ok(isNewest(jobs, "en|hero.picture", a));
  const b = startJob(jobs, "en|hero.picture");
  assert.ok(!isNewest(jobs, "en|hero.picture", a), "the first ask, overtaken");
  assert.ok(isNewest(jobs, "en|hero.picture", b));
  const other = startJob(jobs, "de|hero.picture");
  assert.ok(isNewest(jobs, "de|hero.picture", other), "another language's slot keeps its own count");
  assert.ok(isNewest(jobs, "en|hero.picture", b));
});

test("the make button: new words while a picture is made start a new ask; the same words wait", () => {
  const base = { hasPicture: true, canMake: true };
  assert.deepEqual(makeButton({ ...base, making: false, makingFrom: null, draft: "a seal" }), { label: "Make another", disabled: false });
  assert.deepEqual(makeButton({ ...base, hasPicture: false, making: false, makingFrom: null, draft: "a seal" }), { label: "Make it", disabled: false });
  assert.equal(makeButton({ ...base, making: false, makingFrom: null, draft: "  " }).disabled, true, "no words, nothing to make");
  assert.equal(makeButton({ ...base, canMake: false, making: false, makingFrom: null, draft: "a seal" }).disabled, true);
  // being made from the words in the box: wait
  assert.deepEqual(makeButton({ ...base, making: true, makingFrom: "a mechanic at a pump", draft: "a mechanic at a  pump " }), { label: "Making it…", disabled: true });
  // his case: other words typed while it is made
  assert.deepEqual(makeButton({ ...base, making: true, makingFrom: "a mechanic at a pump", draft: "production stop with o-ring, calm, not an emergency" }),
    { label: "Make it from these words instead", disabled: false });
  // a fine-tune running (its words are not the box's): wait
  assert.deepEqual(makeButton({ ...base, making: true, makingFrom: null, draft: "anything" }), { label: "Making it…", disabled: true });
});

test("the words it is made from, shown short under its progress", () => {
  assert.equal(madeFrom("  a   mechanic\nat a pump "), "a mechanic at a pump");
  assert.equal(madeFrom(null), "");
  const long = madeFrom("x".repeat(300));
  assert.equal(long.length, 110);
  assert.ok(long.endsWith("…"));
});
