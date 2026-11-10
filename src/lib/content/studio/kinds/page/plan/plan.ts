// PAGE - THE AI'S PLAN: THE PAGE BUILT WITH MODULES (Content v7, 10.11.2026). Pure: relative imports only, so the prompt
// and the parsing are proved with canned answers (tests/studio-page-plan.test.ts).
//
// SARCLA 10.11.2026: "Quality of generation is far from being good" (point 5) and "the block ... is what is going to make
// the difference here - directly the AI could bring modules and adjust text" (point 13). So for "Ideas for this page",
// "Make it more convincing", a part's ask and a free ask, the AI no longer writes loose HTML: it answers with a PLAN -
// steps such as "add the product row (a module of the library, by its id) after P3" or "replace P1 with the finder bento",
// each with its settings and its words written for this page - and the hub fills each module's products, categories and
// pictures from the shop itself (./fill.ts: the category tree, most viewed, most bought, numbers), draws it, checks it.
// A free block (../block.ts) only where no module fits, and then the kit's rules.
//
// What the AI is given to plan well: the page's real structure (./places.ts: its parts in order, their words, what each
// holds), the store view's language, the library (./library.ts: ids, categories, what each needs, its words) and three
// worked plans made from the library's own modules (never a name written here). What comes back is checked here: a
// module that is not in the library, a place that is not on the page, a word with a price, a discount, a stock or
// delivery promise, a certificate the page does not name, "Chemours" - left out, and said. The NOTE SARCLA reads is one
// short line in ENGLISH (09.11.2026 it came back as a long German paragraph) - written by the hub from the steps when the
// AI's is not that.

import { SHOP_TOKENS, blockRules, cleanBlock, prefixOf } from "../block";
import { insertChange, leftoversIn, replaceChange, type PageChange } from "../model";
import type { Card, ModuleRef } from "../modules/types";
import { emptyWords, libModule, library, libraryText, moduleIdOf, pickModule, type LibModule, type PlanWords } from "./library";
import type { PagePart } from "./places";

/* ── the plan ─────────────────────────────────────────────────────────── */

export type StepDo = "add" | "replace" | "words" | "block";
export type Where = "before" | "after" | "prepend" | "append";
export type FillHow = "page" | "category" | "technologies" | "viewed" | "bought" | "numbers" | "none";
export type FillSpec = { how: FillHow; category: string; numbers: string; count: number };
/** Where a step lands: at a place of the page, in place of a part of the page, or in place of what the hub put there. */
export type StepPlace =
  | { how: "insert"; selector: string; where: Where }
  | { how: "replace"; selector: string }
  | { how: "change"; change: string };

export type PlanStep = {
  id: string;
  do: StepDo;
  /** the library's id ("" for a free block) */
  module: string;
  /** the part it is at (P3, M1) */
  at: string;
  where: "before" | "after" | "";
  place: StepPlace;
  layout: string;
  words: PlanWords;
  extras: { key: string; value: string }[];
  /** a shop address for its button ("" = its own) */
  link: string;
  fill: FillSpec;
  /** a free block's HTML, cleaned (the kit's rules) */
  html: string;
  /** the step in a short English line, as the plan list shows it */
  line: string;
  /** why, in a few English words */
  why: string;
  /** what was put right or left out, in plain words */
  problems: string[];
};
export type Plan = { note: string; steps: PlanStep[]; problems: string[] };

export type PlanMode = "ideas" | "convincing" | "part" | "ask";

/* ── what the AI is told ──────────────────────────────────────────────── */

const WORDS_SCHEMA = {
  type: "object", additionalProperties: false, required: ["eyebrow", "title", "text", "button", "button2", "points", "faq"],
  properties: {
    eyebrow: { type: "string" }, title: { type: "string" }, text: { type: "string" }, button: { type: "string" }, button2: { type: "string" },
    points: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "text"], properties: { title: { type: "string" }, text: { type: "string" } } } },
    faq: { type: "array", items: { type: "object", additionalProperties: false, required: ["q", "a"], properties: { q: { type: "string" }, a: { type: "string" } } } },
  },
};

