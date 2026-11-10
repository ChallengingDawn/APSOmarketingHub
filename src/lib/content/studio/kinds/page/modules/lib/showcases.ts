// PRODUCT SHOWCASES (Content v7, 10.11.2026; SARCLA point 1: "more than 100 modules, by category, really high end"). The
// shop's own products - photo, name, the shop's article count - in rows, pages, a spotlight, a ranking, a wall, a moving
// strip. Never a price, never stock. Drawn with the kit (../kit.ts); every rule under `@@`; what moves is CSS only (radio
// inputs named by the module's own id, :hover, :focus-within, scroll-snap, one keyframe animation).

import { BUTTONS, button, card, cardCss, esc, header, href, langOf, nameOf, pic, wordsFor } from "../kit";
import type { Card, FieldSpec, ModuleDef, ModuleRef, Opts } from "../types";

const F = {
  eyebrow: { kind: "eyebrow", label: "Small line above", max: 40 } as FieldSpec,
  title: { kind: "title", label: "Title", max: 90 } as FieldSpec,
  text: { kind: "text", label: "Line under it", max: 220, rows: 2 } as FieldSpec,
  link: { kind: "link", label: "Link at the top right" } as FieldSpec,
};
const HEAD: FieldSpec[] = [F.eyebrow, F.title, F.link];
const allLink = (store: string) => ({ link: { label: wordsFor(store).all, url: "" } });

/** The words of the arrows, in the store view's language (read out, never shown). */
const ARROWS: Record<string, [string, string]> = { de: ["Zurück", "Weiter"], fr: ["Précédent", "Suivant"], it: ["Indietro", "Avanti"], en: ["Previous", "Next"], nl: ["Vorige", "Volgende"], pl: ["Wstecz", "Dalej"] };
const arrowsFor = (store: string) => ARROWS[langOf(store)] ?? ARROWS.en;

/** A product photo on white, in a box of the module's own class. */
const photo = (c: Card, o: Opts, cls: string, lazy = true) => `<span class="${cls}">${pic(c, o, lazy)}</span>`;
const PHOTO_IMG = (sel: string, inset = "8%") => `@@ ${sel} img{position:absolute;left:${inset};top:${inset};width:calc(100% - 2 * ${inset});height:calc(100% - 2 * ${inset});object-fit:contain;mix-blend-mode:multiply;filter:brightness(1.05) contrast(1.07);-webkit-mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,#000 70%,transparent 100%);mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,#000 70%,transparent 100%);transition:transform .35s}`;

/* ── carousel: pages of four, arrows and a progress line ─────────────── */

function carousel(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const [prev, next] = arrowsFor(s.store);
  const items = s.items.slice(0, 12);
  const per = 4;
  const pages: Card[][] = [];
  for (let i = 0; i < items.length; i += per) pages.push(items.slice(i, i + per));
  const P = pages.length;
  const name = `am-${s.id}-c`;
  const inputs = pages.map((_, k) => `<input type="radio" name="${name}" id="${name}${k + 1}" aria-label="${k + 1} / ${P}"${k ? "" : " checked"}>`).join("");
  const arrows = pages.map((_, k) => {
    const p = Math.max(1, k), n = Math.min(P, k + 2);
    return `<label for="${name}${p}" class="am-ca is-p${k === 0 ? " is-off" : ""}" data-k="${k + 1}" aria-label="${esc(prev)}"></label><label for="${name}${n}" class="am-ca${k === P - 1 ? " is-off" : ""}" data-k="${k + 1}" aria-label="${esc(next)}"></label>`;
  }).join("");
  const dots = pages.map((_, k) => `<label for="${name}${k + 1}" aria-label="${k + 1} / ${P}"></label>`).join("");
  const on: string[] = [];
  for (let k = 1; k <= P; k++) {
    if (k > 1) on.push(`@@ .am-cw>input:nth-of-type(${k}):checked~.am-cv .am-ct{transform:translateX(calc(${-(k - 1)} * (100% + 18px)))}`);
    on.push(`@@ .am-cw>input:nth-of-type(${k}):checked~.am-cb .am-cn label[data-k="${k}"]{display:grid}`);
    on.push(`@@ .am-cw>input:nth-of-type(${k}):checked~.am-cb .am-cd label:nth-child(${k}){background:var(--red)}`);
    on.push(`@@ .am-cw>input:nth-of-type(${k}):focus-visible~.am-cb .am-cd label:nth-child(${k}){outline:2px solid var(--red);outline-offset:3px}`);
  }
  const css = `${cardCss(items)}
@@ .am-cw{position:relative}
@@ .am-cw>input{position:absolute;left:0;top:0;width:1px;height:1px;margin:0;opacity:0;pointer-events:none}
@@ .am-cv{overflow:hidden;margin:-10px -10px 0;padding:10px 10px 16px}
@@ .am-ct{display:flex;gap:18px;transition:transform .6s cubic-bezier(.22,.8,.24,1)}
@@ .am-pg{flex:none;width:100%;display:grid;grid-template-columns:repeat(${per},minmax(0,1fr));gap:14px}
@@ .am-pg .am-pc>i{flex:none;aspect-ratio:1/.86}
@@ .am-cb{display:${P > 1 ? "flex" : "none"};align-items:center;gap:22px;margin-top:2px}
@@ .am-cd{flex:1;display:flex;gap:6px;max-width:420px}
@@ .am-cd label{flex:1;height:4px;border-radius:2px;background:#d9e0e5;cursor:pointer;transition:background .25s}
@@ .am-cd label:hover{background:#b9c4cb}
@@ .am-cn{display:flex;gap:8px;margin-left:auto}
@@ .am-ca{display:none;place-items:center;width:44px;height:44px;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 8px 20px -14px rgba(27,58,75,.55),inset 0 0 0 1px #dfe5e9;transition:box-shadow .2s,background .2s}
@@ .am-ca::before{content:"";width:9px;height:9px;margin-left:-4px;border:solid var(--ink);border-width:2px 2px 0 0;transform:rotate(45deg)}
@@ .am-ca.is-p::before{margin:0 -4px 0 0;transform:rotate(-135deg)}
@@ .am-ca:hover{box-shadow:0 10px 22px -12px rgba(27,58,75,.5),inset 0 0 0 1.5px var(--pet)}
@@ .am-ca.is-off{opacity:.35;cursor:default;pointer-events:none}
${on.join("\n")}
@media (max-width:1100px) and (min-width:901px){@@ .am-pg{gap:10px}@@ .am-pc>b{font-size:14px}}
@media (max-width:900px){
@@ .am-cv{overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:thin;scrollbar-color:#c9d1d6 transparent;margin:-6px -12px 0;padding:6px 12px 14px}
@@ .am-ct{transform:none!important;gap:10px;width:max-content}
@@ .am-pg{display:contents}
@@ .am-pg>.am-pc{width:calc((100vw - 54px) / 2.2);max-width:240px;scroll-snap-align:start}
@@ .am-cb{display:none}
}
@media (prefers-reduced-motion:reduce){@@ .am-ct{transition:none}}`;
  const track = pages.map((p) => `<div class="am-pg">${p.map((c) => card(c, o)).join("")}</div>`).join("");
  return { css, html: `<div class="am-box"><div class="am-cw">${inputs}${header(s)}<div class="am-cv"><div class="am-ct">${track}</div></div><div class="am-cb"><div class="am-cd">${dots}</div><div class="am-cn">${arrows}</div></div></div></div>` };
}

