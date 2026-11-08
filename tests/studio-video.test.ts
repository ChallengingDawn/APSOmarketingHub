import assert from "node:assert/strict";
import { test } from "node:test";
import { backOut, bezier, clamp, EASE, interpolate, kf, p, spring } from "../src/lib/content/studio/kinds/video/engine/math";
import { BAR, BEAT, beatPulse, FPS, timecode } from "../src/lib/content/studio/kinds/video/engine/timeline";
import { barHop, drop, hop, roll, wobble } from "../src/lib/content/studio/kinds/video/engine/physics";
import { fitBlock, fitFlow, fitFs, lineW, parse, plain, wordCount } from "../src/lib/content/studio/kinds/video/engine/text";
import {
  cleanImage, cleanVideo, emptyVideo, forbidden, fromSpec, KIND_INFO, newScene, readSeconds, SCENE_KINDS, segmentAt, segments,
  toSpec, totalBars, totalFrames, validate, videoText, type VideoDoc,
} from "../src/lib/content/studio/kinds/video/model";
import { boxesOf, LAYOUTS, TALL_SAFE } from "../src/lib/content/studio/kinds/video/film/layout";
import { covers, CUT_FRAMES, enterFx, exitFx, shotFx, STILL, sweepBand } from "../src/lib/content/studio/kinds/video/film/cuts";
import { cleanStoryboard, cleanTighten, cleanVariant, context, quoteAllowed, type VideoCtx } from "../src/lib/content/studio/kinds/video/ai";

// The video studio (08.11.2026): a film in our motion style, drawn as a pure function of the frame; cuts on the bar.

const film = (over: Partial<VideoDoc> = {}): VideoDoc => cleanVideo({
  format: "16:9", language: "EN",
  scenes: [
    { id: "a", kind: "title", bars: 2, copy: { kicker: "APSOparts DirectCUT", line1: "Cut to *your* size" }, shape: "oring" },
    { id: "b", kind: "words", bars: 1, copy: { line1: "Any length.", line2: "Any profile." } },
    { id: "c", kind: "steps", bars: 2, copy: { line1: "Pick the profile", line2: "Enter the length", line3: "Order" } },
  ],
  endCard: { line: "Sealing parts, *one click away*.", cta: "apsoparts.com", bars: 2 },
  ...over,
});

const ctx: VideoCtx = {
  projectTitle: "DirectCUT autumn", piece: { id: 7, title: "Video · EN", language: "EN" },
  brief: { goal: "More DirectCUT orders", audience: "Maintenance buyers", message: "Seals cut to length, ordered online. Customer: \"It was in our hands in two days.\"", keywords: ["DirectCUT"] },
};

// ───────────────────────── the engine ─────────────────────────

test("interpolate maps, clamps and eases like the team's engine", () => {
  assert.equal(interpolate(5, [0, 10], [0, 100]), 50);
  assert.equal(interpolate(15, [0, 10], [0, 100]), 150);
  assert.equal(interpolate(15, [0, 10], [0, 100], { extrapolateRight: "clamp" }), 100);
  assert.equal(interpolate(-5, [0, 10], [0, 100], { extrapolateLeft: "clamp" }), 0);
  assert.equal(interpolate(15, [0, 10, 20], [0, 100, 0]), 50);
});

test("bezier easing runs 0 to 1 and the shop's ease is fast out", () => {
  const e = bezier(0.22, 1, 0.36, 1);
  assert.equal(e(0), 0);
  assert.equal(e(1), 1);
  assert.ok(e(0.3) > 0.6, "most of the way after a third of the time");
  assert.equal(bezier(0.3, 0.3, 0.7, 0.7)(0.42), 0.42);
  assert.equal(p(10, 0, 20, (t) => t), 0.5);
  assert.equal(p(-1, 0, 20), 0);
  assert.equal(p(99, 0, 20), 1);
  assert.equal(EASE(0.5) > 0.5, true);
});

