import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateMeasure, hasKeyWords, layoutRich, lineStart, plainText, spans } from "../src/lib/editor/richText";
import {
  FORMATS, adaptDoc, blankDoc, clonePage, designText, emptyDesign, insertPage, isInlinePicture, movePage, normalizeDesign, pageFrom, pageIn,
  removePage, setPageDoc, sizeOf, withFormat, withoutFormat, type SocialDesign,
} from "../src/lib/content/studio/kinds/social/design";
import { TEMPLATES, TEMPLATE_KEYS, composeWords, roleNodes, shapeOf, templateByKey } from "../src/lib/content/studio/kinds/social/templates";
import { cleanDesign, cleanWordsAnswer, colourOf, describePage, planOps, placeWords, type AiOp } from "../src/lib/content/studio/kinds/social/canvasAi";
import { emptySocial, formatsInUse, normalizeSocial, checks, socialText } from "../src/lib/content/studio/kinds/social/model";
import type { DesignDocument } from "../src/lib/design-document";

// The social studio's canvas (08.11.2026): key words in red, formats adapted from one another, our templates, the AI's
// canvas operations.

/* ── key words ── */

test("key words: the words between stars, the stars gone for the reader", () => {
  assert.equal(hasKeyWords("Seals cut to *your size*"), true);
  assert.equal(hasKeyWords("A star * alone"), false);
  assert.equal(plainText("Seals cut to *your size*"), "Seals cut to your size");
  assert.deepEqual(spans("a *b c* d"), [{ t: "a ", key: false }, { t: "b c", key: true }, { t: " d", key: false }]);
});

test("key words: laid out in lines no wider than the box, each word marked", () => {
  const m = (s: string) => s.length * 10;
  const lay = layoutRich("Seals cut to *your size*", { width: 120, fontSize: 20, lineHeight: 1, measure: m });
  assert.ok(lay.lines.every((l) => l.width <= 120.5));
  const words = lay.lines.flatMap((l) => l.words);
  assert.deepEqual(words.map((w) => w.t), ["Seals", "cut", "to", "your", "size"]);
  assert.deepEqual(words.filter((w) => w.key).map((w) => w.t), ["your", "size"]);
  assert.equal(lay.height, lay.lines.length * 20);
  // a line break of the text is a line of the layout
  assert.equal(layoutRich("Cut.\nSized.\n*Shipped.*", { width: 999, fontSize: 10, measure: m }).lines.length, 3);
  assert.equal(lineStart({ words: [], width: 40 }, 100, "center"), 30);
  assert.equal(lineStart({ words: [], width: 40 }, 100, "right"), 60);
});

/* ── formats ── */

const doc = (w: number, h: number, nodes: DesignDocument["nodes"]): DesignDocument => ({ ...blankDoc({ w, h }), nodes });

test("a format made from another: the backdrop covers it, corners keep their things, type keeps its shape", () => {
  const sq = doc(1080, 1080, [
    { id: "bg", kind: "rect", x: 0, y: 0, width: 1080, height: 1080, fill: "#fff" },
    { id: "logo", kind: "image", x: 80, y: 60, width: 160, height: 50, fill: "#fff", src: "/brand/apsoparts-logo.svg" },
    { id: "head", kind: "text", x: 80, y: 400, width: 920, text: "Headline", fill: "#000", fontSize: 100 },
    { id: "btn", kind: "rect", x: 80, y: 920, width: 300, height: 80, fill: "#D80901" },
  ]);
  const wide = adaptDoc(sq, { w: 1200, h: 627 });
  assert.deepEqual(wide.canvas, { w: 1200, h: 627 });
  const by = Object.fromEntries(wide.nodes.map((n) => [n.id, n]));
  assert.deepEqual([by.bg.x, by.bg.y, by.bg.width, by.bg.height], [0, 0, 1200, 627]);
  // one factor for the type: 627/1080
  assert.equal(by.head.fontSize, Math.round(100 * (627 / 1080)));
  // the text that ran across the board still does
  assert.ok((by.head.width ?? 0) > 920 * (627 / 1080));
  // the logo stays top left, the button bottom left - inside the board
  assert.ok(by.logo.x < 100 && by.logo.y < 60);
  assert.ok(by.btn.y + (by.btn.height ?? 0) <= 627 && by.btn.y > 627 / 2);
  // nothing off the board
  for (const n of wide.nodes) assert.ok(n.x >= -1 && n.y >= -1 && n.x + (n.width ?? 0) <= 1201, n.id);
});

const design = (): SocialDesign => {
  let d = emptyDesign();
  d = insertPage(d, 0, pageFrom(d, "square", doc(1080, 1080, [{ id: "t", kind: "text", x: 80, y: 80, width: 900, text: "One *two*", fill: "#000", fontSize: 90 }])));
  return d;
};

