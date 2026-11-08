import assert from "node:assert/strict";
import { test } from "node:test";
import {
  absoluteCss, applyChanges, innerOf, insideOf, markFragment, parseHtml, parseSelector, selectAll, stillPage, stylesheetsOf,
} from "../src/lib/content/studio/kinds/page/apply";

// The page studio lays a version over the shop's page on the server, as APSOconvert's script does in the browser
// (08.11.2026): the preview frame runs no script.

const PAGE = `<!doctype html><html><head><title>T</title><link rel="stylesheet" href="/static/css/styles-m.css" media="all">
<script>var x = "<div id='fake'>";</script></head><body class="cms-page">
<main id="maincontent" class="page-main"><div class="columns"><div class="column main">
<h1 class="page-title"><span>Dichtungen</span></h1>
<p class="intro">One<p class="second">Two
<ul class="list"><li>a<li class="b">b<li>c</ul>
<img src="/media/x.jpg" alt="x"><br>
<table><tr><td>1<td class="k">2</tr></table>
<svg><use href="#i"/><path d="M0"/></svg>
<div class="box" data-x="a&amp;b">Box</div>
</div></div></main><footer id="f">F</footer></body></html>`;

const sel = (html: string, s: string) => {
  const g = parseSelector(s);
  assert.ok(g, `readable: ${s}`);
  return selectAll(parseHtml(html), g).map((n) => html.slice(n.start, n.openEnd));
};

test("the tree finds what a browser finds: implicit closes, void tags, raw text, svg", () => {
  assert.deepEqual(sel(PAGE, "#fake"), [], "a tag inside a script is not an element");
  assert.equal(sel(PAGE, "p").length, 2);
  assert.equal(sel(PAGE, "ul.list > li").length, 3, "an <li> closes the one before");
  assert.equal(sel(PAGE, "li.b + li").length, 1);
  assert.equal(sel(PAGE, "td.k").length, 1);
  assert.equal(sel(PAGE, "svg > path").length, 1, "a self-closed tag inside svg is closed");
  assert.equal(sel(PAGE, "#maincontent .column.main h1 span").length, 1);
  assert.equal(sel(PAGE, "[data-x='a&b']").length, 1, "attribute values are read with their entities");
  assert.equal(sel(PAGE, "li:first-child").length, 1);
  assert.equal(sel(PAGE, "li:nth-child(odd)").length, 2);
  assert.equal(sel(PAGE, "li:not(.b)").length, 2);
  assert.equal(sel(PAGE, "h1, footer").length, 2);
  assert.equal(sel(PAGE, "main ~ footer").length, 1);
  assert.equal(parseSelector("a:hover"), null, "what the reader does not know is said, never guessed");
  assert.equal(parseSelector("div:has(p)"), null);
  assert.equal(parseSelector("p::before"), null);
});

test("each kind of change does what the browser script does", () => {
  const html = `<html><head></head><body><div id="a"><p class="t">Old</p><p class="t">Two</p></div><span id="s" style="color:red">S</span></body></html>`;
  const r = applyChanges(html, [
    { op: "css", css: ".x{color:blue}" },
    { op: "text", selector: "p.t", text: "New <b>" },
    { op: "insert", selector: "#a", where: "after", html: `<section class="apx-n">N</section>` },
    { op: "hide", selector: "#s" },
    { op: "attr", selector: "#a", name: "title", value: `say "hi"` },
    { op: "html", selector: "#nothing", html: "x" },
    { op: "hide", selector: "a:hover" },
  ]);
  assert.deepEqual(r.hits.map((h) => h.state), ["css", "found", "found", "found", "found", "missing", "unread"]);
  assert.match(r.html, /<p class="t">New &lt;b&gt;<\/p><p class="t">Two<\/p>/, "the first only, the text escaped");
  assert.match(r.html, /<\/div><section data-apso-v="" class="apx-n">N<\/section>/);
  assert.match(r.html, /style="color:red;display:none !important"/);
  assert.match(r.html, /<div title="say &quot;hi&quot;" id="a">/, "a new attribute goes after the tag name");
  assert.match(r.html, /<style data-apso-version>\.x\{color:blue\}<\/style><\/head>/);
});

test("all = every element; what a version put in is left alone by later changes", () => {
  const html = `<body><ul><li>1</li><li>2</li></ul></body>`;
  const r = applyChanges(html, [
    { op: "insert", selector: "ul", where: "append", html: "<li>3</li>" },
    { op: "text", selector: "li", text: "x", all: true },
  ]);
  assert.equal(r.hits[1].count, 2);
  assert.equal(r.html, `<body><ul><li>x</li><li>x</li><li data-apso-v="">3</li></ul></body>`);
});

