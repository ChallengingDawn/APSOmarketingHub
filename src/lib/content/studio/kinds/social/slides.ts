// SOCIAL POST - A SLIDE OR A BRAND CARD, AS HTML (08.11.2026). Pure: tests/studio-social.test.ts.
//
// The carousel's slides and the single brand card, drawn in the shop's look (petrol, the shop's red, ink, futura-pt /
// Jost, the eyebrow with its red bar, the photo card) at their real size - 1080 x 1080, 1080 x 1350, or 1200 x 627 for
// a card - by one renderer, so what the studio shows is what the PNG and the PDF carry. Each layout is a few words:
// a slide is read in a second, in a feed, on a phone.

import { BRAND, esc, logoSvg, mediaUrl } from "../banner/brand";
import type { Slide, SlideLayout } from "./model";

type Shape = "sq" | "tall" | "wide";
const shapeOf = (w: number, h: number): Shape => (w / h > 1.4 ? "wide" : h / w > 1.15 ? "tall" : "sq");

/** The headline's size from its length - long ones come down a step so they never run off the slide. */
export function headSize(text: string, layout: SlideLayout, shape: Shape): number {
  const n = text.trim().length;
  const big = layout === "cover" || layout === "statement";
  const steps = big ? [[20, 112], [36, 96], [56, 82], [80, 70], [Infinity, 58]] : [[28, 78], [50, 66], [80, 58], [Infinity, 50]];
  const px = steps.find(([max]) => n <= max)![1];
  return shape === "wide" ? Math.round(px * 0.6) : px;
}

/** The list layout's points: one per line of the text, without the bullets people type. */
export const listItems = (text: string) =>
  text.split("\n").map((l) => l.replace(/^\s*([-•–→*]|\d+[.)])\s*/, "").trim()).filter(Boolean).slice(0, 6);

const SWIPE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/** Every slide's rules, under one class. */
export function slideCss(prefix: string): string {
  return `
.@@{--head:${BRAND.head};position:relative;overflow:hidden;display:flex;flex-direction:column;box-sizing:border-box;padding:84px 84px 64px;font:400 32px/1.45 ${BRAND.body};color:${BRAND.ink};background:#fff;text-align:left;-webkit-font-smoothing:antialiased}
.@@ *{box-sizing:border-box;margin:0;padding:0}
.@@ img{max-width:none;border:0}
.@@-eb{flex:none;display:flex;align-items:center;gap:16px;font:600 24px/1.2 var(--head);letter-spacing:.14em;text-transform:uppercase;color:${BRAND.mut}}
.@@-eb::before{content:"";flex:none;width:44px;height:5px;border-radius:3px;background:${BRAND.red}}
.@@-h{flex:none;margin-top:30px;font-family:var(--head);font-weight:600;line-height:1.06;letter-spacing:-.01em;color:${BRAND.petrol};overflow-wrap:anywhere}
.@@-eb+.@@-h{margin-top:30px}.@@-h:first-child{margin-top:0}
.@@-p{flex:none;margin-top:28px;color:${BRAND.mut};white-space:pre-line;overflow-wrap:anywhere}
.@@-p.is-long{font-size:28px}
.@@-sp{flex:1 1 0;min-height:20px}
.@@-c{position:relative;flex:1 1 0;min-height:160px;margin-top:48px;border-radius:36px;overflow:hidden;background:#e9ebed}
.@@-c img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover}
.@@-t{position:absolute;left:24px;bottom:24px;max-width:calc(100% - 48px);padding:12px 20px;border-radius:16px;background:#fff;color:${BRAND.ink};font:600 25px/1.2 var(--head);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 10px 24px -14px rgba(27,58,75,.5)}
.@@-l{flex:none;margin-top:40px;list-style:none}
.@@-l li{display:flex;gap:28px;align-items:baseline;padding:22px 0;border-top:2px solid #e3e8ec;font-size:31px;line-height:1.35;color:${BRAND.ink}}
.@@-l li:last-child{border-bottom:2px solid #e3e8ec}
.@@-l b{flex:none;width:52px;font:600 26px/1 var(--head);color:${BRAND.red};letter-spacing:.04em}
.@@-b{flex:none;align-self:flex-start;display:inline-flex;align-items:center;gap:16px;margin-top:48px;height:84px;padding:0 40px;border-radius:18px;background:${BRAND.red};color:#fff;font:600 32px/1 var(--head)}
.@@-b svg{width:30px;height:30px}
.@@-ft{flex:none;display:flex;align-items:center;justify-content:space-between;gap:24px;margin-top:40px;height:48px}
.@@-lg{display:block;height:36px;width:auto}
.@@-pg{display:flex;align-items:center;gap:18px;font:600 22px/1 var(--head);letter-spacing:.08em;color:${BRAND.mut}}
.@@-tr{width:120px;height:5px;border-radius:3px;background:rgba(39,78,100,.16);overflow:hidden}
.@@-tr i{display:block;height:100%;background:${BRAND.red}}
.@@-sw{width:60px;height:60px;border-radius:50%;display:grid;place-items:center;background:${BRAND.red};color:#fff}
.@@-sw svg{width:28px;height:28px}
.@@--cover{background:${BRAND.petrol}}
.@@--cover .@@-eb{color:#b9cfdb}.@@--cover .@@-h{color:#fff}.@@--cover .@@-p{color:#cddbe3}.@@--cover .@@-pg{color:#cddbe3}.@@--cover .@@-tr{background:rgba(255,255,255,.22)}
.@@--statement{background:${BRAND.pale}}
.@@--end{background:${BRAND.ink}}
.@@--end .@@-eb{color:#9aa4aa}.@@--end .@@-h{color:#fff}.@@--end .@@-p{color:#b8c0c5}.@@--end .@@-pg{color:#9aa4aa}.@@--end .@@-tr{background:rgba(255,255,255,.18)}
.@@--photo .@@-c{margin-top:0;margin-bottom:44px}
.@@--wide{flex-direction:row;gap:48px;padding:56px 56px 52px 64px;font-size:21px}
.@@--wide .@@-m{flex:1 1 0;min-width:0;display:flex;flex-direction:column}
.@@--wide .@@-c{flex:0 0 44%;margin:0;border-radius:26px;min-height:0}
.@@--wide .@@-eb{gap:12px;font-size:16px}.@@--wide .@@-eb::before{width:30px;height:4px}
.@@--wide .@@-h{margin-top:18px}.@@--wide .@@-p{margin-top:16px;font-size:21px}.@@--wide .@@-p.is-long{font-size:19px}
.@@--wide .@@-l{margin-top:20px}.@@--wide .@@-l li{gap:16px;padding:10px 0;font-size:19px}.@@--wide .@@-l b{width:30px;font-size:16px}
.@@--wide .@@-b{margin-top:26px;height:54px;padding:0 26px;border-radius:13px;font-size:20px;gap:10px}.@@--wide .@@-b svg{width:20px;height:20px}
.@@--wide .@@-ft{margin-top:20px;height:32px}.@@--wide .@@-lg{height:26px}
.@@--wide .@@-t{left:16px;bottom:16px;padding:8px 14px;border-radius:12px;font-size:17px}
`.replace(/@@/g, prefix).split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
}

