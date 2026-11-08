import assert from "node:assert/strict";
import { test } from "node:test";
import {
  batchPlan, blogDoc, blogText, brandWarnings, cardOf, emptyBlog, homeCards, postPath, postWarnings, readingMinutes, slugify, sortCards, topicsOf,
  type BlogCard,
} from "../src/lib/content/studio/kinds/blog/model";
import { cut, homeSection, inline, jsonLd, jsonLdScript, md, pasteHome, pastePost, postArticle, postDocument, serp } from "../src/lib/content/studio/kinds/blog/render";

// The blog studio (08.11.2026): a post, the blog's home that lists every post, a page per topic, Google's snippet.

test("an empty post takes the to-do's name unless it is the default one, and its language's store", () => {
  const a = emptyBlog({ title: "O-Ringe richtig lagern", language: "DE", author: "Claudio" });
  assert.equal(a.title, "O-Ringe richtig lagern");
  assert.equal(a.slug, "o-ringe-richtig-lagern");
  assert.equal(a.store, "de-CH");
  assert.equal(emptyBlog({ title: "Blog article · FR", language: "FR" }).title, "");
  assert.equal(emptyBlog({ language: "it" }).store, "it-CH");
});

test("any stored document reads as a post (an older first shape too)", () => {
  const d = blogDoc({ v: 1, notes: "kept", sections: [{ heading: "A", body: "b" }, "junk"], tags: ["x", "", 3], publishAt: "soon" }, { language: "PL" });
  assert.equal(d.notes, "kept");
  assert.equal(d.sections.length, 1);
  assert.ok(d.sections[0].id, "each section gets an id");
  assert.deepEqual(d.tags, ["x"]);
  assert.equal(d.publishAt, "");
  assert.equal(d.store, "pl-PL");
});

test("addresses", () => {
  assert.equal(slugify("Dichtungen für Öl & Wasser: was zählt?"), "dichtungen-fur-ol-wasser-was-zahlt");
  assert.equal(slugify("Straße"), "strasse");
  assert.equal(postPath({ store: "fr-CH", slug: "", title: "Joints toriques" }), "/fr-CH/blog/joints-toriques");
});

test("topics become to-dos a week apart, list marks dropped, each once, twenty at most", () => {
  const plan = batchPlan("- O-Ringe lagern\n2. FKM oder EPDM?\n\n* o-ringe lagern\n10 Fehler beim Einbau\n• Härte messen", "2026-11-09");
  assert.deepEqual(plan, [
    { title: "O-Ringe lagern", dueDate: "2026-11-09" },
    { title: "FKM oder EPDM?", dueDate: "2026-11-16" },
    { title: "10 Fehler beim Einbau", dueDate: "2026-11-23" },
    { title: "Härte messen", dueDate: "2026-11-30" },
  ]);
  assert.equal(batchPlan(Array.from({ length: 30 }, (_, i) => `Topic ${i}`).join("\n"), "2026-01-01").length, 20);
});