test("a spring starts at rest, overshoots when light, settles at 1", () => {
  assert.equal(spring({ frame: 0, fps: FPS }), 0);
  assert.equal(spring({ frame: -5, fps: FPS }), 0);
  const light = Array.from({ length: 60 }, (_, f) => spring({ frame: f, fps: FPS, config: { damping: 10 } }));
  assert.ok(Math.max(...light) > 1.05, "it overshoots");
  assert.ok(Math.abs(spring({ frame: 200, fps: FPS, config: { damping: 200 } }) - 1) < 1e-3);
  assert.ok(backOut(0.7) > 1, "backOut passes above 1");
  assert.equal(backOut(1), 1);
});

test("keyframes ease every key from one to the next", () => {
  const keys: [number, { x: number; y: number }][] = [[0, { x: 0, y: 10 }], [10, { x: 100, y: 10 }]];
  assert.deepEqual(kf(-3, keys), { x: 0, y: 10 });
  assert.deepEqual(kf(20, keys), { x: 100, y: 10 });
  assert.equal(kf(5, keys, (t) => t).x, 50);
});

test("the clock: 120 BPM at 30 fps is a beat of 15 frames, a bar of 60", () => {
  assert.equal(BEAT, 15);
  assert.equal(BAR, 60);
  assert.equal(timecode(0), "0:00.00");
  assert.equal(timecode(75), "0:02.15");
  assert.equal(timecode(30 * 61), "1:01.00");
  assert.ok(Math.abs(beatPulse(15, 0) - beatPulse(30, 0)) < 1e-9, "every beat punches the same");
  assert.ok(beatPulse(15, 0) > beatPulse(20, 0), "and falls off after it");
  assert.equal(beatPulse(5, 10), 0);
});

test("physics: a drop lands on its frame, bounces lower each time, rests on the floor", () => {
  assert.equal(drop(0, 0, 200, 10).y, 200);
  assert.ok(drop(5, 0, 200, 10).y < 200 && drop(5, 0, 200, 10).y > 0);
  const land = drop(10, 0, 200, 10);
  assert.ok(land.landed && land.y < 1 && land.squash > 0.9, "it hits the floor on frame 10, hard");
  const ys = Array.from({ length: 80 }, (_, f) => drop(f, 0, 200, 10).y);
  assert.ok(ys.every((y) => y >= 0), "never through the floor");
  const firstBounce = Math.max(...ys.slice(11, 24));
  assert.ok(firstBounce > 0 && firstBounce < 200 * 0.2, "a bounce, lower than the drop");
  assert.equal(ys[79], 0);
  assert.equal(drop(79, 0, 200, 10).squash, 0);
});

test("physics: a roll comes to rest at 0, turning as far as it travelled; rocks die out; hops land", () => {
  const r0 = roll(0, 0, 30, 600, 100);
  assert.equal(r0.x, 600);
  assert.ok(Math.abs(r0.angle - (600 / 100) * (180 / Math.PI)) < 1e-9, "it rolls, it does not slide");
  assert.equal(roll(30, 0, 30, 600, 100).x, 0);
  assert.equal(roll(30, 0, 30, 600, 100).moving, false);
  assert.ok(roll(10, 0, 30, 600, 100).x > roll(20, 0, 30, 600, 100).x, "it slows to a stop");
  assert.equal(wobble(-1, 0, 8), 0);
  assert.ok(Math.abs(wobble(120, 0, 8)) < 0.01);
  assert.equal(hop(0, 0, 12, 40), 0);
  assert.equal(hop(6, 0, 12, 40), 40);
  assert.ok(hop(40, 0, 12, 40) < 1);
  assert.equal(barHop(59, 0, 60, 40), barHop(119, 60, 60, 40));
  assert.ok(barHop(66, 0, 60, 40) > 30, "it hops again on the next bar");
});

