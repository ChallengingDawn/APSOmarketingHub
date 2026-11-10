// CAMPAIGNS & BANNERS (Content v7, 10.11.2026; SARCLA point 1: "more than 100 modules, by category, really high end"). A
// campaign's banner, a strip, its dates, its products - the shop's red where it calls to act. NEVER a discount value: a
// campaign says what it is and when, the price is the shop's (the brand brain: "no discount/urgency tactics or 'SALE'
// badges"). Drawn with the kit (../kit.ts); rules under `@@`.

import { BUTTONS, button, card, cardCss, esc, href, marked, nameOf, pic, wordsFor } from "../kit";
import type { FieldSpec, ModuleDef, ModuleRef, Opts, Point } from "../types";

const F = {
  eyebrow: { kind: "eyebrow", label: "Small line above", max: 40 } as FieldSpec,
  title: { kind: "title", label: "Headline", max: 90, red: true } as FieldSpec,
  text: { kind: "text", label: "Line under it", max: 240, rows: 2 } as FieldSpec,
  link: { kind: "link", label: "Button" } as FieldSpec,
  link2: { kind: "link2", label: "Second button" } as FieldSpec,
  feature: { kind: "feature", label: "Picture" } as FieldSpec,
};
const more = (store: string) => ({ link: { label: wordsFor(store).more, url: "" } });
const ey = (t: string, cls = "am-ey") => (t.trim() ? `<p class="${cls}">${esc(t.trim())}</p>` : "");
const banners = (m: ModuleRef, n: number) => m.settings.points.filter((p) => p.title.trim()).slice(0, n);
/** a teaser as a link to its page, or - no page yet - as a plain box */
const box = (cls: string, p: Point, inner: string) => (p.url ? `<a class="${cls}" href="${href(p.url)}">${inner}</a>` : `<div class="${cls}">${inner}</div>`);
const picOf = (p: Point, o: Opts, lazy = true) => (p.img ? pic({ kind: "category", name: p.title, url: p.url ?? "", img: p.img, meta: "", number: "", children: [] }, o, lazy) : "");

/* ── strip: one line, a squared tag, a link ───────────────────────────── */

function strip(m: ModuleRef) {
  const s = m.settings;
  const lay = s.layout || "red";
  const tag = s.eyebrow.trim() ? `<span class="am-tg">${esc(s.eyebrow.trim())}</span>` : "";
  const go = s.link.label.trim() && s.link.url ? `<span class="am-sg">${esc(s.link.label.trim())}</span>` : "";
  const inner = `${tag}<span class="am-sl">${marked(s.title.trim())}</span>${go}`;
  const bg = lay === "petrol" ? "radial-gradient(140% 220% at 0% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%)" : lay === "light" ? "#f3f5f6" : "linear-gradient(100deg,#d80901 0%,#c20800 100%)";
  const css = `
@@ .am-st{display:flex;align-items:center;gap:14px;min-height:58px;padding:9px 20px 9px 10px;border-radius:12px;background:${bg};color:${lay === "light" ? "var(--ink)" : "#fff"}!important;
  ${lay === "light" ? "box-shadow:inset 0 0 0 1px #e1e6e9;" : "box-shadow:0 14px 30px -22px rgba(27,58,75,.6);"}transition:transform .2s,box-shadow .2s}
@@ a.am-st:is(:hover,:focus-visible){transform:translateY(-1px)}
@@ .am-tg{flex:none;display:inline-flex;align-items:center;height:30px;padding:0 11px;border-radius:5px;font:600 11.5px/1 var(--head);letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;
  ${lay === "petrol" ? "background:var(--red);color:#fff" : lay === "light" ? "background:var(--pet);color:#fff" : "background:rgba(0,0,0,.2);color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)"}}
@@ .am-sl{flex:1;min-width:0;font:600 16.5px/1.35 var(--head)}
@@ .am-sl .am-red{color:${lay === "light" ? "var(--red)" : lay === "petrol" ? "#ffc2bc" : "#fff;text-decoration:underline;text-underline-offset:3px"}}
@@ .am-sg{flex:none;display:inline-flex;align-items:center;gap:8px;font:600 14.5px/1 var(--head);white-space:nowrap;${lay === "light" ? "color:var(--red)" : "color:#fff"}}
@@ .am-sg::after{content:"";width:7px;height:7px;border:solid currentColor;border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ a.am-st:hover .am-sg::after{transform:translateX(3px) rotate(45deg)}
@media (max-width:900px){
@@ .am-st{flex-wrap:wrap;gap:8px 12px;padding:12px 14px}
@@ .am-sl{flex:1 1 100%;order:2;font-size:15.5px}
@@ .am-sg{order:3}
}`;
  return { css, html: s.link.url ? `<a class="am-st" href="${href(s.link.url)}">${inner}</a>` : `<div class="am-st">${inner}</div>` };
}

