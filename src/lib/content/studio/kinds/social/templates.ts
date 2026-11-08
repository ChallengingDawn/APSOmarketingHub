// SOCIAL POST - OUR TEMPLATES (SARCLA 08.11.2026: "Brand templates: take them out completely, these are PA, not ours.
// Improve the templates a lot"; text "motion-design quality we are used to").
//
// Every template is a real layout of the canvas (nodes you can move, restyle, delete), built for the board it lands on -
// landscape, square, portrait or story - from one grid and one type system, the one of our films: Jost (the stand-in for
// the shop's futura-pt) 700 for what is said, 500 for the rest; key words in APSOparts red; ink on the films' light
// blueprint grid, or white on petrol; the logo top left; generous margins; nothing letter-spaced. The words are the
// shop's own offer (its six technologies, DirectCUT, Quickorder) or plain placeholders to replace - never a made-up
// figure, price or certificate. The pictures are the shop's own technology photos, passed through the hub.
// Pure (a text measure is handed in by the browser; tests use the estimate) - tests/studio-social-templates.test.ts.

import type { DesignDocument, DesignNode } from "../../../../design-document";
import { estimateMeasure, layoutRich, type Measure } from "../../../../editor/richText";
import { SHOP_PHOTOS } from "../banner/brand";
import { C, LOGOS, type LogoKey, type Size } from "./design";

/** A measure for Jost at a size and weight (the browser's real one, or the estimate). */
export type MeasureFor = (size: number, weight: number) => Measure;
export const estimateFor: MeasureFor = (size, weight) => estimateMeasure(size, weight >= 600);

export type Words = {
  eyebrow?: string;
  headline?: string;
  body?: string;
  cta?: string;
  number?: string;
  items?: string[];
  who?: string;
};

export type TemplateKey =
  | "spotlight" | "stat" | "quote" | "tip" | "cover" | "slide" | "new" | "compare"
  | "checklist" | "event" | "fact" | "hiring" | "poster" | "statement" | "photo";

/** A shop photo through the hub (a canvas may draw it and still be exported). */
export const shopPhoto = (key: string) => {
  const p = SHOP_PHOTOS.find((x) => x.key === key) ?? SHOP_PHOTOS[0];
  return `/api/content/studio/banner/picture?u=${encodeURIComponent(p.url)}`;
};

/* ── the grid ──────────────────────────────────────────────────────────────────────────────────────────────────── */

export type Shape = "wide" | "square" | "tall" | "story";
export const shapeOf = (s: Size): Shape => (s.w / s.h > 1.3 ? "wide" : s.h / s.w > 1.6 ? "story" : s.h / s.w > 1.12 ? "tall" : "square");

type Grid = { W: number; H: number; shape: Shape; u: number; m: number; top: number; bottom: number };

function gridOf(s: Size): Grid {
  const shape = shapeOf(s);
  // one unit = a pixel of the square post; a landscape post's type is smaller, a story's no bigger than a square's
  const u = Math.min(s.w / 1080, Math.sqrt(s.w * s.h) / 1080);
  const m = Math.round(Math.min(s.w, s.h) * (shape === "wide" ? 0.07 : 0.075));
  // a story keeps its words between the platforms' own bars (y 250 to 1650 of 1920)
  const top = shape === "story" ? Math.round(s.h * 0.13) : m;
  const bottom = shape === "story" ? Math.round(s.h * 0.86) : s.h - m;
  return { W: s.w, H: s.h, shape, u, m, top, bottom };
}

let seq = 0;
const nid = (p: string) => `${p}${Date.now().toString(36)}${(seq += 1)}`;
const r = Math.round;

/* ── type ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

type Placed = { nodes: DesignNode[]; h: number };

type TextOpts = {
  size: number; weight?: 500 | 700; color?: string; key?: string; lh?: number; align?: "left" | "center" | "right"; tight?: boolean;
  list?: "number" | "check" | "bullet" | "dash";
};

function textBlock(text: string, x: number, w: number, o: TextOpts, mf: MeasureFor): Placed {
  const weight = o.weight ?? 700;
  const lh = o.lh ?? (weight === 700 ? 1.06 : 1.32);
  const ls = o.tight === false ? 0 : weight === 700 ? -0.01 * o.size : 0;
  const lay = layoutRich(o.list ? text.split("\n").map((l) => `0. ${l}`).join("\n") : text, { width: w, fontSize: o.size, lineHeight: lh, letterSpacing: ls, measure: mf(o.size, weight) });
  const node: DesignNode = {
    id: nid("t"), kind: "text", x: r(x), y: 0, width: r(w), text, fill: o.color ?? C.ink, fontKey: "futura", fontSize: r(o.size),
    fontStyle: String(weight), lineHeight: lh, align: o.align ?? "left",
    ...(ls ? { letterSpacing: Math.round(ls * 100) / 100 } : {}),
    ...(o.key ? { keyFill: o.key } : {}),
    ...(o.list ? { listStyle: o.list } : {}),
  };
  return { nodes: [node], h: lay.height };
}

/** The largest size (from `max` down to `min`) at which the text takes at most `lines` lines and fits `maxH`. */
function fitSize(text: string, w: number, max: number, min: number, lines: number, mf: MeasureFor, maxH = Infinity, weight = 700, lh = 1.06): number {
  for (let size = max; size > min; size -= Math.max(1, r(max * 0.04))) {
    const lay = layoutRich(text, { width: w, fontSize: size, lineHeight: lh, letterSpacing: -0.01 * size, measure: mf(size, weight) });
    // a last line of one short word reads as a mistake on a poster
    const last = lay.lines[lay.lines.length - 1];
    const orphan = lay.lines.length > 1 && last.words.length === 1 && last.words[0].t.length <= 4;
    if (lay.lines.length <= lines && lay.height <= maxH && !orphan) return size;
  }
  return min;
}

/** The red bar and the kicker beside it, as one group. */
function eyebrow(text: string, x: number, w: number, g: Grid, mf: MeasureFor, color: string = C.mute): Placed {
  const size = r(30 * g.u);
  const bar = { w: r(42 * g.u), h: Math.max(3, r(6 * g.u)) };
  const t = textBlock(text, x + bar.w + r(16 * g.u), w - bar.w - r(16 * g.u), { size, weight: 500, color, lh: 1.2 }, mf);
  const group = nid("g");
  const lineH = size * 1.2;
  const rect: DesignNode = { id: nid("bar"), kind: "rect", x: r(x), y: r((lineH - bar.h) / 2), width: bar.w, height: bar.h, fill: C.red, cornerRadius: bar.h / 2, groupId: group };
  return { nodes: [rect, ...t.nodes.map((n) => ({ ...n, groupId: group }))], h: t.h };
}

