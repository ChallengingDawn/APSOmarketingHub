import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { libraryItems, libraryQuery, PICTURE_RE, type LibraryDbRow } from "../src/lib/content/library";
import { certsIn, deliveryIn, neverOnScreen, notInFacts } from "../src/lib/content/studio/kinds/video/guard";
import {
  cleanVideo, dropLanguage, filmFacts, forbidden, inLanguage, languagesOf, setLangLine, toSpec, untranslated, validate, versionFrom, videoText, wordsPrint, wordsToTranslate,
  type VideoDoc,
} from "../src/lib/content/studio/kinds/video/model";
import { duplicateEl, elementAt, elementName, elementsOf, moveEl, moveWords, takeOut } from "../src/lib/content/studio/kinds/video/element";
import { cleanLine, cleanStoryboard, cleanTranslate, lineUser, reviseUser, translateUser, type VideoCtx } from "../src/lib/content/studio/kinds/video/ai";

// cv16 (SARCLA 11.11.2026: "compare the evolution of this page [the Page builder] to the other content types' generators,
// and improve them"): the film's guards, its languages, one element picked on it, one line asked again.

const film = (over: Partial<VideoDoc> = {}): VideoDoc => cleanVideo({
  format: "16:9", language: "EN",
  scenes: [
    { id: "a", kind: "title", bars: 2, copy: { kicker: "APSOparts DirectCUT", line1: "Cut to *your* size" }, shape: "oring", part: "oring-nbr" },
    { id: "b", kind: "words", bars: 1, copy: { line1: "Any length.", line2: "Any profile." } },
    { id: "c", kind: "steps", bars: 2, copy: { line1: "Pick the profile", line2: "Enter the length", line3: "Order" } },
  ],
  endCard: { line: "Sealing parts, *one click away*.", cta: "apsoparts.com", bars: 2 },
  ...over,
});

const ctx: VideoCtx = {
  projectTitle: "DirectCUT autumn", piece: { id: 7, title: "Video · EN", language: "EN" },
  brief: { goal: "More DirectCUT orders", audience: "Maintenance buyers", message: "Seals cut to length, ordered online.", keywords: ["DirectCUT"] },
};

// ───────────────────────── the guards ─────────────────────────

test("never on screen: a stock promise, Chemours - in the shop's languages", () => {
  assert.match(neverOnScreen("Ab Lager lieferbar") ?? "", /stock/i);
  assert.match(neverOnScreen("Always *in stock*") ?? "", /stock/i);
  assert.match(neverOnScreen("Chemours Viton inside") ?? "", /Chemours/);
  assert.equal(neverOnScreen("Cut to *your* size"), null);
  // the film's own check refuses them as it refuses a discount value
  assert.ok(forbidden("Op voorraad"));
  const v = validate(film({ scenes: [{ id: "x", kind: "claim", bars: 2, copy: { line1: "Everything in stock" } }] as never }));
  assert.ok(v.some((i) => i.level === "stop" && /stock/.test(i.text)));
});

test("a delivery time or a certificate only when the film's facts state it", () => {
  assert.deepEqual(deliveryIn("Delivered in 24 h"), ["in 24 h"]);
  assert.ok(deliveryIn("48/72h across Europe").length > 0);
  assert.deepEqual(certsIn("FDA and KTW approved"), ["FDA", "KTW"]);
  const facts = filmFacts({ features: ["delivery"], scenes: [] });
  assert.equal(notInFacts("48/72h across *Europe*", facts), null, "the delivery feature states it");
  assert.match(notInFacts("Delivered in 24 h", facts) ?? "", /delivery time/);
  assert.match(notInFacts("FDA approved seals", facts) ?? "", /FDA/);
  assert.equal(notInFacts("FDA approved seals", "Our FDA compliant range"), null, "the brief names it");
  // in the checks: advice, not a stop (the brief is not in the document)
  const v = validate(film({ scenes: [{ id: "x", kind: "claim", bars: 2, copy: { line1: "Next-day delivery" } }] as never }));
  assert.ok(v.some((i) => i.level === "warn" && /delivery time/.test(i.text)));
});

test("every AI line passes them: a stock line or an unnamed certificate is left out, and said", () => {
  const a = cleanStoryboard({
    scenes: [
      { kind: "claim", bars: 2, kicker: "", line1: "Always in stock", line2: "", line3: "", sub: "", shape: "none", part: "", feature: "", icon: "" },
      { kind: "claim", bars: 2, kicker: "", line1: "Cut to *your* size", line2: "", line3: "", sub: "FDA approved", shape: "none", part: "", feature: "", icon: "" },
    ],
    endLine: "Sealing, *simply*.", cta: "apsoparts.com", note: "",
  }, film(), ctx);
  assert.equal(a.doc.scenes.length, 1);
  assert.equal(a.doc.scenes[0].copy.sub, undefined);
  assert.ok(a.dropped.some((d) => /stock/.test(d)));
  assert.ok(a.dropped.some((d) => /FDA/.test(d)));
});

