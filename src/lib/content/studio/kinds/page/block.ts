// PAGE - A BLOCK THE AI DESIGNS FOR A PAGE OF THE SHOP (Content v6, 09.11.2026). Pure: no "@/" imports, so the prompt
// and the parsing are tested with a canned answer (tests/studio-page-block.test.ts).
//
// SARCLA 09.11.2026 (point 2): the AI's change on the de-CH home page was "pure shit" (dark grey text on the dark petrol
// hero, invisible bullet lines, only the red dots showing) - while "the versions [the Black Friday agent made for the
// home page A/B test] were really good". So a block the hub makes is made the way those were (the home page kit,
// C:\dev\_archive\apsoparts\shop-project\home-page-2026, and the Black Friday blocks):
//   - ONE self-contained element (Magento's Page Builder "HTML Code" element): its own <style>, every rule under ONE
//     prefix class, explicit colours and fonts - nothing inherited by luck;
//   - the shop's content container (1170 px, 10 px gutters), never the whole screen;
//   - real shop data only; calm, clean, product-first; finished at 375, 1024 and 1440 px.
// The AI is given what it needs to design well: the element's own HTML and how it LOOKS on the page now (its ground, text
// colour, font, width - read from the preview), the shop's colours and type (the kit's tokens) and two finished blocks
// in the kit's way. For an element of the page it writes the REPLACEMENT block (op replace: the element hidden, the block
// in its place) - never a loose fragment beside it. What comes back is put right where it can be (rules scoped under the
// prefix, the root's own colour and font) and said where it cannot (an H1 lost, a picture from outside, a placeholder).

import { validateChanges } from "../../../../convert/versions";
import { colorsIn, contrast, luminance, parseColor } from "./readable";
import { leftoversIn, type PageChange } from "./model";

/* ── what the AI is shown ─────────────────────────────────────────────── */

/** The shop's colours and type, as the home page kit names them (home_kit.py .hxt). */
export const SHOP_TOKENS = `THE SHOP'S COLOURS AND TYPE (the home page kit's own tokens - use these, nothing else):
- petrol #274e64 (headings on white, dark bands, main buttons); dark petrol #1b3a4b (hover, a deeper band)
- red #d80901 (a small accent only: a short line, a dot, one key word, the main call to action); dark red #b00700 (its hover)
- ink #1d2326 (strong text on light grounds); text #5e5e5e (body text on white or light grey)
- light grey #f3f4f5 (a calm band or card ground); line #e5e8ea (hairlines, card edges); tile #e8e9eb
- #80878c only for hairlines and icons - never for text (it does not read well enough)
- on petrol or dark petrol: text #ffffff, a soft line #d5e2ea; never grey or red text on petrol
- font: "futura-pt", Arial, sans-serif for everything (headings 600, body 400); body 15-17px/1.5, headings 22-34px
- corners: 4px for bands and buttons, 10-12px for cards; a card edge = box-shadow inset 0 0 0 1px #e5e8ea
- the shop's content container: max-width 1170px, margin 0 auto, padding 0 10px (the search bar's width)`;

