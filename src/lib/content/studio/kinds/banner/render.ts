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
// The first look was the newsletter band's (home-page-2026/newsletter_block.py): petrol, the shop's red, ink, futura-pt
// (Jost where futura-pt is not loaded), an eyebrow with a red bar, a photo card with a white label. Since Content v7
// (10.11.2026, SARCLA point 11: "improve a lot the banner page") a banner takes one of the shop's own best banners as its
// DESIGN (model.ts LOOKS, colours in ./looks.ts): the Evolast slide's petrol, the O-ring guide's light photo, the Variety
// Series' red block, the Black Friday hero, a photo behind the words - each drawn over the same places, so every size of
// a banner stays in step. A design changes the ground, the type, the button and how the picture stands (a product photo
// stands free: on a light disc over a dark ground). The fixed sizes are drawn in design pixels (--u = one pixel at the
// real size) so a 756 x 355 slot scales with its column and its PNG is exact; the shop banner is the shop slider's own
// 1920 x 600, with its 1080 x 900 picture for phones.

import { BRAND, absoluteMedia, esc, linkOf, logoSvg, mediaUrl, pasteHref } from "./brand";
import { PRESET, THEMES, isBand, wordsFor, type BannerDoc, type HeadColor, type LookKey, type PresetKey, type ThemeKey } from "./model";
import { paletteOf, type Palette } from "./looks";

