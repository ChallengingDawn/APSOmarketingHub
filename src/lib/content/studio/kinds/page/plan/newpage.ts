// PAGE - A NEW PAGE WRITTEN WITH MODULES (Content v8, 10.11.2026). Pure: relative imports only
// (tests/studio-page-newmodules.test.ts).
//
// SARCLA 10.11.2026 (point 5): "When the AI is generating a new page it should also generate the modules". The whole-page
// write of a new page (an SEO landing page; "Write the page with AI", "Write it all again", and an app's brief writing it
// by itself) answers with the page's TEXT BLOCKS (the fields: hero, intro, tiles, sections, links, questions, call to
// action - ../fill.ts) AND the MODULES of the shop's library among them - a row of the subject's products, a tool, the
// questions, a call to action - the v7 plan machinery reused (./plan.ts: the words' rules, the fill, the buttons' check;
// ./library.ts: the registry adapter - never a module's name written here):
//   the AI      picks each module by its id from THE LIBRARY (heroes, campaigns, brands and media left out: a new page has
//               its own hero - its H1 - and no campaign, quote or video of its own), says the block it stands after or
//               takes the place of ("instead": that block is not written twice), writes its words in the page's
//               language and says how the hub fills it ("category" with the subject's category, "bought", "viewed")
//   the hub     checks it (a module not in the library, a place the page has not, a second of the same, a word with a
//               price, a discount, a stock or delivery promise - "ab Lager" too -, a certificate nobody named, "Chemours":
//               left out and said), puts each on the page after its block (fields.modules - newpage.ts draws them) and
//               fills its products, categories and photos from the shop (./fill.ts through the `plan_fill` action - real
//               shop data, the clearance filter of ../modules/source.ts applies)
// The text blocks' own words pass the same word rules (guardFill below), line by line so their lists stay lists.

import { blockOrder, removeBlock, type Fields, type PageModule } from "../fields";
import { FILL_SCHEMA, type FillAnswer } from "../fill";
import { moduleDef } from "../modules/registry";
import type { ModuleRef } from "../modules/types";
import { emptyWords, fullGap, isTeaser, library, libraryText, libModule, listsFrom, makeModule, moduleIdOf, withWords, type LibModule, type PlanWords } from "./library";
import { buttonSays, fillIn, looksEnglish, safeWords, wordsIn, type CleanCtx, type FillSpec } from "./plan";
import { aiCanFill, isPlannable } from "./fillable";

const BASE = "https://www.apsoparts.com";

/* ── which modules a new page is composed with ─────────────────────────── */

/** Library categories a new page does not take: its hero is its own (the page's H1), and it has no campaign, customer
 * quote, brand wall or video of its own to show. By the registry's category ids - never a module's name. */
export const NEWPAGE_SKIP_CATEGORIES = ["heroes", "campaigns", "references", "media"] as const;
/** Content v11: and only the modules the fill rules can fill (./fillable.ts) - a module the AI cannot fill is never
 * offered, so never picked (a table of figures, the shop's quote pictures). */
export const newPageLibrary = (lib: LibModule[] = library()): LibModule[] => lib.filter((m) => !(NEWPAGE_SKIP_CATEGORIES as readonly string[]).includes(m.category) && isPlannable(m.id));

/** The blocks a module stands after (or takes the place of), as the AI names them. */
export const MODULE_AT = ["hero", "intro", "benefits", "section 1", "section 2", "section 3", "section 4", "section 5", "section 6", "links", "faq", "cta"] as const;
export type ModuleAt = (typeof MODULE_AT)[number];
/** The blocks a module may take the place of: never the hero (it holds the page's title, its H1). */
const INSTEAD_OK = new Set<string>(["intro", "benefits", "links", "faq", "cta"]);
/** At most this many modules a write brings (Content v9: an empty page is built MOSTLY from the library - 3 to 6). */
export const MAX_MODULES = 6;

const BLOCK_NAME: Record<string, string> = { hero: "the hero", intro: "the intro", benefits: "the proof tiles", links: "the links", faq: "the questions", cta: "the call to action" };
const blockName = (at: string) => BLOCK_NAME[at] ?? (/^section (\d)$/.test(at) ? `section ${at.slice(8)}` : at);

/* ── what the AI is told ──────────────────────────────────────────────── */

// The module's part of the answer is FLAT on purpose: the whole-page write's schema (the text blocks and the modules) is
// one grammar for the model, and a nested one was refused as too large (10.11.2026: "The compiled grammar is too large").
// One list `items` carries a module's points (title + text) or its questions (title = the question, text = the answer).
export const MODULES_SCHEMA = {
  type: "array",
  description: "2 to 6 modules of THE LIBRARY among the page's text blocks, each FULL (all its words)",
  items: {
    type: "object", additionalProperties: false,
    required: ["module", "at", "how", "why", "eyebrow", "title", "text", "button", "link", "items", "fill", "category", "count"],
    properties: {
      module: { type: "string", description: "The module's id from THE LIBRARY, exactly as listed" },
      at: { type: "string", description: `The page's block it stands after (how=after) or takes the place of (how=instead): ${MODULE_AT.join(" | ")}` },
      how: { type: "string", enum: ["after", "instead"] },
      why: { type: "string", description: "Why, in ENGLISH, under 10 words" },
      eyebrow: { type: "string" }, title: { type: "string" }, text: { type: "string" },
      button: { type: "string", description: "The button's words, '' when it has no fitting address" },
      link: { type: "string", description: "The button's address: from THE SHOP'S CATEGORIES or THE SHOP'S PAGES YOU MAY LINK - where its words say it goes; else ''" },
      items: { type: "array", description: "Its points (title + text), or its questions (title = the question, text = the answer); [] when it takes neither", items: { type: "object", additionalProperties: false, required: ["title", "text"], properties: { title: { type: "string" }, text: { type: "string" } } } },
      fill: { type: "string", description: "How the hub fills it: category | technologies | bought | viewed | none" },
      category: { type: "string", description: "fill=category (or bought / viewed within it): a category's address from the lists; else ''" },
      count: { type: "integer", description: "How many items it shows (its range in THE LIBRARY); 0 for none" },
    },
  },
};

