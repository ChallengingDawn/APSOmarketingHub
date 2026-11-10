import assert from "node:assert/strict";
import { test } from "node:test";
import { inflateRawSync } from "node:zlib";
import { STORE_VIEWS, countryGroups, storeCodeOf, storeIdOf, storeViewOf } from "../src/lib/content/studio/kinds/page/storeViews";
import {
  copyView, emptyPage, joinStore, languagesOf, leadOf, pageDoc, splitStore, storesInLanguage, storesOfView, tickStore, versionLabel, versionOfStore,
  viewOf, viewsOf, withStores, withView, type PageDoc,
} from "../src/lib/content/studio/kinds/page/model";
import { planSummary, planViews } from "../src/lib/content/studio/kinds/page/makeViews";
import { inStore, moduleLinks, relinkHtml, relinkModule, shopLinkOf, storeDirective } from "../src/lib/content/studio/kinds/page/links";
import { everyVersionZip, versionFile } from "../src/lib/content/studio/kinds/page/downloadFiles";
import { handOverPlan, safeName, savedLine, sizeLine, uniqueNames, zipOf } from "../src/lib/handover";
import { crc32 } from "../src/lib/xlsxParts";
import { renderModule } from "../src/lib/content/studio/kinds/page/modules/render";
import { normalizeModule } from "../src/lib/content/studio/kinds/page/modules/model";
import { renderNewPage } from "../src/lib/content/studio/kinds/page/newpage";
import { magentoRequest, planShared, writeShared, type Backups, type FetchLike, type StoreRef, type Target, type Want } from "../src/lib/convert/cmsPage";

// Content v10 (SARCLA 10.11.2026), his points 6, 8 and 9: one page per LANGUAGE going to several store views (Magento's
// own "Store View" multi-select, its real list), the bar's Download that did nothing, and every link of a module in the
// store view's own locale. Every Magento rule against a FAKE Magento - never a real call.

/* ── point 6: Magento's real store view list ─────────────────────────── */

test("Magento's store views, by website as its CMS page form lists them - China and Czech Republic taken out (Content v11)", () => {
  assert.equal(STORE_VIEWS.length, 26);
  assert.deepEqual(countryGroups().map((g) => g.label), [
    "Switzerland · EUR", "Switzerland · CHF", "Germany · EUR", "Austria · EUR", "France · EUR", "Italy · EUR", "Netherlands · EUR",
    "International · EUR", "Poland · EUR",
  ]);
  assert.deepEqual(countryGroups()[2].stores, ["en-DE", "de-DE"], "Germany EUR > EN, DE - as the form shows it");
  // the ids read from each front page on 10.11.2026 - the same on production and ACC
  assert.equal(storeIdOf("de-CH/eur"), 1);
  assert.equal(storeIdOf("en-CH"), 5);
  assert.equal(storeIdOf("en-INT"), 26);
  assert.equal(storeIdOf("pl-PL"), 36);
  // SARCLA 10.11.2026: "take out completely China and Czech Republic" - International CS stays, its id unknown, never guessed
  for (const k of ["en-CZ", "cs-CZ", "en-CN"]) assert.equal(storeViewOf(k), null, `${k} is out`);
  assert.equal(storeViewOf("cs-INT")!.id, null);
  assert.equal(storeViewOf("cs-INT")!.code, "international_eur_cs");
  assert.equal(storeViewOf("cs-INT")!.open, false, "its front page leads to en-INT");
  assert.deepEqual(storesInLanguage("cs"), ["cs-INT"]);
});

/* ── point 6: one page per language ──────────────────────────────────── */

const fieldsOf = (title: string) => ({ hero: { title } });

