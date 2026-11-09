// PAGE - CAN IT BE READ? (Content v6, 09.11.2026). Pure: no "@/" imports. The colour sums are tested in node; the
// page readers below take the frame's own window (the preview is a same-origin frame without scripts, so the studio reads
// its computed styles from outside).
//
// SARCLA 09.11.2026 about the AI's "fact-based benefit intro under the H1": dark grey text on the dark petrol hero,
// invisible bullet lines with only red dots showing - "pure shit". So what the AI puts on a page is LOOKED AT before it
// counts as done: every text of the new block against its real background (WCAG contrast, 4.5:1 at least), text the
// colour of its ground, text with no size or cut off, a block that runs out of its place or makes the page scroll
// sideways. The element the AI is asked about is described to it the same way (its look): the ground it stands on, its
// text colour, its font, its width and the container's.

/* ── colours ──────────────────────────────────────────────────────────── */

export type Rgba = { r: number; g: number; b: number; a: number };

/** A CSS colour as the browser computes it ("rgb(39, 78, 100)", "rgba(0, 0, 0, 0)", "#274e64") - null when it is none. */
export function parseColor(css: string | null | undefined): Rgba | null {
  const s = String(css ?? "").trim().toLowerCase();
  if (!s || s === "none") return null;
  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const hex = /^#([0-9a-f]{3,8})$/.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    const n = (i: number) => Number.parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: Math.max(0, Math.min(1, a)) };
  }
  return null;
}

/** `top` laid over `under` (an opaque ground). */
export function over(top: Rgba, under: Rgba): Rgba {
  const a = top.a;
  return { r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1 };
}

const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = (c: Rgba) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);