/** A module as the flat answer gives it, in the plan's shape (words, link, fill) - so the plan's checks apply as they are. */
function planShape(x: Record<string, unknown>, m: LibModule): Record<string, unknown> {
  const items = (Array.isArray(x.items) ? x.items : []).filter(isObj).map((i) => ({ title: str(i.title, 300), text: str(i.text, 1200) }));
  const takesFaq = m.words.some((w) => w.key === "faq");
  const takesPoints = m.words.some((w) => w.key === "points");
  const words = {
    eyebrow: x.eyebrow, title: x.title, text: x.text, button: x.button, button2: "",
    points: takesPoints && !takesFaq ? items : takesPoints && takesFaq ? items.filter((i) => !/\?\s*$/.test(i.title)) : [],
    faq: takesFaq ? items.filter((i) => !takesPoints || /\?\s*$/.test(i.title)).map((i) => ({ q: i.title, a: i.text })) : [],
  };
  return { ...x, words, extras: [], link2: "", fill: { how: str(x.fill, 20), category: str(x.category, 400), numbers: "", count: x.count } };
}

const ALL = FILL_SCHEMA.all as { type: string; additionalProperties: boolean; required: string[]; properties: Record<string, unknown> };
/** The whole-page write with its modules: the text blocks of the fill (../fill.ts FILL_SCHEMA.all) and `modules`. */
export const NEWPAGE_SCHEMA = { ...ALL, required: [...ALL.required, "modules"], properties: { ...ALL.properties, modules: MODULES_SCHEMA } };

/** A worked example made from the library's own modules (what fills a row, a tool, questions, a call to action) - so it
 * shows how to compose, never a module the library does not have. */
export function newPageExample(lib: LibModule[] = newPageLibrary()): string {
  const pick = (want: (m: LibModule) => boolean, not: string[] = []) => lib.find((m) => !not.includes(m.id) && want(m)) ?? null;
  const prod = pick((m) => m.takes === "products" && m.max >= 4 && m.min <= 4);
  const tool = pick((m) => m.category === "tools" && m.takes === "none" && m.words.some((w) => w.key === "button"));
  const faq = pick((m) => m.takes === "none" && m.words.some((w) => w.key === "faq") && !m.words.some((w) => w.key === "points"));
  const cta = pick((m) => m.category === "cta" && m.takes === "none" && m.words.some((w) => w.key === "button2"));
  const step = (o: { module: string; at: string; how: string; why: string; title: string; text?: string; eyebrow?: string; button?: string; link?: string; items?: { title: string; text: string }[]; fill?: string; category?: string; count?: number }) =>
    JSON.stringify({ module: o.module, at: o.at, how: o.how, why: o.why, eyebrow: o.eyebrow ?? "", title: o.title, text: o.text ?? "", button: o.button ?? "", link: o.link ?? "", items: o.items ?? [], fill: o.fill ?? "none", category: o.category ?? "", count: o.count ?? 0 });
  const cat = `${BASE}/de-CH/dichtungstechnik/o-ringe-x-ringe.html`;
  const steps: string[] = [];
  if (prod) steps.push(step({ module: prod.id, at: "intro", how: "after", why: "The subject's products, ready to order", eyebrow: "Sortiment", title: "O-Ringe für Lebensmittelanlagen", button: "Alle O-Ringe", link: cat, fill: "category", category: cat, count: Math.min(prod.max, 6) }));
  if (tool) steps.push(step({ module: tool.id, at: "section 2", how: "after", why: "The shop's own tool for this choice", title: "Den passenden O-Ring finden", text: "Werkstoff, Mass und Härte in wenigen Schritten auswählen." }));
  if (faq) steps.push(step({ module: faq.id, at: "faq", how: "instead", why: "Buyers' questions, answered from the brief", title: "Häufige Fragen", items: [{ title: "Welche Werkstoffe gibt es?", text: "EPDM, FKM und Silikon - je nach Medium und Temperatur." }] }));
  if (cta) steps.push(step({ module: cta.id, at: "cta", how: "instead", why: "One clear next step at the end", title: "Passende Dichtung gesucht?", text: "Unser Team hilft bei der Auswahl.", button: "Kontakt" }));
  if (!steps.length) return "";
  return `AN EXAMPLE of "modules" (a new page "O-Ringe für die Lebensmittelindustrie", store view de-CH, German) - its questions and its call to action are modules, so the faq and cta fields stay empty:
[${steps.join(",")}]`;
}

