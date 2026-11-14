// BLACK FRIDAY 2026 - THE CAMPAIGN'S OWN LOOK AS MODULES (13.11.2026). SARCLA: "create the block and the blocks of it like
// modules today on page builder" + "on Downloads you have now the real content in SVG so we can build really nice blocks
// based on it". The agency's (Moskito) delivery - LinkedIn carousel, Google/Microsoft ads in DE/EN/FR/IT/NL/PL - draws
// the campaign with the shop's REAL parts photographed on a light studio grey: an O-ring over a black plate, a bar, a
// rotary seal; the % made of a rotary seal, a clear tube and an O-ring; a customer's quote. Its photos, cut out of the
// SVGs at full size (C:\dev\black-friday-2026\tools\extract_campaign_photos.py + prep_campaign_assets.mjs), are the hub's
// own files: public/content/campaign/bf26/ - the preview shows them from the hub, Publish stores them in the hub's picture
// storage (../media.ts CAMPAIGN_PICTURE) like a page's own pictures.
//
// Three modules, drawn in HTML so the words stay words (any language, the AI and the person can write them) and the
// parts stay sharp at every width: the poster (Frame 1), the % band (Frame 3), the customer's quote (Frame 2). NEVER a
// discount value - the % is the parts, the rate is each company's own after login (the page's voucher).

import { BUTTONS, button, esc, href, langOf, marked, pic } from "../kit";
import type { FieldSpec, ModuleDef, ModuleRef, ModuleSettings, Opts } from "../types";
import { BF26_VOUCHER_CSS, BF26_VOUCHER_END, BF26_VOUCHER_START, BF26_VOUCHER_TAG, BF26_VOUCHER_TEXT } from "./bf26voucher.data";

/** The campaign's photos in the hub (served from public/, stored on Publish). */
export const BF26 = "/content/campaign/bf26/";
const part = (file: string, cls: string, w: number, h: number) => `<img class="${cls}" src="${BF26}${file}" width="${w}" height="${h}" alt="" aria-hidden="true" loading="lazy">`;
const ey = (t: string) => (t.trim() ? `<p class="am-ey">${esc(t.trim())}</p>` : "");
const both = (m: ModuleRef) => (m.settings.link.url || m.settings.link2.url ? `<div class="am-bb">${button(m.settings.link, "am-btn")}${button(m.settings.link2, "am-btn2")}</div>` : "");
// the campaign's own buttons: red, and black outlined on the studio grey (the Black Friday page's)
const CAMPAIGN_BUTTONS = `${BUTTONS}
@@ .am-bb{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
@@ .am-bb .am-btn{background:#e30613;border-radius:6px}
@@ .am-bb .am-btn:is(:hover,:focus-visible){background:#c00510}
@@ .am-bb .am-btn2{border:0;border-radius:6px;background:#fff;color:#000!important;box-shadow:inset 0 0 0 2px #000}
@@ .am-bb .am-btn2:is(:hover,:focus-visible){background:#000;color:#fff!important}`;
// the studio's light grey, lit from the top left as the photos are
const STUDIO = "radial-gradient(120% 110% at 18% 8%,#f8f8f8 0%,#eeeeee 52%,#e3e3e3 100%)";

/* ── the poster: "Black" / "Friday" (outlined), the red line in its white box, the parts around ─────── */

/** "Black Friday" -> the first word solid, the rest outlined (the campaign's two weights). */
function twoWeights(title: string): string {
  const w = title.trim().replace(/==/g, "").split(/\s+/).filter(Boolean);
  if (!w.length) return "";
  return `<span class="am-b1">${esc(w[0])}</span>${w.length > 1 ? `<span class="am-b2">${esc(w.slice(1).join(" "))}</span>` : ""}`;
}