// ───────────────────────── the languages ─────────────────────────

test("a language version: the same scenes, its own words; a line it has not shows the film's own", () => {
  const items = wordsToTranslate(film());
  assert.deepEqual(items.map((x) => x.id), ["s.a.kicker", "s.a.line1", "s.b.line1", "s.b.line2", "s.c.line1", "s.c.line2", "s.c.line3", "end.line", "end.cta"]);
  const de = versionFrom(film(), [{ id: "s.a.line1", text: "Auf *Ihr* Mass" }, { id: "end.line", text: "Dichtungen, *ein Klick*." }, { id: "s.zz.line1", text: "nobody" }]);
  const d = cleanVideo({ ...film(), langs: { de, EN: de, XYZ: de } });
  assert.deepEqual(languagesOf(d), ["EN", "DE"], "the film's own language and a bad code are never a version");
  const shown = inLanguage(d, "DE");
  assert.equal(shown.language, "DE");
  assert.equal(shown.scenes[0].copy.line1, "Auf *Ihr* Mass");
  assert.equal(shown.scenes[0].copy.kicker, "APSOparts DirectCUT", "not translated yet: the film's own");
  assert.equal(shown.endCard.line, "Dichtungen, *ein Klick*.");
  assert.equal(shown.langs, undefined, "what plays is one language");
  assert.equal(shown.scenes[0].part, "oring-nbr", "the pictures and parts are shared");
  assert.equal(untranslated(d, "DE").length, items.length - 2);
  assert.equal(d.langs!.DE.from, wordsPrint(film()));
  assert.notEqual(wordsPrint(film({ endCard: { line: "Other", cta: "apsoparts.com", bars: 2 } })), d.langs!.DE.from, "the film's words changed since");
  // typed in its tab
  const t = setLangLine(d, "DE", "b", "line1", "Jede Länge.");
  assert.equal(inLanguage(t, "DE").scenes[1].copy.line1, "Jede Länge.");
  assert.equal(t.scenes[1].copy.line1, "Any length.", "the film's own words stay");
  assert.equal(setLangLine(d, "FR", "end", "cta", "apsoparts.fr").langs!.FR.end.cta, "apsoparts.fr");
  assert.deepEqual(languagesOf(dropLanguage(d, "DE")), ["EN"]);
  assert.match(videoText(d), /EN, DE/);
  // the export: one language a file, the render reads it as before
  const spec = toSpec(d, { title: "x", pieceId: 1, at: "2026-11-11", lang: "DE" });
  assert.equal(spec.doc.language, "DE");
  assert.equal(spec.doc.scenes[0].copy.line1, "Auf *Ihr* Mass");
  assert.equal((spec.doc as VideoDoc).langs, undefined);
  assert.equal(toSpec(d, { title: "x", pieceId: 1, at: "2026-11-11" }).doc.scenes[0].copy.line1, "Cut to *your* size");
});

test("the translation takes EVERY line along, guarded, and says what did not come back", () => {
  assert.match(translateUser(ctx, film(), { to: "DE" }), /INTO German[\s\S]*"s\.c\.line3"[\s\S]*"end\.cta"/);
  const a = cleanTranslate({ items: [
    { id: "s.a.line1", text: "Auf *Ihr* Mass" }, { id: "s.b.line1", text: "Ab Lager." }, { id: "end.line", text: "Dichtungen, *ein Klick*." },
  ] }, film(), ctx, { to: "de" });
  assert.equal(a.lang, "DE");
  assert.equal(a.doc.langs!.DE.scenes.a.line1, "Auf *Ihr* Mass");
  assert.equal(a.doc.langs!.DE.scenes.b, undefined, "a stock promise is left out");
  assert.ok(a.dropped.some((d) => /stock/.test(d)));
  assert.equal(a.missing, wordsToTranslate(film()).length - 2);
  assert.match(a.note, /did not come back/);
  assert.match(cleanTranslate({ items: [] }, film(), ctx, { to: "EN" }).note, /another language/);
});

// ───────────────────────── one element picked on the film ─────────────────────────

