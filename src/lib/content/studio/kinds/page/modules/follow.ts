// PAGE - A MODULE'S PICTURE FOLLOWS ITS PRODUCTS (Content v12, 10.11.2026). Pure: relative imports only
// (tests/studio-page-follow.test.ts).
//
// SARCLA 10.11.2026 ~22:40: "on some bento you change the product but the background photo keeps seals". A "Products on a
// photo" (bento-glass) filled again with POM-C plates and rods kept the sealing photo behind them, and its headline still
// said "O-Ringe und Dichtungen in EPDM": a fill put the products in and left the picture (and the words) as they were.
//
// Now, whenever a module's products change - a fill of any kind (a category, most bought, most viewed, numbers, the AI's
// pick, a plan's fill), an item taken out, a switch into another module - its picture is checked against them:
//   - a picture the PERSON chose (uploaded, from the pictures, made by AI, a category's photo picked) never moves;
//   - the FILL's picture stays while it belongs to them (its category is one of theirs, above or below: a technology's
//     photo over its plates, a plate's photo over POM plates), and otherwise becomes their own category's photo from the
//     shop (../modules/source.ts followInfo: the home page's photo of their category or the nearest one above it, else the
//     tile its parent page shows);
//   - no category photo to be had: a module that draws a product well on its big tile (is-prod) shows their first product
//     (a module whose picture is optional simply lets its first product stand big);
//   - the words: when the products are no longer those the words went with, the module says so ("Its words speak of
//     other products") with the popup's own "Write it again with AI" - never rewritten silently.
// A product's category is read from its own page's breadcrumb (./parse.ts breadcrumbOf) - its address carries none - or
// is the category the module was filled from.

import { fieldOf, moduleDef } from "./registry";
import type { Card, ModuleDef, ModuleRef } from "./types";

const B = "https://www.apsoparts.com";

/* ── where a picture came from ─────────────────────────────────────────── */

export type PicFrom = "fill" | "person";

/** The hub's own picture store (an upload, a picture of the project, one made by AI): always the person's. */
const HUB_PICTURE = /^\/api\/content\/picture\//;

/** Who put the module's picture there: the person (it stays) or the hub's fill (it follows the products). A picture
 * without a mark: the hub's picture store's is the person's, the shop's the fill's. null: no picture. */
export function pictureFrom(f: Card | null | undefined): PicFrom | null {
  if (!f) return null;
  if (f.from === "person" || HUB_PICTURE.test(f.img)) return "person";
  return f.from ?? "fill";
}

/** A picture the person chose, marked so. */
export const personPicture = (c: Card): Card => ({ ...c, from: "person" });

/* ── categories by their address ───────────────────────────────────────── */

const STORE_SEG = /^\/[a-z]{2}-[A-Z]{2,3}\//;
const pathOf = (url: string) => { try { return new URL(url, B).pathname; } catch { return ""; } };

/** A product's own page: its 8-digit number first ("/de-CH/02320001-pom-c-platte-natur-weiss.html"). */
export const isProductUrl = (url: string) => /^\/[a-z]{2}-[A-Z]{2,3}\/\d{8}(?=-|\.html|$)/.test(pathOf(url));

/** A category's key - its address without the store view and ".html": "/de-CH/kunststofftechnik/platte.html" ->
 * "kunststofftechnik/platte". "" for a product, the store's home, a page that is no category. */
export function categoryKey(url: string): string {
  const p = pathOf(url);
  if (!STORE_SEG.test(p) || !p.endsWith(".html") || isProductUrl(url)) return "";
  return p.replace(STORE_SEG, "").replace(/\.html$/, "").toLowerCase();
}

/** The category's address in a store view. */
export const urlOfKey = (key: string, store: string) => `${B}/${String(store).split("/")[0]}/${key}.html`;

/** Its line from the technology down: "a/b/c" -> ["a", "a/b", "a/b/c"]. */
export const chainKeys = (key: string) => (key ? key.split("/").map((_, i, all) => all.slice(0, i + 1).join("/")) : []);

/** Are two categories on one line (the same, or one above the other)? */
export const onLine = (a: string, b: string) => !!a && !!b && (a === b || b.startsWith(`${a}/`) || a.startsWith(`${b}/`));

/**
 * The deepest category the products share: within the technology most of them are in (the first one's on a tie) - the
 * category the module's picture is then the photo of. "" when none is known.
 */
