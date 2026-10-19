"use client";

// MAP ASSIGNMENT - the map: one country's outline and regions (cantons, départements ...) drawn with d3-geo from
// public/geo/shapes/<CC>.json, and every postcode of public/geo/postcodes/<CC>.json as a dot in the colour of the
// person the CURRENT rules (edited, not yet saved) give it. Regions take a light wash of the person with most of their
// postcodes. Hover a dot: postcode, place, region, person, the zone that decided; click keeps it. + / - zoom, drag pans.

import { useDeferredValue, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import CenterFocusStrongOutlinedIcon from "@mui/icons-material/CenterFocusStrongOutlined";
import { geoArea, geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, MultiPoint, Polygon, Position } from "geojson";
import { full } from "@/app/charts/format";
import { FAINT, HAIRLINE, INK, MUTED, glass } from "@/app/uc/report/ui";
import { Chip, Choice } from "@/app/connectors/parts";
import { cleanZip, type AssignRules } from "@/lib/mapAssign/rules";
import type { MapData } from "@/lib/mapAssign/api";
import {
  LEFT_EDGE, Swatch, countryName, postcodePicker, useCountryGeo,
  type GeoFiles, type Names, type Palette, type Pick,
} from "./shared";

const W = 800;
const PAD = 12;
const MAX_H = 760;
const CELL = 12;

type Pt = { zip: string; clean: string; place: string | null; x: number; y: number; region: number };
type Region = { code: string; name: string; d: string; rings: Float64Array[]; box: [number, number, number, number] };
export type Base = { w: number; h: number; outline: string | null; regions: Region[]; points: Pt[]; grid: Map<number, number[]> };

/* ── geometry ── */

/** d3-geo reads polygons on the sphere: an RFC 7946 (anticlockwise) ring means "everything but". Turn such rings round. */
function rewind(g: Geometry): Geometry {
  const fix = (rings: Position[][]): Position[][] => (geoArea({ type: "Polygon", coordinates: rings } as Polygon) > 2 * Math.PI ? rings.map((r) => [...r].reverse()) : rings);
  if (g.type === "Polygon") return { ...g, coordinates: fix(g.coordinates) };
  if (g.type === "MultiPolygon") return { ...g, coordinates: g.coordinates.map(fix) };
  if (g.type === "GeometryCollection") return { ...g, geometries: g.geometries.map(rewind) };
  return g;
}

function ringsOf(g: Geometry): Position[][] {
  if (g.type === "Polygon") return g.coordinates;
  if (g.type === "MultiPolygon") return g.coordinates.flat();
  if (g.type === "GeometryCollection") return g.geometries.flatMap(ringsOf);
  return [];
}

/** Even-odd ray test on projected rings - holes and islands included. */
function inside(x: number, y: number, rings: Float64Array[]): boolean {
  let c = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}

function regionAt(regions: Region[], x: number, y: number): number {
  for (let i = 0; i < regions.length; i++) {
    const [x0, y0, x1, y1] = regions[i].box;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && inside(x, y, regions[i].rings)) return i;
  }
  return -1;
}

