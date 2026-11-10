// BANNER - THE PLACES ON A PAGE OF THE SHOP A BANNER CAN STAND AT (Content v7, 10.11.2026). Pure: tests/studio-banner-topage.test.ts.
//
// "Put it on a page" (SARCLA point 11) offers the places a person sees on the page: the home page's slider (when the page
// has one), the top of its content, and after each of its blocks - each block named by its heading or its first words,
// with a selector the hub MAKES and CHECKS to find exactly that block on the page as the shop serves it (its id, its Page
// Builder style key, else its path down from the page's column) - never a guess like "the first h2", which on a shop page
// is in its header. (Builder A's plan/places.ts makes the page's parts the same way for the AI; once both are in, one can
// serve both.)

import { parseHtml, parseSelector, selectAll, type Node } from "../page/apply";

export type PageBlock = { selector: string; name: string; text: string };
export type PagePlaces = { slider: boolean; blocks: PageBlock[] };

const SKIP = new Set(["script", "style", "link", "input", "template", "noscript", "meta", "br", "hr", "svg"]);
const attrOf = (el: Node, name: string): string | null => { const a = el.attrs.find((x) => x.name === name); return a ? (a.value ?? "") : null; };
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", reg: "®", ndash: "–", mdash: "—", auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", eacute: "é", egrave: "è", agrave: "à" };

/** The words of a piece of HTML. */
export function wordsIn(html: string): string {
  return html.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, " ").replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (all, n: string) => ENT[n] ?? all).replace(/\s+/g, " ").trim();
}
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : s);

function shows(el: Node, html: string): boolean {
  if (SKIP.has(el.tag) || /display\s*:\s*none/i.test(attrOf(el, "style") ?? "")) return false;
  const inner = html.slice(el.start, el.end);
  return wordsIn(inner).length > 1 || /<(img|picture|video)\b/i.test(inner) || /desktop_image/.test(inner);
}

function findsIt(root: Node, sel: string, el: Node): boolean {
  const g = parseSelector(sel);
  if (!g) return false;
  const all = selectAll(root, g);
  return all.length === 1 && all[0] === el;
}

const CLASS_OK = (c: string) => /^[A-Za-z_-][\w-]*$/.test(c) && !/^(active|_active|selected|clearfix|hidden|visible|apx-|am-)/.test(c);
function stepOf(el: Node): string {
  const cls = (attrOf(el, "class") ?? "").split(/\s+/).filter(CLASS_OK).slice(0, 2);
  const same = el.parent ? el.parent.children.filter((x) => x.tag === el.tag) : [el];
  return `${el.tag}${cls.map((c) => `.${c}`).join("")}${same.length > 1 ? `:nth-of-type(${same.indexOf(el) + 1})` : ""}`;
}

/** A selector that finds exactly this block: its id, its Page Builder style key, else its path from the page's column. */
export function blockSelector(root: Node, el: Node, main: Node, mainSel: string): string {
  const id = attrOf(el, "id");
  if (id && /^[A-Za-z][\w-]*$/.test(id) && findsIt(root, `#${id}`, el)) return `#${id}`;
  const pb = attrOf(el, "data-pb-style");
  if (pb && /^[A-Z0-9]{4,12}$/i.test(pb) && findsIt(root, `${el.tag}[data-pb-style="${pb}"]`, el)) return `${el.tag}[data-pb-style="${pb}"]`;
  const steps: string[] = [];
  for (let cur: Node | null = el; cur && cur !== main && cur.tag !== "#root"; cur = cur.parent) steps.unshift(stepOf(cur));
  const sel = `${mainSel} > ${steps.join(" > ")}`;
  return findsIt(root, sel, el) ? sel : "";
}

/** The page's slider and its content blocks in their order (a wrapper holding one block looked into), at most `max`. */
export function placesIn(html: string, max = 16): PagePlaces {
  const root = parseHtml(html);
  let main: Node | undefined;
  let mainSel = "";
  for (const sel of ["#maincontent .column.main", "#maincontent"]) {
    const g = parseSelector(sel);
    main = g ? selectAll(root, g)[0] : undefined;
    if (main) { mainSel = sel; break; }
  }
  const sliderG = parseSelector('[data-content-type="slider"]');
  const slider = !!(sliderG && main && selectAll(main, sliderG).length);
  if (!main) return { slider, blocks: [] };
  let kids = main.children.filter((c) => shows(c, html));
  for (let n = 0; kids.length === 1 && n < 8; n++) kids = kids[0].children.filter((c) => shows(c, html));
  const blocks: PageBlock[] = [];
  for (const el of kids) {
    if (blocks.length >= max) break;
    const sel = blockSelector(root, el, main, mainSel);
    if (!sel) continue;
    const inner = html.slice(el.start, el.end);
    const heading = wordsIn(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1\s*>/i.exec(inner)?.[2] ?? "");
    const text = wordsIn(inner);
    const pictures = /<(img|picture)\b|desktop_image/i.test(inner);
    const isSlider = /data-content-type="slider"/.test(inner);
    // a picture without words: named by what it shows (its alt text), else "A picture"
    const alt = wordsIn(/<img\b[^>]*\balt\s*=\s*"([^"]*)"/i.exec(inner)?.[1] ?? "");
    blocks.push({
      selector: sel,
      name: cut(isSlider ? "The slider" : heading || text || (pictures ? (alt ? `The picture "${alt}"` : "A picture") : "A block"), 60),
      text: cut(heading ? text.replace(heading, "").trim() : "", 90),
    });
  }
  // two blocks of the same name: each says where it stands
  const seen = new Map<string, number>();
  for (const b of blocks) seen.set(b.name, (seen.get(b.name) ?? 0) + 1);
  blocks.forEach((b, i) => { if ((seen.get(b.name) ?? 0) > 1) b.name = `${b.name} (block ${i + 1})`; });
  return { slider, blocks };
}