export type SlideOpts = {
  prefix: string; w: number; h: number;
  /** Its place in the carousel (0-based) and the carousel's length; a card is 0 of 1. */
  index: number; total: number;
  /** The last slide's button: the link's label, or the shop's name. */
  linkLabel?: string;
};

/** One slide (or the card) at its real size. */
export function slideHtml(s: Slide, o: SlideOpts): string {
  const P = o.prefix;
  const shape = shapeOf(o.w, o.h);
  const img = s.image ? mediaUrl(s.image.url) : "";
  const dark = s.layout === "cover" || s.layout === "end";
  const hs = headSize(s.headline, s.layout, shape);
  const eyebrow = s.eyebrow.trim() && !(s.layout === "photo" && img) ? `<div class="${P}-eb">${esc(s.eyebrow.trim())}</div>` : "";
  const head = s.headline.trim() ? `<div class="${P}-h" style="font-size:${hs}px">${esc(s.headline.trim())}</div>` : "";
  const items = s.layout === "list" ? listItems(s.text) : [];
  const text = s.layout === "list" && items.length
    ? `<ol class="${P}-l">${items.map((x, i) => `<li><b>${String(i + 1).padStart(2, "0")}</b><span>${esc(x)}</span></li>`).join("")}</ol>`
    : s.text.trim() ? `<div class="${P}-p${s.text.trim().length > 170 ? " is-long" : ""}">${esc(s.text.trim())}</div>` : "";
  const button = s.layout === "end" ? `<span class="${P}-b">${esc(o.linkLabel?.trim() || "apsoparts.com")}${SWIPE}</span>` : "";
  const label = s.layout === "photo" && s.eyebrow.trim() ? `<span class="${P}-t">${esc(s.eyebrow.trim())}</span>` : "";
  const card = img && (s.layout === "cover" || s.layout === "photo" || shape === "wide")
    ? `<div class="${P}-c"><img src="${esc(img)}" alt="${esc(s.image?.alt ?? "")}">${label}</div>` : "";
  const many = o.total > 1;
  const pager = many
    ? `<div class="${P}-pg">${o.index + 1} / ${o.total}<div class="${P}-tr"><i style="width:${Math.round(((o.index + 1) / o.total) * 100)}%"></i></div>${o.index === 0 ? `<span class="${P}-sw">${SWIPE}</span>` : ""}</div>`
    : "";
  const foot = `<div class="${P}-ft">${logoSvg(`${P}-lg`, dark ? "#ffffff" : BRAND.red)}${pager}</div>`;
  const cls = `${P} ${P}--${s.layout} ${P}--${shape}`;
  const style = `width:${o.w}px;height:${o.h}px`;
  if (shape === "wide") {
    const main = `<div class="${P}-m">${eyebrow}${head}${text}${button}<div class="${P}-sp"></div>${foot}</div>`;
    return `<div class="${cls}" style="${style}">${main}${card}</div>`;
  }
  // square and portrait: one column - the photo first on a photo slide, after the words on the cover; a statement and the
  // last slide sit in the middle
  const body = s.layout === "photo"
    ? `${card}${card ? "" : eyebrow}${head}${text}${card ? "" : `<div class="${P}-sp"></div>`}`
    : s.layout === "statement" || s.layout === "end"
      ? `<div class="${P}-sp"></div>${eyebrow}${head}${text}${button}<div class="${P}-sp"></div>`
      : `${eyebrow}${head}${text}${button}${card || `<div class="${P}-sp"></div>`}`;
  return `<div class="${cls}" style="${style}">${body}${foot}</div>`;
}

/** The slide prefix for a to-do - one class per piece, as the banners have. */
export const slidePrefix = (pieceId: number | string) => `aps${String(pieceId).replace(/[^A-Za-z0-9]/g, "").slice(0, 12) || "x"}`;
