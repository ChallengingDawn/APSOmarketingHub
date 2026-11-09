import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONTENT_BY_KEY, CONTENT_TYPES, OFFERED_CONTENT_TYPES, OFFERED_KEYS, PAGE_BUILDER, changesShopPage, inferContentType,
} from "../src/lib/content/contentTypes";
import { studioKindOf } from "../src/lib/content/studio/kinds";
import { ideaKind } from "../src/lib/content/ideaOrigins";
import { contentTypeForPage, projectForPage } from "../src/lib/convert/handoff";
import { contentTypeFor } from "../src/lib/aeo/model";
import { emptyPage, pageModesFor, pageSourceFix } from "../src/lib/content/studio/kinds/page/model";
import { MAKE_KINDS } from "../src/app/projects/make/makeKinds";

// SARCLA 09.11.2026: "SEO landing page should only have the SEO pages" and "Page refresh becomes only Page builder" -
// the editor for the pages already on the webshop, where the optimization from AI testing & personalization lands.

test("the Page builder: the type for a page already on the webshop, offered beside the SEO landing page", () => {
  const t = CONTENT_BY_KEY[PAGE_BUILDER];
  assert.equal(PAGE_BUILDER, "page-refresh"); // the key stays: every project made before opens in it
  assert.equal(t.label, "Page builder");
  assert.equal(t.group, "Pages");
  assert.match(t.blurb, /already on the webshop/);
  assert.deepEqual(OFFERED_KEYS.slice(0, 2), ["landing-page", "page-refresh"]);
  assert.ok(OFFERED_CONTENT_TYPES.some((x) => x.key === PAGE_BUILDER));
  // "Page refresh" is said nowhere a person reads it
  for (const x of CONTENT_TYPES) assert.ok(!/page refresh/i.test(`${x.label} ${x.blurb}`), x.key);
  for (const k of MAKE_KINDS) assert.ok(!/page refresh/i.test(`${k.noun} ${k.blurb} ${k.heading ?? ""} ${k.ask ?? ""}`), k.key);
});

test("an old project named after the old tile still finds its type", () => {
  assert.equal(inferContentType("Untitled page refresh"), "page-refresh");
  assert.equal(inferContentType("Untitled page builder"), "page-refresh");
  assert.equal(inferContentType("Untitled SEO landing page"), "landing-page");
  assert.equal(inferContentType("Untitled product page copy"), "product-page");
});

test("the Page builder and an older product page open in the page studio, on a page of the shop", () => {
  assert.equal(studioKindOf("page-refresh"), "page");
  assert.equal(studioKindOf("product-page"), "page");
  assert.equal(studioKindOf("landing-page"), "page");
  assert.ok(changesShopPage("page-refresh") && changesShopPage("product-page"));
  assert.ok(!changesShopPage("landing-page") && !changesShopPage(null));
});

test("Make offers the SEO landing page and the Page builder", () => {
  const page = MAKE_KINDS.find((k) => k.key === "page-refresh");
  assert.ok(page);
  assert.equal(page.heading, "Page builder");
  assert.ok(MAKE_KINDS.some((k) => k.key === "landing-page" && k.noun === "SEO landing page"));
});

test("AI testing & personalization's hand-offs make a Page builder project - a product page too", () => {
  assert.equal(contentTypeForPage("/de-CH/12202510-maschinenfuss.html"), "page-refresh");
  assert.equal(contentTypeForPage("/fr-CH/etancheite.html"), "page-refresh");
  const p = projectForPage({
    env: "prod", path: "/de-CH/12202510-maschinenfuss.html", url: "https://www.apsoparts.com/de-CH/12202510-maschinenfuss.html",
    h1: "Maschinenfuss", title: "x", numbers: null, ideas: [], version: null, previewPath: "/website/ai-personalization/preview",
  });
  assert.equal(p.contentType, "page-refresh");
});

test("ideas that change a page already on the shop make a Page builder; a page the shop lacks, a landing page", () => {
  assert.equal(ideaKind("convert"), "page-refresh");                                        // Insights
  assert.equal(ideaKind("buyers"), "page-refresh");                                         // What stops buyers
  assert.equal(ideaKind("seo", { seo: "decay" }), "page-refresh");                          // SEO · Decay
  assert.equal(ideaKind("seo", { seo: "quick-win" }), "landing-page");                      // SEO · Quick wins
  assert.equal(ideaKind("aeo", { action: "UPDATE_CONTENT" }), "page-refresh");              // AEO · update this content
  assert.equal(ideaKind("aeo", { action: "CREATE_CONTENT", contentType: "PRODUCT_PAGE" }), "page-refresh");
  assert.equal(ideaKind("aeo", { action: "CREATE_CONTENT", contentType: "BLOG_POST" }), "blog-article");
  assert.equal(ideaKind("aeo", { action: "CREATE_CONTENT", contentType: "COMPARISON" }), "landing-page");
  assert.equal(ideaKind("search"), null);                                                   // their own readers say
  // HubSpot's recommendation sent from AEO says the same
  const rec = (over: Partial<Parameters<typeof contentTypeFor>[0]>) => ({ action: "CREATE_CONTENT", contentType: null, ...over }) as Parameters<typeof contentTypeFor>[0];
  assert.equal(contentTypeFor(rec({ action: "UPDATE_CONTENT" })), "page-refresh");
  assert.equal(contentTypeFor(rec({ contentType: "PRODUCT_PAGE" })), "page-refresh");
});

test("pageModesFor: an SEO landing page is a new page, the Page builder a page of the shop", () => {
  assert.deepEqual(pageModesFor("landing-page"), ["new"]);
  assert.deepEqual(pageModesFor("page-refresh"), ["pick"]);
  assert.deepEqual(pageModesFor("product-page"), ["pick"]);
  assert.deepEqual(pageModesFor(null), ["pick", "new"]);
});

test("pageSourceFix: an empty document takes its type's way; one that holds work keeps it", () => {
  const empty = emptyPage("DE");
  // a landing page left on "a page of the shop" with nothing picked becomes a new page
  assert.equal(pageSourceFix("landing-page", { ...empty, source: "pick" }), "new");
  // ... but one that picked a shop page before keeps showing it
  assert.equal(pageSourceFix("landing-page", { ...empty, source: "pick", path: "/de-CH/dichtungen.html" }), null);
  assert.equal(pageSourceFix("landing-page", { ...empty, source: "new" }), null);
  // a Page builder starts on a page of the shop; one written as a new page before keeps its words
  assert.equal(pageSourceFix("page-refresh", { ...empty, source: "new" }), "pick");
  const written = { ...empty.fields, hero: { ...empty.fields.hero, title: "Dichtungen nach Mass" } };
  assert.equal(pageSourceFix("page-refresh", { ...empty, source: "new", fields: written }), null);
  // a page handed over from AI testing & personalization stays as it came
  assert.equal(pageSourceFix("landing-page", { ...empty, source: "convert" }), null);
  assert.equal(pageSourceFix(null, { ...empty, source: "pick" }), null);
});
