// HEROES & INTROS (Content v7, 10.11.2026; SARCLA point 1: "more than 100 modules, by category, really high end"). The top
// of a page: a headline that says what the page is, a picture of the shop's own, the first step. Calm, product-first, the
// shop's red only on the button and the marked words. Drawn with the kit (../kit.ts); rules under `@@`.

import { BUTTONS, button, esc, href, icon, marked, pic } from "../kit";
import type { FieldSpec, ModuleDef, ModuleRef, Opts } from "../types";

const F = {
  eyebrow: { kind: "eyebrow", label: "Small line above", max: 40 } as FieldSpec,
  title: { kind: "title", label: "Headline", max: 90, red: true } as FieldSpec,
  text: { kind: "text", label: "Line under it", max: 260, rows: 3 } as FieldSpec,
  link: { kind: "link", label: "Button" } as FieldSpec,
  link2: { kind: "link2", label: "Second button" } as FieldSpec,
  feature: { kind: "feature", label: "Picture" } as FieldSpec,
  promises: { kind: "points", label: "Promises under the buttons", max: 3, item: { title: "Words", text: "" }, hint: "Short and true - the shop's own promises." } as FieldSpec,
};

const promises3 = (store: string) => {
  const de = store.startsWith("de");
  return de
    ? [{ title: "Keine Zuschläge für Kleinbestellungen", text: "", icon: "check" }, { title: "Preise und Verfügbarkeit in Echtzeit", text: "", icon: "check" }, { title: "Zuschnitte nach Mass", text: "", icon: "check" }]
    : [{ title: "No surcharge for small orders", text: "", icon: "check" }, { title: "Real-time prices and availability", text: "", icon: "check" }, { title: "Cut-to-size", text: "", icon: "check" }];
};

/** The words of a hero: small line, headline (h2 - the page keeps its own h1), the line, the buttons. */
function words(m: ModuleRef, cls = "am-hw"): string {
  const s = m.settings;
  return `<div class="${cls}">${s.eyebrow.trim() ? `<p class="am-ey">${esc(s.eyebrow.trim())}</p>` : ""}<h2 class="am-hh">${marked(s.title.trim())}</h2>`
    + `${s.text.trim() ? `<p class="am-hx">${esc(s.text.trim())}</p>` : ""}`
    + `${s.link.url || s.link2.url ? `<div class="am-hb">${button(s.link, "am-btn")}${button(s.link2, "am-btn2")}</div>` : ""}`
    + `${s.points.some((p) => p.title.trim()) ? `<ul class="am-hp">${s.points.filter((p) => p.title.trim()).slice(0, 3).map((p) => `<li>${icon("check", 16)}${esc(p.title.trim())}</li>`).join("")}</ul>` : ""}</div>`;
}

const WORDS_CSS = `
@@ h2.am-hh{font-size:clamp(28px,3.3vw,46px)!important;line-height:1.08!important;letter-spacing:-.018em}
@@ .am-hx{margin-top:16px!important;max-width:520px;font-size:17px;line-height:1.6;color:var(--txt)}
@@ .am-hb{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
@@ .am-hp{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:26px!important;padding-top:18px!important;border-top:1px solid rgba(29,35,38,.1)}
@@ .am-hp li{display:flex;align-items:center;gap:7px;font:500 13.5px/1.3 var(--head);color:var(--ink)}
@@ .am-hp svg{flex:none;width:18px;height:18px;padding:3px;border-radius:50%;background:#fdf0ef;color:var(--red);stroke-width:2.4}
@media (max-width:900px){@@ .am-hx{font-size:15.5px;margin-top:12px!important}@@ .am-hb{margin-top:20px}@@ .am-hb>a{flex:1 1 auto;justify-content:center}@@ .am-hp{flex-direction:column;gap:8px;margin-top:20px!important;padding-top:14px!important}}`;

/* ── split: the words beside the picture ──────────────────────────────── */

