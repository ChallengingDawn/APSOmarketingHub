// PAGE - THE LIBRARY, PART 2: MEDIA (Content v7, 10.11.2026). Pure.
//
// Pictures and video: a mosaic gallery, a picture strip that scrolls, a video thumbnail that opens the shop's tutorial,
// the tutorial list, two pictures side by side, a panorama. Pictures are the shop's own media (its category photos and
// banners, ./data.ts) or the hub's picture store; a video is a thumbnail linking out - never an embedded player or a frame.

import { BANNERS, LINKS, TECH, TECH_LINES, TUTORIALS } from "./data";
import { def, esc, eyOf, header, icon, img, isGerman, link, marked, needGap, pathFor, ph, textLink, w2, type ModuleSettings } from "./kit";

type P = ModuleSettings["points"][number];
const picture = (store: string, c: { name: string; url: string; img: string; meta: string }): P =>
  ({ title: isGerman(store) ? c.name : "", text: isGerman(store) ? c.meta : "", icon: "star", img: c.img, ...(isGerman(store) ? { url: c.url } : {}) });
const caption = (p: P) => (p.title.trim() || p.text.trim() ? `<figcaption><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<span>${esc(p.text.trim())}</span>` : ""}</figcaption>` : "");

/* ── a mosaic gallery ──────────────────────────────────────────────────── */

const mediaMosaic = def({
  id: "media-mosaic", category: "media", name: "Picture gallery",
  note: "Pictures in a mosaic - one large, the others around it; the caption slides up on hover",
  layouts: [{ key: "mosaic", label: "Mosaic" }, { key: "even", label: "Even grid" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "points", label: "The pictures", min: 2, max: 7, item: { title: "Caption", text: "A line" }, pictures: true, links: true }, { kind: "link" }],
  tags: ["gallery", "pictures", "photos", "mosaic", "images"],
  defaults: (store) => ({
    eyebrow: isGerman(store) ? "Sortiment" : "", title: isGerman(store) ? "Top-Produkte im Bild" : "",
    points: BANNERS.slice(0, 5).map((b) => picture(store, b)),
  }),
  gap: (s) => s.points.filter((p) => p.img).length >= 2 ? "" : "Add at least two pictures",
  draw: (s, o) => {
    const pts = s.points.filter((p) => p.img).slice(0, 7);
    const even = s.layout === "even";
    const one = (p: P) => {
      const inner = `${img(p.img, o, { alt: p.title })}${caption(p)}`;
      return p.url ? `<a class="am-gm" href="${link(p.url)}"><figure>${inner}</figure></a>` : `<div class="am-gm"><figure>${inner}</figure></div>`;
    };
    return {
      html: `${header(s)}<div class="am-gms${even ? " is-even" : ""}">${pts.map(one).join("") || ph("Add the pictures: from the shop or the hub's pictures")}</div>`,
      css: `