export const PLAN_SCHEMA = {
  type: "object", additionalProperties: false, required: ["note", "steps"],
  properties: {
    note: { type: "string", description: "What the plan does, ONE short line in ENGLISH, under 12 words, no full stop" },
    steps: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["do", "module", "at", "where", "layout", "why", "words", "extras", "link", "fill", "html"],
        properties: {
          do: { type: "string", enum: ["add", "replace", "words", "block"] },
          module: { type: "string", description: "The module's id from THE LIBRARY ('' for do=block)" },
          at: { type: "string", description: "A part's id from THE PAGE'S PARTS (P2, M1)" },
          where: { type: "string", enum: ["before", "after", ""], description: "add / block: before or after the part; replace / words: ''" },
          layout: { type: "string", description: "One of the module's layouts, or ''" },
          why: { type: "string", description: "Why, in ENGLISH, under 10 words" },
          words: WORDS_SCHEMA,
          extras: { type: "array", items: { type: "object", additionalProperties: false, required: ["key", "value"], properties: { key: { type: "string" }, value: { type: "string" } } } },
          link: { type: "string", description: "The button's address: one of THE SHOP'S CATEGORIES or a link of the page, else ''" },
          fill: {
            type: "object", additionalProperties: false, required: ["how", "category", "numbers", "count"],
            properties: {
              how: { type: "string", enum: ["page", "category", "technologies", "viewed", "bought", "numbers", "none"] },
              category: { type: "string", description: "An address from THE SHOP'S CATEGORIES, or ''" },
              numbers: { type: "string", description: "8-digit product numbers the person named, or ''" },
              count: { type: "integer" },
            },
          },
          html: { type: "string", description: "do=block only: the whole block (one <style>, one root .apx-blk); else ''" },
        },
      },
    },
  },
};

/** Three worked plans, made from the library's own modules (what fills a row, what lists categories, what holds points,
 * questions, a call to action) - so they show how to plan, never a module the library does not have. */
