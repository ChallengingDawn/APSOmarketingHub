import assert from "node:assert/strict";
import { test } from "node:test";
import { MARKETING_SECTIONS, WEBSITE_SECTIONS } from "../src/app/hubApps";
import { SEO_NAV } from "../src/app/seo/nav";
import { PLACE_ORIGIN, SOURCE_ORIGIN, originLabel, projectSourceLabel, sourceLabel, type IdeaSource } from "../src/lib/content/ideaOrigins";

// SARCLA 08.11.2026: "if it comes from AI Personalization, call it like that - we need to identify exactly where they
// come from". The names are the menus' own: a menu renamed without this file fails here.
const sections = [...WEBSITE_SECTIONS, ...MARKETING_SECTIONS];
const pages = sections.flatMap((s) => s.pages.map((p) => ({ section: s.name, name: p.name, href: p.href })));
const page = (name: string) => pages.find((p) => p.name === name);

test("each app an idea comes from is named as the side panel names it", () => {
  const ai = sections.find((s) => s.slug === "ai-personalization");
  assert.equal(SOURCE_ORIGIN.convert.app, ai?.name);
  assert.equal(SOURCE_ORIGIN.buyers.app, ai?.name);
  assert.equal(SOURCE_ORIGIN.aeo.app, sections.find((s) => s.slug === "aeo")?.name);
  assert.equal(SOURCE_ORIGIN.seo.app, sections.find((s) => s.slug === "seo")?.name);
  for (const s of ["search", "chat", "brand"] as IdeaSource[]) {
    const p = page(SOURCE_ORIGIN[s].app);
    assert.ok(p, `${s}: "${SOURCE_ORIGIN[s].app}" is a page of the menus`);
    assert.equal(SOURCE_ORIGIN[s].href?.split("#")[0], p!.href, `${s} opens that page`);
  }
});

test("AI testing & personalization's ideas open the page of the menu they are on", () => {
  const insights = page(SOURCE_ORIGIN.convert.place!);
  assert.equal(insights?.section, "AI testing & personalization");
  assert.equal(SOURCE_ORIGIN.convert.href, insights?.href);
  // "What stops buyers" is the card of the Problem pages page
  assert.equal(SOURCE_ORIGIN.buyers.href, page("Problem pages")?.href);
});

test("SEO's two places are SEO's own pages", () => {
  for (const o of [PLACE_ORIGIN.seoQuickWin, PLACE_ORIGIN.seoDecay]) {
    const nav = SEO_NAV.find((e) => e.label === o.place);
    assert.ok(nav, o.place);
    assert.equal(o.href, nav!.href);
  }
});

test("a card says app · place; a filter says the source's name", () => {
  assert.equal(originLabel(SOURCE_ORIGIN.convert), "AI testing & personalization · Insights");
  assert.equal(sourceLabel("buyers"), "AI testing & personalization · What stops buyers");
  assert.equal(originLabel(PLACE_ORIGIN.aeoPrompt), "AEO & LLM Optimizer · Prompts and answers");
  assert.equal(sourceLabel("aeo"), "AEO & LLM Optimizer");
  assert.equal(sourceLabel("team"), "Own ideas");
  assert.ok(!Object.keys(SOURCE_ORIGIN).includes("plan"), "the Action plan is not a source of ideas (SARCLA 08.11.2026)");
});

test("never a short or internal name in a label", () => {
  for (const o of [...Object.values(SOURCE_ORIGIN), ...Object.values(PLACE_ORIGIN)]) {
    const label = originLabel(o);
    assert.doesNotMatch(label, /APSOconvert|Webyn|^AI testing$|Studio/, label);
  }
});

test("a project's board chip names the app its idea came from", () => {
  assert.equal(projectSourceLabel("convert"), "From AI testing & personalization");
  assert.equal(projectSourceLabel("buyers"), "From AI testing & personalization");
  assert.equal(projectSourceLabel("search"), "From Search bar");
  assert.equal(projectSourceLabel("team"), "Own idea");
  assert.equal(projectSourceLabel("geo"), "From GEO", "older projects keep theirs");
  assert.equal(projectSourceLabel("plan"), null, "an unknown source shows no chip");
  assert.equal(projectSourceLabel(null), null);
});
