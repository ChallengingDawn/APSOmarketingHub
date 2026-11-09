// PAGE - A NEW PAGE'S OUTLINE (08.11.2026, evening). Pure: tests/studio-page-outline.test.ts.
//
// SARCLA 08.11.2026: "The UX and the Build on the left: can we improve it to be more fluid, subdivided". The left pane is
// no longer a wall of field cards: it is the page's parts in a short list - Hero, Intro, Benefits, Sections, Links,
// Questions, Call to action, Search engines - each saying how far it is (written, empty, a picture missing, being written
// by the AI). A click opens that part alone and selects it in the preview. And "AI wrote the whole page ... It's not
// generating photos": the picture slots the AI gave an idea for are listed here, to be made without another click.

import { blockOrder, getField, type Fields, type ListKey, type Pic } from "./fields";

export const PART_KEYS = ["hero", "intro", "benefits", "sections", "links", "faq", "cta", "seo"] as const;
export type PartKey = (typeof PART_KEYS)[number];
export const PART_NAME: Record<PartKey, string> = {
  hero: "Hero", intro: "Intro", benefits: "Benefits", sections: "Sections", links: "Links to the shop", faq: "Questions", cta: "Call to action", seo: "Search engines",
};
/** The part as a block in the preview (data-apx-b) - the search engine fields are not on the page. */
export const BLOCK_OF: Record<PartKey, string | null> = {
  hero: "hero", intro: "intro-block", benefits: "benefits", sections: "sections", links: "links", faq: "faq", cta: "cta", seo: null,
};

export type PartState = "written" | "partly" | "picture" | "empty";
export type PartInfo = {
  key: PartKey; name: string;
  /** items in a list part (benefits, sections, links, questions) */
  count: number | null;
  state: PartState;
  /** one line of what it says now */
  summary: string;
  /** pictures the part shows but does not have yet */
  missing: number;
};

const words = (s: string, n = 70) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };
const join = (xs: string[]) => words(xs.map((x) => x.trim()).filter(Boolean).join(" · "));

/** Each part of a new page, how far it is, and a line of what it says. */
export function partsOf(f: Fields): PartInfo[] {
  const h = f.hero;
  const heroMissing = h.title.trim() && !h.picture.url ? 1 : 0;
  const secMissing = f.sections.filter((s) => (s.title.trim() || s.text.trim()) && !s.picture.url).length;
  const st = (written: boolean, started: boolean, missing = 0): PartState => (written ? (missing ? "picture" : "written") : started ? "partly" : "empty");
  const sectionsDone = f.sections.length > 0 && f.sections.every((s) => s.title.trim() && s.text.trim());
  return [
    { key: "hero", name: PART_NAME.hero, count: null, missing: heroMissing, summary: words(h.title) || words(h.sub),
      state: st(!!h.title.trim(), !!(h.eyebrow.trim() || h.sub.trim() || h.button.label.trim() || h.picture.url), heroMissing) },
    { key: "intro", name: PART_NAME.intro, count: null, missing: 0, summary: words(f.intro), state: st(!!f.intro.trim(), false) },
    { key: "benefits", name: PART_NAME.benefits, count: f.benefits.length, missing: 0, summary: join(f.benefits.map((b) => b.title)) || words(f.benefitsTitle),
      state: st(f.benefits.length > 0 && f.benefits.every((b) => b.title.trim()), f.benefits.length > 0 || !!f.benefitsTitle.trim()) },
    { key: "sections", name: PART_NAME.sections, count: f.sections.length, missing: secMissing, summary: join(f.sections.map((s) => s.title)),
      state: st(sectionsDone, f.sections.length > 0, secMissing) },
    { key: "links", name: PART_NAME.links, count: f.links.length, missing: 0, summary: join(f.links.map((l) => l.label)),
      state: st(f.links.length > 0 && f.links.every((l) => l.label.trim() && l.url), f.links.length > 0) },
    { key: "faq", name: PART_NAME.faq, count: f.faq.length, missing: 0, summary: join(f.faq.map((q) => q.q)),
      state: st(f.faq.length > 0 && f.faq.every((q) => q.q.trim() && q.a.trim()), f.faq.length > 0) },
    { key: "cta", name: PART_NAME.cta, count: null, missing: 0, summary: words(f.cta.title) || words(f.cta.text),
      state: st(!!f.cta.title.trim(), !!(f.cta.text.trim() || f.cta.button.label.trim())) },
    { key: "seo", name: PART_NAME.seo, count: null, missing: 0, summary: words(f.seo.title),
      state: st(!!f.seo.title.trim() && !!f.seo.description.trim(), !!(f.seo.title.trim() || f.seo.description.trim())) },
  ];
}

