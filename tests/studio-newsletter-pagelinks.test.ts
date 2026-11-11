import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pageDoc, type MagentoRecord } from "../src/lib/content/studio/kinds/page/model";
import {
  SHOP_BASE, lastWrites, linkFor, linkNote, newsletterStore, pageAddress, pageLinkRow, pageLinkRows, pageLinksQuery, pickerOrder, publishedIn, stateIn,
  storesLine, whereLine, type PageLinkRow, type PageLinksDbRow,
} from "../src/lib/content/studio/kinds/newsletter/pageLinks";

// SARCLA 11.11.2026: "with these new pages (one Magento page per store view, same URL key), how do we generate the link
// for the correct page in the newsletter?" The newsletter is sent per language: each language links the page in its
// language's own store view, at the shop's address - never ACC's. Made-up pages and records; nothing is read or written.

const META = { pieceId: 41, projectId: 7, project: "Food-grade seals 2027", todo: "SEO landing page", status: "approved", updatedAt: "2026-11-10T20:00:00.000Z" };
const rec = (env: "prod" | "acc", store: string, identifier: string, action: MagentoRecord["action"], at: string): MagentoRecord =>
  ({ env, store, pageId: "77", identifier, action, at, by: "sarcla", backupId: "1", url: `${env === "acc" ? "https://acc.apsoparts.com" : SHOP_BASE}/${store}/${identifier}` });

/** A new page in German (de-CH, its URL key set), French (fr-CH, its own key) and English (en-INT, the key from its title). */
const raw = (magento: MagentoRecord[]) => ({
  source: "new", env: "prod", store: "de-CH", path: "", stores: ["de-CH", "de-AT", "de-DE"],
  fields: { hero: { title: "Dichtungen für Lebensmittel" }, intro: "Was in der Lebensmittelindustrie zählt.", seo: { title: "", description: "", urlKey: "dichtungen-lebensmittel" }, modules: [{ id: "m1", after: "", module: { type: "banner", settings: {} } }], looks: { "hero.title": { size: "l" } } },
  newPage: { title: "", urlKey: "", metaTitle: "", metaDescription: "", body: "" },
  langs: {
    "fr-CH": { store: "fr-CH", stores: ["fr-CH", "fr-FR"], path: "", outline: null, fields: { hero: { title: "Joints alimentaires" }, seo: { urlKey: "joints-alimentaires" } }, made: "translate", from: "x", source: "de-CH" },
    "en-INT": { store: "en-INT", stores: ["en-INT", "en-CH"], path: "", fields: { hero: { title: "Food-grade seals" }, seo: { urlKey: "" } }, made: "translate", from: "x", source: "de-CH" },
  },
  magento,
  briefText: "a long brief", notes: "", outline: null,
});
// newest first, as the Page builder keeps them
const RECORDS = [
  rec("acc", "fr-CH", "joints-alimentaires", "created", "2026-11-10T19:00:00Z"),
  rec("prod", "de-CH", "dichtungen-lebensmittel", "created", "2026-11-10T18:30:00Z"),
  rec("acc", "de-CH", "dichtungen-lebensmittel", "created", "2026-11-10T18:00:00Z"),
];
const row = (magento = RECORDS) => pageLinkRow(pageDoc(raw(magento)), META) as PageLinkRow;

test("each language's newsletter links its language's own store view - the Page builder's map", () => {
  assert.deepEqual(["EN", "DE", "FR", "IT", "NL", "PL"].map(newsletterStore), ["en-INT", "de-CH", "fr-CH", "it-CH", "nl-NL", "pl-PL"]);
  assert.equal(newsletterStore("fr"), "fr-CH", "lower case too");
  assert.equal(newsletterStore(""), "en-INT", "no language: the shop's international English (x-default)");
  assert.equal(pageAddress("fr-CH", "joints-alimentaires"), "https://www.apsoparts.com/fr-CH/joints-alimentaires");
});

