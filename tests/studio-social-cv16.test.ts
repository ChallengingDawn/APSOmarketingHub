import assert from "node:assert/strict";
import { test } from "node:test";
import { emptySocial, checks, copiedVersion, normalizeSocial, putView, translateItems, translatedVersion, viewOf, type SocialDoc } from "../src/lib/content/studio/kinds/social/model";
import { guardDesign, guardPost, guardWords } from "../src/lib/content/studio/kinds/social/guard";
import { leftOutLine } from "../src/lib/content/studio/kinds/social/ai";
import { pageAsk, rewritten, textChanges, withNewWords, wordsOnly } from "../src/lib/content/studio/kinds/social/rewrite";
import type { AiOp } from "../src/lib/content/studio/kinds/social/canvasAi";
import type { DesignDocument, DesignNode } from "../src/lib/design-document";

// cv16 (SARCLA 11.11.2026: "compare the evolution of this page [the Page builder] to the other content types' generators,
// and improve them"): the social post brought up to the Page builder - its word rules on every AI text, its language
// versions as tabs with every part translated, "Write it all again" carrying the new words into every format.

const text = (id: string, t: string, y = 0): DesignNode => ({ id, kind: "text", x: 40, y, fill: "#16202A", text: t, fontSize: 40, width: 600 });
const doc = (nodes: DesignNode[], w = 1080, h = 1080): DesignDocument => ({ canvas: { w, h }, background: { color: "#F4F6F8", src: null, gradientId: null }, nodes } as unknown as DesignDocument);

function post(): SocialDoc {
  const d = emptySocial({ contentType: "social-post" });
  d.networks.linkedin.text = "Plates and rods, cut to your size.\n\nWhich size do you need?";
  d.networks.instagram.text = "Cut to your size.";
  d.firstComment = "The sizes in the shop:";
  d.link = { url: "https://www.apsoparts.com/de-CH/directcut", label: "Sizes:", inComment: false };
  d.hashtags = ["#DirectCUT"];
  d.design = {
    formats: ["square", "landscape"], custom: null,
    pages: [{ id: "p1", by: { square: doc([text("a", "Cut to *your size*"), text("b", "apsoparts.com", 900)]), landscape: doc([text("x", "Cut to *your size*"), text("y", "apsoparts.com", 500)], 1200, 627) } }],
  };
  return d;
}

test("the word rules take a stock or delivery promise out of an AI text and say it; the rest stays", () => {
  const said: string[] = [];
  const out = guardPost("Plates cut to your size. All of them in stock and shipped in 24 h. Order in the shop.", "", said);
  assert.equal(out, "Plates cut to your size. Order in the shop.");
  assert.equal(said.length, 1);
  assert.match(leftOutLine(said), /^Left out: /);
  assert.equal(leftOutLine([]), "");
});

test("a certificate stays only when the brief, the post or the ask names it", () => {
  const a: string[] = [];
  assert.equal(guardPost("FDA-compliant seals for food. Ask us.", "", a), "Ask us.");
  const b: string[] = [];
  assert.equal(guardPost("FDA-compliant seals for food. Ask us.", "Brief: our FDA seals", b), "FDA-compliant seals for food. Ask us.");
  assert.equal(b.length, 0);
});

test("the canvas AI's answer under the rules: a text change left with no words is dropped, a template's words cleaned", () => {
  const op = (o: Partial<AiOp>): AiOp => ({ do: "set_text", target: "a", text: "", role: null, position: "none", colour: "", amount: 1, prompt: "", template: null, format: null, words: {}, slides: [], ...o });
  const g = guardDesign({ reply: "Done.", ops: [op({ text: "Ab Lager lieferbar." }), op({ target: "b", text: "Cut to *your size*" }), op({ do: "template", template: "spotlight", words: { headline: "20% off all plates", body: "Cut to size." } })] }, "");
  assert.equal(g.ops.length, 2);
  assert.equal(g.ops[0].text, "Cut to *your size*");
  assert.deepEqual(g.ops[1].words, { body: "Cut to size." });
  assert.ok(g.leftOut.length >= 2);
  assert.deepEqual(guardWords({ items: ["In stock now.", "Cut to size."] }, "", []), { items: ["Cut to size."] });
});

test("a language version: its own words over the post's settings; a change in its tab never touches the main language", () => {
  const d = post();
  d.langs.FR = copiedVersion(d, "2026-11-11T18:00:00Z");
  const v = viewOf(d, "FR");
  assert.equal(v.networks.linkedin.text, d.networks.linkedin.text);
  const changed = putView(d, "FR", { ...v, networks: { ...v.networks, linkedin: { ...v.networks.linkedin, text: "Plaques coupées sur mesure." }, facebook: { ...v.networks.facebook, on: false } }, schedule: { date: "2026-11-20", time: "09:00" } });
  assert.equal(changed.networks.linkedin.text, d.networks.linkedin.text, "the main caption stays");
  assert.equal(changed.langs.FR.networks.linkedin, "Plaques coupées sur mesure.");
  assert.equal(changed.networks.facebook.on, false, "where it goes is the post's");
  assert.equal(changed.schedule.time, "09:00", "the day is the post's");
  // the main language's view is the post itself
  assert.equal(viewOf(changed, null), changed);
  assert.equal(putView(changed, null, changed), changed);
  // kept through a save, a bad language code dropped
  const back = normalizeSocial(JSON.parse(JSON.stringify({ ...changed, langs: { ...changed.langs, fr: changed.langs.FR, XYZ: {} } })));
  assert.deepEqual(Object.keys(back.langs), ["FR"]);
  assert.equal(back.langs.FR.networks.linkedin, "Plaques coupées sur mesure.");
});

