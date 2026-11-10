// HEROES & INTROS (Content v7, 10.11.2026; SARCLA point 1: "more than 100 modules, by category, really high end"). The top
// of a page: a headline that says what the page is, a picture of the shop's own, the first step. Calm, product-first, the
// shop's red only on the button and the marked words. Drawn with the kit (../kit.ts); rules under `@@`.

import { BUTTONS, button, esc, href, icon, marked, nameOf, pic, wordsFor } from "../kit";
import type { FieldSpec, ModuleDef, ModuleRef, Opts } from "../types";

const F = {
  eyebrow: { kind: "eyebrow", label: "Small line above", max: 40 } as FieldSpec,
  title: { kind: "title", label: "Headline", max: 90, red: true } as FieldSpec,
  text: { kind: "text", label: "Line under it", max: 260, rows: 3 } as FieldSpec,
  link: { kind: "link", label: "Button" } as FieldSpec,
  link2: { kind: "link2", label: "Second button" } as FieldSpec,
  feature: { kind: "feature", label: "Picture" } as FieldSpec,
  promises: { kind: "points", label: "Promises under the buttons", max: 3, item: { title: "Words", text: "" }, hint: "Short and true - the shop's own promises." } as FieldSpec,
};

const promises3 = (store: string) => {
  const de = store.startsWith("de");
  return de
    ? [{ title: "Keine Zuschläge für Kleinbestellungen", text: "", icon: "check" }, { title: "Preise und Verfügbarkeit in Echtzeit", text: "", icon: "check" }, { title: "Zuschnitte nach Mass", text: "", icon: "check" }]
    : [{ title: "No surcharge for small orders", text: "", icon: "check" }, { title: "Real-time prices and availability", text: "", icon: "check" }, { title: "Cut-to-size", text: "", icon: "check" }];
};

/** The words of a hero: small line, headline (h2 - the page keeps its own h1), the line, the buttons. */
function words(m: ModuleRef, cls = "am-hw"): string {
  const s = m.settings;
  return `<div class="${cls}">${s.eyebrow.trim() ? `<p class="am-ey">${esc(s.eyebrow.trim())}</p>` : ""}<h2 class="am-hh">${marked(s.title.trim())}</h2>`
    + `${s.text.trim() ? `<p class="am-hx">${esc(s.text.trim())}</p>` : ""}`
    + `${s.link.url || s.link2.url ? `<div class="am-hb">${button(s.link, "am-btn")}${button(s.link2, "am-btn2")}</div>` : ""}`
    + `${s.points.some((p) => p.title.trim()) ? `<ul class="am-hp">${s.points.filter((p) => p.title.trim()).slice(0, 3).map((p) => `<li>${icon("check", 16)}${esc(p.title.trim())}</li>`).join("")}</ul>` : ""}</div>`;
}

const WORDS_CSS = `
@@ h2.am-hh{font-size:clamp(28px,3.3vw,46px)!important;line-height:1.08!important;letter-spacing:-.018em}
@@ .am-hx{margin-top:16px!important;max-width:520px;font-size:17px;line-height:1.6;color:var(--txt)}
@@ .am-hb{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
@@ .am-hp{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:26px!important;padding-top:18px!important;border-top:1px solid rgba(29,35,38,.1)}
@@ .am-hp li{display:flex;align-items:center;gap:7px;font:500 13.5px/1.3 var(--head);color:var(--ink)}
@@ .am-hp svg{flex:none;width:18px;height:18px;padding:3px;border-radius:50%;background:#fdf0ef;color:var(--red);stroke-width:2.4}
@media (max-width:900px){@@ .am-hx{font-size:15.5px;margin-top:12px!important}@@ .am-hb{margin-top:20px}@@ .am-hb>a{flex:1 1 auto;justify-content:center}@@ .am-hp{flex-direction:column;gap:8px;margin-top:20px!important;padding-top:14px!important}}`;

/* ── split: the words beside the picture ──────────────────────────────── */

function split(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const p = s.feature;
  const left = s.layout === "left";
  const cap = p && p.name.trim() && p.url ? `<a class="am-sc" href="${href(p.url)}"><b>${esc(p.name)}</b>${p.meta ? `<em>${esc(p.meta)}</em>` : ""}</a>` : "";
  const css = `${BUTTONS}${WORDS_CSS}
@@ .am-sp{display:grid;grid-template-columns:${left ? "minmax(0,1.08fr) minmax(0,1fr)" : "minmax(0,1fr) minmax(0,1.08fr)"};min-height:440px;border-radius:28px;overflow:hidden;background:linear-gradient(160deg,#f7f9fa 0%,#edf1f3 100%)}
@@ .am-hw{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:52px 56px}
@@ .am-sf{position:relative;min-height:320px;background:var(--tile);${left ? "order:-1;" : ""}}
@@ .am-sf img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}
@@ .am-sf.is-prod{background:#fff}
@@ .am-sf.is-prod img{left:10%;top:8%;width:80%;height:84%;object-fit:contain;mix-blend-mode:multiply}
@@ .am-sc{position:absolute;${left ? "right" : "left"}:18px;bottom:18px;display:flex;flex-direction:column;gap:1px;padding:11px 40px 12px 15px;border-radius:14px;background:rgba(255,255,255,.9);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 12px 28px -14px rgba(27,58,75,.5),inset 0 0 0 1px rgba(255,255,255,.8);color:var(--ink)!important;transition:transform .2s}
@@ .am-sc b{font:600 15.5px/1.2 var(--head)}
@@ .am-sc em{font:500 12.5px/1.3 var(--head);font-style:normal;color:var(--mute)}
@@ .am-sc::after{content:"";position:absolute;right:16px;top:50%;width:7px;height:7px;margin-top:-4px;border:solid var(--red);border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-sc:hover{transform:translateY(-2px)}
@@ .am-sc:hover::after{transform:translateX(3px) rotate(45deg)}
@media (max-width:1100px) and (min-width:901px){@@ .am-hw{padding:40px 36px}@@ .am-sp{min-height:400px}}
@media (max-width:900px){
@@ .am-sp{grid-template-columns:minmax(0,1fr);min-height:0;border-radius:20px}
@@ .am-sf{order:-1;min-height:0;aspect-ratio:16/10}
@@ .am-hw{padding:24px 20px 26px}
@@ .am-sc{left:12px;right:auto;bottom:12px;padding:9px 36px 10px 12px}
}`;
  return { css, html: `<div class="am-sp">${words(m)}${p ? `<div class="am-sf${p.kind === "product" ? " is-prod" : ""}">${pic(p, o, false)}${cap}</div>` : ""}</div>` };
}

