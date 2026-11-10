// PAGE - THE LIBRARY, PART 2: the shared kit of its modules (Content v7, 10.11.2026). Pure: tests/studio-page-library2.test.ts.
//
// SARCLA 10.11.2026, point 1: "create more than 100 modules subdivided by categories, really high end". Builder B draws the
// first ~55 (heroes, product showcases, bentos, category navigation, campaigns, trust); this part draws ~55 more in eight
// categories: Content & stories, Technical & comparison, Tools & services, Help & FAQ, Calls to action & sign-ups, Industries
// & applications, References & brands, Media.
//
// The same rules as the v6 modules (./render.ts), at the home page kit's measures: ONE element <div class="apx-<id>"> with
// its own <style>, every rule under .apx-<id> (inner classes am-*), explicit colours and futura-pt, the shop's container
// (1170 px, 10 px gutters), finished at 375 / 1024 / 1440, CSS-only interactions (hover, focus, <details>, radio tabs,
// :has()), at most 20 KB, never a price, a discount, stock or an invented fact. A module's settings are the v6 shape
// (../model.ts ModuleSettings): eyebrow, title, text, link, link2, layout, items (the shop's cards), feature (its picture),
// points (title, text, icon), faq (q, a) - each module says what it reads from them (`uses`).

import type { Card, ModuleSettings } from "../model";

export type Opts = {
  /** a picture's address as it is written - the preview makes the hub's own absolute, the hand-over names Magento's media */
  picture?: (url: string) => string;
};

/** What a module needs before it can show (the gallery's filter, the AI's choice). */
export type L2Need = "products" | "categories" | "picture" | "text";

/** What a module reads from the v6 settings, in the words its panel shows. */
export type L2Uses = {
  fields: ("eyebrow" | "title" | "text" | "link" | "link2")[];
  /** its cards: the shop's products / categories, or pictures (a card's photo + name + link), or links (a card's name + link) */
  items?: { takes: "products" | "categories" | "pictures" | "links"; min: number; max: number; label: string };
  /** its points: title + text (+ icon) */
  points?: { min: number; max: number; label: string; title: string; text: string; icon?: boolean };
  /** its pairs: q + a */
  faq?: { min: number; max: number; label: string; q: string; a: string };
  /** its one picture */
  feature?: string;
};

export type L2Category =
  | "Content & stories" | "Technical & comparison" | "Tools & services" | "Help & FAQ"
  | "Calls to action & sign-ups" | "Industries & applications" | "References & brands" | "Media";

export const L2_CATEGORIES: L2Category[] = [
  "Content & stories", "Technical & comparison", "Tools & services", "Help & FAQ",
  "Calls to action & sign-ups", "Industries & applications", "References & brands", "Media",
];

export type Drawn = { html: string; css: string };

export type L2Module = {
  /** its type: unique in the whole library (B's part has others) */
  type: string;
  category: L2Category;
  name: string;
  /** one line: what it is, what it is for */
  note: string;
  needs: L2Need[];
  layouts: { key: string; label: string }[];
  uses: L2Uses;
  /** the words and links a person starts from, in the store view's language where the shop has them (German: the
   * shop's own words; other languages: its links and pictures only - the AI or the person writes the words) */
  defaults: (store: string) => Partial<ModuleSettings>;
  /** the module drawn (its CSS with @@ for its own class) - with empty settings: a visible placeholder, never nothing */
  draw: (s: ModuleSettings, o: Opts) => Drawn;
  /** what still keeps it from being shown on the shop ("" = ready) */
  gap: (s: ModuleSettings) => string;
};

/* ── words ─────────────────────────────────────────────────────────────── */

export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const langOf = (store: string) => String(store || "de").slice(0, 2).toLowerCase();

