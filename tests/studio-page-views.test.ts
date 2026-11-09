import assert from "node:assert/strict";
import { test } from "node:test";
import {
  alternatesByStore, copyView, dropView, howToAdd, mainView, pageDoc, shopViews, sourceHash, viewKey, viewOf, viewState, viewsLine, viewsOf, withView,
} from "../src/lib/content/studio/kinds/page/model";

// SARCLA 09.11.2026: "the locales are not all complete in Magento - we select by store view". A page's versions are by
// STORE VIEW now; an older document kept them by LANGUAGE and must open exactly as before.

const INDEX = ["de-CH", "de-CH/eur", "de-DE", "de-AT", "de-INT", "fr-CH", "fr-FR", "fr-INT", "it-CH", "it-IT", "it-INT", "en-INT", "nl-NL", "nl-INT", "pl-PL"];

test("an older document keyed by language opens exactly as before: 'fr' is its store view now", () => {
  const old = {
    source: "new", store: "de-CH", fields: { hero: { title: "Dichtungen" } },
    langs: {
      fr: { store: "fr-CH", fields: { hero: { title: "Joints" } }, from: "abc", at: "2026-11-08T20:00:00.000Z" },
      nl: { fields: { hero: { title: "Afdichtingen" } } }, // an older one without its store: the store view Dutch goes in
      en: { store: "en-INT", fields: { hero: { title: "Seals" } } },
    },
  };
  const d = pageDoc(old);
  assert.deepEqual(Object.keys(d.langs).sort(), ["en-INT", "fr-CH", "nl-NL"]);
  assert.equal(d.langs["fr-CH"].fields.hero.title, "Joints");
  assert.equal(d.langs["fr-CH"].made, "translate", "a version with a source hash was a translation");
  assert.equal(d.langs["nl-NL"].store, "nl-NL");
  assert.equal(d.langs["en-INT"].made, "", "no hash: picked, not made");
  // what the studio showed under "fr" it shows under fr-CH - and still under "fr" (an older caller)
  assert.equal(viewOf(d, "fr-CH").fields.hero.title, "Joints");
  assert.equal(viewOf(d, "fr").fields.hero.title, "Joints");
  assert.equal(viewOf(d, "fr").store, "fr-CH");
  assert.deepEqual(viewsOf(d), ["de-CH", "fr-CH", "en-INT", "nl-NL"]);
});

test("a field the server set under the store view is laid over the older language version", () => {
  const raw = {
    source: "pick", store: "de-CH", path: "/de-CH/ueber-uns",
    langs: {
      fr: { store: "fr-CH", path: "/fr-CH/a-propos", changes: [{ op: "text", selector: "h1", text: "Bonjour" }] },
      "fr-CH": { outline: { env: "prod", path: "/fr-CH/a-propos", title: "A propos", description: "", h1: ["A propos"], lines: [], truncated: false } },
    },
  };
  const d = pageDoc(raw);
  assert.deepEqual(Object.keys(d.langs), ["fr-CH"], "one version, not two");
  assert.equal(d.langs["fr-CH"].path, "/fr-CH/a-propos", "the older version's address kept");
  assert.equal(d.langs["fr-CH"].changes.length, 1, "its changes kept");
  assert.equal(d.langs["fr-CH"].outline?.title, "A propos", "the newer field laid over it");
  // the next save (a diff from the stored document to this one) takes the old key out: a null is skipped on reading
  const saved = pageDoc({ ...raw, langs: { fr: null, "fr-CH": JSON.parse(JSON.stringify(d.langs["fr-CH"])) } });
  assert.deepEqual(Object.keys(saved.langs), ["fr-CH"]);
  // a version under the main store view is the document itself - never kept twice
  assert.deepEqual(Object.keys(pageDoc({ store: "de-CH", langs: { de: { fields: { hero: { title: "x" } } }, "de-CH": { path: "/x" } } }).langs), []);
});

test("a key: a store view, or an older language", () => {
  const d = pageDoc({ source: "new", store: "de-CH", langs: { "fr-FR": { fields: { hero: { title: "Joints" } } } } });
  assert.equal(mainView(d), "de-CH");
  assert.equal(viewKey(d, null), "de-CH");
  assert.equal(viewKey(d, "de"), "de-CH", "the page's own language: its own store view");
  assert.equal(viewKey(d, "fr"), "fr-FR", "a language the page has: its version there");
  assert.equal(viewKey(d, "it"), "it-CH", "a language it does not have: where the language goes");
  assert.equal(viewKey(d, "de-at"), "de-AT");
  assert.equal(viewKey(d, "de-CH/eur"), "de-CH", "a currency view is its store view");
});

