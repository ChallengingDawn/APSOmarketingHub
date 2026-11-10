// PAGE - THE MODULE LIBRARY AS THE AI'S PLANS USE IT (Content v7, 10.11.2026). Pure: relative imports only.
//
// SARCLA 10.11.2026 (his points 5 and 13): "the quality of generation is far from good"; "the block is what is going to
// make the difference - the AI could directly bring modules and adjust text". The AI composes with the module LIBRARY
// (builder B owns it: ../modules/registry.ts lists every module - id, category, name, what it needs, its settings schema,
// its defaults, its render) and never with a module name written here. This file is the ONE place the plans read the
// library through: `SOURCE` below - the registry since builder B pushed it (fc87262c); switching is one line.
//
// What a plan needs to know of a module, whatever the registry calls it:
//   id, category, name, note      what the AI is shown to choose by
//   needs                         products | categories | picture | text - what the hub fills it with from the shop
//   min, max                      how many items it shows (it waits for `min` before it goes on the page)
//   layouts                       its layouts by key
//   words                         the words it takes (its settings schema's word fields) - the AI writes these for the
//                                 page, in the page's language
// and what the hub does with one: make it (its defaults), draw it (its HTML), draw it as a skeleton while it fills, say
// what it still lacks, read a stored one back.

import { CATEGORIES, MODULES, countFor, gapOf, moduleDef } from "../modules/registry";
import { normalizeModule, newModule, isModuleType } from "../modules/model";
import { fitModule, renderModule, renderSkeleton } from "../modules/render";
import type { FieldSpec, ModuleRef, ModuleSettings, Point } from "../modules/types";

export type Need = "products" | "categories" | "picture" | "text";
/** The words a module takes (the plan's `words` object). */
export type WordKey = "eyebrow" | "title" | "text" | "button" | "button2" | "points" | "faq";
export const WORD_MAX: Record<WordKey, number> = { eyebrow: 40, title: 90, text: 400, button: 30, button2: 30, points: 6, faq: 8 };

/** One word field of a module, as the AI is told it. */
export type WordField = { key: WordKey; label: string; max: number; hint: string; red?: boolean; item?: { title: string; text: string } };

export type LibModule = {
  id: string;
  category: string;
  categoryName: string;
  name: string;
  note: string;
  needs: Need[];
  takes: "products" | "categories" | "none";
  min: number;
  max: number;
  layouts: { key: string; label: string }[];
  words: WordField[];
  /** its short settings by key (a badge's words, a colour) - words the AI may set, or one of the options */
  extras: { key: string; label: string; max: number; options: string[] }[];
};

/** A library the plans can read: its list, and what the hub does with one of its modules. */
export type LibrarySource = {
  list: () => LibModule[];
  make: (id: string, store: string) => ModuleRef | null;
  draw: (m: ModuleRef) => string;
  /** the module in its own shape, grey, with what is happening (busy: it moves) or why it cannot stand - the studio's
   * preview only (never Magento) */
  skeleton: (m: ModuleRef, text: string, busy: boolean) => string;
  /** the module made light enough for one element of the page (its last items out) */
  fit: (m: ModuleRef) => { m: ModuleRef; dropped: number };
  gap: (m: ModuleRef) => string;
  read: (raw: unknown) => ModuleRef | null;
  /** how many items a fill asks for, for its settings */
  count: (m: ModuleRef) => number;
};

/** The word fields of a settings schema (eyebrow, title, text, the buttons' words, points, questions). */
function wordsOfFields(fields: FieldSpec[]): WordField[] {
  const out: WordField[] = [];
  for (const f of fields) {
    if (f.kind === "eyebrow") out.push({ key: "eyebrow", label: f.label ?? "Small line above", max: f.max ?? 40, hint: f.hint ?? "1-3 words" });
    else if (f.kind === "title") out.push({ key: "title", label: f.label ?? "Headline", max: f.max ?? 90, hint: f.hint ?? "at most 8 words", red: !!f.red });
    else if (f.kind === "text") out.push({ key: "text", label: f.label ?? "Text", max: Math.min(f.max ?? 240, 600), hint: f.hint ?? "one or two short sentences" });
    else if (f.kind === "link") out.push({ key: "button", label: f.label ?? "Button", max: 30, hint: "the button's words, 1-3 words" });
    else if (f.kind === "link2") out.push({ key: "button2", label: f.label ?? "Second button", max: 30, hint: "a second button's words" });
    else if (f.kind === "points") out.push({ key: "points", label: f.label ?? "Points", max: Math.min(f.max ?? 6, 8), hint: f.hint ?? "short points", item: f.item });
    else if (f.kind === "faq") out.push({ key: "faq", label: f.label ?? "Questions", max: Math.min(f.max ?? 6, 8), hint: "questions buyers ask, each with a short answer" });
  }
  return out;
}

const registrySource: LibrarySource = {
  list: () => MODULES.map((d) => ({
    id: d.id, category: d.category, categoryName: CATEGORIES.find((c) => c.id === d.category)?.name ?? d.category,
    name: d.name, note: d.note, needs: [...d.needs] as Need[], takes: d.takes, min: d.min, max: d.max, layouts: d.layouts,
    words: wordsOfFields(d.fields),
    extras: d.fields.filter((f): f is Extract<FieldSpec, { kind: "extra" }> => f.kind === "extra").map((f) => ({ key: f.key, label: f.label, max: f.max ?? 60, options: (f.options ?? []).map((o) => o.key) })),
  })),
  make: (id, store) => (isModuleType(id) ? newModule(id, store) : null),
  draw: (m) => renderModule(m),
  skeleton: (m, text, busy) => renderSkeleton(m, busy ? { busy: text } : { reason: text }),
  fit: (m) => fitModule(m),
  gap: (m) => gapOf(m),
  read: (raw) => normalizeModule(raw),
  count: (m) => { const d = moduleDef(m.type); return d ? countFor(d, m.settings) : 6; },
};

