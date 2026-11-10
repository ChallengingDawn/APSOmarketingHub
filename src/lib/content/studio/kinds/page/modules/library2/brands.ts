// PAGE - THE LIBRARY, PART 2: REFERENCES & BRANDS (Content v7, 10.11.2026). Pure.
//
// Only brands the shop carries and words its customers really said: the product lines and brands of its own pages
// (HITEC®, NORMATEC, evolast®, FEP-O-Seal, KAPSTO, CUPMOUNT - the O-Ring selection guide, the category tree, the grounding
// page), the five APSO product brands of its home page, the customer quotes its About page shows (its own pictures, as
// published), the Angst+Pfister group as the grounding page states it. Brand names are set in type - never an invented logo.

import { LINKS, ORING, PICS, TECH, TECH_LINES } from "./data";
import { button, cardImg, catUrl, def, esc, eyOf, header, img, isGerman, link, marked, needGap, pathFor, ph, prose, textLink } from "./kit";

const search = (store: string, q: string) => `${pathFor(store, LINKS.search)}?q=${encodeURIComponent(q)}`;

/* ── a wall of brand names ─────────────────────────────────────────────── */

const brandWall = def({
  id: "brand-wall", category: "references", name: "Brands we carry",
  note: "The brands and product lines of the range, set as wordmarks - each opens its products",
  layouts: [{ key: "grid", label: "Tiles with a line" }, { key: "row", label: "One row of names" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "points", label: "The brands", min: 2, max: 8, item: { title: "The brand (as the shop writes it)", text: "What it is" }, links: true }],
  tags: ["brands", "logos", "manufacturers", "product lines", "wordmarks"],
  defaults: (store) => ({
    eyebrow: isGerman(store) ? "Marken & Produktlinien" : "", title: isGerman(store) ? "Marken, die Sie bei uns finden" : "",
    points: [
      { title: "HITEC®", text: isGerman(store) ? "O-Ringe für Anwendungen mit Zulassungs- oder Dokumentationsanforderungen" : "", icon: "star", url: search(store, "hitec") },
      { title: "NORMATEC", text: isGerman(store) ? "O-Ringe für ein breites Spektrum industrieller Anwendungen" : "", icon: "star", url: search(store, "normatec") },
      { title: "evolast®", text: isGerman(store) ? "FFKM für extreme chemische und thermische Bedingungen" : "", icon: "star", url: search(store, "evolast") },
      { title: "FEP-O-Seal", text: isGerman(store) ? "FEP-ummantelte O-Ringe für ausgewählte statische Dichtstellen" : "", icon: "star", url: catUrl(store, ORING.FEP.url, "FEP-O-Seal") },
      { title: "KAPSTO", text: isGerman(store) ? "Schutzkappen und Schutzstopfen für industrielle Anwendungen" : "", icon: "star", url: catUrl(store, "https://www.apsoparts.com/de-CH/fluidtechnik/kapsto-schutzelemente.html", "KAPSTO") },
      { title: "CUPMOUNT", text: isGerman(store) ? "Lagerungselemente für mobile Anwendungsbereiche" : "", icon: "star", url: search(store, "cupmount") },
    ],
  }),
  gap: (s) => needGap(s, { points: 2 }),
  draw: (s) => {
    const pts = s.points.filter((p) => p.title.trim()).slice(0, 8);
    const row = s.layout === "row";
    const one = (p: (typeof pts)[number]) => {
      const inner = `<b>${esc(p.title.trim()).replace(/®/g, "<sup>®</sup>")}</b>${!row && p.text.trim() ? `<em>${esc(p.text.trim())}</em>` : ""}`;
      return p.url ? `<a class="am-bw" href="${link(p.url)}">${inner}</a>` : `<div class="am-bw">${inner}</div>`;
    };
    return {
      html: `${header(s)}<div class="am-bws${row ? " is-row" : ""}" style="--n:${Math.max(1, pts.length)}">${pts.map(one).join("") || ph("Add the brands the shop carries: the name and a line")}</div>`,
      css: `
@@ .am-bws{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;border-radius:26px;background:#fff;box-shadow:var(--card);overflow:hidden}
@@ .am-bw{display:flex;flex-direction:column;justify-content:center;gap:10px;min-height:150px;padding:26px 28px;border-right:1px solid #eef1f3;border-bottom:1px solid #eef1f3;color:var(--ink)!important;transition:background .25s}
@@ .am-bw:nth-child(3n){border-right:0}
@@ .am-bw b{font:700 30px/1 var(--head);letter-spacing:.01em;color:var(--pet);transition:color .25s}
@@ .am-bw sup{font-size:.45em;vertical-align:top;line-height:1}
@@ .am-bw em{font-style:normal;font-size:14px;line-height:1.45;color:var(--mute)}
@@ a.am-bw:hover{background:#fbf3f2}
@@ a.am-bw:hover b{color:var(--red)}
@@ .am-bws.is-row{grid-template-columns:repeat(var(--n),minmax(0,1fr));border-radius:20px}
@@ .am-bws.is-row .am-bw{align-items:center;min-height:96px;padding:18px 12px;border-bottom:0;border-right:1px solid #eef1f3}
@@ .am-bws.is-row .am-bw:last-child{border-right:0}
@@ .am-bws.is-row .am-bw b{font-size:clamp(17px,1.7vw,24px);color:#7d878d;text-align:center}
@@ .am-bws.is-row a.am-bw:hover b{color:var(--pet)}
@media (max-width:900px){
@@ .am-bws{grid-template-columns:repeat(2,minmax(0,1fr));border-radius:18px}
@@ .am-bw{min-height:0;padding:18px 14px}
@@ .am-bw:nth-child(3n){border-right:1px solid #eef1f3}
@@ .am-bw:nth-child(2n){border-right:0}
@@ .am-bw b{font-size:22px}
@@ .am-bw em{font-size:13px}
@@ .am-bws.is-row{grid-template-columns:repeat(3,minmax(0,1fr))}
@@ .am-bws.is-row .am-bw:nth-child(3n){border-right:0}
@@ .am-bws.is-row .am-bw:nth-child(n+4){border-top:1px solid #eef1f3}
}`,
    };
  },
});

