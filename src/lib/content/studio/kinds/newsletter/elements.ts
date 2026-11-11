// NEWSLETTER - ONE ELEMENT OF THE E-MAIL, AS ITS CARD SHOWS IT (cv16, 11.11.2026). Pure: relative imports only - the
// studio's element card (src/app/projects/studio/kinds/newsletter/ElementPop.tsx) and tests/studio-newsletter-cv16.test.ts.
//
// The Page builder's element popups (../page/modules/elements.ts, Content v14): a click picks ONE element - a text, a
// button, a picture, a list's item - and its card says, in one order, its words, its link (with "In every store view"),
// its look, its own Ask AI, and Take it out / Duplicate / Move. The newsletter's elements are its blocks' parts as the
// e-mail marks them (model.ts: "<block id>:<field>" on words, "<id>:image" / "<id>:item<n>Image" / "<id>:logo" on pictures).
// An e-mail's look is our template's (no colour or size per element), so a card has no Look; "In every store view" is
// "In every language" here - the same element's link in each language's e-mail (a translation keeps the block ids).

import { BLOCK_LABEL, asNewsletter, type Block, type NewsletterDoc } from "./model";
import { languagesOf, versionIn } from "./langs";

export type ElementKind = "words" | "button" | "picture" | "logo";
export type Element = {
  block: Block; field: string;
  kind: ElementKind;
  /** "Lead story · button", "Products · product 2" */
  label: string;
  /** where it leads (a button, a story's link, a product, the banner's picture) - null: it has no link */
  url: string | null;
  /** a product's place in its block (0-based) - Duplicate and Move work on it */
  item: number | null;
};

const NAME: Record<string, string> = { headline: "headline", eyebrow: "line over it", title: "title", text: "words", button: "button", link: "button", footer: "line", imageAlt: "picture's words", image: "picture", logo: "logo" };

/** The element a key points at - null when its block or part is gone. */
export function elementOf(docIn: unknown, key: string): Element | null {
  const d = asNewsletter(docIn);
  const at = key.indexOf(":");
  if (at < 0) return null;
  const block = d.blocks.find((b) => b.id === key.slice(0, at));
  if (!block) return null;
  const field = key.slice(at + 1);
  const item = /^item(\d)/.exec(field);
  const n = item ? Number(item[1]) - 1 : null;
  if (n !== null && (block.kind !== "products" && block.kind !== "facts")) return null;
  const kind: ElementKind = field === "logo" ? "logo" : field === "image" || /^item\dImage$/.test(field) ? "picture" : field === "button" || field === "link" ? "button" : "words";
  let url: string | null = null;
  if (block.kind === "hero" || block.kind === "cta") url = field === "button" ? block.button.url : null;
  else if (block.kind === "article") url = field === "link" ? block.link.url : null;
  else if (block.kind === "banner") url = field === "image" ? block.url : null;
  else if (block.kind === "products" && n !== null) url = block.items[n]?.url ?? null;
  const label = `${BLOCK_LABEL[block.kind]} · ${n !== null ? (block.kind === "products" ? `product ${n + 1}` : `fact ${n + 1}`) : NAME[field] ?? field}`;
  return { block, field, kind, label, url, item: n };
}

/** The e-mail with the element's link set. */
export function withLink(docIn: unknown, key: string, url: string): NewsletterDoc {
  const d = asNewsletter(docIn);
  const el = elementOf(d, key);
  if (!el || el.url === null) return d;
  const b = el.block;
  const next: Block = b.kind === "hero" || b.kind === "cta" ? { ...b, button: { ...b.button, url } }
    : b.kind === "article" ? { ...b, link: { ...b.link, url } }
    : b.kind === "banner" ? { ...b, url }
    : b.kind === "products" && el.item !== null ? { ...b, items: b.items.map((x, i) => (i === el.item ? { ...x, url } : x)) } : b;
  return { ...d, blocks: d.blocks.map((x) => (x.id === b.id ? next : x)) };
}

/** What "Take it out" does to the element (null: it cannot go - a headline, a story's words): the e-mail without it, and
 *  what is said. A line over the headline, a button or a link loses its words (it shows no more); a product leaves its
 *  row; a picture leaves its place. */
export function takeOut(docIn: unknown, key: string): { doc: NewsletterDoc; done: string } | null {
  const d = asNewsletter(docIn);
  const el = elementOf(d, key);
  if (!el) return null;
  const b = el.block;
  const put = (nb: Block, done: string) => ({ doc: { ...d, blocks: d.blocks.map((x) => (x.id === b.id ? nb : x)) }, done });
  if (b.kind === "products" && el.item !== null) {
    if (b.items.length <= 1) return null;
    return put({ ...b, items: b.items.filter((_, i) => i !== el.item) }, `Product ${el.item + 1} taken out`);
  }
  if (el.kind === "picture" && "imageUrl" in b) return b.imageUrl ? put({ ...b, imageUrl: "" } as Block, "The picture taken out") : null;
  if (b.kind === "hero" && el.field === "eyebrow") return put({ ...b, eyebrow: "" }, "The line over the headline taken out");
  if ((b.kind === "hero" || b.kind === "cta") && el.field === "button") return put({ ...b, button: { ...b.button, label: "" } }, "The button taken out");
  if (b.kind === "article" && el.field === "link") return put({ ...b, link: { ...b.link, label: "" } }, "The button taken out");
  if (b.kind === "cta" && el.field === "text") return put({ ...b, text: "" }, "The line over the button taken out");
  if (b.kind === "products" && el.field === "title") return put({ ...b, title: "" }, "The title over the products taken out");
  return null;
}

/** A product's order in its row: one more like it, moved left / right (a row holds three at most). */
export function itemOrder(docIn: unknown, key: string): { dup: boolean; up: boolean; down: boolean } | null {
  const el = elementOf(docIn, key);
  if (!el || el.item === null || el.block.kind !== "products") return null;
  const n = el.block.items.length;
  return { dup: n < 3, up: el.item > 0, down: el.item < n - 1 };
}

/** The e-mail with a product duplicated (next to it) or moved by one; the key the element has then. */
export function orderItem(docIn: unknown, key: string, how: "dup" | -1 | 1): { doc: NewsletterDoc; key: string } | null {
  const d = asNewsletter(docIn);
  const el = elementOf(d, key);
  const o = itemOrder(d, key);
  if (!el || !o || el.item === null || el.block.kind !== "products") return null;
  const b = el.block;
  const i = el.item;
  const items = [...b.items];
  let to = i;
  if (how === "dup") { if (!o.dup) return null; items.splice(i + 1, 0, JSON.parse(JSON.stringify(items[i]))); to = i + 1; }
  else { to = i + how; if (to < 0 || to >= items.length) return null; [items[i], items[to]] = [items[to], items[i]]; }
  const part = el.field.replace(/^item\d/, `item${to + 1}`);
  return { doc: { ...d, blocks: d.blocks.map((x) => (x.id === b.id ? { ...b, items } : x)) }, key: `${b.id}:${part}` };
}

/** The same element's link in every language's e-mail (a translation keeps the block ids): "In every language". */
export function linkInLanguages(whole: unknown, key: string): { lang: string; url: string | null }[] {
  return languagesOf(whole).map((lang) => ({ lang, url: elementOf(versionIn(whole, lang), key)?.url ?? null }));
}