/** The shop's button: a red pill and its words, one group. */
function button(text: string, x: number, g: Grid, mf: MeasureFor, o: { fill?: string; color?: string; align?: "left" | "center" | "right"; boxW?: number } = {}): Placed {
  const size = r(30 * g.u);
  const h = r(78 * g.u);
  const padX = r(36 * g.u);
  const w = r(mf(size, 700)(text) + padX * 2 + 4);
  const left = o.align === "center" && o.boxW ? x + (o.boxW - w) / 2 : o.align === "right" && o.boxW ? x + o.boxW - w : x;
  const group = nid("g");
  const pill: DesignNode = { id: nid("btn"), kind: "rect", x: r(left), y: 0, width: w, height: h, fill: o.fill ?? C.red, cornerRadius: r(14 * g.u), groupId: group };
  const label: DesignNode = {
    id: nid("t"), kind: "text", x: r(left), y: r((h - size * 1.2) / 2), width: w, text, fill: o.color ?? C.white, fontKey: "futura",
    fontSize: size, fontStyle: "700", lineHeight: 1.2, align: "center", groupId: group,
  };
  return { nodes: [pill, label], h };
}

/** Blocks stacked from `y` down (or up to `y`), with their gaps; the nodes moved to where they land. */
function stack(blocks: (Placed & { gap?: number })[], y: number, dir: "down" | "up" = "down"): DesignNode[] {
  const total = blocks.reduce((s, b, i) => s + b.h + (i ? b.gap ?? 0 : 0), 0);
  let at = dir === "down" ? y : y - total;
  const out: DesignNode[] = [];
  blocks.forEach((b, i) => {
    if (i) at += b.gap ?? 0;
    for (const n of b.nodes) out.push({ ...n, y: r(n.y + at) });
    at += b.h;
  });
  return out;
}
const heightOf = (blocks: (Placed & { gap?: number })[]) => blocks.reduce((s, b, i) => s + b.h + (i ? b.gap ?? 0 : 0), 0);

/** The logo, its letters `h` tall, its letters' top-left corner at (x, y). */
export function logoNode(key: LogoKey, x: number, y: number, h: number): DesignNode {
  const l = LOGOS[key];
  const fileH = h / l.box.h;
  const fileW = fileH * l.ratio;
  return { id: nid("logo"), kind: "image", x: r(x - l.box.x * fileW), y: r(y - l.box.y * fileH), width: r(fileW), height: r(fileH), fill: "#fff", src: l.src, opacity: 1 };
}

/** A picture (a frame with a photo in it), cut to its box. */
function picture(src: string, x: number, y: number, w: number, h: number, o: { radius?: number; mask?: "circle" } = {}): DesignNode {
  return {
    id: nid("pic"), kind: "image", x: r(x), y: r(y), width: r(w), height: r(h), fill: "#fff", src, opacity: 1,
    ...(o.radius ? { cornerRadius: r(o.radius) } : {}), ...(o.mask ? { mask: o.mask } : {}),
  };
}

function rect(x: number, y: number, w: number, h: number, fill: string, o: Partial<DesignNode> = {}): DesignNode {
  return { id: nid("r"), kind: "rect", x: r(x), y: r(y), width: r(w), height: r(h), fill, ...o };
}

function bg(s: Size, kind: "grid-light" | "grid-dark" | "dots" | "white" | "petrol" | "ink" | "photo", photo?: string): DesignDocument["background"] {
  const base = { gradientId: null, customGradient: { from: C.petrol, to: C.petrolDeep }, scrim: 0 };
  switch (kind) {
    case "grid-light": return { ...base, color: C.light, src: "/social/grid-light.svg" };
    case "grid-dark": return { ...base, color: C.petrol, src: "/social/grid-dark.svg" };
    case "dots": return { ...base, color: C.white, src: "/social/dots-light.svg" };
    case "petrol": return { ...base, color: C.petrol, src: null };
    case "ink": return { ...base, color: C.ink, src: null };
    case "photo": return { ...base, color: C.ink, src: photo ?? shopPhoto("sealing"), scrim: 0 };
    default: return { ...base, color: C.white, src: null };
  }
}

const doc = (s: Size, background: DesignDocument["background"], nodes: DesignNode[]): DesignDocument => ({ schemaVersion: 1, canvas: { w: s.w, h: s.h }, background, nodes });

/** The logo in the top left corner, black on light, white on dark. */
const cornerLogo = (g: Grid, dark: boolean) => logoNode(dark ? "white" : "black", g.m, g.shape === "story" ? g.top - r(110 * g.u) : r(g.m * 0.8), r(40 * g.u));

/** Where the words may go under the logo. */
const contentTop = (g: Grid) => (g.shape === "story" ? g.top + r(30 * g.u) : r(g.m * 0.8 + 40 * g.u + 70 * g.u));

/* ── the templates ─────────────────────────────────────────────────────────────────────────────────────────────── */

export type Template = {
  key: TemplateKey;
  name: string;
  /** One line: what it is for. */
  note: string;
  /** The words it starts with. */
  words: Words;
  build: (s: Size, w?: Words, mf?: MeasureFor) => DesignDocument;
};

const W = (base: Words, over?: Words): Required<Pick<Words, "eyebrow" | "headline" | "body" | "cta" | "number" | "who">> & { items: string[] } => ({
  eyebrow: over?.eyebrow ?? base.eyebrow ?? "",
  headline: over?.headline ?? base.headline ?? "",
  body: over?.body ?? base.body ?? "",
  cta: over?.cta ?? base.cta ?? "",
  number: over?.number ?? base.number ?? "",
  who: over?.who ?? base.who ?? "",
  items: over?.items ?? base.items ?? [],
});

