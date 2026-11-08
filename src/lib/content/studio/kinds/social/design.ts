// SOCIAL POST - ITS DESIGN (SARCLA 08.11.2026: "the Social post to-do opens ONE studio whose centre is the design
// canvas"; "in the publish options you can choose multiple formats for publishing").
//
// A post's design is a few pages (one picture, or a carousel's slides), each in every format the post goes out in:
// landscape for a LinkedIn or Facebook link post, square for every feed, portrait for Instagram, a story, a wide one.
// Each page in each format is a design document of the canvas (src/lib/design-document.ts) - its own, so a story can be
// fixed by hand without touching the square. A new format is made from one the post has by `adaptDoc`: the background
// keeps covering the board, the things in a corner stay in their corner, the type scales by one factor and a text that
// ran across the board still does. Pictures are addresses (the hub's /api/content/picture/..., the logos in /brand),
// never their bytes. Pure - tests/studio-social-design.test.ts.

import type { DesignDocument, DesignNode } from "../../../../design-document";
import { hasKeyWords, plainText } from "../../../../editor/richText";

export const FORMAT_KEYS = ["landscape", "square", "portrait", "story", "wide", "custom"] as const;
export type FormatKey = (typeof FORMAT_KEYS)[number];
export const isFormat = (v: unknown): v is FormatKey => typeof v === "string" && (FORMAT_KEYS as readonly string[]).includes(v);

export const FORMATS: Record<Exclude<FormatKey, "custom">, { w: number; h: number; label: string; where: string }> = {
  landscape: { w: 1200, h: 627, label: "Landscape", where: "LinkedIn, Facebook" },
  square: { w: 1080, h: 1080, label: "Square", where: "Every feed" },
  portrait: { w: 1080, h: 1350, label: "Portrait", where: "Instagram, LinkedIn" },
  story: { w: 1080, h: 1920, label: "Story", where: "Instagram, Facebook stories" },
  wide: { w: 1600, h: 900, label: "Wide", where: "X, slides" },
};

export type Size = { w: number; h: number };
export type DesignPage = { id: string; by: Partial<Record<FormatKey, DesignDocument>> };
export type SocialDesign = {
  /** The formats it goes out in, the first the one it was made in. */
  formats: FormatKey[];
  /** A size of its own, when "custom" is among them. */
  custom: Size | null;
  pages: DesignPage[];
};

export const MAX_PAGES = 20;

export function sizeOf(f: FormatKey, d: Pick<SocialDesign, "custom">): Size {
  if (f === "custom") return d.custom ?? { w: 1080, h: 1080 };
  return { w: FORMATS[f].w, h: FORMATS[f].h };
}

export const formatLabel = (f: FormatKey, d: Pick<SocialDesign, "custom">) =>
  f === "custom" ? `Custom ${sizeOf(f, d).w} × ${sizeOf(f, d).h}` : `${FORMATS[f].label} ${FORMATS[f].w} × ${FORMATS[f].h}`;

/** The format a board of this size is, if it is one of ours. */
export function formatOfSize(s: Size): Exclude<FormatKey, "custom"> | null {
  for (const [k, f] of Object.entries(FORMATS)) if (f.w === s.w && f.h === s.h) return k as Exclude<FormatKey, "custom">;
  return null;
}

/* ── the brand, as the canvas draws it ─────────────────────────────────────────────────────────────────────────── */

/** The shop's colours (red #D80901 is APSOparts red; ink, petrol and the light grey of our films). */
export const C = {
  red: "#D80901",
  redDeep: "#B00700",
  petrol: "#274E64",
  petrolDeep: "#16303F",
  ink: "#1D2A33",
  mute: "#5C6670",
  light: "#F4F6F8",
  grey: "#E6E9ED",
  pale: "#E6EEF2",
  white: "#FFFFFF",
} as const;

/** The palette the swatches offer. */
export const PALETTE = [C.red, C.petrol, C.ink, C.mute, C.light, C.grey, C.pale, C.white, C.petrolDeep, C.redDeep];

