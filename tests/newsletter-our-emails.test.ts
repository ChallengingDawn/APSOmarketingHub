import assert from "node:assert/strict";
import { test } from "node:test";
import { blocksFrom, digestOf, draftFrom, groupEmails, isIcon, picturesToUpload, readEmail, readingOrder, type RawEmail, type RawEmailFull } from "../src/lib/content/studio/kinds/newsletter/ourEmails";

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

test("a HubSpot draft: the original's content, only what was changed rewritten, the rest said", () => {
  const source = { ...email, from: { fromName: "APSOparts" }, subscriptionDetails: { subscriptionId: 9 }, content: { ...email.content, templatePath: "@hubspot/email/dnd/Start_from_scratch.html", styleSettings: { bodyColor: "#fff" } } };
  const blocks = blocksFrom(readEmail(email).parts, "Gaskets made to measure");
  // unchanged: nothing rewritten
  const same = draftFrom(source, { subject: "S", preheader: "P", language: "EN", blocks }, { name: "N", uploaded: {} });
  assert.deepEqual(same.changed, []);
  const w = (same.body.content as { widgets: Record<string, { body: Record<string, unknown> }> }).widgets;
  assert.equal(w.intro.body.html, email.content!.widgets!.intro.body!.html);
  assert.equal(w.preview_text.body.value, "P");
  assert.equal(same.body.subcategory, "batch");
  assert.deepEqual(same.body.from, { fromName: "APSOparts" });
  // the story's words, its button and the lead picture changed; a block added; the greeting never written over
  const hero = blocks[0];
  const story = blocks[1];
  assert.ok(hero.kind === "hero" && story.kind === "article");
  const edited = [
    { ...hero, imageUrl: "/api/content/picture/12-0123456789abcdef01" },
    { ...story, text: "Upload a **PDF** order - the parts are found for you.", link: { label: "TRY IT NOW", url: "https://shop.example.com/up2" } },
    { id: "new", kind: "text" as const, text: "A new paragraph" },
  ];
  const plan = draftFrom(source, { subject: "S", preheader: "P", language: "EN", blocks: edited }, { name: "N", uploaded: { "/api/content/picture/12-0123456789abcdef01": "https://cdn.example.com/up/12.jpg" } });
  const pw = (plan.body.content as { widgets: Record<string, { body: Record<string, unknown> }> }).widgets;
  assert.equal(pw.story2.body.html, "<p><strong>Already tried DirectUP?</strong></p><p>Upload a <strong>PDF</strong> order - the parts are found for you.</p>");
  assert.equal(pw.btn2.body.text, "TRY IT NOW");
  assert.equal(pw.btn2.body.destination, "https://shop.example.com/up2");
  assert.equal((pw.hero.body.img as { src: string }).src, "https://cdn.example.com/up/12.jpg");
  assert.equal(pw.hi.body.html, email.content!.widgets!.hi.body!.html);
  assert.ok(plan.notes.some((n) => /1 block added/.test(n)));
  assert.deepEqual(picturesToUpload({ blocks: edited }), ["/api/content/picture/12-0123456789abcdef01"]);
});


/* ── Content v4 (09.11.2026): our step-by-step and side-by-side e-mails, read as SARCLA would ─────────────────────── */

test("step numbers and small icons are not story pictures", () => {
  assert.equal(isIcon({ src: "https://cdn.example.com/1_Arial.png", alt: "1_Arial", w: 45, h: 45 }), true);
  assert.equal(isIcon({ src: "https://cdn.example.com/1_Arial.png", alt: "1_Arial" }), true, "named as a step, size not given");
  assert.equal(isIcon({ src: "https://cdn.example.com/02_DirectCUT.png", alt: "02_DirectCUT", w: 260, h: 260 }), false, "a numbered picture of a size is a picture");
  assert.equal(isIcon({ src: "https://cdn.example.com/Img1.png", alt: "", w: 560, h: 285 }), false);
  assert.equal(isIcon({ src: "https://cdn.example.com/MAIL.jpg", alt: "MAIL", w: 30, h: 30 }), true);
});

test("a grid of stories side by side is read column by column; our footer row stays out of it", () => {
  const order = readingOrder([
    { columns: [{ widgets: ["intro"] }] },
    { columns: [{ widgets: ["t1"] }, { widgets: ["t2"] }] },
    { columns: [{ widgets: ["p1"] }, { widgets: ["p2"] }] },
    { columns: [{ widgets: ["x1"] }, { widgets: ["x2"] }] },
    { columns: [{ widgets: ["follow"] }, { widgets: ["support"] }] },
  ], (w) => w === "follow");
  assert.deepEqual(order, ["intro", "t1", "p1", "x1", "t2", "p2", "x2", "follow", "support"]);
});

