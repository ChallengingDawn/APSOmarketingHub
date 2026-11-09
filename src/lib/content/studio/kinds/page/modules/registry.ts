// PAGE - THE MODULE REGISTRY (Content v7, 10.11.2026). Pure, shared with the browser, the server and the tests.
//
// SARCLA 10.11.2026: "create more than 100 modules subdivided by categories, really high end" (point 1), "put the modules in
// the right side bar after the assistant" (point 3), "the AI could bring modules and adjust the text" (point 13). ONE place
// that lists every module of the library - its id, category, name, what it needs, its settings schema, its defaults and
// how it is drawn - read GENERICALLY by everyone:
//   the Modules tab        categories in order, a search, the thumbnails (/content/modules/<id>.webp)
//   the Build pane         a module's settings drawn from its `fields`
//   the AI (builder A)     picks a module by what it needs and fills its fields - it never hard-codes a module's name
//   the renderer           drawModule(): the module's own render inside ONE element with the kit's base rules
// The modules themselves are in ./lib/*.ts, collected by ./library.ts.

import { BASE, cssStr, drawing, minifyCss, wordsFor } from "./kit";
import { LIBRARY } from "./library";
import type { CategoryId, FieldSpec, ModuleDef, ModuleRef, ModuleSettings, Need, Opts } from "./types";

export type { CategoryId, FieldSpec, ModuleDef, Need } from "./types";

/* ── the categories, in their order ────────────────────────────────────── */

export type Category = { id: CategoryId; name: string; note: string };

/** The library's categories as the Modules tab shows them, in this order. */
export const CATEGORIES: Category[] = [
  { id: "heroes", name: "Heroes & intros", note: "The top of a page: a headline, a picture, the first step" },
  { id: "showcases", name: "Product showcases", note: "The shop's products in rows, grids, a spotlight, carousels" },
  { id: "bentos", name: "Bentos", note: "Tiles of different sizes: a big one and the products around it" },
  { id: "navigation", name: "Category navigation", note: "Finders, mosaics, cards, tiles and lists of the shop's categories" },
  { id: "campaigns", name: "Campaigns & banners", note: "A campaign's banner, a strip, a countdown - never a discount value" },
  { id: "trust", name: "Trust & reasons to buy", note: "The shop's promises and its real numbers" },
  { id: "stories", name: "Content & stories", note: "Words and pictures: an article, a story, a quote" },
  { id: "technical", name: "Technical & comparison", note: "Tables, materials side by side, specifications" },
  { id: "tools", name: "Tools & services", note: "DirectCUT, DirectUP, the O-Ring Expert, the quick order" },
  { id: "help", name: "Help & FAQ", note: "Questions and answers, contact, how it works" },
  { id: "cta", name: "Calls to action & sign-ups", note: "The next step: a button, a band, a sign-up" },
  { id: "industries", name: "Industries & applications", note: "Where the parts work: food, pharma, machines" },
  { id: "references", name: "References & brands", note: "The brands the shop carries, customers' words" },
  { id: "media", name: "Media", note: "Video, a gallery, downloads" },
];
export const categoryOf = (id: string): Category | null => CATEGORIES.find((c) => c.id === id) ?? null;

/* ── the modules ───────────────────────────────────────────────────────── */

const ID_RE = /^[a-z][a-z0-9-]{1,39}$/;

/** Every module of the library, checked once: a module with a bad id, an unknown category or an id taken twice is left
 * out (and said on the console) - one wrong file never breaks the gallery. */
export const MODULES: ModuleDef[] = (() => {
  const seen = new Set<string>();
  const out: ModuleDef[] = [];
  for (const d of LIBRARY) {
    const why = !ID_RE.test(d.id) ? "a bad id" : seen.has(d.id) ? "an id taken twice" : !categoryOf(d.category) ? `an unknown category "${d.category}"` : "";
    if (why) { if (typeof console !== "undefined") console.warn(`module "${d.id}" left out: ${why}`); continue; }
    seen.add(d.id);
    out.push(d);
  }
  return out;
})();
const BY_ID = new Map(MODULES.map((d) => [d.id, d]));

