// PAGE - THE AI FILLS A NEW PAGE'S FIELDS (08.11.2026). Pure: tests/studio-page-fill.test.ts.
//
// SARCLA 08.11.2026: "the new page should allow many more fields and allow filling fields with AI". One schema per part
// of the page (the AI answers in it, nothing else), and one way to lay an answer over the fields as they are NOW: the
// words change, the pictures a person chose and the looks stay, list items keep their ids (and so their looks), and an
// address is only ever one of the shop's own pages the server offered (never one the AI made up).

import { LIMIT, emptyPic, itemId, setField, type Fields } from "./fields";
import { fitText } from "./fit";
import { leftoversIn, urlKeyOf } from "./model";

export const PARTS = ["hero", "intro", "benefits", "sections", "section", "links", "faq", "cta", "seo"] as const;
export type Part = (typeof PARTS)[number] | "all" | "field";
export const PART_LABEL: Record<Part, string> = {
  hero: "the hero", intro: "the intro", benefits: "the benefits", sections: "the sections", section: "this section", links: "the links",
  faq: "the questions", cta: "the call to action", seo: "the search engine fields", all: "the whole page", field: "this field",
};

const S = (description: string) => ({ type: "string", description });
const obj = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

const BUTTON = obj({ label: S(`The button's words, at most ${LIMIT.button} characters`), url: S("One address from THE SHOP'S PAGES YOU MAY LINK, else empty") });
const HERO = obj({
  eyebrow: S(`A small line above the title (what the page is about), at most ${LIMIT.eyebrow} characters`),
  title: S(`The page's H1: concrete, with the main keyword, at most ${LIMIT.heroTitle} characters`),
  sub: S(`One or two sentences under the title, at most ${LIMIT.heroSub} characters`),
  button: BUTTON,
  pictureIdea: S("ENGLISH: what the hero's picture should show, for a photographer - a real scene, no text in it"),
  pictureAlt: S(`The picture's alt text in the page's language, at most ${LIMIT.alt} characters`),
});
const INTRO = S(`An intro paragraph (2-4 sentences, at most ${LIMIT.intro} characters): what the visitor finds here and why it matters to them`);
const BENEFITS = obj({
  title: S(`A heading over the benefits, at most ${LIMIT.blockTitle} characters`),
  items: { type: "array", description: "Three or four benefits", items: obj({ title: S(`At most ${LIMIT.benefitTitle} characters`), text: S(`One or two sentences, at most ${LIMIT.benefitText} characters`) }) },
});
const SECTION = obj({
  title: S(`The section's heading, at most ${LIMIT.sectionTitle} characters`),
  text: S(`The section's text, at most ${LIMIT.sectionText} characters: short paragraphs separated by a blank line; a list as lines starting "- "`),
  pictureIdea: S("ENGLISH: what this section's picture should show - a real scene, no text in it"),
  pictureAlt: S(`The picture's alt text in the page's language, at most ${LIMIT.alt} characters`),
});
const SECTIONS = obj({ items: { type: "array", description: "Two to four sections, each one idea", items: SECTION } });
const LINKS = obj({
  title: S(`A heading over the links, at most ${LIMIT.blockTitle} characters`),
  items: { type: "array", description: "Four to eight of THE SHOP'S PAGES YOU MAY LINK, the most useful for this page's visitor first", items: obj({ url: S("Exactly one address from the list"), label: S(`The link's words, at most ${LIMIT.linkLabel} characters`), note: S(`What the visitor finds there, at most ${LIMIT.linkNote} characters`) }) },
});
const FAQ = obj({
  title: S(`A heading over the questions, at most ${LIMIT.blockTitle} characters`),
  items: { type: "array", description: "Four to six questions a buyer asks, answered from the facts you have", items: obj({ q: S(`At most ${LIMIT.faqQ} characters`), a: S(`At most ${LIMIT.faqA} characters`) }) },
});
const CTA = obj({ title: S(`At most ${LIMIT.ctaTitle} characters`), text: S(`At most ${LIMIT.ctaText} characters`), button: BUTTON });
const SEO = obj({
  title: S(`Meta title, at most ${LIMIT.seoTitle} characters, the main keyword first`),
  description: S(`Meta description, 120-${LIMIT.seoDescription} characters, says what the page offers`),
  urlKey: S("The URL key: lower case, words joined by dashes, in the page's language, no store code"),
});

