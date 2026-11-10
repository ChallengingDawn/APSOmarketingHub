// PAGE - THE MODULE LIBRARY AS THE AI'S PLANS USE IT (Content v7, 10.11.2026). Pure: relative imports only.
//
// SARCLA 10.11.2026 (his points 5 and 13): "the quality of generation is far from good"; "the block is what is going to
// make the difference - the AI could directly bring modules and adjust text". The AI composes with the module LIBRARY
// (builder B owns it: one registry listing every module - id, category, name, what it needs, its settings, its render)
// and never with a module name written here. This file is the ONE place the plans read the library through: `SOURCE`
// below. Until B's registry is pushed it is the v6 gallery's list (./modules/model.ts MODULE_KINDS, ./modules/render.ts);
// switching to the registry is one line (SOURCE = registrySource).
//
// What a plan needs to know of a module, whatever the registry calls it:
//   id, category, name, note      what the AI is shown to choose by (never a hard-coded name in the prompt)
//   needs                         products | categories | picture | text - what the hub fills it with from the shop
//   min, max                      how many items it shows (it waits for `min` before it goes on the page)
//   layouts                       its layouts by key
//   words                         the words it takes - the AI writes these for the page, in the page's language
// and the four things the hub does with one: make it (its defaults), draw it (its HTML), say what it still lacks, read a
// stored one back.

import { MODULE_KINDS, isModuleType, moduleGap, newModule, normalizeModule, type ModuleRef, type ModuleSettings, type Point } from "../modules/model";
import { renderModule } from "../modules/render";

export type Need = "products" | "categories" | "picture" | "text";
/** The words a module takes (the plan's `words` object): what each is, and its most characters. */
export type WordKey = "eyebrow" | "title" | "text" | "button" | "button2" | "points" | "faq";
export const WORD_MAX: Record<WordKey, number> = { eyebrow: 40, title: 90, text: 400, button: 30, button2: 30, points: 60, faq: 400 };
export const WORD_NOTE: Record<WordKey, string> = {
  eyebrow: "a small line above the title, 1-3 words",
  title: "the heading, at most 8 words",
  text: "one or two short sentences",
  button: "the button's words, 1-3 words",
  button2: "a second button's words",
  points: "2-4 short points: title (2-4 words) and text (a few words)",
  faq: "3-5 questions buyers ask, each with a short answer",
};

export type LibModule = {
  id: string;
  category: string;
  name: string;
  note: string;
  needs: Need[];
  min: number;
  max: number;
  layouts: { key: string; label: string }[];
  words: WordKey[];
};

/** A library the plans can read: its list, and what the hub does with one of its modules. */
export type LibrarySource = {
  list: () => LibModule[];
  /** a new module of this id for a store view (its defaults), or null when the library has no such id */
  make: (id: string, store: string) => ModuleRef | null;
  /** its HTML: ONE element with its own <style>, as the shop gets it */
  draw: (m: ModuleRef) => string;
  /** what still keeps it off the page ("" = ready) */
  gap: (m: ModuleRef) => string;
  /** a stored module read back (null = not one) */
  read: (raw: unknown) => ModuleRef | null;
};

/* ── today: the v6 gallery's ten modules (builder B's registry replaces this) ── */

/** The v6 gallery's modules as library entries - the categories are data here, as the registry will have them. */
const V6_CATEGORY: Record<string, string> = {
  finder: "Categories", mosaic: "Categories", cards: "Categories",
  bento: "Products", row: "Products",
  banner: "Campaign", cta: "Campaign",
  usp: "Trust", textpic: "Text", faq: "Text",
};

const v6Source: LibrarySource = {
  list: () => MODULE_KINDS.map((k) => {
    const needs: Need[] = [];
    if (k.takes === "products") needs.push("products");
    if (k.takes === "categories") needs.push("categories");
    if (k.fields.includes("feature")) needs.push("picture");
    if (k.fields.some((f) => f === "title" || f === "text" || f === "faq" || f === "points")) needs.push("text");
    const words: WordKey[] = [];
    if (k.fields.includes("eyebrow")) words.push("eyebrow");
    if (k.fields.includes("title")) words.push("title");
    if (k.fields.includes("text")) words.push("text");
    if (k.fields.includes("link")) words.push("button");
    if (k.fields.includes("link2")) words.push("button2");
    if (k.fields.includes("points")) words.push("points");
    if (k.fields.includes("faq")) words.push("faq");
    return { id: k.type, category: V6_CATEGORY[k.type] ?? "Other", name: k.name, note: k.note, needs, min: k.min, max: k.max, layouts: k.layouts, words };
  }),
  make: (id, store) => (isModuleType(id) ? newModule(id, store) : null),
  draw: (m) => renderModule(m),
  gap: (m) => moduleGap(m),
  read: (raw) => normalizeModule(raw),
};

