import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { cleanVideo, newScene, videoText, type VideoDoc } from "../src/lib/content/studio/kinds/video/model";
import { DEFAULT_PART, PART, PARTS, isPart, partOf } from "../src/lib/content/studio/kinds/video/parts";
import { cleanScene, featuresForScene, lengthOf, sceneFrom, sceneUser, storyboardUser, type VideoCtx } from "../src/lib/content/studio/kinds/video/ai";
import { emptyBanner } from "../src/lib/content/studio/kinds/banner/model";
import { pasteBlock, pickCss, previewDoc, prefixFor, stillMarkup } from "../src/lib/content/studio/kinds/banner/render";

// Content v3 (08.11.2026, SARCLA tonight): the video's real parts, its length and its AI for one scene; the banner's
// parts clicked on the banner itself.

const ctx: VideoCtx = {
  projectTitle: "Food plants", piece: { id: 9, title: "Video · EN", language: "EN" },
  brief: { goal: "More seal orders from food plants", audience: "Maintenance buyers", message: "The right seal, in stock", keywords: [] },
};

const film = (over: Partial<VideoDoc> = {}): VideoDoc => cleanVideo({
  format: "16:9", language: "EN", features: ["no-surcharge"],
  scenes: [
    { id: "a", kind: "title", bars: 2, copy: { line1: "Small orders, *welcome*" }, shape: "oring" },
    { id: "b", kind: "feature", bars: 2, copy: { kicker: "No surcharge", line1: "Two pieces, same care", sub: "A two-position order gets the same treatment as a large one." }, feature: "no-surcharge" },
    { id: "c", kind: "product", bars: 2, copy: { kicker: "FKM O-ring", line1: "For heat and oil" }, part: "oring-fkm" },
  ],
  endCard: { line: "Seals, *in stock*.", cta: "apsoparts.com", bars: 2, part: "oring-vmq" },
  ...over,
});