/** The part a field or a block belongs to: "sections.ab12.text" -> sections, "intro-block" -> intro, "benefitsTitle" -> benefits. */
export function partOfPath(path: string | null | undefined): PartKey | null {
  const p = String(path ?? "").split(".")[0];
  const k = p === "benefitsTitle" ? "benefits" : p === "linksTitle" ? "links" : p === "faqTitle" ? "faq" : p === "intro-block" ? "intro" : p;
  return (PART_KEYS as readonly string[]).includes(k) ? (k as PartKey) : null;
}

/** What an AI run is writing (the studio's busy key: "all", "hero", "section:<id>", "field:<path>"): the parts in the
 * outline, the blocks and fields in the preview - so both shimmer where the words are coming. */
export function busyOf(busy: string | null, f: Fields): { parts: PartKey[]; blocks: string[]; fields: string[] } {
  const none = { parts: [] as PartKey[], blocks: [] as string[], fields: [] as string[] };
  if (!busy) return none;
  const blocksOf = (k: PartKey): string[] => (k === "sections" ? ["sections", ...f.sections.map((s) => `sections.${s.id}`)] : BLOCK_OF[k] ? [BLOCK_OF[k] as string] : []);
  if (busy === "all") return { parts: [...PART_KEYS], blocks: PART_KEYS.flatMap(blocksOf), fields: [] };
  if (busy.startsWith("section:")) return { parts: ["sections"], blocks: [`sections.${busy.slice(8)}`], fields: [] };
  if (busy.startsWith("field:")) {
    const path = busy.slice(6);
    const k = partOfPath(path);
    return { parts: k ? [k] : [], blocks: [], fields: [path] };
  }
  const k = (PART_KEYS as readonly string[]).includes(busy) ? (busy as PartKey) : null;
  return k ? { parts: [k], blocks: blocksOf(k), fields: [] } : none;
}

/** The shape a picture is made in for its slot (the page draws them 4:3 - the closest the model makes). */
export const PICTURE_ASPECT = "3:2" as const;

export type PictureJob = { path: string; idea: string; aspect: typeof PICTURE_ASPECT };

/**
 * The pictures to make after the AI wrote a part (or the whole page): each slot of that part with an idea and no picture
 * yet - a picture the person chose is never replaced. The hero first, then the sections in their order; at most `max`.
 */
export function picturesToMake(f: Fields, run: string, id?: string | null, max = 6): PictureJob[] {
  const out: PictureJob[] = [];
  const add = (path: string) => {
    const p = getField(f, path) as Pic | undefined;
    if (p && !p.url && p.idea.trim()) out.push({ path, idea: p.idea.trim(), aspect: PICTURE_ASPECT });
  };
  if (run === "all" || run === "hero") add("hero.picture");
  if (run === "all" || run === "sections") for (const s of f.sections) add(`sections.${s.id}.picture`);
  if (run === "section" && id) add(`sections.${id}.picture`);
  return out.slice(0, max);
}

/** Every picture slot of the page, by path, with its picture - for the outline's "picture missing". */
export function pictureSlots(f: Fields): { path: string; pic: Pic }[] {
  return [{ path: "hero.picture", pic: f.hero.picture }, ...f.sections.map((s) => ({ path: `sections.${s.id}.picture`, pic: s.picture }))];
}