export function workedExamples(lib: LibModule[] = library()): string {
  const pick = (want: (m: LibModule) => boolean, not: string[] = []) => lib.find((m) => !not.includes(m.id) && want(m)) ?? null;
  const prod = pick((m) => m.takes === "products" && m.max >= 5);
  const cats = pick((m) => m.takes === "categories" && m.min >= 2);
  const points = pick((m) => m.takes === "none" && m.words.some((w) => w.key === "points"));
  const faq = pick((m) => m.words.some((w) => w.key === "faq"));
  const cta = pick((m) => m.takes === "none" && m.words.some((w) => w.key === "button2"), [faq?.id ?? ""]) ?? pick((m) => m.takes === "none" && m.words.some((w) => w.key === "button") && !m.needs.includes("picture"), [faq?.id ?? "", points?.id ?? ""]);
  const w = (o: Partial<PlanWords>) => JSON.stringify({ ...emptyWords(), ...o });
  const step = (o: { do: StepDo; module: string; at: string; where: string; why: string; words: string; fill: string; layout?: string; link?: string }) =>
    `{"do":"${o.do}","module":"${o.module}","at":"${o.at}","where":"${o.where}","layout":"${o.layout ?? ""}","why":"${o.why}","words":${o.words},"extras":[],"link":"${o.link ?? ""}","fill":${o.fill},"html":""}`;
  const none = `{"how":"none","category":"","numbers":"","count":0}`;
  const out: string[] = [];
  const s1: string[] = [];
  if (points) s1.push(step({ do: "add", module: points.id, at: "P1", where: "after", why: "Reasons to order here, right under the title", words: w({ points: [{ title: "Keine Zuschläge", text: "für Kleinbestellungen" }, { title: "Zuschnitte", text: "nach Mass" }, { title: "Schnell bestellen", text: "mit Schnellbestellung & DirectUP" }] }), fill: none }));
  if (prod) s1.push(step({ do: "add", module: prod.id, at: "P2", where: "after", why: "The O-rings buyers order most, ready to click", words: w({ eyebrow: "Beliebt", title: "Meistgekaufte O-Ringe", button: "Alle O-Ringe" }), fill: `{"how":"bought","category":"https://www.apsoparts.com/de-CH/o-ringe.html","numbers":"","count":5}`, link: "https://www.apsoparts.com/de-CH/o-ringe.html" }));
  if (faq) s1.push(step({ do: "add", module: faq.id, at: "P3", where: "after", why: "Answers the page already gives, easy to scan", words: w({ title: "Häufige Fragen zu O-Ringen", faq: [{ q: "Welche Werkstoffe gibt es?", a: "NBR, EPDM, FKM und weitere - wie in der Werkstoffübersicht oben beschrieben." }, { q: "Kann ich auch kleine Mengen bestellen?", a: "Ja, ohne Zuschlag für Kleinbestellungen." }] }), fill: none }));
  if (s1.length) out.push(`EXAMPLE 1 - a category page (store view de-CH, German), the person asks "Make it more convincing".
THE PAGE'S PARTS:
P1 · <div> · holds the page's H1 · heading "O-Ringe"
    O-Ringe Über 24.000 O-Ringe in Normgrössen und Sondermassen ...
P2 · <div> · 14 category links, 14 pictures
    NBR O-Ringe EPDM O-Ringe FKM O-Ringe Silikon O-Ringe ...
P3 · <div> · heading "Was ist ein O-Ring?"
    Ein O-Ring ist ein ringförmiges Dichtelement ... Werkstoffe NBR, EPDM, FKM ...
A GOOD PLAN (every word German and taken from the page or the brand facts; nothing invented):
{"note":"Promises, best sellers and answers added to the O-ring page","steps":[${s1.join(",")}]}`);
  if (cats) out.push(`EXAMPLE 2 - the home page (de-CH), the person selected P1 (a slider of three pictures, no heading) and asks "Show our technologies here instead".
A GOOD PLAN:
{"note":"The slider becomes a finder of the shop's technologies","steps":[${step({ do: "replace", module: cats.id, at: "P1", where: "", layout: cats.layouts[0]?.key ?? "", why: "Buyers start from the technology they need", words: w({ eyebrow: "Sortiment", title: "Finden Sie Ihre Technologie", button: "Alle Produkte" }), fill: `{"how":"technologies","category":"","numbers":"","count":${Math.min(cats.max, 6)}}` })}]}`);
  const m1 = prod ?? cats;
  if (m1) out.push(`EXAMPLE 3 - a page where the hub already put a module: "M1 · a module the hub put here (id "${m1.id}") · heading "Unsere meistgekauften Produkte aus dem Sortiment"". The person asks "Shorter words".
A GOOD PLAN (only the words change - the module and its products stay):
{"note":"Shorter title for the product module","steps":[${step({ do: "words", module: m1.id, at: "M1", where: "", why: "Short titles scan faster", words: w({ eyebrow: "Beliebt", title: "Bestseller" }), fill: none })}]}`);
  if (cta) out.push(`(For a legal or plain text page - privacy, terms, imprint: its text stays exactly as it is. At most ONE step at its end, e.g. a "${cta.id}" after the last part with a way to contact or to the shop's categories - or no step and a note saying why.)`);
  return out.join("\n\n");
}

