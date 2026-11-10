// PAGE - THE LIBRARY, PART 2: CALLS TO ACTION & SIGN-UPS (Content v7, 10.11.2026). Pure.
//
// The next step, each to a page the shop already has: create an account, the newsletter, two next steps, a slim line, a
// request when no standard product fits, a big statement, the brochure. No new form and no new backend: every button
// opens the shop's own page (its account, newsletter and contact forms) or the shop's own PDF.

import { BROCHURES, LINKS, PICS, TECH } from "./data";
import { button, def, esc, eyOf, icon, img, isGerman, link, linesOf, marked, needGap, pathFor, ph, prose, type ModuleSettings } from "./kit";

/* ── create an account ─────────────────────────────────────────────────── */

const actAccount = def({
  id: "act-account", category: "cta", name: "Create an account",
  note: "Why an account helps, ticked off, and the two ways in: create one or sign in",
  layouts: [{ key: "split", label: "Words left, list right" }, { key: "card", label: "One centred card" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", label: "The line, then a line per advantage (\"- ...\")", rows: 8 }, { kind: "link" }, { kind: "link2" }],
  tags: ["account", "register", "sign up", "login", "customer account"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "Neu bei APSOparts?", title: "Erstellen Sie Ihr ==kostenloses== Konto",
      text: "Mit einem APSOparts® Konto sehen Sie Preise und bestellen online.\n\n- Produkte im Warenkorb speichern\n- Aktuelle und frühere Bestellungen einsehen\n- Rechnungen und Bestelldokumente herunterladen\n- Lieferadressen verwalten\n- Wunschlisten erstellen",
      link: { label: "Ein Konto erstellen", url: pathFor(store, LINKS.create) },
      link2: { label: "Anmelden", url: pathFor(store, LINKS.login) },
    } : { link: { label: "", url: pathFor(store, LINKS.create) }, link2: { label: "", url: pathFor(store, LINKS.login) } }),
  }),
  gap: (s) => needGap(s, { title: true }),
  draw: (s) => {
    const blocks = s.text.replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/);
    const lead = blocks.filter((b) => !b.trim().startsWith("-")).join("\n\n");
    const ticks = linesOf(blocks.filter((b) => b.trim().startsWith("-")).join("\n"));
    const card = s.layout === "card";
    const btns = `<div class="am-bs">${button(s.link, "am-btn")}${button(s.link2, "am-btn2")}</div>`;
    const list = ticks.length ? `<ul class="am-ac-l">${ticks.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "";
    return {
      html: `<div class="am-ac${card ? " is-card" : ""}"><div class="am-ac-t">${eyOf(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ph("Write the headline")}${lead ? `<p class="am-sub">${esc(lead)}</p>` : ""}${card ? list : ""}${btns}</div>${card ? "" : list || ph("Write the advantages, a line each")}</div>`,
      css: `
@@ .am-ac{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:44px;align-items:center;padding:36px 40px;border-radius:28px;background:linear-gradient(135deg,#f6f8f9,#e9edf0)}
@@ .am-ac h2.am-h{font-size:clamp(26px,2.6vw,36px)!important;line-height:1.12!important}
@@ .am-ac .am-sub{margin-top:10px!important;font-size:16px}
@@ .am-ac .am-bs{margin-top:24px}
@@ .am-ac-l{display:grid;gap:0;padding:8px 22px!important;border-radius:22px;background:#fff;box-shadow:var(--card)}
@@ .am-ac-l li{display:flex;align-items:center;gap:14px;padding:14px 0;border-top:1px solid #eef1f3;font:500 16.5px/1.35 var(--head);color:var(--ink)}
@@ .am-ac-l li:first-child{border-top:0}
@@ .am-ac-l li::before{content:"";flex:none;width:26px;height:26px;border-radius:50%;background:var(--red) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 12.5 4 4 8-9'/%3E%3C/svg%3E") center/15px no-repeat}
@@ .am-ac.is-card{grid-template-columns:minmax(0,1fr);justify-items:center;padding:0;background:none}
@@ .am-ac.is-card .am-ac-t{width:100%;max-width:620px;padding:36px 40px 38px;border-radius:28px;background:#fff;box-shadow:0 30px 60px -40px rgba(27,58,75,.6),inset 0 0 0 1px #edf0f2;text-align:center}
@@ .am-ac.is-card .am-ey{justify-content:center}
@@ .am-ac.is-card .am-ac-l{margin:22px 0 0!important;padding:0!important;box-shadow:none;text-align:left}
@@ .am-ac.is-card .am-bs{justify-content:center}
@media (max-width:900px){
@@ .am-ac{grid-template-columns:minmax(0,1fr);gap:18px;padding:20px 16px;border-radius:20px}
@@ .am-ac.is-card .am-ac-t{padding:22px 16px}
@@ .am-ac-l{padding:4px 14px!important}
@@ .am-ac-l li{font-size:15px;padding:11px 0}
}`,
    };
  },
});

/* ── the newsletter ────────────────────────────────────────────────────── */

const actNewsletter = def({
  id: "act-newsletter", category: "cta", name: "Newsletter",
  note: "The shop's newsletter in one band - what it brings, how many read it, the sign-up page",
  layouts: [{ key: "band", label: "Band" }, { key: "card", label: "Card with a figure" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 3 }, { kind: "points", label: "A figure (the shop's own)", max: 1, item: { title: "The figure", text: "What it counts" } }, { kind: "link" }],
  tags: ["newsletter", "sign up", "subscribe", "email"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "Newsletter", title: "Produktneuheiten und Shop-News ==zuerst==",
      text: "Der APSOparts® Newsletter: was neu im Sortiment ist und was sich im Shop und seinen Tools tut.",
      points: [{ title: "20.000+", text: "Abonnentinnen und Abonnenten", icon: "mail" }],
      link: { label: "Abonnieren", url: pathFor(store, LINKS.newsletter) },
    } : { link: { label: "", url: pathFor(store, LINKS.newsletter) } }),
  }),
  gap: (s) => needGap(s, { title: true }),
  draw: (s) => {
    const fig = s.points.find((p) => p.title.trim());
    const card = s.layout === "card";
    return {
      html: `<div class="am-nl${card ? " is-card" : ""}"><span class="am-nl-i" aria-hidden="true">${icon("mail", 34)}</span><div class="am-nl-t">${eyOf(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ph("Write the headline")}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}</div>${fig ? `<div class="am-nl-f"><b>${esc(fig.title.trim())}</b><span>${esc(fig.text.trim())}</span></div>` : ""}${button(s.link, "am-btn")}</div>`,
      css: `
@@ .am-nl{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:28px;padding:30px 36px;border-radius:26px;background:var(--pet);background:radial-gradient(120% 160% at 100% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%);overflow:hidden}
@@ .am-nl::after{content:"";position:absolute;right:-60px;top:-60px;width:220px;height:220px;border-radius:50%;border:30px solid rgba(255,255,255,.05);pointer-events:none}
@@ .am-nl-i{display:grid;place-items:center;width:76px;height:76px;border-radius:22px;background:var(--red);color:#fff;transform:rotate(-6deg);box-shadow:0 18px 30px -16px rgba(0,0,0,.5)}
@@ .am-nl h2.am-h{color:#fff!important}
@@ .am-nl :is(.am-sub,.am-ey){color:#cddbe3}
@@ .am-nl:not(.is-card) .am-red{color:#ff6a5f}
@@ .am-nl-f{padding-left:28px;border-left:1px solid rgba(255,255,255,.18)}
@@ .am-nl-f b{display:block;font:600 36px/1 var(--head);letter-spacing:-.02em;color:#fff}
@@ .am-nl-f span{display:block;margin-top:6px;max-width:150px;font:500 13px/1.35 var(--head);color:#9fb8c6}
@@ .am-nl .am-btn{position:relative;z-index:1}
@@ .am-nl.is-card{grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);grid-template-rows:auto auto;gap:18px 40px;padding:36px 40px;background:linear-gradient(135deg,#f6f8f9,#e9edf0)}
@@ .am-nl.is-card::after{border-color:rgba(39,78,100,.05)}
@@ .am-nl.is-card .am-nl-i{position:absolute;right:36px;top:30px;width:58px;height:58px;border-radius:16px}
@@ .am-nl.is-card .am-nl-t{grid-column:1;grid-row:1/span 2}
@@ .am-nl.is-card h2.am-h{color:var(--ink)!important}
@@ .am-nl.is-card :is(.am-sub,.am-ey){color:var(--mute)}
@@ .am-nl.is-card .am-nl-f{grid-column:2;grid-row:1;align-self:end;padding:0;border:0}
@@ .am-nl.is-card .am-nl-f b{font-size:52px;color:var(--red)}
@@ .am-nl.is-card .am-nl-f span{color:var(--mute)}
@@ .am-nl.is-card .am-btn{grid-column:2;grid-row:2;justify-self:start}
@media (max-width:1100px) and (min-width:901px){@@ .am-nl-f{display:none}}
@media (max-width:900px){
@@ .am-nl,@@ .am-nl.is-card{grid-template-columns:minmax(0,1fr);grid-template-rows:auto;gap:16px;padding:22px 18px;border-radius:20px}
@@ .am-nl-i{width:56px;height:56px;border-radius:16px}
@@ .am-nl.is-card .am-nl-i{position:static}
@@ .am-nl.is-card :is(.am-nl-t,.am-nl-f,.am-btn){grid-column:1;grid-row:auto}
@@ .am-nl-f{padding:0;border:0}
@@ .am-nl .am-btn{justify-self:start}
}`,
    };
  },
});

/* ── two next steps ────────────────────────────────────────────────────── */

const actPair = def({
  id: "act-pair", category: "cta", name: "Two next steps",
  note: "Two ways forward side by side, each with its icon, its line and its button",
  layouts: [{ key: "cards", label: "Two cards" }, { key: "split", label: "One band, split" }],
  fields: [{ kind: "points", label: "The two steps", min: 2, max: 2, item: { title: "Its headline", text: "Its line" }, icons: true }, { kind: "link", label: "The first button" }, { kind: "link2", label: "The second button" }],
  tags: ["call to action", "two options", "next step", "buttons"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      points: [
        { title: "Neu bei APSOparts?", text: "Erstellen Sie Ihr kostenloses Konto - Preise in Echtzeit, Bestellungen, Rechnungen und Wunschlisten an einem Ort.", icon: "user" },
        { title: "Fragen zu einem Produkt?", text: "Unser Support hilft per Chat oder E-Mail - mit Artikelnummer, Produktname und Menge geht es am schnellsten.", icon: "chat" },
      ],
      link: { label: "Ein Konto erstellen", url: pathFor(store, LINKS.create) },
      link2: { label: "Support kontaktieren", url: pathFor(store, LINKS.contact) },
    } : { points: [{ title: "", text: "", icon: "user" }, { title: "", text: "", icon: "chat" }], link: { label: "", url: pathFor(store, LINKS.create) }, link2: { label: "", url: pathFor(store, LINKS.contact) } }),
  }),
  gap: (s) => needGap(s, { points: 2 }),
  draw: (s) => {
    const p = s.points.slice(0, 2);
    const side = (i: number) => {
      const x = p[i];
      if (!x?.title.trim()) return ph(i ? "Write the second step" : "Write the first step", "am-pr-c");
      return `<div class="am-pr-c${i ? " is-b" : ""}"><span class="am-pr-i">${icon(x.icon, 26)}</span><h3>${marked(x.title.trim())}</h3>${x.text.trim() ? `<p>${esc(x.text.trim())}</p>` : ""}${button(i ? s.link2 : s.link, i ? "am-btn is-pet" : "am-btn")}</div>`;
    };
    const split = s.layout === "split";
    return {
      html: `<div class="am-pr${split ? " is-split" : ""}">${side(0)}${side(1)}</div>`,
      css: `
@@ .am-pr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
@@ .am-pr-c{display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:30px 32px 32px;border-radius:26px;background:linear-gradient(150deg,#fff3f2,#fde6e4)}
@@ .am-pr-c.is-b{background:linear-gradient(150deg,#eef4f7,#e1eaef)}
@@ .am-pr-i{display:grid;place-items:center;width:60px;height:60px;border-radius:18px;background:var(--red);color:#fff;box-shadow:0 14px 26px -16px rgba(216,9,1,.7)}
@@ .am-pr-c.is-b .am-pr-i{background:var(--pet);box-shadow:0 14px 26px -16px rgba(27,58,75,.8)}
@@ .am-pr-c h3{margin-top:6px!important;font-size:25px!important;line-height:1.15!important}
@@ .am-pr-c p{max-width:440px;font-size:15.5px;line-height:1.55;color:var(--txt)}
@@ .am-pr-c .am-btn{margin-top:auto}
@@ .am-pr-c p+.am-btn{margin-top:10px}
@@ .am-pr.is-split{gap:0;border-radius:26px;overflow:hidden;box-shadow:var(--card)}
@@ .am-pr.is-split .am-pr-c{border-radius:0;background:#fff}
@@ .am-pr.is-split .am-pr-c.is-b{background:linear-gradient(#f6f8f9,#edf1f3)}
@media (max-width:900px){
@@ .am-pr{grid-template-columns:minmax(0,1fr);gap:10px}
@@ .am-pr-c{padding:20px 18px;border-radius:20px}
@@ .am-pr-c h3{font-size:21px!important}
}`,
    };
  },
});

/* ── a slim line ───────────────────────────────────────────────────────── */

const actInline = def({
  id: "act-inline", category: "cta", name: "Slim line",
  note: "One line and a link, slim enough to sit between any two blocks",
  layouts: [{ key: "light", label: "Light" }, { key: "outline", label: "Outlined" }, { key: "red", label: "Red edge" }],
  fields: [{ kind: "title", label: "The line", red: true, max: 140 }, { kind: "points", label: "Its icon", max: 1, item: { title: "(not shown)", text: "" }, icons: true }, { kind: "link" }],
  tags: ["call to action", "inline", "strip", "hint", "slim"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      title: "Finden Sie schneller den richtigen O-Ring - mit dem neuen ==O-Ring-Auswahlleitfaden==.",
      link: { label: "Leitfaden entdecken", url: pathFor(store, LINKS.oringGuide) },
    } : { link: { label: "", url: pathFor(store, LINKS.oringGuide) } }),
    points: [{ title: "", text: "", icon: "ring" }],
  }),
  gap: (s) => needGap(s, { title: true }),
  draw: (s) => {
    const ic = s.points[0]?.icon || "arrow";
    const lay = s.layout === "outline" || s.layout === "red" ? s.layout : "light";
    const go = s.link.label.trim() && s.link.url;
    const inner = `<span class="am-in-i">${icon(ic, 22)}</span><span class="am-in-t">${s.title.trim() ? marked(s.title.trim()) : "&nbsp;"}</span>${go ? `<span class="am-in-g">${esc(s.link.label.trim())}</span>` : ""}`;
    return {
      html: s.title.trim() ? (go ? `<a class="am-in is-${lay}" href="${link(s.link.url)}">${inner}</a>` : `<div class="am-in is-${lay}">${inner}</div>`) : ph("Write the line"),
      css: `
@@ .am-in{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:16px;padding:12px 22px 12px 12px;border-radius:16px;background:linear-gradient(90deg,#f6f8f9,#edf1f3);color:var(--ink)!important;transition:box-shadow .2s,background .2s}
@@ .am-in-i{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:#fff;color:var(--red)}
@@ .am-in-t{font:500 17px/1.35 var(--head)}
@@ .am-in-g{display:inline-flex;align-items:center;gap:8px;font:600 15px/1.2 var(--head);color:var(--pet);white-space:nowrap}
@@ .am-in-g::after{content:"";width:7px;height:7px;border:solid currentColor;border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ a.am-in:hover .am-in-g::after{transform:translateX(4px) rotate(45deg)}
@@ a.am-in:hover{box-shadow:inset 0 0 0 1.5px var(--pet)}
@@ .am-in.is-outline{background:#fff;box-shadow:inset 0 0 0 1.5px #d5dce0}
@@ .am-in.is-outline .am-in-i{background:var(--soft)}
@@ .am-in.is-red{border-radius:6px 16px 16px 6px;background:#fff;box-shadow:var(--card),inset 5px 0 0 var(--red)}
@@ .am-in.is-red .am-in-i{background:#fdf0ef}
@media (max-width:900px){
@@ .am-in{grid-template-columns:38px minmax(0,1fr);gap:4px 12px;padding:12px}
@@ .am-in-i{grid-row:span 2;width:38px;height:38px}
@@ .am-in-t{font-size:15.5px}
@@ .am-in-g{grid-column:2;font-size:14px}
}`,
    };
  },
});

/* ── no standard product fits: a request ───────────────────────────────── */

const actRequest = def({
  id: "act-request", category: "cta", name: "Request a part",
  note: "When no standard product fits: what to send the shop's specialists, and the contact page",
  layouts: [{ key: "split", label: "Words left, list right" }, { key: "band", label: "Petrol band" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", label: "The line, then what to send (\"- ...\")", rows: 9 }, { kind: "link" }],
  tags: ["request", "inquiry", "contact", "special", "not found"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "Anfrage", title: "Kein passendes ==Standardprodukt== gefunden?",
      text: "Die technischen Experten von APSOparts® helfen Ihnen, eine geeignete Lösung zu identifizieren oder zu beschaffen. Bitte geben Sie an:\n\n- Produkttyp oder Anwendung\n- Erforderliche Abmessungen\n- Materialanforderungen\n- Betriebstemperatur, Druck und Medium\n- Benötigte Menge\n- Zeichnung, Foto oder vorhandene Artikelnummer",
      link: { label: "APSOparts® Support kontaktieren", url: pathFor(store, LINKS.contact) },
    } : { link: { label: "", url: pathFor(store, LINKS.contact) } }),
  }),
  gap: (s) => needGap(s, { title: true }),
  draw: (s) => {
    const blocks = s.text.replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/);
    const lead = blocks.filter((b) => !b.trim().startsWith("-")).join("\n\n");
    const items = linesOf(blocks.filter((b) => b.trim().startsWith("-")).join("\n"));
    const band = s.layout === "band";
    return {
      html: `<div class="am-rq${band ? " is-band" : ""}"><div class="am-rq-t">${eyOf(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ph("Write the headline")}${lead ? `<div class="am-sub">${prose(lead)}</div>` : ""}${button(s.link, band ? "am-btn" : "am-btn is-pet")}</div>${items.length ? `<ol class="am-rq-l">${items.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>` : ""}</div>`,
      css: `
@@ .am-rq{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:48px;align-items:center}
@@ .am-rq h2.am-h{font-size:clamp(26px,2.6vw,36px)!important;line-height:1.12!important}
@@ .am-rq .am-sub{margin:12px 0 22px!important;font-size:16px}
@@ .am-rq-l{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;counter-reset:r}
@@ .am-rq-l li{position:relative;min-height:84px;padding:16px 16px 16px 58px;border-radius:16px;background:linear-gradient(#f6f8f9,#edf1f3);font:500 15.5px/1.35 var(--head);color:var(--ink);counter-increment:r}
@@ .am-rq-l li::before{content:counter(r);position:absolute;left:16px;top:16px;display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:#fff;font:600 14px/1 var(--head);color:var(--red);box-shadow:0 6px 14px -8px rgba(27,58,75,.5)}
@@ .am-rq.is-band{padding:36px 40px;border-radius:28px;background:radial-gradient(120% 140% at 0% 0%,#2f5d76 0%,#274e64 45%,#1b3a4b 100%)}
@@ .am-rq.is-band h2.am-h{color:#fff!important}
@@ .am-rq.is-band :is(.am-sub,.am-ey){color:#cddbe3}
@@ .am-rq.is-band .am-red{color:#ff6a5f}
@@ .am-rq.is-band .am-rq-l li{background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);color:#fff}
@@ .am-rq.is-band .am-rq-l li::before{background:var(--red);color:#fff;box-shadow:none}
@media (max-width:900px){
@@ .am-rq{grid-template-columns:minmax(0,1fr);gap:18px}
@@ .am-rq.is-band{padding:20px 16px;border-radius:20px}
@@ .am-rq-l{grid-template-columns:minmax(0,1fr);gap:8px}
@@ .am-rq-l li{min-height:0;padding:13px 14px 13px 52px}
@@ .am-rq-l li::before{top:11px}
}`,
    };
  },
});

/* ── a big statement ───────────────────────────────────────────────────── */

const actStatement = def({
  id: "act-statement", category: "cta", name: "Big statement",
  note: "A large headline over a photo of the range, two buttons - the closing call of a page",
  layouts: [{ key: "photo", label: "Over a photo" }, { key: "plain", label: "Large type only" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 2 }, { kind: "feature", label: "The photo (over a photo)" }, { kind: "link" }, { kind: "link2" }],
  tags: ["statement", "closing", "banner", "call to action", "big"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "APSOparts®", title: "Entdecken Sie unser Sortiment von mehr als ==100.000 Artikeln==",
      text: "Ihr Onlineshop für Dichtungen, technische Kunststoffe und weitere Industriekomponenten - mit Preisen in Echtzeit und ohne Kleinmengenzuschlag.",
      link: { label: "Ein Konto erstellen", url: pathFor(store, LINKS.create) },
      link2: { label: "Über APSOparts®", url: pathFor(store, LINKS.about) },
    } : { link: { label: "", url: pathFor(store, LINKS.create) }, link2: { label: "", url: pathFor(store, LINKS.about) } }),
    feature: { ...TECH[0], url: pathFor(store, TECH[0].url) },
  }),
  gap: (s) => needGap(s, { title: true }),
  draw: (s, o) => {
    const photo = s.layout !== "plain" && s.feature?.img;
    return {
      html: `<div class="am-bg${photo ? " is-photo" : ""}">${photo ? img(s.feature!.img, o, { alt: "" }) : ""}<div class="am-bg-t">${eyOf(s)}${s.title.trim() ? `<h2 class="am-bg-h">${marked(s.title.trim())}</h2>` : ph("Write the headline")}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}<div class="am-bs">${button(s.link, "am-btn")}${button(s.link2, "am-btn2")}</div></div></div>`,
      css: `
@@ .am-bg{position:relative;display:grid;align-items:end;min-height:360px;padding:52px 56px;border-radius:30px;background:radial-gradient(130% 150% at 0% 0%,#2f5d76 0%,#274e64 40%,#14303f 100%);overflow:hidden}
@@ .am-bg>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
@@ .am-bg.is-photo::before{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,rgba(15,35,46,.92) 0%,rgba(15,35,46,.78) 45%,rgba(15,35,46,.15) 100%)}
@@ .am-bg-t{position:relative;z-index:2;max-width:700px}
@@ .am-bg .am-ey{color:#cddbe3}
@@ .am-bg .am-ey::before{background:#fff}
@@ h2.am-bg-h{font-size:clamp(32px,4.2vw,58px)!important;line-height:1.02!important;letter-spacing:-.025em!important;color:#fff!important}
@@ .am-bg-h .am-red{color:#ff4a3d}
@@ .am-bg .am-sub{margin-top:16px!important;max-width:560px;font-size:16.5px;color:#d6e2e8}
@@ .am-bg .am-bs{margin-top:28px}
@@ .am-bg .am-btn2{box-shadow:inset 0 0 0 2px rgba(255,255,255,.75);color:#fff!important}
@@ .am-bg .am-btn2:hover{background:rgba(255,255,255,.1)}
@@ .am-bg:not(.is-photo){min-height:0;padding:60px 56px}
@@ .am-bg:not(.is-photo)::after{content:"";position:absolute;right:-80px;bottom:-140px;width:420px;height:420px;border-radius:50%;border:56px solid rgba(255,255,255,.05)}
@media (max-width:900px){
@@ .am-bg,@@ .am-bg:not(.is-photo){min-height:0;padding:28px 20px;border-radius:20px}
@@ .am-bg.is-photo{padding-top:160px}
@@ .am-bg.is-photo::before{background:linear-gradient(180deg,rgba(15,35,46,.1) 0%,rgba(15,35,46,.85) 45%,rgba(15,35,46,.95) 100%)}
@@ h2.am-bg-h{font-size:30px!important}
}`,
    };
  },
});

/* ── the brochure ──────────────────────────────────────────────────────── */

const actBrochure = def({
  id: "act-brochure", category: "cta", name: "The brochure",
  note: "The shop's brochure: its cover, what it explains, a download in each language",
  layouts: [{ key: "split", label: "Cover beside" }, { key: "compact", label: "Compact strip" }],
  fields: [{ kind: "eyebrow" }, { kind: "title", red: true }, { kind: "text", rows: 3 }, { kind: "feature", label: "The cover" }, { kind: "faq", label: "The languages (its name, then the PDF's address)", max: 6 }, { kind: "link", label: "Or one download button" }],
  tags: ["brochure", "download", "PDF", "catalogue", "languages"],
  defaults: (store) => ({
    ...(isGerman(store) ? {
      eyebrow: "Broschüre", title: "Die wichtigsten Funktionen ==auf einen Blick==",
      text: "Die APSOparts® Broschüre erklärt die wichtigsten Funktionalitäten unseres Online-Shops.",
      faq: BROCHURES.map((b) => ({ q: b.name, a: b.url })),
    } : { faq: BROCHURES.map((b) => ({ q: b.name.slice(0, 2).toUpperCase(), a: b.url })) }),
    feature: { kind: "category", name: "APSOparts® Broschüre", url: pathFor(store, LINKS.tutorials), img: PICS.brochure, meta: "", number: "", children: [] },
  }),
  gap: (s) => needGap(s, { title: true }) || (s.faq.some((x) => x.q.trim() && link(x.a.trim()) !== "#") || (s.link.label.trim() && s.link.url) ? "" : "Add a language and its PDF's address"),
  draw: (s, o) => {
    const langs = s.faq.filter((x) => x.q.trim() && link(x.a.trim()) !== "#").slice(0, 6);
    const compact = s.layout === "compact";
    const cover = s.feature?.img ? `<figure class="am-br-c">${img(s.feature.img, o, { alt: s.feature.name })}</figure>` : ph("Pick the cover", "am-br-c");
    return {
      html: `<div class="am-br${compact ? " is-compact" : ""}">${cover}<div class="am-br-t">${eyOf(s)}${s.title.trim() ? `<h2 class="am-h">${marked(s.title.trim())}</h2>` : ""}${s.text.trim() ? `<p class="am-sub">${esc(s.text.trim())}</p>` : ""}<div class="am-br-l">${langs.map((x) => `<a href="${link(x.a.trim())}">${icon("download", 18)}<span>${esc(x.q.trim())}</span></a>`).join("") || (s.link.label.trim() && s.link.url ? `<a href="${link(s.link.url)}">${icon("download", 18)}<span>${esc(s.link.label.trim())}</span></a>` : ph("Add the languages and their PDFs"))}</div></div></div>`,
      css: `
@@ .am-br{display:grid;grid-template-columns:300px minmax(0,1fr);gap:48px;align-items:center;padding:34px 44px 34px 34px;border-radius:28px;background:linear-gradient(135deg,#f6f8f9,#e9edf0);overflow:hidden}
@@ .am-br-c{position:relative;margin:0;aspect-ratio:2481/3508;border-radius:6px;overflow:hidden;background:#fff;box-shadow:0 34px 50px -28px rgba(27,58,75,.6),0 2px 6px rgba(27,58,75,.12);transform:rotate(-3deg);transition:transform .4s}
@@ .am-br-c img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
@@ .am-br:hover .am-br-c{transform:rotate(-1deg) translateY(-4px)}
@@ .am-br .am-sub{margin-top:10px!important;font-size:16px}
@@ .am-br-l{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
@@ .am-br-l a{display:inline-flex;align-items:center;gap:8px;padding:10px 16px 10px 12px;border-radius:10px;background:#fff;box-shadow:inset 0 0 0 1px #dbe1e5;font:600 14.5px/1 var(--head);color:var(--pet)!important;transition:background .2s,color .2s,box-shadow .2s}
@@ .am-br-l a svg{color:var(--red)}
@@ .am-br-l a:hover{background:var(--pet);box-shadow:none;color:#fff!important}
@@ .am-br-l a:hover svg{color:#fff}
@@ .am-br.is-compact{grid-template-columns:96px minmax(0,1fr);gap:28px;padding:22px 28px 22px 26px}
@@ .am-br.is-compact .am-br-c{transform:rotate(-4deg)}
@@ .am-br.is-compact h2.am-h{font-size:22px!important}
@@ .am-br.is-compact .am-sub{display:none}
@@ .am-br.is-compact .am-br-l{margin-top:12px}
@@ .am-br.is-compact .am-br-l a{padding:7px 12px 7px 10px;font-size:13.5px}
@media (max-width:900px){
@@ .am-br{grid-template-columns:minmax(0,1fr);gap:22px;padding:22px 18px;border-radius:20px}
@@ .am-br-c{width:58%;justify-self:center}
@@ .am-br.is-compact{grid-template-columns:72px minmax(0,1fr);gap:16px;padding:16px}
@@ .am-br.is-compact .am-br-c{width:auto}
}`,
    };
  },
});

export const CTA = [actAccount, actNewsletter, actPair, actInline, actRequest, actStatement, actBrochure];
export type CtaSettings = ModuleSettings;
