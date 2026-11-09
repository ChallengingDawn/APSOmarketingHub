import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addItem, emptyFields, fieldKind, fieldLabel, fieldPictures, fieldStrings, filledCount, getField, moveItem, normalizeFields, removeItem, setField,
  setLook, withFieldStrings,
} from "../src/lib/content/studio/kinds/page/fields";
import { cleanFill, mergeFill } from "../src/lib/content/studio/kinds/page/fill";
import { renderNewPage, wordsHtml } from "../src/lib/content/studio/kinds/page/newpage";
import {
  changeStrings, counterpartIn, emptyPage, hasContent, langState, leftoversIn, leftoversOf, pageDoc, pageText, sourceHash, storeForLanguage,
  tagSkeleton, viewOf, withChangeStrings, withView,
} from "../src/lib/content/studio/kinds/page/model";
import { applyChanges, replaceTop } from "../src/lib/content/studio/kinds/page/apply";

// The page studio as a CMS (SARCLA 08.11.2026): a new page made of fields, filled by the AI part by part, drawn in the
// shop's look; one page in several languages; no placeholder ever left unseen; a click in the preview finds its change.

const filled = () => {
  let f = emptyFields();
  f = { ...f, hero: { ...f.hero, title: "O-Ringe für Lebensmittel", sub: "Für hygienische Leitungen.", button: { label: "Zu den O-Ringen", url: "/de-CH/o-ringe.html" }, picture: { url: "/api/content/picture/12-abc", alt: "Eine Dichtung", idea: "a seal" } } };
  const b = addItem(f, "benefits"); f = setField(b.fields, `benefits.${b.id}.title`, "Werkstoff statt Ratespiel");
  const s = addItem(f, "sections"); f = setField(s.fields, `sections.${s.id}.text`, "Erster Absatz.\n\nZweiter Absatz.\n- eins\n- zwei");
  return { f, benefit: b.id, section: s.id };
};

test("fields: read from anything, a value set and read by its path, list items by their id", () => {
  const n = normalizeFields({ hero: { title: "T", picture: { url: "javascript:alert(1)" } }, benefits: [{ id: "ab12", title: "x" }, "nope"], looks: { "hero.title": { size: "l", bogus: 1 }, "x y": { size: "s" } } });
  assert.equal(n.hero.title, "T");
  assert.equal(n.hero.picture.url, "", "a javascript: address is no picture");
  assert.equal(n.benefits.length, 1);
  assert.deepEqual(n.looks, { "hero.title": { size: "l" } });
  const { f, benefit, section } = filled();
  assert.equal(getField(f, `benefits.${benefit}.title`), "Werkstoff statt Ratespiel");
  assert.equal(getField(setField(f, "hero.button.label", "Los"), "hero.button.label"), "Los");
  assert.equal(setField(f, "nope.deep", "x"), f, "an unknown path changes nothing");
  assert.equal(fieldKind("hero.picture"), "picture");
  assert.equal(fieldKind(`sections.${section}.text`), "long");
  assert.equal(fieldLabel(f, `sections.${section}.text`), "Section 1 · text");
  assert.equal(filledCount(emptyFields()), 0);
  assert.ok(filledCount(f) >= 3);
  assert.deepEqual(fieldPictures(f).map((p) => p.path), ["hero.picture"]);
});

test("fields: items added, moved, removed - their looks go with them", () => {
  let { f } = filled();
  const a = addItem(f, "faq"); f = a.fields;
  const b = addItem(f, "faq"); f = b.fields;
  f = setLook(f, `faq.${a.id}`, { bg: "grey" });
  assert.deepEqual(moveItem(f, "faq", b.id, -1).faq.map((x) => x.id), [b.id, a.id]);
  const gone = removeItem(f, "faq", a.id);
  assert.deepEqual(gone.faq.map((x) => x.id), [b.id]);
  assert.equal(gone.looks[`faq.${a.id}`], undefined);
  assert.deepEqual(setLook(setLook(f, "hero.title", { size: "l" }), "hero.title", { size: undefined }).looks["hero.title"], undefined);
});

test("the words of a page, out for a translation and back in - addresses never touched", () => {
  const { f, section } = filled();
  const items = fieldStrings(f);
  assert.ok(items.some((x) => x.id === "hero.title"));
  assert.ok(!items.some((x) => /url/.test(x.id)), "no address is a word to translate");
  const back = withFieldStrings(f, [{ id: "hero.title", text: "Joints toriques" }, { id: "hero.button.url", text: "/evil" }, { id: `sections.${section}.text`, text: "Premier." }]);
  assert.equal(back.hero.title, "Joints toriques");
  assert.equal(back.hero.button.url, "/de-CH/o-ringe.html");
  assert.equal(back.hero.picture.url, f.hero.picture.url, "the pictures stay");
});