test("formats: one more is made for every page; the last one is never removed", () => {
  let d = withFormat(design(), "story", undefined, "square");
  assert.deepEqual(d.formats, ["square", "story"]);
  assert.deepEqual(pageIn(d, d.pages[0], "story").canvas, { w: 1080, h: 1920 });
  d = withoutFormat(d, "story");
  assert.deepEqual(d.formats, ["square"]);
  assert.equal(d.pages[0].by.story, undefined);
  assert.deepEqual(withoutFormat(d, "square").formats, ["square"]);
  // a custom size, and resizing it again
  d = withFormat(d, "custom", { w: 800, h: 400 });
  assert.deepEqual(sizeOf("custom", d), { w: 800, h: 400 });
  assert.deepEqual(pageIn(d, d.pages[0], "custom").canvas, { w: 800, h: 400 });
});

test("pages: added in every format, moved, copied with fresh ids, removed; the words read page by page", () => {
  let d = withFormat(design(), "landscape");
  d = insertPage(d, 1, pageFrom(d, "square", doc(1080, 1080, [{ id: "u", kind: "text", x: 0, y: 0, text: "Second", fill: "#000", fontSize: 40 }])));
  assert.equal(d.pages.length, 2);
  assert.ok(d.pages[1].by.landscape, "the new page has the post's other format too");
  d = movePage(d, 1, 0);
  assert.equal(pageIn(d, d.pages[0], "square").nodes[0].text, "Second");
  const copy = clonePage(d.pages[0]);
  assert.notEqual(copy.id, d.pages[0].id);
  assert.notEqual(copy.by.square!.nodes[0].id, d.pages[0].by.square!.nodes[0].id);
  d = setPageDoc(d, 0, "square", { ...pageIn(d, d.pages[0], "square"), nodes: [] });
  assert.equal(pageIn(d, d.pages[0], "square").nodes.length, 0);
  assert.equal(designText(removePage(d, 0)), "One two");
});

test("a stored design read back: unknown formats out, nulls dropped, at least one format", () => {
  const d = normalizeDesign({ formats: ["square", "nope", "story"], pages: [{ id: "a", by: { square: { canvas: { w: 1080, h: 1080 }, background: { color: "#fff" }, nodes: [{ id: "n", kind: "text", x: 1, y: 2, fill: "#000", text: "x", crop: null }] }, bogus: {} } }, "junk"] });
  assert.deepEqual(d.formats, ["square", "story"]);
  assert.equal(d.pages.length, 1);
  assert.equal("crop" in d.pages[0].by.square!.nodes[0], false);
  assert.deepEqual(normalizeDesign(null).formats, ["square"]);
  assert.equal(isInlinePicture("data:image/png;base64,AAAA"), true);
  assert.equal(isInlinePicture("/api/content/picture/3-abc"), false);
  assert.equal(isInlinePicture("data:image/svg+xml,<svg/>"), false);
});

/* ── the post's document ── */

test("the post: formats per network, only those a network takes; the formats that go out", () => {
  const p = normalizeSocial({ ...emptySocial({ contentType: "social-post" }), formats: { linkedin: ["landscape", "story"], instagram: ["story", "square"], facebook: [] } });
  assert.deepEqual(p.formats.linkedin, ["landscape"]);
  assert.deepEqual(p.formats.instagram, ["story", "square"]);
  assert.deepEqual(p.formats.facebook, ["square"]);
  assert.deepEqual(new Set(formatsInUse(p)), new Set(["landscape", "story", "square"]));
  assert.equal(p.published, null);
  // a new post says it has no design yet; the design's words are in its text
  assert.ok(checks(emptySocial()).some((c) => /No design yet/.test(c.text)));
  const withDesign = { ...emptySocial(), design: design() };
  assert.match(socialText(withDesign), /One two/);
});

/* ── templates ── */

test("templates: at least twelve, each a real layout inside its board, in every format", () => {
  assert.ok(TEMPLATES.length >= 12);
  assert.equal(new Set(TEMPLATE_KEYS).size, TEMPLATES.length);
  for (const t of TEMPLATES) {
    for (const f of Object.values(FORMATS)) {
      const d = t.build({ w: f.w, h: f.h });
      assert.deepEqual(d.canvas, { w: f.w, h: f.h }, t.key);
      assert.ok(d.nodes.some((n) => n.kind === "text"), `${t.key} has words`);
      assert.equal(new Set(d.nodes.map((n) => n.id)).size, d.nodes.length, `${t.key}: ids unique`);
      for (const n of d.nodes) {
        // things sit on the board (a ring or a corner may run off its edge on purpose)
        if (n.kind === "ellipse" || n.rotation) continue;
        assert.ok(n.x >= -1 && n.y >= -1 && n.x <= f.w && n.y <= f.h, `${t.key} ${n.id} in ${f.w}x${f.h}`);
        if (n.kind === "text") assert.ok(n.x + (n.width ?? 0) <= f.w + 1, `${t.key} text inside ${f.w}`);
        assert.ok(!n.src || !isInlinePicture(n.src), "pictures by address");
      }
      assert.ok(!d.background.src || !isInlinePicture(d.background.src));
    }
  }
  // the words are ours: no discount value, never Chemours
  const all = JSON.stringify(TEMPLATES.map((t) => t.words));
  assert.doesNotMatch(all, /%|chemours/i);
});

