import assert from "node:assert/strict";
import { test } from "node:test";
import { aiParse, aiSubs, aiSystem, aiText } from "../src/lib/boDistribution/aiClassify";

test("bo ai: only the new text goes out - no HTML, no quoted history, no addresses or phone numbers", () => {
  const html = "<p>Guten Tag</p><p>bitte senden Sie mir ein Angebot für 200 O-Ringe 20x2 NBR, Tel. +41 44 306 61 11, max@kunde.ch</p>"
    + "<p>Von: Verkauf &lt;sales@apsoparts.com&gt;</p><p>Gesendet: Montag</p><p>Alte Nachricht mit vielen Details</p>";
  const t = aiText("AW: Anfrage", html);
  assert.match(t, /^Subject: AW: Anfrage/);
  assert.match(t, /200 O-Ringe 20x2 NBR/);
  assert.doesNotMatch(t, /Alte Nachricht|<p>|max@kunde|\+41 44/);
  assert.match(t, /\[phone\]/);
  assert.match(t, /\[e-mail\]/);
  assert.ok(aiText("x", "a".repeat(5000)).length < 1300);
});

test("bo ai: the answer is checked against the lists", () => {
  const sub = aiSubs("Product Price")[0];
  assert.deepEqual(aiParse(`{"category":"Product Price","sub":"${sub}","why":"asks for a quote"}`), { category: "Product Price", sub, why: "asks for a quote" });
  assert.deepEqual(aiParse('Sure: {"category":"Product Price","sub":"made up","why":""}'), { category: "Product Price", sub: null, why: "" });
  assert.deepEqual(aiParse('{"category":"Others","sub":"","why":"newsletter"}'), { category: null, sub: null, why: "newsletter" });
  assert.equal(aiParse("no json"), null);
  assert.match(aiSystem(), /"Others"/);
});
