// PAGE - THE LIBRARY, PART 2: TECHNICAL & COMPARISON (Content v7, 10.11.2026). Pure.
//
// Facts as an engineer reads them: a product's technical summary, materials side by side, how to choose, which material
// for which condition, the parameters to check, static against dynamic, the norms, a checklist before ordering. Only the
// shop's own facts: its product pages' "Technische Zusammenfassung" (./data.ts) and the O-Ring selection guide - never a
// value the shop does not state, never a certificate list (a product's approvals stay on its own page).

import { LINKS, MATS, MAT_NOTE, ORING, PRODUCTS } from "./data";
import { cardFor, cardImg, catUrl, def, esc, eyOf, header, icon, isGerman, link, marked, needGap, pathFor, ph, rowsOf, textLink, w2, linesOf, pairOf } from "./kit";

/* ── a product's technical summary ─────────────────────────────────────── */

/** HITEC® O-Ring DW EPDM 70.503-00: its page's "Technische Zusammenfassung" (approvals left out - they stay on its page). */
const DW_SPECS = [
  ["Merkmal", "Wert"],
  ["Werkstoff", "EPDM"],
  ["Mischungsbezeichnung Angst+Pfister", "DW EPDM 70.503-00"],
  ["Härte", "70 ±5 Shore A"],
  ["Einsatztemperaturbereich", "von -57 bis +150 °C"],
  ["Farbe", "schwarz"],
  ["Medienbeständigkeit", "gegen Heisswasser und Dampf, viele organische und anorganische Säuren und Laugen"],
  ["Vernetzungsart", "Peroxid"],
  ["Norm", "in Anlehnung an Norm ISO 3601"],
];