test("a template takes the words it is given", () => {
  const t = templateByKey("statement")!;
  const d = t.build({ w: 1080, h: 1080 }, { headline: "Hello *world*" });
  assert.ok(d.nodes.some((n) => n.text === "Hello *world*"));
  assert.equal(shapeOf({ w: 1200, h: 627 }), "wide");
  assert.equal(shapeOf({ w: 1080, h: 1920 }), "story");
  const cta = roleNodes("cta", "apsoparts.com", { w: 1080, h: 1080 }, { x: 80, y: 100, w: 900 });
  assert.equal(cta.nodes.length, 2);
  assert.equal(cta.nodes[0].groupId, cta.nodes[1].groupId);
  const comp = composeWords([{ role: "eyebrow", text: "Kicker" }, { role: "headline", text: "Big *one*" }, { role: "body", text: "Body" }], { w: 1080, h: 1350 }, undefined, { place: "top" });
  const ys = comp.filter((n) => n.kind === "text").map((n) => n.y);
  assert.deepEqual([...ys].sort((a, b) => a - b), ys, "stacked top to bottom");
});

/* ── the AI on the canvas ── */

const op = (o: Partial<AiOp>): AiOp => ({ do: "set_text", target: "", text: "", role: null, position: "none", colour: "", amount: 1, prompt: "", template: null, format: null, words: {}, slides: [], ...o });

test("the AI's answer is kept where it makes sense: known operations, two pictures at most", () => {
  const raw = {
    reply: "Done",
    ops: [
      { do: "explode" },
      { do: "picture", prompt: "a" }, { do: "picture", prompt: "b" }, { do: "picture", prompt: "c" },
      { do: "pages", slides: [{ template: "cover", words: { headline: "x", items: [] }, prompt: "d" }, { template: "nope", words: {}, prompt: "" }] },
      { do: "format", format: "story" }, { do: "format", format: "custom" },
    ],
  };
  const a = cleanDesign(raw);
  assert.deepEqual(a.ops.map((o) => o.do), ["picture", "picture", "pages", "format", "format"]);
  assert.equal(a.ops[2].slides[0].prompt, "", "a third picture is dropped");
  assert.equal(a.ops[2].slides[1].template, "slide");
  assert.equal(a.ops[3].format, "story");
  assert.equal(a.ops[4].format, null);
  assert.equal(colourOf("petrol"), "#274E64");
  assert.equal(colourOf("#abcdef"), "#ABCDEF");
  assert.equal(colourOf("rainbow"), null);
  assert.deepEqual(cleanWordsAnswer({ blocks: [{ role: "headline", text: "A *b*" }, { role: "zzz", text: "c" }, { role: "body", text: "  " }] }).blocks, [{ role: "headline", text: "A *b*" }, { role: "body", text: "c" }]);
});

test("the AI's operations applied: words changed, the logo in its corner, a frame for a picture, a carousel", () => {
  const page = templateByKey("spotlight")!.build({ w: 1080, h: 1080 });
  const head = page.nodes.find((n) => n.kind === "text" && n.text?.includes("*"))!;
  let plan = planOps([op({ do: "set_text", target: head.id, text: "Shorter *one*" })], page);
  assert.equal(plan.doc!.nodes.find((n) => n.id === head.id)!.text, "Shorter *one*");
  plan = planOps([op({ do: "logo", position: "bottom-right" })], page);
  const logos = plan.doc!.nodes.filter((n) => n.src?.includes("logo"));
  assert.equal(logos.length, 1, "one logo on a page");
  assert.ok(logos[0].x > 540 && logos[0].y > 540);
  plan = planOps([op({ do: "picture", prompt: "a food line", position: "right" })], page);
  assert.equal(plan.pictures.length, 1);
  const frame = plan.doc!.nodes.find((n) => n.id === (plan.pictures[0].into as { node: string }).node);
  assert.ok(frame && frame.kind === "rect");
  plan = planOps([op({ do: "background", prompt: "a food line" })], page);
  assert.deepEqual(plan.pictures.map((p) => p.into), ["background"]);
  assert.equal(plan.doc, null);
  plan = planOps([op({ do: "background", colour: "petrol>ink" })], page);
  assert.equal(plan.doc!.background.gradientId, "custom");
  plan = planOps([op({ do: "pages", slides: [{ template: "cover", words: { headline: "A" }, prompt: "" }, { template: "slide", words: { headline: "B" }, prompt: "" }] })], page);
  assert.equal(plan.pages!.length, 2);
  plan = planOps([op({ do: "remove", target: "nothing-like-it" })], page);
  assert.equal(plan.doc, null);
  // the page as the model reads it names every object by its id
  assert.match(describePage(page, 0, 1, "square"), new RegExp(head.id));
  // words from the Text panel replace the page's words, the picture stays
  const placed = placeWords(page, [{ role: "headline", text: "New *words*" }], true);
  assert.ok(placed.nodes.some((n) => n.text === "New *words*"));
  assert.ok(!placed.nodes.some((n) => n.text === head.text));
  assert.ok(placed.nodes.some((n) => n.kind === "image" && !n.src?.includes("logo")));
});