/* ── spotlight: one product big, three beside it ──────────────────────── */

function spotlight(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const [first, ...rest] = s.items.slice(0, 4);
  const right = s.layout === "right";
  const badge = (s.extra.badge ?? "").trim();
  const big = first ? `<div class="am-sx"><a class="am-sxp" href="${href(first.url)}" tabindex="-1" aria-hidden="true">${pic(first, o, false)}</a><div class="am-sxt">`
    + `${badge ? `<p class="am-sxb">${esc(badge)}</p>` : ""}<a class="am-sxn" href="${href(first.url)}">${nameOf(first.name)}</a>`
    + `${first.meta ? `<p class="am-sxm">${esc(first.meta)}${first.number ? ` · ${esc(first.number)}` : ""}</p>` : ""}${s.text.trim() ? `<p class="am-sxl">${esc(s.text.trim())}</p>` : ""}`
    + `<a class="am-btn" href="${href(first.url)}">${esc(w.go)}</a></div></div>` : "";
  const small = rest.map((c) => `<a class="am-sm" href="${href(c.url)}">${photo(c, o, "am-smp")}<span><b>${nameOf(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</span></a>`).join("");
  const css = `${BUTTONS}
@@ .am-sl{display:grid;grid-template-columns:${right ? "minmax(0,1fr) minmax(0,1.55fr)" : "minmax(0,1.55fr) minmax(0,1fr)"};gap:14px}
@@ .am-sx{${right ? "order:2;" : ""}position:relative;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);align-items:center;gap:10px;min-height:400px;padding:28px 34px 28px 22px;border-radius:24px;background:#fff;
  box-shadow:0 18px 40px -30px rgba(27,58,75,.6),inset 0 0 0 1px #edf0f2;overflow:hidden}
@@ .am-sxp{position:relative;align-self:stretch;min-height:300px}
@@ .am-sxp{background:radial-gradient(circle closest-side,#f3f6f7 0%,#edf1f3 82%,rgba(237,241,243,0) 100%)}
${PHOTO_IMG(".am-sxp", "7%")}
@@ .am-sx:hover .am-sxp img{transform:scale(1.04)}
@@ .am-sxt{display:flex;flex-direction:column;align-items:flex-start;min-width:0}
@@ .am-sxb{display:inline-block;margin-bottom:12px!important;padding:5px 10px;border-radius:6px;background:#fdf0ef;font:600 11.5px/1.2 var(--head);letter-spacing:.1em;text-transform:uppercase;color:var(--red)}
@@ .am-sxn{display:block;font:600 clamp(22px,2.2vw,30px)/1.12 var(--head);letter-spacing:-.01em;color:var(--ink)!important;overflow-wrap:break-word}
@@ .am-sxn:hover{color:var(--pet)!important}
@@ .am-sxm{margin-top:8px!important;font:500 14px/1.3 var(--head);color:var(--mute)}
@@ .am-sxl{margin-top:14px!important;font-size:15px;line-height:1.55;color:var(--txt)}
@@ .am-sxt .am-btn{margin-top:22px}
@@ .am-ss{display:grid;grid-template-rows:repeat(3,minmax(0,1fr));gap:14px}
@@ .am-sm{display:grid;grid-template-columns:104px minmax(0,1fr);align-items:center;gap:16px;padding:12px 40px 12px 12px;border-radius:20px;background:#fff;position:relative;
  box-shadow:0 12px 30px -22px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2;color:var(--ink)!important;transition:transform .2s,box-shadow .2s}
@@ .am-sm::after{content:"";position:absolute;right:20px;top:50%;width:7px;height:7px;margin-top:-4px;border:solid #a3abb0;border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:border-color .2s,transform .2s}
@@ .am-sm:hover{transform:translateY(-2px);box-shadow:0 18px 30px -18px rgba(27,58,75,.5),inset 0 0 0 1px #dfe4e8}
@@ .am-sm:hover::after{border-color:var(--red);transform:translateX(3px) rotate(45deg)}
@@ .am-smp{position:relative;display:block;aspect-ratio:1;border-radius:14px;background:#f6f8f9}
${PHOTO_IMG(".am-smp", "9%")}
@@ .am-sm b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:600 15.5px/1.25 var(--head)}
@@ .am-sm em{display:block;margin-top:4px;font:500 12.5px/1.2 var(--head);font-style:normal;color:var(--mute)}
@@ .am-sm:hover b{color:var(--red)}
@media (max-width:1100px) and (min-width:901px){@@ .am-sl{grid-template-columns:minmax(0,1.35fr) minmax(0,1fr)}@@ .am-sx{grid-template-columns:minmax(0,1fr);padding:22px 24px 26px;min-height:0}@@ .am-sxp{min-height:220px}@@ .am-sm{grid-template-columns:80px minmax(0,1fr);gap:12px}}
@media (max-width:900px){
@@ .am-sl{grid-template-columns:minmax(0,1fr)}
@@ .am-sx{order:0;grid-template-columns:minmax(0,1fr);min-height:0;padding:16px 18px 22px;border-radius:20px}
@@ .am-sxp{min-height:210px}
@@ .am-ss{grid-template-rows:none;gap:10px}
@@ .am-sm{grid-template-columns:76px minmax(0,1fr);gap:12px;padding:10px 36px 10px 10px;border-radius:16px}
@@ .am-sm b{font-size:14.5px}
}`;
  return { css, html: `<div class="am-box">${header({ ...s, text: "" })}<div class="am-sl">${big}<div class="am-ss">${small}</div></div></div>` };
}