export const GRADIENTS = [
  { id: "petrol", label: "Petrol", from: C.petrol, to: C.petrolDeep },
  { id: "red", label: "Red", from: C.red, to: "#8F0F1C" },
  { id: "ink", label: "Ink", from: "#2C3B46", to: "#11181D" },
  { id: "mist", label: "Mist", from: "#FFFFFF", to: "#DDE5EB" },
  { id: "sea", label: "Sea", from: "#3C6E8A", to: C.petrolDeep },
  { id: "dusk", label: "Dusk", from: C.petrol, to: C.red },
] as const;

/** The logos, by address, with where the letters sit inside each file (so a logo lines up with the grid). */
export const LOGOS = {
  black: { src: "/video/brand/apsoparts-logo-black.svg", label: "Black", ratio: 119.24 / 36.42, box: { x: 0, y: 0, w: 1, h: 1 }, dark: false },
  colour: { src: "/brand/apsoparts-logo.svg", label: "Colour", ratio: 678.5 / 229.7, box: { x: 36 / 678.5, y: 52 / 229.7, w: 606 / 678.5, h: 126 / 229.7 }, dark: false },
  white: { src: "/brand/apsoparts-logo-white.svg", label: "White", ratio: 678.5 / 229.7, box: { x: 36 / 678.5, y: 52 / 229.7, w: 606 / 678.5, h: 126 / 229.7 }, dark: true },
  companyColour: { src: "/brand/apsoparts-logo-company.svg", label: "With “an Angst+Pfister company”", ratio: 1119.5 / 229.7, box: { x: 36 / 1119.5, y: 52 / 229.7, w: 1050 / 1119.5, h: 126 / 229.7 }, dark: false },
  companyWhite: { src: "/brand/apsoparts-logo-company-white.svg", label: "With “an Angst+Pfister company”, white", ratio: 1119.5 / 229.7, box: { x: 36 / 1119.5, y: 52 / 229.7, w: 1050 / 1119.5, h: 126 / 229.7 }, dark: true },
} as const;
export type LogoKey = keyof typeof LOGOS;
export const isLogoSrc = (src: string | undefined) => !!src && Object.values(LOGOS).some((l) => l.src === src);

/** Backgrounds drawn from the brand: the films' blueprint grid, light and dark. Files in public/social. */
export const BRAND_BACKDROPS = [
  { id: "grid-light", label: "Blueprint, light", src: "/social/grid-light.svg", color: C.light },
  { id: "grid-dark", label: "Blueprint, petrol", src: "/social/grid-dark.svg", color: C.petrol },
  { id: "dots-light", label: "Dots, light", src: "/social/dots-light.svg", color: C.white },
  { id: "corner-red", label: "Red corner", src: "/social/corner-red.svg", color: C.white },
] as const;

/* ── a new design, and a stored one read back ──────────────────────────────────────────────────────────────────── */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

export function blankDoc(s: Size, color: string = C.light): DesignDocument {
  return {
    schemaVersion: 1,
    canvas: { w: s.w, h: s.h },
    background: { color, gradientId: null, customGradient: { from: C.petrol, to: C.petrolDeep }, src: null, scrim: 0 },
    nodes: [],
  };
}

/** A stored page's document, made whole (a design saved by the studio sets missing keys to null). */
export function cleanDoc(raw: unknown, fallback: Size): DesignDocument | null {
  if (!isObj(raw)) return null;
  const c = isObj(raw.canvas) ? raw.canvas : {};
  const b = isObj(raw.background) ? raw.background : {};
  const g = isObj(b.customGradient) ? b.customGradient : {};
  const nodes = Array.isArray(raw.nodes) ? raw.nodes.filter((n): n is DesignNode => isObj(n) && typeof n.id === "string" && typeof n.kind === "string") : [];
  return {
    schemaVersion: 1,
    canvas: { w: Math.round(num(c.w, 64, 8192, fallback.w)), h: Math.round(num(c.h, 64, 8192, fallback.h)) },
    background: {
      color: typeof b.color === "string" ? b.color : C.white,
      gradientId: typeof b.gradientId === "string" ? b.gradientId : null,
      customGradient: { from: typeof g.from === "string" ? g.from : C.petrol, to: typeof g.to === "string" ? g.to : C.petrolDeep },
      src: typeof b.src === "string" && b.src ? b.src : null,
      scrim: num(b.scrim, 0, 100, 0),
    },
    // keys a save set to null are dropped - the canvas reads "missing", not null
    nodes: nodes.map((n) => Object.fromEntries(Object.entries(n).filter(([, v]) => v !== null && v !== undefined)) as DesignNode),
  };
}