function split(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const p = s.feature;
  const left = s.layout === "left";
  const cap = p && p.name.trim() && p.url ? `<a class="am-sc" href="${href(p.url)}"><b>${esc(p.name)}</b>${p.meta ? `<em>${esc(p.meta)}</em>` : ""}</a>` : "";
  const css = `${BUTTONS}${WORDS_CSS}
@@ .am-sp{display:grid;grid-template-columns:${left ? "minmax(0,1.08fr) minmax(0,1fr)" : "minmax(0,1fr) minmax(0,1.08fr)"};min-height:440px;border-radius:28px;overflow:hidden;background:linear-gradient(160deg,#f7f9fa 0%,#edf1f3 100%)}
@@ .am-hw{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:52px 56px}
@@ .am-sf{position:relative;min-height:320px;background:var(--tile);${left ? "order:-1;" : ""}}
@@ .am-sf img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}
@@ .am-sf.is-prod{background:#fff}
@@ .am-sf.is-prod img{left:10%;top:8%;width:80%;height:84%;object-fit:contain;mix-blend-mode:multiply}
@@ .am-sc{position:absolute;${left ? "right" : "left"}:18px;bottom:18px;display:flex;flex-direction:column;gap:1px;padding:11px 40px 12px 15px;border-radius:14px;background:rgba(255,255,255,.9);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 12px 28px -14px rgba(27,58,75,.5),inset 0 0 0 1px rgba(255,255,255,.8);color:var(--ink)!important;transition:transform .2s}
@@ .am-sc b{font:600 15.5px/1.2 var(--head)}
@@ .am-sc em{font:500 12.5px/1.3 var(--head);font-style:normal;color:var(--mute)}
@@ .am-sc::after{content:"";position:absolute;right:16px;top:50%;width:7px;height:7px;margin-top:-4px;border:solid var(--red);border-width:1.8px 1.8px 0 0;transform:rotate(45deg);transition:transform .2s}
@@ .am-sc:hover{transform:translateY(-2px)}
@@ .am-sc:hover::after{transform:translateX(3px) rotate(45deg)}
@media (max-width:1100px) and (min-width:901px){@@ .am-hw{padding:40px 36px}@@ .am-sp{min-height:400px}}
@media (max-width:900px){
@@ .am-sp{grid-template-columns:minmax(0,1fr);min-height:0;border-radius:20px}
@@ .am-sf{order:-1;min-height:0;aspect-ratio:16/10}
@@ .am-hw{padding:24px 20px 26px}
@@ .am-sc{left:12px;right:auto;bottom:12px;padding:9px 36px 10px 12px}
}`;
  return { css, html: `<div class="am-sp">${words(m)}${p ? `<div class="am-sf${p.kind === "product" ? " is-prod" : ""}">${pic(p, o, false)}${cap}</div>` : ""}</div>` };
}

/* ── cover: the picture fills, the words on a petrol veil ─────────────── */

function cover(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const p = s.feature;
  const centre = s.layout === "centre";
  const css = `${BUTTONS}${WORDS_CSS}
@@ .am-cv{position:relative;display:flex;align-items:${centre ? "center" : "flex-end"};justify-content:${centre ? "center" : "flex-start"};min-height:480px;border-radius:28px;overflow:hidden;background:var(--pet-d);isolation:isolate}
@@ .am-cv>img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;z-index:-2}
@@ .am-cv::before{content:"";position:absolute;inset:0;z-index:-1;background:${centre
    ? "radial-gradient(70% 90% at 50% 50%,rgba(20,44,58,.78) 0%,rgba(20,44,58,.55) 55%,rgba(20,44,58,.25) 100%)"
    : "linear-gradient(90deg,rgba(20,44,58,.92) 0%,rgba(20,44,58,.72) 38%,rgba(20,44,58,.12) 72%,rgba(20,44,58,0) 100%)"}}
@@ .am-hw{max-width:${centre ? "720px" : "600px"};padding:56px 60px;${centre ? "text-align:center;align-items:center;" : ""}display:flex;flex-direction:column;align-items:${centre ? "center" : "flex-start"}}
@@ .am-ey{color:#d5e1e8}
@@ .am-ey::before{background:#fff}
@@ h2.am-hh{color:#fff!important}
@@ .am-hx{color:#dbe6ec}
@@ .am-hb{${centre ? "justify-content:center;" : ""}}
@@ .am-hp{border-top-color:rgba(255,255,255,.22);${centre ? "justify-content:center;" : ""}}
@@ .am-hp li{color:#fff}
@@ .am-hp svg{background:rgba(255,255,255,.16);color:#fff}
@@ .am-red{color:#ff6a5f}
@media (max-width:900px){
@@ .am-cv{display:block;min-height:0;border-radius:20px;background:var(--pet-d)}
@@ .am-cv>img{position:relative;display:block;height:auto;aspect-ratio:16/10;z-index:0}
@@ .am-cv::before{inset:auto 0 0 0;top:0;height:auto;aspect-ratio:16/10;z-index:1;background:linear-gradient(180deg,rgba(20,44,58,0) 55%,rgba(27,58,75,1) 100%)}
@@ .am-hw{position:relative;z-index:2;max-width:none;margin-top:-28px;padding:0 20px 26px;text-align:left;align-items:flex-start}
@@ .am-hb,@@ .am-hp{justify-content:flex-start}
}`;
  return { css, html: `<div class="am-cv is-dark">${p ? pic(p, o, false) : ""}${words(m)}</div>` };
}