/* ── compact list: small photo, name, number, count - many at a glance ── */

function list(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const cols = s.layout === "2" ? 2 : 3;
  const rows = s.items.slice(0, 12).map((c) => `<li><a class="am-lr" href="${href(c.url)}">${photo(c, o, "am-lp")}<span class="am-lt"><b>${nameOf(c.name)}</b><em>${[c.number, c.meta].filter(Boolean).map(esc).join(" · ")}</em></span></a></li>`).join("");
  const css = `
@@ .am-lw{border-radius:20px;background:#fff;box-shadow:0 14px 34px -28px rgba(27,58,75,.55),inset 0 0 0 1px #e6ebee;overflow:hidden}
@@ .am-ls{display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));margin:0 -1px -1px 0!important}
@@ .am-ls li{border-right:1px solid #edf0f2;border-bottom:1px solid #edf0f2;min-width:0}
@@ .am-lr{position:relative;display:grid;grid-template-columns:66px minmax(0,1fr);align-items:center;gap:14px;height:100%;padding:12px 40px 12px 12px;color:var(--ink)!important;transition:background .15s}
@@ .am-lr::after{content:"";position:absolute;right:20px;top:50%;width:7px;height:7px;margin-top:-4px;border:solid #b5bdc2;border-width:1.7px 1.7px 0 0;transform:rotate(45deg);transition:transform .2s,border-color .2s}
@@ .am-lr:hover,@@ .am-lr:focus-visible{background:#f6f8f9}
@@ .am-lr:hover::after{border-color:var(--red);transform:translateX(3px) rotate(45deg)}
@@ .am-lp{position:relative;display:block;width:66px;height:66px;border-radius:12px;background:#fff;box-shadow:inset 0 0 0 1px #edf0f2}
${PHOTO_IMG(".am-lp", "7%")}
@@ .am-lr:hover .am-lp img{transform:scale(1.07)}
@@ .am-lt{min-width:0}
@@ .am-lt b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:600 14.5px/1.25 var(--head);transition:color .15s}
@@ .am-lr:hover b{color:var(--red)}
@@ .am-lt em{display:block;margin-top:3px;font:500 12px/1.3 var(--head);font-style:normal;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
@media (max-width:1100px) and (min-width:901px){@@ .am-ls{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:900px){@@ .am-ls{grid-template-columns:minmax(0,1fr)}@@ .am-ls li:nth-child(n+9){display:none}@@ .am-lr{grid-template-columns:56px minmax(0,1fr);gap:12px;padding:10px 36px 10px 10px}@@ .am-lp{width:56px;height:56px}@@ .am-lw{border-radius:16px}}`;
  return { css, html: `${header(s)}<div class="am-lw"><ul class="am-ls">${rows}</ul></div>` };
}

/* ── tabs: a tab per category, its products under it ─────────────────── */

