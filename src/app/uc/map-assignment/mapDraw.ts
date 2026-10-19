// MAP ASSIGNMENT - drawing the map on a canvas (one draw per frame, nothing kept in the DOM): the regions filled
// (zoomed out) or the postcode areas (zoomed in, clipped to the outline), the region borders and outline above, the
// hovered / picked area outlined, labels and the top-customer marks in screen pixels on top. Paths are built once per
// country (Path2D) and per colouring, so a pan or zoom frame only fills a handful of paths.

import type { MapBase } from "./mapModel";

export type View = { k: number; x: number; y: number };
/** The canvas in CSS pixels and how the map's units sit in it before the zoom: css = base * sx + (ox, oy). */
export type Frame = { cssW: number; cssH: number; dpr: number; sx: number; ox: number; oy: number };

export const toScreen = (f: Frame, v: View, bx: number, by: number): [number, number] => [(bx * f.sx + f.ox) * v.k + v.x, (by * f.sx + f.oy) * v.k + v.y];
export const toBase = (f: Frame, v: View, X: number, Y: number): [number, number] => [((X - v.x) / v.k - f.ox) / f.sx, ((Y - v.y) / v.k - f.oy) / f.sx];

export type BasePaths = { outline: Path2D | null; regions: Path2D[]; borders: Path2D; cells: Path2D | null };

export function basePaths(base: MapBase): BasePaths {
  const regions = base.regions.map((r) => new Path2D(r.d));
  const borders = new Path2D();
  for (const p of regions) borders.addPath(p);
  let cells: Path2D | null = null;
  if (base.voronoi) {
    cells = new Path2D();
    for (let c = 0; c < base.cells.length; c++) base.voronoi.renderCell(c, cells);
  }
  return { outline: base.outline ? new Path2D(base.outline) : null, regions, borders, cells };
}

/** A fill key: "#rrggbb" plain, "#rrggbb|#rrggbb" = the first with stripes of the second. */
export type FillKey = string;

/** The cells grouped by fill: one path per colour. */
export function cellGroups(base: MapBase, keys: (FillKey | null)[]): { key: FillKey; path: Path2D }[] {
  const by = new Map<FillKey, Path2D>();
  if (!base.voronoi) return [];
  for (let c = 0; c < base.cells.length; c++) {
    const k = keys[c];
    if (!k) continue;
    let p = by.get(k);
    if (!p) { p = new Path2D(); by.set(k, p); }
    base.voronoi.renderCell(c, p);
  }
  return [...by].map(([key, path]) => ({ key, path }));
}

export type Focus = { cell?: number | null; region?: number | null };
export type Marker = { x: number; y: number; r: number; i: number };

export type Scene = {
  base: MapBase; paths: BasePaths; frame: Frame; view: View;
  /** fills per region (zoomed out, or a region layer such as GDP) */
  regionKeys: (FillKey | null)[];
  /** fills per postcode area, grouped (zoomed in); null = draw the regions */
  cells: { key: FillKey; path: Path2D }[] | null;
  hover: Focus | null; pinned: Focus | null;
  regionLabel: (i: number) => string;
  markers: Marker[] | null; hoverMarker: number | null;
};

export const LAND = "#eef1f5";
const INK = "#15223a";
const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";

const patterns = new Map<string, CanvasPattern | null>();
function stripes(ctx: CanvasRenderingContext2D, base: string, stripe: string, dpr: number): CanvasPattern | null {
  const key = `${base}|${stripe}|${dpr}`;
  if (patterns.has(key)) return patterns.get(key) ?? null;
  const n = Math.round(8 * dpr);
  const tile = document.createElement("canvas");
  tile.width = n; tile.height = n;
  const t = tile.getContext("2d");
  let p: CanvasPattern | null = null;
  if (t) {
    t.fillStyle = base; t.fillRect(0, 0, n, n);
    t.strokeStyle = stripe; t.lineWidth = 2 * dpr; t.lineCap = "square";
    // one diagonal and its wrap-around corners: seamless at 45°
    t.beginPath(); t.moveTo(0, n); t.lineTo(n, 0); t.moveTo(-n / 2, n / 2); t.lineTo(n / 2, -n / 2); t.moveTo(n / 2, n * 1.5); t.lineTo(n * 1.5, n / 2); t.stroke();
    p = ctx.createPattern(tile, "repeat");
  }
  patterns.set(key, p);
  return p;
}