/** Two finished blocks in the kit's way - how a block is built, not what it says. */
export const KIT_EXAMPLES = `EXAMPLE 1 - a dark band (it replaced a page title band; the H1 kept, a lead and four facts the page already showed):
<style>
.apx-k1,.apx-k1 *{box-sizing:border-box}
.apx-k1{background:#274e64;color:#ffffff;font-family:"futura-pt",Arial,sans-serif;font-size:16px;line-height:1.5}
.apx-k1 .apx-k1-in{max-width:1170px;margin:0 auto;padding:28px 10px 30px}
.apx-k1 h1{margin:0 0 8px;font:600 32px/1.15 "futura-pt",Arial,sans-serif;color:#ffffff}
.apx-k1 .apx-k1-lead{margin:0 0 18px;max-width:720px;font-size:17px;color:#e8f0f4}
.apx-k1 ul{display:flex;flex-wrap:wrap;gap:10px 28px;margin:0;padding:0;list-style:none}
.apx-k1 li{display:flex;align-items:center;gap:10px;margin:0;font:500 15px/1.3 "futura-pt",Arial,sans-serif;color:#ffffff}
.apx-k1 li::before{content:"";flex:none;width:18px;height:3px;border-radius:2px;background:#d80901}
@media (max-width:767px){.apx-k1 .apx-k1-in{padding:20px 10px 22px}.apx-k1 h1{font-size:24px}.apx-k1 ul{flex-direction:column;gap:8px}}
</style>
<div class="apx-k1"><div class="apx-k1-in"><h1>(the page's H1, its words unchanged)</h1><p class="apx-k1-lead">(one or two sentences)</p><ul><li>(a fact of the page)</li><li>(another)</li></ul></div></div>

EXAMPLE 2 - cards on white (a row of the shop's own categories, their own photos and addresses from the page):
<style>
.apx-k2,.apx-k2 *{box-sizing:border-box}
.apx-k2{max-width:1170px;margin:32px auto;padding:0 10px;background:transparent;color:#5e5e5e;font-family:"futura-pt",Arial,sans-serif;font-size:15px;line-height:1.55}
.apx-k2 h2{margin:0 0 16px;font:600 24px/1.2 "futura-pt",Arial,sans-serif;color:#274e64}
.apx-k2 .apx-k2-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.apx-k2 a.apx-k2-card{display:flex;flex-direction:column;border-radius:12px;background:#ffffff;box-shadow:inset 0 0 0 1px #e5e8ea;color:#1d2326;text-decoration:none;overflow:hidden;transition:box-shadow .2s,transform .2s}
.apx-k2 a.apx-k2-card:hover{transform:translateY(-2px);box-shadow:inset 0 0 0 1px #d6dcdf,0 18px 30px -20px rgba(27,58,75,.45)}
.apx-k2 .apx-k2-ph{display:flex;align-items:center;justify-content:center;aspect-ratio:4/3;background:#f3f4f5}
.apx-k2 .apx-k2-ph img{max-width:80%;max-height:80%;object-fit:contain;mix-blend-mode:multiply}
.apx-k2 .apx-k2-tx{padding:12px 14px 14px}
.apx-k2 .apx-k2-tx b{display:block;font:600 16px/1.25 "futura-pt",Arial,sans-serif;color:#1d2326}
.apx-k2 .apx-k2-tx span{display:block;margin-top:4px;font-size:14px;color:#5e5e5e}
.apx-k2 .apx-k2-tx i{display:inline-block;margin-top:8px;font:600 13px/1 "futura-pt",Arial,sans-serif;font-style:normal;color:#d80901}
@media (max-width:767px){.apx-k2 .apx-k2-grid{grid-template-columns:1fr 1fr;gap:10px}.apx-k2 h2{font-size:20px}}
</style>
<div class="apx-k2"><h2>(a heading)</h2><div class="apx-k2-grid"><a class="apx-k2-card" href="(an address of the page)"><span class="apx-k2-ph"><img src="(a photo of the page)" alt="(its name)"></span><span class="apx-k2-tx"><b>(name)</b><span>(one line)</span><i>(the action)</i></span></a></div></div>`;

/** The rules of a block, with its prefix. */
export function blockRules(prefix: string): string {
  return `HOW THE BLOCK IS BUILT (the bar: the shop's home page kit and its Black Friday blocks):
- ONE self-contained element, as Magento's Page Builder "HTML Code" element holds it: first ONE <style>, then ONE root
  element <div class="${prefix}"> (or <section class="${prefix}">) holding everything. Every CSS rule starts with
  .${prefix} (the root, or inside it: ".${prefix} h2", ".${prefix} .${prefix}-card"); inner classes start with ${prefix}-.
  Never a rule for body, html, a bare tag, or one of the shop's own classes.
- Nothing inherited by luck: the root sets its background (transparent only where it stands on the page's white), its
  text colour, font-family "futura-pt", Arial, sans-serif, font-size and line-height; and every heading, paragraph,
  list item, link and button in it sets its own colour and font. Lists set list-style, margin and padding themselves.
- Text must be read easily on what is behind it: a contrast of at least 4.5:1. On petrol or any dark ground the text is
  white (#ffffff); on white or light grey it is #1d2326, #5e5e5e or petrol. Never grey, petrol or red text on petrol.
- Width: the shop's content container - max-width 1170px, margin 0 auto, padding 0 10px. A band whose ground runs
  across the page (as the element it replaces did) keeps that ground full width and its content in the container.
  box-sizing:border-box on the root and all inside it; pictures max-width:100%; no fixed width over 360px; nothing that
  runs out of its place.
- Finished at 375, 1024 and 1440 px wide: one @media (max-width:767px) rule set for the phone (one or two columns,
  smaller headings, less padding).
- Calm, clean, product-first: white space, the shop's colours only (below), red as a small accent; no emojis, no icon
  fonts, no pictures or fonts from outside the shop, no gradients of other colours, no heavy shadows.
- Real shop data only: the words, facts, photos and links of the page itself, the brief and the brand facts. Never an
  invented address, figure, price, stock, delivery time, certificate or approval.
- A replaced element keeps what it did for search engines: its H1 stays the page's one H1 with the same words; its
  links stay.
- No <script>, no on...= handlers, no forms, no iframes, no <link>, no @import.`;
}