test("a click on the film picks the line under it, the part, the end card's button", () => {
  const d = film();
  const els = elementsOf(d.scenes[0], "16:9");
  assert.deepEqual(els.map((e) => e.key), ["kicker", "line1", "picture"]);
  const head = els.find((e) => e.key === "line1")!;
  assert.equal(elementAt(d.scenes[0], "16:9", head.box.x + 20, head.box.y + head.box.h / 2)?.key, "line1");
  assert.equal(elementAt(d.scenes[0], "16:9", 1460, 590)?.key, "picture", "the part beside it");
  assert.equal(elementAt(d.scenes[0], "16:9", 5, 5), null, "nothing in the corner");
  assert.equal(elementAt(null, "16:9", 160, 790, d.endCard)?.key, "cta");
  assert.deepEqual(elementsOf(d.scenes[2], "9:16").map((e) => e.key), ["line1", "line2", "line3"], "a step a card");
  assert.equal(elementName(d, { scene: 0, key: "line1" }), "Scene 1 · Headline");
  assert.equal(elementName(d, { scene: -1, key: "cta" }), "End card · The button");
});

test("take out, duplicate, move: the lines of a words scene - in every language with them", () => {
  const d = cleanVideo({ ...film(), langs: { DE: versionFrom(film(), [{ id: "s.b.line1", text: "Jede Länge." }, { id: "s.b.line2", text: "Jedes Profil." }]) } });
  const out = takeOut(d, { scene: 1, key: "line1" });
  assert.equal(out.scenes[1].copy.line1, "Any profile.", "the lines close up");
  assert.equal(out.langs!.DE.scenes.b.line1, "Jedes Profil.");
  const mv = moveEl(d, { scene: 1, key: "line1" }, 1)!;
  assert.equal(mv.doc.scenes[1].copy.line2, "Any length.");
  assert.equal(mv.doc.langs!.DE.scenes.b.line2, "Jede Länge.");
  assert.deepEqual(mv.el, { scene: 1, key: "line2" });
  assert.deepEqual(moveWords(d, { scene: 1, key: "line1" }), { up: null, down: "Line down" });
  assert.deepEqual(moveWords(d, { scene: 0, key: "line1" }), { up: null, down: "Scene later" });
  const dup = duplicateEl(d, { scene: 1, key: "line1" })!;
  assert.equal(dup.what, "line");
  assert.deepEqual([dup.doc.scenes[1].copy.line1, dup.doc.scenes[1].copy.line2, dup.doc.scenes[1].copy.line3], ["Any length.", "Any length.", "Any profile."]);
  const sc = duplicateEl(d, { scene: 0, key: "line1" })!;
  assert.equal(sc.what, "scene");
  assert.equal(sc.doc.scenes.length, 4);
  assert.notEqual(sc.doc.scenes[1].id, "a");
  const later = moveEl(d, { scene: 0, key: "line1" }, 1)!;
  assert.equal(later.doc.scenes[1].id, "a");
  assert.equal(takeOut(d, { scene: 0, key: "picture" }).scenes[0].part, undefined, "a title can do without its part");
  assert.equal(takeOut(d, { scene: -1, key: "cta" }).endCard.cta, "");
});

// ───────────────────────── one line asked again ─────────────────────────

test("a line's own Ask AI changes that line only - or its language version's", () => {
  const q = lineUser(ctx, film(), { index: 0, key: "line1", ask: "warmer" });
  assert.match(q, /Change ONLY headline of scene 1 \(title\) - max 4 words/);
  assert.match(q, /warmer/);
  const a = cleanLine({ text: "Made to *your* size", note: "Warmer." }, film(), ctx, { index: 0, key: "line1" });
  assert.equal(a.doc.scenes[0].copy.line1, "Made to *your* size");
  assert.equal(a.doc.scenes[0].copy.kicker, "APSOparts DirectCUT");
  assert.equal(a.doc.scenes[1].copy.line1, "Any length.");
  const de = cleanLine({ text: "Nach *Mass*", note: "" }, film(), ctx, { index: 0, key: "line1", lang: "DE" });
  assert.equal(de.doc.langs!.DE.scenes.a.line1, "Nach *Mass*");
  assert.equal(de.doc.scenes[0].copy.line1, "Cut to *your* size");
  const end = cleanLine({ text: "Shop now", note: "" }, film(), ctx, { index: -1, key: "cta" });
  assert.equal(end.doc.endCard.cta, "Shop now");
  const stock = cleanLine({ text: "Always in stock", note: "" }, film(), ctx, { index: 1, key: "line1" });
  assert.equal(stock.doc.scenes[1].copy.line1, "Any length.", "guarded");
  const quote = cleanVideo({ ...film(), scenes: [{ id: "q", kind: "quote", bars: 3, copy: { line1: "It works.", sub: "A buyer" } }] });
  assert.match(cleanLine({ text: "It works great.", note: "" }, quote, ctx, { index: 0, key: "line1" }).note, /never rewritten/);
});

