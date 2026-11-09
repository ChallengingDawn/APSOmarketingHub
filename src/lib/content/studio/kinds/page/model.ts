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
import { describe, validateChanges, type Change } from "../../../../convert/versions";
import { emptyFields, fieldStrings, filledCount, normalizeFields, type Fields, type Item } from "./fields";

export type PageSource = "convert" | "pick" | "new";
export const SOURCES: PageSource[] = ["convert", "pick", "new"];
export const SOURCE_LABEL: Record<PageSource, string> = {
  convert: "From AI testing & personalization", pick: "A page of the shop", new: "A new page",
};

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
  changes: Change[];
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
};

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
  /** the APSOconvert version the changes came from - with its test's figures when it won a test (lib/convert/winner.ts) */
  origin: { versionId: string; rev: number; status: string; summary: string; idea: string; test: WinnerTest | null } | null;
  /** a test's winner published from here (SARCLA 08.11.2026: "content publish should go to Content") */
  published: Published | null;
  /** an older new page: one block of HTML (kept so it still shows); new pages are `fields` */
  newPage: { title: string; urlKey: string; metaTitle: string; metaDescription: string; body: string };
  fields: Fields;
  changes: Change[];
  texts: TextSlot[];
  langs: Record<string, LangVersion>;
  inserts: Insert[];
  abTest: { enabled: boolean; split: number; goal: AbGoal; clickTarget: string; audience: AbAudience; notes: string; status: "draft" };
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
// in every language the shop has - its store views, read from APSOconvert's page index (the `stores` action); when the
// index is empty, the shop's own list below (the locale home pages, src/lib/seo/hreflang.ts). Since 09.11.2026 one
// version per STORE VIEW (below): in Magento each store view gets its own CMS page.

/** The shop's store views when the page index has none yet (src/lib/seo/hreflang.ts LOCALE_HOMEPAGES). */
export const SHOP_STORES = [
  "de-CH", "de-DE", "de-AT", "de-INT", "fr-CH", "fr-FR", "fr-INT", "it-CH", "it-IT", "it-INT", "en-INT", "nl-NL", "nl-INT", "pl-PL",
] as const;
/** The languages in the order the studio shows them (the page's own first). */
export const LANG_ORDER = ["de", "fr", "it", "en", "nl", "pl"] as const;
/** @deprecated the four the studio offered before 08.11.2026 - the shop's languages come from its store views now */
export const LANGS = ["de", "fr", "it", "en"] as const;
/** Each language's own store view: the Swiss one where the shop has it, English the international one (x-default). */
const HOME_STORE: Record<string, string> = { de: "de-CH", fr: "fr-CH", it: "it-CH", en: "en-INT", nl: "nl-NL", pl: "pl-PL", es: "es-ES" };
const LANGUAGE_NAME: Record<string, string> = { de: "German", fr: "French", it: "Italian", en: "English", nl: "Dutch", pl: "Polish", es: "Spanish" };

/** A store view as the shop writes it, without its currency ("de-CH/eur" -> "de-CH"); null when it is not one. */
export function baseStore(store: string | null | undefined): string | null {
  const m = /^([a-z]{2})-([a-z]{2,3})(?:\/[a-z]{3})?$/i.exec(String(store ?? "").trim());
  return m ? `${m[1].toLowerCase()}-${m[2].toUpperCase()}` : null;
}

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
  const have = storesOf(l, stores.length ? stores : SHOP_STORES);
  const country = /^[a-z]{2}-([a-z]{2,3})/i.exec(String(mainStore ?? ""))?.[1]?.toUpperCase() ?? "CH";
  const want = [l === "en" ? "en-INT" : "", `${l}-${country}`, HOME_STORE[l] ?? "", `${l}-INT`].filter(Boolean);
  return want.find((s) => have.includes(s)) ?? have[0] ?? HOME_STORE[l] ?? `${l}-INT`;
}

/** One language the page can be published in: its store view for this page, and every store view of it on the shop. */
export type LangOption = { lang: string; name: string; store: string; stores: string[] };

/** Every language the shop publishes in (from its store views), the page's own first - each with its store view. */
export function shopLanguages(stores: readonly string[], mainStore: string): LangOption[] {
  const list = stores.length ? stores : SHOP_STORES;
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
  return { path: "", store: viewKey(d, key), changes: [], texts: [], fields: emptyFields(), outline: null, from: "", source: "", made: "", at: "" };
}

/** One store view of the page as a whole page document (the main one is the document itself). A language works too. */
export function viewOf(d: PageDoc, key: string | null | undefined): PageDoc {
  const k = viewKey(d, key);
  if (k === mainView(d)) return d;
  const v = d.langs[k] ?? emptyLang(d, k);
  return { ...d, path: v.path, store: k, changes: v.changes, texts: v.texts, fields: v.fields, outline: v.outline, newPage: { ...d.newPage, body: "" } };
}

/** The document with one store view's version put back: its own parts into its place; the shared parts (test, Magento's
 * notes, the banners in it) from the view too, so a change made in any store view reaches every one. */
