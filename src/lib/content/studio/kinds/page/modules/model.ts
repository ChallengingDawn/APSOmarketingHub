// PAGE - THE MODULE GALLERY'S MODULES (Content v6, 09.11.2026). Pure, shared with the browser and the tests: relative imports only.
//
// SARCLA 09.11.2026 (on the Page builder, the de-CH home page): "On this CMS we should be able to add new modal and replace
// the old one - we should have a gallery of forms like bentos and much more", "fill the product of the bento or other by
// hierarchy like on the bento", "fill most viewed / most bought, automatically or by article or product number", "we
// should really be able to add elements". And the bar he named: the two home page versions built from the home page kit
// (C:\dev\_archive\apsoparts\shop-project\home-page-2026, s15 "Calm drill-down" and s17 "Technology mosaic") - "the
// versions were really good".
//
// A MODULE is one of the kit's proven blocks (finder bento, product bento, mosaic of categories, category cards, product
// row, campaign banner, USP bar, text and picture, questions, call to action) drawn from its SETTINGS by ./render.ts as ONE
// self-contained element - its own <style>, every rule under one prefix class (.apx-<id>), the shop's container width.
// On a page of the shop it is a Change (src/lib/convert/versions.ts): `insert` at a place or `replace` an element, the
// module's settings kept beside it (`module`) so it opens again for editing (the shared interface of the Content v6 brief).
//
// Its products and categories are the SHOP's: name, photo, link and the shop's own count ("702 Artikel") read from the
// shop's pages - never a price, never stock, never a product the shop does not have (./parse.ts, ./source.ts).

export const MODULE_TYPES = ["finder", "bento", "mosaic", "cards", "row", "banner", "usp", "textpic", "faq", "cta"] as const;
export type ModuleType = (typeof MODULE_TYPES)[number];
export const isModuleType = (v: unknown): v is ModuleType => (MODULE_TYPES as readonly string[]).includes(v as string);

/** A product or a category as the shop shows it. `children`: a category's subcategories or products (a finder's panel,
 * a mosaic tile's rows, a category card's list). */
export type Card = {
  kind: "product" | "category";
  name: string;
  /** the shop's own address (https://www.apsoparts.com/de-CH/...) */
  url: string;
  /** the shop's own photo (https://www.apsoparts.com/media/...) */
  img: string;
  /** what the shop itself says about it: "702 Artikel", "31 Produkte" - never a price or stock */
  meta: string;
  /** a product's 8-digit number ("" for a category) */
  number: string;
  children: Card[];
};

/** How the module's items were filled - so "fill again" does the same, and the panel says where they came from. */
export type FillHow = "viewed" | "bought" | "category" | "numbers" | "ai" | "hand";
export type Fill = { how: FillHow; category: string; numbers: string; ask: string; at: string; missing: string[] };

export type Point = { title: string; text: string; icon: string };
export type Qa = { q: string; a: string };

export type ModuleSettings = {
  /** the prefix of every class and rule: .apx-<id> */
  id: string;
  /** the store view whose words it carries ("de-CH") - the interface words follow its language */
  store: string;
  eyebrow: string;
  title: string;
  text: string;
  link: { label: string; url: string };
  /** a second button (the call to action) */
  link2: { label: string; url: string };
  layout: string;
  items: Card[];
  /** the big tile of a bento, the picture of a banner or a text and picture */
  feature: Card | null;
  points: Point[];
  faq: Qa[];
  fill: Fill | null;
};

export type ModuleRef = { type: ModuleType; settings: ModuleSettings };

/* ── the gallery: what each module is ──────────────────────────────────── */

export type Takes = "products" | "categories" | "none";
export type ModuleKind = {
  type: ModuleType;
  name: string;
  note: string;
  /** what its items are, and how many it shows at most / wants at least */
  takes: Takes;
  max: number;
  min: number;
  layouts: { key: string; label: string }[];
  /** the fields its panel shows */
  fields: ("eyebrow" | "title" | "text" | "link" | "link2" | "feature" | "points" | "faq")[];
  /** in the kit: where it was proven */
  from: string;
};

