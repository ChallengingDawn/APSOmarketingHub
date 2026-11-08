import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyPage, fillTexts, finalChanges, fromAi, languageOfStore, mergeTexts, newPagePaste, pageDoc, pageText, pathInfo, placeholderId,
  placeholdersOf, storeForLanguage, styleBlock, textsFromAi, unwritten, urlKeyOf, SHELL_SELECTOR, type AiChange,
} from "../src/lib/content/studio/kinds/page/model";

// The page studio's document (08.11.2026): a shop page, the changes on it, the texts Content writes, the test, Magento.

const ph = (ask: string, key?: string) => `<span class="apx-text"${key ? ` data-key="${key}"` : ""}>[Text from Content: ${ask}]</span>`;

test("an empty page, and any stored document read as one (an older first shape too)", () => {
  const e = emptyPage("FR");
  assert.equal(e.store, "fr-CH");
  assert.equal(e.source, "pick");
  const old = pageDoc({ v: 1, notes: "kept" }, "IT");
  assert.equal(old.notes, "kept");
  assert.equal(old.store, "it-CH");
  assert.deepEqual(old.changes, []);
  const odd = pageDoc({ source: "nope", env: "x", abTest: { split: 300, goal: "?", audience: "customers" }, texts: [{ id: "t1", ask: "a", text: "b" }, { ask: "no id" }] });
  assert.equal(odd.source, "pick");
  assert.equal(odd.env, "prod");
  assert.equal(odd.abTest.split, 95);
  assert.equal(odd.abTest.goal, "add-to-cart");
  assert.equal(odd.abTest.audience, "customers");
  assert.equal(odd.texts.length, 1);
});

test("store views and languages", () => {
  assert.equal(storeForLanguage("de"), "de-CH");
  assert.equal(storeForLanguage(null), "de-CH");
  assert.equal(languageOfStore("it-IT"), "Italian");
  assert.equal(languageOfStore("de-CH/eur"), "German");
  assert.equal(languageOfStore(""), null);
});

test("an address typed is a page, or not", () => {
  assert.deepEqual(pathInfo("/de-CH/dichtungstechnik.html"), { store: "de-CH", kind: "category" });
  assert.equal(pathInfo("/de-CH/12202510-apsovibr.html")?.kind, "product");
  assert.equal(pathInfo("/de-CH/checkout/cart"), null, "a shop function is not a page to change");
  assert.equal(pathInfo("https://www.apsoparts.com/de-CH/"), null);
  assert.equal(pathInfo("/de-CH/x.html?y=1"), null);
});

test("a new page's address key", () => {
  assert.equal(urlKeyOf("Dichtungen für die Lebensmittelindustrie!"), "dichtungen-fur-die-lebensmittelindustrie");
  assert.equal(urlKeyOf("Straße & Öl"), "strasse-ol");
});

test("placeholders: found once each, with a short id; written texts take their place", () => {
  const d = pageDoc({
    source: "new", newPage: { body: `<h1>H</h1><p>${ph("Why this seal", "t1")}</p>` },
    changes: [{ op: "insert", selector: "h1", where: "after", html: `<p>${ph("Delivery in two lines")}</p>${ph("Why this seal", "t1")}` }],
  });
  const all = placeholdersOf(d);
  assert.equal(all.length, 2);
  assert.deepEqual(all.map((p) => p.where), ["the page's body", "change 1"]);
  assert.ok(all.every((p) => /^t[0-9a-z]+$/.test(p.id) && p.id.length < 12), "short enough for a document path");
  assert.equal(placeholderId("t1", "Why  this seal "), placeholderId("t1", "Why this seal"));
  assert.notEqual(placeholderId("t1", "Why this seal"), placeholderId("t1", "Another ask"), "same key, other words = another text");
  const texts = [{ id: all[0].id, ask: all[0].ask, text: "Because <it> lasts.\nTwice." }];
  const filled = fillTexts(d.newPage.body, texts);
  assert.equal(filled, "<h1>H</h1><p>Because &lt;it&gt; lasts.<br>Twice.</p>");
  assert.equal(unwritten({ ...d, texts }).length, 1);
});

test("the final list: a new page's body first, texts filled, unsafe changes left out and said", () => {
  const d = pageDoc({
    source: "new", newPage: { body: `<div class="apx-page">${ph("Intro", "t1")}</div>` },
    changes: [{ op: "css", css: ".apx-page{padding:0}" }, { op: "insert", selector: "h1", where: "after", html: "<script>x()</script>" }],
  });
  const id = placeholdersOf(d)[0].id;
  const r = finalChanges({ ...d, texts: [{ id, ask: "Intro", text: "Hello" }] });
  assert.equal(r.changes.length, 2);
  assert.deepEqual(r.changes[0], { op: "html", selector: SHELL_SELECTOR, html: `<div class="apx-page">Hello</div>`, note: "The new page" });
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /script/);
});

test("the AI's flat changes become a valid list; its texts land on the placeholders it left", () => {
  const blank: AiChange = { op: "", selector: "", where: "", html: "", css: "", text: "", name: "", value: "", all: false, note: "" };
  const r = fromAi([
    { ...blank, op: "css", css: ".apx-a{color:#274e64}", selector: "ignored" },
    { ...blank, op: "insert", selector: ".product-info-main", where: "", html: `<div class="apx-a">${ph("Why it fits", "t1")}</div>`, note: "Adds a why block" },
    { ...blank, op: "attr", selector: "a.x", name: "onclick", value: "y" },
  ]);
  assert.equal(r.changes.length, 2);
  assert.deepEqual(r.changes[0], { op: "css", css: ".apx-a{color:#274e64}" });
  assert.equal((r.changes[1] as { where: string }).where, "after");
  assert.equal(r.problems.length, 1);
  const d = pageDoc({ changes: r.changes });
  const texts = textsFromAi(placeholdersOf(d), [{ key: "t1", text: "Fits DIN 3771." }, { key: "t9", text: "nowhere" }]);
  assert.equal(texts.length, 1);
  assert.equal(texts[0].ask, "Why it fits");
  const merged = mergeTexts([{ id: texts[0].id, ask: "Why it fits", text: "old" }, { id: "tother", ask: "x", text: "kept" }], texts);
  assert.deepEqual(merged.map((t) => t.text), ["kept", "Fits DIN 3771."]);
});

test("the version's text and the paste for a new page", () => {
  const d = pageDoc({
    source: "new", store: "de-CH",
    newPage: { title: "O-Ringe für Wasser", urlKey: "", metaTitle: "", metaDescription: "Für Trinkwasser.", body: "<h1>O-Ringe</h1>" },
    changes: [{ op: "css", css: "h1{color:#274e64}" }],
  });
  assert.match(pageText(d), /^New page: O-Ringe für Wasser/);
  const blocks = newPagePaste(d);
  assert.equal(blocks.length, 2);
  assert.match(blocks[0].code, /URL Key: o-ringe-fur-wasser/);
  assert.match(blocks[0].code, /Meta Title: O-Ringe für Wasser/);
  assert.equal(blocks[1].code, "<style>\nh1{color:#274e64}\n</style>\n<h1>O-Ringe</h1>");
  assert.equal(styleBlock([]), "");
});
