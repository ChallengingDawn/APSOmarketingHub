import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { applyCopy, applyPlace, type CopyAnswer } from "../src/lib/content/studio/kinds/banner/ai";
import { SHOP_PHOTOS } from "../src/lib/content/studio/kinds/banner/brand";
import { normalizeBanner } from "../src/lib/content/studio/kinds/banner/model";
import { FEATURES, featurePhoto } from "../src/lib/content/studio/kinds/video/features";
import { PARTS } from "../src/lib/content/studio/kinds/video/parts";
import { cleanStoryboard } from "../src/lib/content/studio/kinds/video/ai";

// The banner and video studios on the flow standard (09.11.2026): a part's ask changes that part only; a feature scene
// always shows a real photo (never an icon in a disc); our parts are never drawn taller than their own pixels.

const banner = () => normalizeBanner({
  format: "band", sizes: ["mail"], language: "EN",
  content: { eyebrow: "Seals", headline: "The right seal", rotatingWords: [], line: "One line of substance.", button: { label: "Shop seals", url: "seals" } },
  own: { mail: { eyebrow: "", headline: "Right seal", line: "Short line.", button: "" } },
});
const answer: CopyAnswer = {
  content: { eyebrow: "NEW EYEBROW", headline: "A new headline", rotatingWords: ["for dairies", "for breweries"], line: "A NEW LINE.", button: "NEW BUTTON" },
  own: { mail: { eyebrow: "", headline: "New head", line: "NEW SHORT", button: "" } },
};

test("a headline ask changes the headline (and its endings) only - the banner's and each place's own", () => {
  const d = applyCopy(banner(), answer, "headline");
  assert.equal(d.content.headline, "A new headline");
  assert.deepEqual(d.content.rotatingWords, ["for dairies", "for breweries"]);
  assert.equal(d.content.eyebrow, "Seals");
  assert.equal(d.content.line, "One line of substance.");
  assert.equal(d.content.button.label, "Shop seals");
  assert.equal(d.content.button.url, "seals");
  assert.equal(d.own.mail?.headline, "New head");
  assert.equal(d.own.mail?.line, "Short line.", "the place's own line stays");
});

test("a button or line ask touches nothing else; every word takes the whole answer", () => {
  const b = applyCopy(banner(), answer, "button");
  assert.equal(b.content.button.label, "NEW BUTTON");
  assert.equal(b.content.headline, "The right seal");
  assert.equal(b.own.mail?.headline, "Right seal");
  const l = applyCopy(banner(), answer, "line");
  assert.equal(l.content.line, "A NEW LINE.");
  assert.equal(l.own.mail?.line, "NEW SHORT");
  assert.equal(l.content.eyebrow, "Seals");
  const all = applyCopy(banner(), answer, null);
  assert.equal(all.content.eyebrow, "NEW EYEBROW");
  assert.equal(all.content.line, "A NEW LINE.");
  assert.deepEqual(all.own, answer.own);
  // the picture or the background is no words: the whole answer
  assert.equal(applyCopy(banner(), answer, "picture").content.headline, "A new headline");
});

test("shorter words for one place change that place's own words only", () => {
  const d = applyPlace(banner(), answer, "mail");
  assert.deepEqual(d.own.mail, answer.own.mail);
  assert.equal(d.content.headline, "The right seal");
  assert.equal(d.content.line, "One line of substance.");
  const same = banner();
  assert.equal(applyPlace(same, answer, "card"), same, "no answer for the place: the banner as it was");
  assert.equal(applyPlace(banner(), answer, "card").own.card, undefined);
});

test("every feature has a shop photo of its own - a feature scene never falls back to an icon in a disc", () => {
  const urls = new Set(SHOP_PHOTOS.map((p) => p.url));
  for (const f of FEATURES) {
    assert.ok(f.photo, `${f.key} has a photo`);
    assert.ok(urls.has(featurePhoto(f.key)), `${f.key}'s photo is one of the shop's`);
  }
  assert.ok(urls.has(featurePhoto(null)), "a scene without a feature still gets a shop photo");
});

