import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanPage, outline, previewCsp, selectorOf, shimSource, staticBase, stillPage } from "../src/lib/convert/preview";
import { describe, runtimeSource, scriptJson, validateChanges } from "../src/lib/convert/versions";

test("validateChanges: keeps what a version may do, says why the rest is left out", () => {
  const { changes, problems } = validateChanges([
    { op: "css", css: ".a{color:red}", note: "red" },
    { op: "insert", selector: "#maincontent", where: "prepend", html: "<p class=\"apx-x\">Hallo</p>" },
    { op: "text", selector: "h1.page-title", text: "Neu" },
    { op: "hide", selector: ".x", all: true },
    { op: "attr", selector: "a.y", name: "title", value: "ok" },
    { op: "html", selector: ".z", html: "<img src=x onerror=alert(1)>" },
    { op: "html", selector: ".z", html: "<script>alert(1)</script>" },
    { op: "insert", selector: ".z", where: "inside", html: "<p>x</p>" },
    { op: "attr", selector: "a", name: "onclick", value: "x" },
    { op: "attr", selector: "a", name: "href", value: "javascript:alert(1)" },
    { op: "css", css: "@import url(x.css)" },
    { op: "css", css: "a{}</style><script>" },
    { op: "text", selector: "a{color:red}", text: "x" },
    { op: "js", js: "alert(1)" },
    "nonsense",
  ]);
  assert.deepEqual(changes.map((c) => c.op), ["css", "insert", "text", "hide", "attr"]);
  assert.equal(changes[3].op === "hide" && changes[3].all, true);
  assert.equal(problems.length, 10);
  assert.match(problems.join("\n"), /event handler/);
  assert.match(problems.join("\n"), /<script>/);
  assert.match(problems.join("\n"), /where/);
  assert.match(problems.join("\n"), /attribute name not allowed/);
  assert.match(problems.join("\n"), /javascript: address/);
  assert.match(problems.join("\n"), /@import/);
  assert.match(problems.join("\n"), /unknown kind "js"/);
  assert.deepEqual(validateChanges("x").problems, ["the changes are not a list"]);
  assert.equal(validateChanges(Array.from({ length: 50 }, () => ({ op: "hide", selector: ".a" }))).changes.length, 40);
});

test("describe: the note first, else a short line of what changes", () => {
  assert.equal(describe({ op: "hide", selector: ".a", note: "Hides the filter" }), "Hides the filter");
  assert.equal(describe({ op: "hide", selector: ".a" }), ".a hidden");
  assert.equal(describe({ op: "insert", selector: "#m", where: "after", html: "<p>x</p>" }), "New block after #m");
});

test("scriptJson and runtimeSource: no way out of the <script>, and the runtime is valid JavaScript", () => {
  const j = scriptJson({ html: "</script><script>alert(1)</script>", t: "a" + String.fromCharCode(0x2028) + "b" });
  assert.ok(!j.includes("<"));
  assert.ok(!j.includes(String.fromCharCode(0x2028)));
  assert.deepEqual(JSON.parse(j), { html: "</script><script>alert(1)</script>", t: "a" + String.fromCharCode(0x2028) + "b" });
  const src = runtimeSource([{ op: "css", css: "a{}" }, { op: "text", selector: "h1", text: "</script>" }], { report: true });
  assert.ok(!src.includes("</script>"));
  assert.doesNotThrow(() => new Function(src));
});

