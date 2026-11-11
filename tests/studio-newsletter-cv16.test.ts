import assert from "node:assert/strict";
import { test } from "node:test";
import { pageDoc, type MagentoRecord } from "../src/lib/content/studio/kinds/page/model";
import { SHOP_FACTS, applyDraft, asNewsletter, emptyNewsletter, extraBlocks, newBlock, wordsOf, type Block, type NewsletterDoc } from "../src/lib/content/studio/kinds/newsletter/model";
import {
  draftProgress, draftRows, followLanguage, languagesOf, linksByLanguage, makeAllOf, refusalSaid, retryLangs, translationBase, versionIn, versionSig,
  withVersion, withoutLanguage,
} from "../src/lib/content/studio/kinds/newsletter/langs";
import { guardDraft, guardEdits, guardWords } from "../src/lib/content/studio/kinds/newsletter/guard";
import { elementOf, itemOrder, linkInLanguages, orderItem, takeOut, withLink } from "../src/lib/content/studio/kinds/newsletter/elements";
import { fileNameOf } from "../src/lib/content/studio/kinds/newsletter/ourEmails";
import { pageLinkRow, type PageLinkRow } from "../src/lib/content/studio/kinds/newsletter/pageLinks";
import { libraryItem, stateWord, type LibraryDbRow } from "../src/lib/content/library";

// cv16 (SARCLA 11.11.2026 ~18:25: "compare the evolution of this page [the Page builder] to the other content types'
// generators, and improve them"): the newsletter's languages as versions of their own, the shop's word rules on every AI
// text, the element card's link / take out / order, the last step's drafts per language. Made-up e-mails only.

const B = "https://www.apsoparts.com";

function german(): NewsletterDoc {
  const d = emptyNewsletter("DE");
  let n = 0;
  const blocks = d.blocks.map((b): Block => {
    if (b.kind === "hero") return { ...b, id: "hero", eyebrow: "Lebensmittel", headline: "Dichtungen für die Lebensmittelindustrie", text: "Was zählt.", imageUrl: "/api/content/picture/12-abcdefabcdefabcdef", imageAlt: "O-Ringe", button: { label: wordsOf("DE").discover, url: `${B}/de-CH/dichtungen-lebensmittel` } };
    if (b.kind === "article") { n += 1; return { ...b, id: `s${n}`, title: `Story ${n}`, text: "Text.", link: { label: wordsOf("DE").more, url: `${B}/de-CH/o-ringe.html` } }; }
    if (b.kind === "cta") return { ...b, id: "cta" };
    return b;
  });
  return { ...d, subject: "Dichtungen für Lebensmittel", preheader: "Konforme Werkstoffe", blocks: [...blocks.slice(0, -1), { ...newBlock("facts", "facts", "DE") }, blocks[blocks.length - 1]] };
}

const rec = (env: "prod" | "acc", store: string, identifier: string): MagentoRecord => ({ env, store, pageId: "1", identifier, action: "created", at: "2026-11-10T16:00:00Z", by: "sarcla", backupId: "1", url: "" });
const ROWS: PageLinkRow[] = [pageLinkRow(pageDoc({
  source: "new", env: "prod", store: "de-CH", stores: ["de-CH"], fields: { hero: { title: "Dichtungen" }, seo: { urlKey: "dichtungen-lebensmittel" } },
  langs: { "fr-CH": { store: "fr-CH", stores: ["fr-CH"], fields: { hero: { title: "Joints" }, seo: { urlKey: "joints-alimentaires" } } } },
  magento: [rec("prod", "fr-CH", "joints-alimentaires"), rec("prod", "de-CH", "dichtungen-lebensmittel")],
}, null), { pieceId: 41, projectId: 7, project: "Food", todo: "Page", status: "approved", updatedAt: "2026-11-10T16:00:00Z" })!];

