// PAGE - "FILL IT WITH AI" FOR ONE MODULE (Content v11, 10.11.2026). Pure: relative imports only
// (tests/studio-page-cv11-fill.test.ts).
//
// SARCLA 10.11.2026: "I can't see launch the AI to fill me the block" - a "Campaign with its dates" on his Kalrez page
// (whose words say "until 27 November 2026") stood empty, its settings offering no way to have the AI fill it. One task,
// `module_words`, fills ONE module's settings from the page: the button at the top of its settings and the chip's "Ask
// AI" with the module selected both run it (one server path). The AI is told:
//   the page        its subject, its other blocks' words, the to-do's brief, the store view's language
//   the module      what it is, the words it takes (with their limits), its lists, its own settings, its table
//   the dates       every date the page's own words give - a module's "Starts" / "Ends" may only be one of those
//   the brand rules no stock or delivery promise, no discount value, no invented fact or certificate, never Chemours
// What comes back is checked here: every word under the shop's word rules (../plan/plan.ts safeWords, the stock words of
// ../../banner/brand.ts), a figure only when the page or the brand facts give it, a date only when the page gives it (none
// given: the dates stay empty, and it is said), a button only to a page of the shop its words name. The studio puts the
// words into the module (applyModuleWords) and, for a module of the shop's products or categories, fills those from the
// shop as a plan's module is filled (`plan_fill`).

import { STOCK_WORDS } from "../../banner/brand";
import { fieldStrings, type Fields } from "../fields";
import { emptyWords, libModule, withWords, wordsOfModule, type LibModule, type PlanWords } from "../plan/library";
import { factKeys, figuresOut } from "../plan/newpage";
import { buttonSays, fillIn, looksEnglish, safeWords, wordsIn, type CleanCtx, type FillSpec } from "../plan/plan";
import { fieldOf, moduleDef } from "./registry";
import type { ModuleRef } from "./types";

const B = "https://www.apsoparts.com";
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const whole = (u: string) => (u.startsWith("/") ? `${B}${u}` : u);

/* ── the dates a page's words give ────────────────────────────────────── */

export type PageDate = { day: number; month: number; year: number | null; label: string };

const MONTHS: Record<string, number> = {};
[
  ["january", "januar", "janvier", "gennaio", "januari", "jan", "jänner"], ["february", "februar", "février", "fevrier", "febbraio", "februari", "feb", "febr"],
  ["march", "märz", "maerz", "mars", "marzo", "maart", "mar", "mär"], ["april", "avril", "aprile", "apr", "avr"],
  ["may", "mai", "maggio", "mei"], ["june", "juni", "juin", "giugno", "jun"],
  ["july", "juli", "juillet", "luglio", "jul"], ["august", "août", "aout", "agosto", "augustus", "aug"],
  ["september", "septembre", "settembre", "sep", "sept"], ["october", "oktober", "octobre", "ottobre", "oct", "okt"],
  ["november", "novembre", "nov"], ["december", "dezember", "décembre", "decembre", "dicembre", "dec", "dez"],
].forEach((names, i) => names.forEach((n) => { MONTHS[n] = i + 1; }));
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).map((m) => m.replace(".", "\\.")).join("|");

const two = (n: number) => String(n).padStart(2, "0");
/** "27.11.2026", or "27.11." without a year. */
export const dateLabel = (d: Pick<PageDate, "day" | "month" | "year">, withYear = true) => `${two(d.day)}.${two(d.month)}.${withYear && d.year ? d.year : ""}`;
const ok = (day: number, month: number, year: number | null) => day >= 1 && day <= 31 && month >= 1 && month <= 12 && (year === null || (year >= 2000 && year <= 2100));

/** Every date a text gives - "27 November 2026", "27. November 2026", "November 27, 2026", "27 novembre 2026",
 * "27.11.2026", "27.11.", "27/11/2026", "2026-11-27" - once each, in the order it gives them. */
