// PAGE - A NEW PAGE'S OUTLINE (08.11.2026, evening). Pure: tests/studio-page-outline.test.ts.
//
// SARCLA 08.11.2026: "The UX and the Build on the left: can we improve it to be more fluid, subdivided". The left pane is
// no longer a wall of field cards: it is the page's parts in a short list - Hero, Intro, Benefits, Sections, Links,
// Questions, Call to action, Search engines - each saying how far it is (written, empty, a picture missing, being written
// by the AI). A click opens that part alone and selects it in the preview. And "AI wrote the whole page ... It's not
// generating photos": the picture slots the AI gave an idea for are listed here, to be made without another click.

import { getField, type Fields, type Pic } from "./fields";

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
