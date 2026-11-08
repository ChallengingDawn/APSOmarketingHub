import assert from "node:assert/strict";
import { test } from "node:test";
import { blogDoc } from "../src/lib/content/studio/kinds/blog/model";
import { addSection, moveSection, oneLine, outlineOf, partLabel, partText, setPart } from "../src/lib/content/studio/kinds/blog/parts";
import { mdChunks, pastePost, postArticle, postDocument } from "../src/lib/content/studio/kinds/blog/render";

// Content v3 (08.11.2026) - SARCLA: "Improve the blog page a lot, and the editing is really not yet fully clear. On the
// preview, show just the blog page." Each part of the post is edited where it is read. Made-up words.

const post = () => blogDoc({
  title: "EPDM or FKM?", slug: "epdm-or-fkm", store: "en-CH", language: "EN", author: "Claudio Saraiva", excerpt: "It depends on the medium.",
  takeaways: ["Water: EPDM", "Oil: FKM"],
  sections: [
    { id: "a", heading: "The short answer", body: "Use **EPDM** for hot water.\n\n- steam\n- CIP\n\n| Medium | EPDM |\n|---|---|\n| Water | yes |", quote: "" },
    { id: "b", heading: "Temperatures", body: "", quote: "Heat ages rubber." },
  ],
  faq: [{ id: "f1", q: "Both at once?", a: "Not with one compound." }],
  relatedProducts: [{ id: "p1", name: "EPDM O-rings", url: "https://www.apsoparts.com/en-CH/o-rings-epdm" }],
  tags: ["O-rings"],
});

test("a section's text in blocks: each paragraph, list and table its own words, put back as one text", () => {
  const d = post();
  assert.deepEqual(mdChunks(d.sections[0].body), ["Use **EPDM** for hot water.", "- steam\n- CIP", "| Medium | EPDM |\n|---|---|\n| Water | yes |"]);
  assert.equal(partText(d, "s:a:b:1"), "- steam\n- CIP");
  const n = setPart(d, "s:a:b:1", "- steam\n- CIP\n- hot water");
  assert.equal(n.sections[0].body, "Use **EPDM** for hot water.\n\n- steam\n- CIP\n- hot water\n\n| Medium | EPDM |\n|---|---|\n| Water | yes |");
  // a block emptied goes away; a new paragraph typed into a block stays in the text
  assert.equal(setPart(d, "s:a:b:0", "").sections[0].body.startsWith("- steam"), true);
  assert.equal(setPart(d, "s:a:b:0", "One.\n\nTwo.").sections[0].body.startsWith("One.\n\nTwo.\n\n- steam"), true);
  // an empty section: its first block is where its text is written
  assert.equal(partText(d, "s:b:b:0"), "");
  assert.equal(setPart(d, "s:b:b:0", "Above 150 °C, EPDM ages.").sections[1].body, "Above 150 °C, EPDM ages.");
  assert.equal(partText(d, "s:gone:h"), null);
});

test("every part by its key; a title stays one line; the band's own words stay the language's", () => {
  const d = post();
  assert.equal(partText(d, "title"), "EPDM or FKM?");
  assert.equal(setPart(d, "title", "EPDM or FKM\nfor steam?").title, "EPDM or FKM for steam?");
  assert.deepEqual(setPart(d, "short", "- Water: EPDM\n\n• Oil: FKM\nSteam: EPDM").takeaways, ["Water: EPDM", "Oil: FKM", "Steam: EPDM"]);
  assert.equal(partText(d, "cta:l"), "To the shop", "an empty button reads as the language's word");
  assert.equal(setPart(d, "cta:l", "To the shop").cta.label, "", "left as it was: still the language's word");
  assert.equal(setPart(d, "cta:l", "See the O-rings").cta.label, "See the O-rings");
  assert.equal(setPart(d, "faq:f1:a", "Use FFKM.").faq[0].a, "Use FFKM.");
  assert.equal(setPart(d, "prod:p1", "EPDM O-rings 70 Shore").relatedProducts[0].name, "EPDM O-rings 70 Shore");
  assert.equal(setPart(d, "s:b:q", "").sections[1].quote, "");
  assert.ok(oneLine("s:a:h") && oneLine("cta:l") && !oneLine("s:a:b:0") && !oneLine("lead"));
  assert.equal(partLabel(d, "s:a:b:1"), "Section 1 · list");
  assert.equal(partLabel(d, "s:a:b:0"), "Section 1 · paragraph");
  assert.equal(partLabel(d, null), "The whole post");
});