function poster(m: ModuleRef) {
  const s = m.settings;
  const css = `${CAMPAIGN_BUTTONS}
@@ .am-bp{position:relative;isolation:isolate;min-height:560px;padding:56px 25% 60px 27%;border-radius:22px;overflow:hidden;background:${STUDIO}}
@@ .am-bp>img{position:absolute;z-index:-1;height:auto;pointer-events:none;user-select:none}
@@ .am-bp .am-pl{left:-4%;bottom:-11%;width:31%}
@@ .am-bp .am-or{left:-6%;top:31%;width:19%;z-index:0}
@@ .am-bp .am-ba{right:-9%;top:16%;width:47%}
@@ .am-bp .am-rs{right:-5%;bottom:-9%;width:27%}
@@ .am-bp .am-ey{color:#000;letter-spacing:.16em;font-weight:700}
@@ .am-bp .am-ey::before{width:34px;background:#e30613}
@@ h2.am-bt{display:flex;flex-direction:column;margin:10px 0 0!important;font-size:clamp(64px,9.4vw,124px)!important;line-height:.9!important;letter-spacing:-.01em;color:#000!important}
@@ .am-b1{font-weight:700}
@@ .am-b2{align-self:flex-start;margin-left:.62em;font-weight:500;color:transparent;-webkit-text-stroke:2px #000;paint-order:stroke}
@@ .am-bw{display:inline-block;max-width:440px;margin-top:26px!important;padding:24px 32px;border-radius:14px;background:#fff;
  font:600 clamp(19px,1.9vw,25px)/1.3 var(--head);color:#e30613;box-shadow:0 20px 40px -32px rgba(0,0,0,.45)}
@media (max-width:1100px) and (min-width:901px){@@ .am-bp{padding:48px 22% 52px 24%}}
@media (max-width:900px){
@@ .am-bp{min-height:0;padding:30px 22px 200px;border-radius:16px}
@@ .am-bp .am-pl{left:-9%;bottom:-24%;width:52%}
@@ .am-bp .am-or{left:22%;top:auto;bottom:62px;width:30%}
@@ .am-bp .am-ba{display:none}
@@ .am-bp .am-rs{right:-7%;bottom:-10%;width:42%}
@@ h2.am-bt{font-size:clamp(54px,17vw,84px)!important}
@@ .am-bw{display:block;margin-top:20px!important;padding:18px 20px;font-size:19px}
@@ .am-bb>a{flex:1 1 auto;justify-content:center}
}
@media (prefers-reduced-motion:no-preference){@@ .am-bp>img{transition:transform .8s cubic-bezier(.2,.7,.2,1)}@@ .am-bp:hover .am-ba{transform:translateX(-10px)}@@ .am-bp:hover .am-or{transform:rotate(-8deg)}}`;
  const parts = part("plate.webp", "am-pl", 900, 901) + part("oring.webp", "am-or", 900, 900) + part("bar.webp", "am-ba", 1017, 161) + part("rotary-seal.webp", "am-rs", 900, 845);
  const words = `${ey(s.eyebrow)}<h2 class="am-bt">${twoWeights(s.title)}</h2>${s.text.trim() ? `<p class="am-bw">${marked(s.text.trim())}</p>` : ""}${both(m)}`;
  return { css, html: `<div class="am-bp">${parts}<div>${words}</div></div>` };
}

/* ── the % band: the % made of parts, the words beside it ─────────────────────────────────────────── */

