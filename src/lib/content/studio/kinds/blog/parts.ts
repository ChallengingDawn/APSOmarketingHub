// BLOG POST - ITS PARTS, AS THE STUDIO EDITS THEM IN PLACE (Content v3, 08.11.2026). Pure, shared with the browser and
// the tests (relative imports only): tests/studio-blog-parts.test.ts.
//
// SARCLA 08.11.2026: "Improve the blog page a lot, and the editing is really not yet fully clear." Every part of the post
// the preview shows has a key; a click on it in the preview edits its words right there, and the assistant works on
// that part alone:
//   title  lead  short (the "in short" lines)  hero (the post's picture)  hero:cap
//   s:<id>:h (a section's heading)  s:<id>:b:<k> (its k-th block: a paragraph, a list, a table)  s:<id>:q (its pull
//   quote)  s:<id>:img (its picture)  s:<id>:img:cap
//   cta:t  cta:x  cta:l (the band to the shop: title, line, button)  faq:<id>:q  faq:<id>:a  prod:<id> (a product's name)
//   and, with no words of their own: tags, author, faq, prods, cta.

import { newId, newSection, wordsOf, type BlogDoc, type BlogSection } from "./model";
import { mdChunks } from "./render";

const sec = (d: BlogDoc, id: string) => d.sections.find((s) => s.id === id);

/** A part's words as they are written (markdown where the part has it), or null when the post has no such part. */
export function partText(d: BlogDoc, key: string): string | null {
  const w = wordsOf(d.language);
  const [a, b, c, e] = key.split(":");
  switch (a) {
    case "title": return d.title;
    case "lead": return d.excerpt;
    case "short": return d.takeaways.join("\n");
    case "hero": return b === "cap" ? d.hero.caption : null;
    case "cta": return b === "t" ? d.cta.title || w.ctaTitle : b === "x" ? d.cta.text || w.ctaText : b === "l" ? d.cta.label || w.ctaLabel : null;
    case "prod": return d.relatedProducts.find((p) => p.id === b)?.name ?? null;
    case "faq": { const f = d.faq.find((x) => x.id === b); return f ? (c === "q" ? f.q : c === "a" ? f.a : null) : null; }
    case "s": {
      const s = sec(d, b);
      if (!s) return null;
      if (c === "h") return s.heading;
      if (c === "q") return s.quote;
      if (c === "img") return e === "cap" ? s.image.caption : null;
      if (c === "b") { const k = Number(e); const chunks = mdChunks(s.body); return Number.isInteger(k) && k >= 0 && k <= chunks.length ? chunks[k] ?? "" : null; }
      return null;
    }
    default: return null;
  }
}

/** Is the part one line (a title, a heading, a button) - Enter keeps it - or text with lines and paragraphs? */
export function oneLine(key: string): boolean {
  return /^(title|cta:t|cta:l|prod:[^:]+|s:[^:]+:h|faq:[^:]+:q)$/.test(key);
}

const oneLineOf = (t: string) => t.replace(/\s*\n+\s*/g, " ").trim();

/** The post with one part's words changed. A section's block emptied goes away; the band's words left as the language's
 *  own words stay empty (so a translation brings them in the new language). */