/** What the whole-page write is told about the modules (after the fill's own rules). */
export function newPageSystem(lib: LibModule[] = newPageLibrary()): string {
  return `THE PAGE IS TEXT BLOCKS AND MODULES. Besides the fields, you compose the page with the shop's MODULE LIBRARY ("modules"):
finished blocks in the shop's own design that the hub fills with the shop's REAL products, categories and photos - never
you. A good new page has 2 to 6 modules among its text blocks, each where it helps a buyer find, choose and order:
- the subject's products near the top (after the hero or the intro): a module that takes products, "fill" = "category"
  with the subject's category from the lists below (or "bought" / "viewed" within it);
- a tool or service of the shop where it helps the choice (only one the library has);
- the questions buyers ask, or a call to action at the end, as a module - then that text block is not written twice:
  "how": "instead", and its field left empty (no items, empty words).
Each module: "module" = its id, exactly as listed. "at" = the page's block it stands after ("how": "after") or takes the
place of ("how": "instead" - never the hero: it holds the page's title, its H1). "section 2" = the second of the
sections you write. Never two modules that show the same thing, never a module that repeats a text block.
Its words are written FOR THIS PAGE, in the page's language: short, concrete, plain, headings of 2-6 words. Facts only
from the brief, the brand facts and the shop's pages listed: no prices, no discounts or "% off", no stock or delivery
promise ("ab Lager", "sofort lieferbar", "in 24 h"), no certificate or approval nobody named, no figures you were not
given, never the name "Chemours". A button says where it goes and its "link" goes exactly there (an address from the
lists below); a button with no fitting address gets no words. A module whose points are the shop's own (its tools, each
with its page) keeps them: give it no items. Its points - or its questions (title = the question, text = the answer) - go in
"items". A word the module does not take stays "", a list it does not take stays [].
"why" is ENGLISH, under 10 words.
FIGURES - temperatures, hardness, pressures, sizes, norms (ISO, DIN, EN, AS) - in the text blocks AND the modules: only
as THE SHOP'S OWN FACTS (in the question) or the brand facts give them, written as they write them. A figure from neither
is left out: say the same without it ("for high temperatures", never "up to about 200 °C").
"fill" - how the hub fills a module's products or categories: "category" (that category's products; for a module of
categories its subcategories), "technologies" (the shop's main technologies), "bought" / "viewed" (most bought / most
viewed online, within "category" when given), "none" (a module of words). "count": how many it shows (its range below).

THE LIBRARY (by category: "id" name: what it is. what the hub fills. layouts. the words it takes):
${libraryText(lib)}

${newPageExample(lib)}`;
}

/** Does a module carry the shop's own points (each with its page or its picture) - those it keeps, by the registry's
 * settings schema? */
const ownPointsField = (id: string) => {
  const pf = moduleDef(id)?.fields.find((f) => f.kind === "points") as { links?: boolean; pictures?: boolean } | undefined;
  return !!pf && !!(pf.links || pf.pictures);
};
/** The modules that keep their own points in this store view, and those points' titles - so their words fit them
 * (10.11.2026: a tools module's line named tools its own tiles did not show). */
export function ownPoints(store: string, lib: LibModule[] = newPageLibrary()): { id: string; titles: string[] }[] {
  return lib.filter((m) => ownPointsField(m.id)).map((m) => ({ id: m.id, titles: (makeModule(m.id, store)?.settings.points ?? []).map((p) => p.title).filter(Boolean) })).filter((x) => x.titles.length);
}

/* ── the page's subject and the shop's own facts on it (lead 10.11.2026: "give fill_page the subject's real shop facts") ── */

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");
const SUBJECT_STOP = new Set(["aus", "fur", "fuer", "und", "the", "for", "and", "von", "mit", "der", "die", "das", "des", "seo", "page", "seite", "landing", "online", "shop", "html", "www", "apsoparts", "com"]);
const subjectTokens = (s: string) => fold(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !SUBJECT_STOP.has(w) && !/^[a-z]{2}-[a-z]{2,3}$/.test(w));

/**
 * The page's subject among the shop's categories: the one whose name (and address) shares the most words with the
 * brief's own (its title, keywords, the person's ask) - the deeper, more exact one when two share as many. null when no
 * category shares a word. "O-Ringe aus FKM" + "o-ringe fkm" -> "O-Ringe FKM", not "O-Ringe / X-Ringe".
 */
export function subjectOf(briefWords: string[], cats: { name: string; url: string }[]): { name: string; url: string } | null {
  const want = new Set(briefWords.flatMap(subjectTokens));
  if (!want.size) return null;
  const stem = (w: string) => w.replace(/(en|e|n|s)$/, "");
  const wantStems = new Set([...want].map(stem));
  let best: { name: string; url: string; score: number; extra: number } | null = null;
  for (const c of cats) {
    const slug = (() => { try { return new URL(c.url, BASE).pathname.split("/").pop() ?? ""; } catch { return ""; } })();
    // each word once, by its stem ("Ringe" in the name and "ring" in the address are one word)
    const own = [...new Set([...subjectTokens(c.name), ...subjectTokens(slug.replace(/\.html$/, ""))].map(stem))];
    const hit = own.filter((w) => wantStems.has(w)).length;
    if (!hit) continue;
    const extra = subjectTokens(c.name).filter((w) => !want.has(w) && !wantStems.has(stem(w))).length;
    if (!best || hit > best.score || (hit === best.score && extra < best.extra)) best = { name: c.name, url: c.url, score: hit, extra };
  }
  return best ? { name: best.name, url: best.url } : null;
}

/** The shop's own facts on the subject, as the question gives them (its description, its first product's technical
 * summary) - "" when there are none. */
export function factsBlock(f: { name: string; url: string; words: string; product: { name: string; rows: string[][] } | null } | null): string {
  if (!f || (!f.words.trim() && !f.product?.rows.length)) return "";
  const rows = (f.product?.rows ?? []).filter((r) => r.length >= 2 && r[0].trim() && r[1].trim());
  // the shop's own words, without what a page may never say (a stock or delivery promise, a price, "Chemours" - and a
  // sentence naming its trade names: the shop's FKM text tells the material's history by them)
  const words = safeWords(f.words, f.words, [], "").split(/(?<=[.!?])\s+/).filter((x) => !/\b(viton|kalrez|teflon|chemours)\b/i.test(x)).join(" ");
  return `THE SHOP'S OWN FACTS ON THIS PAGE'S SUBJECT - ${f.name} (${f.url}). Figures (temperatures, hardness, pressures,
sizes, norms) only from here or the brand facts; any other figure is left out:
${words || "(its page has no text of its own)"}${rows.length ? `
ITS FIRST PRODUCT'S TECHNICAL SUMMARY (${f.product!.name}):
${rows.slice(1).map((r) => `- ${r[0]}: ${r[1]}`).join("\n")}` : ""}`;
}

