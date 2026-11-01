import assert from "node:assert/strict";
import { test } from "node:test";
import {
  foundRule, gapsOf, isPrivate, monthsOfDays, periodOf, sampleIn, settledOf, storeLabel, storesIn, termsOf, typedIn, typingSample, type LogLine,
} from "../src/lib/products/siteSearch";

// SARCLA 01.11.2026 on Products Reports: "we should really create subtabs" - his pick "Search": what customers search for, the
// searches that found nothing and how often, by language and store, month by month, the terms - counted honestly: the bar
// searches as one types.

const at = (s: number) => new Date(Date.UTC(2026, 9, 31, 10, 0, s)).toISOString();
const L = (text: string, s: number, hits: number | null, locale = "de-CH", tier = "lexical"): LogLine => ({ text, norm: text.toLowerCase(), locale, tier, hits, at: at(s) });

test("the store in words: language and country, the international store, anything else as it is", () => {
  assert.equal(storeLabel("de-CH"), "German · Switzerland");
  assert.equal(storeLabel("en-INT"), "English · International");
  assert.equal(storeLabel("it-IT"), "Italian · Italy");
  assert.equal(storeLabel("xx"), "xx");
  assert.equal(periodOf("30"), "30");
  assert.equal(periodOf("365"), "all");
  assert.equal(periodOf(null), "all");
});

test("a password or an e-mail typed into the bar is never shown - a product code is", () => {
  for (const t of ["max.muster@firma.ch", "Passwort123", "mot de passe", "Xy7#kLm2pQ"]) assert.ok(isPrivate(t), t);
  for (const t of ["NBR70-1234", "o-ring 20x2", "PTFE", "0111104030", "pom c rund 30", "DIN 3771", "Passfeder 8x7", "passscheibe"]) assert.ok(!isPrivate(t), t);
});

test("settled, as the gateway's report: a keystroke the next text extends within 20 s is not a search; one letter, our test phrases neither", () => {
  const lines = [
    L("h", 0, 0), L("hal", 1, 0), L("haltegri", 3, 0), L("haltegriff", 4, 12),    // typed: one search, "haltegriff"
    L("pom", 10, 30, "fr-CH"),                                                       // another store: its own
    L("pomc", 50, 0),                                                                 // 46 s after "haltegriff": a search
    L("can i ask you a question please?", 60, 0, "en-CH", "assistant"),
  ];
  assert.deepEqual(settledOf(lines).map((l) => l.text), ["haltegriff", "pomc", "pom"]);
});

test("found something, as the gateway's report: a result shown; a view that never counts its rows; a special article; the AI never", () => {
  const lines = [
    ...Array.from({ length: 50 }, (_, i) => L(`o-ring ${i} x 2`, i, 0, "de-CH", "dimension")),
    L("belt 10", 100, 0, "de-CH", "belt-dim"),
    L("3123456789", 101, 0, "de-CH", "sku"),
    L("10", 102, 0, "de-CH", "figure"),
    L("help me", 103, 0, "de-CH", "assistant"),
    L("ptfe", 104, 9),
    L("xyz", 105, null),
  ];
  const ok = foundRule(lines);
  assert.deepEqual(lines.slice(50).map(ok), [true, true, true, false, true, false]);
  assert.equal(ok(lines[0]), true);
});

test("the last searches one by one: found nothing, still being typed a little slower, and what really found nothing", () => {
  const lines = [
    L("haltegri", 0, 0), L("haltegriff", 30, 4),             // 30 s later: settled twice, the first still being typed
    L("distanzscheibe", 100, 0),                              // a word not learned
    L("12345678", 200, 0, "it-IT"),                           // a number we do not know
    L("12345678", 400, 0, "it-IT"),
    L("Passwort123", 500, 0),                                 // never shown
    L("ptfe platte", 600, 7),
  ];
  const s = typingSample(lines)!;
  const all = sampleIn(s, []);
  assert.equal(all.settled, 7);
  assert.equal(all.nothing, 5);
  assert.equal(all.typing, 1);
  assert.equal(all.kinds.number, 2);
  assert.equal(all.kinds.words, 1);
  assert.equal(all.kinds.code, 1);                          // the password: counted by its kind, never shown
  assert.equal(s.hidden, 1);
  assert.deepEqual(s.examples.number, [{ text: "12345678", n: 2, stores: ["it-IT"] }]);
  assert.ok(!JSON.stringify(s.examples).includes("Passwort"));
  // one store
  const it = sampleIn(s, ["it-IT"]);
  assert.deepEqual([it.settled, it.nothing, it.typing, it.stores], [2, 2, 0, 1]);
  assert.equal(typingSample([]), null);
});

test("the report's terms and gaps: what each found, where it was typed, the private ones counted and left out", () => {
  const t = termsOf([
    { query: "pom", searches: 741, success_pct: 96, ai_fallbacks: 0, avg_results: 40, locales: "de-CH fr-CH" },
    { query: "gas spring", searches: 37, success_pct: 0, ai_fallbacks: 30, avg_results: 0, locales: "en-INT" },
    { query: "a@b.ch", searches: 3, success_pct: 0, locales: "de-CH" },
  ]);
  assert.equal(t.hidden, 1);
  assert.deepEqual(t.rows.map((r) => [r.term, r.found, r.nothing, r.kind]), [["pom", 711, 30, "words"], ["gas spring", 0, 37, "words"]]);
  assert.deepEqual(t.rows[0].stores, ["de-CH", "fr-CH"]);
  assert.deepEqual(typedIn(t.rows, ["en-INT"]).map((r) => r.term), ["gas spring"]);
  assert.equal(typedIn(t.rows, []).length, 2);
  const g = gapsOf([
    { query_norm: "ich brauche einen oring", count: 4, last_seen: "2026-10-09T08:00:00Z", locales: ["de-DE", "it-IT"], reason: "assistant_fallthrough", top_query_raw: "ich brauche   einen Oring" },
    { query_norm: "help", count: 1, last_seen: "2026-10-12T08:00:00Z", locale: "en-CH", reason: "ai_failed" },
    { query_norm: "kennwort", count: 2, last_seen: "2026-10-12T08:00:00Z", locales: ["de-CH"] },
  ]);
  assert.equal(g.hidden, 1);
  assert.deepEqual(g.rows.map((r) => [r.term, r.last, r.stores.join(" "), r.failed]), [["ich brauche einen Oring", "2026-10-09", "de-DE it-IT", false], ["help", "2026-10-12", "en-CH", true]]);
});

test("month by month from the report's days, a month held in part with its first and last day; the stores chosen added up", () => {
  const m = monthsOfDays([
    { day: "2026-07-05", searches: 10, ok: 8 }, { day: "2026-07-31", searches: 20, ok: 15 },
    { day: "2026-08-01T00:00:00.000Z", searches: 5, ok: 5 },
  ]);
  assert.deepEqual(m, [
    { month: "2026-07", first: "2026-07-05", last: "2026-07-31", days: 2, searches: 30, ok: 23 },
    { month: "2026-08", first: "2026-08-01", last: "2026-08-01", days: 1, searches: 5, ok: 5 },
  ]);
  const rows = [{ locale: "de-CH", searches: 100, ok: 80 }, { locale: "fr-CH", searches: 50, ok: 30 }];
  assert.deepEqual(storesIn(rows, []), { searches: 150, ok: 110 });
  assert.deepEqual(storesIn(rows, ["fr-CH"]), { searches: 50, ok: 30 });
});
