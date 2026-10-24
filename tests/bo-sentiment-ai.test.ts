import assert from "node:assert/strict";
import { test } from "node:test";
import { AI_PER_DAY, AI_PER_RUN, aiParse, aiSystem, aiText } from "../src/lib/boSentiment/ai";

test("only the allowed answers are accepted", () => {
  const ok = aiParse('{"tone":"negative","resolution":"positive","machine":false,"why":"complains about late pallet"}');
  assert.deepEqual(ok, { tone: "negative", resolution: "positive", machine: false, why: "complains about late pallet" });

  // prose around the JSON is fine
  assert.equal(aiParse('Here you go: {"tone":"neutral","resolution":"unknown","machine":false,"why":"x"} - hope that helps')?.tone, "neutral");

  // a value outside the list is no answer at all, not a guess
  assert.equal(aiParse('{"tone":"angry","resolution":"positive","machine":false,"why":"x"}'), null);
  assert.equal(aiParse('{"tone":"negative","resolution":"solved","machine":false,"why":"x"}'), null);
  assert.equal(aiParse('{"tone":"negative","machine":false}'), null, "a missing field is no answer");
  assert.equal(aiParse("not json at all"), null);
  assert.equal(aiParse(""), null);

  // machine is strictly true, never a truthy string
  assert.equal(aiParse('{"tone":"neutral","resolution":"unknown","machine":"yes","why":""}')?.machine, false);
  assert.equal(aiParse('{"tone":"neutral","resolution":"unknown","machine":true,"why":""}')?.machine, true);
});

test("the thread is labelled by author, newest last", () => {
  const t = aiText("Wrong delivery", [
    { direction: "INCOMING_EMAIL", text: "You sent the wrong size." },
    { direction: "EMAIL", text: "Apologies - the replacement ships today." },
  ]);
  assert.match(t, /Subject: Wrong delivery/);
  assert.ok(t.indexOf("[CUSTOMER]") < t.indexOf("[US]"), "the order of the thread is kept");
  assert.match(t, /\[CUSTOMER\]\nYou sent the wrong size\./);
  assert.match(t, /\[US\]\nApologies - the replacement ships today\./);
});

test("addresses and phone numbers never reach the model", () => {
  const t = aiText("Re: order", [
    { direction: "INCOMING_EMAIL", text: "Write me at buyer.name@kunde.de or call +41 44 123 45 67 please." },
  ]);
  assert.equal(t.includes("buyer.name@kunde.de"), false);
  assert.equal(t.includes("44 123 45 67"), false);
  assert.match(t, /\[e-mail\]/);
  assert.match(t, /\[phone\]/);
});

test("a mail with only an HTML body is still shown to the model", () => {
  const t = aiText("x", [{ direction: "INCOMING_EMAIL", text: "", html: "<p>This is <b>unacceptable</b></p>" }]);
  assert.match(t, /This is unacceptable/);
});

test("an empty mail adds nothing", () => {
  const t = aiText("Only a subject", [{ direction: "INCOMING_EMAIL", text: "   " }]);
  assert.equal(t.includes("[CUSTOMER]"), false);
});

test("the instruction says the things the measurements showed it must say", () => {
  const s = aiSystem();
  // the defect that produced 24.5% negative: urgency read as dissatisfaction
  assert.match(s, /deadline is NOT dissatisfaction/i);
  assert.match(s, /urgent/i);
  // the defect that produced "customer happy, we failed"
  assert.match(s, /apology is not a failure/i);
  // routine courtesy must not inflate positive, which is why v4 removed bare "thanks"
  assert.match(s, /courtesy/i);
  // the two questions are about different authors
  assert.match(s, /only from what WE wrote/i);
  assert.match(s, /JSON/);
});

test("the caps are small enough that a backlog cannot become a bill", () => {
  assert.ok(AI_PER_RUN <= 10, `${AI_PER_RUN} per run`);
  assert.ok(AI_PER_DAY <= 200, `${AI_PER_DAY} per day`);
  // the sweep runs every few minutes, so the daily cap must be the binding one
  assert.ok(AI_PER_DAY > AI_PER_RUN);
});