test("text: *red* markup, plain text and word counts", () => {
  assert.deepEqual(parse("Cut to *your* size"), [{ t: "Cut", red: false }, { t: "to", red: false }, { t: "your", red: true }, { t: "size", red: false }]);
  assert.deepEqual(parse("*one click away*.").map((w) => w.red), [true, true, true, false]);
  assert.equal(plain("Cut to *your*  size"), "Cut to your size");
  assert.equal(wordCount("Cut to *your* size"), 4);
  assert.equal(wordCount("  "), 0);
});

test("text: a block shrinks to its box, and in a narrow format a long line breaks in two instead", () => {
  const wide = fitFs(["Cut to your size"], 700, 150, 1000);
  assert.ok(wide <= 150);
  assert.ok(lineW("Cut to your size", 700, wide) <= 1000);
  const shrunk = fitBlock(["Sealing parts in every size you need"], 700, 140, { w: 900, h: 600 });
  const broken = fitBlock(["Sealing parts in every size you need"], 700, 140, { w: 900, h: 600 }, { breakable: true, maxLines: 4 });
  assert.equal(shrunk.lines.length, 1);
  assert.ok(broken.lines.length >= 2 && broken.fs > shrunk.fs, "broken in two it reads bigger");
  for (const l of broken.lines) assert.ok(lineW(l, 700, broken.fs) <= 900 + 0.5);
  assert.ok(broken.lines.length * broken.fs * 1.08 <= 600 + 0.5, "and it fits the height");
  // the key word keeps its colour across the break
  const kept = fitBlock(["Order *your seals* online in minutes"], 700, 160, { w: 600, h: 900 }, { breakable: true });
  assert.deepEqual(kept.lines.flat().filter((w) => w.red).map((w) => w.t), ["your", "seals"]);
  const q = fitFlow("It was in our hands in two days and fitted the first time we tried", 500, 66, { w: 900, h: 400 });
  assert.ok(q.lines.length > 1 && q.lines.length * q.fs * 1.2 <= 400);
});

// ───────────────────────── the document ─────────────────────────

test("an empty film has an end card and plays 2 bars; the first studio's notes are kept", () => {
  const e = emptyVideo({ language: "de" });
  assert.equal(e.language, "DE");
  assert.equal(totalFrames(e), 2 * BAR);
  const old = cleanVideo({ v: 1, notes: "Use the new DirectCUT pictures" });
  assert.equal(old.v, 2);
  assert.equal(old.notes, "Use the new DirectCUT pictures");
  assert.equal(old.endCard.cta, "apsoparts.com");
});

test("cleaning holds a document to the library: kinds, bars 1-4, ids unique, pictures as addresses only", () => {
  const d = cleanVideo({
    format: "4:3",
    scenes: [
      { id: "x", kind: "nope", bars: 9, copy: { line1: "Hello", junk: "no" } },
      { id: "x", kind: "product", bars: 0, copy: { kicker: "FKM O-ring" }, image: "data:image/png;base64,AAAA" },
      { kind: "product", copy: { kicker: "Seal" }, image: "https://www.apsoparts.com/media/x.jpg", shape: "seal" },
    ],
  });
  assert.equal(d.format, "16:9");
  assert.equal(d.scenes[0].kind, "words");
  assert.equal(d.scenes[0].bars, 4);
  assert.equal(d.scenes[1].bars, 1);
  assert.notEqual(d.scenes[0].id, d.scenes[1].id);
  assert.equal(d.scenes[1].image, undefined, "never the picture itself");
  assert.equal(d.scenes[2].image, "https://www.apsoparts.com/media/x.jpg");
  assert.equal(d.scenes[2].shape, "seal");
  assert.equal(cleanImage("/video/brand/x.svg"), "/video/brand/x.svg");
  assert.equal(cleanImage("//evil.example/x.png"), undefined);
  assert.equal(cleanImage("javascript:alert(1)"), undefined);
  assert.ok(JSON.stringify(film()).length < 2000, "a film is small - far under the 8 KB a request may carry");
});

