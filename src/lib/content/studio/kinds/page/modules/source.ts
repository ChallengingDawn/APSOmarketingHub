// PAGE - WHERE A MODULE'S PRODUCTS COME FROM (server, Content v6, 09.11.2026).
//
// SARCLA 09.11.2026: "fill the product of the bento or other by hierarchy like on the bento", "fill most viewed / most
// bought - allow to fill automatically or by article or product number", "fill with AI". Four ways, all from what the
// hub already holds or the shop itself shows - nothing invented:
//   HIERARCHY  the shop's category tree from its main menu, a category's subcategories and products from its own page
//              (./parse.ts), read through APSOconvert's reader (src/lib/convert/studio.ts shopPage: kept ten minutes, one
//              read at a time per page - the shop's firewall answers a burst with 429)
//   MOST VIEWED / MOST BOUGHT  Website > Products Reports' "Views against orders" read (src/lib/marketingKpis/engage.ts,
//              kept six hours): a product PAGE's views (GA4 view_item on the product page only - on a list it fires for
//              every product listed, so "items viewed" is no view count) and its articles bought online (GA4 purchase,
//              each article once a month; itemRevenue is broken and never used). GA4 counts consented visitors only.
//   NUMBERS    an 8-digit product: its page from the shop's page index (apsomh_convert_pages); a 10-digit article: its
//              product from Products & Pricing as the hub keeps it (Engage's article map, Articles CY/LY's rows)
//   AI         picks among the candidates the three ways above give (./ai.ts) - never a number it was not shown
// A product shows with its name, photo and address as ITS OWN PAGE says them (og:title, og:image) - never a price, never stock.
// Content v7 (the lead 10.11.2026, after builder A's real runs): an AUTOMATIC fill (a category, most bought, most viewed, the
// AI's pick, a finder's products) never shows a product on clearance or replaced ("Nur solange der Vorrat reicht",
// "Nachfolge von ...", "Liquidation" - ./parse.ts clearanceOf) nor one whose photo carries a NEW!/LIQUIDATION sticker, sits on
// a coloured card or is a drawing (./photo.ts, the home page kit's photo audit): another photo of its own page when it has a
// clean one, else it is left out - and the fill says how many. Pasted numbers keep theirs, said "on clearance".

import { query } from "@/lib/db/client";
import { kvGet } from "@/lib/db/init";
import { ensureConvertSchema } from "@/lib/convert/pages";
import { shopPage } from "@/lib/convert/studio";
import { engageData } from "@/lib/marketingKpis/engage";
import { loadReport } from "@/lib/integrations/articleReport";
import type { Card } from "./model";
import { breadcrumbOf, categoryDescription, clearanceOf, findNode, galleryOf, numbersIn, parseCategory, parseMenu, parseProduct, tilePhotos, type CategoryPage, type TreeNode } from "./parse";
import { categoryKey, chainKeys, commonCategory, urlOfKey, wantsPicture, type FollowInfo } from "./follow";
import type { ModuleRef } from "./types";
import { photoBad, photoFlaws } from "./photo";
import { sharpImg } from "./kit";
import { factsHead, parseFacts, type ProductFacts } from "./library2/facts";
import { GALLERY, cleanCards as cleanCardsWith, cleanedNote } from "./clean";

const BASE = "https://www.apsoparts.com";
/** The shop's data is read from production: ACC's catalogue lags behind (the links a module writes follow the page's own host). */
const ENV = "prod" as const;

const pathOf = (url: string) => { try { return new URL(url, BASE).pathname; } catch { return ""; } };
const STORE_RE = /^[a-z]{2}-[A-Z]{2,3}$/;

class ShopBusy extends Error {}
/** At a person's pace: a read the shop has not answered before waits 0.4 s after the last one (its firewall answers a
 * burst with 429) - a page read in the last ten minutes comes from APSOconvert's reader at once. */
let lastRead = 0;
async function pace(): Promise<void> {
  const wait = lastRead + 400 - Date.now();
  lastRead = Math.max(Date.now(), lastRead + 400);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}