/* ── cover: the picture fills, the words on a petrol veil ─────────────── */

function cover(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const p = s.feature;
  const centre = s.layout === "centre";
  const css = `${BUTTONS}${WORDS_CSS}
@@ .am-cv{position:relative;display:flex;align-items:${centre ? "center" : "flex-end"};justify-content:${centre ? "center" : "flex-start"};min-height:480px;border-radius:28px;overflow:hidden;background:var(--pet-d);isolation:isolate}
@@ .am-cv>img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;z-index:-2}
@@ .am-cv::before{content:"";position:absolute;inset:0;z-index:-1;background:${centre
    ? "radial-gradient(70% 90% at 50% 50%,rgba(20,44,58,.78) 0%,rgba(20,44,58,.55) 55%,rgba(20,44,58,.25) 100%)"
    : "linear-gradient(90deg,rgba(20,44,58,.92) 0%,rgba(20,44,58,.72) 38%,rgba(20,44,58,.12) 72%,rgba(20,44,58,0) 100%)"}}
@@ .am-hw{max-width:${centre ? "720px" : "600px"};padding:56px 60px;${centre ? "text-align:center;align-items:center;" : ""}display:flex;flex-direction:column;align-items:${centre ? "center" : "flex-start"}}
@@ .am-ey{color:#d5e1e8}
@@ .am-ey::before{background:#fff}
@@ h2.am-hh{color:#fff!important}
@@ .am-hx{color:#dbe6ec}
@@ .am-hb{${centre ? "justify-content:center;" : ""}}
@@ .am-hp{border-top-color:rgba(255,255,255,.22);${centre ? "justify-content:center;" : ""}}
@@ .am-hp li{color:#fff}
@@ .am-hp svg{background:rgba(255,255,255,.16);color:#fff}
@@ .am-red{color:#ff6a5f}
@media (max-width:900px){
@@ .am-cv{display:block;min-height:0;border-radius:20px;background:var(--pet-d)}
@@ .am-cv>img{position:relative;display:block;height:auto;aspect-ratio:16/10;z-index:0}
@@ .am-cv::before{inset:auto 0 0 0;top:0;height:auto;aspect-ratio:16/10;z-index:1;background:linear-gradient(180deg,rgba(20,44,58,0) 55%,rgba(27,58,75,1) 100%)}
@@ .am-hw{position:relative;z-index:2;max-width:none;margin-top:-28px;padding:0 20px 26px;text-align:left;align-items:flex-start}
@@ .am-hb,@@ .am-hp{justify-content:flex-start}
}`;
  return { css, html: `<div class="am-cv is-dark">${p ? pic(p, o, false) : ""}${words(m)}</div>` };
}

/* ── products: the words beside three of the shop's products, fanned ──── */

