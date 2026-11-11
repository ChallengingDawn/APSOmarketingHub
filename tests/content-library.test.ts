import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { MagentoRecord } from "../src/lib/content/studio/kinds/page/model";
import {
  LIBRARY_KINDS, NO_FILTER, PICTURE_RE, countLine, filterChoices, filterItems, kindCounts, libraryHref, libraryItem, libraryItems,
  libraryKindBySlug, libraryOrder, libraryQuery, pageWhere, peopleIn, pictureOf, stateOf, stateWord, studioHref,
  type LibraryDbRow, type LibraryItem,
} from "../src/lib/content/library";

// SARCLA 11.11.2026, ~13:40, right after publishing the first official Page builder page (the Kalrez page: "Official,
// this is the first one"): "Content library: we should have one page per type of content, and content should really
// display, and in one click back to edit, for all that we publish from the one [hub]". Made-up pieces and records.

const ENGLISH = ["en-CH/eur", "en-CH", "en-DE", "en-AT", "en-FR", "en-IT", "en-NL", "en-INT", "en-PL"];
const KEY = "kalrez-6221-6230-discontinued";
const rec = (env: "prod" | "acc", store: string, action: MagentoRecord["action"], at: string, identifier = KEY): MagentoRecord =>
  ({ env, store, pageId: String(700 + ENGLISH.indexOf(store)), identifier, action, at, by: "SARCLA", backupId: "1", url: "" });
// newest first, as the Page builder keeps them: production 11.11 13:40, ACC the night before
const KALREZ_RECORDS = [
  ...ENGLISH.map((s) => rec("prod", s, "created", "2026-11-11T12:40:00.000Z")),
  ...ENGLISH.map((s) => rec("acc", s, "updated", "2026-11-10T22:06:00.000Z")),
];
const kalrezDoc = (magento: MagentoRecord[] = KALREZ_RECORDS) => ({
  source: "new", env: "prod", store: "en-INT", path: "", stores: ENGLISH,
  fields: {
    hero: { title: "Kalrez® 6221 & 6230 Discontinued", picture: { url: "/api/content/picture/448-k9x2ab", alt: "Operator's hand pressing the red stop button", idea: "" } },
    seo: { title: "", description: "", urlKey: KEY },
  },
  newPage: { title: "", urlKey: "", metaTitle: "", metaDescription: "", body: "" },
  langs: {}, magento,
});
const row = (o: Partial<LibraryDbRow> & Pick<LibraryDbRow, "piece_id" | "kind">): LibraryDbRow => ({
  project_id: 12, project: "Kalrez discontinuation", title: "Page builder", status: "approved", language: "EN", content_type: "page-refresh",
  writer: "SARCLA", reviewer: "CLAUDIO", updated_at: "2026-11-11T12:41:00.000Z", updated_by: "SARCLA", live_event: null, doc: {}, first_pic: null, on_pages: null, ...o,
});
const KALREZ = row({ piece_id: 77, kind: "page", doc: kalrezDoc() });

test("one page per kind of content - the kinds the studios make, each at its own address", () => {
  assert.deepEqual(LIBRARY_KINDS.map((k) => k.slug), ["pages", "banners", "blog", "newsletters", "social", "videos"]);
  assert.deepEqual(LIBRARY_KINDS.map((k) => k.kind), ["page", "banner", "blog", "newsletter", "social", "video"]);
  assert.equal(libraryHref("pages"), "/projects/library/pages");
  assert.equal(libraryKindBySlug("banners")?.label, "Banners");
  assert.equal(libraryKindBySlug("search-ads"), null, "no studio, no page");
  // one click back to edit: the content board's own address of the to-do (the page studio opens at Build)
  assert.equal(studioHref(12, 77), "/projects/12/pieces/77");
});

