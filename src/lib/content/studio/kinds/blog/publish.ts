// BLOG POST - THE LAST STEP'S OWN LOGIC (cv16, SARCLA 11.11.2026: "compare the evolution of this page to the other content
// types and improve them"). Pure: relative imports only - tests/studio-blog-cv16.test.ts.
//
// The blog is still published by pasting its CMS pages into Magento (Publish.tsx) - nothing is written to Magento from the
// hub. What the Page builder's last step brought to it:
//   pictures   the post's own pictures (and the home's cards') in the hub's picture storage, each under a readable name
//              from its words (page/contentMedia.ts contentFileOf) - the paste names them at their address there, so no
//              picture waits for Magento's Media Gallery any more. One "Store them" for all, with what failed and Try again.
//   on the shop  each page of the post (the post, the blog's home, its topics) read on www.apsoparts.com: there or not yet,
//              with its link. What was found is kept with the post (doc.published) - the Content library's card shows it.
//   languages  a translation's links follow the language: /de-CH/... becomes /fr-CH/... in the text, the band's button,
//              the products.

import { SHOP, homePath, postPath, tagPath, type BlogDoc, type Published } from "./model";

/** A picture kept in the hub, as a post names it (a path; the paste: the hub's full address). */
const HUB_PICTURE = /(?:https?:\/\/[^\s"'()<>]*?)?(\/api\/content\/picture\/(\d{1,12})-[A-Za-z0-9_-]{4,40})/g;
const HUB_PATH = /^\/api\/content\/picture\/(\d{1,12})-[A-Za-z0-9_-]{4,40}$/;

export type PictureAsk = { url: string; words: string };
export type PictureState = "there" | "missing" | "unknown";
export type PictureRow = { url: string; file: string; address: string; state: PictureState };

/** The hub path of a picture address ("" when it is not the hub's). */
export function hubPath(url: string): string {
  const m = /\/api\/content\/picture\/\d{1,12}-[A-Za-z0-9_-]{4,40}/.exec(String(url ?? ""));
  return m ? m[0] : "";
}

/** The post's own pictures kept in the hub, each once, with its words (what it shows, else the idea it was made from). */
export function postPictures(d: Pick<BlogDoc, "hero" | "sections" | "title">): PictureAsk[] {
  const out: PictureAsk[] = [];
  const add = (url: string, words: string) => { const p = hubPath(url); if (p && !out.some((x) => x.url === p)) out.push({ url: p, words: words.trim() }); };
  add(d.hero.url, d.hero.alt || d.hero.prompt || d.title);
  for (const s of d.sections) add(s.image.url, s.image.alt || s.image.prompt || s.heading);
  return out;
}

/** The pictures of the cards the home and the topic pages show (other posts' pictures too). */
export function cardPictures(cards: { hero: { url: string; alt: string }; title: string }[]): PictureAsk[] {
  const out: PictureAsk[] = [];
  for (const c of cards) { const p = hubPath(c.hero.url); if (p && !out.some((x) => x.url === p)) out.push({ url: p, words: (c.hero.alt || c.title).trim() }); }
  return out;
}

/** The asks as the server takes them: hub paths only, each once, 40 at most. */
export function picturesIn(raw: unknown): (PictureAsk & { id: number })[] {
  const out: (PictureAsk & { id: number })[] = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    if (!x || typeof x !== "object") continue;
    const url = typeof (x as PictureAsk).url === "string" ? hubPath((x as PictureAsk).url) : "";
    const m = HUB_PATH.exec(url);
    if (!m || out.some((y) => y.url === url)) continue;
    out.push({ url, id: Number(m[1]), words: typeof (x as PictureAsk).words === "string" ? (x as PictureAsk).words.slice(0, 300) : "" });
    if (out.length >= 40) break;
  }
  return out;
}

/** A paste's code with each hub picture named at its address in the hub's picture storage (by its path). */
export function withStored(code: string, addresses: ReadonlyMap<string, string>): string {
  if (!addresses.size) return code;
  return code.replace(HUB_PICTURE, (all, path: string) => addresses.get(path) ?? all);
}

/* ── the post's pages on the shop ─────────────────────────────────────── */

export type LivePage = { key: string; label: string; path: string };
export type LiveRead = { path: string; url: string; status: number; live: boolean };

/** The pages the post goes into: the post, the blog's home, a page per topic. */
export function pagesOf(d: Pick<BlogDoc, "store" | "slug" | "title" | "tags">): LivePage[] {
  return [
    { key: "post", label: "The post", path: postPath(d) },
    { key: "home", label: "The blog's home", path: homePath(d.store) },
    ...d.tags.map((t) => ({ key: `tag:${t}`, label: `Topic: ${t}`, path: tagPath(d.store, t) })),
  ].filter((p) => !p.path.includes("…"));
}

/** A blog address on the shop (/de-CH/blog, /de-CH/blog/<address>, /de-CH/blog/tag/<topic>) - 12 at most. */
export function livePathsIn(raw: unknown): string[] {
  const out: string[] = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    if (typeof x !== "string" || !/^\/[a-z]{2}-[A-Z]{2}\/blog(\/[a-z0-9-]{1,120}){0,2}$/.test(x) || out.includes(x)) continue;
    out.push(x);
    if (out.length >= 12) break;
  }
  return out;
}

/** What a read of a page on the shop says: there (200 and the blog's own article in it), or not yet. */
export const isLive = (status: number, body: string) => status === 200 && /class="apx-blog\b/.test(body);

/** The record of a read: the pages found live (none: no record). */
export function publishedFrom(pages: LivePage[], reads: LiveRead[], at: string, by: string): Published | null {
  const live = pages.filter((p) => reads.some((r) => r.path === p.path && r.live));
  return live.length ? { at, by, pages: live.map((p) => ({ label: p.label, path: p.path, url: `${SHOP}${p.path}` })) } : null;
}

/* ── a translation's links follow the language ────────────────────────── */

const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** A shop link of the old store view made the new one's: /de-CH/... -> /fr-CH/... (on its own, or on the shop's address). */
export function followStore(text: string, from: string, to: string): string {
  if (!text || !from || !to || from === to) return text;
  const re = new RegExp(`(^|\\(|\\s|"|'|apsoparts\\.com)\\/${reEsc(from)}(?=\\/|$|\\)|\\s|"|')`, "g");
  return text.replace(re, `$1/${to}`);
}

/** The post with its links in the new store view: the sections' text, the questions' answers, the band, the products. */
export function postFollowsStore<T extends Pick<BlogDoc, "sections" | "faq" | "cta" | "relatedProducts" | "excerpt">>(d: T, from: string, to: string): T {
  const f = (t: string) => followStore(t, from, to);
  return {
    ...d,
    excerpt: f(d.excerpt),
    sections: d.sections.map((s) => ({ ...s, body: f(s.body) })),
    faq: d.faq.map((q) => ({ ...q, a: f(q.a) })),
    cta: { ...d.cta, url: f(d.cta.url) },
    relatedProducts: d.relatedProducts.map((p) => ({ ...p, url: f(p.url) })),
  };
}