function products(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const three = s.items.slice(0, 3);
  // the strongest product in the middle, in front
  const order = three.length === 3 ? [three[1], three[0], three[2]] : three;
  const fan = order.map((c) => `<a class="am-fc" href="${href(c.url)}"><i>${pic(c, o, false)}</i><b>${nameOf(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}<span>${esc(w.go)}</span></a>`).join("");
  const css = `${BUTTONS}${WORDS_CSS}
@@ .am-pd{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.04fr);min-height:460px;border-radius:28px;overflow:hidden;background:linear-gradient(160deg,#f7f9fa 0%,#edf1f3 100%)}
@@ .am-hw{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:52px 20px 52px 56px}
@@ .am-fan{position:relative;min-height:400px;isolation:isolate}
@@ .am-fan::before{content:"";position:absolute;left:50%;top:50%;width:min(470px,92%);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;z-index:-1;
  background:radial-gradient(closest-side,#fff 0%,rgba(255,255,255,.75) 55%,rgba(255,255,255,0) 100%)}
@@ .am-fc{position:absolute;left:50%;top:50%;display:flex;flex-direction:column;width:clamp(168px,16vw,206px);padding:0 0 14px;border-radius:18px;background:#fff;color:var(--ink)!important;
  box-shadow:0 26px 44px -26px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2;transition:transform .45s cubic-bezier(.2,.7,.2,1),box-shadow .3s}
@@ .am-fc:nth-child(1){z-index:2;transform:translate(-50%,-52%)}
@@ .am-fc:nth-child(2){transform:translate(-136%,-44%) rotate(-7deg) scale(.88)}
@@ .am-fc:nth-child(3){transform:translate(36%,-44%) rotate(7deg) scale(.88)}
@@ .am-fc:nth-child(3)>:is(b,em){text-align:right}
@@ .am-fan:hover .am-fc:nth-child(2){transform:translate(-146%,-46%) rotate(-9deg) scale(.9)}
@@ .am-fan:hover .am-fc:nth-child(3){transform:translate(46%,-46%) rotate(9deg) scale(.9)}
@@ .am-fan .am-fc:is(:hover,:focus-visible){z-index:3;box-shadow:0 34px 50px -24px rgba(27,58,75,.6),inset 0 0 0 1px #dfe4e8}
@@ .am-fan .am-fc:nth-child(1):is(:hover,:focus-visible){transform:translate(-50%,-56%)}
@@ .am-fc>i{position:relative;display:block;height:clamp(150px,13vw,180px);margin-bottom:8px}
@@ .am-fc>i img{position:absolute;left:8%;top:8%;width:84%;height:88%;object-fit:contain;mix-blend-mode:multiply;filter:brightness(1.05) contrast(1.07)}
@@ .am-fc>b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:0 14px;font:600 15px/1.25 var(--head);min-height:2.5em}
@@ .am-fc>em{margin:3px 14px 0;font:500 12px/1.3 var(--head);font-style:normal;color:var(--mute)}
@@ .am-fc>span{display:inline-flex;align-items:center;gap:6px;margin:9px 14px 0;font:600 13px/1 var(--head);color:var(--red)}
@@ .am-fc>span::after{content:"";width:6px;height:6px;border:solid currentColor;border-width:1.7px 1.7px 0 0;transform:rotate(45deg)}
@@ .am-fc:not(:nth-child(1))>span{visibility:hidden}
@@ .am-fan:hover .am-fc:hover>span{visibility:visible}
@media (prefers-reduced-motion:reduce){@@ .am-fc{transition:none}}
@media (max-width:1100px) and (min-width:901px){@@ .am-hw{padding:40px 12px 40px 36px}@@ .am-fc{width:150px}@@ .am-fc>i{height:132px}}
@media (max-width:900px){
@@ .am-pd{grid-template-columns:minmax(0,1fr);min-height:0;border-radius:20px}
@@ .am-hw{padding:24px 20px 6px}
@@ .am-fan{min-height:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:16px 12px 20px}
@@ .am-fan::before{display:none}
@@ .am-fc,@@ .am-fc:nth-child(n),@@ .am-fan:hover .am-fc:nth-child(n){position:relative;left:auto;top:auto;width:auto;transform:none!important;padding-bottom:10px;border-radius:14px}
@@ .am-fc:nth-child(1){order:2}@@ .am-fc:nth-child(2){order:1}@@ .am-fc:nth-child(3){order:3}@@ .am-fc:nth-child(3)>:is(b,em){text-align:left}
@@ .am-fc>i{height:auto;aspect-ratio:1/.9;margin-bottom:6px}
@@ .am-fc>b{margin:0 9px;font-size:12.5px}
@@ .am-fc>em{margin:2px 9px 0;font-size:11px}
@@ .am-fc>span{display:none}
}`;
  return { css, html: `<div class="am-pd">${words(m)}<div class="am-fan">${fan}</div></div>` };
}

/* ── categories: the headline over a row of the shop's categories ─────── */

function categories(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const list = s.items.slice(0, 6);
  const n = Math.max(1, list.length);
  const tiles = list.map((c) => `<a class="am-ct" href="${href(c.url)}"><i>${pic({ ...c, kind: "category" }, o)}</i><b>${esc(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</a>`).join("");
  const css = `${BUTTONS}${WORDS_CSS}
@@ .am-hc{padding:48px 40px 40px;border-radius:28px;background:radial-gradient(90% 70% at 50% 0%,#fff 0%,#f4f7f8 55%,#ecf0f2 100%);text-align:center}
@@ .am-hw{display:flex;flex-direction:column;align-items:center;max-width:780px;margin:0 auto}
@@ .am-hx{max-width:620px}
@@ .am-hb{justify-content:center}
@@ .am-hp{justify-content:center;border-top:0;padding-top:0!important;margin-top:18px!important}
@@ .am-cr{display:grid;grid-template-columns:repeat(${n},minmax(0,1fr));gap:14px;margin-top:34px}
@@ .am-ct{display:flex;flex-direction:column;align-items:flex-start;padding:8px 8px 14px;border-radius:20px;background:#fff;text-align:left;color:var(--ink)!important;
  box-shadow:0 14px 30px -22px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2;transition:transform .25s,box-shadow .25s}
@@ .am-ct:is(:hover,:focus-visible){transform:translateY(-4px);box-shadow:0 22px 36px -22px rgba(27,58,75,.55),inset 0 0 0 1px #dfe4e8}
@@ .am-ct>i{position:relative;display:block;width:100%;aspect-ratio:4/3;border-radius:14px;overflow:hidden;background:var(--tile)}
@@ .am-ct>i img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;transition:transform .5s}
@@ .am-ct:hover>i img{transform:scale(1.06)}
@@ .am-ct>b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:11px 6px 0;font:600 15.5px/1.22 var(--head)}
@@ .am-ct>em{margin:3px 6px 0;font:500 12.5px/1.2 var(--head);font-style:normal;color:var(--mute)}
@media (max-width:1100px) and (min-width:901px){@@ .am-cr{gap:10px}@@ .am-hc{padding:40px 22px 30px}@@ .am-ct{padding:6px 6px 12px;border-radius:16px}@@ .am-ct>b{font-size:14px;margin:9px 4px 0}@@ .am-ct>em{margin:2px 4px 0}}
@media (max-width:900px){
@@ .am-hc{padding:28px 0 22px;border-radius:20px}
@@ .am-hw{padding:0 18px}
@@ .am-cr{display:flex;gap:10px;margin-top:22px;padding:4px 18px 10px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 18px;scrollbar-width:none}
@@ .am-ct{flex:0 0 42%;scroll-snap-align:start;border-radius:16px}
@@ .am-ct>b{font-size:14px}
}`;
  return { css, html: `<div class="am-hc">${words(m)}<div class="am-cr">${tiles}</div></div>` };
}

