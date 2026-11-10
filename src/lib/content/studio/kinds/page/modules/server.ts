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
// AI tasks (registered by ../server.ts): module_fill - ./ai.ts; module_words ("Fill it with AI", Content v11) - ./words.ts

import type { AiTask, ServerAction, StudioCtx } from "../../../contract";
import { s } from "../../../contract";
import { languageOfStore, pageDoc, viewOf, type PageDoc } from "../model";
import { moduleOfChange, type Card } from "./model";
import { aiCandidates, cardsForNumbers, cardsForPicks, categoryCard, cleanCards, cleanedNote, shopCategory, shopTree, topCards } from "./source";
import type { TreeNode } from "./parse";
import { MODULE_FILL_SCHEMA, MODULE_FILL_SYSTEM, candidatesIn, cleanPick, moduleFillUser } from "./ai";
import { MODULE_WORDS_SCHEMA, MODULE_WORDS_SYSTEM, cleanModuleWords, datesIn, moduleWordsUser, pageWordsOf } from "./words";
import { libModule } from "../plan/library";
import { treeFor } from "../plan/fill";
import { readBrain } from "@/lib/brain";

const STORE_RE = /^([a-z]{2}-[A-Z]{2,3})(\/[a-z]{3})?$/;
/** The store view whose shop is read: the one asked for, else the one shown ("lang"), else the page's own - a store view
 * in another currency ("de-CH/eur") reads its own language's (the same catalogue; the module writes its links there). */
function storeIn(raw: unknown, input: Record<string, unknown>, language: string | null): string {
  const asked = typeof input.store === "string" ? STORE_RE.exec(input.store) : null;
  if (asked) return asked[1];
  const d = viewOf(pageDoc(raw, language), typeof input.lang === "string" ? input.lang : null);
  return STORE_RE.exec(d.store)?.[1] ?? "de-CH";
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
  // a fill (count given): its first products as an automatic fill shows them - none on clearance, no sticker on a photo
  if (input.count !== undefined) {
    const k = await cleanCards(c.products, countIn(input));
    return { category: { name: c.name, url: c.url, img: c.img, count: c.count, subs: c.subs, products: k.cards }, cleaned: cleanedNote({ clearance: k.clearance + c.cleared, photo: k.photo }).trim() };
  }
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

/** "Fill with AI" as a task of the page studio, given how it says the page (its context and outline) - ./ai.ts. */
export function moduleFillTask(page: (ctx: StudioCtx, raw: unknown, input: Record<string, unknown>) => string): AiTask {
  return {
    label: "Fill a block with products",
    schema: MODULE_FILL_SCHEMA,
    system: MODULE_FILL_SYSTEM,
    effort: "low",
    maxTokens: 1500,
    user: (ctx, raw, input) => moduleFillUser(page(ctx, raw, input), input),
    clean: (raw, _doc, _ctx, input) => cleanPick(raw, candidatesIn(input.candidates), Math.max(1, Math.min(12, Number(input.count) || 5))),
  };
}

/* ── "Fill it with AI" for one module (Content v11, SARCLA 10.11.2026: "I can't see launch the AI to fill me the block") ──
 *    one task behind the module's settings button and the chip's "Ask AI" with the module selected - ./words.ts ── */

const B = "https://www.apsoparts.com";
const NL = "\n";
const whole = (u: string) => (u.startsWith("/") ? `${B}${u}` : u);

/** Everything the module's words are written from and checked against: the page's other blocks, the pages a button may
 * go to, the shop's categories, the dates the page gives, what a word may name. */
async function wordsContext(ctx: StudioCtx, raw: unknown, input: Record<string, unknown>, context: (ctx: StudioCtx, d: PageDoc) => string) {
  const d = viewOf(pageDoc(raw, ctx.piece.language), typeof input.lang === "string" ? input.lang : null);
  const key = s(input.key, 40);
  const id = key.startsWith("np:") ? key.slice(3) : "";
  const mine = id ? null : key;
  // the page's words: a new page's blocks and its other modules; a page of the shop's outline and its other modules
  const page = d.source === "new" ? pageWordsOf(d.fields, id)
    : [d.outline?.path === d.path ? [d.outline.title, ...d.outline.h1, ...d.outline.lines].join(NL) : "",
      ...d.changes.filter((c) => c.id !== mine).map((c) => { const m = moduleOfChange(c); return m ? `module ${libModule(m.type)?.name ?? m.type}: ${[m.settings.title, m.settings.text].filter(Boolean).join(" · ")}` : ""; })].filter(Boolean).join(NL);
  const tree = await treeFor(d.store).catch(() => [] as { name: string; url: string; depth: number }[]);
  // the pages a button may go to: the page's own links and the shop's categories
  const own: { url: string; name: string }[] = [];
  if (d.source === "new") {
    const f = d.fields;
    for (const l of f.links) if (l.url) own.push({ url: whole(l.url), name: l.label || l.note });
    if (f.hero.button.url) own.push({ url: whole(f.hero.button.url), name: f.hero.button.label });
    if (f.cta.button.url) own.push({ url: whole(f.cta.button.url), name: f.cta.button.label });
    for (const pm of f.modules ?? []) for (const l of [pm.module.settings.link, pm.module.settings.link2]) if (l.url) own.push({ url: whole(l.url), name: l.label });
  }
  const links = [...own, ...tree.map((t) => ({ url: whole(t.url), name: t.name }))].filter((l, i, all) => l.url && all.findIndex((x) => x.url === l.url) === i);
  const brain = await readBrain().catch(() => null);
  const facts = brain ? JSON.stringify([brain.brandVoice, brain.positioningGuard, brain.productContentRules]) : "";
  const head = context(ctx, d);
  const dates = datesIn(`${page}${NL}${head}`);
  return { d, page, tree, links, head, dates, pageText: `${head} ${page} ${s(input.request, 1500)} ${facts}` };
}

/** "Fill it with AI" as a task of the page studio (../server.ts registers it with how it says the project). */
export function moduleWordsTask(context: (ctx: StudioCtx, d: PageDoc) => string, rules: string): AiTask {
  return {
    label: "Fill a module",
    schema: MODULE_WORDS_SCHEMA,
    system: `${MODULE_WORDS_SYSTEM}${NL}${NL}${rules}`,
    effort: "low",
    maxTokens: 3500,
    user: async (ctx, raw, input) => {
      const type = s(input.type, 60);
      const lib = libModule(type);
      if (!lib) throw new Error("That module is not in the library any more.");
      const w = await wordsContext(ctx, raw, input, context);
      const now = input.now && typeof input.now === "object" ? input.now as Record<string, unknown> : {};
      return moduleWordsUser({
        context: w.head, page: w.page, lib, now: JSON.stringify(now).length < 4000 ? now : {}, language: languageOfStore(w.d.store) ?? "German", store: w.d.store,
        dates: w.dates, links: w.links, tree: w.tree, request: s(input.request, 1500),
      });
    },
    clean: async (raw, docRaw, ctx, input) => {
      const w = await wordsContext(ctx, docRaw, input, context);
      return cleanModuleWords(raw, {
        type: s(input.type, 60), pageText: w.pageText, lang: w.d.store.slice(0, 2), store: w.d.store,
        links: w.links.map((l) => l.url), linkNames: Object.fromEntries(w.links.map((l) => [l.url, l.name])), categories: w.tree.map((t) => whole(t.url)), dates: w.dates,
      });
    },
  };
}
