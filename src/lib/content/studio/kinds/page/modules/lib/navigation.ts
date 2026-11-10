// CATEGORY NAVIGATION (Content v7, 10.11.2026; SARCLA point 1: "more than 100 modules, by category, really high end"). The
// shop's own categories - their photos, names, counts and subcategories as the shop's pages show them - as tiles, circles,
// an index, an accordion, rows, quick links and a list that shows its photo where the mouse rests. Real links for every
// category (search engines and keyboards find them); what moves is CSS only. Drawn with the kit; rules under `@@`.

import { esc, header, href, pic, wordsFor } from "../kit";
import type { Card, FieldSpec, ModuleDef, ModuleRef, Opts } from "../types";

const HEAD: FieldSpec[] = [{ kind: "eyebrow", label: "Small line above", max: 40 }, { kind: "title", label: "Title", max: 90 }, { kind: "link", label: "Link at the top right" }];
const allLink = (store: string) => ({ link: { label: wordsFor(store).all, url: "" } });
const P = "https://www.apsoparts.com/de-CH/";
const catPic = (c: Card, o: Opts, lazy = true) => pic({ ...c, kind: "category" }, o, lazy);
const subsOf = (c: Card) => c.children.filter((x) => x.kind === "category");
const kidsGap = (m: ModuleRef) => (m.settings.items.some((c) => c.children.length) ? "" : "Its categories have no subcategories yet - fill them from the shop");
const chev = (sel: string, color = "#a3abb0") => `@@ ${sel}::after{content:"";flex:none;width:7px;height:7px;border:solid ${color};border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s,border-color .2s}`;

/* ── tiles: a square photo, the name under it ─────────────────────────── */