test("a translation takes every part along: each caption, the comment, the link's words, every page's words in every format", () => {
  const d = post();
  const items = translateItems(d);
  assert.deepEqual(items.map((x) => x.id), ["net.linkedin", "net.instagram", "comment", "link.label", "t.1", "t.2"], "a text in two formats is translated once");
  const fr = items.map((x) => ({ id: x.id, text: `FR ${x.text}` })).filter((x) => x.id !== "net.instagram");
  const { version, missing } = translatedVersion(d, fr, "2026-11-11T18:00:00Z");
  assert.equal(missing, 1);
  assert.equal(version.networks.linkedin, `FR ${d.networks.linkedin.text}`);
  assert.equal(version.networks.instagram, d.networks.instagram.text, "a part not translated stays as it was");
  assert.equal(version.firstComment, "FR The sizes in the shop:");
  assert.equal(version.link.label, "FR Sizes:");
  assert.equal(version.design.pages[0].by.square!.nodes[0].text, "FR Cut to *your size*");
  assert.equal(version.design.pages[0].by.landscape!.nodes[0].text, "FR Cut to *your size*", "every format");
  assert.equal(d.design.pages[0].by.square!.nodes[0].text, "Cut to *your size*", "the main design is untouched");
});

test("the link follows the language: a French version still pointing to the German shop is said", () => {
  const d = post();
  assert.ok(checks(d, "FR").some((c) => /DE shop/.test(c.text)));
  assert.ok(!checks(d, "DE").some((c) => /shop - give/.test(c.text)));
});

test("Write it all again: the new words go into the page's other formats where the old words stood", () => {
  const page = post().design.pages[0];
  const before = page.by.square!;
  const after = { ...before, nodes: before.nodes.map((n) => (n.id === "a" ? { ...n, text: "Any size, *cut for you*" } : n)) };
  assert.deepEqual([...textChanges(before, after)], [["Cut to *your size*", "Any size, *cut for you*"]]);
  const next = withNewWords(page, "square", before, after);
  assert.equal(next.by.square!.nodes[0].text, "Any size, *cut for you*");
  assert.equal(next.by.landscape!.nodes[0].text, "Any size, *cut for you*");
  assert.equal(next.by.landscape!.nodes[1].text, "apsoparts.com");
});

test("a rewrite keeps the layout: words only, unless the person asks for more; never a new carousel or format", () => {
  const op = (k: AiOp["do"]): AiOp => ({ do: k, target: "a", text: "x", role: null, position: "none", colour: "", amount: 1, prompt: "", template: null, format: null, words: {}, slides: [] });
  const all = (["set_text", "add_text", "pages", "format", "picture", "template", "move"] as const).map(op);
  assert.deepEqual(wordsOnly(all, "topic").map((o) => o.do), ["set_text"]);
  assert.deepEqual(wordsOnly(all, "ask").map((o) => o.do), ["set_text", "add_text", "move"]);
  assert.match(pageAsk("better", "", 0, 3), /EACH text id.*added too/);
  assert.match(pageAsk("ask", "mention DirectCUT", 2, 3), /page 3 of 3[\s\S]*mention DirectCUT/);
});

test("a rewrite lands on the page as it is now: a picture put in while the AI wrote stays", () => {
  const page = post().design.pages[0];
  const asked = page.by.square!;
  const after = { ...asked, nodes: asked.nodes.map((n) => (n.id === "a" ? { ...n, text: "Any size, *cut for you*" } : n)) };
  // nothing happened meanwhile: the answer's own document
  assert.equal(rewritten(page, "square", asked, after).by.square, after);
  // a picture landed meanwhile: it stays, the new words go in where the old ones stood
  const pic: DesignNode = { id: "pic", kind: "image", x: 0, y: 300, fill: "#fff", src: "/api/content/picture/9", width: 400, height: 300 };
  const now = { ...page, by: { ...page.by, square: { ...asked, nodes: [...asked.nodes, pic] } } };
  const out = rewritten(now, "square", asked, after);
  assert.equal(out.by.square!.nodes.length, 3);
  assert.equal(out.by.square!.nodes[0].text, "Any size, *cut for you*");
  assert.equal(out.by.landscape!.nodes[0].text, "Any size, *cut for you*");
});