test("a new page's row: its URL key per language store view, as the last step writes it into Magento", () => {
  const r = row();
  assert.deepEqual(Object.keys(r.views).sort(), ["de-CH", "en-INT", "fr-CH"], "no Italian, Dutch or Polish version: none there");
  assert.equal(r.views["de-CH"].key, "dichtungen-lebensmittel");
  assert.equal(r.views["fr-CH"].key, "joints-alimentaires");
  assert.equal(r.views["en-INT"].key, "food-grade-seals", "no URL key set: made from the title, as Magento gets it");
  assert.equal(r.views["fr-CH"].title, "Joints alimentaires");
  assert.equal(r.title, "Dichtungen für Lebensmittel");
  assert.equal(r.main, "de-CH");
  // the newest write per environment and store view
  assert.deepEqual(r.last.map((w) => `${w.env} ${w.store} ${w.action}`), ["acc fr-CH created", "prod de-CH created", "acc de-CH created"]);
});

test("picking writes the PRODUCTION address in the newsletter's store view - and says plainly when it is not there yet", () => {
  const r = row();
  const de = linkFor(r, "DE");
  assert.deepEqual(de, { store: "de-CH", address: "https://www.apsoparts.com/de-CH/dichtungen-lebensmittel", state: "live", tone: "ok", line: "On the shop in de-CH" });
  const fr = linkFor(r, "FR");
  assert.equal(fr.address, "https://www.apsoparts.com/fr-CH/joints-alimentaires", "only on ACC: still the shop's address");
  assert.equal(fr.state, "acc");
  assert.equal(fr.tone, "warn");
  assert.equal(fr.line, "Only on ACC - not on the shop yet. Publish it to production first");
  const en = linkFor(r, "EN");
  assert.equal(en.address, "https://www.apsoparts.com/en-INT/food-grade-seals");
  assert.equal(en.state, "none");
  assert.equal(en.line, "Not on the shop yet - publish it to production first");
  const it = linkFor(r, "IT");
  assert.equal(it.address, null, "no Italian version: nothing to link");
  assert.equal(it.state, "no-version");
  assert.equal(it.line, "No Italian version yet - add it-CH in the Page builder first");
  for (const l of ["DE", "FR", "EN", "NL", "PL"].map((x) => linkFor(r, x))) assert.ok(!l.address || l.address.startsWith("https://www.apsoparts.com/"), "never an ACC address");
});

test("the state from the records: switched off, moved to another URL key, a store view the version goes to", () => {
  // the page brought back on production (it had created it): switched off - newer than the write
  const off = row([rec("prod", "de-CH", "dichtungen-lebensmittel", "switched-off", "2026-11-11T08:00:00Z"), ...RECORDS]);
  assert.equal(linkFor(off, "DE").state, "off");
  assert.equal(linkFor(off, "DE").line, "Switched off on the shop - publish it to production again");
  // the URL key changed after the last publish: the address the page will have, and where the shop has it now
  const moved = row([rec("prod", "de-CH", "dichtungen-food", "updated", "2026-11-10T12:00:00Z")]);
  const m = linkFor(moved, "DE");
  assert.equal(m.address, "https://www.apsoparts.com/de-CH/dichtungen-lebensmittel");
  assert.equal(m.state, "moved");
  assert.equal(m.line, "The shop has it at /de-CH/dichtungen-food - publish it to production again for this address");
  // a restore of an update leaves the page on
  assert.equal(stateIn(lastWrites([rec("prod", "it-CH", "k", "restored", "2026-11-10T12:00:00Z")]), "it-CH", "k").state, "live");
  // a store view the version goes to without being its own (en-CH of the en-INT version): the same key
  assert.equal(pageLinkRow(pageDoc(raw(RECORDS)), META)?.views["en-INT"]?.version, "en-INT");
});

