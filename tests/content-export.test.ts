import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bodyToHtml,
  markdownFor,
  pdfLinesFor,
  plainTextFor,
  slugFor,
  wordHtmlFor,
  type ExportVariant,
} from "../src/lib/content/exportVariant";
import { languageLabel, LANGUAGE_BY_CODE, translatedLabel } from "../src/lib/content/languages";


const v = (over: Partial<ExportVariant> = {}): ExportVariant => ({
  label: "Shorter hero",
  title: "Cut to size, in two days",
  body: "## Why\n\nBecause **waiting** is the cost.\n\n- 48 hours\n- No minimum\n",
  language: "DE",
  channel: "landing-page",
  createdBy: "sarcla",
  ...over,
});

test("a filename survives a title with punctuation and accents", () => {
  assert.equal(slugFor("DirectCut: Italy / 2026"), "directcut-italy-2026");
  // "Grösse" must not become "gr-sse".
  assert.equal(slugFor("Grösse & Gewicht"), "grosse-gewicht");
  assert.equal(slugFor("   "), "version");
  assert.equal(slugFor(null, undefined, "Ok"), "ok");
});

test("a very long title is cut without leaving a trailing dash", () => {
  const name = slugFor("a".repeat(80) + " " + "b".repeat(20));
  assert.equal(name.length <= 60, true);
  assert.equal(name.endsWith("-"), false);
});

test("markdown carries the title and where it came from", () => {
  const md = markdownFor("DirectCut landing page", v());
  assert.match(md, /^# Cut to size, in two days/);
  assert.match(md, /> DirectCut landing page/);
  assert.match(md, /> Shorter hero · DE · landing-page · sarcla/);
  assert.match(md, /Because \*\*waiting\*\* is the cost\./);
});

test("copy gives the text and not the provenance header", () => {
  const txt = plainTextFor(v());
  assert.match(txt, /^Cut to size, in two days/);
  assert.equal(txt.includes("DirectCut landing page"), false);
  assert.equal(txt.includes(">"), false);
});

test("the Word document escapes what a body can legally contain", () => {
  // A body that mentions a tag, or an ampersand in a company name, must not
  // be able to close the document and inject into it.
  const html = wordHtmlFor("A & P", v({ body: 'Use <script>alert("x")</script> & co.' }));
  assert.equal(html.includes("<script>"), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp; co\./);
  assert.match(html, /A &amp; P/);
});

test("headings, bullets and bold survive into Word", () => {
  const html = bodyToHtml("# One\n## Two\n\n- a\n- b\n\nplain **bold** here\n\n1. first\n2. second");
  assert.match(html, /<h1>One<\/h1>/);
  assert.match(html, /<h2>Two<\/h2>/);
  assert.match(html, /<ul>\n<li>a<\/li>\n<li>b<\/li>\n<\/ul>/);
  assert.match(html, /<p>plain <strong>bold<\/strong> here<\/p>/);
  assert.match(html, /<ol>\n<li>first<\/li>\n<li>second<\/li>\n<\/ol>/);
});

test("a list closes before the paragraph that follows it", () => {
  const html = bodyToHtml("- a\n\nafter");
  assert.equal(html.indexOf("</ul>") < html.indexOf("<p>after</p>"), true);
  assert.equal((html.match(/<ul>/g) ?? []).length, 1);
});

test("a stray asterisk stays an asterisk instead of opening a tag", () => {
  // Half-parsed markdown that emits an unclosed <em> opens as a broken
  // document; an asterisk on the page is merely an asterisk.
  const html = bodyToHtml("2 * 3 = 6 and a lone * here");
  assert.equal(html.includes("<em>"), false);
  assert.match(html, /2 \* 3 = 6/);
  // ...and emphasis that is written properly still arrives.
  assert.match(bodyToHtml("one *word* only"), /one <em>word<\/em> only/);
  assert.match(bodyToHtml("*all of it*"), /<p><em>all of it<\/em><\/p>/);
});

test("the PDF lines mark headings bigger and strip the bold markers", () => {
  const lines = pdfLinesFor("DirectCut landing page", v());
  assert.equal(lines[0].text, "Cut to size, in two days");
  assert.equal(lines[0].bold, true);
  const why = lines.find((l) => l.text === "Why");
  assert.ok(why);
  assert.equal(why.bold, true);
  // No ** left to read as text in the finished PDF.
  assert.equal(lines.some((l) => l.text.includes("**")), false);
  assert.ok(lines.some((l) => l.text.startsWith("•")));
});

test("a version with no title still exports", () => {
  const bare = v({ title: null, label: null, language: null, createdBy: null });
  assert.doesNotThrow(() => markdownFor("P", bare));
  assert.equal(markdownFor("P", bare).startsWith("> P"), true);
  assert.equal(pdfLinesFor("P", bare)[0].size, 9);
});

test("a translation is named for its language, and the suffix does not stack", () => {
  assert.equal(translatedLabel("Shorter hero", "IT"), "Shorter hero – Italian");
  assert.equal(translatedLabel("Shorter hero – Italian", "DE"), "Shorter hero – German");
  assert.equal(translatedLabel(null, "FR"), "French");
  assert.equal(translatedLabel("   ", "NL"), "Dutch");
});

test("German means Swiss German, and an unknown code reads as itself", () => {
  assert.match(LANGUAGE_BY_CODE.DE.instruction, /no ß anywhere/);
  assert.equal(languageLabel("it"), "Italian");
  assert.equal(languageLabel("XX"), "XX");
  assert.equal(languageLabel(null), "");
});