test("a language is a version of its own: kept, read, written back, taken out", () => {
  const de = german();
  const fr = { ...translationBase(de, "FR"), subject: "Joints alimentaires" };
  const both = withVersion(de, "FR", fr);
  assert.deepEqual(languagesOf(both), ["DE", "FR"]);
  // the top level stays the German e-mail; the French one is its own
  assert.equal(both.subject, "Dichtungen für Lebensmittel");
  assert.equal(versionIn(both, "FR").subject, "Joints alimentaires");
  assert.equal(versionIn(both, "FR").language, "FR");
  assert.equal(versionIn(both, "IT").subject, "Dichtungen für Lebensmittel", "a language it has not: its own e-mail");
  // stored and read again (asNewsletter keeps the versions; never the own language twice)
  const read = asNewsletter(JSON.parse(JSON.stringify({ ...both, langs: { ...both.langs, DE: both.langs!.FR } })));
  assert.deepEqual(Object.keys(read.langs ?? {}), ["FR"]);
  // a change in the French tab goes to the French e-mail only
  const changed = withVersion(read, "FR", { ...versionIn(read, "FR"), preheader: "Matériaux conformes" });
  assert.equal(versionIn(changed, "FR").preheader, "Matériaux conformes");
  assert.equal(changed.preheader, "Konforme Werkstoffe");
  // the own language's tab keeps the other languages
  const own = withVersion(changed, "DE", { ...versionIn(changed, "DE"), subject: "Neu" });
  assert.equal(own.subject, "Neu");
  assert.equal(versionIn(own, "FR").preheader, "Matériaux conformes");
  assert.deepEqual(languagesOf(withoutLanguage(own, "FR")), ["DE"]);
  assert.equal(withoutLanguage(own, "FR").langs, undefined);
});

test("a translation takes along what follows the language: our facts and footer, the default buttons, a Page builder page's address", () => {
  const de = german();
  const words = translationBase(de, "FR");
  // the AI translated the words (here: the headline), the facts too - the brand's own figures win
  const translated: NewsletterDoc = { ...words, blocks: words.blocks.map((b) => (b.kind === "hero" ? { ...b, headline: "Des joints" } : b.kind === "facts" ? { ...b, items: b.items.map((x) => ({ ...x, label: "traduit" })) } : b)) };
  const { doc, moved } = followLanguage(de, translated, ROWS);
  const hero = doc.blocks.find((b) => b.kind === "hero") as Extract<Block, { kind: "hero" }>;
  assert.equal(hero.headline, "Des joints");
  assert.equal(hero.button.label, wordsOf("FR").discover);
  assert.equal(hero.button.url, `${B}/fr-CH/joints-alimentaires`, "the Page builder's page, in fr-CH");
  const story = doc.blocks.find((b) => b.kind === "article") as Extract<Block, { kind: "article" }>;
  assert.equal(story.link.url, `${B}/de-CH/o-ringe.html`, "another address of the shop is never guessed");
  assert.equal(story.link.label, wordsOf("FR").more);
  assert.deepEqual((doc.blocks.find((b) => b.kind === "facts") as Extract<Block, { kind: "facts" }>).items, SHOP_FACTS.FR);
  assert.equal((doc.blocks.find((b) => b.kind === "footer") as Extract<Block, { kind: "footer" }>).text, wordsOf("FR").footer);
  assert.equal(moved, 1);
  assert.equal(doc.hubspot, undefined, "no draft of its own yet");
});

test("the shop's word rules on AI text: stock and delivery promises, prices, unnamed certificates out; HubSpot's tokens and our facts kept", () => {
  const said: string[] = [];
  const t = guardWords("{{ contact.salutation_phrase }} {{ contact.lastname }},\nunsere O-Ringe sind ab Lager lieferbar. Sie sind FDA-konform. Wir beraten Sie gern.\n\n**Neu:** der Zuschnitt in 24 h.", "", said, "DE");
  assert.match(t, /\{\{ contact\.salutation_phrase \}\} \{\{ contact\.lastname \}\}/);
  assert.doesNotMatch(t, /ab Lager|FDA|24 h/);
  assert.match(t, /Wir beraten Sie gern\./);
  assert.ok(said.length >= 3, said.join(" | "));
  // a certificate the brief names stays
  assert.match(guardWords("Werkstoffe nach FDA.", "FDA conform materials", [], "DE"), /FDA/);
  const de = german();
  const g = guardEdits({ subject: "Jetzt 20 % Rabatt", preheader: "", blocks: [
    { id: "facts", fields: [{ name: "item2Big", value: "48/72 h" }, { name: "item2Label", value: "Lieferung in Europa ab Lager" }] },
    { id: "hero", fields: [{ name: "headline", value: "Ab Lager in 24 h." }, { name: "text", value: "Was zählt, ist die Dichtung." }] },
  ] }, de, "");
  assert.equal(g.edits.subject, "", "a discount subject is not offered");
  assert.deepEqual(g.edits.blocks[0].fields.map((f) => f.value), ["48/72 h", "Lieferung in Europa ab Lager"], "the shop's facts are the brand's");
  assert.deepEqual(g.edits.blocks[1].fields.map((f) => f.name), ["text"], "a headline the rules emptied keeps its words");
  assert.ok(g.left.length >= 2);
  const d = guardDraft({ subject: "Neu im Shop", preheader: "", eyebrow: "", headline: "Sofort lieferbar.", lead: "Gut.", button: "Ansehen", stories: [{ title: "Preis", text: "Nur CHF 12.", link: "Mehr" }], cta: "", ctaButton: "" }, "", "DE");
  assert.equal(d.answer.headline, "");
  assert.equal(d.answer.stories.length, 1);
  assert.equal(d.answer.stories[0].text, "");
});

