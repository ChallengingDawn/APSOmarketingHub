// PAGE - THE LIBRARY, PART 2: TOOLS & SERVICES (Content v7, 10.11.2026). Pure.
//
// The shop's real tools only, each linking to its real page: DirectCUT (cut to size), the O-Ring Expert, DirectUP (upload
// an order), the quick order, 3D CAD files, technical downloads, the chemical resistance table, the product finder,
// availability & logistics. Their words are the shop's own (the Tools & Services page, each tool's page, ./data.ts).

import { DOWNLOADS, LINKS, ORING, PICS } from "./data";
import { button, def, esc, eyOf, header, icon, img, isGerman, link, marked, needGap, pathFor, ph, prose, textLink, w2, type ModuleSettings } from "./kit";

type P = ModuleSettings["points"][number];
const tool = (store: string, title: string, text: string, ic: string, path: string, picture = ""): P =>
  ({ title: isGerman(store) ? title : "", text: isGerman(store) ? text : "", icon: ic, url: pathFor(store, path), ...(picture && isGerman(store) ? { img: picture } : {}) });

/* ── the tools as tiles ────────────────────────────────────────────────── */

const toolTiles = def({
  id: "tool-tiles", category: "tools", name: "Tools & services",
  note: "The shop's tools side by side - its icon, what it does, a click opens it",
  layouts: [{ key: "tiles", label: "Icon tiles" }, { key: "pictures", label: "The shop's tool pictures" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "points", label: "The tools", min: 1, max: 6, item: { title: "The tool", text: "What it does" }, icons: true, pictures: true, links: true }, { kind: "link" }],
  tags: ["tools", "services", "DirectCUT", "DirectUP", "O-Ring Expert", "quick order"],
  defaults: (store) => ({
    eyebrow: isGerman(store) ? "Tools & Services" : "", title: isGerman(store) ? "Auswählen, konfigurieren, ==bestellen==" : "",
    points: [
      tool(store, "DirectCUT Konfigurator", "Individuelle Zuschnitte von Kunststoff- und Dichtungskomponenten", "cut", LINKS.directcut, PICS.directcutTile),
      tool(store, "O-Ring Expert", "Finden Sie den besten O-Ring für Ihre statische oder dynamische Anwendung", "ring", LINKS.oringExpert, PICS.oringExpertTile),
      tool(store, "Schnellbestellung", "Laden Sie Ihre Bestellungen in jedem Format und mit wenigen Klicks hoch", "quick", LINKS.quickorder, PICS.quickorderTile),
      tool(store, "3D-CAD-Datei-Download", "Verfügbare 3D-CAD-Modelle anfragen", "cube", LINKS.cad),
    ],
    link: { label: isGerman(store) ? "Alle Tools & Services" : "", url: pathFor(store, LINKS.service) },
  }),
  gap: (s) => s.points.some((p) => p.title.trim() && p.url) ? "" : "Add a tool: its name and its page",
  draw: (s, o) => {
    const pics = s.layout === "pictures";
    const pts = s.points.filter((p) => p.title.trim() || p.img).slice(0, 6);
    const one = (p: P) => pics && p.img
      ? `<a class="am-tt is-pic" href="${link(p.url ?? "")}">${img(p.img, o, { alt: `${p.title} - ${p.text}` })}</a>`
      : `<a class="am-tt" href="${link(p.url ?? "")}"><span class="am-tt-i">${icon(p.icon, 26)}</span><b>${esc(p.title.trim())}</b><span class="am-tt-x">${esc(p.text.trim())}</span><span class="am-tt-a" aria-hidden="true">${icon("arrow", 20)}</span></a>`;
    return {
      html: `${header(s)}<div class="am-tts" style="--n:${Math.min(4, Math.max(1, pts.length))}">${pts.map(one).join("") || ph("Add the tools: a name, a line and the page each opens")}</div>`,
      css: `
@@ .am-tts{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:14px}
@@ .am-tt{position:relative;display:flex;flex-direction:column;gap:10px;min-height:230px;padding:24px 22px 22px;border-radius:22px;background:#e9edf0;color:var(--ink)!important;overflow:hidden;transition:background .25s,transform .25s}
@@ .am-tt-i{display:grid;place-items:center;width:58px;height:58px;margin-bottom:8px;border-radius:50%;background:#fff;color:var(--pet);transition:background .25s,color .25s}
@@ .am-tt b{font:600 21px/1.15 var(--head);color:var(--red)}
@@ .am-tt-x{font:400 15.5px/1.4 var(--head);color:var(--pet)}
@@ .am-tt-a{margin-top:auto;color:var(--pet);transition:transform .25s}
@@ .am-tt:hover,@@ .am-tt:focus-visible{background:var(--pet);transform:translateY(-2px)}
@@ .am-tt:hover :is(b,.am-tt-x,.am-tt-a){color:#fff}
@@ .am-tt:hover .am-tt-i{background:var(--red);color:#fff}
@@ .am-tt:hover .am-tt-a{transform:translateX(6px)}
@@ .am-tt.is-pic{padding:0;min-height:0;aspect-ratio:1/1;background:#e9ebed}
@@ .am-tt.is-pic img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .5s}
@@ .am-tt.is-pic:hover{background:#e9ebed}
@@ .am-tt.is-pic:hover img{transform:scale(1.035)}
@@ .am-tts>.am-ph{grid-column:1/-1}
@media (max-width:1100px) and (min-width:901px){@@ .am-tts{grid-template-columns:repeat(min(var(--n),3),minmax(0,1fr))}}
@media (max-width:900px){
@@ .am-tts{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@@ .am-tt{min-height:0;padding:16px 14px;gap:6px;border-radius:18px}
@@ .am-tt-i{width:44px;height:44px;margin-bottom:4px}
@@ .am-tt b{font-size:17px}
@@ .am-tt-x{font-size:14px}
@@ .am-tt-a{display:none}
}`,
    };
  },
});