test("runtimeSource: lays the changes over a page and reports what found its element", () => {
  // a tiny DOM: enough for the runtime's querySelector, replaceWith, insertBefore, textContent and setAttribute
  type El = { tag: string; cls: string; text: string; attrs: Record<string, string>; parent: El | null; kids: El[]; style: Record<string, string> };
  const mk = (tag: string, cls = "", parent: El | null = null): El => {
    const e: El = { tag, cls, text: "", attrs: {}, parent, kids: [], style: {} };
    if (parent) parent.kids.push(e);
    return e;
  };
  const root = mk("html");
  const head = mk("head", "", root);
  const body = mk("body", "", root);
  const h1 = mk("h1", "page-title", body);
  const box = mk("div", "box", body);
  const all = (e: El): El[] => [e, ...e.kids.flatMap(all)];
  const match = (e: El, sel: string) => sel.split(",").some((s) => { const [t, c] = s.trim().split("."); return (!t || e.tag === t) && (!c || e.cls.split(" ").includes(c)); });
  const wrap = (e: El): unknown => ({
    get textContent() { return e.text; }, set textContent(v: string) { e.text = v; },
    setAttribute: (k: string, v: string) => { e.attrs[k] = v; },
    style: { setProperty: (k: string, v: string) => { e.style[k] = v; } },
    closest: () => null,
    get parentNode() { return e.parent ? wrap(e.parent) : null; },
    insertBefore: () => { e.kids.push(mk("p", "apx-new")); },
    appendChild: (n: { tag?: string }) => { if (n.tag === "style") e.kids.push(mk("style")); else e.kids.push(mk("p", "apx-new")); },
    set innerHTML(v: string) { e.text = v; },
  });
  const sent: unknown[] = [];
  const doc = {
    readyState: "complete",
    head: wrap(head), documentElement: wrap(root),
    createElement: (t: string) => t === "template"
      ? { set innerHTML(_v: string) { /* parsed */ }, content: { children: [{ setAttribute: () => {} }] } }
      : { tag: t, setAttribute: () => {}, textContent: "" },
    querySelector: (sel: string) => { const f = all(root).find((e) => match(e, sel)); return f ? wrap(f) : null; },
    querySelectorAll: (sel: string) => all(root).filter((e) => match(e, sel)).map(wrap),
  };
  const timers: (() => void)[] = [];
  const src = runtimeSource([
    { op: "css", css: ".x{}" },
    { op: "text", selector: "h1.page-title", text: "Neu" },
    { op: "hide", selector: "div.box" },
    { op: "attr", selector: "h1", name: "data-x", value: "1" },
    { op: "insert", selector: "div.box", where: "prepend", html: "<p>Hallo</p>" },
    { op: "text", selector: "span.nowhere", text: "x" },
  ], { report: true, waitMs: 500 });
  new Function("document", "window", "parent", "setTimeout", "MutationObserver", src)(
    doc, {}, { postMessage: (m: unknown) => sent.push(m) }, (f: () => void) => { timers.push(f); }, undefined,
  );
  timers.forEach((f) => f());
  assert.equal(h1.text, "Neu");
  assert.equal(h1.attrs["data-x"], "1");
  assert.equal(box.style.display, "none");
  assert.ok(box.kids.some((k) => k.cls === "apx-new"));
  assert.ok(head.kids.some((k) => k.tag === "style"));
  assert.deepEqual(sent, [{ apsoPreview: "applied", hit: [1, 1, 1, 1, 1, 0] }]);
});

test("cleanPage: outside scripts, tag manager, prefetch rules and the page's <base> go; ours come in", () => {
  const html = `<!doctype html><html><head><title>T</title><base href="/x/">
<script src="https://www.googletagmanager.com/gtm.js?id=GTM-1"></script>
<script src="https://smart-search-production.up.railway.app/demo/smart-search.js"></script>
<script src="https://acc.apsoparts.com/static/version1/frontend/ANP/default/de_DE/requirejs/require.js"></script>
<script src="/static/x.js"></script>
<script>window.dataLayer=[];(function(w){w.gtag=1})(window);gtag('config','x')</script>
<script>var keep=1;</script>
<script type="speculationrules">{"prefetch":[]}</script>
<link rel="prefetch" href="/a.html"><link rel="stylesheet" href="/s.css">
</head><body><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-1"></iframe></noscript>
<svg><use xlink:href="https://acc.apsoparts.com/static/version1/frontend/ANP/default/de_DE/images/icons.svg#plus"></use></svg></body></html>`;
  const { html: out, removed } = cleanPage(html, {
    pageUrl: "https://acc.apsoparts.com/de-CH/a.html", head: "<script>/*SHIM*/</script>", tail: "<style>/*V*/</style>",
    sprite: { url: "https://acc.apsoparts.com/static/version1/frontend/ANP/default/de_DE/images/icons.svg", svg: `<?xml version="1.0"?><svg><symbol id="plus"></symbol></svg>` },
  });
  assert.deepEqual(removed, { scripts: 2, trackers: 2, prefetch: 2 });
  assert.ok(!out.includes("googletagmanager"));
  assert.ok(!out.includes("railway.app"));
  assert.ok(out.includes("require.js") && out.includes("/static/x.js") && out.includes("var keep=1"));
  assert.ok(out.includes("/s.css"));
  assert.ok(!out.includes('<base href="/x/">'));
  assert.match(out, /<head><base href="https:\/\/acc\.apsoparts\.com\/de-CH\/a\.html"><meta name="referrer" content="no-referrer"><script>window\.__apsoSprite=/);
  assert.ok(out.indexOf("/*SHIM*/") < out.indexOf("<title>"));
  assert.ok(out.indexOf("/*V*/") < out.indexOf("</head>") && out.indexOf("/*V*/") > out.indexOf("var keep=1"));
  assert.ok(out.includes('<use xlink:href="#plus">'));
  assert.ok(out.includes('<symbol id="plus">') && !out.includes("<?xml"));
});

