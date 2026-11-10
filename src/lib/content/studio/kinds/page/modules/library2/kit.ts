// PAGE - THE LIBRARY, PART 2: what its modules share on top of the library's kit (Content v7, 10.11.2026). Pure:
// tests/studio-page-library2.test.ts.
//
// SARCLA 10.11.2026, point 1: "create more than 100 modules subdivided by categories, really high end". Builder B draws the
// first ~55 (heroes, product showcases, bentos, category navigation, campaigns, trust) and the registry; this part draws
// ~55 more in eight categories: Content & stories, Technical & comparison, Tools & services, Help & FAQ, Calls to action &
// sign-ups, Industries & applications, References & brands, Media.
//
// The library's rules (../kit.ts, ../registry.ts): ONE element <div class="apx-<id>"> with its own <style>, every rule
// under .apx-<id> (inner classes am-*), explicit colours and futura-pt, the shop's container (1170 px, 10 px gutters),
// finished at 375 / 1024 / 1440, CSS-only interactions (hover, focus, <details>, radio tabs, :has(), scroll-snap), at most
// 20 KB, never a price, a discount, stock or an invented fact. A module whose slots are still empty draws them as dashed
// placeholders that say what fills them - visible at once, never nothing.

import { BUTTONS, esc, href as kitHref, langOf, marked, sharpImg } from "../kit";
import type { Card, Drawn, FieldSpec, ModuleDef, ModuleSettings, Need, Opts, Takes, CategoryId } from "../types";

export { BUTTONS, button, esc, header, icon, langOf, marked, nameOf, wordsFor } from "../kit";
export type { Card, Drawn, ModuleSettings, Opts } from "../types";

/* ── the interface words this part adds (in the store view's language) ── */

type W = {
  more: string; all: string; open: string; watch: string; download: string; search: string; searchHint: string; popular: string;
  step: string; contents: string; readMore: string; tool: string; vs: string; question: string; answer: string;
};
const WORDS: Record<string, W> = {
  de: { more: "Mehr erfahren", all: "Alle anzeigen", open: "Öffnen", watch: "Video ansehen", download: "Herunterladen", search: "Suchen", searchHint: "Produkt, Werkstoff, Artikelnummer …", popular: "Häufig gesucht", step: "Schritt", contents: "Inhalt", readMore: "Weiterlesen", tool: "Zum Tool", vs: "vs", question: "Frage", answer: "Antwort" },
  fr: { more: "En savoir plus", all: "Tout afficher", open: "Ouvrir", watch: "Voir la vidéo", download: "Télécharger", search: "Rechercher", searchHint: "Produit, matériau, numéro d'article …", popular: "Recherches fréquentes", step: "Étape", contents: "Sommaire", readMore: "Lire la suite", tool: "Vers l'outil", vs: "vs", question: "Question", answer: "Réponse" },
  it: { more: "Scopri di più", all: "Mostra tutto", open: "Apri", watch: "Guarda il video", download: "Scarica", search: "Cerca", searchHint: "Prodotto, materiale, numero articolo …", popular: "Ricerche frequenti", step: "Passo", contents: "Indice", readMore: "Continua a leggere", tool: "Vai allo strumento", vs: "vs", question: "Domanda", answer: "Risposta" },
  en: { more: "Learn more", all: "View all", open: "Open", watch: "Watch the video", download: "Download", search: "Search", searchHint: "Product, material, article number …", popular: "Popular searches", step: "Step", contents: "Contents", readMore: "Read more", tool: "Open the tool", vs: "vs", question: "Question", answer: "Answer" },
  nl: { more: "Meer weten", all: "Alles tonen", open: "Openen", watch: "Video bekijken", download: "Downloaden", search: "Zoeken", searchHint: "Product, materiaal, artikelnummer …", popular: "Veel gezocht", step: "Stap", contents: "Inhoud", readMore: "Verder lezen", tool: "Naar de tool", vs: "vs", question: "Vraag", answer: "Antwoord" },
  pl: { more: "Dowiedz się więcej", all: "Pokaż wszystkie", open: "Otwórz", watch: "Obejrzyj wideo", download: "Pobierz", search: "Szukaj", searchHint: "Produkt, materiał, numer artykułu …", popular: "Często wyszukiwane", step: "Krok", contents: "Spis treści", readMore: "Czytaj dalej", tool: "Do narzędzia", vs: "vs", question: "Pytanie", answer: "Odpowiedź" },
};
export const w2 = (store: string): W => WORDS[langOf(store)] ?? WORDS.en;

