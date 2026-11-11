// PAGE - A MODULE'S ELEMENTS, ONE BY ONE (Content v13, 11.11.2026). Pure: relative imports only
// (tests/studio-page-cv13-elements.test.ts).
//
// SARCLA 11.11.2026, on the popup of a "Campaign with its dates" (all its words as fields): "still confusing ... You should
// allow editing per element, therefore also the AI per element, like a text, a button. I should be able to add another
// button, take out elements. Both settings and ask AI go to block level - we need to dig into element also. Allow element
// create inside of the block."
//
// Every visible element of a module is a PART of it, named by the setting it is drawn from:
//   title · eyebrow · text · link · link2      its headline, small line above, line, buttons
//   points.<i> · points.<i>.title|text         a point, a tile, a teaser - or its title or its line
//   faq.<i> · faq.<i>.q|a                      a question - or its question or its answer
//   extra.<key>                                a date, a badge's words
//   words.<key>                                the tiles' button ("Alle anzeigen")
//   table.<row>.<col>                          a cell of its table
//   items.<i>                                  a product or a category card - filled from the shop
//   feature                                    its picture
//   add.<id>                                   an element a person added (./adds.ts)
// A click in the page is told here as a PROBE (what the element says, its link, its picture, its class) and becomes the
// part it hit (partAt); the studio selects that element on its own, with its own popup, its own Ask AI and "Take it out".
// Only a click on the module's own ground (its padding, its empty area) is the whole block.

import { moduleFieldEdit, moduleFieldLabel, moduleWordsAt, sameWords, takeOutOfModule, wordsKey } from "../blocklist";
import { packLook } from "../style";
import { ADDS_MAX, ADD_MAX, ADD_NAME, addId } from "./adds";
import { pictureAddress, shopAddress } from "./address";
import { wordsFor } from "./kit";
import { BUTTON_LOOK_KEY, TEXT_LOOK_KEY, isLookKey } from "./looks";
import { fieldOf, hasField, moduleDef } from "./registry";
import { tileWordsOf } from "./tilewords";
import type { AddKind, Added, Card, ModuleRef, ModuleSettings } from "./types";

/** What a click in the page tells about the element it landed on (the studio's frame reads it from the page). */
export type Probe = {
  /** its tag, lower case */
  tag: string;
  /** its words as the page shows them */
  text: string;
  /** an element of words (a heading, a paragraph, a button, a cell) - no picture in it */
  words: boolean;
  /** its own link (an <a>), its own picture (an <img>) */
  href: string | null;
  src: string | null;
  /** the link it stands in (a word inside a button) */
  inLink: string | null;
  /** its class attribute */
  cls: string;
  /** the pictures and links inside it (a few) */
  srcs: string[];
  hrefs: string[];
};

export type PartKind = "words" | "button" | "picture" | "item" | "point" | "question" | "cell";

/** One part of a module as its popup shows it. */
export type PartInfo = {
  part: string;
  kind: PartKind;
  /** "Headline", "Ends (e.g. 06.12.2026)", "Point 2 · title", "Button (added)" */
  label: string;
  /** its words now (a point's or a question's: its title or question) */
  words: string;
  max: number;
  multiline: boolean;
  /** what the AI is told it is (a heading, a button's words, a paragraph) */
  tag: string;
  /** a picture's address, a button's page, a card from the shop */
  img?: string;
  url?: string;
  card?: Card;
};

const P = /^points\.(\d+)(?:\.(title|text))?$/;
const Q = /^faq\.(\d+)(?:\.(q|a))?$/;
const IT = /^items\.(\d+)$/;
const AD = /^add\.([a-z0-9]+)$/;
const TC = /^table\.(\d+)\.(\d+)$/;

