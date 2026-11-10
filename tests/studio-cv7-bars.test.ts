import assert from "node:assert/strict";
import { test } from "node:test";
import { answerOf, plainStatus, readAnswer } from "../src/lib/http/answer";
import { STATE_WORD, checkConnection, noKeySteps, verdictOf } from "../src/lib/content/studio/kinds/page/magentoCheck";
import { AB_TESTING_HREF, plannedList, plannedOf } from "../src/lib/content/abPlanned";
import { SHOP_COUNTRIES, SHOP_LANGUAGES, planSummary, planViews, toggleAll, viewsOfCountry, viewsOfLanguage } from "../src/lib/content/studio/kinds/page/makeViews";
import { pageDoc } from "../src/lib/content/studio/kinds/page/model";
import { missingPeople } from "../src/lib/content/people";

// Content v7 (10.11.2026) - the studio's bars and loose ends: SARCLA's points 8 and 12.

/* ── point 12: "The hub answered 200." - an answer in plain words ─────── */

test("a kept-alive answer cut on the way says what happened, never the status", () => {
  // keepAlive sends 200 first and spaces while it works: an answer that never came whole is a cut, not "200"
  const cut = answerOf(200, "        ");
  assert.equal(cut.ok, false);
  assert.match(String(cut.error), /cut off on the way/);
  assert.doesNotMatch(String(cut.error), /\b200\b/);
  const half = answerOf(200, '   {"ok":true,"result":{"che');
  assert.match(String(half.error), /cut off/);
});

test("spaces then JSON is read as the JSON", () => {
  const r = answerOf(200, `      {"ok":true,"result":{"check":{"state":"connected"}}}`);
  assert.equal(r.ok, true);
  assert.deepEqual((r.result as { check: unknown }).check, { state: "connected" });
});

test("a JSON error keeps its words; a bare refusal and an HTML page get the status's meaning", () => {
  assert.equal(answerOf(400, JSON.stringify({ ok: false, error: "Pick the page first." })).error, "Pick the page first.");
  assert.match(String(answerOf(403, JSON.stringify({ ok: false })).error), /firewall/);
  assert.match(String(answerOf(502, "<html><body>Bad gateway</body></html>").error), /restarting or busy/);
  assert.match(String(answerOf(401, "").error), /session has ended/);
  for (const s of [0, 200, 400, 401, 403, 404, 413, 429, 500, 502, 503, 504]) assert.doesNotMatch(plainStatus(s), /\d{3}/, `status ${s} says no number`);
});

test("readAnswer never throws: a network failure is a sentence", async () => {
  const r = await readAnswer(Promise.reject(new TypeError("Failed to fetch")));
  assert.equal(r.ok, false);
  assert.match(String(r.error), /could not be reached/);
  const ok = await readAnswer(new Response("  " + JSON.stringify({ ok: true, n: 2 }), { status: 200 }));
  assert.deepEqual(ok, { ok: true, n: 2 });
});

/* ── points 8 and 12: the Magento connection in four plain states ─────── */

test("the check says Connected / Refused / No key / Not reachable - never 'Magento answered 503'", async () => {
  const c = verdictOf("acc", 200, JSON.stringify({ items: [], total_count: 12 }));
  assert.equal(STATE_WORD[c.state], "Connected");
  const bad = verdictOf("acc", 401, JSON.stringify({ message: "The signature is invalid. Verify and try again." }));
  assert.equal(STATE_WORD[bad.state], "Refused");
  const right = verdictOf("prod", 403, JSON.stringify({ message: "The consumer isn't authorized to access %resources." }));
  assert.equal(STATE_WORD[right.state], "Refused");
  assert.match(String(right.detail), /System > Extensions > Integrations/);
  for (const st of [404, 429, 500, 503]) {
    const v = verdictOf("acc", st, "<html><body>down</body></html>");
    assert.equal(STATE_WORD[v.state], "Not reachable");
    assert.doesNotMatch(`${v.line} ${v.detail ?? ""}`, /\d{3}|<html/, `status ${st}`);
  }
  const none = await checkConnection("prod", "none", null);
  assert.equal(STATE_WORD[none.state], "No key");
  const down = await checkConnection("acc", "cms", async () => { throw new Error("ECONNRESET"); });
  assert.equal(STATE_WORD[down.state], "Not reachable");
  assert.doesNotMatch(`${down.line} ${down.detail}`, /ECONNRESET/);
});