test("Write it all again writes the blocks the person added too - never a product's own name", () => {
  const de = german();
  const more: NewsletterDoc = { ...de, blocks: [...de.blocks, { ...newBlock("text", "t2", "DE"), text: "Zweiter Text" } as Block, { id: "p1", kind: "products", title: "", items: [{ name: "O-Ring 10x2", text: "", imageUrl: "", url: "" }, { name: "", text: "", imageUrl: "", url: "" }] } as Block] };
  const extra = extraBlocks(more);
  assert.deepEqual(extra.map((x) => x.id), ["t2", "p1"]);
  assert.deepEqual(extra[1].fields.map((f) => f.name), ["title", "item1Text"]);
  const out = applyDraft(more, { subject: "S", preheader: "P", eyebrow: "", headline: "H", lead: "L", button: "", stories: [], cta: "", ctaButton: "", intro: "Intro",
    extra: [{ id: "t2", fields: [{ name: "text", value: "Neu geschrieben" }] }, { id: "p1", fields: [{ name: "title", value: "Unsere O-Ringe" }, { name: "item1Name", value: "Erfunden" }] }] });
  assert.equal((out.blocks.find((b) => b.id === "t2") as Extract<Block, { kind: "text" }>).text, "Neu geschrieben");
  const p = out.blocks.find((b) => b.id === "p1") as Extract<Block, { kind: "products" }>;
  assert.equal(p.title, "Unsere O-Ringe");
  assert.equal(p.items[0].name, "O-Ring 10x2");
});

test("one element: its link, Take it out, a product's order, its link in every language", () => {
  const de = german();
  const el = elementOf(de, "hero:button");
  assert.equal(el?.kind, "button");
  assert.equal(el?.label, "Lead story · button");
  assert.equal(el?.url, `${B}/de-CH/dichtungen-lebensmittel`);
  assert.equal(elementOf(de, "hero:image")?.kind, "picture");
  assert.equal(elementOf(de, "gone:text"), null);
  const linked = withLink(de, "hero:button", `${B}/de-CH/neu`);
  assert.equal(elementOf(linked, "hero:button")?.url, `${B}/de-CH/neu`);
  assert.equal(takeOut(de, "hero:headline"), null, "a headline cannot go");
  assert.equal((takeOut(de, "hero:eyebrow")!.doc.blocks.find((b) => b.id === "hero") as Extract<Block, { kind: "hero" }>).eyebrow, "");
  const withProducts: NewsletterDoc = { ...de, blocks: [...de.blocks, { id: "p1", kind: "products", title: "T", items: [{ name: "A", text: "", imageUrl: "", url: `${B}/de-CH/a.html` }, { name: "B", text: "", imageUrl: "", url: "" }] }] };
  assert.deepEqual(itemOrder(withProducts, "p1:item1Name"), { dup: true, up: false, down: true });
  const moved = orderItem(withProducts, "p1:item1Name", 1)!;
  assert.equal(moved.key, "p1:item2Name");
  assert.deepEqual((moved.doc.blocks.find((b) => b.id === "p1") as Extract<Block, { kind: "products" }>).items.map((x) => x.name), ["B", "A"]);
  assert.equal((orderItem(withProducts, "p1:item2Name", "dup")!.doc.blocks.find((b) => b.id === "p1") as Extract<Block, { kind: "products" }>).items.length, 3);
  const fr = followLanguage(de, translationBase(de, "FR"), ROWS).doc;
  assert.deepEqual(linkInLanguages(withVersion(de, "FR", fr), "hero:button"), [{ lang: "DE", url: `${B}/de-CH/dichtungen-lebensmittel` }, { lang: "FR", url: `${B}/fr-CH/joints-alimentaires` }]);
});

