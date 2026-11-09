import assert from "node:assert/strict";
import { test } from "node:test";
import { htmlToMarks, readHtml } from "../src/lib/content/studio/kinds/blog/richEdit";
import { inline, md, mdParts } from "../src/lib/content/studio/kinds/blog/render";
import { richText } from "../src/lib/content/studio/kinds/newsletter/model";

// Content v4 (09.11.2026), the flow standard: "Bold / red key words show AS bold / red while editing (never raw ** or ==
// marks in front of the person)". The words are edited as they look; what is kept is the same markdown as before.

test("a paragraph with bold, red, slanted words and a link comes back as it was written", () => {
  const raw = "Pick **FKM** for oils, ==never EPDM== with mineral oil - see [the guide](https://www.apsoparts.com/de/o-ring) and *check* the `-20 °C` limit.";
  const [p] = mdParts(raw);
  assert.equal(htmlToMarks(p.html, "blocks"), raw);
});

test("every block of a section round-trips: headings, lists, numbered lists, tip boxes, tables, two lines in one paragraph", () => {
  const raws = [
    "### Why the material matters",
    "#### A smaller heading",
    "- **NBR**: oils and fuels\n- **EPDM**: water and steam\n- ==FKM==: heat and chemicals",
    "1. Measure the groove\n2. Pick the material\n3. Order",
    "> Tip: keep O-rings out of the light.",
    "| Material | Up to |\n| --- | --- |\n| NBR | 100 °C |\n| FKM | 200 °C |",
    "First line\nsecond line of the same paragraph",
    "---",
  ];
  for (const raw of raws) {
    const parts = mdParts(raw);
    assert.equal(parts.length, 1, raw);
    assert.equal(htmlToMarks(parts[0].html, "blocks"), raw, raw);
  }
});

test("an answer of several blocks comes back block by block", () => {
  const raw = "Yes, **if** the temperature stays under 100 °C.\n\n- check the oil\n- check the pressure\n\n> Ask us when in doubt.";
  assert.equal(htmlToMarks(md(raw), "blocks"), raw);
});

test("a one-line part (a heading, the lead) keeps its marks", () => {
  const raw = "How to choose an ==O-ring== for **hot oil**";
  assert.equal(htmlToMarks(inline(raw), "inline"), raw);
});

test("what the browser makes while editing becomes our marks: <b>, a bold span, Enter's new paragraphs and divs, nbsp", () => {
  assert.equal(htmlToMarks("Pick <b>FKM</b>&nbsp;for oils", "blocks"), "Pick **FKM** for oils");
  assert.equal(htmlToMarks('<span style="font-weight: 700;">bold</span> and <i>slanted</i>', "blocks"), "**bold** and *slanted*");
  assert.equal(htmlToMarks("<p>One</p><p>Two <b>bold </b>words</p>", "blocks"), "One\n\nTwo **bold** words");
  assert.equal(htmlToMarks("First<div>Second</div><div><br></div>", "blocks"), "First\n\nSecond");
  assert.equal(htmlToMarks("<b>a</b><b>b</b>", "inline"), "**ab**", "two bold runs side by side are one");
  assert.equal(htmlToMarks("<b><strong>twice</strong></b>", "inline"), "**twice**", "bold in bold once");
  assert.equal(htmlToMarks("<b> </b>word", "inline"), "word", "marks around nothing go");
  assert.equal(htmlToMarks("x &lt; y &amp; z", "inline"), "x < y & z");
});

test("the 'in short' lines and an empty part", () => {
  assert.equal(htmlToMarks("<ul><li>One</li><li>Two <mark>red</mark></li></ul>", "blocks"), "- One\n- Two ==red==");
  assert.equal(htmlToMarks("", "blocks"), "");
  assert.equal(htmlToMarks("<br>", "inline"), "");
});

test("a newsletter's text (paragraphs, bold, links) round-trips through its own look", () => {
  const raw = "Dear customer,\n\nOur **new search** finds parts by size - [try it](https://www.apsoparts.com/de/search).\nSee you soon.";
  assert.equal(htmlToMarks(richText(raw), "blocks"), raw);
});

test("the reader is lenient: unclosed tags, stray closings, comments", () => {
  assert.equal(htmlToMarks("<p>a <b>bold</p><p>b</b> c<!-- x --></p>", "blocks"), "a **bold**\n\nb c");
  assert.equal(readHtml("<br/>x").length, 2);
});