/* ── duo: two banners side by side ────────────────────────────────────── */

function duo(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const list = banners(m, 2);
  const items = list.map((p, i) => box(`am-du${i % 2 ? " is-dark" : ""}`, p, `<span class="am-dt"><b>${marked(p.title.trim())}</b>${p.text.trim() ? `<em>${esc(p.text.trim())}</em>` : ""}${p.url ? `<span class="am-dg">${esc(w.more)}</span>` : ""}</span><i>${picOf(p, o)}</i>`)).join("");
  const css = `
@@ .am-dd{display:grid;grid-template-columns:repeat(${Math.max(1, list.length)},minmax(0,1fr));gap:14px}
@@ .am-du{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.9fr);min-height:270px;border-radius:22px;overflow:hidden;background:linear-gradient(150deg,#f7f9fa 0%,#f1f4f6 100%);color:var(--ink)!important;
  box-shadow:0 14px 30px -24px rgba(27,58,75,.6);transition:transform .25s,box-shadow .25s}
@@ .am-du.is-dark{background:radial-gradient(130% 160% at 0% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%);color:#fff!important}
@@ .am-du:is(:hover,:focus-visible){transform:translateY(-3px);box-shadow:0 22px 40px -24px rgba(27,58,75,.6)}
@@ .am-dt{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:28px 18px 28px 30px}
@@ .am-dt b{font:600 clamp(21px,2vw,27px)/1.15 var(--head);letter-spacing:-.01em}
@@ .is-dark .am-red{color:#ffc2bc}
@@ .am-dt em{margin-top:9px;font-style:normal;font-size:15px;line-height:1.5;color:var(--txt)}
@@ .is-dark .am-dt em{color:#cfdde5}
@@ .am-dg{display:inline-flex;align-items:center;gap:8px;margin-top:18px;font:600 14.5px/1 var(--head);color:var(--red)}
@@ .is-dark .am-dg{color:#fff}
@@ .am-dg::after{content:"";width:7px;height:7px;border:solid currentColor;border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-du:hover .am-dg::after{transform:translateX(3px) rotate(45deg)}
@@ .am-du>i{position:relative;display:block;margin:12px 12px 12px 0;border-radius:16px;overflow:hidden;background:linear-gradient(135deg,#e3e8eb,#cfd8dd)}
@@ .am-du>i img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;transition:transform .6s}
@@ .am-du:hover>i img{transform:scale(1.05)}
@media (max-width:1100px) and (min-width:901px){@@ .am-du{grid-template-columns:minmax(0,1fr);min-height:0}@@ .am-du>i{order:-1;margin:10px 10px 0;aspect-ratio:16/8}@@ .am-dt{padding:20px 22px 24px}}
@media (max-width:900px){
@@ .am-dd{grid-template-columns:minmax(0,1fr);gap:10px}
@@ .am-du{grid-template-columns:minmax(0,1fr);min-height:0;border-radius:18px}
@@ .am-du>i{order:-1;margin:8px 8px 0;aspect-ratio:16/9;border-radius:13px}
@@ .am-dt{padding:16px 18px 20px}
}`;
  return { css, html: `<div class="am-dd">${items}</div>` };
}

/* ── date: the campaign's dates as a block ────────────────────────────── */