export function emptyDesign(): SocialDesign {
  return { formats: ["square"], custom: null, pages: [] };
}

export function normalizeDesign(raw: unknown): SocialDesign {
  const d = isObj(raw) ? raw : {};
  const formats = Array.isArray(d.formats) ? [...new Set(d.formats.filter(isFormat))] : [];
  const cu = isObj(d.custom) ? d.custom : null;
  const custom = cu ? { w: Math.round(num(cu.w, 64, 8192, 1080)), h: Math.round(num(cu.h, 64, 8192, 1080)) } : null;
  const base: SocialDesign = { formats: formats.length ? formats : ["square"], custom, pages: [] };
  const pages: DesignPage[] = [];
  for (const [i, p] of (Array.isArray(d.pages) ? d.pages : []).slice(0, MAX_PAGES).entries()) {
    if (!isObj(p)) continue;
    const by: DesignPage["by"] = {};
    const src = isObj(p.by) ? p.by : {};
    for (const f of FORMAT_KEYS) {
      const doc = cleanDoc(src[f], sizeOf(f, base));
      if (doc) by[f] = doc;
    }
    if (Object.keys(by).length) pages.push({ id: typeof p.id === "string" && p.id ? p.id.slice(0, 40) : `p${i + 1}`, by });
  }
  return { ...base, pages };
}

/* ── one format made from another ──────────────────────────────────────────────────────────────────────────────── */

type Anchor = "start" | "middle" | "end" | "span";

/** Which edge a thing belongs to along one axis: hugging the start, the end, across the whole of it, or in the middle. */
function anchorOf(pos: number, size: number, board: number): Anchor {
  const end = pos + size;
  if (pos <= board * 0.08 && end >= board * 0.92) return "span";
  const mid = pos + size / 2;
  if (mid < board * 0.36) return "start";
  if (mid > board * 0.64) return "end";
  return "middle";
}

/**
 * The page on a board of another size. The type and the things keep their shape (one factor, the smaller of the two
 * ratios); what covered the board covers the new one; a thing near an edge keeps its distance to that edge; a text or a
 * band that ran across the board runs across the new one; the middle stays in the middle.
 */
