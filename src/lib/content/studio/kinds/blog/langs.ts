// BLOG POST - ITS LANGUAGES, EACH A TAB OF ITS OWN (cv17, 12.11.2026). Pure: relative imports only - the studio, the
// server and tests/studio-blog-cv17.test.ts.
//
// SARCLA 11.11.2026: "continue" - the gap round cv16 left in the blog: a translation REPLACED the post (each language its
// own to-do), while the newsletter (newsletter/langs.ts) and the social studio keep every language as a tab. Now the post's
// own language stays its top level (the library, the calendar, the blog's home and an older post read it so) and each
// other language is a version under `langs` (model.ts BlogLang): its title, lead, "in short", sections (their pictures'
// words and lines), questions, topics, Google's texts, the author's role, the band to the shop, its products - its links in
// its own store view. What stays the post's: the author, the publishing day, the notes and the pictures (the hero's file,
// and a section's when the post has the same section - a translation keeps the sections' ids, so a picture made in any
// tab shows in every language).
//   versionIn / withVersion   a language's post as the studio edits it, and back into the document
//   withoutLanguage           a tab taken out (the post's own stays)
//   translatedView            the AI's translation (already read against the shop's word rules on the server, ./guard.ts)
//                             laid over the post it was made from: every part along, the pictures kept, the links moved
// An older post (no `langs`) reads, edits and saves exactly as before; a to-do once translated in place stays a to-do of
// its own (nothing is moved).

import { blogDoc, slugify, storeOf, LANG_FIELDS, type BlogDoc, type BlogLang, type BlogSection } from "./model";
import { postFollowsStore } from "./publish";

/** The languages a post is written in, in the studio's order. */
export const LANG_ORDER = ["DE", "FR", "IT", "EN", "NL", "PL"];
const rank = (l: string) => { const i = LANG_ORDER.indexOf(l); return i < 0 ? 99 : i; };
const up = (l: string | null | undefined) => String(l ?? "").trim().toUpperCase();

/** What a post read from storage falls back on (the to-do's language, the person, the to-do's name). */
export type Defaults = { language?: string | null; author?: string | null; title?: string | null };
const asPost = (doc: unknown, df?: Defaults): BlogDoc => blogDoc(doc, df ?? {});

/** Every language the post has: its own first, then the others in the studio's order. */
export function languagesOf(doc: unknown, df?: Defaults): string[] {
  const d = asPost(doc, df);
  return [d.language, ...Object.keys(d.langs ?? {}).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))];
}

/** A language's post as the studio edits it: its own words over the post's shared parts, the post's pictures in place.
 *  The post's own language (or one it has not) is the post itself. */
export function versionIn(doc: unknown, lang?: string | null, df?: Defaults): BlogDoc {
  const d = asPost(doc, df);
  const L = up(lang);
  const v = L && L !== d.language ? d.langs?.[L] : undefined;
  if (!v) return d;
  const { langs: _l, ...post } = d;
  const files = new Map(d.sections.map((s) => [s.id, s.image.url]));
  return {
    ...post,
    ...pick(v),
    language: L,
    hero: { ...v.hero, url: d.hero.url },
    sections: v.sections.map((s) => (files.has(s.id) ? { ...s, image: { ...s.image, url: files.get(s.id)! } } : s)),
    changes: v.changes ?? [],
    published: v.published ?? null,
  };
}

const pick = (v: BlogLang | BlogDoc) => Object.fromEntries(LANG_FIELDS.map((f) => [f, v[f]])) as Pick<BlogDoc, (typeof LANG_FIELDS)[number]>;

/** The post with one language's view put back: its own language - the top level (its other languages as the post has
 *  them); another - its version, and what is shared (the pictures' files, the author, the day, the notes) into the post. */