export const BLOCK_SYSTEM = `You design blocks for pages of the APSOparts shop (apsoparts.com, the online shop of Angst+Pfister: technical parts for
industry - seals and O-rings, plastics, fluid handling, drive technology, anti-vibration, sensors; buyers are engineers,
purchasers and maintenance). A block goes on a page that is already on the shop: it takes the place of one of the page's
elements (that element is hidden, kept) or is added at a place between them. You write the whole block - its HTML and
its own stylesheet - so it looks like the shop's best pages, and the final words a visitor reads, in the page's language.

${SHOP_TOKENS}

${KIT_EXAMPLES}`;

/** The answer's shape. */
export const BLOCK_SCHEMA = {
  type: "object", additionalProperties: false, required: ["summary", "html", "note"],
  properties: {
    summary: { type: "string", description: "What the block does now, for the person approving it, English, 1-2 sentences" },
    html: { type: "string", description: "The whole block: one <style>, then one root element with the prefix class" },
    note: { type: "string", description: "The block in under 10 words, English (shown in the list of changes)" },
  },
};

export type BlockMode = "replace" | "insert" | "rework";
export type BlockAsk = {
  mode: BlockMode;
  prefix: string;
  selector: string;
  where?: string;
  /** the element's (or the block's) HTML now */
  html: string;
  /** how it looks on the page now (./readable.ts lookLine) */
  look: string;
  /** the words around a place a block is added at */
  near?: string;
  request: string;
  language: string;
  /** what the check after applying found wrong (block_fix) */
  problems?: string;
};

/** The task's own part of the question (the page, the brief and the changes come before it). */
export function blockAsk(a: BlockAsk): string {
  const what = a.mode === "replace"
    ? `THE ELEMENT TO REPLACE (selector ${a.selector}). Write the block that takes its place: it is hidden and your block stands exactly where it was - so the block does everything the element did (its H1, its links, its words where they still serve) and what the person asks.`
    : a.mode === "insert"
      ? `A NEW BLOCK, added ${a.where || "after"} the element ${a.selector}.${a.near ? ` Around that place the page reads: ${a.near}` : ""}`
      : `A BLOCK THE HUB PUT ON THIS PAGE BEFORE (on ${a.selector}). Write it again whole, with what the person asks changed and everything else kept.`;
  return `${what}
ITS HTML NOW:
${a.html.slice(0, 6000) || "(none - the place is empty)"}
HOW IT LOOKS ON THE PAGE NOW: ${a.look || "(not read)"}

${blockRules(a.prefix)}

THE PREFIX CLASS: ${a.prefix}
WRITE IN: ${a.language}
${a.problems ? `\nTHE BLOCK WAS PUT ON THE PAGE AND LOOKED AT - IT LOOKS WRONG:\n${a.problems}\nFix exactly that (colours, sizes, widths), keep its words and structure otherwise.\n` : ""}
THE PERSON ASKS: ${a.request}`;
}

/* ── what comes back ──────────────────────────────────────────────────── */

/** A prefix for a block, from its change's id ("apx-" + six letters). */
export const prefixOf = (id: string) => `apx-${id.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(-6).padStart(6, "0")}`;