type W = {
  more: string; all: string; open: string; watch: string; download: string; search: string; searchHint: string; popular: string;
  step: string; contents: string; readMore: string; less: string; tool: string; video: string; pdf: string; or: string;
};
const WORDS: Record<string, W> = {
  de: { more: "Mehr erfahren", all: "Alle anzeigen", open: "Öffnen", watch: "Video ansehen", download: "Herunterladen", search: "Suchen", searchHint: "Produkt, Werkstoff, Artikelnummer …", popular: "Häufig gesucht", step: "Schritt", contents: "Inhalt", readMore: "Weiterlesen", less: "Weniger", tool: "Zum Tool", video: "Video", pdf: "PDF", or: "oder" },
  fr: { more: "En savoir plus", all: "Tout afficher", open: "Ouvrir", watch: "Voir la vidéo", download: "Télécharger", search: "Rechercher", searchHint: "Produit, matériau, numéro d'article …", popular: "Recherches fréquentes", step: "Étape", contents: "Sommaire", readMore: "Lire la suite", less: "Moins", tool: "Vers l'outil", video: "Vidéo", pdf: "PDF", or: "ou" },
  it: { more: "Scopri di più", all: "Mostra tutto", open: "Apri", watch: "Guarda il video", download: "Scarica", search: "Cerca", searchHint: "Prodotto, materiale, numero articolo …", popular: "Ricerche frequenti", step: "Passo", contents: "Indice", readMore: "Continua a leggere", less: "Meno", tool: "Vai allo strumento", video: "Video", pdf: "PDF", or: "o" },
  en: { more: "Learn more", all: "View all", open: "Open", watch: "Watch the video", download: "Download", search: "Search", searchHint: "Product, material, article number …", popular: "Popular searches", step: "Step", contents: "Contents", readMore: "Read more", less: "Less", tool: "Open the tool", video: "Video", pdf: "PDF", or: "or" },
  nl: { more: "Meer weten", all: "Alles tonen", open: "Openen", watch: "Video bekijken", download: "Downloaden", search: "Zoeken", searchHint: "Product, materiaal, artikelnummer …", popular: "Veel gezocht", step: "Stap", contents: "Inhoud", readMore: "Verder lezen", less: "Minder", tool: "Naar de tool", video: "Video", pdf: "PDF", or: "of" },
  pl: { more: "Dowiedz się więcej", all: "Pokaż wszystkie", open: "Otwórz", watch: "Obejrzyj wideo", download: "Pobierz", search: "Szukaj", searchHint: "Produkt, materiał, numer artykułu …", popular: "Często wyszukiwane", step: "Krok", contents: "Spis treści", readMore: "Czytaj dalej", less: "Mniej", tool: "Do narzędzia", video: "Wideo", pdf: "PDF", or: "lub" },
};
export const words = (store: string): W => WORDS[langOf(store)] ?? WORDS.en;

/* ── addresses ─────────────────────────────────────────────────────────── */

/** The store view of the module being drawn (drawL2 sets it - drawing is synchronous). */
const drawing: { store: string | null } = { store: null };
export const setDrawing = (store: string | null) => { drawing.store = store; };

/** A link to the shop, written from the page's own host (the same module works on ACC and the live shop); a store view
 * in another currency ("de-CH/eur") keeps its visitors there. Anything else than the shop: "#" (never a stranger's address). */