test("a new page goes to every store view of its language - ticked, untickable, its own always in", () => {
  const raw = { ...emptyPage("EN"), source: "new", fields: { ...emptyPage("EN").fields, hero: { ...emptyPage("EN").fields.hero, title: "Kalrez alternatives" } } };
  let d = pageDoc(raw);
  assert.equal(d.store, "en-INT");
  assert.deepEqual(storesOfView(d, "en-INT"), ["en-INT", ...storesInLanguage("en").filter((k) => k !== "en-INT")]);
  assert.equal(storesOfView(d, "en-INT").length, 9);
  assert.equal(versionLabel(d, "en-INT"), "English · 9 store views");
  assert.equal(versionOfStore(d, "en-CH/eur"), "en-INT", "en-CH in EUR gets the English page");
  // unticked: it gets no page; its own store view never goes
  d = tickStore(d, "en-NL", false);
  assert.equal(versionOfStore(d, "en-NL"), null);
  assert.equal(tickStore(d, "en-INT", false), d, "the page's own store view stays");
  d = tickStore(d, "en-NL", true);
  assert.equal(versionOfStore(d, "en-NL"), "en-INT");
  // kept as ticked: a saved document reads back the same
  const back = pageDoc(JSON.parse(JSON.stringify(tickStore(d, "en-PL", false))));
  assert.equal(versionOfStore(back, "en-PL"), null);
  assert.equal(storesOfView(back, "en-INT").length, 8);
});

