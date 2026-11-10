// THE SHOP'S PRODUCTS AS PICTURES (Content v7, 10.11.2026). Server only.
//
// SARCLA 10.11.2026 (point 11): "on pictures we should have all of our products as well". The picture panel of every studio
// (src/app/projects/studio/pictures.tsx) gets a "Products" source beside making, uploading and the picture store: the
// shop's own product photos, found the way a buyer finds them - nothing copied, nothing generated:
//   by words      the shop's own search page (/<store>/catalogsearch/result/?q=...): one read gives up to 24 products
//                 with their names and photos, in the shop's order
//   by number     an 8-digit product or a 10-digit article: its page from the shop's page index (apsomh_convert_pages),
//                 its name and photo from that page (the module gallery's reader, ./studio/kinds/page/modules/source.ts)
//   by category   the shop's menu (its technologies and their categories), then a category's own page: its products
//                 and its subcategories, with their photos
// Every page is read through APSOconvert's reader (kept ten minutes) at a person's pace - the shop's firewall answers a
// burst with 429. A product is given back as its NAME, NUMBER, PAGE and PHOTO ADDRESS (the 500 px photo the product page
// zooms): a studio keeps the address, never the picture's bytes, and the name is its alt text.

import { shopPage } from "@/lib/convert/studio";
import { parseCategory } from "./studio/kinds/page/modules/parse";
import { sharpImg } from "./studio/kinds/page/modules/render";
import { cardsForNumbers, shopCategory, shopTree } from "./studio/kinds/page/modules/source";

export type ProductPicture = { name: string; number: string; url: string; img: string };
export type CategoryLink = { name: string; url: string; img: string };

const BASE = "https://www.apsoparts.com";
const STORE_RE = /^[a-z]{2}-[A-Z]{2,3}$/;
/** A store view the shop has a catalogue for - another currency's ("de-CH/eur") reads its language's. */
export function storeOf(raw: unknown): string {
  const m = /^([a-z]{2}-[A-Z]{2,3})/.exec(String(raw ?? ""));
  return m && STORE_RE.test(m[1]) ? m[1] : "de-CH";
}

let lastRead = 0;
/** At a person's pace: a read the shop has not answered lately waits 0.4 s after the last one. */
async function pace(): Promise<void> {
  const wait = lastRead + 400 - Date.now();
  lastRead = Math.max(Date.now(), lastRead + 400);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

const asPicture = (c: { name: string; number: string; url: string; img: string }): ProductPicture | null =>
  c.img && c.name ? { name: c.name, number: c.number, url: c.url, img: sharpImg(c.img) } : null;

/** Words people type, as the shop's search takes them: letters, digits, a few signs - at most 80 characters. */
export function searchWords(q: string): string {
  return String(q ?? "").replace(/[^\p{L}\p{N}\s.,/+-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
/** Is it a product (8 digits) or an article (10 digits) number - or several, pasted? */
export const isNumbers = (q: string) => /^[\d\s.,;'’-]+$/.test(q.trim()) && /\d{8}/.test(q.replace(/[.'’-]/g, ""));

/** The shop's products for a few words or numbers, with their photos (up to 24, the shop's order). */
export async function findProducts(raw: string, storeRaw: unknown): Promise<{ products: ProductPicture[]; note: string }> {
  const store = storeOf(storeRaw);
  const q = searchWords(raw);
  if (q.length < 2) return { products: [], note: "Type at least two letters, or a product number." };
  if (isNumbers(q)) {
    const r = await cardsForNumbers(q, store, 12);
    const products = r.cards.map(asPicture).filter((x): x is ProductPicture => !!x);
    const missing = r.missing.map((m) => `${m.number} (${m.why})`).join(", ");
    return { products, note: missing ? `Not found: ${missing}.` : "" };
  }
  await pace();
  const path = `/${store}/catalogsearch/result/?q=${encodeURIComponent(q)}`;
  const page = await shopPage("prod", path).catch((e) => { throw new Error(`The shop could not be searched just now (${String((e as Error)?.message ?? e).slice(0, 100)}).`); });
  if (page.status === 429) throw new Error("The shop asks the hub to slow down - try again in a minute.");
  if (page.status !== 200) throw new Error("The shop's search did not answer - try again in a moment.");
  const found = parseCategory(page.html, `${BASE}${path}`).products;
  const products = found.map(asPicture).filter((x): x is ProductPicture => !!x).slice(0, 24);
  return { products, note: products.length ? "" : `The shop finds no product for "${q}" in ${store}.` };
}

/** A category's products (with photos) and its subcategories, from its own page on the shop. */
export async function categoryProducts(url: string, storeRaw: unknown): Promise<{ name: string; products: ProductPicture[]; subs: CategoryLink[] }> {
  const store = storeOf(storeRaw);
  await pace();
  const c = await shopCategory(url, store);
  return {
    name: c.name,
    products: c.products.map(asPicture).filter((x): x is ProductPicture => !!x).slice(0, 24),
    subs: c.subs.map((s) => ({ name: s.name, url: s.url, img: s.img })).slice(0, 24),
  };
}

/** The shop's technologies and their first categories (its menu), to browse by. */
export type TreeBranch = CategoryLink & { children: CategoryLink[] };
export async function productTree(storeRaw: unknown): Promise<TreeBranch[]> {
  const t = await shopTree(storeOf(storeRaw));
  return t.tree.map((n) => ({
    name: n.name, url: n.url, img: t.photos[n.url] ?? "",
    children: n.children.map((k) => ({ name: k.name, url: k.url, img: t.photos[k.url] ?? "" })).slice(0, 24),
  }));
}
