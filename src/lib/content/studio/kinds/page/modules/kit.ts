// PAGE - THE MODULE KIT: what every module of the library is drawn with (Content v7, 10.11.2026). Pure.
//
// Ported from the home page kit (C:\dev\_archive\apsoparts\shop-project\home-page-2026: home_kit.py's finished card, the
// s15 "Calm drill-down" and s17 "Technology mosaic" options), at the kit's measures (read off the built pages at 1440 px:
// the box 28 px round on #f6f8f9 -> #edf1f3, rows of 228 px, cards 18 px round, futura-pt 600 for every name). A module
// file takes its pieces from here - the tokens, the heading, the product card, the big tile, the buttons, the icons - so a
// hundred modules read as one shop.
//
// Every rule is written `@@ ...`: the registry (./registry.ts drawModule) puts the module's own class there (.apx-<id>).

import type { Card, ModuleSettings, Opts, Point } from "./types";

export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** A CSS string's content (for `content: "..."`). */
export const cssStr = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ")}"`;

/** The product photo the product page zooms (500 px, ~10 KB) instead of the list's 279 px - crisp on sharp screens
 * (the kit's sharp(), SARCLA 05.11: "some photos looked bad"). */
export const sharpImg = (u: string) => u.replace("/cache/e65cbd4f894347b40651eab73facc10f/", "/cache/74c1057f7991b4edb2bc7bdaa94de933/");

/** CSS written readably, sent small: comments out, spaces only where they mean something. */
export function minifyCss(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{};,>])\s*/g, "$1").replace(/;}/g, "}").trim();
}

/* ── the interface words, in the store view's language ─────────────────── */

export type Words = { go: string; goCat: string; all: string; allProducts: string; more: string; articles: string; products: string; categories: string; discover: string; shop: string };
const WORDS: Record<string, Words> = {
  de: { go: "Zum Produkt", goCat: "Zum Bereich", all: "Alle anzeigen", allProducts: "Alle Produkte", more: "Mehr erfahren", articles: "Artikel", products: "Produkte", categories: "Kategorien", discover: "Entdecken", shop: "Zum Shop" },
  fr: { go: "Voir le produit", goCat: "Voir la catégorie", all: "Tout afficher", allProducts: "Tous les produits", more: "En savoir plus", articles: "articles", products: "produits", categories: "catégories", discover: "Découvrir", shop: "Vers la boutique" },
  it: { go: "Vai al prodotto", goCat: "Vai alla categoria", all: "Mostra tutto", allProducts: "Tutti i prodotti", more: "Scopri di più", articles: "articoli", products: "prodotti", categories: "categorie", discover: "Scopri", shop: "Al negozio" },
  en: { go: "View product", goCat: "View group", all: "View all", allProducts: "All products", more: "Learn more", articles: "articles", products: "products", categories: "categories", discover: "Discover", shop: "To the shop" },
  nl: { go: "Naar het product", goCat: "Naar de categorie", all: "Alles tonen", allProducts: "Alle producten", more: "Meer weten", articles: "artikelen", products: "producten", categories: "categorieën", discover: "Ontdekken", shop: "Naar de shop" },
  pl: { go: "Do produktu", goCat: "Do kategorii", all: "Pokaż wszystkie", allProducts: "Wszystkie produkty", more: "Dowiedz się więcej", articles: "artykułów", products: "produktów", categories: "kategorii", discover: "Odkryj", shop: "Do sklepu" },
};
export const wordsFor = (store: string): Words => WORDS[String(store).slice(0, 2).toLowerCase()] ?? WORDS.en;
export const langOf = (store: string) => String(store).slice(0, 2).toLowerCase();

/** The shop's four promises, as its home page says them (the kit's title row, from today's USP picture). */
export const PROMISES: Record<string, Point[]> = {
  de: [
    { icon: "box", title: "Keine Zuschläge", text: "für Kleinbestellungen" },
    { icon: "clock", title: "Echtzeit-Preise", text: "Lieferzeiten und Verfügbarkeit" },
    { icon: "cut", title: "Zuschnitte", text: "nach Mass" },
    { icon: "quick", title: "Schnell bestellen", text: "mit Schnellbestellung & DirectUP" },
  ],
  fr: [
    { icon: "box", title: "Pas de supplément", text: "pour les petites commandes" },
    { icon: "clock", title: "Prix en temps réel", text: "délais de livraison et disponibilité" },
    { icon: "cut", title: "Découpes", text: "sur mesure" },
    { icon: "quick", title: "Commander vite", text: "avec la commande rapide & DirectUP" },
  ],
  it: [
    { icon: "box", title: "Nessun supplemento", text: "per piccoli ordini" },
    { icon: "clock", title: "Prezzi in tempo reale", text: "tempi di consegna e disponibilità" },
    { icon: "cut", title: "Tagli", text: "su misura" },
    { icon: "quick", title: "Ordinare in fretta", text: "con l'ordine rapido & DirectUP" },
  ],
  en: [
    { icon: "box", title: "No surcharges", text: "for small orders" },
    { icon: "clock", title: "Real-time prices", text: "delivery times and availability" },
    { icon: "cut", title: "Cut-to-size", text: "to your dimensions" },
    { icon: "quick", title: "Fast ordering", text: "with Quickorder & DirectUP" },
  ],
};
export const promisesFor = (store: string): Point[] => (PROMISES[langOf(store)] ?? PROMISES.en).map((p) => ({ ...p }));

/* ── links and pictures ────────────────────────────────────────────────── */

/** The store view of the module being drawn (drawModule sets it - drawing is synchronous). */
export const drawing: { store: string | null } = { store: null };

/** A link to the shop, written from the page's own host: the same module works on ACC and on the live shop (and in the
 * studio's preview, whose page carries the shop's address as its base). Pictures stay absolute on www - ACC lacks some
 * media files (the kit, 05.11). */
export const href = (u: string) => {
  const path = u.replace(/^https:\/\/(www|acc)\.apsoparts\.com(?=\/)/i, "");
  // a store view in another currency (the Swiss shop's EUR: "de-CH/eur") keeps its visitors there: /de-CH/x -> /de-CH/eur/x
  const cur = drawing.store && /^[a-z]{2}-[A-Z]{2,3}\/[a-z]{3}$/.test(drawing.store) ? drawing.store : null;
  const base = cur ? cur.split("/")[0] : null;
  return esc(cur && base && path.startsWith(`/${base}/`) && !path.startsWith(`/${cur}/`) ? `/${cur}${path.slice(base.length + 1)}` : path);
};

/** A picture's <img>: a product's the sharp 500 px one; lazy below the fold. */
export function pic(c: Card, o: Opts, lazy = true, alt = ""): string {
  if (!c.img) return "";
  const src = c.kind === "product" ? sharpImg(c.img) : c.img;
  return `<img src="${esc(o.picture ? o.picture(src) : src)}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ""}>`;
}