/** Words, then a picture beside them (wide) or under them (the rest). */
function spotlight(s: Size, words: Words, mf: MeasureFor, o: { photo: string; dark?: boolean }): DesignDocument {
  const g = gridOf(s);
  const w = W(words);
  const dark = !!o.dark;
  const ink = dark ? C.white : C.ink;
  const mute = dark ? "#C9D6DE" : C.mute;
  const nodes: DesignNode[] = [cornerLogo(g, dark)];
  if (g.shape === "wide") {
    const picW = r(g.W * 0.42);
    const colW = g.W - g.m * 2 - picW - r(56 * g.u);
    nodes.push(picture(o.photo, g.W - g.m - picW, g.m, picW, g.H - g.m * 2, { radius: 26 * g.u }));
    const top = contentTop(g);
    const maxH = g.bottom - top - r(110 * g.u);
    const size = fitSize(w.headline, colW, r(84 * g.u), r(44 * g.u), 3, mf, maxH * 0.6);
    const blocks = [
      ...(w.eyebrow ? [eyebrow(w.eyebrow, g.m, colW, g, mf, mute)] : []),
      { ...textBlock(w.headline, g.m, colW, { size, color: ink, key: C.red }, mf), gap: r(24 * g.u) },
      ...(w.body ? [{ ...textBlock(w.body, g.m, colW, { size: r(28 * g.u), weight: 500, color: mute }, mf), gap: r(20 * g.u) }] : []),
    ];
    nodes.push(...stack(blocks, top));
    if (w.cta) nodes.push(...stack([button(w.cta, g.m, g, mf)], g.bottom, "up"));
    return doc(s, bg(s, dark ? "grid-dark" : "grid-light"), nodes);
  }
  const colW = g.W - g.m * 2;
  const top = contentTop(g);
  const size = fitSize(w.headline, colW, r((g.shape === "story" ? 112 : 96) * g.u), r(56 * g.u), 3, mf);
  const words1 = [
    ...(w.eyebrow ? [eyebrow(w.eyebrow, g.m, colW, g, mf, mute)] : []),
    { ...textBlock(w.headline, g.m, colW, { size, color: ink, key: C.red }, mf), gap: r(26 * g.u) },
    ...(w.body ? [{ ...textBlock(w.body, g.m, colW * 0.92, { size: r(32 * g.u), weight: 500, color: mute }, mf), gap: r(22 * g.u) }] : []),
  ];
  const textH = heightOf(words1);
  nodes.push(...stack(words1, top));
  const btn = w.cta ? button(w.cta, g.m, g, mf) : null;
  const picTop = top + textH + r(46 * g.u);
  const picBottom = g.bottom - (btn ? btn.h + r(36 * g.u) : 0);
  if (picBottom - picTop > 120 * g.u) nodes.push(picture(o.photo, g.m, picTop, colW, picBottom - picTop, { radius: 30 * g.u }));
  if (btn) nodes.push(...stack([btn], g.bottom, "up"));
  return doc(s, bg(s, dark ? "grid-dark" : "grid-light"), nodes);
}

/** One big figure, its meaning, a line under it. */
function stat(s: Size, words: Words, mf: MeasureFor): DesignDocument {
  const g = gridOf(s);
  const w = W(words);
  const nodes: DesignNode[] = [cornerLogo(g, false)];
  const wide = g.shape === "wide";
  const colW = wide ? r(g.W * 0.5) : g.W - g.m * 2;
  const numSize = fitSize(w.number, colW, r((wide ? 300 : g.shape === "story" ? 420 : 360) * g.u), r(120 * g.u), 1, mf);
  const num = textBlock(w.number, g.m, colW, { size: numSize, color: C.red, lh: 0.92 }, mf);
  const headSize = fitSize(w.headline, wide ? g.W - g.m * 3 - colW : colW, r((wide ? 64 : 84) * g.u), r(40 * g.u), 3, mf);
  if (wide) {
    const blocksR = [
      textBlock(w.headline, g.m * 2 + colW, g.W - g.m * 3 - colW, { size: headSize, color: C.ink, key: C.red }, mf),
      ...(w.body ? [{ ...textBlock(w.body, g.m * 2 + colW, g.W - g.m * 3 - colW, { size: r(26 * g.u), weight: 500, color: C.mute }, mf), gap: r(20 * g.u) }] : []),
    ];
    const mid = (contentTop(g) + g.bottom) / 2;
    nodes.push(...stack([num], r(mid - num.h / 2)));
    nodes.push(...stack(blocksR, r(mid - heightOf(blocksR) / 2)));
    nodes.push(rect(g.m * 2 + colW - r(28 * g.u), r(mid - 90 * g.u), Math.max(2, r(4 * g.u)), r(180 * g.u), C.red));
  } else {
    const blocks = [
      num,
      { ...rect(g.m, 0, r(96 * g.u), Math.max(3, r(8 * g.u)), C.red), h: Math.max(3, r(8 * g.u)), nodes: [rect(g.m, 0, r(96 * g.u), Math.max(3, r(8 * g.u)), C.red)], gap: r(40 * g.u) },
      { ...textBlock(w.headline, g.m, colW, { size: headSize, color: C.ink, key: C.red }, mf), gap: r(36 * g.u) },
      ...(w.body ? [{ ...textBlock(w.body, g.m, colW * 0.9, { size: r(30 * g.u), weight: 500, color: C.mute }, mf), gap: r(24 * g.u) }] : []),
    ];
    const free = g.bottom - contentTop(g);
    nodes.push(...stack(blocks, r(contentTop(g) + Math.max(0, (free - heightOf(blocks)) * 0.42))));
  }
  return doc(s, bg(s, "grid-light"), nodes);
}

/** A quote: the red quotation mark, the words, who said them. */
function quote(s: Size, words: Words, mf: MeasureFor): DesignDocument {
  const g = gridOf(s);
  const w = W(words);
  const colW = g.W - g.m * 2 - (g.shape === "wide" ? r(g.W * 0.12) : 0);
  const nodes: DesignNode[] = [cornerLogo(g, false)];
  const qSize = fitSize(w.headline, colW, r((g.shape === "wide" ? 58 : 70) * g.u), r(36 * g.u), g.shape === "story" ? 7 : 5, mf, Infinity, 500, 1.18);
  const blocks = [
    textBlock("“", g.m - r(6 * g.u), r(200 * g.u), { size: r((g.shape === "wide" ? 200 : 260) * g.u), color: C.red, lh: 0.62, tight: false }, mf),
    { ...textBlock(w.headline, g.m, colW, { size: qSize, weight: 500, color: C.ink, key: C.red, lh: 1.18 }, mf), gap: r(14 * g.u) },
    { ...rect(0, 0, 0, 0, C.red), h: Math.max(3, r(5 * g.u)), nodes: [rect(g.m, 0, r(60 * g.u), Math.max(3, r(5 * g.u)), C.red)], gap: r(46 * g.u) },
    { ...textBlock(w.who, g.m, colW, { size: r(28 * g.u), weight: 500, color: C.mute, lh: 1.3 }, mf), gap: r(22 * g.u) },
  ];
  const free = g.bottom - contentTop(g);
  nodes.push(...stack(blocks, r(contentTop(g) + Math.max(0, (free - heightOf(blocks)) * 0.45))));
  return doc(s, bg(s, "dots"), nodes);
}

