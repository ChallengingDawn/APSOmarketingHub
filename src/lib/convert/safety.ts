// APSOconvert > A VERSION THAT DOES NOT BREAK THE SHOP (SARCLA 10.11.2026: "generation continues to be absolute shit" -
// his screenshot: a version that moved the shop's filters with CSS left the filters squeezed under the articles table
// and the table's rows torn apart). The shop is Magento: its filters, the articles table, prices, availability, the
// cart, the menus and the galleries are drawn and kept in place by its own scripts. A version laid over the page in
// the browser may change words, add its own blocks, emphasise, open a folded part - it may NOT re-lay-out, replace or
// hide the shop's own parts. What needs that (moving the filters, new table columns, another page layout) is made as a
// SKETCH: a clearly marked note at that place, for Content and dotSource to build.
//
// riskOf() names what a change list does against those rules, so the AI is asked once more and what is still risky is
// left out. Pure (no "@/" imports), so it is tested.

import type { Change } from "./versions";

/** The shop's parts its own scripts draw and hold in place (Magento 2 + the APSOparts theme). */
const SHOP_WIDGETS = [
  /layered|filter|swatch/i,                     // the filters (layered navigation, "Filter anzeigen")
  /\btable\b|\btbody\b|\bthead\b|\btr\b|\btd\b|data-grid|articles?-?table|product-items?|products-grid|products-list/i,
  /price|stock|availab|qty|tocart|add-to-cart|minicart|checkout|cart/i,
  /\bnav\b|navigation|menu|header|footer|breadcrumbs?|page-wrapper|columns|sidebar|maincontent|page-main/i,
  /gallery|fotorama|slider|carousel|swiper/i,
  /\[data-(bind|role|mage-init|content-type)/i,
];

/** CSS properties that re-lay-out an element (move it, re-size it, take it out of the flow, re-order it). */
const LAYOUT_PROPS = /^(position|top|right|bottom|left|inset|float|clear|order|flex(-[a-z]+)?|grid(-[a-z]+)?|grid-template(-[a-z]+)?|align-(items|content|self)|justify-(items|content|self)|place-[a-z]+|width|min-width|max-width|height|min-height|transform|columns|column-count|z-index|overflow(-[xy])?|visibility|clip(-path)?)$/i;

/** display values that rebuild a layout or take a part away (block / inline-block only OPEN a folded part). */
const BAD_DISPLAY = /^(none|flex|inline-flex|grid|inline-grid|contents|table[a-z-]*|flow-root)$/i;

/** A selector made only of the version's own blocks (class "apx-...") - those it may lay out as it likes. */
export function ownOnly(selector: string): boolean {
  const parts = selector.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => {
    // the last compound of the selector is what the rule styles: one of ours - or a bare tag inside one of ours
    // (".apx-sketch b"); a shop class inside ours (".apx-box .price") is still the shop's
    const compounds = p.split(/\s*[>+~]\s*|\s+/).filter(Boolean).map((x) => x.replace(/:{1,2}[a-z-]+(\([^)]*\))?/gi, ""));
    const last = compounds.pop() ?? "";
    if (/(^|[.#])apx-/.test(last)) return true;
    return /^[a-z][a-z0-9]*$/i.test(last) && compounds.some((x) => /(^|[.#])apx-/.test(x));
  });
}

/** The rules of a stylesheet, roughly: "selector { declarations }" (no nesting - @media's inner rules read as rules). */
export function cssRules(css: string): { selector: string; decls: { prop: string; value: string }[]; raw: string }[] {
  const out: { selector: string; decls: { prop: string; value: string }[]; raw: string }[] = [];
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    // inside "@media (...) { .x { } }" the inner rule is found on its own: its selector is ".x"
    const selector = m[1].trim();
    if (!selector || selector.startsWith("@")) continue;
    const decls = m[2].split(";").map((d) => {
      const i = d.indexOf(":");
      return i > 0 ? { prop: d.slice(0, i).trim().toLowerCase(), value: d.slice(i + 1).replace(/!important/i, "").trim() } : null;
    }).filter((d): d is { prop: string; value: string } => !!d && !!d.prop);
    out.push({ selector, decls, raw: m[0] });
  }
  return out;
}

const shopWidget = (selector: string) => SHOP_WIDGETS.some((r) => r.test(selector));

/** What one change does against the rules - empty = it is safe. */
export function riskOfChange(c: Change): string[] {
  const out: string[] = [];
  if (c.op === "css") {
    for (const r of cssRules(c.css)) {
      if (ownOnly(r.selector)) continue;
      for (const d of r.decls) {
        if (LAYOUT_PROPS.test(d.prop)) {
          // opening a folded part is fine: height/max-height auto|none
          if (/^(max-height|height)$/.test(d.prop) && /^(auto|none)$/i.test(d.value)) continue;
          out.push(`re-lays-out the shop's "${r.selector.slice(0, 80)}" (${d.prop}: ${d.value.slice(0, 30)})`);
        } else if (d.prop === "display" && BAD_DISPLAY.test(d.value)) {
          out.push(`re-lays-out the shop's "${r.selector.slice(0, 80)}" (display: ${d.value})`);
        } else if (/^margin/.test(d.prop) && /-\d/.test(d.value)) {
          out.push(`pulls the shop's "${r.selector.slice(0, 80)}" over its neighbours (negative margin)`);
        }
      }
    }
    return out;
  }
  const sel = c.selector;
  if (c.op === "hide" && shopWidget(sel)) out.push(`hides a part the shop's scripts draw ("${sel.slice(0, 80)}")`);
  if ((c.op === "replace" || c.op === "html") && shopWidget(sel) && !ownOnly(sel)) out.push(`rewrites a part the shop's scripts draw ("${sel.slice(0, 80)}")`);
  return out;
}

/** The whole list: every change's risks, by its place in the list. */
export function riskOf(changes: Change[]): { index: number; problems: string[] }[] {
  return changes.map((c, index) => ({ index, problems: riskOfChange(c) })).filter((x) => x.problems.length > 0);
}

/** What makes a version a poor proposal though it breaks nothing (SARCLA 10.11.2026: "this proposal is pure shit" - a
 *  floating box of "[Text from Content: ...]" with a sketch inside; "recommendations should always be in English"):
 *  a placeholder instead of real words, more than one sketch, words in another language than English. The AI is asked
 *  once more; nothing is dropped for it. */
export function qualityOf(changes: Change[]): string[] {
  const out: string[] = [];
  const text = changes.map((c) => ("html" in c ? c.html : "text" in c ? c.text : "")).join("\n");
  if (/\[\s*(text|texte|testo|tekst)\s+(from|de|da|von|z)\s+content/i.test(text) || /class="apx-text"/i.test(text)) out.push("it puts a placeholder where the real words belong - write the actual short text, in English");
  const sketches = (text.match(/apx-sketch/g) ?? []).length;
  if (sketches > 1) out.push(`it has ${sketches} sketches - one at most, and only for what cannot be shown`);
  const visible = text.replace(/<[^>]+>/g, " ");
  // whole words of the shop's other languages (letters on both sides checked the Unicode way: "quantità" ends in à)
  if (/(?<!\p{L})(der|und|nicht|für|mit|bestellen|verfügbar|une|les|des|pour|avec|commander|disponible|della|questa|quantità|superiore|allo|richiedi|disponibile|het|voor|niet|bestellen)(?!\p{L})/iu.test(visible)) out.push("its words are not in English - every new word is English");
  return out;
}

/** The safe part of a list: risky css rules taken out of their stylesheet, risky element changes dropped. */
export function safePart(changes: Change[]): { changes: Change[]; dropped: string[] } {
  const out: Change[] = [];
  const dropped: string[] = [];
  for (const c of changes) {
    if (c.op === "css") {
      // the risky rules cut out of the stylesheet as written - the rest (its @media blocks too) stays as it was
      let css = c.css.replace(/\/\*[\s\S]*?\*\//g, "");
      for (const r of cssRules(c.css)) {
        const bad = riskOfChange({ op: "css", css: r.raw });
        if (bad.length) { dropped.push(...bad); css = css.replace(r.raw, ""); }
      }
      if (cssRules(css).length) out.push({ ...c, css });
      continue;
    }
    const bad = riskOfChange(c);
    if (bad.length) dropped.push(...bad);
    else out.push(c);
  }
  return { changes: out, dropped };
}

/** The look of a sketch note - what the AI is told to use, so every sketch reads the same. */
export const SKETCH_CSS = ".apx-sketch{margin:12px 0;padding:12px 14px;border:2px dashed #6a46c9;border-radius:8px;background:rgba(106,70,201,.07);color:#3a2a7a;font:600 14px/1.4 inherit}.apx-sketch b{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6a46c9;margin-bottom:2px}";

/** The rules the version's AI is given (studio.ts VERSION_SYSTEM). */
export const SAFETY_RULES = `THE SHOP IS MAGENTO. Its filters (layered navigation, "Filter anzeigen"), the articles table, prices, availability,
quantities, the cart, the menus, the header and footer and the galleries are drawn and held in place by its own scripts.
- NEVER move, re-order, re-size or re-lay-out those parts: on their selectors no position, top/left, float, order,
  flex, grid, width, height, transform, overflow, z-index, negative margin, display:none/flex/grid.
- NEVER replace, rewrite (html) or hide those parts.
- You MAY: change a text, add your own blocks (class "apx-...") before / after / inside them, emphasise (colour,
  background, border, font-size, font-weight, padding/margin of your own blocks), open a folded part (display:block,
  max-height:none).
- A change that needs the shop's own parts rebuilt (moving the filters, other table columns, another page layout) is
  made as a SKETCH, never by force - and only then: keep the page as it is and insert, right at that place, ONE
  <div class="apx-sketch"><b>Proposed</b>what changes here, in English, in at most 15 words</div>, with this CSS once:
  ${SKETCH_CSS}
  At most one sketch in a version, never inside another block of yours, never beside a box of its own. Whatever CAN be
  shown (a message, a button, a note, an emphasis) is shown for real, not sketched. Content and dotSource build it.`;