test("every scene starts on a bar line; the end card closes the film", () => {
  const d = film();
  const segs = segments(d);
  assert.deepEqual(segs.map((s) => [s.kind, s.start, s.dur]), [["title", 0, 120], ["words", 120, 60], ["steps", 180, 120], ["end", 300, 120]]);
  for (const s of segs) assert.equal(s.start % BAR, 0);
  assert.equal(totalBars(d), 7);
  assert.equal(totalFrames(d), 420);
  assert.deepEqual(segs.map((s) => s.cut), ["open", "whip", "sweep", "lift"]);
  assert.equal(segmentAt(segs, 0).kind, "title");
  assert.equal(segmentAt(segs, 179).kind, "words");
  assert.equal(segmentAt(segs, 180).kind, "steps");
  assert.equal(segmentAt(segs, 9999).kind, "end");
  const cut = cleanVideo({ ...d, scenes: d.scenes.map((s, i) => (i === 1 ? { ...s, cut: "sweep" } : s)) });
  assert.equal(segments(cut)[1].cut, "sweep");
});

test("the rules: never a discount value, no prices, few words, time to read", () => {
  assert.ok(forbidden("Up to 20% off"));
  assert.ok(forbidden("20 Prozent Rabatt"));
  assert.ok(forbidden("% 15"));
  assert.ok(forbidden("From CHF 12.50"));
  assert.ok(forbidden("ab 9 €"));
  assert.equal(forbidden("Delivered in 48 hours"), null);
  assert.equal(forbidden("FKM O-ring 20 x 2 mm"), null);
  const d = film({
    scenes: [
      { id: "a", kind: "words", bars: 1, copy: { line1: "Now *20%* off" } },
      { id: "b", kind: "claim", bars: 1, copy: { line1: "Every seal you need is here today for you" } },
      { id: "c", kind: "quote", bars: 2, copy: { line1: "" } },
      { id: "d", kind: "title", bars: 4, copy: { line1: "Hello" } },
    ],
  });
  const issues = validate(d);
  assert.ok(issues.some((i) => i.scene === 0 && i.level === "stop"));
  assert.ok(issues.some((i) => i.scene === 1 && i.field === "line1" && /words/.test(i.text)));
  assert.ok(issues.some((i) => i.scene === 2 && /empty/.test(i.text)));
  assert.ok(issues.some((i) => i.scene === 3 && /new scene every bar or two/.test(i.text)));
  assert.ok(!validate(film()).some((i) => i.level === "stop"));
  assert.ok(readSeconds({ kind: "words", copy: { line1: "One two three" } }) < 2);
});

test("every kind has its fields and bars; a new scene starts in its kind's range", () => {
  for (const k of SCENE_KINDS) {
    const info = KIND_INFO[k];
    assert.ok(info.fields.some((f) => f.required), `${k} has a required field`);
    for (const f of info.fields) assert.ok(f.words > 0 && f.chars >= f.words * 4);
    const s = newScene(k);
    assert.ok(s.bars >= info.bars.min && s.bars <= info.bars.max);
  }
});

test("the script reads the film: kinds, bars, time codes, the end card", () => {
  const t = videoText(film());
  assert.match(t, /^Video · 16:9 · EN · 14 s \(7 bars\)/);
  assert.match(t, /1\. Title · 2 bars · 0:00\.00 - APSOparts DirectCUT \/ Cut to your size \[O-ring\]/);
  assert.match(t, /End card · 2 bars · 0:10\.00 - APSOparts \/ Sealing parts, one click away\. \/ \[apsoparts\.com\]/);
});

test("the spec for the render machine carries the story, its size and length; a format can be asked for", () => {
  const s = toSpec(film(), { title: "DirectCUT", pieceId: 7, at: "2026-11-08T00:00:00.000Z", format: "9:16" });
  assert.equal(s.width, 1080);
  assert.equal(s.height, 1920);
  assert.equal(s.frames, 420);
  assert.equal(s.fps, 30);
  const back = fromSpec(JSON.parse(JSON.stringify(s)));
  assert.ok(back);
  assert.equal(back.doc.format, "9:16");
  assert.equal(back.doc.scenes.length, 3);
  assert.equal(fromSpec({ kind: "other" }), null);
});