test("the AI's answer: words capped, addresses only from the offered pages, pictures and looks kept", () => {
  const { f, section } = filled();
  const raw = {
    summary: "A page.",
    hero: { eyebrow: "Lebensmittel", title: "Neue Überschrift", sub: "Neu.", button: { label: "Los", url: "/de-CH/invented.html" }, pictureIdea: "hands on a seal", pictureAlt: "Hände" },
    sections: { items: [{ title: "Eins", text: "Text eins", pictureIdea: "x", pictureAlt: "y" }, { title: "Zwei", text: "Text zwei", pictureIdea: "", pictureAlt: "" }] },
    links: { title: "Weiter", items: [{ url: "/de-CH/o-ringe.html", label: "O-Ringe", note: "" }, { url: "/de-CH/made-up.html", label: "X", note: "" }] },
    seo: { title: "T", description: "D", urlKey: "O-Ringe Für Lebensmittel" },
  };
  const { answer, leftovers } = cleanFill(raw, [{ url: "/de-CH/o-ringe.html", name: "o ringe", kind: "category" }]);
  assert.deepEqual(leftovers, []);
  assert.equal(answer.hero!.button.url, "", "an address the server did not offer is dropped");
  assert.equal(answer.links!.items.length, 1);
  assert.equal(answer.seo!.urlKey, "o-ringe-fur-lebensmittel");
  const looked = setLook(f, `sections.${section}.title`, { color: "red" });
  const m = mergeFill(looked, answer);
  assert.equal(m.hero.title, "Neue Überschrift");
  assert.equal(m.hero.button.url, "/de-CH/o-ringe.html", "the person's own link stays when the AI has none");
  assert.equal(m.hero.picture.url, "/api/content/picture/12-abc", "the person's picture stays");
  assert.equal(m.hero.picture.idea, "hands on a seal");
  assert.equal(m.sections.length, 2);
  assert.equal(m.sections[0].id, section, "the first section keeps its id (and its look)");
  assert.deepEqual(m.looks[`sections.${section}.title`], { color: "red" });
  assert.ok(cleanFill({ intro: "[Intro paragraph part 1 in German]" }, []).leftovers.length === 1, "a placeholder in an answer is seen");
});

test("a new page drawn: the shop's look, every element knows its field in the preview, nothing of that for Magento", () => {
  const { f, section } = filled();
  const prev = renderNewPage(f, { marks: true, inserts: [{ id: "b1", where: "after-intro", html: "<div>BANNER</div>" }] });
  assert.match(prev.html, /<h1 class="apx-np-h1" data-apx-f="hero.title">O-Ringe für Lebensmittel<\/h1>/);
  assert.match(prev.html, new RegExp(`data-apx-b="sections.${section}"`));
  assert.match(prev.html, /data-apx-insert="b1"><div>BANNER<\/div>/);
  assert.match(prev.html, /class="apx-np-slot"[^>]*data-apx-f="intro"/, "an empty part shows as a slot to click");
  const paste = renderNewPage(f, { picture: (u) => (u.startsWith("/api/") ? '{{media url="wysiwyg/content/apx-12.jpg"}}' : u) });
  assert.doesNotMatch(paste.html, /data-apx|apx-np-slot/);
  assert.match(paste.html, /src="\{\{media url=&quot;wysiwyg\/content\/apx-12.jpg&quot;\}\}"/);
  assert.match(paste.css, /@media \(max-width:767px\)/, "it has its phone layout");
  assert.equal(wordsHtml("A\nB\n\n- x\n- <y>"), "<p>A<br>B</p><ul><li>x</li><li>&lt;y&gt;</li></ul>");
  const looked = renderNewPage(setLook(f, "hero.title", { size: "l", align: "center", color: "red" }));
  assert.match(looked.html, /class="apx-np-h1 apx-np-s-l apx-np-ac apx-np-c-red"/);
});

test("placeholders are found wherever they are - and plain copy is not one", () => {
  assert.deepEqual(leftoversIn("<p>[Intro paragraph part 1 in German]</p>"), ["[Intro paragraph part 1 in German]"]);
  assert.equal(leftoversIn("Lorem ipsum dolor sit amet").length, 1);
  assert.equal(leftoversIn("[Text from Content: why]").length, 1);
  assert.equal(leftoversIn("[XX] und TODO").length, 2);
  assert.deepEqual(leftoversIn("O-Ring [NBR 70], 10 x 2 mm [mm], {{store direct_url='x'}}"), [], "units, material codes and Magento's directives are copy");
  const d = pageDoc({ source: "new", fields: { hero: { title: "[Product name] für Lebensmittel" } }, changes: [{ op: "text", selector: "h1", text: "Lorem ipsum" }] });
  assert.deepEqual(leftoversOf(d).map((x) => x.where), ["hero.title", "change 1"]);
});