/** The country fitted to the width, its regions as paths, every postcode placed and put in its region. */
export function projectGeo(files: GeoFiles): Base | null {
  const regionsIn = (files.shapes?.regions ?? []).map((r) => ({ ...r, geometry: rewind(r.geometry) }));
  const outline = files.shapes?.outline ? rewind(files.shapes.outline) : null;
  const rows = (files.points?.points ?? []).filter((r) => Array.isArray(r) && r[0] != null && Number.isFinite(Number(r[1])) && Number.isFinite(Number(r[2])));
  let fit: GeoPermissibleObjects;
  if (outline) fit = { type: "Feature", geometry: outline, properties: {} } as Feature;
  else if (regionsIn.length) fit = { type: "FeatureCollection", features: regionsIn.map((r) => ({ type: "Feature", geometry: r.geometry, properties: {} })) } as FeatureCollection;
  else if (rows.length > 1) fit = { type: "MultiPoint", coordinates: rows.map((r) => [Number(r[2]), Number(r[1])]) } as MultiPoint;
  else return null;
  const projection = geoMercator().fitWidth(W - 2 * PAD, fit);
  const [[, y0], [, y1]] = geoPath(projection).bounds(fit);
  const inner = Math.max(120, Math.min(MAX_H - 2 * PAD, Number.isFinite(y1 - y0) ? y1 - y0 : 400));
  projection.fitExtent([[PAD, PAD], [W - PAD, PAD + inner]], fit);
  const path = geoPath(projection);
  const regions: Region[] = regionsIn.map((r) => {
    const rings: Float64Array[] = [];
    let x0 = Infinity, y0b = Infinity, x1 = -Infinity, y1b = -Infinity;
    for (const ring of ringsOf(r.geometry)) {
      const a = new Float64Array(ring.length * 2);
      let n = 0;
      for (const pos of ring) {
        const p = projection([pos[0], pos[1]]);
        if (!p) continue;
        a[n++] = p[0]; a[n++] = p[1];
        if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0b) y0b = p[1]; if (p[1] > y1b) y1b = p[1];
      }
      if (n >= 6) rings.push(a.subarray(0, n));
    }
    return { code: String(r.code ?? ""), name: String(r.name ?? r.code ?? ""), d: path({ type: "Feature", geometry: r.geometry, properties: {} } as Feature) ?? "", rings, box: [x0, y0b, x1, y1b] };
  });
  const points: Pt[] = [];
  const grid = new Map<number, number[]>();
  for (const r of rows) {
    const p = projection([Number(r[2]), Number(r[1])]);
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    const zip = String(r[0]);
    const i = points.length;
    points.push({ zip, clean: cleanZip(zip), place: typeof r[3] === "string" && r[3] ? r[3] : null, x: p[0], y: p[1], region: regionAt(regions, p[0], p[1]) });
    const k = Math.floor(p[0] / CELL) * 1000 + Math.floor(p[1] / CELL);
    const cell = grid.get(k);
    if (cell) cell.push(i); else grid.set(k, [i]);
  }
  return { w: W, h: Math.ceil(inner + 2 * PAD), outline: outline ? path(fit) : null, regions, points, grid };
}

/* ── the country under the rules ── */

export type CountryMap = {
  status: "loading" | "none" | "ok";
  base: Base | null;
  picks: Pick[];
  /** postcodes the unsaved edits give to someone else; null without edits */
  moved: number | null;
  byOwner: Map<string, number>;
  byZone: Map<string, number>;
  regionOwner: (string | null)[];
  /** a region's postcodes per person, for the hover */
  regionCount: number[];
};

/** Every postcode of the country, decided by `rules` (deferred, so typing in the rules stays quick). */
export function useCountryMap(cc: string, rulesNow: AssignRules, saved: AssignRules, dirty: boolean): CountryMap {
  const files = useCountryGeo(cc);
  const base = useMemo(() => (files ? projectGeo(files) : null), [files]);
  const rules = useDeferredValue(rulesNow);
  const rule = rules.countries[cc];
  const globalDefault = rules.defaultOwner;
  const picks = useMemo(() => {
    if (!base) return [];
    const pick = postcodePicker(rule, { ...rules, defaultOwner: globalDefault });
    return base.points.map((p) => pick(p.clean));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, rule, globalDefault]);
  const savedRule = saved.countries[cc];
  const moved = useMemo(() => {
    if (!base || !dirty) return null;
    const pick = postcodePicker(savedRule, saved);
    let n = 0;
    base.points.forEach((p, i) => { if (String(pick(p.clean).owner) !== String(picks[i]?.owner)) n++; });
    return n;
  }, [base, dirty, savedRule, saved, picks]);
  const counts = useMemo(() => countPicks(base, picks), [picks, base]);
  return { status: files === null ? "loading" : base === null ? "none" : "ok", base, picks, moved, ...counts };
}

/** Postcodes per person and per zone, and each region's person with most of its postcodes. */
export function countPicks(base: Base | null, picks: Pick[]): { byOwner: Map<string, number>; byZone: Map<string, number>; regionOwner: (string | null)[]; regionCount: number[] } {
  const byOwner = new Map<string, number>(), byZone = new Map<string, number>();
  const per = (base?.regions ?? []).map(() => new Map<string, number>());
  picks.forEach((p, i) => {
    const o = String(p.owner ?? "");
    byOwner.set(o, (byOwner.get(o) ?? 0) + 1);
    if (p.zoneId) byZone.set(p.zoneId, (byZone.get(p.zoneId) ?? 0) + 1);
    const r = base?.points[i]?.region ?? -1;
    if (r >= 0) per[r].set(o, (per[r].get(o) ?? 0) + 1);
  });
  const regionOwner = per.map((m) => { let best: string | null = null, n = 0; for (const [o, c] of m) if (c > n) { best = o; n = c; } return best; });
  const regionCount = per.map((m) => [...m.values()].reduce((a, b) => a + b, 0));
  return { byOwner, byZone, regionOwner, regionCount };
}