/** A module by its id (a change's `module.type`), or null. */
export const moduleDef = (id: unknown): ModuleDef | null => (typeof id === "string" ? BY_ID.get(id) ?? null : null);
export const isModuleType = (v: unknown): v is string => !!moduleDef(v);

/** The modules of a category, in the library's order. */
export const modulesIn = (category: CategoryId): ModuleDef[] => MODULES.filter((d) => d.category === category);

/** The categories that hold modules, each with its modules - what the Modules tab lists. */
export function libraryByCategory(): { category: Category; modules: ModuleDef[] }[] {
  return CATEGORIES.map((category) => ({ category, modules: modulesIn(category.id) })).filter((x) => x.modules.length);
}

/** The modules a search finds: by name, line, tags, category - every word must be somewhere. */
export function searchModules(q: string): ModuleDef[] {
  const want = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!want.length) return MODULES;
  return MODULES.filter((d) => {
    const hay = [d.name, d.note, d.id, categoryOf(d.category)?.name ?? "", ...(d.tags ?? []), ...d.needs].join(" ").toLowerCase();
    return want.every((w) => hay.includes(w));
  });
}

/** Its picture in the gallery (made by the static harness from the module itself, with the shop's real de-CH data). */
export const thumbOf = (id: string) => `/content/modules/${id}.webp`;

/** How many items a fill asks for. */
export const countFor = (d: ModuleDef, s: ModuleSettings): number => Math.max(d.min, Math.min(d.max || 12, d.count ? d.count(s) : d.max));

/** The fields a module shows (its schema) - by kind. */
export const hasField = (d: ModuleDef, kind: FieldSpec["kind"]) => d.fields.some((f) => f.kind === kind);
export const fieldOf = <K extends FieldSpec["kind"]>(d: ModuleDef, kind: K) => d.fields.find((f) => f.kind === kind) as Extract<FieldSpec, { kind: K }> | undefined;

/** What still keeps a module from standing on a page: no products yet, no words... - "" when it is ready. */
export function gapOf(m: ModuleRef): string {
  const d = moduleDef(m.type);
  if (!d) return "This module is not in the library any more";
  const s = m.settings;
  if (d.takes !== "none" && s.items.length < Math.max(1, d.min)) return d.takes === "products" ? "Fill it with products first" : "Pick its categories first";
  const own = d.gap?.(m);
  if (own) return own;
  if (d.needs.includes("text") && !s.title.trim()) return "Give it a headline";
  if (d.needs.includes("picture") && !s.feature?.img) return "Give it a picture";
  return "";
}

/** What a module needs, in words ("Fills with products", "A headline and a picture"). */
export function needsLine(d: ModuleDef): string {
  const w: Record<Need, string> = { products: "products", categories: "categories", picture: "a picture", text: "a headline" };
  if (d.takes === "products") return "Fills with products";
  if (d.takes === "categories") return "Fills with categories";
  const n = d.needs.filter((x) => x === "text" || x === "picture").map((x) => w[x]);
  return n.length ? `Needs ${n.join(" and ")}` : "Ready as it is";
}

/* ── drawing ───────────────────────────────────────────────────────────── */

/** The module's CSS and inner HTML, its rules under its own class. */
export function drawModule(m: ModuleRef, o: Opts = {}): { cls: string; css: string; html: string } {
  const cls = `apx-${m.settings.id}`;
  const d = moduleDef(m.type);
  const w = wordsFor(m.settings.store);
  drawing.store = m.settings.store;
  let r: { html: string; css: string };
  try { r = d ? d.render(m, o) : { html: "", css: "" }; } finally { drawing.store = null; }
  const css = minifyCss(`${BASE}${r.css}`.replace(/%GOCAT%/g, cssStr(w.goCat)).replace(/%GO%/g, cssStr(w.go))).split("@@").join(`.${cls}`);
  return { cls, css, html: r.html };
}