test("the Kalrez page: Official - live on production, a link per store view, when and by whom; ACC after", () => {
  const i = libraryItem(KALREZ)!;
  assert.equal(i.title, "Kalrez® 6221 & 6230 Discontinued");
  assert.equal(i.line, `/${KEY}`);
  assert.equal(i.picture, "/api/content/picture/448-k9x2ab", "its hero picture");
  assert.deepEqual(i.languages, ["EN"]);
  assert.equal(i.storeViews, 9);
  assert.equal(i.official, true);
  assert.equal(i.state, "official");
  assert.equal(stateWord(i), "Live on production");
  assert.deepEqual(i.where.map((w) => w.kind), ["prod", "acc"], "production first");
  const prod = i.where[0];
  assert.equal(prod.label, "Production");
  assert.equal(prod.at, "2026-11-11T12:40:00.000Z");
  assert.equal(prod.by, "SARCLA");
  assert.equal(prod.links.length, 9);
  assert.deepEqual(prod.links[0], { label: "en-CH/eur", url: `https://www.apsoparts.com/en-CH/eur/${KEY}` }, "in the shop's order of store views");
  assert.ok(prod.links.some((l) => l.url === `https://www.apsoparts.com/en-INT/${KEY}`));
  assert.ok(i.where[1].links.every((l) => l.url.startsWith("https://acc.apsoparts.com/")), "ACC's own addresses");
  assert.equal(i.href, "/projects/12/pieces/77");
});

test("a page only on ACC is published, not official; switched off on production is not on production", () => {
  const acc = libraryItem(row({ piece_id: 78, kind: "page", doc: kalrezDoc(KALREZ_RECORDS.filter((r) => r.env === "acc")) }))!;
  assert.equal(acc.official, false);
  assert.equal(acc.state, "published");
  assert.equal(stateWord(acc), "On ACC");
  // the newest production write of en-INT switched it off: en-INT left out, the eight others stay
  const off = libraryItem(row({ piece_id: 79, kind: "page", doc: kalrezDoc([rec("prod", "en-INT", "switched-off", "2026-11-11T14:00:00.000Z"), ...KALREZ_RECORDS]) }))!;
  assert.equal(off.where[0].links.length, 8);
  assert.ok(!off.where[0].links.some((l) => l.label === "en-INT"));
  // every store view switched off on production: only ACC is left
  const allOff = pageWhere([...ENGLISH.map((s) => rec("prod", s, "switched-off", "2026-11-11T15:00:00.000Z")), ...KALREZ_RECORDS]);
  assert.deepEqual(allOff.map((w) => w.kind), ["acc"]);
});

test("a page of the shop: its h1, else its title there; its path; the first picture of its changes", () => {
  const i = libraryItem(row({
    piece_id: 84, kind: "page", status: "writing", language: "DE",
    doc: { source: "pick", env: "prod", store: "de-CH", path: "/de-CH/o-ringe.html", outline: { path: "/de-CH/o-ringe.html", title: "O-Ringe | APSOparts Shop", h1: [] }, langs: {}, magento: [] },
    first_pic: "https://www.apsoparts.com/media/catalog/product/o/r/oring.jpg",
  }))!;
  assert.equal(i.title, "O-Ringe");
  assert.equal(i.line, "/de-CH/o-ringe.html");
  assert.equal(i.picture, "https://www.apsoparts.com/media/catalog/product/o/r/oring.jpg");
  assert.equal(i.state, "draft");
  assert.deepEqual(i.where, []);
});

