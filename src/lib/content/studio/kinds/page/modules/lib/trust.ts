// TRUST & REASONS TO BUY (Content v7, 10.11.2026; SARCLA point 1: "more than 100 modules, by category, really high end").
// The shop's promises and its REAL numbers: the counts the shop itself shows (filled from its pages, never typed in), and
// the brand brain's facts (src/data/brain.json: in-stock items in 48/72 h across Europe, live chat and e-mail in seven
// languages, no small-order surcharge, DirectCUT, DirectUP, 3D files). Never an invented certificate, figure or promise.
// Drawn with the kit (../kit.ts); rules under `@@`.

import { BUTTONS, button, esc, href, icon, langOf, marked, pic, promisesFor, wordsFor } from "../kit";
import type { FieldSpec, ModuleDef, ModuleRef, ModuleSettings, Opts, Point } from "../types";

const F = {
  eyebrow: { kind: "eyebrow", label: "Small line above", max: 40 } as FieldSpec,
  title: { kind: "title", label: "Title", max: 90, red: true } as FieldSpec,
  text: { kind: "text", label: "Line under it", max: 260, rows: 2 } as FieldSpec,
  link: { kind: "link", label: "Button" } as FieldSpec,
};
const ey = (t: string, cls = "am-ey") => (t.trim() ? `<p class="${cls}">${esc(t.trim())}</p>` : "");
const pts = (s: ModuleSettings, n: number) => s.points.filter((p) => p.title.trim()).slice(0, n);
const head = (s: ModuleSettings, link = true) => (s.title.trim() || s.eyebrow.trim()
  ? `<div class="am-hd"><div>${ey(s.eyebrow)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ""}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}</div>${link && s.link.url && s.link.label.trim() ? `<a class="am-all" href="${href(s.link.url)}">${esc(s.link.label.trim())}</a>` : ""}</div>`
  : "");
const needPoints = (what: string) => (m: ModuleRef) => (m.settings.points.some((p) => p.title.trim()) ? "" : `Write its ${what}`);
const contact = (store: string) => ({ link: { label: { de: "Kontakt", fr: "Contact", it: "Contatto", en: "Contact", nl: "Contact", pl: "Kontakt" }[langOf(store)] ?? "Contact", url: "" } });

/* ── figures: a row of big figures ────────────────────────────────────── */

function figures(m: ModuleRef) {
  const s = m.settings;
  const list = pts(s, 5);
  const box = s.layout === "box";
  const css = `
@@ .am-fr{display:grid;grid-template-columns:repeat(${Math.max(1, list.length)},minmax(0,1fr));${box ? "gap:12px;padding:12px;border-radius:24px;background:linear-gradient(#f6f8f9,#edf1f3)" : "border-top:1px solid var(--line);border-bottom:1px solid var(--line)"}}
@@ .am-fi{display:flex;flex-direction:column;align-items:flex-start;padding:${box ? "24px 24px 22px;border-radius:16px;background:#fff;box-shadow:0 12px 30px -24px rgba(27,58,75,.55)" : "28px 28px 26px"}}
${box ? "" : "@@ .am-fi+.am-fi{border-left:1px solid var(--line)}"}
@@ .am-fi b{font:600 clamp(32px,3.3vw,48px)/1 var(--head);letter-spacing:-.02em;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
@@ .am-fi b::after{content:"";display:block;width:28px;height:3px;margin-top:14px;border-radius:2px;background:var(--red)}
@@ .am-fi span{margin-top:12px;font:500 15px/1.4 var(--head);color:var(--txt)}
@media (max-width:1100px) and (min-width:901px){@@ .am-fi{padding:${box ? "20px 18px" : "24px 18px"}}}
@media (max-width:900px){
@@ .am-fr{grid-template-columns:repeat(2,minmax(0,1fr));${box ? "gap:8px;padding:8px;border-radius:18px" : ""}}
@@ .am-fi{padding:${box ? "18px 16px" : "20px 14px"}}
${box ? "" : "@@ .am-fi+.am-fi{border-left:0}@@ .am-fi:nth-child(even){border-left:1px solid var(--line)}@@ .am-fi:nth-child(n+3){border-top:1px solid var(--line)}"}
@@ .am-fi b{font-size:30px}
@@ .am-fi span{font-size:13.5px}
${list.length % 2 ? "@@ .am-fi:last-child{grid-column:1/-1}" : ""}
}`;
  return { css, html: `${head(s)}<div class="am-fr">${list.map((p) => `<div class="am-fi"><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<span>${esc(p.text.trim())}</span>` : ""}</div>`).join("")}</div>` };
}

/* ── range: the shop's categories with their own counts ───────────────── */

/** "258 Produkte" -> 258 and "Produkte"; "31.264 Artikel" -> 31264 */
function countOf(meta: string): { n: number; word: string; raw: string } | null {
  const m = /^\s*([\d'’.,\s]*\d)\s*(.*)$/.exec(meta);
  if (!m) return null;
  const n = Number(m[1].replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? { n, word: m[2].trim(), raw: m[1].trim() } : null;
}
const SEP: Record<string, string> = { de: ".", it: ".", nl: ".", fr: " ", pl: " ", en: "," };
const thousands = (n: number, store: string) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, SEP[langOf(store)] ?? ",");

function range(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const w = wordsFor(s.store);
  const bars = s.layout === "bars";
  const list = s.items.slice(0, 8).map((c) => ({ c, k: countOf(c.meta) }));
  const counted = list.filter((x) => x.k);
  const max = Math.max(1, ...counted.map((x) => x.k!.n));
  const total = counted.reduce((a, x) => a + x.k!.n, 0);
  const word = counted[0]?.k?.word || w.products;
  const sum = counted.length > 1 ? `<p class="am-rt"><b>${esc(thousands(total, s.store))}</b><span>${esc(word)} · ${counted.length} ${esc(w.categories)}</span></p>` : "";
  const rows = list.map(({ c, k }) => bars
    ? `<a class="am-rb" href="${href(c.url)}"><i>${pic({ ...c, kind: "category" }, o)}</i><b>${esc(c.name)}</b><span class="am-rl"><span style="--w:${k ? Math.max(0.04, Math.round((k.n / max) * 100) / 100) : 0}"></span></span><em>${k ? esc(thousands(k.n, s.store)) : ""}</em></a>`
    : `<a class="am-rc" href="${href(c.url)}"><i>${pic({ ...c, kind: "category" }, o)}</i><span><b>${k ? esc(thousands(k.n, s.store)) : ""}</b><small>${esc(k?.word ?? "")}</small></span><em>${esc(c.name)}</em></a>`).join("");
  const css = `
