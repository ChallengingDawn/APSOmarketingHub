// PAGE - THE LIBRARY, PART 2: HELP & FAQ (Content v7, 10.11.2026). Pure.
//
// The shop's help centre as blocks: its topics, questions with a help card, questions all open (for search engines),
// contact and offices, a step-by-step answer, a search box that searches the shop (its own search, GET - no new form
// backend), a glossary. The words are the shop's own (/support/faqs, About us, the O-Ring selection guide).

import { LINKS, MATS, PICS } from "./data";
import { def, esc, eyOf, header, icon, img, isGerman, link, marked, needGap, pathFor, ph, prose, textLink, w2, type ModuleSettings } from "./kit";

type P = ModuleSettings["points"][number];

/* ── the help centre's topics ──────────────────────────────────────────── */

const TOPICS: [string, string, string, string][] = [
  ["Allgemeine Fragen", "Konten, Support, kundenspezifische Lösungen und Probleme mit der Website", "question", "#O03V6RD"],
  ["Produkthilfe", "Produktsuche, Filter, Dokumente und Bestellungen", "search", "#WDBRWPW"],
  ["Produktkonfigurator", "DirectCUT-Produkte, Abmessungen und Wiederholungsbestellungen", "cut", "#P3Y84BI"],
  ["Mein Konto", "Bestellungen, Rechnungen, Adressen, Unternehmensbenutzer und Referenzen", "user", "#G1PXMAT"],
  ["Suche & Support-Tools", "Intelligente Suche und APSOAssistant", "chat", "#TB28JVV"],
  ["Bestellungen & Lieferung", "Checkout, Wiederholungsbestellungen, DirectUP, Lieferung und Sendungsverfolgung", "truck", "#KUG7VQ5"],
  ["Rücksendungen", "Stornierungen und Rücksendeanfragen", "box", "#W0LBLAV"],
  ["Zahlungen", "Zahlungsmethoden, Versandkosten und Mehrwertsteuer", "doc", "#PDYODGN"],
];