/* ── the APSO product brands ───────────────────────────────────────────── */

const FAMILIES: [string, number][] = [["APSOseal®", 0], ["APSOplast®", 1], ["APSOfluid®", 3], ["APSOdrive®", 4], ["APSOvib®", 2]];

const brandFamilies = def({
  id: "brand-families", category: "references", name: "Our product brands",
  note: "The five APSO brands, each with its technology's photo, its line and its range",
  layouts: [{ key: "cards", label: "Photo cards" }, { key: "list", label: "Rows" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "points", label: "The brands", min: 2, max: 6, item: { title: "The brand", text: "Its line" }, pictures: true, links: true }],
  tags: ["brands", "APSOseal", "APSOplast", "APSOfluid", "APSOdrive", "APSOvib", "technologies"],
  defaults: (store) => ({
    eyebrow: isGerman(store) ? "Unsere Marken" : "", title: isGerman(store) ? "Fünf Technologien, ==fünf Marken==" : "",
    points: FAMILIES.map(([b, i]) => ({ title: b, text: isGerman(store) ? `${TECH[i].name} · ${TECH_LINES[TECH[i].name].line}` : "", icon: "star", img: TECH[i].img, url: isGerman(store) ? TECH[i].url : undefined })),
  }),
  gap: (s) => needGap(s, { points: 2 }),
  draw: (s, o) => {
    const pts = s.points.filter((p) => p.title.trim()).slice(0, 6);
    const list = s.layout === "list";
    const one = (p: (typeof pts)[number]) => {
      const [tech, line] = p.text.includes(" · ") ? p.text.split(" · ") : ["", p.text];
      const inner = `<i>${img(p.img, o, { alt: p.title }) || ""}</i><span class="am-fm-t"><b>${esc(p.title.trim()).replace(/®/g, "<sup>®</sup>")}</b>${tech ? `<small>${esc(tech)}</small>` : ""}${line?.trim() ? `<em>${esc(line.trim())}</em>` : ""}</span>`;
      return p.url ? `<a class="am-fm" href="${link(p.url)}">${inner}</a>` : `<div class="am-fm">${inner}</div>`;
    };
    return {
      html: `${header(s)}<div class="am-fms${list ? " is-list" : ""}" style="--n:${Math.max(1, pts.length)}">${pts.map(one).join("") || ph("Add the brands: a name, a line, a picture and its range")}</div>`,
      css: `
@@ .am-fms{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:12px}
@@ .am-fm{position:relative;display:flex;flex-direction:column;min-height:400px;border-radius:22px;background:var(--pet-d);overflow:hidden;color:#fff!important}
@@ .am-fm>i{position:absolute;inset:0;display:block}
@@ .am-fm>i img{width:100%;height:100%;object-fit:cover;transition:transform .7s}
@@ .am-fm::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,35,46,0) 30%,rgba(15,35,46,.88) 75%)}
@@ .am-fm-t{position:relative;z-index:1;display:flex;flex-direction:column;gap:6px;margin-top:auto;padding:20px 18px 22px}
@@ .am-fm b{font:700 24px/1 var(--head);letter-spacing:.005em;color:#fff}
@@ .am-fm sup{font-size:.5em;vertical-align:top;line-height:1}
@@ .am-fm small{font:600 11.5px/1.2 var(--head);letter-spacing:.12em;text-transform:uppercase;color:#ff8a80}
@@ .am-fm em{max-height:0;overflow:hidden;font-style:normal;font-size:13.5px;line-height:1.45;color:#dbe6ec;opacity:0;transition:max-height .4s,opacity .3s}
@@ .am-fm:hover>i img{transform:scale(1.06)}
@@ .am-fm:hover em,@@ .am-fm:focus-visible em{max-height:120px;opacity:1}
@@ .am-fms.is-list{grid-template-columns:minmax(0,1fr);gap:0;border-top:1px solid var(--line)}
@@ .am-fms.is-list .am-fm{display:grid;grid-template-columns:150px minmax(0,1fr);align-items:center;gap:24px;min-height:0;padding:14px 0;border-radius:0;background:none;border-bottom:1px solid var(--line);color:var(--ink)!important}
@@ .am-fms.is-list .am-fm::after{display:none}
@@ .am-fms.is-list .am-fm>i{position:relative;height:96px;border-radius:14px;overflow:hidden}
@@ .am-fms.is-list .am-fm-t{display:grid;grid-template-columns:200px minmax(0,1fr);grid-template-rows:auto auto;gap:4px 24px;margin:0;padding:0}
@@ .am-fms.is-list b{grid-row:span 2;align-self:center;font-size:26px;color:var(--pet)}
@@ .am-fms.is-list small{color:var(--red)}
@@ .am-fms.is-list em{max-height:none;opacity:1;font-size:15px;color:var(--txt)}
@@ .am-fms.is-list a.am-fm:hover b{color:var(--red)}
@media (max-width:1100px) and (min-width:901px){@@ .am-fms:not(.is-list){grid-template-columns:repeat(3,minmax(0,1fr))}@@ .am-fm{min-height:300px}}
@media (hover:none){@@ .am-fm em{max-height:none;opacity:1}}
@media (max-width:900px){
@@ .am-fms:not(.is-list){grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
@@ .am-fm{min-height:220px;border-radius:18px}
@@ .am-fm b{font-size:20px}
@@ .am-fm em{display:none}
@@ .am-fms.is-list .am-fm{grid-template-columns:96px minmax(0,1fr);gap:14px}
@@ .am-fms.is-list .am-fm>i{height:72px}
@@ .am-fms.is-list .am-fm-t{grid-template-columns:minmax(0,1fr)}
@@ .am-fms.is-list b{grid-row:auto;font-size:21px}
}`,
    };
  },
});

