import assert from "node:assert/strict";
import { test } from "node:test";
import { BLOCK_SYSTEM, blockAsk, blockChange, cleanBlock, prefixIn, prefixOf, scopeCss } from "../src/lib/content/studio/kinds/page/block";
import { colorName, contrast, parseColor, worstContrast } from "../src/lib/content/studio/kinds/page/readable";
import { carryMeta, type PageChange } from "../src/lib/content/studio/kinds/page/model";

// Content v6 (SARCLA 09.11.2026, point 2): the AI's block must be as good as the home page kit's - one self-contained
// element, every rule under one prefix class, explicit colours and fonts, the shop's container width, real data only.
// The prompt and the parsing are proved here with canned answers - no AI call.

test("the AI is shown what it needs to design well: the kit's tokens and finished blocks, the element's HTML and its look", () => {
  assert.match(BLOCK_SYSTEM, /petrol #274e64/);
  assert.match(BLOCK_SYSTEM, /EXAMPLE 1 - a dark band/);
  assert.match(BLOCK_SYSTEM, /max-width:1170px;margin:0 auto;padding:28px 10px 30px/);
  const ask = blockAsk({
    mode: "replace", prefix: "apx-a1b2c3", selector: ".page-title-wrapper", html: `<div class="page-title-wrapper"><h1 class="page-title"><span>APSOparts® – Ihr Online-Shop für Industriekomponenten</span></h1></div>`,
    look: "ground #274e64; text #ffffff; font futura-pt 32px weight 400; element 1440px wide on a 1440px page; the content container around it: max 1170px",
    request: "Add a fact-based benefit intro under the H1", language: "German",
  });
  assert.match(ask, /THE ELEMENT TO REPLACE \(selector \.page-title-wrapper\)/);
  assert.match(ask, /it is hidden and your block stands exactly where it was/);
  assert.match(ask, /ground #274e64; text #ffffff/);
  assert.match(ask, /Every CSS rule starts with\s+\.apx-a1b2c3/);
  assert.match(ask, /Never grey, petrol or red text on petrol/);
  assert.match(ask, /THE PREFIX CLASS: apx-a1b2c3/);
  assert.match(ask, /WRITE IN: German/);
  const fix = blockAsk({ mode: "rework", prefix: "apx-a1b2c3", selector: ".page-title-wrapper", html: "<div class='apx-a1b2c3'>x</div>", look: "", request: "-", language: "German", problems: `"Keine Zuschläge" is grey #5e5e5e on petrol #274e64 - a contrast of 2.1:1` });
  assert.match(fix, /IT LOOKS WRONG:\n"Keine Zuschläge" is grey #5e5e5e on petrol #274e64/);
});

test("tonight's answer, put right where it can be and said where it cannot: rules scoped, the root's own colour, grey on petrol named", () => {
  // the shape of the night's failure: a loose fragment, rules for bare tags, grey text on a petrol ground
  const night = `<style>.apx-benefit-intro{background:#274e64;color:#5e5e5e;max-width:800px} ul{list-style:none} li::before{content:"";background:#d80901}</style>
<p class="apx-benefit-intro">Über 100'000 Artikel</p><ul class="apx-benefits"><li>Keine Zuschläge für Kleinbestellungen</li></ul>`;
  const c = cleanBlock(night, "apx-k9k9k9", { ground: "#274e64", hadH1: true });
  assert.match(c.html, /^<style>\n/);
  assert.match(c.html, /<div class="apx-k9k9k9"><p class="apx-benefit-intro">/, "one root with the prefix");
  assert.match(c.html, /\.apx-k9k9k9 ul\{list-style:none\}/, "a bare tag's rule kept inside the block");
  assert.match(c.html, /\.apx-k9k9k9 li::before\{/);
  assert.match(c.html, /\.apx-k9k9k9 \.apx-benefit-intro\{/);
  assert.match(c.html, /\.apx-k9k9k9\{color:#ffffff;font-family:"futura-pt",Arial,sans-serif\}/, "on petrol the root's text is white, its font the shop's");
  assert.ok(c.problems.some((p) => /phone/.test(p)), "no phone rule is said");
  assert.ok(c.problems.some((p) => /H1/.test(p)), "the lost H1 is said");
  // a root whose own colours cannot be read is said before anything is drawn
  const own = cleanBlock(`<style>.apx-a{background:#274e64;color:#5e5e5e;font-family:Arial}@media (max-width:767px){.apx-a{padding:0}}</style><div class="apx-a">x</div>`, "apx-a");
  assert.ok(own.problems.some((p) => /#5e5e5e on its own ground #274e64 cannot be read/.test(p)), own.problems.join(" | "));
});

test("a good block passes as it is: one style, one root, its rules under the prefix, a phone rule", () => {
  const good = `<style>
.apx-c1d2e3,.apx-c1d2e3 *{box-sizing:border-box}
.apx-c1d2e3{background:#274e64;color:#ffffff;font-family:"futura-pt",Arial,sans-serif;font-size:16px;line-height:1.5}
.apx-c1d2e3 .apx-c1d2e3-in{max-width:1170px;margin:0 auto;padding:28px 10px}
.apx-c1d2e3 h1{margin:0;color:#ffffff}
@media (max-width:767px){.apx-c1d2e3 h1{font-size:24px}}
</style>
<div class="apx-c1d2e3"><div class="apx-c1d2e3-in"><h1>APSOparts® – Ihr Online-Shop für Industriekomponenten</h1></div></div>`;
  const r = blockChange({ summary: "A clearer title band", html: good, note: "Title band with facts" }, { id: "cabcdefc1d2e3", mode: "replace", prefix: "apx-c1d2e3", selector: ".page-title-wrapper", hadH1: true, ground: "#274e64" });
  assert.deepEqual(r.problems, []);
  assert.equal(r.change?.op, "replace");
  assert.equal(r.change?.id, "cabcdefc1d2e3");
  assert.equal((r.change as { selector: string }).selector, ".page-title-wrapper");
  assert.equal((r.change as { note: string }).note, "Title band with facts");
  assert.match((r.change as { html: string }).html, /\.apx-c1d2e3 h1\{margin:0;color:#ffffff\}/);
  // nothing came back: said
  assert.equal(blockChange({ summary: "", html: "  ", note: "" }, { id: "c1", mode: "insert", prefix: "apx-1", selector: "x" }).change, null);
  // a block written again keeps its id, its module and its place
  const base: PageChange = { op: "insert", selector: ".row", where: "after", html: good, id: "cbase01", module: { type: "bento", settings: { n: 4 } }, off: "Looks wrong" };
  const again = blockChange({ summary: "", html: good, note: "" }, { id: "cnew", mode: "rework", prefix: "apx-c1d2e3", selector: "", base });
  assert.equal(again.change?.id, "cbase01");
  assert.deepEqual(again.change?.module, { type: "bento", settings: { n: 4 } });
  assert.equal((again.change as { where: string }).where, "after");
  assert.equal(again.change?.off, undefined, "written again, it is checked again");
});

test("scoping: inside @media too; html/body become the root; @import and @font-face left out", () => {
  const s = scopeCss(`@import url(x.css); body{margin:0} h2, .apx-p .x{color:#274e64} @media (max-width:767px){p{font-size:14px}} @font-face{font-family:x;src:url(y)}`, "apx-p");
  assert.equal(s.css, `.apx-p{margin:0}.apx-p h2,.apx-p .x{color:#274e64}@media (max-width:767px){.apx-p p{font-size:14px}}`);
  assert.equal(prefixIn(`<style>.apx-qq1{}</style><section class="apx-qq1 wide">x</section>`), "apx-qq1");
  assert.match(prefixOf("cmh8x2k1a9"), /^apx-[a-z0-9]{6}$/);
});

test("contrast as WCAG counts it - the night's grey on petrol fails, white on petrol passes", () => {
  const petrol = parseColor("#274e64")!;
  assert.ok(contrast(parseColor("#5e5e5e")!, petrol) < 2.5);
  assert.ok(contrast(parseColor("#ffffff")!, petrol) > 8);
  assert.ok(contrast(parseColor("rgb(216, 9, 1)")!, parseColor("#fff")!) >= 4.5, "the shop's red on white reads");
  assert.equal(parseColor("rgba(0, 0, 0, 0)")!.a, 0);
  const w = worstContrast(parseColor("#ffffff")!, [petrol, parseColor("#f3f4f5")!]);
  assert.ok(w.ratio < 1.2, "white on a gradient that ends light: the light end counts");
  assert.equal(colorName(petrol), "petrol #274e64");
});

test("a whole page written again: changes that came back the same keep their id and module, one held back stays held back", () => {
  const old: PageChange[] = [
    { op: "replace", selector: ".a", html: "<div class='apx-a'>A</div>", id: "ca1", module: { type: "hero", settings: {} } },
    { op: "insert", selector: ".b", where: "after", html: "<div class='apx-b'>B</div>", id: "cb1", off: "Looks wrong - not applied: grey on petrol" },
  ];
  const next = carryMeta(old, [
    { op: "replace", selector: ".a", html: "<div class='apx-a'>A2</div>" },
    { op: "insert", selector: ".b", where: "after", html: "<div class='apx-b'>B</div>" },
    { op: "css", css: ".x{}" },
  ]);
  assert.equal(next[0].id, "ca1");
  assert.deepEqual(next[0].module, { type: "hero", settings: {} });
  assert.equal(next[1].id, "cb1");
  assert.equal(next[1].off, "Looks wrong - not applied: grey on petrol");
  assert.match(next[2].id ?? "", /^c/);
});

test("Text and picture (the +, no AI): the kit's way under its prefix, a photo of the page, its words marked as still to write", async () => {
  const { textPictureBlock } = await import("../src/lib/content/studio/kinds/page/block");
  const { leftoversIn } = await import("../src/lib/content/studio/kinds/page/model");
  const html = textPictureBlock("apx-tp0001", { src: "https://www.apsoparts.com/media/wysiwyg/1_ORings_XRings_1.jpg", alt: "O-Ringe" });
  const c = cleanBlock(html, "apx-tp0001");
  assert.deepEqual(c.problems.filter((p) => !/placeholder/.test(p)), [], "nothing but its words to write");
  assert.deepEqual(c.fixed, [], "nothing to put right");
  assert.match(html, /max-width:1170px;margin:36px auto;padding:0 10px/);
  assert.match(html, /<img src="https:\/\/www\.apsoparts\.com\/media\/wysiwyg\/1_ORings_XRings_1\.jpg" alt="O-Ringe"/);
  assert.deepEqual(leftoversIn(html), ["[Heading]", "[Your words: one or two sentences]"]);
  assert.doesNotMatch(textPictureBlock("apx-tp0002", null), /<img/);
});
