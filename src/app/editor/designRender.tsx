"use client";
// A DESIGN DRAWN WITHOUT THE EDITOR (08.11.2026): the same Konva, the same drawing of each kind of object as the canvas,
// for what is not on the canvas right now - a template's thumbnail, a page in the page strip, a format in the publish
// panel, every page and format exported at once. Read-only: no selection, no handles. Tables and charts are left out
// (no social layout uses them).

import { useEffect, useState } from "react";
import Konva from "konva";
import type { DesignDocument, DesignNode } from "@/lib/design-document";
import { coverCrop, cropToPixels } from "@/lib/editor/crop";
import { listify } from "@/lib/editor/lists";
import { hasKeyWords } from "@/lib/editor/richText";
import { FUTURA_STACK, richShapeConfig } from "./richKonva";

const GEORGIA = "Georgia, 'Times New Roman', serif";
const MONO = "Consolas, 'Courier New', monospace";
/** The editor's own named gradients (EditorCanvas BG_GRADIENTS); anything else draws from customGradient. */
const NAMED: Record<string, { from: string; to: string }> = {
  navy: { from: "#16303f", to: "#274e64" }, red: { from: "#ed1b2f", to: "#8f0f1c" }, slate: { from: "#1a1d21", to: "#3c4043" }, light: { from: "#f5f6f8", to: "#dfe4ea" },
};
const SCRIM_TOP = "rgba(10,20,28,0)";
const SCRIM_BOTTOM = "rgba(10,20,28,0.88)";

let fontVars: { inter: string; outfit: string } | null = null;
function fontOf(n: DesignNode): string {
  if (n.fontKey === "futura") return FUTURA_STACK;
  if (n.fontKey === "georgia") return GEORGIA;
  if (n.fontKey === "mono") return MONO;
  if (!fontVars) {
    const probe = document.createElement("span");
    document.body.appendChild(probe);
    probe.style.fontFamily = "var(--font-inter)";
    const inter = getComputedStyle(probe).fontFamily || "Inter, sans-serif";
    probe.style.fontFamily = "var(--font-outfit)";
    const outfit = getComputedStyle(probe).fontFamily || "Outfit, sans-serif";
    probe.remove();
    fontVars = { inter, outfit };
  }
  return n.fontKey === "outfit" ? fontVars.outfit : fontVars.inter;
}

const images = new Map<string, Promise<HTMLImageElement | null>>();
/** A picture loaded once per session (null when it does not load). */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  let p = images.get(src);
  if (!p) {
    p = new Promise((ok) => {
      const el = new window.Image();
      el.crossOrigin = "anonymous";
      el.onload = () => ok(el);
      el.onerror = () => ok(null);
      el.src = src;
    });
    images.set(src, p);
    void p.then((x) => { if (!x) images.delete(src); });
  }
  return p;
}

/** Every picture a design shows, loaded. */
async function picturesOf(doc: DesignDocument): Promise<Map<string, HTMLImageElement>> {
  const srcs = [doc.background.src, ...doc.nodes.map((n) => (n.kind === "image" ? n.src : null))].filter((x): x is string => !!x);
  const out = new Map<string, HTMLImageElement>();
  await Promise.all([...new Set(srcs)].map(async (s) => { const el = await loadImage(s); if (el) out.set(s, el); }));
  return out;
}