// ───────────────────────── layouts and cuts ─────────────────────────

test("9:16 keeps everything between y 250 and 1650; every box is inside its frame", () => {
  for (const [fmt, L] of Object.entries(LAYOUTS)) {
    for (const [name, b] of boxesOf(L)) {
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= L.W && b.y + b.h <= L.H, `${fmt} ${name} inside the frame`);
      if (fmt === "9:16") assert.ok(b.y >= TALL_SAFE.top && b.y + b.h <= TALL_SAFE.bottom, `9:16 ${name} inside y 250-1650`);
    }
    assert.ok(L.logo.x < L.W * 0.12 && L.logo.y < L.H * 0.2, `${fmt}: the logo is top left`);
    assert.ok(L.bigLogo.h > L.logo.h * 2.5, `${fmt}: APSOparts is big on the end card`);
  }
});

test("cuts: the sweep's band hides the whole frame across the bar line; whips and lifts settle", () => {
  for (const L of Object.values(LAYOUTS)) {
    for (const f of [98, 99, 100, 101, 102]) assert.ok(covers(sweepBand(f, 100, L.W, L.H), L.W), `${L.fmt} covered on ${f}`);
    assert.equal(sweepBand(100 - CUT_FRAMES.sweepHalf - 1, 100, L.W, L.H), null);
    assert.equal(sweepBand(100 + CUT_FRAMES.sweepHalf, 100, L.W, L.H), null);
    const first = sweepBand(100 - CUT_FRAMES.sweepHalf, 100, L.W, L.H)!;
    assert.ok(first.left + first.width + first.slant <= 0, "it comes in from off screen");
  }
  assert.deepEqual(enterFx("whip", 8, 1920, 1080), STILL);
  assert.ok(enterFx("whip", 0, 1920, 1080).x > 900, "a whip comes in from the right");
  assert.ok(exitFx("whip", 59, 60, 1920, 1080).x < -400, "and leaves to the left");
  assert.equal(exitFx("whip", 40, 60, 1920, 1080).x, 0, "nothing moves before the cut");
  assert.ok(enterFx("lift", 0, 1920, 1080).y > 300);
  assert.equal(enterFx("open", 0, 1920, 1080).opacity, 0);
  assert.equal(enterFx("open", 40, 1920, 1080).opacity, 1);
  const d = segments(film());
  assert.equal(shotFx(d[1], d[2], 30, 1920, 1080).x, 0);
});

// ───────────────────────── the AI's answers ─────────────────────────

test("the AI's storyboard is held to the rules: no discount, no invented quote, kinds and bars kept in range", () => {
  const raw = {
    scenes: [
      { kind: "title", bars: 2, kicker: "DirectCUT", line1: "Cut to *your* size", line2: "", line3: "", sub: "", shape: "oring" },
      { kind: "words", bars: 7, kicker: "", line1: "Up to 20% off", line2: "Any length", line3: "", sub: "", shape: "none" },
      { kind: "quote", bars: 2, kicker: "", line1: "Best supplier we ever had", line2: "", line3: "", sub: "A customer", shape: "none" },
      { kind: "quote", bars: 2, kicker: "", line1: "It was in our hands in two days", line2: "", line3: "", sub: "A maintenance buyer", shape: "none" },
      { kind: "dance", bars: 1, kicker: "", line1: "x", line2: "", line3: "", sub: "", shape: "none" },
    ],
    endLine: "Sealing parts, *one click away*.", cta: "Order now for CHF 9", note: "Short and calm.",
  };
  const r = cleanStoryboard(raw, emptyVideo({ language: "EN" }), ctx);
  assert.deepEqual(r.doc.scenes.map((s) => s.kind), ["title", "words", "quote"]);
  assert.deepEqual(r.doc.scenes[1].copy, { line1: "Any length" }, "the discount line is gone, the next closes up");
  assert.equal(r.doc.scenes[1].bars, 4);
  assert.equal(r.doc.scenes[2].copy.line1, "It was in our hands in two days", "a quote the brief gave, word for word");
  assert.equal(r.doc.endCard.cta, "apsoparts.com", "a price on the button is dropped");
  assert.ok(r.dropped.some((x) => /discount/.test(x)));
  assert.ok(r.dropped.some((x) => /quote nobody gave us/.test(x)));
  assert.equal(new Set(r.doc.scenes.map((s) => s.id)).size, 3);
  assert.ok(quoteAllowed("it was in our hands, in two days!", [ctx.brief.message]));
  assert.ok(!quoteAllowed("", [ctx.brief.message]));
});