/** The task's system part (after the brand's voice and facts, which the route puts first). */
export function planSystem(lib: LibModule[] = library()): string {
  return `You plan changes to ONE page of the APSOparts shop (apsoparts.com, the online shop of Angst+Pfister: technical parts
for industry - seals and O-rings, plastics, fluid handling, drive technology, anti-vibration, sensors; buyers are engineers,
purchasers and maintenance). You do not write HTML: you COMPOSE the page with the shop's MODULE LIBRARY - finished blocks
in the shop's own design, filled by the hub with the shop's real products, categories and photos.

A PLAN is a list of steps. Each step does ONE thing:
- "add": a module of THE LIBRARY ("module" = its id, exactly as listed) before or after a part of the page ("at" = the
  part's id, P2 / M1; "where" = before | after).
- "replace": a module in place of a part ("at"). The part is hidden, kept; the module stands where it was. Replace only a
  part whose job the module does better (a slider, a list of links, a block of tiles) - never the page's H1 part (add
  after it instead), never text the page needs (legal text, a product's data, an explanation).
- "words": new words for a module the hub already put on the page ("at" = its M id, "module" = its id) - the module and
  its products stay.
- "block": only when NO module of the library fits: "html" = one finished block (rules below), added before/after a part
  or in place of one.

How a good plan looks:
- Few steps that each clearly help a buyer find, choose and order: 1 step when one thing is asked, 2-4 for ideas or "more
  convincing", never more than 5. The strongest first. Nothing that repeats what the page already shows (a second row of
  the same products, a second list of the same categories).
- Each module where it belongs: products near what they are about, the shop's promises near the top, questions and a call
  to action towards the end.
- Its products or categories come from the shop, not from you: "fill" says how - "category" (that category's products,
  or for a module of categories its subcategories; "category" = an address from THE SHOP'S CATEGORIES), "technologies"
  (the shop's main technologies), "bought" / "viewed" (most bought / most viewed online - within "category" when given),
  "numbers" (only product numbers the person named), "page" (what this page itself is about), "none". "count": how many
  it shows (its range in the library).
- Its words are written FOR THIS PAGE, in the page's language: short, concrete, plain. Headings of 2-6 words. Facts only
  from the page's own words and the brand facts: no prices, no discounts or "% off", no stock or delivery-time promises,
  no certificate or approval the page does not name, no figures you were not given, never the name "Chemours". A button
  says where it goes ("Alle O-Ringe", "Zu den Werkstoffen").
- "note" and "why" are ENGLISH, short (the person approving reads English): note under 12 words, why under 10.
- A word the module does not take stays "". A list it does not take stays [].

THE LIBRARY (by category: "id" name: what it is. what the hub fills. layouts. the words it takes):
${libraryText(lib)}

${workedExamples(lib)}

A FREE BLOCK (do = "block" only): ${blockRules("apx-blk")}

${SHOP_TOKENS}`;
}

/** The question: the page, its parts, the shop's categories, the language, what is asked. */
export function planUser(a: {
  context: string; page: string; parts: PagePart[]; partsText: string; tree: { name: string; url: string; depth: number }[];
  language: string; store: string; mode: PlanMode; request: string; selected: PagePart | null; selectedText?: string;
}): string {
  const tree = a.tree.length ? a.tree.slice(0, 120).map((t) => `${"  ".repeat(t.depth)}${t.url} · ${t.name}`).join("\n") : "(not read - fill with \"bought\", \"viewed\" or \"page\")";
  const ask = a.mode === "ideas"
    ? "Propose what would help a buyer most on this page: 2 to 4 steps, the strongest first."
    : a.mode === "convincing"
      ? `Make the page more convincing for a buyer - the reasons to order here, the right products at hand, answers to what buyers ask - with 2 to 4 steps.${a.request ? ` ${a.request}` : ""}`
      : a.mode === "part"
        ? `Work on THE SELECTED PART only: new words for it (a module the hub put), a better module in its place, or one module right before or after it. 1 or 2 steps.${a.request ? `\nTHE PERSON ASKS: ${a.request}` : ""}`
        : `THE PERSON ASKS: ${a.request || "Improve the page."}\nAs many steps as the ask needs - 1 when it asks for one thing.`;
  return `${a.context}

${a.page}

THE PAGE'S PARTS, IN THEIR ORDER (id · what it is · its heading · what it holds, then its words):
${a.partsText}

THE SHOP'S CATEGORIES (for "fill" and "link": address · name):
${tree}

WRITE THE MODULES' WORDS IN: ${a.language} (store view ${a.store}). The note and each "why": English.
${a.selected ? `\nTHE PERSON SELECTED: ${a.selected.id}${a.selected.heading ? ` (heading "${a.selected.heading}")` : ""}${a.selectedText ? ` - the element reads: "${a.selectedText.slice(0, 300)}"` : ""}\n` : ""}
${ask}`;
}

