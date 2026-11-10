// PAGE - A PLAN'S MODULE FILLED FROM THE SHOP (server, Content v7, 10.11.2026).
//
// SARCLA 10.11.2026 (point 13): "the AI could directly bring modules" - and the bar of 09.11.2026: real shop data only.
// The AI says HOW a module is filled (./plan.ts FillSpec); the hub fills it here from what the shop itself shows and what
// the hub already holds (../modules/source.ts):
//   category      that category's products (its own page), or - a module of categories - its subcategories, each with
//                 its products or its own subcategories (the module's `kids`)
//   technologies  the shop's main technologies (its menu), each the same way
//   viewed/bought the products whose pages are viewed most / whose articles are bought most online (GA4, last months),
//                 within a category when one is given
//   numbers       the product (8 digits) or article (10 digits) numbers the person named
// and a module that shows a picture gets one from the shop: its category's photo, else a product's. Never a price, never
// stock: a card carries a name, a photo, a link and the shop's own count ("702 Artikel").

import type { Card, ModuleRef } from "../modules/types";
import { moduleDef } from "../modules/registry";
import { newModule } from "../modules/model";
import { followable, type FollowInfo } from "../modules/follow";
import { cardsForNumbers, categoryCard, cleanCards, cleanedNote, followInfo, shopCategory, shopTree, topCards } from "../modules/source";
import { libModule, teaserField } from "./library";
import type { FillSpec } from "./plan";

/** `follow`: what the products are (their categories, their own category's photo) - the module's picture follows them. */
export type FillOut = { items: Card[]; feature: Card | null; note: string; missing: string[]; follow?: FollowInfo | null };

const BASE = "https://www.apsoparts.com";
/** The store view whose shop is read: "de-CH/eur" reads de-CH (the same catalogue - the module writes its links there). */
export const readStore = (store: string) => /^([a-z]{2}-[A-Z]{2,3})/.exec(store)?.[1] ?? "de-CH";

/** A category's address in this store view (an address from another store view is not this one's). */
const inStore = (url: string, store: string) => { try { return new URL(url, BASE).pathname.startsWith(`/${store}/`); } catch { return false; } };

/** Categories as cards, each with its products or subcategories (one shop read per category, in turn). */
async function categoryCards(list: { name: string; url: string; img: string }[], store: string, kids: "products" | "subs", count: number, parent: Card[] = []): Promise<{ cards: Card[]; missing: string[] }> {
  const cards: Card[] = [];
  const missing: string[] = [];
  for (const c of list) {
    if (cards.length >= count) break;
    try {
      const card = await categoryCard(c.url, store, kids, parent);
      cards.push({ ...card, name: c.name || card.name, img: c.img || card.img });
    } catch (e) {
      missing.push(`${c.name}: ${String((e as Error).message ?? e).slice(0, 120)}`);
    }
  }
  return { cards, missing };
}