/* ── one brand in depth ────────────────────────────────────────────────── */

const brandSpotlight = def({
  id: "brand-spotlight", category: "references", name: "Brand spotlight",
  note: "One brand or product line in depth: its name set large, what it stands for, its products",
  takes: "products", min: 1, max: 4,
  layouts: [{ key: "right", label: "Products right" }, { key: "below", label: "Products below" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", label: "The brand" }, { kind: "text", rows: 5 }, { kind: "points", label: "What it stands for", max: 4, item: { title: "The point", text: "" } }, { kind: "link" }],
  tags: ["brand", "spotlight", "product line", "evolast", "HITEC"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "FFKM O-Ringe", title: "evolast®",
      text: "Evolast FFKM für Hochleistungs-Elastomerdichtungen unter schweren chemischen und thermischen Bedingungen. Erforderliche Zulassungen sind nach dem genauen Compound, Typ und Artikel zu prüfen.",
      points: ["Extreme Chemikalienbeständigkeit", "Extreme Wärmebeständigkeit", "Chemische Industrie, Öl und Gas, Pharma"].map((t) => ({ title: t, text: "", icon: "check" })),
      link: { label: "Alle evolast® Produkte", url: search(store, "evolast") },
    } : { link: { label: "", url: search(store, "evolast") } }),
  }),
  gap: (s) => needGap(s, { title: true }),
  draw: (s, o) => {
    const pts = s.points.filter((p) => p.title.trim()).slice(0, 4);
    const prods = s.items.slice(0, 4);
    const below = s.layout === "below";
    const cards = prods.map((c) => `<a class="am-bp" href="${link(c.url)}"><i>${cardImg(c, o)}</i><b>${esc(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</a>`).join("");
    return {
      html: `<div class="am-bsp${below ? " is-below" : ""}"><div class="am-bsp-t">${eyOf(s)}${s.title.trim() ? `<h2 class="am-bsp-h">${marked(s.title.trim()).replace(/®/g, "<sup>®</sup>")}</h2>` : ph("Write the brand's name")}${s.text.trim() ? `<div class="am-sub">${prose(s.text)}</div>` : ""}${pts.length ? `<ul class="am-bsp-l">${pts.map((p) => `<li>${esc(p.title.trim())}</li>`).join("")}</ul>` : ""}${button(s.link, "am-btn")}</div><div class="am-bsp-g" style="--n:${Math.max(1, prods.length)}">${cards || ph("Pick its products")}</div></div>`,
      css: `
@@ .am-bsp{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:40px;align-items:center;padding:40px 44px;border-radius:30px;background:linear-gradient(135deg,#f6f8f9,#e7ecef);overflow:hidden}
@@ h2.am-bsp-h{font-size:clamp(46px,6vw,84px)!important;line-height:.95!important;letter-spacing:-.035em!important;color:var(--pet)!important}
@@ .am-bsp-h sup{font-size:.35em;vertical-align:top;line-height:1.2;color:var(--red)}
@@ .am-bsp .am-sub{margin-top:16px!important;font-size:16px;line-height:1.6}
@@ .am-bsp-l{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 24px!important}
@@ .am-bsp-l li{padding:8px 12px;border-radius:8px;background:#fff;box-shadow:inset 0 0 0 1px #dfe5e8;font:600 13.5px/1.2 var(--head);color:var(--pet)}
@@ .am-bsp-g{display:grid;grid-template-columns:repeat(min(var(--n),2),minmax(0,1fr));gap:12px}
@@ .am-bp{display:flex;flex-direction:column;padding:12px 14px 16px;border-radius:20px;background:#fff;box-shadow:var(--card);color:var(--ink)!important;transition:transform .2s,box-shadow .2s}
@@ .am-bp i{position:relative;display:block;aspect-ratio:1/.8;margin-bottom:10px}
@@ .am-bp i img{position:absolute;inset:4%;width:92%;height:92%;object-fit:contain;mix-blend-mode:multiply;filter:brightness(1.05) contrast(1.07);transition:transform .35s}
@@ .am-bp b{font:600 15.5px/1.25 var(--head)}
@@ .am-bp em{margin-top:4px;font:500 12.5px/1.2 var(--head);font-style:normal;color:var(--mute)}
@@ .am-bp:hover{transform:translateY(-3px);box-shadow:0 20px 34px -22px rgba(27,58,75,.55),inset 0 0 0 1px #e2e7ea}
@@ .am-bp:hover i img{transform:scale(1.05)}
@@ .am-bsp.is-below{grid-template-columns:minmax(0,1fr);gap:28px}
@@ .am-bsp.is-below .am-bsp-t{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:0 40px;align-items:end}
@@ .am-bsp.is-below .am-bsp-t>:not(.am-ey):not(.am-bsp-h){grid-column:2}
@@ .am-bsp.is-below .am-bsp-t>:is(.am-ey,.am-bsp-h){grid-column:1}
@@ .am-bsp.is-below .am-bsp-g{grid-template-columns:repeat(4,minmax(0,1fr))}
@@ .am-bsp.is-below .am-btn{justify-self:start}
@media (max-width:900px){
@@ .am-bsp,@@ .am-bsp.is-below{grid-template-columns:minmax(0,1fr);gap:20px;padding:22px 16px;border-radius:20px}
@@ .am-bsp.is-below .am-bsp-t{display:block}
@@ .am-bsp-g,@@ .am-bsp.is-below .am-bsp-g{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
@@ h2.am-bsp-h{font-size:48px!important}
}`,
    };
  },
});

