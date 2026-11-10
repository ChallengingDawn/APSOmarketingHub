// BENTOS (Content v7, 10.11.2026; SARCLA point 1: "more than 100 modules, by category, really high end"; 09.11: "a gallery
// of forms like bentos and much more"). Tiles of different sizes in one calm box - the shop's category photos, its products
// on white, words and the shop's own figures where a tile asks for them. Drawn with the kit (../kit.ts); rules under `@@`.

import { BIG, BUTTONS, big, button, card, cardCss, esc, header, href, marked, nameOf, pic, wordsFor } from "../kit";
import type { Card, FieldSpec, ModuleDef, ModuleRef, Opts } from "../types";

const F = {
  eyebrow: { kind: "eyebrow", label: "Small line above", max: 40 } as FieldSpec,
  title: { kind: "title", label: "Title", max: 90 } as FieldSpec,
  headline: { kind: "title", label: "Headline", max: 80, red: true } as FieldSpec,
  text: { kind: "text", label: "Line under it", max: 200, rows: 2 } as FieldSpec,
  link: { kind: "link", label: "Link at the top right" } as FieldSpec,
  button: { kind: "link", label: "Button" } as FieldSpec,
  feature: { kind: "feature", label: "The photo tile" } as FieldSpec,
};
const allLink = (store: string) => ({ link: { label: wordsFor(store).all, url: "" } });
const P = "https://www.apsoparts.com/de-CH/";
const SEALING = { kind: "category" as const, name: "Dichtungstechnik", url: `${P}dichtungstechnik.html`, img: "https://www.apsoparts.com/media/wysiwyg/1_Sealing_Technology_1.jpg", meta: "258 Produkte", number: "", children: [] };