/* ── intro: an editorial page intro, no picture ───────────────────────── */

function intro(m: ModuleRef) {
  const s = m.settings;
  const centre = s.layout === "centre";
  const facts = s.points.filter((p) => p.title.trim()).slice(0, 3);
  const lead = s.text.trim();
  const ey = s.eyebrow.trim() ? `<p class="am-ey">${esc(s.eyebrow.trim())}</p>` : "";
  const list = facts.length ? `<ul class="am-in-f">${facts.map((p) => `<li><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<span>${esc(p.text.trim())}</span>` : ""}</li>`).join("")}</ul>` : "";
  const leadHtml = lead ? `<p class="am-in-l">${esc(lead)}</p>` : "";
  const css = `
@@ .am-in{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:28px 64px;align-items:start;padding:40px 4px 36px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
@@ h2.am-in-h{font-size:clamp(30px,3.6vw,52px)!important;line-height:1.06!important;letter-spacing:-.02em;max-width:640px}
@@ .am-in-l{font-size:17.5px;line-height:1.62;color:var(--txt)}
@@ .am-in-f{display:grid;margin-top:22px!important;border-top:1px solid var(--line)}
@@ .am-in-f li{display:grid;grid-template-columns:minmax(0,150px) minmax(0,1fr);align-items:baseline;gap:16px;padding:13px 0!important;border-bottom:1px solid var(--line)}
@@ .am-in-f b{font:600 26px/1.1 var(--head);color:var(--ink);letter-spacing:-.015em;font-variant-numeric:tabular-nums}
@@ .am-in-f span{font-size:14.5px;line-height:1.45;color:var(--txt)}
@@ .am-all{margin-top:20px}
@@ .am-in.is-c{display:block;padding:48px 4px 44px;text-align:center}
@@ .am-in.is-c .am-ey{justify-content:center}
@@ .am-in.is-c h2.am-in-h{max-width:860px;margin:0 auto!important}
@@ .am-in.is-c .am-in-l{max-width:720px;margin:18px auto 0!important}
@@ .am-in.is-c .am-in-f{grid-template-columns:repeat(${Math.max(1, facts.length)},minmax(0,1fr));max-width:820px;margin:30px auto 0!important;border:0}
@@ .am-in.is-c .am-in-f li{display:flex;flex-direction:column;align-items:center;gap:4px;padding:4px 18px!important;border:0}
@@ .am-in.is-c .am-in-f li+li{border-left:1px solid var(--line)}
@@ .am-in.is-c .am-in-f b{font-size:34px}
@@ .am-in.is-c .am-all{margin-top:26px}
@media (max-width:1100px) and (min-width:901px){@@ .am-in{gap:24px 36px}@@ .am-in-f li{grid-template-columns:minmax(0,120px) minmax(0,1fr)}}
@media (max-width:900px){
@@ .am-in{grid-template-columns:minmax(0,1fr);gap:16px;padding:26px 2px 24px}
@@ .am-in-l{font-size:16px}
@@ .am-in-f li{grid-template-columns:minmax(0,110px) minmax(0,1fr);gap:12px}
@@ .am-in-f b{font-size:21px}
@@ .am-in.is-c{padding:30px 2px 28px}
@@ .am-in.is-c .am-in-f{grid-template-columns:minmax(0,1fr);gap:14px}
@@ .am-in.is-c .am-in-f li+li{border-left:0;border-top:1px solid var(--line);padding-top:14px!important}
@@ .am-in.is-c .am-in-f b{font-size:26px}
}`;
  const html = centre
    ? `<div class="am-in is-c">${ey}<h2 class="am-in-h">${marked(s.title.trim())}</h2>${leadHtml}${list}${button(s.link, "am-all")}</div>`
    : `<div class="am-in"><div>${ey}<h2 class="am-in-h">${marked(s.title.trim())}</h2></div><div>${leadHtml}${list}${button(s.link, "am-all")}</div></div>`;
  return { css, html };
}

/* ── figures: the words beside three figures on petrol ────────────────── */

function figures(m: ModuleRef) {
  const s = m.settings;
  const figs = s.points.filter((p) => p.title.trim()).slice(0, 3);
  const css = `${BUTTONS}${WORDS_CSS}
@@ .am-hf{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:18px;align-items:stretch;padding:18px;border-radius:28px;background:linear-gradient(160deg,#f7f9fa 0%,#edf1f3 100%)}
@@ .am-hw{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:34px 24px 34px 38px}
@@ .am-fg{display:grid;grid-template-rows:repeat(${Math.max(1, figs.length)},1fr);padding:10px 30px;border-radius:20px;background:radial-gradient(120% 120% at 100% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%);box-shadow:0 26px 50px -30px rgba(27,58,75,.7)}
@@ .am-fg li{display:flex;flex-direction:column;justify-content:center;padding:18px 0!important}
@@ .am-fg li+li{border-top:1px solid rgba(255,255,255,.14)}
@@ .am-fg b{position:relative;padding-left:16px;font:600 clamp(32px,3.4vw,46px)/1 var(--head);color:#fff;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
@@ .am-fg b::before{content:"";position:absolute;left:0;top:.14em;bottom:.12em;width:4px;border-radius:2px;background:var(--red)}
@@ .am-fg span{margin-top:7px;padding-left:16px;font:500 14.5px/1.35 var(--head);color:#cfdde5}
@media (max-width:1100px) and (min-width:901px){@@ .am-hw{padding:26px 14px 26px 24px}@@ .am-fg{padding:6px 22px}}
@media (max-width:900px){
@@ .am-hf{grid-template-columns:minmax(0,1fr);padding:10px;border-radius:20px}
@@ .am-hw{padding:18px 12px 8px}
@@ .am-fg{grid-template-rows:none;grid-template-columns:minmax(0,1fr);padding:4px 20px;border-radius:16px}
@@ .am-fg li{padding:14px 0!important}
@@ .am-fg b{font-size:32px}
}`;
  return { css, html: `<div class="am-hf">${words({ ...m, settings: { ...s, points: [] } })}<ul class="am-fg">${figs.map((p) => `<li><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<span>${esc(p.text.trim())}</span>` : ""}</li>`).join("")}</ul></div>` };
}

/* ── category header: a category page's top, its subcategories as quick links ── */

function categoryHead(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const p = s.feature;
  const subs = s.items.slice(0, 10);
  const css = `
@@ .am-ch{display:grid;grid-template-columns:minmax(0,1fr) ${p ? "220px" : ""};gap:28px;align-items:center;padding:30px 30px 30px 36px;border-radius:24px;background:linear-gradient(120deg,#f7f9fa 0%,#edf1f3 100%)}
@@ h2.am-ch-h{font-size:clamp(26px,2.7vw,38px)!important;line-height:1.1!important;letter-spacing:-.015em}
@@ .am-ch-x{margin-top:10px!important;max-width:680px;font-size:16px;line-height:1.55;color:var(--txt)}
@@ .am-ql{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px!important}
@@ .am-ql a{display:inline-flex;align-items:center;gap:9px;height:44px;padding:0 14px 0 5px;border-radius:8px;background:#fff;font:600 14px/1.2 var(--head);color:var(--ink)!important;white-space:nowrap;
  box-shadow:0 6px 16px -12px rgba(27,58,75,.5),inset 0 0 0 1px #e3e8eb;transition:box-shadow .18s,color .18s,transform .18s}
@@ .am-ql a:is(:hover,:focus-visible){color:var(--red)!important;box-shadow:0 10px 20px -12px rgba(27,58,75,.5),inset 0 0 0 1px #d6dde2;transform:translateY(-1px)}
@@ .am-ql i{flex:none;width:34px;height:34px;border-radius:6px;overflow:hidden;background:var(--tile)}
@@ .am-ql i img{width:100%;height:100%;object-fit:cover}
@@ .am-chp{position:relative;aspect-ratio:1;border-radius:20px;overflow:hidden;background:var(--tile);box-shadow:0 22px 40px -26px rgba(27,58,75,.6)}
@@ .am-chp img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}
@@ .am-chp.is-prod{background:#fff}
@@ .am-chp.is-prod img{left:8%;top:8%;width:84%;height:84%;object-fit:contain;mix-blend-mode:multiply}
@media (max-width:900px){
@@ .am-ch{grid-template-columns:minmax(0,1fr) ${p ? "88px" : ""};gap:14px 16px;align-items:start;padding:20px 18px;border-radius:18px}
@@ .am-ch>div:first-child{display:contents}
@@ .am-ch-t{grid-column:1}
@@ .am-chp{grid-column:2;grid-row:1;border-radius:14px}
@@ .am-ql{grid-column:1/-1;flex-wrap:nowrap;overflow-x:auto;margin:0 -18px!important;padding:2px 18px 6px!important;scrollbar-width:none}
@@ .am-ch-x{font-size:15px}
}`;
  const text = `<div class="am-ch-t">${s.eyebrow.trim() ? `<p class="am-ey">${esc(s.eyebrow.trim())}</p>` : ""}<h2 class="am-ch-h">${marked(s.title.trim())}</h2>${s.text.trim() ? `<p class="am-ch-x">${esc(s.text.trim())}</p>` : ""}</div>`;
  return {
    css,
    html: `<div class="am-ch"><div>${text}${subs.length ? `<ul class="am-ql">${subs.map((c) => `<li><a href="${href(c.url)}"><i>${pic({ ...c, kind: "category" }, o)}</i>${esc(c.name)}</a></li>`).join("")}</ul>` : ""}</div>`
      + `${p ? `<div class="am-chp${p.kind === "product" ? " is-prod" : ""}">${pic(p, o, false)}</div>` : ""}</div>`,
  };
}

/* ── mosaic: the words beside a mosaic of the shop's categories ───────── */

function mosaic(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const four = s.layout === "4";
  const list = s.items.slice(0, four ? 4 : 3);
  const tiles = list.map((c) => `<a class="am-mt" href="${href(c.url)}">${pic({ ...c, kind: "category" }, o, false)}<span><b>${esc(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</span></a>`).join("");
  const css = `${BUTTONS}${WORDS_CSS}
@@ .am-hm{display:grid;grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr);gap:14px;align-items:stretch}
@@ .am-hw{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:44px 40px;border-radius:28px;background:linear-gradient(160deg,#f7f9fa 0%,#edf1f3 100%)}
@@ .am-mg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(200px,1fr));gap:14px;min-height:460px}
${four ? "" : "@@ .am-mt:first-child{grid-row:span 2}"}
@@ .am-mt{position:relative;display:block;overflow:hidden;border-radius:22px;background:var(--tile);color:var(--ink)!important;box-shadow:0 14px 30px -22px rgba(27,58,75,.55)}
@@ .am-mt img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;transition:transform .6s}
@@ .am-mt:is(:hover,:focus-visible) img{transform:scale(1.05)}
@@ .am-mt span{position:absolute;left:12px;bottom:12px;right:12px;display:flex;flex-direction:column;align-items:flex-start;width:max-content;max-width:calc(100% - 24px);padding:9px 34px 10px 14px;border-radius:13px;
  background:rgba(255,255,255,.92);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 10px 22px -14px rgba(27,58,75,.55)}
@@ .am-mt span::after{content:"";position:absolute;right:14px;top:50%;width:7px;height:7px;margin-top:-4px;border:solid var(--red);border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-mt:hover span::after{transform:translateX(3px) rotate(45deg)}
@@ .am-mt b{font:600 16px/1.2 var(--head)}
@@ .am-mt em{margin-top:1px;font:500 12px/1.2 var(--head);font-style:normal;color:var(--mute)}
@media (max-width:1100px) and (min-width:901px){@@ .am-hw{padding:32px 26px}@@ .am-mg{min-height:400px}}
@media (max-width:900px){
@@ .am-hm{grid-template-columns:minmax(0,1fr);gap:10px}
@@ .am-hw{padding:24px 20px 26px;border-radius:20px}
@@ .am-mg{min-height:0;grid-template-rows:none;grid-auto-rows:auto;gap:10px}
@@ .am-mt{height:150px}
${four ? "" : "@@ .am-mt:first-child{grid-row:auto;grid-column:1/-1;height:190px}"}
@@ .am-mt{border-radius:16px}
@@ .am-mt span{left:8px;bottom:8px;max-width:calc(100% - 16px);padding:7px 26px 8px 10px;border-radius:10px}
@@ .am-mt span::after{right:10px}
@@ .am-mt b{font-size:14px}
@@ .am-mt em{display:none}
}`;
  return { css, html: `<div class="am-hm">${words(m)}<div class="am-mg">${tiles}</div></div>` };
}

/* ── band: the quietest hero, one row ─────────────────────────────────── */

function band(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const p = s.feature;
  const dark = s.layout === "petrol";
  const css = `${BUTTONS}
@@ .am-bd{display:grid;grid-template-columns:${p ? "92px " : ""}minmax(0,1fr) auto;align-items:center;gap:26px;padding:18px 26px 18px ${p ? "18px" : "32px"};border-radius:20px;
  ${dark ? "background:radial-gradient(120% 160% at 0% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%)" : "background:linear-gradient(120deg,#f7f9fa 0%,#edf1f3 100%);box-shadow:inset 0 0 0 1px #e6ebee"}}
@@ .am-bdp{position:relative;width:92px;height:92px;border-radius:16px;overflow:hidden;background:${dark ? "rgba(255,255,255,.1)" : "#fff"}}
@@ .am-bdp img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}
@@ .am-bdp.is-prod{background:#fff}
@@ .am-bdp.is-prod img{left:8%;top:8%;width:84%;height:84%;object-fit:contain;mix-blend-mode:multiply}
@@ .am-ey{margin-bottom:5px!important${dark ? ";color:#cddbe3" : ""}}
${dark ? "@@ .am-ey::before{background:#fff}" : ""}
@@ h2.am-bh{font-size:clamp(21px,2vw,27px)!important;line-height:1.15!important;letter-spacing:-.01em${dark ? ";color:#fff!important" : ""}}
${dark ? "@@ .am-red{color:#ff6a5f}" : ""}
@@ .am-bx{margin-top:5px!important;font-size:15px;line-height:1.5;color:${dark ? "#cfdde5" : "var(--txt)"}}
@@ .am-bs{display:flex;gap:10px}
@media (max-width:900px){
@@ .am-bd{grid-template-columns:${p ? "64px " : ""}minmax(0,1fr);gap:14px;padding:16px}
@@ .am-bdp{width:64px;height:64px;border-radius:12px;align-self:start}
@@ .am-bs{grid-column:1/-1}
@@ .am-bs>a{flex:1 1 auto;justify-content:center}
}`;
  return {
    css,
    html: `<div class="am-bd${dark ? " is-dark" : ""}">${p ? `<div class="am-bdp${p.kind === "product" ? " is-prod" : ""}">${pic(p, o, false)}</div>` : ""}`
      + `<div>${s.eyebrow.trim() ? `<p class="am-ey">${esc(s.eyebrow.trim())}</p>` : ""}<h2 class="am-bh">${marked(s.title.trim())}</h2>${s.text.trim() ? `<p class="am-bx">${esc(s.text.trim())}</p>` : ""}</div>`
      + `${s.link.url || s.link2.url ? `<div class="am-bs">${button(s.link, "am-btn")}${button(s.link2, "am-btn2")}</div>` : ""}</div>`,
  };
}

/* ── the entries ──────────────────────────────────────────────────────── */

const heroDefaults = (store: string) => ({ link: { label: store.startsWith("de") ? "Zum Sortiment" : "To the range", url: "" }, points: promises3(store) });

export const HEROES: ModuleDef[] = [
  {
    id: "hero-split", category: "heroes", name: "Hero beside a picture", note: "A big headline, a line and two buttons beside a photo of the shop, its name on a glass label",
    needs: ["text", "picture"], takes: "none", min: 0, max: 0,
    layouts: [{ key: "right", label: "Picture right" }, { key: "left", label: "Picture left" }],
    fields: [F.eyebrow, F.title, F.text, F.link, F.link2, F.feature, F.promises], defaults: heroDefaults, render: split,
    tags: ["hero", "intro", "top", "split", "picture"],
    sample: {
      eyebrow: "Dichtungstechnik", title: "O-Ringe in ==jeder Grösse==, ab Lager bestellt",
      text: "31 Produkte und 31.264 Artikel - vom Standard-NBR bis FFKM. Mit Preisen, Lieferzeiten und Verfügbarkeit in Echtzeit.",
      link: { label: "Zu den O-Ringen", url: "https://www.apsoparts.com/de-CH/dichtungstechnik/o-ringe-x-ringe.html" },
      link2: { label: "Schnellbestellung", url: "https://www.apsoparts.com/de-CH/quickorder/" },
      feature: { kind: "category", name: "O-Ringe / X-Ringe", url: "https://www.apsoparts.com/de-CH/dichtungstechnik/o-ringe-x-ringe.html", img: "https://www.apsoparts.com/media/wysiwyg/1_ORings_XRings_1.jpg", meta: "31 Produkte", number: "", children: [] },
    },
  },
  {
    id: "hero-cover", category: "heroes", name: "Hero over a picture", note: "The photo fills the width; the headline and the buttons stand on a petrol veil",
    needs: ["text", "picture"], takes: "none", min: 0, max: 0,
    layouts: [{ key: "left", label: "Words left" }, { key: "centre", label: "Words in the middle" }],
    fields: [F.eyebrow, F.title, F.text, F.link, F.link2, F.feature, F.promises], defaults: heroDefaults, render: cover,
    tags: ["hero", "cover", "full", "photo", "dark"],
    sample: {
      eyebrow: "Kunststofftechnik", title: "Technische Kunststoffe, ==zugeschnitten== nach Mass",
      text: "Platten, Rundstäbe und Rohre - mit dem DirectCUT Konfigurator nach Mass zugeschnitten.",
      link: { label: "Zur Kunststofftechnik", url: "https://www.apsoparts.com/de-CH/kunststofftechnik.html" },
      link2: { label: "DirectCUT", url: "https://www.apsoparts.com/de-CH/service/directcut-configurator" },
      feature: { kind: "category", name: "Kunststofftechnik", url: "https://www.apsoparts.com/de-CH/kunststofftechnik.html", img: "https://www.apsoparts.com/media/wysiwyg/2_EngeneeringPlasticsTechnology_1.jpg", meta: "", number: "", children: [] },
    },
  },
  {
    id: "hero-products", category: "heroes", name: "Hero with three products", note: "The headline and the buttons beside three of the shop's products, fanned - resting on one brings it forward",
    needs: ["products", "text"], takes: "products", min: 3, max: 3, count: () => 3,
    layouts: [], fields: [F.eyebrow, F.title, F.text, F.link, F.link2, F.promises], defaults: heroDefaults, render: products,
    tags: ["hero", "products", "fan", "stack", "bestseller"],
    sample: {
      eyebrow: "Sortiment", title: "Dichtungen, Kunststoffe, Antriebe - ==ab Lager==",
      text: "Über 60.000 Artikel in sechs Technologien - mit Preisen, Lieferzeiten und Verfügbarkeit in Echtzeit.",
      link: { label: "Zum Sortiment", url: "https://www.apsoparts.com/de-CH/dichtungstechnik.html" },
      link2: { label: "Schnellbestellung", url: "https://www.apsoparts.com/de-CH/quickorder/" },
    },
  },
  {
    id: "hero-categories", category: "heroes", name: "Hero over category shortcuts", note: "A centred headline and line, then a row of the shop's categories, each with its photo and count",
    needs: ["categories", "text"], takes: "categories", kids: "subs", min: 3, max: 6, count: () => 6,
    layouts: [], fields: [F.eyebrow, F.title, F.text, F.link, F.link2], render: categories,
    tags: ["hero", "categories", "shortcuts", "centred", "start"],
    sample: {
      eyebrow: "APSOparts", title: "Industriekomponenten, ==online== bestellt",
      text: "Sechs Technologien und über 60.000 Artikel - wählen Sie Ihren Bereich.",
    },
  },
  {
    id: "hero-intro", category: "heroes", name: "Editorial page intro", note: "A large headline and a lead, with up to three key facts beside it - no picture, just words",
    needs: ["text"], takes: "none", min: 0, max: 0,
    layouts: [{ key: "side", label: "Headline beside the lead" }, { key: "centre", label: "All in the middle" }],
    fields: [F.eyebrow, F.title, { kind: "text", label: "Lead", max: 700, rows: 5 }, { kind: "points", label: "Key facts", max: 3, item: { title: "Figure or word", text: "What it says" }, hint: "Real figures only - the shop's counts, its promises." }, { kind: "link", label: "Link under it" }],
    render: (m) => intro(m), tags: ["intro", "editorial", "lead", "facts", "text"],
    sample: {
      eyebrow: "Dichtungstechnik", title: "Dichtungen für Maschinen und Anlagen, ==ab Lager==",
      text: "Von O-Ringen über Rotations- und Hubdichtungen bis zu Profilen und Dichtungsplatten: die Dichtungstechnik umfasst 258 Produkte mit 37.336 Artikeln. Jeder Artikel zeigt seinen Preis, seine Lieferzeit und seine Verfügbarkeit in Echtzeit.",
      points: [{ title: "258", text: "Produkte der Dichtungstechnik", icon: "check" }, { title: "37.336", text: "Artikel, jeder mit Preis und Verfügbarkeit", icon: "check" }, { title: "48/72 h", text: "Lieferung ab Lager in Europa", icon: "check" }],
      link: { label: "Zur Dichtungstechnik", url: "https://www.apsoparts.com/de-CH/dichtungstechnik.html" },
    },
  },
  {
    id: "hero-figures", category: "heroes", name: "Hero with figures", note: "The headline and the buttons beside three big figures on a petrol card",
    needs: ["text"], takes: "none", min: 0, max: 0,
    layouts: [], fields: [F.eyebrow, F.title, F.text, F.link, F.link2, { kind: "points", label: "Figures", max: 3, item: { title: "Figure", text: "What it counts" }, hint: "Real figures only - the shop's counts, its promises." }],
    defaults: (store) => ({ link: heroDefaults(store).link }), render: (m) => figures(m),
    gap: (m) => (m.settings.points.some((p) => p.title.trim()) ? "" : "Give it its figures"),
    tags: ["hero", "figures", "numbers", "stats", "facts"],
    sample: {
      eyebrow: "Dichtungstechnik", title: "Die passende Dichtung, ==sofort== bestellt",
      text: "O-Ringe, Rotations- und Hubdichtungen, Profile und Dichtungsplatten - mit Preisen, Lieferzeiten und Verfügbarkeit in Echtzeit.",
      link: { label: "Zur Dichtungstechnik", url: "https://www.apsoparts.com/de-CH/dichtungstechnik.html" },
      link2: { label: "Schnellbestellung", url: "https://www.apsoparts.com/de-CH/quickorder/" },
      points: [{ title: "258", text: "Produkte der Dichtungstechnik", icon: "check" }, { title: "37.336", text: "Artikel, jeder mit Preis und Verfügbarkeit", icon: "check" }, { title: "48/72 h", text: "Lieferung ab Lager in Europa", icon: "check" }],
    },
  },
  {
    id: "hero-category", category: "heroes", name: "Category header", note: "A category page's top: its name and line, its subcategories as quick links, a small photo",
    needs: ["categories", "text"], takes: "categories", kids: "subs", min: 2, max: 10, count: () => 8,
    layouts: [], fields: [F.eyebrow, { kind: "title", label: "Title", max: 90, red: true }, F.text, F.feature], render: categoryHead,
    tags: ["header", "category", "quick links", "subcategories", "compact"],
    sample: { eyebrow: "Sortiment", title: "Dichtungstechnik", text: "258 Produkte mit 37.336 Artikeln - von O-Ringen bis zu Dichtungsplatten." },
  },
  {
    id: "hero-mosaic", category: "heroes", name: "Hero beside a photo mosaic", note: "The headline and the buttons beside a mosaic of the shop's categories, each a link with its name",
    needs: ["categories", "text"], takes: "categories", kids: "subs", min: 3, max: 4, count: (s) => (s.layout === "4" ? 4 : 3),
    layouts: [{ key: "3", label: "One big, two small" }, { key: "4", label: "Four alike" }],
    fields: [F.eyebrow, F.title, F.text, F.link, F.link2, F.promises], defaults: heroDefaults, render: mosaic,
    tags: ["hero", "mosaic", "photos", "categories", "grid"],
    sample: {
      eyebrow: "Sortiment", title: "Sechs Technologien, ==ein== Shop",
      text: "Dichtungen, technische Kunststoffe, Schwingungs-, Fluid- und Antriebstechnik, Sensoren - über 60.000 Artikel.",
      link: { label: "Zum Sortiment", url: "https://www.apsoparts.com/de-CH/dichtungstechnik.html" },
    },
  },
  {
    id: "hero-band", category: "heroes", name: "Slim hero band", note: "One quiet row: a small photo, a short headline and line, one button - light or petrol",
    needs: ["text"], takes: "none", min: 0, max: 0,
    layouts: [{ key: "light", label: "Light" }, { key: "petrol", label: "Petrol" }],
    fields: [F.eyebrow, F.title, { kind: "text", label: "Line under it", max: 160, rows: 2 }, F.link, F.link2, F.feature],
    defaults: (store) => ({ link: heroDefaults(store).link }), render: band,
    tags: ["band", "slim", "compact", "intro", "row"],
    sample: {
      eyebrow: "Kunststofftechnik", title: "Platten ==nach Mass== zugeschnitten",
      text: "Platten, Rundstäbe und Rohre mit dem DirectCUT Konfigurator nach Mass konfigurieren.",
      link: { label: "Zu DirectCUT", url: "https://www.apsoparts.com/de-CH/service/directcut-configurator" },
    },
  },
];