/** What the first write of an EMPTY page is told (Content v9, SARCLA 10.11.2026: "the block and number of blocks are
 * decided by the AI on the first prompt"; "the AI should really use the modules to build the block"). */
export const EMPTY_PAGE = `THE PAGE IS EMPTY - YOU DECIDE ITS BLOCKS: which, and how many, for THIS subject and what the brief asks.
Build it MOSTLY FROM THE MODULE LIBRARY: 3 to 6 modules - the subject's products near the top, the shop's categories or a
tool of the shop where they help the choice, the reasons to order here, the questions buyers ask, one call to action at
the end - each only where it helps a buyer find, choose and order.
The text blocks (the fields) only where words of your own say what no module does: the hero always (its title is the
page's H1), usually the intro and one to three sections. The proof tiles, the links, the questions and the call to action
as text blocks only when no module of the library does it better. A block you leave out: its words "" and its items [] -
it is not on the page. A module's "at" names a block you DO write ("hero", "intro", "section 1" ...).
Every module you bring is FULL: every word it takes written for this page, its points or its questions as many as it
shows. A module you cannot fill completely from the facts you have: leave it out, never half-filled.
Compose the page: the text blocks you keep and 3 to 6 modules of the library among them.`;

/** The question's part for the modules: the shop's categories, the pages a button may go to, the language - and the
 * shop's own facts on the subject (factsBlock). `decide`: an empty page - the AI decides its blocks (EMPTY_PAGE). */
export function newPageUser(a: { tree: { name: string; url: string; depth: number }[]; candidates: { url: string; name: string; kind: string }[]; language: string; store: string; facts?: string; decide?: boolean }): string {
  const tree = a.tree.length ? a.tree.slice(0, 120).map((t) => `${"  ".repeat(t.depth)}${t.url} · ${t.name}`).join("\n") : "(not read - fill with \"bought\" or \"viewed\", or a category from the pages below)";
  const own = ownPoints(a.store.split("/")[0]);
  return `${a.facts ? `${a.facts}\n\n` : ""}THE SHOP'S CATEGORIES (for a module's "fill" and its buttons: address · name):
${tree}

A MODULE'S BUTTONS AND FILL MAY ALSO USE THE SHOP'S PAGES YOU MAY LINK above (their address as listed).
${own.length ? `
THE MODULES THAT SHOW THE SHOP'S OWN POINTS (each with its page) - they keep them: their "items" stay [], their words
must fit exactly these:
${own.map((x) => `"${x.id}": ${x.titles.join(" · ")}`).join("\n")}
` : ""}
WRITE THE MODULES' WORDS IN: ${a.language} (store view ${a.store}). Each "why": English.
${a.decide ? EMPTY_PAGE : "Compose the page: its text blocks (the fields) and 2 to 4 modules of the library among them."}`;
}

/* ── what comes back ──────────────────────────────────────────────────── */

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
/** A shop address as the lists give it: a path of the shop made whole. */
const whole = (u: string) => (u.startsWith("/") ? `${BASE}${u}` : u);

export type NewPageModule = {
  module: string;
  at: ModuleAt;
  how: "after" | "instead";
  layout: string;
  words: PlanWords;
  extras: { key: string; value: string }[];
  link: string;
  link2: string;
  fill: FillSpec;
  /** the step in one short English line ("Add a product row after the intro") */
  line: string;
  why: string;
  problems: string[];
};

export type NewPageCtx = {
  /** the category addresses a fill may read (the tree's and the candidates' categories) - whole addresses */
  categories: string[];
  /** every address a button may go to (the categories and the shop's pages offered) */
  links: string[];
  /** what each address is called - a button's words must say it */
  linkNames: Record<string, string>;
  /** the brief, the brand facts, the pages' names: what a word may name */
  pageText: string;
  /** the page's language ("de") */
  lang: string;
  /** the store view ("de-CH") - a module's own points are its store view's */
  store?: string;
  /** the figures and norms the facts given hold (factKeys) - a module's words may carry only those */
  facts?: FactKeys;
  lib?: LibModule[];
};

/** The address lists a new page's modules may use, made from the tree and the candidates (paths made whole). */
export function newPageAddresses(tree: { name: string; url: string }[], candidates: { url: string; name: string; kind: string }[]): Pick<NewPageCtx, "categories" | "links" | "linkNames"> {
  const cats = [...tree.map((t) => whole(t.url)), ...candidates.filter((c) => c.kind === "category").map((c) => whole(c.url))];
  const links = [...cats, ...candidates.map((c) => whole(c.url))];
  const linkNames: Record<string, string> = {};
  for (const t of tree) linkNames[whole(t.url)] = t.name;
  for (const c of candidates) linkNames[whole(c.url)] = c.name;
  return { categories: [...new Set(cats)], links: [...new Set(links)], linkNames };
}

/** "a"/"an" as it sounds, for the English line. */
const withArticle = (name: string) => (/^[aeiou]/i.test(name) ? `an ${name}` : /^[A-Z]{2}/.test(name) ? `a ${name}` : `a ${name.charAt(0).toLowerCase()}${name.slice(1)}`);

/** The AI's modules kept where they make sense: modules of the library a new page takes, places the page has, words
 * that may stand on the shop, buttons that go where they say, fills from the shop - every refusal said. */
