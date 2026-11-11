// PAGE - THE LIBRARY, PART 2: INDUSTRIES & APPLICATIONS (Content v7, 10.11.2026). Pure.
//
// Where the parts work: industries with their materials, an industry x material matrix, an industry in depth, the range
// around a machine, applications and what matters in each, the industries the range covers. Which material suits which
// industry is the O-Ring selection guide's own table ("Typische Anwendungen") and its FAQ - never a claim the shop does not
// make, never an approval (they depend on the exact compound and article).

import { LINKS, ORING, PICS, VMQ_70 } from "./data";
import { button, cardImg, catUrl, def, esc, eyOf, header, icon, img, isGerman, link, marked, needGap, pathFor, ph, rowsOf, textLink } from "./kit";

/* ── industries with their materials ───────────────────────────────────── */

const IND: [string, string, string, string][] = [
  ["Lebensmittel und Getränke", "EPDM und VMQ - lebensmittelkonforme Optionen je nach Compound", "food", "VMQ"],
  ["Pharma und Medizintechnik", "VMQ, FFKM und FEP-ummantelte O-Ringe", "pharma", "FFKM"],
  ["Chemische Industrie", "FKM, FFKM, PTFE und FEP-ummantelte Optionen", "flask", "FKM"],
  ["Trinkwasser und HLK", "EPDM: wasser-, dampf-, witterungs- und ozonbeständig", "water", "EPDM"],
  ["Öl und Gas", "FKM, HNBR und FFKM", "drop", "HNBR"],
  ["Hydraulik und Pneumatik", "NBR, HNBR für Hochleistungs-Hydraulik", "gear", "NBR"],
];

