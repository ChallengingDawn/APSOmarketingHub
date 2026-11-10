// PAGE - A BLOCK CHANGED INTO ANOTHER MODULE (Content v10, 10.11.2026). Pure: relative imports only - the tests run it.
//
// SARCLA 10.11.2026 (point 4): "when I edit a block I should be able to change it into other module compatible, in this to
// other Q&A". A block lists the modules that hold the SAME KIND OF CONTENT - its FAMILY - and switching keeps that content
// (its questions, its products, its words and picture, its points) and changes only the look; Undo brings the old one back.
//
//   products        a row, a bento, a carousel...           every module of the shop's products
//   categories      a mosaic, cards, tiles... (by what each category carries: its subcategories or its products)
//   questions       a Questions block, the FAQ modules      every Q&A module of the library
//   story           text and a picture                      the story modules (and the heroes and banners of words + picture)
//   points          proof tiles, promises, reasons, steps   every module of a list of points
//   figures         the shop's figures                      the modules of figures
//   sections        chapters, sections, groups              the modules of headed sections
//   table           a technical table                       the table modules
//   words           a headline, a line and a button         the calls to action
//
// A new page's own blocks switch too: its Questions block, a Text and picture block, its proof tiles and its call to
// action become a module of their family, their words carried in (moduleFromBlock).

import type { Fields } from "../fields";
import { normalizeModule, newModule } from "./model";
import { MODULES, categoryOf, fieldOf, hasField, moduleDef } from "./registry";
import { renderModule } from "./render";
import type { Card, ModuleDef, ModuleRef, ModuleSettings } from "./types";

export type Family = "products" | "categories-subs" | "categories-products" | "questions" | "story" | "points" | "figures" | "sections" | "table" | "words";

/** What a family's content is called, for "Keeps the same …". */
export const FAMILY_WORDS: Record<Family, string> = {
  products: "its products", "categories-subs": "its categories", "categories-products": "its categories and their products", questions: "its questions",
  story: "its words and picture", points: "its points", figures: "its figures", sections: "its sections", table: "its table", words: "its words and button",
};

/** Modules of words and a picture whose picture is something else (a video's thumbnail, a brochure's cover...). */
const NOT_STORY = new Set(["media-video", "act-brochure", "tech-specs", "help-howto"]);
/** Lists of points that are not two lines of words (pictures, logos, quotes, file types, one icon). */
const NOT_POINTS = new Set(["media-mosaic", "media-strip", "media-duo", "media-videos", "brand-quotes", "brand-wall", "tool-upload", "act-inline", "help-search", "tool-downloads", "tech-compare", "ind-matrix", "ind-cloud", "act-newsletter", "act-pair", "campaign-duo"]);

/** The family of a module of the library - null when it holds content no other module holds. */
export function familyOf(d: ModuleDef): Family | null {
  if (d.takes === "products") return "products";
  if (d.takes === "categories") return d.kids === "products" ? "categories-products" : "categories-subs";
  const faq = fieldOf(d, "faq");
  if (faq && /question|term/i.test(faq.label ?? "Questions")) return "questions";
  if (faq && /chapter|section|group|side|application/i.test(faq.label ?? "")) return "sections";
  if (hasField(d, "table")) return "table";
  if (hasField(d, "feature") && hasField(d, "title") && hasField(d, "text") && !NOT_STORY.has(d.id) && !faq) return "story";
  const pts = fieldOf(d, "points");
  if (pts && /figure/i.test(pts.label ?? "")) return "figures";
  if (pts && pts.item?.text && !NOT_POINTS.has(d.id) && !faq && !hasField(d, "feature")) return "points";
  if (!pts && !faq && !hasField(d, "feature") && hasField(d, "title") && hasField(d, "link")) return "words";
  return null;
}

/** A new page's own block's family (its Questions, a Text and picture, its proof tiles, its call to action). */
export function blockFamily(key: string): Family | null {
  if (key === "faq") return "questions";
  if (key.startsWith("sections.")) return "story";
  if (key === "benefits") return "points";
  if (key === "cta") return "words";
  return null;
}