export function commonCategory(cats: string[]): string {
  const known = cats.filter(Boolean);
  if (!known.length) return "";
  const tech = (k: string) => k.split("/")[0];
  const n = new Map<string, number>();
  for (const k of known) n.set(tech(k), (n.get(tech(k)) ?? 0) + 1);
  let best = tech(known[0]);
  for (const k of known) if ((n.get(tech(k)) ?? 0) > (n.get(best) ?? 0)) best = tech(k);
  const group = known.filter((k) => tech(k) === best).map((k) => k.split("/"));
  let depth = 0;
  while (group.every((g) => g.length > depth && g[depth] === group[0][depth])) depth++;
  return group[0].slice(0, depth).join("/");
}

/* ── the modules whose picture follows ─────────────────────────────────── */

/** Modules of products or categories whose picture is never the shop's category: a machine's picture. */
const NOT_FOLLOW = new Set(["ind-around"]);
/** Modules whose picture tile draws a product photo well (its "is-prod" look: on white, whole) - with no category photo to
 * be had, their first product's picture. */
export const PACKSHOT = new Set(["bento", "bento-mixed", "hero-category"]);

/** Does this module show the shop's products or categories AND a picture that goes with them? */
export const followable = (d: ModuleDef | null | undefined): d is ModuleDef =>
  !!d && d.takes !== "none" && !!fieldOf(d, "feature") && !NOT_FOLLOW.has(d.id);

/**
 * Does the picture belong to the products? true / false - null when it cannot be told (none of their categories known,
 * a picture of no category). A product's photo belongs while that product is one of them; a category's photo when one
 * of theirs is on its line.
 */
export function belongsTo(feature: Card, items: Card[], cats: string[]): boolean | null {
  const fk = categoryKey(feature.url);
  if (!fk) {
    if (isProductUrl(feature.url)) return items.some((i) => i.url === feature.url || (!!feature.number && i.number === feature.number));
    return null;
  }
  const known = cats.filter(Boolean);
  if (!known.length) return null;
  return known.some((k) => onLine(fk, k));
}

/** What the module's products are, as the hub read them: each one's category (its key; "" unknown), the category they
 * share and that category's photo from the shop (null: not looked for, or none). */
export type FollowInfo = { cats: string[]; common: { url: string; name: string } | null; photo: Card | null };

/** Does the module want a new picture for these products: its fill's picture no longer theirs, or none where it needs one? */
export function wantsPicture(m: ModuleRef, cats: string[]): boolean {
  const d = moduleDef(m.type);
  const s = m.settings;
  if (!followable(d) || !s.items.length) return false;
  const f = s.feature;
  if (!f) return d.needs.includes("picture");
  return pictureFrom(f) === "fill" && belongsTo(f, s.items, cats) === false;
}

/** The category the module's words went with: its picture's (a category of the shop), else the one it was filled from. */
export function aboutOf(m: ModuleRef): string {
  const fk = m.settings.feature ? categoryKey(m.settings.feature.url) : "";
  return fk || (m.settings.fill?.category ? categoryKey(m.settings.fill.category) : "");
}

/** The category whose products the module shows when it was filled from one (a category, most bought or viewed in one):
 * its address - else "" (numbers, the AI's pick, the whole shop's most bought: their pages tell). */
export function fillHint(m: ModuleRef): string {
  const f = m.settings.fill;
  return f && f.category && ["category", "viewed", "bought", "hand"].includes(f.how) && categoryKey(f.category) ? f.category : "";
}

/* ── the words: "Its words speak of other products" ────────────────────── */

/** The module's settings key that holds it: "<the products' category>|<its words' fingerprint>". */
export const REWORD = "reword";

