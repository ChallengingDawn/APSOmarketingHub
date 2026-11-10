// PAGE - THE GALLERY'S MODULES (Content v6, 09.11.2026; a library since Content v7, 10.11.2026). Pure, shared with the
// browser and the tests: relative imports only.
//
// SARCLA 09.11.2026 (on the Page builder, the de-CH home page): "On this CMS we should be able to add new modal and replace
// the old one - we should have a gallery of forms like bentos and much more", "fill the product of the bento or other by
// hierarchy like on the bento", "fill most viewed / most bought, automatically or by article or product number", "we
// should really be able to add elements". And the bar he named: the two home page versions built from the home page kit
// (C:\dev\_archive\apsoparts\shop-project\home-page-2026, s15 "Calm drill-down" and s17 "Technology mosaic") - "the
// versions were really good". SARCLA 10.11.2026 (point 1): "create more than 100 modules subdivided by categories, really
// high end" - the ten modules became a LIBRARY: each a file of ./lib/, listed by ./registry.ts (its id, category, name,
// needs, settings schema, defaults, render). A module's type is its registry id; this file keeps what every module shares.
//
// On a page of the shop a module is a Change (src/lib/convert/versions.ts): `insert` at a place or `replace` an element, the
// module's settings kept beside it (`module`) so it opens again for editing (the shared interface of the Content v6 brief).
// Its products and categories are the SHOP's: name, photo, link and the shop's own count ("702 Artikel") read from the
// shop's pages - never a price, never stock, never a product the shop does not have (./parse.ts, ./source.ts).

import { ICONS as KIT_ICONS, wordsFor as kitWords, type Words as KitWords } from "./kit";
import { MODULES, gapOf, isModuleType as inLibrary, moduleDef } from "./registry";
import type { Card, FillHow, ModuleDef, ModuleRef, ModuleSettings, Point } from "./types";

export type { Card, Fill, FillHow, ModuleRef, ModuleSettings, Point, Qa, Takes } from "./types";

/** A module's type: its registry id ("row", "hero-split"). */
export type ModuleType = string;
export const isModuleType = (v: unknown): v is ModuleType => inLibrary(v);
/** Every module of the library (the registry's list). */
export const MODULE_KINDS: ModuleDef[] = MODULES;
/** A module's entry in the library - the first one when the type is not (any more) in it. */
export const kindOf = (t: ModuleType): ModuleDef => moduleDef(t) ?? MODULES[0];

export type Words = KitWords;
export const wordsFor = kitWords;
export const ICONS = KIT_ICONS;

/* ── a module made, read back, checked ─────────────────────────────────── */

/** A short random id - letters and digits, a letter first (it is a CSS class). */
export const moduleId = () => `m${Math.random().toString(36).slice(2, 6).padEnd(4, "0")}`;

const emptyLink = () => ({ label: "", url: "" });

