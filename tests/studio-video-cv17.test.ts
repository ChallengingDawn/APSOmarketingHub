import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { libraryItems, libraryQuery, PICTURE_RE, type LibraryDbRow } from "../src/lib/content/library";
import {
  MAX_EXPORTS, cleanExports, cleanVideo, exportedSummary, filmPrint, inLanguage, lastExports, toSpec, withExport, type ExportRecord, type VideoDoc,
} from "../src/lib/content/studio/kinds/video/model";

// cv17 (SARCLA 11.11.2026: "continue" - what cv16 left open on the video): each export of a language for the render machine
// is recorded in the film (when, which language, by whom, the file) - the last step shows each language's last one, the
// library's card "Exported · DE, FR".

const film = (over: Partial<VideoDoc> = {}): VideoDoc => cleanVideo({
  format: "16:9", language: "EN",
  scenes: [
    { id: "a", kind: "title", bars: 2, copy: { kicker: "APSOparts DirectCUT", line1: "Cut to *your* size" }, shape: "oring", part: "oring-nbr" },
    { id: "b", kind: "words", bars: 1, copy: { line1: "Any length.", line2: "Any profile." } },
  ],
  endCard: { line: "Sealing parts, *one click away*.", cta: "apsoparts.com", bars: 2 },
  langs: { DE: { scenes: { a: { line1: "Auf *Ihr* Mass" } }, end: { line: "", cta: "" } }, FR: { scenes: {}, end: { line: "", cta: "" } } },
  ...over,
});
const rec = (lang: string, at: string, over: Partial<ExportRecord> = {}): ExportRecord => ({ at, lang, by: "SARCLA", file: `directcut-${lang.toLowerCase()}-16x9.json`, format: "16:9", ...over });

test("an export recorded: newest first, the film's words untouched; a film never exported has no record at all", () => {
  const f = film();
  assert.equal("exports" in f, false, "an older film opens as it was");
  const once = withExport(f, rec("DE", "2026-11-11T14:02:00Z"));
  const twice = withExport(once, rec("FR", "2026-11-11T14:03:00Z"));
  assert.deepEqual(twice.exports!.map((x) => x.lang), ["FR", "DE"]);
  assert.deepEqual(twice.scenes, f.scenes);
  assert.deepEqual(cleanVideo(JSON.parse(JSON.stringify(twice))).exports, twice.exports, "kept through a save");
  // the document as it is being typed (spaces kept): only the record is added
  const typing = { ...f, scenes: [{ ...f.scenes[0], copy: { line1: "Cut to *your* size " } }] };
  assert.equal(withExport(typing, rec("EN", "2026-11-11T15:00:00Z")).scenes[0].copy.line1, "Cut to *your* size ");
  // anything that is not a film stays as it is; a record without a language or a when is not kept
  assert.equal(withExport(null, rec("EN", "2026-11-11T15:00:00Z")), null);
  assert.deepEqual(withExport({ notes: "x" }, rec("EN", "2026-11-11T15:00:00Z")), { notes: "x" });
  assert.equal(withExport(f, rec("", "2026-11-11T15:00:00Z")), f);
  assert.equal(withExport(f, rec("EN", "yesterday")), f);
});

test("at most MAX_EXPORTS kept; junk in a stored list dropped", () => {
  let f = film();
  for (let i = 0; i < MAX_EXPORTS + 6; i++) f = withExport(f, rec("EN", new Date(Date.UTC(2026, 10, 11, 8, i)).toISOString()));
  assert.equal(f.exports!.length, MAX_EXPORTS);
  assert.equal(f.exports![0].at, new Date(Date.UTC(2026, 10, 11, 8, MAX_EXPORTS + 5)).toISOString(), "the newest kept");
  assert.deepEqual(cleanExports([null, 3, { lang: "de", at: "2026-11-11T10:00:00Z", format: "4:3" }, { lang: "German", at: "2026-11-11T10:00:00Z" }]),
    [{ at: "2026-11-11T10:00:00Z", lang: "DE", by: "", file: "", format: "16:9" }]);
});

