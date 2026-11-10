// PAGE - A MODULE DRAWN (Content v6, 09.11.2026; the library's since Content v7, 10.11.2026). Pure:
// tests/studio-page-modules.test.ts.
//
// One renderer for the gallery's thumbnails, the studio's preview and what goes to Magento - so what the person picks is
// what the shop shows. Each module draws itself (./lib/*.ts, listed by ./registry.ts) with the kit's pieces (./kit.ts);
// here it becomes ONE element: <div class="apx-<id>"> with its own <style>, every rule under .apx-<id> (inner classes am-*),
// explicit colours and fonts, the shop's container (1170 px, 10 px gutters), finished at 375, 1024 and 1440 px. No script
// (a version may carry none - src/lib/convert/versions.ts): what moves is CSS (:has(), :hover, :focus-within, <details>,
// radio inputs, scroll-snap).
//
// Content v7 (SARCLA 10.11.2026 point 6: "added a module didn't appear"): a module that still lacks what it needs is drawn
// as its SKELETON - its own shape, greyed and shimmering, with the reason in plain words over it - so a click always shows
// something in the page at once (renderSkeleton). The skeleton is the studio's only: it never goes to Magento.

import { esc, href, minifyCss, sharpImg } from "./kit";
import { drawModule, gapOf, moduleDef } from "./registry";
import type { Card, ModuleRef, Opts } from "./types";

export { esc, href, minifyCss, sharpImg } from "./kit";

/** The module's CSS and inner HTML, its rules under its own class. */
export function moduleParts(m: ModuleRef, o: Opts = {}): { cls: string; css: string; html: string } {
  return drawModule(m, o);
}

/** The module as the shop gets it: ONE element - <div class="apx-<id>"> with its <style> first. */
export function renderModule(m: ModuleRef, o: Opts = {}): string {
  const p = moduleParts(m, o);
  return `<div class="${p.cls}" data-apx-module="${esc(m.type)}"><style>${p.css}</style>${p.html}</div>`;
}

/** Its weight against a version's 20 KB per element (src/lib/convert/versions.ts LIMITS.html). */
export const MODULE_MAX = 20_000;
export function moduleWeight(html: string): { bytes: number; ok: boolean } {
  return { bytes: html.length, ok: html.length <= MODULE_MAX };
}

/* ── the skeleton: a module that cannot stand yet, in its own shape ────── */

const GHOST_URL = "https://www.apsoparts.com/";
const ghostCard = (i: number, kind: Card["kind"], kids = 0): Card => ({
  kind, name: " ".repeat(14 + (i % 3) * 4), url: GHOST_URL, img: "", meta: " ".repeat(8), number: "",
  children: Array.from({ length: kids }, (_, k) => ghostCard(k + i, kind === "category" ? "product" : "product")),
});

/** The module filled with grey stand-ins in its own shape: as many items as it shows, words as bars. */
function ghostOf(m: ModuleRef): ModuleRef {
  const d = moduleDef(m.type);
  const s = m.settings;
  const n = d ? Math.max(d.min, Math.min(d.max || 0, d.count ? d.count(s) : d.max)) : 0;
  const bar = (k: number) => " ".repeat(k);
  const items = d && d.takes !== "none" && s.items.length < Math.max(1, d.min)
    ? Array.from({ length: n }, (_, i) => ghostCard(i, d.takes === "categories" ? "category" : "product", d.takes === "categories" ? 4 : 0))
    : s.items;
  return {
    ...m,
    settings: {
      ...s, items,
      title: s.title.trim() || bar(26), text: s.text.trim() || (d?.fields.some((f) => f.kind === "text") ? bar(60) : ""),
      eyebrow: s.eyebrow.trim() || (d?.fields.some((f) => f.kind === "eyebrow") ? bar(10) : ""),
      link: { label: s.link.label || bar(10), url: s.link.url || GHOST_URL },
      link2: d?.fields.some((f) => f.kind === "link2") ? { label: s.link2.label || bar(10), url: s.link2.url || GHOST_URL } : s.link2,
      points: s.points.length ? s.points : Array.from({ length: 4 }, () => ({ title: bar(12), text: bar(18), icon: "check" })),
      faq: s.faq.some((x) => x.q.trim()) ? s.faq : Array.from({ length: 3 }, () => ({ q: bar(40), a: bar(60) })),
      feature: s.feature ?? (d?.fields.some((f) => f.kind === "feature") ? { kind: "category", name: bar(14), url: GHOST_URL, img: "", meta: "", number: "", children: [] } : null),
    },
  };
}