/* ── one tool in depth ─────────────────────────────────────────────────── */

const toolSpotlight = def({
  id: "tool-spotlight", category: "tools", name: "Tool spotlight",
  note: "One tool in depth: its picture, what it does, how it works in four steps, the way in",
  layouts: [{ key: "right", label: "Picture right" }, { key: "left", label: "Picture left" }, { key: "stacked", label: "Steps across below" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 4 }, { kind: "feature", label: "The tool's picture" }, { kind: "points", label: "How it works", max: 5, item: { title: "The step", text: "What happens" } }, { kind: "link" }, { kind: "link2" }],
  tags: ["DirectCUT", "configurator", "tool", "how it works", "cut to size"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "DirectCUT Produktkonfigurator", title: "Individuell zugeschnittene ==technische Kunststoffe== und Dichtungswerkstoffe",
      text: "Lassen Sie ausgewählte Kunststoff- und Dichtungswerkstoffe exakt nach Ihren Abmessungen zuschneiden - vom Einzelstück bis zu grösseren Produktionsmengen.",
      points: [
        { title: "Produkt wählen", text: "Material und Dicke bzw. Durchmesser wählen, dann auf das Säge-Symbol neben dem Artikel klicken.", icon: "cut" },
        { title: "Abmessungen eingeben", text: "Gewünschte Länge, Breite und Menge eingeben.", icon: "ruler" },
        { title: "Preis und Verfügbarkeit prüfen", text: "Für das zugeschnittene Produkt sofort sichtbar, mit dem voraussichtlichen Liefertermin.", icon: "clock" },
        { title: "In den Warenkorb", text: "Nach der Bestätigung wird mit CNC-Schneidtechnologie nach den geltenden ISO-Toleranzen zugeschnitten.", icon: "cart" },
      ],
      link: { label: "Zu DirectCUT", url: pathFor(store, LINKS.directcut) },
      link2: { label: "Ein Konto erstellen", url: pathFor(store, LINKS.create) },
    } : { link: { label: "", url: pathFor(store, LINKS.directcut) } }),
    feature: { kind: "category", name: "DirectCUT", url: pathFor(store, LINKS.directcut), img: PICS.machine, meta: "", number: "", children: [] },
  }),
  gap: (s) => needGap(s, { title: true }),
  draw: (s, o) => {
    const lay = s.layout === "left" || s.layout === "stacked" ? s.layout : "right";
    const steps = s.points.filter((p) => p.title.trim()).slice(0, 5);
    const pic = s.feature?.img ? `<figure class="am-ts-p">${img(s.feature.img, o, { lazy: false, alt: s.feature.name })}</figure>` : ph("Pick the tool's picture", "am-ts-p");
    const st = steps.length ? `<ol class="am-ts-s" style="--n:${steps.length}">${steps.map((p, i) => `<li><span>${i + 1}</span><div><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<p>${esc(p.text.trim())}</p>` : ""}</div></li>`).join("")}</ol>` : "";
    const words = `${eyOf(s)}${s.title.trim() ? `<h2 class="am-ts-h">${marked(s.title.trim())}</h2>` : ph("Write the headline")}${s.text.trim() ? `<div class="am-ts-x">${prose(s.text)}</div>` : ""}`;
    const btns = `<div class="am-bs">${button(s.link, "am-btn")}${button(s.link2, "am-btn2")}</div>`;
    return {
      html: `<div class="am-ts is-${lay}"><div class="am-ts-t">${words}${lay === "stacked" ? "" : st}${btns}</div>${pic}${lay === "stacked" ? st : ""}</div>`,
      css: `