export function setPart(d: BlogDoc, key: string, raw: string): BlogDoc {
  const text = oneLine(key) ? oneLineOf(raw) : raw.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const w = wordsOf(d.language);
  const [a, b, c, e] = key.split(":");
  const upSec = (id: string, f: (s: BlogSection) => BlogSection) => ({ ...d, sections: d.sections.map((s) => (s.id === id ? f(s) : s)) });
  switch (a) {
    case "title": return { ...d, title: text };
    case "lead": return { ...d, excerpt: text };
    case "short": return { ...d, takeaways: text.split("\n").map((t) => t.replace(/^\s*[-*•]\s+/, "").trim()).filter(Boolean).slice(0, 6) };
    case "hero": return b === "cap" ? { ...d, hero: { ...d.hero, caption: text } } : d;
    case "cta": {
      const own = (def: string) => (text === def ? "" : text);
      if (b === "t") return { ...d, cta: { ...d.cta, title: own(w.ctaTitle) } };
      if (b === "x") return { ...d, cta: { ...d.cta, text: own(w.ctaText) } };
      if (b === "l") return { ...d, cta: { ...d.cta, label: own(w.ctaLabel) } };
      return d;
    }
    case "prod": return { ...d, relatedProducts: d.relatedProducts.map((p) => (p.id === b ? { ...p, name: text } : p)) };
    case "faq": return { ...d, faq: d.faq.map((f) => (f.id === b ? (c === "q" ? { ...f, q: text } : c === "a" ? { ...f, a: text } : f) : f)) };
    case "s": {
      if (!sec(d, b)) return d;
      if (c === "h") return upSec(b, (s) => ({ ...s, heading: text }));
      if (c === "q") return upSec(b, (s) => ({ ...s, quote: text }));
      if (c === "img" && e === "cap") return upSec(b, (s) => ({ ...s, image: { ...s.image, caption: text } }));
      if (c === "b") {
        const k = Number(e);
        return upSec(b, (s) => {
          const chunks = mdChunks(s.body);
          if (!Number.isInteger(k) || k < 0 || k > chunks.length) return s;
          chunks[k] = text;
          return { ...s, body: chunks.filter((x) => x.trim()).join("\n\n") };
        });
      }
      return d;
    }
    default: return d;
  }
}

/** The section a part belongs to, by its id (null when the part is not in a section). */
export const sectionOf = (key: string | null): string | null => (key && key.startsWith("s:") ? key.split(":")[1] ?? null : null);

/** A block of a section by what it is: "paragraph 2", "the list", "the table" (counted among its own kind). */
function blockName(d: BlogDoc, sid: string, k: number): string {
  const chunks = mdChunks(sec(d, sid)?.body ?? "");
  const kindOf = (c: string) => (/^\s*\|/.test(c) ? "table" : /^\s*([-*+]|\d+[.)])\s/.test(c) ? "list" : /^\s*#/.test(c) ? "sub-heading" : /^\s*>/.test(c) ? "callout" : "paragraph");
  if (!chunks.length) return "text";
  const kind = kindOf(chunks[k] ?? "");
  const same = chunks.map(kindOf).filter((x) => x === kind).length;
  const nth = chunks.slice(0, k + 1).map(kindOf).filter((x) => x === kind).length;
  return same > 1 ? `${kind} ${nth}` : kind;
}

/** What a part is called in the studio: "Section 2 · paragraph 3". */
export function partLabel(d: BlogDoc, key: string | null): string {
  if (!key) return "The whole post";
  const [a, b, c, e] = key.split(":");
  const at = (id: string) => d.sections.findIndex((s) => s.id === id) + 1;
  const q = (id: string) => d.faq.findIndex((f) => f.id === id) + 1;
  switch (a) {
    case "title": return "The title";
    case "lead": return "The lead";
    case "short": return "In short";
    case "hero": return b === "cap" ? "The line under the post's picture" : "The post's picture";
    case "cta": return b === "t" ? "The band to the shop · title" : b === "x" ? "The band to the shop · its line" : b === "l" ? "The band to the shop · button" : "The band to the shop";
    case "faq": return b ? `Question ${q(b)}${c === "a" ? " · answer" : ""}` : "Questions and answers";
    case "prods": return "Related products";
    case "prod": return "Related product";
    case "tags": return "Topics";
    case "author": return "Author and day";
    case "s": {
      const n = at(b);
      const name = c === "h" ? "heading" : c === "q" ? "pull quote" : c === "img" ? (e === "cap" ? "line under the picture" : "picture") : c === "b" ? blockName(d, b, Number(e)) : "";
      return `Section ${n}${name ? ` · ${name}` : ""}`;
    }
    default: return "The post";
  }
}

