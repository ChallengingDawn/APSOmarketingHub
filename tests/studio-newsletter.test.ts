import assert from "node:assert/strict";
import { test } from "node:test";
import { asNewsletter, checks, emptyNewsletter, newBlock, newsletterText, renderEmail, richText, safeUrl } from "../src/lib/content/studio/kinds/newsletter/model";

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
  assert.equal(asNewsletter(null).blocks.length, 6);
});