export const FILL_SCHEMA: Record<Exclude<Part, "field">, Record<string, unknown>> = {
  hero: obj({ hero: HERO }),
  intro: obj({ intro: INTRO }),
  benefits: obj({ benefits: BENEFITS }),
  sections: obj({ sections: SECTIONS }),
  section: obj({ section: SECTION }),
  links: obj({ links: LINKS }),
  faq: obj({ faq: FAQ }),
  cta: obj({ cta: CTA }),
  seo: obj({ seo: SEO }),
  all: obj({ summary: S("ENGLISH, one sentence: what the page now says"), hero: HERO, intro: INTRO, benefits: BENEFITS, sections: SECTIONS, links: LINKS, faq: FAQ, cta: CTA, seo: SEO }),
};
export const FIELD_SCHEMA = obj({ text: S("The field's new words, final, in the page's language") });

/* ── the answer, cleaned ──────────────────────────────────────────────── */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const t = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
/** words within their field's limit - cut where they read whole, never "21 too many" (./fit.ts) */
const w = (v: unknown, limit: number) => (typeof v === "string" ? fitText(v.slice(0, 6000), limit) : "");
const arr = (v: unknown, max: number) => (Array.isArray(v) ? v.filter(isObj).slice(0, max) : []);

export type Candidate = { url: string; name: string; kind: string };
type Btn = { label: string; url: string };
export type FillAnswer = {
  summary?: string;
  hero?: { eyebrow: string; title: string; sub: string; button: Btn; pictureIdea: string; pictureAlt: string };
  intro?: string;
  benefits?: { title: string; items: { title: string; text: string }[] };
  sections?: { items: { title: string; text: string; pictureIdea: string; pictureAlt: string }[] };
  section?: { title: string; text: string; pictureIdea: string; pictureAlt: string };
  links?: { title: string; items: { url: string; label: string; note: string }[] };
  faq?: { title: string; items: { q: string; a: string }[] };
  cta?: { title: string; text: string; button: Btn };
  seo?: { title: string; description: string; urlKey: string };
};

/** The model's answer kept only where it makes sense: words within their limits, addresses only from the offered pages. */
export function cleanFill(raw: unknown, candidates: Candidate[]): { answer: FillAnswer; leftovers: string[] } {
  const r = isObj(raw) ? raw : {};
  const allowed = new Set(candidates.map((c) => c.url));
  const url = (v: unknown) => { const u = t(v, 400); return allowed.has(u) ? u : ""; };
  const btn = (v: unknown): Btn => { const b = isObj(v) ? v : {}; return { label: w(b.label, LIMIT.button), url: url(b.url) }; };
  const sec = (s: Record<string, unknown>) => ({ title: w(s.title, LIMIT.sectionTitle), text: w(s.text, LIMIT.sectionText), pictureIdea: t(s.pictureIdea, 600), pictureAlt: w(s.pictureAlt, LIMIT.alt) });
  const a: FillAnswer = {};
  if (typeof r.summary === "string") a.summary = t(r.summary, 300);
  if (isObj(r.hero)) { const h = r.hero; a.hero = { eyebrow: w(h.eyebrow, LIMIT.eyebrow), title: w(h.title, LIMIT.heroTitle), sub: w(h.sub, LIMIT.heroSub), button: btn(h.button), pictureIdea: t(h.pictureIdea, 600), pictureAlt: w(h.pictureAlt, LIMIT.alt) }; }
  if (typeof r.intro === "string") a.intro = w(r.intro, LIMIT.intro);
  if (isObj(r.benefits)) a.benefits = { title: w(r.benefits.title, LIMIT.blockTitle), items: arr(r.benefits.items, 6).map((b) => ({ title: w(b.title, LIMIT.benefitTitle), text: w(b.text, LIMIT.benefitText) })).filter((b) => b.title || b.text) };
  if (isObj(r.sections)) a.sections = { items: arr(r.sections.items, 6).map(sec).filter((s) => s.title || s.text) };
  if (isObj(r.section)) a.section = sec(r.section);
  if (isObj(r.links)) {
    const seen = new Set<string>();
    a.links = { title: w(r.links.title, LIMIT.blockTitle), items: arr(r.links.items, 10).map((l) => ({ url: url(l.url), label: w(l.label, LIMIT.linkLabel), note: w(l.note, LIMIT.linkNote) })).filter((l) => l.url && !seen.has(l.url) && (seen.add(l.url), true)) };
  }
  if (isObj(r.faq)) a.faq = { title: w(r.faq.title, LIMIT.blockTitle), items: arr(r.faq.items, 8).map((q) => ({ q: w(q.q, LIMIT.faqQ), a: w(q.a, LIMIT.faqA) })).filter((q) => q.q && q.a) };
  if (isObj(r.cta)) a.cta = { title: w(r.cta.title, LIMIT.ctaTitle), text: w(r.cta.text, LIMIT.ctaText), button: btn(r.cta.button) };
  if (isObj(r.seo)) a.seo = { title: w(r.seo.title, LIMIT.seoTitle), description: w(r.seo.description, LIMIT.seoDescription), urlKey: urlKeyOf(t(r.seo.urlKey, 160)) };
  const words = JSON.stringify(a);
  return { answer: a, leftovers: leftoversIn(words.replace(/\\n/g, " ")) };
}