test("a feature scene the AI writes comes with its feature's shop photo", () => {
  const ctx = { projectTitle: "Film", brief: { goal: "", audience: "", message: "", keywords: [] }, piece: { id: 1, title: "Film", language: "EN" } };
  const r = cleanStoryboard({
    scenes: [{ kind: "feature", bars: 2, kicker: "Quickorder", line1: "Your list, in the *cart*", line2: "", line3: "", sub: "", shape: "none", part: "", feature: "quickorder", icon: "quick" }],
    endLine: "Order it", cta: "apsoparts.com", note: "",
  }, { features: ["quickorder"] }, ctx, { features: ["quickorder"] });
  assert.equal(r.doc.scenes[0].image, featurePhoto("quickorder"));
});

test("our parts are never drawn taller than the cut-out's own pixels", () => {
  for (const p of PARTS) {
    const png = readFileSync(`public/video/${p.cut}`);
    const h = png.readUInt32BE(20);
    const w = png.readUInt32BE(16);
    assert.equal(p.px, h, `${p.key}: px is the cut-out's height`);
    assert.ok(Math.abs(p.ratio - w / h) < 0.01, `${p.key}: its ratio`);
  }
});

// ── round 2 (09.11.2026): words typed on the banner, the video's end card asks ──

import { readPart, targetOf, writePart } from "../src/lib/content/studio/kinds/banner/edit";
import { cleanEnd } from "../src/lib/content/studio/kinds/video/ai";

test("words typed on the banner go where the words shown came from - the place's own, else the banner's", () => {
  const d = banner();
  assert.equal(readPart(d, "band", "headline"), "The right seal");
  assert.equal(readPart(d, "mail", "headline"), "Right seal", "the newsletter shows its own words");
  assert.equal(targetOf(d, "mail", "headline"), "own");
  assert.equal(targetOf(d, "band", "headline"), "banner");
  const own = writePart(d, "mail", "headline", "Seals", "own");
  assert.equal(own.own.mail?.headline, "Seals");
  assert.equal(own.content.headline, "The right seal", "the banner's own words untouched");
  const all = writePart(d, "band", "headline", "Hygienic seals");
  assert.equal(all.content.headline, "Hygienic seals");
  assert.equal(all.own.mail?.headline, "Right seal");
  // emptied while typing, the field stays where it started (no jump to the banner's words)
  assert.equal(writePart(d, "mail", "headline", "", "own").own.mail?.headline, "");
  assert.equal(writePart(d, "band", "button", "Shop now").content.button.label, "Shop now");
  assert.equal(writePart(d, "band", "button", "Shop now").content.button.url, "seals");
  assert.equal(writePart(d, "band", "headline", "Two\nlines").content.headline, "Two lines", "one line, as the left card keeps it");
});

test("the end card's ask changes the end card only; Shorter is never longer", () => {
  const film = { v: 2, format: "16:9", scenes: [{ id: "a", kind: "claim", bars: 2, copy: { line1: "Seals that *fit*" } }], endCard: { line: "Order online today", cta: "apsoparts.com", bars: 2 } };
  const r = cleanEnd({ endLine: "Your seal, *found*", cta: "Shop seals", note: "Shorter." }, film, { how: "another" });
  assert.equal(r.doc.endCard.line, "Your seal, *found*");
  assert.equal(r.doc.endCard.cta, "Shop seals");
  assert.equal(r.doc.scenes[0].copy.line1, "Seals that *fit*");
  const longer = cleanEnd({ endLine: "Order your seals online today, fast", cta: "", note: "" }, film, { how: "shorter" });
  assert.equal(longer.doc.endCard.line, "Order online today", "not shorter: as it was");
  const off = cleanEnd({ endLine: "20% off every seal", cta: "", note: "" }, film, { how: "another" });
  assert.equal(off.doc.endCard.line, "Order online today", "a discount value never lands");
});