test("previewCsp: the shop's own files only, nothing sent, framed by the hub only", () => {
  const csp = previewCsp("https://acc.apsoparts.com");
  assert.match(csp, /^sandbox allow-scripts;/);
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /script-src 'unsafe-inline' 'unsafe-eval' https:\/\/acc\.apsoparts\.com https:\/\/www\.apsoparts\.com;/);
  assert.ok(!csp.includes("googletagmanager") && !csp.includes("railway") && !csp.includes("p.typekit.net"));
  assert.equal(previewCsp("https://www.apsoparts.com").match(/www\.apsoparts\.com/g)?.length, 6);
  assert.doesNotThrow(() => new Function(shimSource()));
});

test("staticBase and selectorOf", () => {
  assert.equal(staticBase(`<script src="https://www.apsoparts.com/static/version1793025842/frontend/ANP/default/de_DE/requirejs/require.js">`),
    "https://www.apsoparts.com/static/version1793025842/frontend/ANP/default/de_DE/");
  assert.equal(staticBase("<p>none</p>"), null);
  assert.equal(selectorOf("div", ` id="maincontent" class="a"`), "#maincontent");
  assert.equal(selectorOf("div", ` id="ui-id-3" class="product-info-main active clearfix x"`), "div.product-info-main.x");
  assert.equal(selectorOf("span", ""), "span");
});

test("outline: the main column in page order, own text per element, no hidden field, cuts marked", () => {
  const long = "x".repeat(300);
  const html = `<html><head><title>Maschinenfuss | APSOparts</title><meta name="description" content="Ein Fuss &amp; mehr"></head><body>
<header><a href="/">Logo</a></header>
<main id="maincontent" class="page-main">
  <div class="page-title-wrapper"><h1 class="page-title"><span class="base">APSOvib&reg; Fuss</span></h1></div>
  <input name="form_key" type="hidden" value="SECRET1234" />
  <div class="product-info"><h2 class="product__section__headline">Technische Zusammenfassung</h2>
    <table><tr><th>Farbe</th><td><div class="show-more-content">schwarz</div></td></tr></table>
    <p class="long">${long}</p>
    <script>var no = "script text";</script>
    <img class="photo" src="/a.jpg" alt="Foto">
    <button class="action primary"><span>In den Warenkorb</span></button>
  </div>
</main><footer>Footer</footer></body></html>`;
  const o = outline(html);
  assert.equal(o.title, "Maschinenfuss | APSOparts");
  assert.equal(o.description, "Ein Fuss & mehr");
  assert.deepEqual(o.h1, ["APSOvib® Fuss"]);
  const text = o.lines.join("\n");
  assert.ok(!text.includes("SECRET1234") && !text.includes("script text") && !text.includes("Logo") && !text.includes("Footer"));
  assert.match(o.lines[0], /^ +h1\.page-title · APSOvib® Fuss$/);
  const at = (s: string) => o.lines.findIndex((l) => l.includes(s));
  assert.ok(at("Technische") < at("Farbe") && at("Farbe") < at("schwarz") && at("schwarz") < at("p.long") && at("p.long") < at("[picture: Foto]"));
  assert.match(o.lines[at("button")], /button\.action\.primary · In den Warenkorb/);
  assert.ok(o.lines[at("p.long")].endsWith("…"));
  assert.equal(o.truncated, false);
  assert.equal(outline(html, { maxLines: 2 }).truncated, true);
});

