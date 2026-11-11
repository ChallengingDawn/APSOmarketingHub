import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { blogDoc, blogText, type BlogDoc } from "../src/lib/content/studio/kinds/blog/model";
import { guardOutline } from "../src/lib/content/studio/kinds/blog/guard";
import { languagesOf, liveLanguages, translatedLine, translatedView, versionIn, withVersion, withoutLanguage, type OutlineAnswer } from "../src/lib/content/studio/kinds/blog/langs";
import { PICTURE_RE, libraryItem, libraryItems, libraryQuery, type LibraryDbRow } from "../src/lib/content/library";

// cv17 (SARCLA 11.11.2026: "continue") - the blog's languages as tabs, as the newsletter and the social studio keep them:
// the post's own language its top level, each other language a version under `langs`. Made-up words.

const raw = () => ({
  v: 1, title: "EPDM oder FKM?", slug: "epdm-oder-fkm", store: "de-CH", language: "DE", author: "Claudio Saraiva", authorRole: "Produktmanager Dichtungen",
  excerpt: "Es kommt auf das Medium an.", takeaways: ["EPDM: Heisswasser"], metaTitle: "EPDM oder FKM?", metaDescription: "Welches Elastomer?",
  hero: { url: "/api/content/picture/12-abcd", alt: "O-Ringe auf einer Werkbank", caption: "In der Molkerei", prompt: "o-rings on a bench" },
  sections: [
    { id: "a", heading: "Kurz", body: "Siehe die [EPDM O-Ringe](/de-CH/o-ringe-epdm).", quote: "Hitze altert Gummi.", image: { url: "/api/content/picture/13-efgh", alt: "Eine Dichtung", caption: "Nach 2000 Stunden", prompt: "a seal in a pump" } },
    { id: "b", heading: "Temperaturen", body: "Bis etwa 150 °C.", quote: "", image: { url: "", alt: "", caption: "", prompt: "" } },
  ],
  faq: [{ id: "f1", q: "Beides?", a: "Nein, siehe [hier](https://www.apsoparts.com/de-CH/dichtungen)." }],
  relatedProducts: [{ id: "p1", name: "EPDM O-Ringe", url: "https://www.apsoparts.com/de-CH/o-ringe-epdm" }],
  tags: ["O-Ringe"], cta: { title: "Im Shop", text: "Alle Grössen.", label: "Zum Shop", url: "https://www.apsoparts.com/de-CH/" },
  publishAt: "2026-11-20", notes: "Für das Team", changes: [{ id: 5, text: "The post: 2 sections.", at: "2026-11-11T10:00:00Z" }],
  published: { at: "2026-11-11T12:00:00Z", by: "SARCLA", pages: [{ label: "The post", path: "/de-CH/blog/epdm-oder-fkm", url: "https://www.apsoparts.com/de-CH/blog/epdm-oder-fkm" }] },
});

/** The French translation as the server's outline task answers it (already guarded there). */
const french = (): OutlineAnswer => ({
  title: "EPDM ou FKM ?", slug: "epdm-ou-fkm", metaTitle: "EPDM ou FKM ?", metaDescription: "Quel élastomère ?", excerpt: "Tout dépend du fluide.",
  takeaways: ["EPDM : eau chaude"], tags: ["Joints toriques"],
  sections: [
    { id: "x1", heading: "En bref", body: "Voir les [joints EPDM](/de-CH/o-ringe-epdm).", quote: "La chaleur vieillit le caoutchouc.", image: { url: "", alt: "Un joint", caption: "Après 2000 heures", prompt: "" } },
    { id: "x2", heading: "Températures", body: "Jusqu'à environ 150 °C.", quote: "", image: { url: "", alt: "", caption: "", prompt: "" } },
  ],
  faq: [{ id: "q1", q: "Les deux ?", a: "Non, voir [ici](https://www.apsoparts.com/de-CH/dichtungen)." }],
  cta: { title: "Dans la boutique", text: "Toutes les tailles.", label: "Vers la boutique" },
  picture: "", pictureAlt: "Des joints toriques sur un établi", heroCaption: "Dans la laiterie", authorRole: "Chef de produit étanchéité",
});