export function withVersion(doc: unknown, lang: string, view: BlogDoc, df?: Defaults): BlogDoc {
  const d = asPost(doc, df);
  const L = up(lang);
  if (L === d.language || !L) {
    const { langs: _l, ...rest } = view;
    // the post's own language changes only to one it has no tab for (the start card, before anything is written)
    const language = up(view.language) && !d.langs?.[up(view.language)] ? up(view.language) : d.language;
    return { ...rest, language, ...(d.langs ? { langs: d.langs } : {}) };
  }
  const files = new Map(view.sections.map((s) => [s.id, s.image.url]));
  const post: BlogDoc = {
    ...d,
    author: view.author, publishAt: view.publishAt, notes: view.notes,
    hero: d.hero.url === view.hero.url ? d.hero : { ...d.hero, url: view.hero.url },
    sections: d.sections.map((s) => (files.has(s.id) && files.get(s.id) !== s.image.url ? { ...s, image: { ...s.image, url: files.get(s.id)! } } : s)),
  };
  const was = d.langs?.[L];
  const own: BlogLang = {
    ...pick(view), changes: view.changes ?? [], ...(view.published ? { published: view.published } : {}),
    ...(was?.at ? { at: was.at } : {}),
  };
  return { ...post, langs: { ...(d.langs ?? {}), [L]: own } };
}

/** The post without one of its other languages (its own stays). */
export function withoutLanguage(doc: unknown, lang: string, df?: Defaults): BlogDoc {
  const d = asPost(doc, df);
  const L = up(lang);
  if (!d.langs?.[L]) return d;
  const { [L]: _gone, ...langs } = d.langs;
  const { langs: _l, ...rest } = d;
  return Object.keys(langs).length ? { ...rest, langs } : rest;
}

/* ── a translation: every part along ─────────────────────────────────────────────────────────────────────────────── */

/** The whole post as the AI's "outline" task answers it (server.ts; every text read against the shop's word rules). */
export type OutlineAnswer = Pick<BlogDoc, "title" | "slug" | "metaTitle" | "metaDescription" | "excerpt" | "sections" | "faq" | "tags" | "takeaways"> & {
  cta: { title: string; text: string; label: string }; picture: string; pictureAlt: string; heroCaption?: string; authorRole?: string;
  /** what the shop's word rules left out (server: ./guard.ts) */
  note?: string;
};

/**
 * The post in another language from the AI's translation of `source` (the language open): every part along - the title,
 * the lead, "in short", the sections (each keeps its id and its picture; what the picture shows and the line under it in
 * the new language), the questions, the topics, Google's texts, the author's role, the band's words - and its links, the
 * band's button and the products in the new language's store view (`store`: the language's own when it has one, else its
 * default). Nothing of the post's history: a language made new has no changes and no pages on the shop yet.
 */
export function translatedView(source: BlogDoc, x: OutlineAnswer, to: string, store?: string): BlogDoc {
  const L = up(to);
  const toStore = store || storeOf(L);
  const sections = x.sections.map((s, i): BlogSection => {
    const was = source.sections[i];
    if (!was) return s;
    return {
      ...s, id: was.id,
      image: {
        url: was.image.url, prompt: was.image.prompt || s.image.prompt,
        alt: s.image.alt || was.image.alt, caption: s.image.caption || was.image.caption,
      },
    };
  });
  const view: BlogDoc = {
    ...source,
    language: L, store: toStore,
    title: x.title || source.title, slug: x.slug || slugify(x.title) || source.slug,
    metaTitle: x.metaTitle, metaDescription: x.metaDescription, excerpt: x.excerpt, takeaways: x.takeaways,
    sections, faq: x.faq.length ? x.faq : source.faq, tags: x.tags.length ? x.tags : source.tags,
    cta: { ...source.cta, title: x.cta.title, text: x.cta.text, label: x.cta.label },
    hero: { ...source.hero, prompt: x.picture || source.hero.prompt, alt: x.pictureAlt || source.hero.alt, caption: x.heroCaption || source.hero.caption },
    authorRole: x.authorRole || source.authorRole,
    changes: [], published: null,
  };
  const { langs: _l, ...plain } = view;
  return postFollowsStore(plain, source.store, toStore);
}

/** "Translated into French: 5 sections, 3 questions, ... - its links and products in fr-CH." */
export function translatedLine(view: BlogDoc, names: Record<string, string>): string {
  return `Translated into ${names[view.language] ?? view.language} - a tab of its own: ${view.sections.length} section${view.sections.length === 1 ? "" : "s"}, ${view.faq.length} question${view.faq.length === 1 ? "" : "s"}, the pictures' words, the author's role, store view ${view.store} - its links and products follow it.`;
}

/** Where each language's pages were found on the shop (the last step), its own first - for the tabs' marks. */
export function liveLanguages(doc: unknown, df?: Defaults): string[] {
  return languagesOf(doc, df).filter((l) => (versionIn(doc, l, df).published?.pages.length ?? 0) > 0);
}
