// PAGE - A NEW PAGE DRAWN FROM ITS FIELDS (08.11.2026). Pure: tests/studio-page-newpage.test.ts.
//
// One renderer for the preview and for Magento, so what the studio shows is what the shop gets. The look is the shop's:
// petrol headings, the shop's red only for small accents and the buttons, futura-pt (Jost where the hub cannot load
// it), white cards on the shop's light grey, generous space, and a phone layout below 768 px. Every rule hangs under
// .apx-np, with !important only where the shop's theme styles the same elements (h1, h2, p, a, details).
//
// In the preview (`marks`), every element says which field it is (data-apx-f="hero.title") and each block which part
// it is (data-apx-b="sections.ab12"), so a click in the preview selects it; an empty part shows as a quiet dashed slot
// to click. Nothing of that reaches Magento.

import { blockOrder, type BlockBg, type ButtonLook, type Fields, type Look, type Pic } from "./fields";
import { kindOf as moduleKind, moduleGap } from "./modules/model";
import { renderModule } from "./modules/render";

export type InsertHtml = { id: string; where: "top" | "after-intro" | "bottom"; html: string; label?: string };
export type RenderOpts = {
  marks?: boolean;
  inserts?: InsertHtml[];
  /** a picture's address as it is written (the preview makes the hub's own absolute; the paste names Magento's media) */
  picture?: (url: string) => string;
  link?: (url: string) => string;
  /** the preview only (`marks`): what the AI is writing now - those blocks and fields shimmer - and the pictures being
   * made (SARCLA 08.11.2026: "an AI animation as soon as it starts working") */
  busy?: { blocks?: string[]; fields?: string[]; pictures?: string[]; tuning?: string[] };
  /** the preview only (`marks`), for someone who may change the page: the "+" between blocks and in a block with items */
  adds?: boolean;
};

export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ARROW = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/** Plain words as HTML: a blank line = a new paragraph, lines starting "- " = a list, a line break kept. */
export function wordsHtml(text: string): string {
  const blocks = text.replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/);
  return blocks.map((b) => {
    const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length && lines.every((l) => /^[-•–]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${esc(l.replace(/^[-•–]\s+/, ""))}</li>`).join("")}</ul>`;
    return `<p>${lines.map(esc).join("<br>")}</p>`;
  }).join("");
}

const DEFAULT_BG: Record<string, BlockBg> = { hero: "grey", cta: "petrol" };