function dated(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const p = s.feature;
  const from = (s.extra.from ?? "").trim();
  const to = (s.extra.to ?? "").trim();
  const until = (s.extra.until ?? "").trim() || (s.store.startsWith("de") ? "bis" : s.store.startsWith("fr") ? "au" : s.store.startsWith("it") ? "al" : "to");
  const css = `${BUTTONS}
@@ .am-da{display:grid;grid-template-columns:200px minmax(0,1fr) ${p ? "minmax(0,.85fr)" : ""};align-items:stretch;gap:0;border-radius:24px;overflow:hidden;background:linear-gradient(150deg,#f7f9fa 0%,#edf1f3 100%);box-shadow:inset 0 0 0 1px #e6ebee}
@@ .am-dk{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:4px;padding:28px 26px;background:linear-gradient(160deg,#e20a01 0%,#c10800 100%);color:#fff}
@@ .am-dk b{font:600 clamp(30px,2.8vw,40px)/1 var(--head);letter-spacing:-.015em;font-variant-numeric:tabular-nums}
@@ .am-dk.is-name b{font-size:clamp(24px,2.2vw,30px);line-height:1.1;overflow-wrap:anywhere}
@@ .am-da.is-bare{grid-template-columns:minmax(0,1fr) ${p ? "minmax(0,.85fr)" : ""}}
@@ .am-dk b i{display:block;margin-top:5px;font:600 13px/1 var(--head);font-style:normal;letter-spacing:.14em;color:#fff}
@@ .am-dk small{display:flex;align-items:center;gap:8px;width:100%;margin:6px 0;font:600 11px/1 var(--head);letter-spacing:.16em;text-transform:uppercase;color:#fff}
@@ .am-dk small::after{content:"";flex:1;height:1px;background:rgba(255,255,255,.35)}
@@ .am-dw{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:34px 38px}
@@ h2.am-dh{font-size:clamp(24px,2.4vw,34px)!important;line-height:1.12!important;letter-spacing:-.012em}
@@ .am-dx{margin-top:10px!important;max-width:480px;font-size:16px;line-height:1.55;color:var(--txt)}
@@ .am-dw .am-btn{margin-top:20px}
@@ .am-dp{position:relative;min-height:260px;background:var(--tile)}
@@ .am-dp img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}
@@ .am-dp.is-prod{background:#fff}
@@ .am-dp.is-prod img{left:10%;top:8%;width:80%;height:84%;object-fit:contain;mix-blend-mode:multiply}
@media (max-width:1100px) and (min-width:901px){@@ .am-da{grid-template-columns:170px minmax(0,1fr) ${p ? "minmax(0,.7fr)" : ""}}@@ .am-dw{padding:26px 26px}}
@media (max-width:900px){
@@ .am-da{grid-template-columns:minmax(0,1fr);border-radius:18px}
@@ .am-dk{flex-direction:row;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:14px 18px}
@@ .am-dk b{font-size:24px}
@@ .am-dk b i{display:inline;margin:0 0 0 6px;font-size:12px}
@@ .am-dk small{width:auto;margin:0}
@@ .am-dk small::after{display:none}
@@ .am-dp{order:-1;min-height:0;aspect-ratio:16/8}
@@ .am-dw{padding:20px 18px 22px}
@@ .am-dw .am-btn{align-self:stretch;justify-content:center}
}`;
  const day = (t: string) => { const y = /^(.*?\.)\s*(\d{4})$/.exec(t); return y ? `<b>${esc(y[1])}<i>${esc(y[2])}</i></b>` : `<b>${esc(t)}</b>`; };
  // no dates yet: the campaign's name stands in the block (its small line), never an invented date
  const name = !from && !to ? s.eyebrow.trim() : "";
  // one date alone says what it is: "until 27.11. 2026", "from 16.11." (Content v11 - a lone end date read as a bare date)
  const lang = s.store.slice(0, 2);
  const UNTIL: Record<string, string> = { de: "bis", fr: "jusqu'au", it: "fino al", nl: "tot", pl: "do", cs: "do", en: "until" };
  const FROM: Record<string, string> = { de: "ab", fr: "dès le", it: "dal", nl: "vanaf", pl: "od", cs: "od", en: "from" };
  const lone = from && !to ? FROM[lang] ?? FROM.en : !from && to ? UNTIL[lang] ?? UNTIL.en : "";
  const block = from || to ? `<div class="am-dk">${lone ? `<small>${esc(lone)}</small>` : ""}${from ? day(from) : ""}${from && to ? `<small>${esc(until)}</small>` : ""}${to ? day(to) : ""}</div>` : name ? `<div class="am-dk is-name"><b>${esc(name)}</b></div>` : "";
  return {
    css,
    html: `<div class="am-da${block ? "" : " is-bare"}">${block}<div class="am-dw">${name ? "" : ey(s.eyebrow)}<h2 class="am-dh">${marked(s.title.trim())}</h2>${s.text.trim() ? `<p class="am-dx">${esc(s.text.trim())}</p>` : ""}${button(s.link, "am-btn")}</div>`
      + `${p ? `<div class="am-dp${p.kind === "product" ? " is-prod" : ""}">${pic(p, o)}</div>` : ""}</div>`,
  };
}

/* ── products: a campaign panel beside its products ───────────────────── */