function tabs(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const cats = s.items.slice(0, 5);
  const name = `am-${s.id}-t`;
  const inputs = cats.map((_, k) => `<input type="radio" name="${name}" id="${name}${k + 1}"${k ? "" : " checked"}>`).join("");
  const labels = cats.map((c, k) => `<label for="${name}${k + 1}">${c.img ? `<span class="am-ti">${pic({ ...c, kind: "category" }, o, false)}</span>` : ""}${esc(c.name)}</label>`).join("");
  const kids = (c: Card) => c.children.filter((x) => x.kind === "product").slice(0, 4);
  const panels = cats.map((c) => `<div class="am-tp">${kids(c).map((x) => card(x, o)).join("")}`
    + `<a class="am-te" href="${href(c.url)}">${c.img ? pic({ ...c, kind: "category" }, o) : ""}<span><b>${esc(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}<i>${esc(w.all)}</i></span></a></div>`).join("");
  const on: string[] = [];
  cats.forEach((_, i) => {
    const k = i + 1;
    on.push(`@@ .am-tb>input:nth-of-type(${k}):checked~.am-tps>.am-tp:nth-child(${k}){display:grid}`);
    on.push(`@@ .am-tb>input:nth-of-type(${k}):checked~.am-tl>label:nth-child(${k}){background:#fdf0ef;color:var(--red);box-shadow:inset 0 0 0 1px rgba(216,9,1,.18)}`);
    on.push(`@@ .am-tb>input:nth-of-type(${k}):focus-visible~.am-tl>label:nth-child(${k}){outline:2px solid var(--red);outline-offset:2px}`);
  });
  const css = `${cardCss(cats.flatMap(kids))}
@@ .am-tb{position:relative}
@@ .am-tb>input{position:absolute;left:0;top:0;width:1px;height:1px;margin:0;opacity:0;pointer-events:none}
@@ .am-tl{display:flex;gap:6px;padding:6px;border-radius:16px;background:#fff;box-shadow:0 12px 30px -24px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2;overflow-x:auto;scrollbar-width:none}
@@ .am-tl label{flex:1 1 0;min-width:max-content;display:flex;align-items:center;justify-content:center;gap:10px;padding:8px 16px 8px 8px;border-radius:11px;cursor:pointer;font:600 15px/1.2 var(--head);color:var(--ink);white-space:nowrap;transition:background .15s,color .15s}
@@ .am-tl label:hover{background:#f4f6f7}
@@ .am-ti{flex:none;display:block;width:34px;height:34px;border-radius:9px;overflow:hidden;background:var(--tile)}
@@ .am-ti img{width:100%;height:100%;object-fit:cover}
@@ .am-tps{margin-top:14px}
@@ .am-tp{display:none;grid-template-columns:repeat(4,minmax(0,1fr)) minmax(0,.92fr);gap:12px}
@@ .am-tp .am-pc>i{flex:none;aspect-ratio:1/.9}
@@ .am-te{position:relative;display:flex;flex-direction:column;justify-content:flex-end;min-height:250px;border-radius:18px;overflow:hidden;background:var(--pet-d);color:#fff!important;isolation:isolate}
@@ .am-te img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;z-index:-2;transition:transform .5s}
@@ .am-te::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(27,58,75,0) 22%,rgba(27,58,75,.86) 62%,#1b3a4b 100%)}
@@ .am-te:hover img{transform:scale(1.05)}
@@ .am-te span{padding:16px 18px 18px}
@@ .am-te b{display:block;font:600 18px/1.2 var(--head)}
@@ .am-te em{display:block;margin-top:3px;font:500 13px/1.3 var(--head);font-style:normal;color:#cfdce4}
@@ .am-te i{display:inline-flex;align-items:center;gap:8px;margin-top:12px;font:600 14px/1 var(--head);font-style:normal}
@@ .am-te i::after{content:"";width:7px;height:7px;border:solid #fff;border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-te:hover i::after{transform:translateX(3px) rotate(45deg)}
${on.join("\n")}
@media (max-width:1100px) and (min-width:901px){@@ .am-tp{grid-template-columns:repeat(3,minmax(0,1fr)) minmax(0,.92fr)}@@ .am-tp>.am-pc:nth-of-type(4){display:none}@@ .am-tl label{font-size:14px;padding-right:12px}}
@media (max-width:900px){
@@ .am-tl{border-radius:14px}
@@ .am-tl label{flex:none;font-size:14px;padding:6px 14px 6px 6px}
@@ .am-tl{-webkit-mask-image:linear-gradient(90deg,#000 82%,transparent);mask-image:linear-gradient(90deg,#000 82%,transparent)}
@@ .am-ti{width:28px;height:28px}
@@ .am-tp{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@@ .am-te{grid-column:1/-1;min-height:120px}
}`;
  return { css, html: `<div class="am-box"><div class="am-tb">${inputs}${header(s)}<div class="am-tl" role="tablist">${labels}</div><div class="am-tps">${panels}</div></div></div>` };
}

/* ── ranked: the top five with their numbers ─────────────────────────── */

