import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TEMPLATES, applyDraft, applyEdits, applyTemplate, asNewsletter, checks, editable, emptyNewsletter, hubPictures, isBlank, newBlock, newsletterText, pictureIdea,
  renderEmail, richText, safeUrl, sendDay, setTextField, textFields, type Block,
} from "../src/lib/content/studio/kinds/newsletter/model";

// The newsletter studio's e-mail (08.11.2026). Made-up words.

const filled = () => {
  const d = emptyNewsletter("DE");
  d.subject = "Cut to size, ordered in two clicks";
  d.preheader = "DirectCut now in your language";
  const hero = d.blocks.find((b) => b.kind === "hero")!;
  if (hero.kind === "hero") { hero.headline = "Panels <cut> to the millimetre"; hero.text = "Pick the **material**, type the size.\n\nSee [the guide](https://www.apsoparts.com/guide)."; }
  return d;
};

test("the e-mail is e-mail HTML: tables, inline styles, no script, the preheader hidden first", () => {
  const html = renderEmail(filled());
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<html lang="de"/);
  assert.match(html, /<table role="presentation"/);
  assert.doesNotMatch(html, /<script/i);
  assert.ok(html.indexOf("DirectCut now in your language") < html.indexOf("<table"));
  // escaped, never injected
  assert.match(html, /Panels &lt;cut&gt; to the millimetre/);
  // the unsubscribe link is HubSpot's token
  assert.match(html, /href="\{\{ unsubscribe_link \}\}"/);
  // phones get one column
  assert.match(html, /@media \(max-width: 620px\)/);
});

test("missing pictures show in the preview only", () => {
  const d = filled();
  assert.match(renderEmail(d, { preview: true }), /Picture to add/);
  assert.doesNotMatch(renderEmail(d), /Picture to add/);
});

test("light formatting: bold, links, paragraphs - and nothing else gets through", () => {
  const h = richText("A **b** [x](https://a.ch?q=1&r=2)\n\n<img src=x onerror=1>");
  assert.match(h, /<strong>b<\/strong>/);
  assert.match(h, /href="https:\/\/a\.ch\?q=1&amp;r=2"/);
  assert.match(h, /&lt;img src=x onerror=1&gt;/);
  assert.equal(safeUrl("javascript:alert(1)"), "#");
  assert.equal(safeUrl("{{ unsubscribe_link }}"), "{{ unsubscribe_link }}");
});

test("the words, plain, for the version", () => {
  const t = newsletterText(filled());
  assert.match(t, /^Subject: Cut to size, ordered in two clicks/);
  assert.match(t, /Panels <cut> to the millimetre/);
});

test("what to fix before it goes out", () => {
  assert.ok(checks(emptyNewsletter()).some((c) => c.text === "No subject yet."));
  const d = filled();
  d.subject = "x".repeat(70);
  assert.ok(checks(d).some((c) => /too long/.test(c.text)));
  const noFooter = { ...filled(), blocks: filled().blocks.filter((b) => b.kind !== "footer") };
  assert.ok(checks(noFooter).some((c) => /unsubscribe/.test(c.text)));
  const disc = filled();
  disc.blocks.push({ ...newBlock("text"), kind: "text", text: "Now 20% discount on all seals" } as never);
  assert.ok(checks(disc).some((c) => /discount value/.test(c.text)));
});

test("an older or broken document keeps what it can", () => {
  const d = asNewsletter({ subject: "S", blocks: [{ id: "x", kind: "nope" }, { id: "t", kind: "text", text: "Hi" }] });
  assert.equal(d.subject, "S");
  assert.deepEqual(d.blocks.map((b) => b.kind), ["text"]);
  assert.deepEqual(asNewsletter(null).blocks.map((b) => b.kind), ["header", "hero", "article", "article", "text", "cta", "footer"], "a new one starts as the shop news layout");
});

// Content v2 (08.11.2026): "much more improved, with the assistant on the side; pictures are not being generated".

test("pictures kept in the hub go into the e-mail with the hub's full address", () => {
  const d = emptyNewsletter("DE");
  const hero = d.blocks.find((b) => b.kind === "hero")!;
  if (hero.kind === "hero") hero.imageUrl = "/api/content/picture/7-0123456789abcdef01";
  const html = renderEmail(d, { origin: "https://hub.example.com/" });
  assert.match(html, /<img src="https:\/\/hub\.example\.com\/api\/content\/picture\/7-0123456789abcdef01"/);
  assert.match(renderEmail(d), /<img src="#"/, "no origin, no made-up address");
  assert.deepEqual(hubPictures(d), ["/api/content/picture/7-0123456789abcdef01"]);
  assert.match(renderEmail(d), /Abmelden/, "the footer speaks the newsletter's language");
});