test("where the page is, in a line - Production and ACC, their store views in the shop's order", () => {
  const r = row([rec("prod", "fr-CH", "joints-alimentaires", "created", "3"), ...RECORDS]);
  assert.deepEqual(publishedIn(r.last), { prod: ["de-CH", "fr-CH"], acc: ["de-CH", "fr-CH"] });
  assert.equal(whereLine(r.last), "Production: de-CH, fr-CH · ACC: de-CH, fr-CH");
  assert.equal(whereLine([]), "Not published yet");
  assert.equal(storesLine(["de-CH", "de-AT", "de-DE", "de-INT", "fr-CH", "fr-FR"]), "de-CH, de-AT, de-DE and 3 more");
});

test("what is said under a link field: an ACC address, another language's store view, a page not on the shop yet", () => {
  const rows = [row()];
  assert.equal(linkNote("", "DE", rows), null);
  assert.deepEqual(linkNote("https://acc.apsoparts.com/de-CH/dichtungen-lebensmittel", "DE", rows), { tone: "bad", line: "An ACC address - readers cannot open it. Use the shop's address (www.apsoparts.com)" });
  // picked before the newsletter was translated into French
  assert.deepEqual(linkNote("https://www.apsoparts.com/de-CH/dichtungen-lebensmittel", "FR", rows), { tone: "warn", line: "This address is in de-CH - the newsletter is in French (fr-CH)" });
  assert.equal(linkNote("https://www.apsoparts.com/en-INT/food-grade-seals", "EN", rows)?.line, "Not on the shop yet - publish it to production first");
  assert.equal(linkNote("https://www.apsoparts.com/de-CH/dichtungen-lebensmittel", "DE", rows)?.tone, "ok");
  // any other page of the shop in the newsletter's language: nothing to say (the e-mail's own link search finds those)
  assert.equal(linkNote("https://www.apsoparts.com/de-DE/o-ringe.html", "DE", rows), null);
  assert.equal(linkNote("https://www.apsoparts.com/de-CH/eur/o-ringe.html", "DE", null), null, "the Swiss shop in EUR is German too");
  assert.equal(linkNote("https://example.com/x", "DE", rows), null);
});

test("only new pages with a URL key are listed; the ones the newsletter can link come first", () => {
  assert.equal(pageLinkRow(pageDoc({ source: "pick", store: "de-CH", path: "/de-CH/o-ringe.html" }), META), null, "a page of the shop: the e-mail's link search finds it");
  assert.equal(pageLinkRow(pageDoc({ source: "new", store: "de-CH", fields: { intro: "Noch ohne Titel" } }), META), null, "no title, no URL key: no address");
  // an older new page: its words in one block of HTML, its key from its title
  const old = pageLinkRow(pageDoc({ source: "new", store: "fr-CH", newPage: { title: "Une page d'avant", urlKey: "", body: "<p>Bonjour</p>" } }), META);
  assert.equal(old?.views["fr-CH"]?.key, "une-page-d-avant");
  const live = { ...row(), pieceId: 1, updatedAt: "2026-11-01T00:00:00.000Z" };
  const notYet = { ...row([]), pieceId: 2, updatedAt: "2026-11-11T00:00:00.000Z" };
  assert.deepEqual(pickerOrder([notYet, live], "DE").map((r) => r.pieceId), [1, 2], "on the shop first");
  assert.deepEqual(pickerOrder([live, notYet], "IT").map((r) => r.pieceId), [2, 1], "none in Italian: newest first");
});