/** THE library the plans use - one line to switch (builder B's registry since 10.11.2026). */
const SOURCE: LibrarySource = registrySource;

let held: LibModule[] | null = null;
export const library = (): LibModule[] => (held ??= SOURCE.list());
export const libModule = (id: string): LibModule | null => library().find((m) => m.id === id) ?? null;
export const makeModule = (id: string, store: string): ModuleRef | null => SOURCE.make(id, store);
export const drawModule = (m: ModuleRef): string => SOURCE.draw(m);
export const skeletonOf = (m: ModuleRef, text: string, busy = true): string => SOURCE.skeleton(m, text, busy);
export const fitModuleOf = (m: ModuleRef) => SOURCE.fit(m);
export const moduleGapOf = (m: ModuleRef): string => SOURCE.gap(m);
export const readModule = (raw: unknown): ModuleRef | null => SOURCE.read(raw);
export const fillCount = (m: ModuleRef): number => SOURCE.count(m);

/** A module's id as the AI may write it: its id, else its name ("Product row" -> "row"), else null. */
export function moduleIdOf(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const all = library();
  const low = s.toLowerCase().replace(/^id\s*/, "").replace(/^["']|["']$/g, "");
  return all.find((m) => m.id === low)?.id ?? all.find((m) => m.id.toLowerCase() === low || m.name.toLowerCase() === low)?.id ?? null;
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
 * address for its button (empty = its own). `extras`: its short settings by key (options checked). */
export function withWords(m: ModuleRef, w: Partial<PlanWords>, link = "", extras: { key: string; value: string }[] = []): ModuleRef {
  const lib = libModule(m.type);
  const field = (k: WordKey) => lib?.words.find((x) => x.key === k) ?? null;
  const s: ModuleSettings = { ...m.settings, link: { ...m.settings.link }, link2: { ...m.settings.link2 }, extra: { ...(m.settings.extra ?? {}) } };
  const put = (k: WordKey, v: string | undefined, set: (x: string) => void) => { const f = field(k); if (f && v && v.trim()) set(v.trim().slice(0, f.max + 10)); };
  put("eyebrow", w.eyebrow, (x) => { s.eyebrow = x; });
  put("title", w.title, (x) => { s.title = x; });
  put("text", w.text, (x) => { s.text = x; });
  put("button", w.button, (x) => { s.link.label = x; });
  put("button2", w.button2, (x) => { s.link2.label = x; });
  if (link && field("button")) s.link.url = link;
  const pf = field("points");
  if (pf && w.points?.some((p) => p.title.trim())) {
    const old = s.points;
    s.points = w.points.filter((p) => p.title.trim()).slice(0, pf.max).map((p, i): Point => ({ ...(old[i] ?? { icon: "check" }), title: p.title.trim().slice(0, 60), text: p.text.trim().slice(0, 160) }));
  }
  const qf = field("faq");
  if (qf && w.faq?.some((x) => x.q.trim() && x.a.trim())) s.faq = w.faq.filter((x) => x.q.trim() && x.a.trim()).slice(0, qf.max).map((x) => ({ q: x.q.trim().slice(0, 300), a: x.a.trim().slice(0, 1200) }));
  for (const e of extras) {
    const spec = lib?.extras.find((x) => x.key === e.key);
    const v = String(e.value ?? "").trim();
    if (!spec || !v) continue;
    if (spec.options.length && !spec.options.includes(v)) continue;
    s.extra[spec.key] = v.slice(0, spec.max);
  }
  return { type: m.type, settings: s };
}

/** The library as the AI is shown it: by category, each module one line - its id, what it is, what the hub fills it with,
 * its layouts and the words it takes. */
export function libraryText(list: LibModule[] = library()): string {
  const cats = [...new Set(list.map((m) => m.category))];
  return cats.map((c) => {
    const mods = list.filter((m) => m.category === c);
    return `${(mods[0]?.categoryName ?? c).toUpperCase()}:\n${mods.map((m) => {
      const fill = m.takes === "products" ? `the hub fills ${m.min}-${m.max} of the shop's products` : m.takes === "categories" ? `the hub fills ${m.min}-${m.max} of the shop's categories` : "";
      const pic = m.needs.includes("picture") ? "a photo from the shop" : "";
      const words = m.words.map((w) => `${w.key}${w.key === "points" || w.key === "faq" ? ` (up to ${w.max}${w.item ? `: "${w.item.title}" + "${w.item.text}"` : ""})` : ` (${w.max})`}${w.red ? " ==red== allowed" : ""}`).join(", ");
      const extras = m.extras.map((e) => `${e.key}${e.options.length ? ` = ${e.options.join("|")}` : ""}`).join(", ");
      return `- "${m.id}" ${m.name}: ${m.note}.${[fill, pic].filter(Boolean).length ? ` ${[fill, pic].filter(Boolean).join(", ")}.` : ""}${m.layouts.length > 1 ? ` Layouts: ${m.layouts.map((l) => l.key).join("|")}.` : ""} Words: ${words || "none"}.${extras ? ` Extras: ${extras}.` : ""}`;
    }).join("\n")}`;
  }).join("\n");
}

/** The first module of the library that fits a want (for the worked examples: never a name written here). */
export function pickModule(want: (m: LibModule) => boolean, not: string[] = []): LibModule | null {
  return library().find((m) => !not.includes(m.id) && want(m)) ?? null;
}