test("Write it all again > Directly: the same scenes written again, their places and pictures kept", () => {
  assert.match(reviseUser(ctx, film(), { how: "better" }), /Write every scene of this storyboard again, better/);
  const d = cleanVideo({ ...film(), scenes: [{ id: "p", kind: "product", bars: 2, copy: { kicker: "FKM O-ring" }, image: "https://www.apsoparts.com/media/x.jpg" }, ...film().scenes] });
  const a = cleanStoryboard({
    scenes: [
      { kind: "product", bars: 2, kicker: "FKM O-rings", line1: "For heat", line2: "", line3: "", sub: "", shape: "oring", part: "", feature: "", icon: "" },
      { kind: "title", bars: 2, kicker: "DirectCUT", line1: "Your *size*", line2: "", line3: "", sub: "", shape: "oring", part: "", feature: "", icon: "" },
    ],
    endLine: "Sealing, *simply*.", cta: "apsoparts.com", note: "",
  }, d, ctx, { how: "better" });
  assert.deepEqual(a.doc.scenes.map((s) => s.id), ["p", "a"]);
  assert.equal(a.doc.scenes[0].image, "https://www.apsoparts.com/media/x.jpg");
  assert.equal(a.doc.scenes[1].part, "oring-nbr");
});

// ───────────────────────── the library's card ─────────────────────────

test("the library's video card: its real length from its bars, its languages with their versions (on PGlite)", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE apsomh_content_projects (id INTEGER PRIMARY KEY, title TEXT, created_by TEXT, status TEXT DEFAULT 'draft', deleted_at TIMESTAMPTZ);
      CREATE TABLE apsomh_content_project_members (project_id INTEGER, username TEXT, role TEXT);
      CREATE TABLE apsomh_content_pieces (id INTEGER PRIMARY KEY, project_id INTEGER, title TEXT, status TEXT, language TEXT, content_type TEXT, writer TEXT, reviewer TEXT);
      CREATE TABLE apsomh_content_piece_docs (piece_id INTEGER PRIMARY KEY, kind TEXT, doc JSONB, updated_at TIMESTAMPTZ, updated_by TEXT);
      CREATE TABLE apsomh_content_events (id SERIAL PRIMARY KEY, project_id INTEGER, piece_id INTEGER, actor TEXT, kind TEXT, detail JSONB, created_at TIMESTAMPTZ DEFAULT NOW());
      INSERT INTO apsomh_content_projects VALUES (12, 'DirectCUT autumn', 'SARCLA', 'draft', NULL);
    `);
    const doc = { ...film(), scenes: [...film().scenes.slice(0, 2).map((s) => ({ ...s, bars: 2 })), { id: "z", kind: "words", bars: "x", copy: { line1: "Odd" } }], endCard: { line: "x", cta: "apsoparts.com", bars: 3 }, langs: { DE: { scenes: {}, end: { line: "", cta: "" } }, FR: { scenes: {}, end: { line: "", cta: "" } } } };
    await db.query("INSERT INTO apsomh_content_pieces VALUES (5, 12, 'DirectCUT film', 'writing', 'EN', 'video', 'SARCLA', NULL)");
    await db.query("INSERT INTO apsomh_content_piece_docs VALUES (5, 'video', $1, '2026-11-11T18:00:00Z', 'SARCLA')", [JSON.stringify(doc)]);
    await db.query("INSERT INTO apsomh_content_pieces VALUES (6, 12, 'Empty film', 'writing', 'EN', 'video', 'SARCLA', NULL)");
    await db.query("INSERT INTO apsomh_content_piece_docs VALUES (6, 'video', $1, '2026-11-11T18:00:00Z', 'SARCLA')", [JSON.stringify({ v: 2, scenes: [], endCard: { line: "", cta: "", bars: 2 }, language: "EN", length: 20, format: "9:16" })]);
    const items = libraryItems((await db.query<LibraryDbRow>(libraryQuery(true), ["ADMIN", PICTURE_RE])).rows);
    const f = items.find((i) => i.pieceId === 5)!;
    assert.equal(f.line, "3 scenes · 16 s · 16:9", "2 + 2 + 1 bars and the 3-bar end card: 16 seconds");
    assert.deepEqual(f.languages, ["EN", "DE", "FR"]);
    const e = items.find((i) => i.pieceId === 6);
    assert.equal(e?.line ?? "", "20 s · 9:16", "no scenes yet: the length it is to be");
  } finally {
    await db.close();
  }
});