export function adaptDoc(doc: DesignDocument, to: Size): DesignDocument {
  const from = doc.canvas;
  if (from.w === to.w && from.h === to.h) return JSON.parse(JSON.stringify(doc));
  const k = Math.min(to.w / from.w, to.h / from.h);
  const boxOf = (n: DesignNode) => ({
    x: n.x, y: n.y,
    w: n.width ?? (n.kind === "text" ? from.w - n.x - from.w * 0.08 : 100),
    h: n.height ?? (n.kind === "text" ? (n.fontSize ?? 24) * 2 : 100),
  });
  /** Where a box lands: its corner kept, its middle kept, or (alone, `stretch`) still across the board. */
  const place = (b: { x: number; y: number; w: number; h: number }, stretch: boolean, text: boolean) => {
    const ax = anchorOf(b.x, b.w, from.w);
    const ay = anchorOf(b.y, b.h, from.h);
    let w = b.w * k;
    let h = b.h * k;
    let x: number;
    let y: number;
    if (ax === "span" && stretch) {
      const left = b.x * (to.w / from.w);
      const right = (from.w - b.x - b.w) * (to.w / from.w);
      x = left; w = Math.max(40, to.w - left - right);
      // a band (a shape or a picture across the board) keeps its height in the board's own proportion
      if (!text) h = b.h * (to.h / from.h) * (ay === "span" ? 1 : Math.min(1.6, Math.max(0.6, (to.w / from.w) / (to.h / from.h))));
    } else if (ax === "start") x = b.x * k;
    else if (ax === "end") x = to.w - (from.w - b.x - b.w) * k - w;
    else x = to.w / 2 + (b.x + b.w / 2 - from.w / 2) * k - w / 2;
    if (ay === "span" && stretch && !text) { y = b.y * (to.h / from.h); h = Math.max(16, to.h - y - (from.h - b.y - b.h) * (to.h / from.h)); }
    else if (ay === "start" || ay === "span") y = b.y * k;
    else if (ay === "end") y = to.h - (from.h - b.y - b.h) * k - h;
    else y = to.h / 2 + (b.y + b.h / 2 - from.h / 2) * k - h / 2;
    return { x, y, w, h };
  };
  const scaled = (n: DesignNode, x: number, y: number, w: number, h: number): DesignNode => {
    const b = boxOf(n);
    const out: DesignNode = { ...n, x: Math.round(x), y: Math.round(y) };
    if (n.width !== undefined || n.kind === "text") out.width = Math.round(w);
    if (n.height !== undefined) out.height = Math.round(h);
    if (n.fontSize !== undefined) out.fontSize = Math.max(8, Math.round(n.fontSize * k));
    if (n.letterSpacing !== undefined) out.letterSpacing = n.letterSpacing * k;
    if (n.strokeWidth !== undefined) out.strokeWidth = n.strokeWidth * k;
    if (n.cornerRadius !== undefined) out.cornerRadius = n.cornerRadius * k;
    // a picture whose frame changed shape shows its middle again (the old crop was for the old frame)
    if (n.kind === "image" && n.crop && Math.abs(w / Math.max(1, h) - b.w / Math.max(1, b.h)) > 0.02) delete out.crop;
    return out;
  };
  // a group (a button and its words, a kicker and its bar) travels as one: one box, one place, one factor
  const groups = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const n of doc.nodes) {
    if (!n.groupId) continue;
    const b = boxOf(n);
    const g = groups.get(n.groupId);
    if (!g) { groups.set(n.groupId, { ...b }); continue; }
    const x1 = Math.max(g.x + g.w, b.x + b.w); const y1 = Math.max(g.y + g.h, b.y + b.h);
    g.x = Math.min(g.x, b.x); g.y = Math.min(g.y, b.y); g.w = x1 - g.x; g.h = y1 - g.y;
  }
  const landed = new Map([...groups].map(([id, g]) => [id, place(g, false, false)]));
  const nodes = doc.nodes.map((n): DesignNode => {
    const b = boxOf(n);
    if (n.groupId && groups.has(n.groupId)) {
      const g = groups.get(n.groupId)!;
      const at = landed.get(n.groupId)!;
      return scaled(n, at.x + (n.x - g.x) * k, at.y + (n.y - g.y) * k, b.w * k, b.h * k);
    }
    const full = n.x <= from.w * 0.02 && n.y <= from.h * 0.02 && b.w >= from.w * 0.98 && b.h >= from.h * 0.98;
    if (full && n.kind !== "text") return { ...n, x: 0, y: 0, width: to.w, height: to.h, ...(n.kind === "image" ? { crop: undefined } : {}) };
    const at = place(b, true, n.kind === "text");
    return scaled(n, at.x, at.y, at.w, at.h);
  });
  return { ...doc, canvas: { w: to.w, h: to.h }, nodes };
}

/* ── pages and formats ─────────────────────────────────────────────────────────────────────────────────────────── */

let seq = 0;
export const pageId = () => `p${Date.now().toString(36)}${(seq += 1)}`;

/** A page in a format: its own, else made from the first format it has. */
export function pageIn(d: SocialDesign, page: DesignPage, f: FormatKey): DesignDocument {
  const own = page.by[f];
  if (own) return own;
  const first = d.formats.map((x) => page.by[x]).find(Boolean) ?? Object.values(page.by).find(Boolean);
  return first ? adaptDoc(first, sizeOf(f, d)) : blankDoc(sizeOf(f, d));
}

/** The design with a format more: every page made in it from `from` (else the first format it has). */
export function withFormat(d: SocialDesign, f: FormatKey, custom?: Size, from?: FormatKey): SocialDesign {
  const next: SocialDesign = { ...d, custom: f === "custom" && custom ? custom : d.custom };
  if (!next.formats.includes(f)) next.formats = [...next.formats, f];
  next.pages = d.pages.map((p) => {
    if (p.by[f] && !(f === "custom" && custom)) return p;
    const src = (from && from !== f ? p.by[from] : undefined) ?? d.formats.filter((x) => x !== f).map((x) => p.by[x]).find(Boolean) ?? Object.values(p.by).find(Boolean);
    return { ...p, by: { ...p.by, [f]: src ? adaptDoc(src, sizeOf(f, next)) : blankDoc(sizeOf(f, next)) } };
  });
  return next;
}