function percent(m: ModuleRef) {
  const s = m.settings;
  const right = (s.layout || "right") === "right";
  const css = `${CAMPAIGN_BUTTONS}
@@ .am-bf{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center;min-height:470px;border-radius:22px;overflow:hidden;background:${STUDIO}}
@@ .am-bf>i{position:relative;display:block;align-self:stretch;min-height:470px;${right ? "" : "order:-1;"}}
@@ .am-bf>i img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${right ? "34% 32%" : "62% 32%"};
  -webkit-mask-image:linear-gradient(to ${right ? "right" : "left"},transparent 0,#000 26%);mask-image:linear-gradient(to ${right ? "right" : "left"},transparent 0,#000 26%)}
@@ .am-bf>div{padding:48px ${right ? "24px 48px 56px" : "56px 48px 24px"}}
@@ .am-bf .am-ey{color:#000;letter-spacing:.16em;font-weight:700}
@@ .am-bf .am-ey::before{background:#e30613}
@@ h2.am-pt{font-size:clamp(30px,3.4vw,46px)!important;font-weight:700!important;line-height:1.12!important;color:#000!important;letter-spacing:-.01em}
@@ h2.am-pt .am-red{color:#e30613}
@@ .am-px{max-width:470px;margin-top:16px!important;font:400 17px/1.5 var(--head);color:#2a2a2a}
@media (max-width:900px){
@@ .am-bf{grid-template-columns:minmax(0,1fr);min-height:0;border-radius:16px}
@@ .am-bf>i{order:-1;min-height:0;aspect-ratio:16/10}
@@ .am-bf>i img{object-position:50% 40%;-webkit-mask-image:linear-gradient(to top,transparent 0,#000 24%);mask-image:linear-gradient(to top,transparent 0,#000 24%)}
@@ .am-bf>div{padding:22px 22px 28px}
@@ h2.am-pt{font-size:clamp(27px,8vw,36px)!important}
@@ .am-bb>a{flex:1 1 auto;justify-content:center}
}`;
  const photo = `<i><img src="${BF26}percent-crop.webp" width="1600" height="1288" alt="${esc(s.extra.alt || "")}" loading="lazy"></i>`;
  const words = `<div>${ey(s.eyebrow)}<h2 class="am-pt">${marked(s.title.trim())}</h2>${s.text.trim() ? `<p class="am-px">${esc(s.text.trim())}</p>` : ""}${both(m)}</div>`;
  return { css, html: `<div class="am-bf">${words}${photo}</div>` };
}

/* ── the customer's quote: big white quote marks, the words in italic, the name in red, the logo ─── */

/** The quote's words: **words** are its bold ones (the campaign's "sehr zufrieden", "intuitiv"). */
const boldWords = (t: string) => esc(t).replace(/\*\*([^*]{1,80})\*\*/g, "<strong>$1</strong>");

function quote(m: ModuleRef, o: Opts) {
  const s = m.settings;
  const logo = s.feature?.img ? pic(s.feature, o, true, s.feature.name || s.eyebrow)
    : (s.extra.logo || "kaufmann") === "kaufmann" ? `<img src="${BF26}logo-kaufmann.webp" width="704" height="165" alt="Kaufmann &amp; Fils SA" loading="lazy">` : "";
  const css = `
@@ .am-bq{position:relative;isolation:isolate;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:30px 48px;align-items:end;padding:64px 64px 56px;border-radius:22px;overflow:hidden;background:${STUDIO}}
@@ .am-bq::before{content:"\\201C";position:absolute;z-index:-1;left:40px;top:34px;font:700 260px/.8 var(--head);color:#fff}
@@ .am-bq blockquote{grid-column:1/-1;max-width:900px;font:italic 400 clamp(21px,2.3vw,30px)/1.42 var(--head);color:#000}
@@ .am-bq blockquote strong{font-weight:700}
@@ .am-bn{font:600 21px/1.25 var(--head);color:#e30613}
@@ .am-br{margin-top:6px!important;max-width:360px;font:400 16px/1.45 var(--head);color:#1d1d1d}
@@ .am-bl{display:flex;align-items:center;justify-content:center;min-width:300px;height:116px;padding:0 34px;border-radius:14px;background:#fff}
@@ .am-bl img{max-width:250px;max-height:56px;width:auto;height:auto}
@media (max-width:900px){
@@ .am-bq{grid-template-columns:minmax(0,1fr);gap:18px;padding:44px 22px 26px;border-radius:16px}
@@ .am-bq::before{left:12px;top:24px;font-size:170px}
@@ .am-bl{min-width:0;height:88px}
}`;
  const html = `<figure class="am-bq">${s.text.trim() ? `<blockquote>${boldWords(s.text.trim())}</blockquote>` : ""}`
    + `<figcaption>${s.title.trim() ? `<p class="am-bn">${esc(s.title.trim())}</p>` : ""}${s.eyebrow.trim() ? `<p class="am-br">${esc(s.eyebrow.trim())}</p>` : ""}</figcaption>`
    + `${logo ? `<span class="am-bl">${logo}</span>` : ""}</figure>`;
  return { css, html };
}