test("an older post (no langs) opens, edits and saves exactly as before", () => {
  const d = blogDoc(raw());
  assert.equal("langs" in d, false, "no key added");
  assert.deepEqual(languagesOf(raw()), ["DE"]);
  assert.deepEqual(versionIn(raw(), "DE"), d);
  assert.deepEqual(versionIn(raw(), "FR"), d, "a language it has not: the post itself");
  assert.deepEqual(versionIn(raw(), null), d);
  const edited = withVersion(raw(), "DE", { ...d, title: "Neu" });
  assert.equal(edited.title, "Neu");
  assert.equal("langs" in edited, false);
  assert.deepEqual(blogDoc(JSON.parse(JSON.stringify(edited))), { ...d, title: "Neu" }, "stored and read back: the same shape");
  // the start card may still change the post's own language while it has no other
  assert.equal(withVersion(raw(), "DE", { ...d, language: "FR", store: "fr-CH" }).language, "FR");
  assert.deepEqual(withoutLanguage(raw(), "FR"), d, "nothing to take out");
  // a to-do once translated in place stays a to-do of its own: nothing moves it
  const translatedInPlace = blogDoc({ ...raw(), language: "FR", store: "fr-CH", changes: [{ id: 9, text: "Translated into French", at: "2026-11-10T08:00:00Z", lang: "FR", from: "DE" }] });
  assert.deepEqual(languagesOf(translatedInPlace), ["FR"]);
});