/* ── what comes back ──────────────────────────────────────────────────── */

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Words that may not stand on the shop: a price, a discount, a stock or delivery-time promise, the brand we never name. */
const NEVER: RegExp[] = [
  /\d+([.,]\d+)?\s*%/, /\b(CHF|EUR|USD|PLN)\b|€|\$/i,
  /\b(rabatt|discount|remise|sconto|korting|rabat|reduziert|reduced|soldes|saldi|sale)\b/i,
  /\b(auf lager|lagernd|in stock|en stock|disponibile a magazzino|op voorraad|na stanie)\b/i,
  /\b(in|within|innerhalb( von)?|en|entro|binnen|w ciągu)\s+\d+\s*(h\b|std|stunden|hours?|tage[n]?|days?|jours?|giorni|dagen|dni|werktage[n]?|business days)/i,
  /\bchemours\b/i,
];
/** Certificates and approvals: only when the page itself names them. */
const CERTS = /\b(FDA|KTW|W270|WRAS|ACS|NSF|USP\s*Class|EC\s*1935|1935\/2004|10\/2011|REACH|RoHS|ATEX|UL\s?\d+|DVGW|BAM|3-A|EHEDG|ISO\s?\d{3,5}|DIN\s?EN\s?\d+|ADI[- ]free)\b/gi;

/** A text kept when it may stand on the shop: sentences with a price, a discount, a stock or delivery promise, "Chemours",
 * a certificate the page does not name, or a placeholder are taken out (and said). */
export function safeWords(text: string, pageText: string, said: string[]): string {
  const plain = text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  if (!plain) return "";
  const parts = plain.split(/(?<=[.!?])\s+/);
  const keep = parts.filter((p) => {
    if (NEVER.some((re) => re.test(p))) { said.push(`"${p.slice(0, 60)}" left out (a price, a discount, a stock or delivery promise, or a name we never write)`); return false; }
    for (const m of p.matchAll(CERTS)) {
      if (!new RegExp(m[0].replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/\s+/g, "\\s*"), "i").test(pageText)) { said.push(`"${p.slice(0, 60)}" left out (${m[0]}: the page does not name it)`); return false; }
    }
    if (leftoversIn(p).length) { said.push(`"${p.slice(0, 60)}" left out (not final words)`); return false; }
    return true;
  });
  return keep.join(" ").trim();
}