/* ── product lines as a path ───────────────────────────────────────────── */

const brandLines = def({
  id: "brand-lines", category: "references", name: "Product lines",
  note: "A brand's product lines as a path - from the general line to the most demanding one",
  layouts: [{ key: "steps", label: "A rising path" }, { key: "cards", label: "Even cards" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 3 }, { kind: "points", label: "The lines, in order", min: 2, max: 5, item: { title: "The line", text: "When to look at it" }, links: true }],
  tags: ["product lines", "range", "upgrade", "brands", "path"],
  defaults: (store) => ({
    eyebrow: isGerman(store) ? "O-Ring-Produktlinien" : "", title: isGerman(store) ? "Welche ==Produktlinie== sollte ich prüfen?" : "",
    text: isGerman(store) ? "Bei gleichem Grundwerkstoff ist HITEC in der Regel die Upgrade-Option zu NORMATEC - mit Fokus auf Zulassungen oder Dokumentation. Der umgekehrte Wechsel sollte nicht automatisch angenommen werden." : "",
    points: [
      { title: "NORMATEC", text: isGerman(store) ? "Für allgemeine Industrieanwendungen" : "", icon: "star", url: search(store, "normatec") },
      { title: "HITEC®", text: isGerman(store) ? "Für Anwendungen mit Zulassungs- oder Dokumentationsanforderungen" : "", icon: "star", url: search(store, "hitec") },
      { title: "evolast® FFKM", text: isGerman(store) ? "Für Hochleistungs-FFKM-Dichtungen unter extremen Bedingungen" : "", icon: "star", url: search(store, "evolast") },
      { title: "FEP-O-Seal", text: isGerman(store) ? "Für geeignete statische Anwendungen in Pharma, Chemie oder Verfahrenstechnik" : "", icon: "star", url: catUrl(store, ORING.FEP.url, "FEP-O-Seal") },
    ],
  }),
  gap: (s) => needGap(s, { points: 2 }),
  draw: (s) => {
    const pts = s.points.filter((p) => p.title.trim()).slice(0, 5);
    const steps = s.layout !== "cards";
    const one = (p: (typeof pts)[number], i: number) => {
      const inner = `<span class="am-pl-n">${String(i + 1).padStart(2, "0")}</span><b>${esc(p.title.trim()).replace(/®/g, "<sup>®</sup>")}</b><em>${esc(p.text.trim())}</em>`;
      return p.url ? `<a class="am-pl" style="--i:${i}" href="${link(p.url)}">${inner}</a>` : `<div class="am-pl" style="--i:${i}">${inner}</div>`;
    };
    return {
      html: `${header(s)}<div class="am-pls${steps ? " is-steps" : ""}" style="--n:${Math.max(1, pts.length)}">${pts.map(one).join("") || ph("Add the lines, in order")}</div>`,
      css: `
@@ .am-pls{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:12px;align-items:end}
@@ .am-pl{position:relative;display:flex;flex-direction:column;gap:10px;min-height:200px;padding:22px 22px 24px;border-radius:22px;background:linear-gradient(#f6f8f9,#edf1f3);color:var(--ink)!important;transition:transform .25s,box-shadow .25s}
@@ .am-pl-n{font:600 13px/1 var(--head);letter-spacing:.12em;color:var(--red)}
@@ .am-pl b{font:700 26px/1.05 var(--head);color:var(--pet)}
@@ .am-pl sup{font-size:.45em;vertical-align:top;line-height:1.2}
@@ .am-pl em{margin-top:auto;font-style:normal;font-size:14.5px;line-height:1.45;color:var(--txt)}
@@ a.am-pl:hover{transform:translateY(-3px);box-shadow:0 22px 40px -28px rgba(27,58,75,.6),inset 0 0 0 1.5px var(--red)}
@@ .am-pls.is-steps .am-pl{min-height:calc(190px + var(--i) * 46px)}
@@ .am-pls.is-steps .am-pl:last-child{background:radial-gradient(120% 140% at 0% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%)}
@@ .am-pls.is-steps .am-pl:last-child b{color:#fff}
@@ .am-pls.is-steps .am-pl:last-child em{color:#cddbe3}
@@ .am-pls.is-steps .am-pl:last-child .am-pl-n{color:#ff8a80}
@@ .am-pls.is-steps .am-pl:not(:last-child)::after{content:"";position:absolute;right:-12px;bottom:34px;z-index:1;width:24px;height:24px;border-radius:50%;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23d80901' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12h13M13 7l5 5-5 5'/%3E%3C/svg%3E") center/14px no-repeat;box-shadow:0 4px 10px -4px rgba(27,58,75,.5)}
@media (max-width:900px){
@@ .am-pls{grid-template-columns:minmax(0,1fr);gap:8px}
@@ .am-pl,@@ .am-pls.is-steps .am-pl{min-height:0;padding:16px 16px 18px;margin-left:calc(var(--i) * 10px)}
@@ .am-pls:not(.is-steps) .am-pl{margin:0}
@@ .am-pls.is-steps .am-pl:not(:last-child)::after{display:none}
@@ .am-pl b{font-size:22px}
}`,
    };
  },
});

