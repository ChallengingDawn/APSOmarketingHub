// PAGE - THE STUDIO'S DOCUMENT (08.11.2026). Pure, shared with the browser and the tests: relative imports only.
//
// SARCLA 08.11.2026: "pages - can come from AI & Personalization (Webyn) or be created here, but should also contain A/B
// testing possibility, live preview of the pages, editing page, select a page to modify; always trigger on the to-do".
// And later that day: "a real AI-assisted CMS", "the new page should allow many more fields", "the design per language:
// when we publish one page in multiple languages", "translate the complete page into another language".
//
// A page to-do is one shop page and what changes on it:
//   source    "convert" - the page and its approved version came from APSOconvert (the project's brief carries its marker)
//             "pick"    - a page of the shop picked here, from the pages APSOconvert keeps indexed
//             "new"     - a new CMS page, made of FIELDS (./fields.ts) drawn by one renderer (./newpage.ts). An older
//                         new page kept its body as one block of HTML: it still shows, until its words move into fields
//   changes   APSOconvert's change list (src/lib/convert/versions.ts) - the same declarative list the shop's test applies,
//             so what is approved here is what visitors get
//   texts     words for the placeholders <span class="apx-text">[Text from Content: ...]</span> an older version left
//             (the AI no longer leaves any: it writes the final words; ./model.ts leftoversOf flags any that remain)
//   langs     the page in its other STORE VIEWS (SARCLA 09.11.2026: "the locales are not all complete in Magento - we
//             select by store view"): one version per store view ("fr-CH", "de-DE"), each with its own address, words,
//             changes and preview. The document's top level is the MAIN store view; `viewOf` gives one store view as a
//             whole page document, `withView` puts it back. An older document kept one version per LANGUAGE ("fr"):
//             `pageDoc` reads it as the version of its store view (LangVersion.store, else storeForLanguage)
//   inserts   banners placed in the page by the banner studio (the shared contract: kind, piece, size, where)
//   abTest    the test's plan; it runs from a gateway, not from the hub (the hub has no public address)
//   publish   the hand-over notes (a paste block for what the hub does not write itself)
//   magento   what was written into Magento's CMS from the page studio's last step: one record per environment and store
//             view (./magento.ts; the backups are in apsomh_convert_cms_backups)

import { classify, isEnv, isKind, type Env, type PageKind } from "../../../../convert/model";
import { STORE_VIEWS, countryGroups, countryStore, shopOrder, storeKey, viewName, viewShort, type CountryGroup } from "./storeViews";
import { describe, validateChanges, type Change } from "../../../../convert/versions";
import { emptyFields, fieldStrings, filledCount, normalizeFields, type Fields, type Item } from "./fields";

export type PageSource = "convert" | "pick" | "new";
export const SOURCES: PageSource[] = ["convert", "pick", "new"];
export const SOURCE_LABEL: Record<PageSource, string> = {
  convert: "From AI testing & personalization", pick: "A page of the shop", new: "A new page",
};

/**
 * The ways a page to-do of a type is made (SARCLA 09.11.2026). An SEO landing page is a NEW page ("SEO landing page should
 * only have the SEO pages"); the Page builder changes a page already on the webshop ("Page refresh becomes only Page
 * builder" - a product page's copy made before opens the same way); a page to-do of no such type offers both. The first
 * is where a new document starts. ("From AI testing & personalization" is no choice: a page handed over arrives so.)
 */
export function pageModesFor(contentType: string | null | undefined): PageSource[] {
  if (contentType === "landing-page") return ["new"];
  if (contentType === "page-refresh" || contentType === "product-page") return ["pick"];
  return ["pick", "new"];
}

/**
 * The way a document should be switched to as it opens, or null when it is fine: one whose way its type does not offer
 * AND that holds nothing in it yet (a landing page left on "a page of the shop" with no page picked). A document that
 * holds work keeps its way - a landing page that picked a shop page before still shows it, a page handed over from AI
 * testing & personalization stays "convert".
 */
export function pageSourceFix(contentType: string | null | undefined, d: Pick<PageDoc, "source" | "path" | "changes" | "fields" | "newPage">): PageSource | null {
  const modes = pageModesFor(contentType);
  if (d.source === "convert" || modes.includes(d.source)) return null;
  const holds = d.source === "new" ? filledCount(d.fields) > 0 || !!d.newPage.body.trim() : !!d.path || d.changes.length > 0;
  return holds ? null : modes[0];
}

export type AbGoal = "orders" | "add-to-cart" | "clicks";
export const AB_GOAL_LABEL: Record<AbGoal, string> = { orders: "Orders", "add-to-cart": "Add to cart", clicks: "Clicks on one element" };
export type AbAudience = "all" | "new" | "returning" | "customers";
export const AB_AUDIENCE_LABEL: Record<AbAudience, string> = {
  all: "Every visitor", new: "New visitors", returning: "Returning visitors", customers: "Signed-in customers",
};

export type TextSlot = { id: string; ask: string; text: string };

export type PageOutline = { env: Env; path: string; title: string; description: string; h1: string[]; lines: string[]; truncated: boolean };

/** A block placed in the page from another to-do of the project (the banner studio's "Put it in a page"). */
export type InsertWhere = "top" | "after-intro" | "bottom";
export const INSERT_WHERE: InsertWhere[] = ["top", "after-intro", "bottom"];
export const INSERT_WHERE_LABEL: Record<InsertWhere, string> = { top: "At the top", "after-intro": "After the intro", bottom: "At the end" };
export type Insert = { id: string; kind: "banner"; pieceId: number; preset: string; where: InsertWhere };

/** The page in one more store view: its own address (an existing page) or its own fields (a new page), its own changes. */
export type LangVersion = {
  path: string;
  /** its store view - the key it is kept under */
  store: string;
  changes: PageChange[];
  texts: TextSlot[];
  fields: Fields;
  outline: PageOutline | null;
  /** the content this one was made from (sourceHash of the `source` store view) - it is out of date once that changes */
  from: string;
  /** the store view it was made from ("" = the main one) */
  source: string;
  /** how it was made: copied from a store view of its language (no AI), translated by the AI, or neither (a page picked) */
  made: "copy" | "translate" | "";
  at: string;
  /** the version of the page open in this store view (A, B, C - see PageVersion), and every version it has */
  letter: string;
  versions: PageVersion[];
};

/**
 * ANOTHER VERSION OF THE SAME PAGE (SARCLA 09.11.2026: "it should also allow to create another version of the same", to
 * A/B test). A page of the shop has version A - its change list - and may have B, C, D: each its own change list, made
 * from the one open (a copy, changed on its own afterwards), named by letter as AI testing & personalization names an
 * optimization's versions (src/lib/convert/studio.ts VERSION_LETTERS). The version OPEN is the store view's `changes` -
 * everything that edits the page (the assistant, a click in the page, the gallery) edits it; switching to another letter
 * keeps the open one's list under its letter and opens the other's. `versions` lists every letter once there are two (or
 * one came from AI testing & personalization); the open one's own `changes` there are kept empty (they are the view's).
 */
export type PageVersion = {
  letter: string;
  changes: PageChange[];
  texts: TextSlot[];
  /** the letter it was copied from ("" = the first, or brought in) */
  from: string;
  at: string;
  /** a version of an optimization of AI testing & personalization (apsomh_convert_versions): which one, its revision */
  origin: { versionId: string; rev: number; summary: string } | null;
};
/** The letters a page's versions take, in order - AI testing & personalization's own (A first, at most four). */
export const PAGE_LETTERS = ["A", "B", "C", "D"] as const;

/** One write into Magento's CMS from the last step (./magento.ts). */
export type MagentoRecord = {
  env: Env; store: string; pageId: string; identifier: string;
  action: "created" | "updated" | "restored" | "switched-off";
  at: string; by: string; backupId: string; url: string;
};

/** A test's figures as the page studio keeps them. */
export type WinnerTest = {
  id: string; rateA: number | null; rateB: number | null; uplift: number | null; pB: number | null;
  visitors: number; days: number; decidedBy: string | null; decidedAt: string | null;
};
/** How a winner went out: on for everyone (the gateway), into the Magento CMS page, or the code for dotSource. */
export type Published = {
  way: "everyone" | "cms" | "dotsource"; id: string; edited: boolean; at: string; by: string;
  package: { css: string; js: string; description: string } | null;
};
export const WAY_LABEL: Record<Published["way"], string> = {
  everyone: "On for everyone on the shop", cms: "Written into the Magento page", dotsource: "Handed to dotSource as code",
};

