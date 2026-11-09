import assert from "node:assert/strict";
import { test } from "node:test";
import {
  STORE_VIEWS, codesInSwitcher, countryGroups, countryStore, currencyOf, storeCodeOf, storeKey, storeViewByCode, viewName, viewShort,
} from "../src/lib/content/studio/kinds/page/storeViews";
import {
  SHOP_STORES, abLine, addVersion, pathIn, convertVersionsOf, dropVersion, howToAdd, lettersOf, mainView, opensMarkerPage, openVersion, pageDoc, pageText,
  shopCountries, sourceHash, versionList, viewOf, viewsOf, withView, type PageDoc,
} from "../src/lib/content/studio/kinds/page/model";
import { CHECK_PATH, checkConnection, connectionLine, verdictOf } from "../src/lib/content/studio/kinds/page/magentoCheck";
import { appBriefOf } from "../src/lib/content/studio/kinds/page/appBrief";
import { pieceKindFromConvert } from "../src/lib/content/convertPiece";
import { magentoRequest, planPage, seoFieldsOf, writePage, type Backups, type FetchLike, type StoreRef, type Want } from "../src/lib/convert/cmsPage";

// Content v6 (SARCLA 09.11.2026, his points 1, 3, 4, 5, 11): every store view of the shop with its currency, a page of the
// shop's search engine fields, the A/B test in one line, versions A / B / C of the same page, and the Magento connection
// in plain words - every rule against fakes, never a real call to Magento.

/* ── point 1: every store view, as the shop's switcher has them ───────── */

test("the shop's 25 store views, each with its Magento store code - the Swiss shop in CHF AND in EUR", () => {
  assert.equal(STORE_VIEWS.length, 25);
  assert.equal(new Set(STORE_VIEWS.map((v) => v.key)).size, 25, "each key once");
  assert.equal(storeCodeOf("de-CH"), "switzerland_chf_de");
  assert.equal(storeCodeOf("de-CH/eur"), "switzerland_eur_de", "read on www.apsoparts.com/de-CH/eur/ (storeId 1, EUR)");
  assert.equal(storeCodeOf("en-CH"), "switzerland_chf_en");
  assert.equal(storeCodeOf("it-CH/eur"), "switzerland_eur_it");
  assert.equal(storeCodeOf("nl-INT"), "international_eur_nl");
  assert.equal(storeCodeOf("en-PL"), "poland_eur_en");
  assert.equal(storeCodeOf("es-ES"), null, "not a store view of the shop");
  assert.equal(storeViewByCode("international_eur_en")?.key, "en-INT");
  assert.equal(viewName("de-CH/eur"), "Switzerland · German · EUR");
  assert.equal(viewName("de-CH"), "Switzerland · German · CHF");
  assert.equal(viewName("en-INT"), "International · English · EUR");
  assert.equal(viewShort("de-CH/eur"), "DE-CH · EUR");
  assert.equal(viewShort("fr-FR"), "FR-FR");
  assert.equal(currencyOf("pl-PL"), "EUR", "the Polish shop sells in EUR");
  assert.equal(storeKey("de-CH/EUR"), "de-CH/eur");
  assert.equal(storeKey("de-ch/chf"), "de-CH");
  assert.equal(countryStore("de-CH/eur"), "de-CH");
  for (const k of ["en-INT", "de-INT", "fr-INT", "it-INT", "nl-INT", "en-CH/eur", "fr-CH/eur", "en-DE", "en-AT", "en-FR", "en-IT", "en-NL"]) assert.ok(SHOP_STORES.includes(k), k);
});

test("grouped as Magento has them: a country in a currency, each with its languages", () => {
  const g = countryGroups();
  assert.deepEqual(g.map((x) => x.label), [
    "Switzerland · CHF", "Switzerland · EUR", "Germany · EUR", "Austria · EUR", "France · EUR", "Italy · EUR", "Netherlands · EUR", "International · EUR", "Poland · EUR",
  ]);
  assert.deepEqual(g[1].stores, ["de-CH/eur", "fr-CH/eur", "it-CH/eur", "en-CH/eur"]);
  assert.deepEqual(g[7].stores, ["en-INT", "de-INT", "fr-INT", "it-INT", "nl-INT"]);
  // a store view the page index holds that the list lacks: under "Other", never lost
  const more = countryGroups(["es-ES", "de-CH"]);
  assert.deepEqual(more[more.length - 1], { key: "other", country: "Other", currency: null, label: "Other store views", stores: ["es-ES"] });
  const d = pageDoc({ source: "pick", store: "de-CH", path: "/de-CH/ueber-uns" });
  assert.equal(shopCountries([], d).reduce((n, x) => n + x.stores.length, 0), 25);
});

