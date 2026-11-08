import assert from "node:assert/strict";
import { test } from "node:test";
import { blocksFrom, digestOf, groupEmails, readEmail, type RawEmail, type RawEmailFull } from "../src/lib/content/studio/kinds/newsletter/ourEmails";

// Our e-mails in HubSpot, read for the newsletter studio (08.11.2026). Made-up e-mails in HubSpot's shape.

const sent = (id: string, name: string, language: string, subject: string, date: string, c: { sent: number; open: number; click: number }, extra: Partial<RawEmail> = {}): RawEmail => ({
  id, name, language, subject, state: "AUTOMATED", type: "AUTOMATED_EMAIL", publishDate: `${date}T09:00:00Z`,
  stats: { counters: { sent: c.sent, delivered: c.sent, open: c.open, click: c.click } }, webversion: { enabled: true, url: `https://campaigns.example.com/${id}` }, ...extra,
});

test("one group per campaign across its languages, newest first, named by its English subject", () => {
  const groups = groupEmails([
    sent("1", "DE_New_Features_Gaskets_2611", "de", "Dichtungen nach Mass", "2026-11-04", { sent: 4000, open: 800, click: 80 }),
    sent("2", "EN_New_Features_Gaskets_2611", "en", "Gaskets made to measure", "2026-11-04", { sent: 1500, open: 300, click: 20 }),
    sent("3", "FR_New_Features_Gaskets_2611", "fr", "Joints sur mesure", "2026-11-04", { sent: 1600, open: 0, click: 0 }),
    sent("4", "EN_New_Features_Hoses_2610", "en", "Hoses by the metre", "2026-10-19", { sent: 900, open: 100, click: 9 }),
    sent("5", "EN_Draft_2612", "en", "Not sent yet", "2026-12-01", { sent: 0, open: 0, click: 0 }, { state: "AUTOMATED_DRAFT" }),
    sent("6", "DE_GENERAL_NPS_2611", "en", "Wie war Ihre Erfahrung?", "2026-10-30", { sent: 1900, open: 500, click: 50 }, { type: "FEEDBACK_CUSTOM_SURVEY_EMAIL" }),
  ]);
  assert.deepEqual(groups.map((g) => g.label), ["Gaskets made to measure", "Wie war Ihre Erfahrung?", "Hoses by the metre"]);
  const g = groups[0];
  assert.equal(g.kind, "campaign");
  assert.deepEqual(g.variants.map((v) => v.language), ["EN", "DE", "FR"]);
  assert.equal(g.variants[1].openRate, 0.2);
  // thousands sent and not one open: not tracked, not 0%
  assert.equal(g.variants[2].openRate, null);
  // the language its name says, not HubSpot's "en"
  assert.equal(groups[1].variants[0].language, "DE");
  assert.equal(groups[1].kind, "survey");
  assert.ok(!groups.some((x) => x.variants.some((v) => v.id === "5")), "a draft is not something we sent");
});

const email: RawEmailFull = {
  id: 77, name: "EN_New_Features_Gaskets_2611", subject: "Gaskets made to measure", language: "en",
  content: {
    flexAreas: { main: { sections: [
      { columns: [{ widgets: ["web"] }] }, { columns: [{ widgets: ["hero"] }] }, { columns: [{ widgets: ["hi"] }] }, { columns: [{ widgets: ["intro"] }] },
      { columns: [{ widgets: ["btn1"] }] }, { columns: [{ widgets: ["pic2"] }] }, { columns: [{ widgets: ["story2"] }] }, { columns: [{ widgets: ["btn2"] }] },
      { columns: [{ widgets: ["line"] }] }, { columns: [{ widgets: ["foot"] }] },
    ] } },
    widgets: {
      web: { body: { path: "@hubspot/email_web_version_link" } },
      hero: { body: { path: "@hubspot/image_email", img: { src: "https://cdn.example.com/hero.png", alt: "Hero" } } },
      hi: { body: { path: "@hubspot/rich_text", html: "<p>{{ contact.salutation_phrase }} {{ contact.lastname }}</p>" } },
      intro: { body: { module_id: 1155639, html: "<h2>Cut to your size</h2><p>Order gaskets cut to the millimetre&nbsp;- in two clicks.</p>" } },
      btn1: { body: { path: "@hubspot/button_email", text: "TRY IT", destination: "https://shop.example.com/cut" } },
      pic2: { body: { module_id: 1367093, img: { src: "https://cdn.example.com/two.png", alt: "Two" } } },
      story2: { body: { module_id: 1155639, html: "<p><strong>Already tried DirectUP?</strong></p><p>Turn a PDF order into a shop order, the parts found for you.</p>" } },
      btn2: { body: { path: "@hubspot/button_email", text: "UPLOAD AN ORDER", destination: "https://shop.example.com/up" } },
      line: { body: { module_id: 2191110, style: { color: "#ccc" } } },
      foot: { body: { path: "@hubspot/email_footer" } },
      preview_text: { type: "text", body: { value: "Two clicks, any size" } },
    },
  },
};