function ranked(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const items = s.items.slice(0, 5);
  const row = s.layout === "row";
  const num = (i: number) => `<span class="am-rn">${i + 1}</span>`;
  const html = row
    ? `<ol class="am-rq">${items.map((c, i) => `<li><a class="am-rc" href="${href(c.url)}">${num(i)}${photo(c, o, "am-rp")}<b>${nameOf(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</a></li>`).join("")}</ol>`
    : `<ol class="am-ro">${items.map((c, i) => i === 0
      ? `<li class="am-r1"><a class="am-rb" href="${href(c.url)}">${num(i)}${photo(c, o, "am-rp", false)}<span><b>${nameOf(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</span></a></li>`
      : `<li><a class="am-rr" href="${href(c.url)}">${num(i)}${photo(c, o, "am-rp")}<span><b>${nameOf(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</span></a></li>`).join("")}</ol>`;
  const css = `
@@ .am-rn{position:relative;z-index:2;font:600 64px/.8 var(--head);letter-spacing:-.04em;color:transparent;-webkit-text-stroke:1.6px #a9b8c1;font-variant-numeric:tabular-nums}
@@ li:first-child .am-rn{color:var(--red);-webkit-text-stroke:0}
@@ .am-rp{position:relative;display:block;border-radius:14px;background:#fff}
${PHOTO_IMG(".am-rp", "8%")}
@@ a:hover .am-rp img{transform:scale(1.06)}
@@ .am-rq a b,@@ .am-ro a b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:600 15.5px/1.25 var(--head);color:var(--ink);transition:color .15s}
@@ .am-rq a:hover b,@@ .am-ro a:hover b{color:var(--red)}
@@ .am-rq em,@@ .am-ro em{display:block;margin-top:4px;font:500 12.5px/1.2 var(--head);font-style:normal;color:var(--mute)}
${row ? `
@@ .am-rq{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}
@@ .am-rc{position:relative;display:flex;flex-direction:column;height:100%;padding:14px 16px 16px;border-radius:20px;background:#fff;box-shadow:0 12px 30px -22px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2;transition:transform .2s}
@@ .am-rc:hover{transform:translateY(-2px)}
@@ .am-rc .am-rn{position:absolute;left:14px;top:12px;z-index:1;font-size:56px}
@@ .am-rc .am-rp{aspect-ratio:1/.9;margin:0 0 10px 18px}
@media (max-width:1100px) and (min-width:901px){@@ .am-rq{gap:10px}@@ .am-rc .am-rn{font-size:46px}}
@media (max-width:900px){@@ .am-rq{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}@@ .am-rq li:first-child{grid-column:1/-1}@@ .am-rq li:first-child .am-rc{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center;column-gap:12px}@@ .am-rq li:first-child .am-rp{grid-row:1/span 3;margin:0}@@ .am-rc .am-rn{font-size:44px}}` : `
@@ .am-ro{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);grid-template-rows:repeat(4,minmax(0,1fr));gap:12px}
@@ .am-r1{grid-row:1/span 4}
@@ .am-rb{position:relative;display:flex;flex-direction:column;justify-content:flex-end;height:100%;min-height:420px;padding:26px 28px 28px;border-radius:24px;background:#fff;box-shadow:0 18px 40px -30px rgba(27,58,75,.6),inset 0 0 0 1px #edf0f2;color:var(--ink)!important}
@@ .am-rb .am-rn{position:absolute;left:24px;top:22px;font-size:120px}
@@ .am-rb .am-rp{flex:1;min-height:200px;margin:30px 0 14px}
@@ .am-rb b{font-size:22px!important;line-height:1.15!important}
@@ .am-rb em{font-size:14px!important}
@@ .am-rr{display:grid;grid-template-columns:62px 92px minmax(0,1fr);align-items:center;gap:16px;height:100%;padding:10px 44px 10px 18px;border-radius:20px;background:#fff;position:relative;
  box-shadow:0 12px 30px -22px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2;color:var(--ink)!important;transition:transform .2s}
@@ .am-rr::after{content:"";position:absolute;right:22px;top:50%;width:7px;height:7px;margin-top:-4px;border:solid #a3abb0;border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s,border-color .2s}
@@ .am-rr:hover{transform:translateX(3px)}
@@ .am-rr:hover::after{border-color:var(--red)}
@@ .am-rr .am-rn{font-size:58px;text-align:center}
@@ .am-rr .am-rp{width:92px;height:84px;background:#f6f8f9}
@media (max-width:1100px) and (min-width:901px){@@ .am-ro{grid-template-columns:minmax(0,.9fr) minmax(0,1.3fr)}@@ .am-rr{grid-template-columns:44px 76px minmax(0,1fr);gap:12px}@@ .am-rr .am-rn{font-size:46px}@@ .am-rr .am-rp{width:76px;height:70px}@@ .am-rb .am-rn{font-size:96px}}
@media (max-width:900px){@@ .am-ro{grid-template-columns:minmax(0,1fr);grid-template-rows:none;gap:10px}@@ .am-r1{grid-row:auto}@@ .am-rb{min-height:0;padding:18px 20px 20px}@@ .am-rb .am-rn{font-size:80px;left:16px;top:14px}@@ .am-rb .am-rp{flex:none;height:200px;margin:24px 0 10px}
@@ .am-rr{grid-template-columns:40px 64px minmax(0,1fr);gap:10px;padding:8px 36px 8px 10px}@@ .am-rr .am-rn{font-size:42px}@@ .am-rr .am-rp{width:64px;height:60px}@@ .am-ro a b{font-size:14.5px}}`}`;
  return { css, html: `${header(s)}${html}` };
}

/* ── duo: two products, large, side by side ──────────────────────────── */

function duo(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const items = s.items.slice(0, 2);
  const css = `${BUTTONS}
@@ .am-du{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
@@ .am-dc{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center;gap:8px;min-height:310px;padding:20px 28px 20px 16px;border-radius:24px;
  background:linear-gradient(150deg,#fff 0%,#fff 45%,#f1f5f7 100%);box-shadow:0 18px 40px -30px rgba(27,58,75,.6),inset 0 0 0 1px #edf0f2}
@@ .am-dp{position:relative;display:block;align-self:stretch;min-height:240px}
@@ .am-dp{background:radial-gradient(circle closest-side,#f2f5f6 0%,#ecf0f2 80%,rgba(236,240,242,0) 100%)}
${PHOTO_IMG(".am-dp", "6%")}
@@ .am-dc:hover .am-dp img{transform:scale(1.05) rotate(-2deg)}
@@ .am-dt{display:flex;flex-direction:column;align-items:flex-start;min-width:0}
@@ .am-dk{font:600 12px/1.2 var(--head);letter-spacing:.12em;text-transform:uppercase;color:var(--red)}
@@ .am-dn{display:block;margin-top:8px;font:600 clamp(19px,1.7vw,23px)/1.18 var(--head);color:var(--ink)!important;overflow-wrap:break-word}
@@ .am-dn:hover{color:var(--pet)!important}
@@ .am-dm{margin-top:8px!important;font:500 13.5px/1.3 var(--head);color:var(--mute)}
@@ .am-dt .am-btn{margin-top:20px;height:44px;padding:0 18px;font-size:15px}
@media (max-width:1100px) and (min-width:901px){@@ .am-dc{grid-template-columns:minmax(0,1fr);padding:16px 20px 22px}@@ .am-dp{min-height:190px}}
@media (max-width:900px){@@ .am-du{grid-template-columns:minmax(0,1fr);gap:10px}@@ .am-dc{grid-template-columns:42% minmax(0,1fr);min-height:0;padding:12px 16px 14px 8px;border-radius:20px}@@ .am-dp{min-height:150px}@@ .am-dt .am-btn{height:40px;margin-top:14px;font-size:14px}}`;
  const html = items.map((c, i) => `<div class="am-dc"><a class="am-dp" href="${href(c.url)}" tabindex="-1" aria-hidden="true">${pic(c, o, i > 0)}</a><div class="am-dt">`
    + `${c.number ? `<span class="am-dk">${esc(c.number)}</span>` : ""}<a class="am-dn" href="${href(c.url)}">${nameOf(c.name)}</a>${c.meta ? `<p class="am-dm">${esc(c.meta)}</p>` : ""}`
    + `<a class="am-btn is-pet" href="${href(c.url)}">${esc(w.go)}</a></div></div>`).join("");
  return { css, html: `${header(s)}<div class="am-du">${html}</div>` };
}

/* ── wall: the photos only, names on hover ───────────────────────────── */

function wall(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const cols = s.layout === "4" ? 4 : 6;
  const items = s.items.slice(0, cols === 4 ? 8 : 12);
  const css = `
@@ .am-ww{border-radius:24px;background:#fff;box-shadow:0 18px 40px -32px rgba(27,58,75,.6),inset 0 0 0 1px #e6ebee;overflow:hidden}
@@ .am-wl{display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));margin:0 -1px -1px 0!important}
@@ .am-wl li{border-right:1px solid #edf0f2;border-bottom:1px solid #edf0f2;min-width:0}
@@ .am-wc{position:relative;display:block;aspect-ratio:1;overflow:hidden;color:var(--ink)!important}
@@ .am-wc img{position:absolute;left:13%;top:11%;width:74%;height:74%;object-fit:contain;mix-blend-mode:multiply;filter:brightness(1.05) contrast(1.07);transition:transform .45s cubic-bezier(.2,.7,.2,1)}
@@ .am-wc:hover img,@@ .am-wc:focus-visible img{transform:scale(1.08) translateY(-6%)}
@@ .am-wn{position:absolute;left:10px;right:10px;bottom:10px;padding:9px 11px 10px;border-radius:12px;background:rgba(255,255,255,.95);box-shadow:0 10px 24px -12px rgba(27,58,75,.5),inset 0 0 0 1px #edf0f2;
  transform:translateY(calc(100% + 14px));transition:transform .3s cubic-bezier(.2,.7,.2,1)}
@@ .am-wc:hover .am-wn,@@ .am-wc:focus-visible .am-wn{transform:none}
@@ .am-wn b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:600 13.5px/1.22 var(--head)}
@@ .am-wn em{display:block;margin-top:2px;font:500 11.5px/1.2 var(--head);font-style:normal;color:var(--mute)}
@media (hover:none){@@ .am-wn{position:static;display:block;transform:none;margin:0 9px 10px;padding:0;background:none;box-shadow:none}@@ .am-wc{aspect-ratio:auto}@@ .am-wc img{position:static;display:block;width:100%;height:auto;aspect-ratio:1;padding:10%;margin:0}}
@media (max-width:1100px) and (min-width:901px){@@ .am-wl{grid-template-columns:repeat(${cols === 6 ? 4 : 4},minmax(0,1fr))}${cols === 6 ? "@@ .am-wl li:nth-child(n+9){display:none}" : ""}}
@media (max-width:900px){@@ .am-ww{border-radius:18px}@@ .am-wl{grid-template-columns:repeat(3,minmax(0,1fr))}${cols === 6 ? "" : "@@ .am-wl li:nth-child(n+7){display:none}"}
@@ .am-wn{position:static;display:block;transform:none;margin:0 9px 10px;padding:0;background:none;box-shadow:none}@@ .am-wn b{font-size:12px}@@ .am-wn em{display:none}
@@ .am-wc{aspect-ratio:auto}@@ .am-wc img{position:static;display:block;width:100%;height:auto;aspect-ratio:1;padding:10%;transform:none!important}}`;
  return { css, html: `${header(s)}<div class="am-ww"><ul class="am-wl">${items.map((c) => `<li><a class="am-wc" href="${href(c.url)}">${pic(c, o)}<span class="am-wn"><b>${nameOf(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</span></a></li>`).join("")}</ul></div>` };
}

/* ── shelf: a petrol panel with the words, four products beside it ──── */

function shelf(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const right = s.layout === "right";
  const items = s.items.slice(0, 4);
  const panel = `<div class="am-pn is-dark">${s.eyebrow.trim() ? `<p class="am-ey">${esc(s.eyebrow.trim())}</p>` : ""}<h2 class="am-ph">${esc(s.title.trim())}</h2>`
    + `${s.text.trim() ? `<p class="am-px">${esc(s.text.trim())}</p>` : ""}${button(s.link, "am-btn2")}</div>`;
  const css = `${cardCss(items)}${BUTTONS}
@@ .am-sh{display:grid;grid-template-columns:${right ? "repeat(4,minmax(0,1fr)) minmax(0,1.15fr)" : "minmax(0,1.15fr) repeat(4,minmax(0,1fr))"};gap:12px}
@@ .am-pn{${right ? "order:2;" : ""}display:flex;flex-direction:column;align-items:flex-start;min-height:300px;padding:26px 24px 24px;border-radius:20px;color:#fff;
  background:radial-gradient(120% 120% at 0% 0%,#2f5d76 0%,#274e64 48%,#1b3a4b 100%);box-shadow:0 18px 40px -28px rgba(27,58,75,.8)}
@@ .am-pn .am-ey{color:#cddbe3}
@@ .am-pn .am-ey::before{background:#fff}
@@ h2.am-ph{font-size:clamp(21px,1.9vw,26px)!important;line-height:1.15!important;color:#fff!important}
@@ .am-px{margin-top:10px!important;font-size:14.5px;line-height:1.55;color:#cddbe3}
@@ .am-pn .am-btn2{margin-top:auto;height:44px;padding:0 18px;font-size:15px}
@@ .am-sh>.am-pc>i{flex:none;aspect-ratio:1/.95}
@media (max-width:1100px) and (min-width:901px){@@ .am-sh{grid-template-columns:${right ? "repeat(3,minmax(0,1fr)) minmax(0,1.1fr)" : "minmax(0,1.1fr) repeat(3,minmax(0,1fr))"}}@@ .am-sh>.am-pc:nth-of-type(4){display:none}}
@media (max-width:900px){@@ .am-sh{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}@@ .am-pn{order:0;grid-column:1/-1;min-height:0;padding:20px 18px}@@ .am-pn .am-btn2{margin-top:16px}}`;
  return { css, html: `<div class="am-sh">${panel}${items.map((c) => card(c, o)).join("")}</div>` };
}

/* ── marquee: a slowly moving strip of the products ──────────────────── */

function marquee(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const items = s.items.slice(0, 12);
  const chip = (c: Card, hidden: boolean) => `<a class="am-mc" href="${href(c.url)}"${hidden ? ' tabindex="-1"' : ""}>${photo(c, o, "am-mp")}<span><b>${nameOf(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</span></a>`;
  const secs = Math.max(30, items.length * 5);
  const css = `
@@ .am-mq{position:relative;overflow:hidden;margin:0 -10px;padding:8px 10px 18px;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 7%,#000 93%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 7%,#000 93%,transparent 100%)}
@@ .am-mt{display:flex;gap:14px;width:max-content;animation:am${s.id}mq ${secs}s linear infinite}
@@ .am-mt>div{display:flex;gap:14px}
@@ .am-mq:hover .am-mt,@@ .am-mq:focus-within .am-mt{animation-play-state:paused}
@@ .am-mc{flex:none;display:grid;grid-template-columns:76px minmax(0,1fr);align-items:center;gap:14px;width:300px;padding:10px 18px 10px 10px;border-radius:18px;background:#fff;
  box-shadow:0 12px 26px -20px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2;color:var(--ink)!important;transition:transform .2s,box-shadow .2s}
@@ .am-mc:hover{transform:translateY(-3px);box-shadow:0 18px 30px -18px rgba(27,58,75,.5),inset 0 0 0 1px #dfe4e8}
@@ .am-mp{position:relative;display:block;width:76px;height:76px;border-radius:13px;background:#f6f8f9}
${PHOTO_IMG(".am-mp", "8%")}
@@ .am-mc b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:600 14.5px/1.25 var(--head);transition:color .15s}
@@ .am-mc:hover b{color:var(--red)}
@@ .am-mc em{display:block;margin-top:3px;font:500 12px/1.2 var(--head);font-style:normal;color:var(--mute)}
@keyframes am${s.id}mq{from{transform:translateX(0)}to{transform:translateX(calc(-50% - 7px))}}
@media (max-width:900px){@@ .am-mc{width:250px;grid-template-columns:64px minmax(0,1fr);gap:12px}@@ .am-mp{width:64px;height:64px}@@ .am-mq{padding:6px 10px 14px}}
@media (prefers-reduced-motion:reduce){@@ .am-mt{animation:none}@@ .am-mq{overflow-x:auto;-webkit-mask-image:none;mask-image:none}@@ .am-mt>div[aria-hidden]{display:none}}`;
  return { css, html: `${header(s)}<div class="am-mq"><div class="am-mt"><div>${items.map((c) => chip(c, false)).join("")}</div><div aria-hidden="true">${items.map((c) => chip(c, true)).join("")}</div></div></div>` };
}

/* ── the entries ──────────────────────────────────────────────────────── */

const P = "https://www.apsoparts.com/de-CH/";

export const SHOWCASES: ModuleDef[] = [
  {
    id: "showcase-carousel", category: "showcases", name: "Product carousel", note: "Pages of four products with arrows and a progress line - swiped on phones",
    needs: ["products"], takes: "products", min: 4, max: 12, count: () => 12, layouts: [], fields: HEAD, defaults: allLink, render: carousel,
    tags: ["carousel", "slider", "pages", "arrows", "swipe", "products"],
    sample: { eyebrow: "Beliebt", title: "Am meisten bestellt", link: { label: "Alle anzeigen", url: `${P}dichtungstechnik.html` } },
  },
  {
    id: "showcase-spotlight", category: "showcases", name: "Product spotlight", note: "One product large on white with its button, three more beside it",
    needs: ["products"], takes: "products", min: 2, max: 4, count: () => 4,
    layouts: [{ key: "left", label: "Spotlight left" }, { key: "right", label: "Spotlight right" }],
    fields: [F.eyebrow, F.title, F.link, { kind: "extra", key: "badge", label: "Label on the big product", max: 30, hint: "A word or two (\"Im Fokus\") - leave it empty for none" }, { kind: "text", label: "A line about the big product", max: 200, rows: 2, hint: "Only what the product page itself says" }],
    defaults: allLink, render: spotlight, tags: ["spotlight", "feature", "highlight", "hero product"],
    sample: { eyebrow: "Sortiment", title: "Im Fokus", text: "", extra: { badge: "Dichtungstechnik" }, link: { label: "Alle anzeigen", url: `${P}dichtungstechnik.html` } },
  },
  {
    id: "showcase-list", category: "showcases", name: "Compact product list", note: "Many products at a glance: a small photo, the name, its number and count - in columns",
    needs: ["products"], takes: "products", min: 3, max: 12, count: () => 12,
    layouts: [{ key: "3", label: "3 columns" }, { key: "2", label: "2 columns" }], fields: HEAD, defaults: allLink, render: list,
    tags: ["list", "compact", "dense", "catalogue", "numbers"],
    sample: { eyebrow: "Sortiment", title: "Alles auf einen Blick", link: { label: "Alle anzeigen", url: `${P}dichtungstechnik.html` } },
  },
  {
    id: "showcase-tabs", category: "showcases", name: "Products in tabs", note: "A tab for each category; a click shows its products and a tile to all of them",
    needs: ["categories"], takes: "categories", kids: "products", min: 2, max: 5, count: () => 4, layouts: [], fields: HEAD, defaults: allLink, render: tabs,
    gap: (m) => (m.settings.items.some((c) => c.children.some((x) => x.kind === "product")) ? "" : "Its categories have no products yet - fill them from the shop"),
    tags: ["tabs", "categories", "switch", "products"],
    sample: { eyebrow: "Dichtungstechnik", title: "Was suchen Sie?", link: { label: "Alle anzeigen", url: `${P}dichtungstechnik.html` } },
  },
  {
    id: "showcase-ranked", category: "showcases", name: "Top five", note: "The five most bought (or viewed) with their rank in big numbers",
    needs: ["products"], takes: "products", min: 3, max: 5, count: () => 5,
    layouts: [{ key: "list", label: "First large, the rest in rows" }, { key: "row", label: "In a row" }], fields: HEAD, defaults: allLink, render: ranked,
    tags: ["top", "ranking", "best sellers", "numbers", "most bought"],
    sample: { eyebrow: "Beliebt", title: "Die fünf meistbestellten", link: { label: "Alle anzeigen", url: `${P}dichtungstechnik.html` } },
  },
  {
    id: "showcase-duo", category: "showcases", name: "Two products side by side", note: "Two products large, each with its photo, name, count and button",
    needs: ["products"], takes: "products", min: 2, max: 2, count: () => 2, layouts: [], fields: HEAD, defaults: allLink, render: duo,
    tags: ["two", "pair", "compare", "featured"],
    sample: { eyebrow: "Sortiment", title: "Von der Dichtung bis zum Rundstab", link: { label: "Alle Produkte", url: `${P}` } },
  },
  {
    id: "showcase-wall", category: "showcases", name: "Photo wall", note: "The products' photos only, in a calm grid - the name rises on hover",
    needs: ["products"], takes: "products", min: 6, max: 12, count: (s) => (s.layout === "4" ? 8 : 12),
    layouts: [{ key: "6", label: "6 per row" }, { key: "4", label: "4 per row" }], fields: HEAD, defaults: allLink, render: wall,
    tags: ["wall", "photos", "grid", "gallery", "imagery"],
    sample: { eyebrow: "Sortiment", title: "Aus allen Technologien", link: { label: "Alle Produkte", url: `${P}` } },
  },
  {
    id: "showcase-shelf", category: "showcases", name: "Products with a side panel", note: "A petrol panel with the title, a line and a button; four products beside it",
    needs: ["products"], takes: "products", min: 2, max: 4, count: () => 4,
    layouts: [{ key: "left", label: "Panel left" }, { key: "right", label: "Panel right" }],
    fields: [F.eyebrow, F.title, F.text, { kind: "link", label: "Button" }], defaults: allLink, render: shelf,
    tags: ["shelf", "panel", "petrol", "products", "side"],
    sample: { eyebrow: "Sortiment", title: "Aus unserem Sortiment", text: "Dichtungen, Kunststoffe, Schwingungstechnik und Antriebe - mit Preisen und Verfügbarkeit in Echtzeit.", link: { label: "Alle Produkte", url: `${P}` } },
  },
  {
    id: "showcase-marquee", category: "showcases", name: "Moving product strip", note: "The products pass slowly by and stop under the mouse - still for those who prefer less motion",
    needs: ["products"], takes: "products", min: 5, max: 12, count: () => 10, layouts: [], fields: HEAD, defaults: allLink, render: marquee,
    tags: ["marquee", "ticker", "moving", "strip", "animation"],
    sample: { eyebrow: "Sortiment", title: "Quer durch das Sortiment", link: { label: "Alle Produkte", url: `${P}` } },
  },
];