export function cleanNewPageModules(raw: unknown, ctx: NewPageCtx): { modules: NewPageModule[]; problems: string[] } {
  const lib = ctx.lib ?? newPageLibrary();
  const ids = new Set(lib.map((m) => m.id));
  const problems: string[] = [];
  const out: NewPageModule[] = [];
  const taken = new Set<string>();
  const instead = new Set<string>();
  const planCtx = { parts: [], container: "", categories: ctx.categories, links: ctx.links, linkNames: ctx.linkNames, pageUrl: "", pageKind: "new", pageText: ctx.pageText, newId: () => "", lang: ctx.lang } satisfies CleanCtx;
  for (const x0 of (Array.isArray(raw) ? raw : []).filter(isObj).slice(0, 8)) {
    if (out.length >= MAX_MODULES) { problems.push(`More than ${MAX_MODULES} modules came back - the first ${MAX_MODULES} were kept.`); break; }
    const asked = str(x0.module, 60);
    const id = moduleIdOf(asked);
    if (!id) { problems.push(`"${asked || "(no id)"}" is not a module of the library - left out.`); continue; }
    if (!ids.has(id)) { problems.push(isPlannable(id) ? `"${libModule(id)?.name ?? id}" is not one a new page takes (its hero is its own; no campaign, quote or video) - left out.` : `"${libModule(id)?.name ?? id}" is not one the AI can fill - left out.`); continue; }
    if (taken.has(id)) { problems.push(`"${libModule(id)?.name ?? id}" came twice - the second was left out.`); continue; }
    const atRaw = str(x0.at, 20).toLowerCase().replace(/^sections?\s*(\d)$/, "section $1");
    const at = (MODULE_AT as readonly string[]).includes(atRaw) ? (atRaw as ModuleAt) : null;
    if (!at) { problems.push(`A module aimed at "${str(x0.at, 20)}", which is not a block of the page - left out.`); continue; }
    const m = libModule(id)!;
    // the flat answer (or a plan-shaped one) in the plan's shape
    const x = isObj(x0.words) ? x0 : planShape(x0, m);
    const said: string[] = [];
    let how: "after" | "instead" = x.how === "instead" ? "instead" : "after";
    if (how === "instead" && !INSTEAD_OK.has(at)) { how = "after"; said.push(`${blockName(at)} stays (${at === "hero" ? "it holds the page's title" : "a section is not replaced"}) - the module goes after it`); }
    if (how === "instead" && instead.has(at)) { how = "after"; said.push(`${blockName(at)} was replaced already - the module goes after it`); }
    const words = wordsIn(x.words, ctx.pageText, said, ctx.lang);
    // a module whose points are the shop's own (each with its page or its picture) keeps them: words by index would put
    // one tool's name on another's link
    // (a store view where the module has none of its own: the AI's points stand, without pages)
    if (ownPointsField(id) && words.points.length && (makeModule(id, ctx.store ?? "de-CH")?.settings.points.length ?? 0) > 0) { words.points = []; said.push("its own points kept (each has its page)"); }
    // figures only from the facts given (a figure they do not hold: its clause or its sentence out, said)
    if (ctx.facts) {
      const fo = (t: string) => figuresOut(t, ctx.facts!, said);
      words.eyebrow = fo(words.eyebrow); words.title = fo(words.title); words.text = fo(words.text); words.button = fo(words.button);
      words.points = words.points.map((p) => ({ title: fo(p.title), text: fo(p.text) })).filter((p) => p.title);
      words.faq = words.faq.map((q) => ({ q: fo(q.q), a: fo(q.a) })).filter((q) => q.q && q.a);
    }
    const extras = (Array.isArray(x.extras) ? x.extras : []).filter(isObj).map((e) => ({ key: str(e.key, 30), value: safeWords(str(e.value, 120), ctx.pageText, said) })).filter((e) => e.key && e.value && m.extras.some((s) => s.key === e.key)).slice(0, 8);
    const okLink = (v: unknown) => { const u = whole(str(v, 400)); return u && ctx.links.includes(u) ? u : ""; };
    let link = okLink(x.link);
    let link2 = okLink(x.link2);
    const says = (button: string, url: string) => !button || !url || buttonSays(button, `${ctx.linkNames[url] ?? ""} ${url}`);
    if (!says(words.button, link)) { said.push(`Button "${words.button}" left out: it went to ${ctx.linkNames[link] || "another page"}`); link = ""; words.button = ""; }
    if (!says(words.button2, link2)) { said.push(`Button "${words.button2}" left out: it went to ${ctx.linkNames[link2] || "another page"}`); link2 = ""; words.button2 = ""; }
    if (words.button2 && !link2) words.button2 = "";
    const f0 = isObj(x.fill) ? { ...x.fill, category: whole(str(x.fill.category, 400)) } : x.fill;
    const fill = fillIn(f0, m, planCtx);
    const layouts = m.layouts.map((l) => l.key);
    let layout = layouts.includes(str(x.layout, 30)) ? str(x.layout, 30) : "";
    // a module of words is FULL on the page or not there (Content v9, SARCLA 10.11.2026: "the AI should really use the
    // modules ... and fill them fully"; a "Three teasers" came back empty): what it lacks with the words it came with -
    // another of its kind that these words fill takes its place, else it is left out and said. A module of the shop's
    // products, categories or photos is checked once the shop has filled it (the studio: fillTries below).
    let use = m;
    let useExtras = extras;
    if (!needsShop(id)) {
      const store = ctx.store ?? "de-CH";
      // Content v11: a module the fill rules cannot fill in this store view is never kept, whatever came back with it
      const cannot = !aiCanFill(id, store);
      const gap = gapWith({ module: id, words, link, link2, extras, layout }, store) || (cannot ? "It cannot be filled in this store view" : "");
      if (gap) {
        // one of the same kind that THESE words fill (not its own sample words)
        const alt = lib.find((o) => o.id !== id && o.category === m.category && !taken.has(o.id) && !needsShop(o.id) && !ownPointsField(o.id) && listsFrom(o.id, words) && aiCanFill(o.id, store)
          && !gapWith({ module: o.id, words, link, link2, extras: [], layout: "" }, store)
          && !!gapWith({ module: o.id, words: emptyWords(), link: "", link2: "", extras: [], layout: "" }, store));
        if (!alt) { problems.push(cannot ? `"${m.name}" left out: it cannot be filled in ${store}.` : `"${m.name}" left out: ${lowerFirst(gap)} - it came back without them.`); continue; }
        said.push(`"${m.name}" could not be filled (${lowerFirst(gap)}) - "${alt.name}" in its place`);
        use = alt; useExtras = []; layout = "";
      }
    }
    taken.add(id);
    taken.add(use.id);
    if (how === "instead") instead.add(at);
    const name = use.name;
    out.push({
      module: use.id, at, how, layout, words, extras: useExtras, link: link || (fill.how === "category" ? fill.category : ""), link2, fill,
      line: how === "instead" ? `${name} in place of ${blockName(at)}` : `Add ${withArticle(name)} after ${blockName(at)}`,
      why: looksEnglish(str(x.why, 120)) ? str(x.why, 120) : "", problems: [...new Set(said)].slice(0, 4),
    });
  }
  return { modules: out, problems: [...new Set(problems)].slice(0, 6) };
}