/* ── the choices ──────────────────────────────────────────────────────── */

export type SwitchOption = {
  def: ModuleDef;
  /** said under its thumbnail: what it does with the content ("Shows 4 of your 6 products") - "" when it all fits */
  note: string;
  /** it needs more than there is (it waits until filled) */
  short: boolean;
};

/** How many items or points a module of this kind shows at most, and needs at least. */
function room(d: ModuleDef, s: ModuleSettings): { kind: string; have: number; min: number; max: number } | null {
  if (d.takes === "products") return { kind: "product", have: s.items.length, min: Math.max(1, d.min), max: d.max };
  if (d.takes === "categories") return { kind: "category", have: s.items.length, min: Math.max(1, d.min), max: d.max };
  const p = fieldOf(d, "points");
  if (p && (familyOf(d) === "points" || familyOf(d) === "figures")) return { kind: "point", have: s.points.filter((x) => x.title.trim() || x.text.trim()).length, min: p.min ?? 0, max: p.max ?? 12 };
  const q = fieldOf(d, "faq");
  if (q) return { kind: familyOf(d) === "questions" ? "question" : "section", have: s.faq.filter((x) => x.q.trim()).length, min: 0, max: q.max ?? 12 };
  return null;
}
const plural = (n: number, w: string) => `${n} ${w === "category" ? (n === 1 ? "category" : "categories") : `${w}${n === 1 ? "" : "s"}`}`;

/** What a module would do with this content: all of it, the first ones only, or wait for more. */
export function fitNote(d: ModuleDef, s: ModuleSettings): { note: string; short: boolean } {
  const r = room(d, s);
  if (r && r.have > r.max && r.max > 0) return { note: `Shows ${r.max} of your ${plural(r.have, r.kind)}`, short: false };
  if (r && r.have < r.min) return { note: `Needs ${plural(r.min, r.kind)} - ${r.have ? `you have ${r.have}` : "none yet"}`, short: true };
  if (hasField(d, "feature") && !s.feature?.img && (d.needs.includes("picture"))) return { note: "Needs a picture", short: true };
  return { note: "", short: false };
}

/** The modules a module can become: its family's, its own category's first - none when its content is its own. */
export function compatibleModules(m: ModuleRef): SwitchOption[] {
  const d = moduleDef(m.type);
  if (!d) return [];
  const fam = familyOf(d);
  if (!fam) return [];
  return rank(MODULES.filter((x) => x.id !== d.id && familyOf(x) === fam), d.category).map((x) => ({ def: x, ...fitNote(x, m.settings) }));
}

/** The modules a new page's own block can become (its words carried in - moduleFromBlock). */
export function compatibleWithBlock(f: Fields, key: string, store: string): SwitchOption[] {
  const fam = blockFamily(key);
  if (!fam) return [];
  const home = fam === "questions" ? "help" : fam === "story" ? "stories" : fam === "points" ? "trust" : "cta";
  return rank(MODULES.filter((x) => familyOf(x) === fam), home).map((x) => {
    const m = moduleFromBlock(f, key, x.id, store);
    return { def: x, ...(m ? fitNote(x, m.settings) : { note: "", short: false }) };
  });
}

/** Its own category first, then the library's order (the Modules tab's). */
function rank(list: ModuleDef[], category: string): ModuleDef[] {
  return [...list.filter((x) => x.category === category), ...list.filter((x) => x.category !== category)];
}

/* ── switching: the content kept, the look changed ────────────────────── */

/**
 * The module as another of its family: every word, product, question and point kept, its first layout (or the same one
 * when the other has it). A module that shows fewer keeps the first ones - Undo brings the others back. What a person set
 * on it (its words' and buttons' looks, its questions open or closed) comes with it; its split belongs to its columns.
 */
export function switchModule(m: ModuleRef, type: string): ModuleRef {
  const to = moduleDef(type);
  if (!to) return m;
  const s = m.settings;
  const extra: Record<string, string> = { ...s.extra };
  delete extra.split;
  const layout = to.layouts.some((l) => l.key === s.layout) ? s.layout : to.layouts[0]?.key ?? "";
  const raw: ModuleRef = { type: to.id, settings: { ...s, layout, extra } };
  return normalizeModule(raw) ?? raw;
}