/** The prefix a block already has (its root's first "apx-" class) - kept when the block is written again. */
export function prefixIn(html: string): string | null {
  const body = html.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "");
  const m = /<[a-z][\w-]*\b[^>]*\bclass\s*=\s*["']([^"']*)["']/i.exec(body);
  const k = m?.[1].split(/\s+/).find((c) => /^apx-[a-z0-9]{3,}$/i.test(c));
  return k ?? null;
}

/** Each selector of a rule list scoped under the prefix: ".x a, h2" -> ".p .x a, .p h2" (the root itself stays). */
function scopeSelectors(list: string, prefix: string): string {
  return list.split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
    if (s === `.${prefix}` || s.startsWith(`.${prefix} `) || s.startsWith(`.${prefix}.`) || s.startsWith(`.${prefix}:`) || s.startsWith(`.${prefix}>`) || s.startsWith(`.${prefix}[`) || s.startsWith(`.${prefix},`)) return s;
    if (/^(html|body|:root)\b/i.test(s)) return `.${prefix}`;
    return `.${prefix} ${s}`;
  }).join(",");
}

/** A stylesheet with every rule under the prefix (inside @media too); @import and @font-face left out. */
export function scopeCss(css: string, prefix: string): { css: string; moved: number } {
  let moved = 0;
  const walk = (src: string): string => {
    let out = "";
    let i = 0;
    while (i < src.length) {
      const open = src.indexOf("{", i);
      if (open < 0) { out += src.slice(i); break; }
      const head = src.slice(i, open).trim();
      // the block's end (nested braces counted)
      let depth = 1, k = open + 1;
      while (k < src.length && depth) { if (src[k] === "{") depth++; else if (src[k] === "}") depth--; k++; }
      const body = src.slice(open + 1, k - 1);
      if (/^@(media|supports)\b/i.test(head)) out += `${head}{${walk(body)}}`;
      else if (/^@(import|font-face|charset|namespace)\b/i.test(head)) moved++;
      else if (/^@/.test(head)) out += `${head}{${body}}`;
      else {
        const scoped = scopeSelectors(head, prefix);
        if (scoped.replace(/\s+/g, "") !== head.replace(/\s+/g, "")) moved++;
        out += `${scoped}{${body}}`;
      }
      i = k;
    }
    return out;
  };
  const clean = css.replace(/@import[^;]*;/gi, () => { moved++; return ""; });
  return { css: walk(clean).trim(), moved };
}