/** A fingerprint of the module's words (small line, title, line under it). */
export function wordsPrint(m: ModuleRef): string {
  const s = m.settings;
  const t = `${s.eyebrow.trim()}\u0001${s.title.trim()}\u0001${s.text.trim()}`;
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const hasWords = (m: ModuleRef) => !!(m.settings.eyebrow.trim() || m.settings.title.trim() || m.settings.text.trim());

/** Do its words speak of other products? The flag holds while its words are those it was set on - any change of them
 * (the person's, the AI's) ends it. `name`: the products' category now ("" unknown). */
export function rewordOf(m: ModuleRef): { name: string } | null {
  const v = m.settings.extra?.[REWORD];
  if (!v) return null;
  const i = v.lastIndexOf("|");
  if (i < 0 || v.slice(i + 1) !== wordsPrint(m) || !hasWords(m)) return null;
  return { name: v.slice(0, i) };
}

/** The flag taken off (the person keeps the words). */
export function withoutReword(m: ModuleRef): ModuleRef {
  if (!(REWORD in (m.settings.extra ?? {}))) return m;
  const extra = { ...m.settings.extra };
  delete extra[REWORD];
  return { ...m, settings: { ...m.settings, extra } };
}

/* ── the picture follows ──────────────────────────────────────────────── */

export type FollowOut = {
  m: ModuleRef;
  /** "photo": their category's photo · "product": their first product's · "out": the other products' picture taken out
   * (its first product stands big) · "": nothing changed */
  did: "photo" | "product" | "out" | "";
  /** its words now flagged */
  reword: boolean;
  /** a line for "Changes made here" ("" when nothing changed) */
  line: string;
};

const productCard = (c: Card): Card => ({ kind: "product", name: c.name, url: c.url, img: c.img, meta: c.meta, number: c.number, children: [], from: "fill" });

/**
 * The module with its picture following its products (`info` from the hub's read). `o.reword`: flag its words when its
 * products are no longer those they went with - `o.about` the category they went with (aboutOf, taken BEFORE the products
 * changed), else its picture's.
 */
export function followPicture(m: ModuleRef, info: FollowInfo, o: { reword?: boolean; about?: string } = {}): FollowOut {
  const d = moduleDef(m.type);
  const s = m.settings;
  let next = m;
  let did: FollowOut["did"] = "";
  let line = "";
  if (followable(d) && s.items.length && wantsPicture(m, info.cats)) {
    const optional = !d.needs.includes("picture");
    const first = s.items.find((x) => x.img && x.kind === "product") ?? null;
    let pic: Card | null = info.photo?.img ? { ...info.photo, children: [], from: "fill" } : null;
    if (!pic && first && (PACKSHOT.has(d.id) ? !optional : !s.feature)) pic = productCard(first);
    if (pic) {
      next = { ...m, settings: { ...s, feature: pic } };
      did = pic.kind === "product" && !categoryKey(pic.url) ? "product" : "photo";
      line = `The picture follows its products: ${pic.name.slice(0, 60)}`;
    } else if (s.feature && PACKSHOT.has(d.id) && optional) {
      // a big tile whose picture is optional: the other products' picture out - their first product stands big
      next = { ...m, settings: { ...s, feature: null } };
      did = "out";
      line = "The picture of other products is out - its first product shows big";
    }
  }
  // its words: the products are no longer those they went with
  let reword = false;
  if (o.reword && hasWords(next)) {
    const about = o.about ?? (did && s.feature ? categoryKey(s.feature.url) : "");
    const known = info.cats.filter(Boolean);
    if (about && known.length && !known.some((k) => onLine(about, k))) {
      reword = true;
      next = { ...next, settings: { ...next.settings, extra: { ...next.settings.extra, [REWORD]: `${(info.common?.name ?? "").replace(/\|/g, " ").slice(0, 80)}|${wordsPrint(next)}` } } };
    }
  }
  return { m: next, did, reword, line };
}

/**
 * Must the hub read what the module's products are? Not when nothing can come of it: no products; no picture of the fill's
 * to follow (the person's, or none where none is needed) and no words to check (`about`: the category its words went
 * with before its products changed, null when they did not); or a module filled from a category - so its products' own -
 * whose picture is of that category and whose words went with it.
 */
export function followNeedsShop(m: ModuleRef, about: string | null): boolean {
  const d = moduleDef(m.type);
  const s = m.settings;
  if (!s.items.length) return false;
  const pic = followable(d) && (s.feature ? pictureFrom(s.feature) === "fill" : d.needs.includes("picture"));
  const words = !!about && hasWords(m);
  if (!pic && !words) return false;
  const hint = fillHint(m);
  if (!hint) return true;
  const cats = s.items.map((i) => categoryKey(i.url) || categoryKey(hint));
  return (pic && wantsPicture(m, cats)) || (words && !cats.some((k) => onLine(about!, k)));
}

/** What the module's state is checked by (its type, its items, its picture): one check per state. */
export const followSig = (m: ModuleRef) => `${m.type}|${m.settings.items.map((x) => x.url).join(",")}|${m.settings.feature?.url ?? ""}|${m.settings.feature?.img ?? ""}`;