/* ── addresses and pictures ────────────────────────────────────────────── */

/** A link: the shop (written from the page's own host, the EUR store view kept - ../kit.ts href), the shop's brochure files
 * (campaigns.apsoparts.com/hubfs), an anchor in the module; anything else "#" - never a stranger's address. */
export function link(u: string): string {
  const s = String(u ?? "").trim();
  if (/^https:\/\/campaigns\.apsoparts\.com\/hubfs\/[^\s"'<>]+$/i.test(s)) return esc(s);
  if (/^#[\w-]{1,60}$/.test(s)) return s;
  if (/^https:\/\/(www|acc)\.apsoparts\.com(\/[^\s"'<>]*)?$/i.test(s) || /^\/[^/\s"'<>][^\s"'<>]*$/.test(s)) return kitHref(s);
  return "#";
}

/** A picture's <img>: the shop's media or the hub's picture store only; a product's the sharp 500 px one. */
export function img(u: string | undefined, o: Opts, opt: { lazy?: boolean; alt?: string; product?: boolean } = {}): string {
  const s = String(u ?? "").trim();
  if (!/^https:\/\/(www|acc)\.apsoparts\.com\/media\/[^\s"'<>]+$/i.test(s) && !/^\/api\/content\/picture\/[\w-]+$/.test(s)) return "";
  const src = opt.product ? sharpImg(s) : s;
  return `<img src="${esc(o.picture ? o.picture(src) : src)}" alt="${esc(opt.alt ?? "")}"${opt.lazy === false ? "" : ' loading="lazy"'}>`;
}
export const cardImg = (c: Card, o: Opts, lazy = true) => img(c.img, o, { lazy, product: c.kind === "product", alt: c.name });

/** Plain words as HTML: a blank line = a new paragraph, "## " = a small heading, lines starting "- " = a list (a list line
 * "Word: rest" shows the word bold). ==word== = red. */
export function prose(t: string): string {
  return String(t ?? "").replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/).filter(Boolean).map((b) => {
    const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 1 && /^##\s+/.test(lines[0])) return `<h3 class="am-p3">${marked(lines[0].replace(/^##\s+/, ""))}</h3>`;
    if (lines.length && lines.every((l) => /^[-•–]\s+/.test(l))) {
      return `<ul class="am-li">${lines.map((l) => {
        const x = l.replace(/^[-•–]\s+/, "");
        const m = /^([^:]{1,32}):\s+(.+)$/.exec(x);
        return `<li>${m ? `<b>${marked(m[1])}:</b> ${marked(m[2])}` : marked(x)}</li>`;
      }).join("")}</ul>`;
    }
    return `<p>${lines.map(marked).join("<br>")}</p>`;
  }).join("");
}
/** The lines of a text ("- " marks dropped). */
export const linesOf = (t: string) => String(t ?? "").replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim().replace(/^[-•–]\s+/, "")).filter(Boolean);
/** "Word: rest" split (a list line). */
export const pairOf = (l: string) => { const m = /^([^:]{1,40}):\s*(.*)$/.exec(l); return m ? { k: m[1].trim(), v: m[2].trim() } : { k: "", v: l }; };

/* ── the shared CSS (rules under @@; the registry adds the kit's BASE) ─── */

/** What this part's modules need beyond the kit's BASE: resets for tables and lists of terms, the petrol text link. */
const EXTRA = `
@@{--soft:#f3f5f6;--card:0 12px 30px -22px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2}
@@ :is(h4,dl,dt,dd,table,caption,form,fieldset){margin:0!important;padding:0;border:0}
@@ h4{font-family:var(--head)!important;font-weight:600!important;color:var(--ink)!important;text-transform:none}
@@ table{border-collapse:collapse;border-spacing:0;width:100%}
@@ :is(th,td){padding:0;text-align:left;vertical-align:top;font-weight:inherit}
@@ .am-lk{display:inline-flex;align-items:center;gap:8px;font:600 14.5px/1.2 var(--head);color:var(--pet)!important}
@@ .am-lk::after{content:"";flex:none;width:7px;height:7px;border:solid currentColor;border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-lk:hover::after,@@ a:hover>.am-lk::after{transform:translateX(3px) rotate(45deg)}
@@ .am-p3{margin:18px 0 6px!important;font-size:18px!important;line-height:1.3!important}
@@ .am-bs{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
`;
/** A list with the shop's small red squares (prose's "- " lines). */
const LI = `
@@ .am-li{display:grid;gap:7px}
@@ .am-li li{position:relative;padding-left:20px}
@@ .am-li li::before{content:"";position:absolute;left:2px;top:.62em;width:7px;height:7px;border-radius:2px;background:var(--red)}
@@ .am-li b{color:var(--ink);font-weight:700}
`;
/** The placeholder an empty slot shows: visible at once, saying what fills it. */
const PH = `
@@ .am-ph{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:110px;padding:16px;border:2px dashed #c4ccd2;border-radius:16px;
  background:repeating-linear-gradient(135deg,#f7f9fa 0 12px,#f1f4f6 12px 24px);color:#6c757b;font:600 13.5px/1.3 var(--head);text-align:center}
@@ .am-ph::before{content:"";flex:none;width:22px;height:22px;border-radius:6px;border:2px solid #b3bcc2;background:linear-gradient(#b3bcc2,#b3bcc2) center/10px 2px no-repeat,linear-gradient(#b3bcc2,#b3bcc2) center/2px 10px no-repeat}
`;
/** A placeholder slot (the editor's words: English, like the hub). */
export const ph = (hint: string, cls = "") => `<div class="am-ph${cls ? ` ${cls}` : ""}">${esc(hint)}</div>`;

/** The module's own CSS with what its HTML uses from the shared pieces (buttons, lists, placeholders). */
export function own(d: Drawn): Drawn {
  // "O-Ring", "X-Ringe", "E-Mail" never break at their hyphen
  const h = d.html.replace(/(^|[^\w/.\-])([A-Z])-(?=[A-ZÄÖÜ][a-zäöü])/g, "$1$2‑");
  const add = [
    EXTRA,
    /class="am-btn2?[" ]/.test(h) ? BUTTONS : "",
    h.includes('class="am-li"') ? LI : "",
    h.includes('class="am-ph') ? PH : "",
  ].join("");
  return { html: h, css: `${add}${d.css}` };
}

/* ── a module of this part, as the registry takes it ───────────────────── */

export type Spec = {
  id: string;
  category: CategoryId;
  name: string;
  note: string;
  needs?: Need[];
  takes?: Takes;
  min?: number;
  max?: number;
  kids?: "products" | "subs";
  layouts: { key: string; label: string }[];
  fields: FieldSpec[];
  defaults?: (store: string) => Partial<ModuleSettings>;
  /** what still keeps it off a page ("" = ready) */
  gap?: (s: ModuleSettings) => string;
  draw: (s: ModuleSettings, o: Opts) => Drawn;
  tags?: string[];
  from?: string;
};

/** A module of the library (../types.ts ModuleDef) from its spec: drawn with this part's shared pieces. */
export function def(x: Spec): ModuleDef {
  return {
    id: x.id, category: x.category, name: x.name, note: x.note, needs: x.needs ?? [], takes: x.takes ?? "none",
    min: x.min ?? 0, max: x.max ?? 0, kids: x.kids, layouts: x.layouts, fields: x.fields, tags: x.tags, from: x.from,
    // every address of the defaults in the store view's own path (written for de-CH)
    defaults: x.defaults ? (store) => localize(store, x.defaults!(store)) : undefined,
    gap: x.gap ? (m) => x.gap!(m.settings) : undefined,
    render: (m, o) => own(x.draw(m.settings, o)),
  };
}

/* ── defaults: the shop's own words for German store views ─────────────── */

/** Settings with every shop address moved to the store view's path. */
function localize(store: string, d: Partial<ModuleSettings>): Partial<ModuleSettings> {
  const u = (x: string) => pathFor(store, x);
  const c = (k: Card): Card => ({ ...k, url: u(k.url), children: k.children.map(c) });
  return {
    ...d,
    ...(d.link ? { link: { ...d.link, url: u(d.link.url) } } : {}),
    ...(d.link2 ? { link2: { ...d.link2, url: u(d.link2.url) } } : {}),
    ...(d.points ? { points: d.points.map((p) => (p.url ? { ...p, url: u(p.url) } : p)) } : {}),
    ...(d.items ? { items: d.items.map(c) } : {}),
    ...(d.feature ? { feature: c(d.feature) } : {}),
  };
}

/** A store view's own path for a shop path written for de-CH ("/de-CH/service" -> "/fr-CH/service"). The tools' and help
 * pages have the same address in every store view; category addresses are German words and stay with German stores. */
export const pathFor = (store: string, p: string) => {
  const sv = String(store || "de-CH").split("/")[0];
  return /^[a-z]{2}-[A-Z]{2,3}$/.test(sv) ? p.replace(/^(https:\/\/www\.apsoparts\.com)?\/de-CH\//, `$1/${sv}/`) : p;
};
export const isGerman = (store: string) => langOf(store) === "de";
/** A card with its addresses moved to the store view. */
export const cardFor = (store: string, c: Card): Card => ({ ...c, url: pathFor(store, c.url), children: c.children.map((k) => cardFor(store, k)) });

/** A card the shop shows. */
export const mk = (kind: Card["kind"], name: string, url: string, im = "", meta = "", children: Card[] = [], number = ""): Card =>
  ({ kind, name, url, img: im, meta, number, children });

/** A common gap: the words or the parts a module still needs ("" = ready). */
export function needGap(s: ModuleSettings, need: { title?: boolean; text?: boolean; items?: number; points?: number; faq?: number; table?: number; feature?: boolean }): string {
  if (need.title && !s.title.trim()) return "Give it a headline";
  if (need.text && !s.text.trim()) return "Write its words";
  if (need.items && s.items.length < need.items) return `Add at least ${need.items} item${need.items > 1 ? "s" : ""}`;
  if (need.points && s.points.filter((p) => p.title.trim()).length < need.points) return `Write at least ${need.points} point${need.points > 1 ? "s" : ""}`;
  if (need.faq && s.faq.filter((x) => x.q.trim() && x.a.trim()).length < need.faq) return need.faq > 1 ? `Write at least ${need.faq} questions with their answers` : "Write a question and its answer";
  if (need.table && s.table.filter((r) => r.some((c) => c.trim())).length < need.table) return "Fill its table";
  if (need.feature && !s.feature?.img) return "Pick its picture";
  return "";
}

/** The table's rows without empty ones; the head is the first. */
export const rowsOf = (s: ModuleSettings) => s.table.filter((r) => r.some((c) => String(c ?? "").trim()));

/** The small line above a title. */
export const eyOf = (s: ModuleSettings) => (s.eyebrow.trim() ? `<p class="am-ey">${esc(s.eyebrow.trim())}</p>` : "");
/** A module's picture in a frame (a product's on white), or its placeholder. */
export const figureOf = (c: Card | null, o: Opts, cls: string, hint: string, lazy = true) =>
  c?.img ? `<figure class="${cls}${c.kind === "product" ? " is-prod" : ""}">${cardImg(c, o, lazy)}</figure>` : ph(hint, cls);
/** A text link with its arrow, or "". */
export const textLink = (l: { label: string; url: string }, cls = "") => (l.label.trim() && l.url ? `<a class="am-lk${cls ? ` ${cls}` : ""}" href="${link(l.url)}">${esc(l.label.trim())}</a>` : "");