export function renderNewPage(f: Fields, o: RenderOpts = {}): { css: string; html: string } {
  const m = !!o.marks;
  const pic = o.picture ?? ((u: string) => u);
  const link = o.link ?? ((u: string) => u);
  const lk = (path: string): Look => f.looks[path] ?? {};
  const busyB = new Set(m ? o.busy?.blocks ?? [] : []);
  const busyF = new Set(m ? o.busy?.fields ?? [] : []);
  const making = new Set(m ? o.busy?.pictures ?? [] : []);
  const tuning = new Set(m ? o.busy?.tuning ?? [] : []);
  const fa = (path: string) => (m ? ` data-apx-f="${esc(path)}"${busyF.has(path) ? " data-apx-busy" : ""}` : "");
  const ba = (path: string) => (m ? ` data-apx-b="${esc(path)}"${busyB.has(path) ? " data-apx-busy" : ""}` : "");
  const textCls = (path: string, base: string) => {
    const l = lk(path);
    return [base, l.size ? `apx-np-s-${l.size}` : "", l.align === "center" ? "apx-np-ac" : "", l.color ? `apx-np-c-${l.color}` : ""].filter(Boolean).join(" ");
  };
  const bgOf = (path: string, fallback: BlockBg = "white") => lk(path).bg ?? DEFAULT_BG[path] ?? fallback;
  const slot = (path: string, hint: string, tag = "div") => (m ? `<${tag} class="apx-np-slot"${fa(path)}>${esc(hint)}</${tag}>` : "");
  const one = (path: string, tag: string, base: string, value: string, hint: string) =>
    value.trim() ? `<${tag} class="${textCls(path, base)}"${fa(path)}>${esc(value.trim())}</${tag}>` : slot(path, hint, tag === "h1" || tag === "h2" || tag === "h3" ? "div" : tag);
  const many = (path: string, base: string, value: string, hint: string) =>
    value.trim() ? `<div class="${textCls(path, base)}"${fa(path)}>${wordsHtml(value)}</div>` : slot(path, hint);
  const button = (path: string, b: { label: string; url: string }, hint: string) => {
    if (!b.label.trim()) return m ? `<div class="apx-np-btns">${slot(path, hint, "span")}</div>` : "";
    const look: ButtonLook = lk(path).button ?? (path === "cta.button" && bgOf("cta") === "petrol" ? "red" : "red");
    const href = b.url ? link(b.url) : "#";
    return `<div class="apx-np-btns${lk(path).align === "center" ? " apx-np-ac" : ""}"><a class="apx-np-btn apx-np-btn-${look}" href="${esc(href)}"${fa(path)}>${esc(b.label.trim())}${ARROW}</a></div>`;
  };
  const picture = (path: string, p: Pic, hint: string) => {
    // the studio's slot (the flow standard, 09.11.2026): empty - the idea in small grey words, "Make it" and "Upload";
    // being made - "Making the picture…" over a moving bar (the studio's marks only, never in Magento's copy)
    if (!p.url && making.has(path)) return `<div class="apx-np-pic apx-np-pic-empty"${fa(path)} data-apx-making><span>Making the picture…</span><i class="apx-np-bar"></i></div>`;
    // a picture there being made again or fine-tuned (Content v5): it stays in view, veiled, the bar moving over it
    if (p.url && (making.has(path) || tuning.has(path))) return `<div class="apx-np-pic"${fa(path)} data-apx-making-over><img src="${esc(pic(p.url))}" alt="${esc(p.alt)}" loading="lazy"><span class="apx-np-veil">${tuning.has(path) ? "Fine-tuning the picture…" : "Making a new picture…"}</span><i class="apx-np-bar"></i></div>`;
    if (!p.url) return m ? `<div class="apx-np-pic apx-np-pic-empty"${fa(path)}><span class="apx-np-slot"><span class="apx-np-idea">${esc(p.idea.trim() ? `Idea: ${p.idea.trim().slice(0, 160)}${p.idea.trim().length > 160 ? "…" : ""}` : hint)}</span><span class="apx-np-acts">${p.idea.trim() ? `<b data-apx-act="make">Make it</b>` : ""}<b data-apx-act="upload">Upload</b></span></span></div>` : "";
    return `<div class="apx-np-pic"${fa(path)}><img src="${esc(pic(p.url))}" alt="${esc(p.alt)}" loading="lazy"></div>`;
  };
  const inserts = (where: InsertHtml["where"]) => (o.inserts ?? []).filter((x) => x.where === where)
    .map((x) => `<div class="apx-np-ins"${m ? ` data-apx-insert="${esc(x.id)}"` : ""}>${x.html}</div>`).join("");
  // the studio's "+" (Content v5: SARCLA "add more elements by + next to sections, or in the photo"): between two blocks
  // a + that shows on hover ("Add a block here"), and in a block with items "+ Tile" / "+ Link" / "+ Question"
  const adds = m && !!o.adds;
  const addItem = (list: string, label: string, tag = "div") => (adds ? `<${tag} class="apx-np-additem" data-apx-additem="${list}">+ ${label}</${tag}>` : "");

  const h = f.hero;
  const c = f.cta;
  const links = f.links.filter((l) => l.label.trim() || m);
  const secIndex = new Map(f.sections.map((s, i) => [s.id, i]));
  const block = (key: string): string => {
    // the hero
    if (key === "hero") {
      const heroPic = picture("hero.picture", h.picture, "Hero picture - upload one, or let the AI write this part");
      const heroHasPic = !!h.picture.url || m;
      return `<section class="apx-np-blk apx-np-hero apx-np-bg-${bgOf("hero")}${heroHasPic ? "" : " apx-np-hero-solo"}"${ba("hero")}><div class="apx-np-in">
<div class="apx-np-hero-t">${h.eyebrow.trim() ? `<div class="${textCls("hero.eyebrow", "apx-np-eb")}"${fa("hero.eyebrow")}>${esc(h.eyebrow.trim())}</div>` : m ? slot("hero.eyebrow", "Small line above the title", "div") : ""}
${one("hero.title", "h1", "apx-np-h1", h.title, "The page's title (its H1)")}
${many("hero.sub", "apx-np-sub", h.sub, "One or two lines under the title")}
${button("hero.button", h.button, "A button")}</div>
${heroHasPic ? heroPic : ""}</div></section>`;
    }
    // the intro
    if (key === "intro") {
      return f.intro.trim() || m ? `<section class="apx-np-blk apx-np-intro apx-np-bg-${bgOf("intro-block")}"${ba("intro-block")}><div class="apx-np-in">${many("intro", "apx-np-lead", f.intro, "An intro paragraph: what the visitor finds on this page")}</div></section>` : "";
    }
    // the proof tiles
    if (key === "benefits") {
      if (f.benefits.length) {
        return `<section class="apx-np-blk apx-np-bens apx-np-bg-${bgOf("benefits")}"${ba("benefits")}><div class="apx-np-in">
${f.benefitsTitle.trim() ? one("benefitsTitle", "h2", "apx-np-h2", f.benefitsTitle, "") : m ? slot("benefitsTitle", "A heading for the benefits") : ""}
<div class="apx-np-grid">${f.benefits.map((b) => `<div class="apx-np-card"${ba(`benefits.${b.id}`)}>${one(`benefits.${b.id}.title`, "h3", "apx-np-h3", b.title, "Benefit")}${many(`benefits.${b.id}.text`, "apx-np-p", b.text, "What it means for the buyer")}</div>`).join("")}${f.benefits.length < 8 ? addItem("benefits", "Tile") : ""}</div></div></section>`;
      }
      return m ? `<section class="apx-np-blk apx-np-bg-white"${ba("benefits")}><div class="apx-np-in">${slot("benefits", "Benefits - three or four cards")}</div></section>` : "";
    }
    // a section: text and a picture
    if (key.startsWith("sections.")) {
      const i = secIndex.get(key.slice(9)) ?? 0;
      const s = f.sections[i];
      const side = s.side;
      const bg = bgOf(`sections.${s.id}`, i % 2 ? "grey" : "white");
      const hasPic = !!s.picture.url || m;
      return `<section class="apx-np-blk apx-np-sec apx-np-bg-${bg}${side === "left" ? " is-left" : ""}${hasPic ? "" : " is-solo"}"${ba(`sections.${s.id}`)}><div class="apx-np-in">
<div class="apx-np-sec-t">${one(`sections.${s.id}.title`, "h2", "apx-np-h2", s.title, "Section heading")}${many(`sections.${s.id}.text`, "apx-np-p", s.text, "The section's text")}</div>
${hasPic ? picture(`sections.${s.id}.picture`, s.picture, "Picture - upload one, or let the AI write this part") : ""}</div></section>`;
    }
    if (key === "sections") return m ? `<section class="apx-np-blk apx-np-bg-white"${ba("sections")}><div class="apx-np-in">${slot("sections", "Sections - text with a picture")}</div></section>` : "";
    // the links to products and categories
    if (key === "links") {
      if (links.length) {
        return `<section class="apx-np-blk apx-np-links apx-np-bg-${bgOf("links")}"${ba("links")}><div class="apx-np-in">
${f.linksTitle.trim() ? one("linksTitle", "h2", "apx-np-h2", f.linksTitle, "") : m ? slot("linksTitle", "A heading for the links") : ""}
<div class="apx-np-lgrid">${links.map((l) => `<a class="apx-np-link" href="${esc(l.url ? link(l.url) : "#")}"${fa(`links.${l.id}`)}><span><b>${esc(l.label.trim() || "A page of the shop")}</b>${l.note.trim() ? `<small>${esc(l.note.trim())}</small>` : ""}</span>${ARROW}</a>`).join("")}${f.links.length < 16 ? addItem("links", "Link") : ""}</div></div></section>`;
      }
      return m ? `<section class="apx-np-blk apx-np-bg-white"${ba("links")}><div class="apx-np-in">${slot("links", "Links to products and categories of the shop")}</div></section>` : "";
    }
    // the questions
    if (key === "faq") {
      if (f.faq.length) {
        return `<section class="apx-np-blk apx-np-faq apx-np-bg-${bgOf("faq")}"${ba("faq")}><div class="apx-np-in apx-np-narrow">
${f.faqTitle.trim() ? one("faqTitle", "h2", "apx-np-h2", f.faqTitle, "") : m ? slot("faqTitle", "A heading for the questions") : ""}
${f.faq.map((q) => `<details class="apx-np-q"${m ? " open" : ""}${ba(`faq.${q.id}`)}><summary${fa(`faq.${q.id}.q`)}>${esc(q.q.trim() || (m ? "A question" : ""))}</summary>${many(`faq.${q.id}.a`, "apx-np-a", q.a, "Its answer")}</details>`).join("")}${f.faq.length < 14 ? addItem("faq", "Question") : ""}</div></section>`;
      }
      return m ? `<section class="apx-np-blk apx-np-bg-white"${ba("faq")}><div class="apx-np-in">${slot("faq", "Questions and answers")}</div></section>` : "";
    }
    // the call to action
    if (key === "cta") {
      return c.title.trim() || c.text.trim() || c.button.label.trim() || m ? `<section class="apx-np-blk apx-np-cta apx-np-bg-${bgOf("cta")}"${ba("cta")}><div class="apx-np-in apx-np-narrow">
${one("cta.title", "h2", "apx-np-h2", c.title, "The call to action")}${many("cta.text", "apx-np-p", c.text, "One line that makes the next step clear")}${button("cta.button", c.button, "Its button")}</div></section>` : "";
    }
    return "";
  };

  const order = blockOrder(f);
  // the gallery's modules (Content v6): each after its block, one whose block is gone at the end; in the preview each
  // says which it is (data-apx-mod) - Magento's copy is the module alone
  const mods = f.modules ?? [];
  const modsAfter = (key: string) => mods.filter((x) => (key === "~end" ? x.after && !order.includes(x.after) : x.after === key))
    .map((x) => {
      // one that still lacks something: a quiet slot in the preview, nothing in Magento's copy
      const gap = moduleGap(x.module);
      if (gap) return m ? `<div data-apx-mod="${esc(x.id)}" class="apx-np-in"><span class="apx-np-slot">${esc(moduleKind(x.module.type).name)} - ${esc(gap.toLowerCase())} (on the left)</span></div>` : "";
      const h = renderModule(x.module, o.picture ? { picture: o.picture } : {});
      return m ? `<div data-apx-mod="${esc(x.id)}">${h}</div>` : h;
    }).join("\n");
  const parts: string[] = [];
  parts.push(inserts("top"));
  parts.push(modsAfter(""));
  order.forEach((key, i) => {
    parts.push(block(key));
    parts.push(modsAfter(key));
    // a banner placed "after the intro" stays after it (after the hero when the page has no intro)
    if (key === "intro" || (key === "hero" && !order.includes("intro"))) parts.push(inserts("after-intro"));
    if (adds) parts.push(`<div class="apx-np-add" data-apx-add="${i + 1}" title="Add a block here"><b>+</b></div>`);
  });
  parts.push(modsAfter("~end"));
  parts.push(inserts("bottom"));

  return { css: NEW_PAGE_CSS, html: `<div class="apx-np">\n${parts.filter(Boolean).join("\n")}\n</div>` };
}