/** A headline over a list - numbered steps, or ticks. */
function listed(s: Size, words: Words, mf: MeasureFor, style: "number" | "check", dark = false): DesignDocument {
  const g = gridOf(s);
  const w = W(words);
  const ink = dark ? C.white : C.ink;
  const nodes: DesignNode[] = [cornerLogo(g, dark)];
  const wide = g.shape === "wide";
  const headW = wide ? r(g.W * 0.4) : g.W - g.m * 2;
  const headSize = fitSize(w.headline, headW, r((wide ? 64 : 88) * g.u), r(40 * g.u), wide ? 4 : 3, mf);
  const head = [
    ...(w.eyebrow ? [eyebrow(w.eyebrow, g.m, headW, g, mf, dark ? "#C9D6DE" : C.mute)] : []),
    { ...textBlock(w.headline, g.m, headW, { size: headSize, color: ink, key: C.red }, mf), gap: r(24 * g.u) },
  ];
  const items = w.items.slice(0, 6);
  const listX = wide ? g.m * 2 + headW : g.m;
  const listW = wide ? g.W - g.m * 3 - headW : g.W - g.m * 2;
  const itemSize = r((wide ? 30 : g.shape === "story" ? 44 : 38) * g.u);
  // each item on its own row, a hairline between them - as the carousel's list slide draws it
  const rows: (Placed & { gap?: number })[] = items.map((t, i) => {
    const row = textBlock(t, listX + r(itemSize * 1.9), listW - r(itemSize * 1.9), { size: itemSize, weight: 500, color: ink, lh: 1.25 }, mf);
    const mark = textBlock(style === "number" ? String(i + 1).padStart(2, "0") : "✓", listX, r(itemSize * 1.6), { size: itemSize, weight: 700, color: C.red, lh: 1.25, tight: false }, mf);
    const pad = r(itemSize * 0.62);
    const line = rect(listX, 0, listW, Math.max(1, r(2 * g.u)), dark ? "rgba(255,255,255,0.18)" : "rgba(39,78,100,0.16)");
    const h = row.h + pad * 2;
    return { nodes: [line, ...[...mark.nodes, ...row.nodes].map((n) => ({ ...n, y: pad }))], h };
  });
  if (wide) {
    const mid = (contentTop(g) + g.bottom) / 2;
    nodes.push(...stack(head, r(Math.max(contentTop(g), mid - heightOf(head) / 2))));
    nodes.push(...stack(rows, r(Math.max(g.m, mid - heightOf(rows) / 2))));
  } else {
    const all = [...head, ...rows.map((b, i) => ({ ...b, gap: i === 0 ? r(54 * g.u) : 0 }))];
    const free = g.bottom - contentTop(g);
    nodes.push(...stack(all, r(contentTop(g) + Math.max(0, (free - heightOf(all)) * (g.shape === "story" ? 0.4 : 0.2)))));
  }
  return doc(s, bg(s, dark ? "grid-dark" : "grid-light"), nodes);
}

/** The carousel's first page: the hook, big, and the sign to swipe. */
function cover(s: Size, words: Words, mf: MeasureFor): DesignDocument {
  const g = gridOf(s);
  const w = W(words);
  const colW = g.W - g.m * 2 - (g.shape === "wide" ? r(g.W * 0.18) : 0);
  const nodes: DesignNode[] = [cornerLogo(g, true)];
  const size = fitSize(w.headline, colW, r((g.shape === "story" ? 140 : g.shape === "wide" ? 92 : 120) * g.u), r(52 * g.u), 4, mf);
  const blocks = [
    ...(w.eyebrow ? [eyebrow(w.eyebrow, g.m, colW, g, mf, "#C9D6DE")] : []),
    { ...textBlock(w.headline, g.m, colW, { size, color: C.white, key: "#FF5A4F" }, mf), gap: r(30 * g.u) },
  ];
  const free = g.bottom - contentTop(g) - r(120 * g.u);
  nodes.push(...stack(blocks, r(contentTop(g) + Math.max(0, (free - heightOf(blocks)) * 0.5))));
  // the swipe sign, bottom right: the word and a red disc with an arrow
  const d = r(84 * g.u);
  const group = nid("g");
  const swipe = textBlock(w.cta || "Swipe", g.W - g.m - d - r(260 * g.u), r(240 * g.u), { size: r(30 * g.u), weight: 500, color: "#C9D6DE", align: "right", lh: 1.2 }, mf);
  nodes.push({ id: nid("disc"), kind: "ellipse", x: g.W - g.m - d, y: g.bottom - d, width: d, height: d, fill: C.red, groupId: group });
  nodes.push({ id: nid("arrow"), kind: "arrow", x: r(g.W - g.m - d * 0.72), y: r(g.bottom - d / 2), width: r(d * 0.44), fill: C.white, stroke: C.white, strokeWidth: Math.max(2, r(6 * g.u)), groupId: group });
  nodes.push(...stack([swipe], r(g.bottom - d / 2 - 18 * g.u)).map((n) => ({ ...n, groupId: group })));
  return doc(s, bg(s, "grid-dark"), nodes);
}

/** A carousel page: its number, its point, a line or two, the progress along the bottom. */
function slide(s: Size, words: Words, mf: MeasureFor): DesignDocument {
  const g = gridOf(s);
  const w = W(words);
  const colW = g.W - g.m * 2 - (g.shape === "wide" ? r(g.W * 0.2) : 0);
  const nodes: DesignNode[] = [cornerLogo(g, false)];
  const size = fitSize(w.headline, colW, r((g.shape === "wide" ? 76 : 96) * g.u), r(44 * g.u), 3, mf);
  const blocks = [
    textBlock(w.number || "02", g.m, r(400 * g.u), { size: r((g.shape === "wide" ? 110 : 150) * g.u), color: C.red, lh: 1 }, mf),
    { ...textBlock(w.headline, g.m, colW, { size, color: C.ink, key: C.red }, mf), gap: r(26 * g.u) },
    ...(w.body ? [{ ...textBlock(w.body, g.m, colW * 0.92, { size: r(32 * g.u), weight: 500, color: C.mute }, mf), gap: r(26 * g.u) }] : []),
  ];
  const free = g.bottom - contentTop(g) - r(60 * g.u);
  nodes.push(...stack(blocks, r(contentTop(g) + Math.max(0, (free - heightOf(blocks)) * 0.4))));
  const track = Math.max(3, r(6 * g.u));
  const tw = r(220 * g.u);
  nodes.push(rect(g.W - g.m - tw, g.bottom - track, tw, track, "rgba(39,78,100,0.16)", { cornerRadius: track / 2 }));
  nodes.push(rect(g.W - g.m - tw, g.bottom - track, r(tw * 0.34), track, C.red, { cornerRadius: track / 2 }));
  return doc(s, bg(s, "grid-light"), nodes);
}