/** Items laid over a list: the first ones keep their ids (and their looks, their pictures), new ones get theirs. */
function overList<T extends { id: string }, A>(old: T[], fresh: A[], make: (a: A, prev: T | undefined, id: string) => T): T[] {
  return fresh.map((a, i) => make(a, old[i], old[i]?.id ?? itemId()));
}

/** The fields with an answer laid over them: words replaced, the person's pictures and looks kept. */
export function mergeFill(f: Fields, a: FillAnswer, sectionId?: string): Fields {
  let out: Fields = { ...f };
  if (a.hero) {
    const h = a.hero;
    out.hero = {
      ...out.hero, eyebrow: h.eyebrow, title: h.title || out.hero.title, sub: h.sub,
      button: { label: h.button.label, url: h.button.url || out.hero.button.url },
      picture: { ...out.hero.picture, idea: h.pictureIdea || out.hero.picture.idea, alt: h.pictureAlt || out.hero.picture.alt },
    };
  }
  if (a.intro !== undefined && a.intro) out.intro = a.intro;
  if (a.benefits && a.benefits.items.length) {
    out.benefitsTitle = a.benefits.title;
    out.benefits = overList(out.benefits, a.benefits.items, (b, _p, id) => ({ id, title: b.title, text: b.text }));
  }
  if (a.sections && a.sections.items.length) {
    out.sections = overList(out.sections, a.sections.items, (s, p, id) => ({
      id, title: s.title, text: s.text, side: p?.side ?? (out.sections.length % 2 ? "left" : "right"),
      picture: { ...(p?.picture ?? emptyPic()), idea: s.pictureIdea || p?.picture.idea || "", alt: s.pictureAlt || p?.picture.alt || "" },
    }));
    out.sections = out.sections.map((s, i) => ({ ...s, side: f.sections.find((x) => x.id === s.id)?.side ?? (i % 2 ? "left" : "right") }));
  }
  if (a.section && sectionId) {
    const s = a.section;
    out.sections = out.sections.map((x) => (x.id === sectionId ? { ...x, title: s.title || x.title, text: s.text || x.text, picture: { ...x.picture, idea: s.pictureIdea || x.picture.idea, alt: s.pictureAlt || x.picture.alt } } : x));
  }
  if (a.links && a.links.items.length) {
    out.linksTitle = a.links.title;
    out.links = overList(out.links, a.links.items, (l, _p, id) => ({ id, label: l.label, url: l.url, note: l.note }));
  }
  if (a.faq && a.faq.items.length) {
    out.faqTitle = a.faq.title;
    out.faq = overList(out.faq, a.faq.items, (q, _p, id) => ({ id, q: q.q, a: q.a }));
  }
  if (a.cta) out.cta = { title: a.cta.title, text: a.cta.text, button: { label: a.cta.button.label, url: a.cta.button.url || out.cta.button.url } };
  if (a.seo) out.seo = { title: a.seo.title, description: a.seo.description, urlKey: a.seo.urlKey || out.seo.urlKey };
  // looks of items that are gone go with them
  const ids = new Set([...out.benefits, ...out.sections, ...out.links, ...out.faq].map((x) => x.id));
  const keep = (k: string) => { const p = k.split("."); return !["benefits", "sections", "links", "faq"].includes(p[0]) || !p[1] || ids.has(p[1]); };
  out = { ...out, looks: Object.fromEntries(Object.entries(out.looks).filter(([k]) => keep(k))) };
  return out;
}

/** One field's new words, set (a single-field ask: "change this"). */
export const mergeField = (f: Fields, path: string, text: string) => (text.trim() ? setField(f, path, text.trim()) : f);