/* ── customer quotes (the shop's own pictures) ─────────────────────────── */

const QUOTES: [string, string][] = [["Agazzi Giancarlo Srl", PICS.quotes[0]], ["Kaufmann", PICS.quotes[1]], ["Nordfels", PICS.quotes[2]], ["Renex", PICS.quotes[3]], ["RGM", PICS.quotes[4]]];

const brandQuotes = def({
  id: "brand-quotes", category: "references", name: "Customer quotes",
  note: "What customers said, as the shop's About page publishes it - its own quote pictures, scrolled one by one",
  layouts: [{ key: "carousel", label: "One at a time" }, { key: "grid", label: "Two columns" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "points", label: "The quotes (the shop's own pictures)", min: 1, max: 6, item: { title: "Who said it (for the picture's text)", text: "" }, pictures: true }, { kind: "link" }],
  tags: ["testimonials", "quotes", "customers", "references", "reviews"],
  defaults: (store) => isGerman(store) ? {
    title: "Warum unsere Kunden ==immer wieder bestellen==",
    points: QUOTES.map(([t, p]) => ({ title: t, text: "", icon: "chat", img: p })),
    link: { label: "Über APSOparts®", url: pathFor(store, LINKS.about) },
  } : { link: { label: "", url: pathFor(store, LINKS.about) } },
  gap: (s) => s.points.some((p) => p.img) ? "" : "Add the quote pictures the shop has published",
  draw: (s, o) => {
    const pts = s.points.filter((p) => p.img).slice(0, 6);
    const grid = s.layout === "grid";
    return {
      html: `${header(s)}<div class="am-qc${grid ? " is-grid" : ""}">${pts.map((p) => `<figure>${img(p.img, o, { alt: p.title.trim() ? `${p.title.trim()}` : "" })}</figure>`).join("") || ph("Add the quote pictures the shop has published")}</div>`,
      css: `
@@ .am-qc{display:grid;grid-auto-flow:column;grid-auto-columns:88%;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 2px 16px;margin:0 -2px;scrollbar-width:thin;scrollbar-color:#c9d1d6 transparent}
@@ .am-qc figure{scroll-snap-align:start;margin:0;border-radius:20px;overflow:hidden;background:#284d63;box-shadow:0 20px 40px -30px rgba(27,58,75,.7)}
@@ .am-qc img{width:100%;height:auto;aspect-ratio:1920/600;object-fit:cover}
@@ .am-qc.is-grid{grid-auto-flow:row;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-columns:auto;overflow:visible;padding:0;margin:0}
@media (max-width:900px){@@ .am-qc{grid-auto-columns:92%;gap:10px}@@ .am-qc.is-grid{grid-template-columns:minmax(0,1fr)}@@ .am-qc figure{border-radius:14px}}`,
    };
  },
});

