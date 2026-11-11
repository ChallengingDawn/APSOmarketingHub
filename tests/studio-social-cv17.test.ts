import assert from "node:assert/strict";
import { test } from "node:test";
import {
  copiedVersion, emptySocial, exportPack, linkPath, linkToFind, normalizeSocial, translateItems, translatedVersion, viewOf, withLangLink, type SocialDoc,
} from "../src/lib/content/studio/kinds/social/model";
import { altOf, altSidecar, normalizeDesign, pageAlts, pageFileName, withAlt } from "../src/lib/content/studio/kinds/social/design";
import { askDoc, askUrl, linkAnswer, linkAsk } from "../src/lib/content/studio/kinds/social/relink";
import { counterpartIn, langOfStore, pageDoc, pathIn, viewOf as pageView } from "../src/lib/content/studio/kinds/page/model";
import { shopLinkOf } from "../src/lib/content/studio/kinds/page/links";
import type { DesignDocument, DesignNode } from "../src/lib/design-document";

// cv17 (SARCLA 11.11.2026: "continue" - what cv16 left open on the social post): a language version's link follows its
// language (the Page builder's lookup from the shop's hreflang links), and a picture says what it shows (its alt text).

const text = (id: string, t: string, y = 0): DesignNode => ({ id, kind: "text", x: 40, y, fill: "#16202A", text: t, fontSize: 40, width: 600 } as DesignNode);
const image = (id: string, alt?: string, y = 200): DesignNode => ({ id, kind: "image", x: 40, y, width: 600, height: 400, src: "/api/content/picture/abc", ...(alt === undefined ? {} : { alt }) } as unknown as DesignNode);
const doc = (nodes: DesignNode[], w = 1080, h = 1080): DesignDocument => ({ schemaVersion: 1, canvas: { w, h }, background: { color: "#F4F6F8", src: null, gradientId: null, customGradient: { from: "#274E64", to: "#16303F" }, scrim: 0 }, nodes } as unknown as DesignDocument);

function post(alt?: string): SocialDoc {
  const d = emptySocial({ contentType: "social-post" });
  d.networks.linkedin.text = "Seals for every machine.";
  d.link = { url: "https://www.apsoparts.com/de-CH/dichtungstechnik.html?utm_source=linkedin", label: "Alle Dichtungen:", inComment: false };
  d.design = {
    formats: ["square", "landscape"], custom: null,
    pages: [
      { id: "p1", by: { square: doc([text("a", "Dichtungen für *jede* Maschine"), image("img", alt)]), landscape: doc([text("a", "Dichtungen für *jede* Maschine"), image("img", alt, 100)], 1200, 627) } },
      { id: "p2", by: { square: doc([text("c", "apsoparts.com", 900)]) } },
    ],
  };
  return normalizeSocial(d);
}

/* ── a fake shop: its pages' hreflang links, never a real fetch ───────────────────────────────────────────────────── */

const alt = (lang: string, href: string) => `<link rel="alternate" hreflang="${lang}" href="https://www.apsoparts.com${href}">`;
const SHOP: Record<string, string> = {
  "/de-CH/dichtungstechnik.html": `<html><head>${alt("de-ch", "/de-CH/dichtungstechnik.html")}${alt("fr-ch", "/fr-CH/technologie-de-l-etancheite.html")}${alt("it-ch", "/it-CH/tecnologia-di-tenuta.html")}${alt("x-default", "/en-INT/sealing-technology.html")}</head></html>`,
  // a page the shop has in German only
  "/de-CH/aktion-herbst.html": `<html><head>${alt("de-ch", "/de-CH/aktion-herbst.html")}</head></html>`,
};
let reads = 0;
/** What page/shop.ts relinkOf does with the document it is given, against the fake shop (read once per link; the page's
 * counterpart from its hreflang links, in the store view asked for). The server action hands relinkOf askDoc() as is. */
function fakeRelink(raw: unknown, key: string): { map: Record<string, string>; missing: string[] } {
  const d = pageView(pageDoc(raw), key);
  const store = d.store;
  const lang = langOfStore(store);
  const map: Record<string, string> = {};
  const missing: string[] = [];
  for (const u of d.fields.links.map((l) => l.url)) {
    const l = shopLinkOf(u);
    if (!l || l.store.slice(0, 2) === store.slice(0, 2)) continue;
    reads += 1;
    const html = SHOP[`/${l.store}/${l.rest}`];
    const found = html ? counterpartIn(html, lang, store, store) : null;
    const to = pathIn(found, store) ?? found;
    if (to) map[u] = `https://www.apsoparts.com${to}`; else missing.push(u);
  }
  return { map, missing };
}