test("each language's last export, and the summary the library says - the film's own language first", () => {
  let f = film();
  f = withExport(f, rec("FR", "2026-11-11T10:00:00Z"));
  f = withExport(f, rec("DE", "2026-11-11T11:00:00Z", { by: "DIANA" }));
  f = withExport(f, rec("FR", "2026-11-11T12:00:00Z", { file: "again.json" }));
  const last = lastExports(f);
  assert.equal(last.FR.file, "again.json");
  assert.equal(last.DE.by, "DIANA");
  assert.equal(last.EN, undefined, "never exported");
  assert.deepEqual(exportedSummary(f), { langs: ["DE", "FR"], at: "2026-11-11T12:00:00Z", by: "SARCLA" });
  assert.equal(exportedSummary(film()), null);
});

test("the record is not the film: what goes to the render machine carries none; a changed film says so by its print", () => {
  const f = withExport(film(), rec("DE", "2026-11-11T14:02:00Z", { print: filmPrint(film(), "DE", "16:9") }));
  const spec = toSpec(f, { title: "DirectCUT", pieceId: 5, at: "2026-11-11T14:02:00Z", lang: "DE" });
  assert.equal("exports" in spec.doc, false);
  assert.equal("exports" in inLanguage(f, "EN"), false);
  assert.equal(filmPrint(f, "DE", "16:9"), f.exports![0].print, "the same film: the same print");
  const changed = { ...f, langs: { ...f.langs, DE: { ...f.langs!.DE, scenes: { a: { line1: "Auf *Ihre* Grösse" } } } } };
  assert.notEqual(filmPrint(changed, "DE", "16:9"), f.exports![0].print, "its German words changed since");
  assert.equal(filmPrint(changed, "FR", "16:9"), filmPrint(f, "FR", "16:9"), "French did not");
  assert.notEqual(filmPrint(f, "DE", "9:16"), filmPrint(f, "DE", "16:9"), "another format is another file");
});

test("the library's video card: \"Exported · DE, FR\" with the newest export's when and who, beside the board's mark (on PGlite)", async () => {
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
    let f = film();
    f = withExport(f, rec("FR", "2026-11-11T10:00:00Z"));
    f = withExport(f, rec("DE", "2026-11-11T13:40:00Z", { by: "DIANA" }));
    const put = async (id: number, status: string, doc: unknown) => {
      await db.query(`INSERT INTO apsomh_content_pieces VALUES ($1, 12, 'DirectCUT film', $2, 'EN', 'video', 'SARCLA', NULL)`, [id, status]);
      await db.query("INSERT INTO apsomh_content_piece_docs VALUES ($1, 'video', $2, '2026-11-11T18:00:00Z', 'SARCLA')", [id, JSON.stringify(doc)]);
    };
    await put(5, "approved", f);
    await put(6, "live", f);
    await put(7, "live", film());
    // a stored list with junk in it: only real records are said
    await put(8, "writing", { ...film(), exports: [{ lang: "IT" }, "x", { at: "2026-11-10T09:00:00Z", lang: "en", by: "SARCLA", file: "a.json" }] });
    await db.query("INSERT INTO apsomh_content_events (project_id, piece_id, actor, kind, detail, created_at) VALUES (12, 6, 'SARCLA', 'status', '{\"to\":\"live\"}', '2026-11-11T17:00:00Z'), (12, 7, 'SARCLA', 'status', '{\"to\":\"live\"}', '2026-11-11T17:00:00Z')");
    const items = libraryItems((await db.query<LibraryDbRow>(libraryQuery(true), ["ADMIN", PICTURE_RE])).rows);
    const by = (id: number) => items.find((i) => i.pieceId === id)!;

    assert.deepEqual(by(5).where.map((w) => w.label), ["Exported · DE, FR"], "the film's versions' order");
    assert.equal(by(5).where[0].at, "2026-11-11T13:40:00.000Z");
    assert.equal(by(5).where[0].by, "DIANA");
    assert.equal(by(5).state, "approved", "an export for the render machine is not a publication");

    assert.deepEqual(by(6).where.map((w) => w.label), ["Marked live", "Exported · DE, FR"], "no longer only \"Marked live\"");
    assert.deepEqual(by(7).where.map((w) => w.label), ["Marked live"], "never exported: as before");
    assert.deepEqual(by(8).where.map((w) => w.label), ["Exported · EN"]);
    assert.equal(by(5).line, "2 scenes · 10 s · 16:9", "the rest of the card as before");
  } finally {
    await db.close();
  }
});