test("the server's ONE query (on PGlite): only the projects this person may open, a slim document read as the whole one", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE apsomh_content_projects (id INTEGER PRIMARY KEY, title TEXT, created_by TEXT, status TEXT DEFAULT 'draft', deleted_at TIMESTAMPTZ);
      CREATE TABLE apsomh_content_project_members (project_id INTEGER, username TEXT, role TEXT);
      CREATE TABLE apsomh_content_pieces (id INTEGER PRIMARY KEY, project_id INTEGER, title TEXT, status TEXT, language TEXT, content_type TEXT);
      CREATE TABLE apsomh_content_piece_docs (piece_id INTEGER PRIMARY KEY, kind TEXT, doc JSONB, updated_at TIMESTAMPTZ);
      INSERT INTO apsomh_content_projects VALUES
        (1, 'Food-grade seals 2027', 'sarcla', 'draft', NULL),
        (2, 'Diana''s project', 'diana', 'draft', NULL),
        (3, 'Daniel''s project', 'daniel', 'draft', NULL),
        (4, 'Deleted', 'sarcla', 'archived', NOW()),
        (5, 'Shop pages', 'sarcla', 'archived', NULL);
      INSERT INTO apsomh_content_project_members VALUES (2, 'sarcla', 'commenter');`);
    const pieces: [number, number, string, string, string, unknown, string][] = [
      [41, 1, "SEO landing page", "page", "DE", raw(RECORDS), "2026-11-10T20:00:00Z"],
      // an older new page (no store view lists, its words one block of HTML), shared with sarcla to comment on
      [42, 2, "Old landing page", "page", "FR", { source: "new", store: "fr-CH", newPage: { title: "Une page d'avant", urlKey: "page-avant", body: "<p>Bonjour</p>" } }, "2026-11-11T08:00:00Z"],
      // kept before store view lists (Content v10): no `stores` - its versions settled as the whole document's
      [43, 3, "Not shared", "page", "DE", (({ stores: _s, ...o }) => o)({ ...raw([]), fields: { hero: { title: "Nicht geteilt" } } }), "2026-11-09T08:00:00Z"],
      [44, 4, "In a deleted project", "page", "DE", raw(RECORDS), "2026-11-11T09:00:00Z"],
      [45, 5, "Page builder", "page", "DE", { source: "pick", store: "de-CH", path: "/de-CH/o-ringe.html" }, "2026-11-11T09:00:00Z"],
      [46, 5, "Newsletter", "newsletter", "DE", { source: "new", subject: "x" }, "2026-11-11T09:00:00Z"],
    ];
    for (const [id, project, title, kind, lang, doc, at] of pieces) {
      await db.query("INSERT INTO apsomh_content_pieces VALUES ($1, $2, $3, 'approved', $4, $5)", [id, project, title, lang, kind === "page" ? "landing-page" : "newsletter"]);
      await db.query("INSERT INTO apsomh_content_piece_docs VALUES ($1, $2, $3, $4)", [id, kind, JSON.stringify(doc), at]);
    }
    const read = async (username: string, admin: boolean) => pageLinkRows((await db.query<PageLinksDbRow>(pageLinksQuery(admin), [username])).rows);
    const mine = await read("sarcla", false);
    assert.deepEqual(mine.map((r) => r.pieceId), [42, 41], "own and shared, newest first - not another's, not a deleted project, not a page of the shop");
    const meta = (pieceId: number, projectId: number, project: string, todo: string, updatedAt: string) => ({ pieceId, projectId, project, todo, status: "approved", updatedAt });
    assert.deepEqual(mine[1], pageLinkRow(pageDoc(raw(RECORDS), "DE"), meta(41, 1, "Food-grade seals 2027", "SEO landing page", "2026-11-10T20:00:00.000Z")), "the slim document gives the whole one's row");
    assert.deepEqual(mine[0], pageLinkRow(pageDoc(pieces[1][5], "FR"), meta(42, 2, "Diana's project", "Old landing page", "2026-11-11T08:00:00.000Z")));
    assert.equal(mine[0].views["fr-CH"].key, "page-avant");
    assert.equal(linkFor(mine[0], "FR").line, "Not on the shop yet - publish it to production first");
    const daniel = await read("daniel", false);
    assert.deepEqual(daniel.map((r) => r.pieceId), [43]);
    assert.deepEqual(daniel[0], pageLinkRow(pageDoc(pieces[2][5], "DE"), meta(43, 3, "Daniel's project", "Not shared", "2026-11-09T08:00:00.000Z")));
    assert.equal(daniel[0].views["de-CH"].key, "nicht-geteilt");
    assert.deepEqual((await read("nobody", false)).map((r) => r.pieceId), []);
    assert.deepEqual((await read("boss", true)).map((r) => r.pieceId), [42, 41, 43], "an admin: every project but the deleted one");
  } finally { await db.close(); }
});