/** New in the shop: the photo across the top, the words on white under it. */
function newIn(s: Size, words: Words, mf: MeasureFor, photo: string): DesignDocument {
  const g = gridOf(s);
  const w = W(words);
  if (g.shape === "wide") return spotlight(s, words, mf, { photo });
  const nodes: DesignNode[] = [];
  const picH = r(g.H * (g.shape === "story" ? 0.5 : 0.52));
  nodes.push(picture(photo, 0, 0, g.W, picH));
  nodes.push(logoNode("white", g.m, g.shape === "story" ? g.top - r(110 * g.u) : r(g.m * 0.8), r(40 * g.u)));
  const colW = g.W - g.m * 2;
  const size = fitSize(w.headline, colW, r(92 * g.u), r(48 * g.u), 2, mf);
  const blocks = [
    ...(w.eyebrow ? [eyebrow(w.eyebrow, g.m, colW, g, mf)] : []),
    { ...textBlock(w.headline, g.m, colW, { size, color: C.ink, key: C.red }, mf), gap: r(20 * g.u) },
    ...(w.body ? [{ ...textBlock(w.body, g.m, colW, { size: r(30 * g.u), weight: 500, color: C.mute }, mf), gap: r(18 * g.u) }] : []),
  ];
  nodes.push(...stack(blocks, picH + r(56 * g.u)));
  if (w.cta) nodes.push(...stack([button(w.cta, g.m, g, mf)], g.bottom, "up"));
  return doc(s, bg(s, "white"), nodes);
}

/** Two options side by side (stacked on a story): a title and three points each. */
function compare(s: Size, words: Words, mf: MeasureFor): DesignDocument {
  const g = gridOf(s);
  const w = W(words);
  const nodes: DesignNode[] = [cornerLogo(g, false)];
  const colW = g.W - g.m * 2;
  const headSize = fitSize(w.headline, colW, r((g.shape === "wide" ? 64 : 84) * g.u), r(40 * g.u), 2, mf);
  const head = textBlock(w.headline, g.m, colW, { size: headSize, color: C.ink, key: C.red }, mf);
  const top = contentTop(g);
  nodes.push(...stack([head], top));
  const pairs = w.items.slice(0, 8).map((x) => x.split("|").map((y) => y.trim()));
  const titles = pairs[0] ?? ["Option A", "Option B"];
  const rows = pairs.slice(1);
  const across = g.shape !== "story";
  const gap = r(28 * g.u);
  const cardW = across ? (colW - gap) / 2 : colW;
  const cardTop = top + head.h + r(48 * g.u);
  const cardH = across ? g.bottom - cardTop : (g.bottom - cardTop - gap) / 2;
  [0, 1].forEach((k) => {
    const x = across ? g.m + k * (cardW + gap) : g.m;
    const y = across ? cardTop : cardTop + k * (cardH + gap);
    const hot = k === 1;
    nodes.push(rect(x, y, cardW, cardH, hot ? C.petrol : C.white, { cornerRadius: r(26 * g.u), ...(hot ? {} : { stroke: "rgba(39,78,100,0.18)", strokeWidth: Math.max(1, r(2 * g.u)) }) }));
    const pad = r(40 * g.u);
    const tSize = r((g.shape === "wide" ? 34 : 42) * g.u);
    const blocks = [
      textBlock(titles[k] ?? "", x + pad, cardW - pad * 2, { size: tSize, color: hot ? C.white : C.ink }, mf),
      ...rows.map((rw) => ({ ...textBlock(`–  ${rw[k] ?? ""}`, x + pad, cardW - pad * 2, { size: r((g.shape === "wide" ? 24 : 30) * g.u), weight: 500 as const, color: hot ? "#DCE6EC" : C.mute, lh: 1.3 }, mf), gap: r(16 * g.u) })),
    ];
    nodes.push(...stack(blocks.map((b, i) => (i === 1 ? { ...b, gap: r(26 * g.u) } : b)), y + pad));
    if (hot) nodes.push(rect(x + pad, y + cardH - pad - Math.max(3, r(6 * g.u)), r(56 * g.u), Math.max(3, r(6 * g.u)), C.red, { cornerRadius: 3 }));
  });
  return doc(s, bg(s, "grid-light"), nodes);
}

/** An event: the date block in red, what it is, where, and a button. */
function event(s: Size, words: Words, mf: MeasureFor): DesignDocument {
  const g = gridOf(s);
  const w = W(words);
  const nodes: DesignNode[] = [cornerLogo(g, true)];
  const box = r((g.shape === "wide" ? 170 : 210) * g.u);
  const [day, month] = (w.number || "12 Nov").split(/\s+/);
  const group = nid("g");
  const dateBlocks = [
    textBlock(day ?? "", 0, box, { size: r(box * 0.46), color: C.white, align: "center", lh: 1 }, mf),
    { ...textBlock(month ?? "", 0, box, { size: r(box * 0.16), weight: 500, color: C.white, align: "center", lh: 1.2 }, mf), gap: r(box * 0.04) },
  ];
  const dateH = heightOf(dateBlocks);
  const colW = g.shape === "wide" ? g.W - g.m * 3 - box : g.W - g.m * 2;
  const headSize = fitSize(w.headline, colW, r((g.shape === "wide" ? 74 : 96) * g.u), r(44 * g.u), 3, mf);
  const blocksText = [
    ...(w.eyebrow ? [eyebrow(w.eyebrow, 0, colW, g, mf, "#C9D6DE")] : []),
    { ...textBlock(w.headline, 0, colW, { size: headSize, color: C.white, key: "#FF5A4F" }, mf), gap: r(24 * g.u) },
    ...(w.body ? [{ ...textBlock(w.body, 0, colW, { size: r(30 * g.u), weight: 500, color: "#C9D6DE" }, mf), gap: r(20 * g.u) }] : []),
  ];
  const shift = (ns: DesignNode[], dx: number) => ns.map((n) => ({ ...n, x: n.x + dx }));
  if (g.shape === "wide") {
    const mid = (contentTop(g) + g.bottom - r(90 * g.u)) / 2;
    const y0 = r(mid - box / 2);
    nodes.push(rect(g.m, y0, box, box, C.red, { cornerRadius: r(20 * g.u), groupId: group }));
    nodes.push(...shift(stack(dateBlocks, y0 + (box - dateH) / 2), g.m).map((n) => ({ ...n, groupId: group })));
    nodes.push(...shift(stack(blocksText, r(mid - heightOf(blocksText) / 2)), g.m * 2 + box));
  } else {
    const top = contentTop(g);
    nodes.push(rect(g.m, top, box, box, C.red, { cornerRadius: r(22 * g.u), groupId: group }));
    nodes.push(...shift(stack(dateBlocks, top + (box - dateH) / 2), g.m).map((n) => ({ ...n, groupId: group })));
    nodes.push(...shift(stack(blocksText, top + box + r(56 * g.u)), g.m));
  }
  if (w.cta) nodes.push(...stack([button(w.cta, g.m, g, mf, { fill: C.white, color: C.ink })], g.bottom, "up"));
  return doc(s, bg(s, "grid-dark"), nodes);
}