@@ .am-gms{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:190px;gap:12px}
@@ .am-gm{position:relative;display:block;border-radius:20px;overflow:hidden;background:var(--tile);color:#fff!important}
@@ .am-gms:not(.is-even)>.am-gm:first-child{grid-column:span 2;grid-row:span 2}
@@ .am-gm figure{position:absolute;inset:0;margin:0}
@@ .am-gm img{width:100%;height:100%;object-fit:cover;transition:transform .7s}
@@ .am-gm figcaption{position:absolute;left:0;right:0;bottom:0;padding:44px 18px 16px;background:linear-gradient(180deg,transparent,rgba(15,35,46,.82))}
@@ .am-gm figcaption b{display:block;font:600 17px/1.25 var(--head);color:#fff}
@@ .am-gm figcaption span{display:block;max-height:0;overflow:hidden;font-size:13.5px;line-height:1.45;color:#dbe6ec;opacity:0;transition:max-height .35s,opacity .3s,margin .3s}
@@ .am-gm:hover img{transform:scale(1.05)}
@@ .am-gm:is(:hover,:focus-within) figcaption span{max-height:80px;margin-top:4px;opacity:1}
@@ .am-gms:not(.is-even)>.am-gm:first-child figcaption b{font-size:22px}
@@ .am-gms.is-even{grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:230px}
@@ .am-gms>.am-ph{grid-column:1/-1;grid-row:span 2}
@media (hover:none){@@ .am-gm figcaption span{display:none}}
@media (max-width:900px){
@@ .am-gms,@@ .am-gms.is-even{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:140px;gap:8px}
@@ .am-gm{border-radius:14px}
@@ .am-gm figcaption{padding:24px 10px 10px}
@@ .am-gm figcaption b{font-size:14px}
@@ .am-gm figcaption span{display:none}
}`,
    };
  },
});

/* ── a picture strip that scrolls ──────────────────────────────────────── */

const mediaStrip = def({
  id: "media-strip", category: "media", name: "Picture strip",
  note: "Large pictures in a row that scrolls sideways, the next one peeking in - captions under each",
  layouts: [{ key: "wide", label: "Wide pictures" }, { key: "tall", label: "Tall pictures" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "points", label: "The pictures", min: 2, max: 8, item: { title: "Caption", text: "A line" }, pictures: true, links: true }, { kind: "link" }],
  tags: ["carousel", "slider", "strip", "scroll", "pictures"],
  defaults: (store) => ({
    eyebrow: isGerman(store) ? "Technologien" : "", title: isGerman(store) ? "Sechs Technologien, ein Shop" : "",
    points: TECH.map((t) => ({ title: isGerman(store) ? t.name : "", text: isGerman(store) ? TECH_LINES[t.name].line : "", icon: "star", img: t.img, ...(isGerman(store) ? { url: t.url } : {}) })),
  }),
  gap: (s) => s.points.filter((p) => p.img).length >= 2 ? "" : "Add at least two pictures",
  draw: (s, o) => {
    const pts = s.points.filter((p) => p.img).slice(0, 8);
    const tall = s.layout === "tall";
    const one = (p: P) => {
      const inner = `<i>${img(p.img, o, { alt: p.title })}</i>${p.title.trim() ? `<b>${esc(p.title.trim())}</b>` : ""}${p.text.trim() ? `<span>${esc(p.text.trim())}</span>` : ""}`;
      return p.url ? `<a class="am-ps" href="${link(p.url)}">${inner}</a>` : `<div class="am-ps">${inner}</div>`;
    };
    return {
      html: `${header(s)}<div class="am-pst${tall ? " is-tall" : ""}">${pts.map(one).join("") || ph("Add the pictures")}</div>`,
      css: `
@@ .am-pst{display:grid;grid-auto-flow:column;grid-auto-columns:calc((100% - 32px) / 2.35);gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 2px 18px;margin:0 -2px;scrollbar-width:thin;scrollbar-color:#c9d1d6 transparent}
@@ .am-ps{scroll-snap-align:start;display:flex;flex-direction:column;gap:6px;color:var(--ink)!important}
@@ .am-ps i{position:relative;display:block;aspect-ratio:16/10;margin-bottom:8px;border-radius:20px;overflow:hidden;background:var(--tile)}
@@ .am-ps i img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .7s}
@@ .am-ps b{font:600 19px/1.25 var(--head)}
@@ .am-ps span{font-size:14px;line-height:1.5;color:var(--txt)}
@@ a.am-ps:hover i img{transform:scale(1.04)}
@@ a.am-ps:hover b{color:var(--red)}
@@ .am-pst.is-tall{grid-auto-columns:calc((100% - 48px) / 3.6)}
@@ .am-pst.is-tall .am-ps i{aspect-ratio:3/4}
@@ .am-pst>.am-ph{min-width:100%}
@media (max-width:900px){@@ .am-pst{grid-auto-columns:82%;gap:10px}@@ .am-pst.is-tall{grid-auto-columns:62%}@@ .am-ps i{border-radius:14px}@@ .am-ps b{font-size:16.5px}@@ .am-ps span{font-size:13px}}`,
    };
  },
});

/* ── a video (a thumbnail that opens it) ───────────────────────────────── */

const mediaVideo = def({
  id: "media-video", category: "media", name: "Video",
  note: "A large thumbnail with a play button - a click opens the video on the shop's page",
  layouts: [{ key: "wide", label: "Wide" }, { key: "side", label: "Words beside" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 3 }, { kind: "feature", label: "The thumbnail" }, { kind: "link", label: "Where the video is" }],
  tags: ["video", "tutorial", "film", "play", "youtube"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "Tutorial-Video", title: "DirectCUT ==Produkt-Konfigurator==",
      text: "Was der Produktkonfigurator kann, für welche Produkte Sie ihn verwenden können - und ein paar Tipps und Tricks, die Ihnen zum Erfolg verhelfen.",
      link: { label: "Video ansehen", url: `${pathFor(store, LINKS.tutorials)}#directcut` },
    } : { link: { label: "", url: `${pathFor(store, LINKS.tutorials)}#directcut` } }),
    feature: { kind: "category", name: "DirectCUT", url: `${pathFor(store, LINKS.tutorials)}#directcut`, img: BANNERS[2].img, meta: "", number: "", children: [] },
  }),
  gap: (s) => needGap(s, { title: true }) || (s.link.url ? "" : "Say where the video is (its page on the shop)"),
  draw: (s, o) => {
    const w = w2(s.store);
    const side = s.layout === "side";
    const thumb = s.feature?.img ? img(s.feature.img, o, { alt: s.title.replace(/==/g, "") }) : "";
    const play = `<span class="am-vd-p" aria-hidden="true">${icon("play", 30)}</span>`;
    const th = `<a class="am-vd-t" href="${link(s.link.url)}" aria-label="${esc(s.link.label.trim() || w.watch)}">${thumb || '<span class="am-vd-e"></span>'}${play}${side ? "" : `<span class="am-vd-c">${eyOf(s)}${s.title.trim() ? `<b>${marked(s.title.trim())}</b>` : ""}</span>`}</a>`;
    const words = side ? `<div class="am-vd-w">${eyOf(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ph("Write the headline")}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}${textLink({ label: s.link.label || w.watch, url: s.link.url })}</div>` : (s.text.trim() ? `<p class="am-vd-x">${esc(s.text.trim())}</p>` : "");
    return {
      html: `<div class="am-vd${side ? " is-side" : ""}">${th}${words}</div>`,
      css: `
@@ .am-vd{display:grid;gap:14px}
@@ .am-vd-t{position:relative;display:block;aspect-ratio:21/9;border-radius:26px;overflow:hidden;background:#dfe5e8;color:#fff!important}
@@ .am-vd-t img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .7s}
@@ .am-vd-t::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(15,35,46,.78) 0%,rgba(15,35,46,.25) 55%,rgba(15,35,46,.05) 100%)}
@@ .am-vd-p{position:absolute;left:50%;top:50%;z-index:2;display:grid;place-items:center;width:92px;height:92px;margin:-46px 0 0 -46px;padding-left:5px;border-radius:50%;background:var(--red);color:#fff;box-shadow:0 0 0 12px rgba(216,9,1,.22),0 20px 40px -14px rgba(0,0,0,.6);transition:transform .3s,box-shadow .3s}
@@ .am-vd-p svg{fill:currentColor}
@@ .am-vd-t:hover .am-vd-p,@@ .am-vd-t:focus-visible .am-vd-p{transform:scale(1.08);box-shadow:0 0 0 18px rgba(216,9,1,.2),0 20px 40px -14px rgba(0,0,0,.6)}
@@ .am-vd-t:hover img{transform:scale(1.03)}
@@ .am-vd-c{position:absolute;left:36px;bottom:30px;z-index:2;max-width:46%}
@@ .am-vd-c .am-ey{color:#cddbe3}
@@ .am-vd-c .am-ey::before{background:#fff}
@@ .am-vd-c b{display:block;font:600 clamp(24px,2.6vw,36px)/1.1 var(--head);letter-spacing:-.015em;color:#fff}
@@ .am-vd-c .am-red{color:#ff6a5f}
@@ .am-vd-x{max-width:760px;margin:2px 4px 0!important;font-size:15px;line-height:1.55;color:var(--txt)}
@@ .am-vd.is-side{grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:40px;align-items:center}
@@ .am-vd.is-side .am-vd-t{aspect-ratio:16/10}
@@ .am-vd.is-side .am-vd-t::after{background:rgba(15,35,46,.18)}
@@ .am-vd-w .am-lk{margin-top:14px}
@media (max-width:900px){
@@ .am-vd-t{aspect-ratio:16/10;border-radius:18px}
@@ .am-vd-p{width:64px;height:64px;margin:-32px 0 0 -32px}
@@ .am-vd-c{left:16px;bottom:14px;max-width:80%}
@@ .am-vd-c b{font-size:20px}
@@ .am-vd.is-side{grid-template-columns:minmax(0,1fr);gap:16px}
}`,
    };
  },
});