test("the shop's own switcher, read: the store codes its options name", () => {
  // as www.apsoparts.com/de-CH/eur/ writes its country and language switchers (GET, 09.11.2026), shortened
  const html = `<div class="country switcher-country"><strong class="view-switzerland_eur_de"><span>Schweiz</span></strong>
<ul class="dropdown switcher-dropdown"><li class="view-germany_eur_de switcher-option"><a href="#">Deutschland</a></li>
<li class="view-international_eur_de switcher-option"><a href="#">International</a></li></ul></div>
<div class="language switcher-language"><ul><li class="view-switzerland_eur_en switcher-option"><a href="#">English</a></li></ul></div>`;
  const codes = codesInSwitcher(html);
  assert.deepEqual(codes, ["switzerland_eur_de", "germany_eur_de", "international_eur_de", "switzerland_eur_en"]);
  assert.ok(codes.every((c) => storeViewByCode(c)), "every code the shop names is in the hub's list");
});

test("an older document opens as before; a version kept under de-CH whose page is the EUR shop's moves to de-CH/eur", () => {
  const d = pageDoc({
    source: "pick", store: "de-CH", path: "/de-CH/ueber-uns",
    langs: {
      fr: { store: "fr-CH", path: "/fr-CH/a-propos", changes: [{ op: "text", selector: "h1", text: "Bonjour" }] },
      "de-CH": { path: "/de-CH/eur/ueber-uns", changes: [{ op: "text", selector: "h1", text: "Hallo EUR" }] },
    },
  });
  assert.equal(viewOf(d, "fr").store, "fr-CH", "a language key still works");
  assert.deepEqual(Object.keys(d.langs).sort(), ["de-CH/eur", "fr-CH"]);
  assert.equal(d.langs["de-CH/eur"].store, "de-CH/eur");
  assert.equal(viewOf(d, "de-CH/eur").path, "/de-CH/eur/ueber-uns");
  // a page picked on the Swiss EUR shop is that store view's own
  const eur = pageDoc({ source: "pick", store: "de-CH/eur", path: "/de-CH/eur/ueber-uns" });
  assert.equal(mainView(eur), "de-CH/eur");
  assert.deepEqual(viewsOf(eur), ["de-CH/eur"]);
});

test("the same page in a store view's second currency: under its own prefix (the hreflang links know no currency)", () => {
  assert.equal(pathIn("/fr-CH/a-propos", "fr-CH/eur"), "/fr-CH/eur/a-propos");
  assert.equal(pathIn("/fr-CH/eur/a-propos", "fr-CH/eur"), "/fr-CH/eur/a-propos");
  assert.equal(pathIn("/fr-CH/a-propos", "fr-CH"), "/fr-CH/a-propos");
  assert.equal(pathIn("/fr-FR/a-propos", "fr-CH/eur"), null, "another country's page is not it");
  assert.equal(pathIn("/de-CH/", "de-CH/eur"), "/de-CH/eur/", "the home page too");
  assert.equal(pathIn(null, "de-CH"), null);
});

test("the EUR twin of a store view is a copy of it (no AI), never a translation", () => {
  let d = pageDoc({ source: "pick", store: "de-CH", path: "/de-CH/ueber-uns", changes: [{ op: "text", selector: "h1", text: "Hallo" }] });
  d = withView(d, "de-DE", { ...viewOf(d, "de-DE"), path: "/de-DE/ueber-uns", changes: [{ op: "text", selector: "h1", text: "Hallo DE" }] });
  assert.deepEqual(howToAdd(d, "de-CH/eur"), { how: "copy", from: "de-CH" }, "its own country first");
  assert.deepEqual(howToAdd(d, "fr-CH/eur"), { how: "translate", from: "de-CH" });
});

/* ── point 5: versions A / B / C of the same page ─────────────────────── */

const page = (over: Record<string, unknown> = {}): PageDoc => pageDoc({
  source: "pick", store: "de-CH", path: "/de-CH/ueber-uns", changes: [{ op: "text", selector: "h1", text: "A" }], ...over,
});

