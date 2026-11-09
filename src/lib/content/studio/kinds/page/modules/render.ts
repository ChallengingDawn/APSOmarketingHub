// PAGE - A MODULE DRAWN (Content v6, 09.11.2026). Pure: tests/studio-page-modules.test.ts.
//
// One renderer for the gallery's thumbnails, the studio's preview and what goes to Magento - so what the person picks is
// what the shop shows. Ported from the home page kit (C:\dev\_archive\apsoparts\shop-project\home-page-2026: home_kit.py's
// finished card, s15 "Calm drill-down" = the finder bento and the product bento, s17 "Technology mosaic", Klassik's category
// cards and best seller row, the campaign row, the title row's four promises, About, the Tools & Services band), at the
// kit's measures (read off the built pages at 1440 px: the box 28 px round on #f6f8f9 -> #edf1f3, the menu 296 px, rows of
// 228 px, cards 18 px round, futura-pt 600 for every name).
//
// Every module is ONE element: <div class="apx-<id>"> with its own <style>, every rule under .apx-<id> (inner classes
// am-*), explicit colours and fonts, the shop's container (1170 px, 10 px gutters), finished at 375, 1024 and 1440 px.
// No script (a version may carry none - src/lib/convert/versions.ts): what moves is CSS - the finder's panels follow the
// mouse with :has(), the mosaic's subcategories slide up on hover or focus, the questions open as <details>.

import { kindOf, wordsFor, type Card, type ModuleRef, type ModuleSettings, type Point } from "./model";

export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** A CSS string's content (for `content: "..."`). */
const cssStr = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ")}"`;

/** The product photo the product page zooms (500 px, ~10 KB) instead of the list's 279 px - crisp on sharp screens
 * (the kit's sharp(), SARCLA 05.11: "some photos looked bad"). */
export const sharpImg = (u: string) => u.replace("/cache/e65cbd4f894347b40651eab73facc10f/", "/cache/74c1057f7991b4edb2bc7bdaa94de933/");

/** CSS written readably, sent small: comments out, spaces only where they mean something. */
export function minifyCss(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{};,>])\s*/g, "$1").replace(/;}/g, "}").trim();
}

type Opts = {
  /** a picture's address as it is written - the preview makes the hub's own absolute, the hand-over names Magento's media */
  picture?: (url: string) => string;
};

/* ── the shared parts: tokens, heading, cards, tiles ───────────────────── */

const BASE = `
@@{--red:#d80901;--red-d:#b00700;--pet:#274e64;--pet-d:#1b3a4b;--ink:#1d2326;--txt:#5e5e5e;--mute:#80878c;--line:#e5e8ea;--tile:#e8e9eb;
  --head:"futura-pt","Futura PT",Futura,Jost,Arial,sans-serif;display:block;box-sizing:border-box;width:100%;max-width:1170px;margin:28px auto;padding:0 10px;
  color:var(--txt);font:15px/1.55 Arial,system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-align:left;clear:both}