function withProducts(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const red = s.layout === "red";
  const list = s.items.slice(0, 4);
  const css = `${cardCss(list)}${BUTTONS}
@@ .am-cp{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,3fr);gap:14px;align-items:stretch}
@@ .am-cq{position:relative;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start;min-height:300px;padding:30px 28px;border-radius:22px;overflow:hidden;color:#fff;
  background:${red ? "linear-gradient(160deg,#e20a01 0%,#b40700 100%)" : "radial-gradient(130% 120% at 0% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%)"}}
@@ .am-cq::before{content:"";position:absolute;right:-60px;top:-60px;width:220px;height:220px;border-radius:50%;border:34px solid rgba(255,255,255,.07)}
@@ .am-cq .am-ey{color:#fff}
@@ .am-cq .am-ey::before{background:#fff}
@@ .am-cq h2.am-h{color:#fff!important;font-size:clamp(22px,2.1vw,29px)!important;line-height:1.15!important}
@@ .am-cq .am-red{color:${red ? "#fff;text-decoration:underline;text-underline-offset:4px" : "#ffc2bc"}}
@@ .am-cq p.am-sub{color:${red ? "#fff" : "#cfdde5"};font-size:15px}
@@ .am-cq .am-btn{margin-top:20px;${red ? "background:#fff;color:var(--red)!important" : ""}}
${red ? "@@ .am-cq .am-btn:is(:hover,:focus-visible){background:#ffe9e7}" : ""}
@@ .am-cl{display:grid;grid-template-columns:repeat(${Math.max(1, list.length)},minmax(0,1fr));gap:12px}
@@ .am-cl .am-pc>i{flex:none;aspect-ratio:1/.92}
@media (max-width:1100px) and (min-width:901px){@@ .am-cp{grid-template-columns:minmax(0,1.1fr) minmax(0,2fr)}@@ .am-cl{grid-template-columns:repeat(${Math.min(3, Math.max(1, list.length))},minmax(0,1fr))}@@ .am-cl .am-pc:nth-child(4){display:none}@@ .am-cq{padding:24px 22px}}
@media (max-width:900px){
@@ .am-cp{grid-template-columns:minmax(0,1fr);gap:10px}
@@ .am-cq{min-height:0;padding:22px 20px 24px;border-radius:18px}
@@ .am-cl{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
}`;
  return {
    css,
    html: `<div class="am-cp"><div class="am-cq">${ey(s.eyebrow)}<h2 class="am-h">${marked(s.title.trim())}</h2>${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}${button(s.link, "am-btn")}</div>`
      + `<div class="am-cl">${list.map((c) => card(c, o)).join("")}</div></div>`,
  };
}

/* ── cover: a campaign poster - the picture fills, a frame, the words at its foot ── */

function poster(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const p = s.feature;
  const css = `${BUTTONS}
@@ .am-po{position:relative;display:flex;flex-direction:column;justify-content:flex-end;min-height:470px;padding:42px 46px;border-radius:24px;overflow:hidden;background:var(--pet-d);isolation:isolate}
@@ .am-po>img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;z-index:-2;transition:transform 1.2s}
@@ .am-po:hover>img{transform:scale(1.03)}
@@ .am-po::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(0deg,rgba(14,30,40,.9) 0%,rgba(14,30,40,.55) 38%,rgba(14,30,40,0) 70%)}
@@ .am-po::after{content:"";position:absolute;inset:14px;border:1px solid rgba(255,255,255,.55);border-radius:14px;pointer-events:none}
@@ .am-ptg{position:absolute;left:30px;top:30px;display:inline-flex;align-items:center;height:32px;padding:0 13px;border-radius:5px;background:var(--red);color:#fff;font:600 12px/1 var(--head);letter-spacing:.14em;text-transform:uppercase}
@@ h2.am-ph{max-width:820px;color:#fff!important;font-size:clamp(32px,4.4vw,62px)!important;font-weight:700!important;line-height:1!important;letter-spacing:-.02em}
@@ .am-ph .am-red{color:#ffc2bc}
@@ .am-px{max-width:560px;margin-top:14px!important;font-size:17px;line-height:1.5;color:#e2ebf0}
@@ .am-pb{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
@media (max-width:900px){
@@ .am-po{min-height:430px;padding:26px 22px;border-radius:18px}
@@ .am-po::after{inset:9px;border-radius:11px}
@@ .am-ptg{left:20px;top:20px;height:28px;font-size:11px}
@@ .am-px{font-size:15.5px}
@@ .am-pb>a{flex:1 1 auto;justify-content:center}
}`;
  return {
    css,
    html: `<div class="am-po is-dark">${p ? pic(p, o, false) : ""}${s.eyebrow.trim() ? `<span class="am-ptg">${esc(s.eyebrow.trim())}</span>` : ""}<h2 class="am-ph">${marked(s.title.trim())}</h2>`
      + `${s.text.trim() ? `<p class="am-px">${esc(s.text.trim())}</p>` : ""}${s.link.url || s.link2.url ? `<div class="am-pb">${button(s.link, "am-btn")}${button(s.link2, "am-btn2")}</div>` : ""}</div>`,
  };
}

/* ── trio: three teaser cards ─────────────────────────────────────────── */