/** A new section after another one (or at the end): its heading and text still to write. */
export function addSection(d: BlogDoc, afterId?: string | null): { doc: BlogDoc; id: string } {
  const s = newSection();
  const i = afterId ? d.sections.findIndex((x) => x.id === afterId) : -1;
  const sections = [...d.sections];
  sections.splice(i >= 0 ? i + 1 : sections.length, 0, s);
  return { doc: { ...d, sections }, id: s.id };
}

/** A section moved one place up (-1) or down (+1). */
export function moveSection(d: BlogDoc, id: string, by: -1 | 1): BlogDoc {
  const i = d.sections.findIndex((s) => s.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= d.sections.length) return d;
  const sections = [...d.sections];
  [sections[i], sections[j]] = [sections[j], sections[i]];
  return { ...d, sections };
}

/** A new question (or product) at the end, its id to select it. */
export function addFaq(d: BlogDoc): { doc: BlogDoc; id: string } {
  const id = newId();
  return { doc: { ...d, faq: [...d.faq, { id, q: "", a: "" }] }, id };
}
export function addProduct(d: BlogDoc, p: { name?: string; url?: string } = {}): { doc: BlogDoc; id: string } {
  const id = newId();
  return { doc: { ...d, relatedProducts: [...d.relatedProducts, { id, name: p.name ?? "", url: p.url ?? "" }] }, id };
}

/** The state of each part the outline lists: done, still to do, or to look at. */
export type PartState = "done" | "todo" | "warn";
export type OutlineRow = { key: string; label: string; detail: string; state: PartState; section?: string };

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** The post as its outline lists it, top to bottom - as the page shows it. */
export function outlineOf(d: BlogDoc): OutlineRow[] {
  const rows: OutlineRow[] = [];
  rows.push({ key: "title", label: "Title and lead", detail: d.title.trim() ? (d.excerpt.trim() ? "Written" : "No lead yet") : "No title yet", state: d.title.trim() && d.excerpt.trim() ? "done" : "todo" });
  rows.push({ key: "short", label: "In short", detail: d.takeaways.length ? `${d.takeaways.length} line${d.takeaways.length === 1 ? "" : "s"}` : "Empty", state: d.takeaways.length ? "done" : "todo" });
  rows.push({
    key: "hero", label: "The post's picture",
    detail: d.hero.url ? (d.hero.alt.trim() ? "In place" : "No description yet") : d.hero.prompt.trim() ? "An idea, not made yet" : "None yet",
    state: d.hero.url ? (d.hero.alt.trim() ? "done" : "warn") : "todo",
  });
  d.sections.forEach((s, i) => {
    const n = words(s.body);
    const bits = [n ? `${n} words` : "No text yet", s.image.url ? "picture" : s.image.prompt ? "picture idea" : "", s.quote.trim() ? "quote" : ""].filter(Boolean);
    rows.push({ key: `s:${s.id}:h`, label: s.heading.trim() || `Section ${i + 1}`, detail: bits.join(" · "), state: s.heading.trim() && n ? (s.image.url && !s.image.alt.trim() ? "warn" : "done") : "todo", section: s.id });
  });
  rows.push({ key: "cta", label: "The band to the shop", detail: d.cta.title.trim() ? "Written" : "The shop's own words", state: "done" });
  rows.push({ key: "faq", label: "Questions and answers", detail: d.faq.length ? `${d.faq.length} question${d.faq.length === 1 ? "" : "s"}` : "None yet", state: d.faq.length ? "done" : "todo" });
  const noUrl = d.relatedProducts.filter((p) => !p.url.trim()).length;
  rows.push({ key: "prods", label: "Related products", detail: d.relatedProducts.length ? `${d.relatedProducts.length}${noUrl ? ` · ${noUrl} without address` : ""}` : "None yet", state: d.relatedProducts.length ? (noUrl ? "warn" : "done") : "todo" });
  rows.push({ key: "tags", label: "Topics", detail: d.tags.length ? d.tags.join(", ") : "None yet", state: d.tags.length ? "done" : "todo" });
  rows.push({ key: "author", label: "Author and day", detail: [d.author.trim() || "No author", d.publishAt || "the calendar's day"].join(" · "), state: d.author.trim() ? "done" : "todo" });
  return rows;
}
