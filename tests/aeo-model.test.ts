import assert from "node:assert/strict";
import { test } from "node:test";
import { assistantName, assistantsIn, byMonth, citeRate, isOwnUrl, latestByPrompt, mentionRate, namesIn, r10Series, runOf, shareOfVoice, sumsBetween, type AeoRun } from "../src/lib/aeo/model";

test("our pages: apsoparts.com and angst-pfister.com, sub-domains too - not look-alikes", () => {
  assert.equal(isOwnUrl("https://www.apsoparts.com/de-ch/o-rings"), true);
  assert.equal(isOwnUrl("https://apsoparts.com/"), true);
  assert.equal(isOwnUrl("https://www.angst-pfister.com/en"), true);
  assert.equal(isOwnUrl("https://notapsoparts.com/x"), false);
  assert.equal(isOwnUrl("https://apsoparts.com.evil.io/"), false);
  assert.equal(isOwnUrl("not a url"), false);
  assert.equal(isOwnUrl(null), false);
});

test("a HubSpot run, as the hub keeps it", () => {
  const r = runOf({ id: "u-1", promptId: "77", aiModel: "chatgpt", completedAt: "2026-10-01T10:00:00Z", ownedMentions: 2, competitorMentions: "3", totalCitations: 5 });
  assert.deepEqual(r, { id: "u-1", promptId: "77", model: "CHATGPT", at: "2026-10-01T10:00:00Z", owned: 2, competitor: 3, citations: 5, ownCited: null });
  assert.equal(runOf({ promptId: "77" }), null);
});

const run = (id: string, promptId: string, model: string, at: string, owned: number, competitor: number, ownCited: number | null): AeoRun =>
  ({ id, promptId, model, at, owned, competitor, citations: 4, ownCited });
const runs = [
  run("a", "p1", "CHATGPT", "2026-09-10T00:00:00Z", 1, 3, 1),
  run("b", "p1", "GEMINI", "2026-09-11T00:00:00Z", 0, 2, 0),
  run("c", "p2", "CHATGPT", "2026-10-02T00:00:00Z", 2, 2, null),
  run("d", "p1", "CHATGPT", "2026-10-05T00:00:00Z", 0, 1, 0),
  run("e", "p2", "CLAUDE", "2025-10-01T00:00:00Z", 1, 0, 1),
];

test("naming APSO, share of voice and citing us - over the answers in a window, and per assistant", () => {
  const w = sumsBetween(runs, "2026-09-01T00:00:00Z", "2026-11-01T00:00:00Z");
  assert.equal(w.all.answers, 4);
  assert.equal(mentionRate(w.all), 0.5);                 // a and c named APSO
  assert.equal(shareOfVoice(w.all), 3 / 11);             // APSO 3 against competitors 8
  assert.equal(citeRate(w.all), 1 / 3);                  // c's sources not read yet: 1 of the 3 read
  assert.equal(w.by.CHATGPT.answers, 3);
  assert.equal(mentionRate(w.by.GEMINI), 0);
  assert.equal(Object.keys(byMonth(runs)).sort().join(","), "2025-10,2026-09,2026-10");
});

test("each prompt's latest answer per assistant", () => {
  const l = latestByPrompt(runs);
  assert.equal(l.get("p1")?.get("CHATGPT")?.id, "d");
  assert.equal(l.get("p1")?.get("GEMINI")?.id, "b");
  assert.equal(l.get("p2")?.size, 2);
});

test("R10: answers, those naming APSO and the share per month, this year and last", () => {
  const s = r10Series(runs, 2026);
  assert.equal(s.R10D.months[8], 2);
  assert.equal(s.R10N.months[8], 1);
  assert.equal(s.R10.months[8], 0.5);
  assert.equal(s.R10.months[9], 0.5);
  assert.equal(s.R10.py[9], 1);
  assert.equal(s.R10.months[0], null);
});

test("the assistants that answered, Perplexity among them, in the pages' order", () => {
  const r = (model: string) => ({ id: model, promptId: "p", model, at: "2026-10-01T00:00:00Z", owned: 0, competitor: 0, citations: 0, ownCited: null });
  const runs = [r("PERPLEXITY"), r("CHATGPT"), r("GEMINI"), r("COPILOT")];
  assert.deepEqual(assistantsIn(runs), ["CHATGPT", "GEMINI", "PERPLEXITY", "COPILOT"]);
  assert.equal(namesIn(runs.slice(0, 3)), "ChatGPT, Gemini and Perplexity");
  assert.equal(assistantName("COPILOT"), "Copilot");
});