function trio(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const list = banners(m, 3);
  const head = s.title.trim() || s.eyebrow.trim()
    ? `<div class="am-hd"><div>${ey(s.eyebrow)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ""}</div>${s.link.url && s.link.label.trim() ? `<a class="am-all" href="${href(s.link.url)}">${esc(s.link.label.trim())}</a>` : ""}</div>` : "";
  const css = `
@@ .am-tr{display:grid;grid-template-columns:repeat(${Math.max(1, list.length)},minmax(0,1fr));gap:14px}
@@ .am-tc{display:flex;flex-direction:column;border-radius:20px;overflow:hidden;background:#fff;color:var(--ink)!important;box-shadow:0 14px 30px -22px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2;transition:transform .25s,box-shadow .25s}
@@ .am-tc:is(:hover,:focus-visible){transform:translateY(-3px);box-shadow:0 22px 38px -22px rgba(27,58,75,.55),inset 0 0 0 1px #dfe4e8}
@@ .am-tc>i{position:relative;display:block;aspect-ratio:16/10;background:linear-gradient(135deg,#e3e8eb,#cfd8dd);overflow:hidden}
@@ .am-tc>i img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;transition:transform .6s}
@@ .am-tc:hover>i img{transform:scale(1.05)}
@@ .am-tc>b{margin:18px 20px 0;font:600 19px/1.2 var(--head)}
@@ .am-tc>em{flex:1;margin:7px 20px 0;font-style:normal;font-size:14.5px;line-height:1.5;color:var(--txt)}
@@ .am-tc>span{display:inline-flex;align-items:center;gap:8px;margin:16px 20px 20px;font:600 14px/1 var(--head);color:var(--red)}
@@ .am-tc>span::after{content:"";width:7px;height:7px;border:solid currentColor;border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-tc:hover>span::after{transform:translateX(3px) rotate(45deg)}
@media (max-width:1100px) and (min-width:901px){@@ .am-tc>b{font-size:17px;margin:14px 16px 0}@@ .am-tc>em{margin:6px 16px 0;font-size:14px}@@ .am-tc>span{margin:14px 16px 16px}}
@media (max-width:900px){
@@ .am-tr{display:flex;gap:10px;margin:0 -10px;padding:2px 10px 12px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 10px;scrollbar-width:none}
@@ .am-tc{flex:0 0 80%;scroll-snap-align:start;border-radius:16px}
@@ .am-tc>b{font-size:17px;margin:14px 16px 0}
@@ .am-tc>em{margin:6px 16px 0;font-size:14px}
@@ .am-tc>span{margin:14px 16px 16px}
}`;
  return {
    css,
    html: `${head}<div class="am-tr">${list.map((p) => box("am-tc", p, `<i>${picOf(p, o)}</i><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<em>${esc(p.text.trim())}</em>` : "<em></em>"}${p.url ? `<span>${esc(w.more)}</span>` : ""}`)).join("")}</div>`,
  };
}

/* ── bold: big type, a product on a tilted card (the Black Friday look) ── */

function bold(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const p = s.feature;
  const css = `${BUTTONS}