export function datesIn(text: string): PageDate[] {
  const t = String(text ?? "");
  const out: PageDate[] = [];
  const push = (at: number, day: number, month: number, year: number | null) => {
    if (!ok(day, month, year)) return;
    if (out.some((d) => d.day === day && d.month === month && (d.year === year || year === null))) return;
    // the same day without its year, given before: it takes the year
    const same = out.findIndex((d) => d.day === day && d.month === month && d.year === null);
    if (same >= 0) { out[same] = { day, month, year, label: dateLabel({ day, month, year }) }; return; }
    out.push({ day, month, year, label: dateLabel({ day, month, year }) });
    void at;
  };
  const found: { at: number; day: number; month: number; year: number | null }[] = [];
  for (const m of t.matchAll(new RegExp(`(?<![\\p{L}\\d])(\\d{1,2})(?:\\.|st|nd|rd|th)?\\s*(?:de\\s+|di\\s+)?(${MONTH_RE})\\.?(?:\\s*,?\\s*(\\d{4}))?(?![\\p{L}])`, "giu"))) found.push({ at: m.index ?? 0, day: Number(m[1]), month: MONTHS[m[2].toLowerCase()] ?? 0, year: m[3] ? Number(m[3]) : null });
  for (const m of t.matchAll(new RegExp(`(?<![\\p{L}\\d])(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,\\s*|\\s+)(\\d{4})(?!\\d)`, "giu"))) found.push({ at: m.index ?? 0, day: Number(m[2]), month: MONTHS[m[1].toLowerCase()] ?? 0, year: Number(m[3]) });
  for (const m of t.matchAll(/(?<![\d.])(\d{1,2})[./](\d{1,2})[./](\d{4})(?!\d)/g)) found.push({ at: m.index ?? 0, day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) });
  for (const m of t.matchAll(/(?<![\d.])(\d{1,2})\.(\d{1,2})\.(?!\d)/g)) found.push({ at: m.index ?? 0, day: Number(m[1]), month: Number(m[2]), year: null });
  for (const m of t.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) found.push({ at: m.index ?? 0, day: Number(m[3]), month: Number(m[2]), year: Number(m[1]) });
  for (const f of found.sort((a, b) => a.at - b.at)) push(f.at, f.day, f.month, f.year);
  return out;
}

/** A module's settings that hold a date (a campaign's start and end). */
const DATE_KEYS = new Set(["from", "to", "until", "date", "start", "end"]);
export const isDateExtra = (key: string, label = "") => DATE_KEYS.has(key) || /^(starts?|ends?|date|until)\b/i.test(label);

/* ── what the AI is asked ─────────────────────────────────────────────── */

// Flat on purpose (the whole-page write's lesson, 10.11.2026: a nested grammar was refused as too large).
export const MODULE_WORDS_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["eyebrow", "title", "text", "button", "link", "button2", "link2", "items", "extras", "table", "fill", "category", "why"],
  properties: {
    eyebrow: { type: "string" }, title: { type: "string" }, text: { type: "string" },
    button: { type: "string", description: "The button's words, '' when no page of the shop fits" },
    link: { type: "string", description: "The button's address, exactly as listed in THE PAGES A BUTTON MAY GO TO, else ''" },
    button2: { type: "string" }, link2: { type: "string" },
    items: { type: "array", description: "Its points (title + text), or its questions (title = the question, text = the answer); [] when it takes neither", items: { type: "object", additionalProperties: false, required: ["title", "text"], properties: { title: { type: "string" }, text: { type: "string" } } } },
    extras: { type: "array", description: "Its own settings by key (a date, a label) - only those listed for it", items: { type: "object", additionalProperties: false, required: ["key", "value"], properties: { key: { type: "string" }, value: { type: "string" } } } },
    table: { type: "array", description: "Its table, the first row the head - [] when it has none", items: { type: "array", items: { type: "string" } } },
    fill: { type: "string", description: "How the hub fills its products or categories: category | technologies | bought | viewed | none" },
    category: { type: "string", description: "fill=category (or bought / viewed within it): an address from THE SHOP'S CATEGORIES, else ''" },
    why: { type: "string", description: "ENGLISH, one or two short sentences for the person: what you wrote it from - and any word or date left empty, and why" },
  },
};