async function readShop(path: string): Promise<string> {
  try {
    await pace();
    const p = await shopPage(ENV, path);
    if (p.status === 429) throw new ShopBusy("The shop asks the hub to slow down - try again in a minute.");
    if (p.status !== 200) throw new Error(`The shop answered ${p.status} for ${path}.`);
    return p.html;
  } catch (e) {
    if (e instanceof ShopBusy) throw e;
    const msg = String((e as Error)?.message ?? e);
    if (/sandbox/i.test(msg)) throw new Error("The local sandbox does not reach the shop - start it with SANDBOX_SHOP=read to read its pages.");
    throw new Error(`The shop could not be read just now (${msg.slice(0, 120)}).`);
  }
}

/* ── the category tree ─────────────────────────────────────────────────── */

export type TreeOut = { store: string; tree: TreeNode[]; photos: Record<string, string> };
const TREES = new Map<string, { at: number; out: TreeOut }>();

/** A store view's category tree (its home page's main menu) and the photos its home page puts on its tiles. */
export async function shopTree(store: string): Promise<TreeOut> {
  if (!STORE_RE.test(store)) throw new Error("Which store view?");
  const held = TREES.get(store);
  if (held && Date.now() - held.at < 6 * 3600_000) return held.out;
  const html = await readShop(`/${store}/`);
  const out: TreeOut = { store, tree: parseMenu(html, BASE), photos: tilePhotos(html, BASE) };
  if (!out.tree.length) throw new Error(`The shop's menu was not found on the ${store} home page.`);
  TREES.set(store, { at: Date.now(), out });
  return out;
}

/** A category's page as a module reads it; its photo from its parent's tile or the home page's. */
export async function shopCategory(url: string, store: string): Promise<CategoryPage & { img: string; cleared: number }> {
  const path = pathOf(url);
  if (!path.startsWith(`/${store}/`) || !/\.html$/.test(path)) throw new Error("That is not a category of this store view.");
  const page = parseCategory(await readShop(path), `${BASE}${path}`);
  const t = await shopTree(store).catch(() => null);
  // its products on clearance or replaced are never offered to a fill
  const products = page.products.filter((p) => !clearanceOf(p.name, p.url));
  return { ...page, products, cleared: page.products.length - products.length, name: page.name || (t ? findNode(t.tree, `${BASE}${path}`)?.name ?? "" : ""), img: t?.photos[`${BASE}${path}`] ?? "" };
}

/* ── a photo fit for a module ──────────────────────────────────────────── */

const PHOTOS = new Map<string, boolean>();
let lastPhoto = 0;
/** Is a product photo clean (no sticker, no coloured card, not a drawing)? Its 500 px picture read once (kept); when it
 * cannot be read it counts as clean - a fill never fails for it. */
export async function photoOk(img: string): Promise<boolean> {
  if (!img) return false;
  const url = sharpImg(img);
  const held = PHOTOS.get(url);
  if (held !== undefined) return held;
  let ok = true;
  try {
    const wait = lastPhoto + 120 - Date.now();
    lastPhoto = Math.max(Date.now(), lastPhoto + 120);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "APSOhub-modules" } }).finally(() => clearTimeout(timer));
    if (r.ok) {
      const sharp = (await import("sharp")).default;
      const { data, info } = await sharp(Buffer.from(await r.arrayBuffer()), { failOn: "none" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      ok = !photoBad(photoFlaws(data, info.width, info.height, info.channels, url));
    }
  } catch { ok = true; }
  PHOTOS.set(url, ok);
  while (PHOTOS.size > 5000) PHOTOS.delete(PHOTOS.keys().next().value as string);
  return ok;
}

export { cleanedNote, knowGallery, type Cleaned } from "./clean";
/** An automatic fill's products, cleaned (./clean.ts) - a product's other photos read from its own page when needed. */
export const cleanCards = (cards: Card[], count: number, check: (img: string) => Promise<boolean> = photoOk) =>
  cleanCardsWith(cards, count, check, (url) => readShop(pathOf(url)).then((h) => galleryOf(h)));

/** A category as a card: its photo (the home page's tile, else its parent's tile, else its first subcategory's or product's). */
export async function categoryCard(url: string, store: string, children: "subs" | "products" | "both" = "both", parentSubs: Card[] = []): Promise<Card> {
  const c = await shopCategory(url, store);
  const tile = parentSubs.find((x) => x.url === c.url)?.img;
  // a leaf category has no subcategories: its products stand in (and a category without products: its subcategories)
  const kids0 = children === "subs" ? (c.subs.length ? c.subs : c.products) : c.products.length ? c.products : c.subs;
  // its products as an automatic fill shows them (a finder's panel shows four)
  const kids = kids0.some((k) => k.kind === "product") ? (await cleanCards(kids0, 6)).cards : kids0;
  return {
    kind: "category", name: c.name, url: c.url, img: c.img || tile || c.subs[0]?.img || c.products[0]?.img || "", meta: c.count, number: "",
    children: kids.slice(0, 8).map((k) => ({ ...k, children: [] })),
  };
}