/** "Did you know?": the question in red, the fact, and one of our parts drawn - an O-ring. */
function fact(s: Size, words: Words, mf: MeasureFor): DesignDocument {
  const g = gridOf(s);
  const w = W(words);
  const nodes: DesignNode[] = [];
  // the O-ring, a petrol ring with its light, half off the board on the right
  const R = r(Math.min(g.W, g.H) * (g.shape === "wide" ? 0.62 : 0.46));
  const ring = Math.max(8, r(R * 0.2));
  const cx = g.W - R * 0.42;
  const cy = g.shape === "wide" ? g.H * 0.5 : g.bottom - R * 0.3;
  nodes.push({ id: nid("ring"), kind: "ellipse", x: r(cx - R), y: r(cy - R), width: R * 2, height: R * 2, fill: "rgba(0,0,0,0)", stroke: C.petrol, strokeWidth: ring, opacity: 0.95 });
  nodes.push({ id: nid("ring"), kind: "ellipse", x: r(cx - R + ring * 0.2), y: r(cy - R + ring * 0.2), width: R * 2 - ring * 0.4, height: R * 2 - ring * 0.4, fill: "rgba(0,0,0,0)", stroke: "rgba(255,255,255,0.35)", strokeWidth: Math.max(2, r(ring * 0.14)) });
  nodes.push(cornerLogo(g, false));
  const colW = g.shape === "wide" ? r(g.W * 0.56) : g.W - g.m * 2 - r(g.W * 0.06);
  const size = fitSize(w.headline, colW, r((g.shape === "wide" ? 62 : 80) * g.u), r(40 * g.u), 4, mf);
  const blocks = [
    textBlock(w.eyebrow || "Did you know?", g.m, colW, { size: r((g.shape === "wide" ? 40 : 52) * g.u), weight: 500, color: C.red, lh: 1.1 }, mf),
    { ...textBlock(w.headline, g.m, colW, { size, color: C.ink, key: C.red }, mf), gap: r(28 * g.u) },
    ...(w.body ? [{ ...textBlock(w.body, g.m, colW * 0.9, { size: r(28 * g.u), weight: 500, color: C.mute }, mf), gap: r(24 * g.u) }] : []),
  ];
  nodes.push(...stack(blocks, contentTop(g) + (g.shape === "wide" ? 0 : r(20 * g.u))));
  return doc(s, bg(s, "grid-light"), nodes);
}

/** We're hiring: a round photo, the role, a button. */
function hiring(s: Size, words: Words, mf: MeasureFor, photo: string): DesignDocument {
  const g = gridOf(s);
  const w = W(words);
  const nodes: DesignNode[] = [cornerLogo(g, false)];
  const wide = g.shape === "wide";
  const D = r(Math.min(g.W, g.H) * (wide ? 0.62 : g.shape === "story" ? 0.62 : 0.4));
  const colW = wide ? g.W - g.m * 3 - D : g.W - g.m * 2;
  const headSize = fitSize(w.headline, colW, r((wide ? 70 : 92) * g.u), r(44 * g.u), 3, mf);
  const text = [
    ...(w.eyebrow ? [eyebrow(w.eyebrow, g.m, colW, g, mf)] : []),
    { ...textBlock(w.headline, g.m, colW, { size: headSize, color: C.ink, key: C.red }, mf), gap: r(24 * g.u) },
    ...(w.body ? [{ ...textBlock(w.body, g.m, colW, { size: r(30 * g.u), weight: 500, color: C.mute }, mf), gap: r(18 * g.u) }] : []),
  ];
  if (wide) {
    nodes.push(picture(photo, g.W - g.m - D, r((g.H - D) / 2), D, D, { mask: "circle" }));
    nodes.push({ id: nid("halo"), kind: "ellipse", x: g.W - g.m - D - r(14 * g.u), y: r((g.H - D) / 2 - 14 * g.u), width: D + r(28 * g.u), height: D + r(28 * g.u), fill: "rgba(0,0,0,0)", stroke: C.red, strokeWidth: Math.max(2, r(5 * g.u)) });
    nodes.push(...stack(text, contentTop(g)));
  } else {
    const top = contentTop(g);
    nodes.push(...stack(text, top));
    const y = top + heightOf(text) + r(50 * g.u);
    const x = g.W - g.m - D;
    nodes.push(picture(photo, x, y, D, D, { mask: "circle" }));
    nodes.push({ id: nid("halo"), kind: "ellipse", x: x - r(16 * g.u), y: y - r(16 * g.u), width: D + r(32 * g.u), height: D + r(32 * g.u), fill: "rgba(0,0,0,0)", stroke: C.red, strokeWidth: Math.max(2, r(5 * g.u)) });
  }
  if (w.cta) nodes.push(...stack([button(w.cta, g.m, g, mf)], g.bottom, "up"));
  return doc(s, bg(s, "dots"), nodes);
}

/** The films' typographic poster: three words stacked huge on the grid, the last in red, a quiet line under them. */
function poster(s: Size, words: Words, mf: MeasureFor): DesignDocument {
  const g = gridOf(s);
  const w = W(words);
  const nodes: DesignNode[] = [cornerLogo(g, false)];
  const lines = (w.headline || "Cut.\nSized.\n*Shipped.*").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 5);
  const colW = g.W - g.m * 2;
  const widest = lines.reduce((a, b) => (b.replace(/\*/g, "").length > a.replace(/\*/g, "").length ? b : a), "");
  const maxH = (g.bottom - contentTop(g) - r(150 * g.u)) / lines.length / 0.98;
  const size = Math.min(fitSize(widest.replace(/\*/g, ""), colW, r((g.shape === "wide" ? 200 : 250) * g.u), r(60 * g.u), 1, mf), r(maxH));
  const blocks = lines.map((l, i) => ({ ...textBlock(l, g.m, colW, { size, color: C.ink, key: C.red, lh: 0.98 }, mf), gap: i ? r(size * 0.02) : 0 }));
  const free = g.bottom - contentTop(g) - r(130 * g.u);
  nodes.push(...stack(blocks, r(contentTop(g) + Math.max(0, (free - heightOf(blocks)) * 0.5))));
  const foot = [
    { ...rect(0, 0, 0, 0, C.red), h: Math.max(3, r(6 * g.u)), nodes: [rect(g.m, 0, r(64 * g.u), Math.max(3, r(6 * g.u)), C.red)] },
    { ...textBlock(w.body || "", g.m, colW * 0.8, { size: r(28 * g.u), weight: 500, color: C.mute }, mf), gap: r(22 * g.u) },
  ];
  nodes.push(...stack(foot, g.bottom, "up"));
  return doc(s, bg(s, "grid-light"), nodes);
}

