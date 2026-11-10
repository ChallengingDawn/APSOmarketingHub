// THE TEN MODULES OF CONTENT v6 (09.11.2026), ported into the library as they were - the documents that hold them open
// them again unchanged (their ids, settings and layouts are the same). From the home page kit: s15 "Calm drill-down" (the
// finder bento, the product bento), s17 "Technology mosaic", Klassik's category cards and best seller row, the campaign
// row, the title row's four promises, About, the questions of the SEO pages, the Tools & Services band.

import { BIG, BUTTONS, big, button, card, cardCss, esc, header, href, icon, marked, pic, promisesFor, words, wordsFor } from "../kit";
import type { ModuleDef, ModuleRef, Opts, Point } from "../types";

/* ── finder bento (s15 Calm drill-down) ───────────────────────────────── */

function finder(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const items = s.items.slice(0, 6);
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
@@ .am-pn{grid-area:1/1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(2,228px);gap:12px;clip-path:inset(0 0 0 100%);
  transition:clip-path .3s cubic-bezier(.2,.7,.2,1) .14s}
@@ .am-pn>.am-big{grid-column:span 2;grid-row:span 2}
@@ .am-pn:first-child{clip-path:inset(-30px)}
@@ .am-fd:has(.am-it:not(:first-child):is(:hover,:focus-visible),.am-pn:not(:first-child):hover) .am-pn:first-child{clip-path:inset(0 0 0 100%)}
${show.length ? `${show.join(",")}{clip-path:inset(-30px)}` : ""}
@media (max-width:1100px) and (min-width:901px){@@ .am-fd{grid-template-columns:${right ? "minmax(0,1fr) 240px" : "240px minmax(0,1fr)"};gap:14px}@@ .am-pn{grid-template-columns:minmax(0,1.2fr) repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,214px);gap:10px}@@ .am-pn>.am-big{grid-column:span 1;grid-row:span 2}@@ .am-it{gap:10px;padding:6px 10px 6px 6px}@@ .am-it b{font-size:14.5px}@@ .am-cap b{font-size:18px}}
@media (max-width:900px){
@@ .am-fd{grid-template-columns:minmax(0,1fr);gap:12px}
@@ .am-nav{order:0;flex-direction:row;gap:6px;overflow-x:auto;padding:6px;border-radius:16px;scrollbar-width:none}
@@ .am-it{flex:none;grid-template-columns:30px auto;gap:8px;min-height:0;padding:5px 14px 5px 5px;border-radius:99px;background:#f4f6f7}
@@ .am-it::after{display:none}
@@ .am-it img,@@ .am-it>span{width:30px;height:30px;border-radius:50%}
@@ .am-it b{font-size:14px;white-space:nowrap}
@@ .am-pn{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:230px;grid-auto-rows:auto;gap:10px;transition:none}
@@ .am-pn:not(:first-child){display:none}
@@ .am-pn>.am-big{grid-row:auto}
@@ .am-pn .am-pc>i{flex:none;aspect-ratio:1/.78}
@@ .am-cap{padding:9px 12px 10px}@@ .am-cap b{font-size:17px}@@ .am-cap em{display:none}
}`;
  return { css, html: `<div class="am-box">${header(s)}<div class="am-fd"><nav class="am-nav">${nav}</nav><div class="am-st">${panels}</div></div></div>` };
}

/* ── product bento (s15's right side) ─────────────────────────────────── */

function bento(m: ModuleRef, o: Opts) {
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
@media (max-width:1100px) and (min-width:901px){@@ .am-bn{grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(2,214px)}${wide ? "@@ .am-bn>.am-pc:nth-of-type(n+5){display:none}" : ""}}
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

function mosaic(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const cols = s.layout === "4" ? 4 : s.layout === "2" ? 2 : 3;
  const rowH = cols === 4 ? 230 : cols === 2 ? 320 : 262;
  const tiles = s.items.slice(0, 8).map((c) => {
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
@@ .am-zr b{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;font:600 13.5px/1.2 var(--head);transition:color .15s}
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

function cards(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const cols = s.layout === "2" ? 2 : s.layout === "4" ? 4 : 3;
  const list = s.items.slice(0, 6).map((c) => {
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

function row(m: ModuleRef, o: Opts) {
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
  return { css, html: `${header(s)}<div class="am-rw">${s.items.slice(0, 12).map((c) => card(c, o)).join("")}</div>` };
}

/* ── campaign banner (the campaign row) ───────────────────────────────── */

/**
 * The banner made in the banner studio, as ONE picture (builder D, Content v7 - SARCLA 10.11.2026 point 11: "push the
 * banner directly on a page after editing"): its picture (the shop's 1920 x 600) and, on phones, its 1080 x 900
 * (`extra.phone`), its link, its alt text (`extra.alt`, else the title). In the home page's slider (`extra.place` =
 * "slider") it fills the slide; elsewhere it stands in the shop's container.
 */
function bannerPicture(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const desk = s.feature?.img ?? "";
  const phone = s.extra.phone ?? "";
  const alt = (s.extra.alt || s.title).trim();
  const src = (u: string) => esc(o.picture ? o.picture(u) : u);
  const img = desk ? `<picture>${phone ? `<source media="(max-width:767px)" srcset="${src(phone)}">` : ""}<img src="${src(desk)}" alt="${esc(alt)}" width="1920" height="600"></picture>` : "";
  const link = s.feature?.url || s.link.url;
  const css = `${s.extra.place === "slider" ? "@@{margin:0 auto;padding:0;max-width:none}" : ""}
@@ .am-bpic{display:block;overflow:hidden;border-radius:${s.extra.place === "slider" ? "0" : "6px"};background:#eef1f3}
@@ .am-bpic img{display:block;width:100%;height:auto;aspect-ratio:1920/600;object-fit:cover}
@media (max-width:767px){@@ .am-bpic img{aspect-ratio:1080/900}}`;
  return { css, html: link ? `<a class="am-bpic" href="${href(link)}">${img}</a>` : `<div class="am-bpic">${img}</div>` };
}

function banner(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const lay = s.layout;
  if (lay === "picture") return bannerPicture(m, o);
  const p = s.feature;
  const picture = p ? `<div class="am-bp${p.kind === "product" ? " is-prod" : ""}">${pic(p, o, false)}</div>` : "";
  const text = `<div class="am-bt">${s.eyebrow.trim() ? `<p class="am-ey">${esc(s.eyebrow.trim())}</p>` : ""}<h2 class="am-bh">${marked(s.title.trim())}</h2>`
    + `${s.text.trim() ? `<p class="am-bx">${esc(s.text.trim())}</p>` : ""}${button(s.link, "am-btn")}</div>`;
  const css = `${BUTTONS}
@@ .am-bb{position:relative;display:grid;grid-template-columns:${lay === "behind" ? "minmax(0,1fr)" : lay === "left" ? "minmax(0,1.05fr) minmax(0,1fr)" : "minmax(0,1fr) minmax(0,1.05fr)"};align-items:stretch;min-height:320px;border-radius:22px;
  background:linear-gradient(135deg,#f6f8f9,#e9edf0);overflow:hidden}
@@ .am-bt{position:relative;z-index:1;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:40px 44px}
@@ .am-ey{color:var(--ink)}
@@ h2.am-bh{font-size:clamp(26px,2.6vw,36px)!important;line-height:1.12!important;letter-spacing:-.01em}
@@ .am-bx{margin-top:12px!important;max-width:460px;font-size:16px;line-height:1.55;color:var(--txt)}
@@ .am-btn{margin-top:22px}
@@ .am-bp{position:relative;min-height:240px;${lay === "left" ? "order:-1;" : ""}}
@@ .am-bp img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}
@@ .am-bp.is-prod img{left:10%;top:8%;width:80%;height:84%;object-fit:contain;mix-blend-mode:multiply}
${lay === "behind" ? `@@ .am-bp{position:absolute;left:0;top:0;right:0;bottom:0}
@@ .am-bt{margin:28px;max-width:520px;padding:30px 32px;border-radius:18px;background:rgba(255,255,255,.96);box-shadow:0 20px 40px -26px rgba(27,58,75,.6)}` : ""}
@media (max-width:900px){
@@ .am-bb{grid-template-columns:minmax(0,1fr);min-height:0;border-radius:18px}
@@ .am-bp{order:-1;min-height:0;aspect-ratio:16/9;${lay === "behind" ? "position:relative" : ""}}
@@ .am-bt{padding:22px 20px 24px;${lay === "behind" ? "margin:0;max-width:none;border-radius:0;box-shadow:none" : ""}}
}`;
  return { css, html: `<div class="am-bb">${text}${picture}</div>` };
}

/* ── USP bar (the four promises) ──────────────────────────────────────── */

function usp(m: ModuleRef) {
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

function textpic(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const left = s.layout === "left";
  const p = s.feature;
  const css = `${BUTTONS}
@@ .am-tp{display:grid;grid-template-columns:${p ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)"};align-items:center;gap:44px}
@@ .am-tt>p:not(.am-ey),@@ .am-tt .am-li{margin-top:12px!important;font-size:15.5px;line-height:1.6;color:var(--txt)}
@@ .am-tt .am-ey{margin-top:0!important}
@@ h2.am-th{font-size:clamp(23px,2.2vw,30px)!important;line-height:1.18!important}
@@ .am-li li{position:relative;padding-left:20px}
@@ .am-li li::before{content:"";position:absolute;left:2px;top:.62em;width:8px;height:8px;border-radius:2px;background:var(--red)}
@@ .am-btn{margin-top:22px}
@@ .am-tf{position:relative;${left ? "order:-1;" : ""}aspect-ratio:4/3;border-radius:20px;overflow:hidden;background:var(--tile);box-shadow:0 26px 50px -32px rgba(27,58,75,.6)}
@@ .am-tf img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}
@@ .am-tf.is-prod{background:#fff;box-shadow:0 26px 50px -32px rgba(27,58,75,.6),inset 0 0 0 1px #edf0f2}
@@ .am-tf.is-prod img{left:10%;top:8%;width:80%;height:84%;object-fit:contain;mix-blend-mode:multiply}
@media (max-width:900px){@@ .am-tp{grid-template-columns:minmax(0,1fr);gap:20px}@@ .am-tf{order:-1;aspect-ratio:16/10;border-radius:16px}}`;
  return {
    css,
    html: `<div class="am-tp"><div class="am-tt">${s.eyebrow.trim() ? `<p class="am-ey">${esc(s.eyebrow.trim())}</p>` : ""}<h2 class="am-th">${marked(s.title.trim())}</h2>${words(s.text)}${button(s.link, "am-btn is-pet")}</div>`
      + `${p ? `<div class="am-tf${p.kind === "product" ? " is-prod" : ""}">${pic(p, o)}</div>` : ""}</div>`,
  };
}

/* ── questions ────────────────────────────────────────────────────────── */

function faq(m: ModuleRef) {
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

function cta(m: ModuleRef) {
  const s = m.settings;
  const light = s.layout === "light";
  const css = `${BUTTONS}
@@ .am-ct2{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:20px 40px;padding:34px 40px;border-radius:22px;${light ? "background:linear-gradient(#f6f8f9,#edf1f3)" : "background:var(--pet);background:radial-gradient(120% 140% at 0% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%)"}}
@@ .am-ct2 .am-ey{color:${light ? "var(--mute)" : "#cddbe3"}}
@@ .am-ct2 .am-ey::before{background:${light ? "var(--red)" : "#fff"}}
@@ .am-ct2 h2.am-h{${light ? "" : "color:#fff!important;"}font-size:clamp(23px,2.2vw,30px)!important}
@@ .am-ct2 .am-sub{${light ? "" : "color:#cddbe3;"}margin-top:8px!important}
@@ .am-bs{display:flex;flex-wrap:wrap;gap:10px}
@@ .am-btn,@@ .am-btn2{height:50px;padding:0 24px}
${light ? "@@ .am-btn{background:var(--pet)}@@ .am-btn:hover,@@ .am-btn:focus-visible{background:var(--pet-d)}" : ""}
@media (max-width:900px){@@ .am-ct2{grid-template-columns:minmax(0,1fr);padding:24px 20px;border-radius:18px}@@ .am-btn,@@ .am-btn2{height:46px}}`;
  const t = s.title.trim();
  const ey = s.eyebrow.trim();
  return {
    css,
    html: `<div class="am-ct2${light ? "" : " is-dark"}"><div>${ey ? `<p class="am-ey">${esc(ey)}</p>` : ""}<h2 class="am-h">${marked(t)}</h2>${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}</div>`
      + `<div class="am-bs">${button(s.link, "am-btn")}${button(s.link2, "am-btn2")}</div></div>`,
  };
}

/* ── the entries ──────────────────────────────────────────────────────── */

const allLink = (store: string) => ({ link: { label: wordsFor(store).all, url: "" } });
const moreLink = (store: string) => ({ link: { label: wordsFor(store).more, url: "" } });
const HEAD = [{ kind: "eyebrow" as const, label: "Small line above", max: 40 }, { kind: "title" as const, label: "Title", max: 90 }, { kind: "link" as const, label: "Link at the top right" }];

export const V6: ModuleDef[] = [
  {
    id: "finder", category: "navigation", name: "Finder bento", note: "A menu of categories beside a big tile and their products - resting on one shows its products",
    needs: ["categories"], takes: "categories", kids: "products", min: 2, max: 6, count: () => 5, from: "home page version A (Calm drill-down)",
    layouts: [{ key: "left", label: "Menu left" }, { key: "right", label: "Menu right" }], fields: HEAD, defaults: allLink, render: finder,
    gap: (m) => (m.settings.items.every((c) => !c.children.length) ? "Its categories have no products yet - fill them from the shop" : ""),
    tags: ["finder", "menu", "drill-down", "bento", "hover"],
  },
  {
    id: "bento", category: "bentos", name: "Product bento", note: "A big tile and the products beside it",
    needs: ["products"], takes: "products", min: 2, max: 7, count: (s) => (s.layout === "wide" ? 6 : 4) + (s.feature ? 0 : 1), from: "home page version A (Calm drill-down)",
    layouts: [{ key: "left", label: "Big tile left" }, { key: "right", label: "Big tile right" }, { key: "wide", label: "Big tile + 6" }],
    fields: [...HEAD, { kind: "feature", label: "The big tile", hint: "Its first product, until you pick one" }], defaults: allLink, render: bento,
    tags: ["bento", "grid", "feature", "products"],
  },
  {
    id: "mosaic", category: "navigation", name: "Mosaic of categories", note: "Big category photos, the name only - resting on one slides up its subcategories",
    needs: ["categories"], takes: "categories", kids: "subs", min: 2, max: 8, count: (s) => (s.layout === "4" ? 8 : s.layout === "2" ? 4 : 6), from: "home page version B (Technology mosaic)",
    layouts: [{ key: "3", label: "3 per row" }, { key: "4", label: "4 per row" }, { key: "2", label: "2 per row" }], fields: HEAD, defaults: allLink, render: mosaic,
    tags: ["mosaic", "tiles", "categories", "photos", "hover"],
  },
  {
    id: "cards", category: "navigation", name: "Category cards", note: "A photo, the category and its subcategories as a list",
    needs: ["categories"], takes: "categories", kids: "subs", min: 1, max: 6, count: (s) => (s.layout === "4" ? 4 : s.layout === "2" ? 2 : 3), from: "home page Klassik (Technologien)",
    layouts: [{ key: "3", label: "3 per row" }, { key: "2", label: "2 per row" }, { key: "4", label: "4 per row" }], fields: HEAD, defaults: allLink, render: cards,
    tags: ["cards", "categories", "list"],
  },
  {
    id: "row", category: "showcases", name: "Product row", note: "Product cards in a row - photo, name, the shop's article count",
    needs: ["products"], takes: "products", min: 2, max: 12, count: (s) => (s.layout === "grid" ? 10 : 8), from: "home page Klassik (Bestseller)",
    layouts: [{ key: "scroll", label: "One row" }, { key: "grid", label: "Rows of 5" }, { key: "grid4", label: "Rows of 4" }], fields: HEAD, defaults: allLink, render: row,
    tags: ["row", "bestseller", "products", "scroll"],
  },
  {
    id: "banner", category: "campaigns", name: "Campaign banner", note: "A headline, a line and a button beside a picture",
    needs: ["text"], takes: "none", min: 0, max: 0, from: "home page campaign row (Black Friday)",
    layouts: [{ key: "right", label: "Picture right" }, { key: "left", label: "Picture left" }, { key: "behind", label: "Picture behind" }, { key: "picture", label: "A banner from the banner studio" }],
    fields: [{ kind: "eyebrow", label: "Small line above", max: 40 }, { kind: "title", label: "Headline", max: 90, red: true }, { kind: "text", label: "Line under it", max: 240, rows: 2 }, { kind: "link", label: "Button" }, { kind: "feature", label: "Picture" }],
    defaults: moreLink, render: banner, tags: ["banner", "campaign", "promotion"],
  },
  {
    id: "usp", category: "trust", name: "USP bar", note: "The shop's promises, each with its icon",
    needs: [], takes: "none", min: 0, max: 0, from: "home page title row (the four promises)",
    layouts: [{ key: "bar", label: "One bar" }, { key: "cards", label: "Cards" }],
    fields: [{ kind: "points", label: "Promises", max: 6, item: { title: "Bold words", text: "The rest" }, icons: true, hint: "The shop's own promises - a promise the shop does not make is never written here." }],
    defaults: (store) => ({ points: promisesFor(store) }), render: (m) => usp(m),
    gap: (m) => (m.settings.points.some((p) => p.title.trim()) ? "" : "Write at least one promise"), tags: ["usp", "promises", "benefits", "icons"],
  },
  {
    id: "textpic", category: "stories", name: "Text and picture", note: "A heading, words and a button beside a picture",
    needs: ["text"], takes: "none", min: 0, max: 0, from: "home page About",
    layouts: [{ key: "right", label: "Picture right" }, { key: "left", label: "Picture left" }],
    fields: [{ kind: "eyebrow", label: "Small line above", max: 40 }, { kind: "title", label: "Headline", max: 90, red: true }, { kind: "text", label: "Text (a blank line = a new paragraph, - a list)", max: 900, rows: 5 }, { kind: "link", label: "Button" }, { kind: "feature", label: "Picture" }],
    defaults: moreLink, render: textpic, tags: ["text", "picture", "about", "story"],
  },
  {
    id: "faq", category: "help", name: "Questions", note: "What buyers ask, with the answers - opened by a click",
    needs: [], takes: "none", min: 0, max: 0, from: "the SEO pages' questions",
    layouts: [{ key: "one", label: "One column" }, { key: "two", label: "Two columns" }],
    fields: [{ kind: "eyebrow", label: "Small line above", max: 40 }, { kind: "title", label: "Title", max: 90 }, { kind: "faq", label: "Questions", max: 12 }],
    defaults: () => ({ faq: [{ q: "", a: "" }, { q: "", a: "" }, { q: "", a: "" }] }), render: (m) => faq(m),
    gap: (m) => (m.settings.faq.some((x) => x.q.trim() && x.a.trim()) ? "" : "Write at least one question and its answer"), tags: ["faq", "questions", "accordion"],
  },
  {
    id: "cta", category: "cta", name: "Call to action", note: "One line and a button: the next step",
    needs: ["text"], takes: "none", min: 0, max: 0, from: "home page Tools & Services band",
    layouts: [{ key: "petrol", label: "Petrol band" }, { key: "light", label: "Light" }],
    fields: [{ kind: "eyebrow", label: "Small line above", max: 40 }, { kind: "title", label: "Headline", max: 90, red: true }, { kind: "text", label: "Line under it", max: 240, rows: 2 }, { kind: "link", label: "Button" }, { kind: "link2", label: "Second button" }],
    defaults: moreLink, render: (m) => cta(m), tags: ["cta", "button", "band"],
  },
];