/* ── the voucher: the company's own code after login - its logic where it is (13.11.2026) ─────────────────────────── */
// SARCLA 13.11.2026: "can we bring [the voucher] as a module with the railway logic?" - "if it works perfectly yes". The
// pasted block's markup in the module's language and its CSS (C:/dev/black-friday-2026/tools/gen_bf_page.py writes
// ./bf26voucher.data.ts from the same texts), and ONE script tag: its engine, a file of the hub stored in the hub's own
// picture storage at Publish (../../../../../../convert/trustedScripts.ts - the only script a change may carry). The
// engine asks the Ads Gateway on Railway for the company's code after login, exactly as the pasted block does - the
// gateway is not touched. The hub's preview runs no script: it shows the card as a visitor sees it before login.

const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/><circle cx="12" cy="15.5" r="1.3" fill="#fff"/></svg>';
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const voucherText = (store: string) => BF26_VOUCHER_TEXT[langOf(store)] ?? BF26_VOUCHER_TEXT.en;
/** The store view's own page of the shop (its customer account pages): https://www.apsoparts.com/<store>/<rest>. */
const shopPage = (store: string, rest: string) => `https://www.apsoparts.com/${String(store).split("/")[0] || "en-INT"}/${rest}`;

/** A new voucher's words: the campaign's own, in the store view's language (the pasted block's). */
function voucherDefaults(store: string): Partial<ModuleSettings> {
  const T = voucherText(store);
  return {
    eyebrow: T.eyebrow, title: T.sub.replace(T.hl, `==${T.hl}==`), text: T.lead,
    link: { label: T.register, url: shopPage(store, "customer/account/create/") },
    link2: { label: T.login, url: shopPage(store, "customer/account/login/") },
    extra: { small: T.small },
  };
}