/** A product's name as a card writes it: a type number never breaks at its hyphen ("70.10-02"). */
export const nameOf = (n: string) => esc(n).replace(/(\d)-(?=\d)/g, "$1‑");

/** Words with ==red== marks: the marked words in the shop's red (the Black Friday headline's "persönliches"). */
export const marked = (t: string) => esc(t).replace(/==([^=]{1,60})==/g, '<span class="am-red">$1</span>');

/** Plain words as HTML: a blank line = a new paragraph, lines starting "- " = a list. */
export function words(t: string): string {
  return t.replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/).map((b) => {
    const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length && lines.every((l) => /^[-•–]\s+/.test(l))) return `<ul class="am-li">${lines.map((l) => `<li>${esc(l.replace(/^[-•–]\s+/, ""))}</li>`).join("")}</ul>`;
    return `<p>${lines.map(esc).join("<br>")}</p>`;
  }).join("");
}

/** A button: its words and a page of the shop - nothing when either is missing. */
export function button(l: { label: string; url: string }, cls: string): string {
  return l.label.trim() && l.url ? `<a class="${cls}" href="${href(l.url)}">${esc(l.label.trim())}</a>` : "";
}

/* ── the shared rules: tokens, heading, cards, tiles ───────────────────── */

export const BASE = `
@@{--red:#d80901;--red-d:#b00700;--pet:#274e64;--pet-d:#1b3a4b;--ink:#1d2326;--txt:#5e5e5e;--mute:#5b6267;--line:#e5e8ea;--tile:#e8e9eb;
  --head:"futura-pt","Futura PT",Futura,Jost,Arial,sans-serif;display:block;box-sizing:border-box;width:100%;max-width:1170px;margin:28px auto;padding:0 10px;
  color:var(--txt);font:15px/1.55 Arial,system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-align:left;clear:both}
@@ *,@@ ::before,@@ ::after{box-sizing:border-box}
@@ a{color:inherit;text-decoration:none!important}
@@ img{display:block;max-width:none;border:0}
@@ :is(h2,h3,p,ul,ol,figure,details,summary,blockquote){margin:0!important;padding:0}
@@ :is(ul,ol){list-style:none!important}
@@ li{margin:0!important;padding:0}
@@ :is(h2,h3){font-family:var(--head)!important;font-weight:600!important;color:var(--ink)!important;letter-spacing:-.005em;text-transform:none;text-wrap:balance}
@@ :is(a,summary,label):focus-visible{outline:2px solid var(--red);outline-offset:2px}
@@ .am-red{color:var(--red)}
@@ .am-hd{display:flex;align-items:flex-end;justify-content:space-between;gap:10px 24px;margin:0 2px 16px}
@@ .am-ey{display:flex;align-items:center;gap:10px;margin-bottom:7px!important;font:600 12px/1.2 var(--head);letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
@@ .am-ey::before{content:"";flex:none;width:26px;height:3px;border-radius:2px;background:var(--red)}
@@ h2.am-h{font-size:clamp(22px,2.1vw,27px)!important;line-height:1.2!important}
@@ .am-sub{margin-top:6px!important;max-width:760px;font-size:15px;line-height:1.55;color:var(--txt)}
@@ .am-all{flex:none;display:inline-flex;align-items:center;gap:8px;padding-bottom:4px;font:600 14.5px/1.2 var(--head);color:var(--pet)!important;white-space:nowrap}
@@ :is(.am-all,.am-go)::after{content:"";flex:none;width:7px;height:7px;border:solid currentColor;border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-all:hover::after,@@ a:hover .am-go::after{transform:translateX(3px) rotate(45deg)}
@@ .am-box{padding:22px 26px 26px;border-radius:28px;background:linear-gradient(#f6f8f9,#edf1f3)}
@media (max-width:900px){@@{margin:20px auto}@@ .am-box{padding:16px 12px 14px;border-radius:20px}@@ .am-hd{margin-bottom:12px}}
`;