/** The contrast of two opaque colours, 1 to 21 (WCAG). */
export function contrast(a: Rgba, b: Rgba): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export const hexOf = (c: Rgba) => `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** The colours a gradient (or any background-image value) names - its stops. */
export function colorsIn(css: string): Rgba[] {
  return [...String(css).matchAll(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/gi)].map((m) => parseColor(m[0])).filter((c): c is Rgba => !!c);
}

/** The least contrast a text colour has against any of the grounds it may stand on. */
export function worstContrast(text: Rgba, grounds: Rgba[]): { ratio: number; ground: Rgba } {
  let worst = { ratio: 21, ground: grounds[0] ?? { r: 255, g: 255, b: 255, a: 1 } };
  for (const g of grounds) {
    const t = text.a < 1 ? over(text, g) : text;
    const r = contrast(t, g);
    if (r < worst.ratio) worst = { ratio: r, ground: g };
  }
  return worst;
}

/** A colour said in plain words for the person (and the AI): its name when it is one of the shop's, else its code. */
export function colorName(c: Rgba): string {
  const h = hexOf(c);
  const named: Record<string, string> = {
    "#274e64": "petrol", "#1b3a4b": "dark petrol", "#d80901": "the shop's red", "#ffffff": "white", "#000000": "black",
    "#5e5e5e": "grey", "#1d2326": "near-black", "#f3f4f5": "light grey", "#f2f4f5": "light grey",
  };
  if (named[h]) return `${named[h]} ${h}`;
  const l = luminance(c);
  const word = l > 0.85 ? "near-white" : l > 0.45 ? "light" : l > 0.15 ? "mid" : l > 0.04 ? "dark" : "very dark";
  const hue = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 24 ? "grey" : c.r >= c.g && c.r >= c.b ? (c.g > c.b + 40 ? "orange" : "red") : c.g >= c.b ? "green" : "blue";
  return `${word} ${hue} ${h}`;
}

/* ── the page, read from its frame ────────────────────────────────────── */

type Win = Window & typeof globalThis;
const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

/** The grounds an element's text stands on: its own background and those under it, down to the page's white. A picture
 * under it (no colour of its own over it) = not known (null): the text over a photo is not judged here. */
export function groundsOf(el: Element, win: Win): Rgba[] | null {
  const layers: { color: Rgba | null; image: string }[] = [];
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    const cs = win.getComputedStyle(cur);
    layers.push({ color: parseColor(cs.backgroundColor), image: cs.backgroundImage && cs.backgroundImage !== "none" ? cs.backgroundImage : "" });
  }
  // from the page's white up to the element: each layer over what is under it
  let grounds: Rgba[] = [WHITE];
  for (let i = layers.length - 1; i >= 0; i--) {
    const L = layers[i];
    if (L.image) {
      const stops = colorsIn(L.image);
      if (/url\(/i.test(L.image) && !stops.length) {
        // a photo: known again only once an opaque colour lies over it
        grounds = [];
      } else if (stops.length) {
        const next: Rgba[] = [];
        for (const s of stops) for (const g of grounds.length ? grounds : [WHITE]) next.push(s.a < 1 ? over(s, g) : s);
        grounds = next.slice(0, 12);
      }
    }
    if (L.color && L.color.a > 0) {
      grounds = L.color.a >= 1 ? [L.color] : (grounds.length ? grounds : []).map((g) => over(L.color!, g));
      if (!grounds.length && L.color.a >= 0.85) grounds = [{ ...L.color, a: 1 }];
    }
  }
  return grounds.length ? grounds : null;
}

/** What the AI is told of an element it is asked about: how it looks on the page now. */
export type Look = {
  /** the ground it stands on ("#274e64"), "a picture" when a photo is under it */
  ground: string;
  /** its text colour, font, size and weight */
  color: string; font: string; size: string; weight: string;
  /** its width, the page's, and the shop's content container around it (px) */
  width: number; page: number; container: number | null;
  /** the page's own heading and link colours, for a block that fits in */
  heading: string | null; link: string | null;
};

export function lookOf(el: Element, win: Win): Look {
  const cs = win.getComputedStyle(el);
  const grounds = groundsOf(el, win);
  const color = parseColor(cs.color);
  const doc = el.ownerDocument;
  let container: number | null = null;
  for (let cur: Element | null = el.parentElement; cur && cur !== doc.body; cur = cur.parentElement) {
    const mw = win.getComputedStyle(cur).maxWidth;
    if (mw && mw !== "none" && /px$/.test(mw) && Number.parseFloat(mw) >= 600) { container = Math.round(Number.parseFloat(mw)); break; }
  }
  const main = doc.getElementById("maincontent") ?? doc.body;
  const h = main.querySelector("h2, h3");
  const a = main.querySelector(".column.main a[href]");
  return {
    ground: grounds ? grounds.map(hexOf).slice(0, 3).join(" to ") : "a picture",
    color: color ? hexOf(color.a < 1 && grounds ? over(color, grounds[0]) : color) : "-",
    font: cs.fontFamily.split(",").slice(0, 2).join(",").trim(), size: cs.fontSize, weight: cs.fontWeight,
    width: Math.round(el.getBoundingClientRect().width), page: Math.round(doc.documentElement.clientWidth), container,
    heading: h ? hexOf(parseColor(win.getComputedStyle(h).color) ?? WHITE) : null,
    link: a ? hexOf(parseColor(win.getComputedStyle(a).color) ?? WHITE) : null,
  };
}

/** The look in one line for the AI (a few hundred characters - it travels in the request). */
export function lookLine(l: Look): string {
  return `ground ${l.ground}; text ${l.color}; font ${l.font} ${l.size} weight ${l.weight}; element ${l.width}px wide on a ${l.page}px page`
    + `${l.container ? `; the content container around it: max ${l.container}px` : ""}${l.heading ? `; the page's headings ${l.heading}` : ""}${l.link ? `; its links ${l.link}` : ""}`;
}

/* ── the check of a new block ─────────────────────────────────────────── */

export type Problem = { kind: "contrast" | "same" | "invisible" | "clipped" | "overflow" | "empty"; text: string; why: string };

const MIN_RATIO = 4.5;
const words = (el: Element) => Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent ?? "").join(" ").replace(/\s+/g, " ").trim();
const cut = (s: string) => (s.length > 48 ? `${s.slice(0, 46)}…` : s);

/**
 * What is wrong with a block a change put in the page (its top elements: data-apx-c="<index>"), as the frame shows it:
 * text that cannot be read (below 4.5:1 on its real ground, or the ground's own colour), text with no size, hidden or
 * cut off, a block wider than its place or making the page scroll sideways. Empty = it reads well.
 */
export function checkBlock(doc: Document, win: Win, index: number): Problem[] {
  const tops = Array.from(doc.querySelectorAll(`[data-apx-c="${index}"]`)).filter((e) => e.tagName !== "STYLE" && e.tagName !== "SCRIPT");
  const out: Problem[] = [];
  const seen = new Set<string>();
  const add = (p: Problem) => { const k = `${p.kind}|${p.text}`; if (!seen.has(k) && out.length < 8) { seen.add(k); out.push(p); } };
  if (!tops.length) return [{ kind: "empty", text: "", why: "The new block is not on the page - its place was not found." }];
  const page = doc.documentElement.clientWidth;
  let shown = 0;
  for (const top of tops) {
    const r = top.getBoundingClientRect();
    if (r.width > 1 && r.height > 1) shown++;
    // wider than its place, or out of the page
    const parent = top.parentElement;
    const pr = parent?.getBoundingClientRect();
    if (pr && (r.right > pr.right + 2 || r.left < pr.left - 2) && r.width > pr.width + 2) add({ kind: "overflow", text: "", why: `The new block is ${Math.round(r.width)} px wide in a place of ${Math.round(pr.width)} px - it runs out of the page's column.` });
    if (r.right > page + 2 || r.left < -2) add({ kind: "overflow", text: "", why: `The new block runs past the edge of the screen (${Math.round(r.right)} px on a ${page} px page).` });
    for (const el of [top, ...Array.from(top.querySelectorAll("*"))]) {
      if (/^(STYLE|SCRIPT|BR|SVG|PATH|USE|IMG)$/i.test(el.tagName)) continue;
      const er = el.getBoundingClientRect();
      if (er.right > page + 2 && er.width > 0) add({ kind: "overflow", text: cut(words(el)), why: `Something in the new block runs past the edge of the screen (${Math.round(er.right)} px on a ${page} px page).` });
      const t = words(el);
      if (!t || t.length < 2) continue;
      const cs = win.getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") { add({ kind: "invisible", text: cut(t), why: `"${cut(t)}" is hidden.` }); continue; }
      let op = 1;
      for (let cur: Element | null = el; cur; cur = cur.parentElement) op *= Number(win.getComputedStyle(cur).opacity || 1);
      const size = Number.parseFloat(cs.fontSize) || 0;
      if (size < 9 || er.width < 1 || er.height < 1 || op < 0.15) { add({ kind: "invisible", text: cut(t), why: `"${cut(t)}" has no size or cannot be seen (${size < 9 ? `${size}px text` : op < 0.15 ? "almost transparent" : "no room"}).` }); continue; }
      if ((cs.overflow === "hidden" || cs.overflowX === "hidden" || cs.overflowY === "hidden" || cs.textOverflow === "ellipsis") && cs.webkitLineClamp === "none"
        && (el.scrollHeight > el.clientHeight + 3 || el.scrollWidth > el.clientWidth + 3)) {
        add({ kind: "clipped", text: cut(t), why: `"${cut(t)}" is cut off - its box is too small for its words.` });
      }
      const c = parseColor(cs.color);
      const grounds = groundsOf(el, win);
      if (!c || !grounds) continue;
      if (c.a < 0.15) { add({ kind: "invisible", text: cut(t), why: `"${cut(t)}" has a transparent colour.` }); continue; }
      const w = worstContrast(c, grounds);
      const shownC = c.a < 1 ? over(c, w.ground) : c;
      if (w.ratio < 1.25) add({ kind: "same", text: cut(t), why: `"${cut(t)}" is ${colorName(shownC)} on ${colorName(w.ground)} - the same colour as its ground: it cannot be read.` });
      else if (w.ratio < MIN_RATIO) add({ kind: "contrast", text: cut(t), why: `"${cut(t)}" is ${colorName(shownC)} on ${colorName(w.ground)} - a contrast of ${w.ratio.toFixed(1)}:1, it needs 4.5:1 to be read.` });
    }
  }
  if (!shown) add({ kind: "empty", text: "", why: "The new block takes no room on the page - nothing of it shows." });
  return out;
}

/** The problems in plain words, one line - what the studio says and what the AI is told to fix. */
export function problemsLine(list: Problem[], max = 3): string {
  return list.slice(0, max).map((p) => p.why).join(" ") + (list.length > max ? ` (${list.length - max} more)` : "");
}
