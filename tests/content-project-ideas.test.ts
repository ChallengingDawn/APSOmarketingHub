import assert from "node:assert/strict";
import { test } from "node:test";
import { originLabel, projectIdeas } from "../src/lib/content/ideaOrigins";

// SARCLA's night list (09.11.2026): a project made from several ideas shows where EACH comes from, by the menus' names.

test("project ideas: every idea read back with its app and place, by the menus' names", () => {
  const notes = [
    "[idea convert:12] Show the delivery time under the price - buyers ask for it",
    "[idea aeo-q:7] Answer: “Which O-ring for hot water?”",
    "[idea seo:3] Improve: /de-CH/o-ringe.html - close to page one",
    "[idea team:5] A guide to FDA seals",
    "A note of the team",
  ].join("\n");
  const r = projectIdeas(notes);
  assert.equal(r.ideas.length, 4);
  assert.deepEqual(r.ideas.map((i) => originLabel(i.origin)), [
    "AI testing & personalization · Insights", "AEO & LLM Optimizer · Prompts and answers", "SEO", "Own ideas",
  ]);
  assert.equal(r.ideas[0].title, "Show the delivery time under the price");
  assert.equal(r.ideas[0].why, "buyers ask for it");
  assert.equal(r.ideas[0].origin.href, "/website/ai-personalization/insights");
  assert.equal(r.ideas[3].origin.href, null, "an own idea has no app to open");
  assert.equal(r.rest, "A note of the team");
  assert.deepEqual(projectIdeas(null), { ideas: [], rest: "" });
});