const techSpecs = def({
  id: "tech-specs", category: "technical", name: "Technical summary",
  note: "A product's facts as its own page lists them - material, hardness, temperature range - beside its photo",
  layouts: [{ key: "side", label: "Photo beside" }, { key: "plain", label: "Table only, two columns" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", label: "The product's name" }, { kind: "text", label: "One line about it", rows: 2 }, { kind: "feature", label: "The product (its photo)" },
    { kind: "table", label: "Its facts (the first row names the columns)", cols: 2, maxRows: 14 }, { kind: "link" }],
  tags: ["specifications", "datasheet", "table", "properties", "product facts"],
  defaults: (store) => isGerman(store) ? {
    eyebrow: "Technische Zusammenfassung", title: "HITEC® O-Ring DW EPDM 70.503-00",
    text: "Zuverlässige EPDM-Dichtung für Wasser, Dampf, Witterung und langfristige industrielle Nutzung.",
    feature: cardFor(store, PRODUCTS[5]), table: DW_SPECS, link: { label: "Zum Produkt", url: pathFor(store, PRODUCTS[5].url) },
  } : { feature: { ...PRODUCTS[5], url: catUrl(store, PRODUCTS[5].url, PRODUCTS[5].number) } },
  gap: (s) => needGap(s, { title: true, table: 2 }),
  draw: (s, o) => {
    const rows = rowsOf(s);
    const head = rows[0] ?? [];
    const body = rows.slice(1).slice(0, 14);
    const plain = s.layout === "plain";
    const tbl = body.length
      ? `<table class="am-sp"><thead><tr><th>${esc(head[0] ?? "")}</th><th>${esc(head[1] ?? "")}</th></tr></thead><tbody>${body.map((r) => `<tr><th scope="row">${esc(r[0] ?? "")}</th><td>${esc(r[1] ?? "")}</td></tr>`).join("")}</tbody></table>`
      : ph("Add its facts: a row for each (what, value) - from the product's own page");
    const pic = plain ? "" : s.feature?.img ? `<a class="am-sp-p" href="${link(s.feature.url)}">${cardImg(s.feature, o, false)}</a>` : ph("Pick the product", "am-sp-p");
    return {
      html: `<div class="am-sw${plain ? " is-plain" : ""}">${pic}<div class="am-sp-t">${eyOf(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ""}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}${tbl}${textLink(s.link, "am-sp-l")}</div></div>`,
      css: `
@@ .am-sw{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:44px;align-items:start;padding:28px;border-radius:28px;background:linear-gradient(#f6f8f9,#edf1f3)}
@@ .am-sw.is-plain{grid-template-columns:minmax(0,1fr);padding:28px 32px}
@@ .am-sp-p{position:sticky;top:24px;display:block;aspect-ratio:1/1;border-radius:22px;background:#fff;box-shadow:var(--card);overflow:hidden}
@@ .am-sp-p img{position:absolute;inset:9%;width:82%;height:82%;object-fit:contain;mix-blend-mode:multiply;filter:brightness(1.05) contrast(1.07);transition:transform .5s}
@@ .am-sp-p:hover img{transform:scale(1.04)}
@@ .am-sp{margin-top:20px!important;border-radius:18px;background:#fff;box-shadow:var(--card);overflow:hidden}
@@ .am-sp thead th{padding:12px 20px;background:var(--pet);font:600 12px/1.2 var(--head);letter-spacing:.12em;text-transform:uppercase;color:#cddbe3}
@@ .am-sp tbody th,@@ .am-sp tbody td{padding:13px 20px;border-top:1px solid #edf0f2;font-size:15px;line-height:1.45}
@@ .am-sp tbody th{width:42%;overflow-wrap:anywhere;font:600 14.5px/1.4 var(--head);color:var(--mute)}
@@ .am-sp tbody td{font:500 16px/1.4 var(--head);color:var(--ink)}
@@ .am-sp tbody tr:nth-child(even){background:#fafbfc}
@@ .am-sp tbody tr:hover{background:#fdf0ef}
@@ .am-sw.is-plain .am-sp tbody{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:0}
@@ .am-sw.is-plain .am-sp tbody tr{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);border-top:1px solid #edf0f2}
@@ .am-sw.is-plain .am-sp tbody tr:nth-child(odd){border-right:1px solid #edf0f2}
@@ .am-sw.is-plain .am-sp tbody tr:nth-child(even){background:none}
@@ .am-sw.is-plain .am-sp tbody :is(th,td){border:0;width:auto}
@@ .am-sw.is-plain .am-sp thead{display:none}
@@ .am-sp-l{margin-top:18px}
@media (max-width:900px){
@@ .am-sw{grid-template-columns:minmax(0,1fr);gap:18px;padding:16px;border-radius:20px}
@@ .am-sw.is-plain{padding:18px 16px}
@@ .am-sp-p{position:relative;top:0;max-width:300px;width:100%;justify-self:center}
@@ .am-sp tbody th,@@ .am-sp tbody td{padding:11px 14px;font-size:14.5px}
@@ .am-sp tbody td{font-size:15px}
@@ .am-sw.is-plain .am-sp tbody{grid-template-columns:minmax(0,1fr)}
@@ .am-sw.is-plain .am-sp tbody tr:nth-child(odd){border-right:0}
}`,
    };
  },
});

/* ── materials side by side ────────────────────────────────────────────── */

const COMPARE = ["NBR", "FKM", "EPDM", "VMQ", "FFKM"];
const compareTable = () => {
  const ms = COMPARE.map((k) => MATS.find((m) => m.key === k)!);
  return [
    ["", ...COMPARE],
    ["Wichtigste Eigenschaften", ...ms.map((m) => m.props.join(", "))],
    ["Anforderungen", ...ms.map((m) => m.needs.join(", "))],
    ["Typische Anwendungen", ...ms.map((m) => m.apps.join(", "))],
    ["Zu prüfende Alternative", ...ms.map((m) => m.alt.join("; "))],
  ];
};

const techCompare = def({
  id: "tech-compare", category: "technical", name: "Materials side by side",
  note: "A comparison table: the materials across, what matters down - each column opens its range on the shop",
  layouts: [{ key: "table", label: "Table" }, { key: "cards", label: "A card per material" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "table", label: "The comparison (the first row: the materials)", cols: 6, maxRows: 10 },
    { kind: "text", label: "The note under it", rows: 3 }, { kind: "points", label: "Each column's page (in the same order)", max: 7, item: { title: "Its words", text: "" }, links: true }],
  tags: ["comparison", "materials", "matrix", "table", "versus"],
  defaults: (store) => isGerman(store) ? {
    eyebrow: "Werkstoffübersicht", title: "O-Ring-Werkstoffe im Vergleich", table: compareTable(), text: MAT_NOTE,
    points: COMPARE.map((k) => ({ title: ORING[k].name, text: "", icon: "ring", url: ORING[k].url })),
  } : { points: COMPARE.map((k) => ({ title: k, text: "", icon: "ring", url: catUrl(store, ORING[k].url, `O-Ring ${k}`) })) },
  gap: (s) => needGap(s, { table: 2 }),
  draw: (s) => {
    const rows = rowsOf(s).slice(0, 10);
    const head = rows[0] ?? [];
    const cols = Math.max(0, Math.min(6, Math.max(...rows.map((r) => r.length), 0) - 1));
    const go = (i: number) => s.points[i]?.url;
    if (!rows.length || cols < 1) return { html: `${header(s, false)}${ph("Fill the comparison: the first row names the columns, each next row one property")}`, css: "" };
    const note = s.text.trim() ? `<p class="am-cmp-n">${esc(s.text.trim())}</p>` : "";
    const hd = `${eyOf(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ""}`;
    if (s.layout === "cards") {
      const cards = Array.from({ length: cols }, (_, c) => {
        const name = head[c + 1] ?? "";
        const u = go(c);
        return `<article class="am-mc"><header>${u ? `<a href="${link(u)}">${esc(name)}</a>` : `<span>${esc(name)}</span>`}</header><dl>${rows.slice(1).map((r) => `<dt>${esc(r[0] ?? "")}</dt><dd>${esc(r[c + 1] ?? "")}</dd>`).join("")}</dl>${u ? `<a class="am-lk" href="${link(u)}">${esc(s.points[c]?.title?.trim() || name)}</a>` : ""}</article>`;
      }).join("");
      return {
        html: `<div class="am-hd"><div>${hd}</div></div><div class="am-mcs" style="--n:${cols}">${cards}</div>${note}`,
        css: `
@@ .am-mcs{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:12px}
@@ .am-mc{display:flex;flex-direction:column;min-width:0;padding:0 0 16px;border-radius:20px;background:#fff;box-shadow:var(--card);overflow:hidden}
@@ .am-mc header{padding:18px 18px 16px;background:linear-gradient(135deg,#2f5d76,#1b3a4b)}
@@ .am-mc header :is(a,span){font:600 26px/1 var(--head);letter-spacing:-.01em;color:#fff!important}
@@ .am-mc dl{display:grid;gap:0;padding:6px 18px 0!important}
@@ .am-mc dt{margin-top:14px!important;font:600 11px/1.2 var(--head);letter-spacing:.1em;text-transform:uppercase;color:var(--red)}
@@ .am-mc dd{margin-top:4px!important;font-size:14px;line-height:1.45;color:var(--ink)}
@@ .am-mc .am-lk{margin:auto 18px 0;padding-top:14px;font-size:14px}
@@ .am-cmp-n{margin-top:16px!important;max-width:880px;font-size:13.5px;line-height:1.55;color:var(--mute)}
@media (max-width:1100px) and (min-width:901px){@@ .am-mcs{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:900px){@@ .am-mcs{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px;padding:2px 2px 12px;margin:0 -2px}@@ .am-mc{flex:0 0 78%;scroll-snap-align:start}}`,
      };
    }
    const th = head.slice(1, cols + 1).map((h, i) => `<th scope="col">${go(i) ? `<a href="${link(go(i)!)}">${esc(h)}</a>` : esc(h)}</th>`).join("");
    const trs = rows.slice(1).map((r) => `<tr><th scope="row">${esc(r[0] ?? "")}</th>${Array.from({ length: cols }, (_, i) => `<td>${esc(r[i + 1] ?? "")}</td>`).join("")}</tr>`).join("");
    return {
      html: `<div class="am-hd"><div>${hd}</div></div><div class="am-cmp"><table><thead><tr><th>${esc(head[0] ?? "")}</th>${th}</tr></thead><tbody>${trs}</tbody></table></div>${note}`,
      css: `
@@ .am-cmp{border-radius:22px;background:#fff;box-shadow:var(--card);overflow-x:auto;scrollbar-width:thin}
@@ .am-cmp table{min-width:${180 + cols * 150}px;table-layout:fixed}
@@ .am-cmp thead th{position:relative;padding:16px 16px 14px;background:var(--pet);font:600 20px/1.1 var(--head);color:#fff;vertical-align:bottom}
@@ .am-cmp thead th:first-child{width:200px;background:var(--pet-d)}
@@ .am-cmp thead a{display:inline-flex;align-items:center;gap:8px;color:#fff!important}
@@ .am-cmp thead a::after{content:"";width:6px;height:6px;border:solid #fff;border-width:1.6px 1.6px 0 0;transform:rotate(45deg);opacity:.6;transition:transform .2s,opacity .2s}
@@ .am-cmp thead a:hover::after{opacity:1;transform:translateX(3px) rotate(45deg)}
@@ .am-cmp tbody th{position:sticky;left:0;z-index:1;padding:14px 16px;background:#f6f8f9;font:600 13.5px/1.35 var(--head);color:var(--ink);border-top:1px solid #e8ecee}
@@ .am-cmp tbody td{overflow-wrap:anywhere;padding:14px 16px;border-top:1px solid #edf0f2;border-left:1px solid #f1f3f5;font-size:14px;line-height:1.5;color:var(--txt)}
@@ .am-cmp tbody tr:hover td{background:#fbfcfc;color:var(--ink)}
@@ .am-cmp-n{margin-top:14px!important;max-width:880px;font-size:13.5px;line-height:1.55;color:var(--mute)}
@media (max-width:900px){@@ .am-cmp{border-radius:16px}@@ .am-cmp table{min-width:${130 + cols * 140}px}@@ .am-cmp thead th:first-child{width:130px}@@ .am-cmp tbody th{padding:12px}@@ .am-cmp thead th{font-size:17px}}`,
    };
  },
});

/* ── how to choose ─────────────────────────────────────────────────────── */

const techGuide = def({
  id: "tech-guide", category: "technical", name: "How to choose",
  note: "The steps to the right choice, numbered, beside the short answer - from the shop's selection guides",
  layouts: [{ key: "side", label: "Steps and the short answer beside" }, { key: "flow", label: "Steps across, the answer below" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "points", label: "The steps", min: 2, max: 6, item: { title: "The step", text: "What to check" } },
    { kind: "table", label: "The short answer (each row: the material, what it suits)", cols: 2, maxRows: 8 }, { kind: "link" }],
  tags: ["guide", "selection", "how to", "steps", "advice"],
  defaults: (store) => isGerman(store) ? {
    eyebrow: "Leitfaden zur Auswahl", title: "So wählen Sie den richtigen O-Ring",
    text: "Beginnen Sie mit der wichtigsten Betriebsbedingung und prüfen Sie anschliessend die übrigen Punkte, bevor Sie die endgültige Produktvariante auswählen.",
    points: [
      { title: "Betriebstemperatur", text: "Die erwartete minimale und maximale Temperatur mit dem compoundspezifischen Bereich vergleichen.", icon: "flame" },
      { title: "Medium und Konzentration", text: "Medium, Konzentration, Betriebstemperatur und Einwirkdauer prüfen.", icon: "flask" },
      { title: "Statische oder dynamische Bewegung", text: "Bei dynamischen Dichtungen kommen Reibung, Schmierung, Oberflächenqualität und Verschleiss hinzu.", icon: "gear" },
      { title: "Abmessungen, Nut und Einbauraum", text: "Innendurchmesser, Schnurstärke und anwendbare Normen nutzen, um den passenden O-Ring zu finden.", icon: "ruler" },
      { title: "Zulassungen und Dokumentation", text: "Prüfen Sie den konkreten Artikel, den Compound und die erforderliche Dokumentation.", icon: "doc" },
    ],
    table: [["Werkstoff", "Kurzantwort"], ...MATS.slice(0, 5).map((m) => [m.key, m.short])],
    link: { label: "Zur O-Ring Auswahlhilfe", url: pathFor(store, LINKS.oringGuide) },
  } : { link: { label: "", url: pathFor(store, LINKS.oringGuide) } },
  gap: (s) => needGap(s, { title: true, points: 2 }),
  draw: (s) => {
    const steps = s.points.filter((p) => p.title.trim()).slice(0, 6);
    const ans = rowsOf(s).slice(1, 9);
    const head = rowsOf(s)[0] ?? [];
    const flow = s.layout === "flow";
    const st = steps.length ? `<ol class="am-gs" style="--n:${steps.length}">${steps.map((p, i) => `<li><span class="am-gs-n">${i + 1}</span><div><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<p>${esc(p.text.trim())}</p>` : ""}</div></li>`).join("")}</ol>` : ph("Write the steps: what to check, in order");
    const box = ans.length ? `<aside class="am-ga"><p class="am-ga-k">${esc(head[1] || head[0] || "")}</p><ul>${ans.map((r) => `<li><b>${esc(r[0] ?? "")}</b><span>${esc(r[1] ?? "")}</span></li>`).join("")}</ul>${textLink(s.link)}</aside>` : textLink(s.link);
    return {
      html: `${header(s, false)}<div class="am-gd${flow ? " is-flow" : ""}">${st}${box}</div>`,
      css: `
@@ .am-gd{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:28px;align-items:start}
@@ .am-gs{display:grid;gap:0;counter-reset:s}
@@ .am-gs li{position:relative;display:grid;grid-template-columns:52px minmax(0,1fr);gap:16px;padding:0 0 22px}
@@ .am-gs li:not(:last-child)::before{content:"";position:absolute;left:25px;top:50px;bottom:4px;width:2px;background:linear-gradient(#e5e9ec,#e5e9ec) center/2px 100% no-repeat}
@@ .am-gs-n{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 2px var(--red);font:600 20px/1 var(--head);color:var(--red)}
@@ .am-gs li:first-child .am-gs-n{background:var(--red);color:#fff}
@@ .am-gs b{display:block;padding-top:4px;font:600 19px/1.25 var(--head);color:var(--ink)}
@@ .am-gs p{margin-top:5px!important;font-size:15px;line-height:1.55;color:var(--txt)}
@@ .am-ga{position:sticky;top:24px;padding:24px 24px 22px;border-radius:24px;background:linear-gradient(150deg,#2f5d76,#1b3a4b);color:#e3ecf1}
@@ .am-ga-k{margin-bottom:12px!important;font:600 12px/1.2 var(--head);letter-spacing:.14em;text-transform:uppercase;color:#9fb8c6}
@@ .am-ga ul{display:grid;gap:12px}
@@ .am-ga li{display:grid;grid-template-columns:62px minmax(0,1fr);gap:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.14)}
@@ .am-ga li:first-child{padding-top:0;border:0}
@@ .am-ga li b{font:600 17px/1.3 var(--head);color:#fff}
@@ .am-ga li span{font-size:14px;line-height:1.5}
@@ .am-ga .am-lk{margin-top:18px;color:#fff!important}
@@ .am-gd.is-flow{grid-template-columns:minmax(0,1fr)}
@@ .am-gd.is-flow .am-gs{grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:14px}
@@ .am-gd.is-flow .am-gs li{grid-template-columns:minmax(0,1fr);align-content:start;gap:12px;padding:20px 18px;border-radius:20px;background:#fff;box-shadow:var(--card)}
@@ .am-gd.is-flow .am-gs li::before{display:none}
@@ .am-gd.is-flow .am-gs-n{width:44px;height:44px;font-size:18px}
@@ .am-gd.is-flow .am-ga{position:static}
@@ .am-gd.is-flow .am-ga ul{grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px 32px}
@@ .am-gd.is-flow .am-ga li{padding-top:12px;border-top:1px solid rgba(255,255,255,.14)}
@media (max-width:1100px) and (min-width:901px){@@ .am-gd.is-flow .am-gs{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:900px){
@@ .am-gd{grid-template-columns:minmax(0,1fr);gap:14px}
@@ .am-gd.is-flow .am-gs{grid-template-columns:minmax(0,1fr);gap:10px}
@@ .am-gd.is-flow .am-gs li{grid-template-columns:44px minmax(0,1fr);padding:14px}
@@ .am-gs li{grid-template-columns:44px minmax(0,1fr);gap:12px}
@@ .am-gs-n{width:44px;height:44px;font-size:17px}
@@ .am-gs li:not(:last-child)::before{left:21px;top:46px}
@@ .am-ga{position:static;padding:18px}
@@ .am-gs b{font-size:17px}
}`,
    };
  },
});

/* ── which material for which condition ────────────────────────────────── */

const PICKS: [string, string, string, string][] = [
  ["Öle, Kraftstoffe oder Hydraulik", "NBR", "NBR", "drop"],
  ["Hohe Temperaturen", "FKM", "FKM", "flame"],
  ["Wasser, Dampf, Witterung oder Ozon", "EPDM", "EPDM", "water"],
  ["Höhere Wärme und mechanische Belastung", "HNBR", "HNBR", "gear"],
  ["Sehr tiefe Temperaturen, Lebensmittelanwendungen", "VMQ", "VMQ", "snow"],
  ["Extreme chemische und thermische Bedingungen", "FFKM", "FFKM", "flask"],
];

const techPick = def({
  id: "tech-pick", category: "technical", name: "Which one for what",
  note: "The condition on the left, the material that suits it on the right - each opens its range",
  layouts: [{ key: "rows", label: "Rows" }, { key: "tiles", label: "Tiles" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "points", label: "The pairs", min: 2, max: 8, item: { title: "The condition", text: "What suits it" }, icons: true, links: true }, { kind: "link" }],
  tags: ["selector", "decision", "material", "if then", "chooser"],
  defaults: (store) => isGerman(store) ? {
    eyebrow: "Schnellauswahl", title: "Welcher Werkstoff für welche Bedingung?",
    text: "Starten Sie mit der wichtigsten Betriebsbedingung - eine Vorauswahl, keine endgültige Produktfreigabe.",
    points: PICKS.map(([t, x, k, ic]) => ({ title: t, text: x, icon: ic, url: ORING[k].url })),
    link: { label: "Zur O-Ring Auswahlhilfe", url: pathFor(store, LINKS.oringGuide) },
  } : { points: PICKS.map(([, x, k, ic]) => ({ title: "", text: x, icon: ic, url: catUrl(store, ORING[k].url, `O-Ring ${k}`) })), link: { label: "", url: pathFor(store, LINKS.oringGuide) } },
  gap: (s) => needGap(s, { points: 2 }),
  draw: (s) => {
    const pts = s.points.filter((p) => p.title.trim()).slice(0, 8);
    const tiles = s.layout === "tiles";
    const list = pts.map((p) => `<a class="am-pk" href="${link(p.url ?? "")}"><span class="am-pk-i">${icon(p.icon)}</span><span class="am-pk-c">${esc(p.title.trim())}</span><span class="am-pk-a" aria-hidden="true"></span><b class="am-pk-m">${esc(p.text.trim())}</b></a>`).join("");
    return {
      html: `${header(s)}<div class="am-pks${tiles ? " is-tiles" : ""}">${list || ph("Write the pairs: a condition and what suits it")}</div>`,
      css: `
@@ .am-pks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px}
@@ .am-pk{display:grid;grid-template-columns:44px minmax(0,1fr) 40px auto;align-items:center;gap:14px;min-height:72px;padding:12px 18px 12px 14px;border-radius:16px;background:#fff;box-shadow:var(--card);color:var(--ink)!important;transition:box-shadow .2s,transform .2s}
@@ .am-pk:hover,@@ .am-pk:focus-visible{transform:translateY(-1px);box-shadow:0 16px 30px -20px rgba(27,58,75,.5),inset 0 0 0 1.5px var(--red)}
@@ .am-pk-i{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:var(--soft);color:var(--pet)}
@@ .am-pk-c{font:500 15.5px/1.3 var(--head);color:var(--ink)}
@@ .am-pk-a{height:2px;background:linear-gradient(90deg,#d5dce0,#d5dce0) left center/calc(100% - 8px) 2px no-repeat;position:relative}
@@ .am-pk-a::after{content:"";position:absolute;right:1px;top:-4px;width:8px;height:8px;border:solid #c3ccd2;border-width:2px 2px 0 0;transform:rotate(45deg);transition:border-color .2s}
@@ .am-pk:hover .am-pk-a{background-image:linear-gradient(90deg,var(--red),var(--red))}
@@ .am-pk:hover .am-pk-a::after{border-color:var(--red)}
@@ .am-pk-m{min-width:64px;padding:8px 12px;border-radius:10px;background:var(--pet);font:600 17px/1 var(--head);color:#fff;text-align:center}
@@ .am-pks.is-tiles{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
@@ .am-pks.is-tiles .am-pk{grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto 1fr;gap:16px 10px;min-height:150px;padding:20px;align-items:start}
@@ .am-pks.is-tiles .am-pk-i{grid-column:1}
@@ .am-pks.is-tiles .am-pk-m{grid-column:2;grid-row:1;min-width:0;font-size:22px;padding:10px 14px}
@@ .am-pks.is-tiles .am-pk-c{grid-column:1/-1;align-self:end;font-size:17px}
@@ .am-pks.is-tiles .am-pk-a{display:none}
@media (max-width:900px){
@@ .am-pks,@@ .am-pks.is-tiles{grid-template-columns:minmax(0,1fr);gap:8px}
@@ .am-pk{grid-template-columns:38px minmax(0,1fr) auto;gap:10px;padding:10px 12px}
@@ .am-pk-i{width:38px;height:38px}
@@ .am-pk-a{display:none}
@@ .am-pk-m{min-width:56px;font-size:15px}
@@ .am-pks.is-tiles .am-pk{min-height:0;grid-template-columns:38px minmax(0,1fr) auto;grid-template-rows:auto;align-items:center}
@@ .am-pks.is-tiles .am-pk-c{grid-column:2;grid-row:1;align-self:center;font-size:15.5px}
@@ .am-pks.is-tiles .am-pk-m{grid-column:3;font-size:16px;padding:8px 12px}
}`,
    };
  },
});

/* ── the parameters to check ───────────────────────────────────────────── */

const techParams = def({
  id: "tech-params", category: "technical", name: "Parameters at a glance",
  note: "What to check before choosing, each with its icon - tiles, or a calm list",
  layouts: [{ key: "tiles", label: "Tiles" }, { key: "list", label: "List" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "points", label: "The parameters", min: 2, max: 6, item: { title: "The parameter", text: "What to check" }, icons: true }, { kind: "link" }],
  tags: ["parameters", "technical", "checklist", "properties"],
  defaults: (store) => isGerman(store) ? {
    eyebrow: "Technische Parameter", title: "Technische Parameter auf einen Blick",
    text: "Die Werkstoffbezeichnung allein garantiert keine bestimmte Leistung. Nutzen Sie die Produktdaten und Einbaubedingungen, um den richtigen O-Ring zu validieren.",
    points: [
      { title: "Temperaturbereich", text: "VMQ eignet sich häufig für sehr niedrige Temperaturen, EPDM überzeugt bei Wasser und Dampf, FKM/FFKM für höhere Temperaturen.", icon: "flame" },
      { title: "Shore-Härte", text: "Beeinflusst Extrusionsbeständigkeit, Verpressungsverhalten und Montage - zusammen mit Druck und Nutgeometrie wählen.", icon: "ruler" },
      { title: "Chemische Beständigkeit", text: "EPDM ist nicht für Öle und Kraftstoffe geeignet; FKM, FFKM, PTFE oder FEP-ummantelte Optionen bei stärkerer chemischer Belastung.", icon: "flask" },
      { title: "Druckbeständigkeit", text: "Hängt von Werkstoff, Härte, Spaltmass, Bewegung, Nutgestaltung und möglichen Stützringen ab.", icon: "gear" },
    ],
    link: { label: "Chemische Beständigkeitstabelle", url: pathFor(store, LINKS.compat) },
  } : { link: { label: "", url: pathFor(store, LINKS.compat) } },
  gap: (s) => needGap(s, { points: 2 }),
  draw: (s) => {
    const pts = s.points.filter((p) => p.title.trim()).slice(0, 6);
    const list = s.layout === "list";
    return {
      html: `${header(s)}<ul class="am-pm${list ? " is-list" : ""}" style="--n:${Math.min(4, Math.max(1, pts.length))}">${pts.map((p) => `<li><span class="am-pm-i">${icon(p.icon, 26)}</span><div><b>${esc(p.title.trim())}</b><p>${esc(p.text.trim())}</p></div></li>`).join("") || `<li class="am-pm-e">${ph("Write the parameters: a name and what to check")}</li>`}</ul>`,
      css: `
@@ .am-pm{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:14px}
@@ .am-pm>li{display:flex;flex-direction:column;gap:18px;padding:24px 22px 24px;border-radius:22px;background:linear-gradient(#f6f8f9,#edf1f3)}
@@ .am-pm-i{display:grid;place-items:center;width:56px;height:56px;border-radius:16px;background:#fff;color:var(--red);box-shadow:0 10px 24px -16px rgba(27,58,75,.5)}
@@ .am-pm b{display:block;font:600 19px/1.25 var(--head);color:var(--ink)}
@@ .am-pm p{margin-top:8px!important;font-size:14.5px;line-height:1.55;color:var(--txt)}
@@ .am-pm.is-list{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 48px}
@@ .am-pm.is-list>li{flex-direction:row;gap:18px;padding:20px 0;border-radius:0;background:none;border-top:1px solid var(--line)}
@@ .am-pm.is-list .am-pm-i{flex:none;width:48px;height:48px;border-radius:50%;background:#fdf0ef;box-shadow:none}
@@ .am-pm-e{grid-column:1/-1;padding:0!important;background:none!important}
@media (max-width:1100px) and (min-width:901px){@@ .am-pm{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:900px){
@@ .am-pm,@@ .am-pm.is-list{grid-template-columns:minmax(0,1fr);gap:10px}
@@ .am-pm>li{flex-direction:row;gap:14px;padding:16px}
@@ .am-pm-i{flex:none;width:46px;height:46px;border-radius:14px}
@@ .am-pm.is-list>li{padding:14px 0}
@@ .am-pm b{font-size:17px}
}`,
    };
  },
});

/* ── side by side: A against B ─────────────────────────────────────────── */

const techVersus = def({
  id: "tech-versus", category: "technical", name: "Side by side",
  note: "Two options face to face - what counts for each - with \"vs\" between them",
  layouts: [{ key: "cards", label: "Two cards" }, { key: "split", label: "One panel, split" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 3 }, { kind: "faq", label: "The two sides (its name, then a line per point)", max: 2 }, { kind: "link" }],
  tags: ["versus", "compare", "two options", "difference"],
  defaults: (store) => isGerman(store) ? {
    eyebrow: "Statisch vs. dynamisch", title: "Dichtung auf die ==Bewegung== abstimmen",
    text: "Bei dynamischen Anwendungen ist die Dichtungsauslegung vor der Auswahl der endgültigen Produktvariante detaillierter zu prüfen.",
    faq: [
      { q: "Statische Abdichtung", a: "- Verpressung\n- Nutgestaltung\n- Einbaubedingungen\n- Langfristige Medienverträglichkeit" },
      { q: "Dynamische Abdichtung", a: "- Reibung und Schmierung\n- Oberflächenqualität\n- Spaltmass\n- Druckgrenzen\n- Verschleiss" },
    ],
    link: { label: "Zur O-Ring Auswahlhilfe", url: pathFor(store, LINKS.oringGuide) },
  } : { link: { label: "", url: pathFor(store, LINKS.oringGuide) } },
  gap: (s) => needGap(s, { faq: 1 }),
  draw: (s) => {
    const w = w2(s.store);
    const sides = s.faq.filter((x) => x.q.trim() || x.a.trim()).slice(0, 2);
    const side = (x: { q: string; a: string } | undefined, i: number) => x
      ? `<div class="am-vs-s${i ? " is-b" : ""}"><h3>${esc(x.q.trim())}</h3><ul>${linesOf(x.a).map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>`
      : ph(i ? "Write the second side" : "Write the first side", "am-vs-s");
    const split = s.layout === "split";
    return {
      html: `${header(s)}<div class="am-vs${split ? " is-split" : ""}">${side(sides[0], 0)}<span class="am-vs-x" aria-hidden="true">${esc(w.vs)}</span>${side(sides[1], 1)}</div>`,
      css: `
@@ .am-vs{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 0 minmax(0,1fr);gap:0 20px;align-items:stretch}
@@ .am-vs-s{padding:28px 30px 30px;border-radius:24px;background:#fff;box-shadow:var(--card)}
@@ .am-vs-s h3{display:flex;align-items:center;gap:12px;margin-bottom:16px!important;font-size:24px!important}
@@ .am-vs-s h3::before{content:"";width:12px;height:12px;border-radius:3px;background:var(--pet)}
@@ .am-vs-s.is-b h3::before{background:var(--red)}
@@ .am-vs-s ul{display:grid;gap:0}
@@ .am-vs-s li{display:flex;gap:12px;align-items:center;padding:12px 0;border-top:1px solid #eef1f3;font:500 16px/1.35 var(--head);color:var(--ink)}
@@ .am-vs-s li::before{content:"";flex:none;width:18px;height:18px;border-radius:50%;background:#e7eef2 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23274e64' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 12.5 4 4 8-9'/%3E%3C/svg%3E") center/11px no-repeat}
@@ .am-vs-s.is-b li::before{background-color:#fdf0ef;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23d80901' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 12.5 4 4 8-9'/%3E%3C/svg%3E")}
@@ .am-vs-x{position:relative;z-index:1;align-self:center;justify-self:center;display:grid;place-items:center;width:56px;height:56px;margin:0 -28px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 8px #fff;font:600 17px/1 var(--head);color:#fff;text-transform:uppercase}
@@ .am-vs.is-split{gap:0;padding:0;border-radius:26px;background:linear-gradient(#f6f8f9,#edf1f3);overflow:hidden}
@@ .am-vs.is-split .am-vs-s{border-radius:0;background:none;box-shadow:none;padding:32px 40px}
@@ .am-vs.is-split .am-vs-s.is-b{background:#fff}
@@ .am-vs.is-split .am-vs-x{box-shadow:0 0 0 8px #f3f6f7}
@media (max-width:900px){
@@ .am-vs,@@ .am-vs.is-split{grid-template-columns:minmax(0,1fr);grid-template-rows:auto 0 auto;gap:0}
@@ .am-vs-s,@@ .am-vs.is-split .am-vs-s{padding:20px 18px}
@@ .am-vs-x{margin:-24px 0;width:48px;height:48px}
@@ .am-vs-s h3{font-size:20px!important}
}`,
    };
  },
});

/* ── norms and documents ───────────────────────────────────────────────── */

const techStandards = def({
  id: "tech-standards", category: "technical", name: "Norms and documents",
  note: "The norms that matter, set as badges with what they cover - and where the documents are",
  layouts: [{ key: "badges", label: "Badges" }, { key: "rows", label: "Rows" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 3 }, { kind: "points", label: "The norms", min: 1, max: 6, item: { title: "The norm", text: "What it covers" }, links: true }, { kind: "link" }],
  tags: ["norms", "standards", "ISO", "documentation"],
  defaults: (store) => isGerman(store) ? {
    eyebrow: "Normen & Dokumentation", title: "Normen, Abmessungen und Qualitätssicherung",
    text: "Nutzen Sie anerkannte Normen, um Abmessungen zu vergleichen und die Beschaffung für Ersatz-, Instandhaltungs- und Neuanwendungen zu vereinfachen.",
    points: [
      { title: "ISO 3601", text: "Wird häufig für O-Ring-Abmessungen, Toleranzen, Einbauräume, Qualitätsannahmekriterien, Stützringe und Werkstoffeignung verwendet.", icon: "ruler" },
      { title: "AS568", text: "Wird häufig für O-Ringe in Zollabmessungen eingesetzt.", icon: "ruler" },
      { title: "Datenblatt", text: "Das compoundspezifische Datenblatt bestätigt die technische Eignung vor der Freigabe für anspruchsvolle Anwendungen.", icon: "doc", url: pathFor(store, LINKS.downloads) },
    ],
    link: { label: "Technische Downloads öffnen", url: pathFor(store, LINKS.downloads) },
  } : { link: { label: "", url: pathFor(store, LINKS.downloads) } },
  gap: (s) => needGap(s, { points: 1 }),
  draw: (s) => {
    const pts = s.points.filter((p) => p.title.trim()).slice(0, 6);
    const rows = s.layout === "rows";
    const one = (p: (typeof pts)[number]) => {
      const inner = `<span class="am-ns-b">${esc(p.title.trim())}</span><p>${esc(p.text.trim())}</p>`;
      return p.url ? `<a class="am-ns-c is-link" href="${link(p.url)}">${inner}</a>` : `<div class="am-ns-c">${inner}</div>`;
    };
    return {
      html: `${header(s)}<div class="am-ns${rows ? " is-rows" : ""}">${pts.map(one).join("") || ph("Write the norms: the name and what it covers")}</div>`,
      css: `
@@ .am-ns{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
@@ .am-ns-c{display:flex;flex-direction:column;gap:14px;padding:24px;border-radius:22px;background:#fff;box-shadow:var(--card);color:var(--txt)!important}
@@ .am-ns-b{align-self:flex-start;padding:10px 16px 9px;border:2px solid var(--ink);border-radius:10px;font:600 22px/1 var(--head);letter-spacing:.02em;color:var(--ink)}
@@ .am-ns-c p{font-size:14.5px;line-height:1.55}
@@ .am-ns-c.is-link{transition:box-shadow .2s}
@@ .am-ns-c.is-link:hover{box-shadow:0 16px 30px -20px rgba(27,58,75,.5),inset 0 0 0 1.5px var(--red)}
@@ .am-ns-c.is-link .am-ns-b{border-color:var(--red);color:var(--red)}
@@ .am-ns.is-rows{grid-template-columns:minmax(0,1fr);gap:0;border-top:1px solid var(--line)}
@@ .am-ns.is-rows .am-ns-c{flex-direction:row;align-items:center;gap:28px;padding:18px 4px;border-radius:0;background:none;box-shadow:none;border-bottom:1px solid var(--line)}
@@ .am-ns.is-rows .am-ns-b{flex:none;min-width:150px;text-align:center}
@@ .am-ns.is-rows .am-ns-c p{font-size:15.5px}
@media (max-width:900px){
@@ .am-ns{grid-template-columns:minmax(0,1fr);gap:10px}
@@ .am-ns-c{padding:18px}
@@ .am-ns.is-rows .am-ns-c{flex-direction:column;align-items:flex-start;gap:10px}
@@ .am-ns.is-rows .am-ns-b{min-width:0}
}`,
    };
  },
});

/* ── a checklist before ordering ───────────────────────────────────────── */

const techChecklist = def({
  id: "tech-checklist", category: "technical", name: "Before you order",
  note: "What to have checked before the cart - in groups, each line with its tick",
  layouts: [{ key: "columns", label: "Groups side by side" }, { key: "single", label: "One numbered list" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "faq", label: "The groups (its name, then a line per point)", max: 3 }, { kind: "link" }],
  tags: ["checklist", "before ordering", "validation", "requirements"],
  defaults: (store) => isGerman(store) ? {
    eyebrow: "Vor der Bestellung", title: "Bestätigen Sie die technische Eignung",
    text: "Vergleichen Sie die tatsächlichen Anwendungsanforderungen, bevor Sie ein Produkt in den Warenkorb legen.",
    faq: [
      { q: "Geführte Auswahl", a: "- Betriebstemperatur\n- Medium und Konzentration\n- Statische oder dynamische Bewegung\n- Abmessungen, Nut und Einbauraum\n- Erforderliche Zulassungen, Dokumentation und benötigte Menge" },
      { q: "Technische Validierung", a: "- Druck und Extrusionsrisiko\n- Shore-Härte und Verpressung\n- Lebensdauer und Wartungsintervall\n- Normen, Abmessungen und Toleranzen\n- Compoundspezifisches Datenblatt" },
    ],
    link: { label: "Technische Downloads öffnen", url: pathFor(store, LINKS.downloads) },
  } : { link: { label: "", url: pathFor(store, LINKS.downloads) } },
  gap: (s) => needGap(s, { faq: 1 }),
  draw: (s) => {
    const groups = s.faq.filter((x) => x.a.trim()).slice(0, 3);
    const single = s.layout === "single";
    let html: string;
    if (!groups.length) html = ph("Write the groups: a name and the points to check");
    else if (single) {
      const all = groups.flatMap((g) => linesOf(g.a).map((l) => ({ g: g.q.trim(), l })));
      html = `<ol class="am-cl1">${all.map((x, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span><b>${esc(pairOf(x.l).v || x.l)}</b>${i === 0 || all[i - 1].g !== x.g ? `<em>${esc(x.g)}</em>` : ""}</li>`).join("")}</ol>`;
    } else html = `<div class="am-cls" style="--n:${groups.length}">${groups.map((g) => `<div class="am-clg"><h3>${esc(g.q.trim())}</h3><ul>${linesOf(g.a).map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>`).join("")}</div>`;
    return {
      html: `<div class="am-ck">${header(s, false)}${html}${textLink(s.link, "am-ck-l")}</div>`,
      css: `
@@ .am-ck{padding:30px 32px 30px;border-radius:28px;background:linear-gradient(#f6f8f9,#edf1f3)}
@@ .am-cls{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:14px}
@@ .am-clg{padding:22px 24px 14px;border-radius:20px;background:#fff;box-shadow:var(--card)}
@@ .am-clg h3{margin-bottom:8px!important;font-size:18px!important}
@@ .am-clg li{position:relative;padding:11px 0 11px 34px;border-top:1px solid #eef1f3;font:500 15.5px/1.35 var(--head);color:var(--ink)}
@@ .am-clg li:first-child{border-top:0}
@@ .am-clg li::before{content:"";position:absolute;left:0;top:10px;width:22px;height:22px;border-radius:7px;background:var(--red) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 12.5 4 4 8-9'/%3E%3C/svg%3E") center/14px no-repeat}
@@ .am-cl1{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 28px;counter-reset:c}
@@ .am-cl1 li{display:grid;grid-template-columns:40px minmax(0,1fr);align-items:baseline;gap:4px 10px;padding:14px 0;border-top:1px solid #dfe5e8}
@@ .am-cl1 li span{font:600 15px/1 var(--head);color:var(--red)}
@@ .am-cl1 li b{font:500 16.5px/1.35 var(--head);color:var(--ink)}
@@ .am-cl1 li em{grid-column:2;grid-row:1;justify-self:end;font:600 10.5px/1.2 var(--head);font-style:normal;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);display:none}
@@ .am-ck-l{margin-top:18px}
@media (max-width:900px){
@@ .am-ck{padding:18px 14px;border-radius:20px}
@@ .am-cls,@@ .am-cl1{grid-template-columns:minmax(0,1fr);gap:10px}
@@ .am-cl1{gap:0}
@@ .am-clg{padding:16px 16px 8px}
}`,
    };
  },
});

export const TECHNICAL = [techSpecs, techCompare, techGuide, techPick, techParams, techVersus, techStandards, techChecklist];
