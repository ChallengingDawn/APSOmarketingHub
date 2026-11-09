import assert from "node:assert/strict";
import { test } from "node:test";
import { LIMIT, addItem, emptyFields, setField } from "../src/lib/content/studio/kinds/page/fields";
import { cleanFill } from "../src/lib/content/studio/kinds/page/fill";
import { fitField, fitFields, fitText, limitOf, overLimit } from "../src/lib/content/studio/kinds/page/fit";

// SARCLA's night list (09.11.2026): the AI respects the fields' length limits - never "21 too many". What comes back too
// long is brought within its limit on the server, cut where it reads whole: paragraphs, sentences, a clause, a word.

test("fit: a text that fits is kept as it is (only trimmed)", () => {
  assert.equal(fitText("  Hygienic seals  ", 70), "Hygienic seals");
  assert.equal(fitText("x".repeat(70), 70), "x".repeat(70));
  assert.equal(fitText("anything", null), "anything", "no limit, no cut");
});

test("fit: whole sentences are kept, never half of one", () => {
  const s = "Our O-rings are FDA-conform. They hold in hot water and steam. They are delivered from stock in Switzerland within days.";
  const out = fitText(s, 70);
  assert.ok(out.length <= 70, out);
  assert.equal(out, "Our O-rings are FDA-conform. They hold in hot water and steam.");
});

test("fit: a title is cut at a clause, not in the middle of a word or on a joiner", () => {
  const t = "Hygienische Dichtungen für die Lebensmittelindustrie – FDA-konform und schnell geliefert";
  const out = fitText(t, LIMIT.heroTitle);
  assert.ok(out.length <= LIMIT.heroTitle, `${out.length}`);
  assert.equal(out, "Hygienische Dichtungen für die Lebensmittelindustrie");
  const words = "Joints toriques pour les lignes hygiéniques des usines alimentaires et des brasseries suisses";
  const w = fitText(words, 60);
  assert.ok(w.length <= 60);
  assert.ok(!/\s(et|des|les|pour)$/.test(w), w);
  assert.ok(words.startsWith(w), "only cut, never reworded");
  assert.ok(/\S$/.test(w) && !/[,\-–:]$/.test(w));
});

test("fit: a section's text drops whole paragraphs or list lines first", () => {
  const p = `${"A first paragraph that says what matters. ".repeat(8).trim()}\n\n${"A second one that runs long. ".repeat(20).trim()}`;
  const out = fitText(p, 400);
  assert.ok(out.length <= 400);
  assert.ok(!out.includes("second"), "the second paragraph goes whole");
  const list = `Why order here:\n${Array.from({ length: 20 }, (_, i) => `- Reason number ${i + 1} to order here today`).join("\n")}`;
  const l = fitText(list, 300);
  assert.ok(l.length <= 300);
  assert.ok(l.split("\n").every((line) => line === "Why order here:" || /^- Reason number \d+ to order here today$/.test(line)), "list lines whole");
});

test("fit: the limit of every field by its path", () => {
  assert.equal(limitOf("hero.title"), LIMIT.heroTitle);
  assert.equal(limitOf("hero.button.label"), LIMIT.button);
  assert.equal(limitOf("sections.ab12.text"), LIMIT.sectionText);
  assert.equal(limitOf("sections.ab12.picture.alt"), LIMIT.alt);
  assert.equal(limitOf("faq.q1.a"), LIMIT.faqA);
  assert.equal(limitOf("seo.description"), LIMIT.seoDescription);
  assert.equal(limitOf("seo.urlKey"), null);
  assert.equal(limitOf("hero.button.url"), null);
  assert.ok(fitField("seo.title", "Meta ".repeat(30)).length <= LIMIT.seoTitle);
});

test("fit: the AI's answer comes back within every limit (the whole page)", () => {
  const long = (n: number, word = "Dichtung") => Array.from({ length: n }, () => word).join(" ");
  const raw = {
    hero: { eyebrow: long(12), title: long(20), sub: long(40), button: { label: "Jetzt die passenden O-Ringe online bestellen", url: "" }, pictureIdea: "seals", pictureAlt: long(30) },
    intro: long(140),
    benefits: { title: long(15), items: [{ title: long(10), text: long(50) }] },
    sections: { items: [{ title: long(15), text: long(200), pictureIdea: "x", pictureAlt: "y" }] },
    faq: { title: "Fragen", items: [{ q: long(30), a: long(120) }] },
    cta: { title: long(15), text: long(50), button: { label: long(6), url: "" } },
    seo: { title: long(15), description: long(40), urlKey: "o-ringe" },
  };
  const { answer: a } = cleanFill(raw, []);
  const checks: [string, number][] = [
    [a.hero!.eyebrow, LIMIT.eyebrow], [a.hero!.title, LIMIT.heroTitle], [a.hero!.sub, LIMIT.heroSub], [a.hero!.button.label, LIMIT.button],
    [a.hero!.pictureAlt, LIMIT.alt], [a.intro!, LIMIT.intro], [a.benefits!.title, LIMIT.blockTitle], [a.benefits!.items[0].title, LIMIT.benefitTitle],
    [a.benefits!.items[0].text, LIMIT.benefitText], [a.sections!.items[0].title, LIMIT.sectionTitle], [a.sections!.items[0].text, LIMIT.sectionText],
    [a.faq!.items[0].q, LIMIT.faqQ], [a.faq!.items[0].a, LIMIT.faqA], [a.cta!.title, LIMIT.ctaTitle], [a.cta!.text, LIMIT.ctaText],
    [a.cta!.button.label, LIMIT.button], [a.seo!.title, LIMIT.seoTitle], [a.seo!.description, LIMIT.seoDescription],
  ];
  for (const [v, max] of checks) {
    assert.ok(v.length > 0 && v.length <= max, `${v.length} > ${max}: ${v}`);
    assert.ok(!/\S-$|\s$/.test(v));
  }
  assert.equal(a.hero!.button.label, "Jetzt die passenden O-Ringe", "a button cut at a word");
});

test("fit: a translated page that runs longer is brought back within its limits", () => {
  let f = emptyFields();
  const s = addItem(f, "sections");
  f = setField(s.fields, "hero.title", "Joints d'étanchéité hygiéniques pour l'industrie alimentaire, conformes FDA et livrés vite");
  f = setField(f, `sections.${s.id}.title`, "Le bon joint pour chaque ligne de production alimentaire et chaque nettoyage");
  assert.equal(overLimit(f).length, 2);
  const out = fitFields(f);
  assert.deepEqual(overLimit(out), []);
  assert.equal(out.hero.title, "Joints d'étanchéité hygiéniques pour l'industrie alimentaire");
});