/* ── the modules put on the page ──────────────────────────────────────── */

/** A new page's module the AI put there (its page module id starts "ai") - "Write it all again" replaces those, a
 * module the person put stays. */
export const AI_MODULE = /^ai[a-z0-9]+$/;
export const isAiModule = (pm: Pick<PageModule, "id">) => AI_MODULE.test(pm.id);

/** The block a module's "at" names on the page as it is: "section 2" = the second section in the page's order (a section
 * the page has not: its last one). null when the page has no such block. */
export function blockKeyOf(at: string, order: string[]): string | null {
  const sec = /^section (\d)$/.exec(at);
  if (sec) {
    const list = order.filter((k) => k.startsWith("sections."));
    return list[Number(sec[1]) - 1] ?? list[list.length - 1] ?? null;
  }
  return order.includes(at) ? at : null;
}

const CANON = ["hero", "intro", "benefits", "sections", "links", "faq", "cta"];
/** A block the page does not have: the nearest one before where it would stand (the page's usual order). */
function nearestBefore(at: string, order: string[]): string {
  const c = CANON.indexOf(at.startsWith("section") ? "sections" : at);
  for (let i = c - 1; i >= 0; i--) {
    if (CANON[i] === "sections") { const s = order.filter((k) => k.startsWith("sections.")); if (s.length) return s[s.length - 1]; continue; }
    if (order.includes(CANON[i])) return CANON[i];
  }
  return "hero";
}

/** The module a step brings, with its words for the page (not filled yet). */
export function moduleOfStep(s: Pick<NewPageModule, "module" | "words" | "link" | "link2" | "extras" | "layout">, store: string): ModuleRef | null {
  const m0 = makeModule(s.module, store);
  if (!m0) return null;
  const m1 = withWords(m0, s.words, s.link, s.extras, s.link2);
  return s.layout ? { ...m1, settings: { ...m1.settings, layout: s.layout } } : m1;
}

/** Does the module need the shop (products, categories, a photo - or its teasers' pictures and pages, ./library.ts
 * teaserField)? */
export function needsShop(module: string): boolean {
  const m = libModule(module);
  return !!m && (m.takes !== "none" || m.needs.includes("picture") || isTeaser(module));
}

const lowerFirst = (t: string) => (t ? `${t.charAt(0).toLowerCase()}${t.slice(1)}` : t);

/** What a module still lacks with these words in it ("" = full): the registry's own check (../modules/registry.ts), then
 * its words - a headline when it takes one, its points or its questions when it takes them (Content v9: "filled fully,
 * with all their words" - a module that draws nothing but its frame is not full). */
export function gapWith(s: Pick<NewPageModule, "module" | "words" | "link" | "link2" | "extras" | "layout">, store: string): string {
  const m = moduleOfStep(s, store);
  return m ? fullGap(m) : "It is not in the module library";
}

/** The AI's modules of words that are not full taken out before they go on the page - the studio's own check of what the
 * server kept (Content v9: no "not on the page yet" module from the AI). A module of the shop is checked once filled. */
export function fullOnly<T extends Pick<NewPageModule, "module" | "words" | "link" | "link2" | "extras" | "layout">>(mods: T[], store: string): { kept: T[]; left: string[] } {
  const kept: T[] = [];
  const left: string[] = [];
  for (const s of mods) {
    const gap = needsShop(s.module) ? "" : gapWith(s, store);
    if (gap) left.push(`"${libModule(s.module)?.name ?? s.module}" left out: ${lowerFirst(gap)}.`);
    else kept.push(s);
  }
  return { kept, left };
}

/** One way to fill a module of the shop: the module, how, its layout, and the line said when it is not the AI's own. */
export type FillTry = { module: string; fill: FillSpec; layout: string; why: string };

/**
 * What the studio tries, in turn, for a module of the shop's products or categories the AI put on a new page, until one
 * comes back FULL (Content v9, SARCLA 10.11.2026: a module "not on the page yet" from the AI is never left): the AI's own
 * fill; then, within the same category, the most bought and the most viewed products; a module of categories whose
 * category has no subcategories: a module of products of the same family filled with that category's products. When
 * none fills it, the module is taken off the page and said.
 */