// the card's markup is kept small (a finder carries 20 of them inside a version's 20 KB per element):
// <a class="am-pc"><i><img></i><small>label</small><b>name</b><em>702 Artikel</em></a> - "Zum Produkt" is the em's ::after
const CARD = `
@@ .am-pc{position:relative;display:flex;flex-direction:column;min-width:0;min-height:0;padding-bottom:12px;border-radius:18px;background:#fff;overflow:hidden;color:var(--ink)!important;
  box-shadow:0 12px 30px -22px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2;transition:transform .2s,box-shadow .2s}
@@ .am-pc:is(:hover,:focus-visible){transform:translateY(-2px);box-shadow:0 18px 30px -18px rgba(27,58,75,.5),inset 0 0 0 1px #dfe4e8}
@@ .am-pc>i{position:relative;display:block;flex:1 1 auto;min-height:96px;margin-bottom:6px;overflow:hidden}
@@ .am-pc>i img{position:absolute;left:6%;top:5%;width:88%;height:95%;object-fit:contain;mix-blend-mode:multiply;filter:brightness(1.05) contrast(1.07);
  -webkit-mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,#000 70%,transparent 100%);mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,#000 70%,transparent 100%);transition:transform .35s}
@@ .am-pc:hover>i img{transform:scale(1.05)}
%CAT%
@@ .am-pc>small{display:block;margin:0 13px 2px;font:600 10px/1.2 var(--head);letter-spacing:.1em;text-transform:uppercase;color:var(--red)}
@@ .am-pc>b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.5em;margin:0 13px;font:600 15px/1.25 var(--head);color:var(--ink);overflow-wrap:break-word}
@@ .am-pc>em{position:relative;display:block;height:18px;margin:4px 13px 0;font:500 12px/18px var(--head);font-style:normal;color:var(--mute);white-space:nowrap;transition:color .18s}
@@ .am-pc>em::after{content:%GO% " \\2192";position:absolute;left:0;top:0;font-weight:600;color:var(--pet);opacity:0;transform:translateX(-6px);transition:opacity .18s,transform .18s}
@@ .am-pc:is(:hover,:focus-visible)>em{color:transparent}
@@ .am-pc:is(:hover,:focus-visible)>em::after{opacity:1;transform:none}
@media (hover:none){@@ .am-pc>em::after{display:none}@@ .am-pc>em{color:var(--mute)!important}}
`;
const CARD_CAT = `@@ .am-pc.is-cat>i{margin-bottom:8px;background:var(--tile)}
@@ .am-pc.is-cat>i img{left:0;top:0;width:100%;height:100%;object-fit:cover;mix-blend-mode:normal;filter:none;-webkit-mask-image:none;mask-image:none}
@@ .am-pc.is-cat>em::after{content:%GOCAT% " \\2192"}`;