export function withView(d: PageDoc, key: string | null | undefined, view: PageDoc): PageDoc {
  const k = viewKey(d, key);
  if (k === mainView(d)) return { ...view, langs: d.langs };
  const old = d.langs[k] ?? emptyLang(d, k);
  const next: LangVersion = { ...old, path: view.path, store: k, changes: view.changes, texts: view.texts, fields: view.fields, outline: view.outline };
  return { ...d, abTest: view.abTest, publish: view.publish, notes: view.notes, inserts: view.inserts, magento: view.magento, langs: { ...d.langs, [k]: next } };
}

/** A short stable hash of a text (FNV-1a, base 36). */
export function hashOf(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

/** What a translation or a copy is made from: a store view's words and changes. */
export const sourceHash = (d: PageDoc) => hashOf(JSON.stringify(d.source === "new" ? fieldStrings(d.fields) : [d.changes, d.texts]));

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
  return same.length ? { how: "copy", from: same[0] } : { how: "translate", from: mainView(d) };
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

/** The shop's store views grouped by language, the page's own language first, each group in the shop's order. */
export type StoreGroup = { lang: string; name: string; stores: string[] };
export function shopViews(stores: readonly string[], mainStore: string): StoreGroup[] {
  const list = stores.length ? stores : SHOP_STORES;
  return shopLanguages(list, mainStore).map((o) => {
    const own = o.lang === langOfStore(mainStore) ? [baseStore(mainStore) ?? o.store] : [];
    return { lang: o.lang, name: o.name, stores: sortViews([...new Set([...own, ...storesOf(o.lang, list)])], mainStore) };
  });
}

/** "de-CH · fr-CH · 2 of 14 store views" - the page's store views in one line. */
export function viewsLine(d: PageDoc, groups: StoreGroup[]): string {
  const made = viewsOf(d);
  const total = groups.reduce((n, g) => n + g.stores.length, 0);
  if (made.length < 2) return `Only ${made[0]} so far · ${total} store views on the shop`;
  return `${made.join(" · ")} · ${made.length} of ${total} store views`;
}

/* ── the document ─────────────────────────────────────────────────────── */

export function emptyPage(language?: string | null): PageDoc {
  return {
    v: 1, source: "pick", env: "prod", path: "", store: storeForLanguage(language), pageKind: null, started: false, origin: null, published: null,
    newPage: { title: "", urlKey: "", metaTitle: "", metaDescription: "", body: "" },
    fields: emptyFields(),
    changes: [], texts: [], langs: {}, inserts: [],
    abTest: { enabled: false, split: 50, goal: "add-to-cart", clickTarget: "", audience: "all", notes: "", status: "draft" },
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
const changesOf = (v: unknown): Change[] => (Array.isArray(v) ? (v.filter(isObj) as unknown as Change[]) : []);

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
  for (const [s, x] of Object.entries(raw)) {
    if (s === main) continue;
    const from = str(x.from, 20);
    out[s] = {
      path: str(x.path, 400), store: s, changes: changesOf(x.changes), texts: textsOf(x.texts),
      fields: normalizeFields(x.fields), outline: outlineOf(x.outline), from,
      source: baseStore(str(x.source, 20)) ?? "",
      made: x.made === "copy" || x.made === "translate" ? x.made : from ? "translate" : "",
      at: str(x.at, 40),
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
  const store = str(d.store, 20) || e.store;
  return {
    v: 1,
    source: SOURCES.includes(d.source as PageSource) ? (d.source as PageSource) : e.source,
    env: isEnv(d.env) ? d.env : e.env,
    path: str(d.path, 400),
    store,
    pageKind: isKind(d.pageKind) ? d.pageKind : null,
    started: d.started === true,
    origin: o ? { versionId: str(o.versionId, 40), rev: Number(o.rev) || 1, status: str(o.status, 20), summary: str(o.summary, 600), idea: str(o.idea, 200), test: winnerTestOf(o.test) } : null,
    published: publishedOf(d.published),
    newPage: { title: str(np.title, 200), urlKey: str(np.urlKey, 200), metaTitle: str(np.metaTitle, 200), metaDescription: str(np.metaDescription, 400), body: str(np.body, 60_000) },
    fields: normalizeFields(d.fields),
    changes: changesOf(d.changes),
    texts: textsOf(d.texts),
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
  /\[(?=[^\]\n]*[a-zäöüàâçéèêëîïôûùÿñ])[A-ZÄÖÜÀ-Ý][^\[\]\n<>]{2,160}\]/g,
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
  doc.changes.forEach((c, i) => list.push({ c, from: i }));
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
    if (v.changes.length) lines.push("", "Changes:", ...v.changes.map((c, i) => `${i + 1}. ${changeLine(c)}`));
    const texts = v.texts.filter((t) => t.text.trim());
    if (texts.length) lines.push("", "Texts:", ...texts.map((t) => `- ${t.ask}\n${t.text}`));
    return lines;
  };
  const lines = one(d, "");
  // the first line stays "New page: ..." / "A page of the shop: ..." - the library reads it as the title
  if (d.origin?.summary) lines.splice(1, 0, d.origin.summary);
  for (const lang of Object.keys(d.langs)) { const v = viewOf(d, lang); if (hasContent(v) || v.path) lines.push("", ...one(v, lang)); }
  if (d.abTest.enabled) lines.push("", `A/B test: ${d.abTest.split}% see the new version; goal ${AB_GOAL_LABEL[d.abTest.goal].toLowerCase()}; ${AB_AUDIENCE_LABEL[d.abTest.audience].toLowerCase()}.`);
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