/** A new module of a type, for a store view: empty items, its first layout, its defaults (the words a person starts from). */
export function newModule(type: ModuleType, store: string, id = moduleId()): ModuleRef {
  const k = kindOf(type);
  const settings: ModuleSettings = {
    id, store, eyebrow: "", title: "", text: "", link: emptyLink(), link2: emptyLink(), layout: k.layouts[0]?.key ?? "",
    items: [], feature: null, points: [], faq: [], fill: null, extra: {}, table: [],
  };
  const d = k.defaults?.(store) ?? {};
  return { type: k.id, settings: { ...settings, ...d, id, store } };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** An address a module may carry: the shop's own (www or acc), or a path on it - nothing else. */
export function shopAddress(v: unknown): string {
  const s = str(v, 600).trim();
  if (!s) return "";
  if (/^https:\/\/(www|acc)\.apsoparts\.com(\/[^\s"'<>]*)?$/i.test(s)) return s;
  if (/^\/[^/\s"'<>][^\s"'<>]*$/.test(s)) return s;
  return "";
}
/** A picture a module may show: the shop's media, or the hub's own picture store (it goes to Magento's media on publish). */
export function pictureAddress(v: unknown): string {
  const s = str(v, 600).trim();
  if (/^https:\/\/(www|acc)\.apsoparts\.com\/media\/[^\s"'<>]+$/i.test(s)) return s;
  if (/^\/api\/content\/picture\/[\w-]+$/.test(s)) return s;
  return "";
}

function cardOf(v: unknown, depth = 0): Card | null {
  if (!isObj(v)) return null;
  const url = shopAddress(v.url);
  const name = str(v.name, 200).trim();
  if (!name || !url) return null;
  return {
    kind: v.kind === "category" ? "category" : "product",
    name, url, img: pictureAddress(v.img), meta: str(v.meta, 60).trim(),
    number: /^\d{8}$/.test(String(v.number ?? "")) ? String(v.number) : "",
    children: depth < 1 && Array.isArray(v.children) ? v.children.map((c) => cardOf(c, depth + 1)).filter((c): c is Card => !!c).slice(0, 8) : [],
    // a picture's origin (Content v12, ./follow.ts): the fill's follows the products, the person's stays
    ...(v.from === "fill" || v.from === "person" ? { from: v.from } : {}),
  };
}

function linkOf(v: unknown) {
  const o = isObj(v) ? v : {};
  return { label: str(o.label, 60), url: shopAddress(o.url) };
}

function pointOf(p: Record<string, unknown>): Point {
  const out: Point = { title: str(p.title, 80), text: str(p.text, 240), icon: (KIT_ICONS as readonly string[]).includes(String(p.icon)) ? String(p.icon) : "check" };
  const img = pictureAddress(p.img);
  const url = shopAddress(p.url);
  if (img) out.img = img;
  if (url) out.url = url;
  return out;
}

/** Any stored module as a module: unknown values left out, lists capped (a module is one element on the page). */
export function normalizeModule(raw: unknown): ModuleRef | null {
  if (!isObj(raw) || !isModuleType(raw.type)) return null;
  const k = kindOf(raw.type);
  const s = isObj(raw.settings) ? raw.settings : {};
  const id = typeof s.id === "string" && /^[a-z][a-z0-9]{2,11}$/.test(s.id) ? s.id : moduleId();
  const fill = isObj(s.fill) && ["viewed", "bought", "category", "numbers", "ai", "hand"].includes(String(s.fill.how)) ? {
    how: s.fill.how as FillHow, category: shopAddress(s.fill.category), numbers: str(s.fill.numbers, 600), ask: str(s.fill.ask, 400), at: str(s.fill.at, 40),
    missing: Array.isArray(s.fill.missing) ? s.fill.missing.map((x) => str(x, 20)).filter(Boolean).slice(0, 30) : [],
  } : null;
  const extra: Record<string, string> = {};
  if (isObj(s.extra)) for (const [key, v] of Object.entries(s.extra).slice(0, 24)) if (/^[a-z][\w-]{0,30}$/i.test(key) && typeof v === "string") extra[key] = v.slice(0, 600);
  const table = Array.isArray(s.table) ? s.table.filter(Array.isArray).slice(0, 30).map((r) => (r as unknown[]).slice(0, 8).map((c) => str(c, 200))) : [];
  return {
    type: k.id,
    settings: {
      id, store: str(s.store, 20) || "de-CH",
      eyebrow: str(s.eyebrow, 60), title: str(s.title, 140), text: str(s.text, 900),
      link: linkOf(s.link), link2: linkOf(s.link2),
      layout: k.layouts.some((l) => l.key === s.layout) ? String(s.layout) : k.layouts[0]?.key ?? "",
      items: Array.isArray(s.items) ? s.items.map((c) => cardOf(c)).filter((c): c is Card => !!c).slice(0, Math.max(k.max, 1)) : [],
      feature: cardOf(s.feature),
      points: Array.isArray(s.points) ? s.points.filter(isObj).slice(0, 12).map(pointOf) : [],
      faq: Array.isArray(s.faq) ? s.faq.filter(isObj).slice(0, 12).map((x) => ({ q: str(x.q, 300), a: str(x.a, 1500) })) : [],
      fill, extra, table,
    },
  };
}

/** What still keeps a module from being shown: no products yet, no words... - "" when it is ready (./registry.ts gapOf). */
export const moduleGap = (m: ModuleRef): string => gapOf(m);

/** A module's line for the list of changes: "Product row · 5 products · Bestseller". */
export function moduleLine(m: ModuleRef): string {
  const k = kindOf(m.type);
  const n = m.settings.items.length;
  const what = k.takes === "products" ? `${n} product${n === 1 ? "" : "s"}` : k.takes === "categories" ? `${n} categor${n === 1 ? "y" : "ies"}` : "";
  return [k.name, what, m.settings.title.trim()].filter(Boolean).join(" · ");
}

/* ── the module on a page of the shop: a Change with its settings beside it ── */

/** Where a module goes on a page of the shop: at a place (before/after/in an element), or in place of one. */
export type ModulePlace = { how: "insert"; selector: string; where: "before" | "after" | "prepend" | "append" } | { how: "replace"; selector: string };

/** A change that carries a module (the shared interface: `module` beside the change's own fields). */
export type ModuleChange =
  | { op: "insert"; selector: string; where: "before" | "after" | "prepend" | "append"; html: string; note?: string; module: ModuleRef }
  | { op: "replace"; selector: string; html: string; note?: string; module: ModuleRef };

/** The module a change carries, or null (any change, as the document keeps it). */
export function moduleOfChange(c: unknown): ModuleRef | null {
  if (!isObj(c) || (c.op !== "insert" && c.op !== "replace")) return null;
  return normalizeModule(c.module);
}

/** The change that puts a module at its place, its HTML drawn by `render` (./render.ts renderModule). */
export function moduleChange(m: ModuleRef, place: ModulePlace, html: string): ModuleChange {
  const note = `${kindOf(m.type).name}${m.settings.title.trim() ? `: ${m.settings.title.trim().slice(0, 80)}` : ""}`;
  return place.how === "replace"
    ? { op: "replace", selector: place.selector, html, note, module: m }
    : { op: "insert", selector: place.selector, where: place.where, html, note, module: m };
}

/** The place a module's change stands at. */
export function placeOfChange(c: ModuleChange): ModulePlace {
  return c.op === "replace" ? { how: "replace", selector: c.selector } : { how: "insert", selector: c.selector, where: c.where };
}
