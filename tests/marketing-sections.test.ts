import assert from "node:assert/strict";
import { test } from "node:test";
import { APPS, MARKETING_SECTIONS, UC_SECTIONS, WEBSITE_SECTIONS } from "../src/app/hubApps";
import { appForPath } from "../src/lib/auth/access";
import { accessAt, isNodeKey, levelsOf, nodeByKey, nodeFor } from "../src/lib/auth/tree";
import { REPORT_CATEGORIES } from "../src/lib/reporting/categories";

// SARCLA 07.11.2026: "let's start to split it like website or UC by main categories" - Content, SEO, SEA, GEO,
// AEO and LLM Optimizer.

const marketing = APPS.find((a) => a.key === "marketing")!;

test("the sections are the five SARCLA named, in his order", () => {
  assert.deepEqual(MARKETING_SECTIONS.map((s) => s.name), ["Content", "SEO", "SEA", "GEO", "AEO & LLM Optimizer"]);
});

test("every page kept its access key: the app lists exactly the pages it listed before the split", () => {
  // the subs before 07.11.2026 - a grant is on one of these addresses, so none may go and none may come with the split
  const before = ["/projects", "/personality", "/create", "/library", "/templates", "/seo", "/seo/quick-wins", "/seo/impact", "/geo", "/aeo"];
  assert.deepEqual(marketing.subs.map((s) => s.href), before);
  for (const h of before) assert.ok(isNodeKey(`marketing:${h}`), h);
  // each now under its section's heading
  assert.equal(nodeByKey("marketing:/seo/quick-wins")?.parent, "marketing#SEO");
  assert.equal(nodeByKey("marketing:/projects")?.parent, "marketing#Content");
  assert.equal(nodeByKey("marketing:/aeo")?.parent, "marketing#AEO & LLM Optimizer");
  // an empty section has no heading in the tree: nothing in it to grant
  assert.equal(isNodeKey("marketing#SEA"), false);
});

test("a page the menus list beside a section page still answers to that page's grant", () => {
  assert.equal(nodeFor("marketing", "/seo/decay")?.name, "SEO");
  assert.equal(nodeFor("marketing", "/geo/fix-queue")?.name, "GEO readiness");
  assert.equal(nodeFor("marketing", "/aeo/prompts")?.name, "AI answers (AEO)");
  assert.equal(nodeFor("marketing", "/projects/12")?.name, "Projects");
  // SEO taken away: its other pages go with it, as before the split
  const lv = levelsOf("user", { marketing: "read", "marketing:/seo": "none" });
  assert.equal(accessAt("/seo/decay", lv).level, "none");
  assert.equal(accessAt("/geo/live", lv).level, "read");
  assert.equal(accessAt("/projects", lv).level, "read");
});

test("the front page and the doorways are the app's own addresses", () => {
  assert.equal(marketing.href, "/marketing");
  assert.equal(appForPath("/marketing"), "marketing");
  for (const s of MARKETING_SECTIONS) assert.equal(appForPath(`/marketing/${s.slug}`), "marketing");
  assert.deepEqual(marketing.cards?.map((c) => c.href), MARKETING_SECTIONS.map((s) => `/marketing/${s.slug}`));
});

test("no other app or report lists a Marketing page, so no tile here hands its panel to another app", () => {
  const ours = new Set(MARKETING_SECTIONS.flatMap((s) => s.pages.map((p) => p.href)));
  const elsewhere = [
    ...WEBSITE_SECTIONS.flatMap((s) => s.pages.map((p) => p.href)),
    ...UC_SECTIONS.flatMap((s) => s.pages.map((p) => p.href)),
    ...REPORT_CATEGORIES.flatMap((c) => c.reports.flatMap((r) => [r.href, r.overviewHref ?? r.href, ...(r.children ?? []).map((k) => k.href)])),
    ...APPS.filter((a) => a.key !== "marketing").flatMap((a) => a.subs.map((x) => x.href)),
  ];
  for (const h of elsewhere) assert.ok(!ours.has(h.split("?")[0]), h);
  // section slugs are unique, and none is a page's own address
  assert.equal(new Set(MARKETING_SECTIONS.map((s) => s.slug)).size, MARKETING_SECTIONS.length);
});