/* ── the entries ──────────────────────────────────────────────────────── */

const heroDefaults = (store: string) => ({ link: { label: store.startsWith("de") ? "Zum Sortiment" : "To the range", url: "" }, points: promises3(store) });

export const HEROES: ModuleDef[] = [
  {
    id: "hero-split", category: "heroes", name: "Hero beside a picture", note: "A big headline, a line and two buttons beside a photo of the shop, its name on a glass label",
    needs: ["text", "picture"], takes: "none", min: 0, max: 0,
    layouts: [{ key: "right", label: "Picture right" }, { key: "left", label: "Picture left" }],
    fields: [F.eyebrow, F.title, F.text, F.link, F.link2, F.feature, F.promises], defaults: heroDefaults, render: split,
    tags: ["hero", "intro", "top", "split", "picture"],
    sample: {
      eyebrow: "Dichtungstechnik", title: "O-Ringe in ==jeder Grösse==, ab Lager bestellt",
      text: "31 Produkte und 31.264 Artikel - vom Standard-NBR bis FFKM. Mit Preisen, Lieferzeiten und Verfügbarkeit in Echtzeit.",
      link: { label: "Zu den O-Ringen", url: "https://www.apsoparts.com/de-CH/dichtungstechnik/o-ringe-x-ringe.html" },
      link2: { label: "Schnellbestellung", url: "https://www.apsoparts.com/de-CH/quickorder/" },
      feature: { kind: "category", name: "O-Ringe / X-Ringe", url: "https://www.apsoparts.com/de-CH/dichtungstechnik/o-ringe-x-ringe.html", img: "https://www.apsoparts.com/media/wysiwyg/1_ORings_XRings_1.jpg", meta: "31 Produkte", number: "", children: [] },
    },
  },
  {
    id: "hero-cover", category: "heroes", name: "Hero over a picture", note: "The photo fills the width; the headline and the buttons stand on a petrol veil",
    needs: ["text", "picture"], takes: "none", min: 0, max: 0,
    layouts: [{ key: "left", label: "Words left" }, { key: "centre", label: "Words in the middle" }],
    fields: [F.eyebrow, F.title, F.text, F.link, F.link2, F.feature, F.promises], defaults: heroDefaults, render: cover,
    tags: ["hero", "cover", "full", "photo", "dark"],
    sample: {
      eyebrow: "Kunststofftechnik", title: "Technische Kunststoffe, ==zugeschnitten== nach Mass",
      text: "Platten, Rundstäbe und Rohre - mit dem DirectCUT Konfigurator nach Mass zugeschnitten.",
      link: { label: "Zur Kunststofftechnik", url: "https://www.apsoparts.com/de-CH/kunststofftechnik.html" },
      link2: { label: "DirectCUT", url: "https://www.apsoparts.com/de-CH/service/directcut-configurator" },
      feature: { kind: "category", name: "Kunststofftechnik", url: "https://www.apsoparts.com/de-CH/kunststofftechnik.html", img: "https://www.apsoparts.com/media/wysiwyg/2_EngeneeringPlasticsTechnology_1.jpg", meta: "", number: "", children: [] },
    },
  },
];