test("a version's link to find: a page of the shop in another language - its store view, its host and tracking kept aside", () => {
  const a = linkAsk("https://www.apsoparts.com/de-CH/dichtungstechnik.html?utm_source=linkedin#sizes", "FR")!;
  assert.equal(a.store, "fr-CH", "the link's own country, where the shop has the language");
  assert.equal(a.from, "de");
  assert.equal(a.path, "/de-CH/dichtungstechnik.html");
  assert.equal(a.tail, "?utm_source=linkedin#sizes");
  assert.equal(a.env, "prod");
  assert.equal(linkAsk("https://acc.apsoparts.com/de-CH/dichtungstechnik.html", "IT")?.env, "acc");
  assert.equal(linkAsk("/de-CH/dichtungstechnik.html", "EN")?.store, "en-INT", "English: the shop's international store view");
  assert.equal(linkAsk("https://www.apsoparts.com/fr-CH/technologie-de-l-etancheite.html", "FR"), null, "already in its language");
  assert.equal(linkAsk("https://www.linkedin.com/company/apsoparts", "FR"), null, "not a page of the shop");
  assert.equal(linkAsk("", "FR"), null);
  assert.equal(linkToFind("https://www.apsoparts.com/de-CH/x.html", "FR"), "DE");
  assert.equal(linkToFind("https://www.apsoparts.com/fr-CH/x.html", "FR"), null);
  assert.equal(linkToFind("https://example.com/de-CH/x.html", "FR"), null);
});

test("what relinkOf is given: a new page in the version's store view whose one link is this one - read as such", () => {
  const a = linkAsk("https://www.apsoparts.com/de-CH/dichtungstechnik.html?utm_source=linkedin", "FR")!;
  const p = pageDoc(askDoc(a));
  assert.equal(p.source, "new");
  assert.equal(p.store, "fr-CH");
  assert.equal(pageView(p, a.store), p, "its own store view is the main one - relinkOf reads it as it is");
  assert.deepEqual(p.fields.links.map((l) => l.url), [askUrl(a)], "the page's address, without the tracking");
});

test("the link follows the language: the fake shop's hreflang links give the French page; tracking and host kept", () => {
  reads = 0;
  const a = linkAsk("https://www.apsoparts.com/de-CH/dichtungstechnik.html?utm_source=linkedin", "FR")!;
  assert.equal(linkAnswer(a, fakeRelink(askDoc(a), a.store)), "https://www.apsoparts.com/fr-CH/technologie-de-l-etancheite.html?utm_source=linkedin");
  assert.equal(reads, 1, "the shop's page read once");
  const it = linkAsk("/de-CH/dichtungstechnik.html", "IT")!;
  assert.equal(linkAnswer(it, fakeRelink(askDoc(it), it.store)), "/it-CH/tecnologia-di-tenuta.html", "an address without its host stays without");
  const en = linkAsk("https://acc.apsoparts.com/de-CH/dichtungstechnik.html", "EN")!;
  assert.equal(linkAnswer(en, fakeRelink(askDoc(en), en.store)), "https://acc.apsoparts.com/en-INT/sealing-technology.html", "ACC stays ACC");
});

test("none found: the shop has no page in that language, or answers with another language - null, the version keeps its link", () => {
  const a = linkAsk("https://www.apsoparts.com/de-CH/aktion-herbst.html", "FR")!;
  const r = fakeRelink(askDoc(a), a.store);
  assert.deepEqual(r.missing, [askUrl(a)]);
  assert.equal(linkAnswer(a, r), null);
  assert.equal(linkAnswer(a, { map: { [askUrl(a)]: "https://www.apsoparts.com/de-CH/aktion-herbst.html" } }), null, "a German page is no French answer");
  const gone = linkAsk("https://www.apsoparts.com/de-CH/nicht-mehr-da.html", "FR")!;
  assert.equal(linkAnswer(gone, fakeRelink(askDoc(gone), gone.store)), null);
});

test("the found page goes into the version only while its link is still the one searched from", () => {
  const d = post();
  d.langs.FR = copiedVersion(d, "2026-11-11T20:00:00Z");
  const from = d.link.url;
  const to = "https://www.apsoparts.com/fr-CH/technologie-de-l-etancheite.html?utm_source=linkedin";
  const next = withLangLink(d, "FR", from, to);
  assert.equal(next.langs.FR.link.url, to);
  assert.equal(next.link.url, from, "the main language keeps its own");
  assert.equal(viewOf(next, "FR").link.url, to, "the FR tab shows its own address");
  // typed by hand meanwhile: the typed one wins
  const typed = { ...d, langs: { ...d.langs, FR: { ...d.langs.FR, link: { ...d.langs.FR.link, url: "https://www.apsoparts.com/fr-CH/autre.html" } } } };
  assert.equal(withLangLink(typed, "FR", from, to), typed);
  assert.equal(withLangLink(d, "FR", from, null), d, "nothing found: nothing changes");
  assert.equal(withLangLink(d, "IT", from, to), d, "no such version");
  assert.equal(linkPath(to), "/fr-CH/technologie-de-l-etancheite.html");
});