@@ .am-bo{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:28px;align-items:center;min-height:440px;padding:40px 52px;border-radius:22px;overflow:hidden;
  background:linear-gradient(135deg,#fafafa 0%,#f4f4f4 50%,#efefef 100%)}
@@ .am-bo .am-ey{color:#000;letter-spacing:.16em;font-weight:700}
@@ .am-bo .am-ey::before{width:36px}
@@ h2.am-bh{margin:12px 0 0!important;font-size:clamp(48px,6.6vw,96px)!important;font-weight:800!important;line-height:.92!important;letter-spacing:-.015em;color:#000!important}
@@ .am-bh .am-red{color:#d80901}
@@ .am-bx{max-width:470px;margin-top:20px!important;font:400 17px/1.5 var(--head);color:#2a2a2a}
@@ .am-bb{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}
@@ .am-bo .am-btn{background:#e60000;border-radius:4px}
@@ .am-bo .am-btn:is(:hover,:focus-visible){background:#c40000}
@@ .am-bo .am-btn2{border:0;border-radius:4px;background:#fff;color:#000!important;box-shadow:inset 0 0 0 2px #000}
@@ .am-bo .am-btn2:is(:hover,:focus-visible){background:#000;color:#fff!important}
@@ .am-bk{position:relative;justify-self:center;width:min(100%,380px);aspect-ratio:1/1.05;border-radius:18px;background:#fff;transform:rotate(-4deg);
  box-shadow:0 2px 3px rgba(0,0,0,.05),0 34px 60px -30px rgba(0,0,0,.45);transition:transform .45s cubic-bezier(.2,.7,.2,1)}
@@ .am-bo:hover .am-bk{transform:rotate(-1deg) translateY(-4px)}
@@ .am-bk img{position:absolute;left:9%;top:9%;width:82%;height:82%;object-fit:contain;mix-blend-mode:multiply;filter:brightness(1.05) contrast(1.07)}
@@ .am-bk.is-cat{overflow:hidden}
@@ .am-bk.is-cat img{left:0;top:0;width:100%;height:100%;object-fit:cover;mix-blend-mode:normal;filter:none}
@@ .am-bk::after{content:"";position:absolute;left:-10px;top:22px;width:64px;height:12px;background:#e60000;transform:rotate(-8deg)}
@media (prefers-reduced-motion:reduce){@@ .am-bk{transition:none}}
@media (max-width:1100px) and (min-width:901px){@@ .am-bo{padding:34px 34px;gap:20px}}
@media (max-width:900px){
@@ .am-bo{grid-template-columns:minmax(0,1fr);gap:18px;min-height:0;padding:26px 22px 30px;border-radius:16px}
@@ h2.am-bh{font-size:clamp(44px,13vw,64px)!important}
@@ .am-bx{font-size:16px}
@@ .am-bb>a{flex:1 1 auto;justify-content:center}
@@ .am-bk{order:-1;width:62%;margin-top:6px}
}`;
  return {
    css,
    html: `<div class="am-bo"><div>${ey(s.eyebrow)}<h2 class="am-bh">${marked(s.title.trim())}</h2>${s.text.trim() ? `<p class="am-bx">${esc(s.text.trim())}</p>` : ""}`
      + `${s.link.url || s.link2.url ? `<div class="am-bb">${button(s.link, "am-btn")}${button(s.link2, "am-btn2")}</div>` : ""}</div>`
      + `${p ? `<a class="am-bk${p.kind === "category" ? " is-cat" : ""}" href="${href(p.url)}" aria-label="${esc(p.name)}">${pic(p, o, false)}</a>` : ""}</div>`,
  };
}

/* ── split: a dark band, the shop's products on white circles ─────────── */

function split(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const list = s.items.slice(0, 4);
  const css = `${BUTTONS}
@@ .am-sp{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:24px;align-items:center;padding:38px 46px;border-radius:24px;overflow:hidden;
  background:radial-gradient(90% 140% at 100% 50%,#2f5d76 0%,#274e64 40%,#1b3a4b 100%)}
@@ .am-sp .am-ey{color:#cddbe3}
@@ .am-sp .am-ey::before{background:#fff}
@@ .am-sp h2.am-h{color:#fff!important;font-size:clamp(25px,2.6vw,36px)!important;line-height:1.12!important}
@@ .am-sp .am-red{color:#ffc2bc}
@@ .am-sp p.am-sub{color:#cfdde5;font-size:16px;margin-top:10px!important}
@@ .am-sp .am-btn{margin-top:22px}
@@ .am-sc{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 22px;align-items:center}
@@ .am-sk{display:grid;grid-template-columns:104px minmax(0,1fr);align-items:center;gap:0 14px;color:#fff!important}
@@ .am-sk:nth-child(even){transform:translateY(18px)}
@@ .am-sk>i{position:relative;display:block;width:104px;height:104px;grid-row:span 2;border-radius:50%;background:#fff;box-shadow:0 18px 32px -16px rgba(0,0,0,.55),0 0 0 6px rgba(255,255,255,.08);transition:transform .35s cubic-bezier(.2,.7,.2,1)}
@@ .am-sk>i img{position:absolute;left:15%;top:15%;width:70%;height:70%;object-fit:contain;mix-blend-mode:multiply;filter:brightness(1.05) contrast(1.07)}
@@ .am-sk:is(:hover,:focus-visible)>i{transform:scale(1.06)}
@@ .am-sk>b{align-self:end;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:600 15px/1.25 var(--head);color:#fff;transition:color .18s}
@@ .am-sk:hover>b{color:#ffd9d6}
@@ .am-sk>em{align-self:start;margin-top:4px;font:500 12.5px/1.2 var(--head);font-style:normal;color:#d3e0e7}
@@ .am-sk>em::after{content:" \\2192";color:#fff;opacity:0;transition:opacity .18s}
@@ .am-sk:hover>em::after{opacity:1}
@media (max-width:1100px) and (min-width:901px){@@ .am-sp{padding:30px 30px}@@ .am-sk{grid-template-columns:80px minmax(0,1fr);gap:0 10px}@@ .am-sk>i{width:80px;height:80px}@@ .am-sk>b{font-size:13.5px}}
@media (max-width:900px){
@@ .am-sp{grid-template-columns:minmax(0,1fr);gap:22px;padding:24px 20px 28px;border-radius:18px}
@@ .am-sc{grid-template-columns:minmax(0,1fr);gap:12px}
@@ .am-sk{grid-template-columns:72px minmax(0,1fr)}
@@ .am-sk:nth-child(even){transform:none}
@@ .am-sk>i{width:72px;height:72px}
}`;
  return {
    css,
    html: `<div class="am-sp is-dark"><div>${ey(s.eyebrow)}<h2 class="am-h">${marked(s.title.trim())}</h2>${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}${button(s.link, "am-btn")}</div>`
      + `<div class="am-sc">${list.map((c) => `<a class="am-sk" href="${href(c.url)}"><i>${pic(c, o)}</i><b>${nameOf(c.name)}</b><em>${esc(c.meta)}</em></a>`).join("")}</div></div>`,
  };
}

/* ── the entries ──────────────────────────────────────────────────────── */

const pointsField = (n: number, label: string): FieldSpec => ({ kind: "points", label, min: n, max: n, item: { title: "Title", text: "One line" }, pictures: true, links: true, hint: "Each with a picture and a page of the shop." });
const pointsGap = (n: number) => (m: ModuleRef) => (banners(m, n).length >= n ? "" : `Write its ${n} teasers - each a title, a picture and a page of the shop`);

export const CAMPAIGNS: ModuleDef[] = [
  {
    id: "campaign-strip", category: "campaigns", name: "Announcement strip", note: "One slim line across the page: a squared tag, the news, a link - red, petrol or light",
    needs: ["text"], takes: "none", min: 0, max: 0,
    layouts: [{ key: "red", label: "Red" }, { key: "petrol", label: "Petrol" }, { key: "light", label: "Light" }],
    fields: [{ kind: "eyebrow", label: "Tag", max: 24 }, { kind: "title", label: "The line", max: 120, red: true }, { kind: "link", label: "Link" }],
    defaults: more, render: (m) => strip(m), tags: ["strip", "announcement", "bar", "news", "notice"],
    sample: {
      eyebrow: "DirectUP", title: "Bestellungen als Excel oder PDF hochladen - die Artikel landen ==im Warenkorb==",
      link: { label: "So geht's", url: "https://www.apsoparts.com/de-CH/service/directup-order-upload" },
    },
  },
  {
    id: "campaign-duo", category: "campaigns", name: "Two banners", note: "Two campaigns side by side, each with its picture, a title, a line and its page",
    needs: [], takes: "none", min: 0, max: 0, layouts: [],
    fields: [pointsField(2, "The two banners")], gap: pointsGap(2), render: duo,
    tags: ["banners", "two", "duo", "teasers", "side by side"],
    sample: {
      points: [
        { title: "Rotationsdichtungen", text: "35 Produkte mit 3.784 Artikeln - für Wellen und Achsen.", icon: "check", img: "https://www.apsoparts.com/media/wysiwyg/2_RotarySeals_1.jpg", url: "https://www.apsoparts.com/de-CH/dichtungstechnik/rotationsdichtungen.html" },
        { title: "Rundstäbe aus ==Kunststoff==", text: "73 Produkte mit 967 Artikeln, in vielen Werkstoffen.", icon: "check", img: "https://www.apsoparts.com/media/wysiwyg/6_EngineeringPlasticsTechnology_RoundBars_1.jpg", url: "https://www.apsoparts.com/de-CH/kunststofftechnik/rundstab.html" },
      ],
    },
  },
  {
    id: "campaign-date", category: "campaigns", name: "Campaign with its dates", note: "The dates as a big red block, the campaign's words and button, its picture",
    needs: ["text"], takes: "none", min: 0, max: 0, layouts: [],
    fields: [{ kind: "extra", key: "from", label: "Starts (e.g. 16.11.)", max: 16 }, { kind: "extra", key: "to", label: "Ends (e.g. 06.12.2026)", max: 16 }, F.eyebrow, F.title, F.text, F.link, F.feature],
    defaults: more, render: dated,
    tags: ["dates", "campaign", "period", "event", "black friday"],
    sample: {
      extra: { from: "16.11.", to: "06.12.2026" }, eyebrow: "Black Friday", title: "Ihr ==persönliches== Black-Friday-Angebot",
      text: "Melden Sie sich an - der persönliche Code Ihrer Firma wird nach der Anmeldung freigeschaltet.",
      link: { label: "Jetzt registrieren", url: "https://www.apsoparts.com/de-CH/customer/account/create/" },
    },
  },
  {
    id: "campaign-products", category: "campaigns", name: "Campaign with products", note: "A campaign panel on petrol or red beside three or four of the shop's products",
    needs: ["products", "text"], takes: "products", min: 3, max: 4, count: () => 4,
    layouts: [{ key: "petrol", label: "Petrol panel" }, { key: "red", label: "Red panel" }],
    fields: [F.eyebrow, F.title, F.text, F.link], defaults: (store) => ({ link: { label: wordsFor(store).all, url: "" } }), render: withProducts,
    tags: ["campaign", "products", "panel", "promotion", "selection"],
    sample: {
      eyebrow: "O-Ringe / X-Ringe", title: "O-Ringe ==in jeder Grösse==",
      text: "31 Produkte mit 31.264 Artikeln - vom Standard-NBR bis FFKM.",
      link: { label: "Zu den O-Ringen", url: "https://www.apsoparts.com/de-CH/dichtungstechnik/o-ringe-x-ringe.html" },
    },
  },
  {
    id: "campaign-cover", category: "campaigns", name: "Campaign poster", note: "The picture fills the box inside a thin frame; a red tag, a big headline and the button at its foot",
    needs: ["text", "picture"], takes: "none", min: 0, max: 0, layouts: [],
    fields: [{ kind: "eyebrow", label: "Tag", max: 24 }, F.title, F.text, F.link, F.link2, F.feature], defaults: more, render: poster,
    tags: ["poster", "cover", "photo", "big", "campaign"],
    sample: {
      eyebrow: "Fluidtechnik", title: "Schläuche und Armaturen, ==online== bestellt",
      text: "490 Produkte mit 4.270 Artikeln - für Industrie, Chemie und Pharma.",
      link: { label: "Zur Fluidtechnik", url: "https://www.apsoparts.com/de-CH/fluidtechnik.html" },
      feature: { kind: "category", name: "Fluidtechnik", url: "https://www.apsoparts.com/de-CH/fluidtechnik.html", img: "https://www.apsoparts.com/media/wysiwyg/4_Fluid_Handling_Technology_1.jpg", meta: "", number: "", children: [] },
    },
  },
  {
    id: "campaign-trio", category: "campaigns", name: "Three teasers", note: "Three cards, each a picture, a title, a line and its page - swiped on a phone",
    needs: [], takes: "none", min: 0, max: 0, layouts: [],
    fields: [F.eyebrow, { kind: "title", label: "Title above", max: 90 }, { kind: "link", label: "Link at the top right" }, pointsField(3, "The three teasers")],
    gap: pointsGap(3), render: trio,
    tags: ["teasers", "three", "cards", "trio", "grid"],
    sample: {
      eyebrow: "Sortiment", title: "Aus drei Technologien",
      points: [
        { title: "Profile, Rundschnüre und Bänder", text: "56 Produkte mit 588 Artikeln.", icon: "check", img: "https://www.apsoparts.com/media/wysiwyg/4_Profiles_RoundCords_Strips_1.jpg", url: "https://www.apsoparts.com/de-CH/dichtungstechnik/profile-rundschnure-und-bander.html" },
        { title: "Fluidtechnik", text: "490 Produkte mit 4.270 Artikeln: Schläuche und Armaturen.", icon: "check", img: "https://www.apsoparts.com/media/wysiwyg/4_Fluid_Handling_Technology_1.jpg", url: "https://www.apsoparts.com/de-CH/fluidtechnik.html" },
        { title: "Antriebstechnik", text: "341 Produkte mit 14.742 Artikeln.", icon: "check", img: "https://www.apsoparts.com/media/wysiwyg/5_Mechanical_Drive_Technology_1.jpg", url: "https://www.apsoparts.com/de-CH/antriebstechnik.html" },
      ],
    },
  },
  {
    id: "campaign-bold", category: "campaigns", name: "Bold campaign", note: "Huge type with a red word, a short line and two buttons beside a product on a tilted white card",
    needs: ["text"], takes: "none", min: 0, max: 0, layouts: [],
    fields: [F.eyebrow, { kind: "title", label: "Headline (short: two or three words)", max: 40, red: true }, F.text, F.link, F.link2, F.feature], defaults: more, render: bold,
    tags: ["bold", "black friday", "big type", "campaign", "typography"],
    sample: {
      eyebrow: "16.11. - 06.12.2026", title: "Black ==Friday==",
      text: "Ihr persönliches Black-Friday-Angebot: der Code Ihrer Firma wird nach der Anmeldung freigeschaltet.",
      link: { label: "Jetzt registrieren", url: "https://www.apsoparts.com/de-CH/customer/account/create/" },
      link2: { label: "Bereits Kunde? Anmelden", url: "https://www.apsoparts.com/de-CH/customer/account/" },
    },
  },
  {
    id: "campaign-split", category: "campaigns", name: "Products on a petrol band", note: "A dark petrol band: the words on one side, the shop's products on white circles on the other",
    needs: ["products", "text"], takes: "products", min: 2, max: 4, count: () => 4, layouts: [],
    fields: [F.eyebrow, F.title, F.text, F.link], defaults: (store) => ({ link: { label: wordsFor(store).all, url: "" } }), render: split,
    tags: ["dark", "petrol", "products", "circles", "band"],
    sample: {
      eyebrow: "Kunststofftechnik", title: "Technische Kunststoffe als ==Halbzeug==",
      text: "Platten, Rundstäbe und Rohre - 180 Produkte mit 2.090 Artikeln.",
      link: { label: "Zur Kunststofftechnik", url: "https://www.apsoparts.com/de-CH/kunststofftechnik.html" },
    },
  },
];