test("another version: a copy of the one open under the next letter, opened; switching keeps each list under its letter", () => {
  let v = page();
  assert.deepEqual(lettersOf(v), ["A"]);
  assert.equal(v.letter, "A");
  v = addVersion(v, "2026-11-10T08:00:00.000Z");
  assert.equal(v.letter, "B");
  assert.deepEqual(lettersOf(v), ["A", "B"]);
  assert.deepEqual(v.changes, [{ op: "text", selector: "h1", text: "A" }], "B starts as a copy of A");
  // B changed on its own
  v = { ...v, changes: [{ op: "text", selector: "h1", text: "B" }] };
  const hashB = sourceHash(v);
  v = openVersion(v, "A");
  assert.equal(v.letter, "A");
  assert.deepEqual(v.changes, [{ op: "text", selector: "h1", text: "A" }]);
  assert.deepEqual(versionList(v).find((x) => x.letter === "B")!.changes, [{ op: "text", selector: "h1", text: "B" }]);
  assert.equal(sourceHash(v), hashB, "opening another letter is no change: the store views made from it stay up to date");
  assert.equal(versionList(v).find((x) => x.letter === "B")!.from, "A");
  v = addVersion(addVersion(v));
  assert.deepEqual(lettersOf(v), ["A", "B", "C", "D"]);
  assert.equal(addVersion(v), v, "four at most, as AI testing & personalization has");
  // kept and read back as the studio saves it
  const back = pageDoc(JSON.parse(JSON.stringify(v)));
  assert.deepEqual(lettersOf(back), ["A", "B", "C", "D"]);
  assert.equal(back.letter, "D");
  assert.deepEqual(versionList(back).find((x) => x.letter === "B")!.changes, [{ op: "text", selector: "h1", text: "B" }]);
});

test("a version taken out: never the last; the open one taken out opens the first left; the A/B test falls back", () => {
  let v = addVersion(page());
  v = { ...v, abTest: { ...v.abTest, enabled: true, a: "A", b: "B" } };
  assert.equal(abLine(v), "A/B test · Version B vs version A");
  v = dropVersion(v, "B");
  assert.deepEqual(lettersOf(v), ["A"]);
  assert.equal(v.letter, "A");
  assert.deepEqual({ a: v.abTest.a, b: v.abTest.b }, { a: "page", b: "A" });
  assert.equal(dropVersion(v, "A"), v, "the last one stays");
});

test("the A/B test in one line, and which two run - read back safely", () => {
  const v = page();
  assert.equal(abLine(v), "A/B test · Off");
  assert.equal(abLine({ ...v, abTest: { ...v.abTest, enabled: true } }), "A/B test · Version A vs the page as it is");
  const bad = pageDoc({ source: "pick", store: "de-CH", path: "/de-CH/x", abTest: { enabled: true, a: "C", b: "C" } });
  assert.deepEqual({ a: bad.abTest.a, b: bad.abTest.b }, { a: "page", b: "A" }, "a pair that does not exist goes back to the page against A");
});

test("a page's versions in other store views travel with a copy; the library's text names each", () => {
  let d = addVersion(page());
  d = { ...d, changes: [{ op: "text", selector: "h1", text: "B" }] };
  const withEur = withView(d, "de-CH/eur", { ...viewOf(d, "de-CH/eur") });
  assert.deepEqual(lettersOf(viewOf(withEur, "de-CH/eur")), ["A"], "a store view has its own versions");
  const t = pageText(d);
  assert.match(t, /Changes \(version B\):/);
  assert.match(t, /\nVersion A:\n1\. /);
});

test("the versions of an optimization of AI testing & personalization come under their own letters, the one sent open", () => {
  const all = [
    { id: "11", ideaId: "5", letter: "A", rev: 2, summary: "Bigger button", changes: [{ op: "text" as const, selector: "h1", text: "A" }], updatedAt: "2026-11-09T10:00:00Z" },
    { id: "12", ideaId: "5", letter: "B", rev: 1, summary: "Mosaic", changes: [{ op: "text" as const, selector: "h1", text: "B" }], updatedAt: "2026-11-09T11:00:00Z" },
    { id: "13", ideaId: "6", letter: "A", rev: 1, summary: "Another optimization", changes: [], updatedAt: "2026-11-09T11:00:00Z" },
  ];
  const list = convertVersionsOf(all, { id: "12", ideaId: "5", letter: "B" });
  assert.deepEqual(list.map((x) => [x.letter, x.origin?.versionId, x.changes.length]), [["A", "11", 1], ["B", "12", 0]], "B is open: its list is the view's");
  const d = pageDoc({ source: "convert", store: "de-CH", path: "/de-CH/", changes: all[1].changes, letter: "B", versions: list, origin: { versionId: "12", rev: 1, letter: "B" } });
  assert.equal(d.letter, "B");
  assert.equal(d.origin?.letter, "B");
  assert.deepEqual(versionList(d).map((x) => x.letter), ["A", "B"]);
  assert.deepEqual(convertVersionsOf(all, { id: "13", ideaId: "6", letter: "A" }), [], "one version alone: no list");
});