export const MODULE_WORDS_SYSTEM = `You fill ONE module of a page of the APSOparts shop: a finished block of the shop's module library, drawn
in the shop's own design. You write the words it takes - for THIS page, in the page's language - from what the page
already says, its brief and the brand facts. The hub fills the module's products, categories and photos from the shop:
never you.

How:
- Every word the module takes is written, within its limit (characters - a hard limit). A word it does not take stays
  "", a list it does not take stays [].
- It fits the page: its subject, its other blocks (never a copy of a block's words), the page's language. Headings of 2-8
  words, plain and concrete. A word in ==double equals== shows in the shop's red, where the module allows it - one or two
  words at most.
- Its points or questions (in "items"): as many as it shows, each from what the page says.
- DATES (a module's "Starts" / "Ends"): only a date THE PAGE'S OWN WORDS give (listed under THE DATES THE PAGE GIVES),
  written like the field's example (16.11. / 06.12.2026). "Order until 27 November 2026" gives Ends = 27.11.2026 and no
  start. A date the page does not give stays "" - say so in "why". Never invent a date, never a date of another event.
- Facts only from the page, the brief and the brand facts: no prices, no discount or "% off", no stock or delivery promise
  ("in stock", "ab Lager", "sofort lieferbar", "in 24 h"), no certificate or approval the page does not name, no figure
  the page does not give, no product facts of your own, never the name "Chemours".
- A button says where it goes and its "link" goes exactly there: an address from THE PAGES A BUTTON MAY GO TO. No address
  fits: no words for it.
- A table (only when the module has one): its head first, rows only of what the page states; a value the page does not
  give is left out, never guessed.
- "fill" (a module of the shop's products or categories only): "category" with the page's subject's category from THE
  SHOP'S CATEGORIES, "technologies", "bought" or "viewed"; any other module: "none".
- "why" is ENGLISH.`;

/** The module as the AI is told it: what it is, its words with their limits, its lists, its own settings, its table. */
export function moduleSpec(lib: LibModule): string {
  const def = moduleDef(lib.id);
  const words = lib.words.filter((w) => w.key !== "points" && w.key !== "faq").map((w) => `${w.key}: ${w.label} - at most ${w.max} characters${w.red ? ", ==red== allowed" : ""} (${w.hint})`);
  const pts = lib.words.find((w) => w.key === "points");
  const faq = lib.words.find((w) => w.key === "faq");
  const lists = [pts ? `items = its points: "${pts.item?.title ?? "title"}" + "${pts.item?.text ?? "text"}", ${pts.max} of them (${pts.hint})` : "", faq ? `items = its questions (title = the question, text = the answer), up to ${faq.max}` : ""].filter(Boolean);
  const extras = lib.extras.map((e) => `${e.key}: ${def?.fields.find((f) => f.kind === "extra" && f.key === e.key)?.label ?? e.key}${e.options.length ? ` - one of ${e.options.join(" | ")}` : ` - at most ${e.max} characters`}`);
  const table = def ? fieldOf(def, "table") : undefined;
  const shop = lib.takes === "products" ? `The hub fills ${lib.min}-${lib.max} of the shop's products ("fill").` : lib.takes === "categories" ? `The hub fills ${lib.min}-${lib.max} of the shop's categories ("fill").` : "";
  return `THE MODULE: "${lib.name}" (${lib.id}, ${lib.categoryName}) - ${lib.note}.${shop ? ` ${shop}` : ""}${lib.needs.includes("picture") ? " Its photo comes from the shop." : ""}
ITS WORDS:
${words.map((w) => `- ${w}`).join("\n") || "- none"}${lists.length ? `\nITS LIST:\n${lists.map((l) => `- ${l}`).join("\n")}` : ""}${extras.length ? `\nITS OWN SETTINGS ("extras", by key):\n${extras.map((e) => `- ${e}`).join("\n")}` : ""}${table ? `\nITS TABLE: ${table.label ?? "a table"} - ${table.cols ?? 3} columns, at most ${table.maxRows ?? 12} rows, the first the head` : ""}`;
}

