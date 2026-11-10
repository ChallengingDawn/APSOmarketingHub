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
import { library, libraryText, libModule, makeModule, moduleIdOf, withWords, emptyWords, type LibModule, type PlanWords } from "./library";
import { WORDS_SCHEMA, buttonSays, fillIn, looksEnglish, safeWords, wordsIn, type CleanCtx, type FillSpec } from "./plan";

const BASE = "https://www.apsoparts.com";

/* ── which modules a new page is composed with ─────────────────────────── */

/** Library categories a new page does not take: its hero is its own (the page's H1), and it has no campaign, customer
 * quote, brand wall or video of its own to show. By the registry's category ids - never a module's name. */
export const NEWPAGE_SKIP_CATEGORIES = ["heroes", "campaigns", "references", "media"] as const;
export const newPageLibrary = (lib: LibModule[] = library()): LibModule[] => lib.filter((m) => !(NEWPAGE_SKIP_CATEGORIES as readonly string[]).includes(m.category));

/** The blocks a module stands after (or takes the place of), as the AI names them. */
export const MODULE_AT = ["hero", "intro", "benefits", "section 1", "section 2", "section 3", "section 4", "section 5", "section 6", "links", "faq", "cta"] as const;
export type ModuleAt = (typeof MODULE_AT)[number];
/** The blocks a module may take the place of: never the hero (it holds the page's title, its H1). */
const INSTEAD_OK = new Set<string>(["intro", "benefits", "links", "faq", "cta"]);
export const MAX_MODULES = 4;

const BLOCK_NAME: Record<string, string> = { hero: "the hero", intro: "the intro", benefits: "the proof tiles", links: "the links", faq: "the questions", cta: "the call to action" };
const blockName = (at: string) => BLOCK_NAME[at] ?? (/^section (\d)$/.test(at) ? `section ${at.slice(8)}` : at);

/* ── what the AI is told ──────────────────────────────────────────────── */

const FILL_SPEC_SCHEMA = {
  type: "object", additionalProperties: false, required: ["how", "category", "numbers", "count"],
  properties: {
    how: { type: "string", enum: ["category", "technologies", "viewed", "bought", "none"] },
    category: { type: "string", description: "An address from THE SHOP'S CATEGORIES or THE SHOP'S PAGES YOU MAY LINK (a category), or ''" },
    numbers: { type: "string", description: "Always ''" },
    count: { type: "integer" },
  },
};

export const MODULES_SCHEMA = {
  type: "array",
  description: "2 to 4 modules of THE LIBRARY among the page's text blocks",
  items: {
    type: "object", additionalProperties: false,
    required: ["module", "at", "how", "layout", "why", "words", "extras", "link", "link2", "fill"],
    properties: {
      module: { type: "string", description: "The module's id from THE LIBRARY, exactly as listed" },
      at: { type: "string", enum: [...MODULE_AT], description: "The page's block it stands after (how=after) or takes the place of (how=instead)" },
      how: { type: "string", enum: ["after", "instead"] },
      layout: { type: "string", description: "One of the module's layouts, or ''" },
      why: { type: "string", description: "Why, in ENGLISH, under 10 words" },
      words: WORDS_SCHEMA,
      extras: { type: "array", items: { type: "object", additionalProperties: false, required: ["key", "value"], properties: { key: { type: "string" }, value: { type: "string" } } } },
      link: { type: "string", description: "The button's address: from THE SHOP'S CATEGORIES or THE SHOP'S PAGES YOU MAY LINK - where its words say it goes; else ''" },
      link2: { type: "string", description: "The second button's address (the same lists), else ''" },
      fill: FILL_SPEC_SCHEMA,
    },
  },
};

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
  const w = (o: Partial<PlanWords>) => JSON.stringify({ ...emptyWords(), ...o });
  const none = `{"how":"none","category":"","numbers":"","count":0}`;
  const step = (o: { module: string; at: string; how: string; why: string; words: string; fill: string; link?: string }) =>
    `{"module":"${o.module}","at":"${o.at}","how":"${o.how}","layout":"","why":"${o.why}","words":${o.words},"extras":[],"link":"${o.link ?? ""}","link2":"","fill":${o.fill}}`;
  const cat = `${BASE}/de-CH/dichtungstechnik/o-ringe-x-ringe.html`;
  const steps: string[] = [];
  if (prod) steps.push(step({ module: prod.id, at: "intro", how: "after", why: "The subject's products, ready to order", words: w({ eyebrow: "Sortiment", title: "O-Ringe für Lebensmittelanlagen", button: "Alle O-Ringe" }), fill: `{"how":"category","category":"${cat}","numbers":"","count":${Math.min(prod.max, 6)}}`, link: cat }));
  if (tool) steps.push(step({ module: tool.id, at: "section 2", how: "after", why: "The shop's own tool for this choice", words: w({ title: "Den passenden O-Ring finden", text: "Werkstoff, Mass und Härte in wenigen Schritten auswählen." }), fill: none }));
  if (faq) steps.push(step({ module: faq.id, at: "faq", how: "instead", why: "Buyers' questions, answered from the brief", words: w({ title: "Häufige Fragen", faq: [{ q: "Welche Werkstoffe gibt es?", a: "EPDM, FKM und Silikon - je nach Medium und Temperatur." }] }), fill: none }));
  if (cta) steps.push(step({ module: cta.id, at: "cta", how: "instead", why: "One clear next step at the end", words: w({ title: "Passende Dichtung gesucht?", text: "Unser Team hilft bei der Auswahl.", button: "Kontakt" }), fill: none }));
  if (!steps.length) return "";
  return `AN EXAMPLE of "modules" (a new page "O-Ringe für die Lebensmittelindustrie", store view de-CH, German) - its questions and its call to action are modules, so the faq and cta fields stay empty:
[${steps.join(",")}]`;
}