test("the preview marks each block to be picked; the e-mail never does", () => {
  const d = emptyNewsletter("EN");
  const preview = renderEmail(d, { preview: true });
  assert.equal((preview.match(/data-block="/g) ?? []).length, d.blocks.length);
  assert.doesNotMatch(renderEmail(d), /data-block|class="blk/);
});

test("three layouts to start from; changing the layout keeps the words already written", () => {
  assert.deepEqual(TEMPLATES.map((t) => t.key), ["knowhow", "news", "products"]);
  for (const t of TEMPLATES) {
    const b = t.blocks("EN");
    assert.equal(b[0].kind, "header");
    assert.equal(b[b.length - 1].kind, "footer", `${t.key} ends with the unsubscribe footer`);
    assert.equal(new Set(b.map((x) => x.id)).size, b.length, "every block its own id");
  }
  const d = emptyNewsletter("EN");
  assert.equal(isBlank(d), true);
  const story = d.blocks.find((b) => b.kind === "article")!;
  if (story.kind === "article") { story.title = "Quickorder reads your CSV"; story.imageUrl = "/api/content/picture/1-0123456789abcdef01"; }
  assert.equal(isBlank(d), false);
  const k = applyTemplate(d, "knowhow");
  assert.equal(k.layout, "knowhow");
  const first = k.blocks.find((b) => b.kind === "article")!;
  assert.ok(first.kind === "article" && first.title === "Quickorder reads your CSV" && first.layout === "left" && first.imageUrl.startsWith("/api/"));
  assert.ok(k.blocks.some((b) => b.kind === "facts"), "the know-how letter carries the shop's facts");
});

test("the shop's facts come from the brand brain, in the letter's language", () => {
  const f = newBlock("facts", "f", "DE");
  assert.ok(f.kind === "facts" && f.items.map((x) => x.big).join("|") === "100'000+|48/72 h|7 Sprachen");
  assert.match(renderEmail({ ...emptyNewsletter("DE"), blocks: [f] }), /background:#274e64/);
});

test("the assistant changes words only - by block and field name, never addresses, never a block that is gone", () => {
  const d = emptyNewsletter("EN");
  const hero = d.blocks.find((b) => b.kind === "hero")!;
  const next = applyEdits(d, {
    subject: "New subject", preheader: "",
    blocks: [
      { id: hero.id, fields: [{ name: "headline", value: "A headline" }, { name: "button", value: "Order now" }, { name: "imageUrl", value: "https://evil.example/x.png" }] },
      { id: "gone", fields: [{ name: "text", value: "x" }] },
    ],
  });
  const h = next.blocks.find((b) => b.id === hero.id)!;
  assert.ok(h.kind === "hero" && h.headline === "A headline" && h.button.label === "Order now" && h.button.url === "https://www.apsoparts.com" && h.imageUrl === "");
  assert.equal(next.subject, "New subject");
  assert.equal(next.preheader, "", "an empty answer keeps the field");
  const p = newBlock("products", "p") as Block;
  const p2 = setTextField(setTextField(p, "item2Name", "O-ring FKM"), "item9Name", "nope");
  assert.ok(p2.kind === "products" && p2.items[1].name === "O-ring FKM" && p2.items.length === 3);
  assert.deepEqual(textFields(newBlock("divider", "x")), []);
  assert.deepEqual(editable(d, hero.id).blocks.map((b) => b.id), [hero.id]);
});

test("the draft brings an idea for each picture; the picture panel starts from it", () => {
  const d = applyDraft(emptyNewsletter("EN"), {
    subject: "S", preheader: "P", eyebrow: "E", headline: "H", lead: "L", button: "B", picture: "hands fitting a seal",
    stories: [{ title: "T1", text: "x", link: "l", picture: "a hose reel" }], intro: "Hello", cta: "C", ctaButton: "CB",
  });
  const hero = d.blocks.find((b) => b.kind === "hero")!;
  assert.equal(pictureIdea(hero), "hands fitting a seal");
  assert.equal(pictureIdea(d.blocks.find((b) => b.kind === "article")!), "a hose reel");
  const story2 = d.blocks.filter((b) => b.kind === "article")[1];
  assert.equal(pictureIdea({ ...story2, title: "Storage", text: "Keep **cool** and dark" } as Block), "Storage - Keep cool and dark");
  assert.ok(d.blocks.some((b) => b.kind === "text" && b.text === "Hello"));
  assert.equal(sendDay("2026-12-03"), "Thu 3 Dec 2026", "no comma after the weekday");
  assert.equal(sendDay(null), "");
});

test("the brand's rules: chemical compatibility only with its line, never Chemours", () => {
  const d = emptyNewsletter("DE");
  d.subject = "S";
  d.blocks.push({ id: "t", kind: "text", text: "Die chemische Beständigkeit von FKM ist hoch." });
  assert.ok(checks(d).some((c) => c.level === "warn" && /no guarantee, no liability/.test(c.text)));
  d.blocks.push({ id: "u", kind: "text", text: "Nur zur Information, ohne Gewähr, keine Haftung." });
  assert.ok(!checks(d).some((c) => /no liability/.test(c.text)));
  d.blocks.push({ id: "v", kind: "text", text: "Viton by Chemours" });
  assert.ok(checks(d).some((c) => c.level === "bad" && /Chemours/.test(c.text)));
});