@@ *,@@ *::before,@@ *::after{box-sizing:border-box}
@@ a{color:inherit;text-decoration:none!important}
@@ img{display:block;max-width:none;border:0}
@@ h2,@@ h3,@@ p,@@ ul,@@ figure,@@ details,@@ summary{margin:0!important;padding:0}
@@ ul{list-style:none!important}
@@ li{margin:0!important;padding:0}
@@ h2,@@ h3{font-family:var(--head)!important;font-weight:600!important;color:var(--ink)!important;letter-spacing:-.005em;text-transform:none;text-wrap:balance}
@@ a:focus-visible,@@ summary:focus-visible{outline:2px solid var(--red);outline-offset:2px}
@@ .am-hd{display:flex;align-items:flex-end;justify-content:space-between;gap:10px 24px;margin:0 2px 16px}
@@ .am-ey{display:flex;align-items:center;gap:10px;margin-bottom:7px!important;font:600 12px/1.2 var(--head);letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
@@ .am-ey::before{content:"";flex:none;width:26px;height:3px;border-radius:2px;background:var(--red)}
@@ h2.am-h{font-size:clamp(22px,2.1vw,27px)!important;line-height:1.2!important}
@@ .am-sub{margin-top:6px!important;max-width:760px;font-size:15px;line-height:1.55;color:var(--txt)}
@@ .am-all{flex:none;display:inline-flex;align-items:center;gap:8px;padding-bottom:4px;font:600 14.5px/1.2 var(--head);color:var(--pet)!important;white-space:nowrap}
@@ .am-all::after,@@ .am-go::after{content:"";flex:none;width:7px;height:7px;border:solid currentColor;border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-all:hover::after,@@ a:hover .am-go::after{transform:translateX(3px) rotate(45deg)}
@@ .am-box{padding:22px 26px 26px;border-radius:28px;background:linear-gradient(#f6f8f9,#edf1f3)}
@media (max-width:900px){@@{margin:20px auto}@@ .am-box{padding:16px 12px 14px;border-radius:20px}@@ .am-hd{margin-bottom:12px}}
`;

// the card's markup is kept small (a finder carries 20 of them inside a version's 20 KB per element):
// <a class="am-pc"><i><img></i><small>label</small><b>name</b><em>702 Artikel</em></a> - "Zum Produkt" is the em's ::after
const CARD = `
@@ .am-pc{position:relative;display:flex;flex-direction:column;min-width:0;min-height:0;padding-bottom:12px;border-radius:18px;background:#fff;overflow:hidden;color:var(--ink)!important;
  box-shadow:0 12px 30px -22px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2;transition:transform .2s,box-shadow .2s}
@@ .am-pc:hover,@@ .am-pc:focus-visible{transform:translateY(-2px);box-shadow:0 18px 30px -18px rgba(27,58,75,.5),inset 0 0 0 1px #dfe4e8}
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

const BIG = `
@@ .am-big{position:relative;display:flex;flex-direction:column;justify-content:flex-end;min-width:0;min-height:0;border-radius:18px;background:var(--tile);overflow:hidden;
  color:var(--ink)!important;box-shadow:0 12px 30px -22px rgba(27,58,75,.55)}
@@ .am-big img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;transition:transform .5s}
@@ .am-big.is-prod{background:#fff;box-shadow:0 12px 30px -22px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2}
@@ .am-big.is-prod img{left:8%;top:4%;width:84%;height:72%;object-fit:contain;mix-blend-mode:multiply;filter:brightness(1.05) contrast(1.07)}
@@ .am-big:hover img{transform:scale(1.04)}
@@ .am-cap{position:relative;display:block;margin:0 10px 10px;padding:11px 14px 12px;border-radius:14px;background:#fff;box-shadow:0 8px 20px -14px rgba(27,58,75,.5)}
@@ .am-cap small{display:block;font:600 10.5px/1.2 var(--head);letter-spacing:.1em;text-transform:uppercase;color:var(--red)}
@@ .am-cap b{display:block;margin:3px 0 2px;font:600 21px/1.15 var(--head);color:var(--ink)}
@@ .am-cap em{display:block;font-style:normal;font-size:13.5px;line-height:1.35;color:var(--txt)}
@@ .am-go{display:inline-flex;align-items:center;gap:7px;margin-top:5px;font:600 14px/1 var(--head);color:var(--red)}
`;

/* ── the pieces ────────────────────────────────────────────────────────── */

function header(s: ModuleSettings, all = true): string {
  const t = s.title.trim();
  const ey = s.eyebrow.trim();
  const sub = s.text.trim();
  const link = all && s.link.url && s.link.label.trim() ? `<a class="am-all" href="${href(s.link.url)}">${esc(s.link.label.trim())}</a>` : "";
  if (!t && !ey && !link) return "";
  return `<div class="am-hd"><div>${ey ? `<p class="am-ey">${esc(ey)}</p>` : ""}${t ? `<h2 class="am-h">${esc(t)}</h2>` : ""}${sub ? `<p class="am-sub">${esc(sub)}</p>` : ""}</div>${link}</div>`;
}

/** A link to the shop, written from the page's own host: the same module works on ACC and on the live shop (and in the
 * studio's preview, whose page carries the shop's address as its base). Pictures stay absolute on www - ACC lacks some
 * media files (the kit, 05.11). */
export const href = (u: string) => esc(u.replace(/^https:\/\/(www|acc)\.apsoparts\.com(?=\/)/i, ""));

function pic(c: Card, o: Opts, lazy = true): string {
  if (!c.img) return "";
  const src = c.kind === "product" ? sharpImg(c.img) : c.img;
  return `<img src="${esc(o.picture ? o.picture(src) : src)}" alt=""${lazy ? ' loading="lazy"' : ""}>`;
}

/** The kit's finished card: photo, name in two lines, the shop's count; "Zum Produkt" takes the count's place on hover. */
function card(c: Card, o: Opts, label = ""): string {
  return `<a class="am-pc${c.kind === "category" ? " is-cat" : ""}" href="${href(c.url)}"><i>${pic(c, o)}</i>${label ? `<small>${esc(label)}</small>` : ""}`
    + `<b>${esc(c.name)}</b><em>${esc(c.meta)}</em></a>`;
}

/** The big tile: a category's photo filling it (a product's on white), a white caption with its name and "Alle anzeigen". */
function big(c: Card, o: Opts, small: string, go: string): string {
  return `<a class="am-big${c.kind === "product" ? " is-prod" : ""}" href="${href(c.url)}">${pic(c, o, false)}<span class="am-cap">${small ? `<small>${esc(small)}</small>` : ""}`
    + `<b>${esc(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}<span class="am-go">${esc(go)}</span></span></a>`;
}

/** The card rules a module needs: the category card's only when one is in it. */
const cardCss = (cards: Card[]) => CARD.replace("%CAT%", cards.some((c) => c.kind === "category") ? CARD_CAT : "");

/* ── finder bento (s15 Calm drill-down) ───────────────────────────────── */

function finder(m: ModuleRef, o: Opts): { html: string; css: string } {
  const s = m.settings;
  const w = wordsFor(s.store);
  const items = s.items.slice(0, kindOf("finder").max);
  const nav = items.map((c) => `<a class="am-it" href="${href(c.url)}">${c.img ? pic({ ...c, kind: "category" }, o, false) : "<span></span>"}<b>${esc(c.name)}</b></a>`).join("");
  const panels = items.map((c) => {
    const kids = c.children.filter((x) => x.kind === "product").slice(0, 4);
    const fill = c.children.filter((x) => x.kind === "category").slice(0, 4 - kids.length);
    return `<div class="am-pn">${big(c, o, "", w.all)}${[...kids, ...fill].map((x) => card(x, o)).join("")}</div>`;
  }).join("");
  const n = items.length;
  // the panel of the entry the mouse rests on (or the keyboard is on); the first one when none - the kit's "rest" is the
  // .14 s delay, and a panel stays while the mouse is on it (so crossing to its products never loses it)
  const show: string[] = [];
  for (let i = 2; i <= n; i++) {
    show.push(`@@ .am-fd:has(.am-it:nth-child(${i}):is(:hover,:focus-visible)) .am-pn:nth-child(${i}),@@ .am-pn:nth-child(${i}):is(:hover,:focus-within)`);
  }
  const right = s.layout === "right";
  const css = `${cardCss(items.flatMap((c) => c.children))}${BIG}
@@ .am-fd{display:grid;grid-template-columns:${right ? "minmax(0,1fr) 296px" : "296px minmax(0,1fr)"};gap:22px}
@@ .am-nav{${right ? "order:2;" : ""}display:flex;flex-direction:column;gap:4px;min-width:0;padding:8px;border-radius:20px;background:#fff;box-shadow:0 14px 34px -24px rgba(27,58,75,.5)}
@@ .am-it{flex:1 1 62px;max-height:78px;display:grid;grid-template-columns:40px minmax(0,1fr) 8px;align-items:center;gap:12px;min-height:58px;padding:6px 12px 6px 8px;border-radius:13px;color:var(--ink)!important;transition:background .15s}
@@ .am-it img,@@ .am-it>span{width:40px;height:40px;border-radius:10px;object-fit:cover;background:var(--tile)}
@@ .am-it b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:600 16px/1.2 var(--head);color:var(--ink);transition:color .15s}
@@ .am-it::after{content:"";width:7px;height:7px;border:solid #a3abb0;border-width:1.6px 1.6px 0 0;transform:rotate(45deg);transition:border-color .15s,transform .2s}
@@ .am-it:is(:first-child,:hover,:focus-visible){background:#fdf0ef}
@@ .am-it:is(:first-child,:hover,:focus-visible) b{color:var(--red)}
@@ .am-it:is(:first-child,:hover,:focus-visible)::after{border-color:var(--red)}
@@ .am-it:hover::after{transform:translateX(2px) rotate(45deg)}
@@ .am-fd:has(.am-it:not(:first-child):hover) .am-it:first-child:not(:hover){background:none}
@@ .am-fd:has(.am-it:not(:first-child):hover) .am-it:first-child:not(:hover) b{color:var(--ink)}
@@ .am-fd:has(.am-it:not(:first-child):hover) .am-it:first-child:not(:hover)::after{border-color:#a3abb0}
@@ .am-st{display:grid;min-width:0}
@@ .am-pn{grid-area:1/1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(2,228px);gap:12px;visibility:hidden;transform:translateX(14px);
  transition:visibility 0s .14s,transform .26s ease-out .14s}
@@ .am-pn>.am-big{grid-column:span 2;grid-row:span 2}
@@ .am-pn:first-child{visibility:visible;transform:none}
@@ .am-fd:has(.am-it:not(:first-child):is(:hover,:focus-visible),.am-pn:not(:first-child):hover) .am-pn:first-child{visibility:hidden;transform:translateX(14px)}
${show.length ? `${show.join(",")}{visibility:visible;transform:none}` : ""}
@media (max-width:1100px) and (min-width:901px){@@ .am-fd{grid-template-columns:${right ? "minmax(0,1fr) 240px" : "240px minmax(0,1fr)"};gap:14px}@@ .am-pn{grid-template-columns:minmax(0,1.2fr) repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,214px);gap:10px}@@ .am-pn>.am-big{grid-column:span 1;grid-row:span 2}@@ .am-it{gap:10px;padding:6px 10px 6px 6px}@@ .am-it b{font-size:14.5px}@@ .am-cap b{font-size:18px}}
@media (max-width:900px){
@@ .am-fd{grid-template-columns:minmax(0,1fr);gap:12px}
@@ .am-nav{order:0;flex-direction:row;gap:6px;overflow-x:auto;padding:6px;border-radius:16px;scrollbar-width:none}
@@ .am-it{flex:none;grid-template-columns:30px auto;gap:8px;min-height:0;padding:5px 14px 5px 5px;border-radius:99px;background:#f4f6f7}
@@ .am-it::after{display:none}
@@ .am-it img,@@ .am-it>span{width:30px;height:30px;border-radius:50%}
@@ .am-it b{font-size:14px;white-space:nowrap}
@@ .am-pn{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:230px;grid-auto-rows:auto;gap:10px;transform:none!important;transition:none}
@@ .am-pn:not(:first-child){display:none}
@@ .am-pn>.am-big{grid-row:auto}
@@ .am-pn .am-pc>i{flex:none;aspect-ratio:1/.78}
@@ .am-cap{padding:9px 12px 10px}@@ .am-cap b{font-size:17px}@@ .am-cap em{display:none}
}`;
  return { css, html: `<div class="am-box">${header(s)}<div class="am-fd"><nav class="am-nav">${nav}</nav><div class="am-st">${panels}</div></div></div>` };
}

/* ── product bento (s15's right side) ─────────────────────────────────── */

function bento(m: ModuleRef, o: Opts): { html: string; css: string } {
  const s = m.settings;
  const w = wordsFor(s.store);
  const wide = s.layout === "wide";
  const n = wide ? 6 : 4;
  const list = s.items.slice(0, s.feature ? n : n + 1);
  const feature = s.feature ?? list.shift() ?? null;
  const cols = wide ? 5 : 4;
  const css = `${cardCss(list)}${BIG}
@@ .am-bn{display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));grid-template-rows:repeat(2,228px);gap:12px}
@@ .am-bn>.am-big{grid-column:${s.layout === "right" ? `${cols - 1}/span 2` : "1/span 2"};grid-row:1/span 2}
${s.layout === "right" ? "@@ .am-bn>.am-pc{grid-row:auto}@@ .am-bn{grid-auto-flow:dense}" : ""}
@media (max-width:1100px) and (min-width:901px){@@ .am-bn{grid-template-columns:repeat(${wide ? 4 : 4},minmax(0,1fr));grid-template-rows:repeat(2,214px)}${wide ? "@@ .am-bn>.am-pc:nth-of-type(n+5){display:none}" : ""}}
@media (max-width:900px){
@@ .am-bn{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:auto;grid-auto-rows:auto;gap:10px}
@@ .am-bn>.am-big{grid-column:1/span 2;grid-row:auto}
@@ .am-bn .am-pc>i{flex:none;aspect-ratio:1/.78}
@@ .am-bn>.am-big{height:230px}@@ .am-cap{padding:9px 12px 10px}@@ .am-cap b{font-size:17px}@@ .am-cap em{display:none}
}`;
  return {
    css,
    html: `<div class="am-box">${header(s)}<div class="am-bn">${feature ? big(feature, o, s.eyebrow.trim() && !s.title.trim() ? s.eyebrow.trim() : "", w.all) : ""}${list.map((c) => card(c, o)).join("")}</div></div>`,
  };
}

/* ── mosaic of categories (s17 Technology mosaic) ─────────────────────── */

function mosaic(m: ModuleRef, o: Opts): { html: string; css: string } {
  const s = m.settings;
  const w = wordsFor(s.store);
  const cols = s.layout === "4" ? 4 : s.layout === "2" ? 2 : 3;
  const rowH = cols === 4 ? 230 : cols === 2 ? 320 : 262;
  const tiles = s.items.slice(0, kindOf("mosaic").max).map((c) => {
    const rows = c.children.slice(0, 4).map((x) => `<li><a class="am-zr" href="${href(x.url)}">${x.img ? `<span class="am-zt${x.kind === "category" ? " is-cat" : ""}">${pic(x, o)}</span>` : "<span class=\"am-zt\"></span>"}<b>${esc(x.name)}</b></a></li>`).join("");
    return `<div class="am-z"><a class="am-zp" href="${href(c.url)}" aria-label="${esc(c.name)}">${pic({ ...c, kind: "category" }, o)}</a><h3 class="am-zn">${esc(c.name)}</h3>`
      + (rows ? `<div class="am-zc"><a class="am-zh" href="${href(c.url)}">${esc(c.name)}</a><ul>${rows}</ul><a class="am-za" href="${href(c.url)}">${esc(w.allProducts)}</a></div>` : "")
      + "</div>";
  }).join("");
  const css = `
@@ .am-zg{display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));grid-auto-rows:${rowH}px;gap:14px}
@@ .am-z{position:relative;overflow:hidden;border-radius:20px;background:var(--tile);box-shadow:0 12px 30px -22px rgba(27,58,75,.55)}
@@ .am-zp{position:absolute;left:0;top:0;right:0;bottom:0;display:block}
@@ .am-zp img{width:100%;height:100%;object-fit:cover;transition:transform .6s}
@@ h3.am-zn{position:absolute;left:14px;bottom:14px;max-width:calc(100% - 28px);padding:9px 15px 10px;border-radius:13px;background:#fff;box-shadow:0 8px 20px -12px rgba(27,58,75,.55);
  font:600 17px/1.2 var(--head)!important;pointer-events:none;transition:opacity .2s,transform .25s}
@@ .am-zc{position:absolute;left:10px;right:10px;bottom:10px;padding:10px 8px 2px;border-radius:16px;background:rgba(255,255,255,.97);box-shadow:0 18px 36px -20px rgba(27,58,75,.6);
  transform:translateY(calc(100% + 16px));transition:transform .32s cubic-bezier(.2,.7,.2,1)}
@@ .am-z:hover .am-zc,@@ .am-z:focus-within .am-zc{transform:none}
@@ .am-z:hover .am-zn,@@ .am-z:focus-within .am-zn{opacity:0;transform:translateY(10px)}
@@ .am-z:hover .am-zp img,@@ .am-z:focus-within .am-zp img{transform:scale(1.05)}
@@ .am-zh{display:block;margin:0 8px 4px;font:600 16px/1.2 var(--head);color:var(--ink)!important}
@@ .am-zc ul{display:grid;gap:1px}
@@ .am-zr{display:grid;grid-template-columns:32px minmax(0,1fr) 8px;align-items:center;gap:10px;min-height:37px;padding:2px 10px 2px 4px;border-radius:9px;color:var(--ink)!important}
@@ .am-zr:hover,@@ .am-zr:focus-visible{background:#f4f6f7}
@@ .am-zr::after{content:"";width:6px;height:6px;border:solid var(--red);border-width:1.6px 1.6px 0 0;transform:rotate(45deg);opacity:0;transition:opacity .15s}
@@ .am-zr:hover::after{opacity:1}
@@ .am-zr b{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font:600 13.5px/1.2 var(--head);transition:color .15s}
@@ .am-zr:hover b,@@ .am-zr:focus-visible b{color:var(--red)}
@@ .am-zt{display:block;width:32px;height:32px;overflow:hidden;border-radius:8px;background:#fff;box-shadow:inset 0 0 0 1px #eef1f3}
@@ .am-zt img{width:100%;height:100%;object-fit:contain;transform:scale(1.3)}
@@ .am-zt.is-cat{background:var(--tile);box-shadow:none}
@@ .am-zt.is-cat img{object-fit:cover;transform:scale(1.12)}
@@ .am-za{display:flex;align-items:center;justify-content:space-between;margin:4px 8px 0;padding:8px 2px 10px 0;border-top:1px solid #edf0f2;font:600 13.5px/1.2 var(--head);color:var(--red)!important}
@@ .am-za::after{content:"";width:7px;height:7px;border:solid currentColor;border-width:1.8px 1.8px 0 0;transform:rotate(45deg)}
@media (hover:none){@@ .am-zc{display:none}}
@media (max-width:1100px) and (min-width:901px){@@ .am-zg{grid-auto-rows:${Math.round(rowH * 0.85)}px}}
@media (max-width:900px){
@@ .am-zg{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:150px;gap:10px}
@@ h3.am-zn{left:8px;bottom:8px;max-width:calc(100% - 16px);padding:6px 10px 7px;border-radius:10px;font-size:13.5px!important}
@@ .am-zc{display:none}
}`;
  return { css, html: `<div class="am-box">${header(s)}<div class="am-zg">${tiles}</div></div>` };
}

/* ── category cards (Klassik's technologies) ──────────────────────────── */

function cards(m: ModuleRef, o: Opts): { html: string; css: string } {
  const s = m.settings;
  const w = wordsFor(s.store);
  const cols = s.layout === "2" ? 2 : s.layout === "4" ? 4 : 3;
  const list = s.items.slice(0, kindOf("cards").max).map((c) => {
    const rows = c.children.slice(0, cols === 4 ? 4 : 5).map((x) => `<li><a class="am-cr" href="${href(x.url)}"><span class="am-ct${x.kind === "category" ? " is-cat" : ""}">${pic(x, o)}</span><b>${esc(x.name)}</b>${x.meta ? `<em>${esc(x.meta)}</em>` : ""}</a></li>`).join("");
    return `<article class="am-cc"><a class="am-cp" href="${href(c.url)}">${pic({ ...c, kind: "category" }, o)}<span class="am-cn"><b>${esc(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</span></a>`
      + (rows ? `<ul>${rows}</ul>` : "") + `<a class="am-ca" href="${href(c.url)}">${esc(w.all)}</a></article>`;
  }).join("");
  const css = `
@@ .am-cg{display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:14px;align-items:start}
@@ .am-cc{display:flex;flex-direction:column;min-width:0;border-radius:20px;background:#fff;overflow:hidden;box-shadow:0 12px 30px -22px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2}
@@ .am-cp{position:relative;display:block;height:${cols === 2 ? 200 : 168}px;background:var(--tile);overflow:hidden}
@@ .am-cp img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
@@ .am-cp:hover img{transform:scale(1.04)}
@@ .am-cn{position:absolute;left:12px;bottom:12px;max-width:calc(100% - 24px);padding:8px 13px 9px;border-radius:12px;background:#fff;box-shadow:0 8px 20px -12px rgba(27,58,75,.55)}
@@ .am-cn b{display:block;font:600 17px/1.2 var(--head);color:var(--ink)}
@@ .am-cn em{display:block;margin-top:1px;font:500 12px/1.3 var(--head);font-style:normal;color:var(--mute)}
@@ .am-cc ul{display:grid;gap:2px;padding:10px 10px 4px!important}
@@ .am-cr{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:40px;padding:3px 8px 3px 4px;border-radius:9px;color:var(--ink)!important;transition:background .15s}
@@ .am-cr:hover,@@ .am-cr:focus-visible{background:#f4f6f7}
@@ .am-cr b{overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;font:500 14px/1.25 var(--head);transition:color .15s}
@@ .am-cr:hover b{color:var(--red)}
@@ .am-cr em{font:500 12px/1 var(--head);font-style:normal;color:var(--mute);white-space:nowrap}
@@ .am-ct{display:block;width:30px;height:30px;overflow:hidden;border-radius:7px;background:#fff;box-shadow:inset 0 0 0 1px #eef1f3}
@@ .am-ct img{width:100%;height:100%;object-fit:contain;transform:scale(1.25)}
@@ .am-ct.is-cat{background:var(--tile);box-shadow:none}
@@ .am-ct.is-cat img{object-fit:cover;transform:scale(1.1)}
@@ .am-ca{display:flex;align-items:center;justify-content:space-between;margin:6px 18px 0;padding:12px 0 14px;border-top:1px solid #edf0f2;font:600 14px/1.2 var(--head);color:var(--pet)!important}
@@ .am-ca::after{content:"";width:7px;height:7px;border:solid currentColor;border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-ca:hover::after{transform:translateX(3px) rotate(45deg)}
@media (max-width:1100px) and (min-width:901px){@@ .am-cg{grid-template-columns:repeat(${Math.min(cols, 3)},minmax(0,1fr))}}
@media (max-width:900px){@@ .am-cg{grid-template-columns:minmax(0,1fr)${cols === 4 ? " minmax(0,1fr)" : ""};gap:10px}@@ .am-cp{height:150px}}
@media (max-width:560px){@@ .am-cg{grid-template-columns:minmax(0,1fr)}}`;
  return { css, html: `<div class="am-box">${header(s)}<div class="am-cg">${list}</div></div>` };
}

/* ── product row (Klassik's best sellers) ─────────────────────────────── */

function row(m: ModuleRef, o: Opts): { html: string; css: string } {
  const s = m.settings;
  const scroll = s.layout === "scroll";
  const per = s.layout === "grid4" ? 4 : 5;
  const css = `${cardCss(s.items)}
@@ .am-rw{display:grid;gap:14px;${scroll
    ? "grid-auto-flow:column;grid-auto-columns:calc((100% - 56px) / 5);overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 2px 14px;margin:-4px -2px 0;scrollbar-width:thin;scrollbar-color:#c9d1d6 transparent"
    : `grid-template-columns:repeat(${per},minmax(0,1fr))`}}
@@ .am-rw>.am-pc{scroll-snap-align:start}
@@ .am-rw .am-pc>i{flex:none;aspect-ratio:1/.82}
@media (max-width:1100px) and (min-width:901px){@@ .am-rw{${scroll ? "grid-auto-columns:calc((100% - 42px) / 4)" : `grid-template-columns:repeat(${Math.min(per, 4)},minmax(0,1fr))`}}}
@media (max-width:900px){@@ .am-rw{gap:10px;${scroll ? "grid-auto-columns:calc((100% - 10px) / 2.25)" : "grid-template-columns:repeat(2,minmax(0,1fr))"}}}`;
  return { css, html: `${header(s)}<div class="am-rw">${s.items.slice(0, kindOf("row").max).map((c) => card(c, o)).join("")}</div>` };
}

/* ── campaign banner (the campaign row) ───────────────────────────────── */

/** Words with ==red== marks: the marked words in the shop's red (the Black Friday headline's "persönliches"). */
const marked = (t: string) => esc(t).replace(/==([^=]{1,60})==/g, '<span class="am-red">$1</span>');

function button(l: { label: string; url: string }, cls: string): string {
  return l.label.trim() && l.url ? `<a class="${cls}" href="${href(l.url)}">${esc(l.label.trim())}</a>` : "";
}

function banner(m: ModuleRef, o: Opts): { html: string; css: string } {
  const s = m.settings;
  const lay = s.layout;
  const p = s.feature;
  const picture = p ? `<div class="am-bp${p.kind === "product" ? " is-prod" : ""}">${pic(p, o, false)}</div>` : "";
  const text = `<div class="am-bt">${s.eyebrow.trim() ? `<p class="am-ey">${esc(s.eyebrow.trim())}</p>` : ""}<h2 class="am-bh">${marked(s.title.trim())}</h2>`
    + `${s.text.trim() ? `<p class="am-bx">${esc(s.text.trim())}</p>` : ""}${button(s.link, "am-btn")}</div>`;
  const css = `
@@ .am-bb{position:relative;display:grid;grid-template-columns:${lay === "behind" ? "minmax(0,1fr)" : lay === "left" ? "minmax(0,1.05fr) minmax(0,1fr)" : "minmax(0,1fr) minmax(0,1.05fr)"};align-items:stretch;min-height:320px;border-radius:22px;
  background:linear-gradient(135deg,#f6f8f9,#e9edf0);overflow:hidden}
@@ .am-bt{position:relative;z-index:1;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:40px 44px}
@@ .am-ey{color:var(--ink)}
@@ .am-ey::before{background:var(--red)}
@@ h2.am-bh{font-size:clamp(26px,2.6vw,36px)!important;line-height:1.12!important;letter-spacing:-.01em}
@@ .am-red{color:var(--red)}
@@ .am-bx{margin-top:12px!important;max-width:460px;font-size:16px;line-height:1.55;color:var(--txt)}
@@ .am-btn{display:inline-flex;align-items:center;gap:10px;margin-top:22px;height:48px;padding:0 22px;border-radius:6px;background:var(--red);color:#fff!important;font:600 16px/1 var(--head);white-space:nowrap;transition:background .2s}
@@ .am-btn::after{content:"";width:7px;height:7px;border:solid #fff;border-width:2px 2px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-btn:hover,@@ .am-btn:focus-visible{background:var(--red-d)}
@@ .am-btn:hover::after{transform:translateX(3px) rotate(45deg)}
@@ .am-bp{position:relative;min-height:240px;${lay === "left" ? "order:-1;" : ""}}
@@ .am-bp img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}
@@ .am-bp.is-prod img{left:10%;top:8%;width:80%;height:84%;object-fit:contain;mix-blend-mode:multiply}
${lay === "behind" ? `@@ .am-bp{position:absolute;left:0;top:0;right:0;bottom:0}
@@ .am-bt{margin:28px;max-width:520px;padding:30px 32px;border-radius:18px;background:rgba(255,255,255,.96);box-shadow:0 20px 40px -26px rgba(27,58,75,.6)}` : ""}
@media (max-width:900px){
@@ .am-bb{grid-template-columns:minmax(0,1fr);min-height:0;border-radius:18px}
@@ .am-bp{order:-1;min-height:0;aspect-ratio:16/9;${lay === "behind" ? "position:relative" : ""}}
@@ .am-bt{padding:22px 20px 24px;${lay === "behind" ? "margin:0;max-width:none;border-radius:0;box-shadow:none" : ""}}
@@ .am-btn{height:46px}
}`;
  return { css, html: `<div class="am-bb">${text}${picture}</div>` };
}

/* ── USP bar (the four promises) ──────────────────────────────────────── */

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
};
const icon = (k: string) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[k] ?? ICON.check}</svg>`;

function usp(m: ModuleRef): { html: string; css: string } {
  const s = m.settings;
  const pts = s.points.filter((p: Point) => p.title.trim()).slice(0, 6);
  const cardsLook = s.layout === "cards";
  const css = `
@@ .am-us{display:grid;grid-template-columns:repeat(${Math.max(1, pts.length)},minmax(0,1fr));gap:${cardsLook ? "14px" : "0"};${cardsLook ? "" : "padding:16px 10px;border-radius:20px;background:#f3f5f6;"}}
@@ .am-u{display:grid;grid-template-columns:44px minmax(0,1fr);align-items:center;gap:12px;min-width:0;padding:${cardsLook ? "18px 18px" : "4px 18px"};${cardsLook ? "border-radius:18px;background:#fff;box-shadow:0 12px 30px -22px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2" : ""}}
${cardsLook ? "" : "@@ .am-u+.am-u{border-left:1px solid #e1e6e9}"}
@@ .am-u svg{display:block;width:44px;height:44px;padding:10px;border-radius:50%;background:#fdf0ef;color:var(--red)}
@@ .am-u b{display:block;font:600 16px/1.2 var(--head);color:var(--ink)}
@@ .am-u span{display:block;margin-top:2px;font:500 13px/1.35 var(--head);color:var(--mute)}
@media (max-width:1100px) and (min-width:901px){@@ .am-u{grid-template-columns:38px minmax(0,1fr);gap:10px;padding:${cardsLook ? "16px 14px" : "4px 12px"}}@@ .am-u svg{width:38px;height:38px;padding:8px}@@ .am-u b{font-size:15px}}
@media (max-width:900px){@@ .am-us{grid-template-columns:repeat(2,minmax(0,1fr));gap:${cardsLook ? "10px" : "14px 0"};${cardsLook ? "" : "padding:14px 4px"}}
@@ .am-u{grid-template-columns:36px minmax(0,1fr);gap:10px;padding:${cardsLook ? "14px 12px" : "2px 12px"}}@@ .am-u+.am-u{border-left:0}@@ .am-u svg{width:36px;height:36px;padding:8px}@@ .am-u b{font-size:14.5px}@@ .am-u span{font-size:12.5px}}`;
  return { css, html: `<ul class="am-us">${pts.map((p) => `<li class="am-u">${icon(p.icon)}<div><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<span>${esc(p.text.trim())}</span>` : ""}</div></li>`).join("")}</ul>` };
}

/* ── text and picture (About) ─────────────────────────────────────────── */

/** Plain words as HTML: a blank line = a new paragraph, lines starting "- " = a list. */
function words(t: string): string {
  return t.replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/).map((b) => {
    const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length && lines.every((l) => /^[-•–]\s+/.test(l))) return `<ul class="am-li">${lines.map((l) => `<li>${esc(l.replace(/^[-•–]\s+/, ""))}</li>`).join("")}</ul>`;
    return `<p>${lines.map(esc).join("<br>")}</p>`;
  }).join("");
}

function textpic(m: ModuleRef, o: Opts): { html: string; css: string } {
  const s = m.settings;
  const left = s.layout === "left";
  const p = s.feature;
  const css = `
@@ .am-tp{display:grid;grid-template-columns:${p ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)"};align-items:center;gap:44px}
@@ .am-tt>p,@@ .am-tt .am-li{margin-top:12px!important;font-size:15.5px;line-height:1.6;color:var(--txt)}
@@ .am-tt .am-ey{margin-top:0!important}
@@ h2.am-th{font-size:clamp(23px,2.2vw,30px)!important;line-height:1.18!important}
@@ .am-li li{position:relative;padding-left:20px}
@@ .am-li li::before{content:"";position:absolute;left:2px;top:.62em;width:8px;height:8px;border-radius:2px;background:var(--red)}
@@ .am-btn{display:inline-flex;align-items:center;gap:10px;margin-top:22px;height:48px;padding:0 22px;border-radius:6px;background:var(--pet);color:#fff!important;font:600 16px/1 var(--head);white-space:nowrap;transition:background .2s}
@@ .am-btn::after{content:"";width:7px;height:7px;border:solid #fff;border-width:2px 2px 0 0;transform:rotate(45deg)}
@@ .am-btn:hover,@@ .am-btn:focus-visible{background:var(--pet-d)}
@@ .am-tf{position:relative;${left ? "order:-1;" : ""}aspect-ratio:4/3;border-radius:20px;overflow:hidden;background:var(--tile);box-shadow:0 26px 50px -32px rgba(27,58,75,.6)}
@@ .am-tf img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}
@@ .am-tf.is-prod{background:#fff;box-shadow:0 26px 50px -32px rgba(27,58,75,.6),inset 0 0 0 1px #edf0f2}
@@ .am-tf.is-prod img{left:10%;top:8%;width:80%;height:84%;object-fit:contain;mix-blend-mode:multiply}
@media (max-width:900px){@@ .am-tp{grid-template-columns:minmax(0,1fr);gap:20px}@@ .am-tf{order:-1;aspect-ratio:16/10;border-radius:16px}}`;
  return {
    css,
    html: `<div class="am-tp"><div class="am-tt">${s.eyebrow.trim() ? `<p class="am-ey">${esc(s.eyebrow.trim())}</p>` : ""}<h2 class="am-th">${marked(s.title.trim())}</h2>${words(s.text)}${button(s.link, "am-btn")}</div>`
      + `${p ? `<div class="am-tf${p.kind === "product" ? " is-prod" : ""}">${pic(p, o)}</div>` : ""}</div>`,
  };
}

/* ── questions ────────────────────────────────────────────────────────── */

function faq(m: ModuleRef): { html: string; css: string } {
  const s = m.settings;
  const two = s.layout === "two";
  const qs = s.faq.filter((x) => x.q.trim() && x.a.trim());
  const css = `
@@ .am-fq{display:grid;grid-template-columns:${two ? "repeat(2,minmax(0,1fr))" : "minmax(0,1fr)"};gap:10px;align-items:start}
@@ .am-q{border-radius:16px;background:#fff;box-shadow:inset 0 0 0 1px var(--line);transition:box-shadow .2s}
@@ .am-q[open]{box-shadow:inset 0 0 0 1px #d6dde2,0 14px 30px -24px rgba(27,58,75,.55)}
@@ .am-q summary{position:relative;display:block;padding:17px 56px 17px 20px;cursor:pointer;list-style:none;font:600 16.5px/1.35 var(--head);color:var(--ink)}
@@ .am-q summary::-webkit-details-marker{display:none}
@@ .am-q summary::after{content:"";position:absolute;right:22px;top:50%;width:9px;height:9px;margin-top:-7px;border:solid var(--red);border-width:0 2px 2px 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-q[open] summary::after{transform:translateY(4px) rotate(225deg)}
@@ .am-q summary:hover{color:var(--pet)}
@@ .am-qa{padding:0 20px 18px}
@@ .am-qa p,@@ .am-qa .am-li{margin-top:8px!important;font-size:15px;line-height:1.6;color:var(--txt)}
@@ .am-qa>:first-child{margin-top:0!important}
@@ .am-li li{position:relative;padding-left:18px}
@@ .am-li li::before{content:"";position:absolute;left:2px;top:.62em;width:7px;height:7px;border-radius:2px;background:var(--red)}
@media (max-width:900px){@@ .am-fq{grid-template-columns:minmax(0,1fr)}@@ .am-q summary{padding:15px 48px 15px 16px;font-size:15.5px}@@ .am-qa{padding:0 16px 16px}}`;
  return { css, html: `${header(s, false)}<div class="am-fq">${qs.map((x) => `<details class="am-q"><summary>${esc(x.q.trim())}</summary><div class="am-qa">${words(x.a)}</div></details>`).join("")}</div>` };
}

/* ── call to action (the Tools & Services band) ───────────────────────── */

function cta(m: ModuleRef): { html: string; css: string } {
  const s = m.settings;
  const light = s.layout === "light";
  const css = `
@@ .am-ct2{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:20px 40px;padding:34px 40px;border-radius:22px;${light ? "background:linear-gradient(#f6f8f9,#edf1f3)" : "background:var(--pet);background:radial-gradient(120% 140% at 0% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%)"}}
@@ .am-ct2 .am-ey{color:${light ? "var(--mute)" : "#cddbe3"}}
@@ .am-ct2 .am-ey::before{background:${light ? "var(--red)" : "#fff"}}
@@ .am-ct2 h2.am-h{${light ? "" : "color:#fff!important;"}font-size:clamp(23px,2.2vw,30px)!important}
@@ .am-ct2 .am-sub{${light ? "" : "color:#cddbe3;"}margin-top:8px!important}
@@ .am-bs{display:flex;flex-wrap:wrap;gap:10px}
@@ .am-btn,@@ .am-btn2{display:inline-flex;align-items:center;gap:10px;height:50px;padding:0 24px;border-radius:6px;font:600 16px/1 var(--head);white-space:nowrap;transition:background .2s,color .2s,border-color .2s}
@@ .am-btn{background:${light ? "var(--pet)" : "var(--red)"};color:#fff!important}
@@ .am-btn::after{content:"";width:7px;height:7px;border:solid #fff;border-width:2px 2px 0 0;transform:rotate(45deg)}
@@ .am-btn:hover,@@ .am-btn:focus-visible{background:${light ? "var(--pet-d)" : "var(--red-d)"}}
@@ .am-btn2{border:2px solid ${light ? "var(--pet)" : "rgba(255,255,255,.7)"};color:${light ? "var(--pet)" : "#fff"}!important}
@@ .am-btn2:hover,@@ .am-btn2:focus-visible{background:${light ? "rgba(39,78,100,.06)" : "rgba(255,255,255,.1)"};border-color:${light ? "var(--pet-d)" : "#fff"}}
@media (max-width:900px){@@ .am-ct2{grid-template-columns:minmax(0,1fr);padding:24px 20px;border-radius:18px}@@ .am-btn,@@ .am-btn2{height:46px}}`;
  const t = s.title.trim();
  const ey = s.eyebrow.trim();
  return {
    css,
    html: `<div class="am-ct2"><div>${ey ? `<p class="am-ey">${esc(ey)}</p>` : ""}<h2 class="am-h">${marked(t)}</h2>${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}</div>`
      + `<div class="am-bs">${button(s.link, "am-btn")}${button(s.link2, "am-btn2")}</div></div>`,
  };
}

/* ── the module as one element ────────────────────────────────────────── */

const DRAW: Record<ModuleRef["type"], (m: ModuleRef, o: Opts) => { html: string; css: string }> = {
  finder, bento, mosaic, cards, row, banner, usp: (m) => usp(m), textpic, faq: (m) => faq(m), cta: (m) => cta(m),
};

/** The module's CSS and inner HTML, its rules under its own class. */
export function moduleParts(m: ModuleRef, o: Opts = {}): { cls: string; css: string; html: string } {
  const cls = `apx-${m.settings.id}`;
  const w = wordsFor(m.settings.store);
  const d = DRAW[m.type](m, o);
  const css = minifyCss(`${BASE}${d.css}`.replace(/%GOCAT%/g, cssStr(w.goCat)).replace(/%GO%/g, cssStr(w.go))).split("@@").join(`.${cls}`);
  return { cls, css, html: d.html };
}

/** The module as the shop gets it: ONE element - <div class="apx-<id>"> with its <style> first. */
export function renderModule(m: ModuleRef, o: Opts = {}): string {
  const p = moduleParts(m, o);
  return `<div class="${p.cls}" data-apx-module="${m.type}"><style>${p.css}</style>${p.html}</div>`;
}

/** Its weight against a version's 20 KB per element (src/lib/convert/versions.ts LIMITS.html). */
export const MODULE_MAX = 20_000;
export function moduleWeight(html: string): { bytes: number; ok: boolean } {
  return { bytes: html.length, ok: html.length <= MODULE_MAX };
}
