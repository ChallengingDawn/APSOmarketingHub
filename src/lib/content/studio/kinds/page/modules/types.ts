// PAGE - THE MODULE LIBRARY'S TYPES (Content v7, 10.11.2026). Pure, no imports: the registry, the kit, every module file
// and the studio read them.
//
// SARCLA 10.11.2026 (point 1): "create more than 100 modules subdivided by categories, really high end". A MODULE is one
// finished block of the shop (a hero, a bento, a row of products, a mosaic of categories, a banner, the shop's promises...)
// drawn from its SETTINGS as ONE self-contained element: its own <style>, every rule under one prefix class (.apx-<id>),
// the shop's container width (1170 px, 10 px gutters), explicit colours and fonts, no script - finished at 375, 1024 and
// 1440 px. On a page of the shop it is a Change (insert at a place / replace an element) with `module: { type, settings }`
// kept beside it so it opens again (model.ts, the shared interface of Content v6).

/** A product or a category as the shop shows it. `children`: a category's subcategories or products (a finder's panel,
 * a mosaic tile's rows, a category card's list). */
export type Card = {
  kind: "product" | "category";
  name: string;
  /** the shop's own address (https://www.apsoparts.com/de-CH/...) */
  url: string;
  /** the shop's own photo (https://www.apsoparts.com/media/...) or the hub's picture store (/api/content/picture/...) */
  img: string;
  /** what the shop itself says about it: "702 Artikel", "31 Produkte" - never a price or stock */
  meta: string;
  /** a product's 8-digit number ("" for a category) */
  number: string;
  children: Card[];
  /** a module's picture (its `feature`) only: who put it there - the hub's fill (it follows the module's products when
   * they change) or the person (uploaded, from the pictures, made by AI, a category's photo picked: it stays). None =
   * the hub's picture store's is the person's, any other the fill's (./follow.ts pictureFrom). */
  from?: "fill" | "person";
};

/** How the module's items were filled - so "fill again" does the same, and the panel says where they came from. */
export type FillHow = "viewed" | "bought" | "category" | "numbers" | "ai" | "hand";
export type Fill = { how: FillHow; category: string; numbers: string; ask: string; at: string; missing: string[] };

/** A point of a list: a promise (title + text + icon), a figure ("31'264" + "Artikel"), a step, a logo (img), a quote. */
export type Point = { title: string; text: string; icon: string; img?: string; url?: string };
export type Qa = { q: string; a: string };

export type ModuleSettings = {
  /** the prefix of every class and rule: .apx-<id> */
  id: string;
  /** the store view whose words it carries ("de-CH", "de-CH/eur") - the interface words follow its language */
  store: string;
  eyebrow: string;
  title: string;
  text: string;
  link: { label: string; url: string };
  /** a second button */
  link2: { label: string; url: string };
  /** a small variant inside the module (picture left / right, 3 or 4 per row) - the module's `layouts` */
  layout: string;
  items: Card[];
  /** the big tile of a bento, the picture of a hero, a banner, a text and picture */
  feature: Card | null;
  points: Point[];
  faq: Qa[];
  fill: Fill | null;
  /** a module's own short settings (a badge's words, a date, a colour choice, a video address...) - by key, words only */
  extra: Record<string, string>;
  /** rows of cells (a comparison, a technical table): the first row is the head */
  table: string[][];
};

/** The module a change carries: its registry id and its settings. */
export type ModuleRef = { type: string; settings: ModuleSettings };

/* ── the registry's entries ────────────────────────────────────────────── */

/** The library's categories (registry.ts CATEGORIES: their order, names and lines). */
export type CategoryId =
  | "heroes" | "showcases" | "bentos" | "navigation" | "campaigns" | "trust"
  | "stories" | "technical" | "tools" | "help" | "cta" | "industries" | "references" | "media";

/** What a module must be given before it can stand on a page. */
export type Need = "products" | "categories" | "picture" | "text";

/** What its items are: the shop's products, its categories (each with its own products or subcategories), or none. */
export type Takes = "products" | "categories" | "none";