/** The card rules a module needs: the category card's only when one is in it. */
export const cardCss = (cards: Card[]) => CARD.replace("%CAT%", cards.some((c) => c.kind === "category") ? CARD_CAT : "");

export const BIG = `
@@ .am-big{position:relative;display:flex;flex-direction:column;justify-content:flex-end;min-width:0;min-height:0;border-radius:18px;background:var(--tile);overflow:hidden;
  color:var(--ink)!important;box-shadow:0 12px 30px -22px rgba(27,58,75,.55)}
@@ .am-big img{position:absolute;left:0;top:0;width:100%;height:calc(100% - 46px);object-fit:cover;transition:transform .5s}
@@ .am-big.is-prod{background:#fff;box-shadow:0 12px 30px -22px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2}
@@ .am-big.is-prod img{left:8%;top:4%;width:84%;height:72%;object-fit:contain;mix-blend-mode:multiply;filter:brightness(1.05) contrast(1.07)}
@@ .am-big:hover img{transform:scale(1.04)}
@@ .am-cap{position:relative;display:block;margin:0 10px 10px;padding:11px 14px 12px;border-radius:14px;background:#fff;box-shadow:0 8px 20px -14px rgba(27,58,75,.5)}
@@ .am-cap small{display:block;font:600 10.5px/1.2 var(--head);letter-spacing:.1em;text-transform:uppercase;color:var(--red)}
@@ .am-cap b{display:block;margin:3px 0 2px;font:600 21px/1.15 var(--head);color:var(--ink)}
@@ .am-cap em{display:block;font-style:normal;font-size:13.5px;line-height:1.35;color:var(--txt)}
@@ .am-go{display:inline-flex;align-items:center;gap:7px;margin-top:5px;font:600 14px/1 var(--head);color:var(--red)}
`;

/** The shop's buttons: red (the main one), petrol, and the outlined second one - on light or on dark ground. */
export const BUTTONS = `
@@ .am-btn,@@ .am-btn2{display:inline-flex;align-items:center;gap:10px;height:48px;padding:0 22px;border-radius:6px;font:600 16px/1 var(--head);white-space:nowrap;transition:background .2s,color .2s,border-color .2s}
@@ .am-btn{background:var(--red);color:#fff!important}
@@ .am-btn::after{content:"";width:7px;height:7px;border:solid currentColor;border-width:2px 2px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-btn:hover,@@ .am-btn:focus-visible{background:var(--red-d)}
@@ .am-btn:hover::after{transform:translateX(3px) rotate(45deg)}
@@ .am-btn.is-pet{background:var(--pet)}
@@ .am-btn.is-pet:hover,@@ .am-btn.is-pet:focus-visible{background:var(--pet-d)}
@@ .am-btn2{border:2px solid var(--pet);color:var(--pet)!important}
@@ .am-btn2:hover,@@ .am-btn2:focus-visible{background:rgba(39,78,100,.06);border-color:var(--pet-d)}
@@ .is-dark .am-btn2{border-color:rgba(255,255,255,.7);color:#fff!important}
@@ .is-dark .am-btn2:hover,@@ .is-dark .am-btn2:focus-visible{background:rgba(255,255,255,.1);border-color:#fff}
@media (max-width:900px){@@ .am-btn,@@ .am-btn2{height:46px;padding:0 18px;font-size:15px}}
`;

/* ── the pieces ────────────────────────────────────────────────────────── */

