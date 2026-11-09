import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SHOP_STORES, baseStore, counterpartIn, emptyPage, langState, langsOf, pageDoc, shopLanguages, storeForLanguage, storesOf, viewOf, withView,
} from "../src/lib/content/studio/kinds/page/model";

// SARCLA 08.11.2026: "On the page builder: DE FR IT EN - we should have all locales: NL, PL". Every language the shop's
// store views have, each with the store view its page goes in - the preview, the outline and the links follow it.

// the store views as APSOconvert's page index reads them from the shop's sitemaps (currencies too)
const INDEX = ["de-CH", "de-CH/eur", "de-DE", "de-AT", "de-INT", "fr-CH", "fr-FR", "fr-INT", "it-CH", "it-IT", "it-INT", "en-INT", "nl-NL", "nl-INT", "pl-PL"];

test("a store view as the shop writes it", () => {
  assert.equal(baseStore("de-CH/eur"), "de-CH");
  assert.equal(baseStore("nl-nl"), "nl-NL");
  assert.equal(baseStore("en-INT"), "en-INT");
  assert.equal(baseStore("checkout"), null);
  assert.deepEqual(storesOf("de", INDEX), ["de-AT", "de-CH", "de-DE", "de-INT"], "the currency views are the same store view");
  assert.deepEqual(storesOf("pl", INDEX), ["pl-PL"]);
});

test("each language's store view: the page's own country first, English the international one", () => {
  assert.equal(storeForLanguage("fr", "de-CH", INDEX), "fr-CH");
  assert.equal(storeForLanguage("it", "de-CH", INDEX), "it-CH");
  assert.equal(storeForLanguage("en", "de-CH", INDEX), "en-INT", "English is the shop's x-default");
  assert.equal(storeForLanguage("nl", "de-CH", INDEX), "nl-NL", "Dutch has no Swiss store view: the Dutch one");
  assert.equal(storeForLanguage("pl", "de-CH", INDEX), "pl-PL");
  assert.equal(storeForLanguage("de", "fr-FR", INDEX), "de-CH", "German from a French page: there is no de-FR");
  assert.equal(storeForLanguage("it", "fr-FR", INDEX), "it-CH");
  assert.equal(storeForLanguage("fr", "de-DE", INDEX), "fr-CH", "no fr-DE: French's own store view");
  assert.equal(storeForLanguage("de", "de-AT", INDEX), "de-AT");
  assert.equal(storeForLanguage("nl", "de-CH", ["de-CH", "nl-INT"]), "nl-INT", "only what the shop has");
  // without the index (empty) the shop's own list stands in
  assert.equal(storeForLanguage("nl", "de-CH", []), "nl-NL");
  assert.equal(storeForLanguage("pl"), "pl-PL");
  assert.equal(storeForLanguage(null), "de-CH");
  assert.ok(SHOP_STORES.includes("nl-NL") && SHOP_STORES.includes("pl-PL"));
});

test("every language the shop publishes in, the page's own first", () => {
  const de = shopLanguages(INDEX, "de-CH");
  assert.deepEqual(de.map((x) => x.lang), ["de", "fr", "it", "en", "nl", "pl"]);
  assert.deepEqual(de.map((x) => x.store), ["de-CH", "fr-CH", "it-CH", "en-INT", "nl-NL", "pl-PL"]);
  assert.deepEqual(de[0].stores, ["de-CH", "de-AT", "de-DE", "de-INT"], "the page's store view first, then the others of its language");
  assert.equal(de[4].name, "Dutch");
  const nl = shopLanguages(INDEX, "nl-NL");
  assert.equal(nl[0].lang, "nl", "a Dutch page: Dutch first");
  assert.equal(nl[0].store, "nl-NL");
  assert.deepEqual(shopLanguages([], "de-CH").map((x) => x.lang), ["de", "fr", "it", "en", "nl", "pl"], "the index empty: the shop's own list");
  assert.deepEqual(shopLanguages(["de-CH", "fr-CH"], "es-ES").map((x) => x.lang), ["es", "de", "fr"], "the page's own language is always there");
});

test("a page's languages: its own, then those made - a language not made yet is offered, not listed", () => {
  const base = pageDoc({ source: "new", store: "de-CH", fields: { hero: { title: "Dichtungen" } } });
  assert.deepEqual(langsOf(base), ["de"]);
  const nl = viewOf(base, "nl");
  assert.equal(nl.store, "nl-NL", "a Dutch page goes in the Dutch store view");
  const made = withView(base, "nl", { ...nl, fields: { ...nl.fields, hero: { ...nl.fields.hero, title: "Afdichtingen" } } });
  assert.equal(made.langs["nl-NL"].store, "nl-NL", "kept under its store view");
  assert.deepEqual(langsOf(made), ["de", "nl"]);
  const pl = viewOf(made, "pl");
  const both = withView(made, "pl", { ...pl, fields: { ...pl.fields, hero: { ...pl.fields.hero, title: "Uszczelnienia" } } });
  assert.deepEqual(langsOf(both), ["de", "nl", "pl"]);
  assert.equal(langState(both, "pl"), "done");
  // an existing page: a language whose page is picked counts, even before its changes
  const shop = pageDoc({ source: "pick", store: "de-CH", path: "/de-CH/x.html", langs: { fr: { path: "/fr-CH/x.html", store: "fr-CH" } } });
  assert.deepEqual(langsOf(shop), ["de", "fr"]);
  assert.deepEqual(langsOf(emptyPage("PL")), ["pl"]);
});

test("the same page in another language: the store view it goes in first", () => {
  const html = `<link rel="alternate" hreflang="nl-int" href="https://www.apsoparts.com/nl-INT/afdichting.html">
<link rel="alternate" hreflang="nl-nl" href="https://www.apsoparts.com/nl-NL/afdichting.html">
<link rel="alternate" hreflang="pl-pl" href="https://www.apsoparts.com/pl-PL/uszczelnienia.html">`;
  assert.equal(counterpartIn(html, "nl", "de-CH"), "/nl-INT/afdichting.html", "without a wish, the shop's order");
  assert.equal(counterpartIn(html, "nl", "de-CH", "nl-NL"), "/nl-NL/afdichting.html", "the store view the studio uses for Dutch");
  assert.equal(counterpartIn(html, "pl", "de-CH", "pl-PL"), "/pl-PL/uszczelnienia.html");
});