@@ .am-ts{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px 52px;align-items:center;padding:36px 40px;border-radius:30px;background:linear-gradient(135deg,#f6f8f9,#e9edf0)}
@@ .am-ts.is-left>.am-ts-p{order:-1}
@@ .am-ts-p{position:relative;margin:0;aspect-ratio:16/10;border-radius:22px;overflow:hidden;background:#fff;box-shadow:var(--card)}
@@ .am-ts-p img{position:absolute;inset:4%;width:92%;height:92%;object-fit:contain}
@@ h2.am-ts-h{font-size:clamp(26px,2.6vw,36px)!important;line-height:1.12!important;letter-spacing:-.015em!important}
@@ .am-ts-x{margin-top:12px!important;font-size:16px;line-height:1.6;color:var(--txt)}
@@ .am-ts-s{display:grid;gap:10px;margin:22px 0 4px!important}
@@ .am-ts-s li{display:grid;grid-template-columns:34px minmax(0,1fr);gap:12px;align-items:start}
@@ .am-ts-s span{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--pet);font:600 15px/1 var(--head);color:#fff}
@@ .am-ts-s b{display:block;padding-top:6px;font:600 16.5px/1.25 var(--head);color:var(--ink)}
@@ .am-ts-s p{margin-top:2px!important;font-size:14px;line-height:1.5;color:var(--txt)}
@@ .am-ts .am-bs{margin-top:22px}
@@ .am-ts.is-stacked{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
@@ .am-ts.is-stacked>.am-ts-s{grid-column:1/-1;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:14px;margin:6px 0 0!important}
@@ .am-ts.is-stacked>.am-ts-s li{grid-template-columns:minmax(0,1fr);align-content:start;gap:12px;padding:18px;border-radius:18px;background:#fff;box-shadow:var(--card)}
@media (max-width:900px){
@@ .am-ts,@@ .am-ts.is-stacked{grid-template-columns:minmax(0,1fr);gap:18px;padding:18px 16px;border-radius:20px}
@@ .am-ts-p{order:-1}
@@ .am-ts.is-stacked>.am-ts-s{grid-template-columns:minmax(0,1fr);gap:8px}
@@ .am-ts.is-stacked>.am-ts-s li{grid-template-columns:34px minmax(0,1fr);padding:12px}
@@ h2.am-ts-h{font-size:25px!important}
}`,
    };
  },
});

/* ── how it works: numbered steps ──────────────────────────────────────── */

const toolSteps = def({
  id: "tool-steps", category: "tools", name: "How it works",
  note: "The steps of a tool, numbered and joined by a line - from upload to cart",
  layouts: [{ key: "line", label: "Steps on a line" }, { key: "cards", label: "Numbered cards" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 3 }, { kind: "points", label: "The steps", min: 2, max: 5, item: { title: "The step", text: "What happens" }, icons: true }, { kind: "link" }],
  tags: ["steps", "process", "how it works", "DirectUP", "timeline"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "DirectUP Bestellungs-Upload", title: "Laden Sie Ihre Bestellung hoch. ==DirectUP== findet die passenden Produkte.",
      points: [
        { title: "Bestelldokument hochladen", text: "Als PDF, Excel-Datei oder in einem anderen unterstützten Format - auch eingescannte Dokumente und Fotos.", icon: "upload" },
        { title: "Passende Produkte finden", text: "Anhand von APSOparts Artikelnummern, Ihren eigenen Artikelnummern oder Produktbeschreibungen.", icon: "search" },
        { title: "Überprüfen und anpassen", text: "Jede Position ist als gefunden, zu überprüfen oder nicht gefunden gekennzeichnet.", icon: "list" },
        { title: "In den Warenkorb legen", text: "Alle Positionen direkt in den Warenkorb übernehmen und online abschliessen.", icon: "cart" },
      ],
      link: { label: "Zu DirectUP", url: pathFor(store, LINKS.quickorder) },
    } : { link: { label: "", url: pathFor(store, LINKS.quickorder) } }),
  }),
  gap: (s) => needGap(s, { points: 2 }),
  draw: (s) => {
    const w = w2(s.store);
    const steps = s.points.filter((p) => p.title.trim()).slice(0, 5);
    const cards = s.layout === "cards";
    return {
      html: `${header(s)}<ol class="am-hw${cards ? " is-cards" : ""}" style="--n:${Math.max(1, steps.length)}">${steps.map((p, i) => `<li><span class="am-hw-n">${cards ? String(i + 1).padStart(2, "0") : icon(p.icon, 24)}</span><small>${esc(w.step)} ${i + 1}</small><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<p>${esc(p.text.trim())}</p>` : ""}</li>`).join("") || `<li class="am-hw-e">${ph("Write the steps: what happens, in order")}</li>`}</ol>`,
      css: `
@@ .am-hw{position:relative;display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:22px}
@@ .am-hw>li{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-width:0}
@@ .am-hw:not(.is-cards)>li:not(:last-child)::after{content:"";position:absolute;left:76px;right:-12px;top:31px;height:2px;background:repeating-linear-gradient(90deg,#c9d2d7 0 6px,transparent 6px 12px)}
@@ .am-hw-n{display:grid;place-items:center;width:64px;height:64px;margin-bottom:10px;border-radius:20px;background:var(--pet);color:#fff;box-shadow:0 14px 26px -16px rgba(27,58,75,.8)}
@@ .am-hw>li:first-child .am-hw-n{background:var(--red)}
@@ .am-hw small{font:600 11.5px/1.2 var(--head);letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
@@ .am-hw b{font:600 19px/1.25 var(--head);color:var(--ink)}
@@ .am-hw p{font-size:14.5px;line-height:1.55;color:var(--txt)}
@@ .am-hw.is-cards{gap:14px}
@@ .am-hw.is-cards>li{padding:22px 22px 24px;border-radius:22px;background:linear-gradient(#f6f8f9,#edf1f3);overflow:hidden}
@@ .am-hw.is-cards .am-hw-n{width:auto;height:auto;margin:0 0 18px;border-radius:0;background:none;box-shadow:none;font:600 64px/.85 var(--head);letter-spacing:-.04em;color:transparent;-webkit-text-stroke:1.5px var(--pet)}
@@ .am-hw.is-cards>li:first-child .am-hw-n{background:none;-webkit-text-stroke-color:var(--red)}
@@ .am-hw-e{grid-column:1/-1;width:100%}
@@ .am-hw-e .am-ph{width:100%}
@media (max-width:900px){
@@ .am-hw{grid-template-columns:minmax(0,1fr);gap:0}
@@ .am-hw>li{display:grid;grid-template-columns:52px minmax(0,1fr);column-gap:14px;row-gap:2px;padding-bottom:20px}
@@ .am-hw>li>:not(.am-hw-n){grid-column:2}
@@ .am-hw-n{grid-row:1/span 3;width:52px;height:52px;margin:0;border-radius:16px}
@@ .am-hw:not(.is-cards)>li:not(:last-child)::after{left:25px;right:auto;top:58px;bottom:4px;width:2px;height:auto;background:repeating-linear-gradient(180deg,#c9d2d7 0 6px,transparent 6px 12px)}
@@ .am-hw.is-cards{gap:10px}
@@ .am-hw.is-cards>li{padding:16px}
@@ .am-hw.is-cards .am-hw-n{width:auto;height:auto;font-size:44px;margin:0}
@@ .am-hw b{font-size:17px}
}`,
    };
  },
});

/* ── which tool for which job ──────────────────────────────────────────── */

const toolWhich = def({
  id: "tool-which", category: "tools", name: "Which tool for which job",
  note: "What you want to do on the left, the tool that does it on the right - a small directory",
  layouts: [{ key: "table", label: "Directory" }, { key: "cards", label: "Cards" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "points", label: "The jobs", min: 2, max: 8, item: { title: "What you want to do", text: "The tool" }, icons: true, links: true }],
  tags: ["tools", "directory", "jobs", "services"],
  defaults: (store) => ({
    eyebrow: isGerman(store) ? "Tools & Services" : "", title: isGerman(store) ? "Welches Tool für welche Aufgabe?" : "",
    points: [
      tool(store, "Kunststoffe oder Dichtungswerkstoffe nach Mass zuschneiden lassen", "DirectCUT", "cut", LINKS.directcut),
      tool(store, "Eine Bestellung als PDF oder Excel hochladen", "DirectUP", "upload", LINKS.quickorder),
      tool(store, "Die passenden O-Ring-Abmessungen ermitteln", "O-Ring Expert", "ring", LINKS.oringExpert),
      tool(store, "Ein 3D-CAD-Modell für die Konstruktion anfragen", "3D-CAD-Download", "cube", LINKS.cad),
      tool(store, "Die Beständigkeit eines Werkstoffs gegen eine Chemikalie prüfen", "Beständigkeitstabelle", "flask", LINKS.compat),
      tool(store, "Datenblätter und technische Publikationen finden", "Technische Downloads", "download", LINKS.downloads),
    ].map((p) => (isGerman(store) ? p : { ...p, text: "" })),
  }),
  gap: (s) => needGap(s, { points: 2 }),
  draw: (s) => {
    const pts = s.points.filter((p) => p.title.trim()).slice(0, 8);
    const cards = s.layout === "cards";
    const rows = pts.map((p) => `<a class="am-wj" href="${link(p.url ?? "")}"><span class="am-wj-i">${icon(p.icon)}</span><span class="am-wj-q">${esc(p.title.trim())}</span><b class="am-wj-t">${esc(p.text.trim())}</b></a>`).join("");
    return {
      html: `${header(s)}<div class="am-wjs${cards ? " is-cards" : ""}">${rows || ph("Write the jobs: what a buyer wants to do, and the tool that does it")}</div>`,
      css: `
@@ .am-wjs{border-radius:24px;background:#fff;box-shadow:var(--card);overflow:hidden}
@@ .am-wj{display:grid;grid-template-columns:44px minmax(0,1fr) 280px;align-items:center;gap:18px;padding:14px 24px 14px 18px;border-top:1px solid #eef1f3;color:var(--ink)!important;transition:background .2s}
@@ .am-wj:first-child{border-top:0}
@@ .am-wj-i{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:var(--soft);color:var(--pet);transition:background .2s,color .2s}
@@ .am-wj-q{font:500 16.5px/1.35 var(--head)}
@@ .am-wj-t{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-left:22px;border-left:1px solid #e6eaed;font:600 18px/1.2 var(--head);color:var(--red)}
@@ .am-wj-t::after{content:"";flex:none;width:8px;height:8px;border:solid currentColor;border-width:2px 2px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-wj:hover{background:#fbf3f2}
@@ .am-wj:hover .am-wj-i{background:var(--red);color:#fff}
@@ .am-wj:hover .am-wj-t::after{transform:translateX(4px) rotate(45deg)}
@@ .am-wjs.is-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;background:none;box-shadow:none;border-radius:0;overflow:visible}
@@ .am-wjs.is-cards .am-wj{grid-template-columns:minmax(0,1fr);align-content:start;gap:12px;padding:20px;border:0;border-radius:20px;background:linear-gradient(#f6f8f9,#edf1f3)}
@@ .am-wjs.is-cards .am-wj-t{padding:12px 0 0;border-left:0;border-top:1px solid #dde3e7}
@media (max-width:900px){
@@ .am-wj{grid-template-columns:38px minmax(0,1fr);gap:4px 12px;padding:12px 14px}
@@ .am-wj-i{grid-row:span 2;width:38px;height:38px}
@@ .am-wj-t{padding:0;border:0;justify-content:flex-start;font-size:15.5px}
@@ .am-wj-q{font-size:15px}
@@ .am-wjs.is-cards{grid-template-columns:minmax(0,1fr);gap:8px}
@@ .am-wjs.is-cards .am-wj{grid-template-columns:38px minmax(0,1fr);padding:14px}
}`,
    };
  },
});

/* ── upload an order (DirectUP) ────────────────────────────────────────── */

const toolUpload = def({
  id: "tool-upload", category: "tools", name: "Upload an order",
  note: "A drop zone that opens DirectUP - the file types it reads, a line, the button",
  layouts: [{ key: "band", label: "Words left, zone right" }, { key: "zone", label: "One big zone" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 4 }, { kind: "points", label: "What it reads (one word each)", max: 5, item: { title: "The file type", text: "" } }, { kind: "link" }],
  tags: ["DirectUP", "upload", "order", "PDF", "Excel", "file"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "DirectUP", title: "Bestellung hochladen statt ==abtippen==",
      text: "Ob Ihre Bestellung aus einem ERP-System, einer Excel-Datei, einem PDF oder einem eingescannten Dokument stammt: DirectUP liest die Bestellpositionen aus und gleicht sie mit den Produkten im Webshop ab.",
      link: { label: "Zu DirectUP", url: pathFor(store, LINKS.quickorder) },
    } : { link: { label: "", url: pathFor(store, LINKS.quickorder) } }),
    points: ["PDF", "Excel", "Scan", isGerman(store) ? "Foto" : "Photo"].map((t) => ({ title: t, text: "", icon: "doc" })),
  }),
  gap: (s) => needGap(s, { title: true }),
  draw: (s) => {
    const chips = s.points.filter((p) => p.title.trim()).slice(0, 5).map((p) => `<span>${esc(p.title.trim())}</span>`).join("");
    const zone = `<a class="am-uz" href="${link(s.link.url || "")}"><span class="am-uz-i">${icon("upload", 34)}</span>${chips ? `<span class="am-uz-c">${chips}</span>` : ""}<span class="am-uz-b">${esc(s.link.label.trim() || "DirectUP")}</span></a>`;
    const big = s.layout === "zone";
    return {
      html: `<div class="am-up${big ? " is-zone" : ""}"><div class="am-up-t">${eyOf(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ph("Write the headline")}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}</div>${zone}</div>`,
      css: `
@@ .am-up{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px;align-items:center;padding:34px 40px;border-radius:28px;background:linear-gradient(135deg,#f6f8f9,#e9edf0)}
@@ .am-up h2.am-h{font-size:clamp(25px,2.5vw,34px)!important;line-height:1.12!important}
@@ .am-up .am-sub{margin-top:12px!important;font-size:16px}
@@ .am-uz{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;min-height:250px;padding:28px;border:2px dashed #b9c4ca;border-radius:22px;background:#fff;color:var(--ink)!important;text-align:center;transition:border-color .2s,background .2s,box-shadow .2s}
@@ .am-uz-i{display:grid;place-items:center;width:76px;height:76px;border-radius:50%;background:#fdf0ef;color:var(--red);transition:transform .3s}
@@ .am-uz-c{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
@@ .am-uz-c span{padding:6px 12px;border-radius:8px;background:var(--soft);font:600 13px/1 var(--head);letter-spacing:.04em;color:var(--pet)}
@@ .am-uz-b{display:inline-flex;align-items:center;gap:10px;min-height:46px;padding:0 22px;border-radius:6px;background:var(--red);font:600 16px/1 var(--head);color:#fff}
@@ .am-uz-b::after{content:"";width:7px;height:7px;border:solid #fff;border-width:2px 2px 0 0;transform:rotate(45deg)}
@@ .am-uz:hover,@@ .am-uz:focus-visible{border-color:var(--red);background:#fffafa;box-shadow:0 20px 40px -30px rgba(216,9,1,.6)}
@@ .am-uz:hover .am-uz-i{transform:translateY(-4px)}
@@ .am-up.is-zone{grid-template-columns:minmax(0,1fr);justify-items:center;text-align:center;gap:24px;padding:40px}
@@ .am-up.is-zone .am-up-t{max-width:760px}
@@ .am-up.is-zone .am-ey{justify-content:center}
@@ .am-up.is-zone .am-uz{width:100%;flex-direction:row;flex-wrap:wrap;min-height:150px}
@media (max-width:900px){
@@ .am-up,@@ .am-up.is-zone{grid-template-columns:minmax(0,1fr);gap:18px;padding:20px 16px;border-radius:20px}
@@ .am-uz{min-height:0;padding:22px 16px}
@@ .am-up.is-zone .am-uz{flex-direction:column}
}`,
    };
  },
});