test("markdown: what posts use, escaped, links only to safe places", () => {
  assert.equal(inline("**Härte** in ==Shore A== and `70`"), "<strong>Härte</strong> in <mark>Shore A</mark> and <code>70</code>");
  assert.equal(inline("[shop](/de-CH/o-ringe.html) [bad](javascript:alert)"), `<a href="/de-CH/o-ringe.html">shop</a> bad`);
  assert.equal(inline("<script>x</script>"), "&lt;script&gt;x&lt;/script&gt;");
  const html = md("Intro line\nsecond line\n\n### Sub\n- one\n- two\n\n1. first\n2. second\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> said");
  assert.match(html, /^<p>Intro line<br>second line<\/p>/);
  assert.match(html, /<h3>Sub<\/h3>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(html, /<ol><li>first<\/li><li>second<\/li><\/ol>/);
  assert.match(html, /<thead><tr><th>A<\/th><th>B<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td>2<\/td><\/tr><\/tbody>/);
  assert.match(html, /<blockquote><p>said<\/p><\/blockquote>/);
  assert.equal(md("# Title"), "<h3>Title</h3>", "a section's own heading is the h2 - its body never has one");
});

test("Google's snippet: cut at a word, the address as breadcrumbs", () => {
  assert.deepEqual(cut("short", 60), { text: "short", cut: false });
  const c = cut("Welcher O-Ring-Werkstoff passt zu Ihrer Anwendung im Lebensmittelbereich wirklich?", 60);
  assert.ok(c.cut && c.text.endsWith(" …") && c.text.length <= 62);
  const d = blogDoc({ title: "FKM oder EPDM", slug: "fkm-epdm", store: "de-CH", excerpt: "Kurz gesagt: es kommt auf das Medium an." });
  const s = serp(d);
  assert.equal(s.title, "FKM oder EPDM");
  assert.equal(s.crumbs, "www.apsoparts.com › de-CH › blog › fkm-epdm");
  assert.equal(s.fromText, true, "no meta description - Google takes the text");
});

test("structured data: an Article, a FAQPage only with questions, nothing it does not have", () => {
  const d = blogDoc({ title: "T", slug: "t", store: "de-CH", author: "", faq: [{ q: "Q?", a: "A." }, { q: "No answer", a: "" }] });
  const ld = jsonLd(d);
  assert.equal(ld.length, 2);
  assert.equal(ld[0]["@type"], "Article");
  assert.deepEqual(ld[0].author, { "@type": "Organization", name: "APSOparts" });
  assert.equal("datePublished" in ld[0], false);
  assert.equal("image" in ld[0], false);
  assert.equal((ld[1].mainEntity as unknown[]).length, 1);
  assert.equal(jsonLd(blogDoc({ title: "T" })).length, 1);
  assert.doesNotMatch(jsonLdScript(blogDoc({ title: "</script><b>" })), /<\/script><b>/);
});

test("the brand's rules are checked on the text", () => {
  assert.equal(brandWarnings("Viton by Chemours").length, 1);
  assert.equal(brandWarnings("Jetzt 20% Rabatt").length, 1);
  assert.equal(brandWarnings("Die chemische Beständigkeit von FKM").length, 1);
  assert.equal(brandWarnings("Die chemische Beständigkeit von FKM - nur zur Information, ohne Gewähr, keine Haftung.").length, 0);
  assert.deepEqual(brandWarnings("O-Ringe richtig lagern"), []);
  const w = postWarnings(blogDoc({ title: "", metaTitle: "x".repeat(70) }));
  assert.ok(w.some((x) => /no title/.test(x)) && w.some((x) => /10 characters too long/.test(x)));
});

test("the post's page: its parts in order, links to the blog's home and its topics", () => {
  const d = blogDoc({
    title: "FKM oder EPDM?", slug: "fkm-oder-epdm", store: "de-CH", language: "DE", author: "Claudio", publishAt: "2026-11-20",
    excerpt: "Es kommt auf das Medium an.", hero: { url: "https://www.apsoparts.com/media/x.jpg", alt: "O-Ringe" },
    sections: [{ id: "a", heading: "Was entscheidet", body: "Text" }], faq: [{ id: "f", q: "Und Öl?", a: "FKM." }],
    relatedProducts: [{ id: "p", name: "O-Ringe FKM", url: "/de-CH/o-ringe.html" }, { id: "q", name: "Bad", url: "javascript:x" }], tags: ["O-Ringe", "Werkstoffe"],
  });
  const a = postArticle(d);
  const order = ["apx-crumbs", "apx-eyebrow", "<h1>", "apx-meta", "apx-hero", "apx-lead", "<h2 id=\"was-entscheidet\">", "apx-faq", "apx-related", "apx-tags", "apx-back"].map((k) => a.indexOf(k));
  assert.ok(order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1])), `in order: ${order.join(",")}`);
  assert.match(a, /href="\/de-CH\/blog">Blog<\/a>/);
  assert.match(a, /href="\/de-CH\/blog\/tag\/o-ringe">O-Ringe<\/a>/);
  assert.match(a, /Häufige Fragen/);
  assert.match(a, /20\. November 2026/);
  assert.doesNotMatch(a, /javascript/);
  assert.match(postDocument(d), /^<!doctype html><html lang="de">/);
  const blocks = pastePost(d);
  assert.match(blocks[0].code, /URL Key: blog\/fkm-oder-epdm/);
  assert.match(blocks[1].code, /^<style>[\s\S]*<\/style>\n<article[\s\S]*application\/ld\+json/);
  assert.equal(readingMinutes(d), 1);
  assert.match(blogText(d), /^# FKM oder EPDM\?/);
});

test("the blog's home: this store's posts newest first, the one being written as typed, topics by use", () => {
  const card = (pieceId: number, date: string | null, tags: string[], store = "de-CH"): BlogCard => ({
    pieceId, projectId: 1, title: `Post ${pieceId}`, slug: `post-${pieceId}`, excerpt: "", hero: { url: "", alt: "" }, date, tags, status: "live", language: "DE", store, minutes: 3,
  });
  const stored = [card(1, "2026-10-01", ["Seals"]), card(2, null, []), card(3, "2026-11-01", ["Seals", "Plastics"]), card(4, "2026-12-01", [], "fr-CH")];
  assert.deepEqual(sortCards(stored).map((c) => c.pieceId), [4, 3, 1, 2]);
  const typed = cardOf(blogDoc({ title: "Typed", store: "de-CH", publishAt: "2026-11-15", tags: ["Seals"] }), { pieceId: 1, projectId: 1, status: "writing", due: null });
  const home = homeCards(stored, typed);
  assert.deepEqual(home.map((c) => c.title), ["Typed", "Post 3", "Post 2"]);
  assert.deepEqual(topicsOf(home), ["Seals", "Plastics"]);
  const html = homeSection(home, { store: "de-CH", language: "DE", topics: topicsOf(home), withState: true });
  assert.match(html, /Alle Beiträge/);
  assert.match(html, /<span class="apx-state">Writing<\/span>/);
  assert.doesNotMatch(pasteHome(home, { store: "de-CH", language: "DE", topics: [] }).code, /class="apx-state"/, "the paste never carries the hub's states");
  assert.match(homeSection(home, { store: "de-CH", language: "DE", topics: ["Seals"], tag: "Plastics" }), /Post 3[\s\S]*<\/div>/);
});