test("the last step: one draft per language - none, up to date, changed since - and what Make the drafts makes", () => {
  const de = { ...german(), startedFrom: { emailId: "1", subject: "x", language: "DE", date: "" } };
  const fr = followLanguage(de, { ...translationBase(de, "FR"), subject: "Joints" }, ROWS).doc;
  let doc = withVersion(de, "FR", fr);
  let rows = draftRows(doc, ROWS);
  assert.deepEqual(rows.map((r) => [r.lang, r.state]), [["DE", "none"], ["FR", "none"]]);
  assert.deepEqual(makeAllOf(rows), { langs: ["DE", "FR"], label: "Make 2 drafts (DE, FR)", why: null });
  // the German draft made from these words
  doc = withVersion(doc, "DE", { ...versionIn(doc, "DE"), hubspot: { emailId: "9", url: "https://app-eu1.hubspot.com/email/1/edit/9/content", at: "2026-11-11T18:00:00Z", sig: versionSig(versionIn(doc, "DE")) } });
  rows = draftRows(doc, ROWS);
  assert.deepEqual(rows.map((r) => r.state), ["same", "none"]);
  assert.equal(makeAllOf(rows).label, "Make the FR draft");
  // its words changed since
  doc = withVersion(doc, "DE", { ...versionIn(doc, "DE"), subject: "Anders" });
  assert.equal(draftRows(doc, ROWS)[0].state, "changed");
  // a language with no subject is not made - said why
  const blocked = withVersion(doc, "FR", { ...versionIn(doc, "FR"), subject: "" });
  const all = makeAllOf(draftRows(blocked, ROWS));
  assert.deepEqual(all.langs, ["DE"]);
  assert.equal(all.label, "Update the DE draft");
  assert.equal(draftProgress("FR", 2, 3), "Making the FR draft in HubSpot · 2 of 3…");
  assert.deepEqual(retryLangs([{ lang: "DE", ok: true }, { lang: "FR", ok: false }]), ["FR"]);
  // the links of every language, each where it leads
  const links = linksByLanguage(doc, ROWS);
  assert.equal(links[1].store, "fr-CH");
  assert.equal(links[1].links.find((l) => l.where === "Story 1")?.line, "This address is in de-CH - the newsletter is in French (fr-CH)");
});

test("a HubSpot refusal in plain words; a picture's file named from what it shows", () => {
  assert.equal(refusalSaid("HubSpot: <!doctype html><html><head><title>403 Forbidden</title></head><body>x</body></html>", 403),
    "HubSpot with a web page (“403 Forbidden”) instead of its answer - the hub's HubSpot app may not write marketing e-mails (ask an admin)");
  assert.equal(refusalSaid("HubSpot: Property values were not valid", 400), "HubSpot: Property values were not valid");
  assert.match(refusalSaid("HubSpot: You have reached your secondly limit.", 429), /try again in a minute/);
  assert.equal(fileNameOf("O-Ringe für die Lebensmittelindustrie, nah", "12", "jpg"), "o-ringe-fur-die-lebensmittelindustrie-nah-12.jpg");
  assert.equal(fileNameOf("", "12", "png"), "apsohub-12.png");
});

test("the Content library's card: every language, each language's HubSpot draft", () => {
  const row: LibraryDbRow = {
    piece_id: 95, project_id: 12, project: "Food", title: "Newsletter", status: "review", language: "DE", content_type: "newsletter", kind: "newsletter",
    writer: "SARCLA", reviewer: null, updated_at: "2026-11-11T18:00:00.000Z", updated_by: "SARCLA", live_event: null, first_pic: null, on_pages: null,
    doc: { subject: "Dichtungen", preheader: "Konform", language: "DE", hubspot: { emailId: "11", url: "https://app-eu1.hubspot.com/email/26492587/edit/11/content", at: "2026-11-11T17:00:00.000Z" },
      langs: { FR: { hubspot: { emailId: "12", url: "https://app-eu1.hubspot.com/email/26492587/edit/12/content", at: "2026-11-11T18:00:00.000Z" } }, IT: {} } },
  };
  const nl = libraryItem(row)!;
  assert.deepEqual(nl.languages, ["DE", "FR", "IT"]);
  assert.deepEqual(nl.where.map((w) => w.label), ["HubSpot draft · DE", "HubSpot draft · FR"]);
  assert.equal(nl.where[1].links[0].label, "E-mail 12");
  assert.equal(stateWord(nl), "HubSpot draft");
});