/** The declarations of the root's own rule(s) ".prefix{...}". */
function rootDecls(css: string, prefix: string): string {
  const re = new RegExp(`(^|[},])\\s*\\.${prefix.replace(/[-]/g, "\\-")}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, "g");
  return [...css.matchAll(re)].map((m) => m[2]).join(";");
}

const SHOP_IMG = /^(https:\/\/(www|acc)\.apsoparts\.com\/|\/media\/|\/static\/|\/api\/content\/picture\/|\{\{media )/i;

export type CleanBlock = { html: string; problems: string[]; fixed: string[] };

/**
 * The AI's block made what a block of the hub must be, where that can be done without asking again: one <style> with every
 * rule under the prefix, one root carrying the prefix class, the root's own colour, font and box sizing. What cannot be
 * put right here is said (`problems`) - the studio asks the AI once more with it.
 */
export function cleanBlock(raw: string, prefix: string, o: { ground?: string | null; hadH1?: boolean } = {}): CleanBlock {
  const problems: string[] = [];
  const fixed: string[] = [];
  let html = String(raw ?? "").trim().replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "");
  // every stylesheet of the answer, as one, scoped
  const sheets: string[] = [];
  html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (_all, css: string) => { sheets.push(css); return ""; }).trim();
  html = html.replace(/<link\b[^>]*>/gi, () => { fixed.push("a stylesheet link left out"); return ""; });
  // one root with the prefix class
  const tops = topElements(html);
  const loose = tops.reduce((s, t) => s.replace(html.slice(t.start, t.end), ""), html).replace(/<!--[\s\S]*?-->/g, "").trim();
  if (tops.length !== 1 || loose) {
    html = `<div class="${prefix}">${html}</div>`;
    fixed.push("wrapped in one element");
  } else {
    const t = tops[0];
    const open = html.slice(t.start, t.openEnd);
    const cls = /\bclass\s*=\s*(["'])([^"']*)\1/i.exec(open);
    if (!cls) html = `${html.slice(0, t.start)}${open.replace(/^<([a-z][\w-]*)/i, `<$1 class="${prefix}"`)}${html.slice(t.openEnd)}`;
    else if (!cls[2].split(/\s+/).includes(prefix)) html = `${html.slice(0, t.start)}${open.replace(cls[0], `class=${cls[1]}${prefix} ${cls[2]}${cls[1]}`)}${html.slice(t.openEnd)}`;
  }
  const scoped = scopeCss(sheets.join("\n"), prefix);
  if (scoped.moved) fixed.push(`${scoped.moved} style rule${scoped.moved === 1 ? "" : "s"} kept inside the block`);
  let css = scoped.css;
  // the root says its own colour, font and sizing - never inherited by luck
  const root = rootDecls(css, prefix);
  const dark = (() => { const g = parseColor(o.ground ?? ""); return g ? luminance(g) < 0.2 : false; })();
  const base: string[] = [];
  if (!/(^|;)\s*color\s*:/i.test(root)) base.push(`color:${dark && !/background(-color)?\s*:/i.test(root) ? "#ffffff" : "#1d2326"}`);
  if (!/font-family\s*:|(^|;)\s*font\s*:/i.test(root)) base.push(`font-family:"futura-pt",Arial,sans-serif`);
  if (base.length) { css = `.${prefix}{${base.join(";")}}\n${css}`; fixed.push(`the block's own ${base.map((b) => b.split(":")[0]).join(" and ")} set`); }
  if (!new RegExp(`\\.${prefix.replace(/-/g, "\\-")}\\s*\\*`).test(css)) css = `.${prefix},.${prefix} *{box-sizing:border-box}\n${css}`;
  // what cannot be put right here
  if (!/@media\b/i.test(css)) problems.push("It has no rule for the phone (@media (max-width:767px)) - it must be finished at 375 px.");
  for (const m of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    if (!SHOP_IMG.test(m[1])) problems.push(`A picture comes from outside the shop (${m[1].slice(0, 80)}) - only the page's own photos may be used.`);
  }
  if (o.hadH1 && !/<h1\b/i.test(html)) problems.push("The element it replaces held the page's H1 - the block must keep it (same words).");
  if ((html.match(/<h1\b/gi) ?? []).length > 1) problems.push("It has more than one H1 - a page has one.");
  // grey or red words straight on a dark ground the block sets (the night's failure, seen before it is drawn)
  const bg = /background(?:-color)?\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/i.exec(root)?.[1];
  const fg = /(?:^|;)\s*color\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/i.exec(root)?.[1];
  const b = bg ? colorsIn(bg)[0] : null, f = fg ? colorsIn(fg)[0] : null;
  if (b && f && contrast(f, b) < 4.5) problems.push(`Its text colour ${fg} on its own ground ${bg} cannot be read (${contrast(f, b).toFixed(1)}:1, it needs 4.5:1).`);
  for (const l of leftoversIn(html)) problems.push(`"${l}" is a placeholder, not final words.`);
  const out = `<style>\n${css}\n</style>\n${html}`;
  const v = validateChanges([{ op: "insert", selector: "body", where: "append", html: out }]);
  if (v.problems.length) problems.push(...v.problems.map((p) => p.replace(/^change 1: /, "It has ").replace(/ is not allowed$/, ", which a block may not carry.")));
  return { html: out, problems: [...new Set(problems)], fixed };
}

/** The top elements of a fragment (no parser of the page's: a small one, enough for an answer). */
function topElements(html: string): { start: number; openEnd: number; end: number }[] {
  const out: { start: number; openEnd: number; end: number }[] = [];
  const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;
  let depth = 0;
  let cur: { start: number; openEnd: number } | null = null;
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[0].startsWith("<!--") || !m[1]) continue;
    const closing = m[0][1] === "/";
    const selfClosed = VOID.test(m[1]) || /\/\s*>$/.test(m[0]);
    if (!closing) {
      if (depth === 0) cur = { start: m.index, openEnd: m.index + m[0].length };
      if (selfClosed) { if (depth === 0 && cur) { out.push({ ...cur, end: m.index + m[0].length }); cur = null; } continue; }
      depth++;
    } else {
      depth = Math.max(0, depth - 1);
      if (depth === 0 && cur) { out.push({ ...cur, end: m.index + m[0].length }); cur = null; }
    }
  }
  return out;
}