/* ── each block its own row (Content v5, 09.11.2026) ─────────────────── */
//
// SARCLA 09.11.2026: "each block should be a section - for example block 4 should be subdivided". The map lists the page's
// blocks one by one, in their order and numbered as on the page (Hero, Intro, the proof tiles, each text-and-picture
// section, the links, the questions, the call to action), then the search engine fields. A block with items opens into
// them: the tiles, the questions, the links - each its own row.

export type BlockKind = "hero" | "intro" | "benefits" | "text" | "texts" | "links" | "faq" | "cta" | "seo";
export const BLOCK_KIND_NAME: Record<BlockKind, string> = {
  hero: "Hero", intro: "Intro", benefits: "Proof tiles", text: "Text and picture", texts: "Text and picture", links: "Links to the shop",
  faq: "Questions", cta: "Call to action", seo: "Search engine fields",
};
/** What an item of a block is called ("Tile 3", "Question 2", "Link 1") and how the + says it. */
export const ITEM_NAME: Partial<Record<ListKey, string>> = { benefits: "Tile", faq: "Question", links: "Link" };

export type BlockInfo = {
  /** its key in the order ("hero", "intro", "sections.ab12", "sections" = the empty slot, ..., "seo") */
  key: string; kind: BlockKind;
  /** its number on the page (the search engine fields: none) */
  num: number | null;
  name: string; line: string; count: number | null; state: PartState; missing: number;
  /** its block in the preview (data-apx-b) - none for the search engine fields */
  preview: string | null;
  /** the list its items are in (tiles, links, questions) */
  list: ListKey | null;
};

const kindOf = (key: string): BlockKind => (key.startsWith("sections.") ? "text" : key === "sections" ? "texts" : (key as BlockKind));
/** A block's key as the preview names it (data-apx-b): the intro's block is "intro-block" ("intro" is its words). */
export const previewOf = (key: string): string | null => (key === "seo" ? null : key === "intro" ? "intro-block" : key);

/** Every block of the page in its order, numbered, with its state and a line of what it says - then the search engine fields. */
export function blocksOf(f: Fields): BlockInfo[] {
  const st = (written: boolean, started: boolean, missing = 0): PartState => (written ? (missing ? "picture" : "written") : started ? "partly" : "empty");
  const h = f.hero;
  const out: BlockInfo[] = blockOrder(f).map((key, i) => {
    const kind = kindOf(key);
    const base = { key, kind, num: i + 1, name: BLOCK_KIND_NAME[kind], preview: previewOf(key), list: null as ListKey | null, count: null as number | null, missing: 0 };
    if (key === "hero") {
      const missing = h.title.trim() && !h.picture.url ? 1 : 0;
      return { ...base, missing, line: words(h.title) || words(h.sub), state: st(!!h.title.trim(), !!(h.eyebrow.trim() || h.sub.trim() || h.button.label.trim() || h.picture.url), missing) };
    }
    if (key === "intro") return { ...base, line: words(f.intro), state: st(!!f.intro.trim(), false) };
    if (key === "benefits") {
      return { ...base, list: "benefits", count: f.benefits.length || null, line: words(f.benefitsTitle) || join(f.benefits.map((b) => b.title)),
        state: st(f.benefits.length > 0 && f.benefits.every((b) => b.title.trim()), f.benefits.length > 0 || !!f.benefitsTitle.trim()) };
    }
    if (kind === "text") {
      const s = f.sections.find((x) => `sections.${x.id}` === key)!;
      const done = !!(s.title.trim() && s.text.trim());
      const missing = (s.title.trim() || s.text.trim()) && !s.picture.url ? 1 : 0;
      return { ...base, missing, line: words(s.title) || words(s.text), state: st(done, !!(s.title.trim() || s.text.trim() || s.picture.url), missing) };
    }
    if (key === "sections") return { ...base, line: "", state: "empty" as PartState };
    if (key === "links") {
      return { ...base, list: "links", count: f.links.length || null, line: words(f.linksTitle) || join(f.links.map((l) => l.label)),
        state: st(f.links.length > 0 && f.links.every((l) => l.label.trim() && l.url), f.links.length > 0) };
    }
    if (key === "faq") {
      return { ...base, list: "faq", count: f.faq.length || null, line: words(f.faqTitle) || join(f.faq.map((q) => q.q)),
        state: st(f.faq.length > 0 && f.faq.every((q) => q.q.trim() && q.a.trim()), f.faq.length > 0) };
    }
    return { ...base, line: words(f.cta.title) || words(f.cta.text), state: st(!!f.cta.title.trim(), !!(f.cta.text.trim() || f.cta.button.label.trim())) };
  });
  out.push({ key: "seo", kind: "seo", num: null, name: BLOCK_KIND_NAME.seo, preview: null, list: null, count: null, missing: 0, line: words(f.seo.title),
    state: st(!!f.seo.title.trim() && !!f.seo.description.trim(), !!(f.seo.title.trim() || f.seo.description.trim())) });
  return out;
}