/** What the whole-page write is told about the modules (after the fill's own rules). */
export function newPageSystem(lib: LibModule[] = newPageLibrary()): string {
  return `THE PAGE IS TEXT BLOCKS AND MODULES. Besides the fields, you compose the page with the shop's MODULE LIBRARY ("modules"):
finished blocks in the shop's own design that the hub fills with the shop's REAL products, categories and photos - never
you. A good new page has 2 to 4 modules among its text blocks, each where it helps a buyer find, choose and order:
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
with its page) keeps them: give it no points. A word the module does not take stays "", a list it does not take stays [].
"why" is ENGLISH, under 10 words.
"fill" - how the hub fills a module's products or categories: "category" (that category's products; for a module of
categories its subcategories), "technologies" (the shop's main technologies), "bought" / "viewed" (most bought / most
viewed online, within "category" when given), "none" (a module of words). "count": how many it shows (its range below).

THE LIBRARY (by category: "id" name: what it is. what the hub fills. layouts. the words it takes):
${libraryText(lib)}

${newPageExample(lib)}`;
}

/** The question's part for the modules: the shop's categories, the pages a button may go to, the language. */
export function newPageUser(a: { tree: { name: string; url: string; depth: number }[]; candidates: { url: string; name: string; kind: string }[]; language: string; store: string }): string {
  const tree = a.tree.length ? a.tree.slice(0, 120).map((t) => `${"  ".repeat(t.depth)}${t.url} · ${t.name}`).join("\n") : "(not read - fill with \"bought\" or \"viewed\", or a category from the pages below)";
  return `THE SHOP'S CATEGORIES (for a module's "fill" and its buttons: address · name):
${tree}

A MODULE'S BUTTONS AND FILL MAY ALSO USE THE SHOP'S PAGES YOU MAY LINK above (their address as listed).

WRITE THE MODULES' WORDS IN: ${a.language} (store view ${a.store}). Each "why": English.
Compose the page: its text blocks (the fields) and 2 to 4 modules of the library among them.`;
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
  for (const x of (Array.isArray(raw) ? raw : []).filter(isObj).slice(0, 8)) {
    if (out.length >= MAX_MODULES) { problems.push(`More than ${MAX_MODULES} modules came back - the first ${MAX_MODULES} were kept.`); break; }
    const asked = str(x.module, 60);
    const id = moduleIdOf(asked);
    if (!id) { problems.push(`"${asked || "(no id)"}" is not a module of the library - left out.`); continue; }
    if (!ids.has(id)) { problems.push(`"${libModule(id)?.name ?? id}" is not one a new page takes (its hero is its own; no campaign, quote or video) - left out.`); continue; }
    if (taken.has(id)) { problems.push(`"${libModule(id)?.name ?? id}" came twice - the second was left out.`); continue; }
    const at = (MODULE_AT as readonly string[]).includes(str(x.at, 20)) ? (str(x.at, 20) as ModuleAt) : null;
    if (!at) { problems.push(`A module aimed at "${str(x.at, 20)}", which is not a block of the page - left out.`); continue; }
    const said: string[] = [];
    let how: "after" | "instead" = x.how === "instead" ? "instead" : "after";
    if (how === "instead" && !INSTEAD_OK.has(at)) { how = "after"; said.push(`${blockName(at)} stays (${at === "hero" ? "it holds the page's title" : "a section is not replaced"}) - the module goes after it`); }
    if (how === "instead" && instead.has(at)) { how = "after"; said.push(`${blockName(at)} was replaced already - the module goes after it`); }
    const m = libModule(id)!;
    const words = wordsIn(x.words, ctx.pageText, said, ctx.lang);
    // a module whose points are the shop's own (each with its page or its picture) keeps them: words by index would put
    // one tool's name on another's link
    const pf = moduleDef(id)?.fields.find((f) => f.kind === "points") as { links?: boolean; pictures?: boolean } | undefined;
    if (pf && (pf.links || pf.pictures) && words.points.length) { words.points = []; said.push("its own points kept (each has its page)"); }
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
    const layout = layouts.includes(str(x.layout, 30)) ? str(x.layout, 30) : "";
    taken.add(id);
    if (how === "instead") instead.add(at);
    const name = m.name;
    out.push({
      module: id, at, how, layout, words, extras, link: link || (fill.how === "category" ? fill.category : ""), link2, fill,
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

/** Does the module need the shop (products, categories or a photo)? */
export function needsShop(module: string): boolean {
  const m = libModule(module);
  return !!m && (m.takes !== "none" || m.needs.includes("picture"));
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

/** A text with the shop's word rules applied line by line (a paragraph break and a "- " list stay as they are). */
export function guardText(text: string, pageText: string, said: string[], lang: string): string {
  if (!text.trim()) return text;
  return text.split("\n").map((line): string | null => {
    const m = /^(\s*[-•–]\s+)?(.*)$/.exec(line)!;
    if (!m[2].trim()) return line;
    const kept = safeWords(m[2], pageText, said, lang);
    // a line left out goes whole (a list keeps its rhythm)
    return kept ? `${m[1] ?? ""}${kept}` : null;
  }).filter((l): l is string => l !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** The whole-page answer's words under the shop's word rules (prices, discounts, stock and delivery promises, a
 * certificate nobody named, "Chemours", another language): a sentence that breaks one is taken out, and said. */
export function guardFill(a: FillAnswer, pageText: string, lang: string): { answer: FillAnswer; problems: string[] } {
  const said: string[] = [];
  const g = (t: string) => guardText(t, pageText, said, lang);
  const out: FillAnswer = { ...a };
  if (a.hero) out.hero = { ...a.hero, eyebrow: g(a.hero.eyebrow), title: g(a.hero.title), sub: g(a.hero.sub), button: { ...a.hero.button, label: g(a.hero.button.label) }, pictureAlt: g(a.hero.pictureAlt) };
  if (a.intro !== undefined) out.intro = g(a.intro);
  if (a.benefits) out.benefits = { title: g(a.benefits.title), items: a.benefits.items.map((b) => ({ title: g(b.title), text: g(b.text) })).filter((b) => b.title || b.text) };
  if (a.sections) out.sections = { items: a.sections.items.map((s) => ({ ...s, title: g(s.title), text: g(s.text), pictureAlt: g(s.pictureAlt) })).filter((s) => s.title || s.text) };
  if (a.section) out.section = { ...a.section, title: g(a.section.title), text: g(a.section.text), pictureAlt: g(a.section.pictureAlt) };
  if (a.links) out.links = { title: g(a.links.title), items: a.links.items.map((l) => ({ ...l, label: g(l.label), note: g(l.note) })).filter((l) => l.label) };
  if (a.faq) out.faq = { title: g(a.faq.title), items: a.faq.items.map((q) => ({ q: g(q.q), a: g(q.a) })).filter((q) => q.q && q.a) };
  if (a.cta) out.cta = { title: g(a.cta.title), text: g(a.cta.text), button: { ...a.cta.button, label: g(a.cta.button.label) } };
  if (a.seo) out.seo = { ...a.seo, title: g(a.seo.title), description: g(a.seo.description) };
  return { answer: out, problems: [...new Set(said)].slice(0, 8) };
}