/** The design without a format (never the last one). */
export function withoutFormat(d: SocialDesign, f: FormatKey): SocialDesign {
  if (!d.formats.includes(f) || d.formats.length < 2) return d;
  return { ...d, formats: d.formats.filter((x) => x !== f), pages: d.pages.map((p) => { const by = { ...p.by }; delete by[f]; return { ...p, by }; }) };
}

/** A format made again from another (its hand changes are lost - the studio asks first). */
export function readapt(d: SocialDesign, f: FormatKey, from: FormatKey): SocialDesign {
  return { ...d, pages: d.pages.map((p) => ({ ...p, by: { ...p.by, [f]: adaptDoc(pageIn(d, p, from), sizeOf(f, d)) } })) };
}

/** One page's document in one format replaced. */
export function setPageDoc(d: SocialDesign, index: number, f: FormatKey, doc: DesignDocument): SocialDesign {
  return { ...d, pages: d.pages.map((p, i) => (i === index ? { ...p, by: { ...p.by, [f]: doc } } : p)) };
}

/** A new page from a document in one format, made in every other format the post has. */
export function pageFrom(d: SocialDesign, f: FormatKey, doc: DesignDocument): DesignPage {
  const by: DesignPage["by"] = { [f]: doc };
  for (const g of d.formats) if (g !== f) by[g] = adaptDoc(doc, sizeOf(g, d));
  return { id: pageId(), by };
}

export function insertPage(d: SocialDesign, at: number, page: DesignPage): SocialDesign {
  if (d.pages.length >= MAX_PAGES) return d;
  const pages = [...d.pages];
  pages.splice(Math.max(0, Math.min(at, pages.length)), 0, page);
  return { ...d, pages };
}

export function removePage(d: SocialDesign, at: number): SocialDesign {
  return { ...d, pages: d.pages.filter((_, i) => i !== at) };
}

export function movePage(d: SocialDesign, from: number, to: number): SocialDesign {
  if (from === to || from < 0 || to < 0 || from >= d.pages.length || to >= d.pages.length) return d;
  const pages = [...d.pages];
  pages.splice(to, 0, pages.splice(from, 1)[0]);
  return { ...d, pages };
}

/** A copy of a page with fresh ids (two pages never share an object's id - the canvas keys on them). */
export function clonePage(p: DesignPage): DesignPage {
  const by: DesignPage["by"] = {};
  for (const [f, doc] of Object.entries(p.by)) if (doc) by[f as FormatKey] = { ...doc, nodes: doc.nodes.map((n, i) => ({ ...n, id: `${n.id.slice(0, 60)}c${i}${(seq += 1)}` })) };
  return { id: pageId(), by };
}

/* ── what a design says ────────────────────────────────────────────────────────────────────────────────────────── */

/** A page's words, top to bottom (logos and shapes say nothing), without the key words' stars. */
export function pageWords(doc: DesignDocument): string[] {
  return [...doc.nodes].filter((n) => n.kind === "text" && !n.hidden && (n.text ?? "").trim()).sort((a, b) => a.y - b.y || a.x - b.x).map((n) => plainText(n.text).trim());
}

/** Every page's words in the first format - what the versions, the search and the checks read. */
export function designText(d: SocialDesign): string {
  const f = d.formats[0];
  return d.pages.map((p, i) => {
    const words = pageWords(pageIn(d, p, f));
    return words.length ? `${d.pages.length > 1 ? `Page ${i + 1}: ` : ""}${words.join(" / ")}` : "";
  }).filter(Boolean).join("\n");
}

/** A text uses the key words' stars. */
export const usesKeyWords = (doc: DesignDocument) => doc.nodes.some((n) => n.kind === "text" && hasKeyWords(n.text));

/** The pictures a design shows (their addresses), for the checks and the exports. */
export function pictures(doc: DesignDocument): string[] {
  return [doc.background.src, ...doc.nodes.filter((n) => n.kind === "image").map((n) => n.src)].filter((x): x is string => !!x);
}

/** A picture kept as bytes (data:) instead of an address - a design never stores one (an SVG drawn by code is fine). */
export const isInlinePicture = (src: string | null | undefined) => !!src && /^data:image\/(png|jpe?g|webp|gif)/i.test(src);