/** The heading row: the small line, the title, a line under it, "Alle anzeigen" on the right. */
export function header(s: ModuleSettings, all = true): string {
  const t = s.title.trim();
  const ey = s.eyebrow.trim();
  const sub = s.text.trim();
  const link = all && s.link.url && s.link.label.trim() ? `<a class="am-all" href="${href(s.link.url)}">${esc(s.link.label.trim())}</a>` : "";
  if (!t && !ey && !link && !sub) return "";
  return `<div class="am-hd"><div>${ey ? `<p class="am-ey">${esc(ey)}</p>` : ""}${t ? `<h2 class="am-h">${marked(t)}</h2>` : ""}${sub ? `<p class="am-sub">${esc(sub)}</p>` : ""}</div>${link}</div>`;
}

/** The kit's finished card: photo, name in two lines, the shop's count; "Zum Produkt" takes the count's place on hover. */
export function card(c: Card, o: Opts, label = ""): string {
  return `<a class="am-pc${c.kind === "category" ? " is-cat" : ""}" href="${href(c.url)}"><i>${pic(c, o)}</i>${label ? `<small>${esc(label)}</small>` : ""}`
    + `<b>${nameOf(c.name)}</b><em>${esc(c.meta)}</em></a>`;
}

/** The big tile: a category's photo filling it (a product's on white), a white caption with its name and "Alle anzeigen". */
export function big(c: Card, o: Opts, small: string, go: string): string {
  return `<a class="am-big${c.kind === "product" ? " is-prod" : ""}" href="${href(c.url)}">${pic(c, o, false)}<span class="am-cap">${small ? `<small>${esc(small)}</small>` : ""}`
    + `<b>${esc(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}<span class="am-go">${esc(go)}</span></span></a>`;
}

/* ── icons (line icons, the shop's stroke) ─────────────────────────────── */

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
  shield: '<path d="M12 3.5 19 6v5.5c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.5 3.6 5.3 3.6 8.5s-1.2 6-3.6 8.5c-2.4-2.5-3.6-5.3-3.6-8.5s1.2-6 3.6-8.5z"/>',
  chat: '<path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3.5v-3.5h0a2 2 0 0 1-1.5-2z"/><path d="M8.5 9.5h7M8.5 12.5h4.5"/>',
  cart: '<path d="M3.5 4.5h2.2l2 10.5h10.3l1.8-7.5H6.4"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.3M12 18.2v2.3M3.5 12h2.3M18.2 12h2.3M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  doc: '<path d="M6.5 3.5h7.5l4.5 4.5v12.5h-12z"/><path d="M14 3.5V8h4.5M9 12.5h6M9 15.5h6"/>',
  phone: '<path d="M6.5 4h3l1.5 4-2 1.2a10 10 0 0 0 5.8 5.8l1.2-2 4 1.5v3A2 2 0 0 1 18 19.5C10.5 19 5 13.5 4.5 6A2 2 0 0 1 6.5 4z"/>',
  euro: '<path d="M17 6.5a6.5 6.5 0 1 0 0 11M5 10.5h8M5 13.5h8"/>',
  leaf: '<path d="M5 19c0-8 5-13.5 14.5-14-.5 9.5-6 14.5-14 14.5z"/><path d="M5 19 13 11"/>',
  spark: '<path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.8 2.8M15.2 15.2 18 18M6 18l2.8-2.8M15.2 8.8 18 6"/>',
  ruler: '<path d="m4 15.5 11.5-11.5 4.5 4.5L8.5 20z"/><path d="m7.5 12 2 2M10.5 9l2 2M13.5 6l2 2"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.4 2.7-5.2 5.5-5.2s4.9 1.8 5.5 5.2"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M15.5 14c2.6-.2 4.4 1.3 5 4.3"/>',
};
export const ICONS = Object.keys(ICON);
export const ICON_LABEL: Record<string, string> = {
  box: "Box", clock: "Clock", cut: "Cut", quick: "Fast", truck: "Delivery", check: "Check", upload: "Upload", cube: "3D", flask: "Lab", book: "Guide",
  expert: "Expert", star: "Star", shield: "Shield", globe: "Globe", chat: "Chat", cart: "Cart", layers: "Range", gear: "Machine", search: "Search", doc: "Document",
  phone: "Phone", euro: "Price", leaf: "Leaf", spark: "Spark", ruler: "Measure", users: "People",
};
export const icon = (k: string, size = 22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[k] ?? ICON.check}</svg>`;