/** A tile placed by its own class (a grid area), whatever comes before it: the class put first in its class list. */
const tag = (html: string, cls: string) => html.replace(/class="/, `class="${cls} `);

/** A product as a wide card: photo left, name and count right. */
const wide = (c: Card, o: Opts, go: string) => `<a class="am-wd" href="${href(c.url)}"><span class="am-wdp">${pic(c, o)}</span><span class="am-wdt"><b>${nameOf(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}<i>${esc(go)}</i></span></a>`;
const WIDE = `
@@ .am-wd{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);align-items:center;gap:10px;min-width:0;min-height:0;padding:12px 18px 12px 10px;border-radius:18px;background:#fff;
  box-shadow:0 12px 30px -22px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2;color:var(--ink)!important;transition:transform .2s,box-shadow .2s}
@@ .am-wd:hover{transform:translateY(-2px);box-shadow:0 18px 30px -18px rgba(27,58,75,.5),inset 0 0 0 1px #dfe4e8}
@@ .am-wdp{position:relative;display:block;align-self:stretch;min-height:110px}
@@ .am-wdp img{position:absolute;left:4%;top:4%;width:92%;height:92%;object-fit:contain;mix-blend-mode:multiply;filter:brightness(1.05) contrast(1.07);-webkit-mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,#000 70%,transparent 100%);mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,#000 70%,transparent 100%);transition:transform .35s}
@@ .am-wd:hover .am-wdp img{transform:scale(1.05)}
@@ .am-wdt b{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font:600 17px/1.22 var(--head)}
@@ .am-wdt em{display:block;margin-top:5px;font:500 12.5px/1.2 var(--head);font-style:normal;color:var(--mute)}
@@ .am-wdt i{display:inline-flex;align-items:center;gap:7px;margin-top:12px;font:600 13.5px/1 var(--head);font-style:normal;color:var(--pet)}
@@ .am-wdt i::after{content:"";width:6px;height:6px;border:solid currentColor;border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-wd:hover i::after{transform:translateX(3px) rotate(45deg)}
@media (max-width:900px){@@ .am-wdt b{font-size:15px}@@ .am-wdp{min-height:96px}}`;

/* ── mixed: a big category tile, a tall product, two small ones, a petrol word tile ── */

function mixed(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const list = s.items.slice(0, s.feature ? 3 : 4);
  const feature = s.feature ?? list.shift() ?? null;
  const [t, s1, s2] = list;
  const words = `<div class="am-xt is-dark">${s.eyebrow.trim() ? `<p class="am-ey">${esc(s.eyebrow.trim())}</p>` : ""}<h2 class="am-xh">${marked(s.title.trim())}</h2>`
    + `${s.text.trim() ? `<p class="am-xx">${esc(s.text.trim())}</p>` : ""}${s.link.url && s.link.label.trim() ? `<a class="am-xl" href="${href(s.link.url)}">${esc(s.link.label.trim())}</a>` : ""}</div>`;
  const css = `${cardCss(list)}${BIG}
@@ .am-mx{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));grid-template-rows:repeat(2,228px);gap:12px;grid-template-areas:"a a t s1 s2" "a a t x x"}
@@ .am-mx>.am-big{grid-area:a}@@ .am-mx>.g-t{grid-area:t}@@ .am-mx>.g-t>i{background:radial-gradient(circle closest-side,#f2f5f6 0%,#fff 100%)}@@ .am-mx>.g-t>i img{left:-6%;width:112%}@@ .am-mx>.g-s1{grid-area:s1}@@ .am-mx>.g-s2{grid-area:s2}
@@ .am-xt{grid-area:x;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:22px 26px;border-radius:18px;color:#fff;
  background:radial-gradient(130% 160% at 100% 0%,#2f5d76 0%,#274e64 50%,#1b3a4b 100%);box-shadow:0 14px 30px -22px rgba(27,58,75,.8)}
@@ .am-xt .am-ey{color:#cddbe3}@@ .am-xt .am-ey::before{background:#fff}
@@ h2.am-xh{font-size:clamp(19px,1.8vw,24px)!important;line-height:1.18!important;color:#fff!important}
@@ .am-xt .am-red{color:#ff6a5f}
@@ .am-xx{margin-top:6px!important;font-size:14px;line-height:1.5;color:#cddbe3}
@@ .am-xl{display:inline-flex;align-items:center;gap:8px;margin-top:12px;font:600 14.5px/1.2 var(--head);color:#fff!important}
@@ .am-xl::after{content:"";width:7px;height:7px;border:solid currentColor;border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-xl:hover::after{transform:translateX(3px) rotate(45deg)}
@media (max-width:1100px) and (min-width:901px){@@ .am-mx{grid-template-rows:repeat(2,214px)}@@ .am-xt{padding:18px 20px}@@ .am-xx{display:none}}
@media (max-width:900px){
@@ .am-mx{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:220px auto 190px 190px;gap:10px;grid-template-areas:"a a" "x x" "t s1" "t s2"}
@@ .am-xt{padding:18px 18px 20px}
@@ .am-cap{padding:9px 12px 10px}@@ .am-cap b{font-size:17px}@@ .am-cap em{display:none}
}`;
  return { css, html: `<div class="am-box"><div class="am-mx">${feature ? big(feature, o, "", w.all) : ""}${t ? tag(card(t, o), "g-t") : ""}${s1 ? tag(card(s1, o), "g-s1") : ""}${s2 ? tag(card(s2, o), "g-s2") : ""}${words}</div></div>` };
}

/* ── categories: one big, two medium, two small - photos and names ───── */

function categories(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const cats = s.items.slice(0, 5);
  const tile = (c: Card, i: number) => i === 0
    ? `<div class="am-ct is-a"><a class="am-cp" href="${href(c.url)}" aria-label="${esc(c.name)}">${pic({ ...c, kind: "category" }, o, false)}</a><div class="am-cl"><a href="${href(c.url)}"><b>${esc(c.name)}</b></a>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}`
      + `${c.children.length ? `<span class="am-cs">${c.children.slice(0, 4).map((x) => `<a href="${href(x.url)}">${esc(x.name)}</a>`).join("")}</span>` : ""}</div></div>`
    : `<a class="am-ct" href="${href(c.url)}">${pic({ ...c, kind: "category" }, o)}<span class="am-cl"><b>${esc(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</span></a>`;
  const css = `
@@ .am-bc{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));grid-template-rows:repeat(2,236px);gap:12px;grid-template-areas:"a a b b c" "a a d e c"}
@@ .am-bc>:nth-child(1){grid-area:a}@@ .am-bc>:nth-child(2){grid-area:b}@@ .am-bc>:nth-child(3){grid-area:c}@@ .am-bc>:nth-child(4){grid-area:d}@@ .am-bc>:nth-child(5){grid-area:e}
@@ .am-ct{position:relative;display:block;min-width:0;border-radius:20px;overflow:hidden;background:var(--tile);color:#fff!important;isolation:isolate;box-shadow:0 12px 30px -22px rgba(27,58,75,.55)}
@@ .am-ct img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;z-index:-2;transition:transform .6s cubic-bezier(.2,.7,.2,1)}
@@ .am-ct::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(20,40,52,0) 34%,rgba(20,40,52,.55) 62%,rgba(20,40,52,.88) 100%);pointer-events:none}
@@ .am-ct.is-a::after{background:linear-gradient(180deg,rgba(20,40,52,0) 22%,rgba(20,40,52,.6) 52%,rgba(20,40,52,.92) 100%)}
@@ .am-ct:hover img,@@ .am-ct:focus-within img{transform:scale(1.05)}
@@ .am-cp{position:absolute;inset:0;z-index:-2}
@@ .am-cl{position:absolute;left:16px;right:16px;bottom:14px;display:block}
@@ .am-cl b{display:block;font:600 17px/1.2 var(--head);color:#fff;text-shadow:0 1px 12px rgba(0,0,0,.25)}
@@ .am-cl em{display:block;margin-top:2px;font:500 12.5px/1.2 var(--head);font-style:normal;color:#dbe5ea}
@@ .am-ct:not(.is-a) .am-cl b::after{content:"";display:inline-block;width:7px;height:7px;margin:0 0 2px 9px;border:solid #fff;border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-ct:hover .am-cl b::after{transform:translateX(3px) rotate(45deg)}
@@ .am-ct.is-a .am-cl{left:22px;right:22px;bottom:20px}
@@ .am-ct.is-a .am-cl b{font-size:28px;line-height:1.1}
@@ .am-ct.is-a .am-cl em{font-size:14px;margin-top:4px}
@@ .am-cs{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
@@ .am-cs a{padding:6px 11px;border-radius:8px;background:rgba(255,255,255,.18);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.35);font:600 13px/1.2 var(--head);color:#fff!important;transition:background .15s,color .15s}
@@ .am-cs a:hover,@@ .am-cs a:focus-visible{background:#fff;color:var(--ink)!important}
@media (max-width:1100px){@@ .am-ct:not(.is-a) .am-cl b::after{display:none}}
@media (max-width:1100px) and (min-width:901px){@@ .am-bc{grid-template-rows:repeat(2,210px)}@@ .am-ct.is-a .am-cl b{font-size:24px}@@ .am-cs a:nth-child(n+4){display:none}}
@media (max-width:900px){
@@ .am-bc{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:230px 150px 140px 140px;gap:10px;grid-template-areas:"a a" "b b" "c d" "c e"}
@@ .am-ct{border-radius:16px}@@ .am-cl{left:12px;right:12px;bottom:10px}@@ .am-cl b{font-size:15px}
@@ .am-ct.is-a .am-cl{left:14px;right:14px;bottom:14px}@@ .am-ct.is-a .am-cl b{font-size:22px}@@ .am-cs{margin-top:10px}@@ .am-cs a:nth-child(n+4){display:none}
}`;
  return { css, html: `<div class="am-box">${header(s)}<div class="am-bc">${cats.map(tile).join("")}</div></div>` };
}

/* ── text first: a word tile, the products around it, one wide ───────── */

function textFirst(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const list = s.items.slice(0, 5);
  const last = list.length === 5 ? list.pop()! : null;
  const words = `<div class="am-tt">${s.eyebrow.trim() ? `<p class="am-ey">${esc(s.eyebrow.trim())}</p>` : ""}<h2 class="am-th">${marked(s.title.trim())}</h2>`
    + `${s.text.trim() ? `<p class="am-tx">${esc(s.text.trim())}</p>` : ""}${button(s.link, "am-btn")}</div>`;
  const css = `${cardCss(list)}${BUTTONS}${WIDE}
@@ .am-bt{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(2,232px);gap:12px;grid-template-areas:"t t p1 p2" "p3 p4 w w"}
@@ .am-bt>.am-tt{grid-area:t}
@@ .am-bt>.g-p1{grid-area:p1}@@ .am-bt>.g-p2{grid-area:p2}@@ .am-bt>.g-p3{grid-area:p3}@@ .am-bt>.g-p4{grid-area:p4}
@@ .am-bt>.am-wd{grid-area:w}
@@ .am-tt{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:26px 32px;border-radius:20px;background:linear-gradient(135deg,#fff 0%,#fff 55%,#fbeceb 100%);box-shadow:0 12px 30px -22px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2}
@@ h2.am-th{font-size:clamp(23px,2.3vw,32px)!important;line-height:1.12!important;letter-spacing:-.012em}
@@ .am-tx{margin-top:10px!important;max-width:440px;font-size:15px;line-height:1.55;color:var(--txt)}
@@ .am-tt .am-btn{margin-top:18px;height:44px;padding:0 18px;font-size:15px}
@media (max-width:1100px) and (min-width:901px){@@ .am-bt{grid-template-rows:repeat(2,216px)}@@ .am-tt{padding:20px 22px}@@ .am-tx{display:none}}
@media (max-width:900px){
@@ .am-bt{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:auto;grid-auto-rows:auto;gap:10px;grid-template-areas:"t t" "p1 p2" "p3 p4" "w w"}
@@ .am-bt .am-pc>i{flex:none;aspect-ratio:1/.8}
@@ .am-tt{padding:20px 18px 22px}
}`;
  return { css, html: `<div class="am-box"><div class="am-bt">${words}${list.map((c, i) => tag(card(c, o), `g-p${i + 1}`)).join("")}${last ? wide(last, o, w.go) : ""}</div></div>` };
}

/* ── figures: the shop's own numbers between its products ────────────── */

function figures(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const [first, ...rest] = s.items.slice(0, 3);
  const figs = s.points.filter((p) => p.title.trim()).slice(0, 2);
  const right = s.layout !== "left";
  const fig = (p: { title: string; text: string }, i: number) => `<div class="g-f${i + 1} am-fg${i ? " is-dark" : ""}"><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<span>${esc(p.text.trim())}</span>` : ""}</div>`;
  const css = `${cardCss(rest)}${BIG}
@@ .am-bf{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(2,228px);gap:12px;grid-template-areas:${right ? '"f1 p1 b b" "p2 f2 b b"' : '"b b f1 p1" "b b p2 f2"'}}
@@ .am-bf>.am-big{grid-area:b}
@@ .am-bf>.g-f1{grid-area:f1}@@ .am-bf>.g-f2{grid-area:f2}@@ .am-bf>.g-p1{grid-area:p1}@@ .am-bf>.g-p2{grid-area:p2}
@@ .am-fg{display:flex;flex-direction:column;justify-content:flex-end;padding:22px 22px 24px;border-radius:18px;background:#fdf0ef;box-shadow:inset 0 0 0 1px rgba(216,9,1,.1);overflow:hidden;position:relative}
@@ .am-fg::before{content:"";position:absolute;right:-30px;top:-30px;width:120px;height:120px;border-radius:50%;border:18px solid rgba(216,9,1,.07)}
@@ .am-fg b{display:block;font:600 clamp(32px,3.2vw,46px)/1 var(--head);letter-spacing:-.02em;color:var(--red);font-variant-numeric:tabular-nums}
@@ .am-fg span{display:block;margin-top:8px;font:500 14.5px/1.3 var(--head);color:var(--ink)}
@@ .am-fg.is-dark{background:radial-gradient(130% 130% at 0% 0%,#2f5d76 0%,#274e64 50%,#1b3a4b 100%);box-shadow:none}
@@ .am-fg.is-dark::before{border-color:rgba(255,255,255,.07)}
@@ .am-fg.is-dark b{color:#fff}@@ .am-fg.is-dark span{color:#cddbe3}
@media (max-width:1100px) and (min-width:901px){@@ .am-bf{grid-template-rows:repeat(2,214px)}@@ .am-fg{padding:18px}}
@media (max-width:900px){
@@ .am-bf{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:240px auto auto;gap:10px;grid-template-areas:"b b" "f1 f2" "p1 p2"}
@@ .am-fg{min-height:130px;padding:16px}@@ .am-fg span{font-size:13px}
@@ .am-bf .am-pc>i{flex:none;aspect-ratio:1/.8}
@@ .am-cap{padding:9px 12px 10px}@@ .am-cap b{font-size:17px}
}`;
  return { css, html: `<div class="am-box">${header(s)}<div class="am-bf">${first ? big(first, o, "", w.go) : ""}${figs.map(fig).join("")}${rest.map((c, i) => tag(card(c, o), `g-p${i + 1}`)).join("")}</div></div>` };
}

/* ── dark: the night version - a photo tile, wide and square products on petrol ── */

function dark(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const list = s.items.slice(0, 6);
  const p = s.feature;
  const [w1, a, b, c, d, w2] = list;
  const photo = p ? `<a class="am-dp" href="${href(p.url)}">${pic({ ...p, kind: "category" }, o, false)}<span><b>${esc(p.name)}</b>${p.meta ? `<em>${esc(p.meta)}</em>` : ""}<i>${esc(w.all)}</i></span></a>` : "";
  const hd = `<div class="am-dh">${s.eyebrow.trim() ? `<p class="am-ey">${esc(s.eyebrow.trim())}</p>` : ""}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ""}${s.link.url && s.link.label.trim() ? `<a class="am-all" href="${href(s.link.url)}">${esc(s.link.label.trim())}</a>` : ""}</div>`;
  const css = `${cardCss(list)}${WIDE}
@@ .am-dk{padding:26px 28px 28px;border-radius:28px;background:radial-gradient(120% 140% at 0% 0%,#2f5d76 0%,#274e64 42%,#16303e 100%);box-shadow:0 30px 60px -40px rgba(27,58,75,.9)}
@@ .am-dh{display:flex;align-items:flex-end;flex-wrap:wrap;gap:6px 24px;margin:0 2px 18px}
@@ .am-dh>.am-ey{flex-basis:100%;margin:0!important;color:#cddbe3}@@ .am-dh .am-ey::before{background:#fff}
@@ .am-dh h2.am-h{flex:1;color:#fff!important}
@@ .am-dh .am-red{color:#ff6a5f}
@@ .am-dh .am-all{color:#fff!important}
@@ .am-dg{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));grid-template-rows:repeat(2,214px);gap:12px;grid-template-areas:"ph ph w1 w1 s1 s2" "ph ph s3 s4 w2 w2"}
@@ .am-dg>.am-dp{grid-area:ph}
@@ .am-dg>.g-w1{grid-area:w1}@@ .am-dg>.g-w2{grid-area:w2}@@ .am-dg>.g-s1{grid-area:s1}@@ .am-dg>.g-s2{grid-area:s2}@@ .am-dg>.g-s3{grid-area:s3}@@ .am-dg>.g-s4{grid-area:s4}
@@ .am-dg .am-pc,@@ .am-dg .am-wd{box-shadow:0 14px 30px -20px rgba(0,0,0,.55)}
@@ .am-dp{position:relative;display:flex;align-items:flex-end;border-radius:20px;overflow:hidden;background:#123;color:#fff!important;isolation:isolate}
@@ .am-dp img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;z-index:-2;transition:transform .6s}
@@ .am-dp::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(14,32,42,0) 30%,rgba(14,32,42,.6) 58%,rgba(14,32,42,.92) 100%)}
@@ .am-dp:hover img{transform:scale(1.05)}
@@ .am-dp span{display:block;padding:20px 22px}
@@ .am-dp b{display:block;font:600 24px/1.15 var(--head)}
@@ .am-dp em{display:block;margin-top:3px;font:500 13px/1.3 var(--head);font-style:normal;color:#cfdce4}
@@ .am-dp i{display:inline-flex;align-items:center;gap:8px;margin-top:12px;padding:8px 14px;border-radius:8px;background:rgba(255,255,255,.16);box-shadow:inset 0 0 0 1px rgba(255,255,255,.35);font:600 13.5px/1 var(--head);font-style:normal}
@@ .am-dp:hover i{background:#fff;color:var(--ink)}
@media (max-width:1100px) and (min-width:901px){@@ .am-dg{grid-template-columns:repeat(4,minmax(0,1fr));grid-template-areas:"ph ph w1 w1" "ph ph w2 w2"}@@ .am-dg>.am-pc{display:none}}
@media (max-width:900px){
@@ .am-dk{padding:18px 12px 14px;border-radius:20px}
@@ .am-dg{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:220px auto auto auto auto;gap:10px;grid-template-areas:"ph ph" "w1 w1" "s1 s2" "s3 s4" "w2 w2"}
@@ .am-dg .am-pc>i{flex:none;aspect-ratio:1/.8}
@@ .am-dp b{font-size:20px}
}`;
  const squares = [a, b, c, d].map((x, i) => (x ? tag(card(x, o), `g-s${i + 1}`) : "")).join("");
  return { css, html: `<div class="am-dk">${hd}<div class="am-dg">${photo}${w1 ? tag(wide(w1, o, w.go), "g-w1") : ""}${squares}${w2 ? tag(wide(w2, o, w.go), "g-w2") : ""}</div></div>` };
}

/* ── columns: three categories, each its photo and two of its products ── */

function columns(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const cats = s.items.slice(0, 3);
  const kids = (c: Card) => c.children.filter((x) => x.kind === "product").slice(0, 2);
  const col = (c: Card) => `<div class="am-co"><a class="am-cop" href="${href(c.url)}">${pic({ ...c, kind: "category" }, o)}<span><b>${esc(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</span></a>`
    + `<div class="am-cok">${kids(c).map((x) => `<a class="am-ck" href="${href(x.url)}"><i>${pic(x, o)}</i><b>${nameOf(x.name)}</b>${x.meta ? `<em>${esc(x.meta)}</em>` : ""}</a>`).join("")}</div>`
    + `<a class="am-coa" href="${href(c.url)}">${esc(w.all)}</a></div>`;
  const css = `
@@ .am-cg{display:grid;grid-template-columns:repeat(${Math.max(1, cats.length)},minmax(0,1fr));gap:14px}
@@ .am-co{display:flex;flex-direction:column;min-width:0;padding:10px;border-radius:24px;background:#fff;box-shadow:0 14px 34px -26px rgba(27,58,75,.6),inset 0 0 0 1px #edf0f2}
@@ .am-cop{position:relative;display:block;height:190px;border-radius:16px;overflow:hidden;background:var(--tile);color:#fff!important;isolation:isolate}
@@ .am-cop img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;z-index:-2;transition:transform .6s}
@@ .am-cop::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(20,40,52,0) 35%,rgba(20,40,52,.55) 65%,rgba(20,40,52,.88) 100%)}
@@ .am-cop:hover img{transform:scale(1.05)}
@@ .am-cop span{position:absolute;left:16px;right:16px;bottom:13px}
@@ .am-cop b{display:block;font:600 19px/1.15 var(--head)}
@@ .am-cop em{display:block;margin-top:2px;font:500 12.5px/1.2 var(--head);font-style:normal;color:#dbe5ea}
@@ .am-cok{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}
@@ .am-ck{display:flex;flex-direction:column;min-width:0;padding:8px 10px 11px;border-radius:14px;background:#f5f7f8;color:var(--ink)!important;transition:background .15s}
@@ .am-ck:hover{background:#eef2f4}
@@ .am-ck i{position:relative;display:block;aspect-ratio:1/.78;margin-bottom:6px;border-radius:10px;background:#fff}
@@ .am-ck img{position:absolute;left:8%;top:8%;width:84%;height:84%;object-fit:contain;mix-blend-mode:multiply;-webkit-mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,#000 70%,transparent 100%);mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,#000 70%,transparent 100%);transition:transform .35s}
@@ .am-ck:hover img{transform:scale(1.06)}
@@ .am-ck b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.5em;font:600 13.5px/1.25 var(--head);transition:color .15s}
@@ .am-ck:hover b{color:var(--red)}
@@ .am-ck em{display:block;margin-top:3px;font:500 11.5px/1.2 var(--head);font-style:normal;color:var(--mute)}
@@ .am-coa{display:flex;align-items:center;justify-content:space-between;margin:6px 8px 0;padding:12px 2px 6px;font:600 14px/1.2 var(--head);color:var(--pet)!important}
@@ .am-coa::after{content:"";width:7px;height:7px;border:solid currentColor;border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-coa:hover::after{transform:translateX(3px) rotate(45deg)}
@media (max-width:1100px) and (min-width:901px){@@ .am-cg{gap:10px}@@ .am-cop{height:160px}@@ .am-ck b{font-size:12.5px}}
@media (max-width:900px){@@ .am-cg{grid-template-columns:minmax(0,1fr);gap:10px}@@ .am-cop{height:160px}@@ .am-co{border-radius:20px}}`;
  return { css, html: `<div class="am-box">${header(s)}<div class="am-cg">${cats.map(col).join("")}</div></div>` };
}

/* ── glass: a category's photo fills the box, the products float on glass ── */

function glass(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const p = s.feature;
  const list = s.items.slice(0, 4);
  const words = `<div class="am-gw">${s.eyebrow.trim() ? `<p class="am-ey">${esc(s.eyebrow.trim())}</p>` : ""}<h2 class="am-gh">${marked(s.title.trim())}</h2>`
    + `${s.text.trim() ? `<p class="am-gx">${esc(s.text.trim())}</p>` : ""}${button(s.link, "am-btn")}</div>`;
  const css = `${BUTTONS}
@@ .am-gl{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);align-items:end;gap:28px;min-height:540px;padding:30px;border-radius:28px;overflow:hidden;background:var(--pet-d);isolation:isolate}
@@ .am-gl>img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;z-index:-2}
@@ .am-gl::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(18,40,52,.82) 0%,rgba(18,40,52,.45) 42%,rgba(18,40,52,.08) 70%,rgba(18,40,52,.2) 100%)}
@@ .am-gw{align-self:end;padding:8px 8px 6px}
@@ .am-gw .am-ey{color:#d5e1e8}@@ .am-gw .am-ey::before{background:#fff}
@@ h2.am-gh{font-size:clamp(26px,2.8vw,38px)!important;line-height:1.1!important;letter-spacing:-.015em;color:#fff!important}
@@ .am-gw .am-red{color:#ff6a5f}
@@ .am-gx{margin-top:12px!important;max-width:420px;font-size:15.5px;line-height:1.55;color:#dbe6ec}
@@ .am-gw .am-btn{margin-top:22px}
@@ .am-gs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-self:center}
@@ .am-gc{display:flex;flex-direction:column;min-width:0;padding:10px 12px 14px;border-radius:20px;color:var(--ink)!important;
  background:rgba(255,255,255,.72);-webkit-backdrop-filter:blur(16px) saturate(1.4);backdrop-filter:blur(16px) saturate(1.4);box-shadow:0 18px 36px -22px rgba(10,25,35,.6),inset 0 0 0 1px rgba(255,255,255,.75);transition:transform .25s,background .25s}
@@ .am-gc:hover{transform:translateY(-3px);background:rgba(255,255,255,.88)}
@@ .am-gc i{position:relative;display:block;aspect-ratio:1/.72;margin-bottom:9px;border-radius:14px;background:#fff;box-shadow:0 6px 16px -10px rgba(10,25,35,.35)}
@@ .am-gc img{position:absolute;left:10%;top:8%;width:80%;height:84%;object-fit:contain;mix-blend-mode:multiply;filter:brightness(1.06) contrast(1.06);-webkit-mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,#000 70%,transparent 100%);mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,#000 70%,transparent 100%);transition:transform .35s}
@@ .am-gc:hover img{transform:scale(1.06)}
@@ .am-gc b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.5em;font:600 14.5px/1.25 var(--head)}
@@ .am-gc em{display:block;margin-top:3px;font:500 12px/1.2 var(--head);font-style:normal;color:#4f585d}
@media (max-width:1100px) and (min-width:901px){@@ .am-gl{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);min-height:480px;padding:22px;gap:18px}@@ .am-gx{display:none}}
@media (max-width:900px){
@@ .am-gl{display:block;min-height:0;padding:0;border-radius:20px;background:#eef2f4}
@@ .am-gl>img{position:relative;display:block;height:auto;aspect-ratio:16/10;z-index:0}
@@ .am-gl::before{display:none}
@@ .am-gw{padding:18px 18px 4px;background:var(--pet-d)}
@@ .am-gw{margin-top:-4px;padding:20px 18px 22px}
@@ .am-gs{padding:12px;gap:10px}
@@ .am-gc{background:#fff;-webkit-backdrop-filter:none;backdrop-filter:none}
}`;
  return {
    css,
    html: `<div class="am-gl">${p ? pic({ ...p, kind: "category" }, o, false) : ""}${words}<div class="am-gs">${list.map((c) => `<a class="am-gc" href="${href(c.url)}"><i>${pic(c, o)}</i><b>${nameOf(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</a>`).join("")}</div></div>`,
  };
}

/* ── the entries ──────────────────────────────────────────────────────── */

export const BENTOS: ModuleDef[] = [
  {
    id: "bento-mixed", category: "bentos", name: "Mixed bento", note: "A big category photo, a tall product, two small ones and a petrol tile with the words",
    needs: ["products", "text"], takes: "products", min: 3, max: 4, count: (s) => (s.feature ? 3 : 4), layouts: [],
    fields: [F.eyebrow, F.headline, F.text, { kind: "link", label: "Link in the petrol tile" }, { ...F.feature, hint: "A category's photo - its first product until you pick one" } as FieldSpec],
    defaults: allLink, render: mixed, tags: ["bento", "mixed", "asymmetric", "photo", "petrol"],
    sample: { eyebrow: "Dichtungstechnik", title: "Dichtungen für jede Anwendung", text: "258 Produkte, vom O-Ring bis zur Dichtungsplatte.", link: { label: "Zur Dichtungstechnik", url: `${P}dichtungstechnik.html` }, feature: SEALING },
  },
  {
    id: "bento-categories", category: "bentos", name: "Bento of categories", note: "Categories in tiles of different sizes - one big with its subcategories, two medium, two small",
    needs: ["categories"], takes: "categories", kids: "subs", min: 3, max: 5, count: () => 5, layouts: [],
    fields: [F.eyebrow, F.title, F.link], defaults: allLink, render: categories, tags: ["bento", "categories", "tiles", "photos", "sizes"],
    sample: { eyebrow: "Sortiment", title: "Unsere Technologien", link: { label: "Alle Produkte", url: P } },
  },
  {
    id: "bento-text", category: "bentos", name: "Bento with words first", note: "The first big tile is a headline, a line and a button; four products and a wide one around it",
    needs: ["products", "text"], takes: "products", min: 3, max: 5, count: () => 5, layouts: [],
    fields: [F.eyebrow, F.headline, F.text, F.button], defaults: (store) => ({ link: { label: wordsFor(store).all, url: "" } }), render: textFirst,
    tags: ["bento", "text", "headline", "products"],
    sample: { eyebrow: "Sortiment", title: "Vom O-Ring bis zum ==Zahnriemen==", text: "Industriekomponenten aus sechs Technologien - mit Preisen und Verfügbarkeit in Echtzeit.", link: { label: "Alle Produkte", url: P } },
  },
  {
    id: "bento-figures", category: "bentos", name: "Bento with figures", note: "A big product, two more and two tiles with the shop's own figures",
    needs: ["products"], takes: "products", min: 3, max: 3, count: () => 3,
    layouts: [{ key: "right", label: "Big product right" }, { key: "left", label: "Big product left" }],
    fields: [F.eyebrow, F.title, F.link, { kind: "points", label: "Figures", max: 2, item: { title: "The figure", text: "What it counts" }, hint: "The shop's own numbers only - a category's count of products or articles, as the shop shows it." }],
    defaults: allLink, render: figures,
    gap: (m) => (m.settings.points.some((p) => p.title.trim()) ? "" : "Write its figures - the shop's own numbers"), tags: ["bento", "figures", "numbers", "facts"],
    sample: {
      eyebrow: "Dichtungstechnik", title: "Die Dichtungstechnik in Zahlen", link: { label: "Zur Dichtungstechnik", url: `${P}dichtungstechnik.html` },
      points: [{ title: "37.336", text: "Artikel in der Dichtungstechnik", icon: "box" }, { title: "31.264", text: "Artikel bei den O-Ringen und X-Ringen", icon: "box" }],
    },
  },
  {
    id: "bento-dark", category: "bentos", name: "Dark bento", note: "On petrol: a category photo, two wide products and four square ones - the night version",
    needs: ["products", "picture"], takes: "products", min: 4, max: 6, count: () => 6, layouts: [],
    fields: [F.eyebrow, F.title, F.link, F.feature], defaults: allLink, render: dark, tags: ["bento", "dark", "petrol", "night", "products"],
    sample: { eyebrow: "Sortiment", title: "Aus sechs Technologien", link: { label: "Alle Produkte", url: P }, feature: SEALING },
  },
  {
    id: "bento-columns", category: "bentos", name: "Category columns", note: "Three categories side by side, each its photo, two of its products and a link to all",
    needs: ["categories"], takes: "categories", kids: "products", min: 2, max: 3, count: () => 3, layouts: [],
    fields: [F.eyebrow, F.title, F.link], defaults: allLink, render: columns,
    gap: (m) => (m.settings.items.some((c) => c.children.some((x) => x.kind === "product")) ? "" : "Its categories have no products yet - fill them from the shop"),
    tags: ["columns", "categories", "products", "three"],
    sample: { eyebrow: "Dichtungstechnik", title: "Drei Wege zur passenden Dichtung", link: { label: "Zur Dichtungstechnik", url: `${P}dichtungstechnik.html` } },
  },
  {
    id: "bento-glass", category: "bentos", name: "Products on a photo", note: "A category's photo fills the box; the headline on it and four products floating on glass",
    needs: ["products", "picture", "text"], takes: "products", min: 2, max: 4, count: () => 4, layouts: [],
    fields: [F.eyebrow, F.headline, F.text, F.button, F.feature], defaults: (store) => ({ link: { label: wordsFor(store).all, url: "" } }), render: glass,
    tags: ["glass", "photo", "frosted", "products", "background"],
    sample: {
      eyebrow: "Kunststofftechnik", title: "Technische ==Kunststoffe==", text: "Platten, Rundstäbe und Rohre - mit dem DirectCUT Konfigurator nach Mass zugeschnitten.",
      link: { label: "Zur Kunststofftechnik", url: `${P}kunststofftechnik.html` },
      feature: { kind: "category", name: "Kunststofftechnik", url: `${P}kunststofftechnik.html`, img: "https://www.apsoparts.com/media/wysiwyg/3_EngineeringPlasticsTechnology_Plates_1.jpg", meta: "180 Produkte", number: "", children: [] },
    },
  },
];