/** One sentence, centred, on petrol. */
function statement(s: Size, words: Words, mf: MeasureFor): DesignDocument {
  const g = gridOf(s);
  const w = W(words);
  const colW = g.W - g.m * 2 - r(g.W * (g.shape === "wide" ? 0.14 : 0.04));
  const x = (g.W - colW) / 2;
  const size = fitSize(w.headline, colW, r((g.shape === "wide" ? 88 : 112) * g.u), r(48 * g.u), 4, mf);
  const blocks = [
    textBlock(w.headline, x, colW, { size, color: C.white, key: "#FF5A4F", align: "center" }, mf),
    ...(w.body ? [{ ...textBlock(w.body, x + colW * 0.1, colW * 0.8, { size: r(30 * g.u), weight: 500, color: "#C9D6DE", align: "center" }, mf), gap: r(34 * g.u) }] : []),
  ];
  const nodes: DesignNode[] = [...stack(blocks, r((g.H - heightOf(blocks)) / 2 - 20 * g.u))];
  const lh = r(36 * g.u);
  const logo = logoNode("white", 0, 0, lh);
  nodes.push({ ...logo, x: r((g.W - (logo.width ?? 0)) / 2), y: r(g.bottom - (logo.height ?? lh)) });
  return doc(s, bg(s, "grid-dark"), nodes);
}

/** A photo across the board, darkened at the bottom, the words on it in white. */
function photoPost(s: Size, words: Words, mf: MeasureFor, photo: string): DesignDocument {
  const g = gridOf(s);
  const w = W(words);
  const colW = g.W - g.m * 2 - (g.shape === "wide" ? r(g.W * 0.25) : 0);
  const nodes: DesignNode[] = [
    { id: nid("scrim"), kind: "scrim", x: 0, y: r(g.H * 0.35), width: g.W, height: g.H - r(g.H * 0.35), fill: "rgba(10,20,28,0.88)", locked: true },
    logoNode("white", g.m, g.shape === "story" ? g.top - r(110 * g.u) : r(g.m * 0.8), r(40 * g.u)),
  ];
  const size = fitSize(w.headline, colW, r((g.shape === "wide" ? 78 : 100) * g.u), r(44 * g.u), 3, mf);
  const blocks = [
    ...(w.eyebrow ? [eyebrow(w.eyebrow, g.m, colW, g, mf, "#DCE6EC")] : []),
    { ...textBlock(w.headline, g.m, colW, { size, color: C.white, key: "#FF5A4F" }, mf), gap: r(22 * g.u) },
    ...(w.body ? [{ ...textBlock(w.body, g.m, colW * 0.9, { size: r(30 * g.u), weight: 500, color: "#DCE6EC" }, mf), gap: r(18 * g.u) }] : []),
  ];
  nodes.push(...stack(blocks, g.bottom, "up"));
  return doc(s, bg(s, "photo", photo), nodes);
}

export const TEMPLATES: Template[] = [
  {
    key: "spotlight", name: "Product spotlight", note: "A product or a range: the words, its photo, the shop's button",
    words: { eyebrow: "Engineering plastics", headline: "Plates and rods, *cut to your size*", body: "Order the exact dimensions you need with DirectCUT, right in the shop.", cta: "apsoparts.com" },
    build: (s, w, mf = estimateFor) => spotlight(s, { ...TEMPLATE_WORDS.spotlight, ...w }, mf, { photo: shopPhoto("plastics") }),
  },
  {
    key: "stat", name: "A number", note: "One figure that says it all - only a figure we really have",
    words: { number: "6", headline: "technologies, *one shop*", body: "Sealing, engineering plastics, fluid handling, drive, antivibration, sensors and power." },
    build: (s, w, mf = estimateFor) => stat(s, { ...TEMPLATE_WORDS.stat, ...w }, mf),
  },
  {
    key: "quote", name: "Quote", note: "What a customer or a colleague said - with their name",
    words: { headline: "Write the words exactly as they were said, with the *key words* in red.", who: "Name Surname, Role, Company" },
    build: (s, w, mf = estimateFor) => quote(s, { ...TEMPLATE_WORDS.quote, ...w }, mf),
  },
  {
    key: "tip", name: "Tip / how-to", note: "Steps, numbered - a tip people save",
    words: { eyebrow: "Tip", headline: "Measure an O-ring in *three steps*", items: ["The inner diameter", "The cross-section", "The material and its hardness"] },
    build: (s, w, mf = estimateFor) => listed(s, { ...TEMPLATE_WORDS.tip, ...w }, mf, "number"),
  },
  {
    key: "cover", name: "Carousel cover", note: "The first page of a carousel: the hook, big, and swipe",
    words: { eyebrow: "Sealing technology", headline: "What to check before you order a *seal*", cta: "Swipe" },
    build: (s, w, mf = estimateFor) => cover(s, { ...TEMPLATE_WORDS.cover, ...w }, mf),
  },
  {
    key: "slide", name: "Carousel page", note: "A page of a carousel: its number, its point, a line or two",
    words: { number: "01", headline: "The *medium* comes first", body: "Water, oil, steam or a cleaning agent: the material of the seal follows what it touches." },
    build: (s, w, mf = estimateFor) => slide(s, { ...TEMPLATE_WORDS.slide, ...w }, mf),
  },
  {
    key: "new", name: "New in the shop", note: "Something new: a photo across the top, the words under it",
    words: { eyebrow: "New in the shop", headline: "O-rings and X-rings, *in every size*", body: "Name the product and what it is for.", cta: "Have a look" },
    build: (s, w, mf = estimateFor) => newIn(s, { ...TEMPLATE_WORDS.new, ...w }, mf, shopPhoto("orings")),
  },
  {
    key: "compare", name: "Comparison", note: "Two ways side by side - the title row, then a point per row",
    words: { headline: "Standard part or *cut to size*?", items: ["Standard part | Cut to size with DirectCUT", "Standard dimensions | Your exact dimensions", "Ordered straight away | Ordered in the shop", "Quickorder by article number | Made for your drawing"] },
    build: (s, w, mf = estimateFor) => compare(s, { ...TEMPLATE_WORDS.compare, ...w }, mf),
  },
  {
    key: "checklist", name: "Checklist", note: "What to have ready - ticked",
    words: { eyebrow: "Checklist", headline: "Before you order an *O-ring*", items: ["Inner diameter and cross-section", "The medium it seals", "The temperature range", "The hardness (Shore A)"] },
    build: (s, w, mf = estimateFor) => listed(s, { ...TEMPLATE_WORDS.checklist, ...w }, mf, "check"),
  },
  {
    key: "event", name: "Event", note: "A date, what it is, where - and a button",
    words: { number: "12 Nov", eyebrow: "Save the date", headline: "Meet us at *the fair*", body: "Hall 0, stand 000 - put the real place here", cta: "Book a meeting" },
    build: (s, w, mf = estimateFor) => event(s, { ...TEMPLATE_WORDS.event, ...w }, mf),
  },
  {
    key: "fact", name: "Did you know?", note: "One fact worth knowing, with one of our parts drawn",
    words: { eyebrow: "Did you know?", headline: "An O-ring is named by its *inner diameter* and its cross-section.", body: "Both in millimetres - measure them before you order." },
    build: (s, w, mf = estimateFor) => fact(s, { ...TEMPLATE_WORDS.fact, ...w }, mf),
  },
  {
    key: "hiring", name: "We're hiring", note: "A role, a face, a button",
    words: { eyebrow: "We're hiring", headline: "Join the *APSOparts* team", body: "Role title - place", cta: "Apply now" },
    build: (s, w, mf = estimateFor) => hiring(s, { ...TEMPLATE_WORDS.hiring, ...w }, mf, shopPhoto("drive")),
  },
  {
    key: "poster", name: "Type poster", note: "Our films' look: a few words stacked huge, the last one red",
    words: { headline: "Cut.\nSized.\n*Shipped.*", body: "Engineering plastics, cut to your size with DirectCUT." },
    build: (s, w, mf = estimateFor) => poster(s, { ...TEMPLATE_WORDS.poster, ...w }, mf),
  },
  {
    key: "statement", name: "Statement", note: "One sentence, centred, on petrol",
    words: { headline: "Six technologies. *One shop.*", body: "Standard components for industry, ordered online." },
    build: (s, w, mf = estimateFor) => statement(s, { ...TEMPLATE_WORDS.statement, ...w }, mf),
  },
  {
    key: "photo", name: "Photo and headline", note: "A photo across the board, the words on it",
    words: { eyebrow: "Sealing technology", headline: "Seals for *every line*", body: "Find yours by size, material and medium." },
    build: (s, w, mf = estimateFor) => photoPost(s, { ...TEMPLATE_WORDS.photo, ...w }, mf, shopPhoto("sealing")),
  },
];