/** Does a line read as English? (The note SARCLA reads: 09.11.2026 it came back German.) */
export function looksEnglish(s: string): boolean {
  const t = ` ${s.toLowerCase()} `;
  if (/[äöüßàâçéèêëîïôûùœìòąćęłńóśźż]/i.test(s)) return false;
  const foreign = (t.match(/ (der|die|das|und|mit|für|ein|eine|wurde|nicht|le|la|les|et|des|du|une|pour|avec|il|lo|gli|di|della|per|con|een|het|van|voor|niet|i|w|z|na|dla|się)(?= )/g) ?? []).length;
  const english = (t.match(/ (the|a|an|and|with|for|of|to|on|in|added|page|after|before|row|block|module|words|new|more|replaced?)(?= )/g) ?? []).length;
  return foreign === 0 || english > foreign * 2;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const article = (s: string) => (/^[aeiou]/i.test(s) ? "an" : "a");
const quoteOf = (p: PagePart | undefined): string => {
  if (!p) return "the page";
  if (p.kind !== "page") return `the ${lower(libModule(p.module)?.name ?? "block")}${p.heading ? ` "${cutWords(p.heading, 26)}"` : ""}`;
  if (p.heading) return `"${cutWords(p.heading, 30)}"`;
  if (p.h1) return "the page's title";
  return p.text ? `"${cutWords(p.text, 26)}"` : `part ${p.id}`;
};
const cutWords = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, "")}…`);

/** The step in a short English line ("Add a product row after "Top-Produkte""). */
export function stepLine(s: Pick<PlanStep, "do" | "module" | "at" | "where" | "place">, parts: PagePart[]): string {
  const p = parts.find((x) => x.id === s.at);
  const name = s.do === "block" ? "block" : lower(libModule(s.module)?.name ?? "module");
  if (s.do === "words") return `New words for ${quoteOf(p)}`;
  if (s.do === "replace" || s.place.how === "replace" || s.place.how === "change") {
    if (s.place.how === "insert") return `Add ${article(name)} ${name} ${s.where || "after"} ${quoteOf(p)}`;
    return p && p.kind !== "page" ? `Swap ${quoteOf(p)} for ${article(name)} ${name}` : `Replace ${quoteOf(p)} with ${article(name)} ${name}`;
  }
  return `Add ${article(name)} ${name} ${s.where || "after"} ${quoteOf(p)}`;
}

/** The note in one short English line: the AI's when it is that, else made from the steps. */
export function noteOf(raw: string, steps: PlanStep[]): string {
  const first = raw.split(/\r?\n/)[0].replace(/\s+/g, " ").trim().replace(/[.。]+$/, "");
  if (first && first.length <= 90 && looksEnglish(first) && first.split(" ").length <= 16) return first;
  if (!steps.length) return "Nothing to change";
  const one = steps[0].line;
  return steps.length === 1 ? one : `${one} and ${steps.length - 1} more step${steps.length > 2 ? "s" : ""}`;
}

export type CleanCtx = {
  parts: PagePart[];
  /** the element the parts stand in (./places.ts) - a step at the very start or end */
  container: string;
  /** the shop's category addresses the AI was shown */
  categories: string[];
  /** the page's own address (a category page fills "page" from itself) and kind */
  pageUrl: string; pageKind: string;
  /** every word of the page and the brand facts (what a word may name) */
  pageText: string;
  /** a new id per step (the change it becomes) */
  newId: () => string;
};

const WHERE = ["before", "after"] as const;

/** Where a step lands, from its part and side - the place resolved so that it stands exactly there (./places.ts). */
export function placeOf(doing: StepDo, at: PagePart, where: "before" | "after" | "", ctx: Pick<CleanCtx, "parts" | "container">): { place: StepPlace | null; problem: string } {
  const parts = ctx.parts;
  const i = parts.indexOf(at);
  if (doing === "words") return at.kind === "module" ? { place: { how: "change", change: at.change }, problem: "" } : { place: null, problem: `${at.id} is not a module the hub put on the page - its words are changed by asking on it` };
  if (doing === "replace" || (doing === "block" && !where)) {
    if (at.kind !== "page") return { place: { how: "change", change: at.change }, problem: "" };
    return { place: { how: "replace", selector: at.selector }, problem: "" };
  }
  const side = where || "after";
  // a part of the page itself: right before / after it
  if (at.kind === "page") return { place: { how: "insert", selector: at.selector, where: side }, problem: "" };
  // beside what the hub put there (its blocks cannot be aimed at): the next part of the page's own, or the one before
  if (side === "after") {
    const next = parts.slice(i + 1).find((x) => x.kind === "page");
    if (next) return { place: { how: "insert", selector: next.selector, where: "before" }, problem: "" };
    if (ctx.container) return { place: { how: "insert", selector: ctx.container, where: "append" }, problem: "" };
  } else {
    const prev = [...parts.slice(0, i)].reverse().find((x) => x.kind === "page");
    if (prev) return { place: { how: "insert", selector: prev.selector, where: "after" }, problem: "" };
    if (ctx.container) return { place: { how: "insert", selector: ctx.container, where: "prepend" }, problem: "" };
  }
  return { place: null, problem: `No place was found ${side} ${at.id}` };
}

function wordsIn(v: unknown, pageText: string, said: string[]): PlanWords {
  const o = isObj(v) ? v : {};
  const w = (k: string, n: number) => safeWords(str(o[k], n * 2), pageText, said).slice(0, n);
  return {
    eyebrow: w("eyebrow", 40), title: w("title", 120), text: w("text", 600), button: w("button", 30), button2: w("button2", 30),
    points: (Array.isArray(o.points) ? o.points : []).filter(isObj).slice(0, 8).map((p) => ({ title: safeWords(str(p.title, 80), pageText, said), text: safeWords(str(p.text, 200), pageText, said) })).filter((p) => p.title),
    faq: (Array.isArray(o.faq) ? o.faq : []).filter(isObj).slice(0, 8).map((x) => ({ q: safeWords(str(x.q, 300), pageText, said), a: safeWords(str(x.a, 1200), pageText, said) })).filter((x) => x.q && x.a),
  };
}

function fillIn(v: unknown, lib: LibModule | null, ctx: CleanCtx): FillSpec {
  const o = isObj(v) ? v : {};
  let how = (["page", "category", "technologies", "viewed", "bought", "numbers", "none"] as FillHow[]).find((h) => h === o.how) ?? "none";
  const cat = str(o.category, 400);
  let category = ctx.categories.includes(cat) || (cat && cat === ctx.pageUrl) ? cat : "";
  const numbers = (str(o.numbers, 600).match(/\b\d{8}\b|\b\d{10}\b/g) ?? []).slice(0, 12).join(" ");
  const takes = lib?.takes ?? "none";
  // "page": what the page is about - itself when it is a category, else the shop's technologies / most bought
  if (how === "page") { if (ctx.pageKind === "category" && ctx.pageUrl) { how = "category"; category = ctx.pageUrl; } else how = takes === "categories" ? "technologies" : "bought"; }
  if (how === "category" && !category) how = takes === "categories" ? "technologies" : "bought";
  if (how === "numbers" && !numbers) how = takes === "categories" ? "technologies" : "bought";
  if (takes === "categories" && (how === "viewed" || how === "bought" || how === "numbers")) how = category ? "category" : "technologies";
  if (takes === "products" && how === "technologies") how = "bought";
  if (takes === "none" && how !== "category") how = "none";
  const lo = lib ? Math.max(1, lib.min) : 1, hi = lib ? Math.max(lo, lib.max || 12) : 12;
  const want = Math.round(Number(o.count) || 0);
  return { how, category: how === "category" || how === "viewed" || how === "bought" ? category : "", numbers: how === "numbers" ? numbers : "", count: takes === "none" ? 0 : want ? Math.max(lo, Math.min(hi, want)) : 0 };
}

/** The AI's plan kept where it makes sense: modules of the library, places of the page, words that may stand on the
 * shop - every step resolved to the change it becomes, every refusal said. */
export function cleanPlan(raw: unknown, ctx: CleanCtx): Plan {
  const o = isObj(raw) ? raw : {};
  const problems: string[] = [];
  const steps: PlanStep[] = [];
  const touched = new Set<string>();
  for (const x of (Array.isArray(o.steps) ? o.steps : []).filter(isObj).slice(0, 6)) {
    if (steps.length >= 5) break;
    const said: string[] = [];
    let doing = (["add", "replace", "words", "block"] as StepDo[]).find((d) => d === x.do) ?? null;
    if (!doing) { problems.push("A step of an unknown kind was left out."); continue; }
    const at = ctx.parts.find((p) => p.id === str(x.at, 8).toUpperCase());
    if (!at) { problems.push(`A step aimed at "${str(x.at, 8)}", which is not a part of the page - left out.`); continue; }
    const asked = str(x.module, 60);
    let id = doing === "block" ? "" : doing === "words" && at.kind === "module" ? at.module : moduleIdOf(asked);
    if (doing !== "block" && !id) { problems.push(`"${asked || "(no id)"}" is not a module of the library - that step was left out.`); continue; }
    let where: "before" | "after" | "" = (WHERE as readonly string[]).includes(String(x.where)) ? (x.where as "before" | "after") : "";
    // the part holding the page's H1 keeps it: a module goes after it instead of in its place
    if (doing === "replace" && at.kind === "page" && at.h1) { doing = "add"; where = "after"; said.push(`${at.id} holds the page's title (its H1) - the module goes after it, the title stays`); }
    if (doing === "add" && !where) where = "after";
    if (doing === "block" && !where && at.kind === "page" && at.h1) where = "after";
    const { place, problem } = placeOf(doing, at, where, ctx);
    if (!place) { problems.push(`${problem} - that step was left out.`); continue; }
    // one step per part replaced or rewritten
    const key = place.how === "change" ? `c:${place.change}` : place.how === "replace" ? `r:${place.selector}` : "";
    if (key && touched.has(key)) { problems.push(`${at.id} was changed twice - the second step was left out.`); continue; }
    if (key) touched.add(key);
    const lib = id ? libModule(id) : null;
    const layouts = lib?.layouts.map((l) => l.key) ?? [];
    const layout = layouts.includes(str(x.layout, 30)) ? str(x.layout, 30) : "";
    const words = wordsIn(x.words, ctx.pageText, said);
    const extras = (Array.isArray(x.extras) ? x.extras : []).filter(isObj).map((e) => ({ key: str(e.key, 30), value: safeWords(str(e.value, 120), ctx.pageText, said) })).filter((e) => e.key && e.value && lib?.extras.some((s) => s.key === e.key)).slice(0, 8);
    const linkRaw = str(x.link, 400);
    const link = ctx.categories.includes(linkRaw) || linkRaw === ctx.pageUrl ? linkRaw : "";
    const fill = doing === "words" || doing === "block" ? { how: "none" as FillHow, category: "", numbers: "", count: 0 } : fillIn(x.fill, lib, ctx);
    const stepId = ctx.newId();
    let html = "";
    if (doing === "block") {
      const prefix = prefixOf(stepId);
      const rawHtml = str(x.html, 20_000).split("apx-blk").join(prefix);
      if (!rawHtml.trim()) { problems.push("A free block came back empty - left out."); continue; }
      const c = cleanBlock(rawHtml, prefix, { hadH1: place.how === "replace" && at.h1 });
      html = c.html;
      said.push(...c.problems);
      for (const t of leftoversIn(html)) said.push(`"${t}" is not final words`);
      if (/chemours/i.test(html)) { problems.push("A free block named a brand we never write - left out."); continue; }
    }
    if (doing === "words" && !Object.values(words).some((v) => (Array.isArray(v) ? v.length : !!v))) { problems.push(`The step for ${at.id} brought no words - left out.`); continue; }
    const s: PlanStep = {
      id: stepId, do: doing, module: id ?? "", at: at.id, where: place.how === "insert" ? (where || "after") : "", place, layout, words, extras, link: link || (fill.how === "category" ? fill.category : ""),
      fill, html, line: "", why: looksEnglish(str(x.why, 120)) ? str(x.why, 120) : "", problems: [...new Set(said)].slice(0, 4),
    };
    s.line = stepLine(s, ctx.parts);
    steps.push(s);
  }
  return { note: noteOf(str(o.note, 400), steps), steps, problems: [...new Set(problems)].slice(0, 6) };
}