function voucher(m: ModuleRef) {
  const s = m.settings;
  const lang = langOf(s.store);
  const T = voucherText(s.store);
  const lng = BF26_VOUCHER_TEXT[lang] ? lang : "en";
  const sub = esc(s.title.trim() || T.sub.replace(T.hl, `==${T.hl}==`)).replace(/==([^=]{1,60})==/g, "<em>$1</em>");
  const units = T.units.map((u) => `<div class="apbf-count-box"><b>0</b><small>${esc(u)}</small></div>`).join("");
  const steps = T.steps.map((x) => `<li>${esc(x)}</li>`).join("");
  const reg = s.link.label.trim() && s.link.url ? `<a class="apbf-btn apbf-btn-primary" href="${href(s.link.url)}">${esc(s.link.label.trim())} ${ARROW}</a>` : "";
  const log = s.link2.label.trim() && s.link2.url ? `<a class="apbf-btn apbf-btn-ghost" id="apbf-login" href="${href(s.link2.url)}">${esc(s.link2.label.trim())}</a>` : "";
  const small = (s.extra.small || T.small).trim();
  // the block sits in the module's own width (the engine still fits it to the search bar's on desktop)
  // the kit's shared rules (headings 600 and ink, paragraphs without margins) give the block's own back: its type and air
  const css = `${BF26_VOUCHER_CSS}
@@ .apbf{margin:0 auto;padding:0}
@@ .apbf .apbf-word{font-size:clamp(54px,7.6vw,104px)!important;font-weight:800!important;line-height:.92!important;margin:14px 0 22px!important;color:#000!important}
@@ .apbf .apbf-sub{margin:0 0 10px!important}
@@ .apbf .apbf-lead{margin:0 0 26px!important}
@@ .apbf .apbf-small{margin:10px 0 0!important}`;
  const html = `<div class="apbf" id="apbf" data-lang="${lng}" data-start="${BF26_VOUCHER_START}" data-end="${BF26_VOUCHER_END}" data-starts="${esc(T.starts)}" data-ends="${esc(T.ends)}">`
    + `<section class="apbf-hero"><div>`
    + `${s.eyebrow.trim() ? `<div class="apbf-eyebrow">${esc(s.eyebrow.trim())}</div>` : ""}`
    + `<h2 class="apbf-word">Black<span>Friday</span></h2>`
    + `<p class="apbf-sub">${sub}</p>${s.text.trim() ? `<p class="apbf-lead">${esc(s.text.trim())}</p>` : ""}`
    + `${reg || log ? `<div class="apbf-actions">${reg}${log}</div>` : ""}`
    + `<div class="apbf-count"><span class="apbf-count-label">${esc(T.starts)}</span><div class="apbf-count-boxes">${units}</div></div>`
    + `<div class="apbf-ended" style="display:none">${esc(T.ended)}</div></div>`
    + `<div class="apbf-stage"><img class="apbf-art" src="${BF26}percent-art.webp" width="546" height="400" alt="">`
    + `<div class="apbf-slot" id="apbf-slot"><div class="apbf-ticket" aria-label="${esc(T.locked)}: ${esc(T.hint)}">`
    + `<div class="apbf-part apbf-cut-b apbf-ticket-top"><div class="apbf-ticket-brand">APSOparts · <b>Black Friday</b></div><div class="apbf-lock">${LOCK}</div>`
    + `<div class="apbf-ticket-label">${esc(T.locked)}</div><div class="apbf-dots" aria-hidden="true">•••••••</div><div class="apbf-ticket-hint" aria-live="polite">${esc(T.hint)}</div></div>`
    + `<div class="apbf-part apbf-cut-t apbf-ticket-foot">${esc(T.valid)}</div></div></div></div></section>`
    + `<ol class="apbf-steps apbf-locked-only">${steps}</ol>${small ? `<p class="apbf-small">${esc(small)}</p>` : ""}</div>`
    + BF26_VOUCHER_TAG;
  return { css, html };
}

/* ── the library's entries ──────────────────────────────────────────────────────────────────────── */

const F = {
  dates: { kind: "eyebrow", label: "Small line above (the dates)", max: 40 } as FieldSpec,
  link: { kind: "link", label: "Button" } as FieldSpec,
  link2: { kind: "link2", label: "Second button" } as FieldSpec,
};