test("+ Language: the translation laid over the post it was made from - every part along, pictures kept, links moved", () => {
  const src = blogDoc(raw());
  const v = translatedView(src, french(), "FR");
  assert.equal(v.language, "FR");
  assert.equal(v.store, "fr-CH");
  assert.equal(v.title, "EPDM ou FKM ?");
  assert.equal(v.slug, "epdm-ou-fkm");
  assert.equal(v.authorRole, "Chef de produit étanchéité");
  assert.deepEqual(v.tags, ["Joints toriques"]);
  // the sections keep the post's ids (so the pictures are shared) and their pictures, in the new language's words
  assert.deepEqual(v.sections.map((s) => s.id), ["a", "b"]);
  assert.deepEqual(v.sections[0].image, { url: "/api/content/picture/13-efgh", prompt: "a seal in a pump", alt: "Un joint", caption: "Après 2000 heures" });
  assert.deepEqual(v.hero, { url: "/api/content/picture/12-abcd", alt: "Des joints toriques sur un établi", caption: "Dans la laiterie", prompt: "o-rings on a bench" });
  // the links, the band's button and the products in the French store view
  assert.equal(v.sections[0].body, "Voir les [joints EPDM](/fr-CH/o-ringe-epdm).");
  assert.equal(v.faq[0].a, "Non, voir [ici](https://www.apsoparts.com/fr-CH/dichtungen).");
  assert.equal(v.cta.url, "https://www.apsoparts.com/fr-CH/");
  assert.equal(v.relatedProducts[0].url, "https://www.apsoparts.com/fr-CH/o-ringe-epdm");
  assert.deepEqual(v.changes, [], "a new language has no history");
  assert.equal(v.published, null, "nor pages on the shop");
  // another store view of the language when the language has one (fr-FR)
  assert.equal(translatedView(src, french(), "FR", "fr-FR").sections[0].body, "Voir les [joints EPDM](/fr-FR/o-ringe-epdm).");
  assert.match(translatedLine(v, { FR: "French" }), /^Translated into French - a tab of its own: 2 sections, 1 question,.*store view fr-CH/);

  // into the post: a tab of its own, the post's own language untouched
  const doc = withVersion(raw(), "FR", v);
  assert.deepEqual(languagesOf(doc), ["DE", "FR"]);
  const de = versionIn(doc, "DE");
  const { langs: _l, ...deOnly } = de;
  assert.deepEqual(deOnly, blogDoc(raw()), "the German post as it was");
  const fr = versionIn(doc, "FR");
  assert.equal(fr.title, "EPDM ou FKM ?");
  assert.equal(fr.author, "Claudio Saraiva", "the author is the post's");
  assert.equal(fr.publishAt, "2026-11-20");
  assert.equal(fr.notes, "Für das Team");
  // stored and read back: the same French post
  const back = blogDoc(JSON.parse(JSON.stringify(doc)));
  assert.deepEqual(versionIn(back, "FR"), fr);
  assert.equal(back.langs?.FR.store, "fr-CH");
  // its words for the library and the review: both languages, each under its code
  assert.match(blogText(versionIn(doc, "FR")), /^# EPDM ou FKM \?/);
});

test("a tab changes its own language only - the pictures are the post's in every language", () => {
  const doc = withVersion(raw(), "FR", translatedView(blogDoc(raw()), french(), "FR"));
  // the French title edited in its tab
  const fr = versionIn(doc, "FR");
  const a = withVersion(doc, "FR", { ...fr, title: "Joint EPDM ou FKM ?", changes: [{ id: 7, text: "Shorter: the title.", at: "2026-11-12T08:00:00Z" }] });
  assert.equal(versionIn(a, "FR").title, "Joint EPDM ou FKM ?");
  assert.equal(versionIn(a, "DE").title, "EPDM oder FKM?");
  assert.deepEqual(versionIn(a, "FR").changes?.map((c) => c.id), [7], "its own changes");
  assert.deepEqual(versionIn(a, "DE").changes?.map((c) => c.id), [5]);
  // the German title edited: the French stays
  const b = withVersion(a, "DE", { ...versionIn(a, "DE"), title: "EPDM oder FKM bei Dampf?" });
  assert.equal(versionIn(b, "FR").title, "Joint EPDM ou FKM ?");
  assert.equal(b.langs?.FR.title, "Joint EPDM ou FKM ?");
  // a picture made in the French tab is the post's: the German shows it too, at the same place
  const c = withVersion(b, "FR", { ...versionIn(b, "FR"), sections: versionIn(b, "FR").sections.map((s) => (s.id === "b" ? { ...s, image: { ...s.image, url: "/api/content/picture/14-ijkl" } } : s)) });
  assert.equal(versionIn(c, "DE").sections[1].image.url, "/api/content/picture/14-ijkl");
  assert.equal(versionIn(c, "DE").sections[1].image.alt, "", "what it shows stays each language's own");
  // ... and the post's picture changed in German shows in French
  const e = withVersion(c, "DE", { ...versionIn(c, "DE"), hero: { ...versionIn(c, "DE").hero, url: "/api/content/picture/15-mnop" } });
  assert.equal(versionIn(e, "FR").hero.url, "/api/content/picture/15-mnop");
  assert.equal(versionIn(e, "FR").hero.alt, "Des joints toriques sur un établi");
  // the day set in a tab is the post's
  assert.equal(versionIn(withVersion(e, "FR", { ...versionIn(e, "FR"), publishAt: "2026-12-01" }), "DE").publishAt, "2026-12-01");
  // the post's own language does not turn into one it has a tab for
  assert.equal(withVersion(e, "DE", { ...versionIn(e, "DE"), language: "FR" }).language, "DE");
  // a section the French tab has and the German not keeps its own picture
  const f = withVersion(e, "FR", { ...versionIn(e, "FR"), sections: [...versionIn(e, "FR").sections, { id: "z", heading: "Nouveau", body: "Texte.", quote: "", image: { url: "/api/content/picture/16-qrst", alt: "", caption: "", prompt: "" } }] });
  assert.equal(versionIn(f, "FR").sections[2].image.url, "/api/content/picture/16-qrst");
  assert.equal(versionIn(f, "DE").sections.length, 2);
  // a language's pages found on the shop: its own record
  const g = withVersion(f, "FR", { ...versionIn(f, "FR"), published: { at: "2026-11-12T09:00:00Z", by: "SARCLA", pages: [{ label: "The post", path: "/fr-CH/blog/epdm-ou-fkm", url: "https://www.apsoparts.com/fr-CH/blog/epdm-ou-fkm" }] } });
  assert.deepEqual(liveLanguages(g), ["DE", "FR"]);
  assert.equal(versionIn(g, "DE").published?.pages[0].path, "/de-CH/blog/epdm-oder-fkm");
});

test("a tab taken out: the post's own language stays, an older shape comes back", () => {
  const one = withVersion(raw(), "FR", translatedView(blogDoc(raw()), french(), "FR"));
  const two = withVersion(one, "IT", translatedView(versionIn(one, "FR"), {
    ...french(), title: "EPDM o FKM?", slug: "epdm-o-fkm",
    // the AI keeps the links of the post it translates: the French ones
    sections: french().sections.map((x) => ({ ...x, body: x.body.replace("/de-CH/", "/fr-CH/") })),
  }, "IT"));
  assert.deepEqual(languagesOf(two), ["DE", "FR", "IT"]);
  assert.equal(versionIn(two, "IT").sections[0].id, "a", "made from the French tab: the same sections, the same pictures");
  assert.equal(versionIn(two, "IT").store, "it-CH");
  assert.equal(versionIn(two, "IT").sections[0].body, "Voir les [joints EPDM](/it-CH/o-ringe-epdm).", "the French links moved to the Italian store view");
  const less = withoutLanguage(two, "FR");
  assert.deepEqual(languagesOf(less), ["DE", "IT"]);
  const none = withoutLanguage(less, "IT");
  assert.equal("langs" in none, false, "the last one out: no key");
  assert.deepEqual(none, blogDoc(raw()));
  assert.deepEqual(withoutLanguage(two, "DE"), blogDoc(two), "never the post's own language");
  // a stored language that is the post's own, or no language code, is not one
  assert.deepEqual(languagesOf({ ...raw(), langs: { DE: { title: "x" }, fr: { title: "y" }, "FR-CH": {}, IT: "z" } }), ["DE"]);
});

test("a translation is read against the shop's word rules: every text of it, the author's role and the topics too", () => {
  // the post it is made from (the German tab): no FDA in it
  const sources = blogText(blogDoc(raw()));
  const answer = {
    ...french(),
    excerpt: "Tout dépend du fluide. Toutes les tailles sont disponibles en stock.",
    sections: [
      { ...french().sections[0], body: "L'EPDM résiste à l'eau chaude. Livraison le lendemain dans toute la Suisse.\n\n- vapeur\n- dès 12 € la pièce", image: { url: "", alt: "Un joint à 3 CHF", caption: "Après 2000 heures", prompt: "" } },
      { ...french().sections[1], heading: "", body: "Disponible en stock." },
    ],
    faq: [{ id: "q1", q: "Est-il alimentaire ?", a: "Nos joints toriques sont certifiés FDA." }, { id: "q2", q: "Et la norme ?", a: "La norme ISO 3601 fixe les dimensions." }],
    cta: { title: "Dans la boutique", text: "Une remise de 20 % sur tous les joints.", label: "Vers la boutique" },
    authorRole: "Chef de produit - livraison en 24 heures", tags: ["Joints toriques", "En stock"],
    heroCaption: "Dans la laiterie", pictureAlt: "Des joints toriques sur un établi",
  };
  const g = guardOutline(answer, sources);
  assert.equal(g.x.excerpt, "Tout dépend du fluide.");
  assert.equal(g.x.sections.length, 1, "a section left with no heading and no text goes");
  assert.equal(g.x.sections[0].body, "L'EPDM résiste à l'eau chaude.\n\n- vapeur");
  assert.equal(g.x.sections[0].image.alt, "", "what a picture shows: a price goes");
  assert.equal(g.x.sections[0].image.caption, "Après 2000 heures");
  assert.deepEqual(g.x.faq.map((f) => f.q), ["Et la norme ?"], "a certificate claimed for us that the post never named goes; a norm stays");
  assert.equal(g.x.cta.text, "", "a discount value goes");
  assert.equal(g.x.authorRole, "", "the author's role too");
  assert.deepEqual(g.x.tags, ["Joints toriques"], "and a topic");
  assert.equal(g.x.title, "EPDM ou FKM ?");
  assert.ok(g.said.length >= 8, `said: ${g.said.join(" | ")}`);
  assert.ok(g.said.some((s) => /FDA claimed for us/.test(s)));
  // the same claim stays when the post it is made from names it
  const fromFda = guardOutline(answer, `${sources}\nUnsere Dichtungen sind FDA-konform.`);
  assert.deepEqual(fromFda.x.faq.map((f) => f.q), ["Est-il alimentaire ?", "Et la norme ?"]);
  // the guarded answer becomes the tab as any translation does
  const v = translatedView(blogDoc(raw()), g.x, "FR");
  assert.equal(v.sections[0].id, "a");
  assert.equal(v.authorRole, "Produktmanager Dichtungen", "a role left out: the post's own stays until it is translated by hand");
});

test("the Content library lists the post's languages, and each language's pages on the shop", async () => {
  const row = (doc: Record<string, unknown>): LibraryDbRow => ({
    piece_id: 98, kind: "blog", project_id: 30, project: "Food seals", title: "To-do 98", status: "approved", language: "DE", content_type: "blog-article",
    writer: "SARCLA", reviewer: "CLAUDIO", updated_at: "2026-11-12T08:00:00Z", updated_by: "SARCLA", live_event: null, doc, first_pic: null, on_pages: null,
  } as unknown as LibraryDbRow);
  const old = libraryItem(row({ title: "EPDM oder FKM?", slug: "epdm-oder-fkm", store: "de-CH", language: "DE", published: raw().published }))!;
  assert.deepEqual(old.languages, ["DE"]);
  assert.deepEqual(old.where.map((w) => w.label), ["On the shop"], "an older post: as before");
  const fr = { store: "fr-CH", published: { at: "2026-11-12T09:00:00Z", by: "SARCLA", pages: [{ label: "The post", path: "/fr-CH/blog/epdm-ou-fkm", url: "https://www.apsoparts.com/fr-CH/blog/epdm-ou-fkm" }] } };
  const both = libraryItem(row({ title: "EPDM oder FKM?", slug: "epdm-oder-fkm", store: "de-CH", language: "DE", published: raw().published, langs: { FR: fr, IT: { store: "it-CH" } } }))!;
  assert.deepEqual(both.languages, ["DE", "FR", "IT"]);
  assert.deepEqual(both.where.map((w) => `${w.label} ${w.links[0].url}`), [
    "On the shop · DE https://www.apsoparts.com/de-CH/blog/epdm-oder-fkm", "On the shop · FR https://www.apsoparts.com/fr-CH/blog/epdm-ou-fkm",
  ]);

  // the server's read (on PGlite): each language's store view and record only - never its words
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE apsomh_content_projects (id INTEGER PRIMARY KEY, title TEXT, created_by TEXT, status TEXT DEFAULT 'draft', deleted_at TIMESTAMPTZ);
      CREATE TABLE apsomh_content_project_members (project_id INTEGER, username TEXT, role TEXT);
      CREATE TABLE apsomh_content_pieces (id INTEGER PRIMARY KEY, project_id INTEGER, title TEXT, status TEXT, language TEXT, content_type TEXT, writer TEXT, reviewer TEXT);
      CREATE TABLE apsomh_content_piece_docs (piece_id INTEGER PRIMARY KEY, kind TEXT, doc JSONB, updated_at TIMESTAMPTZ, updated_by TEXT);
      CREATE TABLE apsomh_content_events (id SERIAL PRIMARY KEY, project_id INTEGER, piece_id INTEGER, actor TEXT, kind TEXT, detail JSONB, created_at TIMESTAMPTZ DEFAULT NOW());
      INSERT INTO apsomh_content_projects VALUES (30, 'Food seals', 'SARCLA', 'draft', NULL);
      INSERT INTO apsomh_content_pieces VALUES (98, 30, 'To-do 98', 'approved', 'DE', 'blog-article', 'SARCLA', 'CLAUDIO'), (99, 30, 'To-do 99', 'approved', 'DE', 'blog-article', 'SARCLA', 'CLAUDIO');
    `);
    const doc = withVersion(raw(), "FR", { ...translatedView(blogDoc(raw()), french(), "FR"), published: fr.published });
    await db.query("INSERT INTO apsomh_content_piece_docs VALUES (98, 'blog', $1, NOW(), 'SARCLA'), (99, 'blog', $2, NOW(), 'SARCLA')", [JSON.stringify(doc), JSON.stringify(raw())]);
    const rows = (await db.query<LibraryDbRow>(libraryQuery(true), ["ADMIN", PICTURE_RE])).rows;
    const items = libraryItems(rows);
    const two = items.find((i) => i.pieceId === 98)!;
    assert.deepEqual(two.languages, ["DE", "FR"]);
    assert.deepEqual(two.where.map((w) => w.label), ["On the shop · DE", "On the shop · FR"]);
    assert.ok(!JSON.stringify(rows.find((r) => r.piece_id === 98)!.doc).includes("Voir les"), "a language's words never travel");
    const one = items.find((i) => i.pieceId === 99)!;
    assert.deepEqual(one.languages, ["DE"]);
    assert.deepEqual(one.where.map((w) => w.label), ["On the shop"]);
  } finally {
    await db.close();
  }
});

// a type check: a view is a post
const _view: BlogDoc = versionIn(raw(), "FR");
void _view;