@@ .am-rh{display:flex;align-items:flex-end;justify-content:space-between;gap:12px 28px;margin:0 2px 18px}
@@ .am-rt{display:flex;flex-direction:column;align-items:flex-end;text-align:right}
@@ .am-rt b{font:600 clamp(30px,3vw,42px)/1 var(--head);color:var(--pet);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
@@ .am-rt span{margin-top:5px;font:500 13.5px/1.2 var(--head);color:var(--mute)}
${bars ? `
@@ .am-rg{display:grid;gap:4px;padding:10px;border-radius:22px;background:linear-gradient(#f6f8f9,#edf1f3)}
@@ .am-rb{display:grid;grid-template-columns:44px minmax(150px,240px) minmax(0,1fr) 72px;align-items:center;gap:16px;padding:8px 16px 8px 8px;border-radius:14px;color:var(--ink)!important;transition:background .15s}
@@ .am-rb:is(:hover,:focus-visible){background:#fff}
@@ .am-rb i{display:block;width:44px;height:44px;border-radius:10px;overflow:hidden;background:var(--tile)}
@@ .am-rb i img{width:100%;height:100%;object-fit:cover}
@@ .am-rb b{font:600 16px/1.2 var(--head)}
@@ .am-rl{display:block;height:10px;border-radius:5px;background:rgba(39,78,100,.1);overflow:hidden}
@@ .am-rl span{display:block;width:calc(var(--w,0) * 100%);height:100%;border-radius:5px;background:linear-gradient(90deg,#3b6c86,var(--pet));transform-origin:left;transition:background .2s}
@@ .am-rb:hover .am-rl span{background:linear-gradient(90deg,#ff3b2f,var(--red))}
@@ .am-rb em{font:600 17px/1 var(--head);font-style:normal;text-align:right;color:var(--ink);font-variant-numeric:tabular-nums}
@media (max-width:900px){
@@ .am-rg{padding:6px;border-radius:18px}
@@ .am-rb{grid-template-columns:38px minmax(0,1fr) auto;grid-template-rows:auto auto;gap:6px 12px;padding:8px 10px 10px 6px}
@@ .am-rb i{width:38px;height:38px;grid-row:span 2}
@@ .am-rb b{font-size:14.5px}
@@ .am-rl{grid-column:2/-1;grid-row:2;height:8px}
@@ .am-rb em{grid-column:3;grid-row:1;font-size:15px}
}` : `
@@ .am-rg{display:grid;grid-template-columns:repeat(${Math.min(4, Math.max(1, Math.ceil(list.length / 2)))},minmax(0,1fr));gap:12px}
@@ .am-rc{display:grid;grid-template-columns:64px minmax(0,1fr);grid-template-rows:auto auto;align-items:center;gap:4px 16px;padding:14px 18px 14px 14px;border-radius:18px;background:#fff;color:var(--ink)!important;
  box-shadow:0 12px 30px -24px rgba(27,58,75,.55),inset 0 0 0 1px #edf0f2;transition:transform .2s,box-shadow .2s}
@@ .am-rc:is(:hover,:focus-visible){transform:translateY(-2px);box-shadow:0 18px 30px -20px rgba(27,58,75,.5),inset 0 0 0 1px #dfe4e8}
@@ .am-rc i{grid-row:span 2;display:block;width:64px;height:64px;border-radius:14px;overflow:hidden;background:var(--tile)}
@@ .am-rc i img{width:100%;height:100%;object-fit:cover;transition:transform .4s}
@@ .am-rc:hover i img{transform:scale(1.08)}
@@ .am-rc span{display:flex;align-items:baseline;gap:7px;align-self:end}
@@ .am-rc span b{font:600 30px/1 var(--head);letter-spacing:-.02em;color:var(--ink);font-variant-numeric:tabular-nums}
@@ .am-rc span small{font:500 13px/1 var(--head);color:var(--mute)}
@@ .am-rc em{align-self:start;font:600 14.5px/1.25 var(--head);font-style:normal;color:var(--pet);transition:color .15s}
@@ .am-rc:hover em{color:var(--red)}
@media (max-width:1100px) and (min-width:901px){@@ .am-rg{grid-template-columns:repeat(${Math.min(3, Math.max(1, list.length))},minmax(0,1fr))}}
@media (max-width:900px){
@@ .am-rg{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
@@ .am-rc{grid-template-columns:minmax(0,1fr);grid-template-rows:none;gap:6px;padding:12px}
@@ .am-rc i{grid-row:auto;width:44px;height:44px;border-radius:10px}
@@ .am-rc span b{font-size:24px}
@@ .am-rc em{font-size:13.5px}
}`}
@media (max-width:900px){@@ .am-rh{flex-direction:column;align-items:flex-start}@@ .am-rt{align-items:flex-start;text-align:left}}`;
  const top = s.title.trim() || s.eyebrow.trim() || sum
    ? `<div class="am-rh"><div>${ey(s.eyebrow)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ""}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}</div>${sum}</div>` : "";
  return { css, html: `${top}<div class="am-rg">${rows}</div>` };
}

/* ── reasons: cards, an icon each ─────────────────────────────────────── */

function reasons(m: ModuleRef) {
  const s = m.settings;
  const list = pts(s, 4);
  const css = `