export const BF26_MODULES: ModuleDef[] = [
  {
    id: "campaign-bf-poster", category: "campaigns", name: "Black Friday poster (campaign photos)",
    note: "The campaign's own poster: \"Black\" solid and \"Friday\" outlined, its line in red on a white box, the real parts around it (O-ring, plate, bar, rotary seal)",
    needs: ["text"], takes: "none", min: 0, max: 0, layouts: [],
    fields: [F.dates, { kind: "title", label: "Headline (two words: the first solid, the rest outlined)", max: 30 }, { kind: "text", label: "Line in the white box (red)", max: 90, rows: 2 }, F.link, F.link2],
    render: poster, tags: ["black friday", "poster", "campaign photos", "parts", "outline", "moskito"],
    from: "the agency's Black Friday carousel, frame 1 (13.11.2026)",
    sample: {
      eyebrow: "16.11. - 06.12.2026", title: "Black Friday", text: "Smarter einkaufen und exklusive Angebote sichern.",
      link: { label: "Jetzt registrieren", url: "https://www.apsoparts.com/de-CH/customer/account/create/" },
      link2: { label: "Bereits Kunde? Anmelden", url: "https://www.apsoparts.com/de-CH/customer/account/" },
    },
  },
  {
    id: "campaign-bf-percent", category: "campaigns", name: "The % made of parts (campaign photo)",
    note: "The campaign's % laid with a rotary seal, a clear tube and an O-ring - the words beside it, the marked ones in red",
    needs: ["text"], takes: "none", min: 0, max: 0,
    layouts: [{ key: "right", label: "Photo on the right" }, { key: "left", label: "Photo on the left" }],
    fields: [{ kind: "eyebrow", label: "Small line above", max: 40 }, { kind: "title", label: "Headline (==words== in red)", max: 120, red: true }, { kind: "text", label: "Line under it", max: 220, rows: 2 }, F.link, F.link2,
      { kind: "extra", key: "alt", label: "What the photo shows (for search engines)", max: 140 }],
    render: (m) => percent(m), tags: ["black friday", "percent", "campaign photo", "parts", "o-ring", "rotary seal"],
    from: "the agency's Black Friday carousel, frame 3 (13.11.2026)",
    sample: {
      eyebrow: "Black Friday", title: "Kaufen Sie smarter ein - mit ==Echtzeit-Lagerbeständen== und ==Black-Friday==-Angeboten.",
      link: { label: "Zu den O-Ringen", url: "https://www.apsoparts.com/de-CH/dichtungstechnik/o-ringe-x-ringe.html" },
      extra: { alt: "Ein Prozentzeichen aus einem Radialwellendichtring, einem klaren Schlauch und einem O-Ring" },
    },
  },
  {
    id: "campaign-bf-quote", category: "campaigns", name: "Customer quote (campaign look)",
    note: "A customer's words in italic under big white quote marks, the name in red, the role, the company's logo on white",
    needs: ["text"], takes: "none", min: 0, max: 0, layouts: [],
    fields: [
      { kind: "text", label: "The quote (**words** in bold)", max: 600, rows: 6 },
      { kind: "title", label: "Name", max: 60 },
      { kind: "eyebrow", label: "Role and company", max: 120 },
      { kind: "feature", label: "Logo (empty: Kaufmann's)", hint: "Another customer's logo: a picture from the hub's pictures." },
      { kind: "extra", key: "logo", label: "Logo", options: [{ key: "kaufmann", label: "Kaufmann & Fils SA" }, { key: "none", label: "None" }] },
    ],
    render: quote, tags: ["black friday", "quote", "testimonial", "customer", "trust", "kaufmann"],
    from: "the agency's Black Friday carousel, frame 2 (13.11.2026) - the customer's own words",
    sample: {
      text: "Wir arbeiten seit mehreren Jahren mit APSOparts zusammen und sind mit der Qualität ihrer Produkte sowie mit dem Kundenservice **sehr zufrieden**. Der Webshop ist umfassend, **intuitiv** und zuverlässig. Eine zuverlässige und professionelle Zusammenarbeit.",
      title: "Delphine Marti-Kaufmann", eyebrow: "Sales Manager, IT and General Services, Kaufmann & Fils SA",
    },
  },
  {
    id: "campaign-bf-voucher", category: "campaigns", name: "Black Friday voucher (the company's code after login)",
    note: "The campaign's voucher: countdown, the code after login from the Ads Gateway (Railway, unchanged), the three steps and the small print. The code works on the shop, not in this preview; in an A/B test version it stays as before login",
    // it needs nothing: a new one brings the campaign's own words in its store view's language (voucherDefaults)
    needs: [], takes: "none", min: 0, max: 0, layouts: [],
    fields: [
      { kind: "eyebrow", label: "The dates line", max: 60 },
      { kind: "title", label: "The offer (==words== in red)", max: 90, red: true },
      { kind: "text", label: "Line under it", max: 200, rows: 2 },
      { kind: "link", label: "Register button" },
      { kind: "link2", label: "Sign-in button" },
      { kind: "extra", key: "small", label: "Small print", max: 400 },
    ],
    defaults: voucherDefaults, render: (m) => voucher(m),
    tags: ["black friday", "voucher", "code", "coupon", "countdown", "login"],
    from: "the pasted Black Friday block (bf-page-all.html), its engine moved to the hub's storage (13.11.2026)",
    sample: voucherDefaults("de-CH"),
  },
];