/* ── point 3: a page of the shop's search engine fields, into Magento ─── */

test("the search engine fields Magento's page gets: only those set, a URL key only when it changes", () => {
  assert.deepEqual(seoFieldsOf(undefined, "ueber-uns"), {});
  assert.deepEqual(seoFieldsOf({ metaTitle: " Über uns | APSOparts ", metaDescription: "" }, "ueber-uns"), { meta_title: "Über uns | APSOparts" });
  assert.deepEqual(seoFieldsOf({ urlKey: "ueber-uns" }, "ueber-uns"), {}, "the same key is no change");
  assert.deepEqual(seoFieldsOf({ urlKey: "ueber-angst-pfister" }, "ueber-uns"), { identifier: "ueber-angst-pfister" });
});

type Pg = { id: number; identifier: string; title: string; content: string; active: boolean; meta_title?: string; stores: number[] };
function fake(pages: Pg[]) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetch: FetchLike = async (url, init) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init.method, path: u.pathname, body });
    const ok = (j: unknown) => ({ status: 200, text: async () => JSON.stringify(j) });
    const m = /^\/rest\/[^/]+\/V1\/cmsPage(?:\/(search|\d+))?$/.exec(u.pathname);
    const strip = ({ stores: _s, ...p }: Pg) => p;
    if (init.method === "GET" && m?.[1] === "search") {
      const ident = u.searchParams.get("searchCriteria[filterGroups][0][filters][0][value]");
      const sid = Number(u.searchParams.get("searchCriteria[filterGroups][1][filters][0][value]"));
      return ok({ items: pages.filter((p) => p.identifier === ident && p.stores.includes(sid)).map(strip) });
    }
    if (init.method === "GET" && m?.[1]) return ok(strip(pages.find((p) => p.id === Number(m[1]))!));
    if (init.method === "PUT" && m?.[1]) { const i = pages.findIndex((p) => p.id === Number(m[1])); pages[i] = { ...pages[i], ...body.page, stores: pages[i].stores }; return ok(strip(pages[i])); }
    return { status: 400, text: async () => "{}" };
  };
  return { m: magentoRequest({ base: "https://acc.apsoparts.com", fetch, authorize: () => "OAuth test" }), calls };
}
const EUR: StoreRef = { view: "de-CH/eur", code: "switzerland_eur_de", id: 1 };
const noBackups: Backups = { add: async () => "1", written: async () => undefined, failed: async () => undefined };

test("a page of the shop written with its search engine fields - in its own store view (the Swiss shop in EUR)", async () => {
  const f = fake([{ id: 41, identifier: "ueber-uns", title: "Über uns", content: "<h1>Über uns</h1>", active: true, stores: [1] }]);
  const want: Want = { kind: "changes", identifier: "ueber-uns", changes: [], tag: "content-de-CH/eur", seo: { metaTitle: "Über Angst+Pfister | APSOparts", metaDescription: "Wer wir sind." } };
  const plan = await planPage(f.m, { env: "acc", view: "de-CH/eur", store: EUR, want, ours: () => false });
  assert.equal(plan.action, "update");
  assert.equal(plan.pageId, "41");
  await writePage(f.m, { env: "acc", view: "de-CH/eur", store: EUR, want, ours: () => false, by: "test", backups: noBackups });
  const put = f.calls.find((c) => c.method === "PUT")!;
  assert.equal(put.path, "/rest/all/V1/cmsPage/41");
  const sent = (put.body as { page: Record<string, unknown> }).page;
  assert.equal(sent.meta_title, "Über Angst+Pfister | APSOparts");
  assert.equal(sent.meta_description, "Wer wir sind.");
  assert.equal(sent.identifier, "ueber-uns", "the URL key unchanged");
  assert.equal(sent.content, "<h1>Über uns</h1>", "no change: the content as Magento holds it");
});