test("projectForPage: a Content Studio project of a page - its type, its language, its ideas, its marker", async () => {
  const { contentTypeForPage, languageOf, markerOf, pageMarker, projectForPage } = await import("../src/lib/convert/handoff");
  assert.equal(contentTypeForPage("/de-CH/12202510-maschinenfuss.html"), "page-refresh"); // the Page builder, a product page too
  assert.equal(contentTypeForPage("/fr-CH/etancheite.html"), "page-refresh");
  assert.equal(languageOf("/fr-CH/etancheite.html"), "French");
  assert.equal(languageOf("/"), null);
  const p = projectForPage({
    env: "prod", path: "/de-CH/12202510-maschinenfuss.html", url: "https://www.apsoparts.com/de-CH/12202510-maschinenfuss.html",
    h1: "APSOvib® Maschinenfuss NIVOBLOC", title: "x",
    numbers: { views: 1200, rate: 0.01, typical: 0.08, companies: 4, lost: 3, topLoss: "priced and left", reasons: ["1,200 views, 1.0% put something in the cart"], from: "2026-10-08", to: "2026-11-06" },
    ideas: [{ title: "Put the table first", why: "the table is far down", change: "Move the articles table up", expect: "more add-to-carts" }],
    version: { rev: 2, summary: "Table first, a heading above it" },
    previewPath: "https://hub/website/ai-personalization/preview?env=prod&path=%2Fde-CH%2F12202510-maschinenfuss.html",
  });
  assert.equal(p.title, "Shop page: APSOvib® Maschinenfuss NIVOBLOC");
  assert.equal(p.contentType, "page-refresh");
  assert.match(p.brief, /Write in German - the page's store view is de-CH/);
  assert.match(p.brief, /cart rate 1\.0% where similar pages make 8\.0%; 3 of 4 signed-in customers .* "priced and left"/);
  assert.match(p.brief, /1\. Put the table first\n {3}Change: Move the articles table up/);
  assert.match(p.brief, /revision 2/);
  assert.ok(p.brief.endsWith(pageMarker("prod", "/de-CH/12202510-maschinenfuss.html")));
  assert.deepEqual(markerOf(p.brief), { env: "prod", path: "/de-CH/12202510-maschinenfuss.html" });
  assert.equal(markerOf("no marker"), null);
  const big = projectForPage({ env: "acc", path: "/de-CH/x.html", url: "u", h1: "", title: "T", numbers: null, version: null, previewPath: "p",
    ideas: Array.from({ length: 30 }, (_, i) => ({ title: `Idea ${i}`, why: "w".repeat(200), change: "c".repeat(200), expect: "e" })) });
  assert.ok(big.brief.length <= 6000);
  assert.deepEqual(markerOf(big.brief), { env: "acc", path: "/de-CH/x.html" });
  assert.ok(JSON.stringify(big).length < 7800);
});

test("shimSource keeps its regular expressions whole (a template string once ate the backslashes: 's' letters vanished)", () => {
  const s = shimSource();
  const BS = String.fromCharCode(92);
  assert.ok(s.includes("/" + BS + "s+/g"));
  assert.ok(s.includes("[" + BS + "w-]"));
  assert.ok(!s.includes("[w-]"));
  // every whitespace squeeze whole - not one that became /s+/ (09.11: the click map's element names nearly lost theirs)
  assert.ok(!s.includes("(/s+/g"), "a /s+/ (letters s) instead of /" + BS + "s+/ (white space)");
  assert.ok(!s.includes(String.fromCharCode(0)), "no NUL byte");
  assert.ok(s.includes("apsoPreviewHeat") && s.includes("t:\"heat\""), "the click map's heat and its report back");
  assert.doesNotThrow(() => new Function(s));
});

test("assets: the day key, the files it opens, and the shop's addresses in their three spellings", async () => {
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret-for-the-asset-key";
  const { assetKey, keyOk, assetPath, assetBase, rewriteShopUrls, hubOriginOf } = await import("../src/lib/convert/assets");
  const now = Date.parse("2026-11-08T10:00:00Z");
  const k = assetKey("prod", now);
  assert.equal(k.length, 24);
  assert.ok(keyOk("prod", k, now));
  assert.ok(keyOk("prod", k, now + 86_400_000), "yesterday's key still opens");
  assert.ok(!keyOk("prod", k, now + 2 * 86_400_000), "the day before yesterday's does not");
  assert.ok(!keyOk("acc", k, now), "a key is for one shop");
  assert.ok(!keyOk("prod", "x".repeat(24), now));
  assert.equal(assetPath(["static", "version1", "frontend", "a.css"]), "/static/version1/frontend/a.css");
  assert.equal(assetPath(["media", "catalog", "p.jpg"]), "/media/catalog/p.jpg");
  assert.equal(assetPath(["de-CH", "checkout", "cart"]), null);
  assert.equal(assetPath(["static", "..", "app", "etc", "env.php"]), null);
  assert.equal(assetPath(["static", "a b.css"]), null);
  const hub = "https://hub.example";
  const base = assetBase(hub, "prod");
  const BS = String.fromCharCode(92);
  const esc = (x: string) => x.split(":").join(BS + "u003A").split("/").join(BS + "u002F");
  const page = [
    `<link href="https://www.apsoparts.com/static/version1/a.css">`,
    `"src":"https:${BS}/${BS}/www.apsoparts.com${BS}/media${BS}/p.jpg"`,
    `var require = { 'baseUrl': '${esc("https://acc.apsoparts.com/static/version1/frontend")}' }`,
    `<a href="https://www.apsoparts.com/de-CH/x.html">`,
  ].join("\n");
  const out = rewriteShopUrls(page, hub);
  assert.ok(out.includes(`${base}/static/version1/a.css`));
  assert.ok(out.includes(`${base.split("/").join(BS + "/")}${BS}/media${BS}/p.jpg`));
  assert.ok(out.includes(esc(`${assetBase(hub, "acc")}/static/version1/frontend`)));
  assert.ok(out.includes(`href="https://www.apsoparts.com/de-CH/x.html"`), "page links stay on the shop");
  const h = new Headers({ host: "internal:3000", "x-forwarded-host": "apsomarketinghub-dev.awssandbox.angst-pfister.com", "x-forwarded-proto": "https" });
  assert.equal(hubOriginOf(h, "http://internal:3000"), "https://apsomarketinghub-dev.awssandbox.angst-pfister.com");
  assert.equal(hubOriginOf(new Headers({ host: "localhost:3100" }), "http://localhost:3100"), "http://localhost:3100");
});

test("stillPage: a page's still picture runs nothing and says nothing about JavaScript", () => {
  const html = '<html><head><script src="/static/x.js"></script><title>T</title></head><body><noscript><div>JavaScript seems to be disabled</div></noscript><main id="maincontent"><h1>Seite</h1></main><script>alert(1)</script></body></html>';
  const out = stillPage(html);
  assert.equal(/<script/i.test(out), false);
  assert.equal(/noscript|JavaScript seems/i.test(out), false);
  assert.match(out, /<style data-apso-still>[^<]*<\/style><\/head>/);
  assert.match(out, /<main id="maincontent"><h1>Seite<\/h1><\/main>/);
});

test("handoff: a test's winner carries its test in the marker and a Winner line in the brief", async () => {
  const { markerOf, pageMarker, projectForPage } = await import("../src/lib/convert/handoff");
  assert.equal(pageMarker("prod", "/de-CH/x.html", "12"), "[APSOconvert page prod:/de-CH/x.html test:12]");
  assert.deepEqual(markerOf("…\n[APSOconvert page prod:/de-CH/x.html test:12]"), { env: "prod", path: "/de-CH/x.html", testId: "12" });
  assert.deepEqual(markerOf("[APSOconvert page acc:/de-CH/y.html]"), { env: "acc", path: "/de-CH/y.html" });
  const p = projectForPage({
    env: "prod", path: "/de-CH/12202510-maschinenfuss.html", url: "https://www.apsoparts.com/de-CH/12202510-maschinenfuss.html", h1: "Maschinenfuss", title: "",
    numbers: null, ideas: [], version: { rev: 2, summary: "Article table first" }, previewPath: "/website/ai-personalization/preview",
    test: { id: "7", rateA: 0.03, rateB: 0.042, uplift: 0.4, pB: 0.97, visitors: 1200, days: 15, decidedBy: "Claudio Saraiva", decidedAt: "2026-11-20T10:00:00Z" },
  });
  assert.match(p.title, /^Winner: Maschinenfuss/);
  assert.match(p.brief, /Winner of page test #7: 4\.2% .* against 3\.0% .*uplift \+40\.0%, 97% sure/);
  assert.ok(p.brief.endsWith("[APSOconvert page prod:/de-CH/12202510-maschinenfuss.html test:7]"));
  assert.equal(markerOf(p.brief)?.testId, "7");
});

test("stillPage with a focus: nothing runs - an anchor and an outline before the block, else before #maincontent; lazy images", () => {
  const out = stillPage('<html><head></head><body><script>shop()</script><main id="maincontent"><div class="a x b">a</div><img src="p.jpg"></main></body></html>', "div.x");
  assert.equal(/<script/i.test(out), false);
  assert.ok(out.includes('<a id="apso-focus"></a><div class="apx-still-focus a x b">'));
  assert.ok(out.includes('<img loading="lazy" decoding="async" src="p.jpg">'));
  const miss = stillPage('<html><head></head><body><main id="maincontent"><p>x</p></main></body></html>', "section.none");
  assert.ok(miss.includes('<a id="apso-focus"></a><main id="maincontent">'));
  const byId = stillPage('<html><head></head><body><div id="q" class="k">x</div></body></html>', "#q");
  assert.ok(byId.includes('<a id="apso-focus"></a><div id="q" class="apx-still-focus k">'));
});