/* ── the tutorials as a list ───────────────────────────────────────────── */

const mediaVideos = def({
  id: "media-videos", category: "media", name: "Video list",
  note: "The shop's tutorial videos as a list - each opens its video on the tutorials page",
  layouts: [{ key: "list", label: "List" }, { key: "grid", label: "Cards" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "points", label: "The videos", min: 1, max: 8, item: { title: "The video", text: "What it shows" }, icons: true, links: true }, { kind: "link" }],
  tags: ["videos", "tutorials", "how to", "playlist", "learn"],
  defaults: (store) => ({
    eyebrow: isGerman(store) ? "Tutorial-Videos" : "", title: isGerman(store) ? "Den Shop in ==wenigen Minuten== kennenlernen" : "",
    points: TUTORIALS.map((t) => ({ title: isGerman(store) ? t.title : "", text: isGerman(store) ? t.text : "", icon: t.icon, url: `${pathFor(store, LINKS.tutorials)}${t.anchor}` })),
    link: { label: isGerman(store) ? "Alle Tutorial-Videos" : "", url: pathFor(store, LINKS.tutorials) },
  }),
  gap: (s) => s.points.some((p) => p.title.trim() && p.url) ? "" : "Add a video: its title and its page",
  draw: (s) => {
    const w = w2(s.store);
    const pts = s.points.filter((p) => p.title.trim()).slice(0, 8);
    const grid = s.layout === "grid";
    return {
      html: `${header(s)}<ol class="am-vl${grid ? " is-grid" : ""}">${pts.map((p, i) => `<li><a href="${link(p.url ?? "")}"><span class="am-vl-p">${icon("play", 18)}</span><span class="am-vl-t"><small>${esc(w.watch)} · ${String(i + 1).padStart(2, "0")}</small><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<em>${esc(p.text.trim())}</em>` : ""}</span><span class="am-vl-i">${icon(p.icon, 22)}</span></a></li>`).join("") || `<li>${ph("Add the videos: a title, a line and the page each opens")}</li>`}</ol>`,
      css: `
@@ .am-vl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px}
@@ .am-vl a{display:grid;grid-template-columns:52px minmax(0,1fr) 40px;align-items:center;gap:16px;padding:14px 18px 14px 14px;border-radius:18px;background:#fff;box-shadow:var(--card);color:var(--ink)!important;transition:box-shadow .2s,transform .2s}
@@ .am-vl-p{display:grid;place-items:center;width:52px;height:52px;padding-left:3px;border-radius:50%;background:var(--red);color:#fff;transition:transform .25s}
@@ .am-vl-p svg{fill:currentColor}
@@ .am-vl small{display:block;font:600 11px/1.2 var(--head);letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
@@ .am-vl b{display:block;margin-top:3px;font:600 16.5px/1.25 var(--head)}
@@ .am-vl em{display:block;margin-top:3px;font-style:normal;font-size:13.5px;line-height:1.4;color:var(--txt)}
@@ .am-vl-i{display:grid;place-items:center;color:#b3bcc2}
@@ .am-vl a:hover{transform:translateY(-2px);box-shadow:0 18px 30px -20px rgba(27,58,75,.55),inset 0 0 0 1.5px var(--red)}
@@ .am-vl a:hover .am-vl-p{transform:scale(1.08)}
@@ .am-vl.is-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@@ .am-vl.is-grid a{grid-template-columns:minmax(0,1fr);align-content:start;min-height:220px;padding:0 0 18px;overflow:hidden}
@@ .am-vl.is-grid .am-vl-p{width:100%;height:96px;border-radius:0;background:radial-gradient(120% 140% at 0% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%);padding:0}
@@ .am-vl.is-grid .am-vl-p svg{width:34px;height:34px;padding:8px;border-radius:50%;background:var(--red);box-sizing:content-box}
@@ .am-vl.is-grid .am-vl-t{padding:0 18px}
@@ .am-vl.is-grid .am-vl-i{display:none}
@@ .am-vl.is-grid a:hover .am-vl-p{transform:none}
@media (max-width:1100px) and (min-width:901px){@@ .am-vl.is-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:900px){
@@ .am-vl,@@ .am-vl.is-grid{grid-template-columns:minmax(0,1fr);gap:8px}
@@ .am-vl a,@@ .am-vl.is-grid a{grid-template-columns:44px minmax(0,1fr);min-height:0;padding:12px}
@@ .am-vl-p,@@ .am-vl.is-grid .am-vl-p{width:44px;height:44px;border-radius:50%}
@@ .am-vl.is-grid .am-vl-p svg{width:18px;height:18px;padding:0;background:none}
@@ .am-vl.is-grid .am-vl-t{padding:0}
@@ .am-vl-i{display:none}
}`,
    };
  },
});

/* ── two pictures ──────────────────────────────────────────────────────── */

const mediaDuo = def({
  id: "media-duo", category: "media", name: "Two pictures",
  note: "Two pictures side by side with their captions - even, or one wide and one narrow",
  layouts: [{ key: "even", label: "Even" }, { key: "wide", label: "Wide and narrow" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "points", label: "The two pictures", min: 2, max: 2, item: { title: "Caption", text: "A line" }, pictures: true, links: true }],
  tags: ["pictures", "two", "duo", "photos", "side by side"],
  defaults: (store) => ({
    eyebrow: isGerman(store) ? "Dichtungstechnik" : "", title: isGerman(store) ? "O-Ringe und Rotationsdichtungen" : "",
    points: [picture(store, BANNERS[0]), picture(store, BANNERS[1])],
  }),
  gap: (s) => s.points.filter((p) => p.img).length >= 2 ? "" : "Add two pictures",
  draw: (s, o) => {
    const pts = s.points.filter((p) => p.img).slice(0, 2);
    const wide = s.layout === "wide";
    const one = (p: P) => {
      const inner = `<figure>${img(p.img, o, { alt: p.title })}</figure>${p.title.trim() || p.text.trim() ? `<span class="am-du-c"><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<em>${esc(p.text.trim())}</em>` : ""}</span>` : ""}`;
      return p.url ? `<a class="am-du" href="${link(p.url)}">${inner}</a>` : `<div class="am-du">${inner}</div>`;
    };
    return {
      html: `${header(s)}<div class="am-dus${wide ? " is-wide" : ""}">${pts.map(one).join("")}${pts.length < 2 ? ph(pts.length ? "Add the second picture" : "Add two pictures") : ""}</div>`,
      css: `
@@ .am-dus{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
@@ .am-dus.is-wide{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)}
@@ .am-du{display:flex;flex-direction:column;gap:12px;color:var(--ink)!important}
@@ .am-du figure{position:relative;margin:0;aspect-ratio:4/3;border-radius:24px;overflow:hidden;background:var(--tile)}
@@ .am-dus.is-wide .am-du figure{aspect-ratio:auto;height:380px}
@@ .am-du img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .7s}
@@ a.am-du:hover img{transform:scale(1.04)}
@@ .am-du-c{display:flex;align-items:baseline;gap:12px;padding:0 4px}
@@ .am-du-c b{font:600 18px/1.25 var(--head)}
@@ .am-du-c em{font-style:normal;font-size:14px;color:var(--mute)}
@@ a.am-du:hover b{color:var(--red)}
@@ .am-dus>.am-ph{min-height:300px}
@media (max-width:900px){@@ .am-dus,@@ .am-dus.is-wide{grid-template-columns:minmax(0,1fr);gap:14px}@@ .am-dus.is-wide .am-du figure{height:auto;aspect-ratio:4/3}@@ .am-du figure{border-radius:16px}@@ .am-du-c{flex-direction:column;gap:2px}}`,
    };
  },
});

/* ── a panorama ────────────────────────────────────────────────────────── */

const mediaPanorama = def({
  id: "media-panorama", category: "media", name: "Panorama picture",
  note: "One wide picture across the container, with a caption card and a link",
  layouts: [{ key: "card", label: "Caption card on it" }, { key: "below", label: "Caption below" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 3 }, { kind: "feature", label: "The picture" }, { kind: "link" }],
  tags: ["panorama", "wide picture", "banner", "photo"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "Schwingungstechnik", title: "APSOvib® Schwingungstechnik",
      text: "Zukunftsweisende Technologien zur effizienten Unterdrückung von Vibrationen und Geräuschemissionen.",
      link: { label: "Zur Schwingungstechnik", url: TECH[2].url },
    } : {}),
    feature: { ...TECH[2], url: pathFor(store, TECH[2].url) },
  }),
  gap: (s) => s.feature?.img ? "" : "Pick the picture",
  draw: (s, o) => {
    const below = s.layout === "below";
    const pic = s.feature?.img ? img(s.feature.img, o, { alt: s.title.replace(/==/g, "") }) : "";
    const cap = s.title.trim() || s.text.trim() ? `<div class="am-pn-c">${eyOf(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ""}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}${textLink(s.link)}</div>` : "";
    return {
      html: `<div class="am-pn2${below ? " is-below" : ""}">${pic ? `<figure class="am-pn-p">${pic}</figure>` : ph("Pick the picture", "am-pn-p")}${cap}</div>`,
      css: `
@@ .am-pn2{position:relative}
@@ .am-pn-p{position:relative;margin:0;aspect-ratio:21/8;border-radius:28px;overflow:hidden;background:var(--tile)}
@@ .am-pn-p img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
@@ .am-pn-c{position:absolute;left:28px;bottom:28px;max-width:440px;padding:24px 26px 24px;border-radius:20px;background:rgba(255,255,255,.96);box-shadow:0 24px 50px -28px rgba(15,35,46,.6)}
@@ .am-pn-c .am-sub{margin-top:8px!important}
@@ .am-pn-c .am-lk{margin-top:14px}
@@ .am-pn2.is-below .am-pn-c{position:static;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:4px 40px;max-width:none;padding:22px 4px 0;background:none;box-shadow:none}
@@ .am-pn2.is-below .am-pn-c>:is(.am-sub,.am-lk){grid-column:2;grid-row:span 2}
@@ .am-pn2.is-below .am-pn-c>:is(.am-ey,.am-h){grid-column:1}
@@ .am-pn2.is-below .am-pn-c .am-sub{margin-top:0!important}
@media (max-width:900px){
@@ .am-pn-p{aspect-ratio:4/3;border-radius:18px}
@@ .am-pn-c{position:relative;left:auto;bottom:auto;z-index:1;max-width:none;margin:-40px 12px 0;padding:18px 16px}
@@ .am-pn2.is-below .am-pn-c{display:block;margin:0;padding:16px 2px 0}
}`,
    };
  },
});

export const MEDIA = [mediaMosaic, mediaStrip, mediaVideo, mediaVideos, mediaDuo, mediaPanorama];