test("the other kinds: a banner on a page, a newsletter's HubSpot draft, a post marked posted, a blog marked live", () => {
  const banner = libraryItem(row({
    piece_id: 90, kind: "banner", status: "approved", content_type: "banner", language: "EN",
    doc: { content: { headline: "Kalrez 6221 & 6230 are going", image: { url: "/api/content/picture/450-zz" } }, language: "EN" },
    on_pages: [{ pieceId: 77, projectId: 12, title: "Kalrez page", magento: KALREZ_RECORDS }],
  }))!;
  assert.equal(banner.title, "Kalrez 6221 & 6230 are going");
  assert.equal(banner.picture, "/api/content/picture/450-zz");
  assert.equal(banner.official, true, "on a page that is live on production");
  assert.equal(banner.where[0].sub, "on Kalrez page");
  const placed = libraryItem(row({ piece_id: 91, kind: "banner", status: "approved", doc: { content: { headline: "Not out yet" } }, on_pages: [{ pieceId: 81, projectId: 12, title: "Draft page", magento: [] }] }))!;
  assert.equal(placed.state, "published");
  assert.equal(stateWord(placed), "On a page");
  assert.deepEqual(placed.where[0].links, [{ label: "Open the page", url: "/projects/12/pieces/81", internal: true }]);

  const nl = libraryItem(row({ piece_id: 95, kind: "newsletter", status: "review", doc: { subject: "Kalrez: what replaces it", preheader: "Order until 27 November", hubspot: { emailId: "510405035211", url: "https://app-eu1.hubspot.com/email/26492587/edit/510405035211", at: "2026-11-11T09:00:00.000Z" } } }))!;
  assert.equal(nl.title, "Kalrez: what replaces it");
  assert.equal(nl.state, "published");
  assert.equal(stateWord(nl), "HubSpot draft");
  assert.equal(nl.where[0].links[0].label, "E-mail 510405035211");
  const bad = libraryItem(row({ piece_id: 96, kind: "newsletter", doc: { subject: "x", hubspot: { emailId: "1", url: "javascript:alert(1)" } } }))!;
  assert.deepEqual(bad.where[0].links, [], "only an https address is a link");

  const post = libraryItem(row({ piece_id: 97, kind: "social", status: "approved", title: "LinkedIn: Kalrez", doc: { text: "Kalrez 6221 and 6230 are discontinued.\nWhat now?", published: { at: "2026-11-11T10:00:00.000Z", by: "DIAROS" } } }))!;
  assert.equal(post.official, true);
  assert.equal(stateWord(post), "Posted");
  assert.equal(post.line, "Kalrez 6221 and 6230 are discontinued.");
  assert.equal(post.title, "LinkedIn: Kalrez", "a post has no title of its own: the to-do's");

  const blog = libraryItem(row({ piece_id: 98, kind: "blog", status: "live", live_event: { at: "2026-11-10T08:00:00Z", by: "SARCLA" }, doc: { title: "How to choose an FFKM", slug: "ffkm", store: "en-CH", hero: "/api/content/picture/9-a", language: "EN" } }))!;
  assert.equal(blog.official, true);
  assert.equal(blog.line, "/en-CH/blog/ffkm");
  assert.deepEqual(blog.where, [{ kind: "marked", label: "Marked live", at: "2026-11-10T08:00:00.000Z", by: "SARCLA", links: [] }]);

  // a to-do opened once and never filled is not content yet; a kind without a library page never shows
  assert.equal(libraryItem(row({ piece_id: 99, kind: "video", status: "todo", title: "", doc: { scenes: 0 } })), null);
  assert.equal(libraryItem(row({ piece_id: 100, kind: "search-ad" })), null);
  // a picture from anywhere else is not shown (the hub's pages show pictures from the hub, the shop and our HubSpot only)
  assert.equal(pictureOf("javascript:x"), null);
  assert.equal(pictureOf("/api/content/picture/12-ab"), "/api/content/picture/12-ab");
});

test("the order: official first (the newest out first), then published, approved, in review, drafts", () => {
  const items = libraryItems([
    row({ piece_id: 1, kind: "page", status: "writing", doc: { source: "new", fields: { hero: { title: "Draft" } } }, updated_at: "2026-11-11T13:00:00Z" }),
    row({ piece_id: 2, kind: "page", status: "review", doc: { source: "new", fields: { hero: { title: "Review" } } } }),
    row({ piece_id: 3, kind: "page", doc: kalrezDoc(KALREZ_RECORDS.filter((r) => r.env === "acc")) }),
    KALREZ,
    row({ piece_id: 5, kind: "page", doc: kalrezDoc(KALREZ_RECORDS.map((r) => ({ ...r, at: "2026-11-01T00:00:00.000Z" }))) }),
  ]);
  assert.deepEqual(items.map((i) => i.pieceId), [77, 5, 3, 2, 1], "the Kalrez page first: official, the newest out");
  assert.deepEqual(libraryOrder([...items].reverse()).map((i) => i.pieceId), [77, 5, 3, 2, 1]);
});

test("the counts at the top: 'Pages · 1 official'", () => {
  const items = libraryItems([KALREZ, row({ piece_id: 3, kind: "page", doc: kalrezDoc(KALREZ_RECORDS.filter((r) => r.env === "acc")) }), row({ piece_id: 91, kind: "banner", doc: { content: { headline: "B" } } })]);
  const c = kindCounts(items);
  assert.deepEqual(c.find((x) => x.slug === "pages"), { slug: "pages", label: "Pages", total: 2, official: 1, published: 1 });
  assert.equal(countLine(c[0]), "1 official · 1 published");
  assert.equal(countLine({ slug: "pages", label: "Pages", total: 1, official: 1, published: 0 }), "1 official");
  assert.equal(countLine(c.find((x) => x.slug === "banners")!), "1 in progress");
  assert.equal(countLine(c.find((x) => x.slug === "videos")!), "none yet");
});