test("sections added after the picked one, moved; the outline lists the page top to bottom with each part's state", () => {
  const d = post();
  const r = addSection(d, "a");
  assert.deepEqual(r.doc.sections.map((s) => s.id), ["a", r.id, "b"]);
  assert.deepEqual(moveSection(d, "b", -1).sections.map((s) => s.id), ["b", "a"]);
  assert.equal(moveSection(d, "a", -1), d, "the first one does not go up");
  const rows = outlineOf(d);
  assert.deepEqual(rows.map((x) => x.key), ["title", "short", "hero", "s:a:h", "s:b:h", "cta", "faq", "prods", "tags", "author"]);
  assert.equal(rows.find((x) => x.key === "hero")!.state, "todo");
  assert.equal(rows.find((x) => x.key === "s:b:h")!.state, "todo", "a section with no text is still to do");
});

test("the studio's preview is the post's page only, every part marked to edit; the paste carries no mark", () => {
  const d = post();
  const page = postDocument(d, { edit: {} });
  for (const k of ["title", "lead", "short", "s:a:h", "s:a:b:0", "s:a:b:2", "s:b:q", "cta:t", "cta:l", "faq:f1:q", "faq:f1:a", "prod:p1"]) assert.match(page, new RegExp(`data-ed="${k}"`), k);
  assert.match(page, /data-pic="hero"/, "the post's picture still to make shows as its empty frame");
  assert.match(page, /data-sel="tags"/);
  assert.doesNotMatch(page, /class="apx-others"|apx-shop-url/, "no other posts under it, no browser bar around it");
  const paste = pastePost(d)[1].code;
  assert.doesNotMatch(paste, /data-ed|data-pic|data-sel|data-ph|apx-ph/);
  // the related products end: a card per product, its address under its name
  assert.match(postArticle(d), /<section class="apx-related"><h2>Related products<\/h2><ul><li><a href="https:\/\/www\.apsoparts\.com\/en-CH\/o-rings-epdm"><b>EPDM O-rings<\/b><small>apsoparts\.com\/en-CH\/o-rings-epdm<\/small>/);
  // a text's quote is a callout; the section's pull quote keeps its large look
  assert.match(postArticle(d), /<blockquote class="apx-pull"><p>Heat ages rubber\.<\/p><\/blockquote>/);
});

test("in the studio, empty parts say what goes there; a picture idea shows as its frame", () => {
  const d = blogDoc({ title: "", language: "EN", sections: [{ id: "x", heading: "", body: "", image: { url: "", alt: "", caption: "", prompt: "hands fitting an O-ring" } }] });
  const page = postDocument(d, { edit: {} });
  assert.match(page, /<h1 data-ed="title" data-ph="The post's title"><\/h1>/);
  assert.match(page, /data-ed="s:x:b:0" data-ph="Write this section here/);
  assert.match(page, /data-pic="s:x:img"[^>]*><span class="apx-ph-box"><b>A picture<\/b><span>hands fitting an O-ring<\/span>/);
  assert.match(page, /apx-slot-sec" data-sel="faq"/, "no questions yet: their place, to fill");
  assert.doesNotMatch(postDocument(d), /data-ph|apx-ph-box/, "never outside the studio");
  // a pull quote asked for shows empty, to be written
  assert.match(postDocument(d, { edit: { open: ["s:x:q"] } }), /<blockquote class="apx-pull"><p data-ed="s:x:q" data-ph=/);
});