function tiles(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const cols = s.layout === "4" ? 4 : 6;
  const list = s.items.slice(0, 12);
  const css = `
@@ .am-tg{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
@@ .am-tc{flex:0 0 calc((100% - ${cols - 1} * 12px) / ${cols})}
@@ .am-tc{display:flex;flex-direction:column;align-items:center;min-width:0;height:100%;padding:8px 8px 14px;border-radius:18px;background:#fff;text-align:center;color:var(--ink)!important;
  box-shadow:0 12px 28px -22px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2;transition:transform .2s,box-shadow .2s}
@@ .am-tc:hover,@@ .am-tc:focus-visible{transform:translateY(-3px);box-shadow:0 18px 30px -18px rgba(27,58,75,.5),inset 0 0 0 1.5px rgba(216,9,1,.35)}
@@ .am-tp{position:relative;display:block;width:100%;aspect-ratio:1;border-radius:12px;overflow:hidden;background:var(--tile)}
@@ .am-tp img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
@@ .am-tc:hover .am-tp img{transform:scale(1.07)}
@@ .am-tc b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:11px;padding:0 4px;font:600 ${cols === 4 ? 17 : 15}px/1.22 var(--head);transition:color .15s}
@@ .am-tc:hover b{color:var(--red)}
@@ .am-tc em{display:block;margin-top:3px;font:500 12px/1.2 var(--head);font-style:normal;color:var(--mute)}
@media (max-width:1100px) and (min-width:901px){@@ .am-tg{gap:10px}@@ .am-tc{flex-basis:calc((100% - ${cols - 1} * 10px) / ${cols})}@@ .am-tc b{font-size:${cols === 4 ? 16 : 13.5}px}}
@media (max-width:900px){@@ .am-tg{gap:8px}@@ .am-tc{flex-basis:calc((100% - 16px) / 3)}@@ .am-tc{padding:6px 6px 10px;border-radius:14px}@@ .am-tc b{margin-top:8px;font-size:13px}@@ .am-tc em{font-size:11px}}
@media (max-width:420px){@@ .am-tc{flex-basis:calc((100% - 8px) / 2)}}`;
  return { css, html: `${header(s)}<div class="am-tg">${list.map((c) => `<a class="am-tc" href="${href(c.url)}"><span class="am-tp">${catPic(c, o)}</span><b>${esc(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</a>`).join("")}</div>` };
}

/* ── circles: round photos with the names, a swipe row on phones ─────── */

function circles(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const list = s.items.slice(0, 8);
  const css = `
@@ .am-cr{display:grid;grid-template-columns:repeat(${Math.max(4, list.length)},minmax(0,1fr));gap:14px;padding:22px 22px 18px;border-radius:24px;background:linear-gradient(#f7f9fa,#eef2f4)}
@@ .am-ci{display:flex;flex-direction:column;align-items:center;min-width:0;text-align:center;color:var(--ink)!important}
@@ .am-cp{position:relative;display:block;width:min(100%,120px);aspect-ratio:1;border-radius:50%;overflow:hidden;background:#fff;box-shadow:0 12px 26px -16px rgba(27,58,75,.55),0 0 0 4px #fff;transition:box-shadow .25s,transform .25s}
@@ .am-cp img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
@@ .am-ci:hover .am-cp,@@ .am-ci:focus-visible .am-cp{transform:translateY(-3px);box-shadow:0 16px 30px -16px rgba(27,58,75,.6),0 0 0 4px #fff,0 0 0 6px var(--red)}
@@ .am-ci:hover .am-cp img{transform:scale(1.08)}
@@ .am-ci b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:12px;font:600 14.5px/1.22 var(--head);transition:color .15s}
@@ .am-ci:hover b{color:var(--red)}
@@ .am-ci em{display:block;margin-top:2px;font:500 12px/1.2 var(--head);font-style:normal;color:var(--mute)}
@media (max-width:1100px) and (min-width:901px){@@ .am-cr{gap:10px;padding:18px 14px 14px}@@ .am-ci b{font-size:13.5px}}
@media (max-width:900px){
@@ .am-cr{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:16px 14px 14px;border-radius:18px}
@@ .am-ci{flex:none;width:104px;scroll-snap-align:start}
@@ .am-cp{width:84px}
@@ .am-ci b{margin-top:9px;font-size:12.5px;-webkit-hyphens:auto;hyphens:auto;overflow-wrap:break-word}
}`;
  return { css, html: `${header(s)}<div class="am-cr">${list.map((c) => `<a class="am-ci" href="${href(c.url)}"><span class="am-cp">${catPic(c, o)}</span><b>${esc(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</a>`).join("")}</div>` };
}

/* ── index: the categories as headings, their subcategories as links ──── */

function index(m: ModuleRef) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const cols = s.layout === "2" ? 2 : 3;
  const list = s.items.slice(0, 9);
  const block = (c: Card) => `<div class="am-ib"><a class="am-ih" href="${href(c.url)}"><b>${esc(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</a>`
    + `<ul>${subsOf(c).slice(0, 8).map((x) => `<li><a href="${href(x.url)}">${esc(x.name)}</a></li>`).join("")}</ul>`
    + `<a class="am-ia" href="${href(c.url)}">${esc(w.all)}</a></div>`;
  const css = `
@@ .am-ix{display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:0;padding:8px 6px;border-radius:22px;background:#fff;box-shadow:0 14px 34px -28px rgba(27,58,75,.55),inset 0 0 0 1px #e8ecef}
@@ .am-ib{min-width:0;padding:20px 24px 18px}
@@ .am-ib:not(:nth-child(${cols}n+1)){border-left:1px solid #eef1f3}
@@ .am-ib:nth-child(n+${cols + 1}){border-top:1px solid #eef1f3}
@@ .am-ih{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding-bottom:10px;margin-bottom:6px;border-bottom:2px solid var(--ink);color:var(--ink)!important}
@@ .am-ih b{font:600 18px/1.2 var(--head);transition:color .15s}
@@ .am-ih:hover b{color:var(--red)}
@@ .am-ih em{flex:none;font:500 12.5px/1 var(--head);font-style:normal;color:var(--mute);font-variant-numeric:tabular-nums}
@@ .am-ib ul{display:grid;gap:0}
@@ .am-ib li a{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 2px;border-bottom:1px solid #f1f3f5;font:500 14.5px/1.3 var(--head);color:#3b4448!important;transition:color .15s,padding .2s}
${chev(".am-ib li a", "transparent")}
@@ .am-ib li a:hover,@@ .am-ib li a:focus-visible{color:var(--red)!important;padding-left:6px}
@@ .am-ib li a:hover::after{border-color:var(--red);transform:translateX(2px) rotate(45deg)}
@@ .am-ia{display:inline-flex;align-items:center;gap:8px;margin-top:12px;font:600 13.5px/1.2 var(--head);color:var(--pet)!important}
${chev(".am-ia", "currentColor")}
@@ .am-ia:hover::after{transform:translateX(3px) rotate(45deg)}
@media (max-width:1100px) and (min-width:901px){@@ .am-ib{padding:16px 16px 14px}@@ .am-ib li a{font-size:13.5px}}
@media (max-width:900px){@@ .am-ix{grid-template-columns:minmax(0,1fr);padding:4px 2px;border-radius:18px}@@ .am-ib{padding:16px 16px 14px}@@ .am-ib:not(:nth-child(${cols}n+1)){border-left:0}@@ .am-ib+.am-ib{border-top:1px solid #eef1f3}@@ .am-ib ul{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:14px}@@ .am-ib li a{font-size:13.5px}}`;
  return { css, html: `${header(s)}<div class="am-ix">${list.map(block).join("")}</div>` };
}

/* ── accordion: each category opens its subcategories ────────────────── */

function accordion(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const two = s.layout !== "one";
  const list = s.items.slice(0, 8);
  const item = (c: Card, i: number) => `<details class="am-ad"${i === 0 ? " open" : ""}><summary>${c.img ? `<span class="am-ap">${catPic(c, o, i > 1)}</span>` : ""}<span class="am-an"><b>${esc(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</span></summary>`
    + `<div class="am-ab"><ul>${subsOf(c).slice(0, 8).map((x) => `<li><a href="${href(x.url)}">${x.img ? `<span>${catPic(x, o)}</span>` : "<span></span>"}<b>${esc(x.name)}</b></a></li>`).join("")}</ul>`
    + `<a class="am-aa" href="${href(c.url)}">${esc(w.all)}: ${esc(c.name)}</a></div></details>`;
  const half = Math.ceil(list.length / 2);
  const cols = two ? [list.slice(0, half), list.slice(half)] : [list];
  const css = `
@@ .am-ac{display:grid;grid-template-columns:repeat(${cols.length},minmax(0,1fr));gap:12px;align-items:start}
@@ .am-acol{display:grid;gap:10px;min-width:0}
@@ .am-ad{border-radius:18px;background:#fff;box-shadow:0 10px 26px -22px rgba(27,58,75,.5),inset 0 0 0 1px #e8ecef;transition:box-shadow .2s}
@@ .am-ad[open]{box-shadow:0 18px 36px -26px rgba(27,58,75,.6),inset 0 0 0 1px #dbe2e6}
@@ .am-ad summary{position:relative;display:flex;align-items:center;gap:14px;padding:10px 54px 10px 10px;cursor:pointer;list-style:none;color:var(--ink)}
@@ .am-ad summary::-webkit-details-marker{display:none}
@@ .am-ad summary::after{content:"";position:absolute;right:22px;top:50%;width:9px;height:9px;margin-top:-7px;border:solid var(--red);border-width:0 2px 2px 0;transform:rotate(45deg);transition:transform .25s}
@@ .am-ad[open] summary::after{transform:translateY(4px) rotate(225deg)}
@@ .am-ap{flex:none;display:block;width:56px;height:56px;border-radius:12px;overflow:hidden;background:var(--tile)}
@@ .am-ap img{width:100%;height:100%;object-fit:cover}
@@ .am-an b{display:block;font:600 17px/1.2 var(--head);transition:color .15s}
@@ .am-ad summary:hover .am-an b{color:var(--pet)}
@@ .am-an em{display:block;margin-top:2px;font:500 12.5px/1.2 var(--head);font-style:normal;color:var(--mute)}
@@ .am-ab{padding:2px 16px 16px}
@@ .am-ab ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding-top:12px!important;border-top:1px solid #eef1f3}
@@ .am-ab li a{display:grid;grid-template-columns:36px minmax(0,1fr);align-items:center;gap:10px;min-height:46px;padding:5px 10px 5px 5px;border-radius:11px;background:#f5f7f8;color:var(--ink)!important;transition:background .15s}
@@ .am-ab li a:hover,@@ .am-ab li a:focus-visible{background:#fdf0ef}
@@ .am-ab li span{display:block;width:36px;height:36px;border-radius:8px;overflow:hidden;background:var(--tile)}
@@ .am-ab li img{width:100%;height:100%;object-fit:cover}
@@ .am-ab li b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:600 13.5px/1.22 var(--head);transition:color .15s}
@@ .am-ab li a:hover b{color:var(--red)}
@@ .am-aa{display:inline-flex;align-items:center;gap:8px;margin-top:12px;font:600 13.5px/1.2 var(--head);color:var(--pet)!important}
${chev(".am-aa", "currentColor")}
@@ .am-aa:hover::after{transform:translateX(3px) rotate(45deg)}
@media (max-width:900px){@@ .am-ac{grid-template-columns:minmax(0,1fr);gap:10px}@@ .am-ap{width:46px;height:46px}@@ .am-an b{font-size:16px}@@ .am-ab{padding:2px 10px 12px}@@ .am-ab li b{font-size:12.5px;-webkit-hyphens:auto;hyphens:auto;overflow-wrap:break-word}}`;
  return { css, html: `${header(s)}<div class="am-ac">${cols.map((c, k) => `<div class="am-acol">${c.map((x, i) => item(x, k * half + i)).join("")}</div>`).join("")}</div>` };
}

/* ── rows: wide category rows - photo, name, count, its subcategories ── */

function rows(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const list = s.items.slice(0, 8);
  const css = `
@@ .am-rg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
@@ .am-rw{position:relative;display:grid;grid-template-columns:150px minmax(0,1fr);align-items:center;gap:20px;min-height:116px;padding:8px 48px 8px 8px;border-radius:20px;background:#fff;color:var(--ink)!important;
  box-shadow:0 12px 30px -24px rgba(27,58,75,.55),inset 0 0 0 1px #e9edf0;transition:transform .2s,box-shadow .2s}
${chev(".am-rw")}
@@ .am-rw::after{position:absolute;right:24px;top:50%;margin-top:-4px}
@@ .am-rw:hover,@@ .am-rw:focus-visible{transform:translateX(3px);box-shadow:0 16px 30px -20px rgba(27,58,75,.5),inset 0 0 0 1px #dbe2e6}
@@ .am-rw:hover::after{border-color:var(--red);transform:translateX(3px) rotate(45deg)}
@@ .am-rp{display:block;align-self:stretch;min-height:100px;border-radius:14px;overflow:hidden;background:var(--tile)}
@@ .am-rp img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
@@ .am-rw:hover .am-rp img{transform:scale(1.06)}
@@ .am-rt{min-width:0}
@@ .am-rt b{display:block;font:600 19px/1.2 var(--head);transition:color .15s}
@@ .am-rw:hover .am-rt b{color:var(--red)}
@@ .am-rt em{display:block;margin-top:3px;font:500 13px/1.2 var(--head);font-style:normal;color:var(--mute)}
@@ .am-rt small{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;margin-top:8px;font:500 13px/1.35 var(--head);color:#4f5a60}
@media (max-width:1100px) and (min-width:901px){@@ .am-rw{grid-template-columns:110px minmax(0,1fr);gap:14px;padding-right:40px}@@ .am-rt b{font-size:17px}}
@media (max-width:900px){@@ .am-rg{grid-template-columns:minmax(0,1fr);gap:8px}@@ .am-rw{grid-template-columns:96px minmax(0,1fr);gap:14px;min-height:88px;padding:6px 40px 6px 6px;border-radius:16px}@@ .am-rp{min-height:76px}@@ .am-rt b{font-size:16px}@@ .am-rt small{display:none}}`;
  return {
    css,
    html: `${header(s)}<div class="am-rg">${list.map((c) => `<a class="am-rw" href="${href(c.url)}"><span class="am-rp">${catPic(c, o)}</span><span class="am-rt"><b>${esc(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}`
      + `${subsOf(c).length ? `<small>${subsOf(c).slice(0, 4).map((x) => esc(x.name)).join(" · ")}</small>` : ""}</span></a>`).join("")}</div>`,
  };
}

/* ── quick links: squared chips with a small photo ───────────────────── */

function quick(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const list = s.items.slice(0, 16);
  const t = s.title.trim();
  const css = `
@@ .am-qb{display:flex;align-items:flex-start;gap:18px;padding:16px 18px;border-radius:20px;background:#fff;box-shadow:0 12px 30px -26px rgba(27,58,75,.55),inset 0 0 0 1px #e8ecef}
@@ .am-qt{flex:none;max-width:200px;padding:8px 6px 0 4px}
@@ .am-qt .am-ey{margin-bottom:4px!important}
@@ .am-qt b{display:block;font:600 18px/1.2 var(--head);color:var(--ink)}
@@ .am-ql{flex:1;display:flex;flex-wrap:wrap;gap:8px;min-width:0}
@@ .am-qc{display:inline-flex;align-items:center;gap:10px;max-width:100%;padding:5px 14px 5px 5px;border-radius:10px;background:#f4f6f7;box-shadow:inset 0 0 0 1px #e8ecef;color:var(--ink)!important;font:600 14px/1.2 var(--head);transition:background .15s,box-shadow .15s,color .15s}
@@ .am-qc span{flex:none;display:block;width:34px;height:34px;border-radius:7px;overflow:hidden;background:var(--tile)}
@@ .am-qc img{width:100%;height:100%;object-fit:cover}
@@ .am-qc i{font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@@ .am-qc em{font:500 12px/1 var(--head);font-style:normal;color:var(--mute)}
@@ .am-qc:hover,@@ .am-qc:focus-visible{background:#fff;color:var(--red)!important;box-shadow:inset 0 0 0 1.5px rgba(216,9,1,.4),0 8px 18px -12px rgba(27,58,75,.5)}
@media (max-width:900px){@@ .am-qb{flex-direction:column;gap:10px;padding:14px 12px;border-radius:16px}@@ .am-qt{max-width:none;padding:2px 4px 0}@@ .am-qc{font-size:13px;padding-right:12px}@@ .am-qc span{width:30px;height:30px}@@ .am-qc em{display:none}}`;
  return {
    css,
    html: `<div class="am-qb">${t || s.eyebrow.trim() ? `<div class="am-qt">${s.eyebrow.trim() ? `<p class="am-ey">${esc(s.eyebrow.trim())}</p>` : ""}${t ? `<b>${esc(t)}</b>` : ""}</div>` : ""}`
      + `<div class="am-ql">${list.map((c) => `<a class="am-qc" href="${href(c.url)}">${c.img ? `<span>${catPic(c, o)}</span>` : ""}<i>${esc(c.name)}</i>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</a>`).join("")}</div></div>`,
  };
}

/* ── preview: a big list of names; its photo shows where the mouse rests ── */

function preview(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const list = s.items.slice(0, 7);
  const n = list.length;
  const items = list.map((c, i) => `<li><a class="am-vi" href="${href(c.url)}"><span class="am-vn">${String(i + 1).padStart(2, "0")}</span><b>${esc(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</a></li>`).join("");
  const panels = list.map((c, i) => `<div class="am-vp">${catPic(c, o, i > 0)}<div class="am-vc"><b>${esc(c.name)}</b>${subsOf(c).length ? `<span>${subsOf(c).slice(0, 4).map((x) => `<a href="${href(x.url)}">${esc(x.name)}</a>`).join("")}</span>` : ""}<a class="am-vg" href="${href(c.url)}">${esc(w.all)}</a></div></div>`).join("");
  const show: string[] = [];
  for (let k = 2; k <= n; k++) show.push(`@@ .am-pv:has(.am-vl>li:nth-child(${k})>a:is(:hover,:focus-visible)) .am-vp:nth-child(${k}),@@ .am-vp:nth-child(${k}):is(:hover,:focus-within)`);
  const css = `
@@ .am-pv{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.08fr);gap:28px;align-items:stretch}
@@ .am-vl{display:flex;flex-direction:column;justify-content:center;min-width:0}
@@ .am-vi{position:relative;display:grid;grid-template-columns:40px minmax(0,1fr) auto;align-items:baseline;gap:14px;padding:13px 40px 13px 6px;border-bottom:1px solid #e6eaed;color:var(--ink)!important;transition:padding .25s,color .15s}
@@ .am-vl>li:first-child .am-vi{border-top:1px solid #e6eaed}
@@ .am-vn{font:600 13px/1 var(--head);color:#6b757b;font-variant-numeric:tabular-nums;transition:color .15s}
@@ .am-vi b{font:600 clamp(19px,1.9vw,25px)/1.15 var(--head);letter-spacing:-.01em;transition:color .15s}
@@ .am-vi em{font:500 12.5px/1 var(--head);font-style:normal;color:var(--mute);white-space:nowrap}
@@ .am-vi::after{content:"";position:absolute;right:12px;top:50%;width:8px;height:8px;margin-top:-4px;border:solid var(--red);border-width:2px 2px 0 0;transform:rotate(45deg) translate(-6px,6px);opacity:0;transition:opacity .2s,transform .25s}
@@ .am-vi:is(:hover,:focus-visible){padding-left:14px}
@@ .am-vi:is(:hover,:focus-visible) b,@@ .am-vi:is(:hover,:focus-visible) .am-vn{color:var(--red)}
@@ .am-vi:is(:hover,:focus-visible)::after{opacity:1;transform:rotate(45deg)}
@@ .am-pv:not(:has(.am-vi:is(:hover,:focus-visible))) .am-vl>li:first-child .am-vi b{color:var(--red)}
@@ .am-vs{position:relative;display:grid;min-height:420px}
@@ .am-vp{grid-area:1/1;position:relative;border-radius:24px;overflow:hidden;background:#1b3a4b;isolation:isolate;clip-path:inset(0 0 0 100% round 24px);transition:clip-path .45s cubic-bezier(.2,.7,.2,1) .1s}
@@ .am-vp:first-child{clip-path:inset(0 round 24px)}
@@ .am-pv:has(.am-vl>li:not(:first-child)>a:is(:hover,:focus-visible)) .am-vp:first-child{clip-path:inset(0 0 0 100% round 24px)}
${show.length ? `${show.join(",")}{clip-path:inset(0 round 24px)}` : ""}
@@ .am-vp>img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;z-index:-2}
@@ .am-vp::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(20,40,52,0) 32%,rgba(20,40,52,.6) 60%,rgba(20,40,52,.9) 100%)}
@@ .am-vc{position:absolute;left:24px;right:24px;bottom:22px;color:#fff}
@@ .am-vc>b{display:block;font:600 26px/1.15 var(--head)}
@@ .am-vc span{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
@@ .am-vc span a{padding:6px 11px;border-radius:8px;background:rgba(255,255,255,.18);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.35);font:600 13px/1.2 var(--head);color:#fff!important}
@@ .am-vc span a:hover{background:#fff;color:var(--ink)!important}
@@ .am-vg{display:inline-flex;align-items:center;gap:8px;margin-top:14px;font:600 14.5px/1 var(--head);color:#fff!important}
${chev(".am-vg", "currentColor")}
@@ .am-vg:hover::after{transform:translateX(3px) rotate(45deg)}
@media (max-width:1100px) and (min-width:901px){@@ .am-pv{gap:18px}@@ .am-vs{min-height:380px}@@ .am-vi{padding:11px 34px 11px 4px}}
@media (max-width:900px){
@@ .am-pv{grid-template-columns:minmax(0,1fr);gap:14px}
@@ .am-vs{order:-1;min-height:220px}
@@ .am-vp:not(:first-child){display:none}
@@ .am-vp{border-radius:18px;clip-path:none!important}
@@ .am-vc{left:16px;right:16px;bottom:14px}@@ .am-vc>b{font-size:21px}@@ .am-vc span a:nth-child(n+3){display:none}
@@ .am-vi{grid-template-columns:30px minmax(0,1fr) auto;gap:10px;padding:11px 28px 11px 2px}
@@ .am-vi b{font-size:17px}
}`;
  return { css, html: `${header(s)}<div class="am-pv"><ol class="am-vl">${items}</ol><div class="am-vs">${panels}</div></div>` };
}

/* ── the entries ──────────────────────────────────────────────────────── */

export const NAVIGATION: ModuleDef[] = [
  {
    id: "nav-tiles", category: "navigation", name: "Category tiles", note: "Square category photos with the name under them - six or four in a row",
    needs: ["categories"], takes: "categories", kids: "subs", min: 3, max: 12, count: (s) => (s.layout === "4" ? 8 : 6),
    layouts: [{ key: "6", label: "6 per row" }, { key: "4", label: "4 per row" }], fields: HEAD, defaults: allLink, render: tiles,
    tags: ["tiles", "categories", "grid", "squares"],
    sample: { eyebrow: "Sortiment", title: "Unsere Technologien", link: { label: "Alle Produkte", url: P } },
  },
  {
    id: "nav-circles", category: "navigation", name: "Round category photos", note: "Categories as round photos with their names - a row to swipe on phones",
    needs: ["categories"], takes: "categories", kids: "subs", min: 4, max: 8, count: () => 8, layouts: [], fields: HEAD, defaults: allLink, render: circles,
    tags: ["circles", "round", "icons", "categories", "swipe"],
    sample: { eyebrow: "Sortiment", title: "Wählen Sie Ihre Technologie", link: { label: "Alle Produkte", url: P } },
  },
  {
    id: "nav-index", category: "navigation", name: "Category index", note: "Every category with its subcategories as plain links in columns - dense, no photos",
    needs: ["categories"], takes: "categories", kids: "subs", min: 2, max: 9, count: () => 6,
    layouts: [{ key: "3", label: "3 columns" }, { key: "2", label: "2 columns" }], fields: HEAD, defaults: allLink, render: index, gap: kidsGap,
    tags: ["index", "sitemap", "links", "list", "a-z", "dense"],
    sample: { eyebrow: "Sortiment", title: "Das ganze Sortiment auf einen Blick", link: { label: "Alle Produkte", url: P } },
  },
  {
    id: "nav-accordion", category: "navigation", name: "Category accordion", note: "Each category opens with a click into its subcategories, each with a small photo",
    needs: ["categories"], takes: "categories", kids: "subs", min: 2, max: 8, count: () => 6,
    layouts: [{ key: "two", label: "Two columns" }, { key: "one", label: "One column" }], fields: HEAD, defaults: allLink, render: accordion, gap: kidsGap,
    tags: ["accordion", "open", "details", "subcategories"],
    sample: { eyebrow: "Sortiment", title: "Finden Sie Ihren Bereich", link: { label: "Alle Produkte", url: P } },
  },
  {
    id: "nav-rows", category: "navigation", name: "Category rows", note: "Wide rows: the category's photo, its name and count, its first subcategories - two columns",
    needs: ["categories"], takes: "categories", kids: "subs", min: 2, max: 8, count: () => 6, layouts: [], fields: HEAD, defaults: allLink, render: rows,
    tags: ["rows", "list", "categories", "wide"],
    sample: { eyebrow: "Sortiment", title: "Sechs Technologien", link: { label: "Alle Produkte", url: P } },
  },
  {
    id: "nav-quick", category: "navigation", name: "Quick links", note: "The subcategories as small squared chips with a photo - for the top of a category page",
    needs: ["categories"], takes: "categories", kids: "subs", min: 2, max: 16, count: () => 12, layouts: [],
    fields: [{ kind: "eyebrow", label: "Small line above", max: 40 }, { kind: "title", label: "Title", max: 60 }], render: quick,
    tags: ["quick links", "chips", "subcategories", "shortcuts"],
    sample: { eyebrow: "Schnell zu", title: "Unseren Technologien" },
  },
  {
    id: "nav-preview", category: "navigation", name: "Category list with photo", note: "A big numbered list of categories; resting on one shows its photo and subcategories beside it",
    needs: ["categories"], takes: "categories", kids: "subs", min: 3, max: 7, count: () => 6, layouts: [], fields: HEAD, defaults: allLink, render: preview,
    tags: ["list", "hover", "preview", "editorial", "photo"],
    sample: { eyebrow: "Sortiment", title: "Wo möchten Sie anfangen?", link: { label: "Alle Produkte", url: P } },
  },
];