/* ── part of the Angst+Pfister group ───────────────────────────────────── */

const brandGroup = def({
  id: "brand-group", category: "references", name: "Part of the group",
  note: "APSOparts as part of the Angst+Pfister group - its figures as the shop states them",
  layouts: [{ key: "band", label: "Band" }, { key: "split", label: "Words and figures" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 5 }, { kind: "points", label: "The figures (the shop's own)", max: 4, item: { title: "The figure", text: "What it counts" } }, { kind: "link" }],
  tags: ["company", "group", "Angst+Pfister", "about", "trust"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "Muttergesellschaft", title: "Teil der ==Angst+Pfister== Gruppe",
      text: "Internationaler technischer Distributor und Dienstleister für hochwertige Industriekomponenten, vor über 80 Jahren in der Schweiz gegründet - mit Lösungen in der Dichtungs-, Kunststoff-, Fluid-, Antriebs-, Schwingungs- und Sensortechnik, kombiniert mit Logistik und Anwendungstechnik.",
      points: [{ title: "80+", text: "Jahre, gegründet in der Schweiz", icon: "star" }, { title: "2.000+", text: "Mitarbeitende", icon: "users" }, { title: "3", text: "Regionen: Europa, Asien und die USA", icon: "globe" }],
      link: { label: "Über APSOparts®", url: pathFor(store, LINKS.about) },
    } : { link: { label: "", url: pathFor(store, LINKS.about) } }),
  }),
  gap: (s) => needGap(s, { title: true }),
  draw: (s) => {
    const figs = s.points.filter((p) => p.title.trim()).slice(0, 4);
    const split = s.layout === "split";
    return {
      html: `<div class="am-gp${split ? " is-split" : ""}"><span class="am-gp-m" aria-hidden="true">Angst+Pfister</span><div class="am-gp-t">${eyOf(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ph("Write the headline")}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}${textLink(s.link)}</div>${figs.length ? `<div class="am-gp-f">${figs.map((p) => `<div><b>${esc(p.title.trim())}</b><span>${esc(p.text.trim())}</span></div>`).join("")}</div>` : ""}</div>`,
      css: `
@@ .am-gp{position:relative;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:40px;align-items:center;padding:44px 48px;border-radius:30px;background:radial-gradient(120% 140% at 0% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%);overflow:hidden}
@@ .am-gp-m{position:absolute;right:-10px;bottom:-34px;font:700 150px/1 var(--head);letter-spacing:-.04em;color:transparent;-webkit-text-stroke:1px rgba(255,255,255,.08);white-space:nowrap;pointer-events:none}
@@ .am-gp-t,@@ .am-gp-f{position:relative;z-index:1}
@@ .am-gp h2.am-h{color:#fff!important;font-size:clamp(26px,2.6vw,36px)!important}
@@ .am-gp .am-red{color:#ff6a5f}
@@ .am-gp :is(.am-sub,.am-ey){color:#cddbe3}
@@ .am-gp .am-sub{margin-top:12px!important;font-size:15.5px;line-height:1.6}
@@ .am-gp .am-lk{margin-top:16px;color:#fff!important}
@@ .am-gp-f{display:grid;gap:0}
@@ .am-gp-f>div{display:grid;grid-template-columns:150px minmax(0,1fr);align-items:baseline;gap:16px;padding:16px 0;border-top:1px solid rgba(255,255,255,.16)}
@@ .am-gp-f>div:first-child{border-top:0}
@@ .am-gp-f b{font:600 46px/1 var(--head);letter-spacing:-.03em;color:#fff}
@@ .am-gp-f span{font:500 15px/1.35 var(--head);color:#cddbe3}
@@ .am-gp.is-split{grid-template-columns:minmax(0,1fr);gap:28px;background:linear-gradient(135deg,#f6f8f9,#e9edf0)}
@@ .am-gp.is-split .am-gp-m{-webkit-text-stroke-color:rgba(39,78,100,.08)}
@@ .am-gp.is-split h2.am-h{color:var(--ink)!important}
@@ .am-gp.is-split .am-red{color:var(--red)}
@@ .am-gp.is-split :is(.am-sub,.am-ey){color:var(--mute)}
@@ .am-gp.is-split .am-sub{max-width:760px}
@@ .am-gp.is-split .am-lk{color:var(--pet)!important}
@@ .am-gp.is-split .am-gp-f{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@@ .am-gp.is-split .am-gp-f>div{grid-template-columns:minmax(0,1fr);gap:8px;padding:22px;border:0;border-radius:20px;background:#fff;box-shadow:var(--card)}
@@ .am-gp.is-split .am-gp-f b{color:var(--red)}
@@ .am-gp.is-split .am-gp-f span{color:var(--mute)}
@media (max-width:900px){
@@ .am-gp{grid-template-columns:minmax(0,1fr);gap:18px;padding:24px 18px;border-radius:20px}
@@ .am-gp-m{font-size:80px;bottom:-16px}
@@ .am-gp-f>div{grid-template-columns:96px minmax(0,1fr)}
@@ .am-gp-f b{font-size:34px}
@@ .am-gp.is-split .am-gp-f{grid-template-columns:minmax(0,1fr);gap:8px}
@@ .am-gp.is-split .am-gp-f>div{grid-template-columns:96px minmax(0,1fr);padding:14px 16px}
}`,
    };
  },
});

export const BRANDS = [brandWall, brandFamilies, brandSpotlight, brandLines, brandQuotes, brandGroup];