test("a picture's alt text: on the picture in every format of its page, taken away with an empty one", () => {
  const d = post();
  const withIt = withAlt(d.design, 0, "img", "  An O-ring   of NBR on a steel shaft ");
  assert.equal(altOf(withIt.pages[0].by.square!.nodes.find((n) => n.id === "img")), "An O-ring of NBR on a steel shaft");
  assert.equal(altOf(withIt.pages[0].by.landscape!.nodes.find((n) => n.id === "img")), "An O-ring of NBR on a steel shaft", "every format");
  assert.equal(withIt.pages[1], d.design.pages[1], "another page untouched");
  assert.deepEqual(pageAlts(withIt.pages[0].by.square!), ["An O-ring of NBR on a steel shaft"]);
  const gone = withAlt(withIt, 0, "img", " ");
  assert.equal("alt" in gone.pages[0].by.square!.nodes.find((n) => n.id === "img")!, false);
  assert.equal(altOf(withAlt(d.design, 0, "img", "x".repeat(400)).pages[0].by.square!.nodes.find((n) => n.id === "img")), "x".repeat(140), "the Page builder's 140 at most");
});

test("old posts open unchanged; a stored alt text is kept as words, anything else dropped", () => {
  const old = post();
  const again = normalizeSocial(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(again.design, old.design, "a post without alt texts reads back as it was");
  assert.ok(!again.design.pages[0].by.square!.nodes.some((n) => "alt" in n));
  const raw = JSON.parse(JSON.stringify(post("A seal")));
  raw.design.pages[0].by.landscape.nodes[1].alt = 42;
  const n = normalizeDesign(raw.design);
  assert.equal(altOf(n.pages[0].by.square!.nodes[1]), "A seal");
  assert.equal("alt" in n.pages[0].by.landscape!.nodes[1], false, "a number is no alt text");
});

test("a translation carries the alt texts: once per different text, back on every picture that had it", () => {
  const d = post("Ein O-Ring aus NBR");
  const items = translateItems(d);
  assert.deepEqual(items.map((x) => x.id), ["net.linkedin", "link.label", "t.1", "t.2", "a.1"], "the same alt text in two formats is translated once");
  const { version, missing } = translatedVersion(d, items.map((x) => ({ id: x.id, text: x.id === "a.1" ? "Un joint torique en NBR" : `FR ${x.text}` })), "2026-11-11T20:00:00Z");
  assert.equal(missing, 0);
  assert.equal(altOf(version.design.pages[0].by.square!.nodes[1]), "Un joint torique en NBR");
  assert.equal(altOf(version.design.pages[0].by.landscape!.nodes[1]), "Un joint torique en NBR");
  assert.equal(altOf(d.design.pages[0].by.square!.nodes[1]), "Ein O-Ring aus NBR", "the main language keeps its own");
  // a post without alt texts asks for exactly what it did before
  assert.deepEqual(translateItems(post()).map((x) => x.id), ["net.linkedin", "link.label", "t.1", "t.2"]);
  // copied to write by hand: the alt texts come along as they are
  assert.equal(altOf(copiedVersion(d, "x").design.pages[0].by.square!.nodes[1]), "Ein O-Ring aus NBR");
});

test("handed over: the texts to copy name what each picture shows; the zip carries a file of alt texts by file name", () => {
  const d = post("A seal on a shaft");
  const pack = exportPack(d, "Seals");
  assert.match(pack, /--- Alt text \(what the pictures show\) ---\nPage 1: A seal on a shaft\n/);
  assert.doesNotMatch(exportPack(post(), "Seals"), /Alt text/, "no alt text: the pack as before");
  const side = altSidecar(d.design, ["square", "landscape"], "seals")!;
  assert.match(side, /^What each picture shows/);
  assert.ok(side.includes(`${pageFileName("seals", "square", { w: 1080, h: 1080 }, 0, 2)}: A seal on a shaft. The words on it: Dichtungen für jede Maschine`), side);
  assert.ok(side.includes("seals-landscape-1200x627-01.png: A seal on a shaft."), "every format's file");
  assert.ok(side.includes("seals-square-1080x1080-02.png: The words on it: apsoparts.com"), "a page without a picture: its words");
  assert.equal(altSidecar(post().design, ["square"], "seals"), null, "no alt text anywhere: no extra file");
  assert.equal(pageFileName("seals", "square", { w: 1080, h: 1080 }, 0, 1), "seals-square-1080x1080.png", "one page: no number, as before");
});
