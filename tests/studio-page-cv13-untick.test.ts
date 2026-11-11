import assert from "node:assert/strict";
import { test } from "node:test";
import { STORE_VIEWS } from "../src/lib/content/studio/kinds/page/storeViews";
import { emptyPage, pageDoc, splitStore, storesInLanguage, storesOfView, tickStore, versionOfStore, viewOf, viewsOf, withView, type PageDoc } from "../src/lib/content/studio/kinds/page/model";
import { viewsOfCountry, viewsOfLanguage } from "../src/lib/content/studio/kinds/page/makeViews";
import { MAIN_STAYS, RUN_WAITS, dropQuestion, tickLock, untickStores } from "../src/lib/content/studio/kinds/page/untick";

// Content v13 (SARCLA 11.11.2026: "store view also broken: once it's selected I can't deselect it completely - the check
// is still there, can't take it out"). A version's own store view (fr-CH for the French page) was held ticked; now every
// store view comes off but the page's own, and a language's last one takes its page with it.

const titled = (d: PageDoc, title: string) => ({ ...d.fields, hero: { ...d.fields.hero, title } });
/** An English new page (en-INT, all 9 English store views) with a French page (fr-CH, all 4 French ones). */
function page(): PageDoc {
  const e = emptyPage("EN");
  const d = pageDoc({ ...e, source: "new", fields: titled(e, "Seals") });
  return pageDoc(JSON.parse(JSON.stringify(withView(d, "fr-CH", { ...viewOf(d, "fr-CH"), fields: titled(d, "Joints") }))));
}
/** "21 of 26 get the page" - the panel's count. */
const covered = (d: PageDoc) => STORE_VIEWS.filter((v) => versionOfStore(d, v.key)).length;
const kept = (d: PageDoc) => pageDoc(JSON.parse(JSON.stringify(d)));

test("the page as the panel starts: English to 9, French to 4", () => {
  const d = page();
  assert.deepEqual(viewsOf(d), ["en-INT", "fr-CH"]);
  assert.equal(storesOfView(d, "en-INT").length, 9);
  assert.deepEqual([...storesOfView(d, "fr-CH")].sort(), [...storesInLanguage("fr")].sort());
  assert.equal(covered(d), 13);
});

test("untick one: a store view comes off its language's page - also the page's own store view of that language", () => {
  const d = page();
  let r = untickStores(d, ["en-NL"]);
  assert.deepEqual(r.off, ["en-NL"]);
  assert.equal(versionOfStore(r.doc, "en-NL"), null);
  assert.equal(storesOfView(r.doc, "en-INT").length, 8);
  assert.equal(covered(r.doc), 12, "the count follows at once");
  assert.equal(versionOfStore(kept(r.doc), "en-NL"), null, "saved and read back: still off");
  // fr-CH: the French page's own store view, held ticked until Content v13 - it comes off, the French page stays
  r = untickStores(d, ["fr-CH"]);
  assert.deepEqual(r.dropped, []);
  assert.equal(r.moved["fr-CH"], "fr-CH/eur", "shown in its currency twin");
  assert.equal(versionOfStore(r.doc, "fr-CH"), null);
  assert.deepEqual(viewsOf(r.doc), ["en-INT", "fr-CH/eur"]);
  assert.equal(viewOf(r.doc, "fr-CH/eur").fields.hero.title, "Joints", "the same words - nothing lost");
  assert.equal(versionOfStore(r.doc, "fr-FR"), "fr-CH/eur");
  assert.equal(storesOfView(r.doc, "fr-CH/eur").length, 3);
  const back = kept(r.doc);
  assert.equal(versionOfStore(back, "fr-CH"), null, "saved and read back: still off");
  assert.equal(storesOfView(back, "fr-CH/eur").length, 3);
  // ticked again, it goes back to the French page
  assert.equal(versionOfStore(tickStore(back, "fr-CH", true), "fr-CH"), "fr-CH/eur");
});