test("'No key?' says what an admin does: three steps, the Magento menu path, who to ask", () => {
  const s = noKeySteps("prod");
  assert.equal(s.steps.length, 3);
  assert.match(s.steps[0], /right to save pages - in production's Magento admin/);
  assert.equal(s.path[0], "System > Extensions > Integrations");
  assert.ok(s.path.some((x) => /Content > Elements > Pages, with Save Page/.test(x)));
  assert.match(s.steps[1], /one AWS command/);
  assert.match(s.steps[2], /switch the hub on/);
  assert.match(s.ask, /Claudio or the digital team/);
  assert.match(noKeySteps("acc").steps[0], /ACC's Magento admin/);
  assert.match(noKeySteps(["acc", "prod"]).steps[0], /each shop's Magento admin \(ACC, then production\)/, "said once for both");
  // no internal names in front of the admin
  assert.doesNotMatch(JSON.stringify(s), /MAGENTO_CMS|ECS|task definition|env var/i);
});

/* ── point 10: the A/B test planned in the Page builder, listed in Website > A/B testing ── */

test("a page with its A/B test on is a row: page, versions, the two that run, planned (not running), the to-do", () => {
  const doc = {
    source: "pick", env: "prod", store: "de-CH", path: "/de-CH/privacy", letter: "B",
    changes: [{ op: "text", selector: "h1", text: "B" }],
    versions: [{ letter: "A", changes: [{ op: "text", selector: "h1", text: "A" }], texts: [], from: "", at: "", origin: null }, { letter: "B", changes: [], texts: [], from: "A", at: "", origin: null }],
    abTest: { enabled: true, split: 30, goal: "add-to-cart", clickTarget: "", audience: "new", notes: "", status: "draft", a: "page", b: "B" },
  };
  const row = { pieceId: 7, projectId: 3, project: "Privacy", title: "Page builder · /de-CH/privacy", status: "review", writer: "sarcla", language: "DE", updatedAt: "2026-11-10T08:00:00.000Z", doc };
  const t = plannedOf(row);
  assert.ok(t);
  assert.equal(t.path, "/de-CH/privacy");
  assert.equal(t.url, "https://www.apsoparts.com/de-CH/privacy");
  assert.deepEqual(t.versions, ["A", "B"]);
  assert.equal(t.tested, "Version B");
  assert.equal(t.against, "The page as it is");
  assert.equal(t.plan, "30% see version B · Add to cart decides · New visitors");
  assert.equal(t.state, "planned");
  assert.equal(t.todo, "In review");
  assert.equal(t.href, "/projects/3/pieces/7");
  // switched off: no row
  assert.equal(plannedOf({ ...row, doc: { ...doc, abTest: { ...doc.abTest, enabled: false } } }), null);
  // the newest first
  const list = plannedList([{ ...row, pieceId: 1, updatedAt: "2026-11-01T00:00:00.000Z" }, row]);
  assert.deepEqual(list.map((x) => x.pieceId), [7, 1]);
  assert.equal(AB_TESTING_HREF, "/website/ab-testing#pages");
});

/* ── point 2: several store views in one go ─────────────────────────────── */

test("the plan: a language the page has is copied (no AI), another is translated once and its others copied from it", () => {
  const d = pageDoc({ source: "pick", store: "de-CH", path: "/de-CH/privacy", changes: [{ op: "text", selector: "h1", text: "Datenschutz" }] });
  const steps = planViews(d, ["fr-FR", "de-DE", "fr-CH", "de-CH/eur", "fr-CH/eur", "de-CH", "it-CH"]);
  // the page's own language first: copies of de-CH (its EUR twin from de-CH)
  assert.deepEqual(steps.slice(0, 2), [{ key: "de-CH/eur", how: "copy", from: "de-CH" }, { key: "de-DE", how: "copy", from: "de-CH" }]);
  // French: translated ONCE into fr-CH (the language's own), then fr-CH/eur and fr-FR copied from it
  assert.deepEqual(steps.slice(2, 5), [
    { key: "fr-CH", how: "translate", from: "de-CH" }, { key: "fr-CH/eur", how: "copy", from: "fr-CH" }, { key: "fr-FR", how: "copy", from: "fr-CH" },
  ]);
  assert.deepEqual(steps[5], { key: "it-CH", how: "translate", from: "de-CH" });
  assert.equal(steps.length, 6, "de-CH (the page's own) is left out");
  assert.equal(planSummary(steps), "6 store views: 4 copies (no AI), 2 translations - 2 AI calls, one at a time");
  assert.equal(planSummary([]), "Tick the store views to make.");
});

test("all of a language, all of a country, and ticking a set twice takes it off", () => {
  assert.deepEqual(viewsOfLanguage("nl"), ["nl-NL", "nl-INT"]);
  assert.deepEqual(viewsOfCountry("CH"), ["de-CH", "fr-CH", "it-CH", "en-CH", "de-CH/eur", "fr-CH/eur", "it-CH/eur", "en-CH/eur"]);
  const once = toggleAll(["pl-PL"], viewsOfLanguage("nl"));
  assert.deepEqual(once, ["pl-PL", "nl-NL", "nl-INT"]);
  assert.deepEqual(toggleAll(once, viewsOfLanguage("nl")), ["pl-PL"]);
  assert.ok(SHOP_COUNTRIES.some((c) => c.cc === "INT" && c.name === "International"));
  assert.deepEqual(SHOP_LANGUAGES.map((l) => l.lang).sort(), ["de", "en", "fr", "it", "nl", "pl"]);
});

/* ── point 4: Who does it, prefilled ───────────────────────────────────── */

test("a to-do without its people gets the maker as owner and Claudio as reviewer - only what is missing", () => {
  const base = { kind: "page-refresh", writer: null, reviewer: null, maker: "anna", me: "sarcla", people: ["anna", "sarcla", "claudio"], defaultReviewer: "claudio" };
  assert.deepEqual(missingPeople(base), { writer: "anna", reviewer: "claudio" });
  assert.deepEqual(missingPeople({ ...base, maker: "left.the.company" }), { writer: "sarcla", reviewer: "claudio" }, "a maker no longer here: the one opening it");
  assert.deepEqual(missingPeople({ ...base, writer: "anna" }), { reviewer: "claudio" });
  assert.equal(missingPeople({ ...base, writer: "anna", reviewer: "sarcla" }), null);
  assert.deepEqual(missingPeople({ ...base, kind: "task" }), { writer: "anna" }, "an action has no reviewer");
  assert.deepEqual(missingPeople({ ...base, defaultReviewer: null }), { writer: "anna" });
});