const row = (id: string) => ({ columns: [{ widgets: [id] }] });
const steps: RawEmailFull = {
  id: 88, name: "EN_New_Features_DirectUP_2610", subject: "Turn your order document into a shop order", language: "en",
  content: {
    flexAreas: { main: { sections: ["head", "hi", "intro", "btn1", "h3steps", "n1", "s1", "img1", "n2", "s2", "img2", "more", "btn2"].map(row) } },
    widgets: {
      head: { body: { path: "@hubspot/image_email", img: { src: "https://cdn.example.com/Header.png", alt: "Header", width: 600, height: 588 } } },
      hi: { body: { html: "<p>{{ contact.salutation_phrase }} {{ contact.lastname }}</p>" } },
      intro: { body: { html: "<p>We keep making your everyday work in the shop easier. This time: DirectUP, improved.</p>" } },
      btn1: { body: { path: "@hubspot/button_email", text: "TRY DIRECTUP", destination: "https://shop.example.com/up" } },
      h3steps: { body: { html: "<p><strong>From your order document to your cart in 3 steps</strong></p>" } },
      n1: { body: { module_id: 1367093, img: { src: "https://cdn.example.com/1_Arial.png", alt: "1_Arial", width: 45, height: 45 } } },
      s1: { body: { html: "<p><strong>Upload the document you already have</strong></p><p>Use a PDF, an Excel file, a scan or a photo - from your computer or your phone.</p>" } },
      img1: { body: { module_id: 1367093, img: { src: "https://cdn.example.com/Img1.png", alt: "Img1", width: 500, height: 255 } } },
      n2: { body: { module_id: 1367093, img: { src: "https://cdn.example.com/2_Arial.png", alt: "2_Arial", width: 45, height: 45 } } },
      s2: { body: { html: "<p><strong>Check the articles found</strong></p><p>DirectUP knows our article numbers and your own, and shows what it found for you to check.</p>" } },
      img2: { body: { module_id: 1367093, img: { src: "https://cdn.example.com/Img2.png", alt: "Img2", width: 560, height: 285 } } },
      more: { body: { html: "<p><strong>More tools for your everyday work</strong></p><p>Discover the other tools and features we added to the shop lately, each a click away.</p>" } },
      btn2: { body: { path: "@hubspot/button_email", text: "DIRECTCUT", destination: "https://shop.example.com/cut" } },
    },
  },
};

test("a step-by-step e-mail: the short heading titles the next story, each screenshot stays with its step, no step number is a picture", () => {
  const e = readEmail(steps);
  const blocks = blocksFrom(e.parts, e.subject);
  const pics = blocks.flatMap((b) => ("imageUrl" in b && b.imageUrl ? [b.imageUrl] : []));
  assert.ok(!pics.some((u) => /_Arial/.test(u)), "no step number became a picture");
  const stories = blocks.filter((b) => b.kind === "article") as Extract<typeof blocks[number], { kind: "article" }>[];
  assert.equal(stories[0].title, "From your order document to your cart in 3 steps");
  assert.match(stories[0].text, /^\*\*Upload the document you already have\*\*\n\nUse a PDF/);
  assert.equal(stories[0].imageUrl, "https://cdn.example.com/Img1.png");
  assert.equal(stories[1].title, "Check the articles found");
  assert.equal(stories[1].imageUrl, "https://cdn.example.com/Img2.png", "the screenshot under step 2 is step 2's");
  assert.equal(stories[2].title, "More tools for your everyday work");
  assert.equal(stories[2].link.label, "DIRECTCUT");
  assert.ok(!blocks.some((b) => b.kind === "text" && /3 steps/.test(b.text)), "the heading is not left alone as a text block");
  const hero = blocks.find((b) => b.kind === "hero");
  assert.ok(hero && hero.kind === "hero" && hero.headline === "Turn your order document into a shop order");
});

test("a greeting is never a story's title", () => {
  const blocks = blocksFrom([
    { kind: "image", widget: "a", src: "https://cdn.example.com/big.jpg", alt: "", url: "", w: 600, h: 600 },
    { kind: "text", widget: "b", html: "", text: "Dear Customer,\n\nProcurement teams often spend more time preparing orders than placing them." },
  ], "Three ways to spend less time placing orders");
  const hero = blocks[0];
  assert.ok(hero.kind === "hero");
  assert.equal(hero.headline, "Three ways to spend less time placing orders");
  assert.match(hero.text, /^Dear Customer,/);
});