/**
 * "Text and picture" added with the "+" (Content v6, SARCLA point 9: "we should really be able to add elements") - a
 * block in the kit's way at once, no AI: a heading with the shop's small red line, words, and a photo of the page itself
 * (none found: the words alone). Its words are marked as still to write ("[Heading]") until they are: double-click to
 * write them, or "Write them with AI".
 */
export function textPictureBlock(prefix: string, img: { src: string; alt: string } | null): string {
  const p = prefix;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<style>
.${p},.${p} *{box-sizing:border-box}
.${p}{max-width:1170px;margin:36px auto;padding:0 10px;background:transparent;color:#5e5e5e;font-family:"futura-pt",Arial,sans-serif;font-size:16px;line-height:1.55}
.${p} .${p}-in{display:grid;grid-template-columns:${img ? "minmax(0,1.1fr) minmax(0,1fr)" : "minmax(0,1fr)"};gap:36px;align-items:center}
.${p} h2{margin:0;font:600 26px/1.2 "futura-pt",Arial,sans-serif;color:#274e64}
.${p} h2::after{content:"";display:block;width:36px;height:3px;margin:14px 0 14px;border-radius:2px;background:#d80901}
.${p} p{margin:0;max-width:640px;font-size:16px;line-height:1.6;color:#5e5e5e}
.${p} .${p}-ph{display:flex;align-items:center;justify-content:center;aspect-ratio:4/3;border-radius:12px;background:#f3f4f5;overflow:hidden}
.${p} .${p}-ph img{display:block;max-width:82%;max-height:82%;object-fit:contain;mix-blend-mode:multiply}
@media (max-width:767px){.${p}{margin:26px auto}.${p} .${p}-in{grid-template-columns:1fr;gap:18px}.${p} h2{font-size:21px}}
</style>
<div class="${p}"><div class="${p}-in"><div class="${p}-tx"><h2>[Heading]</h2><p>[Your words: one or two sentences]</p></div>${img ? `<div class="${p}-ph"><img src="${esc(img.src)}" alt="${esc(img.alt)}" loading="lazy"></div>` : ""}</div></div>`;
}

/** The AI's answer as the change the studio keeps: the block cleaned, its id and the way it goes on the page. */
export function blockChange(raw: unknown, a: { id: string; mode: BlockMode; prefix: string; selector: string; where?: string; base?: PageChange | null; ground?: string | null; hadH1?: boolean }): {
  summary: string; change: PageChange | null; problems: string[]; fixed: string[];
} {
  const r = (raw ?? {}) as { summary?: unknown; html?: unknown; note?: unknown };
  const html = typeof r.html === "string" ? r.html : "";
  const summary = typeof r.summary === "string" ? r.summary.trim().slice(0, 600) : "";
  const note = typeof r.note === "string" ? r.note.trim().slice(0, 120) : "";
  if (!html.trim()) return { summary, change: null, problems: ["No block came back."], fixed: [] };
  const c = cleanBlock(html, a.prefix, { ground: a.ground, hadH1: a.hadH1 });
  const where = (["before", "after", "prepend", "append"] as const).find((w) => w === a.where) ?? "after";
  const keep = a.base ? { id: a.base.id ?? a.id, ...(a.base.module ? { module: a.base.module } : {}) } : { id: a.id };
  const change: PageChange = a.mode === "rework" && a.base
    ? ({ ...a.base, html: c.html, ...(note ? { note } : {}), ...keep } as PageChange)
    : a.mode === "insert"
      ? { op: "insert", selector: a.selector, where, html: c.html, ...(note ? { note } : {}), ...keep }
      : { op: "replace", selector: a.selector, html: c.html, ...(note ? { note } : {}), ...keep };
  delete (change as { off?: string }).off;
  return { summary, change, problems: c.problems, fixed: c.fixed };
}