/* ── Content v6: a change of a page of the shop (the shared interface) ── */
//
// SARCLA 09.11.2026 (his points 9 and 10): "we should really be able to add elements", and "IF we can change the current
// element, the proposal when applied hides the element and replaces it by our high[-quality] generated code". An element
// the hub adds or swaps on a page of the shop is a Change of the store view's `changes` (src/lib/convert/versions.ts):
//   insert   { op: "insert", selector, where: before | after | prepend | append, html }  - a new block at a place
//   replace  { op: "replace", selector, html }  - the element HIDDEN (kept, never deleted: Undo and "Show the old one"
//            work) and the new block standing exactly where it was - in the preview (./apply.ts) and in what goes to
//            Magento (src/lib/convert/ship.ts applyToCms, where a write made again first takes its own earlier work out)
// The html of a block the hub makes is ONE self-contained element: its own <style> with every rule under one prefix class,
// explicit colours and fonts, the shop's container width (./block.ts says it and checks it).
// Beside the change, kept in the document only (the preview and Magento get the validated change without them):
//   id       a stable name, so a change is found again when the list moves (a module opened again, the check's answer)
//   module   the gallery's module it was made from, with its settings, so it opens again to be edited (builder B)
//   off      the check after applying found the block wrong (text that cannot be read, a block that runs out of the
//            page): it is KEPT, NOT APPLIED, with the reason in plain words - "Looks wrong - not applied: ..."

/** The gallery's module a change was made from (Content v6, builder B): its type and its settings, opened again later. */
export type ModuleRef = { type: string; settings: Record<string, unknown> };
export type ChangeMeta = { id?: string; module?: ModuleRef; off?: string };
/** A change as the page studio keeps it: the shop's change, with its id, its module and its check. */
export type PageChange = Change & ChangeMeta;

/** A new change's id: "c" + time + a little chance (the same in the browser and on the server). */
export function changeId(at = Date.now()): string {
  return `c${at.toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, "0")}`;
}

/** A block put in place of an element of the page (the element hidden, kept), or at a place of it. */
export function replaceChange(selector: string, html: string, o: { note?: string; module?: ModuleRef; id?: string } = {}): PageChange {
  return { op: "replace", selector, html, ...(o.note ? { note: o.note.slice(0, 300) } : {}), id: o.id ?? changeId(), ...(o.module ? { module: o.module } : {}) };
}
export function insertChange(selector: string, where: "before" | "after" | "prepend" | "append", html: string, o: { note?: string; module?: ModuleRef; id?: string } = {}): PageChange {
  return { op: "insert", selector, where, html, ...(o.note ? { note: o.note.slice(0, 300) } : {}), id: o.id ?? changeId(), ...(o.module ? { module: o.module } : {}) };
}

/** Is the change applied (not held back by the check)? */
export const isLive = (c: unknown): boolean => !(c && typeof c === "object" && typeof (c as ChangeMeta).off === "string" && (c as ChangeMeta).off);

/** The list with one change put in: in place of the change with its id, else in place of a replace of the same element,
 * else at the end. Its id is kept (or given). */
export function withChange(changes: PageChange[], c: PageChange): PageChange[] {
  const next = { ...c, id: c.id || changeId() } as PageChange;
  let i = c.id ? changes.findIndex((x) => x.id === c.id) : -1;
  if (i < 0 && c.op === "replace") i = changes.findIndex((x) => x.op === "replace" && x.selector === c.selector);
  if (i < 0) return [...changes, next];
  return changes.map((x, k) => (k === i ? next : x));
}

/** A whole list written again (the AI's "the whole page"): a change that came back the same keeps its id and module; a
 * replace or insert on the same place keeps its id and module too (it was rewritten); a new one gets an id. */
export function carryMeta(old: PageChange[], next: Change[]): PageChange[] {
  const core = (c: unknown) => { const { id: _i, module: _m, off: _o, ...rest } = (c ?? {}) as Record<string, unknown>; return JSON.stringify(rest); };
  const used = new Set<number>();
  const take = (pred: (c: PageChange) => boolean) => { const i = old.findIndex((c, k) => !used.has(k) && pred(c)); if (i >= 0) used.add(i); return i >= 0 ? old[i] : null; };
  return next.map((c) => {
    const same = take((o) => core(o) === core(c));
    const place = same ?? ((c.op === "replace" || c.op === "insert") ? take((o) => o.op === c.op && (o as { selector?: string }).selector === c.selector && (o as { where?: string }).where === (c as { where?: string }).where) : null);
    // one the check held back stays held back while it is the same
    return { ...c, id: place?.id || changeId(), ...(place?.module ? { module: place.module } : {}), ...(same?.off ? { off: same.off } : {}) } as PageChange;
  });
}