function fill(ctx: CanvasRenderingContext2D, key: FillKey, path: Path2D, scale: number, dpr: number) {
  const bar = key.indexOf("|");
  if (bar < 0) { ctx.fillStyle = key; ctx.fill(path); return; }
  const p = stripes(ctx, key.slice(0, bar), key.slice(bar + 1), dpr);
  if (p) {
    // stripes keep their size on screen whatever the zoom
    p.setTransform(new DOMMatrix([1 / (scale * dpr), 0, 0, 1 / (scale * dpr), 0, 0]));
    ctx.fillStyle = p;
  } else ctx.fillStyle = key.slice(0, bar);
  ctx.fill(path);
}

function halo(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,.92)"; ctx.lineJoin = "round";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

/** The map without the hovered / picked outlines: what the snapshot holds (drawBase), the outlines go over it. */
export function drawBase(ctx: CanvasRenderingContext2D, s: Scene) {
  const { base, paths, frame: f, view: v } = s;
  const dpr = f.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, f.cssW, f.cssH);
  const scale = f.sx * v.k;
  const tx = f.ox * v.k + v.x, ty = f.oy * v.k + v.y;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * tx, dpr * ty);
  const px = 1 / scale; // one CSS pixel in map units

  // land, then the colouring
  ctx.fillStyle = LAND;
  if (paths.outline) ctx.fill(paths.outline); else for (const r of paths.regions) ctx.fill(r);
  if (s.cells) {
    ctx.save();
    if (paths.outline) ctx.clip(paths.outline);
    for (const g of s.cells) fill(ctx, g.key, g.path, scale, dpr);
    // the postcode borders once the areas are big enough to tell apart
    const side = base.smallCell * 2.5 * scale;
    if (paths.cells && side >= 10) {
      ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.9, 0.35 + side / 60)})`;
      ctx.lineWidth = Math.min(1.2, 0.5 + side / 80) * px;
      ctx.stroke(paths.cells);
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(21,34,58,.42)"; ctx.lineWidth = 1.1 * px;
    ctx.stroke(paths.borders);
  } else {
    s.regionKeys.forEach((k, i) => { if (k) fill(ctx, k, paths.regions[i], scale, dpr); });
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.4 * px;
    ctx.stroke(paths.borders);
  }
  if (paths.outline) { ctx.strokeStyle = "#8b97ac"; ctx.lineWidth = 1 * px; ctx.stroke(paths.outline); }

  // screen space: labels and marks keep their size
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  labelsAndMarks(ctx, s, scale);
}

/** The hovered and picked postcode area or region outlined, and the hovered top-customer mark, over a drawn map. */
export function drawFocus(ctx: CanvasRenderingContext2D, s: Scene) {
  const { base, paths, frame: f, view: v } = s;
  const dpr = f.dpr;
  const scale = f.sx * v.k;
  const tx = f.ox * v.k + v.x, ty = f.oy * v.k + v.y;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * tx, dpr * ty);
  const px = 1 / scale;
  const outlineFocus = (fc: Focus | null, width: number) => {
    if (!fc) return;
    if (fc.cell !== null && fc.cell !== undefined && base.voronoi) {
      const p = new Path2D();
      base.voronoi.renderCell(fc.cell, p);
      ctx.save();
      if (paths.outline) ctx.clip(paths.outline);
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = (width + 2.5) * px; ctx.stroke(p);
      ctx.strokeStyle = INK; ctx.lineWidth = width * px; ctx.stroke(p);
      ctx.restore();
    } else if (fc.region !== null && fc.region !== undefined && paths.regions[fc.region]) {
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = (width + 2.5) * px; ctx.stroke(paths.regions[fc.region]);
      ctx.strokeStyle = INK; ctx.lineWidth = width * px; ctx.stroke(paths.regions[fc.region]);
    }
  };
  outlineFocus(s.hover, 1.5);
  outlineFocus(s.pinned, 2.4);
  const m = s.hoverMarker !== null ? s.markers?.find((x) => x.i === s.hoverMarker) : null;
  if (m) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const [X, Y] = toScreen(f, v, m.x, m.y);
    ctx.beginPath(); ctx.arc(X, Y, m.r + 1, 0, Math.PI * 2);
    ctx.fillStyle = "#eb6834"; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#ffffff"; ctx.stroke();
  }
}

/** One frame, whole. */
export function drawMap(ctx: CanvasRenderingContext2D, s: Scene) {
  drawBase(ctx, s);
  drawFocus(ctx, s);
}

function labelsAndMarks(ctx: CanvasRenderingContext2D, s: Scene, scale: number) {
  const { base, frame: f, view: v } = s;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const inView = (x: number, y: number, m = 0) => x >= -m && y >= -m && x <= f.cssW + m && y <= f.cssH + m;
  // labels never overlap: a coarse grid of the boxes placed so far
  const taken = new Map<number, [number, number, number, number][]>();
  const G = 48;
  const place = (x: number, y: number, w: number, h: number): boolean => {
    const box: [number, number, number, number] = [x - w / 2 - 2, y - h / 2 - 1, x + w / 2 + 2, y + h / 2 + 1];
    const keys: number[] = [];
    for (let gx = Math.floor(box[0] / G); gx <= Math.floor(box[2] / G); gx++) for (let gy = Math.floor(box[1] / G); gy <= Math.floor(box[3] / G); gy++) keys.push(gx * 100003 + gy);
    for (const k of keys) for (const b of taken.get(k) ?? []) if (b[0] < box[2] && b[2] > box[0] && b[1] < box[3] && b[3] > box[1]) return false;
    for (const k of keys) { const l = taken.get(k); if (l) l.push(box); else taken.set(k, [box]); }
    return true;
  };
  let zipLabels = 0;
  if (s.cells && base.smallCell * 2.5 * scale >= 30) {
    ctx.font = `600 10.5px ${FONT}`;
    const cap = 700;
    for (let c = 0; c < base.cells.length && zipLabels < cap; c++) {
      const b = c * 4;
      const x0 = base.cellBox[b], y0 = base.cellBox[b + 1], x1 = base.cellBox[b + 2], y1 = base.cellBox[b + 3];
      if (!(x1 > x0)) continue;
      const w = (x1 - x0) * scale, h = (y1 - y0) * scale;
      if (Math.min(w, h) < 30) continue;
      const pt = base.points[base.cells[c][0]];
      const [X, Y] = toScreen(f, v, pt.x, pt.y);
      if (!inView(X, Y, 20)) continue;
      const more = base.cells[c].length - 1;
      const text = more ? `${pt.zip} +${more}` : pt.zip;
      const tw = ctx.measureText(text).width;
      if (tw + 6 > Math.min(w, h * 2.2) || !place(X, Y, tw, 12)) continue;
      halo(ctx, text, X, Y, INK);
      zipLabels++;
    }
  }
  if (!zipLabels) {
    // region names while the postcodes have none
    ctx.font = `${s.cells ? 500 : 600} 11px ${FONT}`;
    base.regions.forEach((r, i) => {
      if (!r.label) return;
      const w = (r.box[2] - r.box[0]) * scale, h = (r.box[3] - r.box[1]) * scale;
      if (w < 26 || h < 14) return;
      const [X, Y] = toScreen(f, v, r.label[0], r.label[1]);
      if (!inView(X, Y)) return;
      const name = s.regionLabel(i);
      const short = r.code.includes("-") ? r.code.slice(r.code.indexOf("-") + 1) : r.code;
      const text = ctx.measureText(name).width + 8 <= w * 0.9 ? name : ctx.measureText(short).width + 6 <= w ? short : "";
      if (text && place(X, Y, ctx.measureText(text).width, 13)) halo(ctx, text, X, Y, s.cells ? "#3b4a66" : INK);
    });
  }

  if (s.markers) {
    for (const m of s.markers) {
      const [X, Y] = toScreen(f, v, m.x, m.y);
      if (!inView(X, Y, m.r + 2)) continue;
      ctx.beginPath(); ctx.arc(X, Y, m.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(21,34,58,.82)"; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "#ffffff"; ctx.stroke();
    }
  }
}
