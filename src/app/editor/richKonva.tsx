"use client";
// A TEXT WITH KEY WORDS, DRAWN ON THE CANVAS (08.11.2026). The words are laid out by src/lib/editor/richText.ts; here
// they are painted word by word, the key words in their own colour - as Konva's own text would draw them (the same
// baseline, the same line height), so a text keeps its place when a star is added or taken away. Used by the editor
// (EditorCanvas) and by the read-only drawing of a design (designRender.ts) alike.

import Konva from "konva";
import { Shape, type KonvaNodeEvents } from "react-konva";
import { layoutRich, lineStart, type RichLayout } from "@/lib/editor/richText";

/** The brand's typeface on the canvas: Jost (the stand-in for the shop's futura-pt), served by the hub (public/video/fonts). */
export const FUTURA_STACK = "'APSO Film Jost', 'Jost', 'futura-pt', 'Segoe UI', sans-serif";

export type RichStyle = {
  text: string;
  width: number;
  fontSize: number;
  fontFamily: string;
  fontStyle?: string;
  fill: string;
  keyFill?: string;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  upper?: boolean;
};

export const KEY_RED = "#D80901";

const cssFont = (s: RichStyle) => `${s.fontStyle && s.fontStyle !== "normal" ? `${s.fontStyle} ` : ""}${s.fontSize}px ${s.fontFamily}`;

let measurer: CanvasRenderingContext2D | null = null;
function measureWith(font: string) {
  if (!measurer) measurer = document.createElement("canvas").getContext("2d");
  const m = measurer;
  return (s: string) => {
    if (!m) return s.length * 0.55 * 16;
    m.font = font;
    return m.measureText(s).width;
  };
}

/** Where every word goes, measured in the text's real font. */
export function richLayout(s: RichStyle): RichLayout {
  return layoutRich(s.text, {
    width: s.width, fontSize: s.fontSize, lineHeight: s.lineHeight ?? 1.25, letterSpacing: s.letterSpacing ?? 0, upper: s.upper,
    measure: measureWith(cssFont(s)),
  });
}

/** Paints the laid-out words. Konva's text puts each line's middle at (n + 1/2) x line height - so does this. */
export function paintRich(ctx: Konva.Context, s: RichStyle, layout: RichLayout) {
  const lh = (s.lineHeight ?? 1.25) * s.fontSize;
  const ls = s.letterSpacing ?? 0;
  const measure = measureWith(cssFont(s));
  ctx.setAttr("font", cssFont(s));
  ctx.setAttr("textBaseline", "middle");
  ctx.setAttr("textAlign", "left");
  layout.lines.forEach((line, i) => {
    const y = i * lh + lh / 2;
    const x0 = lineStart(line, s.width, s.align);
    for (const w of line.words) {
      ctx.setAttr("fillStyle", w.key ? s.keyFill || KEY_RED : s.fill);
      if (!ls) { ctx.fillText(w.t, x0 + w.x, y); continue; }
      let x = x0 + w.x;
      for (const ch of w.t) { ctx.fillText(ch, x, y); x += measure(ch) + ls; }
    }
  });
}

/** The scene and hit functions for a Konva shape that is a rich text - for the imperative drawing. */
export function richShapeConfig(s: RichStyle): { width: number; height: number; sceneFunc: (ctx: Konva.Context) => void; hitFunc: (ctx: Konva.Context, shape: Konva.Shape) => void } {
  const layout = richLayout(s);
  return {
    width: s.width,
    height: Math.max(s.fontSize * (s.lineHeight ?? 1.25), layout.height),
    sceneFunc: (ctx) => paintRich(ctx, s, layout),
    hitFunc: (ctx, shape) => { ctx.beginPath(); ctx.rect(0, 0, shape.width(), shape.height()); ctx.closePath(); ctx.fillStrokeShape(shape); },
  };
}

type ShapeProps = Omit<Konva.ShapeConfig, "sceneFunc" | "hitFunc" | "width" | "height"> & KonvaNodeEvents;

/** The rich text as a react-konva node: selectable, draggable, transformable like a plain text. */
export function RichText({ style, ...rest }: { style: RichStyle } & ShapeProps) {
  const cfg = richShapeConfig(style);
  return <Shape {...rest} width={cfg.width} height={cfg.height} sceneFunc={cfg.sceneFunc} hitFunc={cfg.hitFunc} />;
}