test("its own words for one store view: split off as a copy, joined back - a store view goes to one version only", () => {
  let d = pageDoc({ ...emptyPage("EN"), source: "new", fields: { ...emptyPage("EN").fields, hero: { ...emptyPage("EN").fields.hero, title: "Seals" } } });
  d = splitStore(d, "en-CH", "", "2026-11-10T15:00:00Z");
  assert.deepEqual(viewsOf(d), ["en-INT", "en-CH"]);
  assert.deepEqual(storesOfView(d, "en-CH"), ["en-CH"]);
  assert.ok(!storesOfView(d, "en-INT").includes("en-CH"), "it left the English page");
  assert.equal(versionOfStore(d, "en-CH"), "en-CH");
  assert.equal(viewOf(d, "en-CH").fields.hero.title, "Seals", "a copy of the words");
  assert.equal(versionLabel(d, "en-CH"), "EN-CH · its own words");
  assert.equal(leadOf(d, "en"), "en-INT");
  // a split copy has the same words as its page - a saved document keeps it split (no merge for a new document)
  const kept = pageDoc(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(viewsOf(kept), ["en-INT", "en-CH"]);
  // ticking en-CH/eur into the split version takes it out of the English page
  d = withStores(d, "en-CH", ["en-CH", "en-CH/eur"]);
  assert.equal(versionOfStore(d, "en-CH/eur"), "en-CH");
  assert.ok(!storesOfView(d, "en-INT").includes("en-CH/eur"));
  // joined back: its own words go, it is the English page's again
  d = joinStore(d, "en-CH");
  assert.deepEqual(viewsOf(d), ["en-INT"]);
  assert.equal(versionOfStore(d, "en-CH"), "en-INT");
  assert.equal(versionOfStore(d, "en-CH/eur"), "en-INT", "the store views it went to go back with it");
});

test("a document kept before: versions of one language with the same words become one, with exactly those store views", () => {
  const old = pageDoc({
    source: "new", store: "de-CH", fields: fieldsOf("Dichtungen"),
    langs: {
      "de-AT": { store: "de-AT", fields: fieldsOf("Dichtungen") },
      "de-DE": { store: "de-DE", fields: fieldsOf("Dichtungen für Deutschland") },
      "en-INT": { store: "en-INT", fields: fieldsOf("Seals") },
      "en-CH": { store: "en-CH", fields: fieldsOf("Seals") },
      "en-DE": { store: "en-DE", fields: fieldsOf("Seals") },
    },
  });
  assert.deepEqual(languagesOf(old).map((g) => [g.lang, g.versions.map((v) => [v.key, v.stores])]), [
    ["de", [["de-CH", ["de-CH", "de-AT"]], ["de-DE", ["de-DE"]]]],
    ["en", [["en-INT", ["en-INT", "en-CH", "en-DE"]]]],
  ]);
  assert.deepEqual(Object.keys(old.langs).sort(), ["de-DE", "en-INT"], "the copies merged into their language's page");
  assert.equal(versionOfStore(old, "de-INT"), null, "nothing more is ticked for an older page");
  // once saved, it is read the same (no second merge, nothing added)
  const again = pageDoc(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(languagesOf(again), languagesOf(old));
});

test("a page moved to another store view's language goes to all of its new language; a translation made since, to all of it", () => {
  const d = pageDoc({ ...emptyPage("DE"), source: "new", fields: fieldsOf("Dichtungen") });
  assert.equal(storesOfView(d, "de-CH").length, 5);
  const moved = pageDoc({ ...JSON.parse(JSON.stringify(d)), store: "fr-CH" });
  assert.deepEqual(storesOfView(moved, "fr-CH"), ["fr-CH", "fr-CH/eur", "fr-FR", "fr-INT"]);
  // a French version written in (as the studio's translation does: no list of its own)
  const tr = pageDoc(withView(d, "fr-CH", { ...viewOf(d, "fr-CH"), fields: { ...d.fields, hero: { ...d.fields.hero, title: "Joints" } } }));
  assert.deepEqual(storesOfView(tr, "fr-CH"), ["fr-CH", "fr-CH/eur", "fr-FR", "fr-INT"]);
  // an older copy (copyView) is a store view of its own
  const c = copyView(tr, "de-AT", "de-CH");
  assert.deepEqual(storesOfView(c, "de-AT"), ["de-AT"]);
  assert.ok(!storesOfView(c, "de-CH").includes("de-AT"));
});

test("the plan: a store view of the page's language goes to its page at once; a new language is one translation for its ticked", () => {
  const d = pageDoc({ ...emptyPage("EN"), source: "new", fields: fieldsOf("Seals") });
  const off = tickStore(d, "en-PL", false);
  const steps = planViews(off, ["en-PL", "fr-FR", "fr-CH", "cs-INT", "en-INT"]);
  assert.deepEqual(steps, [
    { key: "en-PL", how: "tick", from: "en-INT" },
    { key: "fr-CH", how: "translate", from: "en-INT", stores: ["fr-CH", "fr-FR"] },
    { key: "cs-INT", how: "translate", from: "en-INT", stores: ["cs-INT"] },
  ]);
  assert.equal(planSummary(steps), "4 store views: 1 to the page's language (no AI), French and Czech translated - 2 AI calls, one at a time");
});

/* ── point 6: the last step - the same page in each of the version's store views (Content v11) ── */

type FakePage = { id: number; identifier: string; title: string; content: string; active: boolean; stores: number[] };
/** A Magento in memory, as ACC's answered on 10.11.2026: a page's store_id is refused ('"StoreId" is not supported'), a
 * new page is put in the store of the request, an update keeps the page's store views. */
function fakeMagento(pages: FakePage[]) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  let next = 700;
  const strip = ({ stores: _s, ...p }: FakePage) => p;
  const CODE_ID: Record<string, number> = { international_eur_en: 26, switzerland_chf_en: 5, germany_eur_en: 9, poland_eur_en: 33 };
  const refused = { status: 400, text: async () => JSON.stringify({ message: '"%fieldName" is not supported. Correct the field name and try again.', parameters: { fieldName: "StoreId" } }) };
  const fetch: FetchLike = async (url, init) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init.method, url: u.pathname, body });
    const ok = (j: unknown) => ({ status: 200, text: async () => JSON.stringify(j) });
    const m = /^\/rest\/([^/]+)\/V1\/cmsPage(?:\/(search|\d+))?$/.exec(u.pathname)!;
    const [, store, rest] = m;
    if (init.method === "GET" && rest === "search") {
      const ident = u.searchParams.get("searchCriteria[filterGroups][0][filters][0][value]");
      const sid = Number(u.searchParams.get("searchCriteria[filterGroups][1][filters][0][value]"));
      return ok({ items: pages.filter((p) => p.identifier === ident && p.stores.includes(sid)).map(strip) });
    }
    if (init.method === "GET" && rest) { const p = pages.find((x) => x.id === Number(rest)); return p ? ok(strip(p)) : { status: 404, text: async () => "{}" }; }
    if (body?.page && "store_id" in body.page) return refused;
    if (init.method === "POST") {
      const p: FakePage = { ...body.page, id: next++, stores: [CODE_ID[store] ?? 0] };
      pages.push(p);
      return ok(strip(p));
    }
    if (init.method === "PUT") {
      const i = pages.findIndex((x) => x.id === Number(rest));
      pages[i] = { ...pages[i], ...body.page, id: pages[i].id, stores: pages[i].stores };
      return ok(strip(pages[i]));
    }
    return { status: 400, text: async () => "{}" };
  };
  return { m: magentoRequest({ base: "https://acc.apsoparts.com", fetch, authorize: () => "OAuth test" }), calls, pages, writes: () => calls.filter((c) => c.method !== "GET") };
}
const memBackups = (): Backups & { rows: string[] } => {
  const rows: string[] = [];
  return { rows, add: async (b) => { rows.push(`${b.action}:${b.view}:${b.pageId ?? "-"}`); return String(rows.length); }, written: async () => undefined, failed: async () => undefined };
};
const ref = (view: string, code: string, id: number): StoreRef => ({ view, code, id });
const EN = [ref("en-INT", "international_eur_en", 26), ref("en-CH", "switzerland_chf_en", 5), ref("en-DE", "germany_eur_en", 9), ref("en-PL", "poland_eur_en", 33)];
const want: Extract<Want, { kind: "page" }> = { kind: "page", identifier: "kalrez-alternatives", title: "Kalrez alternatives", metaTitle: "Kalrez alternatives", metaDescription: "", content: "<p>x</p>", active: true };
const targets = (views: string[]): Target[] => views.map((v) => ({ view: v, ref: EN.find((r) => r.view === v) ?? null }));