/**
 * One field of a module's settings, as the Build pane shows it and the AI fills it (its SETTINGS SCHEMA). The generic
 * panel draws each kind; a module lists only the fields it uses, in the order shown.
 *   eyebrow · title · text   words (`max` characters; `rows` > 1 = several lines; title/text take ==word== = red)
 *   link · link2             a button: its words and a page of the shop
 *   feature                  the picture: a category's photo, a product's, or one from the hub's pictures
 *   points                   a list of points (`item` names its two lines; `icons`, `pictures`, `links` say what else)
 *   faq                      questions and answers
 *   table                    rows of cells (`cols` columns, the first row the head)
 *   extra                    one short word setting by `key` (free words, or one of `options`)
 */
export type FieldSpec =
  | { kind: "eyebrow" | "title" | "text"; label?: string; max?: number; rows?: number; hint?: string; red?: boolean }
  | { kind: "link" | "link2"; label?: string }
  | { kind: "feature"; label?: string; hint?: string }
  | { kind: "points"; label?: string; min?: number; max?: number; item?: { title: string; text: string }; icons?: boolean; pictures?: boolean; links?: boolean; hint?: string }
  | { kind: "faq"; label?: string; max?: number }
  | { kind: "table"; label?: string; cols?: number; maxRows?: number }
  | { kind: "extra"; key: string; label: string; max?: number; options?: { key: string; label: string }[]; hint?: string };

/** How a module is drawn: the page's picture addresses as they must be written (the preview, the Magento hand-over). */
export type Opts = {
  /** a picture's address as it is written - the preview makes the hub's own absolute, the hand-over names Magento's media */
  picture?: (url: string) => string;
  /** the store view the page is drawn for (Content v10, SARCLA point 9): its links go there - else the module's own */
  store?: string;
  /** Content v12: its headline is the page's H1 (the page's own hero was taken out - ../blocklist.ts h1ModuleOf) */
  h1?: boolean;
};

/** A module drawn: its inner HTML and its CSS, every rule written `@@ ...` (the registry puts the module's class there). */
export type Drawn = { html: string; css: string };

/** One module of the library - everything the gallery, the panel, the AI and the renderer need to know about it. */
export type ModuleDef = {
  /** its type, kept in the document ("row", "hero-split") - lower case, digits and hyphens */
  id: string;
  category: CategoryId;
  /** "Product row" */
  name: string;
  /** one line: what it shows and how it moves */
  note: string;
  /** what it must be given before it can stand on a page */
  needs: Need[];
  /** what its items are */
  takes: Takes;
  /** the items it wants at least, shows at most (0 / 0 when it takes none) */
  min: number;
  max: number;
  /** a category module: what each of its categories carries - its products (a finder's panels) or its subcategories */
  kids?: "products" | "subs";
  /** how many items a fill asks for, for these settings (its layout may show more or fewer) - default: max */
  count?: (s: ModuleSettings) => number;
  /** small variants inside the module (picture left / right...) - the first is a new module's; [] = one look */
  layouts: { key: string; label: string }[];
  /** its settings schema: the fields the Build pane shows, in order */
  fields: FieldSpec[];
  /** a new module's settings beyond the empty ones (the shop's promises, a button's words) */
  defaults?: (store: string) => Partial<ModuleSettings>;
  /** what still keeps it off a page beyond the generic check ("" when nothing) */
  gap?: (m: ModuleRef) => string;
  /** its HTML and CSS (rules under `@@`); the registry wraps them into ONE element with the kit's base rules */
  render: (m: ModuleRef, o: Opts) => Drawn;
  /** words a person might search it by ("carousel", "slider", "grid") */
  tags?: string[];
  /** the words its picture in the gallery shows (de-CH; real facts only) - also an example for the AI. The products and
   * categories come from the shop (the harness fills them). */
  sample?: Partial<ModuleSettings>;
  /** where the design was proven ("home page version A (Calm drill-down)") */
  from?: string;
};