/** The studio's own look for its "+" in the page (the preview only, never in Magento's copy). */
export const ADD_CSS = `.apx-np-add{position:relative;height:0;z-index:8;pointer-events:auto!important}
.apx-np-add::before{content:"";position:absolute;left:0;right:0;top:-18px;height:36px}
.apx-np-add::after{content:"";position:absolute;left:32px;right:32px;top:-1px;height:2px;background:#c22c6e;opacity:0;transition:opacity .15s}
.apx-np-add>b{position:absolute;left:50%;top:-17px;width:34px;height:34px;margin-left:-17px;display:flex;align-items:center;justify-content:center;border-radius:7px;background:#c22c6e;color:#fff;font:600 26px/1 system-ui,"Segoe UI",sans-serif;box-shadow:0 6px 16px rgba(194,44,110,.35);opacity:0;transform:scale(.85);transition:opacity .15s,transform .15s;cursor:pointer;z-index:2}
.apx-np-add:hover::after,.apx-np-add:hover>b{opacity:1}
.apx-np-add:hover>b{transform:none}
.apx-np-additem{display:flex;align-items:center;justify-content:center;min-height:64px;padding:14px 18px;border:1.5px dashed #c3ccd4;border-radius:14px;color:#7d8b95;font:600 17px/1.2 system-ui,"Segoe UI",sans-serif;cursor:pointer;pointer-events:auto!important;background:rgba(255,255,255,.4);transition:border-color .15s,color .15s,background-color .15s}
.apx-np-additem:hover{border-color:#c22c6e;color:#c22c6e;background:rgba(194,44,110,.05)}
.apx-np-faq .apx-np-additem{margin-top:18px;min-height:52px}
[data-apx-making-over] img{opacity:.5;filter:saturate(.6) blur(1px)}
[data-apx-making-over]::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,rgba(255,255,255,0) 25%,rgba(194,44,110,.18) 42%,rgba(255,255,255,.7) 50%,rgba(36,89,209,.14) 58%,rgba(255,255,255,0) 75%);background-size:260% 100%;animation:apx-sheen 1.4s linear infinite}
.apx-np-veil{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);z-index:2;padding:12px 18px;border-radius:7px;background:#c22c6e;color:#fff;font:600 19px/1.2 system-ui,"Segoe UI",sans-serif;white-space:nowrap;box-shadow:0 8px 20px rgba(194,44,110,.3)}
[data-apx-making-over] .apx-np-bar{z-index:2;background:rgba(255,255,255,.6)}`;

