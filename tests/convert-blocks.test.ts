// APSOconvert > optimizations per block (SARCLA 10.11.2026: "we cannot say where it is"; "for now propose optimization on
// current pages beside product pages ... block and module ... 3 or 4 versions"; "for now is completely replace the
// module"; "let say that we have thresholds"). The pure part: src/lib/convert/blockRules.ts - and the still picture
// opening at a block the hub found.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BLOCK, blockPage, blocksIn, clicksPerPart, nameOf, partName, partsWithClicks, shopPart, spreadStores, versionLabel, versionStep, weakBlock } from "../src/lib/convert/blockRules";
import { cleanPage, markFocus, previewCsp } from "../src/lib/convert/preview";
import { pageDoc } from "../src/lib/content/studio/kinds/page/model";
import { pageMap } from "../src/lib/content/studio/kinds/page/plan/places";
import { cleanPlan, pageWords } from "../src/lib/content/studio/kinds/page/plan/plan";
import { pickModule } from "../src/lib/content/studio/kinds/page/plan/library";

const B = "https://www.apsoparts.com";
const PAGE = `<!doctype html><html><head><title>Über uns</title></head><body>
<header class="page-header"><div><h2>Menü</h2></div></header>
<main id="maincontent" class="page-main"><div class="page-title-wrapper"><h1 class="page-title"><span>Über uns</span></h1></div>
<div class="columns"><div class="column main">
<div data-content-type="row" data-appearance="contained" data-element="main"><div data-element="inner" data-pb-style="AB12CD3"><div data-content-type="text"><h2>Willkommen bei APSOparts</h2><p>Ihr Onlineshop für Dichtungen. <a href="${B}/de-CH/dichtungstechnik.html">Dichtungstechnik</a></p></div></div></div>
<div data-content-type="row" data-appearance="contained" data-element="main"><div data-element="inner" data-pb-style="EF45GH6"><div data-content-type="text"><h2>Warum unsere Kunden immer wieder bestellen</h2><p>Die Website von APSOparts bietet ein einfaches Browsing-Erlebnis.</p><p><a class="action primary" href="${B}/de-CH/customer/account/create/">Konto erstellen</a></p></div></div></div>
</div></div></main><footer><div class="footer__newsletter"><h3>Newsletter</h3><p>Neuheiten zuerst.</p><form><input name="email"><button>Abonnieren</button></form></div></footer></body></html>`;

const view = () => pageDoc({ source: "pick", path: "/de-CH/support/about-us", store: "de-CH" });

test("product pages get no block optimization for now; home, category and content pages do", () => {
  assert.equal(blockPage("product"), false);
  assert.equal(blockPage("system"), false);
  assert.equal(blockPage("cms"), true);
  assert.equal(blockPage("category"), true);
  assert.equal(blockPage("home"), true);
});

test("a block is named so a person finds it: its place among the page's blocks and its heading", () => {
  const map = pageMap(PAGE, view());
  const own = map.parts.filter((p) => p.kind === "page");
  assert.ok(own.length >= 2);
  const quote = own.find((p) => p.heading.startsWith("Warum"))!;
  assert.match(nameOf(map.parts, quote.id), /^Block \d of \d · Warum unsere Kunden immer wieder bestellen$/);
  assert.equal(partName({ id: "P9", heading: "", text: "(no words - pictures: USPs_DE.png)", pb: undefined, holds: { products: 0, categories: 0, pictures: 1, links: 0 } }, 2, 5), "Block 2 of 5 · a picture");
  assert.equal(partName({ id: "P1", heading: "", text: "", pb: "slider", holds: { products: 0, categories: 0, pictures: 3, links: 3 } }, 1, 5), "Block 1 of 5 · the slider");
});