/** The module's items (and its picture) as the plan's fill says - from the shop. */
export async function fillModule(o: { module: string; fill: FillSpec; store: string; count?: number }): Promise<FillOut> {
  const lib = libModule(o.module);
  if (!lib) throw new Error("That module is not in the library any more.");
  const store = readStore(o.store);
  const def = moduleDef(o.module);
  const kids = def?.kids ?? "products";
  const count = Math.max(lib.min || 1, Math.min(lib.max || 12, o.count || o.fill.count || lib.max || 6));
  const f = o.fill;
  const category = f.category && inStore(f.category, store) ? f.category : "";
  let items: Card[] = [];
  let feature: Card | null = null;
  let note = "";
  const missing: string[] = [];

  if (lib.takes === "products") {
    if (f.how === "numbers" && f.numbers) {
      const r = await cardsForNumbers(f.numbers, store, count);
      items = r.cards;
      missing.push(...r.missing.map((m) => `${m.number}: ${m.why}`));
      note = "The products you named, from the shop.";
    } else if (f.how === "category" && category) {
      const c = await shopCategory(category, store);
      items = c.products.slice(0, count + 8);
      note = `${c.name || "The category"}'s products, as the shop lists them.`;
      // a category whose page lists subcategories only: their first products
      if (!items.length && c.subs.length) {
        for (const s of c.subs) {
          if (items.length >= count) break;
          const sub = await shopCategory(s.url, store).catch(() => null);
          for (const p of sub?.products ?? []) { if (items.length < count + 8 && !items.some((x) => x.url === p.url)) items.push(p); }
        }
        note = `Products of ${c.name || "the category"}'s subcategories, as the shop lists them.`;
      }
      // none on clearance or replaced, no sticker on a photo (builder B, ../modules/source.ts cleanCards)
      const k = await cleanCards(items, count);
      items = k.cards;
      note += cleanedNote({ clearance: k.clearance + c.cleared, photo: k.photo });
    } else {
      const how = f.how === "viewed" ? "viewed" : "bought";
      const r = await topCards(how, store, count, category || undefined);
      items = r.cards;
      note = r.note;
    }
  } else if (lib.takes === "categories") {
    if (f.how === "category" && category) {
      const c = await shopCategory(category, store);
      if (!c.subs.length) throw new Error(`${c.name || "That category"} has no subcategories on the shop - a module of products fits it better.`);
      const r = await categoryCards(c.subs, store, kids, count, c.subs);
      items = r.cards; missing.push(...r.missing);
      note = `${c.name || "The category"}'s subcategories, from the shop.`;
    } else {
      const t = await shopTree(store);
      const r = await categoryCards(t.tree.map((n) => ({ name: n.name, url: n.url, img: t.photos[n.url] ?? "" })), store, kids, count);
      items = r.cards; missing.push(...r.missing);
      note = "The shop's technologies, from its menu.";
    }
  }

  // teasers (two banners, three teasers, story cards, a gallery - Content v10, SARCLA 10.11.2026: a "Three teasers" came
  // back empty): each a picture and a page of the shop, never invented - the category's subcategories, then its
  // products, then the shop's technologies, each with the shop's own photo (./library.ts teasersFrom puts them in)
  const teaser = teaserField(o.module);
  if (teaser && lib.takes === "none") {
    const card = (x: { name: string; url: string; img: string }): Card => ({ kind: "category", name: x.name, url: x.url, img: x.img, meta: "", number: "", children: [] });
    if (f.how !== "technologies" && category) {
      const c = await shopCategory(category, store);
      items = c.subs.filter((x) => x.img).map((x) => ({ ...x, children: [] }));
      if (items.length < teaser.n) { const k = await cleanCards(c.products.filter((x) => x.img), teaser.n + 4); items.push(...k.cards); }
      note = `${c.name || "The category"}'s pages and photos, from the shop.`;
    }
    if (items.length < teaser.n) {
      const t = await shopTree(store);
      items.push(...t.tree.filter((x) => t.photos[x.url]).map((x) => card({ name: x.name, url: x.url, img: t.photos[x.url] })));
      note = note || "The shop's technologies, each with its photo, from its menu.";
    }
    const seen = new Set<string>();
    items = items.filter((x) => x.img && x.url && !seen.has(x.url) && (seen.add(x.url), true)).slice(0, teaser.n + 2);
  }

  // Content v12 (SARCLA 10.11.2026: "on some bento you change the product but the background photo keeps seals"): what
  // the products are - their categories and their own category's photo - so the module's picture follows them
  // (../modules/follow.ts followPicture, in ./plan.ts withFill: the person's picture stays)
  let follow: FollowInfo | null = null;
  if (followable(def) && items.length) {
    const probe: ModuleRef = { type: o.module, settings: { ...newModule(o.module, store).settings, items } };
    follow = await followInfo({ m: probe, store, hint: category, force: true }).catch(() => null);
  }

  if (lib.needs.includes("picture")) {
    // its picture: the products' own category photo, else the category's own, else the first item's, else a technology's
    // from the shop's home page
    if (follow?.photo?.img) feature = { ...follow.photo, children: [], from: "fill" };
    if (!feature?.img && category) {
      const c = await shopCategory(category, store).catch(() => null);
      if (c) feature = { kind: "category", name: c.name, url: c.url, img: c.img || c.subs.find((x) => x.img)?.img || c.products.find((x) => x.img)?.img || "", meta: c.count, number: "", children: [], from: "fill" };
    }
    if (!feature?.img) {
      const first = items.find((x) => x.img);
      if (first) feature = { ...first, children: [], from: "fill" };
    }
    if (!feature?.img) {
      const t = await shopTree(store).catch(() => null);
      const n = t?.tree.find((x) => t.photos[x.url]);
      if (t && n) feature = { kind: "category", name: n.name, url: n.url, img: t.photos[n.url], meta: "", number: "", children: [], from: "fill" };
    }
    if (feature && !feature.img) feature = null;
  }
  return { items, feature, note, missing, follow };
}

/** The store view's category tree as the AI is shown it: the technologies and their categories (two levels). */
export async function treeFor(store: string): Promise<{ name: string; url: string; depth: number }[]> {
  const t = await shopTree(readStore(store));
  const out: { name: string; url: string; depth: number }[] = [];
  for (const n of t.tree) {
    out.push({ name: n.name, url: n.url, depth: 0 });
    for (const c of n.children.slice(0, 14)) out.push({ name: c.name, url: c.url, depth: 1 });
  }
  return out;
}