test("a new URL key another page of the store view has is refused before anything is written", async () => {
  const f = fake([
    { id: 41, identifier: "ueber-uns", title: "Über uns", content: "<p>x</p>", active: true, stores: [1] },
    { id: 42, identifier: "firma", title: "Firma", content: "<p>y</p>", active: true, stores: [1] },
  ]);
  const want: Want = { kind: "changes", identifier: "ueber-uns", changes: [], tag: "t", seo: { urlKey: "firma" } };
  const plan = await planPage(f.m, { env: "acc", view: "de-CH/eur", store: EUR, want, ours: () => false });
  assert.equal(plan.action, "none");
  assert.match(plan.why ?? "", /already \(#42\)/);
  assert.equal(f.calls.filter((c) => c.method !== "GET").length, 0);
});

/* ── point 11: the connection, in plain words, checked by ONE read ────── */

test("each environment's connection before any check, in plain words", () => {
  assert.equal(connectionLine("acc", "none").line, "No key on the hub yet");
  assert.equal(connectionLine("prod", "none").line, "No key for pages yet");
  assert.equal(connectionLine("prod", "order").state, "key");
  assert.equal(connectionLine("acc", "cms").line, "Key set - not checked yet");
});

test("the check makes one GET of the CMS pages and says what Magento's answer means", async () => {
  const seen: string[] = [];
  const ok = await checkConnection("acc", "cms", async (path) => { seen.push(path); return { status: 200, text: JSON.stringify({ items: [{ id: 1 }], total_count: 191 }) }; });
  assert.deepEqual(seen, [CHECK_PATH]);
  assert.match(decodeURIComponent(CHECK_PATH), /^\/cmsPage\/search\?searchCriteria\[pageSize\]=1/);
  assert.equal(ok.state, "connected");
  assert.equal(ok.pages, 191);
  const right = verdictOf("prod", 401, JSON.stringify({ message: "The consumer isn't authorized to access %resources.", parameters: { resources: "Magento_Cms::page" } }));
  assert.equal(right.state, "no-right");
  assert.equal(right.line, "Refused - the integration lacks Content > Pages");
  const wrong = verdictOf("prod", 401, JSON.stringify({ message: "The signature is invalid. Verify and try again." }));
  assert.equal(wrong.state, "refused");
  assert.equal(verdictOf("acc", 503, "<html>down</html>").state, "unreachable");
  const none = await checkConnection("acc", "none", null);
  assert.equal(none.state, "no-key");
  assert.equal(none.line, "No key on the hub yet");
  const down = await checkConnection("acc", "cms", async () => { throw new Error("ECONNRESET"); });
  assert.equal(down.state, "unreachable");
});

/* ── the lead's additions (10.11.2026): a project from AI testing & personalization ── */

test("the first to-do of a project sent from AI testing & personalization: the project's own type when the board offers it", () => {
  assert.equal(pieceKindFromConvert("landing-page", "/de-CH/ueber-uns"), "landing-page");
  assert.equal(pieceKindFromConvert("banner", "/de-CH/"), "banner");
  assert.equal(pieceKindFromConvert("newsletter", "/de-CH/"), "newsletter");
  assert.equal(pieceKindFromConvert("blog-article", "/de-CH/"), "blog-article");
  assert.equal(pieceKindFromConvert("page-refresh", "/de-CH/"), "page-refresh");
  assert.equal(pieceKindFromConvert(null, "/de-CH/12202510-x.html"), "page-refresh", "no type: the Page builder");
  assert.equal(pieceKindFromConvert("product-page", "/de-CH/"), "page-refresh", "a type the board does not offer: the Page builder");
});

test("a brief with AI testing & personalization's marker is an app's brief; a landing page does not open the marker's page", () => {
  const notes = "A shop page to improve, from APSOconvert: its numbers say visitors come and do not buy.\n\n[APSOconvert page prod:/de-CH/dichtungstechnik.html v:12]";
  const b = appBriefOf({ source: null, goal: "", notes });
  assert.equal(b.app, "AI testing & personalization");
  assert.equal(b.auto, true);
  assert.doesNotMatch(b.text, /APSOconvert page/, "the marker is not shown as words");
  assert.equal(appBriefOf({ source: null, goal: "O-rings for food", notes: "" }).app, null, "a person's own idea asks first");
  assert.ok(appBriefOf({ source: "seo", goal: "Seals", notes: "" }).auto, "an SEO brief writes itself, as before");
  assert.equal(opensMarkerPage("landing-page"), false, "a landing page makes a new page from the brief");
  assert.equal(opensMarkerPage("page-refresh"), true);
  assert.equal(opensMarkerPage(null), true);
});