export function fillTries(s: Pick<NewPageModule, "module" | "fill" | "layout">, lib: LibModule[] = newPageLibrary()): FillTry[] {
  const m = libModule(s.module);
  const out: FillTry[] = [{ module: s.module, fill: s.fill, layout: s.layout, why: "" }];
  if (!m) return out;
  const cat = s.fill.category;
  const count = s.fill.count;
  if (m.takes === "products") {
    if (s.fill.how === "category" || s.fill.how === "numbers") {
      out.push({ module: s.module, fill: { how: "bought", category: cat, numbers: "", count }, layout: s.layout, why: "the most bought products" });
      out.push({ module: s.module, fill: { how: "viewed", category: cat, numbers: "", count }, layout: s.layout, why: "the most viewed products" });
    } else if (s.fill.how === "bought" || s.fill.how === "viewed") {
      const other = s.fill.how === "bought" ? "viewed" : "bought";
      out.push({ module: s.module, fill: { how: other, category: cat, numbers: "", count }, layout: s.layout, why: `the most ${other} products` });
    }
  } else if (isTeaser(s.module)) {
    // teasers: the category's subcategories (or its products); then the shop's technologies, each with its photo
    if (cat) out.push({ module: s.module, fill: { how: "technologies", category: "", numbers: "", count }, layout: s.layout, why: "the shop's technologies" });
  } else if (m.takes === "categories" && cat) {
    // a family's module of products ("bentos", "showcases"), else the library's first module of products
    const prods = lib.filter((o) => o.takes === "products" && !o.needs.includes("picture"));
    const alt = prods.find((o) => o.category === m.category) ?? prods[0];
    if (alt) {
      const n = Math.max(alt.min, Math.min(alt.max, 6));
      out.push({ module: alt.id, fill: { how: "category", category: cat, numbers: "", count: n }, layout: "", why: `${withArticle(alt.name)} in its place` });
      out.push({ module: alt.id, fill: { how: "bought", category: cat, numbers: "", count: n }, layout: "", why: `${withArticle(alt.name)} with the most bought products, in its place` });
    }
  }
  return out;
}

/**
 * The page with its modules: each after its block - a block a module takes the place of is taken out (its words go with
 * it), the module stands where it was; the AI's earlier modules give way to these, the person's own stay. `newId` makes
 * each page module's id ("ai..."). Returns the fields and the modules placed (their page ids, in order).
 */
export function composeModules(f: Fields, mods: NewPageModule[], store: string, newId: () => string): { fields: Fields; placed: { id: string; step: NewPageModule }[]; problems: string[] } {
  const order0 = blockOrder(f);
  const problems: string[] = [];
  let fields: Fields = f;
  // the blocks the modules take the place of, out first
  const gone = new Set<string>();
  for (const s of mods) {
    if (s.how !== "instead") continue;
    const key = blockKeyOf(s.at, order0);
    if (key && key !== "hero") { gone.add(key); fields = removeBlock(fields, key); }
  }
  const order = blockOrder(fields);
  /** the nearest block still on the page at or before a block of the first order */
  const keptAtOrBefore = (key: string, inclusive: boolean): string => {
    const i = order0.indexOf(key);
    for (let j = inclusive ? i : i - 1; j >= 0; j--) if (order.includes(order0[j])) return order0[j];
    return "hero";
  };
  const placed: { id: string; step: NewPageModule }[] = [];
  const mine: PageModule[] = [];
  for (const s of mods) {
    const module = moduleOfStep(s, store);
    if (!module) { problems.push(`"${s.module}" is not in the module library any more - left out.`); continue; }
    const key = blockKeyOf(s.at, order0);
    // a block the page has not: after the one before where it would stand
    const after = !key ? nearestBefore(s.at, order) : s.how === "instead" && gone.has(key) ? keptAtOrBefore(key, false) : keptAtOrBefore(key, true);
    const id = newId();
    mine.push({ id, after, module });
    placed.push({ id, step: s });
  }
  const kept = (fields.modules ?? []).filter((pm) => !isAiModule(pm));
  return { fields: { ...fields, modules: [...kept, ...mine].slice(0, 12) }, placed, problems };
}

/* ── the text blocks' words under the same rules ──────────────────────── */

/* ── figures only from the facts given (lead 10.11.2026) ──────────────── */
//
// A number with a unit (°C, bar, Shore, mm, %, h ...) or a norm (ISO, DIN, EN, AS ...) in the AI's words that the facts it
// was given do not hold is taken out: the clause that carries it (after a dash, a comma, a semicolon, in brackets), or
// the whole sentence when the figure stands in its first clause - and said under "Left out".