test("filters: how far, language, project, a search through titles, addresses and names", () => {
  const items: LibraryItem[] = libraryItems([
    KALREZ,
    row({ piece_id: 2, kind: "page", project_id: 30, project: "Food seals", status: "review", language: "DE", doc: { source: "new", store: "de-CH", fields: { hero: { title: "Dichtungen für Lebensmittel" }, seo: { urlKey: "dichtungen-lebensmittel" } } } }),
  ]);
  assert.deepEqual(filterItems(items, { ...NO_FILTER, state: "official" }).map((i) => i.pieceId), [77]);
  assert.deepEqual(filterItems(items, { ...NO_FILTER, language: "DE" }).map((i) => i.pieceId), [2]);
  assert.deepEqual(filterItems(items, { ...NO_FILTER, project: 12 }).map((i) => i.pieceId), [77]);
  assert.deepEqual(filterItems(items, { ...NO_FILTER, q: "lebensmittel" }).map((i) => i.pieceId), [2]);
  assert.deepEqual(filterItems(items, { ...NO_FILTER, q: "en-INT kalrez" }).map((i) => i.pieceId), [77], "every word, store views and addresses too");
  assert.deepEqual(filterItems(items, { ...NO_FILTER, q: "sara" }, { SARCLA: "Sara Clavien" }).map((i) => i.pieceId), [77, 2], "the writer's name");
  const ch = filterChoices(items);
  assert.deepEqual(ch.languages, ["EN", "DE"]);
  assert.deepEqual(ch.projects, [{ id: 30, title: "Food seals" }, { id: 12, title: "Kalrez discontinuation" }]);
  assert.deepEqual(ch.states.map((s) => `${s.key} ${s.count}`), ["official 1", "published 0", "approved 0", "review 1", "draft 0"]);
  assert.deepEqual(peopleIn(items).sort(), ["CLAUDIO", "SARCLA"]);
  assert.equal(stateOf("live", false, false), "published", "marked live with no record of where");
  assert.equal(stateOf("changes", false, false), "draft");
});