/**
 * A module that still lacks what it needs, drawn in its own shape - grey, shimmering while it fills ("busy"), with the
 * reason over it in plain words. The studio's preview only (a change with `wait`, never in Magento).
 */
export function renderSkeleton(m: ModuleRef, o: { busy?: string | null; reason?: string } = {}): string {
  const d = moduleDef(m.type);
  const p = moduleParts(ghostOf(m));
  const reason = o.busy || o.reason || gapOf(m) || "Filling it…";
  const name = d?.name ?? "Module";
  const cls = p.cls;
  const ghost = minifyCss(`
.${cls}{position:relative}
.${cls} .am-gh img{display:none!important}
.${cls} .am-gh :is(b,em,small,h2,h3,p,span,summary,a.am-all,a.am-btn,a.am-btn2,li>b,td,th){color:transparent!important;-webkit-text-fill-color:transparent!important}
.${cls} .am-gh :is(b,small,h2,h3,summary,.am-ey,.am-sub,.am-all,.am-btn,.am-btn2){background:linear-gradient(90deg,#e6eaed 0%,#f3f5f7 45%,#e6eaed 90%)!important;background-size:300% 100%!important;border-radius:6px;animation:apxgh 1.4s ease-in-out infinite}
.${cls} .am-gh :is(i,.am-big,.am-bp,.am-tf,.am-zp,.am-cp,.am-zt,.am-ct,svg){background:linear-gradient(90deg,#e3e7ea 0%,#eff2f4 45%,#e3e7ea 90%)!important;background-size:300% 100%!important;animation:apxgh 1.4s ease-in-out infinite}
.${cls} .am-gh svg{color:transparent!important}
.${cls} .am-gh *{box-shadow:none!important;transition:none!important;pointer-events:none}
.${cls} .am-gh .am-ey::before{background:#dfe4e8!important}
.${cls} .am-gw{position:absolute;left:50%;top:50%;z-index:3;transform:translate(-50%,-50%);max-width:min(520px,calc(100% - 40px));display:flex;align-items:center;gap:12px;padding:13px 18px 13px 14px;border-radius:12px;background:#15223a;color:#fff;box-shadow:0 18px 40px -16px rgba(21,34,58,.55);font:600 14px/1.35 system-ui,"Segoe UI",Arial,sans-serif}
.${cls} .am-gw small{display:block;font-weight:500;font-size:12.5px;color:#c9d3e0}
.${cls} .am-gw i{flex:none;width:18px;height:18px;border-radius:50%;border:2.5px solid rgba(255,255,255,.25);border-top-color:#fff;${o.busy ? "animation:apxsp .8s linear infinite" : "border-color:#f0b4cc"}}
@keyframes apxgh{from{background-position:100% 0}to{background-position:0 0}}
@keyframes apxsp{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.${cls} .am-gh *{animation:none!important}}`);
  return `<div class="${cls}" data-apx-module="${esc(m.type)}" data-apx-wait="1"><style>${p.css}${ghost}</style><div class="am-gh" aria-hidden="true">${p.html}</div>`
    + `<div class="am-gw" role="status"><i></i><span>${esc(name)}<small>${esc(reason)}</small></span></div></div>`;
}

/** A link's href as a module writes it (re-exported for the tests). */
export const linkHref = href;

/** The module made light enough for one element of the page (a version takes 20 KB per element): its last items out, one
 * at a time - `dropped` says how many. */
export function fitModule(m: ModuleRef): { m: ModuleRef; dropped: number } {
  let cur = m;
  let dropped = 0;
  while (renderModule(cur).length > MODULE_MAX && cur.settings.items.length > 1) {
    cur = { ...cur, settings: { ...cur.settings, items: cur.settings.items.slice(0, -1) } };
    dropped++;
  }
  return { m: cur, dropped };
}