test("untick a language: all its store views come off - the French page goes; English keeps only the page's own", () => {
  const d = page();
  const fr = untickStores(d, viewsOfLanguage("fr"));
  assert.deepEqual(fr.dropped, ["fr-CH"]);
  assert.deepEqual(viewsOf(fr.doc), ["en-INT"]);
  for (const k of storesInLanguage("fr")) assert.equal(versionOfStore(fr.doc, k), null, `${k} is off`);
  assert.equal(covered(fr.doc), 9);
  assert.equal(dropQuestion(d, fr.dropped), "Remove the French page? Its words are lost.");
  assert.deepEqual(viewsOf(kept(fr.doc)), ["en-INT"], "saved and read back: no French page");
  // English - the page's own language: everything but the store view it is written in
  const en = untickStores(d, viewsOfLanguage("en"));
  assert.deepEqual(en.refused, ["en-INT"]);
  assert.equal(en.off.length, 8);
  assert.deepEqual(storesOfView(en.doc, "en-INT"), ["en-INT"]);
  assert.equal(storesOfView(en.doc, "fr-CH").length, 4, "the French page untouched");
});

test("untick a country: its store views come off every language's page - a page shown there moves to another", () => {
  const d = page();
  const r = untickStores(d, viewsOfCountry("CH"));
  assert.deepEqual([...r.off].sort(), ["en-CH", "en-CH/eur", "fr-CH", "fr-CH/eur"]);
  for (const k of viewsOfCountry("CH")) assert.equal(versionOfStore(r.doc, k), null, `${k} is off`);
  const to = r.moved["fr-CH"];
  assert.ok(["fr-FR", "fr-INT"].includes(to), `the French page is shown in ${to}`);
  assert.deepEqual([...storesOfView(r.doc, to)].sort(), ["fr-FR", "fr-INT"]);
  assert.equal(viewOf(r.doc, to).fields.hero.title, "Joints");
  assert.equal(storesOfView(r.doc, "en-INT").length, 7);
  assert.equal(covered(r.doc), 9);
});

test("the page's own store view is refused - and says why; the rest is free, also while a translation runs", () => {
  const d = page();
  const r = untickStores(d, ["en-INT"]);
  assert.equal(r.doc, d, "nothing changed");
  assert.deepEqual(r.refused, ["en-INT"]);
  assert.equal(tickLock(d, "en-INT"), MAIN_STAYS);
  assert.equal(MAIN_STAYS, "The page is written here - another store view first");
  assert.equal(tickLock(d, "fr-CH"), null, "the French page's own store view can be unticked");
  assert.equal(tickLock(d, "en-NL", true), null, "a language the page has: free while a run goes");
  assert.equal(tickLock(d, "de-DE", true), RUN_WAITS, "a language the page has not yet waits for the run");
  assert.equal(tickLock(d, "de-DE", false), null);
  // a store view that gets no page: nothing to take off
  assert.equal(untickStores(d, ["de-DE"]).doc, d);
});

test("a language's last store view: taking it off removes that language's page (asked first)", () => {
  let d = page();
  d = untickStores(d, ["fr-CH/eur", "fr-FR", "fr-INT"]).doc;
  assert.deepEqual(storesOfView(d, "fr-CH"), ["fr-CH"]);
  const r = untickStores(d, ["fr-CH"]);
  assert.deepEqual(r.dropped, ["fr-CH"]);
  assert.deepEqual(viewsOf(r.doc), ["en-INT"]);
  assert.equal(versionOfStore(r.doc, "fr-CH"), null);
  assert.equal(dropQuestion(d, r.dropped), "Remove the French page? Its words are lost.");
  // a store view's own words (split off) unticked: gone - it does not fall back into the English page
  const s = splitStore(page(), "en-CH", "", "2026-11-11T10:00:00Z");
  assert.deepEqual(storesOfView(s, "en-CH"), ["en-CH"]);
  const o = untickStores(s, ["en-CH"]);
  assert.deepEqual(o.dropped, ["en-CH"]);
  assert.equal(versionOfStore(o.doc, "en-CH"), null);
  assert.equal(dropQuestion(s, o.dropped), "Remove EN-CH's own words? They are lost.");
  assert.equal(dropQuestion(s, ["en-CH", "fr-CH"]), "Remove EN-CH's own words and the French page? Their words are lost.");
});
