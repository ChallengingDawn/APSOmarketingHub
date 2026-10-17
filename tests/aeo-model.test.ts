import assert from "node:assert/strict";
import { test } from "node:test";
import { assistantName, assistantsIn, byMonth, byPrompt, citeRate, citedSites, contentTypeFor, hostOf, isOwnUrl, latestByPrompt, mentionRate, namesIn, projectFor, r10Series, recMarker, runOf, shareOfVoice, sumsBetween, type AeoRecommendation, type AeoRun } from "../src/lib/aeo/model";

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

test("a site is its host without www. - not a URL is nothing", () => {
  assert.equal(hostOf("https://www.NH-Oring.de/o-ringe?x=1"), "nh-oring.de");
  assert.equal(hostOf("https://shop.tameson.de/a"), "shop.tameson.de");
  assert.equal(hostOf("nope"), null);
  assert.equal(hostOf(null), null);
});

test("who the assistants cite: per site the answers citing it, of the answers whose sources are read; ours marked", () => {
  const r = (id: string, model: string, at: string, domains?: string[]): AeoRun => ({ id, promptId: "p", model, at, owned: 0, competitor: 0, citations: 0, ownCited: null, domains });
  const runs = [
    r("1", "CHATGPT", "2026-10-01T00:00:00Z", ["nh-oring.de", "apsoparts.com", "nh-oring.de"]),
    r("2", "GEMINI", "2026-10-02T00:00:00Z", ["nh-oring.de", "tameson.de"]),
    r("3", "GEMINI", "2026-10-03T00:00:00Z"),                         // sources not read: not counted
    r("4", "CHATGPT", "2026-08-01T00:00:00Z", ["cog.de"]),            // outside the window
  ];
  const all = citedSites(runs, "2026-09-15T00:00:00Z", "2026-10-15T00:00:00Z");
  assert.equal(all.read, 2);
  assert.deepEqual(all.sites.map((x) => [x.domain, x.answers, x.share, x.own]), [
    ["nh-oring.de", 2, 1, false], ["apsoparts.com", 1, 0.5, true], ["tameson.de", 1, 0.5, false],
  ]);
  const gemini = citedSites(runs, "2026-09-15T00:00:00Z", "2026-10-15T00:00:00Z", "GEMINI");
  assert.equal(gemini.read, 1);
  assert.equal(gemini.sites.some((x) => x.own), false);
});

test("prompt by prompt in a window", () => {
  const w = byPrompt(runs, "2026-09-01T00:00:00Z", "2026-11-01T00:00:00Z");
  assert.equal(w.p1.answers, 3);
  assert.equal(mentionRate(w.p1), 1 / 3);
  assert.equal(w.p2.answers, 1);                              // e is a year earlier
});

const rec = (over: Partial<AeoRecommendation>): AeoRecommendation => ({
  id: "r9", promptIds: ["p1", "p2", "gone"], engine: null, type: null, action: "CREATE_CONTENT", channel: "OWNED_CONTENT",
  contentType: "EDUCATIONAL", topic: "O-ring material selection guide", domain: null, url: null, priority: "MEDIUM", status: "NEW",
  summary: "Publish a guide comparing NBR, FKM and EPDM", justification: "Competitors are cited for material choice", startDate: null, endDate: null,
  influencing: ["https://www.nh-oring.de/werkstoffe", "https://tameson.de/o-ring"], associatedUrl: null, ...over,
});

test("the Content Studio type a recommendation is made as", () => {
  assert.equal(contentTypeFor(rec({})), "blog-article");
  assert.equal(contentTypeFor(rec({ contentType: "PRODUCT_PAGE" })), "product-page");
  assert.equal(contentTypeFor(rec({ contentType: "COMPARISON" })), "landing-page");
  assert.equal(contentTypeFor(rec({ action: "UPDATE_CONTENT" })), "page-refresh");
  assert.equal(contentTypeFor(rec({ action: "BUILD_BACKLINKS" })), null);       // not content we write
});

test("a recommendation as a project: the topic as title, a brief with the questions and the pages to beat, its marker", () => {
  const prompts = [
    { id: "p1", prompt: "Which O-ring material for hot water?", language: "en", phase: null, assistants: [], createdAt: null, visibility: 0.05 },
    { id: "p2", prompt: "Best O-ring supplier in Switzerland", language: "en", phase: null, assistants: [], createdAt: null, visibility: null },
  ];
  const p = projectFor(rec({}), prompts);
  assert.equal(p.title, "O-ring material selection guide");
  assert.equal(p.contentType, "blog-article");
  assert.match(p.brief, /medium priority/);
  assert.match(p.brief, /What to do: Publish a guide comparing NBR, FKM and EPDM/);
  assert.ok(p.brief.includes("- Which O-ring material for hot water?\n- Best O-ring supplier in Switzerland"));
  assert.match(p.brief, /- https:\/\/www\.nh-oring\.de\/werkstoffe/);
  assert.ok(p.brief.endsWith(recMarker("r9")));
  // long briefs stay under the hub's 8 KB body, the marker kept
  const long = projectFor(rec({ justification: "x".repeat(9000) }), prompts);
  assert.ok(long.brief.length <= 6000);
  assert.ok(long.brief.endsWith(recMarker("r9")));
  assert.equal(projectFor(rec({ topic: null }), prompts).title, "Publish a guide comparing NBR, FKM and EPDM");
});