test("revise keeps the scenes it did not change in their place (same id)", () => {
  const cur = film();
  const raw = {
    scenes: [
      { kind: "title", bars: 2, kicker: "APSOparts DirectCUT", line1: "Cut to *your* size", line2: "", line3: "", sub: "", shape: "oring" },
      { kind: "claim", bars: 1, kicker: "", line1: "Ordered in a minute", line2: "", line3: "", sub: "", shape: "none" },
    ],
    endLine: "", cta: "", note: "",
  };
  const r = cleanStoryboard(raw, cur, ctx);
  assert.equal(r.doc.scenes[0].id, "a");
  assert.notEqual(r.doc.scenes[1].id, "a");
  assert.equal(r.doc.endCard.cta, "apsoparts.com");
});

test("shorter never lengthens, never touches a quote; another opening replaces only the first scene", () => {
  const cur = film({ scenes: [...film().scenes, { id: "q", kind: "quote", bars: 2, copy: { line1: "It was in our hands in two days", sub: "A buyer" } }] });
  const t = cleanTighten({
    scenes: [
      { id: "a", kicker: "DirectCUT", line1: "Your size", line2: "", line3: "", sub: "" },
      { id: "b", kicker: "", line1: "Any length at all, really, truly", line2: "", line3: "", sub: "" },
      { id: "q", kicker: "", line1: "Fast", line2: "", line3: "", sub: "Buyer" },
    ],
    endLine: "*One click away*.", cta: "apsoparts.com", note: "",
  }, cur);
  assert.equal(t.doc.scenes[0].copy.line1, "Your size");
  assert.equal(t.doc.scenes[0].copy.kicker, "DirectCUT");
  assert.equal(t.doc.scenes[1].copy.line1, "Any length.", "a longer line is refused");
  assert.equal(t.doc.scenes[3].copy.line1, "It was in our hands in two days");
  assert.equal(t.doc.endCard.line, "*One click away*.");
  const v = cleanVariant({ opening: { kind: "claim", bars: 1, kicker: "", line1: "Seals, cut for you", line2: "", line3: "", sub: "", shape: "none" }, note: "" }, cur, ctx);
  assert.equal(v.doc.scenes[0].kind, "claim");
  assert.deepEqual(v.doc.scenes.slice(1).map((s) => s.id), ["b", "c", "q"]);
  const none = cleanVariant({ opening: { kind: "quote", bars: 2, kicker: "", line1: "Invented praise", line2: "", line3: "", sub: "", shape: "none" }, note: "" }, cur, ctx);
  assert.equal(none.doc.scenes[0].id, "a", "nothing usable: the film stays as it was");
  assert.match(context(ctx, cur), /Write every word on screen in: English/);
});

test("clamp and the easing helpers stay inside their range", () => {
  assert.equal(clamp(2), 1);
  assert.equal(clamp(-2), 0);
  for (let i = 0; i <= 20; i++) {
    const v = EASE(i / 20);
    assert.ok(v >= 0 && v <= 1.0000001);
  }
});
