// PAGE - THE LIBRARY, PART 2: CONTENT & STORIES (Content v7, 10.11.2026). Pure.
//
// Words and pictures as the shop's best pages carry them: a feature story, a long read with its chapters, story teasers,
// a statement, the shop in figures, a category text that stays readable, tabs. The German starting words are the shop's
// own (the O-Ring selection guide, Tools & Services, About us, the grounding page) - ./data.ts.

import { BANNERS, LINKS, MATS, ORING, ORING_CAT, PICS } from "./data";
import { cardFor, cardImg, def, esc, header, img, isGerman, link, marked, mk, needGap, pathFor, ph, prose, w2, type Card, type ModuleSettings, type Opts } from "./kit";

const ey = (s: ModuleSettings) => (s.eyebrow.trim() ? `<p class="am-ey">${esc(s.eyebrow.trim())}</p>` : "");
const figure = (c: Card | null, o: Opts, cls: string, hint: string, lazy = true) =>
  c?.img ? `<figure class="${cls}${c.kind === "product" ? " is-prod" : ""}">${cardImg(c, o, lazy)}</figure>` : ph(hint, cls);

/* ── feature story ─────────────────────────────────────────────────────── */

const storyFeature = def({
  id: "story-feature", category: "stories", name: "Feature story",
  note: "A big picture beside a headline, a lead, the story and its key figures - the shop's editorial look",
  layouts: [{ key: "right", label: "Picture right" }, { key: "left", label: "Picture left" }, { key: "top", label: "Picture on top" }],
  fields: [
    { kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", label: "The story (the first paragraph is the lead)", rows: 8, max: 900 },
    { kind: "feature", label: "Its picture" }, { kind: "points", label: "Key figures", max: 3, item: { title: "The figure", text: "What it counts" } }, { kind: "link" },
  ],
  tags: ["article", "editorial", "story", "text and picture"],
  defaults: (store) => isGerman(store) ? {
    eyebrow: "Dichtungstechnik", title: "Der passende O-Ring beginnt bei der ==Betriebsumgebung==",
    text: "Für die industrielle Beschaffung ist nicht nur die Frage relevant, was ein O-Ring ist, sondern auch, wo er eingesetzt wird. Die Werkstoff-Vorauswahl sollte Medium, Temperatur, Druck, Bewegung und erforderliche Dokumentation berücksichtigen.\n\nBei Hydraulik- und Pneumatiksystemen stehen häufig zunächst Öl- und Druckanforderungen im Fokus. Anwendungen in Chemie, Lebensmittelindustrie, Trinkwasser und Pharma erfordern eine genauere Prüfung der Medienverträglichkeit sowie der erforderlichen Zulassungen und Dokumentationen.",
    feature: cardFor(store, ORING_CAT),
    points: [{ title: "24.000+", text: "Sortimentsartikel O-Ringe / X-Ringe", icon: "ring" }, { title: "31", text: "Produkte in neun Werkstoffen und Bauformen", icon: "layers" }],
    link: { label: "Zur O-Ring Auswahlhilfe", url: pathFor(store, LINKS.oringGuide) },
  } : { feature: cardFor(store, ORING_CAT), link: { label: "", url: pathFor(store, LINKS.oringGuide) } },
  gap: (s) => needGap(s, { title: true, text: true }),
  draw: (s, o) => {
    const lay = s.layout === "left" || s.layout === "top" ? s.layout : "right";
    const figs = s.points.filter((p) => p.title.trim()).slice(0, 3);
    const hd = s.title.trim() || s.eyebrow.trim() ? `<div class="am-sf-hd">${ey(s)}${s.title.trim() ? `<h2 class="am-sf-h">${marked(s.title.trim())}</h2>` : ""}</div>` : "";
    const words = s.title.trim() || s.text.trim() ? hd : ph("Write the headline and the story");
    const tail = `${s.text.trim() ? `<div class="am-sf-b">${prose(s.text)}</div>` : ""}${figs.length ? `<div class="am-sf-f">${figs.map((p) => `<div><b>${esc(p.title.trim())}</b><span>${esc(p.text.trim())}</span></div>`).join("")}</div>` : ""}`
      + `${s.link.label.trim() && s.link.url ? `<a class="am-lk am-sf-l" href="${link(s.link.url)}">${esc(s.link.label.trim())}</a>` : ""}`;
    const pic = figure(s.feature, o, "am-sf-p", "Pick the story's picture", false);
    return {
      html: `<article class="am-sf is-${lay}">${pic}<div class="am-sf-t">${words}<div class="am-sf-bd">${tail}</div></div></article>`,
      css: `
@@ .am-sf{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.08fr);gap:56px;align-items:center}
@@ .am-sf.is-right>.am-sf-p{order:2}
@@ .am-sf-p{position:relative;margin:0;aspect-ratio:5/4;border-radius:26px;overflow:hidden;background:var(--tile);box-shadow:0 34px 60px -42px rgba(27,58,75,.75)}
@@ .am-sf-p img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
@@ .am-sf-p.is-prod{background:#fff;box-shadow:var(--card)}
@@ .am-sf-p.is-prod img{inset:8%;width:84%;height:84%;object-fit:contain;mix-blend-mode:multiply}
@@ h2.am-sf-h{margin-bottom:18px!important;font-size:clamp(28px,3.1vw,42px)!important;line-height:1.08!important;letter-spacing:-.018em!important}
@@ .am-sf-b p{font-size:16px;line-height:1.68;color:var(--txt)}
@@ .am-sf-b p+p{margin-top:12px!important}
@@ .am-sf-b>p:first-child{font:500 19px/1.5 var(--head);color:var(--ink)}
@@ .am-sf-f{display:flex;flex-wrap:wrap;gap:18px 40px;margin-top:26px;padding-top:22px;border-top:1px solid var(--line)}
@@ .am-sf-f b{display:block;font:600 38px/1 var(--head);letter-spacing:-.02em;color:var(--red)}
@@ .am-sf-f span{display:block;max-width:190px;margin-top:7px;font:500 13.5px/1.35 var(--head);color:var(--mute)}
@@ .am-sf-l{margin-top:24px}
@@ .am-sf.is-top{grid-template-columns:minmax(0,1fr);gap:30px}
@@ .am-sf.is-top>.am-sf-p{aspect-ratio:21/8}
@@ .am-sf.is-top>.am-sf-t{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:0 56px;align-items:start}
@@ .am-sf.is-top h2.am-sf-h{font-size:clamp(26px,2.7vw,36px)!important}
@media (max-width:1100px) and (min-width:901px){@@ .am-sf{gap:36px}@@ .am-sf-b>p:first-child{font-size:17.5px}}
@media (max-width:900px){
@@ .am-sf,@@ .am-sf.is-top{grid-template-columns:minmax(0,1fr);gap:22px}
@@ .am-sf.is-right>.am-sf-p{order:0}
@@ .am-sf-p,@@ .am-sf.is-top>.am-sf-p{aspect-ratio:4/3;border-radius:18px}
@@ .am-sf.is-top>.am-sf-t{display:block}
@@ h2.am-sf-h{font-size:28px!important}
@@ .am-sf-b>p:first-child{font-size:17px}
@@ .am-sf-f b{font-size:32px}
}`,
    };
  },
});

/* ── long read with its chapters ───────────────────────────────────────── */

const GUIDE_CHAPTERS = [
  { q: "Von der Betriebsumgebung ausgehen", a: "Für die industrielle Beschaffung ist nicht nur die Frage relevant, was ein O-Ring ist, sondern auch, wo er eingesetzt wird. Die Werkstoff-Vorauswahl sollte Medium, Temperatur, Druck, Bewegung und erforderliche Dokumentation berücksichtigen.\n\n- Bei Hydraulik- und Pneumatiksystemen stehen häufig zunächst Öl- und Druckanforderungen im Fokus.\n- Anwendungen in Chemie, Lebensmittelindustrie, Trinkwasser und Pharma erfordern eine genauere Prüfung der Medienverträglichkeit.\n- Bei Ersatzteilen für die Instandhaltung sollten Abmessungen, Werkstoff, Compound und Anwendungsbedingungen der bestehenden Dichtung überprüft werden." },
  { q: "Dichtung auf die Bewegung abstimmen", a: "Bei statischen Dichtungen stehen in der Regel Verpressung, Nutgestaltung, Einbaubedingungen und langfristige Medienverträglichkeit im Mittelpunkt. Bei dynamischen Dichtungen kommen Reibung, Schmierung, Oberflächenqualität, Spaltmass, Druckgrenzen und Verschleiss als Entscheidungskriterien hinzu." },
  { q: "Technische Parameter auf einen Blick", a: "Die Werkstoffbezeichnung allein garantiert keine bestimmte Leistung. Nutzen Sie die Produktdaten und Einbaubedingungen, um den richtigen O-Ring zu validieren.\n\n- Temperaturbereich: die erwartete minimale und maximale Temperatur mit dem compoundspezifischen Bereich vergleichen.\n- Shore-Härte: beeinflusst Extrusionsbeständigkeit, Verpressungsverhalten und Montage.\n- Chemische Beständigkeit: Medium, Konzentration, Betriebstemperatur und Einwirkdauer prüfen." },
  { q: "Normen und Abmessungen", a: "ISO 3601 wird häufig für O-Ring-Abmessungen, Toleranzen, Einbauräume, Qualitätsannahmekriterien, Stützringe und Werkstoffeignung verwendet; AS568 wird häufig für O-Ringe in Zollabmessungen eingesetzt." },
];

const storyChapters = def({
  id: "story-chapters", category: "stories", name: "Long read with chapters",
  note: "A long text in numbered chapters, its contents beside it - a click jumps to the chapter",
  layouts: [{ key: "side", label: "Contents beside" }, { key: "top", label: "Contents on top" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", label: "The line under the title", rows: 2 }, { kind: "faq", label: "The chapters (title, then its words)", max: 8 }],
  tags: ["guide", "article", "chapters", "table of contents", "long read"],
  defaults: (store) => isGerman(store) ? {
    eyebrow: "O-Ring Auswahlhilfe", title: "So wählen Sie den richtigen O-Ring",
    text: "Beginnen Sie mit der wichtigsten Betriebsbedingung und prüfen Sie anschliessend Temperatur, Medien, Bewegung, Abmessungen und technische Dokumentation.",
    faq: GUIDE_CHAPTERS,
  } : {},
  gap: (s) => needGap(s, { title: true, faq: 1 }),
  draw: (s, o) => {
    void o;
    const w = w2(s.store);
    const cls = `apx-${s.id}`;
    const ch = s.faq.filter((x) => x.q.trim() || x.a.trim()).slice(0, 8);
    const nn = (i: number) => String(i + 1).padStart(2, "0");
    const nav = ch.length ? `<nav class="am-cn" aria-label="${esc(w.contents)}"><p class="am-cn-k">${esc(w.contents)}</p><ol>${ch.map((c, i) => `<li><a href="#${cls}-${i + 1}"><span>${nn(i)}</span>${esc(c.q.trim())}</a></li>`).join("")}</ol></nav>` : "";
    const body = ch.length
      ? ch.map((c, i) => `<section class="am-cs" id="${cls}-${i + 1}"><span class="am-cs-n" aria-hidden="true">${nn(i)}</span><div><h3>${esc(c.q.trim())}</h3><div class="am-cs-x">${prose(c.a)}</div></div></section>`).join("")
      : ph("Write its chapters: a title and its words for each");
    const top = s.layout === "top";
    return {
      html: `<div class="am-ch${top ? " is-top" : ""}">${top ? "" : nav}<div class="am-cb">${header(s, false)}${top ? nav : ""}${body}</div></div>`,
      css: `
@@ .am-ch{display:grid;grid-template-columns:270px minmax(0,1fr);gap:48px;align-items:start}
@@ .am-ch.is-top{grid-template-columns:minmax(0,1fr)}
@@ .am-cn{position:sticky;top:24px;padding:18px 16px 14px;border-radius:20px;background:linear-gradient(#f6f8f9,#edf1f3)}
@@ .am-cn-k{margin:0 6px 8px!important;font:600 12px/1.2 var(--head);letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
@@ .am-cn ol{display:grid;gap:2px}
@@ .am-cn a{display:grid;grid-template-columns:26px minmax(0,1fr);gap:8px;padding:9px 8px;border-radius:10px;font:600 14.5px/1.3 var(--head);color:var(--ink)!important;transition:background .15s,color .15s}
@@ .am-cn a span{font-weight:600;color:var(--red)}
@@ .am-cn a:hover{background:#fff;color:var(--red)!important}
@@ .am-ch.is-top .am-cn{position:static;margin-bottom:26px;padding:8px;border-radius:16px}
@@ .am-ch.is-top .am-cn-k{display:none}
@@ .am-ch.is-top .am-cn ol{display:flex;flex-wrap:wrap;gap:6px}
@@ .am-ch.is-top .am-cn a{display:flex;gap:8px;padding:9px 14px;background:#fff;box-shadow:inset 0 0 0 1px #e3e8eb}
@@ .am-cb .am-hd{margin-bottom:8px}
@@ .am-cb h2.am-h{font-size:clamp(26px,2.6vw,34px)!important}
@@ .am-cs{display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px;padding:26px 0;border-top:1px solid var(--line);scroll-margin-top:24px}
@@ .am-cb>.am-hd+.am-cs,@@ .am-cn+.am-cs{border-top:0}
@@ .am-cs-n{font:600 34px/1 var(--head);letter-spacing:-.02em;color:transparent;-webkit-text-stroke:1.3px #c3ccd2}
@@ .am-cs h3{margin-bottom:10px!important;font-size:22px!important;line-height:1.25!important}
@@ .am-cs-x p,@@ .am-cs-x .am-li{font-size:16px;line-height:1.66;color:var(--txt)}
@@ .am-cs-x>*+*{margin-top:12px!important}
@media (max-width:1100px) and (min-width:901px){@@ .am-ch{grid-template-columns:230px minmax(0,1fr);gap:32px}}
@media (max-width:900px){
@@ .am-ch{grid-template-columns:minmax(0,1fr);gap:18px}
@@ .am-cn{position:static;padding:12px 10px 8px}
@@ .am-cs{grid-template-columns:minmax(0,1fr);gap:4px;padding:20px 0}
@@ .am-cs-n{font-size:24px}
@@ .am-cs h3{font-size:19px!important}
@@ .am-cs-x p,@@ .am-cs-x .am-li{font-size:15.5px}
}`,
    };
  },
});

/* ── story teasers ─────────────────────────────────────────────────────── */

const storyCards = def({
  id: "story-cards", category: "stories", name: "Story teasers",
  note: "Pages worth reading as cards - a picture, a headline, a line and \"Read more\"",
  layouts: [{ key: "three", label: "Three in a row" }, { key: "lead", label: "One big, two beside" }, { key: "list", label: "A list" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "link" }, { kind: "points", label: "The stories", min: 1, max: 6, item: { title: "Headline", text: "One line about it" }, pictures: true, links: true }],
  tags: ["blog", "articles", "teasers", "news", "guides"],
  defaults: (store) => {
    const de = isGerman(store);
    return {
      eyebrow: de ? "Ratgeber & Tools" : "", title: de ? "Mehr wissen, schneller bestellen" : "",
      points: [
        { title: de ? "O-Ring Auswahlhilfe" : "", text: de ? "Werkstoffe eingrenzen, Produktlinien vergleichen und die Anwendung der passenden Lösung zuordnen." : "", icon: "ring", img: BANNERS[0].img, url: pathFor(store, LINKS.oringGuide) },
        { title: de ? "DirectCUT Produktkonfigurator" : "", text: de ? "Technische Kunststoffe und Dichtungswerkstoffe in wenigen Schritten nach Mass zuschneiden lassen." : "", icon: "cut", img: PICS.machine, url: pathFor(store, LINKS.directcut) },
        { title: de ? "DirectUP Bestellungs-Upload" : "", text: de ? "Laden Sie Ihre Bestellung hoch. DirectUP findet die passenden Produkte." : "", icon: "upload", img: PICS.directup1, url: pathFor(store, LINKS.directup) },
      ],
    };
  },
  gap: (s) => s.points.some((p) => p.title.trim() && p.url) ? "" : "Add a story: its headline and the page it opens",
  draw: (s, o) => {
    const w = w2(s.store);
    const lay = s.layout === "lead" || s.layout === "list" ? s.layout : "three";
    const list = s.points.filter((p) => p.title.trim() || p.img).slice(0, lay === "lead" ? 3 : 6);
    const cards = list.map((p) => `<a class="am-st" href="${link(p.url ?? "")}"><i>${img(p.img, o) || '<span class="am-st-e"></span>'}</i><span class="am-st-t"><b>${marked(p.title.trim())}</b>${p.text.trim() ? `<em>${esc(p.text.trim())}</em>` : ""}<span class="am-lk">${esc(w.readMore)}</span></span></a>`).join("");
    return {
      html: `${header(s)}<div class="am-sg is-${lay}">${cards || ph("Add the stories: a picture, a headline, a line and the page each opens")}</div>`,
      css: `
@@ .am-sg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}
@@ .am-st{display:flex;flex-direction:column;min-width:0;border-radius:20px;background:#fff;overflow:hidden;color:var(--ink)!important;box-shadow:var(--card);transition:transform .25s,box-shadow .25s}
@@ .am-st:hover,@@ .am-st:focus-visible{transform:translateY(-3px);box-shadow:0 22px 40px -26px rgba(27,58,75,.55),inset 0 0 0 1px #e2e7ea}
@@ .am-st>i{position:relative;display:block;aspect-ratio:16/10;overflow:hidden;background:var(--tile)}
@@ .am-st>i img,@@ .am-st-e{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .6s}
@@ .am-st:hover>i img{transform:scale(1.045)}
@@ .am-st-t{display:flex;flex-direction:column;flex:1;gap:8px;padding:18px 20px 20px}
@@ .am-st-t b{font:600 20px/1.22 var(--head);color:var(--ink)}
@@ .am-st-t em{font-style:normal;font-size:14.5px;line-height:1.55;color:var(--txt)}
@@ .am-st-t .am-lk{margin-top:auto;padding-top:6px}
@@ .am-sg.is-lead{grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);grid-template-rows:auto auto}
@@ .am-sg.is-lead>.am-st:first-child{grid-row:span 2}
@@ .am-sg.is-lead>.am-st:first-child>i{aspect-ratio:auto;flex:1;min-height:300px}
@@ .am-sg.is-lead>.am-st:first-child b{font-size:25px}
@@ .am-sg.is-lead>.am-st:not(:first-child){flex-direction:row}
@@ .am-sg.is-lead>.am-st:not(:first-child)>i{flex:0 0 42%;aspect-ratio:auto}
@@ .am-sg.is-list{grid-template-columns:minmax(0,1fr);gap:0;border-top:1px solid var(--line)}
@@ .am-sg.is-list>.am-st{display:grid;grid-template-columns:220px minmax(0,1fr);gap:24px;align-items:center;padding:16px 0;border-radius:0;background:none;box-shadow:none;border-bottom:1px solid var(--line)}
@@ .am-sg.is-list>.am-st:hover{transform:none}
@@ .am-sg.is-list>.am-st>i{border-radius:14px}
@@ .am-sg.is-list .am-st-t{padding:0}
@@ .am-sg.is-list .am-st:hover b{color:var(--red)}
@@ .am-sg>.am-ph{grid-column:1/-1;min-height:220px}
@media (max-width:1100px) and (min-width:901px){@@ .am-sg{gap:16px}@@ .am-st-t b{font-size:18px}}
@media (max-width:900px){
@@ .am-sg,@@ .am-sg.is-lead{grid-template-columns:minmax(0,1fr);gap:14px}
@@ .am-sg.is-lead>.am-st:first-child{grid-row:auto}
@@ .am-sg.is-lead>.am-st:first-child>i{min-height:0;aspect-ratio:16/10;flex:none}
@@ .am-sg.is-lead>.am-st:not(:first-child)>i{flex-basis:38%}
@@ .am-sg.is-list>.am-st{grid-template-columns:110px minmax(0,1fr);gap:14px;padding:12px 0}
@@ .am-sg.is-list .am-st-t em{display:none}
@@ .am-st-t{padding:14px 16px 16px}
@@ .am-st-t b,@@ .am-sg.is-lead>.am-st:first-child b{font-size:18px}
}`,
    };
  },
});

/* ── a statement ───────────────────────────────────────────────────────── */

const storyQuote = def({
  id: "story-quote", category: "stories", name: "Statement",
  note: "One sentence, set large, with who says it - calm white space around it",
  layouts: [{ key: "center", label: "Centred" }, { key: "side", label: "With a picture" }],
  fields: [{ kind: "title", label: "The sentence", red: true, max: 140 }, { kind: "text", label: "Who says it", rows: 1, max: 120 }, { kind: "feature", label: "A picture (with a picture)" }, { kind: "link" }],
  tags: ["quote", "statement", "pull quote", "claim"],
  defaults: (store) => isGerman(store) ? {
    title: "Eine Reihe von Dienstleistungen, um den Einkaufsprozess so ==einfach und schnell== wie möglich zu gestalten.",
    text: "APSOparts® · Tools & Services",
    feature: cardFor(store, PLAST_PIC),
    link: { label: "Zu den Tools & Services", url: pathFor(store, LINKS.service) },
  } : { feature: cardFor(store, PLAST_PIC), link: { label: "", url: pathFor(store, LINKS.service) } },
  gap: (s) => needGap(s, { title: true }),
  draw: (s, o) => {
    const side = s.layout === "side";
    const q = s.title.trim()
      ? `<blockquote class="am-q"><p>${marked(s.title.trim())}</p>${s.text.trim() ? `<footer>${esc(s.text.trim())}</footer>` : ""}</blockquote>`
      : ph("Write the sentence");
    const go = s.link.label.trim() && s.link.url ? `<a class="am-lk" href="${link(s.link.url)}">${esc(s.link.label.trim())}</a>` : "";
    const pic = side ? figure(s.feature, o, "am-qp", "Pick a picture") : "";
    return {
      html: `<div class="am-qs is-${side ? "side" : "center"}">${pic}<div class="am-qt">${q}${go}</div></div>`,
      css: `
@@ .am-qs{position:relative;padding:56px 0 52px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
@@ .am-qt{max-width:900px;margin:0 auto;text-align:center}
@@ .am-q p{font:500 clamp(26px,3vw,40px)/1.22 var(--head);letter-spacing:-.015em;color:var(--ink);text-wrap:balance}
@@ .am-q::before{content:"\\201C";display:block;height:46px;margin-bottom:10px;font:700 96px/1 var(--head);color:var(--red)}
@@ .am-q footer{margin-top:20px;font:600 13px/1.3 var(--head);letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
@@ .am-qt .am-lk{margin-top:18px}
@@ .am-qs.is-side{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:56px;align-items:center;padding:0;border:0}
@@ .am-qs.is-side .am-qt{text-align:left;margin:0}
@@ .am-qp{position:relative;width:100%;max-width:400px;justify-self:center;margin:0;aspect-ratio:1/1;border-radius:50%;overflow:hidden;background:var(--tile);box-shadow:0 30px 60px -40px rgba(27,58,75,.7)}
@@ .am-qp img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
@@ .am-qp.is-prod{background:#fff}
@@ .am-qp.is-prod img{inset:12%;width:76%;height:76%;object-fit:contain}
@@ .am-ph.am-qp{border-radius:50%}
@media (max-width:900px){
@@ .am-qs{padding:38px 4px 34px}
@@ .am-q::before{height:36px;font-size:76px}
@@ .am-qs.is-side{grid-template-columns:minmax(0,1fr);gap:22px}
@@ .am-qp{width:62%;justify-self:center}
}`,
    };
  },
});
const PLAST_PIC = mk("category", "Kunststofftechnik", "https://www.apsoparts.com/de-CH/kunststofftechnik.html", "https://www.apsoparts.com/media/wysiwyg/2_EngeneeringPlasticsTechnology_1.jpg");

/* ── the shop in figures ───────────────────────────────────────────────── */

const storyFigures = def({
  id: "story-figures", category: "stories", name: "In figures",
  note: "Large figures with what they count - the shop's own numbers only",
  layouts: [{ key: "row", label: "In a row" }, { key: "split", label: "Words left, figures right" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 3 }, { kind: "points", label: "The figures", min: 2, max: 4, item: { title: "The figure (the shop's own)", text: "What it counts" } }, { kind: "link" }],
  tags: ["numbers", "facts", "stats", "key figures"],
  defaults: (store) => isGerman(store) ? {
    eyebrow: "APSOparts® in Zahlen", title: "Der Online-Shop der ==Angst+Pfister Gruppe==",
    text: "Ein auf Industriekomponenten spezialisierter B2B-Online-Shop für industrielle Kunden in ganz Europa - mit Preisen in Echtzeit, mehrsprachigem Support und ohne Kleinmengenzuschlag.",
    points: [
      { title: "100.000+", text: "Standardartikel", icon: "box" },
      { title: "6", text: "Produktkategorien, von Dichtungstechnik bis Sensoren", icon: "layers" },
      { title: "2008", text: "gegründet als digitaler Vertriebskanal der Gruppe", icon: "star" },
      { title: "80+", text: "Jahre Angst+Pfister Gruppe", icon: "globe" },
    ],
    link: { label: "Über APSOparts®", url: pathFor(store, LINKS.about) },
  } : { link: { label: "", url: pathFor(store, LINKS.about) } },
  gap: (s) => needGap(s, { points: 2 }),
  draw: (s) => {
    const split = s.layout === "split";
    const pts = s.points.filter((p) => p.title.trim()).slice(0, 4);
    const figs = pts.length ? pts.map((p) => `<div class="am-fg"><b>${esc(p.title.trim())}</b><span>${esc(p.text.trim())}</span></div>`).join("") : ph("Write the figures: the number and what it counts");
    const go = s.link.label.trim() && s.link.url ? `<a class="am-lk" href="${link(s.link.url)}">${esc(s.link.label.trim())}</a>` : "";
    const words = `<div class="am-fw">${ey(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ""}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}${go}</div>`;
    return {
      html: `<div class="am-fs is-${split ? "split" : "row"}">${words}<div class="am-fl" style="--n:${Math.max(1, pts.length)}">${figs}</div></div>`,
      css: `
@@ .am-fs{padding:30px 34px 34px;border-radius:28px;background:linear-gradient(#f6f8f9,#edf1f3)}
@@ .am-fw .am-lk{margin-top:12px}
@@ .am-fl{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));margin-top:26px}
@@ .am-fg{min-width:0;padding:4px 22px 2px}
@@ .am-fg:first-child{padding-left:0}
@@ .am-fg+.am-fg{border-left:1px solid #d9e0e4}
@@ .am-fg b{display:block;font:600 clamp(36px,4.2vw,58px)/1 var(--head);letter-spacing:-.03em;color:var(--ink)}
@@ .am-fg:first-child b{color:var(--red)}
@@ .am-fg span{display:block;max-width:220px;margin-top:10px;font:500 14px/1.4 var(--head);color:var(--mute)}
@@ .am-fs.is-split{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:48px;align-items:center;padding:40px 44px}
@@ .am-fs.is-split .am-fl{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:0}
@@ .am-fs.is-split .am-fg{padding:22px 22px 20px;border:0;border-radius:18px;background:#fff;box-shadow:var(--card)}
@@ .am-fs.is-split .am-fg b{font-size:clamp(34px,3.4vw,46px)}
@@ .am-fl>.am-ph{grid-column:1/-1}
@media (max-width:900px){
@@ .am-fs,@@ .am-fs.is-split{padding:22px 18px 22px;border-radius:20px}
@@ .am-fs.is-split{grid-template-columns:minmax(0,1fr);gap:20px}
@@ .am-fl{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 0;margin-top:20px}
@@ .am-fg{padding:0 14px}
@@ .am-fg:nth-child(odd){padding-left:0;border-left:0}
@@ .am-fs.is-split .am-fl{gap:10px}
@@ .am-fs.is-split .am-fg{padding:16px 14px}
@@ .am-fg b{font-size:36px}
@@ .am-fg span{font-size:13px}
}`,
    };
  },
});

/* ── a category text that stays readable (SEO) ─────────────────────────── */

const seoText = def({
  id: "story-seo-text", category: "stories", name: "Category text",
  note: "The words a category page needs for search engines - an intro, sections, related links; the rest folds away",
  layouts: [{ key: "fold", label: "Folded after the intro" }, { key: "columns", label: "Two columns" }, { key: "aside", label: "With related links" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", label: "The intro", rows: 4 }, { kind: "faq", label: "The sections (a small heading, then its words)", max: 8 }, { kind: "points", label: "Related links (with related links)", max: 6, item: { title: "Its words", text: "" }, links: true }],
  tags: ["seo", "category text", "text", "content"],
  defaults: (store) => isGerman(store) ? {
    eyebrow: "O-Ringe", title: "Den passenden O-Ring-Werkstoff wählen",
    text: "Der beste O-Ring-Werkstoff hängt von Temperatur, Medium, Druck, Bewegung, erforderlichen Zulassungen oder Dokumentationen und der Anwendung ab.",
    faq: [
      { q: "Kurzantwort", a: MATS.slice(0, 5).map((m) => `- ${m.key}: ${m.short}`).join("\n") },
      { q: "Von der Betriebsumgebung ausgehen", a: GUIDE_CHAPTERS[0].a.split("\n\n")[0] },
      { q: "Statisch oder dynamisch", a: GUIDE_CHAPTERS[1].a },
      { q: "Normen und Abmessungen", a: GUIDE_CHAPTERS[3].a },
    ],
    points: ["NBR", "FKM", "EPDM", "VMQ", "FFKM"].map((k) => ({ title: ORING[k].name, text: "", icon: "ring", url: ORING[k].url })),
  } : {},
  gap: (s) => s.text.trim() || s.faq.some((x) => x.a.trim()) ? "" : "Write its intro or its sections",
  draw: (s) => {
    const w = w2(s.store);
    const lay = s.layout === "columns" || s.layout === "aside" ? s.layout : "fold";
    const secs = s.faq.filter((x) => x.q.trim() || x.a.trim()).slice(0, 8).map((x) => `<section>${x.q.trim() ? `<h3>${esc(x.q.trim())}</h3>` : ""}${prose(x.a)}</section>`);
    const intro = s.text.trim() ? `<p class="am-tx-i">${marked(s.text.trim())}</p>` : "";
    const head = `${ey(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ""}`;
    const empty = !intro && !secs.length ? ph("Write the intro and the sections") : "";
    let body: string;
    if (lay === "fold") {
      body = `${head}${intro}${secs.slice(0, 1).join("")}${secs.length > 1 ? `<details class="am-tx-m"><summary><span>${esc(w.readMore)}</span></summary>${secs.slice(1).join("")}</details>` : ""}${empty}`;
    } else if (lay === "columns") {
      body = `${head}${intro}<div class="am-tx-c">${secs.join("")}</div>${empty}`;
    } else {
      const rel = s.points.filter((p) => p.title.trim() && p.url).slice(0, 6);
      body = `<div class="am-tx-a"><div>${head}${intro}${secs.join("")}${empty}</div>${rel.length ? `<aside class="am-tx-r"><p class="am-ey">${esc(w.more)}</p>${rel.map((p) => `<a href="${link(p.url!)}">${esc(p.title.trim())}</a>`).join("")}</aside>` : ""}</div>`;
    }
    return {
      html: `<div class="am-tx is-${lay}">${body}</div>`,
      css: `
@@ .am-tx{max-width:${lay === "fold" ? "860px" : "none"};${lay === "fold" ? "margin:0 auto;" : ""}color:var(--txt)}
@@ .am-tx h2.am-h{margin-bottom:12px!important;font-size:clamp(24px,2.4vw,30px)!important}
@@ .am-tx-i{font:500 18px/1.55 var(--head)!important;color:var(--ink)}
@@ .am-tx section{margin-top:22px!important}
@@ .am-tx h3{margin-bottom:8px!important;font-size:19px!important;line-height:1.3!important}
@@ .am-tx section p,@@ .am-tx section .am-li{font-size:15.5px;line-height:1.7}
@@ .am-tx section>*+*{margin-top:10px!important}
@@ .am-tx-m>summary{display:inline-flex;align-items:center;gap:10px;margin-top:18px!important;padding:10px 18px;border-radius:999px;cursor:pointer;list-style:none;
  box-shadow:inset 0 0 0 1.5px #cfd7dc;font:600 14.5px/1.2 var(--head);color:var(--pet);transition:box-shadow .2s,background .2s}
@@ .am-tx-m>summary::-webkit-details-marker{display:none}
@@ .am-tx-m>summary::after{content:"";width:7px;height:7px;margin-top:-4px;border:solid currentColor;border-width:0 1.8px 1.8px 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-tx-m>summary:hover{background:#f4f6f7;box-shadow:inset 0 0 0 1.5px var(--pet)}
@@ .am-tx-m[open]>summary{display:none}
@@ .am-tx-c{columns:2;column-gap:56px;margin-top:6px}
@@ .am-tx-c section{break-inside:avoid;margin:0 0 22px!important}
@@ .am-tx-a{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:56px;align-items:start}
@@ .am-tx-r{position:sticky;top:24px;display:grid;gap:2px;padding:20px 18px;border-radius:20px;background:linear-gradient(#f6f8f9,#edf1f3)}
@@ .am-tx-r a{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 10px;border-radius:10px;font:600 15px/1.3 var(--head);color:var(--ink)!important}
@@ .am-tx-r a::after{content:"";flex:none;width:7px;height:7px;border:solid var(--red);border-width:1.8px 1.8px 0 0;transform:rotate(45deg)}
@@ .am-tx-r a:hover{background:#fff;color:var(--red)!important}
@media (max-width:900px){
@@ .am-tx-c{columns:1}
@@ .am-tx-a{grid-template-columns:minmax(0,1fr);gap:24px}
@@ .am-tx-r{position:static}
@@ .am-tx-i{font-size:16.5px!important}
}`,
    };
  },
});

/* ── tabs ──────────────────────────────────────────────────────────────── */

const storyTabs = def({
  id: "story-tabs", category: "stories", name: "Tabs",
  note: "A few subjects behind tabs - one open at a time, each with its words, its picture and its page",
  takes: "categories", min: 0, max: 6, kids: "subs",
  layouts: [{ key: "top", label: "Tabs on top" }, { key: "side", label: "Tabs on the left" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "faq", label: "The tabs (its name, then its words)", max: 6 }],
  tags: ["tabs", "switch", "materials", "overview"],
  defaults: (store) => isGerman(store) ? {
    eyebrow: "Werkstoffe", title: "O-Ring-Werkstoffe im Überblick",
    faq: ["NBR", "FKM", "EPDM", "VMQ", "FFKM"].map((k) => {
      const m = MATS.find((x) => x.key === k)!;
      return { q: k, a: `${m.props.join(", ")}.\n\n- Anforderungen: ${m.needs.join(", ")}\n- Typische Anwendungen: ${m.apps.join(", ")}\n- Zu prüfen: ${m.alt.join("; ")}` };
    }),
  } : {},
  gap: (s) => needGap(s, { faq: 1 }),
  draw: (s, o) => {
    const cls = `apx-${s.id}`;
    const w = w2(s.store);
    const tabs = s.faq.filter((x) => x.q.trim()).slice(0, 6);
    if (!tabs.length) return { html: `${header(s)}${ph("Write the tabs: a name and its words for each")}`, css: "" };
    const side = s.layout === "side";
    const radios = tabs.map((_, i) => `<input type="radio" name="${cls}-t" id="${cls}-t${i}" class="am-tr"${i === 0 ? " checked" : ""}>`).join("");
    const labels = tabs.map((t, i) => `<label for="${cls}-t${i}">${esc(t.q.trim())}</label>`).join("");
    const panels = tabs.map((t, i) => {
      const c = s.items[i];
      return `<div class="am-tp">${c?.img ? `<a class="am-tp-p" href="${link(c.url)}">${cardImg(c, o)}</a>` : ""}<div class="am-tp-t"><h3>${esc(c?.name || t.q.trim())}</h3>${prose(t.a)}${c ? `<a class="am-lk" href="${link(c.url)}">${esc(c.name || w.more)}</a>` : ""}</div></div>`;
    }).join("");
    const show = tabs.map((_, i) => `@@ .am-tr:nth-of-type(${i + 1}):checked~.am-tl label:nth-child(${i + 1}),@@ .am-tr:nth-of-type(${i + 1}):checked~.am-tw .am-tl label:nth-child(${i + 1}){background:#fff;color:var(--ink);box-shadow:0 6px 16px -10px rgba(27,58,75,.5),inset 0 0 0 1px #e3e8eb}
@@ .am-tr:nth-of-type(${i + 1}):checked~.am-tw .am-tp:nth-child(${i + 1}),@@ .am-tr:nth-of-type(${i + 1}):checked~.am-tps .am-tp:nth-child(${i + 1}){display:grid}
@@ .am-tr:nth-of-type(${i + 1}):focus-visible~.am-tl label:nth-child(${i + 1}),@@ .am-tr:nth-of-type(${i + 1}):focus-visible~.am-tw .am-tl label:nth-child(${i + 1}){outline:2px solid var(--red);outline-offset:2px}`).join("\n");
    const inner = side ? `<div class="am-tw"><div class="am-tl">${labels}</div><div class="am-tps">${panels}</div></div>` : `<div class="am-tl">${labels}</div><div class="am-tps">${panels}</div>`;
    return {
      html: `${header(s)}<div class="am-tb${side ? " is-side" : ""}">${radios}${inner}</div>`,
      css: `
@@ .am-tr{position:absolute;opacity:0;pointer-events:none}
@@ .am-tl{display:inline-flex;flex-wrap:wrap;gap:4px;padding:5px;border-radius:14px;background:#edf1f3}
@@ .am-tl label{padding:10px 20px;border-radius:10px;cursor:pointer;font:600 15px/1.2 var(--head);color:var(--mute);transition:background .2s,color .2s,box-shadow .2s}
@@ .am-tl label:hover{color:var(--ink)}
@@ .am-tps{margin-top:16px}
@@ .am-tw .am-tps{margin-top:0}
@@ .am-tp{display:none;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:40px;align-items:center;padding:24px;border-radius:24px;background:linear-gradient(#f6f8f9,#edf1f3);animation:am-in .35s ease}
@@ .am-tp:not(:has(.am-tp-p)){grid-template-columns:minmax(0,1fr);padding:28px 32px}
@@ .am-tp-p{position:relative;display:block;aspect-ratio:4/3;border-radius:18px;overflow:hidden;background:var(--tile)}
@@ .am-tp-p img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .5s}
@@ .am-tp-p:hover img{transform:scale(1.04)}
@@ .am-tp-t h3{margin-bottom:10px!important;font-size:26px!important;line-height:1.2!important}
@@ .am-tp-t p{font:500 17px/1.5 var(--head);color:var(--ink)}
@@ .am-tp-t .am-li{margin-top:14px!important;font-size:15px;line-height:1.55}
@@ .am-tp-t .am-lk{margin-top:18px}
@keyframes am-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@@ .am-tb.is-side .am-tw{display:grid;grid-template-columns:220px minmax(0,1fr);gap:18px;align-items:start}
@@ .am-tb.is-side .am-tl{display:grid;gap:4px;padding:6px;border-radius:18px}
@@ .am-tb.is-side .am-tl label{padding:13px 16px}
${show}
@media (max-width:900px){
@@ .am-tl,@@ .am-tb.is-side .am-tl{display:flex;flex-wrap:nowrap;overflow-x:auto;max-width:100%;scrollbar-width:none}
@@ .am-tl label{flex:none;padding:9px 14px;font-size:14px}
@@ .am-tb.is-side .am-tw{grid-template-columns:minmax(0,1fr);gap:12px}
@@ .am-tp{grid-template-columns:minmax(0,1fr);gap:16px;padding:14px;border-radius:18px}
@@ .am-tp:not(:has(.am-tp-p)){padding:18px}
@@ .am-tp-t h3{font-size:21px!important}
@@ .am-tp-t p{font-size:16px}
}`,
    };
  },
});

export const STORIES = [storyFeature, storyChapters, storyCards, storyQuote, storyFigures, seoText, storyTabs];
export const STORY_SAMPLES: Record<string, (store: string) => Partial<ModuleSettings>> = {
  // the tabs take the materials' own categories (their photo and page) - a fill does it on a page
  "story-tabs": () => ({ items: ["NBR", "FKM", "EPDM", "VMQ", "FFKM"].map((k) => ORING[k]) }),
};