test("one page in several languages: each its own view, the main one the document itself", () => {
  const base = pageDoc({ source: "new", store: "de-CH", fields: { hero: { title: "Dichtungen" } } });
  assert.equal(storeForLanguage("en"), "en-INT", "the shop's English store view");
  assert.equal(viewOf(base, "de"), base);
  const fr = viewOf(base, "fr");
  assert.equal(fr.store, "fr-CH");
  assert.equal(fr.fields.hero.title, "", "a language not made yet is empty");
  assert.equal(langState(base, "fr"), "empty");
  const made = withView(base, "fr", { ...fr, fields: { ...fr.fields, hero: { ...fr.fields.hero, title: "Joints" } } });
  made.langs["fr-CH"].from = sourceHash(made);
  assert.equal(made.fields.hero.title, "Dichtungen", "the main language is untouched");
  assert.equal(viewOf(made, "fr").fields.hero.title, "Joints");
  assert.equal(langState(made, "fr"), "done");
  const changed = { ...made, fields: { ...made.fields, hero: { ...made.fields.hero, title: "Dichtungen neu" } } };
  assert.equal(langState(changed, "fr"), "stale", "the main language changed since the translation");
  assert.equal(langState(made, "de"), "main");
  assert.ok(hasContent(viewOf(made, "fr")));
  assert.match(pageText(made), /New page \(FR-CH\): Joints/, "a version is named by its store view");
  const stored = pageDoc(JSON.parse(JSON.stringify(made)));
  assert.equal(stored.langs["fr-CH"].fields.hero.title, "Joints", "a store view survives the round trip");
  assert.deepEqual(emptyPage("DE").langs, {});
});

test("an existing page's changes translated: the words change, the HTML may not", () => {
  const changes = [
    { op: "insert" as const, selector: "h1", where: "after" as const, html: '<div class="apx-a"><p>Schnell <b>geliefert</b></p></div>' },
    { op: "text" as const, selector: ".x", text: "Jetzt bestellen" },
    { op: "attr" as const, selector: "img", name: "alt", value: "Dichtung" },
    { op: "css" as const, css: ".apx-a{color:red}" },
  ];
  const items = changeStrings(changes);
  assert.deepEqual(items.map((x) => x.id), ["c0.html", "c1.text", "c2.value"]);
  const ok = withChangeStrings(changes, [{ id: "c0.html", text: '<div class="apx-a"><p>Livré <b>vite</b></p></div>' }, { id: "c1.text", text: "Commander" }, { id: "c2.value", text: "Joint" }]);
  assert.deepEqual(ok.problems, []);
  assert.equal((ok.changes[0] as { html: string }).html, '<div class="apx-a"><p>Livré <b>vite</b></p></div>');
  assert.equal((ok.changes[1] as { text: string }).text, "Commander");
  const bad = withChangeStrings(changes, [{ id: "c0.html", text: "<div><p>Livré vite</p></div>" }]);
  assert.equal(bad.problems.length, 1, "a translation that changed the tags is refused");
  assert.equal((bad.changes[0] as { html: string }).html, changes[0].html);
  assert.equal(tagSkeleton('<p class="b a">x</p>'), tagSkeleton('<p class="a b">y</p>'));
});

test("the same page in another language, from its hreflang links", () => {
  const html = `<link rel="alternate" href="https://www.apsoparts.com/de-CH/dichtungstechnik.html" hreflang="de-CH" />
<link rel="alternate" href="https://www.apsoparts.com/fr-CH/technologie-de-l-etancheite.html" hreflang="fr-CH" />
<link rel="alternate" href="https://www.apsoparts.com/fr-FR/technologie-de-l-etancheite.html" hreflang="fr-FR" />
<link rel="alternate" href="https://www.apsoparts.com/en-INT/sealing-technology.html" hreflang="x-default" />`;
  assert.equal(counterpartIn(html, "fr", "de-CH"), "/fr-CH/technologie-de-l-etancheite.html");
  assert.equal(counterpartIn(html, "fr", "de-FR"), "/fr-FR/technologie-de-l-etancheite.html");
  assert.equal(counterpartIn(html, "en", "de-CH"), "/en-INT/sealing-technology.html", "English is the x-default");
  assert.equal(counterpartIn(html, "it", "de-CH"), null);
});

test("the preview marks what each change wrote or works on, so a click edits that change", () => {
  const page = `<html><head></head><body><main id="maincontent"><h1 class="t">Alt</h1><p class="p">Text</p></main></body></html>`;
  const r = applyChanges(page, [
    { op: "text", selector: "h1.t", text: "Neu" },
    { op: "insert", selector: "p.p", where: "after", html: "<div><b>A</b></div><p>B</p>" },
  ], { marks: [3, 7] });
  assert.match(r.html, /<h1 data-apx-x="3" class="t">Neu<\/h1>/);
  assert.match(r.html, /<div data-apso-v="" data-apx-c="7" data-apx-k="0"><b>A<\/b><\/div><p data-apso-v="" data-apx-c="7" data-apx-k="1">B<\/p>/);
  const plain = applyChanges(page, [{ op: "text", selector: "h1.t", text: "Neu" }]);
  assert.doesNotMatch(plain.html, /data-apx/, "without marks the page is as the shop gets it");
  assert.equal(replaceTop("<div>A</div><p>B</p>", 1, "<p>C</p>"), "<div>A</div><p>C</p>");
  assert.equal(replaceTop("<div>A</div>", 3, "<p>C</p>"), null);
});
