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

import { query } from "@/lib/db/client";
import { kvGet } from "@/lib/db/init";
import { ensureConvertSchema } from "@/lib/convert/pages";
import { shopPage } from "@/lib/convert/studio";
import { engageData } from "@/lib/marketingKpis/engage";
import { loadReport } from "@/lib/integrations/articleReport";
import type { Card } from "./model";
import { findNode, numbersIn, parseCategory, parseMenu, parseProduct, tilePhotos, type CategoryPage, type TreeNode } from "./parse";

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
export async function shopCategory(url: string, store: string): Promise<CategoryPage & { img: string }> {
  const path = pathOf(url);
  if (!path.startsWith(`/${store}/`) || !/\.html$/.test(path)) throw new Error("That is not a category of this store view.");
  const page = parseCategory(await readShop(path), `${BASE}${path}`);
  const t = await shopTree(store).catch(() => null);
  return { ...page, name: page.name || (t ? findNode(t.tree, `${BASE}${path}`)?.name ?? "" : ""), img: t?.photos[`${BASE}${path}`] ?? "" };
}

/** A category as a card: its photo (the home page's tile, else its parent's tile, else its first subcategory's or product's). */
export async function categoryCard(url: string, store: string, children: "subs" | "products" | "both" = "both", parentSubs: Card[] = []): Promise<Card> {
  const c = await shopCategory(url, store);
  const tile = parentSubs.find((x) => x.url === c.url)?.img;
  // a leaf category has no subcategories: its products stand in (and a category without products: its subcategories)
  const kids = children === "subs" ? (c.subs.length ? c.subs : c.products) : c.products.length ? c.products : c.subs;
  return {
    kind: "category", name: c.name, url: c.url, img: c.img || tile || c.subs[0]?.img || c.products[0]?.img || "", meta: c.count, number: "",
    children: kids.slice(0, 8).map((k) => ({ ...k, children: [] })),
  };
}

/* ── products by number ────────────────────────────────────────────────── */

const CARDS = new Map<string, { at: number; card: Card | null }>();

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
  const card = parseProduct(await readShop(path), `${BASE}${path}`);
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
export async function cardsForNumbers(text: string, store: string, max = 12): Promise<{ cards: Card[]; missing: Missing[] }> {
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
  return { cards, missing };
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
    if (!pool.length) return { cards: c.products.slice(0, count), note: `None of ${c.name}'s products was ${how === "viewed" ? "viewed" : "bought online"} in the last ${r.months} months - its first ${Math.min(count, c.products.length)} as the shop lists them.` };
  }
  pool.sort((a, b) => (how === "viewed" ? b.views - a.views || b.bought - a.bought : b.bought - a.bought || b.views - a.views));
  const cards: Card[] = [];
  for (const x of pool.slice(0, count + 6)) {
    if (cards.length >= count) break;
    const c = await productCard(x.number, store).catch(() => ({ card: null, why: "" }));
    if (c.card) cards.push({ ...c.card });
  }
  const what = how === "viewed" ? "product pages viewed most" : "products whose articles were bought online most";
  return { cards, note: `The ${what}${inName ? ` in ${inName}` : ""} - the last ${r.months} months (GA4, visitors who accepted statistics cookies).` };
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
  for (const x of [...list].sort((a, b) => b.bought - a.bought).slice(0, within ? 8 : 18)) add(x, "bought");
  for (const x of [...list].sort((a, b) => b.views - a.views).slice(0, within ? 8 : 18)) add(x, "viewed");
  // they go to the AI through the studio: a request stays under the firewall's 8 KB
  return out.slice(0, 36).map((x) => ({ ...x, name: x.name.slice(0, 90) }));
}

/** Cards for the AI's picks (numbers it was shown), in its order. */
export async function cardsForPicks(numbers: string[], store: string, count: number): Promise<Card[]> {
  const cards: Card[] = [];
  for (const n of numbers) {
    if (cards.length >= count) break;
    const r = await productCard(n, store).catch(() => ({ card: null }));
    if (r.card) cards.push(r.card);
  }
  return cards;
}