export const MODULE_KINDS: ModuleKind[] = [
  {
    type: "finder", name: "Finder bento", note: "A menu of categories beside a big tile and their products - resting on one shows its products",
    takes: "categories", max: 6, min: 2, from: "home page version A (Calm drill-down)",
    layouts: [{ key: "left", label: "Menu left" }, { key: "right", label: "Menu right" }],
    fields: ["eyebrow", "title", "link"],
  },
  {
    type: "bento", name: "Product bento", note: "A big tile and the products beside it",
    takes: "products", max: 7, min: 2, from: "home page version A (Calm drill-down)",
    layouts: [{ key: "left", label: "Big tile left" }, { key: "right", label: "Big tile right" }, { key: "wide", label: "Big tile + 6" }],
    fields: ["eyebrow", "title", "link", "feature"],
  },
  {
    type: "mosaic", name: "Mosaic of categories", note: "Big category photos, the name only - resting on one slides up its subcategories",
    takes: "categories", max: 8, min: 2, from: "home page version B (Technology mosaic)",
    layouts: [{ key: "3", label: "3 per row" }, { key: "4", label: "4 per row" }, { key: "2", label: "2 per row" }],
    fields: ["eyebrow", "title", "link"],
  },
  {
    type: "cards", name: "Category cards", note: "A photo, the category and its subcategories as a list",
    takes: "categories", max: 6, min: 1, from: "home page Klassik (Technologien)",
    layouts: [{ key: "3", label: "3 per row" }, { key: "2", label: "2 per row" }, { key: "4", label: "4 per row" }],
    fields: ["eyebrow", "title", "link"],
  },
  {
    type: "row", name: "Product row", note: "Product cards in a row - photo, name, the shop's article count",
    takes: "products", max: 12, min: 2, from: "home page Klassik (Bestseller)",
    layouts: [{ key: "scroll", label: "One row" }, { key: "grid", label: "Rows of 5" }, { key: "grid4", label: "Rows of 4" }],
    fields: ["eyebrow", "title", "link"],
  },
  {
    type: "banner", name: "Campaign banner", note: "A headline, a line and a button beside a picture",
    takes: "none", max: 0, min: 0, from: "home page campaign row (Black Friday)",
    layouts: [{ key: "right", label: "Picture right" }, { key: "left", label: "Picture left" }, { key: "behind", label: "Picture behind" }],
    fields: ["eyebrow", "title", "text", "link", "feature"],
  },
  {
    type: "usp", name: "USP bar", note: "The shop's promises, each with its icon",
    takes: "none", max: 0, min: 0, from: "home page title row (the four promises)",
    layouts: [{ key: "bar", label: "One bar" }, { key: "cards", label: "Cards" }],
    fields: ["points"],
  },
  {
    type: "textpic", name: "Text and picture", note: "A heading, words and a button beside a picture",
    takes: "none", max: 0, min: 0, from: "home page About",
    layouts: [{ key: "right", label: "Picture right" }, { key: "left", label: "Picture left" }],
    fields: ["eyebrow", "title", "text", "link", "feature"],
  },
  {
    type: "faq", name: "Questions", note: "What buyers ask, with the answers - opened by a click",
    takes: "none", max: 0, min: 0, from: "the SEO pages' questions",
    layouts: [{ key: "one", label: "One column" }, { key: "two", label: "Two columns" }],
    fields: ["eyebrow", "title", "faq"],
  },
  {
    type: "cta", name: "Call to action", note: "One line and a button: the next step",
    takes: "none", max: 0, min: 0, from: "home page Tools & Services band",
    layouts: [{ key: "petrol", label: "Petrol band" }, { key: "light", label: "Light" }],
    fields: ["eyebrow", "title", "text", "link", "link2"],
  },
];

export const kindOf = (t: ModuleType): ModuleKind => MODULE_KINDS.find((k) => k.type === t) ?? MODULE_KINDS[0];

/* ── words: the interface words in the store view's language ──────────── */

export type Words = { go: string; goCat: string; all: string; allProducts: string; more: string };
const WORDS: Record<string, Words> = {
  de: { go: "Zum Produkt", goCat: "Zum Bereich", all: "Alle anzeigen", allProducts: "Alle Produkte", more: "Mehr erfahren" },
  fr: { go: "Voir le produit", goCat: "Voir la catégorie", all: "Tout afficher", allProducts: "Tous les produits", more: "En savoir plus" },
  it: { go: "Vai al prodotto", goCat: "Vai alla categoria", all: "Mostra tutto", allProducts: "Tutti i prodotti", more: "Scopri di più" },
  en: { go: "View product", goCat: "View group", all: "View all", allProducts: "All products", more: "Learn more" },
  nl: { go: "Naar het product", goCat: "Naar de categorie", all: "Alles tonen", allProducts: "Alle producten", more: "Meer weten" },
  pl: { go: "Do produktu", goCat: "Do kategorii", all: "Pokaż wszystkie", allProducts: "Wszystkie produkty", more: "Dowiedz się więcej" },
};
export const wordsFor = (store: string): Words => WORDS[String(store).slice(0, 2).toLowerCase()] ?? WORDS.en;

/** The shop's four promises, as its home page says them (the kit's title row, from today's USP picture). */
const PROMISES: Record<string, Point[]> = {
  de: [
    { icon: "box", title: "Keine Zuschläge", text: "für Kleinbestellungen" },
    { icon: "clock", title: "Echtzeit-Preise", text: "Lieferzeiten und Verfügbarkeit" },
    { icon: "cut", title: "Zuschnitte", text: "nach Mass" },
    { icon: "quick", title: "Schnell bestellen", text: "mit Schnellbestellung & DirectUP" },
  ],
  en: [
    { icon: "box", title: "No surcharges", text: "for small orders" },
    { icon: "clock", title: "Real-time prices", text: "delivery times and availability" },
    { icon: "cut", title: "Cut-to-size", text: "to your dimensions" },
    { icon: "quick", title: "Fast ordering", text: "with Quickorder & DirectUP" },
  ],
};
export const ICONS = ["box", "clock", "cut", "quick", "truck", "check", "upload", "cube", "flask", "book", "expert", "star"] as const;