/* ── the country picker ── */

export function CountryPicker({ list, cc, onPick }: { list: { cc: string; companies: number }[]; cc: string; onPick: (cc: string) => void }) {
  const top = list.slice(0, 9);
  const rest = list.slice(9);
  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
      <Choice<string> value={cc} onChange={onPick} options={top.map((c) => ({ key: c.cc, label: countryName(c.cc), count: c.companies }))} />
      {rest.length > 0 && (
        <TextField select size="small" value={rest.some((r) => r.cc === cc) ? cc : ""} onChange={(e) => e.target.value && onPick(e.target.value)}
          slotProps={{ select: { displayEmpty: true } }} sx={{ minWidth: 170, "& .MuiInputBase-input": { fontSize: "0.8rem", py: 0.6 } }}>
          <MenuItem value="">{`${rest.length} more countries`}</MenuItem>
          {rest.map((c) => <MenuItem key={c.cc} value={c.cc}>{`${countryName(c.cc)} · ${full(c.companies)}`}</MenuItem>)}
        </TextField>
      )}
    </Box>
  );
}

/* ── the map ── */

type Hit = { i: number; region: number; x: number; y: number };

export function MapPanel({ m, cc, rules, d, names, palette, compact = false }: {
  m: CountryMap; cc: string; rules: AssignRules; d: MapData; names: Names; palette: Palette; compact?: boolean;
}) {
  const [hl, setHl] = useState<string | null>(null);
  const [hover, setHover] = useState<Hit | null>(null);
  const [pinned, setPinned] = useState<Hit | null>(null);
  const [zoom, setZoom] = useState({ k: 1, x: 0, y: 0 });
  const gRef = useRef<SVGGElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ sx: number; sy: number; x0: number; y0: number; upp: number; moved: boolean } | null>(null);
  const base = m.base;
  const h = base?.h ?? 480;
  const rule = rules.countries[cc];
  const summary = d.countries.find((c) => c.country === cc);

  const r0 = base ? Math.max(1.4, Math.min(3.2, 170 / Math.sqrt(Math.max(1, base.points.length)))) : 2;
  const r = r0 / Math.sqrt(zoom.k);

  // one path per person: thousands of dots stay a handful of DOM nodes
  const groups = useMemo(() => {
    if (!base) return [];
    const by = new Map<string, string[]>();
    m.picks.forEach((p, i) => {
      const pt = base.points[i];
      if (!pt) return;
      const o = String(p.owner ?? "");
      const s = `M${(pt.x - r).toFixed(1)} ${pt.y.toFixed(1)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0`;
      const a = by.get(o);
      if (a) a.push(s); else by.set(o, [s]);
    });
    return [...by].map(([owner, parts]) => ({ owner, d: parts.join(""), n: parts.length }));
  }, [base, m.picks, r]);
  const drawOrder = [...groups].sort((a, b) => {
    const rank = (g: { owner: string }) => (g.owner === hl ? 3 : palette(g.owner).grey || palette(g.owner).none ? 0 : 1);
    return rank(a) - rank(b) || b.n - a.n;
  });

  const people = useMemo(() => {
    const s = new Set<string>([...m.byOwner.keys()]);
    for (const b of summary?.byOwner ?? []) s.add(String(b.owner));
    return [...s].map((o) => ({
      owner: o, postcodes: m.byOwner.get(o) ?? 0,
      companies: summary?.byOwner.find((b) => String(b.owner) === o)?.companies ?? 0,
    })).sort((a, b) => b.postcodes - a.postcodes || b.companies - a.companies || names.name(a.owner).localeCompare(names.name(b.owner)));
  }, [m.byOwner, summary, names]);

  /* pointer: nearest dot within 10 screen px, else the region under it */
  const locate = (clientX: number, clientY: number): Hit | null => {
    const g = gRef.current, box = boxRef.current;
    if (!g || !box || !base) return null;
    const ctm = g.getScreenCTM();
    if (!ctm) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const scale = Math.hypot(ctm.a, ctm.b) || 1;
    const reachUser = 10 / scale;
    const reach = Math.ceil(reachUser / CELL);
    const gx = Math.floor(pt.x / CELL), gy = Math.floor(pt.y / CELL);
    let best = -1, bestD = reachUser * reachUser;
    for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++) {
      for (const i of base.grid.get((gx + dx) * 1000 + gy + dy) ?? []) {
        if (hl && String(m.picks[i]?.owner) !== hl) continue;
        const p = base.points[i];
        const dd = (p.x - pt.x) ** 2 + (p.y - pt.y) ** 2;
        if (dd < bestD) { bestD = dd; best = i; }
      }
    }
    const region = best >= 0 ? base.points[best].region : regionAt(base.regions, pt.x, pt.y);
    if (best < 0 && region < 0) return null;
    const rect = box.getBoundingClientRect();
    return { i: best, region, x: clientX - rect.left, y: clientY - rect.top };
  };
  const clampZoom = (k: number, x: number, y: number) => ({ k, x: Math.min(0, Math.max(W - W * k, x)), y: Math.min(0, Math.max(h - h * k, y)) });
  const zoomBy = (f: number) => {
    setPinned(null); setHover(null);
    setZoom((z) => {
      const k = Math.max(1, Math.min(16, z.k * f));
      if (k === 1) return { k: 1, x: 0, y: 0 };
      const cx = W / 2, cy = h / 2;
      return clampZoom(k, cx - (cx - z.x) * (k / z.k), cy - (cy - z.y) * (k / z.k));
    });
  };

  const shown = hover ?? pinned;
  const shownPick = shown && shown.i >= 0 ? m.picks[shown.i] : null;
  const shownPt = shown && shown.i >= 0 && base ? base.points[shown.i] : null;
  const shownRegion = shown && shown.region >= 0 && base ? base.regions[shown.region] : null;
  const boxW = boxRef.current?.clientWidth ?? 600;

  let mapBody: React.ReactNode;
  if (m.status === "loading") {
    mapBody = (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, minHeight: 260, color: MUTED }}>
        <CircularProgress size={16} sx={{ color: MUTED }} /><Typography sx={{ fontSize: "0.85rem", color: MUTED }}>Reading the map of {countryName(cc)}…</Typography>
      </Box>
    );
  } else if (m.status === "none" || !base) {
    mapBody = (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: 220, border: `1px dashed ${HAIRLINE}`, borderRadius: "16px", p: 2, textAlign: "center" }}>
        <Box>
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: INK }}>No map of {countryName(cc)} yet</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 0.5 }}>Its postcode and region files are not in the hub. The rules and the counts beside work without them.</Typography>
        </Box>
      </Box>
    );
  } else {
    mapBody = (
      <Box ref={boxRef} sx={{ position: "relative" }}>
        <Box component="svg" ref={svgRef} viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`Map of ${countryName(cc)}: ${full(base.points.length)} postcodes coloured by person`}
          sx={{ width: "100%", height: "auto", maxHeight: { md: "min(74vh, 760px)" }, display: "block", touchAction: zoom.k > 1 ? "none" : "auto", cursor: zoom.k > 1 ? "grab" : "crosshair", userSelect: "none" }}
          onPointerMove={(e: React.PointerEvent<SVGSVGElement>) => {
            const dr = drag.current;
            if (dr) {
              const dx = e.clientX - dr.sx, dy = e.clientY - dr.sy;
              if (Math.abs(dx) + Math.abs(dy) > 3) dr.moved = true;
              if (dr.moved && zoom.k > 1) { setZoom((z) => clampZoom(z.k, dr.x0 + dx * dr.upp, dr.y0 + dy * dr.upp)); return; }
              if (dr.moved) return;
            }
            if (e.pointerType === "mouse") setHover(locate(e.clientX, e.clientY));
          }}
          onPointerLeave={() => setHover(null)}
          onPointerCancel={() => { drag.current = null; }}
          onPointerDown={(e: React.PointerEvent<SVGSVGElement>) => {
            const svg = svgRef.current;
            const upp = 1 / (svg?.getScreenCTM()?.a || 1); // viewBox units per screen px, letterboxing included
            drag.current = { sx: e.clientX, sy: e.clientY, x0: zoom.x, y0: zoom.y, upp, moved: false };
            if (zoom.k > 1) { try { svg?.setPointerCapture(e.pointerId); } catch { /* not capturable */ } }
          }}
          onPointerUp={(e: React.PointerEvent<SVGSVGElement>) => {
            const dr = drag.current;
            drag.current = null;
            if (dr?.moved) { setPinned(null); return; }
            setPinned(locate(e.clientX, e.clientY));
          }}>
          <g ref={gRef} transform={`translate(${zoom.x} ${zoom.y}) scale(${zoom.k})`}>
            {base.regions.length === 0 && base.outline && <path d={base.outline} fill="#eef1f5" />}
            {base.regions.map((rg, i) => {
              const o = m.regionOwner[i];
              const p = o !== null && o !== undefined ? palette(o) : null;
              return <path key={`${rg.code}-${i}`} d={rg.d} fill={p ? p.color : "#eef1f5"} fillOpacity={p ? (hl && hl !== o ? 0.05 : 0.17) : 1} stroke="#ffffff" strokeWidth={1} vectorEffect="non-scaling-stroke" />;
            })}
            {base.outline && <path d={base.outline} fill="none" stroke="#a7b0bf" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
            {drawOrder.map((g) => {
              const p = palette(g.owner);
              const dim = hl !== null && hl !== g.owner;
              return (
                <path key={g.owner || "nobody"} d={g.d} opacity={dim ? 0.12 : 1}
                  fill={p.ring ? "#ffffff" : p.color}
                  stroke={p.left ? LEFT_EDGE : p.ring ? p.color : "#ffffff"}
                  strokeWidth={p.left ? r * 0.45 : p.ring ? r * 0.55 : r * 0.14} strokeOpacity={p.left || p.ring ? 1 : 0.85} />
              );
            })}
            {shownPt && <circle cx={shownPt.x} cy={shownPt.y} r={r * 2.2} fill="none" stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
          </g>
        </Box>
        <Box sx={{ position: "absolute", top: 8, right: 8, display: "flex", flexDirection: "column", gap: 0.5, ...glass, backdropFilter: "none", borderRadius: "12px", p: 0.4 }}>
          <Tooltip title="Zoom in" placement="left"><IconButton size="small" onClick={() => zoomBy(1.7)} aria-label="Zoom in"><AddIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
          <Tooltip title="Zoom out" placement="left"><span><IconButton size="small" onClick={() => zoomBy(1 / 1.7)} disabled={zoom.k <= 1} aria-label="Zoom out"><RemoveIcon sx={{ fontSize: 18 }} /></IconButton></span></Tooltip>
          <Tooltip title="Whole country" placement="left"><span><IconButton size="small" onClick={() => { setPinned(null); setZoom({ k: 1, x: 0, y: 0 }); }} disabled={zoom.k <= 1} aria-label="Whole country"><CenterFocusStrongOutlinedIcon sx={{ fontSize: 18 }} /></IconButton></span></Tooltip>
        </Box>
        {shown && (shownPt || shownRegion) && (
          <Box sx={{
            position: "absolute", pointerEvents: "none", zIndex: 2, ...glass, backdropFilter: "none", bgcolor: "rgba(255,255,255,.96)", borderRadius: "12px", px: 1.25, py: 0.9, maxWidth: 260,
            left: Math.max(4, Math.min(shown.x + 14, boxW - 264)), top: Math.max(4, shown.y + 14),
          }}>
            {shownPt && <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{shownPt.zip}{shownPt.place ? ` ${shownPt.place}` : ""}</Typography>}
            {shownRegion && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{shownRegion.name}{shownRegion.code && shownRegion.code !== shownRegion.name ? ` (${shownRegion.code})` : ""}</Typography>}
            {shownPick && (
              <>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5 }}>
                  <Swatch paint={palette(shownPick.owner)} />
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK }}>{shownPick.owner ? names.name(shownPick.owner) : "No person picked"}</Typography>
                </Box>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{shownPick.how}</Typography>
                {shownPick.owner && !names.active(shownPick.owner) && <Typography sx={{ fontSize: "0.74rem", color: LEFT_EDGE }}>Has left - companies here go to the default</Typography>}
              </>
            )}
            {!shownPick && shownRegion && shown.region >= 0 && (
              <Typography sx={{ fontSize: "0.76rem", color: INK, mt: 0.5 }}>
                {m.regionOwner[shown.region] ? `Mostly ${names.name(m.regionOwner[shown.region])}` : "No postcodes"} · {full(m.regionCount[shown.region] ?? 0)} postcodes
              </Typography>
            )}
          </Box>
        )}
        <Typography sx={{ fontSize: "0.74rem", color: FAINT, mt: 0.75 }}>
          Hover or tap a dot for its postcode and who has it; + and − zoom, drag to move. Regions are washed in the colour of the person with most of their postcodes.
        </Typography>
      </Box>
    );
  }

  const legend = (
    <Box sx={{ display: "grid", gap: 0.5, alignContent: "start" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1 }}>
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>Who · postcodes · companies</Typography>
        {hl && <Box component="button" type="button" onClick={() => setHl(null)} sx={{ all: "unset", cursor: "pointer", fontSize: "0.74rem", color: "#2459d1", fontWeight: 600 }}>Show everyone</Box>}
      </Box>
      {people.length === 0 && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Nobody yet.</Typography>}
      <Box sx={{ display: "grid", gap: 0.25, gridTemplateColumns: compact ? { xs: "1fr", sm: "1fr 1fr" } : "1fr" }}>
        {people.map((p) => {
          const paint = palette(p.owner);
          const on = hl === p.owner;
          const tag = p.owner === String(rules.defaultOwner) ? "global default" : rule?.defaultOwner && p.owner === String(rule.defaultOwner) ? "country default" : null;
          return (
            <Box key={p.owner || "nobody"} component="button" type="button" onClick={() => setHl(on ? null : p.owner)} aria-pressed={on}
              sx={{
                all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.6, borderRadius: "10px", minHeight: 32,
                bgcolor: on ? "rgba(36,89,209,.08)" : "transparent", opacity: hl && !on ? 0.55 : 1,
                "&:hover": { bgcolor: on ? "rgba(36,89,209,.12)" : "rgba(21,34,58,.04)" }, "&:focus-visible": { outline: "2px solid #2459d1" },
              }}>
              <Swatch paint={paint} size={14} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.owner ? names.name(p.owner) : "No person picked"}
                </Typography>
                {(tag || paint.left) && <Typography sx={{ fontSize: "0.7rem", color: paint.left ? LEFT_EDGE : MUTED }}>{paint.left ? "has left - the default gets it" : tag}</Typography>}
              </Box>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{full(p.postcodes)} · {full(p.companies)}</Typography>
            </Box>
          );
        })}
      </Box>
      <Typography sx={{ fontSize: "0.72rem", color: FAINT, mt: 0.5 }}>
        Postcodes: by the rules on screen{m.moved !== null ? " (with your edits)" : ""}. Companies: by the saved rules, at the last scan{rule?.source === "sae" || !rule ? " - SAE included" : ""}. Click a person to pick out their dots.
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: compact ? "minmax(0, 1fr)" : { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 300px" }, alignItems: "start" }}>
      <Box sx={{ minWidth: 0 }}>
        {m.moved !== null && (
          <Box sx={{ mb: 1 }}><Chip tint={m.moved ? "amber" : "slate"}>{m.moved ? `Your edits give ${full(m.moved)} postcodes to someone else` : "Your edits move no postcode here"}</Chip></Box>
        )}
        {mapBody}
      </Box>
      {legend}
    </Box>
  );
}

export function sourceNote(cc: string, rules: AssignRules, names: Names): { tint: "blue" | "purple" | "slate"; title: string; text: string } {
  const rule = rules.countries[cc];
  const c = countryName(cc);
  const fallback = rule?.defaultOwner ? names.name(rule.defaultOwner) : `${names.name(rules.defaultOwner)} (the global default)`;
  if (!rule) return { tint: "slate", title: `${c}: no rule`, text: `Companies go by the SAE table; without a known SAE to ${names.name(rules.defaultOwner)}. Add a rule for ${c} on Rules to draw zones.` };
  if (rule.source === "sae") return {
    tint: "purple", title: `${c}: the Performis SAE decides`,
    text: `A company with an SAE the table knows goes to that person. The map shows the postcode zones - the fallback for companies without an SAE or with an unknown one; no zone: ${fallback}.`,
  };
  return { tint: "blue", title: `${c}: the map decides`, text: `Key accounts first, then the postcode zones; the SAE is shown, never copied. A postcode in no zone goes to ${fallback}.` };
}