export type ItemInfo = { key: string; id: string; name: string; line: string; state: PartState; sel: string };

/** A block's items as rows: each tile, question or link - its name, a line of what it says, its state, its selection. */
export function itemsOf(f: Fields, list: ListKey): ItemInfo[] {
  const n = ITEM_NAME[list] ?? "Item";
  const st = (a: string, b: string): PartState => (a.trim() && b.trim() ? "written" : a.trim() || b.trim() ? "partly" : "empty");
  if (list === "benefits") return f.benefits.map((b, i) => ({ key: `benefits.${b.id}`, id: b.id, name: `${n} ${i + 1}`, line: words(b.title) || words(b.text), sel: `b:benefits.${b.id}`, state: st(b.title, b.text) }));
  if (list === "faq") return f.faq.map((q, i) => ({ key: `faq.${q.id}`, id: q.id, name: `${n} ${i + 1}`, line: words(q.q), sel: `b:faq.${q.id}`, state: st(q.q, q.a) }));
  if (list === "links") return f.links.map((l, i) => ({ key: `links.${l.id}`, id: l.id, name: `${n} ${i + 1}`, line: words(l.label) || l.url, sel: `f:links.${l.id}`, state: st(l.label, l.url) }));
  return [];
}

/** The block a field or a block of the preview belongs to: "sections.ab12.text" -> "sections.ab12", "benefits.x.title" ->
 * "benefits", "faqTitle" -> "faq", "intro-block" -> "intro", "seo.title" -> "seo". */
export function blockOfPath(path: string | null | undefined): string | null {
  const p = String(path ?? "").split(".");
  if (p[0] === "sections") return p[1] ? `sections.${p[1]}` : "sections";
  const k = p[0] === "benefitsTitle" ? "benefits" : p[0] === "linksTitle" ? "links" : p[0] === "faqTitle" ? "faq" : p[0] === "intro-block" ? "intro" : p[0];
  return ["hero", "intro", "benefits", "links", "faq", "cta", "seo"].includes(k) ? k : null;
}

/** The item a path is in ("benefits.x.title" -> "benefits.x", "links.y" -> "links.y"), or null. */
export function itemOfPath(path: string | null | undefined): string | null {
  const p = String(path ?? "").split(".");
  return (p[0] === "benefits" || p[0] === "faq" || p[0] === "links") && p[1] ? `${p[0]}.${p[1]}` : null;
}

/** The blocks of the map an AI run is writing (the studio's busy key) - they shimmer there and in the page. */
export function busyBlocks(busy: string | null, f: Fields): string[] {
  if (!busy) return [];
  if (busy === "all") return [...blockOrder(f), "seo"];
  if (busy === "sections") return blockOrder(f).filter((k) => k === "sections" || k.startsWith("sections."));
  if (busy.startsWith("section:")) return [`sections.${busy.slice(8)}`];
  if (busy.startsWith("field:")) { const b = blockOfPath(busy.slice(6)); return b ? [b] : []; }
  return ["hero", "intro", "benefits", "links", "faq", "cta", "seo"].includes(busy) ? [busy] : [];
}