/** The module's words now, small (what the studio sends: a module's products never go in a request). */
export function nowWords(m: ModuleRef): Record<string, unknown> {
  const w = wordsOfModule(m);
  const s = m.settings;
  return {
    eyebrow: w.eyebrow.slice(0, 80), title: w.title.slice(0, 160), text: w.text.slice(0, 600), button: w.button.slice(0, 40), button2: w.button2.slice(0, 40),
    points: w.points.slice(0, 8).map((p) => ({ title: p.title.slice(0, 80), text: p.text.slice(0, 160) })),
    faq: w.faq.slice(0, 6).map((q) => ({ q: q.q.slice(0, 160), a: q.a.slice(0, 300) })),
    extras: Object.entries(s.extra ?? {}).filter(([k]) => !/^(look|split|open)/.test(k)).slice(0, 6).map(([key, value]) => ({ key, value: String(value).slice(0, 60) })),
    table: (s.table ?? []).slice(0, 8).map((r) => r.slice(0, 6).map((c) => c.slice(0, 60))),
  };
}

/** A new page's words, block by block, without the module asked about (what the AI fills it from). */
export function pageWordsOf(f: Fields, exceptModule = ""): string {
  const lines = fieldStrings(f).filter((x) => !x.id.startsWith("seo.") && !x.id.endsWith(".alt")).map((x) => `${x.id}: ${x.text}`);
  for (const pm of f.modules ?? []) {
    if (pm.id === exceptModule) continue;
    const w = wordsOfModule(pm.module);
    const t = [w.eyebrow, w.title, w.text, ...w.points.map((p) => `${p.title} ${p.text}`), ...w.faq.map((q) => `${q.q} ${q.a}`)].filter((x) => x.trim()).join(" · ");
    if (t) lines.push(`module ${libModule(pm.module.type)?.name ?? pm.module.type}: ${t}`);
  }
  return lines.join("\n");
}