const u = (n: number) => `calc(var(--u)*${n})`;
/** An address in a double-quoted attribute. Single quotes stay as they are: Magento's {{store direct_url='...'}} needs them. */
const attr = (s: string) => s.replace(/&(?!amp;)/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/** The class every rule hangs under - one per to-do, so two banners on one page never meet. */
export const prefixFor = (pieceId: number | string) => `apb${String(pieceId).replace(/[^A-Za-z0-9]/g, "").slice(0, 12) || "x"}`;

/** A banner's design: its look, its colour, its headline's colour. A colour alone is the newsletter band in it. */
export type Design = { look: LookKey; theme: ThemeKey; headColor?: HeadColor };
const designOf = (x: ThemeKey | Design): Design => (typeof x === "string" ? { look: "band", theme: x } : x);
/** A size to draw: one of the places, or the shop banner's picture for phones. */
export type Format = PresetKey | "slidem";
const placeOfFormat = (f: Format): PresetKey => (f === "slidem" ? "slider" : f);
/** How a size stands: wide (words left, picture right), tall (picture over the words), a strip, or a band. */
const ORIENT: Record<Format, "h" | "v" | "strip" | "band"> = {
  slider: "h", slidem: "h", hero: "h", home: "h", mail: "h", card: "h", square: "v", portrait: "v", story: "v", mrec: "v", leader: "strip", sky: "strip", band: "band", cat: "band",
};

function themeVars(dz: Design): string {
  const t = THEMES[dz.theme] ?? THEMES.pale;
  const p = paletteOf(dz.look, dz.theme, dz.headColor ?? "auto");
  const band = dz.look === "band";
  // the band keeps its own variables as they were; a design of the shop's banners sets its ground and the words' colours
  const base = band
    ? `--bg:${t.bg};--fg:${t.fg};--mut:${t.mut};--acc:${p.head};--eb:${t.eb};--fb:${t.fb};--card:${t.card}`
    : `--bg:${p.ground};--fg:${p.head};--mut:${p.line};--acc:${p.head};--eb:${p.eyebrow};--fb:transparent;--card:transparent`;
  const scrim = p.scrim ? hexA(p.scrim.color) : "";
  return `${base};--hc:${p.head};--ac:${p.accent};--lc:${p.line};--ec:${p.eyebrow};--bc:${p.bar};--bb:${p.button.bg};--bf:${p.button.fg};--bh:${p.button.hover}`
    + `${p.panel ? `;--panel:${p.panel}` : ""}${p.disc ? `;--disc:${p.disc}` : ""}`
    + (scrim ? `;--scrim-h:linear-gradient(90deg,${scrim(0.92)} 0%,${scrim(0.8)} 50%,${scrim(0.25)} 78%,${scrim(0)} 100%);--scrim-v:linear-gradient(0deg,${scrim(0.92)} 0%,${scrim(0.8)} 48%,${scrim(0.25)} 72%,${scrim(0)} 88%)` : "");
}
/** A colour at an opacity, for a veil. */
const hexA = (hex: string) => (a: number) => {
  const h = hex.replace("#", "");
  const n = (i: number) => Number.parseInt(h.slice(i, i + 2), 16);
  return `rgba(${n(0)},${n(2)},${n(4)},${a})`;
};

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
.@@ .@@-r{color:var(--ac,var(--red))}
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

// The category band: the band's rules, slimmer - it sits over a category's products and must not push them down.
const CAT = `
.@@.@@--cat{background:var(--bg)}
.@@--cat .@@-g{grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:40px;padding:28px 0 30px}
.@@--cat .@@-q,.@@--cat .@@-h{margin:8px 0 8px!important}
.@@--cat .@@-q{font-size:clamp(18px,1.8vw,22px)!important}
.@@--cat .@@-w{font-size:clamp(22px,2.3vw,28px)}
.@@--cat .@@-h{font-size:clamp(22px,2.3vw,28px)!important}
.@@--cat .@@-p{max-width:560px;font-size:14.5px!important;line-height:1.55!important}
.@@--cat .@@-b{margin-top:14px;height:44px;padding:0 18px;font-size:15px!important;border-radius:10px}
.@@--cat .@@-c{height:178px;border-radius:18px}
@media (max-width:900px){.@@--cat .@@-g{grid-template-columns:minmax(0,1fr);gap:16px;padding:22px 0 24px}.@@--cat .@@-b{display:flex;width:100%}.@@--cat .@@-c{height:150px;border-radius:14px}}
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

/** The tall social pictures: the logo, the photo across the top, the words under it, the button at the foot. */
const social = (k: string, w: number, h: number, o: { pad: number; top: number; logo: number; photo: number; text: number; bottom: number; eb: number; h: number; hc: number; p: number; pc: number; b: number; bf: number }) => `
.@@--${k}{max-width:${w}px}.@@--${k} .@@-s{--w:${w};--bleed:${o.text - 30};aspect-ratio:${w}/${h}}
.@@--${k} .@@-lg{position:absolute;left:${u(o.pad)};top:${u(o.top)};height:${u(o.logo)}}
.@@--${k} .@@-c{left:${u(o.pad)};right:${u(o.pad)};top:${u(o.top + o.logo + 40)};height:${u(o.photo)};border-radius:${u(36)};box-shadow:0 ${u(30)} ${u(60)} ${u(-34)} rgba(27,58,75,.55)}
.@@--${k} .@@-t{left:${u(24)};bottom:${u(24)};padding:${u(12)} ${u(20)};border-radius:${u(16)};font-size:${u(26)}}
.@@--${k} .@@-x{left:${u(o.pad)};right:${u(o.pad)};top:${u(o.text)};bottom:${u(o.bottom)};justify-content:flex-start}
.@@--${k} .@@-eb{gap:${u(14)};font-size:${u(o.eb)}!important}.@@--${k} .@@-eb::before{width:${u(40)};height:${u(5)}}
.@@--${k} .@@-h{margin:${u(16)} 0 ${u(14)}!important;font-size:${u(o.h)}!important;line-height:1.06!important;-webkit-line-clamp:${o.hc}}
.@@--${k} .@@-p{font-size:${u(o.p)}!important;line-height:1.42!important;-webkit-line-clamp:${o.pc}}
.@@--${k} .@@-b{margin-top:auto;height:${u(o.b)};padding:0 ${u(o.b * 0.46)};gap:${u(14)};border-radius:${u(18)};font-size:${u(o.bf)}!important}.@@--${k} .@@-b svg{width:${u(o.bf)};height:${u(o.bf)}}
`;

// THE DESIGNS OF THE SHOP'S BANNERS (Content v7) - over every size: the ground, the words' colours and weight, the button,
// how the picture stands. The newsletter band ("band") keeps its own rules above, untouched.
const LOOK_CSS = `
.@@--new .@@-q,.@@--new .@@-h{color:var(--hc)!important;font-weight:700!important;letter-spacing:-.012em!important}
.@@--new .@@-w{color:var(--ac);font-weight:700}
.@@--new .@@-p{font-family:var(--head)!important;color:var(--lc)!important;font-weight:400!important}
.@@--new .@@-eb{color:var(--ec)!important;font-weight:700!important}
.@@--new .@@-eb::before{background:var(--bc)}
.@@--new .@@-b{background:var(--bb);color:var(--bf)!important;font-weight:700!important;box-shadow:0 12px 26px -16px rgba(0,0,0,.5)}
.@@--new .@@-b:hover,.@@--new .@@-b:focus-visible{background:var(--bh);color:var(--bf)!important}
.@@--pill .@@-b{border-radius:999px!important;text-transform:uppercase;letter-spacing:.05em}
.@@--pill .@@-b svg{display:none}
.@@--ul .@@-r,.@@--ul .@@-w{color:inherit;text-decoration:underline;text-decoration-color:var(--bc);text-decoration-thickness:.1em;text-underline-offset:.16em;text-decoration-skip-ink:none}
.@@--new .@@-t{display:none}
.@@--new .@@-c{background:transparent;box-shadow:none}
.@@--new .@@-c.is-prod img{object-fit:contain;padding:7%;mix-blend-mode:multiply;-webkit-mask-image:radial-gradient(circle closest-side at 50% 50%,#000 60%,transparent 92%);mask-image:radial-gradient(circle closest-side at 50% 50%,#000 60%,transparent 92%);-webkit-mask-origin:content-box;mask-origin:content-box;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat}
.@@--new .@@-x{z-index:2}
.@@--new .@@-x>*{flex-shrink:0}
.@@--new .@@-lg,.@@--new .@@-lgc{z-index:3}
.@@--look-light.@@--v:not(.@@--mrec) .@@-lg,.@@--look-photo.@@--v:not(.@@--mrec) .@@-lg{box-sizing:content-box;padding:calc(var(--u)*9) calc(var(--u)*13);border-radius:calc(var(--u)*10);background:#fff;box-shadow:0 6px 16px -10px rgba(0,0,0,.45)}
.@@--pill.@@--sky .@@-b{text-transform:none;letter-spacing:0}
.@@--look-petrol .@@-c:not(.is-prod),.@@--look-campaign .@@-c:not(.is-prod){box-shadow:0 30px 60px -32px rgba(0,0,0,.6)}
.@@--look-petrol .@@-c.is-prod{background:var(--disc)!important;border-radius:0!important}
.@@--look-petrol .@@-c.is-prod img{padding:11%}
.@@--look-light.@@--h .@@-c{top:0!important;right:0!important;bottom:0!important;left:auto!important;width:52%!important;height:auto!important;border-radius:0!important}
.@@--look-light.@@--v .@@-c{top:0!important;left:0!important;right:0!important;bottom:auto!important;width:auto!important;height:calc(var(--u)*var(--bleed,400))!important;border-radius:0!important}
.@@--look-light.@@--h .@@-c:not(.is-prod){-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 40%);mask-image:linear-gradient(90deg,transparent 0,#000 40%)}
.@@--look-light.@@--v .@@-c:not(.is-prod){-webkit-mask-image:linear-gradient(180deg,#000 64%,transparent 100%);mask-image:linear-gradient(180deg,#000 64%,transparent 100%)}
.@@--look-light.@@--band .@@-c:not(.is-prod){border-radius:0;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 30%);mask-image:linear-gradient(90deg,transparent 0,#000 30%)}
.@@--look-light .@@-c.is-prod img{padding:9% 7%}
.@@--look-red .@@-s::before{content:"";position:absolute;z-index:0;background:var(--panel)}
.@@--look-red.@@--h .@@-s::before{left:3%;top:9%;bottom:9%;right:30%}
.@@--look-red.@@--v .@@-s::before{left:4%;right:4%;top:44%;bottom:4%}
.@@--look-red.@@--strip .@@-s{background:var(--panel)}
.@@--look-red.@@--h .@@-x{top:12%!important;bottom:12%!important;padding-left:calc(var(--u)*26)}
.@@--look-red.@@--slider .@@-x{top:9%!important;bottom:9%!important}.@@--look-red.@@--slider .@@-h{font-size:calc(var(--u)*58)!important}
.@@--look-red.@@--card .@@-s::before{top:20%}.@@--look-red.@@--card .@@-x{top:23%!important;bottom:12%!important}
.@@--look-red.@@--mail .@@-s::before{top:22%}.@@--look-red.@@--mail .@@-x{top:26%!important;bottom:14%!important}
.@@--look-red.@@--v .@@-x{padding:0 calc(var(--u)*14)}
.@@--look-red.@@--band .@@-x{padding:clamp(24px,3vw,40px);border-radius:4px;background:var(--panel)}
.@@--look-red .@@-h{-webkit-line-clamp:4}
.@@--look-red .@@-c{z-index:1;background:#fff;box-shadow:0 30px 50px -28px rgba(0,0,0,.55);transform:rotate(-2deg)}
.@@--look-red.@@--strip .@@-c{transform:none}
.@@--look-campaign .@@-h,.@@--look-campaign .@@-q{font-weight:800!important;letter-spacing:-.018em!important}
.@@--look-campaign .@@-c.is-prod{border-radius:0!important}
.@@--look-campaign .@@-c.is-prod img{padding:5%;-webkit-mask-image:radial-gradient(circle closest-side at 50% 48%,#000 64%,transparent 96%);mask-image:radial-gradient(circle closest-side at 50% 48%,#000 64%,transparent 96%)}
.@@--look-photo.@@--h .@@-c,.@@--look-photo.@@--v .@@-c{top:0!important;left:0!important;right:0!important;bottom:0!important;width:auto!important;height:auto!important;border-radius:0!important;box-shadow:none!important;transform:none!important}
.@@--look-photo.@@--h .@@-c::after,.@@--look-photo.@@--band .@@-c::after,.@@--look-photo.@@--cat .@@-c::after{content:"";position:absolute;inset:0;z-index:1;background:var(--scrim-h)}
.@@--look-photo.@@--v .@@-c::after{content:"";position:absolute;inset:0;z-index:1;background:var(--scrim-v)}
.@@--look-photo .@@-c.is-prod img{mix-blend-mode:normal}
.@@--look-photo.@@--band,.@@--look-photo.@@--cat{position:relative;overflow:hidden}
.@@--look-photo.@@--band .@@-c,.@@--look-photo.@@--cat .@@-c{position:absolute!important;inset:0!important;height:auto!important;border-radius:0!important;box-shadow:none!important}
.@@--look-photo .@@-g{position:relative;z-index:2}
`;

/** Each fixed size, in its own design pixels. */
const SIZE_CSS: Record<Exclude<Format, "band" | "cat">, string> = {
  // the shop's own banner, its slider's 1920 x 600 (the Evolast FFKM slide's measures: words 120 px in, the picture right)
  slider: `
.@@--slider{max-width:1920px}.@@--slider .@@-s{--w:1920;aspect-ratio:1920/600}
.@@--slider .@@-x{left:${u(120)};top:0;bottom:0;width:${u(800)}}
.@@--slider .@@-eb{gap:${u(16)};font-size:${u(19)}!important}.@@--slider .@@-eb::before{width:${u(40)};height:${u(5)}}
.@@--slider .@@-q{margin:${u(18)} 0 ${u(14)}!important;font-size:${u(40)}!important}.@@--slider .@@-w{font-size:${u(62)}}
.@@--slider .@@-h{margin:${u(18)} 0 ${u(20)}!important;font-size:${u(66)}!important;line-height:1.06!important;-webkit-line-clamp:3}
.@@--slider .@@-p{max-width:${u(720)};font-size:${u(30)}!important;line-height:1.36!important;-webkit-line-clamp:3}
.@@--slider .@@-b{margin-top:${u(42)};height:${u(78)};padding:0 ${u(42)};gap:${u(14)};border-radius:${u(16)};font-size:${u(25)}!important}.@@--slider .@@-b svg{width:${u(24)};height:${u(24)}}
.@@--slider .@@-c{right:${u(80)};top:${u(40)};bottom:${u(40)};width:${u(780)};border-radius:${u(28)}}
.@@--slider .@@-t{left:${u(22)};bottom:${u(22)};padding:${u(12)} ${u(20)};border-radius:${u(16)};font-size:${u(22)}}
`,
  // ... and its picture for phones: 1080 x 900, the words top left, the picture bottom right
  slidem: `
.@@--slidem{max-width:1080px}.@@--slidem .@@-s{--w:1080;aspect-ratio:1080/900}
.@@--slidem .@@-x{left:${u(72)};top:${u(72)};bottom:${u(72)};width:${u(520)}}
.@@--slidem .@@-eb{gap:${u(14)};font-size:${u(20)}!important}.@@--slidem .@@-eb::before{width:${u(36)};height:${u(5)}}
.@@--slidem .@@-q{margin:${u(16)} 0 ${u(12)}!important;font-size:${u(36)}!important}.@@--slidem .@@-w{font-size:${u(56)}}
.@@--slidem .@@-h{margin:${u(18)} 0 ${u(20)}!important;font-size:${u(60)}!important;line-height:1.06!important;-webkit-line-clamp:4}
.@@--slidem .@@-p{font-size:${u(30)}!important;line-height:1.36!important;-webkit-line-clamp:4}
.@@--slidem .@@-b{margin-top:${u(36)};height:${u(80)};padding:0 ${u(40)};gap:${u(14)};border-radius:${u(16)};font-size:${u(26)}!important}.@@--slidem .@@-b svg{width:${u(24)};height:${u(24)}}
.@@--slidem .@@-c{right:${u(48)};bottom:${u(56)};width:${u(440)};height:${u(580)};border-radius:${u(28)}}
.@@--slidem .@@-t{left:${u(20)};bottom:${u(20)};padding:${u(10)} ${u(18)};border-radius:${u(14)};font-size:${u(22)}}
`,
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
  // the square: 1080 x 1080 - logo 64, photo 144-584, words 624-1016
  square: social("square", 1080, 1080, { pad: 72, top: 64, logo: 40, photo: 440, text: 624, bottom: 64, eb: 22, h: 64, hc: 2, p: 28, pc: 2, b: 76, bf: 28 }),
  // the portrait: 1080 x 1350 - more room for the photo and a third line
  portrait: social("portrait", 1080, 1350, { pad: 72, top: 64, logo: 40, photo: 600, text: 790, bottom: 72, eb: 23, h: 70, hc: 3, p: 30, pc: 3, b: 80, bf: 30 }),
  // the story: 1080 x 1920 - everything between 250 and 1650, where the apps' own bars do not cover it
  story: social("story", 1080, 1920, { pad: 90, top: 270, logo: 48, photo: 700, text: 1110, bottom: 280, eb: 26, h: 82, hc: 3, p: 32, pc: 3, b: 92, bf: 32 }),
  mrec: `
.@@--mrec{max-width:300px}.@@--mrec .@@-s{--w:300;--bleed:118;aspect-ratio:300/250}
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

/** The rules for these sizes, in this design (a colour alone = the newsletter band), under the banner's class; nothing outside it. */
export function bannerCss(prefix: string, design: ThemeKey | Design, keys: Format[]): string {
  const dz = designOf(design);
  const isBandF = (k: Format) => k === "band" || k === "cat";
  const fixed = keys.filter((k): k is Exclude<Format, "band" | "cat"> => !isBandF(k));
  // home and hero share their phone rules - written once, with home's
  const parts = [BASE.replace("__VARS__", themeVars(dz)), keys.some(isBandF) ? BAND : "", keys.includes("cat") ? CAT : "", fixed.length ? FIXED : ""];
  for (const k of fixed) parts.push(k === "hero" && !fixed.includes("home") ? SIZE_CSS.hero + phoneOf(SIZE_CSS.home) : SIZE_CSS[k]);
  if (dz.look !== "band") parts.push(LOOK_CSS);
  return parts.join("\n").replace(/@@/g, prefix).split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
}
const phoneOf = (homeCss: string) => homeCss.slice(homeCss.indexOf("@container"));

/** How it is drawn: frozen on its first word and photo (PNG, overview), where a hub picture is read from, and the
 * shop banner's picture for phones. */
type Mode = { still: boolean; origin?: string | null; phone?: boolean };
/** For a page outside the hub's own frames (Magento, a shop page's preview): hub pictures as full addresses. `phone`:
 * the shop banner's picture for phones (1080 x 900). */
export type RenderOpts = { origin?: string | null; phone?: boolean };

/** The banner's design, as the renderer reads it. */
export const designFor = (d: Pick<BannerDoc, "look" | "theme" | "headColor">): Design => ({ look: d.look, theme: d.theme, headColor: d.headColor });
/** The size a place is drawn at: the shop banner's picture for phones, or the place itself. */
export const formatOf = (key: PresetKey, phone?: boolean): Format => (phone && key === "slider" ? "slidem" : key);

/** The logo's colour where it stands: on the light ground beside the red block (red), on a white chip over a photo (red),
 * else the design's. */
function logoColor(look: LookKey, orient: string, pal: Palette): string {
  if (look === "red") return orient === "strip" ? "#ffffff" : BRAND.red;
  if ((look === "photo" || look === "light") && orient === "v") return BRAND.red;
  return pal.logo;
}

/** Words escaped, a short compound kept whole ("O-Ring", "X-Ringe": never "O-" at a line's end). */
export const keepWhole = (t: string) => esc(t).replace(/(^|[\s(/])([\p{L}\d]{1,2}-[\p{L}\d]+)/gu, '$1<span style="white-space:nowrap">$2</span>');

/** The headline's words, with its red word (the first time it is written there) - escaped. */
export function headWords(text: string, accent: string, prefix: string): string {
  const a = accent.trim();
  const i = a ? text.indexOf(a) : -1;
  if (i < 0) return keepWhole(text);
  return `${keepWhole(text.slice(0, i))}<span class="${prefix}-r">${keepWhole(a)}</span>${keepWhole(text.slice(i + a.length))}`;
}

/** The photos the card shows: the list (two or more crossfade), else the one picture. */
function cardPhotos(d: BannerDoc, origin?: string | null): { url: string; label: string; product: boolean }[] {
  const at = (u: string) => absoluteMedia(mediaUrl(u), origin);
  const list = d.content.photos.map((p) => ({ url: at(p.url), label: p.label.trim(), product: p.fit === "product" })).filter((p) => p.url);
  if (list.length >= 2) return list;
  const one = { url: at(d.content.image.url), label: d.content.image.label.trim(), product: d.content.image.fit === "product" };
  return one.url ? [one] : list;
}

function bodyHtml(d: BannerDoc, key: PresetKey, prefix: string, m: Mode, href: string): string {
  const p = PRESET[key];
  const w = wordsFor(d, key);
  const fmt = formatOf(key, m.phone);
  const pal: Palette = paletteOf(d.look, d.theme, d.headColor);
  const hw = (t: string) => headWords(t, d.accent, prefix);
  const photos = m.still ? cardPhotos(d, m.origin).slice(0, 1) : cardPhotos(d, m.origin);
  const motion = !m.still && p.motion && (w.words.length > 1 || photos.length > 1);
  const lang = (d.language || "EN").toLowerCase().slice(0, 2);
  const P = prefix;
  const label = esc(w.eyebrow || w.headline || "Banner");
  // the headline's own words in a span of their own (typed in place as one, its red word with them)
  const head = w.words.length
    ? `<p class="${P}-q"><span class="${P}-ht">${hw(w.headline)}</span> <span class="${P}-w" data-list="w"><span>${esc(w.words[0])}</span></span></p>`
    : w.headline ? `<h2 class="${P}-h"><span class="${P}-ht">${hw(w.headline)}</span></h2>` : "";
  const button = w.button && href
    ? `<a class="${P}-b" href="${attr(href)}">${esc(w.button)}${ARROW}</a>`
    : w.button ? `<span class="${P}-b">${esc(w.button)}${ARROW}</span>` : "";
  // the leaderboard and the skyscraper end on their button, after the photo; the others keep it under the words
  const apart = key === "leader" || key === "sky";
  const text = `<div class="${P}-x">${w.eyebrow ? `<span class="${P}-eb">${esc(w.eyebrow)}</span>` : ""}${head}${w.line ? `<p class="${P}-p"><span class="${P}-ht">${keepWhole(w.line)}</span></p>` : ""}${apart ? "" : button}</div>`;
  const imgs = photos.map((x, i) => `<img src="${attr(x.url)}" alt=""${i ? ' loading="lazy"' : ""} decoding="async"${i === 0 ? ` class="is-on"` : ""}>`).join("");
  const showLabel = key !== "mrec" && key !== "leader" && key !== "sky" && photos[0]?.label;
  const card = photos.length
    ? `<div class="${P}-c${photos[0].product ? " is-prod" : ""}" aria-hidden="true">${imgs}${showLabel ? `<span class="${P}-t" data-list="n"><span>${esc(photos[0].label)}</span></span>` : ""}</div>`
    : "";
  const logo = p.logo ? (key === "mrec" ? `<span class="${P}-lgc">${logoSvg(`${P}-lg`)}</span>` : logoSvg(`${P}-lg`, d.look === "band" ? (THEMES[d.theme].dark ? "#ffffff" : BRAND.red) : logoColor(d.look, ORIENT[fmt], pal))) : "";
  const data = motion ? `<script type="application/json" class="${P}-d">${JSON.stringify({ w: w.words, n: photos.map((x) => x.label) }).replace(/</g, "\\u003c")}</script>` : "";
  const band = isBand(key);
  const look = d.look === "band" ? "" : ` ${P}--new ${P}--look-${d.look} ${P}--${ORIENT[fmt]}${pal.button.pill ? ` ${P}--pill` : ""}`;
  const cls = `${P} ${P}--${fmt}${band ? "" : ` ${P}--fx`}${look}${pal.accentLine ? ` ${P}--ul` : ""}${m.still ? " is-still" : ""}`;
  const attrs = `class="${cls}" lang="${esc(lang)}" aria-label="${label}"${motion ? " data-motion" : ""}`;
  if (band) return `<section ${attrs}><div class="${P}-g">${text}${card}</div>${data}</section>`;
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
export function pasteBlock(d: BannerDoc, key: PresetKey, prefix: string, title = "", opts: RenderOpts = {}): string {
  const p = PRESET[key];
  const w = wordsFor(d, key);
  const body = bodyHtml(d, key, prefix, { still: false, origin: opts.origin }, pasteHref(w.url));
  const motion = body.includes(" data-motion");
  const name = title.replace(/--+/g, "-").replace(/[<>]/g, "").slice(0, 80);
  return [
    `<!-- APSOparts banner${name ? ` "${name}"` : ""} - ${p.label} (${d.language}). Page Builder: ONE row (no padding) with ONE HTML Code element; paste this whole block. All its rules live under .${prefix}. -->`,
    `<style>\n${bannerCss(prefix, designFor(d), [key])}\n</style>`,
    body,
    motion ? bannerJs(prefix) : "",
  ].filter(Boolean).join("\n") + "\n";
}

/** Any size frozen on its first word and photo, with the CSS it needs - for a PNG or a still view. */
export function stillMarkup(d: BannerDoc, key: PresetKey, prefix: string, opts: RenderOpts = {}): { css: string; html: string } {
  const w = wordsFor(d, key);
  return { css: bannerCss(prefix, designFor(d), [formatOf(key, opts.phone)]), html: bodyHtml(d, key, prefix, { still: true, origin: opts.origin, phone: opts.phone }, linkOf(w.url).href) };
}

/** The real size a place is drawn at (the shop banner's picture for phones: 1080 x 900); a band: null. */
export function sizeOf(key: PresetKey, phone?: boolean): { w: number; h: number } | null {
  if (phone && key === "slider") return { w: 1080, h: 900 };
  const p = PRESET[key];
  return p.h ? { w: p.w, h: p.h } : null;
}

/**
 * The banner for a page made elsewhere (a shop page's preview): its stylesheet, its markup without any script, and the
 * script that changes its word (null without motion) - the page's preview takes markup and styles as changes, which
 * may not carry a script, and adds the script itself where it runs scripts.
 */
export function pageParts(d: BannerDoc, key: PresetKey, prefix: string, opts: RenderOpts = {}): { css: string; html: string; script: string | null } {
  const w = wordsFor(d, key);
  const body = bodyHtml(d, key, prefix, { still: false, origin: opts.origin }, linkOf(w.url).href);
  const data = new RegExp(`<script type="application/json" class="${prefix}-d">([\\s\\S]*?)</script>`).exec(body);
  const html = body.replace(/<script\b[\s\S]*?<\/script>/g, "");
  // the word's list rides on the section itself, as an attribute, so the markup carries no script
  const withData = data ? html.replace(` data-motion`, ` data-motion data-list-json="${esc(data[1].replace(/\\u003c/g, "<"))}"`) : html;
  const script = data ? bannerJs(prefix).replace(`L = JSON.parse(root.querySelector(".${prefix}-d").textContent)`, `L = JSON.parse(root.getAttribute("data-list-json"))`) : null;
  return { css: bannerCss(prefix, designFor(d), [key]), html: withData, script };
}

/** The motion-free markup of several sizes at once, sharing one stylesheet (the "All sizes" view). */
export function stillSheet(d: BannerDoc, keys: PresetKey[], prefix: string): { css: string; html: Record<string, string> } {
  const html: Record<string, string> = {};
  for (const k of keys) html[k] = bodyHtml(d, k, prefix, { still: true }, linkOf(wordsFor(d, k).url).href);
  return { css: bannerCss(prefix, designFor(d), keys), html };
}

/** The paste block with its shop links made full addresses - what a page outside Magento can open. */
const openable = (block: string) => block.replace(/\{\{store direct_url='([^']*)'\}\}/g, (_, path: string) => linkOf(path).href);

/** The banner's parts a person can click to change in place (Content v3; SARCLA 08.11.2026: "banner also" - the editing
 *  was "very confusing"), by the class each carries under the banner's prefix. */
export const PICK_PARTS = { eb: "eyebrow", q: "headline", w: "headline", h: "headline", p: "line", b: "button", c: "picture", t: "label" } as const;
/** The headline's own words (its red word inside) - what typing in place takes as one. */
export const HEAD_WORDS = "ht";
export type PickPart = (typeof PICK_PARTS)[keyof typeof PICK_PARTS] | "background";

/** The CSS that shows what can be clicked (`z`: the zoom it is seen at, so the outline stays 2 px on screen). */
export function pickCss(prefix: string, scope = "", z = 1): string {
  const P = prefix;
  const sel = (suffix: string) => ["eb", "q", "h", "p", "b", "c"].map((k) => `${scope}.${P} .${P}-${k}${suffix}`).join(",");
  const line = (2 / Math.max(0.05, z)).toFixed(2);
  return `${sel("")}{cursor:pointer}${scope}.${P}{cursor:pointer}${sel(":hover")}{outline:${line}px dashed rgba(36,89,209,.75);outline-offset:${(3 / Math.max(0.05, z)).toFixed(2)}px}`
    + `${scope}.${P} .is-picked{outline:${line}px solid #c22c6e!important;outline-offset:${(3 / Math.max(0.05, z)).toFixed(2)}px}${scope}.${P}.is-picked{outline:${line}px solid #c22c6e;outline-offset:-${line}px}`
    + `${scope}.${P} .is-editing{outline:none;cursor:text;caret-color:currentColor;-webkit-user-modify:read-write-plaintext-only}${scope}.${P} .is-editing:empty::before{content:"\\200b"}`;
}

/** The frame's half of a click on a part: which part and where it is, told to the studio; the part open, marked. */
const PICK_JS = `  function partOf(el) {
    for (var n = el; n && n !== stage; n = n.parentElement) {
      var c = " " + (n.getAttribute && n.getAttribute("class") || "") + " ", m = P && c.match(new RegExp(" " + P + "-(eb|q|w|h|p|b|c|t) "));
      if (m) return { el: m[1] === "w" ? n.closest("." + P + "-q") || n : n, part: PARTS[m[1]] };
      if (P && c.indexOf(" " + P + " ") >= 0) return { el: n, part: "background" };
    }
    return null;
  }
  function rect(el) { var r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
  function mark(part) {
    if (editing) return;
    [].forEach.call(stage.querySelectorAll(".is-picked"), function (n) { n.classList.remove("is-picked"); });
    picked = part; if (!part || !P) return;
    var keys = Object.keys(PARTS).filter(function (k) { return PARTS[k] === part && k !== "w"; });
    var el = part === "background" ? stage.querySelector("." + P) : stage.querySelector(keys.map(function (k) { return "." + P + "-" + k; }).join(","));
    if (el) { el.classList.add("is-picked"); parent.postMessage({ apsoBanner: "where", part: part, rect: rect(el) }, "*"); }
  }
  if (P) document.addEventListener("click", function (e) {
    if (editing && editing.span.contains(e.target)) return;
    var hit = partOf(e.target);
    parent.postMessage({ apsoBanner: "pick", part: hit ? hit.part : null, rect: hit ? rect(hit.el) : null }, "*");
  });
  // words typed right on the banner (09.11.2026): a double-click on a part asks the studio; the studio answers "edit"
  // with the words as they are (an empty part: nothing), and the part becomes a field in place - Enter or a click
  // outside keeps it, Esc drops it; every key is told to the studio, which writes the same field as the left card
  var editing = null;
  // the field opens at once (nothing typed is lost waiting for the studio); the studio may close it again ("end")
  var WORDS = { eyebrow: 1, headline: 1, line: 1, button: 1, label: 1 };
  if (P) document.addEventListener("dblclick", function (e) {
    var hit = partOf(e.target);
    if (!hit || editing) return;
    e.preventDefault();
    parent.postMessage({ apsoBanner: "dbl", part: hit.part, rect: rect(hit.el) }, "*");
    if (WORDS[hit.part]) startEdit(hit.part, null);
  });
  function ownText(el) {
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return n.parentElement && n.parentElement.closest("." + P + "-w") ? NodeFilter.FILTER_REJECT : (n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP); } });
    return w.nextNode();
  }
  function startEdit(part, text) {
    if (editing) finish(true);
    var keys = Object.keys(PARTS).filter(function (k) { return PARTS[k] === part && k !== "w"; });
    var el = stage.querySelector(keys.map(function (k) { return "." + P + "-" + k; }).join(","));
    if (!el) return;
    var span = document.createElement("span");
    span.className = "is-editing";
    try { span.contentEditable = "plaintext-only"; } catch (x) { span.contentEditable = "true"; }
    if (span.contentEditable !== "plaintext-only") span.contentEditable = "true";
    // the headline's own words (with its red word) are one field; another part's first words
    var ht = el.querySelector("." + P + "-ht");
    var tn = ht ? null : ownText(el);
    // a part not written yet shows its hint greyed in a span of its own: the field takes the hint's place, empty
    var hint = ht ? !!ht.querySelector("[style*=opacity]") : !!(tn && tn.parentElement !== el && tn.parentElement.getAttribute("style") && /opacity/.test(tn.parentElement.getAttribute("style")));
    var host = ht || (hint ? tn.parentElement : tn);
    span.textContent = typeof text === "string" ? text : hint ? "" : (ht ? ht.textContent : tn ? tn.textContent : "");
    if (host) host.parentNode.replaceChild(span, host); else el.insertBefore(span, el.firstChild);
    editing = { part: part, span: span, host: host };
    span.addEventListener("input", function () { parent.postMessage({ apsoBanner: "typing", part: part, text: span.textContent }, "*"); tell(); });
    span.addEventListener("keydown", function (k) {
      if (k.key === "Enter") { k.preventDefault(); finish(true); }
      else if (k.key === "Escape") { k.preventDefault(); finish(false); }
    });
    span.addEventListener("blur", function () { finish(true); });
    span.addEventListener("paste", function (k) { k.preventDefault(); document.execCommand("insertText", false, (k.clipboardData.getData("text/plain") || "").replace(/\\s+/g, " ")); });
    span.focus();
    var r = document.createRange(); r.selectNodeContents(span); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }
  function finish(keep) {
    if (!editing) return;
    var ed = editing; editing = null;
    ed.span.removeAttribute("contenteditable");
    // dropped: the words as they were, at once (the studio redraws the banner too)
    if (!keep && ed.host && ed.span.parentNode) ed.span.parentNode.replaceChild(ed.host, ed.span);
    parent.postMessage({ apsoBanner: "done", part: ed.part, text: ed.span.textContent, keep: keep }, "*");
  }
  window.addEventListener("message", function (e) {
    var m = e.data; if (!m) return;
    if (m.apsoBanner === "edit" && typeof m.text === "string" && !editing) startEdit(m.part, m.text);
    if (m.apsoBanner === "end") finish(!!m.keep);
  });
`;

/**
 * The paste block in a page of its own, for the studio's frame: the brand's font (data: - the hub lets nothing else
 * in), its height told to the studio, links kept in place, and a way to swap the banner without reloading the frame.
 * With `pick` (the banner's prefix), a click on a part of the banner tells the studio which part and where it is, so
 * the studio can open its words right there; the studio marks the part it has open.
 */
export function previewDoc(block: string, fontCss: string, background = "#ffffff", pick?: string): string {
  const P = pick ? pick.replace(/[^A-Za-z0-9]/g, "") : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${fontCss}</style><style>html,body{margin:0;padding:0;background:${background}}${P ? pickCss(P) : ""}</style></head><body><div id="stage">${openable(block)}</div>
<script>
(function () {
  var stage = document.getElementById("stage"), last = 0, P = ${JSON.stringify(P)}, PARTS = ${JSON.stringify(PICK_PARTS)}, picked = null;
  function tell() { var h = Math.ceil(stage.getBoundingClientRect().height); if (h !== last) { last = h; parent.postMessage({ apsoBanner: "height", h: h }, "*"); } }
  if ("ResizeObserver" in window) new ResizeObserver(tell).observe(stage); setTimeout(tell, 60);
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("a")) e.preventDefault(); }, true);
${P ? PICK_JS : "  function mark() {}"}
  window.addEventListener("message", function (e) {
    var m = e.data; if (!m || m.apsoBanner !== "swap" || typeof m.html !== "string") return;
    [].forEach.call(stage.querySelectorAll("[data-on]"), function (r) { if (r.__stop) r.__stop(); });
    var box = document.createElement("div"); box.innerHTML = m.html; stage.innerHTML = "";
    [].slice.call(box.childNodes).forEach(function (n) {
      if (n.tagName === "SCRIPT") { var s = document.createElement("script"); s.textContent = n.textContent; stage.appendChild(s); } else stage.appendChild(n);
    });
    tell(); if (picked) mark(picked);
  });
  ${P ? `window.addEventListener("message", function (e) { var m = e.data; if (m && m.apsoBanner === "mark") mark(m.part || null); });` : ""}
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
