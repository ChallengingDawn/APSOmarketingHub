"use client";
// WHAT THE PANELS DO TO THE CANVAS (08.11.2026) - each one a single step of the canvas's undo: a picture into the frame
// that is selected (or onto the board), a template in every format, the logo in its corner, words in our type.

import type { DesignDocument, DesignNode } from "@/lib/design-document";
import { coverCrop } from "@/lib/editor/crop";
import { LOGOS, setPageDoc, sizeOf, type LogoKey } from "@/lib/content/studio/kinds/social/design";
import { boxAt, darkPage, type Position } from "@/lib/content/studio/kinds/social/canvasAi";
import { logoNode, roleNodes, type Template, type TextRole, type Words } from "@/lib/content/studio/kinds/social/templates";
import { loadImage } from "@/app/editor/designRender";
import type { MeasureFor } from "@/lib/content/studio/kinds/social/templates";
import type { FormatKey, SocialDesign } from "@/lib/content/studio/kinds/social/design";
import type { StudioCtx } from "./Studio";

/** A page made from a template in every format the post has - each built for its own board, not stretched. */
export function templatePage(design: SocialDesign, t: Template, words: Words | undefined, mf: MeasureFor) {
  const by: Partial<Record<FormatKey, DesignDocument>> = {};
  for (const f of design.formats) by[f] = t.build(sizeOf(f, design), words, mf);
  return by;
}

let seq = 0;
const nid = (p: string) => `${p}${Date.now().toString(36)}s${(seq += 1)}`;

const isLogo = (n: DesignNode) => n.kind === "image" && Object.values(LOGOS).some((l) => l.src === n.src);
/** A selected object a picture can go into: a shape (a frame) or a picture that is not a logo. */
export const frameOf = (ctx: StudioCtx): DesignNode | null => {
  if (ctx.selection.length !== 1) return null;
  const n = ctx.canvas.current?.scene().nodes.find((x) => x.id === ctx.selection[0]) ?? null;
  return n && (n.kind === "rect" || n.kind === "ellipse" || (n.kind === "image" && !isLogo(n))) && !n.locked ? n : null;
};

/** The picture's own size (from the gallery, else loaded). */
async function naturalSize(p: { url: string; width?: number | null; height?: number | null }) {
  if (p.width && p.height) return { w: p.width, h: p.height };
  const el = await loadImage(p.url);
  return el ? { w: el.naturalWidth, h: el.naturalHeight } : { w: 1200, h: 800 };
}

/** A frame (by id) becomes the picture: its box, its corners, a circle stays a circle. */
export function fillFrame(nodes: DesignNode[], id: string, url: string, nat?: { w: number; h: number }): DesignNode[] {
  return nodes.map((n) => {
    if (n.id !== id) return n;
    const w = n.width ?? 100; const h = n.height ?? 100;
    const out: DesignNode = {
      id: n.id, kind: "image", x: n.x, y: n.y, width: w, height: h, fill: "#fff", src: url, opacity: n.opacity ?? 1,
      ...(n.rotation ? { rotation: n.rotation } : {}), ...(n.groupId ? { groupId: n.groupId } : {}),
      ...(n.kind === "ellipse" || n.mask === "circle" ? { mask: "circle" as const } : n.mask ? { mask: n.mask } : {}),
      ...(n.cornerRadius ? { cornerRadius: n.cornerRadius } : {}),
      ...(nat ? { crop: coverCrop(nat.w, nat.h, w, h) } : {}),
    };
    return out;
  });
}

/** A picture on the page: into the selected frame, at a point, or centred at a good size. */
export async function placePicture(ctx: StudioCtx, p: { url: string; width?: number | null; height?: number | null }, at?: { x: number; y: number }) {
  const c = ctx.canvas.current;
  if (!c) return;
  const nat = await naturalSize(p);
  const frame = at ? null : frameOf(ctx);
  if (frame) {
    c.commit((nodes) => fillFrame(nodes, frame.id, p.url, nat));
    c.select([frame.id]);
    return;
  }
  const s = c.scene().canvas;
  const w = Math.round(s.w * 0.56);
  const h = Math.round((w * nat.h) / nat.w);
  const id = nid("pic");
  const x = at ? Math.round(at.x - w / 2) : Math.round((s.w - w) / 2);
  const y = at ? Math.round(at.y - h / 2) : Math.round((s.h - h) / 2);
  c.commit((nodes) => [...nodes, { id, kind: "image", x, y, width: w, height: h, fill: "#fff", src: p.url, opacity: 1, cornerRadius: Math.round(Math.min(s.w, s.h) * 0.022) }]);
  c.select([id]);
}

/** The picture behind everything. */
export function backgroundPicture(ctx: StudioCtx, url: string) {
  ctx.canvas.current?.setBackground({ src: url, gradientId: null });
}

/** Our logo in a corner (the one there makes way). */
export function placeLogo(ctx: StudioCtx, key: LogoKey | "auto", pos: Position = "top-left") {
  const c = ctx.canvas.current;
  if (!c) return;
  const scene = c.scene();
  const s = scene.canvas;
  const k = key === "auto" ? (darkPage(scene) ? "white" : "black") : key;
  const lh = Math.round(40 * Math.min(s.w / 1080, Math.sqrt(s.w * s.h) / 1080));
  const probe = logoNode(k, 0, 0, lh);
  const at = boxAt(pos, s, (probe.width ?? 0) * LOGOS[k].box.w, lh);
  const node = logoNode(k, at.x, at.y, lh);
  c.commit((nodes) => [...nodes.filter((n) => !isLogo(n)), node]);
  c.select([node.id]);
}

/** A template on the page - built for each format the post has; the canvas takes its own as one undo step. */
export function applyTemplate(ctx: StudioCtx, t: Template, words?: Words) {
  const by = templatePage(ctx.doc.design, t, words, ctx.mf);
  const mine = by[ctx.fmt];
  const pageId = ctx.doc.design.pages[ctx.pageIx]?.id;
  // the other formats of this page, in the post's document (the canvas shows only this one)
  ctx.set((d) => {
    const i = d.design.pages.findIndex((p) => p.id === pageId);
    if (i < 0) return d;
    let design = d.design;
    for (const [f, doc] of Object.entries(by)) if (f !== ctx.fmt && doc) design = setPageDoc(design, i, f as typeof ctx.fmt, doc);
    return { ...d, design };
  });
  if (mine) ctx.canvas.current?.load(mine);
}

/** Words of a role, dropped under what the page already has (or in its middle when it is empty). */
export function addText(ctx: StudioCtx, role: TextRole, text: string) {
  const c = ctx.canvas.current;
  if (!c) return;
  const scene = c.scene();
  const s = scene.canvas;
  const m = Math.round(Math.min(s.w, s.h) * 0.075);
  const placed = roleNodes(role, text, s, { x: m, y: 0, w: s.w - m * 2 }, ctx.mf, darkPage(scene));
  const y = Math.round(Math.max(m, (s.h - placed.h) / 2));
  const nodes = placed.nodes.map((n) => ({ ...n, y: n.y + y }));
  c.commit((cur) => [...cur, ...nodes]);
  c.select(nodes.map((n) => n.id));
}

/** The size of the board on the canvas now. */
export const boardOf = (ctx: StudioCtx) => ctx.canvas.current?.scene().canvas ?? sizeOf(ctx.fmt, ctx.doc.design);

/** A download, named after the post. */
export function save(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
}
export const fileStem = (title: string) => (title || "social-post").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "social-post";

export type { DesignDocument };