/** The question. */
export function moduleWordsUser(a: {
  context: string; page: string; lib: LibModule; now: Record<string, unknown>; language: string; store: string; dates: PageDate[];
  links: { url: string; name: string }[]; tree: { name: string; url: string; depth: number }[]; request: string;
}): string {
  const shop = a.lib.takes !== "none";
  return `${a.context}

THE PAGE (store view ${a.store}, ${a.language}) - ITS BLOCKS' WORDS NOW:
${a.page.slice(0, 14_000) || "(no words yet)"}

${moduleSpec(a.lib)}
IT READS NOW: ${JSON.stringify(a.now)}

THE DATES THE PAGE GIVES: ${a.dates.length ? a.dates.map((d) => `${d.label}${d.year ? "" : " (no year)"}`).join(" | ") : "none - every date of the module stays empty"}

THE PAGES A BUTTON MAY GO TO (address · name):
${a.links.slice(0, 60).map((l) => `${l.url} · ${l.name}`).join("\n") || "(none - its buttons get no words)"}
${shop ? `\nTHE SHOP'S CATEGORIES (for "fill" - address · name):\n${a.tree.slice(0, 120).map((t) => `${"  ".repeat(t.depth)}${t.url} · ${t.name}`).join("\n") || "(not read - fill with \"bought\")"}\n` : ""}
WRITE IN: ${a.language} (store view ${a.store}).${a.request ? `\nTHE PERSON ASKS: ${a.request}` : ""}
Fill this one module: every word it takes, for this page.`;
}

/* ── what comes back ──────────────────────────────────────────────────── */

export type ModuleWords = {
  words: PlanWords;
  extras: { key: string; value: string }[];
  link: string;
  link2: string;
  /** its table (null: it has none, or none came back) */
  table: string[][] | null;
  fill: FillSpec;
  /** what was put right or left out, in plain words */
  problems: string[];
  /** the AI's line for the person (English) */
  note: string;
};

export type WordsCtx = {
  type: string;
  /** the page's words, its brief and the brand facts: what a word may name, the figures it may carry */
  pageText: string;
  lang: string;
  store: string;
  /** every address a button may go to, and what each is called */
  links: string[];
  linkNames: Record<string, string>;
  /** the shop's category addresses a fill may read */
  categories: string[];
  /** the dates the page's own words give */
  dates: PageDate[];
};

/** The answer kept where it may stand on the shop - every refusal said. */
export function cleanModuleWords(raw: unknown, ctx: WordsCtx): ModuleWords {
  const lib = libModule(ctx.type);
  const def = moduleDef(ctx.type);
  const o = isObj(raw) ? raw : {};
  const said: string[] = [];
  const facts = factKeys(ctx.pageText);
  // the shop's stock words (../../banner/brand.ts) on top of the plans' word rules
  const stockOut = (t: string) => { if (!t || !STOCK_WORDS.test(t)) return t; said.push(`"${t.slice(0, 60)}" left out (a stock or delivery promise)`); return ""; };
  const g = (t: string) => figuresOut(stockOut(t), facts, said);
  if (!lib) return { words: emptyWords(), extras: [], link: "", link2: "", table: null, fill: { how: "none", category: "", numbers: "", count: 0 }, problems: ["That module is not in the library any more."], note: "" };
  const takesFaq = lib.words.some((w) => w.key === "faq");
  const takesPoints = lib.words.some((w) => w.key === "points");
  const items = (Array.isArray(o.items) ? o.items : []).filter(isObj).map((i) => ({ title: str(i.title, 300), text: str(i.text, 1200) }));
  const asWords = {
    eyebrow: o.eyebrow, title: o.title, text: o.text, button: o.button, button2: o.button2,
    points: takesPoints && !takesFaq ? items : takesPoints && takesFaq ? items.filter((i) => !/\?\s*$/.test(i.title)) : [],
    faq: takesFaq ? items.filter((i) => !takesPoints || /\?\s*$/.test(i.title)).map((i) => ({ q: i.title, a: i.text })) : [],
  };
  const w = wordsIn(asWords, ctx.pageText, said, ctx.lang);
  w.eyebrow = g(w.eyebrow); w.title = g(w.title); w.text = g(w.text); w.button = g(w.button); w.button2 = g(w.button2);
  w.points = w.points.map((p) => ({ title: g(p.title), text: g(p.text) })).filter((p) => p.title);
  w.faq = w.faq.map((q) => ({ q: g(q.q), a: g(q.a) })).filter((q) => q.q && q.a);
  // the words it takes only
  const keys = new Set(lib.words.map((x) => x.key));
  for (const k of ["eyebrow", "title", "text", "button", "button2"] as const) if (!keys.has(k)) w[k] = "";

  // its buttons: to a page of the shop their words name
  const okLink = (v: unknown) => { const u = whole(str(v, 400)); return u && ctx.links.includes(u) ? u : ""; };
  let link = okLink(o.link);
  let link2 = okLink(o.link2);
  const says = (button: string, url: string) => !button || !url || buttonSays(button, `${ctx.linkNames[url] ?? ""} ${url}`);
  if (!says(w.button, link)) { said.push(`Button "${w.button}" left out: it went to ${ctx.linkNames[link] || "another page"}`); link = ""; w.button = ""; }
  if (!says(w.button2, link2)) { said.push(`Button "${w.button2}" left out: it went to ${ctx.linkNames[link2] || "another page"}`); link2 = ""; w.button2 = ""; }
  if (w.button && !link) { said.push(`Button "${w.button}" left out: no page of the shop was given for it`); w.button = ""; }
  if (w.button2 && !link2) w.button2 = "";

  // its own settings: a date only when the page gives it
  const extras: { key: string; value: string }[] = [];
  const dateFields = lib.extras.filter((e) => isDateExtra(e.key, def?.fields.find((f) => f.kind === "extra" && f.key === e.key)?.label ?? ""));
  const asked = (Array.isArray(o.extras) ? o.extras : []).filter(isObj).map((e) => ({ key: str(e.key, 30), value: str(e.value, 120) })).filter((e) => e.key && e.value && lib.extras.some((x) => x.key === e.key));
  const dates: { key: string; date: PageDate }[] = [];
  for (const e of asked) {
    const spec = dateFields.find((x) => x.key === e.key);
    if (!spec) { const v = g(safeWords(e.value, ctx.pageText, said, ctx.lang)); if (v) extras.push({ key: e.key, value: v }); continue; }
    const d = datesIn(e.value)[0];
    const page = d ? ctx.dates.find((p) => p.day === d.day && p.month === d.month && (p.year === null || d.year === null || p.year === d.year)) : undefined;
    const label = def?.fields.find((f) => f.kind === "extra" && f.key === e.key)?.label?.replace(/\s*\(.*$/, "") ?? e.key;
    if (!page) { said.push(`${label} left empty: "${e.value}" is not a date the page gives`); continue; }
    dates.push({ key: e.key, date: { ...page, year: page.year ?? d!.year } });
  }
  // a start in the same year as the end goes without its year ("16.11." to "06.12.2026" - the field's own example)
  const end = dates.find((x) => x.key !== "from");
  for (const x of dates) extras.push({ key: x.key, value: dateLabel(x.date, !(x.key === "from" && end && end.date.year === x.date.year)) });
  if (dateFields.length) {
    const empty = dateFields.filter((f) => !extras.some((e) => e.key === f.key)).map((f) => (def?.fields.find((x) => x.kind === "extra" && x.key === f.key)?.label ?? f.key).replace(/\s*\(.*$/, ""));
    if (!ctx.dates.length) said.push("The page gives no date - its dates stay empty");
    else if (empty.length && !said.some((x) => / left empty:/.test(x))) said.push(`${empty.join(" and ")} left empty: the page gives no such date`);
  }

  // its table: the head first, rows of what the page states
  const tf = def ? fieldOf(def, "table") : undefined;
  let table: string[][] | null = null;
  if (tf && Array.isArray(o.table)) {
    const cols = Math.max(2, Math.min(8, tf.cols ?? 3));
    const rows = o.table.filter(Array.isArray).slice(0, tf.maxRows ?? 12).map((r) => Array.from({ length: cols }, (_, j) => g(safeWords(str((r as unknown[])[j], 200), ctx.pageText, said, ctx.lang))));
    const kept = rows.filter((r, i) => i === 0 || r.slice(1).some((c) => c));
    table = kept.length >= 2 ? kept : null;
  }

  const planCtx: CleanCtx = { parts: [], container: "", categories: ctx.categories, links: ctx.links, linkNames: ctx.linkNames, pageUrl: "", pageKind: "new", pageText: ctx.pageText, newId: () => "", lang: ctx.lang, store: ctx.store };
  const fill = fillIn({ how: str(o.fill, 20), category: whole(str(o.category, 400)), numbers: "", count: 0 }, lib, planCtx);
  const why = str(o.why, 400);
  return { words: w, extras, link, link2, table, fill, problems: [...new Set(said)].slice(0, 6), note: looksEnglish(why) ? why : "" };
}

/** The module with the AI's words in it: only the words it takes (a word that came back empty keeps what it had), its
 * buttons' pages, its own settings, its table. */
export function applyModuleWords(m: ModuleRef, a: Pick<ModuleWords, "words" | "extras" | "link" | "link2" | "table">): ModuleRef {
  const m1 = withWords(m, a.words, a.link, a.extras, a.link2);
  return a.table && a.table.length ? { ...m1, settings: { ...m1.settings, table: a.table } } : m1;
}