/* ── products by number ────────────────────────────────────────────────── */

const CARDS = new Map<string, { at: number; card: Card | null }>();
/** a product page's gallery (its other photos), by its address - read with the page */

/** A product's page in a store view, from the shop's page index (the live shop's first). */
async function productPath(number: string, store: string): Promise<{ path: string | null; elsewhere: string | null }> {
  await ensureConvertSchema();
  const r = await query<{ url: string; store: string; env: string }>(
    "SELECT url, store, env FROM apsomh_convert_pages WHERE product = $1 AND gone_at IS NULL AND kind = 'product' ORDER BY (env = 'prod') DESC LIMIT 40", [number]);
  const here = r.rows.find((x) => x.store === store && x.env === "prod") ?? r.rows.find((x) => x.store === store);
  return { path: here ? pathOf(here.url) : null, elsewhere: here ? null : r.rows[0]?.store ?? null };
}

/** One product as a card, read from its own page (kept six hours). */
async function productCard(number: string, store: string): Promise<{ card: Card | null; why: string }> {
  const key = `${store}|${number}`;
  const held = CARDS.get(key);
  if (held && Date.now() - held.at < 6 * 3600_000) return { card: held.card, why: held.card ? "" : "not on the shop" };
  const { path, elsewhere } = await productPath(number, store);
  if (!path) return { card: null, why: elsewhere ? `not in ${store} (the shop has it in ${elsewhere})` : "not on the shop" };
  const html = await readShop(path);
  const card = parseProduct(html, `${BASE}${path}`);
  if (card) GALLERY.set(card.url, galleryOf(html));
  // its categories, read with the page (a module's picture follows them - ./follow.ts)
  keepCrumbs([`${BASE}${path}`, card?.url ?? ""], store, breadcrumbOf(html));
  CARDS.set(key, { at: Date.now(), card });
  while (CARDS.size > 2000) CARDS.delete(CARDS.keys().next().value as string);
  return { card, why: card ? "" : "its page shows no product" };
}

/** Engage's article -> product map (src/lib/marketingKpis/engage.ts ARTICLE_PRODUCT), then Articles CY/LY's rows. */
async function productsOfArticles(articles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!articles.length) return out;
  const map = (await kvGet<Record<string, string>>("marketingKpis:articleProduct:v1").catch(() => null)) ?? {};
  for (const a of articles) if (/^\d{8}$/.test(map[a] ?? "")) out.set(a, map[a]);
  if (out.size < articles.length) {
    const report = await loadReport().catch(() => null);
    for (const r of report?.rows ?? []) {
      const row = r as unknown as { article?: string; product?: string };
      if (row.article && articles.includes(row.article) && !out.has(row.article) && /^\d{8}$/.test(row.product ?? "")) out.set(row.article, row.product!);
    }
  }
  return out;
}

export type Missing = { number: string; why: string };

