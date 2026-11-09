// PAGE - THE MODULE GALLERY'S SERVER ACTIONS (Content v6, 09.11.2026). Behind the project's own access (the to-do's route),
// read only: nothing is written to the shop, nothing to the document (the studio saves the module it gets back).
//
//   module_tree        the store view's category tree (the shop's menu) with the photos its home page shows
//   module_category    one category's page: its products and subcategories (name, photo, link, the shop's count)
//   module_branch      a category's subcategories (or the shop's technologies), each with its products or its own
//                      subcategories - a finder bento, a mosaic, category cards in one go (one shop read per category)
//   module_numbers     pasted product or article numbers as cards, and which were not found and why
//   module_top         the most viewed or most bought products (in a category, when one is given)
//   module_candidates  what "Fill with AI" may pick from; module_picks: its picks as cards
// AI task (registered by ../server.ts): module_fill - ./ai.ts

import type { ServerAction } from "../../../contract";
import { s } from "../../../contract";
import { pageDoc, viewOf } from "../model";
import type { Card } from "./model";
import { aiCandidates, cardsForNumbers, cardsForPicks, categoryCard, shopCategory, shopTree, topCards } from "./source";
import type { TreeNode } from "./parse";

const STORE_RE = /^[a-z]{2}-[A-Z]{2,3}$/;
/** The store view asked for, else the one shown ("lang"), else the page's own. */
function storeIn(raw: unknown, input: Record<string, unknown>, language: string | null): string {
  if (typeof input.store === "string" && STORE_RE.test(input.store)) return input.store;
  const d = viewOf(pageDoc(raw, language), typeof input.lang === "string" ? input.lang : null);
  return STORE_RE.test(d.store) ? d.store : "de-CH";
}
const countIn = (input: Record<string, unknown>, max = 12) => Math.max(1, Math.min(max, Math.round(Number(input.count) || 6)));
const urlIn = (input: Record<string, unknown>) => s(input.url, 400);

/** The tree as the picker shows it: names, addresses, photos where the home page has them - three levels. */
type TreeOutNode = { name: string; url: string; img: string; children: TreeOutNode[] };
const treeOut = (nodes: TreeNode[], photos: Record<string, string>): TreeOutNode[] =>
  nodes.map((n) => ({ name: n.name, url: n.url, img: photos[n.url] ?? "", children: treeOut(n.children, photos) }));

const moduleTree: ServerAction = async (ctx, raw, input) => {
  const t = await shopTree(storeIn(raw, input, ctx.piece.language));
  return { store: t.store, tree: treeOut(t.tree, t.photos) };
};

const moduleCategory: ServerAction = async (ctx, raw, input) => {
  const store = storeIn(raw, input, ctx.piece.language);
  const c = await shopCategory(urlIn(input), store);
  return { category: { name: c.name, url: c.url, img: c.img, count: c.count, subs: c.subs, products: c.products } };
};

/**
 * A branch of the tree as category cards: the shop's technologies (no address) or a category's subcategories, each with
 * `kids` = its products (a finder's panels) or its subcategories (a mosaic's rows, a category card's list). One read of the
 * shop per category, in turn.
 */
const moduleBranch: ServerAction = async (ctx, raw, input) => {
  const store = storeIn(raw, input, ctx.piece.language);
  const kids = input.kids === "subs" ? "subs" : "products";
  const max = countIn(input, 8);
  const url = urlIn(input);
  let list: Card[];
  if (!url) {
    const t = await shopTree(store);
    list = t.tree.map((n) => ({ kind: "category" as const, name: n.name, url: n.url, img: t.photos[n.url] ?? "", meta: "", number: "", children: [] }));
  } else {
    const c = await shopCategory(url, store);
    list = c.subs.length ? c.subs : [];
    if (!list.length) return { cards: [], note: `${c.name || "This category"} has no subcategories on the shop - pick its parent, or fill a product module with its products.` };
  }
  const out: Card[] = [];
  const missing: string[] = [];
  for (const sub of list.slice(0, max)) {
    try {
      const card = await categoryCard(sub.url, store, kids, list);
      out.push({ ...card, img: sub.img || card.img, name: sub.name || card.name });
    } catch (e) {
      missing.push(`${sub.name}: ${(e as Error).message}`);
    }
  }
  return { cards: out, missing, more: Math.max(0, list.length - max) };
};

const moduleNumbers: ServerAction = async (ctx, raw, input) =>
  cardsForNumbers(s(input.text, 2000), storeIn(raw, input, ctx.piece.language), countIn(input));

const moduleTop: ServerAction = async (ctx, raw, input) =>
  topCards(input.how === "bought" ? "bought" : "viewed", storeIn(raw, input, ctx.piece.language), countIn(input), urlIn(input) || undefined);

const moduleCandidates: ServerAction = async (ctx, raw, input) =>
  ({ candidates: await aiCandidates(storeIn(raw, input, ctx.piece.language), urlIn(input) || undefined) });

const modulePicks: ServerAction = async (ctx, raw, input) => {
  const numbers = Array.isArray(input.numbers) ? input.numbers.map(String).filter((n) => /^\d{8}$/.test(n)).slice(0, 12) : [];
  return { cards: await cardsForPicks(numbers, storeIn(raw, input, ctx.piece.language), countIn(input)) };
};

export const moduleActions: Record<string, ServerAction> = {
  module_tree: moduleTree, module_category: moduleCategory, module_branch: moduleBranch, module_numbers: moduleNumbers,
  module_top: moduleTop, module_candidates: moduleCandidates, module_picks: modulePicks,
};
