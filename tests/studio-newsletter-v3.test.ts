import assert from "node:assert/strict";
import { test } from "node:test";
import {
  OUR_LOGO, checks, emptyNewsletter, isOurLogo, moveBlock, newBlock, oneLine, partText, renderEmail, setPart, textFields,
} from "../src/lib/content/studio/kinds/newsletter/model";
import { blocksFrom, readEmail, type RawEmailFull } from "../src/lib/content/studio/kinds/newsletter/ourEmails";

// Content v3 (08.11.2026) - SARCLA: "newsletter also: editing is very confusing; the logo is not the true one, though we
// have it". Made-up words.

test("our true logo on top, as our e-mails carry it - never the name written in letters", () => {
  const d = emptyNewsletter("EN");
  const html = renderEmail(d);
  assert.match(html, new RegExp(`<img src="${OUR_LOGO.replace(/[./]/g, "\\$&")}" width="600" alt="APSOparts®`));
  assert.doesNotMatch(html, /APSO<span/, "no logo drawn in letters, top or bottom");
  assert.match(html, /href="\{\{ view_as_page_url \}\}"/);
  assert.ok(isOurLogo("") && isOurLogo("https://campaigns.apsoparts.com/hubfs/Logo2.jpg") && !isOurLogo("/api/content/picture/3-0123456789abcdef01"));
  // another logo from the hub's Logos; an SVG one is flagged (Outlook and Gmail do not show it)
  const other = { ...d, blocks: d.blocks.map((b) => (b.kind === "header" ? { ...b, logoUrl: "https://x.example/logo.svg" } : b)) };
  assert.match(renderEmail(other), /<img src="https:\/\/x\.example\/logo\.svg" height="56"/);
  assert.ok(checks(other).some((c) => /SVG/.test(c.text)));
  assert.deepEqual(textFields(newBlock("header")), [], "the header has no words of its own to change");
});

test("our footer: support, LinkedIn, masthead, privacy, the reader's address and the unsubscribe link - in the letter's language", () => {
  const de = renderEmail(emptyNewsletter("DE"));
  assert.match(de, /UNSEREN SUPPORT KONTAKTIEREN/);
  assert.match(de, /href="https:\/\/www\.apsoparts\.com\/de-DE\/imprint"[^>]*>Impressum<\/a>/);
  assert.match(de, /\{\{ contact\.email \}\}/);
  assert.match(de, /href="\{\{ unsubscribe_link \}\}"[^>]*>Abmelden<\/a>/);
  assert.match(renderEmail(emptyNewsletter("DE"), { preview: true }), /you@company\.com/, "the preview shows an address, not HubSpot's token");
});

test("in the studio every block's words and pictures are marked to edit in place; the e-mail itself never is", () => {
  const d = emptyNewsletter("EN");
  const hero = d.blocks.find((b) => b.kind === "hero")!;
  const story = d.blocks.find((b) => b.kind === "article")!;
  const page = renderEmail(d, { edit: true });
  for (const k of [`${hero.id}:headline`, `${hero.id}:text`, `${hero.id}:button`, `${story.id}:title`, `${story.id}:link`]) assert.match(page, new RegExp(`data-ed="${k}"`), k);
  assert.match(page, new RegExp(`data-pic="${hero.id}:image"`));
  assert.match(page, /data-ph="The headline"/);
  assert.match(page, /Picture to add/);
  assert.doesNotMatch(renderEmail(d), /data-ed|data-pic|data-ph|data-block/);
});

test("a block's words by their key, set back as one line where they are one line; blocks moved", () => {
  const d = emptyNewsletter("EN");
  const hero = d.blocks.find((b) => b.kind === "hero")!;
  assert.equal(partText(d, `${hero.id}:headline`), "");
  const n = setPart(d, `${hero.id}:headline`, "Seals that last\nin hot water");
  const h = n.blocks.find((b) => b.id === hero.id)!;
  assert.ok(h.kind === "hero" && h.headline === "Seals that last in hot water");
  const t = setPart(n, `${hero.id}:text`, "One.\n\n\n\nTwo.");
  const h2 = t.blocks.find((b) => b.id === hero.id)!;
  assert.ok(h2.kind === "hero" && h2.text === "One.\n\nTwo.");
  assert.equal(partText(d, "nope:headline"), null);
  assert.ok(oneLine(`${hero.id}:button`) && !oneLine(`${hero.id}:text`));
  assert.deepEqual(moveBlock(d, hero.id, -1).blocks.slice(0, 2).map((b) => b.kind), ["hero", "header"]);
});

test("one of our e-mails: its logo picture on top is its header; its footer (words, icons) is not read as its blocks", () => {
  const e: RawEmailFull = {
    id: 9, subject: "Source smarter", language: "en",
    content: {
      flexAreas: { main: { sections: [{ columns: [{ widgets: ["logo"] }] }, { columns: [{ widgets: ["hero"] }] }, { columns: [{ widgets: ["intro"] }] }, { columns: [{ widgets: ["follow"] }] }, { columns: [{ widgets: ["after"] }] }, { columns: [{ widgets: ["mail"] }] }] } },
      widgets: {
        logo: { body: { path: "@hubspot/image_email", img: { src: "https://26492587.fs1.hubspotusercontent-eu1.net/hubfs/26492587/Logo2.jpg", alt: "Logo2" } } },
        hero: { body: { path: "@hubspot/image_email", img: { src: "https://cdn.example.com/hero.png", alt: "Hero" } } },
        intro: { body: { path: "@hubspot/rich_text", html: "<h2>Smarter tools</h2><p>Discover what is new in the shop - and how it saves you time.</p>" } },
        mail: { body: { path: "@hubspot/image_email", img: { src: "https://campaigns.apsoparts.com/hubfs/MAIL.jpg", alt: "MAIL" } } },
        follow: { body: { path: "@hubspot/rich_text", html: "<p>FOLLOW OUR PAGE</p>" } },
        after: { body: { path: "@hubspot/rich_text", html: "<p>APSOparts® GmbH - Masthead | Data Protection Policy</p>" } },
      },
    },
  };
  const blocks = blocksFrom(readEmail(e).parts, "Source smarter");
  assert.deepEqual(blocks.map((b) => b.kind), ["header", "hero"]);
  const head = blocks[0];
  assert.ok(head.kind === "header" && head.logoUrl === "" && head.hs?.image === "logo", "our logo, kept as ours; the draft knows its widget");
  assert.ok(blocks[1].kind === "hero" && blocks[1].imageUrl === "https://cdn.example.com/hero.png");
});