test("three store views: a copy of the same language (no AI), a translation of another", () => {
  let d = pageDoc({ source: "new", store: "de-CH", fields: { hero: { title: "Dichtungen" }, seo: { urlKey: "dichtungen" } } });
  assert.deepEqual(howToAdd(d, "de-DE"), { how: "copy", from: "de-CH" });
  assert.deepEqual(howToAdd(d, "fr-CH"), { how: "translate", from: "de-CH" });
  d = copyView(d, "de-DE", "de-CH", "", "2026-11-09T10:00:00.000Z");
  const de = d.langs["de-DE"];
  assert.equal(de.made, "copy");
  assert.equal(de.source, "de-CH");
  assert.equal(viewOf(d, "de-DE").fields.hero.title, "Dichtungen", "the same words");
  assert.equal(viewOf(d, "de-DE").fields.seo.urlKey, "dichtungen", "the same URL key in its store view");
  assert.equal(viewState(d, "de-DE"), "done");
  // its own from then on: a change there leaves de-CH alone
  const v = viewOf(d, "de-DE");
  d = withView(d, "de-DE", { ...v, fields: { ...v.fields, hero: { ...v.fields.hero, title: "Dichtungen für Deutschland" } } });
  assert.equal(d.fields.hero.title, "Dichtungen");
  assert.equal(viewOf(d, "de-DE").fields.hero.title, "Dichtungen für Deutschland");
  // a translation into fr-CH (what the studio keeps after the AI answers)
  const fr = viewOf(d, "fr-CH");
  d = withView(d, "fr-CH", { ...fr, fields: { ...fr.fields, hero: { ...fr.fields.hero, title: "Joints" } } });
  d = { ...d, langs: { ...d.langs, "fr-CH": { ...d.langs["fr-CH"], from: sourceHash(d), source: "de-CH", made: "translate" } } };
  assert.deepEqual(viewsOf(d), ["de-CH", "de-DE", "fr-CH"]);
  // fr-FR: a copy of fr-CH, not another translation
  assert.deepEqual(howToAdd(d, "fr-FR"), { how: "copy", from: "fr-CH" });
  // the main store view changes: what was made from it is out of date, a copy of fr-CH is not
  d = copyView(d, "fr-FR", "fr-CH");
  const changed = { ...d, fields: { ...d.fields, hero: { ...d.fields.hero, title: "Dichtungen neu" } } };
  assert.equal(viewState(changed, "fr-CH"), "stale");
  assert.equal(viewState(changed, "fr-FR"), "done", "made from fr-CH, which did not change");
  assert.equal(viewState(changed, "de-DE"), "stale", "copied from de-CH, which changed");
  assert.deepEqual(viewsOf(dropView(d, "fr-FR")), ["de-CH", "de-DE", "fr-CH"]);
});

test("a page of the shop: a copy takes its own address in that store view", () => {
  let d = pageDoc({ source: "pick", store: "de-CH", path: "/de-CH/ueber-uns", changes: [{ op: "text", selector: "h1", text: "Über uns" }] });
  d = copyView(d, "de-AT", "de-CH", "/de-AT/ueber-uns");
  assert.equal(viewOf(d, "de-AT").path, "/de-AT/ueber-uns");
  assert.equal(viewOf(d, "de-AT").changes.length, 1, "the same changes");
  assert.deepEqual(viewsOf(d), ["de-CH", "de-AT"]);
  // a copy of a new page never takes an address
  const n = copyView(pageDoc({ source: "new", store: "de-CH", fields: { hero: { title: "x" } } }), "de-AT", "de-CH", "/de-AT/x");
  assert.equal(n.langs["de-AT"].path, "");
});

test("the shop's store views by language, and the line that says how far the page is", () => {
  const groups = shopViews(INDEX, "de-CH");
  assert.deepEqual(groups.map((g) => g.lang), ["de", "fr", "it", "en", "nl", "pl"]);
  assert.deepEqual(groups[0].stores, ["de-CH", "de-DE", "de-AT", "de-INT"], "the shop's order, the currency views folded in");
  assert.deepEqual(groups[1].stores, ["fr-CH", "fr-FR", "fr-INT"]);
  assert.equal(groups.reduce((n, g) => n + g.stores.length, 0), 14);
  const d = pageDoc({ source: "new", store: "de-CH", fields: { hero: { title: "Dichtungen" } } });
  assert.equal(viewsLine(d, groups), "Only de-CH so far · 14 store views on the shop");
  const two = copyView(withView(d, "fr-CH", { ...viewOf(d, "fr-CH"), fields: { ...d.fields, hero: { ...d.fields.hero, title: "Joints" } } }), "de-AT", "de-CH");
  assert.equal(viewsLine(two, groups), "de-CH · de-AT · fr-CH · 3 of 14 store views");
  assert.deepEqual(shopViews([], "fr-FR")[0], { lang: "fr", name: "French", stores: ["fr-CH", "fr-FR", "fr-INT"] }, "without the index: the shop's own list");
});

test("the page's hreflang links by the store view their address is in - what the shop says the page is called there", () => {
  // as www.apsoparts.com/de-CH/ueber-uns writes them (09.11.2026): no de-DE, de-AT, de-INT - those are read from the index
  const html = `<link rel="alternate" href="https://www.apsoparts.com/de-CH/ueber-uns" hreflang="de-CH" />
<link rel="alternate" href="https://www.apsoparts.com/fr-CH/a-propos" hreflang="fr-CH" />
<link rel="alternate" href="https://www.apsoparts.com/en-INT/about-us" hreflang="x-default" />
<link rel="alternate" href="https://www.apsoparts.com/fr-INT/a-propos" hreflang="fr" />
<link rel="stylesheet" href="https://www.apsoparts.com/static/x.css" />
<link rel="alternate" href="https://elsewhere.com/nl-NL/x" hreflang="nl-NL" />`;
  assert.deepEqual(alternatesByStore(html), { "de-CH": "/de-CH/ueber-uns", "fr-CH": "/fr-CH/a-propos", "en-INT": "/en-INT/about-us", "fr-INT": "/fr-INT/a-propos" });
});