/** Pasted numbers as cards, in the order pasted: products, and articles by their product; what was not found, and why. */
export async function cardsForNumbers(text: string, store: string, max = 12): Promise<{ cards: Card[]; missing: Missing[]; flagged: Missing[] }> {
  const n = numbersIn(text);
  const missing: Missing[] = n.other.map((x) => ({ number: x, why: "not a product (8 digits) or an article (10 digits)" }));
  const byArticle = await productsOfArticles(n.articles);
  const order: { number: string; product: string }[] = [];
  for (const raw of text.split(/[\s,;|]+/).map((x) => x.replace(/[.'’-]/g, "")).filter(Boolean)) {
    if (/^\d{8}$/.test(raw)) order.push({ number: raw, product: raw });
    else if (/^\d{10}$/.test(raw)) {
      const p = byArticle.get(raw);
      if (p) order.push({ number: raw, product: p });
      else if (!missing.some((m) => m.number === raw)) missing.push({ number: raw, why: "an article the hub cannot tie to a product (it knows the articles bought online and in its reports)" });
    }
  }
  const cards: Card[] = [];
  const seen = new Set<string>();
  for (const o of order) {
    if (seen.has(o.product) || cards.length >= max) continue;
    seen.add(o.product);
    const r = await productCard(o.product, store).catch((e) => ({ card: null, why: String((e as Error).message ?? e).slice(0, 160) }));
    if (r.card) cards.push(r.card);
    else missing.push({ number: o.number, why: r.why });
  }
  // asked for by number: kept - but said
  const flagged = cards.filter((c) => clearanceOf(c.name, c.url)).map((c) => ({ number: c.number, why: "on clearance or replaced - kept, as it was asked for" }));
  return { cards, missing, flagged };
}

/* ── most viewed, most bought ──────────────────────────────────────────── */

export type Ranked = { number: string; name: string; views: number; bought: number };

/**
 * The products by their page's views or their articles bought online - the last three whole months and this month so
 * far (Engage keeps last year's twelve months, then this year's). Null while Engage's read is being made the first time.
 */
export async function rankedProducts(): Promise<{ list: Ranked[]; months: number; at: string } | { list: null; why: string }> {
  const st = await engageData();
  const d = st.value;
  if (!d) return { list: null, why: st.computing ? "The views and orders are being read from GA4 (a few minutes, once) - try again shortly." : st.error ?? "The views and orders could not be read." };
  const now = 12 + d.monthsDone; // this month's index (in progress)
  const from = Math.max(0, now - 3);
  const list: Ranked[] = [];
  for (const [number, p] of Object.entries(d.products ?? {})) {
    let views = 0, bought = 0;
    for (let i = from; i <= now; i++) { views += p.v[i] ?? 0; bought += p.b?.[i] ?? 0; }
    if (views || bought) list.push({ number, name: p.n, views, bought });
  }
  return { list, months: now - from + 1, at: d.generatedAt };
}

/**
 * The most viewed or most bought products as cards - those the store view has, in their order. `within`: a category's
 * address - only its products (the first page of its list: the shop's own order).
 */
export async function topCards(how: "viewed" | "bought", store: string, count: number, within?: string): Promise<{ cards: Card[]; note: string }> {
  const r = await rankedProducts();
  if (!r.list) throw new Error(r.why);
  let pool = r.list.filter((x) => (how === "viewed" ? x.views : x.bought) > 0);
  let inName = "";
  if (within) {
    const c = await shopCategory(within, store);
    const nums = new Set(c.products.map((p) => p.number).filter(Boolean));
    pool = pool.filter((x) => nums.has(x.number));
    inName = c.name;
    // a category whose products were not looked at / bought lately: its own order on the shop
    if (!pool.length) { const k = await cleanCards(c.products, count); return { cards: k.cards, note: `None of ${c.name}'s products was ${how === "viewed" ? "viewed" : "bought online"} in the last ${r.months} months - its first ${Math.min(count, c.products.length)} as the shop lists them.${cleanedNote({ clearance: k.clearance + c.cleared, photo: k.photo })}` }; }
  }
  pool.sort((a, b) => (how === "viewed" ? b.views - a.views || b.bought - a.bought : b.bought - a.bought || b.views - a.views));
  const cards: Card[] = [];
  let clearance = 0, photo = 0;
  for (const x of pool.slice(0, count + 14)) {
    if (cards.length >= count) break;
    const c = await productCard(x.number, store).catch(() => ({ card: null, why: "" }));
    if (!c.card) continue;
    const k = await cleanCards([c.card], 1);
    clearance += k.clearance; photo += k.photo;
    if (k.cards[0]) cards.push({ ...k.cards[0] });
  }
  const what = how === "viewed" ? "product pages viewed most" : "products whose articles were bought online most";
  return { cards, note: `The ${what}${inName ? ` in ${inName}` : ""} - the last ${r.months} months (GA4, visitors who accepted statistics cookies).${cleanedNote({ clearance, photo })}` };
}

/** What the AI may pick from: the most viewed and most bought, and a category's products - each with its figures. */
export async function aiCandidates(store: string, within?: string): Promise<{ number: string; name: string; views: number; bought: number; from: string }[]> {
  const out: { number: string; name: string; views: number; bought: number; from: string }[] = [];
  const add = (x: { number: string; name: string; views: number; bought: number }, from: string) => { if (!out.some((o) => o.number === x.number)) out.push({ ...x, from }); };
  const r = await rankedProducts().catch(() => ({ list: null }));
  const list = r.list ?? [];
  if (within) {
    const c = await shopCategory(within, store);
    for (const p of c.products.slice(0, 18)) {
      const f = list.find((x) => x.number === p.number);
      if (p.number) add({ number: p.number, name: p.name, views: f?.views ?? 0, bought: f?.bought ?? 0 }, "category");
    }
  }
  const fine = list.filter((x) => !clearanceOf(x.name));
  for (const x of [...fine].sort((a, b) => b.bought - a.bought).slice(0, within ? 8 : 18)) add(x, "bought");
  for (const x of [...fine].sort((a, b) => b.views - a.views).slice(0, within ? 8 : 18)) add(x, "viewed");
  // they go to the AI through the studio: a request stays under the firewall's 8 KB
  return out.slice(0, 36).map((x) => ({ ...x, name: x.name.slice(0, 90) }));
}

/** Cards for the AI's picks (numbers it was shown), in its order. */
export async function cardsForPicks(numbers: string[], store: string, count: number): Promise<Card[]> {
  const cards: Card[] = [];
  for (const n of numbers) {
    if (cards.length >= count) break;
    const r = await productCard(n, store).catch(() => ({ card: null }));
    if (!r.card) continue;
    const k = await cleanCards([r.card], 1);
    if (k.cards[0]) cards.push(k.cards[0]);
  }
  return cards;
}

/* ── a module's picture follows its products (Content v12, SARCLA 10.11.2026: "on some bento you change the product but
 *    the background photo keeps seals") - the decisions are ./follow.ts's; here what the shop says ── */

/** A product page's categories (its breadcrumb), by its address - kept six hours; and the categories' names by key. */
const CRUMBS = new Map<string, { at: number; leaf: string }>();
const NAMES = new Map<string, string>();
function keepCrumbs(urls: string[], store: string, chain: { name: string; url: string }[]): void {
  const leaf = chain.length ? categoryKey(chain[chain.length - 1].url) : "";
  for (const u of urls) if (u) CRUMBS.set(u, { at: Date.now(), leaf });
  for (const c of chain) { const k = categoryKey(c.url); if (k) NAMES.set(`${store}|${k}`, c.name); }
  while (CRUMBS.size > 5000) CRUMBS.delete(CRUMBS.keys().next().value as string);
  while (NAMES.size > 5000) NAMES.delete(NAMES.keys().next().value as string);
}

/** A product's category (its key): its breadcrumb, from what the hub read already, else its own page (one read). */
async function productCategory(url: string, store: string): Promise<string> {
  const held = CRUMBS.get(url);
  if (held && Date.now() - held.at < 6 * 3600_000) return held.leaf;
  const path = pathOf(url);
  if (!path.startsWith(`/${store}/`) || !/\.html$/.test(path)) return "";
  const html = await readShop(path);
  const chain = breadcrumbOf(html);
  keepCrumbs([url, `${BASE}${path}`], store, chain);
  return chain.length ? categoryKey(chain[chain.length - 1].url) : "";
}

/**
 * Each item's category: a category card is its own; the products of a module filled from a category (`hint`) are that
 * category's; the others' from their pages' breadcrumbs - three pages read at most (each kept), the rest unknown.
 */
async function itemCats(items: Card[], hint: string, store: string): Promise<string[]> {
  const hk = hint && pathOf(hint).startsWith(`/${store}/`) ? categoryKey(hint) : "";
  const out: string[] = [];
  let reads = 0;
  for (const it of items.slice(0, 12)) {
    const own = categoryKey(it.url);
    if (own) { out.push(own); continue; }
    if (hk) { out.push(hk); continue; }
    const held = CRUMBS.get(it.url);
    if (held && Date.now() - held.at < 6 * 3600_000) { out.push(held.leaf); continue; }
    if (reads >= 3 || out.filter(Boolean).length >= 3) { out.push(""); continue; }
    reads++;
    out.push(await productCategory(it.url, store).catch(() => ""));
  }
  return out;
}

/** A category's name: from a breadcrumb read, the shop's menu, else its page. */
async function nameOfKey(key: string, store: string): Promise<string> {
  const held = NAMES.get(`${store}|${key}`);
  if (held) return held;
  const t = await shopTree(store).catch(() => null);
  const n = t ? findNode(t.tree, urlOfKey(key, store))?.name : "";
  if (n) return n;
  return (await shopCategory(urlOfKey(key, store), store).catch(() => null))?.name ?? "";
}

/**
 * The photo of a category as a module's picture: the shop's own home page photo of it or of the nearest category above it
 * (large, made for a banner - no read beyond the home page, kept six hours), else the tile its parent's page shows for it
 * or for the nearest one above, else its own page's first subcategory tile. null when the shop shows none.
 */
export async function categoryPhoto(key: string, store: string): Promise<Card | null> {
  const keys = chainKeys(key);
  if (!keys.length) return null;
  const t = await shopTree(store).catch(() => null);
  const card = async (k: string, img: string, name = ""): Promise<Card> => ({ kind: "category", name: name || (await nameOfKey(k, store)) || k.split("/").pop() || k, url: urlOfKey(k, store), img, meta: "", number: "", children: [], from: "fill" });
  for (let i = keys.length - 1; i >= 0; i--) {
    const img = t?.photos[urlOfKey(keys[i], store)];
    if (img) return card(keys[i], img);
  }
  for (let i = keys.length - 1; i >= 1; i--) {
    const parent = await shopCategory(urlOfKey(keys[i - 1], store), store).catch(() => null);
    const tile = parent?.subs.find((x) => x.url === urlOfKey(keys[i], store));
    if (tile?.img) return card(keys[i], tile.img, tile.name);
  }
  const own = await shopCategory(urlOfKey(key, store), store).catch(() => null);
  const sub = own?.subs.find((x) => x.img);
  return sub ? card(key, sub.img, own?.name ?? "") : null;
}

/**
 * What a module's products are (./follow.ts FollowInfo): their categories, the one they share, and - when the module
 * wants a picture for them (its fill's picture no longer theirs, or none where it needs one; `force`: always, for a fill
 * that does not know the module's picture) - that category's photo.
 */
export async function followInfo(o: { m: ModuleRef; store: string; hint?: string; force?: boolean }): Promise<FollowInfo> {
  const store = String(o.store).split("/")[0];
  if (!STORE_RE.test(store)) throw new Error("Which store view?");
  const cats = await itemCats(o.m.settings.items, o.hint ?? "", store);
  const key = commonCategory(cats);
  const common = key ? { url: urlOfKey(key, store), name: await nameOfKey(key, store).catch(() => "") } : null;
  const photo = key && (o.force || wantsPicture(o.m, cats)) ? await categoryPhoto(key, store).catch(() => null) : null;
  return { cats, common, photo };
}

/* ── a category's own facts, for a new page about it (Content v8) ──────────────────────────────────────── */

export type CategoryFacts = { name: string; url: string; words: string; product: { name: string; url: string; rows: string[][] } | null };

/** What the shop itself says on a category: its description (its words and figures) and its first product's technical
 * summary (a product not on clearance) - read like every other shop page here (kept ten minutes, at a person's pace).
 * The words a new page about it may use for its figures (lead 10.11.2026: "figures only from those facts"). */
export async function categoryFacts(url: string, store: string): Promise<CategoryFacts> {
  const path = pathOf(url);
  if (!path.startsWith(`/${store}/`) || !/\.html$/.test(path)) throw new Error("That is not a category of this store view.");
  const html = await readShop(path);
  const c = parseCategory(html, `${BASE}${path}`);
  const first = c.products.find((p) => !clearanceOf(p.name, p.url));
  let product: CategoryFacts["product"] = null;
  if (first) {
    const f = await productFacts(first.url, store).catch(() => null);
    if (f?.table.length) product = { name: first.name, url: first.url, rows: f.table.slice(0, 16) };
  }
  return { name: c.name, url: `${BASE}${path}`, words: categoryDescription(html), product };
}

/* ── a product's facts (Content v7, the library part 2: "Technical summary", "Downloads") ──────────────── */

/** A product page's own facts for the library's technical summary and downloads: its card, its line under the title, its
 * "Technische Zusammenfassung" as table rows (never its approvals or certificates) and its downloads - read like every
 * other shop page here (kept ten minutes, at a person's pace). */
export async function productFacts(url: string, store: string): Promise<{ card: Card | null } & ProductFacts> {
  const path = pathOf(url);
  const sv = String(store).split("/")[0];
  if (!STORE_RE.test(sv) || !path.startsWith(`/${sv}/`) || !/\.html$/.test(path)) throw new Error("That is not a product page of this store view.");
  const html = await readShop(path);
  return { card: parseProduct(html, `${BASE}${path}`), ...parseFacts(html, factsHead(store)) };
}