/** Each template's own words, by key. */
export const TEMPLATE_WORDS = Object.fromEntries(TEMPLATES.map((t) => [t.key, t.words])) as Record<TemplateKey, Words>;
export const TEMPLATE_KEYS = TEMPLATES.map((t) => t.key);
export const templateByKey = (k: string) => TEMPLATES.find((t) => t.key === k) ?? null;

/* ── text on its own (the Text panel, the AI's words) ──────────────────────────────────────────────────────────── */

export const TEXT_ROLES = ["eyebrow", "headline", "subhead", "body", "caption", "quote", "number", "list", "cta"] as const;
export type TextRole = (typeof TEXT_ROLES)[number];
export const isTextRole = (v: unknown): v is TextRole => typeof v === "string" && (TEXT_ROLES as readonly string[]).includes(v);

export const ROLE_LABEL: Record<TextRole, string> = {
  eyebrow: "Kicker", headline: "Headline", subhead: "Subheading", body: "Body text", caption: "Caption",
  quote: "Quote", number: "Big number", list: "List", cta: "Call to action",
};

/** A role's look on a board of this size: its size, weight, colour, line height. */
export function roleStyle(role: TextRole, s: Size, dark = false): TextOpts {
  const g = gridOf(s);
  const ink = dark ? C.white : C.ink;
  const mute = dark ? "#C9D6DE" : C.mute;
  switch (role) {
    case "eyebrow": return { size: r(30 * g.u), weight: 500, color: mute, lh: 1.2 };
    case "headline": return { size: r((g.shape === "wide" ? 76 : 100) * g.u), weight: 700, color: ink, key: dark ? "#FF5A4F" : C.red };
    case "subhead": return { size: r((g.shape === "wide" ? 40 : 52) * g.u), weight: 700, color: ink, key: C.red, lh: 1.14 };
    case "body": return { size: r(32 * g.u), weight: 500, color: mute, lh: 1.34 };
    case "caption": return { size: r(24 * g.u), weight: 500, color: mute, lh: 1.3 };
    case "quote": return { size: r((g.shape === "wide" ? 52 : 64) * g.u), weight: 500, color: ink, key: C.red, lh: 1.18 };
    case "number": return { size: r((g.shape === "wide" ? 240 : 320) * g.u), weight: 700, color: C.red, lh: 0.92 };
    case "list": return { size: r(36 * g.u), weight: 500, color: ink, lh: 1.5, list: "number" };
    case "cta": return { size: r(30 * g.u), weight: 700, color: C.white };
  }
}

/** One text of a role, ready to drop on the board at (x, y), `w` wide. */
export function roleNodes(role: TextRole, text: string, s: Size, at: { x: number; y: number; w: number }, mf: MeasureFor = estimateFor, dark = false): Placed {
  const g = gridOf(s);
  if (role === "cta") {
    const b = button(text, at.x, g, mf);
    return { nodes: b.nodes.map((n) => ({ ...n, y: n.y + at.y })), h: b.h };
  }
  if (role === "eyebrow") {
    const e = eyebrow(text, at.x, at.w, g, mf, dark ? "#C9D6DE" : C.mute);
    return { nodes: e.nodes.map((n) => ({ ...n, y: n.y + at.y })), h: e.h };
  }
  const st = roleStyle(role, s, dark);
  const size = role === "headline" || role === "number" || role === "quote" ? fitSize(text.replace(/\*/g, ""), at.w, st.size, r(st.size * 0.45), role === "number" ? 1 : 4, mf, Infinity, st.weight ?? 700, st.lh ?? 1.06) : st.size;
  const t = textBlock(text, at.x, at.w, { ...st, size }, mf);
  return { nodes: t.nodes.map((n) => ({ ...n, y: n.y + at.y })), h: t.h };
}

/** Blocks of words laid out as one composition on the board's grid (the AI's words; "make it like our films"). */
export function composeWords(blocks: { role: TextRole; text: string }[], s: Size, mf: MeasureFor = estimateFor, o: { dark?: boolean; place?: "top" | "middle" | "bottom" } = {}): DesignNode[] {
  const g = gridOf(s);
  const colW = g.W - g.m * 2 - (g.shape === "wide" ? r(g.W * 0.12) : 0);
  const gapFor = (role: TextRole, prev: TextRole | null) => (prev === null ? 0 : role === "cta" ? r(44 * g.u) : prev === "eyebrow" ? r(24 * g.u) : prev === "number" ? r(28 * g.u) : r(26 * g.u));
  let prev: TextRole | null = null;
  const placed = blocks.filter((b) => b.text.trim()).slice(0, 8).map((b) => {
    const p = roleNodes(b.role, b.text.trim(), s, { x: g.m, y: 0, w: b.role === "body" || b.role === "caption" ? colW * 0.9 : colW }, mf, o.dark);
    const out = { ...p, gap: gapFor(b.role, prev) };
    prev = b.role;
    return out;
  });
  const h = heightOf(placed);
  const top = contentTop(g);
  const y = o.place === "top" ? top : o.place === "bottom" ? g.bottom - h : r(top + Math.max(0, (g.bottom - top - h) * 0.45));
  const group = nid("g");
  return stack(placed, Math.max(top, y)).map((n) => ({ ...n, groupId: n.groupId ?? group }));
}