test("an e-mail read in the order it shows: texts, pictures, buttons; the web-version link and footer are its frame", () => {
  const e = readEmail(email);
  assert.equal(e.preheader, "Two clicks, any size");
  assert.deepEqual(e.parts.map((p) => p.kind), ["chrome", "image", "text", "text", "button", "image", "text", "button", "divider", "chrome"]);
  const intro = e.parts[3];
  assert.ok(intro.kind === "text" && intro.text.startsWith("Cut to your size\nOrder gaskets cut to the millimetre - in two clicks."));
});

test("as the studio's blocks: a lead story (the greeting opening its text) with its button, a story with its picture and button", () => {
  const blocks = blocksFrom(readEmail(email).parts);
  assert.deepEqual(blocks.map((b) => b.kind), ["hero", "article", "divider"]);
  const hero = blocks[0];
  assert.ok(hero.kind === "hero");
  assert.equal(hero.imageUrl, "https://cdn.example.com/hero.png");
  assert.equal(hero.headline, "Cut to your size");
  assert.match(hero.text, /^\{\{ contact\.salutation_phrase \}\} \{\{ contact\.lastname \}\}\n\nOrder gaskets/);
  assert.equal(hero.button.label, "TRY IT");
  const story = blocks[1];
  assert.ok(story.kind === "article");
  assert.equal(story.title, "Already tried DirectUP?");
  assert.equal(story.link.url, "https://shop.example.com/up");
});

test("its words in short for the assistant, without HubSpot's tokens", () => {
  const d = digestOf(readEmail(email), 400);
  assert.match(d, /^Subject: Gaskets made to measure\nPreheader: Two clicks, any size/);
  assert.match(d, /\[button: UPLOAD AN ORDER\]/);
  assert.doesNotMatch(d, /\{\{/);
  assert.ok(d.length <= 400);
});

test("a short line alone titles the story under it; a lead text with no short first line takes the subject as headline", () => {
  const parts = [
    { kind: "image" as const, widget: "a", src: "https://cdn.example.com/head.png", alt: "", url: "" },
    { kind: "text" as const, widget: "b", html: "", text: "We keep making your day easier. Today: the improved DirectUP." },
    { kind: "text" as const, widget: "c", html: "", text: "From your order document to your cart in 3 steps" },
    { kind: "image" as const, widget: "d", src: "https://cdn.example.com/step1.png", alt: "", url: "" },
    { kind: "text" as const, widget: "e", html: "", text: "Upload the document you already have: a PDF, an Excel file or a photo." },
  ];
  const blocks = blocksFrom(parts, "Turn your order document into a webshop order");
  assert.deepEqual(blocks.map((b) => b.kind), ["hero", "article"]);
  const hero = blocks[0];
  assert.ok(hero.kind === "hero" && hero.headline === "Turn your order document into a webshop order" && hero.text.startsWith("We keep making"));
  const step = blocks[1];
  assert.ok(step.kind === "article" && step.title === "From your order document to your cart in 3 steps" && step.imageUrl.endsWith("step1.png"));
});