/** A link's page without its host and store view ("https://www.apsoparts.com/de-CH/eur/x.html" -> "x.html"). */
export const pageOf = (u: string | null | undefined) => String(u ?? "").trim().replace(/^https?:\/\/[^/]+/i, "").replace(/^\/[a-z]{2}-[a-z]{2,3}(\/(eur|chf))?(?=\/|$)/i, "").replace(/^\/+/, "").replace(/[?#].*$/, "");
/** A picture's file, whatever cache folder or host it is drawn from. */
export const fileOf = (u: string | null | undefined) => String(u ?? "").replace(/[?#].*$/, "").split("/").filter(Boolean).pop() ?? "";
const sameFile = (a: string | null | undefined, b: string | null | undefined) => !!fileOf(a) && fileOf(a) === fileOf(b);
const samePage = (a: string | null | undefined, b: string | null | undefined) => !!pageOf(a) && pageOf(a) === pageOf(b);
const lines = (t: string) => t.split(/\n+/).map((x) => x.trim()).filter(Boolean);
/** Do the words shown hold these words as one of their lines? */
const holds = (shown: string, w: string) => !!wordsKey(w) && lines(shown).some((l) => sameWords(l, w));

/** The part of a module a click hit - null when it hit none of them on this element (the studio then looks at the element
 * around it, and the module's own ground is the whole block). */
export function partAt(m: ModuleRef, p: Probe): string | null {
  const s = m.settings;
  // an element a person added: its own class
  const ac = /\bam-x-([a-z0-9]+)\b/.exec(p.cls);
  if (ac && (s.adds ?? []).some((a) => a.id === ac[1])) return `add.${ac[1]}`;
  if (p.words && p.text.trim()) {
    if ((p.tag === "td" || p.tag === "th") && s.table.length) {
      for (let r = 0; r < s.table.length; r++) for (let c = 0; c < s.table[r].length; c++) if (sameWords(p.text, s.table[r][c])) return `table.${r}.${c}`;
    }
    const hit = moduleWordsAt(m, p.text, p.inLink ?? p.href);
    if (hit) return hit.field;
    // one paragraph of a longer line (words drawn as paragraphs)
    const t = wordsKey(p.text);
    if (t.length >= 20) {
      if (wordsKey(s.text).includes(t)) return "text";
      for (let i = 0; i < s.faq.length; i++) if (wordsKey(s.faq[i].a).includes(t)) return `faq.${i}.a`;
      for (let i = 0; i < s.points.length; i++) if (wordsKey(s.points[i].text).includes(t)) return `points.${i}.text`;
    }
    // words of the shop (a card's name) or a box of words (a point's line): what is around them says
  }
  // a picture: its own, a point's, a product's
  if (p.src) {
    if (s.feature?.img && sameFile(p.src, s.feature.img)) return "feature";
    for (let i = 0; i < s.points.length; i++) if (s.points[i].img && sameFile(p.src, s.points[i].img)) return `points.${i}`;
    for (let i = 0; i < s.items.length; i++) if (s.items[i].img && sameFile(p.src, s.items[i].img)) return `items.${i}`;
    return null;
  }
  // a card of the shop: the link to its page
  if (p.tag === "a" && p.href) {
    const i = s.items.findIndex((c) => samePage(p.href, c.url));
    if (i >= 0) return `items.${i}`;
    if (s.feature && samePage(p.href, s.feature.url) && p.srcs.some((x) => sameFile(x, s.feature!.img))) return "feature";
  }
  // the word between a campaign's dates ("bis", "to") - its own setting, the shop's word until it is given one
  if (p.words && /^(bis|au|al|to|until|tot|do)$/i.test(p.text.trim()) && moduleDef(m.type)?.fields.some((f) => f.kind === "extra" && f.key === "to")) return "extra.until";
  if (p.words && !/^(li|dd|dt|td|th)$/.test(p.tag)) return null;
  // a box of one card (its photo, its name, its number, its button - all to ONE product or category of it)
  if (p.hrefs.length && !holds(p.text, s.title)) {
    const at = new Set(p.hrefs.map((h) => s.items.findIndex((c) => samePage(h, c.url))));
    if (at.size === 1 && !at.has(-1)) return `items.${[...at][0]}`;
  }
  // a box around one point (its icon, its picture, its padding) or one question
  const ptHits = s.points.map((x, i) => (holds(p.text, x.title) ? i : -1)).filter((i) => i >= 0);
  if (ptHits.length === 1 && !holds(p.text, s.title)) return `points.${ptHits[0]}`;
  const qHits = s.faq.map((x, i) => (holds(p.text, x.q) ? i : -1)).filter((i) => i >= 0);
  if (qHits.length === 1 && !holds(p.text, s.title)) return `faq.${qHits[0]}`;
  // the box around its picture alone
  if (s.feature?.img && !p.text.trim() && p.srcs.length === 1 && sameFile(p.srcs[0], s.feature.img)) return "feature";
  return null;
}

/** What a part is, for its popup - null when the module has no such part (any more). */
export function partInfo(m: ModuleRef, part: string): PartInfo | null {
  const s = m.settings;
  const d = moduleDef(m.type);
  const label = moduleFieldLabel(m, part);
  const words = (kind: PartKind, w: string, max: number, multiline: boolean, tag: string): PartInfo => ({ part, kind, label, words: w, max, multiline, tag });
  if (part === "title" || part === "eyebrow" || part === "text") {
    const spec = d ? fieldOf(d, part) : undefined;
    const max = spec?.max ?? (part === "eyebrow" ? 40 : part === "title" ? 90 : 240);
    return words("words", s[part], max, part === "text" || (spec?.rows ?? 1) > 1, part === "title" ? "h2" : "p");
  }
  if (part === "link" || part === "link2") return { ...words("button", s[part].label, 60, false, "a"), url: s[part].url };
  const tw = /^words\.(\w+)$/.exec(part);
  if (tw) return { ...words("button", (tileWordsOf(s.store, s.extra) as Record<string, string>)[tw[1]] ?? "", 40, false, "a"), label };
  const pt = P.exec(part);
  if (pt) {
    const x = s.points[Number(pt[1])];
    if (!x) return null;
    if (!pt[2]) return { part, kind: "point", label: `${(d && fieldOf(d, "points")?.label) || "Point"} · ${Number(pt[1]) + 1}`, words: x.title, max: 80, multiline: false, tag: "li", ...(x.img ? { img: x.img } : {}), ...(x.url ? { url: x.url } : {}) };
    return words("words", x[pt[2] as "title" | "text"], pt[2] === "title" ? 80 : 240, pt[2] === "text", pt[2] === "title" ? "h3" : "p");
  }
  const fq = Q.exec(part);
  if (fq) {
    const x = s.faq[Number(fq[1])];
    if (!x) return null;
    if (!fq[2]) return { part, kind: "question", label: `Question ${Number(fq[1]) + 1}`, words: x.q, max: 300, multiline: false, tag: "summary" };
    return words("words", fq[2] === "q" ? x.q : x.a, fq[2] === "q" ? 300 : 1500, fq[2] === "a", fq[2] === "q" ? "summary" : "p");
  }
  const ex = /^extra\.([\w-]+)$/.exec(part);
  if (ex) {
    if (isLookKey(ex[1])) return null;
    const spec = d?.fields.find((f) => f.kind === "extra" && f.key === ex[1]) as { max?: number } | undefined;
    // the word between a campaign's dates says the shop's word until it is given one (./lib/campaigns.ts dated)
    const shown = s.extra[ex[1]] ?? (ex[1] === "until" ? ({ de: "bis", fr: "au", it: "al" } as Record<string, string>)[s.store.slice(0, 2)] ?? "to" : "");
    return words("words", shown, spec?.max ?? 20, false, "span");
  }
  const tc = TC.exec(part);
  if (tc) {
    const v = s.table[Number(tc[1])]?.[Number(tc[2])];
    return v === undefined ? null : { ...words("cell", v, 200, false, Number(tc[1]) === 0 ? "th" : "td") };
  }
  const it = IT.exec(part);
  if (it) {
    const c = s.items[Number(it[1])];
    return c ? { part, kind: "item", label: c.kind === "category" ? "A category from the shop" : "A product from the shop", words: c.name, max: 0, multiline: false, tag: "a", card: c, url: c.url, img: c.img } : null;
  }
  if (part === "feature") {
    const f = s.feature;
    return { part, kind: "picture", label: (d && fieldOf(d, "feature")?.label) || "Picture", words: f?.name ?? "", max: 0, multiline: false, tag: "img", img: f?.img ?? "" };
  }
  const ad = AD.exec(part);
  if (ad) {
    const a = (s.adds ?? []).find((x) => x.id === ad[1]);
    if (!a) return null;
    const n = (s.adds ?? []).filter((x) => x.kind === a.kind).indexOf(a);
    const name = `${ADD_NAME[a.kind]}${n > 0 ? ` ${n + 1}` : ""} · added`;
    if (a.kind === "picture") return { part, kind: "picture", label: name, words: a.text, max: ADD_MAX.picture, multiline: false, tag: "img", img: a.img };
    if (a.kind === "button") return { part, kind: "button", label: name, words: a.text, max: ADD_MAX.button, multiline: false, tag: "a", url: a.url };
    return { part, kind: "words", label: name, words: a.text, max: ADD_MAX[a.kind], multiline: a.kind === "text", tag: a.kind === "title" ? "h3" : "p" };
  }
  return null;
}

/** The module with a part's words changed (null: the part cannot take them - empty words, a part not there). */
export function withPartWords(m: ModuleRef, part: string, value: string): ModuleRef | null {
  const s = m.settings;
  const ex = /^extra\.([\w-]+)$/.exec(part);
  // a date, a badge's words: emptied, it is not drawn (it may be typed again)
  if (ex && !isLookKey(ex[1])) { const extra = { ...s.extra }; const v = value.replace(/\s+/g, " ").trim(); if (v) extra[ex[1]] = v.slice(0, 600); else delete extra[ex[1]]; return { ...m, settings: { ...s, extra } }; }
  const ad = AD.exec(part);
  if (ad) {
    const a = (s.adds ?? []).find((x) => x.id === ad[1]);
    if (!a) return null;
    return { ...m, settings: { ...s, adds: (s.adds ?? []).map((x) => (x === a ? { ...x, text: value.slice(0, ADD_MAX[a.kind]) } : x)) } };
  }
  return moduleFieldEdit(m, part, value);
}

/** A button's page set (its own button, the second one, an added one). */
export function withPartUrl(m: ModuleRef, part: string, url: string): ModuleRef | null {
  const s = m.settings;
  const u = shopAddress(url);
  if (part === "link" || part === "link2") return { ...m, settings: { ...s, [part]: { ...s[part], url: u } } };
  const pt = P.exec(part);
  if (pt && s.points[Number(pt[1])]) return { ...m, settings: { ...s, points: s.points.map((x, i) => { if (i !== Number(pt[1])) return x; const { url: _u, ...rest } = x; return u ? { ...rest, url: u } : rest; }) } };
  const ad = AD.exec(part);
  if (ad && (s.adds ?? []).some((x) => x.id === ad[1] && x.kind === "button")) return { ...m, settings: { ...s, adds: (s.adds ?? []).map((x) => (x.id === ad[1] ? { ...x, url: u } : x)) } };
  return null;
}

/** A picture put in a part (its picture, a point's, an added one) - `from`: the person's own pick, it stays. */
export function withPartPicture(m: ModuleRef, part: string, pic: { url: string; alt?: string; name?: string | null; product?: { number: string; url: string } | null }): ModuleRef | null {
  const s = m.settings;
  const img = pictureAddress(pic.url);
  // a product's photo (the "Products" tab): the whole product on the card - its name, number and page with its photo
  if (pic.product && (part === "feature" || IT.test(part))) {
    const card = cardOfProduct({ name: pic.name || pic.alt, number: pic.product.number, url: pic.product.url, img: pic.url });
    if (card) return withCard(m, part, card);
  }
  if (part === "feature") {
    if (!img) return { ...m, settings: { ...s, feature: null } };
    const was = s.feature;
    const store = s.store.split("/")[0] || "de-CH";
    const card: Card = { kind: was?.kind ?? "category", name: was?.name || pic.alt?.slice(0, 200) || s.title.replace(/==/g, "").slice(0, 200) || "Bild", url: was?.url || s.link.url || `https://www.apsoparts.com/${store}/`, img, meta: was?.meta ?? "", number: was?.number ?? "", children: was?.children ?? [], from: "person" };
    return { ...m, settings: { ...s, feature: card } };
  }
  const pt = P.exec(part);
  if (pt && s.points[Number(pt[1])]) return { ...m, settings: { ...s, points: s.points.map((x, i) => { if (i !== Number(pt[1])) return x; const { img: _i, ...rest } = x; return img ? { ...rest, img } : rest; }) } };
  const ad = AD.exec(part);
  if (ad && (s.adds ?? []).some((x) => x.id === ad[1] && x.kind === "picture")) return { ...m, settings: { ...s, adds: (s.adds ?? []).map((x) => (x.id === ad[1] ? { ...x, img, ...(pic.alt !== undefined ? { text: pic.alt.slice(0, ADD_MAX.picture) } : {}) } : x)) } };
  return null;
}

/** A part's look key in the module's settings (its words' or its button's) - an added one keeps its own in itself. */
export function partLookKey(part: string): string | null {
  if (part in TEXT_LOOK_KEY) return TEXT_LOOK_KEY[part as keyof typeof TEXT_LOOK_KEY];
  if (part in BUTTON_LOOK_KEY) return BUTTON_LOOK_KEY[part as keyof typeof BUTTON_LOOK_KEY];
  return null;
}
/** A part's look as kept (packed) - "" when it has none or cannot have one. */
export function partLook(m: ModuleRef, part: string): string {
  const k = partLookKey(part);
  if (k) return m.settings.extra[k] ?? "";
  const ad = AD.exec(part);
  return ad ? (m.settings.adds ?? []).find((x) => x.id === ad[1])?.look ?? "" : "";
}
/** The module with a part's look set (packed, "" = the module's own again). */
export function withPartLook(m: ModuleRef, part: string, packed: string): ModuleRef | null {
  const s = m.settings;
  const k = partLookKey(part);
  if (k) { const extra = { ...s.extra }; if (packed) extra[k] = packed; else delete extra[k]; return { ...m, settings: { ...s, extra } }; }
  const ad = AD.exec(part);
  if (ad && (s.adds ?? []).some((x) => x.id === ad[1])) return { ...m, settings: { ...s, adds: (s.adds ?? []).map((x) => (x.id === ad[1] ? { ...x, look: packed.slice(0, 160) } : x)) } };
  return null;
}
/** Can this part take a look (colour, size... of its words; style, colour... of its button)? */
export function lookKind(m: ModuleRef, part: string): "text" | "button" | null {
  if (part === "title" || part === "eyebrow" || part === "text") return "text";
  if (part === "link" || part === "link2") return "button";
  const ad = AD.exec(part);
  const a = ad ? (m.settings.adds ?? []).find((x) => x.id === ad[1]) : null;
  return a ? (a.kind === "button" ? "button" : a.kind === "picture" ? null : "text") : null;
}

/* ── taken out ────────────────────────────────────────────────────────── */

/** "Take it out" on a part: its words ("Take the button out") and the module without it - null where nothing may go (a
 * module's headline when it stands on it, the tiles' button: the shop's words come back). */
export function takeOutPart(m: ModuleRef, part: string): { label: string; done: string; module: ModuleRef } | null {
  const s = m.settings;
  const name = moduleDef(m.type)?.name.toLowerCase() ?? "module";
  const set = (settings: ModuleSettings) => ({ ...m, settings });
  if (part === "title") {
    if (!s.title.trim() || moduleDef(m.type)?.needs.includes("text")) return null;
    return { label: "Take the headline out", done: `Took the ${name}'s headline out`, module: set({ ...s, title: "" }) };
  }
  const it = IT.exec(part);
  if (it) {
    const i = Number(it[1]);
    const c = s.items[i];
    if (!c) return null;
    return { label: `Take this ${c.kind === "category" ? "category" : "product"} out`, done: `Took ${c.name} out of the ${name}`, module: set({ ...s, items: s.items.filter((_, k) => k !== i), fill: s.fill ? { ...s.fill, how: "hand" } : null }) };
  }
  if (part === "feature") return s.feature ? { label: "Take the picture out", done: `Took the ${name}'s picture out`, module: set({ ...s, feature: null }) } : null;
  const ad = AD.exec(part);
  if (ad) {
    const a = (s.adds ?? []).find((x) => x.id === ad[1]);
    if (!a) return null;
    const adds = (s.adds ?? []).filter((x) => x !== a);
    const { adds: _gone, ...rest } = s;
    const what = ADD_NAME[a.kind].toLowerCase();
    return { label: `Take the ${what} out`, done: `Took a ${what} out of the ${name}`, module: set(adds.length ? { ...rest, adds } : rest) };
  }
  const tc = TC.exec(part);
  if (tc) {
    const r = Number(tc[1]);
    if (r === 0 || !s.table[r]) return null;
    return { label: "Take the row out", done: `Took a row of the ${name}'s table out`, module: set({ ...s, table: s.table.filter((_, i) => i !== r) }) };
  }
  if (/^words\./.test(part)) return null;
  return takeOutOfModule(m, part);
}

/* ── added ────────────────────────────────────────────────────────────── */

/** What a new element says until it is written over (its popup opens on it at once) - never a promise, never a price. */
const NEW_WORDS: Record<string, { text: string; title: string; eyebrow: string; point: string; q: string; a: string }> = {
  de: { text: "Ihr Text", title: "Ihr Titel", eyebrow: "Thema", point: "Neuer Punkt", q: "Neue Frage?", a: "Die Antwort." },
  fr: { text: "Votre texte", title: "Votre titre", eyebrow: "Thème", point: "Nouveau point", q: "Nouvelle question ?", a: "La réponse." },
  it: { text: "Il vostro testo", title: "Il vostro titolo", eyebrow: "Tema", point: "Nuovo punto", q: "Nuova domanda?", a: "La risposta." },
  en: { text: "Your text", title: "Your headline", eyebrow: "Topic", point: "New point", q: "New question?", a: "The answer." },
};
export const newWordsFor = (store: string) => NEW_WORDS[String(store).slice(0, 2).toLowerCase()] ?? NEW_WORDS.en;

export type AddKey = AddKind | "point" | "question" | "row" | `extra.${string}`;
export type AddOption = { key: AddKey; label: string };

/** A list's item named as the module names it ("tile", "teaser", "step") - "point" when it says nothing. */
function itemWord(label: string | undefined): string {
  const l = String(label ?? "").toLowerCase();
  const w = [["tile", "tile"], ["teaser", "teaser"], ["banner", "banner"], ["step", "step"], ["logo", "logo"], ["quote", "quote"], ["figure", "figure"], ["number", "figure"], ["promise", "promise"], ["reason", "reason"], ["card", "card"]].find(([k]) => l.includes(k));
  return w ? w[1] : "point";
}

/** What can be added inside this module now: a button (a third, a fourth...), a line, a small line above, a headline, a
 * point / tile / question where it has a list, a picture where it takes one, its own settings still empty (a date). */
export function addOptions(m: ModuleRef): AddOption[] {
  const d = moduleDef(m.type);
  if (!d) return [];
  const s = m.settings;
  const room = (s.adds ?? []).length < ADDS_MAX;
  const free = (k: "text" | "eyebrow" | "title") => hasField(d, k) && !s[k].trim();
  const out: AddOption[] = [];
  // a button of its own the module does not draw yet (no words, or no page) is free
  const linkFree = (hasField(d, "link") && !(s.link.label.trim() && s.link.url)) || (hasField(d, "link2") && !(s.link2.label.trim() && s.link2.url));
  if (linkFree || room) out.push({ key: "button", label: "A button" });
  if (free("text") || room) out.push({ key: "text", label: "A line of text" });
  if (free("eyebrow") || room) out.push({ key: "eyebrow", label: "A small line above" });
  if (free("title") || room) out.push({ key: "title", label: "A headline" });
  const pts = fieldOf(d, "points");
  if (pts && s.points.length < (pts.max ?? 12)) out.push({ key: "point", label: `A ${itemWord(pts.label)}` });
  const faq = fieldOf(d, "faq");
  if (faq && s.faq.length < (faq.max ?? 12)) out.push({ key: "question", label: "A question" });
  const tbl = fieldOf(d, "table");
  if (tbl && s.table.length && s.table.length < (tbl.maxRows ?? 12)) out.push({ key: "row", label: "A row of the table" });
  if (hasField(d, "feature") && !s.feature?.img) out.push({ key: "picture", label: "A picture" });
  else if (room && !hasField(d, "feature")) out.push({ key: "picture", label: "A picture" });
  for (const f of d.fields) {
    if (f.kind !== "extra" || f.options || isLookKey(f.key) || (s.extra[f.key] ?? "").trim()) continue;
    out.push({ key: `extra.${f.key}`, label: f.label });
  }
  return out;
}

/** The page a new button goes to until it is given its own: the module's own button's, its first card's, the shop's home. */
function defaultUrl(s: ModuleSettings): string {
  const store = s.store.split("/")[0] || "de-CH";
  return s.link.url || s.link2.url || s.items[0]?.url || s.feature?.url || `https://www.apsoparts.com/${store}/`;
}

/**
 * The module with one element added - and the part to select (its popup opens on it at once). A free setting the module
 * draws in its own place takes it first (its empty button, line, headline); else it is added inside (./adds.ts). A picture
 * where the module takes one comes back as `pick`: the studio asks which picture first.
 */
export function addPart(m: ModuleRef, key: AddKey): { module: ModuleRef; part: string } | { pick: "feature" | "add" } | null {
  const d = moduleDef(m.type);
  if (!d) return null;
  const s = m.settings;
  const w = newWordsFor(s.store);
  const set = (settings: ModuleSettings) => ({ ...m, settings });
  const adds = s.adds ?? [];
  const add = (a: Omit<Added, "id">): { module: ModuleRef; part: string } | null => {
    if (adds.length >= ADDS_MAX) return null;
    const id = addId();
    return { module: set({ ...s, adds: [...adds, { id, ...a }] }), part: `add.${id}` };
  };
  if (key === "button") {
    const label = wordsFor(s.store).more;
    if (hasField(d, "link") && !(s.link.label.trim() && s.link.url)) return { module: set({ ...s, link: { label: s.link.label.trim() || label, url: s.link.url || defaultUrl(s) } }), part: "link" };
    if (hasField(d, "link2") && !(s.link2.label.trim() && s.link2.url)) return { module: set({ ...s, link2: { label: s.link2.label.trim() || label, url: s.link2.url || defaultUrl(s) } }), part: "link2" };
    // a third, a fourth: outlined beside the module's own (filled when it has none drawn)
    const hasOwn = !!(s.link.label.trim() && s.link.url) || !!(s.link2.label.trim() && s.link2.url) || adds.some((a) => a.kind === "button");
    return add({ kind: "button", text: label, url: defaultUrl(s), img: "", look: hasOwn ? packLook({ style: "outline" }) : "" });
  }
  if (key === "text" || key === "eyebrow" || key === "title") {
    if (hasField(d, key) && !s[key].trim()) return { module: set({ ...s, [key]: w[key] }), part: key };
    return add({ kind: key, text: w[key], url: "", img: "", look: "" });
  }
  if (key === "point") {
    const spec = fieldOf(d, "points");
    if (!spec || s.points.length >= (spec.max ?? 12)) return null;
    return { module: set({ ...s, points: [...s.points, { title: w.point, text: "", icon: "check" }] }), part: `points.${s.points.length}.title` };
  }
  if (key === "question") {
    const spec = fieldOf(d, "faq");
    if (!spec || s.faq.length >= (spec.max ?? 12)) return null;
    return { module: set({ ...s, faq: [...s.faq, { q: w.q, a: w.a }] }), part: `faq.${s.faq.length}.q` };
  }
  if (key === "row") {
    const spec = fieldOf(d, "table");
    const cols = Math.max(1, s.table[0]?.length ?? spec?.cols ?? 2);
    if (!spec || s.table.length >= (spec.maxRows ?? 12)) return null;
    return { module: set({ ...s, table: [...s.table, Array.from({ length: cols }, (_, i) => (i === 0 ? "–" : ""))] }), part: `table.${s.table.length}.0` };
  }
  if (key === "picture") return hasField(d, "feature") ? { pick: "feature" } : adds.length < ADDS_MAX ? { pick: "add" } : null;
  const ex = /^extra\.([\w-]+)$/.exec(key);
  if (ex && d.fields.some((f) => f.kind === "extra" && f.key === ex[1])) return { module: m, part: key };
  return null;
}

/** An added picture, once it is chosen. */
export function addPicture(m: ModuleRef, pic: { url: string; alt?: string }): { module: ModuleRef; part: string } | null {
  const img = pictureAddress(pic.url);
  const adds = m.settings.adds ?? [];
  if (!img || adds.length >= ADDS_MAX) return null;
  const id = addId();
  return { module: { ...m, settings: { ...m.settings, adds: [...adds, { id, kind: "picture", text: (pic.alt ?? "").slice(0, ADD_MAX.picture), url: "", img, look: "" }] } }, part: `add.${id}` };
}

/* ── the block's popup: what is in it ─────────────────────────────────── */

/** Every element of the module that shows now, in the order it is drawn roughly - the block popup lists them (a click
 * selects it in the page and opens its own popup). */
export function partsOf(m: ModuleRef): PartInfo[] {
  const d = moduleDef(m.type);
  if (!d) return [];
  const s = m.settings;
  const parts: string[] = [];
  for (const f of d.fields) {
    if (f.kind === "eyebrow" || f.kind === "title" || f.kind === "text") { if (s[f.kind].trim()) parts.push(f.kind); continue; }
    if (f.kind === "link" || f.kind === "link2") { if (s[f.kind].label.trim()) parts.push(f.kind); continue; }
    if (f.kind === "feature") { if (s.feature?.img) parts.push("feature"); continue; }
    if (f.kind === "points") { s.points.forEach((_, i) => parts.push(`points.${i}`)); continue; }
    if (f.kind === "faq") { s.faq.forEach((_, i) => parts.push(`faq.${i}`)); continue; }
    if (f.kind === "extra" && !f.options && !isLookKey(f.key) && (s.extra[f.key] ?? "").trim()) parts.push(`extra.${f.key}`);
  }
  for (const a of s.adds ?? []) parts.push(`add.${a.id}`);
  return parts.map((p) => partInfo(m, p)).filter((x): x is PartInfo => !!x);
}

/* ── one card, one product (Content v13, part 6) ──────────────────────── */
//
// SARCLA 11.11.2026 ~09:20 (screenshot 27, two product cards of a duo): "here the picture is not correct and links have
// not updated when I select the specific product". A card is the shop's product as a whole - its number, name, count,
// page and photo come together. Whatever way a person puts one product on a card (by number in the block's settings, the
// "Products" tab of a picture, "Pick another product" on a card), the whole card is replaced, never its photo alone.

/** A product of the shop as a card (what the shop's search, the products' pictures or a number lookup gave) - null when
 * it is not one (no name, no page of the shop). */
export function cardOfProduct(p: { name?: unknown; number?: unknown; url?: unknown; img?: unknown; meta?: unknown }): Card | null {
  const name = typeof p.name === "string" ? p.name.trim().slice(0, 200) : "";
  const url = shopAddress(p.url);
  if (!name || !url) return null;
  const number = /^\d{8}$/.test(String(p.number ?? "")) ? String(p.number) : "";
  return { kind: "product", name, url, img: pictureAddress(p.img), meta: typeof p.meta === "string" ? p.meta.trim().slice(0, 60) : "", number, children: [] };
}

/** The module with ONE card replaced by another product, whole: a product or category card of its items ("items.<i>"), or
 * its picture's card ("feature" - the person's pick: it stays when the other products change). */
export function withCard(m: ModuleRef, part: string, card: Card): ModuleRef | null {
  const s = m.settings;
  const it = IT.exec(part);
  if (it) {
    const i = Number(it[1]);
    if (!s.items[i]) return null;
    return { ...m, settings: { ...s, items: s.items.map((c, k) => (k === i ? { ...card, children: card.children ?? [] } : c)), fill: s.fill ? { ...s.fill, how: "hand" } : null } };
  }
  if (part === "feature") return { ...m, settings: { ...s, feature: { ...card, from: "person" } } };
  return null;
}