test("the server's ONE query (on PGlite): only the projects this person may open; the picture, the banner's pages, the move to Live", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE apsomh_content_projects (id INTEGER PRIMARY KEY, title TEXT, created_by TEXT, status TEXT DEFAULT 'draft', deleted_at TIMESTAMPTZ);
      CREATE TABLE apsomh_content_project_members (project_id INTEGER, username TEXT, role TEXT);
      CREATE TABLE apsomh_content_pieces (id INTEGER PRIMARY KEY, project_id INTEGER, title TEXT, status TEXT, language TEXT, content_type TEXT, writer TEXT, reviewer TEXT);
      CREATE TABLE apsomh_content_piece_docs (piece_id INTEGER PRIMARY KEY, kind TEXT, doc JSONB, updated_at TIMESTAMPTZ, updated_by TEXT);
      CREATE TABLE apsomh_content_events (id SERIAL PRIMARY KEY, project_id INTEGER, piece_id INTEGER, actor TEXT, kind TEXT, detail JSONB, created_at TIMESTAMPTZ DEFAULT NOW());
      INSERT INTO apsomh_content_projects VALUES (12, 'Kalrez discontinuation', 'SARCLA', 'draft', NULL), (30, 'Food seals', 'DIAROS', 'archived', NULL),
        (40, 'Somebody else''s', 'ANNA', 'draft', NULL), (50, 'Deleted', 'SARCLA', 'draft', NOW());
      INSERT INTO apsomh_content_project_members VALUES (12, 'DIAROS', 'commenter');
    `);
    const big = "x".repeat(5000);
    const piece = async (id: number, project: number, kind: string, doc: unknown, status = "approved", at = "2026-11-11T12:41:00Z") => {
      await db.query("INSERT INTO apsomh_content_pieces VALUES ($1, $2, $3, $4, 'EN', $5, 'SARCLA', 'CLAUDIO')", [id, project, `To-do ${id}`, status, kind === "page" ? "page-refresh" : kind]);
      await db.query("INSERT INTO apsomh_content_piece_docs VALUES ($1, $2, $3, $4, 'SARCLA')", [id, kind, JSON.stringify(doc), at]);
    };
    // the Kalrez page with heavy parts no card needs; its banner placed on it by "Put it on a page" (a change banner-90)
    await piece(77, 12, "page", { ...kalrezDoc(), changes: [{ op: "insert", id: "banner-90", html: `<img src="/api/content/picture/451-b">` }], fields: { ...kalrezDoc().fields, modules: [{ id: "m1", html: big }], looks: { a: { size: "l" } } }, briefText: big });
    await piece(90, 12, "banner", { content: { headline: "Kalrez is going", image: { url: "" }, photos: [{ url: "/api/content/picture/452-c" }] }, language: "EN" });
    await piece(95, 30, "newsletter", { subject: "Food", blocks: [{ kind: "hero", image: { url: "https://26492587.fs1.hubspotusercontent-eu1.net/hubfs/26492587/x.png" } }] });
    await piece(98, 30, "blog", { title: "FFKM", hero: { url: "/api/content/picture/9-a" }, slug: "ffkm", store: "en-CH" }, "live");
    await db.query(`INSERT INTO apsomh_content_events (project_id, piece_id, actor, kind, detail, created_at) VALUES
      (30, 98, 'DIAROS', 'status', '{"to":"live"}', '2026-11-10T08:00:00Z'), (30, 98, 'SARCLA', 'status', '{"to":"approved"}', '2026-11-09T08:00:00Z')`);
    await piece(400, 40, "page", kalrezDoc());
    await piece(500, 50, "page", kalrezDoc());
    const read = async (username: string, admin: boolean) => libraryItems((await db.query<LibraryDbRow>(libraryQuery(admin), [username, PICTURE_RE])).rows);

    const sara = await read("SARCLA", false);
    assert.deepEqual(sara.map((i) => i.pieceId).sort((a, b) => a - b), [77, 90], "her own project only - never someone else's, never a deleted one");
    const kalrez = sara.find((i) => i.pieceId === 77)!;
    assert.equal(kalrez.official, true);
    assert.equal(kalrez.picture, "/api/content/picture/448-k9x2ab");
    assert.equal(kalrez.where[0].links.length, 9);
    const banner = sara.find((i) => i.pieceId === 90)!;
    assert.equal(banner.picture, "/api/content/picture/452-c", "no picture of its own: the first of its photos");
    assert.equal(banner.official, true, "on the Kalrez page, live on production");
    assert.equal(banner.where[0].sub, "on To-do 77");

    // shared with her as a commenter: she sees the project's pieces; the archived project of her own too
    const diana = await read("DIAROS", false);
    assert.deepEqual(diana.map((i) => i.pieceId).sort((a, b) => a - b), [77, 90, 95, 98]);
    const nl = diana.find((i) => i.pieceId === 95)!;
    assert.equal(nl.picture, "https://26492587.fs1.hubspotusercontent-eu1.net/hubfs/26492587/x.png");
    const blog = diana.find((i) => i.pieceId === 98)!;
    assert.deepEqual(blog.where.map((w) => `${w.label} ${w.by} ${w.at}`), ["Marked live DIAROS 2026-11-10T08:00:00.000Z"], "the last move to Live");

    // an admin sees every project's pieces - never a deleted project's
    const admin = await read("ADMIN", true);
    assert.deepEqual(admin.map((i) => i.pieceId).sort((a, b) => a - b), [77, 90, 95, 98, 400]);
    assert.equal(admin[0].pieceId === 77 || admin[0].pieceId === 400, true, "official first");
    // the card's parts only: a page's modules and long texts never travel
    const raw = (await db.query<LibraryDbRow>(libraryQuery(true), ["ADMIN", PICTURE_RE])).rows.find((r) => r.piece_id === 77)!;
    assert.ok(JSON.stringify(raw.doc).length < 6000, "slim");
    assert.ok(!JSON.stringify(raw.doc).includes(big));
  } finally {
    await db.close();
  }
});
