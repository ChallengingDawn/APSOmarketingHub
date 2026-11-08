// BANNER - THE BANNER ITSELF, AS HTML (08.11.2026). Pure: tests/studio-banner.test.ts.
//
// One renderer for every use, so what the studio shows is what goes out:
//   pasteBlock     the shop's sizes as ONE Magento Page Builder "HTML Code" element - its CSS scoped under one class
//                  (nothing leaks into the shop's page), full picture addresses, the word changing every 2.6 s only
//                  while the banner is on screen (IntersectionObserver) and never under "reduce motion"
//   stillMarkup    any size frozen on its first word and photo - for the PNG (studio/kinds/banner/png.ts) and the
//                  "All sizes" view
//   previewDoc     the paste block in a page of its own, for the studio's frame (it reports its height, links stay put)
//   htmlFile       the paste block in a page that opens in any browser (Download HTML)
//
// The look is the newsletter band's (home-page-2026/newsletter_block.py): petrol, the shop's red, ink, futura-pt (Jost
// where futura-pt is not loaded), an eyebrow with a red bar, a photo card with a white label. The fixed sizes are drawn
// in design pixels (--u = one pixel at the real size) so a 756 x 355 slot scales with its column and its PNG is exact.

import { BRAND, esc, linkOf, logoSvg, mediaUrl, pasteHref } from "./brand";
import { PRESET, THEMES, wordsFor, type BannerDoc, type PresetKey, type ThemeKey } from "./model";