/* ── a step made into the change the page keeps ───────────────────────── */

/** The module with what the hub filled it with from the shop (its items, its picture) and how - so "fill again" in its
 * panel does the same. */
export function withFill(m: ModuleRef, out: { items: Card[]; feature: Card | null; missing?: string[] }, spec: FillSpec, at = new Date().toISOString()): ModuleRef {
  const how = spec.how === "viewed" || spec.how === "bought" || spec.how === "numbers" ? spec.how : spec.how === "none" ? "ai" : "category";
  return {
    ...m,
    settings: {
      ...m.settings,
      items: out.items.length ? out.items : m.settings.items,
      feature: out.feature ?? m.settings.feature,
      fill: { how, category: spec.category, numbers: spec.numbers, ask: "", at, missing: (out.missing ?? []).slice(0, 30) },
    },
  };
}

/** The change a step becomes: at its place, in place of a part, or the change it rewrites (its id, its place kept). */
export function stepChange(step: Pick<PlanStep, "id" | "place" | "line">, html: string, module: ModuleRef | null, base: PageChange | null = null): PageChange | null {
  const note = step.line.slice(0, 120);
  const mod = module ? { module: module as unknown as { type: string; settings: Record<string, unknown> } } : {};
  if (step.place.how === "change") {
    if (!base || (base.op !== "insert" && base.op !== "replace")) return null;
    const next = { ...base, html, note, ...mod, id: base.id } as PageChange & { off?: string };
    if (!module) delete (next as { module?: unknown }).module;
    delete next.off;
    return next;
  }
  if (step.place.how === "replace") return replaceChange(step.place.selector, html, { id: step.id, note, ...mod });
  return insertChange(step.place.selector, step.place.where, html, { id: step.id, note, ...mod });
}

/** The whole page's words (its parts) - what a word of a plan may name. */
export const pageWords = (parts: PagePart[]) => parts.map((p) => `${p.heading} ${p.text}`).join(" ");

export const DEFAULT_LIBRARY = () => library();
export { pickModule };