const indIcons = def({
  id: "ind-icons", category: "industries", name: "Industries",
  note: "The industries the range serves, each with its icon and the materials that suit it",
  layouts: [{ key: "cards", label: "Cards" }, { key: "strip", label: "One strip" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "points", label: "The industries", min: 2, max: 8, item: { title: "The industry", text: "What suits it" }, icons: true, links: true }, { kind: "link" }],
  tags: ["industries", "sectors", "applications", "markets"],
  defaults: (store) => ({
    eyebrow: isGerman(store) ? "Branchen" : "", title: isGerman(store) ? "Der passende Werkstoff für ==Ihre Branche==" : "",
    text: isGerman(store) ? "Die Werkstoff-Vorauswahl berücksichtigt Medium, Temperatur, Druck, Bewegung und erforderliche Dokumentation." : "",
    points: IND.map(([t, x, ic, k]) => ({ title: isGerman(store) ? t : "", text: isGerman(store) ? x : "", icon: ic, url: catUrl(store, ORING[k].url, `O-Ring ${k}`) })),
    link: { label: isGerman(store) ? "Zur O-Ring Auswahlhilfe" : "", url: pathFor(store, LINKS.oringGuide) },
  }),
  gap: (s) => needGap(s, { points: 2 }),
  draw: (s) => {
    const pts = s.points.filter((p) => p.title.trim()).slice(0, 8);
    const strip = s.layout === "strip";
    return {
      html: `${header(s)}<div class="am-ii${strip ? " is-strip" : ""}" style="--n:${Math.max(1, pts.length)}">${pts.map((p) => `<a href="${link(p.url ?? "")}"><span class="am-ii-i">${icon(p.icon, 30)}</span><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<em>${esc(p.text.trim())}</em>` : ""}</a>`).join("") || ph("Add the industries: a name, what suits it and a page")}</div>`,
      css: `
@@ .am-ii{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
@@ .am-ii a{position:relative;display:grid;grid-template-columns:64px minmax(0,1fr);grid-template-rows:auto 1fr;column-gap:18px;row-gap:6px;padding:24px 24px 22px;border-radius:22px;background:#fff;box-shadow:var(--card);color:var(--ink)!important;overflow:hidden;transition:transform .25s,box-shadow .25s}
@@ .am-ii a::after{content:"";position:absolute;right:-30px;bottom:-30px;width:110px;height:110px;border-radius:50%;background:var(--soft);transition:transform .4s,background .3s}
@@ .am-ii-i{position:relative;z-index:1;grid-row:span 2;display:grid;place-items:center;width:64px;height:64px;border-radius:20px;background:linear-gradient(145deg,#2f5d76,#1b3a4b);color:#fff}
@@ .am-ii b{position:relative;z-index:1;align-self:end;font:600 19px/1.2 var(--head)}
@@ .am-ii em{position:relative;z-index:1;font-style:normal;font-size:14px;line-height:1.45;color:var(--txt)}
@@ .am-ii a:hover,@@ .am-ii a:focus-visible{transform:translateY(-3px);box-shadow:0 22px 40px -26px rgba(27,58,75,.6),inset 0 0 0 1px #e2e7ea}
@@ .am-ii a:hover::after{transform:scale(1.5);background:#fdf0ef}
@@ .am-ii a:hover .am-ii-i{background:var(--red)}
@@ .am-ii.is-strip{grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:0;border-radius:24px;background:#fff;box-shadow:var(--card);overflow:hidden}
@@ .am-ii.is-strip a{grid-template-columns:minmax(0,1fr);grid-template-rows:auto;justify-items:center;text-align:center;row-gap:10px;padding:26px 14px 22px;border-radius:0;box-shadow:none}
@@ .am-ii.is-strip a+a{border-left:1px solid #eef1f3}
@@ .am-ii.is-strip a::after{display:none}
@@ .am-ii.is-strip .am-ii-i{grid-row:auto;width:58px;height:58px;border-radius:50%;background:#fdf0ef;color:var(--red)}
@@ .am-ii.is-strip b{align-self:start;font-size:15.5px}
@@ .am-ii.is-strip em{display:none}
@@ .am-ii.is-strip a:hover{transform:none;background:#fbf3f2}
@@ .am-ii>.am-ph{grid-column:1/-1}
@media (max-width:1100px) and (min-width:901px){@@ .am-ii{grid-template-columns:repeat(2,minmax(0,1fr))}@@ .am-ii.is-strip{grid-template-columns:repeat(3,minmax(0,1fr))}@@ .am-ii.is-strip a:nth-child(3n+1){border-left:0}}
@media (max-width:900px){
@@ .am-ii{grid-template-columns:minmax(0,1fr);gap:8px}
@@ .am-ii a{grid-template-columns:48px minmax(0,1fr);column-gap:14px;padding:16px}
@@ .am-ii-i{width:48px;height:48px;border-radius:14px}
@@ .am-ii b{font-size:17px}
@@ .am-ii.is-strip{grid-template-columns:repeat(2,minmax(0,1fr))}
@@ .am-ii.is-strip a{padding:18px 10px}
@@ .am-ii.is-strip a:nth-child(odd){border-left:0}
@@ .am-ii.is-strip a:nth-child(n+3){border-top:1px solid #eef1f3}
}`,
    };
  },
});

/* ── industry x material ───────────────────────────────────────────────── */

const MX_COLS = ["NBR", "HNBR", "FKM", "FFKM", "EPDM", "VMQ"];
const MX_ROWS: [string, string[]][] = [
  ["Hydraulik", ["NBR", "HNBR"]], ["Pneumatik", ["NBR"]], ["Automobilindustrie", ["NBR", "HNBR", "FKM"]], ["Chemische Industrie", ["FKM", "FFKM"]],
  ["Öl und Gas", ["HNBR", "FKM", "FFKM"]], ["Pharma", ["FFKM"]], ["Trinkwasser", ["EPDM"]], ["Lebensmittel und Getränke", ["EPDM", "VMQ"]],
  ["HLK", ["EPDM"]], ["Medizintechnik", ["VMQ"]], ["Elektronik", ["VMQ"]],
];
const matrixTable = () => [["", ...MX_COLS], ...MX_ROWS.map(([r, ks]) => [r, ...MX_COLS.map((c) => (ks.includes(c) ? "●" : ""))])];
const isDot = (c: string) => /^(●|•|x|✓|1|ja|yes|oui|sì|si|tak)$/i.test(c.trim());

const indMatrix = def({
  id: "ind-matrix", category: "industries", name: "Industry by material",
  note: "A matrix: the industries down, the materials across, a dot where the guide names them together",
  layouts: [{ key: "dots", label: "Matrix of dots" }, { key: "list", label: "A row per industry" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "table", label: "The matrix (first row: the materials; a dot ● where they fit)", cols: 7, maxRows: 14 }, { kind: "points", label: "Each material's page (in the same order)", max: 7, item: { title: "Its words", text: "" }, links: true }],
  tags: ["matrix", "industries", "materials", "overview", "chart"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "Typische Anwendungen", title: "Welcher Werkstoff in welcher ==Branche==",
      text: "Nach den typischen Anwendungen der O-Ring Auswahlhilfe - eine Vorauswahl; Compound, Zulassungen und Einsatzgrenzen am Artikel prüfen.",
      table: matrixTable(),
    } : {}),
    points: MX_COLS.map((k) => ({ title: k, text: "", icon: "ring", url: catUrl(store, ORING[k].url, `O-Ring ${k}`) })),
  }),
  gap: (s) => needGap(s, { table: 2 }),
  draw: (s) => {
    const rows = rowsOf(s).slice(0, 14);
    const head = rows[0] ?? [];
    const cols = Math.max(0, Math.min(6, Math.max(0, ...rows.map((r) => r.length)) - 1));
    if (!rows.length || cols < 1) return { html: `${header(s, false)}${ph("Fill the matrix: the first row names the materials, each next row an industry with a dot where they fit")}`, css: "" };
    const go = (i: number) => s.points[i]?.url;
    const items = rows.slice(1).map((r) => {
      const hits = head.slice(1, cols + 1).map((h, i) => ({ h, i, v: r[i + 1] ?? "" })).filter((x) => x.v.trim());
      return `<li><b>${esc(r[0] ?? "")}</b><span>${hits.map((x) => go(x.i) ? `<a href="${link(go(x.i)!)}">${esc(x.h)}</a>` : `<i>${esc(x.h)}</i>`).join("")}</span></li>`;
    }).join("");
    const LIST_CSS = `
@@ .am-mxl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 32px;border-top:1px solid var(--line)}
@@ .am-mxl li{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:12px 2px;border-bottom:1px solid var(--line)}
@@ .am-mxl b{font:600 16px/1.3 var(--head);color:var(--ink)}
@@ .am-mxl span{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}
@@ .am-mxl :is(a,i){padding:6px 10px;border-radius:8px;background:var(--pet);font:600 13px/1 var(--head);font-style:normal;color:#fff!important;transition:background .2s}
@@ .am-mxl a:hover{background:var(--red)}
@media (max-width:900px){@@ .am-mxl{grid-template-columns:minmax(0,1fr)}}`;
    if (s.layout === "list") return { html: `${header(s, false)}<ul class="am-mxl">${items}</ul>`, css: LIST_CSS };
    const th = head.slice(1, cols + 1).map((h, i) => `<th scope="col">${go(i) ? `<a href="${link(go(i)!)}">${esc(h)}</a>` : esc(h)}</th>`).join("");
    const trs = rows.slice(1).map((r) => `<tr><th scope="row">${esc(r[0] ?? "")}</th>${Array.from({ length: cols }, (_, i) => { const v = r[i + 1] ?? ""; return `<td>${isDot(v) ? '<span class="am-mx-d" aria-label="✓"></span>' : esc(v)}</td>`; }).join("")}</tr>`).join("");
    return {
      // on a phone the matrix becomes its list (a row per industry, its materials as chips) - never a squeezed table
      html: `<div class="am-mx">${header(s, false)}<div class="am-mx-w"><table><thead><tr><th></th>${th}</tr></thead><tbody>${trs}</tbody></table></div><ul class="am-mxl is-alt">${items}</ul></div>`,
      css: `${LIST_CSS}
@@ .am-mxl.is-alt{display:none}
@@ .am-mx{padding:28px 30px 26px;border-radius:28px;background:linear-gradient(#f6f8f9,#edf1f3)}
@@ .am-mx-w{border-radius:20px;background:#fff;box-shadow:var(--card);overflow-x:auto}
@@ .am-mx table{min-width:${220 + cols * 84}px}
@@ .am-mx thead th{min-width:84px;padding:16px 8px 12px;text-align:center;font:600 16px/1 var(--head);color:var(--pet);border-bottom:2px solid #e8ecee}
@@ .am-mx thead th:first-child{min-width:220px}
@@ .am-mx thead a{color:var(--pet)!important;transition:color .2s}
@@ .am-mx thead a:hover{color:var(--red)!important}
@@ .am-mx tbody th{padding:11px 18px;font:500 15px/1.3 var(--head);color:var(--ink)}
@@ .am-mx tbody td{padding:11px 8px;text-align:center;border-left:1px solid #f1f3f5;font-size:13px;color:var(--txt)}
@@ .am-mx tbody tr+tr :is(th,td){border-top:1px solid #f1f3f5}
@@ .am-mx tbody tr:hover{background:#fbf6f5}
@@ .am-mx tbody tr:hover th{color:var(--red)}
@@ .am-mx-d{display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--red);box-shadow:0 0 0 5px #fdecea;vertical-align:middle}
@media (max-width:900px){
@@ .am-mx{padding:18px 14px;border-radius:20px}
@@ .am-mx-w{display:none}
@@ .am-mxl.is-alt{display:grid;border-top:0}
@@ .am-mxl.is-alt li{padding:11px 4px}
@@ .am-mxl.is-alt li:last-child{border-bottom:0}
}`,
    };
  },
});

/* ── an industry in depth ──────────────────────────────────────────────── */

const indFeature = def({
  id: "ind-feature", category: "industries", name: "Industry spotlight",
  note: "One application in depth: its picture, what matters there, where the part works, the product",
  layouts: [{ key: "split", label: "Picture beside" }, { key: "banner", label: "Picture as a band on top" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 5 }, { kind: "feature", label: "The picture" }, { kind: "points", label: "What matters there", max: 5, item: { title: "The point", text: "" } }, { kind: "link" }],
  tags: ["industry", "application", "spotlight", "use case", "drinking water"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "Lebensmittel und Getränke", title: "Dichten, wo ==Lebensmittel== verarbeitet werden",
      text: "VMQ (Silikon) wird typisch in Lebensmitteln und Getränken, der Medizintechnik und der Elektronik eingesetzt. Der HITEC® O-Ring VMQ 70.10-01 ist ein peroxidisch vernetzter VMQ-Werkstoff mit sehr guter Beständigkeit gegen Wasser und Heissluft, tierische und pflanzliche Öle und Fette.",
      points: ["Beständig gegen Wasser und Heissluft", "Beständig gegen tierische und pflanzliche Öle und Fette", "Einsatztemperatur von -55 bis +200 °C, kurzzeitig +230 °C", "Sehr guter Druckverformungsrest"].map((t) => ({ title: t, text: "", icon: "check" })),
      link: { label: "Zum HITEC® O-Ring VMQ 70.10-01", url: VMQ_70.url },
    } : {}),
    feature: { ...VMQ_70, url: catUrl(store, VMQ_70.url, VMQ_70.number) },
  }),
  gap: (s) => needGap(s, { title: true }),
  draw: (s, o) => {
    const pts = s.points.filter((p) => p.title.trim()).slice(0, 5);
    const banner = s.layout === "banner";
    const pic = s.feature?.img ? `<figure class="am-if-p${s.feature.kind === "product" ? " is-prod" : ""}">${cardImg(s.feature, o, false)}${s.eyebrow.trim() ? `<figcaption>${esc(s.eyebrow.trim())}</figcaption>` : ""}</figure>` : ph("Pick the picture", "am-if-p");
    return {
      html: `<div class="am-if${banner ? " is-banner" : ""}">${pic}<div class="am-if-t">${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ph("Write the headline")}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}${pts.length ? `<ul class="am-if-l">${pts.map((p) => `<li>${esc(p.title.trim())}</li>`).join("")}</ul>` : ""}${button(s.link, "am-btn is-pet")}</div></div>`,
      css: `
@@ .am-if{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0;align-items:stretch;border-radius:30px;background:#fff;box-shadow:var(--card);overflow:hidden}
@@ .am-if-p{position:relative;margin:0;min-height:420px;background:var(--tile)}
@@ .am-if-p img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
@@ .am-if-p.is-prod{background:#fff}
@@ .am-if-p.is-prod img{inset:12%;width:76%;height:76%;object-fit:contain;mix-blend-mode:multiply;filter:brightness(1.05) contrast(1.07);-webkit-mask-image:radial-gradient(circle closest-side at 50% 50%,#000 70%,transparent 100%);mask-image:radial-gradient(circle closest-side at 50% 50%,#000 70%,transparent 100%)}
@@ .am-if-p figcaption{position:absolute;left:20px;top:20px;padding:8px 14px;border-radius:10px;background:var(--red);font:600 12px/1.2 var(--head);letter-spacing:.12em;text-transform:uppercase;color:#fff}
@@ .am-if-t{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;padding:44px 48px}
@@ .am-if h2.am-h{font-size:clamp(26px,2.6vw,36px)!important;line-height:1.12!important}
@@ .am-if .am-sub{margin-top:14px!important;font-size:16px;line-height:1.6}
@@ .am-if-l{display:grid;gap:10px;margin:20px 0 26px!important}
@@ .am-if-l li{display:flex;align-items:flex-start;gap:12px;font:500 16px/1.35 var(--head);color:var(--ink)}
@@ .am-if-l li::before{content:"";flex:none;width:22px;height:22px;margin-top:-1px;border-radius:50%;background:#e7eef2 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23274e64' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 12.5 4 4 8-9'/%3E%3C/svg%3E") center/13px no-repeat}
@@ .am-if.is-banner{grid-template-columns:minmax(0,1fr)}
@@ .am-if.is-banner .am-if-p{min-height:0;aspect-ratio:21/7}
@@ .am-if.is-banner .am-if-t{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 48px;align-items:start;padding:36px 44px}
@@ .am-if.is-banner .am-if-t>:is(h2,.am-sub){grid-column:1}
@@ .am-if.is-banner .am-if-l{grid-column:2;grid-row:1/span 3;margin:4px 0 0!important}
@@ .am-if.is-banner .am-btn{grid-column:1;justify-self:start;margin-top:12px}
@media (max-width:900px){
@@ .am-if,@@ .am-if.is-banner{grid-template-columns:minmax(0,1fr);border-radius:20px}
@@ .am-if-p,@@ .am-if.is-banner .am-if-p{min-height:0;aspect-ratio:4/3}
@@ .am-if-t,@@ .am-if.is-banner .am-if-t{display:flex;padding:22px 18px}
@@ .am-if.is-banner .am-if-l{margin:18px 0 22px!important}
}`,
    };
  },
});

/* ── the range around a machine ────────────────────────────────────────── */

const indAround = def({
  id: "ind-around", category: "industries", name: "Around the machine",
  note: "A machine in the middle, the categories it needs around it - each opens its range",
  takes: "categories", min: 2, max: 6, kids: "subs",
  layouts: [{ key: "around", label: "Around the picture" }, { key: "below", label: "Picture, then a row" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "feature", label: "The machine's picture" }, { kind: "link" }],
  tags: ["machine", "application", "categories", "around", "plant"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "Kunststofftechnik", title: "Platten, Rundstäbe, Rohre - ==im Zuschnitt== nach Mass",
      text: "Mit DirectCUT ausgewählte Kunststoffhalbzeuge in Ihren Abmessungen bestellen - vom Einzelstück bis zu grösseren Produktionsmengen.",
      link: { label: "Zu DirectCUT", url: pathFor(store, LINKS.directcut) },
    } : { link: { label: "", url: pathFor(store, LINKS.directcut) } }),
    feature: { kind: "category", name: "DirectCUT", url: pathFor(store, LINKS.directcut), img: PICS.machine, meta: "", number: "", children: [] },
  }),
  draw: (s, o) => {
    const items = s.items.slice(0, 6);
    const below = s.layout === "below";
    const tile = (c: (typeof items)[number]) => `<a class="am-ar-c" href="${link(c.url)}"><i>${cardImg({ ...c, kind: "category" }, o)}</i><span><b>${esc(c.name)}</b>${c.meta ? `<em>${esc(c.meta)}</em>` : ""}</span></a>`;
    const pic = s.feature?.img ? `<figure class="am-ar-p">${img(s.feature.img, o, { lazy: false, alt: s.feature.name })}</figure>` : ph("Pick the machine's picture", "am-ar-p");
    const half = Math.ceil(items.length / 2);
    const body = !items.length ? `${pic}${ph("Pick the categories around it")}`
      : below ? `${pic}<div class="am-ar-r" style="--n:${items.length}">${items.map(tile).join("")}</div>`
        : `<div class="am-ar-s">${items.slice(0, half).map(tile).join("")}</div>${pic}<div class="am-ar-s">${items.slice(half).map(tile).join("")}</div>`;
    return {
      html: `<div class="am-ar">${header(s)}<div class="am-ar-g${below ? " is-below" : ""}">${body}</div></div>`,
      css: `
@@ .am-ar{padding:28px 30px 30px;border-radius:30px;background:radial-gradient(70% 90% at 50% 55%,#fff 0%,#f1f4f6 60%,#e8edf0 100%)}
@@ .am-ar-g{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.4fr) minmax(0,.8fr);gap:18px;align-items:center}
@@ .am-ar-p{position:relative;margin:0;aspect-ratio:16/10}
@@ .am-ar-p img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply}
@@ .am-ar-s{display:grid;gap:12px}
@@ .am-ar-c{display:grid;grid-template-columns:64px minmax(0,1fr);align-items:center;gap:14px;padding:10px 14px 10px 10px;border-radius:16px;background:#fff;box-shadow:var(--card);color:var(--ink)!important;transition:transform .2s,box-shadow .2s}
@@ .am-ar-c i{position:relative;display:block;width:64px;height:64px;border-radius:12px;overflow:hidden;background:var(--tile)}
@@ .am-ar-c i img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
@@ .am-ar-c b{display:block;font:600 15.5px/1.25 var(--head)}
@@ .am-ar-c em{display:block;margin-top:2px;font:500 12.5px/1.2 var(--head);font-style:normal;color:var(--mute)}
@@ .am-ar-c:hover,@@ .am-ar-c:focus-visible{transform:translateY(-2px);box-shadow:0 16px 30px -20px rgba(27,58,75,.55),inset 0 0 0 1.5px var(--red)}
@@ .am-ar-c:hover b{color:var(--red)}
@@ .am-ar-g.is-below{grid-template-columns:minmax(0,1fr)}
@@ .am-ar-g.is-below .am-ar-p{width:min(560px,100%);justify-self:center}
@@ .am-ar-r{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:12px}
@@ .am-ar-r .am-ar-c{grid-template-columns:minmax(0,1fr);padding:10px 10px 14px}
@@ .am-ar-r .am-ar-c i{width:100%;height:auto;aspect-ratio:4/3}
@@ .am-ar-g>.am-ph{grid-column:1/-1}
@media (max-width:1100px) and (min-width:901px){@@ .am-ar-c{grid-template-columns:48px minmax(0,1fr)}@@ .am-ar-c i{width:48px;height:48px}@@ .am-ar-r{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:900px){
@@ .am-ar{padding:18px 12px;border-radius:20px}
@@ .am-ar-g{grid-template-columns:minmax(0,1fr);gap:8px}
@@ .am-ar-p{order:-1}
@@ .am-ar-r{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
@@ .am-ar-s{gap:8px}
}`,
    };
  },
});

/* ── applications and what matters in each ────────────────────────────── */

const indRows = def({
  id: "ind-rows", category: "industries", name: "Applications",
  note: "Applications as rows: what matters there, and what to look at on the shop",
  layouts: [{ key: "rows", label: "Rows" }, { key: "cards", label: "Cards" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "faq", label: "The applications (its name, then what matters)", max: 8 }, { kind: "points", label: "What to look at for each (same order)", max: 8, item: { title: "Its words", text: "" }, links: true }],
  tags: ["applications", "use cases", "industries", "context"],
  defaults: (store) => isGerman(store) ? {
    eyebrow: "Anwendungskontext", title: "Von der ==Betriebsumgebung== ausgehen",
    text: "Nicht nur die Frage, was ein O-Ring ist, ist relevant - sondern auch, wo er eingesetzt wird.",
    faq: [
      { q: "Hydraulik und Pneumatik", a: "Häufig stehen zunächst Öl- und Druckanforderungen im Fokus." },
      { q: "Chemie und Verfahrenstechnik", a: "Medienverträglichkeit sowie erforderliche Zulassungen und Dokumentationen genauer prüfen." },
      { q: "Lebensmittel und Trinkwasser", a: "Medienverträglichkeit und die Dokumentation des konkreten Artikels und Compounds prüfen." },
      { q: "Instandhaltung und Ersatzteile", a: "Abmessungen, Werkstoff, Compound und Anwendungsbedingungen der bestehenden Dichtung überprüfen." },
    ],
    points: [
      { title: "O-Ring NBR", text: "", icon: "ring", url: ORING.NBR.url }, { title: "O-Ring FFKM", text: "", icon: "ring", url: ORING.FFKM.url },
      { title: "O-Ring EPDM", text: "", icon: "ring", url: ORING.EPDM.url }, { title: "O-Ring Expert", text: "", icon: "ring", url: pathFor(store, LINKS.oringExpert) },
    ],
  } : {},
  gap: (s) => needGap(s, { faq: 1 }),
  draw: (s) => {
    const apps = s.faq.filter((x) => x.q.trim()).slice(0, 8);
    const cards = s.layout === "cards";
    const one = (x: { q: string; a: string }, i: number) => {
      const p = s.points[i];
      return `<li><span class="am-ap-n">${String(i + 1).padStart(2, "0")}</span><b>${esc(x.q.trim())}</b><p>${esc(x.a.trim())}</p>${p?.title.trim() && p.url ? `<a href="${link(p.url)}">${esc(p.title.trim())}</a>` : "<span></span>"}</li>`;
    };
    return {
      html: `${header(s)}<ol class="am-ap${cards ? " is-cards" : ""}">${apps.map(one).join("") || `<li>${ph("Write the applications and what matters in each")}</li>`}</ol>`,
      css: `
@@ .am-ap{display:grid;gap:0;border-top:1px solid var(--line)}
@@ .am-ap>li{display:grid;grid-template-columns:60px minmax(0,.9fr) minmax(0,1.3fr) 210px;align-items:center;gap:20px;padding:20px 4px;border-bottom:1px solid var(--line);transition:background .2s}
@@ .am-ap>li:hover{background:linear-gradient(90deg,#f6f8f9,transparent)}
@@ .am-ap-n{font:600 26px/1 var(--head);color:transparent;-webkit-text-stroke:1.2px var(--red)}
@@ .am-ap b{font:600 19px/1.25 var(--head);color:var(--ink)}
@@ .am-ap p{font-size:15px;line-height:1.55;color:var(--txt)}
@@ .am-ap a{justify-self:end;display:inline-flex;align-items:center;gap:10px;padding:10px 16px;border-radius:10px;background:var(--soft);font:600 14.5px/1.1 var(--head);color:var(--pet)!important;transition:background .2s,color .2s}
@@ .am-ap a::after{content:"";width:7px;height:7px;border:solid currentColor;border-width:1.8px 1.8px 0 0;transform:rotate(45deg)}
@@ .am-ap a:hover{background:var(--pet);color:#fff!important}
@@ .am-ap.is-cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;border:0}
@@ .am-ap.is-cards>li{grid-template-columns:minmax(0,1fr);align-content:start;gap:10px;padding:24px;border:0;border-radius:22px;background:linear-gradient(#f6f8f9,#edf1f3)}
@@ .am-ap.is-cards a{justify-self:start;margin-top:6px;background:#fff}
@media (max-width:900px){
@@ .am-ap>li{grid-template-columns:44px minmax(0,1fr);gap:6px 12px;padding:16px 2px}
@@ .am-ap>li>:is(p,a){grid-column:2}
@@ .am-ap a{justify-self:start;margin-top:6px}
@@ .am-ap-n{font-size:22px}
@@ .am-ap.is-cards{grid-template-columns:minmax(0,1fr);gap:8px}
@@ .am-ap.is-cards>li{padding:18px 16px}
@@ .am-ap.is-cards>li>:is(p,a){grid-column:1}
}`,
    };
  },
});

/* ── the industries the range covers ───────────────────────────────────── */

const COVERED = ["Allgemeine Industrie", "Trinkwasser", "Lebensmittel & Getränke", "Verfahrenstechnik", "Pharma", "Medizintechnik", "Chemische Verarbeitung", "Petrochemie", "Öl & Gas", "Energie", "Industriemaschinen", "Fortschrittliche Fertigung"];

const indCloud = def({
  id: "ind-cloud", category: "industries", name: "Industries covered",
  note: "The industries the range covers, set as large words - a strong, calm typographic block",
  layouts: [{ key: "cloud", label: "Large words" }, { key: "columns", label: "Three columns" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "points", label: "The industries", min: 3, max: 12, item: { title: "The industry", text: "" }, links: true }, { kind: "link" }],
  tags: ["industries", "typography", "sectors", "list"],
  defaults: (store) => isGerman(store) ? {
    eyebrow: "Branchen", title: "Für diese Branchen",
    text: "Die Produktübersicht der O-Ring Auswahlhilfe umfasst:",
    points: COVERED.map((t) => ({ title: t, text: "", icon: "check" })),
    link: { label: "Zur O-Ring Auswahlhilfe", url: pathFor(store, LINKS.oringGuide) },
  } : { link: { label: "", url: pathFor(store, LINKS.oringGuide) } },
  gap: (s) => needGap(s, { points: 3 }),
  draw: (s) => {
    const pts = s.points.filter((p) => p.title.trim()).slice(0, 12);
    const cols = s.layout === "columns";
    const word = (p: (typeof pts)[number], i: number) => {
      const inner = `<span>${esc(p.title.trim())}</span>`;
      return p.url ? `<a class="am-cw w${i % 4}" href="${link(p.url)}">${inner}</a>` : `<span class="am-cw w${i % 4}">${inner}</span>`;
    };
    return {
      html: `<div class="am-cl${cols ? " is-cols" : ""}"><div class="am-cl-t">${eyOf(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ""}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}${textLink(s.link)}</div><div class="am-cl-w">${pts.map(word).join("") || ph("Add the industries")}</div></div>`,
      css: `
@@ .am-cl{display:grid;grid-template-columns:minmax(0,.55fr) minmax(0,1.45fr);gap:40px;align-items:center;padding:40px 44px;border-radius:30px;background:radial-gradient(120% 140% at 0% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%)}
@@ .am-cl h2.am-h{color:#fff!important}
@@ .am-cl .am-red{color:#ff6a5f}
@@ .am-cl :is(.am-sub,.am-ey){color:#cddbe3}
@@ .am-cl .am-lk{margin-top:16px;color:#fff!important}
@@ .am-cl-w{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 22px}
@@ .am-cw{font:600 30px/1.25 var(--head);letter-spacing:-.01em;color:#fff!important;transition:color .2s}
@@ .am-cw.w1{color:transparent!important;-webkit-text-stroke:1.2px rgba(255,255,255,.85)}
@@ .am-cw.w2{font-size:24px;color:#9fb8c6!important}
@@ .am-cw.w3{font-size:34px}
@@ a.am-cw:hover{color:#ff6a5f!important;-webkit-text-stroke:0}
@@ .am-cl.is-cols{grid-template-columns:minmax(0,1fr);gap:22px;background:linear-gradient(#f6f8f9,#edf1f3)}
@@ .am-cl.is-cols h2.am-h{color:var(--ink)!important}
@@ .am-cl.is-cols .am-red{color:var(--red)}
@@ .am-cl.is-cols :is(.am-sub,.am-ey){color:var(--mute)}
@@ .am-cl.is-cols .am-lk{color:var(--pet)!important}
@@ .am-cl.is-cols .am-cl-w{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 28px}
@@ .am-cl.is-cols .am-cw{display:flex;align-items:center;gap:12px;padding:13px 2px;border-bottom:1px solid #dbe2e6;font:500 17px/1.3 var(--head);color:var(--ink)!important;-webkit-text-stroke:0}
@@ .am-cl.is-cols .am-cw::before{content:"";flex:none;width:8px;height:8px;border-radius:2px;background:var(--red)}
@media (max-width:900px){
@@ .am-cl{grid-template-columns:minmax(0,1fr);gap:18px;padding:24px 18px;border-radius:20px}
@@ .am-cw{font-size:22px}
@@ .am-cw.w2{font-size:18px}
@@ .am-cw.w3{font-size:24px}
@@ .am-cl.is-cols .am-cl-w{grid-template-columns:minmax(0,1fr)}
}`,
    };
  },
});

export const INDUSTRIES = [indIcons, indMatrix, indFeature, indAround, indRows, indCloud];