@@ .am-rs{display:grid;grid-template-columns:repeat(${Math.max(1, list.length)},minmax(0,1fr));gap:14px;counter-reset:r}
@@ .am-rn{position:relative;display:flex;flex-direction:column;align-items:flex-start;padding:26px 24px 26px;border-radius:20px;background:#fff;counter-increment:r;
  box-shadow:0 14px 34px -26px rgba(27,58,75,.6),inset 0 0 0 1px #edf0f2;transition:transform .25s,box-shadow .25s}
@@ .am-rn:hover{transform:translateY(-3px);box-shadow:0 22px 40px -26px rgba(27,58,75,.6),inset 0 0 0 1px #e1e6ea}
@@ .am-rn::after{content:counter(r,decimal-leading-zero);position:absolute;right:20px;top:18px;font:600 15px/1 var(--head);color:#c9d2d8;letter-spacing:.06em}
@@ .am-rn svg{display:block;width:52px;height:52px;padding:13px;border-radius:14px;background:linear-gradient(145deg,#fdf0ef,#fbe3e1);color:var(--red)}
@@ .am-rn b{margin-top:20px;font:600 19px/1.2 var(--head);color:var(--ink)}
@@ .am-rn span{margin-top:8px;font-size:15px;line-height:1.55;color:var(--txt)}
@media (max-width:1100px) and (min-width:901px){@@ .am-rs{grid-template-columns:repeat(${Math.min(2, Math.max(1, list.length))},minmax(0,1fr))}}
@media (max-width:900px){
@@ .am-rs{grid-template-columns:minmax(0,1fr);gap:10px}
@@ .am-rn{display:grid;grid-template-columns:44px minmax(0,1fr);gap:2px 14px;padding:18px 18px 18px 16px;border-radius:16px}
@@ .am-rn svg{grid-row:span 2;width:44px;height:44px;padding:11px;border-radius:12px}
@@ .am-rn b{margin-top:0;font-size:17px;padding-right:28px}
@@ .am-rn span{margin-top:2px;font-size:14.5px}
@@ .am-rn::after{top:18px;right:16px}
}`;
  return { css, html: `${head(s)}<div class="am-rs">${list.map((p) => `<div class="am-rn">${icon(p.icon, 26)}<b>${esc(p.title.trim())}</b>${p.text.trim() ? `<span>${esc(p.text.trim())}</span>` : ""}</div>`).join("")}</div>` };
}

/* ── checklist: the words beside a list of checks ─────────────────────── */

function checklist(m: ModuleRef) {
  const s = m.settings;
  const list = pts(s, 6);
  const css = `${BUTTONS}
@@ .am-cl{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:28px 48px;align-items:center;padding:36px 40px;border-radius:26px;background:linear-gradient(150deg,#f7f9fa 0%,#edf1f3 100%)}
@@ h2.am-ch{font-size:clamp(25px,2.5vw,36px)!important;line-height:1.12!important;letter-spacing:-.012em}
@@ .am-cx{margin-top:12px!important;font-size:16px;line-height:1.6;color:var(--txt)}
@@ .am-cl .am-btn{margin-top:22px}
@@ .am-ck{padding:8px 26px;border-radius:20px;background:#fff;box-shadow:0 18px 40px -28px rgba(27,58,75,.6)}
@@ .am-ck li{display:grid;grid-template-columns:30px minmax(0,1fr);gap:2px 14px;padding:16px 0!important}
@@ .am-ck li+li{border-top:1px solid var(--line)}
@@ .am-ck svg{grid-row:span 2;width:30px;height:30px;padding:6px;border-radius:50%;background:var(--red);color:#fff;stroke-width:2.6}
@@ .am-ck b{align-self:center;font:600 16.5px/1.3 var(--head);color:var(--ink)}
@@ .am-ck span{font-size:14.5px;line-height:1.5;color:var(--txt)}
@media (max-width:1100px) and (min-width:901px){@@ .am-cl{gap:24px 28px;padding:28px 28px}}
@media (max-width:900px){
@@ .am-cl{grid-template-columns:minmax(0,1fr);gap:20px;padding:22px 16px 18px;border-radius:20px}
@@ .am-cl>div:first-child{padding:0 4px}
@@ .am-ck{padding:4px 18px;border-radius:16px}
@@ .am-ck li{grid-template-columns:26px minmax(0,1fr);gap:2px 12px;padding:13px 0!important}
@@ .am-ck svg{width:26px;height:26px;padding:5px}
@@ .am-ck b{font-size:15.5px}
@@ .am-cl .am-btn{align-self:stretch;justify-content:center}
}`;
  return {
    css,
    html: `<div class="am-cl"><div>${ey(s.eyebrow)}<h2 class="am-ch">${marked(s.title.trim())}</h2>${s.text.trim() ? `<p class="am-cx">${esc(s.text.trim())}</p>` : ""}${button(s.link, "am-btn")}</div>`
      + `<ul class="am-ck">${list.map((p) => `<li>${icon("check", 18)}<b>${esc(p.title.trim())}</b>${p.text.trim() ? `<span>${esc(p.text.trim())}</span>` : ""}</li>`).join("")}</ul></div>`,
  };
}

/* ── band: the promises on petrol ─────────────────────────────────────── */

function band(m: ModuleRef) {
  const s = m.settings;
  const list = pts(s, 5);
  const t = s.title.trim();
  const css = `
@@ .am-pb{display:grid;grid-template-columns:${t ? "minmax(160px,.7fr) " : ""}repeat(${Math.max(1, list.length)},minmax(0,1fr));align-items:center;gap:0;padding:22px 12px;border-radius:22px;
  background:radial-gradient(120% 220% at 0% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%);box-shadow:0 20px 40px -30px rgba(27,58,75,.8)}
@@ .am-pt{padding:0 22px}
@@ .am-pt .am-ey{color:#cddbe3;margin-bottom:6px!important}
@@ .am-pt .am-ey::before{background:#fff}
@@ h2.am-ph{color:#fff!important;font-size:21px!important;line-height:1.2!important}
@@ .am-ph .am-red{color:#ff6a5f}
@@ .am-pi{display:grid;grid-template-columns:46px minmax(0,1fr);align-items:center;gap:13px;padding:6px 20px;min-width:0}
@@ .am-pi+.am-pi,@@ .am-pt+.am-pi{border-left:1px solid rgba(255,255,255,.16)}
@@ .am-pi svg{display:block;width:46px;height:46px;padding:11px;border-radius:50%;color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.45);transition:background .2s,box-shadow .2s}
@@ .am-pi:hover svg{background:var(--red);box-shadow:inset 0 0 0 1.5px var(--red)}
@@ .am-pi b{display:block;font:600 15.5px/1.2 var(--head);color:#fff}
@@ .am-pi span{display:block;margin-top:2px;font:500 13px/1.35 var(--head);color:#b9ccd7}
@media (max-width:1100px) and (min-width:901px){@@ .am-pb{grid-template-columns:repeat(${Math.max(1, list.length)},minmax(0,1fr))}@@ .am-pt{display:none}@@ .am-pi{grid-template-columns:38px minmax(0,1fr);gap:10px;padding:6px 14px}@@ .am-pi svg{width:38px;height:38px;padding:9px}@@ .am-pi b{font-size:14.5px}}
@media (max-width:900px){
@@ .am-pb{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 0;padding:20px 6px;border-radius:18px}
@@ .am-pt{grid-column:1/-1;padding:0 12px 2px}
@@ .am-pi{grid-template-columns:minmax(0,1fr);align-items:start;gap:9px;padding:2px 12px}
@@ .am-pi+.am-pi,@@ .am-pt+.am-pi{border-left:0}
@@ .am-pi svg{width:36px;height:36px;padding:8px}
@@ .am-pi b{font-size:14.5px}
@@ .am-pi span{font-size:12.5px}
}`;
  return {
    css,
    html: `<div class="am-pb">${t ? `<div class="am-pt">${ey(s.eyebrow)}<h2 class="am-ph">${marked(t)}</h2></div>` : ""}${list.map((p) => `<div class="am-pi">${icon(p.icon)}<div><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<span>${esc(p.text.trim())}</span>` : ""}</div></div>`).join("")}</div>`,
  };
}

/* ── steps: ordering in numbered steps, joined by a line ──────────────── */

function steps(m: ModuleRef) {
  const s = m.settings;
  const list = pts(s, 5);
  const icons = s.layout === "icons";
  const n = Math.max(1, list.length);
  const css = `
@@ .am-sx{position:relative;display:grid;grid-template-columns:repeat(${n},minmax(0,1fr));gap:18px;padding:30px 28px 28px;border-radius:24px;background:linear-gradient(#f6f8f9,#edf1f3)}
@@ .am-sx::before{content:"";position:absolute;left:calc(28px + (100% - 56px - ${(n - 1) * 18}px) / ${n} / 2);right:calc(28px + (100% - 56px - ${(n - 1) * 18}px) / ${n} / 2);top:56px;height:2px;
  background:repeating-linear-gradient(90deg,rgba(39,78,100,.35) 0 8px,transparent 8px 14px)}
@@ .am-si{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;counter-increment:st}
@@ .am-sx{counter-reset:st}
@@ .am-sn{position:relative;z-index:1;display:grid;place-items:center;width:54px;height:54px;border-radius:50%;background:#fff;color:var(--pet);font:600 21px/1 var(--head);
  box-shadow:0 10px 22px -14px rgba(27,58,75,.6),inset 0 0 0 2px var(--pet);transition:background .2s,color .2s,box-shadow .2s}
@@ .am-sn::before{content:${icons ? "none" : "counter(st)"}}
@@ .am-sn svg{width:24px;height:24px}
@@ .am-si:first-child .am-sn{background:var(--red);color:#fff;box-shadow:0 10px 22px -12px rgba(216,9,1,.6)}
@@ .am-si:hover .am-sn{background:var(--pet);color:#fff}
@@ .am-si b{margin-top:16px;font:600 17.5px/1.25 var(--head);color:var(--ink)}
@@ .am-si span{max-width:240px;margin-top:7px;font-size:14.5px;line-height:1.5;color:var(--txt)}
@media (max-width:900px){
@@ .am-sx{grid-template-columns:minmax(0,1fr);gap:0;padding:20px 18px;border-radius:18px}
@@ .am-sx::before{left:44px;right:auto;top:44px;bottom:44px;width:2px;height:auto;background:repeating-linear-gradient(180deg,rgba(39,78,100,.35) 0 8px,transparent 8px 14px)}
@@ .am-si{display:grid;grid-template-columns:52px minmax(0,1fr);gap:2px 14px;align-items:start;text-align:left;padding:8px 0}
@@ .am-sn{grid-row:span 2;width:52px;height:52px;font-size:19px}
@@ .am-si b{margin-top:4px;font-size:16.5px}
@@ .am-si span{max-width:none;margin-top:2px;font-size:14px}
}`;
  return { css, html: `${head(s)}<ol class="am-sx">${list.map((p) => `<li class="am-si"><span class="am-sn">${icons ? icon(p.icon) : ""}</span><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<span>${esc(p.text.trim())}</span>` : ""}</li>`).join("")}</ol>` };
}

/* ── help: human support, its ways ────────────────────────────────────── */

function help(m: ModuleRef) {
  const s = m.settings;
  const list = pts(s, 3);
  const css = `${BUTTONS}
@@ .am-hl{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:24px 40px;align-items:center;padding:34px 36px;border-radius:26px;background:linear-gradient(150deg,#eef4f7 0%,#e2ebf0 100%)}
@@ h2.am-hh{font-size:clamp(25px,2.5vw,35px)!important;line-height:1.12!important}
@@ .am-hx{margin-top:12px!important;font-size:16px;line-height:1.6;color:var(--txt)}
@@ .am-hl .am-btn{margin-top:22px}
@@ .am-hw{display:grid;grid-template-columns:repeat(${Math.max(1, list.length)},minmax(0,1fr));gap:12px}
@@ .am-ht{display:flex;flex-direction:column;align-items:flex-start;padding:22px 20px;border-radius:18px;background:#fff;box-shadow:0 14px 30px -24px rgba(27,58,75,.6);color:var(--ink)!important;transition:transform .2s}
@@ a.am-ht:is(:hover,:focus-visible){transform:translateY(-3px)}
@@ .am-ht svg{width:48px;height:48px;padding:12px;border-radius:14px;background:var(--pet);color:#fff}
@@ .am-ht b{margin-top:16px;font:600 17.5px/1.2 var(--head)}
@@ .am-ht span{margin-top:6px;font-size:14.5px;line-height:1.5;color:var(--txt)}
@media (max-width:1100px) and (min-width:901px){@@ .am-hl{grid-template-columns:minmax(0,1fr);padding:28px}}
@media (max-width:900px){
@@ .am-hl{grid-template-columns:minmax(0,1fr);gap:20px;padding:24px 16px 16px;border-radius:20px}
@@ .am-hl>div:first-child{padding:0 4px}
@@ .am-hw{grid-template-columns:minmax(0,1fr);gap:8px}
@@ .am-ht{display:grid;grid-template-columns:42px minmax(0,1fr);gap:2px 14px;padding:14px 16px 14px 14px;border-radius:14px}
@@ .am-ht svg{grid-row:span 2;width:42px;height:42px;padding:10px;border-radius:12px}
@@ .am-ht b{margin-top:0;font-size:16px}
@@ .am-ht span{margin-top:0;font-size:14px}
@@ .am-hl .am-btn{align-self:stretch;justify-content:center}
}`;
  const tile = (p: Point) => {
    const inner = `${icon(p.icon)}<b>${esc(p.title.trim())}</b>${p.text.trim() ? `<span>${esc(p.text.trim())}</span>` : ""}`;
    return p.url ? `<a class="am-ht" href="${href(p.url)}">${inner}</a>` : `<div class="am-ht">${inner}</div>`;
  };
  return {
    css,
    html: `<div class="am-hl"><div>${ey(s.eyebrow)}<h2 class="am-hh">${marked(s.title.trim())}</h2>${s.text.trim() ? `<p class="am-hx">${esc(s.text.trim())}</p>` : ""}${button(s.link, "am-btn is-pet")}</div>`
      + `<div class="am-hw">${list.map(tile).join("")}</div></div>`,
  };
}

/* ── delivery: the promise as a timeline ──────────────────────────────── */

function delivery(m: ModuleRef) {
  const s = m.settings;
  const list = pts(s, 4);
  const fig = (s.extra.figure ?? "").trim();
  const figText = (s.extra.figureText ?? "").trim();
  const n = Math.max(1, list.length);
  const css = `${BUTTONS}
@@ .am-dl{display:grid;grid-template-columns:${fig ? "minmax(0,.8fr) " : ""}minmax(0,1.6fr);gap:22px 40px;align-items:center;padding:34px 38px;border-radius:26px;background:linear-gradient(150deg,#f7f9fa 0%,#edf1f3 100%)}
@@ .am-df b{display:block;font:600 clamp(48px,5.6vw,80px)/.95 var(--head);letter-spacing:-.03em;color:var(--pet);white-space:nowrap}
@@ .am-df span{display:block;margin-top:10px;font:600 16px/1.3 var(--head);color:var(--ink)}
@@ .am-dr .am-hd{margin:0 0 22px}
@@ .am-tl{position:relative;display:grid;grid-template-columns:repeat(${n},minmax(0,1fr));gap:14px}
@@ .am-tl::before{content:"";position:absolute;left:24px;right:calc((100% - ${(n - 1) * 14}px) / ${n} - 24px);top:23px;height:3px;border-radius:2px;background:linear-gradient(90deg,var(--pet) 0%,#9fb6c3 100%)}
@@ .am-tl::after{content:"";position:absolute;left:18px;top:18px;width:13px;height:13px;border-radius:50%;background:var(--red);box-shadow:0 0 0 4px rgba(216,9,1,.18);
  animation:am-run-${s.id} 3.6s cubic-bezier(.45,.05,.55,.95) infinite}
@keyframes am-run-${s.id}{0%{left:18px;opacity:0}10%{opacity:1}85%{opacity:1}100%{left:calc((100% - ${(n - 1) * 14}px) / ${n} * ${n - 1} + ${(n - 1) * 14 + 18}px);opacity:0}}
@@ .am-ts{position:relative;z-index:1;display:flex;flex-direction:column;align-items:flex-start}
@@ .am-ts svg{width:48px;height:48px;padding:12px;border-radius:50%;background:#fff;color:var(--pet);box-shadow:0 10px 20px -12px rgba(27,58,75,.6),inset 0 0 0 2px var(--pet)}
@@ .am-ts:last-child svg{background:var(--pet);color:#fff}
@@ .am-ts b{margin-top:14px;font:600 16.5px/1.25 var(--head);color:var(--ink)}
@@ .am-ts span{margin-top:5px;font-size:14px;line-height:1.5;color:var(--txt)}
@@ .am-dl .am-all{margin-top:18px}
@media (prefers-reduced-motion:reduce){@@ .am-tl::after{animation:none;display:none}}
@media (max-width:1100px) and (min-width:901px){@@ .am-dl{gap:20px 26px;padding:28px}}
@media (max-width:900px){
@@ .am-dl{grid-template-columns:minmax(0,1fr);gap:18px;padding:24px 18px;border-radius:20px}
@@ .am-df b{font-size:52px}
@@ .am-tl{grid-template-columns:minmax(0,1fr);gap:16px}
@@ .am-tl::before{left:23px;right:auto;top:24px;bottom:24px;width:3px;height:auto;background:linear-gradient(180deg,var(--pet) 0%,#9fb6c3 100%)}
@@ .am-tl::after{display:none}
@@ .am-ts{display:grid;grid-template-columns:48px minmax(0,1fr);gap:2px 14px}
@@ .am-ts svg{grid-row:span 2}
@@ .am-ts b{margin-top:4px}
@@ .am-ts span{margin-top:0}
}`;
  const words = s.title.trim() || s.eyebrow.trim() ? `<div class="am-hd"><div>${ey(s.eyebrow)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ""}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}</div></div>` : "";
  return {
    css,
    html: `<div class="am-dl">${fig ? `<div class="am-df"><b>${esc(fig)}</b>${figText ? `<span>${esc(figText)}</span>` : ""}</div>` : ""}<div class="am-dr">${words}`
      + `<ol class="am-tl">${list.map((p) => `<li class="am-ts">${icon(p.icon)}<b>${esc(p.title.trim())}</b>${p.text.trim() ? `<span>${esc(p.text.trim())}</span>` : ""}</li>`).join("")}</ol>${button(s.link, "am-all")}</div></div>`,
  };
}

/* ── the entries ──────────────────────────────────────────────────────── */

const promisesField = (label: string, max: number, hint = "The shop's own promises - a promise the shop does not make is never written here."): FieldSpec =>
  ({ kind: "points", label, max, item: { title: "Bold words", text: "The rest" }, icons: true, hint });
const figuresField: FieldSpec = { kind: "points", label: "Figures", max: 5, item: { title: "Figure", text: "What it counts" }, hint: "Real figures only: the shop's counts, the brand's facts (48/72 h, 7 languages)." };

export const TRUST: ModuleDef[] = [
  {
    id: "trust-figures", category: "trust", name: "Figures", note: "A row of big figures, each with what it counts - open between hairlines, or on white tiles",
    needs: [], takes: "none", min: 0, max: 0,
    layouts: [{ key: "line", label: "Between lines" }, { key: "box", label: "On tiles" }],
    fields: [F.eyebrow, F.title, F.text, { kind: "link", label: "Link at the top right" }, figuresField], gap: needPoints("figures"), render: (m) => figures(m),
    tags: ["figures", "numbers", "stats", "facts", "kpi"],
    sample: {
      eyebrow: "APSOparts", title: "Das Sortiment in Zahlen", text: "", link: { label: "", url: "" },
      points: [
        { title: "1.560", text: "Produkte in sechs Technologien", icon: "check" }, { title: "60.367", text: "Artikel, jeder mit Preis und Verfügbarkeit", icon: "check" },
        { title: "48/72 h", text: "Lieferung ab Lager in Europa", icon: "check" }, { title: "7", text: "Sprachen im Live-Chat und per E-Mail", icon: "check" },
      ],
    },
  },
  {
    id: "trust-range", category: "trust", name: "The range in numbers", note: "The shop's categories with their own counts, read from the shop - as tiles, or as bars side by side",
    needs: ["categories"], takes: "categories", kids: "subs", min: 2, max: 8, count: () => 6,
    layouts: [{ key: "tiles", label: "Tiles" }, { key: "bars", label: "Bars" }],
    fields: [F.eyebrow, F.title, F.text], render: range,
    gap: (m) => (m.settings.items.some((c) => /\d/.test(c.meta)) ? "" : "Its categories carry no counts yet - fill them from the shop"),
    tags: ["range", "numbers", "counts", "categories", "chart", "bars"],
    sample: { eyebrow: "Sortiment", title: "Sechs Technologien, ein Shop", text: "" },
  },
  {
    id: "trust-reasons", category: "trust", name: "Reasons to order here", note: "Three or four cards, each an icon, a reason and one sentence",
    needs: [], takes: "none", min: 0, max: 0, layouts: [],
    fields: [F.eyebrow, F.title, F.text, { kind: "link", label: "Link at the top right" }, promisesField("Reasons", 4)],
    defaults: (store) => ({ points: promisesFor(store) }), gap: needPoints("reasons"), render: (m) => reasons(m),
    tags: ["reasons", "why", "benefits", "cards", "icons"],
    sample: {
      eyebrow: "Warum APSOparts", title: "Bestellen ohne Umwege", text: "", link: { label: "", url: "" },
      points: [
        { title: "Keine Zuschläge", text: "Auch kleine Bestellungen ohne Zuschlag für Kleinmengen.", icon: "box" },
        { title: "48/72 h ab Lager", text: "Artikel ab Lager kommen in 48 bis 72 Stunden in ganz Europa an.", icon: "truck" },
        { title: "Nach Mass", text: "Platten, Stäbe und Dichtungen mit DirectCUT nach Mass konfiguriert.", icon: "cut" },
        { title: "Hilfe in 7 Sprachen", text: "Live-Chat und E-Mail, persönlich beantwortet.", icon: "chat" },
      ],
    },
  },
  {
    id: "trust-checklist", category: "trust", name: "Checklist", note: "The headline, a line and a button beside a white card of checks",
    needs: ["text"], takes: "none", min: 0, max: 0, layouts: [],
    fields: [F.eyebrow, F.title, F.text, F.link, promisesField("Checks", 6)],
    defaults: (store) => ({ points: promisesFor(store) }), gap: needPoints("checks"), render: (m) => checklist(m),
    tags: ["checklist", "checks", "list", "benefits"],
    sample: {
      eyebrow: "Bestellen bei APSOparts", title: "Was Sie ==bei jeder== Bestellung haben",
      text: "Standardkomponenten der Industrie, online bestellt - mit Preisen in Echtzeit.",
      link: { label: "Konto eröffnen", url: "https://www.apsoparts.com/de-CH/customer/account/create/" },
      points: [
        { title: "Preise in Echtzeit", text: "Ihr Preis, die Lieferzeit und die Verfügbarkeit bei jedem Artikel.", icon: "check" },
        { title: "Keine Zuschläge für Kleinbestellungen", text: "Auch ein einzelner O-Ring kostet keinen Zuschlag.", icon: "check" },
        { title: "Lieferung in 48/72 h", text: "Für Artikel ab Lager, in ganz Europa.", icon: "check" },
        { title: "3D-Daten zum Herunterladen", text: "CAD-Daten für die Konstruktion.", icon: "check" },
        { title: "Hilfe in 7 Sprachen", text: "Live-Chat und E-Mail.", icon: "check" },
      ],
    },
  },
  {
    id: "trust-band", category: "trust", name: "Promise band (petrol)", note: "The shop's promises in white on a petrol band, each with its icon - a short title before them if wanted",
    needs: [], takes: "none", min: 0, max: 0, layouts: [],
    fields: [F.eyebrow, { kind: "title", label: "Short title before them (optional)", max: 40, red: true }, promisesField("Promises", 5)],
    defaults: (store) => ({ points: promisesFor(store) }), gap: needPoints("promises"), render: (m) => band(m),
    tags: ["usp", "promises", "band", "dark", "petrol", "icons"],
    sample: { eyebrow: "APSOparts", title: "Darum hier ==bestellen==" },
  },
  {
    id: "trust-steps", category: "trust", name: "Ordering in steps", note: "Three to five numbered steps joined by a line - numbers or icons in the circles",
    needs: [], takes: "none", min: 0, max: 0,
    layouts: [{ key: "numbers", label: "Numbers" }, { key: "icons", label: "Icons" }],
    fields: [F.eyebrow, F.title, F.text, { kind: "link", label: "Link at the top right" }, { kind: "points", label: "Steps", max: 5, item: { title: "Step", text: "One sentence" }, icons: true }],
    gap: needPoints("steps"), render: (m) => steps(m),
    tags: ["steps", "how it works", "process", "ordering", "timeline"],
    sample: {
      eyebrow: "So einfach", title: "In vier Schritten bestellt", text: "", link: { label: "", url: "" },
      points: [
        { title: "Artikel finden", text: "Über die Suche, die Kategorien oder die Artikelnummer.", icon: "search" },
        { title: "Preis sehen", text: "Preis, Lieferzeit und Verfügbarkeit in Echtzeit.", icon: "clock" },
        { title: "Bestellen", text: "Im Warenkorb - oder als Liste mit DirectUP hochgeladen.", icon: "cart" },
        { title: "Geliefert", text: "Artikel ab Lager in 48/72 h in ganz Europa.", icon: "truck" },
      ],
    },
  },
  {
    id: "trust-help", category: "trust", name: "Help is near", note: "Human support: the words and a contact button beside its ways - live chat, e-mail, the shop's tools",
    needs: ["text"], takes: "none", min: 0, max: 0, layouts: [],
    fields: [F.eyebrow, F.title, F.text, { kind: "link", label: "Button (the contact page)" }, { kind: "points", label: "The ways", max: 3, item: { title: "Way", text: "One line" }, icons: true, links: true }],
    defaults: contact, gap: needPoints("ways to help"), render: (m) => help(m),
    tags: ["help", "support", "contact", "chat", "service"],
    sample: {
      eyebrow: "Persönlich", title: "Fragen? Wir sind ==für Sie== da",
      text: "Im Live-Chat und per E-Mail, in sieben Sprachen - von Menschen beantwortet.",
      link: { label: "Kontakt", url: "https://www.apsoparts.com/de-CH/contact" },
      points: [
        { title: "Live-Chat", text: "In sieben Sprachen, direkt im Shop.", icon: "chat" },
        { title: "E-Mail", text: "Schreiben Sie uns - die Antwort kommt persönlich.", icon: "doc" },
        { title: "O-Ring Expert", text: "Den passenden O-Ring für Ihre Anwendung finden.", icon: "expert", url: "https://www.apsoparts.com/de-CH/service/oring-expert" },
      ],
    },
  },
  {
    id: "trust-delivery", category: "trust", name: "Delivery promise", note: "A big figure beside the way of an order - ordered, packed, delivered - a light running along it",
    needs: [], takes: "none", min: 0, max: 0, layouts: [],
    fields: [{ kind: "extra", key: "figure", label: "Big figure (e.g. 48/72 h)", max: 12 }, { kind: "extra", key: "figureText", label: "Under the figure", max: 60 }, F.eyebrow, F.title, F.text,
      { kind: "points", label: "The way of an order", max: 4, item: { title: "Step", text: "One line" }, icons: true }, { kind: "link", label: "Link under it" }],
    gap: needPoints("steps"), render: (m) => delivery(m),
    tags: ["delivery", "shipping", "timeline", "48h", "stock"],
    sample: {
      extra: { figure: "48/72 h", figureText: "Lieferung ab Lager in Europa" },
      eyebrow: "Lieferung", title: "Ab Lager ==schnell== bei Ihnen", text: "Für Artikel ab Lager, in ganz Europa - mit Track & Trace.", link: { label: "", url: "" },
      points: [
        { title: "Bestellt", text: "Online, mit Preis und Verfügbarkeit.", icon: "cart" },
        { title: "Verpackt", text: "Artikel ab Lager gehen direkt los.", icon: "box" },
        { title: "Geliefert", text: "In 48 bis 72 Stunden in ganz Europa.", icon: "truck" },
      ],
    },
  },
];