function drawNode(layer: Konva.Layer, n: DesignNode, imgs: Map<string, HTMLImageElement>, board: { w: number; h: number }) {
  const base = { x: n.x, y: n.y, rotation: n.rotation ?? 0, opacity: n.opacity ?? 1, listening: false } as const;
  const shadow = n.shadow ? { shadowColor: "rgba(0,0,0,0.55)", shadowBlur: 8, shadowOffsetY: 2, shadowEnabled: true } : {};
  const blend = n.blend ? { globalCompositeOperation: n.blend as GlobalCompositeOperation } : {};
  const grad = (centred: boolean) => {
    const g = n.gradient;
    if (!g) return {};
    const w = n.width ?? 0; const h = n.height ?? 0;
    const rad = ((g.angle ?? 90) * Math.PI) / 180;
    const dx = (Math.cos(rad) * w) / 2; const dy = (Math.sin(rad) * h) / 2;
    const cx = centred ? 0 : w / 2; const cy = centred ? 0 : h / 2;
    return { fillLinearGradientStartPoint: { x: cx - dx, y: cy - dy }, fillLinearGradientEndPoint: { x: cx + dx, y: cy + dy }, fillLinearGradientColorStops: [0, g.from, 1, g.to] };
  };
  if (n.kind === "text") {
    if (hasKeyWords(n.text) && !n.listStyle && !n.curve) {
      const cfg = richShapeConfig({
        text: n.text ?? "", width: n.width ?? Math.max(40, board.w - n.x - board.w * 0.04), fontSize: n.fontSize ?? 24, fontFamily: fontOf(n),
        fontStyle: n.fontStyle, fill: n.fill, keyFill: n.keyFill, align: n.align, lineHeight: n.lineHeight ?? 1.25, letterSpacing: n.letterSpacing ?? 0, upper: n.upper,
      });
      if (n.background) layer.add(new Konva.Rect({ ...base, x: n.x - (n.fontSize ?? 24) * 0.5, y: n.y - (n.fontSize ?? 24) * 0.25, width: cfg.width + (n.fontSize ?? 24), height: cfg.height + (n.fontSize ?? 24) * 0.5, fill: n.backgroundFill ?? "#16303f", cornerRadius: (n.fontSize ?? 24) * 0.9 }));
      layer.add(new Konva.Shape({ ...base, ...shadow, ...cfg }));
      return;
    }
    const t = listify(n.text ?? "", n.listStyle);
    const text = new Konva.Text({
      ...base, ...shadow, text: n.upper ? t.toUpperCase() : t, width: n.width, fontSize: n.fontSize, fontFamily: fontOf(n), fontStyle: n.fontStyle,
      textDecoration: n.underline ? "underline" : "", fill: n.fill, align: n.align, lineHeight: n.lineHeight ?? 1.25, letterSpacing: n.letterSpacing ?? 0,
      stroke: n.stroke, strokeWidth: n.strokeWidth ?? 0, fillAfterStrokeEnabled: true,
    });
    if (n.background) {
      const fs = n.fontSize ?? 24;
      const px = fs * 0.5; const py = fs * 0.25;
      const h = text.height() + py * 2;
      layer.add(new Konva.Rect({ ...base, offsetX: px, offsetY: py, width: text.width() + px * 2, height: h, fill: n.backgroundFill ?? "#16303f", cornerRadius: Math.min(h / 2, fs * 0.9) }));
    }
    layer.add(text);
    return;
  }
  if (n.kind === "image") {
    const el = n.src ? imgs.get(n.src) : undefined;
    if (!el) return;
    const w = n.width ?? el.naturalWidth; const h = n.height ?? el.naturalHeight;
    // a drawing (a logo) is never cut; a photo with no crop of its own fills its frame
    const svg = /\.svg(\?|$)|^data:image\/svg/i.test(n.src ?? "");
    const crop = svg ? undefined : cropToPixels(n.crop ?? coverCrop(el.naturalWidth, el.naturalHeight, w, h), el.naturalWidth, el.naturalHeight);
    const img = new Konva.Image({
      ...base, ...shadow, ...blend, image: el, width: w, height: h, crop,
      scaleX: n.flipH ? -1 : 1, scaleY: n.flipV ? -1 : 1, offsetX: n.flipH ? w : 0, offsetY: n.flipV ? h : 0,
      cornerRadius: n.mask === "circle" ? Math.min(w, h) / 2 : n.mask === "rounded" ? Math.min(w, h) / 12 : n.cornerRadius,
    });
    const filters = [n.brightness ? Konva.Filters.Brighten : null, n.contrastVal ? Konva.Filters.Contrast : null, n.grayscale ? Konva.Filters.Grayscale : null, n.blur ? Konva.Filters.Blur : null].filter(Boolean) as (typeof Konva.Filters.Blur)[];
    if (filters.length) {
      img.filters(filters);
      img.brightness((n.brightness ?? 0) / 100); img.contrast(n.contrastVal ?? 0); img.blurRadius(n.blur ?? 0);
      img.cache();
    }
    layer.add(img);
    return;
  }
  if (n.kind === "ellipse") {
    const w = n.width ?? 100; const h = n.height ?? 100;
    layer.add(new Konva.Ellipse({ ...base, ...shadow, ...blend, ...grad(true), radiusX: w / 2, radiusY: h / 2, offsetX: -w / 2, offsetY: -h / 2, fill: n.fill, stroke: n.strokeWidth ? n.stroke ?? "#1a1d21" : undefined, strokeWidth: n.strokeWidth ?? 0 }));
    return;
  }
  if (n.kind === "arrow") {
    const sw = n.strokeWidth ?? 4;
    layer.add(new Konva.Arrow({ ...base, ...shadow, points: [0, 0, n.width ?? 200, 0], fill: n.stroke ?? n.fill, stroke: n.stroke ?? n.fill, strokeWidth: sw, pointerLength: Math.max(6, sw * 2.6), pointerWidth: Math.max(6, sw * 2.6) }));
    return;
  }
  if (n.kind === "scrim") {
    const h = n.height ?? board.h * 0.55;
    layer.add(new Konva.Rect({ ...base, rotation: 0, width: n.width ?? board.w, height: h, fillLinearGradientStartPoint: { x: 0, y: 0 }, fillLinearGradientEndPoint: { x: 0, y: h }, fillLinearGradientColorStops: [0, SCRIM_TOP, 1, SCRIM_BOTTOM] }));
    return;
  }
  if (n.kind === "rect") {
    const w = n.width ?? 0; const h = n.height ?? 0;
    layer.add(new Konva.Rect({ ...base, ...shadow, ...blend, ...grad(false), width: w, height: h, fill: n.fill, stroke: n.strokeWidth ? n.stroke ?? "#1a1d21" : undefined, strokeWidth: n.strokeWidth ?? 0, cornerRadius: Math.min(n.cornerRadius ?? 0, Math.min(w, h) / 2) }));
  }
}