test("our parts are the shop's own photos, cut out, kept beside the film's logo - nothing drawn", () => {
  assert.ok(PARTS.length >= 5);
  for (const p of PARTS) {
    assert.ok(existsSync(path.join(process.cwd(), "public", "video", p.cut)), `${p.key}: its cut-out is in public/video`);
    assert.match(p.photo, /^https:\/\/www\.apsoparts\.com\/media\/catalog\/product\//, `${p.key}: from the shop's product photos`);
    assert.match(p.shop, /^https:\/\/www\.apsoparts\.com\//);
    assert.ok(p.ratio > 0.4 && p.ratio < 1.2);
  }
  // the materials SARCLA named: black NBR, brown FKM, red silicone
  assert.match(PART["oring-nbr"].note, /black/i);
  assert.match(PART["oring-fkm"].note, /brown/i);
  assert.match(PART["oring-vmq"].note, /red/i);
});

test("a scene's part: its own, else the drawn shape it had before the photos; the end card keeps its part", () => {
  assert.equal(partOf({ part: "xring" }), "xring");
  assert.equal(partOf({ shape: "oring" }), DEFAULT_PART);
  assert.equal(partOf({ shape: "seal" }), "shaft-seal");
  assert.equal(partOf({ shape: "none" }), null);
  assert.equal(partOf({ part: "nonsense", shape: "seal" }), "shaft-seal");
  assert.ok(!isPart("oring"));
  const d = film();
  assert.equal(d.scenes[2].part, "oring-fkm");
  assert.equal(d.scenes[1].part, undefined, "a feature scene takes a photo, not a part");
  assert.equal(d.endCard.part, "oring-vmq");
  assert.equal(newScene("product").part, DEFAULT_PART, "a new product scene shows a real O-ring");
  assert.equal(cleanVideo({ endCard: { part: "drawn" } }).endCard.part, undefined);
  assert.match(videoText(d), /\[O-ring FKM\]/);
  assert.match(videoText(d), /O-ring silicone$/m);
});

test("the film's length is kept and asked for; a length we do not offer is dropped", () => {
  assert.equal(cleanVideo({ length: 30 }).length, 30);
  assert.equal(cleanVideo({ length: 45 }).length, undefined);
  assert.equal(lengthOf(film({ length: 15 })), 15);
  assert.equal(lengthOf(film({ length: 15 }), { seconds: 30 }), 30);
  assert.equal(lengthOf(film()), null);
  assert.match(storyboardUser(ctx, film(), { seconds: 15 }), /about 15 seconds in all: 6 bars of scenes/);
});

test("the AI picks a real part for a scene; a part on a kind that shows none is not kept", () => {
  const base = { bars: 2, kicker: "", line1: "x", line2: "", line3: "", sub: "", feature: "", icon: "" };
  const prod = sceneFrom({ ...base, kind: "product", kicker: "Silicone O-ring", shape: "oring", part: "oring-vmq" }, "p1", [], []);
  assert.equal(prod?.part, "oring-vmq");
  const words = sceneFrom({ ...base, kind: "words", line1: "Fast", shape: "none", part: "oring-vmq" }, "w1", [], []);
  assert.equal(words?.part, undefined);
});

test("one scene changed: its place and id kept, the others untouched; shorter never lengthens", () => {
  const cur = film();
  const raw = { scene: { kind: "title", bars: 2, kicker: "", line1: "Small orders", line2: "", line3: "", sub: "", shape: "oring", part: "", feature: "", icon: "" }, note: "Shorter." };
  const r = cleanScene(raw, cur, ctx, { index: 0, how: "shorter" });
  assert.equal(r.doc.scenes[0].id, "a");
  assert.equal(r.doc.scenes[0].copy.line1, "Small orders");
  assert.deepEqual(r.doc.scenes.slice(1), cur.scenes.slice(1));
  assert.equal(r.doc.scenes[0].part, undefined);
  assert.equal(partOf(r.doc.scenes[0]), DEFAULT_PART, "the O-ring it showed stays");
  const longer = cleanScene({ scene: { ...raw.scene, line1: "Small orders are very welcome here, always" }, note: "" }, cur, ctx, { index: 0, how: "shorter" });
  assert.equal(longer.doc.scenes[0].copy.line1, "Small orders, *welcome*");
  assert.match(longer.note, /not shorter/);
  const gone = cleanScene(raw, cur, ctx, { index: 7, how: "ask" });
  assert.deepEqual(gone.doc.scenes, cur.scenes);
});

test("another feature for one scene: one the film does not tell yet, brought into the film's own list", () => {
  const cur = film();
  const others = featuresForScene(cur, 1);
  assert.ok(!others.includes("no-surcharge"));
  assert.ok(others.length > 3);
  const raw = { scene: { kind: "number", bars: 2, kicker: "", line1: "48/72h", line2: "delivery across *Europe*", line3: "", sub: "In-stock items ship in 48/72h across Europe.", shape: "none", part: "", feature: "delivery", icon: "truck" }, note: "" };
  const r = cleanScene(raw, cur, ctx, { index: 1, how: "feature" });
  assert.equal(r.doc.scenes[1].id, "b");
  assert.equal(r.doc.scenes[1].feature, "delivery");
  assert.deepEqual(r.doc.features, ["no-surcharge", "delivery"]);
  // asked in its own words, a figure no feature of the film states is not kept
  const bad = cleanScene({ scene: { ...raw.scene, line1: "24h", feature: "" } }, cur, ctx, { index: 1, how: "ask" });
  assert.equal(bad.doc.scenes[1].kind, "feature");
  assert.match(sceneUser(ctx, cur, { index: 1, how: "feature" }), /ANOTHER APSOparts feature/);
});

test("the banner's frame tells the studio which part was clicked; the paste block itself stays clean", () => {
  const d = { ...emptyBanner("EN"), content: { ...emptyBanner("EN").content, headline: "Seals in stock", line: "Two minutes to order.", button: { label: "Shop seals", url: "seals" } } };
  const P = prefixFor(12);
  const block = pasteBlock(d, "band", P, "T");
  assert.ok(!/apsoBanner/.test(block), "nothing of the studio in what is pasted into Magento");
  const doc = previewDoc(block, "", "#fff", P);
  assert.match(doc, /apsoBanner: "pick"/);
  assert.match(doc, new RegExp(`\\.${P} \\.${P}-h:hover`));
  assert.ok(!/apsoBanner: "pick"/.test(previewDoc(block, "")), "without a prefix, nothing can be picked");
  const css = pickCss(P, ".bnstage ", 0.5);
  assert.match(css, /outline:4\.00px dashed/, "the outline is 2 px on screen at half size");
  assert.match(stillMarkup(d, "card", P).html, new RegExp(`class="${P}-h"`));
});