const UNIT = "°\\s?C|°\\s?F|bar|psi|MPa|kPa|N/mm²|Shore(?:\\s?[AD])?|mm|cm|µm|%|h|Std\\.?|Stunden|hours?";
const NUM = "[+\\-−–±]?\\d+(?:[.,']\\d+)*";
// a number, a range ("-25 bis +200"), a tolerance ("70 ±5"), then its unit
const TOL = "(?:\\s?±\\s?\\d+(?:[.,]\\d+)?)?";
const FIGURE_RE = () => new RegExp(`(?<![\\p{L}\\d])(${NUM})${TOL}(?:\\s?(?:bis|to|à|a|-|–|…|\\.\\.)\\s?(${NUM})${TOL})?\\s?(${UNIT})(?![\\p{L}\\d])`, "giu");
const NORM_RE = () => /\b(ISO|DIN(?:\s?EN)?|EN|AS|ASTM|SAE|JIS|BS)\s?-?(\d{2,5}(?:[-/]\d+)?)\b/g;
const numKey = (n: string) => n.replace(/^[+±]/, "").replace(/^[−–]/, "-").replace(/'/g, "").replace(",", ".").replace(/\.0+$/, "");
const unitKey = (u: string) => {
  const x = u.toLowerCase().replace(/\s/g, "");
  return x.startsWith("shore") ? "shore" : /^(h|std\.?|stunden|hours?)$/.test(x) ? "h" : x;
};

/** A text's figures: each number with its unit ("200|°c"), and its norms ("ISO3601"). */
export function figuresIn(text: string): { figures: { raw: string; keys: string[] }[]; norms: { raw: string; key: string }[] } {
  const figures = [...String(text ?? "").matchAll(FIGURE_RE())].map((m) => ({ raw: m[0].trim(), keys: [m[1], m[2]].filter(Boolean).map((n) => `${numKey(n!)}|${unitKey(m[3])}`) }));
  const norms = [...String(text ?? "").matchAll(NORM_RE())].map((m) => ({ raw: m[0].trim(), key: `${m[1].replace(/\s/g, "").toUpperCase()}${m[2]}` }));
  return { figures, norms };
}

/** What the facts hold, ready to ask: their figures' keys and their norms. */
export type FactKeys = { figures: Set<string>; norms: Set<string> };
export function factKeys(facts: string): FactKeys {
  const f = figuresIn(facts);
  return { figures: new Set(f.figures.flatMap((x) => x.keys)), norms: new Set(f.norms.map((x) => x.key)) };
}

/** The figures of a piece of text the facts do not hold. */
export function unsourced(text: string, k: FactKeys): string[] {
  const f = figuresIn(text);
  return [...f.figures.filter((x) => x.keys.some((key) => !k.figures.has(key))).map((x) => x.raw), ...f.norms.filter((x) => !k.norms.has(x.key)).map((x) => x.raw)];
}

/** A text with every figure the facts do not hold taken out - its clause, or its sentence - each said. */
export function figuresOut(text: string, k: FactKeys, said: string[]): string {
  if (!text.trim() || !unsourced(text, k).length) return text;
  const out: string[] = [];
  // sentences as the word rules cut them (a decimal point is no end of a sentence)
  for (const sentence of text.trim().split(/(?<=[.!?])\s+/)) {
    const bad = unsourced(sentence, k);
    if (!bad.length) { out.push(sentence); continue; }
    for (const b of bad) said.push(`"${b}" left out: the shop's facts on the page's subject do not give it`);
    // a clause in brackets holding it goes; then a clause after a dash, a comma or a semicolon
    const s = sentence.replace(/\s*\([^()]*\)/g, (g) => (unsourced(g, k).length ? "" : g));
    const m = /^([\s\S]*?)([.!?]*)$/.exec(s.trim())!;
    const parts = m[1].split(/(\s[-–—]\s|,\s|;\s)/);
    // its first clause carries it: the sentence goes
    if (unsourced(parts[0], k).length) continue;
    const kept: string[] = [parts[0]];
    for (let i = 1; i < parts.length; i += 2) if (!unsourced(parts[i + 1] ?? "", k).length) kept.push(parts[i], parts[i + 1] ?? "");
    out.push(`${kept.join("").replace(/[\s,;–—-]+$/, "")}${m[2]}`);
  }
  return out.join(" ").replace(/\s{2,}/g, " ").trim();
}

/** A text with the shop's word rules applied line by line (a paragraph break and a "- " list stay as they are) - and,
 * with the facts given, every figure they do not hold taken out. */
export function guardText(text: string, pageText: string, said: string[], lang: string, facts?: FactKeys): string {
  if (!text.trim()) return text;
  return text.split("\n").map((line): string | null => {
    const m = /^(\s*[-•–]\s+)?(.*)$/.exec(line)!;
    if (!m[2].trim()) return line;
    const words = safeWords(m[2], pageText, said, lang);
    const kept = facts ? figuresOut(words, facts, said) : words;
    // a line left out goes whole (a list keeps its rhythm)
    return kept ? `${m[1] ?? ""}${kept}` : null;
  }).filter((l): l is string => l !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** The whole-page answer's words under the shop's word rules (prices, discounts, stock and delivery promises, a
 * certificate nobody named, "Chemours", another language): a sentence that breaks one is taken out, and said. */
export function guardFill(a: FillAnswer, pageText: string, lang: string, facts?: FactKeys): { answer: FillAnswer; problems: string[] } {
  const said: string[] = [];
  const g = (t: string) => guardText(t, pageText, said, lang, facts);
  const out: FillAnswer = { ...a };
  if (a.hero) out.hero = { ...a.hero, eyebrow: g(a.hero.eyebrow), title: g(a.hero.title), sub: g(a.hero.sub), button: { ...a.hero.button, label: g(a.hero.button.label) }, pictureAlt: g(a.hero.pictureAlt) };
  if (a.intro !== undefined) out.intro = g(a.intro);
  // a tile whose words were all left out goes whole (never a heading over nothing)
  if (a.benefits) out.benefits = { title: g(a.benefits.title), items: a.benefits.items.map((b) => ({ title: g(b.title), text: g(b.text), had: !!b.text.trim() })).filter((b) => b.title && (b.text || !b.had)).map(({ had: _h, ...b }) => b) };
  if (a.sections) out.sections = { items: a.sections.items.map((s) => ({ ...s, title: g(s.title), text: g(s.text), pictureAlt: g(s.pictureAlt) })).filter((s) => s.title || s.text) };
  if (a.section) out.section = { ...a.section, title: g(a.section.title), text: g(a.section.text), pictureAlt: g(a.section.pictureAlt) };
  if (a.links) out.links = { title: g(a.links.title), items: a.links.items.map((l) => ({ ...l, label: g(l.label), note: g(l.note) })).filter((l) => l.label) };
  if (a.faq) out.faq = { title: g(a.faq.title), items: a.faq.items.map((q) => ({ q: g(q.q), a: g(q.a) })).filter((q) => q.q && q.a) };
  if (a.cta) out.cta = { title: g(a.cta.title), text: g(a.cta.text), button: { ...a.cta.button, label: g(a.cta.button.label) } };
  if (a.seo) out.seo = { ...a.seo, title: g(a.seo.title), description: g(a.seo.description) };
  return { answer: out, problems: [...new Set(said)].slice(0, 8) };
}