/** True when two change lists say the same - the order counts (a later change can build on an earlier one). */
export function sameChangeList(a: unknown[], b: unknown[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
function winnerTestOf(v: unknown): WinnerTest | null {
  if (!isObj(v) || typeof v.id !== "string" || !v.id) return null;
  return {
    id: v.id.slice(0, 20), rateA: num(v.rateA), rateB: num(v.rateB), uplift: num(v.uplift), pB: num(v.pB),
    visitors: num(v.visitors) ?? 0, days: num(v.days) ?? 0,
    decidedBy: typeof v.decidedBy === "string" ? v.decidedBy.slice(0, 255) : null, decidedAt: typeof v.decidedAt === "string" ? v.decidedAt.slice(0, 40) : null,
  };
}
function publishedOf(v: unknown): Published | null {
  if (!isObj(v) || !["everyone", "cms", "dotsource"].includes(String(v.way))) return null;
  const pk = isObj(v.package) ? v.package : null;
  const s = (x: unknown, n: number) => (typeof x === "string" ? x.slice(0, n) : "");
  return {
    way: v.way as Published["way"], id: s(v.id, 40), edited: v.edited === true, at: s(v.at, 40), by: s(v.by, 255),
    package: pk ? { css: s(pk.css, 120_000), js: s(pk.js, 120_000), description: s(pk.description, 20_000) } : null,
  };
}

export type PageDoc = {
  v: 1;
  source: PageSource;
  env: Env;
  /** the page's path on the shop ("/de-CH/dichtungstechnik.html"); for a new page "" */
  path: string;
  /** its store view ("de-CH") - the main language's */
  store: string;
  pageKind: PageKind | null;
  /** the first open has looked for an APSOconvert page in the project's brief */
  started: boolean;
  /** the APSOconvert version the changes came from - with its test's figures when it won a test (lib/convert/winner.ts);
   * `letter`: that version's letter in its optimization (A, B ...), "" when not known (a to-do started before 10.11.2026) */
  origin: { versionId: string; rev: number; status: string; summary: string; idea: string; test: WinnerTest | null; letter: string } | null;
  /** a test's winner published from here (SARCLA 08.11.2026: "content publish should go to Content") */
  published: Published | null;
  /** an older new page: one block of HTML (kept so it still shows); new pages are `fields` */
  newPage: { title: string; urlKey: string; metaTitle: string; metaDescription: string; body: string };
  fields: Fields;
  changes: PageChange[];
  texts: TextSlot[];
  /** the version open (A, B ...) and every version the main store view has (PageVersion) */
  letter: string;
  versions: PageVersion[];
  langs: Record<string, LangVersion>;
  inserts: Insert[];
  /** the test's plan; `a` and `b`: which two run - "page" (the page as it is) or a version's letter */
  abTest: { enabled: boolean; split: number; goal: AbGoal; clickTarget: string; audience: AbAudience; notes: string; status: "draft"; a: string; b: string };
  publish: { mode: "paste" | "magento"; status: "draft" | "copied"; notes: string };
  /** what the last step wrote into Magento, newest first - one record per environment and store view */
  magento: MagentoRecord[];
  notes: string;
  /** the page's outline as the server last read it - what the AI is shown (never edited by hand) */
  outline: PageOutline | null;
  /** the project's brief as written, kept for the AI (the studio's context carries only its fields) */
  briefText: string;
};

/** Where a new page's body goes inside the store's page it is shown in. */
export const SHELL_SELECTOR = "#maincontent";
/** The part of a Magento page that is the CMS page's own content. */
export const MAIN_SELECTOR = "#maincontent .column.main";

/* ── languages ────────────────────────────────────────────────────────── */

// SARCLA 08.11.2026 (evening): "On the page builder: DE FR IT EN - we should have all locales: NL, PL". A page is published
// in every language the shop has. Since 09.11.2026 one version per STORE VIEW (below): in Magento each store view gets its
// own CMS page. And that night: "store views are still missing - e.g. the international ones and the EUR versions of a
// store" - the list is the shop's own now, all 25 as its country / language switcher has them, the Swiss shop in CHF AND
// in EUR (./storeViews.ts); a store view the page index holds that the list lacks is added to it.

/** Every store view of the shop, in the shop's order: each language's own store view first among its own (de-CH, fr-CH,
 * it-CH, en-INT, nl-NL, pl-PL), its EUR twin beside it. */
export const SHOP_STORES: readonly string[] = (() => {
  const keys = STORE_VIEWS.map((v) => v.key);
  const home = ["de-CH", "fr-CH", "it-CH", "en-INT", "nl-NL", "pl-PL"];
  const rank = (k: string) => { const h = home.indexOf(k); return h >= 0 ? 0 : countryStore(k) && home.includes(countryStore(k)!) ? 1 : 2; };
  const langs = ["de", "fr", "it", "en", "nl", "pl"];
  return [...keys].sort((a, b) => langs.indexOf(a.slice(0, 2)) - langs.indexOf(b.slice(0, 2)) || rank(a) - rank(b) || shopOrder(a) - shopOrder(b));
})();
/** The languages in the order the studio shows them (the page's own first). */
export const LANG_ORDER = ["de", "fr", "it", "en", "nl", "pl"] as const;
/** @deprecated the four the studio offered before 08.11.2026 - the shop's languages come from its store views now */
export const LANGS = ["de", "fr", "it", "en"] as const;
/** Each language's own store view: the Swiss one where the shop has it, English the international one (x-default). */
const HOME_STORE: Record<string, string> = { de: "de-CH", fr: "fr-CH", it: "it-CH", en: "en-INT", nl: "nl-NL", pl: "pl-PL", es: "es-ES" };
const LANGUAGE_NAME: Record<string, string> = { de: "German", fr: "French", it: "Italian", en: "English", nl: "Dutch", pl: "Polish", es: "Spanish" };

/**
 * A store view as the shop writes it - WITH its currency where the shop has two ("de-CH/eur" stays "de-CH/eur": the Swiss
 * shop in EUR is its own store view in Magento, SARCLA 09.11.2026); null when it is not one. Until that night it dropped
 * the currency and merged the two - `countryStore` still does, for what knows no currency (hreflang).
 */
export function baseStore(store: string | null | undefined): string | null {
  return storeKey(store);
}
export { countryStore, viewName, viewShort };

/** The store views of one language, as the shop has them: "fr" -> fr-CH, fr-FR, fr-INT. */
export function storesOf(lang: string, stores: readonly string[] = SHOP_STORES): string[] {
  const l = lang.toLowerCase();
  return [...new Set(stores.map(baseStore).filter((s): s is string => !!s && s.startsWith(`${l}-`)))].sort();
}

/**
 * The store view a page in this language goes in: English in the international one (the shop's x-default); else the
 * main page's own country when the shop has the language there (a page of fr-FR in Italian: it-FR does not exist), the
 * language's own store view, its international one, the first the shop has. `stores` is the shop's list (the index's).
 */
export function storeForLanguage(lang: string | null | undefined, mainStore?: string | null, stores: readonly string[] = SHOP_STORES): string {
  const l = String(lang ?? "").slice(0, 2).toLowerCase() || "de";
  const have = storesOf(l, stores.length ? [...new Set([...stores, ...SHOP_STORES])] : SHOP_STORES);
  const country = /^[a-z]{2}-([a-z]{2,3})/i.exec(String(mainStore ?? ""))?.[1]?.toUpperCase() ?? "CH";
  // the main page's currency too: a page of the Swiss shop in EUR goes into fr-CH/eur, not fr-CH
  const cur = storeKey(mainStore)?.split("/")[1];
  const want = [l === "en" ? "en-INT" : "", cur ? `${l}-${country}/${cur}` : "", `${l}-${country}`, HOME_STORE[l] ?? "", `${l}-INT`].filter(Boolean);
  return want.find((s) => have.includes(s)) ?? have[0] ?? HOME_STORE[l] ?? `${l}-INT`;
}

/** The shop's store views: its own list (./storeViews.ts), and any other the page index holds. */
export function shopList(stores: readonly string[] = []): string[] {
  const extra = stores.map(baseStore).filter((k): k is string => !!k && !SHOP_STORES.includes(k));
  return [...SHOP_STORES, ...new Set(extra)];
}

/** One language the page can be published in: its store view for this page, and every store view of it on the shop. */
export type LangOption = { lang: string; name: string; store: string; stores: string[] };

/** Every language the shop publishes in (from its store views), the page's own first - each with its store view. */
export function shopLanguages(stores: readonly string[], mainStore: string): LangOption[] {
  const list = shopList(stores);
  const main = langOfStore(mainStore);
  const langs = [...new Set(list.map(baseStore).filter((s): s is string => !!s).map((s) => s.slice(0, 2)))];
  if (!langs.includes(main)) langs.push(main);
  const rank = (l: string) => (l === main ? -1 : (LANG_ORDER as readonly string[]).indexOf(l) < 0 ? 50 : (LANG_ORDER as readonly string[]).indexOf(l));
  langs.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return langs.map((l) => {
    const store = l === main ? (baseStore(mainStore) ?? storeForLanguage(l, mainStore, list)) : storeForLanguage(l, mainStore, list);
    const all = storesOf(l, list);
    return { lang: l, name: langName(l), store, stores: [store, ...all.filter((s) => s !== store)] };
  });
}

/** The language a store view's visitors read: "de-CH" -> German. */
export const languageOfStore = (store: string | null | undefined) => LANGUAGE_NAME[String(store ?? "").slice(0, 2).toLowerCase()] ?? null;
/** A store view's language code: "fr-CH" -> "fr". */
export const langOfStore = (store: string | null | undefined) => (/^[a-z]{2}/i.exec(String(store ?? ""))?.[0] ?? "de").toLowerCase();
/** A language's name - from its code or from a store view ("fr", "fr-CH" -> French). */
export const langName = (lang: string) => LANGUAGE_NAME[lang.slice(0, 2).toLowerCase()] ?? lang.toUpperCase();
/** The page's own language - the top of the document. */
export const mainLang = (d: PageDoc) => langOfStore(d.store);

/* ── store views: one version of the page per store view ──────────────── */

// SARCLA 09.11.2026: "the locales are not all complete in Magento - we select by store view". A page exists in some store
// views and not in others, so its versions are by STORE VIEW: the main one is the document itself, the others are kept
// under `langs` by their store view ("fr-CH", "de-DE"). A store view of a language the page already has starts as a COPY
// of that store view's words (no AI), changed on its own afterwards; a store view of another language is translated.

/** The page's own store view - the top of the document. */
export const mainView = (d: PageDoc): string => baseStore(d.store) ?? storeForLanguage(langOfStore(d.store));

/** A store view in the shop's order (de-CH, de-DE, de-AT, de-INT, fr-CH ...) - for lists. */
const shopRank = (s: string) => { const i = (SHOP_STORES as readonly string[]).indexOf(s); return i < 0 ? 99 : i; };
const langRank = (main: string) => (l: string) => (l === main ? -1 : (LANG_ORDER as readonly string[]).indexOf(l) < 0 ? 50 : (LANG_ORDER as readonly string[]).indexOf(l));
/** Store views in the studio's order: the page's own language first, then the shop's languages, each in the shop's order. */
export function sortViews(list: string[], mainStore: string): string[] {
  const rank = langRank(langOfStore(mainStore));
  return [...list].sort((a, b) => rank(langOfStore(a)) - rank(langOfStore(b)) || shopRank(a) - shopRank(b) || a.localeCompare(b));
}

/**
 * The store view a key names: a store view itself ("fr-CH"); an older key, a LANGUAGE ("fr"): the page's own store view
 * for its own language, else the version the page has in that language, else the store view the language goes in.
 */
export function viewKey(d: PageDoc, key: string | null | undefined): string {
  const main = mainView(d);
  if (!key) return main;
  const s = baseStore(key);
  if (s) return s;
  const l = key.slice(0, 2).toLowerCase();
  if (!/^[a-z]{2}$/.test(l) || l === langOfStore(main)) return main;
  const have = sortViews(Object.keys(d.langs).filter((k) => langOfStore(k) === l), main);
  return have[0] ?? storeForLanguage(l, d.store);
}

/** Has this store view a version of its own? */
const isMade = (d: PageDoc, k: string) => !!d.langs[k] && (hasContent(viewOf(d, k)) || (d.source !== "new" && !!d.langs[k].path));

/** The store views this page HAS: its own, then those made or started (a translation, a copy, a page picked). */
export const viewsOf = (d: PageDoc): string[] => {
  const m = mainView(d);
  return [m, ...sortViews(Object.keys(d.langs).filter((k) => k !== m && isMade(d, k)), m)];
};

/** @deprecated the languages this page has (a page is made by store view now - viewsOf) */
export const langsOf = (d: PageDoc): string[] => [...new Set(viewsOf(d).map(langOfStore))];

function emptyLang(d: PageDoc, key: string): LangVersion {
  return { path: "", store: viewKey(d, key), changes: [], texts: [], fields: emptyFields(), outline: null, from: "", source: "", made: "", at: "", letter: "A", versions: [] };
}

/** One store view of the page as a whole page document (the main one is the document itself). A language works too. */
export function viewOf(d: PageDoc, key: string | null | undefined): PageDoc {
  const k = viewKey(d, key);
  if (k === mainView(d)) return d;
  const v = d.langs[k] ?? emptyLang(d, k);
  return {
    ...d, path: v.path, store: k, changes: v.changes, texts: v.texts, fields: v.fields, outline: v.outline, newPage: { ...d.newPage, body: "" },
    letter: v.letter || "A", versions: v.versions ?? [],
  };
}

/** The document with one store view's version put back: its own parts into its place; the shared parts (test, Magento's
 * notes, the banners in it) from the view too, so a change made in any store view reaches every one. */
export function withView(d: PageDoc, key: string | null | undefined, view: PageDoc): PageDoc {
  const k = viewKey(d, key);
  if (k === mainView(d)) return { ...view, langs: d.langs };
  const old = d.langs[k] ?? emptyLang(d, k);
  const next: LangVersion = {
    ...old, path: view.path, store: k, changes: view.changes, texts: view.texts, fields: view.fields, outline: view.outline,
    letter: view.letter || "A", versions: view.versions ?? [],
  };
  return { ...d, abTest: view.abTest, publish: view.publish, notes: view.notes, inserts: view.inserts, magento: view.magento, langs: { ...d.langs, [k]: next } };
}

/** A short stable hash of a text (FNV-1a, base 36). */
export function hashOf(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

/** What a translation or a copy is made from: a store view's words and changes. */
export const sourceHash = (d: PageDoc) => hashOf(JSON.stringify(
  d.source === "new" ? fieldStrings(d.fields)
    // a page with versions: all of them, whichever is open (opening B is no change to copy or translate again)
    : d.versions?.length ? versionList(d).map((v) => [v.letter, v.changes, v.texts]) : [d.changes, d.texts]));

/** Has this view any content of its own? */
export function hasContent(view: PageDoc): boolean {
  if (view.source === "new") return filledCount(view.fields) > 0 || !!view.newPage.body.trim();
  return view.changes.length > 0;
}

export type LangState = "main" | "done" | "stale" | "empty";
/** Each store view at a glance: the main one, done, out of date (the store view it was made from changed since), or not
 * made yet. A language works too (its version). */
export function viewState(d: PageDoc, key: string): LangState {
  const k = viewKey(d, key);
  if (k === mainView(d)) return "main";
  const v = d.langs[k];
  if (!v) return "empty";
  const view = viewOf(d, k);
  if (!hasContent(view) && !(d.source !== "new" && v.path)) return "empty";
  const src = v.source && v.source !== k ? v.source : mainView(d);
  if (v.from && v.from !== sourceHash(viewOf(d, src))) return "stale";
  return hasContent(view) ? "done" : "empty";
}
/** @deprecated a language's state - viewState */
export const langState = viewState;

/** How a store view not made yet would be made: a COPY of the page's store view of the same language (no AI), else the
 * AI's translation of the main one. */
export function howToAdd(d: PageDoc, to: string): { how: "copy" | "translate"; from: string } {
  const k = baseStore(to) ?? viewKey(d, to);
  const same = viewsOf(d).filter((x) => x !== k && langOfStore(x) === langOfStore(k));
  // the same store view in its other currency first (de-CH/eur from de-CH): the same page, the same words
  const twin = same.find((x) => countryStore(x) === countryStore(k));
  return same.length ? { how: "copy", from: twin ?? same[0] } : { how: "translate", from: mainView(d) };
}

const cloneOf = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** The page with a new store view COPIED from another (its words and changes, no AI) - its own from then on. `path`: the
 * same page of the shop in that store view (an existing page), when the shop has it. */
export function copyView(d: PageDoc, to: string, from: string, path = "", at = new Date().toISOString()): PageDoc {
  const k = baseStore(to);
  if (!k || k === mainView(d)) return d;
  const src = viewOf(d, from);
  const v: LangVersion = {
    path: d.source === "new" ? "" : path, store: k, changes: cloneOf(src.changes), texts: cloneOf(src.texts), fields: cloneOf(src.fields), outline: null,
    from: sourceHash(src), source: viewKey(d, from), made: "copy", at,
    // its versions come along (B, C of the page there too), the same one open
    letter: src.letter || "A", versions: cloneOf(src.versions ?? []),
  };
  return { ...d, langs: { ...d.langs, [k]: v } };
}

/** The page without one store view's version (the main one stays). */
export function dropView(d: PageDoc, key: string): PageDoc {
  const k = viewKey(d, key);
  if (k === mainView(d) || !d.langs[k]) return d;
  const langs = { ...d.langs };
  delete langs[k];
  return { ...d, langs };
}

/* ── versions of the page: A, B, C (see PageVersion) ─────────────────── */

/** A store view's versions, each with its own change list (the open one's is the view's) - A alone when it has no other. */
export function versionList(view: PageDoc): PageVersion[] {
  const open = view.letter || "A";
  if (!view.versions?.length) return [{ letter: open, changes: view.changes, texts: view.texts, from: "", at: "", origin: null }];
  return view.versions.map((v) => (v.letter === open ? { ...v, changes: view.changes, texts: view.texts } : v));
}
/** The letters it has, in order. */
export const lettersOf = (view: PageDoc): string[] => versionList(view).map((v) => v.letter);
/** The next free letter, or null when it has all four. */
export const nextPageLetter = (view: PageDoc): string | null => PAGE_LETTERS.find((l) => !lettersOf(view).includes(l)) ?? null;

/** The store view with another version open: the open one's list kept under its letter, the other's laid in its place. */
export function openVersion(view: PageDoc, letter: string): PageDoc {
  const open = view.letter || "A";
  if (letter === open || !lettersOf(view).includes(letter)) return view;
  const all = versionList(view);
  const to = all.find((v) => v.letter === letter)!;
  return {
    ...view, letter, changes: to.changes, texts: to.texts,
    versions: all.map((v) => (v.letter === letter ? { ...v, changes: [], texts: [] } : v)),
  };
}

/** A new version (the next letter), made as a COPY of the one open - and opened, to be changed on its own. */
export function addVersion(view: PageDoc, at = new Date().toISOString()): PageDoc {
  const letter = nextPageLetter(view);
  if (!letter) return view;
  const open = view.letter || "A";
  const all = versionList(view).map((v) => (v.letter === open ? { ...v, changes: cloneOf(view.changes), texts: cloneOf(view.texts) } : v));
  const made: PageVersion = { letter, changes: [], texts: [], from: open, at, origin: null };
  return { ...view, letter, changes: cloneOf(view.changes), texts: cloneOf(view.texts), versions: [...all, made].sort((a, b) => a.letter.localeCompare(b.letter)) };
}

/** The store view without one version (never its last); the one open taken out opens the first left. The A/B test that
 * ran it goes back to the page as it is against the first left. */
export function dropVersion(view: PageDoc, letter: string): PageDoc {
  const all = versionList(view);
  if (all.length < 2 || !all.some((v) => v.letter === letter)) return view;
  const base = (view.letter || "A") === letter ? openVersion(view, all.find((v) => v.letter !== letter)!.letter) : view;
  const left = base.versions.filter((v) => v.letter !== letter);
  const ab = base.abTest;
  const fix = ab.a === letter || ab.b === letter ? { a: "page", b: base.letter } : {};
  return { ...base, versions: left.length > 1 ? left : left.length === 1 && left[0].origin ? left : [], abTest: { ...ab, ...fix } };
}

/** A version of an optimization of AI testing & personalization, as its page gets it (src/lib/convert/studio.ts Version). */
export type ConvertVersion = { id: string; ideaId: string; letter: string; rev: number; summary: string; changes: Change[]; updatedAt: string };

/**
 * The versions of the optimization a page was sent with, as the page's own versions - each under ITS letter (version B
 * there is version B here), the one sent open (its list is the view's `changes`). One version alone: no list (its letter
 * is the view's, its origin the document's).
 */
export function convertVersionsOf(all: ConvertVersion[], sent: { id: string; ideaId: string; letter: string }): PageVersion[] {
  const out: PageVersion[] = [];
  for (const v of [...all].filter((x) => x.ideaId === sent.ideaId).sort((a, b) => (a.letter || "A").localeCompare(b.letter || "A"))) {
    const letter = v.letter || "A";
    if (!isLetter(letter) || out.some((x) => x.letter === letter)) continue;
    const open = v.id === sent.id;
    out.push({ letter, changes: open ? [] : v.changes, texts: [], from: "", at: v.updatedAt, origin: { versionId: v.id, rev: v.rev, summary: v.summary.slice(0, 600) } });
  }
  return out.length > 1 ? out : [];
}

/** Does a to-do of this type open the page a marker names (a page of the shop it changes)? A landing page does not: it
 * makes a NEW page, the marker's page is only context in its brief. */
export const opensMarkerPage = (contentType: string | null | undefined): boolean => pageModesFor(contentType).includes("pick");

/** The change list of one letter. */
export const changesOfLetter = (view: PageDoc, letter: string): PageChange[] => versionList(view).find((v) => v.letter === letter)?.changes ?? [];

/** "The page as it is" / "Version B" - one side of the A/B test. */
export const sideName = (side: string) => (side === "page" ? "The page as it is" : `Version ${side}`);

/** The A/B test in one line (SARCLA 09.11.2026: "too much information here"): "A/B test · Off", or what runs against what. */
export function abLine(view: PageDoc): string {
  const ab = view.abTest;
  if (!ab.enabled) return "A/B test · Off";
  const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  return `A/B test · ${sideName(ab.b)} vs ${low(sideName(ab.a))}`;
}

/** The shop's store views grouped by language, the page's own language first, each group in the shop's order. */
export type StoreGroup = { lang: string; name: string; stores: string[] };
export function shopViews(stores: readonly string[], mainStore: string): StoreGroup[] {
  const list = shopList(stores);
  return shopLanguages(list, mainStore).map((o) => {
    const own = o.lang === langOfStore(mainStore) ? [baseStore(mainStore) ?? o.store] : [];
    return { lang: o.lang, name: o.name, stores: sortViews([...new Set([...own, ...storesOf(o.lang, list)])], mainStore) };
  });
}

/** "de-CH · fr-CH · 2 of 25 store views" - the page's store views in one line. */
export function viewsLine(d: PageDoc, groups: StoreGroup[]): string {
  const made = viewsOf(d);
  const total = groups.reduce((n, g) => n + g.stores.length, 0);
  if (made.length < 2) return `Only ${made[0]} so far · ${total} store views on the shop`;
  return `${made.join(" · ")} · ${made.length} of ${total} store views`;
}

/**
 * The shop's store views as Magento groups them - a country in a currency ("Switzerland · CHF", "Switzerland · EUR",
 * "Germany · EUR" ...), each with its languages - for "+ Store view" (SARCLA 09.11.2026: the international ones and the
 * EUR versions were missing). The page index's store views the list lacks come last; the page's own are always in.
 */
export function shopCountries(stores: readonly string[], d?: PageDoc | null): CountryGroup[] {
  return countryGroups([...stores, ...(d ? [mainView(d), ...Object.keys(d.langs)] : [])]);
}

/* ── the document ─────────────────────────────────────────────────────── */

export function emptyPage(language?: string | null): PageDoc {
  return {
    v: 1, source: "pick", env: "prod", path: "", store: storeForLanguage(language), pageKind: null, started: false, origin: null, published: null,
    newPage: { title: "", urlKey: "", metaTitle: "", metaDescription: "", body: "" },
    fields: emptyFields(),
    changes: [], texts: [], letter: "A", versions: [], langs: {}, inserts: [],
    abTest: { enabled: false, split: 50, goal: "add-to-cart", clickTarget: "", audience: "all", notes: "", status: "draft", a: "page", b: "A" },
    publish: { mode: "paste", status: "draft", notes: "" },
    magento: [],
    notes: "", outline: null, briefText: "",
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 20_000) => (typeof v === "string" ? v.slice(0, max) : "");

function outlineOf(v: unknown): PageOutline | null {
  const out = isObj(v) ? v : null;
  return out && typeof out.path === "string" ? {
    env: isEnv(out.env) ? out.env : "prod", path: str(out.path, 400), title: str(out.title, 400), description: str(out.description, 600),
    h1: Array.isArray(out.h1) ? out.h1.map((x) => str(x, 300)).slice(0, 5) : [],
    lines: Array.isArray(out.lines) ? out.lines.map((x) => str(x, 400)).slice(0, 300) : [], truncated: out.truncated === true,
  } : null;
}
const textsOf = (v: unknown): TextSlot[] => (Array.isArray(v) ? v.filter(isObj).map((t) => ({ id: str(t.id, 40), ask: str(t.ask, 400), text: str(t.text, 8000) })).filter((t) => t.id) : []);
// a change keeps whatever shape it has while a person edits it - the preview and the exports validate
const changesOf = (v: unknown): PageChange[] => (Array.isArray(v) ? (v.filter(isObj) as unknown as PageChange[]) : []);

const isLetter = (v: unknown): v is string => typeof v === "string" && (PAGE_LETTERS as readonly string[]).includes(v);
/** A store view's versions as kept: each letter once, in order; the open one always among them once there are any. */
function versionsOfRaw(v: unknown, open: string): PageVersion[] {
  if (!Array.isArray(v)) return [];
  const out: PageVersion[] = [];
  for (const x of v.filter(isObj)) {
    if (!isLetter(x.letter) || out.some((y) => y.letter === x.letter)) continue;
    const o = isObj(x.origin) && typeof x.origin.versionId === "string" && x.origin.versionId
      ? { versionId: str(x.origin.versionId, 40), rev: Number(x.origin.rev) || 1, summary: str(x.origin.summary, 600) } : null;
    out.push({ letter: x.letter, changes: x.letter === open ? [] : changesOf(x.changes), texts: x.letter === open ? [] : textsOf(x.texts), from: isLetter(x.from) ? x.from : "", at: str(x.at, 40), origin: o });
  }
  if (out.length && !out.some((x) => x.letter === open)) out.push({ letter: open, changes: [], texts: [], from: "", at: "", origin: null });
  return out.sort((a, b) => a.letter.localeCompare(b.letter));
}
/** The two a test runs: "page" (the page as it is) or a letter. */
const sideOf = (v: unknown, dflt: string) => (v === "page" || isLetter(v) ? (v as string) : dflt);

function insertsOf(v: unknown): Insert[] {
  if (!Array.isArray(v)) return [];
  const out: Insert[] = [];
  for (const x of v.filter(isObj).slice(0, 12)) {
    const pieceId = Number(x.pieceId);
    const id = str(x.id, 40);
    if (!id || !Number.isInteger(pieceId) || pieceId <= 0 || x.kind !== "banner") continue;
    out.push({ id, kind: "banner", pieceId, preset: str(x.preset, 20) || "band", where: INSERT_WHERE.includes(x.where as InsertWhere) ? (x.where as InsertWhere) : "after-intro" });
  }
  return out;
}

/**
 * The page's other store views. An older document kept them by LANGUAGE ("fr"): each is read as the version of its own
 * store view (its `store`, else the store view its language goes in), so it opens exactly as before. A store-view key
 * written since ("fr-CH": a field the server set) is laid over it; the main store view is never one of them.
 */
function langsOfRaw(v: unknown, mainStore: string): Record<string, LangVersion> {
  const out: Record<string, LangVersion> = {};
  if (!isObj(v)) return out;
  const main = baseStore(mainStore);
  const raw: Record<string, Record<string, unknown>> = {};
  for (const [k, x] of Object.entries(v)) {
    if (!/^[a-z]{2}$/.test(k) || !isObj(x)) continue;
    raw[baseStore(str(x.store, 20)) ?? storeForLanguage(k, mainStore)] = { ...x };
  }
  for (const [k, x] of Object.entries(v)) {
    const s = /^[a-z]{2}$/.test(k) ? null : baseStore(k);
    if (!s || !isObj(x)) continue;
    raw[s] = { ...(raw[s] ?? {}), ...x };
  }
  // before 10.11.2026 a store view's currency was merged into it: a version kept under "de-CH" whose page is the Swiss
  // shop's EUR one ("/de-CH/eur/...") is that store view's - moved there, unless it has its own already
  for (const [s, x] of Object.entries(raw)) {
    const own = /^\/([a-z]{2}-[A-Z]{2,3}\/[a-z]{3})\//.exec(str(x.path, 400))?.[1];
    const k = own ? baseStore(own) : null;
    if (k && k !== s && !raw[k] && baseStore(s) === countryStore(k)) { raw[k] = { ...x, store: k }; delete raw[s]; }
  }
  for (const [s, x] of Object.entries(raw)) {
    if (s === main) continue;
    const from = str(x.from, 20);
    const letter = isLetter(x.letter) ? x.letter : "A";
    out[s] = {
      path: str(x.path, 400), store: s, changes: changesOf(x.changes), texts: textsOf(x.texts),
      fields: normalizeFields(x.fields), outline: outlineOf(x.outline), from,
      source: baseStore(str(x.source, 20)) ?? "",
      made: x.made === "copy" || x.made === "translate" ? x.made : from ? "translate" : "",
      at: str(x.at, 40),
      letter, versions: versionsOfRaw(x.versions, letter),
    };
  }
  return out;
}

function magentoOf(v: unknown): MagentoRecord[] {
  if (!Array.isArray(v)) return [];
  const out: MagentoRecord[] = [];
  for (const x of v.filter(isObj).slice(0, 60)) {
    const store = baseStore(str(x.store, 20));
    const action = ["created", "updated", "restored", "switched-off"].includes(String(x.action)) ? (x.action as MagentoRecord["action"]) : null;
    if (!isEnv(x.env) || !store || !action) continue;
    out.push({ env: x.env, store, pageId: str(x.pageId, 20), identifier: str(x.identifier, 200), action, at: str(x.at, 40), by: str(x.by, 255), backupId: str(x.backupId, 20), url: str(x.url, 400) });
  }
  return out;
}

/** Any stored document as a page document: missing parts filled, unknown values put right (an older first shape too). */
export function pageDoc(raw: unknown, language?: string | null): PageDoc {
  const d = isObj(raw) ? raw : {};
  const e = emptyPage(language);
  const np = isObj(d.newPage) ? d.newPage : {};
  const ab = isObj(d.abTest) ? d.abTest : {};
  const pub = isObj(d.publish) ? d.publish : {};
  const o = isObj(d.origin) ? d.origin : null;
  const split = Number(ab.split);
  // the page's own store view, its currency kept: an older document picked on "/de-CH/eur/..." said "de-CH/eur" already
  const store = baseStore(str(d.store, 20)) ?? (str(d.store, 20) || e.store);
  const letter = isLetter(d.letter) ? d.letter : "A";
  const versions = versionsOfRaw(d.versions, letter);
  const letters = versions.length ? versions.map((x) => x.letter) : [letter];
  return {
    v: 1,
    source: SOURCES.includes(d.source as PageSource) ? (d.source as PageSource) : e.source,
    env: isEnv(d.env) ? d.env : e.env,
    path: str(d.path, 400),
    store,
    pageKind: isKind(d.pageKind) ? d.pageKind : null,
    started: d.started === true,
    origin: o ? { versionId: str(o.versionId, 40), rev: Number(o.rev) || 1, status: str(o.status, 20), summary: str(o.summary, 600), idea: str(o.idea, 200), test: winnerTestOf(o.test), letter: isLetter(o.letter) ? o.letter : "" } : null,
    published: publishedOf(d.published),
    newPage: { title: str(np.title, 200), urlKey: str(np.urlKey, 200), metaTitle: str(np.metaTitle, 200), metaDescription: str(np.metaDescription, 400), body: str(np.body, 60_000) },
    fields: normalizeFields(d.fields),
    changes: changesOf(d.changes),
    texts: textsOf(d.texts),
    letter, versions,
    langs: langsOfRaw(d.langs, store),
    inserts: insertsOf(d.inserts),
    abTest: {
      enabled: ab.enabled === true,
      split: Number.isFinite(split) ? Math.max(5, Math.min(95, Math.round(split))) : e.abTest.split,
      goal: (["orders", "add-to-cart", "clicks"] as AbGoal[]).includes(ab.goal as AbGoal) ? (ab.goal as AbGoal) : e.abTest.goal,
      clickTarget: str(ab.clickTarget, 300),
      audience: (["all", "new", "returning", "customers"] as AbAudience[]).includes(ab.audience as AbAudience) ? (ab.audience as AbAudience) : "all",
      notes: str(ab.notes, 2000),
      status: "draft",
      // which two run: the page as it is against version A, unless another pair was picked (two different ones)
      ...(() => {
        const a = sideOf(ab.a, "page"), b = sideOf(ab.b, letter);
        const ok = (x: string) => x === "page" || letters.includes(x);
        return ok(a) && ok(b) && a !== b ? { a, b } : { a: "page", b: letter };
      })(),
    },
    publish: { mode: pub.mode === "magento" ? "magento" : "paste", status: pub.status === "copied" ? "copied" : "draft", notes: str(pub.notes, 2000) },
    magento: magentoOf(d.magento),
    notes: str(d.notes, 4000),
    outline: outlineOf(d.outline),
    briefText: str(d.briefText, 7000),
  };
}

/** An older new page: its words are one block of HTML, not fields yet. */
export const isLegacyBody = (d: PageDoc) => d.source === "new" && !!d.newPage.body.trim() && filledCount(d.fields) === 0;

/** The page's title as people read it. */
export function pageTitleOf(d: PageDoc): string {
  if (d.source === "new") return d.fields.hero.title.trim() || d.newPage.title.trim();
  return d.outline?.h1[0] ?? "";
}

/* ── the page ─────────────────────────────────────────────────────────── */

/** The page on the shop, as an address. */
export function shopUrl(env: Env, path: string): string {
  return `${env === "acc" ? "https://acc.apsoparts.com" : "https://www.apsoparts.com"}${path}`;
}

/** What the studio knows of an address typed or picked: its store view and kind - null when it is not a page path. */
export function pathInfo(path: string): { store: string | null; kind: PageKind } | null {
  const p = path.trim();
  if (!p.startsWith("/") || p.startsWith("//") || /[\s<>"'\\?#]/.test(p) || p.length > 400) return null;
  const c = classify(p);
  return c.kind === "system" ? null : { store: c.store, kind: c.kind };
}

/** A new page's address key, from its title: lower case, plain letters, dashes. */
export function urlKeyOf(title: string): string {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

/**
 * The same page in another language, from the page's own hreflang links: the Swiss store view of that language first
 * (the main page's country), then the language's international one; English is the shop's x-default (en-INT).
 */
export function counterpartIn(html: string, lang: string, mainStore: string, prefer?: string | null): string | null {
  const alts: { lang: string; href: string }[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/\brel\s*=\s*["']?alternate/i.test(tag)) continue;
    const hl = /\bhreflang\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (hl && href) alts.push({ lang: hl.toLowerCase(), href });
  }
  const country = (/^[a-z]{2}-([A-Z]{2,3})/.exec(mainStore)?.[1] ?? "CH").toLowerCase();
  // the store view this language's page goes in first (./model.ts storeForLanguage), then the shop's own order
  const want = [...(prefer ? [prefer.toLowerCase()] : []), `${lang}-${country}`, `${lang}-ch`, ...(lang === "en" ? ["x-default", "en-int"] : []), `${lang}-int`, lang];
  for (const w of want) {
    const a = alts.find((x) => x.lang === w);
    if (!a) continue;
    try {
      const u = new URL(a.href.replace(/&amp;/g, "&"), "https://www.apsoparts.com");
      if (/^(www|acc)\.apsoparts\.com$/.test(u.hostname) && pathInfo(u.pathname)) return u.pathname;
    } catch { /* not an address */ }
  }
  return null;
}

/**
 * An address of the shop as the same page in one store view: itself when it is there already; the same page under the
 * store view's own prefix when only the currency differs ("/fr-CH/a-propos" in fr-CH/eur -> "/fr-CH/eur/a-propos" - the
 * shop's hreflang links know no currency); null when it is another store view's.
 */
export function pathIn(path: string | null | undefined, store: string): string | null {
  if (!path) return null;
  const c = classify(path);
  const k = baseStore(store);
  if (!k || !c.store) return null;
  if (baseStore(c.store) === k) return path;
  return countryStore(c.store) === countryStore(k) ? `/${k}/${c.rest}` : null;
}

/** The page's hreflang links, by the store view their address is in ("/fr-INT/x" -> fr-INT). */
export function alternatesByStore(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/\brel\s*=\s*["']?alternate/i.test(tag)) continue;
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) continue;
    try {
      const u = new URL(href.replace(/&amp;/g, "&"), "https://www.apsoparts.com");
      const s = baseStore(u.pathname.split("/")[1]);
      if (s && /^(www|acc)\.apsoparts\.com$/.test(u.hostname) && !out[s]) out[s] = u.pathname;
    } catch { /* not an address */ }
  }
  return out;
}

/* ── the texts Content writes (an older version's placeholders) ───────── */

/** <span class="apx-text" [data-key="t1"]>[Text from Content: what it must say]</span> - the placeholder a version leaves. */
const PLACEHOLDER = /<span\b([^>]*\bclass\s*=\s*["'][^"']*\bapx-text\b[^"']*["'][^>]*)>\s*\[Text from Content:\s*([\s\S]*?)\]\s*<\/span\s*>/gi;

/** A short stable id from the placeholder's key and its ask (FNV-1a, base 36) - same words, same id. */
export function placeholderId(key: string | null, ask: string): string {
  return `t${hashOf(`${key ?? ""}|${ask.replace(/\s+/g, " ").trim()}`)}`;
}

export type Placeholder = { id: string; key: string | null; ask: string; where: string };

export function placeholdersIn(html: string, where: string): Placeholder[] {
  const out: Placeholder[] = [];
  for (const m of html.matchAll(PLACEHOLDER)) {
    const key = /\bdata-key\s*=\s*["']([^"']{1,40})["']/i.exec(m[1])?.[1] ?? null;
    const ask = m[2].replace(/\s+/g, " ").trim();
    if (ask) out.push({ id: placeholderId(key, ask), key, ask, where });
  }
  return out;
}

/** Every placeholder of the page, in the order it shows - once each. */
export function placeholdersOf(doc: PageDoc): Placeholder[] {
  const all: Placeholder[] = [];
  if (doc.source === "new") all.push(...placeholdersIn(doc.newPage.body, "the page's body"));
  doc.changes.forEach((c, i) => {
    const h = (c as { html?: unknown }).html;
    if (typeof h === "string") all.push(...placeholdersIn(h, `change ${i + 1}`));
  });
  const seen = new Set<string>();
  return all.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The placeholders that have their words, with the words in their place (a line break kept); the others stay. */
export function fillTexts(html: string, texts: TextSlot[]): string {
  if (!texts.length) return html;
  const by = new Map(texts.filter((t) => t.text.trim()).map((t) => [t.id, t.text.trim()]));
  return html.replace(PLACEHOLDER, (all, attrs: string, ask: string) => {
    const key = /\bdata-key\s*=\s*["']([^"']{1,40})["']/i.exec(attrs)?.[1] ?? null;
    const text = by.get(placeholderId(key, ask.replace(/\s+/g, " ").trim()));
    return text === undefined ? all : esc(text).replace(/\r?\n/g, "<br>");
  });
}

/** The placeholders still waiting for their words. */
export const unwritten = (doc: PageDoc) => {
  const have = new Set(doc.texts.filter((t) => t.text.trim()).map((t) => t.id));
  return placeholdersOf(doc).filter((p) => !have.has(p.id));
};

/* ── words that are not final: the check every page shows ─────────────── */

// SARCLA 08.11.2026 (a page with "[Intro paragraph part 1 in German]" in it): "design generate is also shit". The AI is
// told to write final words; this is the check that none slipped through - shown in the studio and in the preview.
const LEFTOVER: RegExp[] = [
  /\[Text from Content:[^\]]*\]/gi,
  // "[Intro paragraph part 1 in German]", "[Product name]" - a capital, then words with small letters ("[NBR 70]" is not one)
  // ... but never the words of a link the text editor wrote ("[Jetzt filtern](/de-CH/...)" - Content v8)
  /\[(?=[^\]\n]*[a-zäöüàâçéèêëîïôûùÿñ])[A-ZÄÖÜÀ-Ý][^\[\]\n<>]{2,160}\](?!\()/g,
  /\[(?:x{2,}|\.{2,}|…|\?{2,}|_{2,}|#+|\d+\s*%?\s*x*)\]/gi,
  /\blorem ipsum\b[^.<\n]{0,40}/gi,
  /\b(?:TODO|TBD|FIXME)\b/g,
  /\bXXX+\b/g,
  /\{\{(?!\s*(?:store|media|widget|block|config|trans|var|customvar|depend|if|else|\/))[^}]{1,80}\}\}/g,
  /<<[^<>\n]{2,80}>>/g,
];

/** The words in a text that look like a placeholder, not final copy ("[Intro paragraph in German]", "Lorem ipsum"). */
export function leftoversIn(text: string): string[] {
  const plain = text.replace(/<[^>]+>/g, " ");
  const out: string[] = [];
  for (const re of LEFTOVER) for (const m of plain.matchAll(re)) { const t = m[0].trim(); if (t && !out.includes(t)) out.push(t); }
  return out;
}

export type Leftover = { text: string; where: string; path?: string; change?: number };

/** Every placeholder left in a page (one language): in its fields, its changes and an older new page's body. */
export function leftoversOf(d: PageDoc): Leftover[] {
  const out: Leftover[] = [];
  if (d.source === "new") {
    for (const it of fieldStrings(d.fields)) for (const t of leftoversIn(it.text)) out.push({ text: t, where: it.id, path: it.id });
    if (isLegacyBody(d)) for (const t of leftoversIn(fillTexts(d.newPage.body, d.texts))) out.push({ text: t, where: "the page's body" });
  }
  d.changes.forEach((c, i) => {
    const x = c as { html?: unknown; text?: unknown; value?: unknown };
    const words = [typeof x.html === "string" ? fillTexts(x.html, d.texts) : "", typeof x.text === "string" ? x.text : "", typeof x.value === "string" ? x.value : ""].join(" ");
    for (const t of leftoversIn(words)) out.push({ text: t, where: `change ${i + 1}`, change: i });
  });
  return out;
}

/* ── the changes as the page gets them ────────────────────────────────── */

/** An older new page's body as the one change that puts it in place. */
export const bodyChange = (doc: PageDoc): Change => ({ op: "html", selector: SHELL_SELECTOR, html: doc.newPage.body, note: "The new page" });

/** The most a version may weigh on the shop (src/lib/convert/versions.ts LIMITS.total). */
const VERSION_MAX = 80_000;

/**
 * The list the page gets: an older new page's body first, then the changes, the written texts in their places - each
 * validated on its own (anything a version may not carry is left out, and said), and `from` saying which of the
 * document's changes each one is (-1 = the body), so the studio shows what each change found. A new page made of
 * fields is drawn by ./newpage.ts and put in place by the preview and the paste themselves.
 */
export function finalChanges(doc: PageDoc): { changes: Change[]; problems: string[]; from: number[] } {
  const list: { c: unknown; from: number }[] = [];
  if (isLegacyBody(doc)) list.push({ c: bodyChange(doc), from: -1 });
  // a change the check held back ("Looks wrong - not applied") stays out of the preview and of Magento
  doc.changes.forEach((c, i) => { if (isLive(c)) list.push({ c, from: i }); });
  const changes: Change[] = [];
  const from: number[] = [];
  const problems: string[] = [];
  for (const x of list) {
    const c = isObj(x.c) && typeof x.c.html === "string" ? { ...x.c, html: fillTexts(x.c.html, doc.texts) } : x.c;
    const v = validateChanges([c]);
    const name = x.from < 0 ? "the page's body" : `change ${x.from + 1}`;
    problems.push(...v.problems.map((p) => p.replace(/^change 1/, name)));
    if (v.changes[0]) { changes.push(v.changes[0]); from.push(x.from); }
  }
  if (changes.length > 40) problems.push(`${changes.length} changes - the shop's test takes 40 at most`);
  if (JSON.stringify(changes).length > VERSION_MAX) problems.push("the changes weigh over 80 KB - the shop's test would leave the last ones out");
  return { changes, problems, from };
}

/** A change as a line - its note, else what it does. */
export function changeLine(c: Change): string {
  try { return describe(c); } catch { return "A change"; }
}

/* ── the changes' words: for the translation ──────────────────────────── */

/** The words of a change list, by change: its HTML (tags kept), its text, an alt or title attribute. */
export function changeStrings(changes: Change[]): (Item & { html: boolean })[] {
  const out: (Item & { html: boolean })[] = [];
  changes.forEach((c, i) => {
    const x = c as { op?: string; html?: unknown; text?: unknown; name?: unknown; value?: unknown };
    if (typeof x.html === "string" && x.html.replace(/<[^>]+>/g, "").trim()) out.push({ id: `c${i}.html`, text: x.html, html: true });
    if (x.op === "text" && typeof x.text === "string" && x.text.trim()) out.push({ id: `c${i}.text`, text: x.text, html: false });
    if (x.op === "attr" && typeof x.value === "string" && /^(alt|title|placeholder|aria-label)$/i.test(String(x.name ?? "")) && x.value.trim()) out.push({ id: `c${i}.value`, text: x.value, html: false });
  });
  return out;
}

/** The tags of an HTML text in order - a translation must keep them as they are. */
export function tagSkeleton(html: string): string {
  return [...html.matchAll(/<\/?([a-zA-Z][\w-]*)([^>]*)>/g)].map((m) => {
    const cls = /\bclass\s*=\s*["']([^"']*)["']/i.exec(m[2])?.[1] ?? "";
    return `${m[0][1] === "/" ? "/" : ""}${m[1].toLowerCase()}${cls ? `.${cls.trim().split(/\s+/).sort().join(".")}` : ""}`;
  }).join(" ");
}

/** The changes with translated words put back; an HTML text whose tags changed is refused (the original is kept). */
export function withChangeStrings(changes: Change[], items: Item[]): { changes: Change[]; problems: string[] } {
  const by = new Map(items.map((x) => [x.id, x.text]));
  const problems: string[] = [];
  const out = changes.map((c, i) => {
    const x = { ...(c as Record<string, unknown>) };
    const h = by.get(`c${i}.html`);
    if (typeof x.html === "string" && typeof h === "string" && h.trim()) {
      if (tagSkeleton(h) === tagSkeleton(x.html as string)) x.html = h;
      else problems.push(`change ${i + 1}: its translation changed the HTML - kept as it was`);
    }
    const t = by.get(`c${i}.text`);
    if (x.op === "text" && typeof t === "string" && t.trim()) x.text = t.trim();
    const v = by.get(`c${i}.value`);
    if (x.op === "attr" && typeof v === "string" && v.trim()) x.value = v.trim();
    return x as unknown as Change;
  });
  return { changes: out, problems };
}

/* ── the AI's answers ─────────────────────────────────────────────────── */

export type AiChange = { op: string; selector: string; where: string; html: string; css: string; text: string; name: string; value: string; all: boolean; note: string };

/** The AI's flat change (every field present, as its schema asks) as a change list item; then validated. */
export function fromAi(list: AiChange[] | null | undefined): { changes: Change[]; problems: string[] } {
  const raw = (list ?? []).map((c) => {
    const o: Record<string, unknown> = { op: c.op };
    if (c.note) o.note = c.note;
    if (c.all) o.all = true;
    if (c.op === "css") o.css = c.css;
    else {
      o.selector = c.selector;
      if (c.op === "html" || c.op === "replace" || c.op === "insert") o.html = c.html;
      if (c.op === "insert") o.where = c.where || "after";
      if (c.op === "text") o.text = c.text;
      if (c.op === "attr") { o.name = c.name; o.value = c.value; }
    }
    return o;
  });
  return validateChanges(raw);
}

/** The words the AI wrote for the placeholders it left, by their data-key, matched to the placeholders now there. */
export function textsFromAi(placeholders: Placeholder[], answers: { key: string; text: string }[] | null | undefined): TextSlot[] {
  const out: TextSlot[] = [];
  for (const a of answers ?? []) {
    const k = String(a?.key ?? "").trim();
    const text = String(a?.text ?? "").trim();
    if (!k || !text) continue;
    const p = placeholders.find((x) => x.key === k || x.id === k);
    if (p && !out.some((t) => t.id === p.id)) out.push({ id: p.id, ask: p.ask, text: text.slice(0, 8000) });
  }
  return out;
}

/** The texts after an answer: the new words over the old, the old kept for placeholders the answer did not write. */
export function mergeTexts(old: TextSlot[], fresh: TextSlot[]): TextSlot[] {
  const out = old.filter((t) => !fresh.some((f) => f.id === t.id));
  return [...out, ...fresh];
}

/* ── for the library and the exports ──────────────────────────────────── */

/** The version's text: what page, what changes, the words written - every language. */
export function pageText(raw: unknown): string {
  const d = pageDoc(raw);
  const one = (v: PageDoc, lang: string): string[] => {
    const head = v.source === "new"
      ? `New page${lang ? ` (${lang.toUpperCase()})` : ""}: ${pageTitleOf(v) || "(no title)"}${(v.fields.seo.urlKey || v.newPage.urlKey) ? ` (/${v.store}/${v.fields.seo.urlKey || v.newPage.urlKey})` : ""}`
      : `${SOURCE_LABEL[v.source]}${lang ? ` (${lang.toUpperCase()})` : ""}: ${v.path ? shopUrl(v.env, v.path) : "(no page yet)"}`;
    const lines = [head];
    if (v.source === "new" && filledCount(v.fields)) lines.push(...fieldStrings(v.fields).map((x) => `${x.id}: ${x.text}`));
    const others = v.source === "new" ? [] : versionList(v).filter((x) => x.letter !== (v.letter || "A"));
    if (v.changes.length) lines.push("", `Changes${others.length ? ` (version ${v.letter || "A"})` : ""}:`, ...v.changes.map((c, i) => `${i + 1}. ${changeLine(c)}`));
    for (const o of others) lines.push("", `Version ${o.letter}${o.from ? ` (made from ${o.from})` : ""}:`, ...o.changes.map((c, i) => `${i + 1}. ${changeLine(c)}`));
    const texts = v.texts.filter((t) => t.text.trim());
    if (texts.length) lines.push("", "Texts:", ...texts.map((t) => `- ${t.ask}\n${t.text}`));
    return lines;
  };
  const lines = one(d, "");
  // the first line stays "New page: ..." / "A page of the shop: ..." - the library reads it as the title
  if (d.origin?.summary) lines.splice(1, 0, d.origin.summary);
  for (const lang of Object.keys(d.langs)) { const v = viewOf(d, lang); if (hasContent(v) || v.path) lines.push("", ...one(v, lang)); }
  if (d.abTest.enabled) lines.push("", `A/B test: ${sideName(d.abTest.a)} against ${sideName(d.abTest.b).toLowerCase()}, ${d.abTest.split}% see ${d.abTest.b === "page" ? "the page as it is" : `version ${d.abTest.b}`}; goal ${AB_GOAL_LABEL[d.abTest.goal].toLowerCase()}; ${AB_AUDIENCE_LABEL[d.abTest.audience].toLowerCase()}.`);
  if (d.notes.trim()) lines.push("", d.notes.trim());
  return lines.join("\n");
}

/** The stylesheet of a change list, as one <style> block for a paste (empty when there is none). */
export function styleBlock(changes: Change[]): string {
  const css = changes.filter((c): c is Extract<Change, { op: "css" }> => c.op === "css").map((c) => c.css.trim()).filter(Boolean).join("\n\n");
  return css ? `<style>\n${css}\n</style>\n` : "";
}

export type PasteBlock = { key: string; label: string; steps: string[]; code: string; lang: "html" | "text" };

/** An older new page for Magento: where each field goes, and its content as one HTML Code element. */
export function newPagePaste(doc: PageDoc): PasteBlock[] {
  const { changes } = finalChanges(doc);
  const body = changes.find((c) => c.op === "html" && c.selector === SHELL_SELECTOR) as Extract<Change, { op: "html" }> | undefined;
  const rest = changes.filter((c) => c !== body);
  const code = `${styleBlock(rest)}${body?.html ?? ""}`.trim();
  const np = doc.newPage;
  return [
    {
      key: "fields", label: "The page's fields", lang: "text",
      steps: ["Content > Pages > Add New Page.", "Copy each value into its field; Store View: " + doc.store + "."],
      code: [`Page Title: ${np.title}`, `URL Key: ${np.urlKey || urlKeyOf(np.title)}`, `Meta Title: ${np.metaTitle || np.title}`, `Meta Description: ${np.metaDescription}`].join("\n"),
    },
    {
      key: "content", label: "The page's content", lang: "html",
      steps: [
        "In Content, drag an HTML Code element (Elements) onto the stage.",
        "Paste this into it, then Save. Leave the page disabled until it is reviewed on the shop.",
      ],
      code,
    },
  ];
}