test("a change may aim at what an earlier html change wrote (a new page's body, then its heading)", () => {
  const html = `<body><main id="maincontent"><h1>Shell</h1></main></body>`;
  const r = applyChanges(html, [
    { op: "html", selector: "#maincontent", html: `<div class="apx-page"><h1>New</h1></div>` },
    { op: "text", selector: "#maincontent h1", text: "Newer" },
  ]);
  assert.equal(r.html, `<body><main id="maincontent"><div class="apx-page"><h1>Newer</h1></div></main></body>`);
});

test("nested matches: the inner change goes with the outer content; inserts at one place keep page order", () => {
  const nested = applyChanges(`<div class="a"><div class="a">in</div></div>`, [{ op: "html", selector: "div.a", html: "X", all: true }]);
  assert.equal(nested.html, `<div class="a">X</div>`);
  const order = applyChanges(`<i id="a"></i><i id="b"></i>`, [
    { op: "insert", selector: "i", where: "after", html: "<b>1</b>", all: true },
  ]);
  assert.equal(order.html, `<i id="a"></i><b data-apso-v="">1</b><i id="b"></i><b data-apso-v="">1</b>`);
});

test("markFragment marks the top elements only", () => {
  assert.equal(markFragment(`<p>a<b>b</b></p> text <div></div>`), `<p data-apso-v="">a<b>b</b></p> text <div data-apso-v=""></div>`);
});

test("innerOf and insideOf read the CMS content area", () => {
  assert.match(innerOf(PAGE, "#maincontent .column.main") ?? "", /^\s*<h1 class="page-title">/);
  assert.equal(insideOf(PAGE, "h1.page-title", "#maincontent .column.main"), true);
  assert.equal(insideOf(PAGE, "#f", "#maincontent .column.main"), false);
  assert.equal(insideOf(PAGE, "#none", "#maincontent"), null);
});

test("the still page: no script, the stylesheets inside, the base set, frames as a box", () => {
  const url = "https://www.apsoparts.com/de-CH/x.html";
  assert.deepEqual(stylesheetsOf(PAGE, url), ["https://www.apsoparts.com/static/css/styles-m.css"]);
  const out = stillPage(`${PAGE}<iframe src="https://x"></iframe><noscript>Enable JS</noscript>`, {
    pageUrl: url, sheets: { "https://www.apsoparts.com/static/css/styles-m.css": "body{margin:0}" }, tail: ".k{}",
    sprite: { url: "https://www.apsoparts.com/i.svg", svg: `<?xml version="1.0"?><svg><symbol id="i"/></svg>` },
  });
  assert.doesNotMatch(out, /<script/i);
  assert.doesNotMatch(out, /Enable JS/);
  assert.doesNotMatch(out, /<iframe/i);
  assert.match(out, /<style>body\{margin:0\}<\/style>/);
  assert.match(out, /<head><base href="https:\/\/www\.apsoparts\.com\/de-CH\/x\.html">/);
  assert.match(out, /<style data-apx-still>\.k\{\}<\/style><\/head>/);
  assert.match(out, /<body class="cms-page"><div hidden aria-hidden="true" style="display:none"><svg>/);
});

test("a stylesheet's relative addresses are made absolute against the stylesheet", () => {
  const css = `a{background:url(../images/x.png)} b{background:url("data:image/png;base64,AA")} c{src:url('//cdn/x.woff')}`;
  const out = absoluteCss(css, "https://www.apsoparts.com/static/v1/css/styles-m.css");
  assert.match(out, /url\(https:\/\/www\.apsoparts\.com\/static\/v1\/images\/x\.png\)/);
  assert.match(out, /url\("data:image\/png;base64,AA"\)/);
  assert.match(out, /url\('\/\/cdn\/x\.woff'\)/);
});

test("a big page parses quickly", () => {
  const big = `<html><body>${"<div class='r'><p>t<span>s</span></p><img src=x></div>".repeat(20000)}</body></html>`;
  const t = Date.now();
  const r = applyChanges(big, [{ op: "text", selector: "div.r:last-child span", text: "end" }]);
  assert.equal(r.hits[0].state, "found");
  assert.ok(Date.now() - t < 3000, `took ${Date.now() - t} ms`);
});