const helpTopics = def({
  id: "help-topics", category: "help", name: "Help topics",
  note: "The help centre's topics as tiles - each opens its answers",
  layouts: [{ key: "grid", label: "Tiles" }, { key: "chips", label: "Compact list" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 3 }, { kind: "points", label: "The topics", min: 2, max: 8, item: { title: "The topic", text: "What it answers" }, icons: true, links: true }, { kind: "link" }],
  tags: ["help", "support", "topics", "faq", "help centre"],
  defaults: (store) => ({
    eyebrow: isGerman(store) ? "Hilfe & Support" : "", title: isGerman(store) ? "APSOparts® Webshop-Hilfecenter" : "",
    text: isGerman(store) ? "Klare und praktische Antworten zu Konten, Produkten, technischen Dokumenten, unseren Tools, Bestellungen, Lieferungen, Rücksendungen und Zahlungen." : "",
    points: TOPICS.map(([t, x, ic, a]) => ({ title: isGerman(store) ? t : "", text: isGerman(store) ? x : "", icon: ic, url: `${pathFor(store, LINKS.faqs)}${a}` })),
    link: { label: isGerman(store) ? "Support kontaktieren" : "", url: pathFor(store, LINKS.contact) },
  }),
  gap: (s) => needGap(s, { points: 2 }),
  draw: (s) => {
    const pts = s.points.filter((p) => p.title.trim()).slice(0, 8);
    const chips = s.layout === "chips";
    return {
      html: `${header(s)}<div class="am-ht${chips ? " is-chips" : ""}">${pts.map((p) => `<a href="${link(p.url ?? "")}"><span class="am-ht-i">${icon(p.icon, 24)}</span><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<em>${esc(p.text.trim())}</em>` : ""}</a>`).join("") || ph("Add the topics: a name, what it answers and its page")}</div>`,
      css: `
@@ .am-ht{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@@ .am-ht a{display:flex;flex-direction:column;gap:8px;min-height:168px;padding:20px 20px 18px;border-radius:20px;background:#fff;box-shadow:var(--card);color:var(--ink)!important;transition:box-shadow .2s,transform .2s}
@@ .am-ht-i{display:grid;place-items:center;width:48px;height:48px;margin-bottom:8px;border-radius:14px;background:#fdf0ef;color:var(--red);transition:background .2s,color .2s}
@@ .am-ht b{font:600 17.5px/1.25 var(--head)}
@@ .am-ht em{font-style:normal;font-size:13.5px;line-height:1.45;color:var(--mute)}
@@ .am-ht a:hover,@@ .am-ht a:focus-visible{transform:translateY(-2px);box-shadow:0 18px 32px -22px rgba(27,58,75,.55),inset 0 0 0 1.5px var(--red)}
@@ .am-ht a:hover .am-ht-i{background:var(--red);color:#fff}
@@ .am-ht.is-chips{display:flex;flex-wrap:wrap;gap:8px}
@@ .am-ht.is-chips a{flex-direction:row;align-items:center;gap:10px;min-height:0;padding:8px 16px 8px 8px;border-radius:12px}
@@ .am-ht.is-chips .am-ht-i{width:34px;height:34px;margin:0;border-radius:9px}
@@ .am-ht.is-chips em{display:none}
@@ .am-ht.is-chips b{font-size:15px}
@@ .am-ht>.am-ph{grid-column:1/-1}
@media (max-width:1100px) and (min-width:901px){@@ .am-ht{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:900px){
@@ .am-ht{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
@@ .am-ht a{min-height:0;padding:14px 12px}
@@ .am-ht-i{width:40px;height:40px;margin:0}
@@ .am-ht em{display:none}
@@ .am-ht b{font-size:15.5px}
}`,
    };
  },
});

/* ── questions with a help card ────────────────────────────────────────── */

const ACCOUNT_FAQ = [
  { q: "Benötige ich ein APSOparts® Konto, um Preise einzusehen und Bestellungen aufzugeben?", a: "Ja. Sie benötigen ein APSOparts® Konto, um Preise einzusehen und Bestellungen aufzugeben.\n\n- Produkte im Warenkorb speichern\n- Aktuelle und frühere Bestellungen einsehen\n- Rechnungen und Bestelldokumente herunterladen\n- Lieferadressen verwalten\n- Wunschlisten erstellen" },
  { q: "Wie kann ich das Passwort meines APSOparts® Kontos zurücksetzen?", a: "Geben Sie auf der Seite zum Zurücksetzen des Passworts die mit Ihrem APSOparts® Konto verknüpfte E-Mail-Adresse ein. APSOparts® sendet einen Link zum Zurücksetzen des Passworts an diese Adresse." },
  { q: "Wer kann mir bei einem bestimmten APSOparts® Produkt oder einer Artikelnummer helfen?", a: "Kontaktieren Sie den APSOparts® Support per Chat oder E-Mail. Das Support-Team steht Ihnen werktags während der Bürozeiten zur Verfügung. Bitte geben Sie an:\n\n- APSOparts® Artikelnummer\n- Produktname\n- Benötigte Menge" },
  { q: "Welche Produkte kann ich mit dem DirectCUT-Konfigurator als Zuschnitt konfigurieren?", a: "Wir bieten einen Zuschnittkonfigurator für Produkte wie Kunststoffplatten, Stäbe, Bänder, Schläuche, Rohre, Rundschnüre, Elastomerplatten und weitere Produkte an." },
  { q: "Kann ich 3D-CAD-Daten für einen APSOparts® Artikel herunterladen?", a: "Ja. Für ausgewählte APSOparts® Artikel sind 3D-CAD-Dateien verfügbar, die direkt von der jeweiligen Produktseite heruntergeladen werden können." },
];

const helpFaqSide = def({
  id: "help-faq-side", category: "help", name: "Questions with a help card",
  note: "The questions open one by one; beside them who helps and how to reach them",
  layouts: [{ key: "left", label: "Help card left" }, { key: "right", label: "Help card right" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 3 }, { kind: "points", label: "Ways to reach the shop", max: 3, item: { title: "The way", text: "When / where" }, icons: true }, { kind: "link" }, { kind: "faq", label: "The questions", max: 12 }],
  tags: ["faq", "questions", "accordion", "support", "contact"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "Häufige Fragen", title: "Keine Antwort gefunden? ==Wir helfen weiter.==",
      text: "Kundenservice per E-Mail, Chat oder vor Ort in mehreren Sprachen.",
      points: [{ title: "Chat", text: "Werktags während der Bürozeiten", icon: "chat" }, { title: "E-Mail", text: "support@apsoparts.com", icon: "mail" }],
      faq: ACCOUNT_FAQ,
      link: { label: "Support kontaktieren", url: pathFor(store, LINKS.contact) },
    } : { link: { label: "", url: pathFor(store, LINKS.contact) } }),
  }),
  gap: (s) => needGap(s, { faq: 1 }),
  draw: (s) => {
    const qs = s.faq.filter((x) => x.q.trim() && x.a.trim()).slice(0, 12);
    const ways = s.points.filter((p) => p.title.trim()).slice(0, 3);
    const card = `<aside class="am-fh">${eyOf(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ""}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}${ways.length ? `<ul class="am-fh-w">${ways.map((p) => `<li><span>${icon(p.icon, 20)}</span><b>${esc(p.title.trim())}</b><em>${esc(p.text.trim())}</em></li>`).join("")}</ul>` : ""}${s.link.label.trim() && s.link.url ? `<a class="am-btn" href="${link(s.link.url)}">${esc(s.link.label.trim())}</a>` : ""}</aside>`;
    const list = qs.length ? `<div class="am-fq2">${qs.map((x, i) => `<details class="am-q2"${i === 0 ? " open" : ""}><summary>${esc(x.q.trim())}</summary><div class="am-q2-a">${prose(x.a)}</div></details>`).join("")}</div>` : ph("Write the questions and their answers");
    const right = s.layout === "right";
    return {
      html: `<div class="am-fs2${right ? " is-right" : ""}">${card}${list}</div>`,
      css: `
@@ .am-fs2{display:grid;grid-template-columns:minmax(0,.72fr) minmax(0,1.28fr);gap:36px;align-items:start}
@@ .am-fs2.is-right>.am-fh{order:2}
@@ .am-fh{position:sticky;top:24px;padding:28px 28px 30px;border-radius:26px;background:linear-gradient(160deg,#f6f8f9,#e8edf0)}
@@ .am-fh .am-sub{margin-top:10px!important}
@@ .am-fh-w{display:grid;gap:8px;margin:20px 0 22px!important}
@@ .am-fh-w li{display:grid;grid-template-columns:40px minmax(0,1fr);grid-template-rows:auto auto;column-gap:12px;align-items:center;padding:10px 12px;border-radius:14px;background:#fff}
@@ .am-fh-w span{grid-row:span 2;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:#fdf0ef;color:var(--red)}
@@ .am-fh-w b{font:600 15px/1.2 var(--head);color:var(--ink)}
@@ .am-fh-w em{font:500 13.5px/1.3 var(--head);font-style:normal;color:var(--mute)}
@@ .am-fq2{display:grid;gap:0;border-top:1px solid var(--line)}
@@ .am-q2{border-bottom:1px solid var(--line)}
@@ .am-q2 summary{position:relative;display:block;padding:20px 54px 20px 0;cursor:pointer;list-style:none;font:600 17px/1.35 var(--head);color:var(--ink);transition:color .2s}
@@ .am-q2 summary::-webkit-details-marker{display:none}
@@ .am-q2 summary::before,@@ .am-q2 summary::after{content:"";position:absolute;right:12px;top:50%;width:16px;height:2px;border-radius:2px;background:var(--red);transition:transform .25s}
@@ .am-q2 summary::after{transform:rotate(90deg)}
@@ .am-q2[open] summary::after{transform:rotate(0)}
@@ .am-q2 summary:hover{color:var(--red)}
@@ .am-q2-a{padding:0 40px 22px 0}
@@ .am-q2-a>*+*{margin-top:10px!important}
@@ .am-q2-a p,@@ .am-q2-a .am-li{font-size:15.5px;line-height:1.62;color:var(--txt)}
@media (max-width:900px){
@@ .am-fs2{grid-template-columns:minmax(0,1fr);gap:18px}
@@ .am-fs2.is-right>.am-fh{order:0}
@@ .am-fh{position:static;padding:20px 16px}
@@ .am-q2 summary{padding:16px 44px 16px 0;font-size:16px}
@@ .am-q2-a{padding:0 0 18px}
}`,
    };
  },
});

/* ── questions, all open ───────────────────────────────────────────────── */

const GUIDE_FAQ = [
  { q: "Welcher O-Ring-Werkstoff ist am besten geeignet?", a: "Der beste O-Ring-Werkstoff hängt von Temperatur, Medium, Druck, Bewegung, erforderlichen Zulassungen oder Dokumentationen und der Anwendung ab. NBR wird häufig für Standardanwendungen mit Öl und Kraftstoff eingesetzt, FKM für höhere Temperaturen und breitere chemische Beständigkeit, EPDM für Wasser und Dampf, VMQ für Flexibilität bei niedrigen Temperaturen und FFKM für extreme chemische und thermische Bedingungen." },
  { q: "Welche APSOparts O-Ring-Produktlinie sollte ich prüfen?", a: "Prüfen Sie NORMATEC für allgemeine Industrieanwendungen, HITEC für Anwendungen mit Zulassungs- oder Dokumentationsanforderungen, Evolast für Hochleistungs-FFKM-Dichtungen und FEP-O-Seal für geeignete statische Anwendungen in Pharma, Chemie oder Verfahrenstechnik." },
  { q: "Kann FEP-O-Seal FFKM ersetzen?", a: "FEP-O-Seal kann für geeignete statische Dichtstellen in aggressiven chemischen, pharmazeutischen oder verfahrenstechnischen Umgebungen in Betracht gezogen werden. Es ist kein genereller Ersatz für FFKM, insbesondere wenn Druck, Elastizität oder die Leistung bei dynamischer Abdichtung entscheidend sind." },
  { q: "Kann ich von NORMATEC auf HITEC O-Ringe wechseln?", a: "Bei gleichem Grundwerkstoff können Kunden, die NORMATEC verwenden, den entsprechenden HITEC O-Ring in der Regel als Upgrade-Option mit Fokus auf Zulassungen oder Dokumentation prüfen. Der umgekehrte Wechsel sollte nicht automatisch angenommen werden." },
];

const helpFaqOpen = def({
  id: "help-faq-open", category: "help", name: "Questions, all open",
  note: "Every answer visible at once, numbered - the kind of text search engines and AI answers read",
  layouts: [{ key: "two", label: "Two columns" }, { key: "one", label: "One column" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "faq", label: "The questions", max: 12 }, { kind: "link" }],
  tags: ["faq", "seo", "questions", "answers", "AEO"],
  defaults: (store) => isGerman(store) ? {
    eyebrow: "Häufig gestellte Fragen", title: "O-Ringe: was Kunden fragen", faq: GUIDE_FAQ,
    link: { label: "Zur O-Ring Auswahlhilfe", url: pathFor(store, LINKS.oringGuide) },
  } : { link: { label: "", url: pathFor(store, LINKS.oringGuide) } },
  gap: (s) => needGap(s, { faq: 1 }),
  draw: (s) => {
    const w = w2(s.store);
    const qs = s.faq.filter((x) => x.q.trim() && x.a.trim()).slice(0, 12);
    const one = s.layout === "one";
    return {
      html: `${header(s)}<ol class="am-fo${one ? " is-one" : ""}">${qs.map((x, i) => `<li><span class="am-fo-n" aria-label="${esc(w.question)} ${i + 1}">${String(i + 1).padStart(2, "0")}</span><div><h3>${esc(x.q.trim())}</h3>${prose(x.a)}</div></li>`).join("") || `<li>${ph("Write the questions and their answers")}</li>`}</ol>`,
      css: `
@@ .am-fo{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
@@ .am-fo>li{display:grid;grid-template-columns:52px minmax(0,1fr);gap:14px;padding:24px 26px 24px 20px;border-radius:22px;background:linear-gradient(#f6f8f9,#edf1f3)}
@@ .am-fo-n{display:grid;place-items:center;width:52px;height:52px;border-radius:16px;background:#fff;box-shadow:0 10px 22px -16px rgba(27,58,75,.6);font:600 18px/1 var(--head);color:var(--red)}
@@ .am-fo h3{margin:4px 0 10px!important;font-size:19px!important;line-height:1.3!important}
@@ .am-fo p,@@ .am-fo .am-li{font-size:15px;line-height:1.62;color:var(--txt)}
@@ .am-fo.is-one{grid-template-columns:minmax(0,1fr);gap:0;border-top:1px solid var(--line)}
@@ .am-fo.is-one>li{grid-template-columns:72px minmax(0,1fr);padding:26px 0;border-radius:0;background:none;border-bottom:1px solid var(--line)}
@@ .am-fo.is-one .am-fo-n{align-self:start;width:auto;height:auto;justify-content:start;background:none;box-shadow:none;font-size:30px;color:transparent;-webkit-text-stroke:1.3px var(--red)}
@@ .am-fo.is-one h3{font-size:21px!important}
@@ .am-fo.is-one p{max-width:820px;font-size:16px}
@media (max-width:900px){
@@ .am-fo{grid-template-columns:minmax(0,1fr);gap:10px}
@@ .am-fo>li{grid-template-columns:minmax(0,1fr);gap:8px;padding:18px 16px}
@@ .am-fo-n{width:40px;height:40px;font-size:15px;border-radius:12px}
@@ .am-fo.is-one>li{grid-template-columns:minmax(0,1fr);padding:18px 0}
@@ .am-fo.is-one .am-fo-n{font-size:24px}
@@ .am-fo h3,@@ .am-fo.is-one h3{font-size:17.5px!important}
}`,
    };
  },
});

/* ── contact and offices ───────────────────────────────────────────────── */

const helpContact = def({
  id: "help-contact", category: "help", name: "Contact and offices",
  note: "How to reach the shop and where it is - the ways, the offices, the contact page",
  layouts: [{ key: "cards", label: "Cards" }, { key: "band", label: "One band" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "points", label: "The ways", max: 3, item: { title: "The way", text: "The address or the hours" }, icons: true }, { kind: "faq", label: "The offices (its name, then its address lines)", max: 3 }, { kind: "link" }],
  tags: ["contact", "address", "offices", "support", "email"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "Kontakt", title: "Unsere Büros",
      text: "Kundenservice per E-Mail, Chat oder vor Ort in mehreren Sprachen.",
      points: [{ title: "E-Mail", text: "support@apsoparts.com", icon: "mail" }, { title: "Chat", text: "Werktags während der Bürozeiten", icon: "chat" }],
      link: { label: "Kontakt / Retouren", url: pathFor(store, LINKS.contact) },
    } : { points: [{ title: "E-Mail", text: "support@apsoparts.com", icon: "mail" }], link: { label: "", url: pathFor(store, LINKS.contact) } }),
    faq: [
      { q: "APSOparts® AG", a: `Feldeggstrasse 20\n8152 Glattbrugg${isGerman(store) ? "\nSchweiz" : ""}` },
      { q: "APSOparts® GmbH", a: `Siemensstrasse 5\n70736 Fellbach${isGerman(store) ? "\nDeutschland" : ""}` },
    ],
  }),
  gap: (s) => s.faq.some((x) => x.q.trim()) || s.points.some((p) => p.title.trim()) ? "" : "Add the ways to reach the shop or its offices",
  draw: (s) => {
    const ways = s.points.filter((p) => p.title.trim()).slice(0, 3);
    const offices = s.faq.filter((x) => x.q.trim()).slice(0, 3);
    const band = s.layout === "band";
    const w = ways.map((p) => `<div class="am-ct-w"><span>${icon(p.icon, 22)}</span><div><small>${esc(p.title.trim())}</small><b>${esc(p.text.trim())}</b></div></div>`).join("");
    const o = offices.map((x) => `<div class="am-ct-o"><span>${icon("pin", 22)}</span><div><small>${esc(x.q.trim())}</small><address>${esc(x.a.trim()).replace(/\r?\n/g, "<br>")}</address></div></div>`).join("");
    return {
      html: `<div class="am-cts${band ? " is-band" : ""}"><div class="am-ct-t">${eyOf(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ""}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}${textLink(s.link)}</div><div class="am-ct-g">${w}${o}${!w && !o ? ph("Add the ways and the offices") : ""}</div></div>`,
      css: `
@@ .am-cts{display:grid;grid-template-columns:minmax(0,1fr);gap:20px}
@@ .am-ct-t .am-lk{margin-top:12px}
@@ .am-ct-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
@@ .am-ct-w,@@ .am-ct-o{display:grid;grid-template-columns:46px minmax(0,1fr);gap:14px;align-items:start;padding:22px 20px;border-radius:20px;background:#fff;box-shadow:var(--card)}
@@ .am-ct-w>span,@@ .am-ct-o>span{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:var(--soft);color:var(--pet)}
@@ .am-ct-w>span{background:#fdf0ef;color:var(--red)}
@@ .am-cts small{display:block;margin-bottom:4px;font:600 11.5px/1.2 var(--head);letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
@@ .am-cts b{display:block;font:600 17px/1.3 var(--head);color:var(--ink);overflow-wrap:break-word;-webkit-hyphens:manual;hyphens:manual}
@@ .am-cts address{font:500 16px/1.45 var(--head);font-style:normal;color:var(--ink)}
@@ .am-cts.is-band{grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);align-items:center;gap:36px;padding:32px 36px;border-radius:28px;background:radial-gradient(120% 140% at 0% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%)}
@@ .am-cts.is-band h2.am-h,@@ .am-cts.is-band .am-lk{color:#fff!important}
@@ .am-cts.is-band :is(.am-sub,.am-ey){color:#cddbe3}
@@ .am-cts.is-band .am-red{color:#ff6a5f}
@@ .am-cts.is-band .am-ct-g{grid-template-columns:repeat(2,minmax(0,1fr))}
@@ .am-cts.is-band :is(.am-ct-w,.am-ct-o){background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px rgba(255,255,255,.16)}
@@ .am-cts.is-band :is(.am-ct-w,.am-ct-o)>span{background:rgba(255,255,255,.12);color:#fff}
@@ .am-cts.is-band :is(b,address){color:#fff}
@@ .am-cts.is-band small{color:#9fb8c6}
@media (max-width:1100px) and (min-width:901px){@@ .am-cts.is-band{grid-template-columns:minmax(0,1fr);gap:20px}}
@media (max-width:900px){
@@ .am-cts.is-band{grid-template-columns:minmax(0,1fr);gap:18px;padding:20px 16px;border-radius:20px}
@@ .am-ct-g,@@ .am-cts.is-band .am-ct-g{grid-template-columns:minmax(0,1fr);gap:8px}
@@ .am-ct-w,@@ .am-ct-o{padding:14px}
}`,
    };
  },
});

/* ── a step-by-step answer ─────────────────────────────────────────────── */

const helpHowto = def({
  id: "help-howto", category: "help", name: "Step-by-step answer",
  note: "One question answered in numbered steps, with the shop's own screenshot and the next step",
  layouts: [{ key: "below", label: "Screenshot on top" }, { key: "side", label: "Steps beside the screenshot" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", label: "The question", red: true }, { kind: "text", label: "The short answer", rows: 3 }, { kind: "points", label: "The steps", min: 2, max: 8, item: { title: "The step, in a few words", text: "What to do" } }, { kind: "feature", label: "A screenshot" }, { kind: "link", label: "The next step" }],
  tags: ["how to", "steps", "help", "instructions", "tutorial"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "Produkthilfe", title: "Wie funktionieren die Produktfilter?",
      text: "Mit Produktfiltern können Sie eine Produktkategorie auf Artikel eingrenzen, die Ihren technischen Anforderungen entsprechen.",
      points: [
        ["Kategorie öffnen", "Öffnen Sie die entsprechende Produktkategorie."],
        ["Alle Filter zeigen", "Wählen Sie weitere Filter anzeigen, um alle verfügbaren Filtergruppen einzublenden."],
        ["Werte wählen", "Öffnen Sie eine Filtergruppe und wählen Sie einen oder mehrere Werte aus."],
        ["Gezielt suchen", "Nutzen Sie das Suchfeld innerhalb einer Filtergruppe, wenn Sie nach einem bestimmten Wert suchen."],
        ["Ergebnis prüfen", "Prüfen Sie die Zeile Ausgewählte Filter sowie die Anzahl der passenden Produkte und Artikel."],
      ].map(([t, x]) => ({ title: t, text: x, icon: "check" })),
      link: { label: "Alle Fragen zur Produkthilfe", url: `${pathFor(store, LINKS.faqs)}#WDBRWPW` },
      feature: { kind: "category", name: "Produktfilter", url: pathFor(store, LINKS.faqs), img: PICS.filters, meta: "", number: "", children: [] },
    } : { link: { label: "", url: pathFor(store, LINKS.faqs) } }),
  }),
  gap: (s) => needGap(s, { title: true, points: 2 }),
  draw: (s, o) => {
    const steps = s.points.filter((p) => p.title.trim()).slice(0, 8);
    const below = s.layout === "below";
    const pic = s.feature?.img ? `<figure class="am-hh-p">${img(s.feature.img, o, { alt: s.feature.name })}</figure>` : "";
    return {
      html: `<div class="am-hh${below ? " is-below" : ""}${pic ? "" : " is-nopic"}"><div class="am-hh-t">${eyOf(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ph("Write the question")}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}${steps.length ? `<ol class="am-hh-s">${steps.map((p, i) => `<li><span>${i + 1}</span><div><b>${esc(p.title.trim())}</b>${p.text.trim() ? `<p>${esc(p.text.trim())}</p>` : ""}</div></li>`).join("")}</ol>` : ph("Write the steps")}${s.link.label.trim() && s.link.url ? `<a class="am-btn is-pet" href="${link(s.link.url)}">${esc(s.link.label.trim())}</a>` : ""}</div>${pic}</div>`,
      css: `
@@ .am-hh{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px;align-items:center;padding:30px 34px;border-radius:28px;background:linear-gradient(135deg,#f6f8f9,#e9edf0)}
@@ .am-hh.is-nopic{grid-template-columns:minmax(0,1fr)}
@@ .am-hh-s{display:grid;gap:8px;margin:20px 0 22px!important}
@@ .am-hh-s li{display:grid;grid-template-columns:30px minmax(0,1fr);gap:12px;align-items:start;padding:12px 14px;border-radius:14px;background:#fff;font:500 15.5px/1.4 var(--head);color:var(--ink)}
@@ .am-hh-s b{display:block;padding-top:4px;font:600 15.5px/1.3 var(--head);color:var(--ink)}
@@ .am-hh-s p{margin-top:3px!important;font:400 14px/1.45 var(--head);color:var(--txt)}
@@ .am-hh-s span{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--red);font:600 14px/1 var(--head);color:#fff}
@@ .am-hh-p{position:relative;margin:0;padding:14px;border-radius:20px;background:#fff;box-shadow:0 26px 50px -34px rgba(27,58,75,.65)}
@@ .am-hh-p img{width:100%;height:auto;border-radius:10px}
@@ .am-hh.is-below{grid-template-columns:minmax(0,1fr);gap:22px}
@@ .am-hh.is-below .am-hh-p{order:-1}
@@ .am-hh.is-below .am-hh-s{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
@media (max-width:900px){
@@ .am-hh{grid-template-columns:minmax(0,1fr);gap:18px;padding:18px 14px;border-radius:20px}
@@ .am-hh-p{order:-1;padding:8px}
@@ .am-hh.is-below .am-hh-s{grid-template-columns:minmax(0,1fr)}
}`,
    };
  },
});

/* ── search the shop ───────────────────────────────────────────────────── */

const SEARCHES = ["FFKM", "PTFE", "EPDM", "O-Ring", "Schlauch"];

const helpSearch = def({
  id: "help-search", category: "help", name: "Search the shop",
  note: "A search box that searches the shop itself, with what buyers search most underneath",
  layouts: [{ key: "band", label: "Petrol band" }, { key: "light", label: "Light" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "points", label: "Frequent searches", max: 8, item: { title: "The search words", text: "" }, links: true }],
  tags: ["search", "search box", "find", "popular searches"],
  defaults: (store) => ({
    ...(isGerman(store) ? { eyebrow: "Suche", title: "Was suchen Sie?", text: "Nach Produkttyp, Material, Abmessungen oder Anwendung - auch ohne den genauen Produktnamen oder die Artikelnummer." } : {}),
    points: SEARCHES.map((q) => ({ title: q, text: "", icon: "search", url: `${pathFor(store, LINKS.search)}?q=${encodeURIComponent(q.toLowerCase())}` })),
  }),
  draw: (s) => {
    const w = w2(s.store);
    const chips = s.points.filter((p) => p.title.trim() && p.url).slice(0, 8);
    const light = s.layout === "light";
    const action = link(pathFor(s.store, LINKS.search));
    return {
      html: `<div class="am-sr${light ? " is-light" : ""}"><div class="am-sr-t">${eyOf(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ""}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}</div>`
        + `<form class="am-sr-f" action="${action}" method="get" role="search"><span class="am-sr-i">${icon("search", 22)}</span><input type="search" name="q" placeholder="${esc(w.searchHint)}" aria-label="${esc(w.search)}" autocomplete="off"><button type="submit">${esc(w.search)}</button></form>`
        + `${chips.length ? `<div class="am-sr-c"><small>${esc(w.popular)}</small>${chips.map((p) => `<a href="${link(p.url!)}">${esc(p.title.trim())}</a>`).join("")}</div>` : ""}</div>`,
      css: `
@@ .am-sr{display:grid;justify-items:center;gap:18px;padding:40px 40px 34px;border-radius:28px;background:radial-gradient(120% 140% at 0% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%);text-align:center}
@@ .am-sr-t{max-width:760px}
@@ .am-sr .am-ey{justify-content:center;color:#cddbe3}
@@ .am-sr h2.am-h{color:#fff!important;font-size:clamp(26px,2.6vw,34px)!important}
@@ .am-sr .am-sub{margin:8px auto 0!important;color:#cddbe3}
@@ .am-sr:not(.is-light) .am-red{color:#ff6a5f}
@@ .am-sr-f{display:grid;grid-template-columns:54px minmax(0,1fr) auto;align-items:center;width:100%;max-width:780px;height:62px;padding:6px;border-radius:14px;background:#fff;box-shadow:0 22px 40px -24px rgba(0,0,0,.55)}
@@ .am-sr-i{display:grid;place-items:center;color:var(--mute)}
@@ .am-sr-f input{width:100%;height:100%;min-width:0;margin:0;padding:0 8px;border:0!important;outline:0;background:transparent;box-shadow:none!important;font:500 17px/1 var(--head);color:var(--ink);-webkit-appearance:none;appearance:none}
@@ .am-sr-f input::placeholder{color:#8b949a}
@@ .am-sr-f button{height:50px;margin:0;padding:0 26px;border:0;border-radius:10px;background:var(--red);cursor:pointer;font:600 16px/1 var(--head);color:#fff;transition:background .2s}
@@ .am-sr-f button:hover,@@ .am-sr-f button:focus-visible{background:var(--red-d)}
@@ .am-sr-f:focus-within{box-shadow:0 0 0 3px rgba(255,255,255,.35),0 22px 40px -24px rgba(0,0,0,.55)}
@@ .am-sr-c{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px}
@@ .am-sr-c small{margin-right:4px;font:600 12px/1 var(--head);letter-spacing:.12em;text-transform:uppercase;color:#9fb8c6}
@@ .am-sr-c a{padding:7px 14px;border-radius:8px;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2);font:600 14px/1.2 var(--head);color:#fff!important;transition:background .2s}
@@ .am-sr-c a:hover{background:var(--red);box-shadow:none}
@@ .am-sr.is-light{background:linear-gradient(#f6f8f9,#edf1f3)}
@@ .am-sr.is-light h2.am-h{color:var(--ink)!important}
@@ .am-sr.is-light :is(.am-sub,.am-ey){color:var(--mute)}
@@ .am-sr.is-light .am-sr-f{box-shadow:var(--card),0 16px 30px -24px rgba(27,58,75,.5)}
@@ .am-sr.is-light .am-sr-c small{color:var(--mute)}
@@ .am-sr.is-light .am-sr-c a{background:#fff;box-shadow:inset 0 0 0 1px #dbe1e5;color:var(--pet)!important}
@@ .am-sr.is-light .am-sr-c a:hover{background:var(--pet);color:#fff!important}
@media (max-width:900px){
@@ .am-sr{padding:24px 14px 22px;border-radius:20px}
@@ .am-sr-f{grid-template-columns:40px minmax(0,1fr) auto;height:54px}
@@ .am-sr-f input{font-size:15px}
@@ .am-sr-f button{height:42px;padding:0 14px;font-size:15px}
}`,
    };
  },
});

/* ── glossary ──────────────────────────────────────────────────────────── */

const GLOSSARY = [
  ...["NBR", "HNBR", "FKM", "FFKM", "EPDM", "VMQ", "PTFE"].map((k) => { const m = MATS.find((x) => x.key === k)!; return { q: k, a: `${m.props.join(", ")}. ${m.short.charAt(0).toUpperCase()}${m.short.slice(1)}` }; }),
  { q: "FEP-ummantelt", a: "Chemikalienbeständige Ummantelung mit Elastomerkern; für ausgewählte statische Dichtstellen in Pharma, Chemie und Verfahrenstechnik." },
  { q: "Shore-Härte", a: "Beeinflusst Extrusionsbeständigkeit, Verpressungsverhalten und Montage - zusammen mit Druck, Nutgeometrie und Bewegung wählen." },
  { q: "ISO 3601", a: "Wird häufig für O-Ring-Abmessungen, Toleranzen, Einbauräume, Qualitätsannahmekriterien, Stützringe und Werkstoffeignung verwendet." },
  { q: "AS568", a: "Wird häufig für O-Ringe in Zollabmessungen eingesetzt." },
];

const helpGlossary = def({
  id: "help-glossary", category: "help", name: "Glossary",
  note: "The terms buyers meet, each with its short meaning - sorted A to Z",
  layouts: [{ key: "columns", label: "Cards in columns" }, { key: "list", label: "A to Z list" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "faq", label: "The terms (the term, then what it means)", max: 12 }, { kind: "link" }],
  tags: ["glossary", "terms", "definitions", "abbreviations", "dictionary"],
  defaults: (store) => isGerman(store) ? {
    eyebrow: "Glossar", title: "Begriffe rund um den O-Ring", faq: GLOSSARY,
    link: { label: "Zur O-Ring Auswahlhilfe", url: pathFor(store, LINKS.oringGuide) },
  } : { link: { label: "", url: pathFor(store, LINKS.oringGuide) } },
  gap: (s) => needGap(s, { faq: 1 }),
  draw: (s) => {
    const terms = s.faq.filter((x) => x.q.trim() && x.a.trim()).slice(0, 12).sort((a, b) => a.q.localeCompare(b.q, "de"));
    const list = s.layout === "list";
    let prev = "";
    const items = terms.map((x) => {
      const l = x.q.trim().charAt(0).toUpperCase();
      const mark = list && l !== prev ? `<span class="am-gl-l">${esc(l)}</span>` : list ? "<span class=\"am-gl-l\"></span>" : "";
      prev = l;
      return `<div class="am-gl-e">${mark}<dt>${esc(x.q.trim())}</dt><dd>${esc(x.a.trim())}</dd></div>`;
    }).join("");
    return {
      html: `${header(s)}${terms.length ? `<dl class="am-gl${list ? " is-list" : ""}">${items}</dl>` : ph("Write the terms and what each means")}`,
      css: `
@@ .am-gl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@@ .am-gl-e{padding:18px 20px 20px;border-radius:18px;background:#fff;box-shadow:var(--card)}
@@ .am-gl dt{font:600 19px/1.2 var(--head);color:var(--pet)}
@@ .am-gl dt::after{content:"";display:block;width:22px;height:3px;margin:9px 0 9px;border-radius:2px;background:var(--red)}
@@ .am-gl dd{font-size:14.5px;line-height:1.55;color:var(--txt)}
@@ .am-gl.is-list{grid-template-columns:minmax(0,1fr);gap:0;border-top:1px solid var(--line)}
@@ .am-gl.is-list .am-gl-e{display:grid;grid-template-columns:44px 170px minmax(0,1fr);gap:18px;align-items:baseline;padding:14px 0;border-radius:0;background:none;box-shadow:none;border-bottom:1px solid var(--line)}
@@ .am-gl-l{font:600 26px/1 var(--head);color:var(--red)}
@@ .am-gl.is-list dt::after{display:none}
@@ .am-gl.is-list dd{font-size:15.5px}
@media (max-width:1100px) and (min-width:901px){@@ .am-gl{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:900px){
@@ .am-gl{grid-template-columns:minmax(0,1fr);gap:8px}
@@ .am-gl-e{padding:14px 16px}
@@ .am-gl.is-list .am-gl-e{grid-template-columns:32px minmax(0,1fr);gap:4px 10px}
@@ .am-gl.is-list dd{grid-column:2}
@@ .am-gl-l{font-size:20px;grid-row:span 2}
}`,
    };
  },
});

export const HELP = [helpTopics, helpFaqSide, helpFaqOpen, helpContact, helpHowto, helpSearch, helpGlossary];
export type { P as HelpPoint };