/* ── a new page's own block as a module ───────────────────────────────── */

/** A new page's words as a module writes them: its marks (**bold**, *italic*, [a link](...)) taken out. */
export function plainWords(t: string): string {
  return String(t ?? "").replace(/\[([^\]\n]{1,120})\]\([^)\s]{1,600}\)/g, "$1").replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/(^|[^*\w])\*([^*\n]+)\*(?![*\w])/g, "$1$2").trim();
}

/** A picture of the page as a module's picture: the hub's own or the shop's (a module shows nothing else). */
function featureOf(url: string, name: string, store: string): Card | null {
  if (!url) return null;
  return { kind: "category", name: name.slice(0, 200) || "Bild", url: `https://www.apsoparts.com/${store.split("/")[0]}/`, img: url, meta: "", number: "", children: [] };
}

/** A new page's own block (its Questions, a Text and picture, its proof tiles, its call to action) as a module of the
 * library - its words carried in; null when the block is not one of those. */
export function moduleFromBlock(f: Fields, key: string, type: string, store: string): ModuleRef | null {
  const to = moduleDef(type);
  if (!to || !blockFamily(key)) return null;
  const base = newModule(to.id, store);
  const s: ModuleSettings = { ...base.settings };
  if (key === "faq") {
    s.title = f.faqTitle.trim();
    s.faq = f.faq.filter((q) => q.q.trim()).map((q) => ({ q: q.q.trim(), a: plainWords(q.a) }));
  } else if (key.startsWith("sections.")) {
    const sec = f.sections.find((x) => `sections.${x.id}` === key);
    if (!sec) return null;
    s.title = sec.title.trim();
    s.text = plainWords(sec.text);
    s.feature = featureOf(sec.picture.url, sec.picture.alt || sec.title, store);
    if (to.layouts.some((l) => l.key === sec.side)) s.layout = sec.side;
  } else if (key === "benefits") {
    s.title = f.benefitsTitle.trim() || s.title;
    s.points = f.benefits.filter((b) => b.title.trim() || b.text.trim()).map((b) => ({ title: b.title.trim(), text: plainWords(b.text), icon: "check" }));
  } else if (key === "cta") {
    s.title = f.cta.title.trim();
    s.text = plainWords(f.cta.text);
    if (f.cta.button.label.trim()) s.link = { label: f.cta.button.label.trim(), url: f.cta.button.url };
  }
  return normalizeModule({ type: to.id, settings: s });
}

/* ── questions: all open or all closed ────────────────────────────────── */

const QA_HAS_DETAILS = new Map<string, boolean>();

/** Does this module draw its questions as ones that open on a click (so "All closed / All open" applies)? */
export function questionsToggle(type: string): boolean {
  const known = QA_HAS_DETAILS.get(type);
  if (known !== undefined) return known;
  const d = moduleDef(type);
  let yes = false;
  if (d && hasField(d, "faq")) {
    const m = newModule(type, "de-CH");
    const probe: ModuleRef = { ...m, settings: { ...m.settings, title: "Fragen", faq: [{ q: "Frage eins?", a: "Antwort eins." }, { q: "Frage zwei?", a: "Antwort zwei." }] } };
    try { yes = /<details\b/.test(renderModule(probe)); } catch { yes = false; }
  }
  QA_HAS_DETAILS.set(type, yes);
  return yes;
}

/** A family's name, for the popup's line ("Questions & answers"). */
export function familyName(f: Family): string {
  return { products: "Product showcases", "categories-subs": "Category modules", "categories-products": "Category modules", questions: "Questions & answers", story: "Text and picture", points: "Lists of points", figures: "Figures", sections: "Headed sections", table: "Tables", words: "Calls to action" }[f];
}

/** The category a module is in, by name (for the list's small line). */
export const categoryName = (d: ModuleDef) => categoryOf(d.category)?.name ?? "";