/** The design on a Konva layer (the stage is the caller's). */
async function drawDesign(layer: Konva.Layer, doc: DesignDocument) {
  const imgs = await picturesOf(doc);
  const { w, h } = doc.canvas;
  const b = doc.background;
  const g = b.gradientId === "custom" ? b.customGradient : b.gradientId ? NAMED[b.gradientId] ?? null : null;
  layer.add(g
    ? new Konva.Rect({ x: 0, y: 0, width: w, height: h, fillLinearGradientStartPoint: { x: 0, y: 0 }, fillLinearGradientEndPoint: { x: w, y: h }, fillLinearGradientColorStops: [0, g.from, 1, g.to], listening: false })
    : new Konva.Rect({ x: 0, y: 0, width: w, height: h, fill: b.color, listening: false }));
  const bgEl = b.src ? imgs.get(b.src) : undefined;
  if (bgEl) {
    const s = Math.max(w / bgEl.width, h / bgEl.height);
    layer.add(new Konva.Image({ image: bgEl, x: (w - bgEl.width * s) / 2, y: (h - bgEl.height * s) / 2, width: bgEl.width * s, height: bgEl.height * s, listening: false }));
  }
  if (b.src && b.scrim > 0) layer.add(new Konva.Rect({ x: 0, y: 0, width: w, height: h, fill: "#000000", opacity: b.scrim / 100, listening: false }));
  for (const n of doc.nodes) if (!n.hidden) drawNode(layer, n, imgs, doc.canvas);
}

let fontsReady: Promise<unknown> | null = null;
/** Waits for the brand's font (once), so the first drawing is not in a fallback font. */
export function whenFontsReady(): Promise<unknown> {
  if (!fontsReady) {
    fontsReady = import("@/lib/content/studio/kinds/video/film/fonts").then((m) => m.loadFilmFonts()).catch(() => false);
  }
  return fontsReady;
}

/** The design as a picture: `pixelRatio` 1 = its real size. */
export async function renderDesign(doc: DesignDocument, o: { pixelRatio?: number; mime?: "image/png" | "image/jpeg"; quality?: number } = {}): Promise<string | null> {
  await whenFontsReady();
  const div = document.createElement("div");
  const stage = new Konva.Stage({ container: div, width: doc.canvas.w, height: doc.canvas.h });
  try {
    const layer = new Konva.Layer();
    stage.add(layer);
    await drawDesign(layer, doc);
    layer.draw();
    return stage.toDataURL({ pixelRatio: o.pixelRatio ?? 1, mimeType: o.mime ?? "image/png", quality: o.quality ?? 0.92 });
  } catch {
    return null;
  } finally {
    stage.destroy();
  }
}

/** The design as a file (a Blob), at its real size. */
export async function designBlob(doc: DesignDocument, mime: "image/png" | "image/jpeg" = "image/png"): Promise<Blob | null> {
  const url = await renderDesign(doc, { mime });
  if (!url) return null;
  return (await fetch(url)).blob();
}

const thumbs = new Map<string, Promise<string | null>>();
/** A small picture of a design, kept for the session (by what it shows). */
export function thumbOf(doc: DesignDocument, width: number): Promise<string | null> {
  const key = `${width}:${JSON.stringify(doc)}`;
  let p = thumbs.get(key);
  if (!p) {
    p = renderDesign(doc, { pixelRatio: Math.min(1, (width * 2) / doc.canvas.w) });
    thumbs.set(key, p);
    if (thumbs.size > 300) thumbs.delete(thumbs.keys().next().value as string);
  }
  return p;
}

/** A design's thumbnail, as an <img>; it redraws when the design changes (after a short pause). */
export function DesignThumb({ doc, width, alt = "", radius = 6, style }: { doc: DesignDocument; width: number; alt?: string; radius?: number; style?: React.CSSProperties }) {
  const [src, setSrc] = useState<string | null>(null);
  const key = JSON.stringify(doc);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => { void thumbOf(doc, width).then((u) => { if (live && u) setSrc(u); }); }, src ? 250 : 0);
    return () => { live = false; clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, width]);
  const h = Math.round((width * doc.canvas.h) / doc.canvas.w);
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt={alt} width={width} height={h} style={{ display: "block", width, height: h, borderRadius: radius, ...style }} />
    : <span style={{ display: "block", width, height: h, borderRadius: radius, background: "linear-gradient(110deg,#eef1f5 30%,#f7f8fa 50%,#eef1f5 70%)", backgroundSize: "200% 100%", animation: "dthumb 1.2s linear infinite", ...style }} />;
}