test("the click map's clicks are counted per block; a clickable block the clicks pass by is WEAK by the thresholds", () => {
  const map = pageMap(PAGE, view());
  const quote = map.parts.find((p) => p.heading.startsWith("Warum"))!;
  const welcome = map.parts.find((p) => p.heading.startsWith("Willkommen"))!;
  const heat = [
    { s: `div[data-pb-style="AB12CD3"] a`, n: 60 },
    { s: `div[data-pb-style="EF45GH6"] a.action.primary`, n: 1 },
    { s: "header.page-header h2", n: 20 },
    { s: "nav.nothing-here", n: 5 },
  ];
  const c = clicksPerPart(PAGE, map.parts, heat);
  assert.equal(c.total, 86);
  assert.equal(c.parts.find((x) => x.id === welcome.id)!.clicks, 60);
  assert.equal(c.parts.find((x) => x.id === quote.id)!.clicks, 1);
  assert.equal(c.elsewhere, 25);
  assert.equal(weakBlock(quote, c.parts.find((x) => x.id === quote.id), c.total), true);
  assert.equal(weakBlock(welcome, c.parts.find((x) => x.id === welcome.id), c.total), false);
  // too few clicks say nothing
  assert.equal(weakBlock(quote, { id: quote.id, clicks: 0, share: 0 }, BLOCK.minClicks - 1), false);
  const text = partsWithClicks(map.parts, c);
  assert.match(text, /1 clicks \(1\.2% of the page's 86\) · WEAK by the thresholds/);
  assert.match(text, /holds the page's H1 \(never replaced\)|Willkommen/);
});

test("the AI's blocks are kept when they are blocks it may replace, each with 2+ versions; the H1's block stays", () => {
  const parts: { id: string; kind: "page"; h1: boolean }[] = [{ id: "P1", kind: "page", h1: true }, { id: "P2", kind: "page", h1: false }, { id: "S1", kind: "page", h1: false }];
  const v = { module: "x", label: "A" };
  const r = blocksIn({ blocks: [
    { at: "P1", title: "Hero", why: "", expect: "", versions: [v, v, v] },
    { at: "p2", title: "Quote becomes proof", why: "1 click of 86", expect: "More clicks", versions: [v, v, v] },
    { at: "P2", title: "Twice", why: "", expect: "", versions: [v, v] },
    { at: "P7", title: "Nope", why: "", expect: "", versions: [v, v] },
    { at: "S1", title: "One version only", why: "", expect: "", versions: [v] },
  ] }, parts);
  assert.deepEqual(r.blocks.map((b) => b.at), ["P2"]);
  assert.equal(r.blocks[0].versions.length, 3);
  assert.equal(r.problems.length, 3);
  // a shop block asked for: only it
  assert.deepEqual(blocksIn({ blocks: [{ at: "P2", title: "x", why: "", expect: "", versions: [v, v] }, { at: "S1", title: "y", why: "", expect: "", versions: [v, v] }] }, parts, "S1").blocks.map((b) => b.at), ["S1"]);
});

test("a version REPLACES the whole block (phase 1): the Content plan resolves it to the block's own selector", () => {
  const map = pageMap(PAGE, view());
  const quote = map.parts.find((p) => p.heading.startsWith("Warum"))!;
  const points = pickModule((m) => m.takes === "none" && !m.needs.includes("picture") && m.words.some((w) => w.key === "points") && m.words.some((w) => w.key === "title"))!;
  const v = { module: points.id, layout: "", why: "Proof before the button", label: "Three reasons as a checklist", extras: [], link: "", link2: "",
    fill: { how: "none", category: "", numbers: "", count: 0 },
    words: { eyebrow: "", title: "Warum Kunden bei APSOparts bestellen", text: "", button: "", button2: "", faq: [], points: [{ title: "Einfach", text: "Browsing-Erlebnis" }, { title: "Konto", text: "für Geschäftskunden" }] } };
  const step = versionStep(v, quote.id);
  assert.equal(step.do, "replace");
  let n = 0;
  const plan = cleanPlan({ note: "", steps: [step] }, { parts: map.parts, container: map.container, categories: [], pageUrl: `${B}/de-CH/support/about-us`, pageKind: "cms", pageText: pageWords(map.parts), newId: () => `b${++n}`, lang: "de", store: "de-CH" });
  assert.equal(plan.steps.length, 1, JSON.stringify(plan.problems));
  assert.deepEqual(plan.steps[0].place, { how: "replace", selector: quote.selector });
  assert.equal(versionLabel(v, points.name), "Three reasons as a checklist");
  assert.equal(versionLabel({}, points.name), points.name);
});

test("a shop block outside the main column (the newsletter band) becomes a part the plan can replace", () => {
  const sp = shopPart(PAGE, "div.footer__newsletter", "Newsletter band")!;
  assert.equal(sp.selector, "div.footer__newsletter");
  assert.equal(sp.heading, "Newsletter");
  assert.match(sp.text, /Neuheiten zuerst/);
  assert.ok(sp.holds.links >= 1, "its form and button count as something to click");
  assert.equal(shopPart(PAGE, "div.nowhere", "x"), null);
});

test("the still Before picture opens at a block the hub found, whatever its selector", () => {
  const html = markFocus(PAGE, `div[data-pb-style="EF45GH6"]`);
  const at = html.indexOf('<a id="apso-focus"></a>');
  assert.ok(at > 0);
  assert.match(html.slice(at, at + 120), /<a id="apso-focus"><\/a><div class="apx-still-focus" data-element="inner" data-pb-style="EF45GH6">/);
  const map = pageMap(PAGE, view());
  const quote = map.parts.find((p) => p.heading.startsWith("Warum"))!;
  const h2 = markFocus(PAGE, quote.selector);
  assert.ok(h2.indexOf("apso-focus") < h2.indexOf("Warum unsere Kunden") && h2.indexOf("apso-focus") > h2.indexOf("Willkommen"));
});

test("a YouTube video the preview may not load shows its own still picture with a play mark (About us)", () => {
  const html = `<!doctype html><html><head></head><body><div class="pagebuilder-video-container"><iframe frameborder="0" allowfullscreen="" src="https://www.youtube.com/embed/TfCflmQYwhk?" data-element="video"></iframe></div></body></html>`;
  const out = cleanPage(html, { pageUrl: "https://www.apsoparts.com/de-CH/support/about-us", head: "", tail: "" }).html;
  assert.doesNotMatch(out, /<iframe/);
  assert.match(out, /<img src="https:\/\/i\.ytimg\.com\/vi\/TfCflmQYwhk\/hqdefault\.jpg"/);
  assert.match(previewCsp("https://www.apsoparts.com"), /img-src [^;]*https:\/\/i\.ytimg\.com/);
  assert.match(previewCsp("https://www.apsoparts.com"), /frame-src 'none'/);
});

test("the start batch reads every store view's home page first, then the store views in turn - de-CH no longer takes every place", () => {
  const list = ["/de-CH/a.html", "/de-CH/b.html", "/de-CH/c.html", "/fr-CH/a.html", "/de-CH/", "/fr-CH/", "/en-CH/x.html", "/it-CH/"].map((path) => ({ path }));
  const store = (p: string) => p.split("/")[1];
  const home = (p: string) => /^\/[a-z]{2}-[A-Z]{2}\/$/.test(p);
  assert.deepEqual(spreadStores(list, store, home).map((p) => p.path), [
    "/de-CH/", "/fr-CH/", "/it-CH/",
    "/de-CH/a.html", "/fr-CH/a.html", "/en-CH/x.html",
    "/de-CH/b.html",
    "/de-CH/c.html",
  ]);
  assert.deepEqual(spreadStores([], store, home), []);
});

test("SEO landing page lists the landing pages to optimize - the hub's own first, then the shop's content pages, never a product page", async () => {
  const { landingRows } = await import("../src/lib/convert/landing");
  const g = (path: string, kind: "cms" | "product" | "category", impressions: number, missed: number) => ({ path, url: `https://www.apsoparts.com${path}`, kind, clicks: 3, impressions, ctr: 3 / impressions, position: 8, typical: 0.02, missed, reasons: [], queries: [] });
  const seo = { rows: [g("/de-CH/o-ring-guide", "cms", 900, 20), g("/de-CH/kalrez", "cms", 4000, 5), g("/de-CH/p/123.html", "product", 9000, 90), g("/de-CH/ours", "cms", 300, 1)] } as never;
  const hub = [
    { env: "prod" as const, store: "de-CH", path: "/de-CH/ours", url: "https://www.apsoparts.com/de-CH/ours", at: "2026-11-11T10:00:00Z", action: "created" as const, kind: "cms" as const, pieceId: 7, projectId: 3, title: "Our page" },
    { env: "acc" as const, store: "en-CH", path: "/en-CH/ours", url: "https://acc.apsoparts.com/en-CH/ours", at: "2026-11-11T09:00:00Z", action: "created" as const, kind: "cms" as const, pieceId: 7, projectId: 3, title: "Our page" },
  ];
  const ideas = [{ env: "prod" as const, path: "/de-CH/kalrez", status: "proposed" as const, contentType: "page-refresh" as const }, { env: "prod" as const, path: "/de-CH/kalrez", status: "proposed" as const, contentType: "landing-page" as const }];
  const rows = landingRows(hub, seo, ideas);
  assert.deepEqual(rows.map((r) => `${r.ours ? "ours" : "shop"} ${r.env}${r.path}`), [
    "ours prod/de-CH/ours", "ours acc/en-CH/ours", "shop prod/de-CH/o-ring-guide", "shop prod/de-CH/kalrez",
  ]);
  assert.equal(rows[0].shown, 300, "our production page carries its Google numbers");
  assert.equal(rows[1].shown, null, "an ACC page has none");
  assert.equal(rows[3].open, 1, "a new-page idea is not one of the page's own optimizations");
});

test("a CMS page's update goes through its own store view - production refuses /rest/all; a page of all or several store views stays on all", async () => {
  const { updateStore } = await import("../src/lib/convert/cmsStore");
  const { STORE_VIEWS } = await import("../src/lib/content/studio/kinds/page/storeViews");
  const one = STORE_VIEWS.find((v) => v.id && v.code)!;
  assert.equal(updateStore([one.id]), one.code);
  assert.equal(updateStore(one.id), one.code);
  assert.equal(updateStore([0]), "all");
  assert.equal(updateStore([one.id, 99]), "all");
  assert.equal(updateStore(undefined), "all");
  assert.equal(updateStore([987654]), "all");
});

test("a home page is reworked as a whole - one optimization, a version per angle; other pages stay per block", async () => {
  const { REWORK_ANGLES, REWORK_PART, isRework, reworkPage } = await import("../src/lib/convert/blockRules");
  assert.equal(reworkPage("home"), true);
  assert.equal(reworkPage("category"), false);
  assert.equal(reworkPage("cms"), false);
  assert.equal(isRework({ scope: "page", part: REWORK_PART }), true);
  assert.equal(isRework({ scope: "block", part: REWORK_PART }), false, "a block's optimization is never the rework");
  assert.equal(isRework({ scope: "page", part: null }), false);
  assert.equal(REWORK_ANGLES.length, 3);
  assert.equal(new Set(REWORK_ANGLES.map((a) => a.label)).size, 3, "each version its own angle");
  for (const a of REWORK_ANGLES) assert.match(a.request, /WHOLE page/);
});