/* ── a module made, read back, checked ─────────────────────────────────── */

/** A short random id - letters and digits, a letter first (it is a CSS class). */
export const moduleId = () => `m${Math.random().toString(36).slice(2, 6).padEnd(4, "0")}`;

const emptyLink = () => ({ label: "", url: "" });

/** A new module of a type, for a store view: empty items, its first layout, the words a person starts from. */
export function newModule(type: ModuleType, store: string, id = moduleId()): ModuleRef {
  const k = kindOf(type);
  const w = wordsFor(store);
  const lang = String(store).slice(0, 2).toLowerCase();
  const settings: ModuleSettings = {
    id, store, eyebrow: "", title: "", text: "", link: emptyLink(), link2: emptyLink(), layout: k.layouts[0].key,
    items: [], feature: null, points: [], faq: [], fill: null,
  };
  if (type === "usp") settings.points = (PROMISES[lang] ?? PROMISES.en).map((p) => ({ ...p }));
  if (type === "faq") settings.faq = [{ q: "", a: "" }, { q: "", a: "" }, { q: "", a: "" }];
  if (type === "row" || type === "bento" || type === "finder" || type === "mosaic" || type === "cards") settings.link = { label: w.all, url: "" };
  if (type === "banner" || type === "textpic" || type === "cta") settings.link = { label: w.more, url: "" };
  return { type, settings };
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
  };
}

function linkOf(v: unknown) {
  const o = isObj(v) ? v : {};
  return { label: str(o.label, 60), url: shopAddress(o.url) };
}

/** Any stored module as a module: unknown values left out, lists capped (a module is one element on the page). */
export function normalizeModule(raw: unknown): ModuleRef | null {
  if (!isObj(raw) || !isModuleType(raw.type)) return null;
  const type = raw.type;
  const k = kindOf(type);
  const s = isObj(raw.settings) ? raw.settings : {};
  const id = typeof s.id === "string" && /^[a-z][a-z0-9]{2,11}$/.test(s.id) ? s.id : moduleId();
  const fill = isObj(s.fill) && ["viewed", "bought", "category", "numbers", "ai", "hand"].includes(String(s.fill.how)) ? {
    how: s.fill.how as FillHow, category: shopAddress(s.fill.category), numbers: str(s.fill.numbers, 600), ask: str(s.fill.ask, 400), at: str(s.fill.at, 40),
    missing: Array.isArray(s.fill.missing) ? s.fill.missing.map((x) => str(x, 20)).filter(Boolean).slice(0, 30) : [],
  } : null;
  return {
    type,
    settings: {
      id, store: str(s.store, 20) || "de-CH",
      eyebrow: str(s.eyebrow, 60), title: str(s.title, 140), text: str(s.text, 900),
      link: linkOf(s.link), link2: linkOf(s.link2),
      layout: k.layouts.some((l) => l.key === s.layout) ? String(s.layout) : k.layouts[0].key,
      items: Array.isArray(s.items) ? s.items.map((c) => cardOf(c)).filter((c): c is Card => !!c).slice(0, Math.max(k.max, 1)) : [],
      feature: cardOf(s.feature),
      points: Array.isArray(s.points) ? s.points.filter(isObj).slice(0, 6).map((p) => ({ title: str(p.title, 60), text: str(p.text, 120), icon: (ICONS as readonly string[]).includes(String(p.icon)) ? String(p.icon) : "check" })) : [],
      faq: Array.isArray(s.faq) ? s.faq.filter(isObj).slice(0, 12).map((x) => ({ q: str(x.q, 300), a: str(x.a, 1500) })) : [],
      fill,
    },
  };
}

/** What still keeps a module from being shown: no products yet, no words... - "" when it is ready. */
export function moduleGap(m: ModuleRef): string {
  const s = m.settings;
  const k = kindOf(m.type);
  if (k.takes !== "none" && s.items.length < k.min) return k.takes === "products" ? "Fill it with products first" : "Pick its categories first";
  if (m.type === "finder" && s.items.every((c) => !c.children.length)) return "Its categories have no products yet - fill them from the shop";
  if ((m.type === "banner" || m.type === "textpic" || m.type === "cta") && !s.title.trim()) return "Give it a headline";
  if (m.type === "faq" && !s.faq.some((x) => x.q.trim() && x.a.trim())) return "Write at least one question and its answer";
  if (m.type === "usp" && !s.points.some((p) => p.title.trim())) return "Write at least one promise";
  return "";
}

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
