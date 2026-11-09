// APSOconvert > the types of content change (SARCLA 09.11.2026: "only insights that propose different types of content
// change"; "displayed on the app, then a brief is sent to reproduce it on Content") - Content's own keys, agreed with
// Content (3b): the brief names the type, carries the block's picture as an address, the marker stays last.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CHANGE_LABEL, CHANGE_TYPES, cleanChangeType, isChangeType, typeOfBlock, typeOfIdea } from "../src/lib/convert/changeTypes";
import { CONTENT_BY_KEY } from "../src/lib/content/contentTypes";
import { markerOf, pageMarker, projectForPage } from "../src/lib/convert/handoff";

test("change types: Content's own types only, Blog to come", () => {
  for (const t of CHANGE_TYPES) assert.ok(CONTENT_BY_KEY[t.key], `${t.key} is a Content type`);
  assert.deepEqual(CHANGE_TYPES.map((t) => t.label), ["Page builder", "SEO landing page", "Banner", "Newsletter", "Blog"]);
  assert.equal(CHANGE_TYPES.find((t) => t.key === "blog-article")?.soon, true);
  assert.equal(CHANGE_LABEL["landing-page"], "SEO landing page");
  assert.ok(isChangeType("banner"));
  assert.ok(!isChangeType("linkedin-post"), "a type Content has but APSOconvert never sends");
});

test("typeOfIdea: the AI's type, else the block's, else a change of the page", () => {
  assert.equal(typeOfBlock("newsletter"), "newsletter");
  assert.equal(typeOfBlock("home-slider"), "banner");
  assert.equal(typeOfBlock("home-top"), "page-refresh");
  assert.equal(typeOfBlock(null), "page-refresh");
  assert.equal(typeOfIdea({ contentType: "landing-page", block: null }), "landing-page");
  assert.equal(typeOfIdea({ contentType: null, block: "newsletter" }), "newsletter");
  assert.equal(typeOfIdea({ contentType: "nonsense", block: null }), "page-refresh");
  assert.equal(typeOfIdea({}), "page-refresh", "an optimization from before the types");
  assert.equal(cleanChangeType("blog-article", null), "page-refresh", "the AI is not offered the blog yet");
  assert.equal(cleanChangeType("banner", "newsletter"), "banner", "the AI's own choice wins");
  assert.equal(cleanChangeType(undefined, "home-slider"), "banner");
});

test("projectForPage: the type of change, the block's picture as an address, the marker last", () => {
  const base = {
    env: "prod" as const, path: "/de-CH/", url: "https://www.apsoparts.com/de-CH/", h1: "APSOparts", title: "x", numbers: null,
    ideas: [{ title: "A clearer newsletter promise", why: "few sign-ups", change: "Say what comes and how often", expect: "more sign-ups" }],
    version: null, versions: [{ id: "77", letter: "A", rev: 1, summary: "New headline" }],
    previewPath: "https://hub/website/ai-personalization/preview?env=prod&path=%2Fde-CH%2F",
  };
  const nl = projectForPage({ ...base, contentType: "newsletter", block: { name: "Newsletter band", picture: "https://hub/api/website/ai-personalization/preview?env=prod&path=%2Fde-CH%2F&still=1&focus=div.footer__newsletter" } });
  assert.equal(nl.contentType, "newsletter");
  assert.equal(nl.title, "Newsletter: Newsletter band · APSOparts");
  assert.match(nl.brief, /^The newsletter band and its sign-up to improve\./);
  assert.match(nl.brief, /Block: Newsletter band\nAs it is now: https:\/\/hub\/api\/website\/ai-personalization\/preview\?.*still=1/);
  assert.match(nl.brief, /Type of change: Newsletter/);
  assert.ok(!/"op"|<div/.test(nl.brief), "no change list or markup in the brief");
  assert.ok(nl.brief.endsWith(pageMarker("prod", "/de-CH/", null, "77")));
  assert.deepEqual(markerOf(nl.brief), { env: "prod", path: "/de-CH/", versionId: "77" });

  const lp = projectForPage({ ...base, contentType: "landing-page" });
  assert.equal(lp.contentType, "landing-page");
  assert.match(lp.brief, /^A NEW SEO landing page to write\./);

  const plain = projectForPage({ ...base });
  assert.equal(plain.contentType, "page-refresh", "no type = the Page builder, as before");
  assert.equal(plain.title, "Shop page: APSOparts");
});