/* ── downloads ─────────────────────────────────────────────────────────── */

const toolDownloads = def({
  id: "tool-downloads", category: "tools", name: "Downloads",
  note: "Datasheets, brochures and catalogues as a calm list - each opens its PDF on the shop",
  layouts: [{ key: "list", label: "List" }, { key: "cards", label: "Cards" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "points", label: "The files", min: 1, max: 8, item: { title: "Its name", text: "What it is (PDF · Datenblatt)" }, links: true }, { kind: "link" }],
  tags: ["downloads", "datasheet", "PDF", "brochure", "catalogue", "documents"],
  defaults: (store) => ({
    ...(isGerman(store) ? { eyebrow: "Downloads", title: "Datenblätter und Unterlagen", text: "Zum HITEC® O-Ring NBR 70.10-02 - wie auf seiner Produktseite." } : {}),
    points: DOWNLOADS.map((d) => ({ title: d.name, text: isGerman(store) ? d.meta : "PDF", icon: "doc", url: d.url })),
    link: { label: isGerman(store) ? "Alle technischen Downloads" : "", url: pathFor(store, LINKS.downloads) },
  }),
  gap: (s) => s.points.some((p) => p.title.trim() && p.url) ? "" : "Add a file: its name and its address on the shop",
  draw: (s) => {
    const w = w2(s.store);
    const pts = s.points.filter((p) => p.title.trim() && p.url).slice(0, 8);
    const cards = s.layout === "cards";
    const one = (p: P) => `<a class="am-dl" href="${link(p.url!)}" download><span class="am-dl-f">${esc((/\.(\w{2,4})(?:$|\?)/.exec(p.url ?? "")?.[1] ?? "PDF").toUpperCase())}</span><span class="am-dl-t"><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<em>${esc(p.text.trim())}</em>` : ""}</span><span class="am-dl-d">${icon("download", 20)}<span>${esc(w.download)}</span></span></a>`;
    return {
      html: `${header(s)}<div class="am-dls${cards ? " is-cards" : ""}">${pts.map(one).join("") || ph("Add the files: a name and its address on the shop")}</div>`,
      css: `
@@ .am-dls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px}
@@ .am-dl{display:grid;grid-template-columns:50px minmax(0,1fr) auto;align-items:center;gap:16px;padding:14px 18px 14px 14px;border-radius:16px;background:#fff;box-shadow:var(--card);color:var(--ink)!important;transition:box-shadow .2s}
@@ .am-dl-f{display:grid;place-items:center;width:50px;height:60px;border-radius:6px 14px 6px 6px;background:linear-gradient(225deg,#f3b9b6 0 12px,#fdf0ef 12px);font:700 12px/1 var(--head);letter-spacing:.06em;color:var(--red)}
@@ .am-dl-t b{display:block;font:600 16px/1.3 var(--head);color:var(--ink)}
@@ .am-dl-t em{display:block;margin-top:3px;font:500 13px/1.3 var(--head);font-style:normal;color:var(--mute)}
@@ .am-dl-d{display:flex;align-items:center;gap:8px;font:600 14px/1 var(--head);color:var(--pet)}
@@ .am-dl:hover,@@ .am-dl:focus-visible{box-shadow:0 16px 30px -20px rgba(27,58,75,.5),inset 0 0 0 1.5px var(--pet)}
@@ .am-dls.is-cards{grid-template-columns:repeat(4,minmax(0,1fr))}
@@ .am-dls.is-cards .am-dl{grid-template-columns:minmax(0,1fr);align-content:start;gap:16px;padding:22px 20px;min-height:220px}
@@ .am-dls.is-cards .am-dl-d{margin-top:auto;padding-top:12px;border-top:1px solid #eef1f3}
@media (max-width:1100px) and (min-width:901px){@@ .am-dls.is-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:900px){
@@ .am-dls,@@ .am-dls.is-cards{grid-template-columns:minmax(0,1fr);gap:8px}
@@ .am-dl,@@ .am-dls.is-cards .am-dl{grid-template-columns:42px minmax(0,1fr) auto;min-height:0;gap:12px;padding:12px}
@@ .am-dl-f{width:42px;height:50px}
@@ .am-dl-d span{display:none}
@@ .am-dls.is-cards .am-dl-d{margin:0;padding:0;border:0}
}`,
    };
  },
});

/* ── find an O-ring: by material, or with the O-Ring Expert ─────────────── */

const ORING_KEYS: [string, string][] = [["NBR", "Öle und Kraftstoffe"], ["FKM", "Hohe Temperaturen"], ["EPDM", "Wasser und Dampf"], ["HNBR", "Wärme und Last"], ["VMQ", "Tiefe Temperaturen"], ["PTFE", "Chemikalien, statisch"], ["FFKM", "Extreme Bedingungen"]];

const toolOring = def({
  id: "tool-oring", category: "tools", name: "Find an O-ring",
  note: "Start by material - a key per material - or let the O-Ring Expert find the size",
  layouts: [{ key: "keys", label: "Material keys" }, { key: "panel", label: "Petrol panel" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 3 }, { kind: "points", label: "The materials", min: 2, max: 8, item: { title: "The material", text: "What it suits" }, links: true }, { kind: "link" }, { kind: "link2" }],
  tags: ["O-ring", "finder", "material", "O-Ring Expert", "selector"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "O-Ring Expert", title: "Den passenden O-Ring finden",
      text: "Starten Sie mit NBR, FKM, EPDM, HNBR, VMQ, PTFE oder FFKM - oder ermitteln Sie mit dem O-Ring Expert die passenden Abmessungen für Ihre statische oder dynamische Anwendung.",
      link: { label: "Zum O-Ring Expert", url: pathFor(store, LINKS.oringExpert) },
      link2: { label: "Alle O-Ringe", url: "https://www.apsoparts.com/de-CH/dichtungstechnik/o-ringe-x-ringe.html" },
      points: ORING_KEYS.map(([k, t]) => ({ title: k, text: t, icon: "ring", url: ORING[k].url })),
    } : { link: { label: "", url: pathFor(store, LINKS.oringExpert) } }),
  }),
  gap: (s) => needGap(s, { points: 2 }),
  draw: (s) => {
    const pts = s.points.filter((p) => p.title.trim()).slice(0, 8);
    const panel = s.layout === "panel";
    const keys = pts.map((p) => `<a class="am-ok" href="${link(p.url ?? "")}"><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<span>${esc(p.text.trim())}</span>` : ""}</a>`).join("");
    return {
      html: `<div class="am-or${panel ? " is-panel" : ""}"><div class="am-or-t">${eyOf(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ""}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}<div class="am-bs">${button(s.link, `am-btn${panel ? "" : " is-pet"}`)}${button(s.link2, "am-btn2")}</div></div><div class="am-oks" style="--n:${Math.max(1, pts.length)}">${keys || ph("Add the materials: a name, what it suits and its range")}</div></div>`,
      css: `
@@ .am-or{display:grid;grid-template-columns:minmax(0,1fr);gap:22px}
@@ .am-or-t{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:10px 32px}
@@ .am-or-t>:not(.am-bs){grid-column:1}
@@ .am-or-t .am-bs{grid-column:2;grid-row:1/span 3;align-self:end}
@@ .am-oks{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:10px}
@@ .am-ok{display:flex;flex-direction:column;justify-content:space-between;gap:16px;min-height:132px;padding:16px 16px 14px;border-radius:16px;background:#fff;box-shadow:var(--card);color:var(--ink)!important;transition:background .2s,transform .2s,box-shadow .2s}
@@ .am-ok b{font:600 30px/1 var(--head);letter-spacing:-.01em;color:var(--pet)}
@@ .am-ok span{font:500 13.5px/1.3 var(--head);color:var(--mute)}
@@ .am-ok:hover,@@ .am-ok:focus-visible{transform:translateY(-3px);background:var(--red);box-shadow:0 18px 30px -18px rgba(216,9,1,.6)}
@@ .am-ok:hover :is(b,span){color:#fff}
@@ .am-or.is-panel{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);align-items:center;gap:40px;padding:36px 40px;border-radius:28px;background:radial-gradient(120% 140% at 0% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%)}
@@ .am-or.is-panel .am-or-t{grid-template-columns:minmax(0,1fr)}
@@ .am-or.is-panel .am-or-t .am-bs{grid-column:1;grid-row:auto;margin-top:12px}
@@ .am-or.is-panel h2.am-h{color:#fff!important}
@@ .am-or.is-panel .am-sub{color:#cddbe3}
@@ .am-or.is-panel .am-red{color:#ff6a5f}
@@ .am-or.is-panel .am-ey{color:#cddbe3}
@@ .am-or.is-panel .am-btn2{box-shadow:inset 0 0 0 2px rgba(255,255,255,.7);color:#fff!important}
@@ .am-or.is-panel .am-oks{grid-template-columns:repeat(4,minmax(0,1fr))}
@@ .am-or.is-panel .am-ok{min-height:96px;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
@@ .am-or.is-panel .am-ok b{color:#fff}
@@ .am-or.is-panel .am-ok span{color:#b9cdd8}
@media (max-width:1100px) and (min-width:901px){@@ .am-oks{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (max-width:900px){
@@ .am-or-t{grid-template-columns:minmax(0,1fr)}
@@ .am-or-t .am-bs{grid-column:1;grid-row:auto;margin-top:6px}
@@ .am-oks,@@ .am-or.is-panel .am-oks{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
@@ .am-ok{min-height:0;padding:12px 14px;gap:8px}
@@ .am-ok b{font-size:24px}
@@ .am-or.is-panel{grid-template-columns:minmax(0,1fr);gap:20px;padding:20px 16px;border-radius:20px}
}`,
    };
  },
});

/* ── every service, as a dense list ────────────────────────────────────── */

const toolServices = def({
  id: "tool-services", category: "tools", name: "Services index",
  note: "Every service of the shop in a dense list - for a service or help page",
  layouts: [{ key: "split", label: "Words left, list right" }, { key: "list", label: "List in two columns" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 4 }, { kind: "points", label: "The services", min: 2, max: 10, item: { title: "The service", text: "One line" }, icons: true, links: true }, { kind: "link" }],
  tags: ["services", "index", "list", "overview"],
  defaults: (store) => ({
    eyebrow: isGerman(store) ? "Tools & Services" : "",
    title: isGerman(store) ? "Einkaufen, so ==einfach und schnell== wie möglich" : "",
    text: isGerman(store) ? "APSOparts® bietet eine Reihe von verschiedenen Dienstleistungen an, um den Einkaufsprozess so einfach und schnell wie möglich zu gestalten." : "",
    points: [
      tool(store, "Verfügbarkeit & Logistik", "Unsere Logistikfähigkeiten und Lagerkapazitäten", "truck", LINKS.logistics),
      tool(store, "Produkt-Finder", "Verschiedene Wege, das passende Produkt zu finden", "search", LINKS.finder),
      tool(store, "DirectUP Bestellungs-Upload", "PDF-Bestellungen direkt und ohne zusätzliche Kosten hochladen", "upload", LINKS.directup),
      tool(store, "DirectCUT Produktkonfigurator", "Platten, Rundstäbe, Riemen und Schläuche nach Mass", "cut", LINKS.directcut),
      tool(store, "O-Ring Expert", "Die passenden O-Ring-Abmessungen ermitteln", "ring", LINKS.oringExpert),
      tool(store, "3D-CAD-Dateien", "Verfügbare 3D-CAD-Modelle anfragen", "cube", LINKS.cad),
      tool(store, "Technische Downloads", "Technische Publikationen und Datenblätter", "download", LINKS.downloads),
      tool(store, "Chemische Beständigkeitstabelle", "Die Beständigkeit von Werkstoffen prüfen", "flask", LINKS.compat),
    ],
  }),
  gap: (s) => needGap(s, { points: 2 }),
  draw: (s) => {
    const pts = s.points.filter((p) => p.title.trim()).slice(0, 10);
    const split = s.layout !== "list";
    const list = `<ul class="am-sv">${pts.map((p) => `<li><a href="${link(p.url ?? "")}"><span class="am-sv-i">${icon(p.icon, 20)}</span><span><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<em>${esc(p.text.trim())}</em>` : ""}</span></a></li>`).join("")}</ul>`;
    const words = `<div class="am-sv-t">${eyOf(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ""}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}${textLink(s.link)}</div>`;
    return {
      html: `<div class="am-svs${split ? " is-split" : ""}">${words}${pts.length ? list : ph("Add the services: a name, a line and the page each opens")}</div>`,
      css: `
@@ .am-svs{display:grid;grid-template-columns:minmax(0,1fr);gap:18px}
@@ .am-svs.is-split{grid-template-columns:minmax(0,.75fr) minmax(0,1.25fr);gap:48px;align-items:start}
@@ .am-sv-t .am-lk{margin-top:14px}
@@ .am-sv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 28px;border-top:1px solid var(--line)}
@@ .am-sv a{display:grid;grid-template-columns:40px minmax(0,1fr) 10px;align-items:center;gap:14px;padding:13px 4px;border-bottom:1px solid var(--line);color:var(--ink)!important}
@@ .am-sv a::after{content:"";width:7px;height:7px;border:solid #b3bcc2;border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s,border-color .2s}
@@ .am-sv-i{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--soft);color:var(--pet);transition:background .2s,color .2s}
@@ .am-sv b{display:block;font:600 16px/1.25 var(--head);transition:color .2s}
@@ .am-sv em{display:block;margin-top:2px;font:400 13.5px/1.35 var(--head);font-style:normal;color:var(--mute)}
@@ .am-sv a:hover b{color:var(--red)}
@@ .am-sv a:hover .am-sv-i{background:var(--red);color:#fff}
@@ .am-sv a:hover::after{border-color:var(--red);transform:translateX(3px) rotate(45deg)}
@media (max-width:900px){
@@ .am-svs.is-split{grid-template-columns:minmax(0,1fr);gap:16px}
@@ .am-sv{grid-template-columns:minmax(0,1fr)}
@@ .am-sv a{grid-template-columns:36px minmax(0,1fr) 10px;padding:11px 2px}
@@ .am-sv-i{width:36px;height:36px}
}`,
    };
  },
});

export const TOOLS = [toolTiles, toolSpotlight, toolSteps, toolWhich, toolUpload, toolDownloads, toolOring, toolServices];