/** The page's stylesheet - one per page, every rule under .apx-np. */
export const NEW_PAGE_CSS = `.apx-np{--red:#d80901;--red-d:#b00701;--petrol:#274e64;--petrol-d:#1b3a4b;--ink:#1d2326;--text:#4a5459;--muted:#66727a;--line:#e1e7ea;--grey:#f2f4f5;--sand:#f7f2ea;--head:futura-pt,Jost,"Helvetica Neue",Arial,sans-serif;font:400 16px/1.65 var(--head);color:var(--text);-webkit-font-smoothing:antialiased;text-align:left}
.apx-np *,.apx-np *::before,.apx-np *::after{box-sizing:border-box}
.apx-np img{max-width:100%;border:0}
.apx-np .apx-np-blk{padding:64px 0;margin:0}
.apx-np .apx-np-in{max-width:1180px;margin:0 auto;padding:0 32px}
.apx-np .apx-np-narrow{max-width:860px}
.apx-np .apx-np-bg-white{background:#fff}
.apx-np .apx-np-bg-grey{background:var(--grey)}
.apx-np .apx-np-bg-sand{background:var(--sand)}
.apx-np .apx-np-bg-petrol{background:var(--petrol);color:#fff}
.apx-np .apx-np-bg-petrol .apx-np-h1,.apx-np .apx-np-bg-petrol .apx-np-h2,.apx-np .apx-np-bg-petrol .apx-np-h3{color:#fff!important}
.apx-np .apx-np-bg-petrol .apx-np-p,.apx-np .apx-np-bg-petrol .apx-np-sub,.apx-np .apx-np-bg-petrol .apx-np-lead,.apx-np .apx-np-bg-petrol p{color:rgba(255,255,255,.86)!important}
.apx-np .apx-np-bg-petrol .apx-np-eb{color:#fff!important}
.apx-np .apx-np-hero{border-radius:18px;margin:24px 0 8px;overflow:hidden}
.apx-np .apx-np-hero .apx-np-in{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:56px;align-items:center;padding:24px 56px}
.apx-np .apx-np-hero-solo .apx-np-in{grid-template-columns:minmax(0,1fr);max-width:900px}
.apx-np .apx-np-eb{display:inline-flex;align-items:center;gap:10px;margin:0 0 4px;font:600 12px/1.2 var(--head);letter-spacing:.14em;text-transform:uppercase;color:var(--petrol)}
.apx-np .apx-np-eb::before{content:"";flex:none;width:26px;height:3px;border-radius:2px;background:var(--red)}
.apx-np .apx-np-h1{font:600 46px/1.08 var(--head)!important;letter-spacing:-.015em!important;color:var(--petrol)!important;margin:12px 0 0!important;padding:0!important;text-transform:none!important}
.apx-np .apx-np-h2{font:600 32px/1.18 var(--head)!important;letter-spacing:-.01em!important;color:var(--petrol)!important;margin:0 0 24px!important;padding:0!important;text-transform:none!important}
.apx-np .apx-np-h3{font:600 19px/1.3 var(--head)!important;color:var(--ink)!important;margin:18px 0 8px!important;padding:0!important;text-transform:none!important}
.apx-np .apx-np-sub{margin:18px 0 0;font-size:19px;line-height:1.55;color:var(--muted)}
.apx-np .apx-np-lead{max-width:820px;font-size:20px;line-height:1.65;color:var(--ink)}
.apx-np .apx-np-p,.apx-np .apx-np-a{color:var(--text)}
.apx-np p{margin:0 0 14px!important;font:inherit;color:inherit;line-height:inherit}
.apx-np p:last-child{margin-bottom:0!important}
.apx-np ul{margin:0 0 14px;padding:0;list-style:none}
.apx-np li{position:relative;margin:0 0 8px;padding-left:22px}
.apx-np li::before{content:"";position:absolute;left:0;top:.72em;width:10px;height:2px;background:var(--red)}
.apx-np .apx-np-btns{margin-top:30px;display:flex;flex-wrap:wrap;gap:12px}
.apx-np .apx-np-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;height:52px;padding:0 24px;border-radius:12px;font:600 16px/1 var(--head)!important;text-decoration:none!important;white-space:nowrap;transition:background .2s,color .2s,border-color .2s}
.apx-np .apx-np-btn svg{flex:none;transition:transform .2s}
.apx-np .apx-np-btn:hover svg{transform:translateX(3px)}
.apx-np .apx-np-btn-red{background:var(--red);color:#fff!important}
.apx-np .apx-np-btn-red:hover{background:var(--red-d)}
.apx-np .apx-np-btn-petrol{background:var(--petrol);color:#fff!important}
.apx-np .apx-np-btn-petrol:hover{background:var(--petrol-d)}
.apx-np .apx-np-btn-outline{background:transparent;color:var(--petrol)!important;border:2px solid var(--petrol)}
.apx-np .apx-np-bg-petrol .apx-np-btn-outline{color:#fff!important;border-color:#fff}
.apx-np .apx-np-pic{position:relative;border-radius:16px;overflow:hidden;aspect-ratio:4/3;background:#e6ebee;box-shadow:0 26px 50px -32px rgba(27,58,75,.6)}
.apx-np .apx-np-pic img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.apx-np .apx-np-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:20px}
.apx-np .apx-np-card{position:relative;background:#fff;border:1px solid var(--line);border-radius:16px;padding:28px 26px 26px}
.apx-np .apx-np-bg-white .apx-np-card{background:var(--grey);border-color:transparent}
.apx-np .apx-np-card::before{content:"";display:block;width:26px;height:3px;border-radius:2px;background:var(--red)}
.apx-np .apx-np-sec .apx-np-in{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:64px;align-items:center}
.apx-np .apx-np-sec.is-left .apx-np-pic{order:-1}
.apx-np .apx-np-sec.is-solo .apx-np-in{grid-template-columns:minmax(0,1fr);max-width:860px}
.apx-np .apx-np-lgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.apx-np .apx-np-link{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;border:1px solid var(--line);border-radius:14px;background:#fff;color:var(--ink)!important;text-decoration:none!important;transition:border-color .2s,box-shadow .2s}
.apx-np .apx-np-link:hover{border-color:var(--petrol);box-shadow:0 10px 24px -18px rgba(27,58,75,.6)}
.apx-np .apx-np-link b{display:block;font:600 16px/1.3 var(--head)}
.apx-np .apx-np-link small{display:block;margin-top:4px;font-size:13.5px;line-height:1.4;color:var(--muted)}
.apx-np .apx-np-link svg{flex:none;color:var(--red)}
.apx-np .apx-np-q{border-bottom:1px solid var(--line)}
.apx-np .apx-np-q:first-of-type{border-top:1px solid var(--line)}
.apx-np .apx-np-q summary{list-style:none;cursor:pointer;position:relative;padding:20px 44px 20px 0;font:600 18px/1.4 var(--head);color:var(--ink)}
.apx-np .apx-np-q summary::-webkit-details-marker{display:none}
.apx-np .apx-np-q summary::after{content:"+";position:absolute;right:6px;top:15px;font:400 28px/1 var(--head);color:var(--red)}
.apx-np .apx-np-q[open] summary::after{content:"\\2013"}
.apx-np .apx-np-a{padding:0 0 22px}
.apx-np .apx-np-cta{border-radius:18px;margin:8px 0 32px;text-align:center}
.apx-np .apx-np-cta .apx-np-btns{justify-content:center}
.apx-np .apx-np-ins{margin:24px 0}
.apx-np .apx-np-ac{text-align:center}
.apx-np .apx-np-btns.apx-np-ac{justify-content:center}
.apx-np .apx-np-s-s{font-size:.86em!important}
.apx-np .apx-np-s-l{font-size:1.22em!important}
.apx-np .apx-np-h1.apx-np-s-s{font-size:36px!important}.apx-np .apx-np-h1.apx-np-s-l{font-size:56px!important}
.apx-np .apx-np-h2.apx-np-s-s{font-size:26px!important}.apx-np .apx-np-h2.apx-np-s-l{font-size:40px!important}
.apx-np .apx-np-c-ink{color:var(--ink)!important}.apx-np .apx-np-c-petrol{color:var(--petrol)!important}
.apx-np .apx-np-c-red{color:var(--red)!important}.apx-np .apx-np-c-muted{color:var(--muted)!important}
.apx-np .apx-np-slot{display:block;margin:10px 0;padding:14px 16px;border:1.5px dashed #b6c2cb;border-radius:10px;background:rgba(255,255,255,.55);color:#7d8b95;font:500 15px/1.4 var(--head);letter-spacing:0;text-transform:none}
.apx-np .apx-np-pic-empty{display:flex;align-items:center;justify-content:center;border:1.5px dashed #b6c2cb;background:rgba(255,255,255,.5);box-shadow:none;color:#7d8b95;font:500 15px/1.4 var(--head);text-align:center;padding:24px}
.apx-np [data-apx-module]{max-width:1180px;padding:0 32px;margin:40px auto}
@media (max-width:767px){
.apx-np [data-apx-module]{padding:0 20px;margin:28px auto}
.apx-np .apx-np-blk{padding:40px 0}
.apx-np .apx-np-in{padding:0 20px}
.apx-np .apx-np-hero{border-radius:0;margin:0}
.apx-np .apx-np-hero .apx-np-in{grid-template-columns:minmax(0,1fr);gap:28px;padding:8px 20px}
.apx-np .apx-np-h1{font-size:32px!important}
.apx-np .apx-np-h2{font-size:25px!important;margin-bottom:18px!important}
.apx-np .apx-np-sub,.apx-np .apx-np-lead{font-size:17px}
.apx-np .apx-np-sec .apx-np-in{grid-template-columns:minmax(0,1fr);gap:24px}
.apx-np .apx-np-sec.is-left .apx-np-pic{order:0}
.apx-np .apx-np-btn{width:100%}
.apx-np .apx-np-cta{border-radius:0;margin:0}
}`;