export function href(u: string): string {
  const s = String(u ?? "").trim();
  if (/^https:\/\/campaigns\.apsoparts\.com\/[^\s"'<>]+$/i.test(s)) return esc(s); // the shop's brochures (HubSpot files)
  if (!/^https:\/\/(www|acc)\.apsoparts\.com(\/|$)/i.test(s) && !/^\/[^/]/.test(s) && !/^#[\w-]+$/.test(s)) return "#";
  const path = s.replace(/^https:\/\/(www|acc)\.apsoparts\.com(?=\/|$)/i, "") || "/";
  const cur = drawing.store && /^[a-z]{2}-[A-Z]{2,3}\/[a-z]{3}$/.test(drawing.store) ? drawing.store : null;
  const base = cur ? cur.split("/")[0] : null;
  return esc(cur && base && path.startsWith(`/${base}/`) && !path.startsWith(`/${cur}/`) ? `/${cur}${path.slice(base.length + 1)}` : path);
}

/** The product photo the product page zooms (500 px) instead of the list's 279 px - crisp on sharp screens. */
export const sharpImg = (u: string) => u.replace("/cache/e65cbd4f894347b40651eab73facc10f/", "/cache/74c1057f7991b4edb2bc7bdaa94de933/");

/** A picture's <img>: the shop's media or the hub's picture store only. */
export function img(u: string, o: Opts, opt: { lazy?: boolean; alt?: string; product?: boolean } = {}): string {
  const s = String(u ?? "").trim();
  if (!/^https:\/\/(www|acc)\.apsoparts\.com\/media\/[^\s"'<>]+$/i.test(s) && !/^\/api\/content\/picture\/[\w-]+$/.test(s)) return "";
  const src = opt.product ? sharpImg(s) : s;
  return `<img src="${esc(o.picture ? o.picture(src) : src)}" alt="${esc(opt.alt ?? "")}"${opt.lazy === false ? "" : ' loading="lazy"'}>`;
}
export const cardImg = (c: Card, o: Opts, lazy = true) => img(c.img, o, { lazy, product: c.kind === "product" });

/** A product's name as a card writes it: a type number never breaks at its hyphen ("70.10-02"). */
export const nameOf = (n: string) => esc(n).replace(/(\d)-(?=\d)/g, "$1‑");

/** Words with ==red== marks: the marked words in the shop's red. */
export const marked = (t: string) => esc(t).replace(/==([^=]{1,60})==/g, '<span class="am-red">$1</span>');

/** Plain words as HTML: a blank line = a new paragraph, lines starting "- " = a list. */
export function prose(t: string, cls = "am-li"): string {
  return String(t ?? "").replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/).filter(Boolean).map((b) => {
    const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length && lines.every((l) => /^[-•–]\s+/.test(l))) return `<ul class="${cls}">${lines.map((l) => `<li>${marked(l.replace(/^[-•–]\s+/, ""))}</li>`).join("")}</ul>`;
    return `<p>${lines.map(marked).join("<br>")}</p>`;
  }).join("");
}
/** The lines of a text ("- " marks dropped). */
export const linesOf = (t: string) => String(t ?? "").replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim().replace(/^[-•–]\s+/, "")).filter(Boolean);
/** A table row's cells: "a | b | c". */
export const cellsOf = (t: string) => String(t ?? "").split("|").map((c) => c.trim());

/* ── the shared CSS ────────────────────────────────────────────────────── */

/** The frame every module stands in (the v6 modules' own, so both parts look like one library). */
export const BASE = `
@@{--red:#d80901;--red-d:#b00700;--pet:#274e64;--pet-d:#1b3a4b;--ink:#1d2326;--txt:#5e5e5e;--mute:#646b70;--line:#e5e8ea;--tile:#e8e9eb;--soft:#f3f5f6;
  --head:"futura-pt","Futura PT",Futura,Jost,Arial,sans-serif;display:block;box-sizing:border-box;width:100%;max-width:1170px;margin:28px auto;padding:0 10px;
  color:var(--txt);font:15px/1.55 Arial,system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-align:left;clear:both}
@@ *,@@ *::before,@@ *::after{box-sizing:border-box}
@@ a{color:inherit;text-decoration:none!important}
@@ img{display:block;max-width:none;border:0}
@@ h2,@@ h3,@@ h4,@@ p,@@ ul,@@ ol,@@ dl,@@ dd,@@ figure,@@ blockquote,@@ details,@@ summary,@@ table{margin:0!important;padding:0}
@@ ul,@@ ol{list-style:none!important}
@@ li{margin:0!important;padding:0}
@@ h2,@@ h3,@@ h4{font-family:var(--head)!important;font-weight:600!important;color:var(--ink)!important;letter-spacing:-.005em;text-transform:none;text-wrap:balance}
@@ a:focus-visible,@@ summary:focus-visible,@@ label:focus-visible{outline:2px solid var(--red);outline-offset:2px}
@@ .am-hd{display:flex;align-items:flex-end;justify-content:space-between;gap:10px 24px;margin:0 2px 18px}
@@ .am-ey{display:flex;align-items:center;gap:10px;margin-bottom:7px!important;font:600 12px/1.2 var(--head);letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
@@ .am-ey::before{content:"";flex:none;width:26px;height:3px;border-radius:2px;background:var(--red)}
@@ h2.am-h{font-size:clamp(22px,2.1vw,27px)!important;line-height:1.2!important}
@@ .am-sub{margin-top:6px!important;max-width:760px;font-size:15px;line-height:1.55;color:var(--txt)}
@@ .am-all{flex:none;display:inline-flex;align-items:center;gap:8px;padding-bottom:4px;font:600 14.5px/1.2 var(--head);color:var(--pet)!important;white-space:nowrap}
@@ .am-all::after,@@ .am-go::after{content:"";flex:none;width:7px;height:7px;border:solid currentColor;border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-all:hover::after,@@ a:hover .am-go::after,@@ .am-go:hover::after{transform:translateX(3px) rotate(45deg)}
@@ .am-go{display:inline-flex;align-items:center;gap:8px;font:600 14.5px/1.2 var(--head);color:var(--pet)}
@@ .am-red{color:var(--red)}
@@ .am-box{padding:24px 26px 26px;border-radius:28px;background:linear-gradient(#f6f8f9,#edf1f3)}
@media (max-width:900px){@@{margin:20px auto}@@ .am-box{padding:18px 14px 16px;border-radius:20px}@@ .am-hd{margin-bottom:14px}}
`;

/** Buttons: red (the shop's), petrol, outline - each with its arrow. */
export const BTN = `
@@ .am-btn,@@ .am-btn2{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:0 22px;border-radius:6px;font:600 16px/1.15 var(--head);text-align:center;transition:background .2s,color .2s,box-shadow .2s}
@@ .am-btn{background:var(--red);color:#fff!important}
@@ .am-btn:hover,@@ .am-btn:focus-visible{background:var(--red-d)}
@@ .am-btn.is-pet{background:var(--pet)}
@@ .am-btn.is-pet:hover,@@ .am-btn.is-pet:focus-visible{background:var(--pet-d)}
@@ .am-btn::after,@@ .am-btn2::after{content:"";flex:none;width:7px;height:7px;border:solid currentColor;border-width:2px 2px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-btn:hover::after,@@ .am-btn2:hover::after{transform:translateX(3px) rotate(45deg)}
@@ .am-btn2{box-shadow:inset 0 0 0 2px var(--pet);color:var(--pet)!important}
@@ .am-btn2:hover,@@ .am-btn2:focus-visible{background:rgba(39,78,100,.07)}
@@ .am-bs{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
@media (max-width:900px){@@ .am-btn,@@ .am-btn2{min-height:46px;padding:0 18px}}
`;

/** The placeholder a slot shows while it is empty: visible at once, saying what fills it. */
export const PH = `
@@ .am-ph{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:110px;padding:16px;border:2px dashed #c4ccd2;border-radius:16px;
  background:repeating-linear-gradient(135deg,#f7f9fa 0 12px,#f1f4f6 12px 24px);color:#7a8389;font:600 13.5px/1.3 var(--head);text-align:center}
@@ .am-ph::before{content:"";width:22px;height:22px;border-radius:6px;border:2px solid #b3bcc2;background:linear-gradient(#b3bcc2,#b3bcc2) center/10px 2px no-repeat,linear-gradient(#b3bcc2,#b3bcc2) center/2px 10px no-repeat}
`;

/** A placeholder slot. */
export const ph = (hint: string, cls = "") => `<div class="am-ph${cls ? ` ${cls}` : ""}">${esc(hint)}</div>`;

/** The module's heading row: eyebrow, title, the line under it, "View all" on the right. */
export function header(s: ModuleSettings, opt: { all?: boolean; center?: boolean } = {}): string {
  const t = s.title.trim();
  const ey = s.eyebrow.trim();
  const sub = s.text.trim();
  const link = opt.all !== false && s.link.url && s.link.label.trim() ? `<a class="am-all" href="${href(s.link.url)}">${esc(s.link.label.trim())}</a>` : "";
  if (!t && !ey && !link && !sub) return "";
  return `<div class="am-hd"><div>${ey ? `<p class="am-ey">${esc(ey)}</p>` : ""}${t ? `<h2 class="am-h">${marked(t)}</h2>` : ""}${sub ? `<p class="am-sub">${esc(sub)}</p>` : ""}</div>${link}</div>`;
}

/** A button from a link, or "" when it has no words or no address. */
export const button = (l: { label: string; url: string }, cls = "am-btn") => (l.label.trim() && l.url ? `<a class="${cls}" href="${href(l.url)}">${esc(l.label.trim())}</a>` : "");

/* ── icons (24 px line icons, the v6 set and more) ─────────────────────── */

const ICON: Record<string, string> = {
  box: '<path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z"/><path d="M4 8.5 12 13l8-4.5M12 13v7"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  cut: '<circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M7.8 16.2 17 4M16.2 16.2 7 4"/>',
  quick: '<circle cx="12" cy="13.5" r="7"/><path d="M12 10v3.5l2.2 1.6M10 3.5h4M12 3.5v3"/>',
  truck: '<path d="M3.5 6.5h10v9h-10z"/><path d="M13.5 9.5h4l3 3v3h-7"/><circle cx="7" cy="17" r="1.8"/><circle cx="17" cy="17" r="1.8"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 14v4.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V14"/>',
  cube: '<path d="M12 3.5 19.5 7.7v8.6L12 20.5l-7.5-4.2V7.7z"/><path d="M4.5 7.7 12 12l7.5-4.3M12 12v8.5"/>',
  flask: '<path d="M9.5 3.5h5M10.5 3.5v5.2L5.2 18a1.6 1.6 0 0 0 1.4 2.5h10.8a1.6 1.6 0 0 0 1.4-2.5l-5.3-9.3V3.5"/><path d="M7.6 14.5h8.8"/>',
  book: '<path d="M4.5 5.5A2 2 0 0 1 6.5 3.5h13v14h-13a2 2 0 0 0-2 2z"/><path d="M4.5 19.5a2 2 0 0 0 2 1.5h13v-3.5"/>',
  expert: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5 20 4"/>',
  star: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
  drop: '<path d="M12 3.5s6 6.4 6 10.6a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/>',
  flame: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-3.5-9.5C12 7 10 9.5 10 12c-1-.8-1.6-2-1.8-3C6.8 10.6 6 12.6 6 15a6 6 0 0 0 6 6z"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
  shield: '<path d="M12 3.5 19 6v5.5c0 4.3-3 7.7-7 9-4-1.3-7-4.7-7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  chat: '<path d="M4.5 5.5h15v10h-9l-4 3.5v-3.5h-2z"/><path d="M8.5 10.5h7"/>',
  mail: '<path d="M3.5 6.5h17v11h-17z"/><path d="m3.5 7 8.5 6.5L20.5 7"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  file: '<path d="M6.5 3.5h7.5l4 4v13h-11.5z"/><path d="M13.5 3.5V8h4.5M9 13h6M9 16.5h6"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 16v2.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V16"/>',
  factory: '<path d="M3.5 20.5v-9l5 3v-3l5 3v-3l5 3v-10h2v16z"/><path d="M3.5 20.5h17"/>',
  food: '<path d="M7 3.5v7a2 2 0 0 0 4 0v-7M9 10.5v10M16.5 20.5v-17c-2 1-3 3.5-3 7h3"/>',
  pharma: '<rect x="3.6" y="9" width="16.8" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="m9.9 9.9 4.2 4.2"/>',
  bolt: '<path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12z"/>',
  car: '<path d="M4 15.5v-3l2-5h12l2 5v3z"/><path d="M4 12.5h16"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>',
  chip: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/>',
  wave: '<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>',
  pin: '<path d="M12 21s6.5-6.2 6.5-11a6.5 6.5 0 0 0-13 0c0 4.8 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 3.6 5.6 3.6 8.5S14.6 17.9 12 20.5C9.4 17.9 8.4 14.9 8.4 12S9.4 6.1 12 3.5z"/>',
  ruler: '<path d="M3.5 15.5 15.5 3.5l5 5-12 12z"/><path d="m7 12 2 2M10 9l2 2M13 6l2 2"/>',
  layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5"/>',
  filter: '<path d="M4 5.5h16l-6.2 7.2v5.8l-3.6 1.8v-7.6z"/>',
  question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.5"/><path d="M12 16.8v.2"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6"/>',
  cart: '<path d="M3.5 4.5h2.5l2.2 10.5h10l2-7.5H7"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="5" cy="6.5" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="17.5" r="1"/>',
  hose: '<path d="M4 8.5h4c4.5 0 4.5 7 9 7h3"/><path d="M4 5.5v6M20 12.5v6"/>',
  ring: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="4.5"/>',
  water: '<path d="M3.5 9c2.8-2 5.7-2 8.5 0s5.7 2 8.5 0M3.5 15c2.8-2 5.7-2 8.5 0s5.7 2 8.5 0"/>',
  plant: '<path d="M12 20.5v-8"/><path d="M12 12.5c0-4 2.5-6.5 7-7 0 4.5-2.5 7-7 7zM12 15c0-3-2-5-6-5.5 0 3.5 2 5.5 6 5.5z"/>',
  wrench: '<path d="M14.5 4a4.5 4.5 0 0 0-4 6.2L4 16.7 7.3 20l6.5-6.5A4.5 4.5 0 0 0 20 9.5l-2.8 2.8-3-.5-.5-3L16.5 6a4.5 4.5 0 0 0-2-.5z"/>',
  arrow: '<path d="M4.5 12h15M14 6.5l5.5 5.5-5.5 5.5"/>',
};
export const L2_ICONS = Object.keys(ICON);
export const icon = (k: string, size = 22) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[k] ?? ICON.check}</svg>`;

/* ── the module as one element ─────────────────────────────────────────── */

export function minifyCss(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{};,>])\s*/g, "$1").replace(/;}/g, "}").trim();
}

/** The module's CSS (its rules under its own class) and inner HTML. */
export function partsL2(mod: L2Module, s: ModuleSettings, o: Opts = {}): { cls: string; css: string; html: string } {
  const cls = `apx-${s.id}`;
  setDrawing(s.store);
  let d: Drawn;
  try { d = mod.draw(s, o); } finally { setDrawing(null); }
  const extra = `${/class="am-btn2?\b|class="am-btn /.test(d.html) && !d.css.includes(".am-btn{") ? BTN : ""}${d.html.includes('class="am-ph') ? PH : ""}`;
  const css = minifyCss(`${BASE}${extra}${d.css}`).split("@@").join(`.${cls}`);
  return { cls, css, html: d.html };
}

/** ONE element: <div class="apx-<id>" data-apx-module="<type>"> with its <style> first. */
export function renderL2(mod: L2Module, s: ModuleSettings, o: Opts = {}): string {
  const p = partsL2(mod, s, o);
  return `<div class="${p.cls}" data-apx-module="${esc(mod.type)}"><style>${p.css}</style>${p.html}</div>`;
}

/* ── settings helpers ──────────────────────────────────────────────────── */

/** Empty v6 settings for a store view (what a module has before anything is filled). */
export function blankSettings(id: string, store: string, layout: string): ModuleSettings {
  return {
    id, store, eyebrow: "", title: "", text: "", link: { label: "", url: "" }, link2: { label: "", url: "" }, layout,
    items: [], feature: null, points: [], faq: [], fill: null,
  };
}

/** A store view's own path for a shop path written for de-CH ("/de-CH/service" -> "/fr-CH/service"); the currency part is
 * href()'s. Category paths are German words and stay with German store views (defaults only give them there). */
export const pathFor = (store: string, p: string) => {
  const sv = String(store || "de-CH").split("/")[0];
  return /^[a-z]{2}-[A-Z]{2,3}$/.test(sv) ? p.replace(/^\/de-CH\//, `/${sv}/`) : p;
};
export const isGerman = (store: string) => langOf(store) === "de";

/** A card the shop shows (a category or product as the samples hold it). */
export const card = (kind: Card["kind"], name: string, url: string, im = "", meta = "", children: Card[] = [], number = ""): Card =>
  ({ kind, name, url, img: im, meta, number, children });

/** A common gap: the words or the items a module still needs. */
export function needGap(s: ModuleSettings, need: { title?: boolean; items?: number; points?: number; faq?: number; feature?: boolean; text?: boolean }): string {
  if (need.title && !s.title.trim()) return "Give it a headline";
  if (need.text && !s.text.trim()) return "Write its words";
  if (need.items && s.items.length < need.items) return `Add at least ${need.items} item${need.items > 1 ? "s" : ""}`;
  if (need.points && s.points.filter((p) => p.title.trim()).length < need.points) return `Write at least ${need.points} point${need.points > 1 ? "s" : ""}`;
  if (need.faq && s.faq.filter((x) => x.q.trim() && x.a.trim()).length < need.faq) return `Write at least ${need.faq} pair${need.faq > 1 ? "s" : ""}`;
  if (need.feature && !s.feature?.img) return "Pick its picture";
  return "";
}