/** THE library the plans use - one line to switch to builder B's registry. */
const SOURCE: LibrarySource = v6Source;

export const library = (): LibModule[] => SOURCE.list();
export const libModule = (id: string): LibModule | null => library().find((m) => m.id === id) ?? null;
export const makeModule = (id: string, store: string): ModuleRef | null => SOURCE.make(id, store);
export const drawModule = (m: ModuleRef): string => SOURCE.draw(m);
export const moduleGapOf = (m: ModuleRef): string => SOURCE.gap(m);
export const readModule = (raw: unknown): ModuleRef | null => SOURCE.read(raw);

/** A module's id as the AI may write it: its id, else its name ("Product row" -> "row"), else null. */
export function moduleIdOf(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const all = library();
  const low = s.toLowerCase();
  return all.find((m) => m.id === s)?.id ?? all.find((m) => m.id.toLowerCase() === low || m.name.toLowerCase() === low)?.id ?? null;
}

/* ── the words a plan writes, put into a module ───────────────────────── */

export type PlanWords = {
  eyebrow: string; title: string; text: string; button: string; button2: string;
  points: { title: string; text: string }[];
  faq: { q: string; a: string }[];
};
export const emptyWords = (): PlanWords => ({ eyebrow: "", title: "", text: "", button: "", button2: "", points: [], faq: [] });

/** A module's words now, as a plan reads them (to adjust the words of a module already on the page). */
export function wordsOfModule(m: ModuleRef): PlanWords {
  const s = m.settings;
  return {
    eyebrow: s.eyebrow, title: s.title, text: s.text, button: s.link.label, button2: s.link2.label,
    points: s.points.map((p) => ({ title: p.title, text: p.text })), faq: s.faq.map((x) => ({ q: x.q, a: x.a })),
  };
}

/** The module with the plan's words in it: only the words it takes; a word left empty keeps what it had. `link`: a shop
 * address for its button (empty = its own). */
export function withWords(m: ModuleRef, w: Partial<PlanWords>, link = ""): ModuleRef {
  const lib = libModule(m.type);
  const takes = new Set<WordKey>(lib?.words ?? []);
  const s: ModuleSettings = { ...m.settings, link: { ...m.settings.link }, link2: { ...m.settings.link2 } };
  const put = (k: WordKey, v: string | undefined, set: (x: string) => void) => { if (takes.has(k) && v && v.trim()) set(v.trim().slice(0, WORD_MAX[k] + 20)); };
  put("eyebrow", w.eyebrow, (x) => { s.eyebrow = x; });
  put("title", w.title, (x) => { s.title = x; });
  put("text", w.text, (x) => { s.text = x; });
  put("button", w.button, (x) => { s.link.label = x; });
  put("button2", w.button2, (x) => { s.link2.label = x; });
  if (link && takes.has("button")) s.link.url = link;
  if (takes.has("points") && w.points?.some((p) => p.title.trim())) {
    const icons = s.points.map((p) => p.icon);
    s.points = w.points.filter((p) => p.title.trim()).slice(0, 6).map((p, i): Point => ({ title: p.title.trim().slice(0, 60), text: p.text.trim().slice(0, 120), icon: icons[i] ?? "check" }));
  }
  if (takes.has("faq") && w.faq?.some((x) => x.q.trim() && x.a.trim())) s.faq = w.faq.filter((x) => x.q.trim() && x.a.trim()).slice(0, 8).map((x) => ({ q: x.q.trim().slice(0, 300), a: x.a.trim().slice(0, 1500) }));
  return { type: m.type, settings: s };
}

/** The library as the AI is shown it: by category, each module one line - its id, what it is, what the hub fills it with,
 * its layouts and the words it takes. */
export function libraryText(list: LibModule[] = library()): string {
  const cats = [...new Set(list.map((m) => m.category))];
  return cats.map((c) => `${c.toUpperCase()}:\n${list.filter((m) => m.category === c).map((m) => {
    const fill = m.needs.includes("products") ? `the hub fills ${m.min}-${m.max} products` : m.needs.includes("categories") ? `the hub fills ${m.min}-${m.max} categories` : "no products";
    return `- id "${m.id}" · ${m.name}: ${m.note}. ${fill}${m.needs.includes("picture") ? ", a picture from the shop" : ""}. Layouts: ${m.layouts.map((l) => `"${l.key}" (${l.label})`).join(", ")}. Words: ${m.words.join(", ") || "none"}.`;
  }).join("\n")}`).join("\n");
}