test("a new page for three store views: the same page created in each, by its own store code - never a store_id", async () => {
  const f = fakeMagento([]);
  const t = targets(["en-INT", "en-CH", "en-DE", "en-XX"]);
  const plan = await planShared(f.m, { env: "acc", view: "en-INT", targets: t, want, language: EN, ours: () => false });
  assert.equal(plan.action, "create");
  assert.deepEqual(plan.storeIds, [26, 5, 9]);
  assert.deepEqual(plan.targets.map((x) => [x.view, x.state]), [["en-INT", "new"], ["en-CH", "new"], ["en-DE", "new"], ["en-XX", "unknown"]]);
  assert.match(plan.targets[3].why!, /does not know en-XX's Magento id/);
  assert.equal(f.writes().length, 0, "a plan writes nothing");
  const b = memBackups();
  const w = await writeShared(f.m, { env: "acc", view: "en-INT", targets: t, want, language: EN, ours: () => false, by: "sarcla", backups: b });
  assert.equal(w.action, "created");
  assert.deepEqual(f.writes().map((c) => `${c.method} ${c.url}`), ["POST /rest/international_eur_en/V1/cmsPage", "POST /rest/switzerland_chf_en/V1/cmsPage", "POST /rest/germany_eur_en/V1/cmsPage"]);
  for (const c of f.writes()) assert.ok(!("store_id" in (c.body as { page: object }).page), "Magento refuses a page's store_id");
  assert.deepEqual(f.pages.map((p) => p.stores), [[26], [5], [9]], "one page in each store view");
  assert.deepEqual(f.pages.map((p) => p.identifier), ["kalrez-alternatives", "kalrez-alternatives", "kalrez-alternatives"], "the same URL key");
  assert.deepEqual(w.missing, []);
  assert.equal(w.pageId, "700", "the page of its own store view");
  assert.deepEqual(b.rows, ["create:en-INT:-", "create:en-CH:-", "create:en-DE:-"], "each backed up first");
});

test("written again: this to-do's pages updated, a store view newly ticked gets its page, one ticked off has its page switched off", async () => {
  const old = (id: number, store: number): FakePage => ({ id, identifier: "kalrez-alternatives", title: "Old", content: "<p>old</p>", active: true, stores: [store] });
  const f = fakeMagento([old(41, 26), old(42, 5), old(43, 33)]);
  const ours = (id: string) => ["41", "42", "43"].includes(id);
  const plan = await planShared(f.m, { env: "acc", view: "en-INT", targets: targets(["en-INT", "en-CH", "en-DE"]), want, language: EN, ours });
  assert.equal(plan.action, "update");
  assert.equal(plan.pageId, "41");
  assert.deepEqual(plan.more, ["42"]);
  assert.deepEqual(plan.storeIds, [26, 5, 9]);
  assert.deepEqual(plan.out, ["en-PL"], "en-PL is no longer ticked");
  const w = await writeShared(f.m, { env: "acc", view: "en-INT", targets: targets(["en-INT", "en-CH", "en-DE"]), want, language: EN, ours, by: "sarcla", backups: memBackups() });
  assert.deepEqual(f.writes().map((c) => `${c.method} ${c.url}`), ["PUT /rest/all/V1/cmsPage/41", "PUT /rest/all/V1/cmsPage/42", "POST /rest/germany_eur_en/V1/cmsPage", "PUT /rest/all/V1/cmsPage/43"]);
  assert.deepEqual(f.pages.map((p) => [p.id, p.stores.join(), p.content, p.active]), [[41, "26", "<p>x</p>", true], [42, "5", "<p>x</p>", true], [43, "33", "<p>old</p>", false], [700, "9", "<p>x</p>", true]]);
  assert.deepEqual(w.missing, []);
});

test("somebody else's page under the URL key in one store view: that one is left out; All Store Views stops it", async () => {
  const f = fakeMagento([{ id: 12, identifier: "kalrez-alternatives", title: "Theirs", content: "", active: true, stores: [5] }]);
  const plan = await planShared(f.m, { env: "acc", view: "en-INT", targets: targets(["en-INT", "en-CH"]), want, language: EN, ours: () => false });
  assert.equal(plan.action, "create");
  assert.deepEqual(plan.storeIds, [26]);
  assert.equal(plan.targets[1].state, "taken");
  await writeShared(f.m, { env: "acc", view: "en-INT", targets: targets(["en-INT", "en-CH"]), want, language: EN, ours: () => false, by: "sarcla", backups: memBackups() });
  assert.equal(f.pages.find((p) => p.id === 12)!.title, "Theirs", "never touched");
  const all = fakeMagento([{ id: 3, identifier: "kalrez-alternatives", title: "All", content: "", active: true, stores: [0] }]);
  const stop = await planShared(all.m, { env: "acc", view: "en-INT", targets: targets(["en-INT"]), want, language: EN, ours: () => false });
  assert.equal(stop.action, "none");
  assert.match(stop.why!, /All Store Views/);
});

/* ── point 9: links in the store view's own locale ───────────────────── */

test("a link of the shop in the store view shown: the same language moves, another language is never guessed", () => {
  assert.deepEqual(shopLinkOf("https://www.apsoparts.com/de-CH/eur/dichtungstechnik.html"), { store: "de-CH/eur", rest: "dichtungstechnik.html" });
  assert.equal(shopLinkOf("/media/x.png"), null);
  assert.equal(inStore("https://www.apsoparts.com/en-INT/sealing-technology.html", "en-CH"), "/en-CH/sealing-technology.html");
  assert.equal(inStore("/de-CH/dichtungstechnik.html", "de-CH/eur"), "/de-CH/eur/dichtungstechnik.html");
  assert.equal(inStore("/de-CH/eur/dichtungstechnik.html", "de-DE"), "/de-DE/dichtungstechnik.html");
  assert.equal(inStore("https://www.apsoparts.com/de-CH/dichtungstechnik.html", "en-INT"), "/de-CH/dichtungstechnik.html", "German is not guessed into English");
  const h = relinkHtml(`<a href="/en-INT/o-rings.html">a</a><a href="https://www.apsoparts.com/de-CH/o-ringe.html">b</a><a href="#top">c</a>`, "en-CH");
  assert.equal(h.html, `<a href="/en-CH/o-rings.html">a</a><a href="https://www.apsoparts.com/de-CH/o-ringe.html">b</a><a href="#top">c</a>`);
  assert.deepEqual(h.foreign, ["https://www.apsoparts.com/de-CH/o-ringe.html"]);
  // ONE page for several store views: Magento writes each visitor's own
  const many = relinkHtml(`<a class="am-pc" href="/en-INT/sealing-technology/o-rings.html">a</a>`, "en-INT", 9);
  assert.equal(many.html, `<a class="am-pc" href="${storeDirective("sealing-technology/o-rings.html")}">a</a>`);
  assert.equal(storeDirective("x.html"), "{{store direct_url='x.html'}}");
});

test("every module draws its links in the page's store view - the product bento in en-CH links en-CH", () => {
  const card = (n: string, url: string) => ({ kind: "product" as const, name: n, url, img: "", meta: "12 Artikel", number: "11400101", children: [] });
  const m = normalizeModule({ type: "bento", settings: {
    id: "t1", store: "en-INT", title: "Kalrez alternatives",
    items: [card("FFKM O-ring", "https://www.apsoparts.com/en-INT/11400101-o-ring.html"), card("PTFE seal", "https://www.apsoparts.com/en-INT/11400102-seal.html"), card("x", "https://www.apsoparts.com/en-INT/1.html"), card("y", "https://www.apsoparts.com/en-INT/2.html"), card("z", "https://www.apsoparts.com/en-INT/3.html")],
  } })!;
  assert.ok(m, "the product bento");
  const html = renderModule(m, { store: "en-CH" });
  assert.match(html, /href="\/en-CH\/11400101-o-ring\.html"/);
  assert.doesNotMatch(html, /href="\/en-INT\//, "no en-INT link left in the en-CH page");
  // without a store asked: the module's own
  assert.match(renderModule(m), /href="\/en-INT\/11400101-o-ring\.html"/);
  // the new page's renderer hands its store view to its modules
  const page = renderNewPage({ ...pageDoc({ ...emptyPage("EN"), source: "new" }).fields, hero: { ...emptyPage("EN").fields.hero, title: "T" }, modules: [{ id: "m1", after: "hero", module: m }] }, { store: "en-DE" });
  assert.match(page.html, /href="\/en-DE\/11400101-o-ring\.html"/);
  // a translation's relink: every address of the module, swapped where the other language's page is known
  assert.equal(moduleLinks(m.settings).length, 5);
  const fr = relinkModule(m.settings, { "https://www.apsoparts.com/en-INT/11400101-o-ring.html": "https://www.apsoparts.com/fr-CH/11400101-joint.html" });
  assert.equal(fr.items[0].url, "https://www.apsoparts.com/fr-CH/11400101-joint.html");
  assert.equal(fr.items[1].url, "https://www.apsoparts.com/en-INT/11400102-seal.html");
});

/* ── point 8: the Download - files handed to the browser ─────────────── */

test("several files are ONE zip the browser takes in one download - names safe and each once", () => {
  assert.equal(safeName("Kalrez / Alternativen: DE?"), "Kalrez-Alternativen-DE");
  assert.deepEqual(uniqueNames(["a.html", "a.html", "A.html", "b"]), ["a.html", "a-2.html", "A-3.html", "b"]);
  assert.deepEqual(handOverPlan([{ name: "x.html", data: "1", type: "text/html" }], "all.zip"), { name: "x.html", type: "text/html", files: 1 });
  assert.deepEqual(handOverPlan([{ name: "x.html", data: "1" }, { name: "y.html", data: "2" }], "kalrez-every-language"), { name: "kalrez-every-language.zip", type: "application/zip", files: 2 });
  assert.equal(handOverPlan([], "z"), null);
  const files = [{ name: "kalrez-en-int.html", data: "<p>English</p>" }, { name: "kalrez-fr-ch.html", data: "<p>Français</p>" }];
  const z = zipOf(files);
  // read it back: two local entries, stored, each with its CRC and its bytes
  const dv = new DataView(z.buffer, z.byteOffset, z.byteLength);
  let at = 0;
  const seen: { name: string; text: string }[] = [];
  while (dv.getUint32(at, true) === 0x04034b50) {
    const method = dv.getUint16(at + 8, true);
    const crc = dv.getUint32(at + 14, true);
    const size = dv.getUint32(at + 18, true);
    const nameLen = dv.getUint16(at + 26, true);
    const name = new TextDecoder().decode(z.subarray(at + 30, at + 30 + nameLen));
    const raw = z.subarray(at + 30 + nameLen, at + 30 + nameLen + size);
    const data = method === 8 ? new Uint8Array(inflateRawSync(raw)) : raw;
    assert.equal(crc32(data), crc, `${name}: its CRC`);
    seen.push({ name, text: new TextDecoder().decode(data) });
    at += 30 + nameLen + size;
  }
  assert.deepEqual(seen, [{ name: "kalrez-en-int.html", text: "<p>English</p>" }, { name: "kalrez-fr-ch.html", text: "<p>Français</p>" }]);
  assert.equal(dv.getUint32(z.length - 22, true), 0x06054b50, "the zip's end record");
  assert.equal(savedLine(["kalrez-every-language.zip"], 3), "kalrez-every-language.zip (3 files in one zip) - in your downloads.");
  assert.equal(sizeLine(2048), "2 KB");
});

test("a version's file: its HTML for Magento with the form's fields on top, or what to say instead", () => {
  const ok = versionFile("kalrez", "en-INT", "English · 11 store views", {
    ok: true, store: "en-INT", warnings: [],
    blocks: [{ key: "fields", label: "f", lang: "text", steps: [], code: "Page Title: Kalrez\nStore View: tick en-INT, en-CH" }, { key: "content", label: "c", lang: "html", steps: [], code: "<div>page</div>" }],
  });
  assert.equal(ok.name, "kalrez-en-int.html");
  assert.ok(ok.name && ok.text.startsWith("<!-- English · 11 store views\nPage Title: Kalrez"));
  assert.ok(ok.name && ok.text.endsWith("<div>page</div>"));
  const eur = versionFile("kalrez", "de-CH/eur", "x", { ok: true, store: "de-CH/eur", warnings: ["2 texts still to write"], blocks: [{ key: "content", label: "c", lang: "html", steps: [], code: "<p/>" }] });
  assert.equal(eur.name, "kalrez-de-ch-eur.html");
  assert.equal(eur.say, "de-CH/eur saved - before it goes live: 2 texts still to write");
  assert.deepEqual(versionFile("k", "fr-CH", "x", { ok: false, error: "Give the page its title first." }), { name: null, say: "fr-CH: Give the page its title first." });
  const spec = versionFile("k", "de-CH", "x", { ok: true, store: "de-CH", warnings: [], blocks: [{ key: "spec", label: "s", lang: "text", steps: [], code: "list" }] });
  assert.equal(spec.name, "k-de-ch-for-developers.txt");
  assert.equal(everyVersionZip("kalrez"), "kalrez-every-language.zip");
});

// (a document type for the helpers above)
export type _Doc = PageDoc;