const u = (n: number) => `calc(var(--u)*${n})`;
/** An address in a double-quoted attribute. Single quotes stay as they are: Magento's {{store direct_url='...'}} needs them. */
const attr = (s: string) => s.replace(/&(?!amp;)/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/** The class every rule hangs under - one per to-do, so two banners on one page never meet. */
export const prefixFor = (pieceId: number | string) => `apb${String(pieceId).replace(/[^A-Za-z0-9]/g, "").slice(0, 12) || "x"}`;

function themeVars(key: ThemeKey): string {
  const t = THEMES[key];
  return `--bg:${t.bg};--fg:${t.fg};--mut:${t.mut};--acc:${t.acc};--eb:${t.eb};--fb:${t.fb};--card:${t.card}`;
}

// Rules shared by every size. "!important" only where the shop's theme styles the same elements (p, h2, a): ours win.
const BASE = `
.@@{__VARS__;--red:${BRAND.red};--red-d:${BRAND.redDark};--head:${BRAND.head};color:var(--fg);text-align:left;font:400 15px/1.5 ${BRAND.body};-webkit-font-smoothing:antialiased}
.@@ *,.@@ *::before,.@@ *::after{box-sizing:border-box}
.@@ img{max-width:none;border:0}
.@@ .@@-eb{display:inline-flex;align-items:center;gap:10px;margin:0!important;font:600 12px/1.2 var(--head)!important;letter-spacing:.14em!important;text-transform:uppercase!important;color:var(--eb)!important}
.@@ .@@-eb::before{content:"";flex:none;width:26px;height:3px;border-radius:2px;background:var(--red)}
.@@ .@@-q,.@@ .@@-h,.@@ .@@-p{margin:0!important;padding:0!important;letter-spacing:normal!important;text-transform:none!important}
.@@ .@@-q{font:500 21px/1.2 var(--head)!important;color:var(--mut)!important}
.@@ .@@-w{display:block;margin-top:3px;font:600 30px/1.15 var(--head);color:var(--acc)}
.@@ .@@-h{font:600 30px/1.15 var(--head)!important;color:var(--acc)!important}
.@@ .@@-p{color:var(--mut)!important;font:400 15.5px/1.6 ${BRAND.body}!important}
.@@ [data-list]>span{display:inline-block;transition:transform .35s cubic-bezier(.2,.7,.2,1),opacity .3s}
.@@ [data-list].is-out>span{transform:translateY(-40%);opacity:0}
.@@ [data-list].is-in>span{transform:translateY(40%);opacity:0;transition:none}
.@@ .@@-b{display:inline-flex;align-items:center;justify-content:center;gap:10px;margin:0;padding:0 22px;height:52px;border:0;border-radius:12px;background:var(--red);color:#fff!important;font:600 16px/1 var(--head)!important;text-decoration:none!important;white-space:nowrap;cursor:pointer;transition:background .2s}
.@@ .@@-b:hover,.@@ .@@-b:focus-visible{background:var(--red-d);color:#fff!important}
.@@ .@@-b svg{flex:none;width:17px;height:17px;transition:transform .2s}
.@@ .@@-b:hover svg{transform:translateX(3px)}
.@@ .@@-c{position:relative;overflow:hidden;background:var(--card);box-shadow:0 18px 40px -26px rgba(27,58,75,.6)}
.@@ .@@-c img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;opacity:0;transform:scale(1.07);transition:opacity .7s,transform 2.8s ease-out}
.@@ .@@-c img.is-on{opacity:1;transform:scale(1)}
.@@ .@@-t{position:absolute;left:14px;bottom:14px;z-index:2;max-width:calc(100% - 28px);padding:8px 14px;border-radius:12px;background:#fff;color:#1d2326;font:600 15px/1.2 var(--head);box-shadow:0 8px 20px -12px rgba(27,58,75,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.@@ .@@-lg{display:block;width:auto}
.@@.is-still *,.@@.is-still *::before{transition:none!important;animation:none!important}
@media (prefers-reduced-motion: reduce){.@@ [data-list]>span,.@@ .@@-c img{transition:none}}
`;

// The full-width band - the newsletter band's rules (newsletter_block.py), with a button in place of the e-mail field.
const BAND = `
.@@.@@--band{background:var(--bg)}
.@@-g{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:56px;align-items:center;width:min(1150px,100% - 32px);margin:0 auto;padding:48px 0 50px}
.@@--band .@@-q,.@@--band .@@-h{margin:10px 0 12px!important}
.@@--band .@@-q{font-size:clamp(21px,2.2vw,27px)!important}
.@@--band .@@-w{font-size:clamp(26px,2.9vw,36px)}
.@@--band .@@-h{font-size:clamp(26px,2.9vw,36px)!important}
.@@--band .@@-p{max-width:540px}
.@@--band .@@-b{margin-top:22px}
.@@--band .@@-c{height:300px;border-radius:22px}
@media (max-width:900px){.@@-g{grid-template-columns:minmax(0,1fr);gap:24px;padding:34px 0 36px}.@@--band .@@-b{display:flex;width:100%}.@@--band .@@-c{height:190px;border-radius:18px}}
`;

// A size with a size: drawn in design pixels. Without container units (old browsers) it shows at its design size.
const FIXED = `
.@@.@@--fx{container-type:inline-size;width:100%;margin:0 auto}
.@@-s{--u:1px;position:relative;overflow:hidden;background:var(--bg)}
@supports (width:1cqw){.@@-s{--u:calc(100cqw / var(--w))}}
.@@-s .@@-x{position:absolute;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;min-width:0}
.@@-s .@@-c{position:absolute}
.@@-s .@@-h,.@@-s .@@-p{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.@@-s .@@-h{-webkit-line-clamp:3}.@@-s .@@-p{-webkit-line-clamp:3}
`;

/** Each fixed size, in its own design pixels. */
const SIZE_CSS: Record<Exclude<PresetKey, "band">, string> = {
  home: `
.@@--home{max-width:756px}.@@--home .@@-s{--w:756;aspect-ratio:756/355;border-radius:${u(18)}}
.@@--home .@@-x{left:${u(36)};top:0;bottom:0;width:${u(372)}}
.@@--home .@@-eb{gap:${u(9)};font-size:${u(11.5)}!important}.@@--home .@@-eb::before{width:${u(22)};height:${u(3)}}
.@@--home .@@-q{margin:${u(10)} 0 ${u(8)}!important;font-size:${u(18)}!important}.@@--home .@@-w{font-size:${u(27)}}
.@@--home .@@-h{margin:${u(10)} 0 ${u(8)}!important;font-size:${u(29)}!important}
.@@--home .@@-p{font-size:${u(13.5)}!important;line-height:1.5!important}
.@@--home .@@-b{margin-top:${u(16)};height:${u(40)};padding:0 ${u(17)};gap:${u(8)};border-radius:${u(10)};font-size:${u(14.5)}!important}.@@--home .@@-b svg{width:${u(15)};height:${u(15)}}
.@@--home .@@-c{right:${u(18)};top:${u(18)};bottom:${u(18)};width:${u(310)};border-radius:${u(16)}}
.@@--home .@@-t{left:${u(12)};bottom:${u(12)};padding:${u(6)} ${u(11)};border-radius:${u(10)};font-size:${u(13)}}
@container (max-width:520px){.@@--home .@@-s,.@@--hero .@@-s{aspect-ratio:auto;display:flex;flex-direction:column;border-radius:16px}
.@@--home .@@-c,.@@--hero .@@-c{position:relative;inset:auto;width:auto;height:190px;margin:12px 12px 0;border-radius:14px}
.@@--home .@@-x,.@@--hero .@@-x{position:static;width:auto;padding:18px 20px 22px}
.@@--home .@@-eb,.@@--hero .@@-eb{font-size:11.5px!important;gap:9px}.@@--home .@@-eb::before,.@@--hero .@@-eb::before{width:22px;height:3px}
.@@--home .@@-q,.@@--hero .@@-q{margin:9px 0 8px!important;font-size:18px!important}.@@--home .@@-w,.@@--hero .@@-w{font-size:25px}
.@@--home .@@-h,.@@--hero .@@-h{margin:9px 0 8px!important;font-size:25px!important}
.@@--home .@@-p,.@@--hero .@@-p{font-size:14.5px!important;-webkit-line-clamp:5}
.@@--home .@@-b,.@@--hero .@@-b{display:flex;width:100%;margin-top:16px;height:48px;font-size:16px!important;border-radius:12px;gap:10px}
.@@--home .@@-b svg,.@@--hero .@@-b svg{width:17px;height:17px}
.@@--home .@@-t,.@@--hero .@@-t{left:12px;bottom:12px;padding:7px 12px;font-size:14px;border-radius:11px}}
`,
  hero: `
.@@--hero{max-width:1092px}.@@--hero .@@-s{--w:1092;aspect-ratio:1092/800;border-radius:${u(24)}}
.@@--hero .@@-x{left:${u(72)};top:0;bottom:0;width:${u(480)}}
.@@--hero .@@-eb{gap:${u(12)};font-size:${u(14)}!important}.@@--hero .@@-eb::before{width:${u(30)};height:${u(4)}}
.@@--hero .@@-q{margin:${u(16)} 0 ${u(14)}!important;font-size:${u(30)}!important}.@@--hero .@@-w{margin-top:${u(6)};font-size:${u(52)};line-height:1.08}
.@@--hero .@@-h{margin:${u(16)} 0 ${u(16)}!important;font-size:${u(54)}!important;line-height:1.08!important;-webkit-line-clamp:4}
.@@--hero .@@-p{font-size:${u(19)}!important;line-height:1.55!important;-webkit-line-clamp:5}
.@@--hero .@@-b{margin-top:${u(32)};height:${u(58)};padding:0 ${u(28)};gap:${u(12)};border-radius:${u(14)};font-size:${u(18)}!important}.@@--hero .@@-b svg{width:${u(19)};height:${u(19)}}
.@@--hero .@@-c{right:${u(56)};top:${u(64)};bottom:${u(64)};width:${u(440)};border-radius:${u(28)}}
.@@--hero .@@-t{left:${u(18)};bottom:${u(18)};padding:${u(10)} ${u(16)};border-radius:${u(14)};font-size:${u(18)}}
`,
  mail: `
.@@--mail{max-width:600px}.@@--mail .@@-s{--w:600;aspect-ratio:600/200}
.@@--mail .@@-x{left:${u(28)};top:${u(22)};bottom:${u(22)};width:${u(330)};justify-content:flex-end}
.@@--mail .@@-lg{position:absolute;left:${u(28)};top:${u(22)};height:${u(17)}}
.@@--mail .@@-eb{gap:${u(8)};font-size:${u(10)}!important}.@@--mail .@@-eb::before{width:${u(18)};height:${u(2.5)}}
.@@--mail .@@-h{margin:${u(7)} 0 0!important;font-size:${u(24)}!important;line-height:1.12!important;-webkit-line-clamp:2}
.@@--mail .@@-p{margin-top:${u(6)}!important;font-size:${u(12.5)}!important;line-height:1.4!important;-webkit-line-clamp:2}
.@@--mail .@@-c{right:${u(14)};top:${u(14)};bottom:${u(14)};width:${u(212)};border-radius:${u(14)};box-shadow:none}
.@@--mail .@@-t{left:${u(9)};bottom:${u(9)};padding:${u(4)} ${u(8)};border-radius:${u(7)};font-size:${u(10.5)}}
`,
  card: `
.@@--card{max-width:1200px}.@@--card .@@-s{--w:1200;aspect-ratio:1200/627}
.@@--card .@@-x{left:${u(64)};top:${u(104)};bottom:${u(52)};width:${u(560)}}
.@@--card .@@-lg{position:absolute;left:${u(64)};top:${u(56)};height:${u(30)}}
.@@--card .@@-eb{gap:${u(12)};font-size:${u(15)}!important}.@@--card .@@-eb::before{width:${u(30)};height:${u(4)}}
.@@--card .@@-h{margin:${u(16)} 0 ${u(14)}!important;font-size:${u(54)}!important;line-height:1.08!important}
.@@--card .@@-p{font-size:${u(21)}!important;line-height:1.5!important}
.@@--card .@@-b{margin-top:${u(28)};height:${u(56)};padding:0 ${u(26)};gap:${u(12)};border-radius:${u(14)};font-size:${u(19)}!important}.@@--card .@@-b svg{width:${u(19)};height:${u(19)}}
.@@--card .@@-c{right:${u(48)};top:${u(48)};bottom:${u(48)};width:${u(480)};border-radius:${u(28)}}
.@@--card .@@-t{left:${u(18)};bottom:${u(18)};padding:${u(10)} ${u(16)};border-radius:${u(14)};font-size:${u(18)}}
`,
  mrec: `
.@@--mrec{max-width:300px}.@@--mrec .@@-s{--w:300;aspect-ratio:300/250}
.@@--mrec .@@-c{left:${u(10)};top:${u(10)};right:${u(10)};height:${u(104)};border-radius:${u(10)};box-shadow:none}
.@@--mrec .@@-lgc{position:absolute;z-index:3;left:${u(18)};top:${u(18)};padding:${u(5)} ${u(7)};border-radius:${u(7)};background:#fff}
.@@--mrec .@@-lg{height:${u(11)}}
.@@--mrec .@@-x{left:${u(16)};right:${u(16)};top:${u(122)};bottom:${u(14)};justify-content:flex-start}
.@@--mrec .@@-h{font-size:${u(18.5)}!important;line-height:1.15!important;-webkit-line-clamp:2}
.@@--mrec .@@-p{margin-top:${u(5)}!important;font-size:${u(11.5)}!important;line-height:1.4!important;-webkit-line-clamp:2}
.@@--mrec .@@-b{margin-top:auto;height:${u(30)};padding:0 ${u(12)};gap:${u(6)};border-radius:${u(8)};font-size:${u(12.5)}!important}.@@--mrec .@@-b svg{width:${u(12)};height:${u(12)}}
`,
  leader: `
.@@--leader{max-width:728px}.@@--leader .@@-s{--w:728;aspect-ratio:728/90;display:flex;align-items:center;gap:${u(18)};padding:0 ${u(14)} 0 ${u(20)}}
.@@--leader .@@-lg{flex:none;height:${u(22)}}
.@@--leader .@@-x{position:static;flex:1;align-self:stretch}
.@@--leader .@@-h{font-size:${u(19)}!important;line-height:1.15!important;-webkit-line-clamp:2}
.@@--leader .@@-c{position:relative;flex:none;width:${u(118)};height:${u(66)};border-radius:${u(10)};box-shadow:none}
.@@--leader .@@-b{flex:none;height:${u(38)};padding:0 ${u(16)};gap:${u(7)};border-radius:${u(10)};font-size:${u(14)}!important}.@@--leader .@@-b svg{width:${u(14)};height:${u(14)}}
`,
  sky: `
.@@--sky{max-width:160px}.@@--sky .@@-s{--w:160;aspect-ratio:160/600;display:flex;flex-direction:column;padding:${u(16)} ${u(14)} ${u(16)}}
.@@--sky .@@-lg{flex:none;height:${u(15)};align-self:flex-start}
.@@--sky .@@-x{position:static;flex:1;justify-content:flex-start;margin-top:${u(26)}}
.@@--sky .@@-eb{gap:${u(7)};font-size:${u(9.5)}!important;letter-spacing:.1em!important}.@@--sky .@@-eb::before{width:${u(16)};height:${u(2.5)}}
.@@--sky .@@-h{margin:${u(9)} 0 0!important;font-size:${u(21)}!important;line-height:1.12!important;-webkit-line-clamp:6}
.@@--sky .@@-p{margin-top:${u(9)}!important;font-size:${u(12)}!important;line-height:1.45!important;-webkit-line-clamp:6}
.@@--sky .@@-c{position:relative;flex:none;height:${u(176)};border-radius:${u(12)};box-shadow:none}
.@@--sky .@@-b{flex:none;width:100%;margin-top:${u(12)};height:${u(34)};padding:0 ${u(8)};gap:${u(6)};border-radius:${u(9)};font-size:${u(13)}!important}.@@--sky .@@-b svg{width:${u(13)};height:${u(13)}}
`,
};

/** The rules for these sizes, under the banner's class; nothing outside it. */
export function bannerCss(prefix: string, theme: ThemeKey, keys: PresetKey[]): string {
  const fixed = keys.filter((k): k is Exclude<PresetKey, "band"> => k !== "band");
  // home and hero share their phone rules - written once, with home's
  const parts = [BASE.replace("__VARS__", themeVars(theme)), keys.includes("band") ? BAND : "", fixed.length ? FIXED : ""];
  for (const k of fixed) parts.push(k === "hero" && !fixed.includes("home") ? SIZE_CSS.hero + phoneOf(SIZE_CSS.home) : SIZE_CSS[k]);
  return parts.join("\n").replace(/@@/g, prefix).split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
}
const phoneOf = (homeCss: string) => homeCss.slice(homeCss.indexOf("@container"));

type Mode = { still: boolean };

/** The photos the card shows: the list (two or more crossfade), else the one picture. */
function cardPhotos(d: BannerDoc): { url: string; label: string }[] {
  const list = d.content.photos.map((p) => ({ url: mediaUrl(p.url), label: p.label.trim() })).filter((p) => p.url);
  if (list.length >= 2) return list;
  const one = { url: mediaUrl(d.content.image.url), label: d.content.image.label.trim() };
  return one.url ? [one] : list;
}

function bodyHtml(d: BannerDoc, key: PresetKey, prefix: string, m: Mode, href: string): string {
  const p = PRESET[key];
  const w = wordsFor(d, key);
  const photos = m.still ? cardPhotos(d).slice(0, 1) : cardPhotos(d);
  const motion = !m.still && p.motion && (w.words.length > 1 || photos.length > 1);
  const lang = (d.language || "EN").toLowerCase().slice(0, 2);
  const P = prefix;
  const label = esc(w.eyebrow || w.headline || "Banner");
  const head = w.words.length
    ? `<p class="${P}-q">${esc(w.headline)} <span class="${P}-w" data-list="w"><span>${esc(w.words[0])}</span></span></p>`
    : w.headline ? `<h2 class="${P}-h">${esc(w.headline)}</h2>` : "";
  const button = w.button && href
    ? `<a class="${P}-b" href="${attr(href)}">${esc(w.button)}${ARROW}</a>`
    : w.button ? `<span class="${P}-b">${esc(w.button)}${ARROW}</span>` : "";
  // the leaderboard and the skyscraper end on their button, after the photo; the others keep it under the words
  const apart = key === "leader" || key === "sky";
  const text = `<div class="${P}-x">${w.eyebrow ? `<span class="${P}-eb">${esc(w.eyebrow)}</span>` : ""}${head}${w.line ? `<p class="${P}-p">${esc(w.line)}</p>` : ""}${apart ? "" : button}</div>`;
  const imgs = photos.map((x, i) => `<img src="${attr(x.url)}" alt=""${i ? ' loading="lazy"' : ""} decoding="async"${i === 0 ? ` class="is-on"` : ""}>`).join("");
  const showLabel = key !== "mrec" && key !== "leader" && key !== "sky" && photos[0]?.label;
  const card = photos.length
    ? `<div class="${P}-c" aria-hidden="true">${imgs}${showLabel ? `<span class="${P}-t" data-list="n"><span>${esc(photos[0].label)}</span></span>` : ""}</div>`
    : "";
  const logo = p.logo ? (key === "mrec" ? `<span class="${P}-lgc">${logoSvg(`${P}-lg`)}</span>` : logoSvg(`${P}-lg`, THEMES[d.theme].dark ? "#ffffff" : BRAND.red)) : "";
  const data = motion ? `<script type="application/json" class="${P}-d">${JSON.stringify({ w: w.words, n: photos.map((x) => x.label) }).replace(/</g, "\\u003c")}</script>` : "";
  const cls = `${P} ${P}--${key}${key === "band" ? "" : ` ${P}--fx`}${m.still ? " is-still" : ""}`;
  const attrs = `class="${cls}" lang="${esc(lang)}" aria-label="${label}"${motion ? " data-motion" : ""}`;
  if (key === "band") return `<section ${attrs}><div class="${P}-g">${text}${card}</div>${data}</section>`;
  // the leaderboard and the skyscraper read in order (logo, words, photo, button); the others place each part themselves
  const inner = apart ? `${logo}${text}${card}${button}` : `${card}${logo}${text}`;
  return `<section ${attrs}><div class="${P}-s">${inner}</div>${data}</section>`;
}

/** The motion: the word and the photo change together every 2.6 s, only while the banner is on screen; never under
 *  "reduce motion" (the first word and photo stay). The tallest word sets the height, so nothing below jumps. */
export function bannerJs(prefix: string): string {
  return `<script>
(function () { /* APSOparts banner: the changing word and photo, only while on screen */
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  [].forEach.call(document.querySelectorAll(".@@[data-motion]"), function (root) {
    if (root.getAttribute("data-on")) return; root.setAttribute("data-on", "1");
    var L = {}; try { L = JSON.parse(root.querySelector(".@@-d").textContent); } catch (e) {}
    var W = L.w || [], N = L.n || [], rots = [].slice.call(root.querySelectorAll("[data-list]")), pics = root.querySelectorAll(".@@-c img"), i = 0, t = null, io = null, rz;
    function list(el) { return el.getAttribute("data-list") === "w" ? W : N; }
    function mark() { [].forEach.call(pics, function (p, k) { p.classList.toggle("is-on", k === i % pics.length); if (k === (i + 1) % pics.length) p.loading = "eager"; }); }
    function fit() { rots.forEach(function (el) { var s = el.firstElementChild, l = list(el), keep = s.textContent, h = 0;
      el.style.minHeight = ""; l.forEach(function (x) { s.textContent = x; h = Math.max(h, el.offsetHeight); }); s.textContent = keep; if (h) el.style.minHeight = h + "px"; }); }
    function swap(el) { var s = el.firstElementChild, l = list(el); if (l.length < 2) return; var x = l[i % l.length]; el.classList.add("is-out");
      setTimeout(function () { s.textContent = x; el.classList.remove("is-out"); el.classList.add("is-in"); void s.offsetWidth; el.classList.remove("is-in"); }, 330); }
    function next() { i = (i + 1) % 840; mark(); rots.forEach(swap); }
    mark();
    if (!RM && (W.length > 1 || pics.length > 1)) {
      fit(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
      window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(fit, 200); });
      if ("IntersectionObserver" in window) { io = new IntersectionObserver(function (e) { if (e[e.length - 1].isIntersecting) { if (!t) t = setInterval(next, 2600); } else if (t) { clearInterval(t); t = null; } }); io.observe(root); }
    }
    root.__stop = function () { if (t) clearInterval(t); t = null; if (io) io.disconnect(); };
  });
})();
</script>`.replace(/@@/g, prefix);
}

/** The block a Magento editor pastes: one row (no padding), one HTML Code element, this whole text. */
export function pasteBlock(d: BannerDoc, key: PresetKey, prefix: string, title = ""): string {
  const p = PRESET[key];
  const w = wordsFor(d, key);
  const body = bodyHtml(d, key, prefix, { still: false }, pasteHref(w.url));
  const motion = body.includes(" data-motion");
  const name = title.replace(/--+/g, "-").replace(/[<>]/g, "").slice(0, 80);
  return [
    `<!-- APSOparts banner${name ? ` "${name}"` : ""} - ${p.label} (${d.language}). Page Builder: ONE row (no padding) with ONE HTML Code element; paste this whole block. All its rules live under .${prefix}. -->`,
    `<style>\n${bannerCss(prefix, d.theme, [key])}\n</style>`,
    body,
    motion ? bannerJs(prefix) : "",
  ].filter(Boolean).join("\n") + "\n";
}

/** Any size frozen on its first word and photo, with the CSS it needs - for a PNG or a still view. */
export function stillMarkup(d: BannerDoc, key: PresetKey, prefix: string): { css: string; html: string } {
  const w = wordsFor(d, key);
  return { css: bannerCss(prefix, d.theme, [key]), html: bodyHtml(d, key, prefix, { still: true }, linkOf(w.url).href) };
}

/** The motion-free markup of several sizes at once, sharing one stylesheet (the "All sizes" view). */
export function stillSheet(d: BannerDoc, keys: PresetKey[], prefix: string): { css: string; html: Record<string, string> } {
  const html: Record<string, string> = {};
  for (const k of keys) html[k] = bodyHtml(d, k, prefix, { still: true }, linkOf(wordsFor(d, k).url).href);
  return { css: bannerCss(prefix, d.theme, keys), html };
}

/** The paste block with its shop links made full addresses - what a page outside Magento can open. */
const openable = (block: string) => block.replace(/\{\{store direct_url='([^']*)'\}\}/g, (_, path: string) => linkOf(path).href);

/**
 * The paste block in a page of its own, for the studio's frame: the brand's font (data: - the hub lets nothing else
 * in), its height told to the studio, links kept in place, and a way to swap the banner without reloading the frame.
 */
export function previewDoc(block: string, fontCss: string, background = "#ffffff"): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${fontCss}</style><style>html,body{margin:0;padding:0;background:${background}}</style></head><body><div id="stage">${openable(block)}</div>
<script>
(function () {
  var stage = document.getElementById("stage"), last = 0;
  function tell() { var h = Math.ceil(stage.getBoundingClientRect().height); if (h !== last) { last = h; parent.postMessage({ apsoBanner: "height", h: h }, "*"); } }
  if ("ResizeObserver" in window) new ResizeObserver(tell).observe(stage); setTimeout(tell, 60);
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("a")) e.preventDefault(); }, true);
  window.addEventListener("message", function (e) {
    var m = e.data; if (!m || m.apsoBanner !== "swap" || typeof m.html !== "string") return;
    [].forEach.call(stage.querySelectorAll("[data-on]"), function (r) { if (r.__stop) r.__stop(); });
    var box = document.createElement("div"); box.innerHTML = m.html; stage.innerHTML = "";
    [].slice.call(box.childNodes).forEach(function (n) {
      if (n.tagName === "SCRIPT") { var s = document.createElement("script"); s.textContent = n.textContent; stage.appendChild(s); } else stage.appendChild(n);
    });
    tell();
  });
})();
</script></body></html>`;
}

/** The swap the frame takes: the paste block as it opens outside Magento. */
export const previewSwap = (block: string) => openable(block);

/** A page that opens in any browser: the paste block with Jost from Google Fonts and full links (Download HTML). */
export function htmlFile(block: string, title: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title || "APSOparts banner")}</title>
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>html,body{margin:0;background:#fff}</style>
</head><body>
${openable(block)}
</body></html>
`;
}
