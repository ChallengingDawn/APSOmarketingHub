// BLOG POST - WHAT A PICKED PART CAN DO BESIDES ITS WORDS (cv16, SARCLA 11.11.2026: "compare the evolution of this page to
// the other content types and improve them"). Pure: relative imports only - tests/studio-blog-cv16.test.ts.
//
// The Page builder's element popup ends with Take it out / Duplicate / Move. In the blog the dark label over the picked
// part (EditFrame.tsx) carries the same, for the parts that are one of several:
//   a section's block   s:<id>:b:<k>  a paragraph, a list, a table - up / down within its section, duplicated, taken out
//   a section           s:<id>:h      its heading picked: the whole section up / down, duplicated, taken out
//   a question          faq:<id>:q|a  up / down, duplicated, taken out
//   a product           prod:<id>     up / down, taken out
//   a pull quote, a line under a picture   taken out
// Each answers the post changed and the part to pick after it (the copy, the part that moved, or nothing).

import { newId, type BlogDoc } from "./model";
import { mdChunks } from "./render";

export type PartAction = "up" | "down" | "duplicate" | "remove";
export type PartActions = { up: boolean; down: boolean; duplicate: boolean; remove: boolean; what: string };

const NONE: PartActions = { up: false, down: false, duplicate: false, remove: false, what: "" };

/** What the picked part can do (each false: the button is not shown or greyed). */
export function partActions(d: BlogDoc, key: string | null): PartActions {
  if (!key) return NONE;
  const [a, b, c, e] = key.split(":");
  if (a === "s") {
    const i = d.sections.findIndex((s) => s.id === b);
    if (i < 0) return NONE;
    if (c === "h") return { up: i > 0, down: i < d.sections.length - 1, duplicate: true, remove: true, what: "section" };
    if (c === "b") {
      const n = mdChunks(d.sections[i].body).length;
      const k = Number(e);
      if (!Number.isInteger(k) || k < 0 || k >= n) return NONE;
      return { up: k > 0, down: k < n - 1, duplicate: true, remove: true, what: "block" };
    }
    if (c === "q") return { ...NONE, remove: !!d.sections[i].quote.trim(), what: "pull quote" };
    if (c === "img" && e === "cap") return { ...NONE, remove: !!d.sections[i].image.caption.trim(), what: "line" };
    return NONE;
  }
  if (a === "faq" && b) {
    const i = d.faq.findIndex((f) => f.id === b);
    if (i < 0) return NONE;
    return { up: i > 0, down: i < d.faq.length - 1, duplicate: true, remove: true, what: "question" };
  }
  if (a === "prod" && b) {
    const i = d.relatedProducts.findIndex((p) => p.id === b);
    if (i < 0) return NONE;
    return { up: i > 0, down: i < d.relatedProducts.length - 1, duplicate: false, remove: true, what: "product" };
  }
  if (a === "hero" && b === "cap") return { ...NONE, remove: !!d.hero.caption.trim(), what: "line" };
  return NONE;
}

const swap = <T,>(list: T[], i: number, j: number): T[] => {
  if (i < 0 || j < 0 || i >= list.length || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};

/** The post with the action done on the part, and the part to pick after it (null: nothing). */
export function doPartAction(d: BlogDoc, key: string, act: PartAction): { doc: BlogDoc; key: string | null } {
  const can = partActions(d, key);
  if (!can[act]) return { doc: d, key };
  const by = act === "up" ? -1 : 1;
  const [a, b, c, e] = key.split(":");
  if (a === "s") {
    const i = d.sections.findIndex((s) => s.id === b);
    const sec = d.sections[i];
    if (c === "h") {
      if (act === "remove") return { doc: { ...d, sections: d.sections.filter((s) => s.id !== b) }, key: null };
      if (act === "duplicate") {
        const copy = { ...sec, id: newId(), image: { ...sec.image } };
        const sections = [...d.sections];
        sections.splice(i + 1, 0, copy);
        return { doc: { ...d, sections }, key: `s:${copy.id}:h` };
      }
      return { doc: { ...d, sections: swap(d.sections, i, i + by) }, key };
    }
    const upSec = (body: string) => ({ ...d, sections: d.sections.map((s) => (s.id === b ? { ...s, body } : s)) });
    if (c === "b") {
      const chunks = mdChunks(sec.body);
      const k = Number(e);
      if (act === "remove") return { doc: upSec(chunks.filter((_, j) => j !== k).join("\n\n")), key: null };
      if (act === "duplicate") { const next = [...chunks]; next.splice(k + 1, 0, chunks[k]); return { doc: upSec(next.join("\n\n")), key: `s:${b}:b:${k + 1}` }; }
      return { doc: upSec(swap(chunks, k, k + by).join("\n\n")), key: `s:${b}:b:${k + by}` };
    }
    if (c === "q" && act === "remove") return { doc: { ...d, sections: d.sections.map((s) => (s.id === b ? { ...s, quote: "" } : s)) }, key: null };
    if (c === "img" && act === "remove") return { doc: { ...d, sections: d.sections.map((s) => (s.id === b ? { ...s, image: { ...s.image, caption: "" } } : s)) }, key: null };
    return { doc: d, key };
  }
  if (a === "faq") {
    const i = d.faq.findIndex((f) => f.id === b);
    if (act === "remove") return { doc: { ...d, faq: d.faq.filter((f) => f.id !== b) }, key: null };
    if (act === "duplicate") {
      const copy = { ...d.faq[i], id: newId() };
      const faq = [...d.faq];
      faq.splice(i + 1, 0, copy);
      return { doc: { ...d, faq }, key: `faq:${copy.id}:${c ?? "q"}` };
    }
    return { doc: { ...d, faq: swap(d.faq, i, i + by) }, key };
  }
  if (a === "prod") {
    const i = d.relatedProducts.findIndex((p) => p.id === b);
    if (act === "remove") return { doc: { ...d, relatedProducts: d.relatedProducts.filter((p) => p.id !== b) }, key: null };
    return { doc: { ...d, relatedProducts: swap(d.relatedProducts, i, i + by) }, key };
  }
  if (a === "hero" && act === "remove") return { doc: { ...d, hero: { ...d.hero, caption: "" } }, key: null };
  return { doc: d, key };
}
