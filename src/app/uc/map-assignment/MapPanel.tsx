"use client";

// MAP ASSIGNMENT - the map (v2, SARCLA 19.10.2026: "interactive from macro to much detail level, showing revenue, top
// customers, GDP, new customers, priority customers"; the German map of v1 - pastel regions under thousands of dots -
// was "really confusing"). One canvas, zoom and pan (wheel / pinch / drag / + -):
//   zoomed out  the REGIONS (cantons, départements, Länder), each in the colour of the person holding most of its
//               postcodes under the rules on screen, paler where others hold part of it
//   zoomed in   the POSTCODE AREAS (the Voronoi cells of the postcode points, clipped to the outline), each in its
//               person's colour; postcode labels once the areas are big enough
// Layers: Owners (default), Revenue, Customers, New customers, Priority P1-P4, GDP, Top customers - from the engine's
// LayerData (GET /api/uc/map-assignment?layers=CC; none yet = only Owners). Legend per layer; for Owners: person,
// postcodes, companies, km² (SARCLA: "see the number of square km of the zone").
// Click a postcode (or a region, zoomed out) -> a card: what it is, who has it and why, and - for admins on a page that
// passes onAssign - a person picker that gives it to someone in the DRAFT rules (mapEdit.ts); the map recolours at once
// and the page's Save keeps it.
//
// CONTRACT with the page (page.tsx, RulesView):
//   const m = useCountryMap(cc, rules, d.rules, dirty)   - the country under the rules on screen (deferred while typing)
//   <MapPanel m={m} cc={cc} rules={rules} d={d} names={names} palette={palette} compact? onAssign? />
//   onAssign(country, change: MapAssign) - someone gave postcodes or regions to a person on the map. change.rule is the
//     country's whole CountryRule after the change: put it in the draft as it is -
//       onAssign={(cc, ch) => setDraft((r) => ({ ...r, countries: { ...r.countries, [cc]: ch.rule } }))}
//     kind / keys / owner / text describe it (owner "" + kind "undo"-text when the map's Undo puts the rule back).
//     Without onAssign, or when d.admin is false, the map only shows.
//   <CountryPicker list={countryList(d, rules)} cc={cc} onPick={setCc} /> - the countries, in the top bar's tab look
//   sourceNote(cc, rules, names) - the card title's line (Performis decides / the map decides)

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import CenterFocusStrongOutlinedIcon from "@mui/icons-material/CenterFocusStrongOutlined";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { compact as short, full } from "@/app/charts/format";
import { FAINT, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { Chip } from "@/app/connectors/parts";
import { cleanZip, type AssignRules, type CountryRule } from "@/lib/mapAssign/rules";
import type { LayerData, MapData, PostcodeStat } from "@/lib/mapAssign/api";
import { API, MAX_BODY, OwnerPicker, Swatch, bodyBytes, countryName, hsCompany, newId, useCountryGeo, type Names, type Palette } from "./shared";
import {
  K_DETAIL, PRIORITIES, W, breaks, buildBase, cellAt, classOf, isLayerData, joinLayer, pickAll, regionAt, statValue, tally,
  type Decided, type Joined, type LayerKey, type MapBase, type Priority, type Tally, type ValueLayer,
} from "./mapModel";
import { assignOnMap, type MapAssign, type MapChange } from "./mapEdit";
import { LAND, basePaths, cellGroups, drawBase, drawFocus, toBase, toScreen, type BasePaths, type FillKey, type Frame, type Marker, type Scene, type View } from "./mapDraw";
import { CountryTabs, PillGroup, type PillDef } from "./mapTabs";

export type { MapAssign } from "./mapEdit";

/* ── the country under the rules ── */

export type CountryMap = {
  status: "loading" | "none" | "ok";
  base: MapBase | null;
  /** per postcode (base.points): who, and how */
  picks: Decided[];
  /** postcodes the unsaved edits give to someone else; null without edits */
  moved: number | null;
  /** postcodes per person */
  byOwner: Map<string, number>;
  byZone: Map<string, number>;
  /** per region: the person holding most of its postcodes, and how many postcodes it has */
  regionOwner: (string | null)[];
  regionCount: number[];
  tally: Tally;
};

const baseCache = new WeakMap<object, MapBase | null>();

/** Every postcode of the country, decided by `rules` (deferred, so typing in the rules stays quick). */
export function useCountryMap(cc: string, rulesNow: AssignRules, saved: AssignRules, dirty: boolean): CountryMap {
  const files = useCountryGeo(cc);
  const base = useMemo(() => {
    if (!files) return null;
    if (!baseCache.has(files)) baseCache.set(files, buildBase(files, cc));
    return baseCache.get(files) ?? null;
  }, [files, cc]);
  const rules = useDeferredValue(rulesNow);
  const rule = rules.countries[cc];
  const globalDefault = String(rules.defaultOwner);
  const picks = useMemo(() => (base ? pickAll(base, rule, globalDefault) : []), [base, rule, globalDefault]);
  const savedRule = saved.countries[cc];
  const savedDefault = String(saved.defaultOwner);
  const moved = useMemo(() => {
    if (!base || !dirty) return null;
    const before = pickAll(base, savedRule, savedDefault);
    let n = 0;
    before.forEach((p, i) => { if (p.owner !== picks[i]?.owner) n++; });
    return n;
  }, [base, dirty, savedRule, savedDefault, picks]);
  const t = useMemo(() => tally(base, picks), [base, picks]);
  const compat = useMemo(() => ({
    byOwner: new Map([...t.byOwner].map(([o, v]) => [o, v.postcodes] as const)),
    regionOwner: t.regions.map((r) => r.owners[0]?.[0] ?? null),
    regionCount: t.regions.map((r) => r.total),
  }), [t]);
  return { status: files === null ? "loading" : base === null ? "none" : "ok", base, picks, moved, byZone: t.byZone, tally: t, ...compat };
}

/* ── the engine's layers ── */

const layerCache = new Map<string, { at: number; p: Promise<LayerData | null> }>();
function loadLayers(cc: string): Promise<LayerData | null> {
  const hit = layerCache.get(cc);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.p;
  const p = fetch(`${API}?layers=${encodeURIComponent(cc)}`)
    .then(async (r) => {
      if (!r.ok) return null;
      const j = (await r.json()) as { ok?: boolean; data?: unknown };
      return j && j.ok && isLayerData(j.data, cc) ? j.data : null; // a route that does not know ?layers answers with MapData
    })
    .catch(() => null);
  layerCache.set(cc, { at: Date.now(), p });
  return p;
}

function useLayers(cc: string): { data: LayerData | null; loading: boolean } {
  const [got, setGot] = useState<{ cc: string; data: LayerData | null } | null>(null);
  useEffect(() => {
    let live = true;
    void loadLayers(cc).then((data) => { if (live) setGot({ cc, data }); });
    return () => { live = false; };
  }, [cc]);
  return got && got.cc === cc ? { data: got.data, loading: false } : { data: null, loading: true };
}

/* ── colours ── */

/** The categorical hue mixed with white: t = 1 the hue, 0 white. */
function mix(hex: string, t: number): string {
  const h = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(h)) return hex;
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `#${c.map((v) => Math.round(v * t + 255 * (1 - t)).toString(16).padStart(2, "0")).join("")}`;
}
const STRONG = 0.8;
const DIM = 0.18;
/** Sequential blue, light to dark (dataviz reference ramp, steps 150 250 350 500 650). */
const RAMP = ["#b7d3f6", "#86b6ef", "#5598e7", "#256abf", "#104281"];
const rampOf = (classes: number) => (classes >= RAMP.length ? RAMP : RAMP.filter((_, i) => i % Math.ceil(RAMP.length / classes) === 0 || i === RAMP.length - 1).slice(-classes));
const UNKNOWN: FillKey = `${LAND}|#d6dbe4`;

const LAYERS: { key: LayerKey; label: string }[] = [
  { key: "owners", label: "Owners" }, { key: "revenue", label: "Revenue" }, { key: "customers", label: "Customers" },
  { key: "newCustomers", label: "New customers" }, { key: "priority", label: "Priority" }, { key: "gdp", label: "GDP" }, { key: "top", label: "Top customers" },
];
const LAYER_KEY = "apsomh:map-assignment:layer";

/** GDP as the engine gives it, in million EUR: "830 m EUR", "1.2 bn EUR". */
const gdpText = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "unknown"
  : Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(Math.abs(v) >= 10_000 ? 0 : 1)} bn EUR` : `${full(v)} m EUR`);
const km2Text = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v > 0 && v < 10 ? `${v.toFixed(1)} km²` : `${full(v)} km²`);

/* ── the country picker ── */

export function CountryPicker({ list, cc, onPick }: { list: { cc: string; companies: number }[]; cc: string; onPick: (cc: string) => void }) {
  return <CountryTabs list={list} cc={cc} onPick={onPick} label={countryName} />;
}

/* ── the map ── */

type Target =
  | { kind: "cell"; cell: number; point: number; region: number; X: number; Y: number }
  | { kind: "region"; region: number; X: number; Y: number }
  | { kind: "marker"; i: number; X: number; Y: number };
const sameTarget = (a: Target | null, b: Target | null) => {
  if (!a || !b) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === "cell" && b.kind === "cell") return a.cell === b.cell;
  if (a.kind === "region" && b.kind === "region") return a.region === b.region;
  return a.kind === "marker" && b.kind === "marker" && a.i === b.i;
};

type Note = { text: string; bad?: boolean; undo?: { rule: CountryRule; text: string } };

export function MapPanel({ m, cc, rules, d, names, palette, compact = false, onAssign }: {
  m: CountryMap; cc: string; rules: AssignRules; d: MapData; names: Names; palette: Palette; compact?: boolean;
  onAssign?: (country: string, change: MapAssign) => void;
}) {
  const base = m.base;
  const rule = rules.countries[cc];
  const summary = d.countries.find((c) => c.country === cc);
  const canGive = !!onAssign && d.admin;

  const [layer, setLayerState] = useState<LayerKey>("owners");
  useEffect(() => { try { const v = window.localStorage.getItem(LAYER_KEY); if (v && LAYERS.some((l) => l.key === v)) setLayerState(v as LayerKey); } catch { /* no storage */ } }, []);
  const setLayer = (k: LayerKey) => { setLayerState(k); try { window.localStorage.setItem(LAYER_KEY, k); } catch { /* no storage */ } };
  const [prio, setPrio] = useState<Priority>("P1");
  const [hl, setHl] = useState<string | null>(null);
  const [hover, setHover] = useState<Target | null>(null);
  const [pinned, setPinned] = useState<Target | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [ui, setUi] = useState({ detail: false, atMin: true, atMax: false });
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [query, setQuery] = useState("");
  const [miss, setMiss] = useState(false);

  // a new country starts whole, nothing picked
  const viewRef = useRef<View>({ k: 1, x: 0, y: 0 });
  useEffect(() => { viewRef.current = { k: 1, x: 0, y: 0 }; setPinned(null); setHover(null); setHl(null); setNote(null); setUi({ detail: false, atMin: true, atMax: false }); }, [cc]);

  const layers = useLayers(cc);
  const joined = useMemo<Joined | null>(() => (base && layers.data ? joinLayer(base, layers.data) : null), [base, layers.data]);
  const hasGdp = !!joined?.gdp.some((g) => g !== null);
  const effLayer: LayerKey = layer === "owners" || (joined && (layer !== "gdp" || hasGdp) && (layer !== "top" || joined.top.length)) ? layer : "owners";

  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<Frame | null>(null);
  const raf = useRef(0);
  const drawRef = useRef<() => void>(() => {});
  const schedule = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => { raf.current = 0; drawRef.current(); });
  }, []);
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  /* ── the canvas size ── */
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !base) return;
    const measure = () => {
      const w = Math.max(200, Math.round(box.clientWidth));
      const maxH = compact ? 520 : Math.max(320, Math.min(760, Math.round(window.innerHeight * 0.74)));
      const h = Math.round(Math.min((w * base.h) / W, maxH));
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [base, compact]);
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !size || !base) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(size.w * dpr); cv.height = Math.round(size.h * dpr);
    const sx = Math.min(size.w / W, size.h / base.h);
    frameRef.current = { cssW: size.w, cssH: size.h, dpr, sx, ox: (size.w - W * sx) / 2, oy: (size.h - base.h * sx) / 2 };
    setView(viewRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, base]);

  /* ── the view ── */
  const clampView = (v: View): View => {
    const f = frameRef.current;
    const kMax = base?.kMax ?? 16;
    const k = Math.max(1, Math.min(kMax, v.k));
    if (!f) return { k, x: 0, y: 0 };
    return { k, x: Math.min(0, Math.max(f.cssW - f.cssW * k, v.x)), y: Math.min(0, Math.max(f.cssH - f.cssH * k, v.y)) };
  };
  const setView = (v: View) => {
    const c = clampView(v);
    viewRef.current = c;
    moving();
    const next = { detail: c.k >= K_DETAIL - 1e-6, atMin: c.k <= 1 + 1e-6, atMax: c.k >= (base?.kMax ?? 16) - 1e-6 };
    setUi((u) => (u.detail === next.detail && u.atMin === next.atMin && u.atMax === next.atMax ? u : next));
    schedule();
  };
  const zoomAt = (factor: number, X: number, Y: number) => {
    const v = viewRef.current;
    const k = Math.max(1, Math.min(base?.kMax ?? 16, v.k * factor));
    setView({ k, x: X - (X - v.x) * (k / v.k), y: Y - (Y - v.y) * (k / v.k) });
  };
  const anim = useRef(0);
  const animateTo = (to: View, ms = 280) => {
    const from = viewRef.current;
    const goal = clampView(to);
    const t0 = performance.now();
    const id = ++anim.current;
    const step = (now: number) => {
      if (id !== anim.current) return;
      const t = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      setView({ k: from.k * Math.pow(goal.k / from.k, e), x: from.x + (goal.x - from.x) * e, y: from.y + (goal.y - from.y) * e });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const zoomCentre = (factor: number) => {
    const f = frameRef.current;
    if (!f) return;
    const v = viewRef.current;
    const k = Math.max(1, Math.min(base?.kMax ?? 16, v.k * factor));
    const X = f.cssW / 2, Y = f.cssH / 2;
    animateTo({ k, x: X - (X - v.x) * (k / v.k), y: Y - (Y - v.y) * (k / v.k) });
  };
  const flyTo = (bx: number, by: number, k: number) => {
    const f = frameRef.current;
    if (!f) return;
    animateTo({ k, x: f.cssW / 2 - (bx * f.sx + f.ox) * k, y: f.cssH / 2 - (by * f.sx + f.oy) * k }, 420);
  };
  /** far enough in that this postcode's area is about 70 px across */
  const kFor = (cell: number) => {
    const f = frameRef.current;
    if (!base || !f) return K_DETAIL * 2;
    const b = cell * 4;
    const side = Math.max(0.05, Math.min(base.cellBox[b + 2] - base.cellBox[b], base.cellBox[b + 3] - base.cellBox[b + 1]) || base.smallCell);
    return Math.max(K_DETAIL * 1.4, Math.min(base.kMax, 70 / (side * f.sx)));
  };

  /* ── colours per layer ── */
  const paintKey = useCallback((owner: string | null, t: number): FillKey | null => {
    if (!owner) return null;
    const p = palette(owner);
    return p.ring ? `${mix(p.color, t * 0.4)}|${mix(p.color, t)}` : mix(p.color, t);
  }, [palette]);

  const ownerRegionKeys = useMemo(() => {
    if (!base) return [];
    return m.tally.regions.map((rt) => {
      const [o1, n1] = rt.owners[0] ?? [null, 0];
      if (!o1) return null;
      if (hl) {
        if (o1 === hl) return paintKey(o1, STRONG);
        const mine = rt.owners.find(([o]) => o === hl);
        const dim = paintKey(o1, DIM);
        return mine && dim ? `${dim.split("|")[0]}|${mix(palette(hl).color, STRONG)}` : dim;
      }
      if (effLayer === "top") return paintKey(o1, 0.35);
      // paler where others hold part of it: all theirs = full strength, half = about two thirds
      return paintKey(o1, 0.25 + (STRONG - 0.25) * (n1 / Math.max(1, rt.total)));
    });
  }, [base, m.tally, hl, paintKey, palette, effLayer]);

  const ownerCellKeys = useMemo(() => {
    if (!base || !ui.detail) return null;
    return base.cells.map((pts) => {
      const o = String(m.picks[pts[0]]?.owner ?? "");
      if (!o) return null;
      if (effLayer === "top") return paintKey(o, 0.35);
      return paintKey(o, hl && hl !== o ? DIM : STRONG);
    });
  }, [base, ui.detail, m.picks, hl, paintKey, effLayer]);

  const valueLayer: ValueLayer | null = effLayer === "revenue" || effLayer === "customers" || effLayer === "newCustomers" || effLayer === "priority" || effLayer === "gdp" ? effLayer : null;
  /** the value layer: per region (zoomed out; GDP always) or per postcode area, with its class breaks */
  const values = useMemo(() => {
    if (!base || !joined || !valueLayer) return null;
    if (valueLayer === "gdp") {
      const v = joined.gdp;
      const t = breaks(v.map((x) => x ?? 0));
      return { unit: "region" as const, regionVals: v, cellVals: null, thresholds: t };
    }
    if (!ui.detail) {
      const v = joined.regions.map((s) => statValue(s, valueLayer, prio));
      return { unit: "region" as const, regionVals: v as (number | null)[], cellVals: null, thresholds: breaks(v) };
    }
    const v = joined.cells.map((s) => statValue(s, valueLayer, prio));
    return { unit: "postcode" as const, regionVals: null, cellVals: v, thresholds: breaks(v) };
  }, [base, joined, valueLayer, prio, ui.detail]);

  const valueKey = useCallback((v: number | null, thresholds: number[]): FillKey | null => {
    if (v === null) return UNKNOWN;
    const c = classOf(v, thresholds);
    if (!c) return null;
    const ramp = rampOf(thresholds.length + 1);
    return ramp[Math.min(ramp.length - 1, c - 1)];
  }, []);

  const regionKeys = useMemo<(FillKey | null)[]>(() => {
    if (!base) return [];
    if (values?.regionVals) return values.regionVals.map((v) => valueKey(v, values.thresholds));
    if (valueLayer) return base.regions.map(() => null);
    return ownerRegionKeys;
  }, [base, values, valueLayer, valueKey, ownerRegionKeys]);

  const isBrowser = typeof window !== "undefined" && typeof Path2D !== "undefined";
  const paths = useMemo<BasePaths | null>(() => (base && isBrowser ? basePaths(base) : null), [base, isBrowser]);
  const cellPaths = useMemo(() => {
    if (!base || !isBrowser || !ui.detail) return null;
    if (values?.cellVals) return cellGroups(base, values.cellVals.map((v) => valueKey(v, values.thresholds)));
    if (valueLayer) return null; // GDP: the regions
    return ownerCellKeys ? cellGroups(base, ownerCellKeys) : null;
  }, [base, isBrowser, ui.detail, values, valueLayer, valueKey, ownerCellKeys]);

  /** top customers: every one with a place, biggest first, sized by revenue */
  const markers = useMemo<Marker[] | null>(() => {
    if (!base || !joined || effLayer !== "top" || !joined.top.length) return null;
    const max = joined.top[0].revenue || 1;
    return joined.top.map((t, i) => ({ x: base.points[t.point].x, y: base.points[t.point].y, r: 3.5 + 9 * Math.sqrt(t.revenue / max), i }));
  }, [base, joined, effLayer]);
  const shownMarkers = (k: number) => (markers ? markers.slice(0, k < K_DETAIL ? 30 : k < 4 ? 100 : 400) : null);

  /* ── drawing ──
     The whole map is drawn into a snapshot (an offscreen canvas) and shown from there: while a pan or zoom goes on,
     the snapshot is only moved and scaled (10-20k postcode areas are not filled 60 times a second); 160 ms after the
     last move it is drawn again, sharp. The hovered and picked outlines go over the snapshot, so a hover never
     redraws the map. */
  const focusOf = (t: Target | null) => (!t ? null : t.kind === "cell" ? { cell: t.cell } : t.kind === "region" ? { region: t.region } : null);
  const snapRef = useRef<{ cv: HTMLCanvasElement; view: View; deps: unknown[] } | null>(null);
  const busyUntil = useRef(0);
  const settle = useRef(0);
  function moving() {
    busyUntil.current = performance.now() + 160;
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(schedule, 180);
  }
  useEffect(() => () => window.clearTimeout(settle.current), []);
  drawRef.current = () => {
    const cv = canvasRef.current, f = frameRef.current;
    if (!cv || !f || !base || !paths) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const v = viewRef.current;
    const tier = v.k < K_DETAIL ? 0 : v.k < 4 ? 1 : 2;
    const scene: Scene = {
      base, paths, frame: f, view: v, regionKeys, cells: cellPaths,
      hover: focusOf(hover), pinned: focusOf(pinned),
      regionLabel: (i) => base.regions[i].name,
      markers: shownMarkers(v.k), hoverMarker: hover?.kind === "marker" ? hover.i : pinned?.kind === "marker" ? pinned.i : null,
    };
    const deps: unknown[] = [base, paths, regionKeys, cellPaths, markers, tier, cv.width, cv.height, f.sx];
    let snap = snapRef.current;
    const fresh = !!snap && deps.every((x, i) => x === snap!.deps[i]);
    const still = !!snap && snap.view.k === v.k && snap.view.x === v.x && snap.view.y === v.y;
    if (!snap || !fresh || (!still && performance.now() >= busyUntil.current)) {
      const off = snap?.cv ?? document.createElement("canvas");
      if (off.width !== cv.width || off.height !== cv.height) { off.width = cv.width; off.height = cv.height; }
      const octx = off.getContext("2d");
      if (!octx) return;
      drawBase(octx, scene);
      snap = snapRef.current = { cv: off, view: { ...v }, deps };
    }
    // the snapshot, moved and scaled from the view it was drawn at to this one
    const s = v.k / snap.view.k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(snap.cv, (v.x - snap.view.x * s) * f.dpr, (v.y - snap.view.y * s) * f.dpr, cv.width * s, cv.height * s);
    drawFocus(ctx, scene);
  };
  useEffect(() => { schedule(); });

  /* ── pointer ── */
  const hitAt = (X: number, Y: number): Target | null => {
    const f = frameRef.current;
    if (!base || !f) return null;
    const v = viewRef.current;
    const mk = shownMarkers(v.k);
    if (mk) {
      let best: Marker | null = null, bestD = Infinity;
      for (const m2 of mk) {
        const [mx, my] = toScreen(f, v, m2.x, m2.y);
        const dd = Math.hypot(mx - X, my - Y);
        if (dd <= m2.r + 4 && dd < bestD) { bestD = dd; best = m2; }
      }
      if (best) return { kind: "marker", i: best.i, X, Y };
    }
    const [bx, by] = toBase(f, v, X, Y);
    if (v.k >= K_DETAIL && base.delaunay) {
      const c = cellAt(base, bx, by);
      if (c === null) return null;
      const point = base.cells[c][0];
      return { kind: "cell", cell: c, point, region: base.points[point].region, X, Y };
    }
    const r = regionAt(base.regions, bx, by);
    return r >= 0 ? { kind: "region", region: r, X, Y } : null;
  };
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ sx: number; sy: number; x0: number; y0: number; moved: boolean; pinch?: { d0: number; k0: number; bx: number; by: number } } | null>(null);
  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
  };
  const hoverRaf = useRef(0);
  const lastMove = useRef<{ x: number; y: number } | null>(null);
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = local(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (g && pointers.current.size >= 2 && g.pinch) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const f = frameRef.current;
      if (!f) return;
      const k = Math.max(1, Math.min(base?.kMax ?? 16, g.pinch.k0 * (dist / g.pinch.d0)));
      g.moved = true;
      setView({ k, x: mx - (g.pinch.bx * f.sx + f.ox) * k, y: my - (g.pinch.by * f.sx + f.oy) * k });
      return;
    }
    if (g && pointers.current.size === 1) {
      const dx = p.x - g.sx, dy = p.y - g.sy;
      if (!g.moved && Math.abs(dx) + Math.abs(dy) > 4) g.moved = true;
      if (g.moved) { anim.current++; setView({ ...viewRef.current, x: g.x0 + dx, y: g.y0 + dy }); setHover(null); }
      return;
    }
    if (e.pointerType !== "mouse") return;
    lastMove.current = p;
    if (hoverRaf.current) return;
    hoverRaf.current = requestAnimationFrame(() => {
      hoverRaf.current = 0;
      const q = lastMove.current;
      if (!q) return;
      const t = hitAt(q.x, q.y);
      setHover((h) => (sameTarget(h, t) ? (h && t ? { ...h, X: t.X, Y: t.Y } : h) : t));
    });
  };
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    const v = viewRef.current;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const f = frameRef.current;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const [bx, by] = f ? toBase(f, v, mx, my) : [0, 0];
      gesture.current = { sx: mx, sy: my, x0: v.x, y0: v.y, moved: true, pinch: { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: v.k, bx, by } };
    } else gesture.current = { sx: p.x, sy: p.y, x0: v.x, y0: v.y, moved: false };
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current;
    const p = local(e);
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1 && g?.pinch) {
      // one finger stays after a pinch: it pans from here
      const [q] = [...pointers.current.values()];
      gesture.current = { sx: q.x, sy: q.y, x0: viewRef.current.x, y0: viewRef.current.y, moved: true };
      return;
    }
    if (pointers.current.size) return;
    gesture.current = null;
    if (!g || g.moved) return;
    const t = hitAt(p.x, p.y);
    setPinned((cur) => (sameTarget(cur, t) ? null : t));
    setNote(null);
  };
  const onPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => { pointers.current.delete(e.pointerId); if (!pointers.current.size) gesture.current = null; };

  // the wheel zooms (passive: false - the page must not scroll under the map); zoomed all the way out, a wheel
  // downwards scrolls the page as usual
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const onWheel = (e: WheelEvent) => {
      const out = e.deltaY > 0;
      if (out && viewRef.current.k <= 1 + 1e-6 && !e.ctrlKey) return;
      e.preventDefault();
      anim.current++;
      setHover(null);
      const r = cv.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : e.ctrlKey ? 0.01 : 0.0022;
      zoomAt(Math.exp(-e.deltaY * unit), e.clientX - r.left, e.clientY - r.top);
    };
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => cv.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, size]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const v = viewRef.current;
    if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomCentre(1.6); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomCentre(1 / 1.6); }
    else if (e.key === "0") { e.preventDefault(); animateTo({ k: 1, x: 0, y: 0 }); }
    else if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const s = 80;
      setView({ ...v, x: v.x + (e.key === "ArrowLeft" ? s : e.key === "ArrowRight" ? -s : 0), y: v.y + (e.key === "ArrowUp" ? s : e.key === "ArrowDown" ? -s : 0) });
    } else if (e.key === "Escape") setPinned(null);
  };

  /* ── search ── */
  const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const find = (q: string) => {
    if (!base) return;
    const s = q.trim();
    if (!s) return;
    const z = cleanZip(s);
    let i = base.byClean.get(z);
    if (i === undefined && z.length >= 2 && /\d/.test(z)) i = base.points.findIndex((p) => p.clean.startsWith(z));
    if (i === undefined || i < 0) { const n = fold(s); i = base.points.findIndex((p) => !!p.place && fold(p.place).startsWith(n)); }
    if (i === undefined || i < 0) { setMiss(true); return; }
    setMiss(false);
    const p = base.points[i];
    const k = kFor(p.cell);
    flyTo(p.x, p.y, k);
    const f = frameRef.current;
    setPinned({ kind: "cell", cell: p.cell, point: base.cells[p.cell][0], region: p.region, X: f ? f.cssW / 2 : 0, Y: f ? f.cssH / 2 : 0 });
    setNote(null);
  };

  /* ── giving ── */
  const filePoints = useMemo(() => (base ? base.points.map((p) => ({ clean: p.clean, region: p.region >= 0 ? base.regions[p.region].code : null })) : []), [base]);
  const give = (change: MapChange, owner: string, what: string) => {
    if (!onAssign || !base || !owner) return;
    const prev = rules.countries[cc];
    const res = assignOnMap(prev, cc, String(rules.defaultOwner), filePoints, change, owner, () => newId("zone"));
    if (!res.ok) { setNote({ text: res.error, bad: true }); return; }
    if (!res.changed) { setNote({ text: `${what} goes to ${names.name(owner)} already.` }); return; }
    const bytes = bodyBytes({ patch: { countries: { [cc]: res.rule } } });
    if (bytes > MAX_BODY) {
      setNote({ bad: true, text: `Not changed: the rules of ${countryName(cc)} would be ${(bytes / 1024).toFixed(1)} KB, and the hub saves at most 8 KB in one go. Fewer, broader zones on Rules make room.` });
      return;
    }
    const keys = change.kind === "postcodes" ? change.zips : change.regions;
    onAssign(cc, { kind: change.kind, keys, owner, rule: res.rule, text: `${what} to ${names.name(owner)}` });
    setNote({
      text: `${what} now goes to ${names.name(owner)} - in your edits, Save keeps it.`,
      undo: { rule: prev ?? { country: cc, source: "sae", zones: [], defaultOwner: null, keyAccounts: [] }, text: what },
    });
  };
  const undo = () => {
    if (!note?.undo || !onAssign) return;
    onAssign(cc, { kind: "postcodes", keys: [], owner: "", rule: note.undo.rule, text: `undo: ${note.undo.text}` });
    setNote({ text: `${note.undo.text}: back as it was.` });
  };

  /* ── what the hover and the card say ── */
  const regionName = (i: number) => (base && i >= 0 ? base.regions[i].name : "");
  const why = (p: Decided | undefined, region: number) => {
    if (!p) return "";
    if (p.via === "prefix") return `postcode zone ${p.token}${rule?.zones[p.zone]?.label ? ` (${rule.zones[p.zone].label})` : ""}`;
    if (p.via === "region") return `the zone holds ${regionName(region) || "its region"}`;
    return p.countryDefault ? `no zone here - ${countryName(cc)}'s own person` : `no zone here - ${names.name(rules.defaultOwner)} takes what no rule places`;
  };
  const cellStat = (cell: number): PostcodeStat | null => joined?.cells[cell] ?? null;
  const statLine = (s: PostcodeStat | null): string | null => {
    if (!joined) return null;
    if (!s || !s.companies) return "No companies here";
    const parts = [`${full(s.companies)} ${s.companies === 1 ? "company" : "companies"}`, `${full(s.customers)} ordered this year`];
    if (s.newCustomers) parts.push(`${full(s.newCustomers)} new`);
    if (s.revenue) parts.push(`revenue ${short(s.revenue)}`);
    return parts.join(" · ");
  };
  const layerValue = (t: Target): string | null => {
    if (!joined || !valueLayer) return null;
    const lab = valueLayer === "revenue" ? "Revenue" : valueLayer === "customers" ? "Customers" : valueLayer === "newCustomers" ? "New customers" : valueLayer === "priority" ? `${prio} companies` : "GDP";
    if (valueLayer === "gdp") {
      const r = t.kind === "cell" ? t.region : t.kind === "region" ? t.region : -1;
      return r >= 0 ? `GDP ${gdpText(joined.gdp[r])}` : null;
    }
    const s = t.kind === "cell" ? cellStat(t.cell) : t.kind === "region" ? joined.regions[t.region] : null;
    const v = statValue(s, valueLayer, prio);
    return `${lab} ${valueLayer === "revenue" ? short(v) : full(v)}`;
  };

  const people = useMemo(() => {
    const s = new Set<string>([...m.tally.byOwner.keys()].filter(Boolean));
    for (const b of summary?.byOwner ?? []) if (b.owner) s.add(String(b.owner));
    return [...s].map((o) => ({
      owner: o, postcodes: m.tally.byOwner.get(o)?.postcodes ?? 0, km2: m.tally.byOwner.get(o)?.km2 ?? 0,
      companies: summary?.byOwner.find((b) => String(b.owner) === o)?.companies ?? 0,
    })).sort((a, b) => b.postcodes - a.postcodes || b.companies - a.companies || names.name(a.owner).localeCompare(names.name(b.owner)));
  }, [m.tally, summary, names]);

  /* ── render ── */
  const layerOptions: PillDef<LayerKey>[] = LAYERS.map((l) => {
    if (l.key === "owners") return { key: l.key, label: l.label };
    const hint = layers.loading ? "Reading the companies per postcode…"
      : !joined ? `No company figures for ${countryName(cc)} yet - they come with the engine's scans`
      : l.key === "gdp" && !hasGdp ? `No GDP figures for ${countryName(cc)} yet`
      : l.key === "top" && !joined.top.length ? `No customer with revenue in ${countryName(cc)} yet` : undefined;
    return { key: l.key, label: l.label, disabled: !!hint, hint };
  });

  const shown = hover ?? null;
  const boxW = size?.w ?? 600;

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
    const card = pinned ? (
      <PickCard key={`${pinned.kind}-${pinned.kind === "cell" ? pinned.cell : pinned.kind === "region" ? pinned.region : pinned.i}`}
        target={pinned} base={base} m={m} joined={joined} names={names} palette={palette} cc={cc} canGive={canGive}
        why={why} statLine={statLine} cellStat={cellStat} people={rule?.people}
        onClose={() => setPinned(null)}
        onGive={give}
        onRegion={(region) => { setPinned({ kind: "region", region, X: pinned.X, Y: pinned.Y }); }}
        onFly={(pt) => { const p = base.points[pt]; flyTo(p.x, p.y, kFor(p.cell)); }}
        decided={(pt) => m.picks[pt]} />
    ) : null;
    mapBody = (
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 1.25 }}>
          <PillGroup<LayerKey> name="Map layers" small value={effLayer} onChange={(k) => { setLayer(k); setPinned(null); }} options={layerOptions} />
          {effLayer === "priority" && (
            <PillGroup<Priority> name="Sales priority" small value={prio} onChange={setPrio}
              options={PRIORITIES.map((p) => ({ key: p, label: p, count: joined ? full(joined.total.priority[p] ?? 0) : null }))} />
          )}
          <Box sx={{ flex: 1 }} />
          <TextField size="small" value={query} placeholder="Find a postcode or place" error={miss}
            onChange={(e) => { setQuery(e.target.value); setMiss(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); find(query); } }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: FAINT }} /></InputAdornment> }, htmlInput: { "aria-label": "Find a postcode or place" } }}
            helperText={miss ? `No postcode or place "${query.trim()}" in ${countryName(cc)}` : undefined}
            sx={{ width: { xs: "100%", sm: 240 }, "& .MuiInputBase-root": { borderRadius: "12px", bgcolor: "rgba(255,255,255,.85)", fontSize: "0.85rem" }, "& .MuiInputBase-input": { py: 0.75 } }} />
        </Box>
        <Box ref={boxRef} sx={{ position: "relative", width: "100%", borderRadius: "14px", overflow: "hidden", bgcolor: "#f7f8fa", border: `1px solid ${HAIRLINE}` }}>
          <Box component="canvas" ref={canvasRef} tabIndex={0} role="img"
            aria-label={`Map of ${countryName(cc)}: ${full(base.regions.length)} regions and ${full(base.points.length)} postcodes coloured ${effLayer === "owners" || effLayer === "top" ? "by person" : `by ${LAYERS.find((l) => l.key === effLayer)?.label.toLowerCase()}`}. Plus and minus zoom, arrows move, Escape closes the card.`}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
            onPointerLeave={() => setHover(null)} onKeyDown={onKeyDown}
            sx={{
              display: "block", width: "100%", height: size ? `${size.h}px` : "auto", aspectRatio: size ? undefined : `${W} / ${base.h}`,
              maxHeight: compact ? 520 : 760, touchAction: ui.atMin ? "pan-y" : "none", cursor: hover ? "pointer" : ui.atMin ? "default" : "grab",
              outline: "none", "&:focus-visible": { boxShadow: "inset 0 0 0 2px #2459d1" },
            }} />
          {/* the level: zoomed out regions, zoomed in postcodes; and the zoom buttons - over the map from a tablet up,
              under it on a phone (they would hide a quarter of it) */}
          <Box sx={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 1, pointerEvents: "none", "& > *": { pointerEvents: "auto" },
            position: { xs: "static", sm: "absolute" }, left: 8, right: 8, bottom: 8, p: { xs: 0.75, sm: 0 }, borderTop: { xs: `1px solid ${HAIRLINE}`, sm: "none" },
          }}>
          <Box>
            <PillGroup<"regions" | "postcodes"> name="Map level" small value={ui.detail ? "postcodes" : "regions"}
              onChange={(k) => {
                if (k === "regions") animateTo({ k: 1, x: 0, y: 0 });
                else zoomCentre(Math.max(K_DETAIL * 1.25, viewRef.current.k) / viewRef.current.k);
              }}
              options={[{ key: "regions", label: "Regions" }, { key: "postcodes", label: "Postcodes" }]} />
          </Box>
          <Box sx={{ display: "flex", flexDirection: { xs: "row", sm: "column" }, gap: 0.25, bgcolor: "rgba(255,255,255,.94)", border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 0.35, boxShadow: "0 1px 3px rgba(31,45,78,.08)" }}>
            <Tooltip title="Zoom in" placement="left"><span><IconButton size="small" onClick={() => zoomCentre(1.7)} disabled={ui.atMax} aria-label="Zoom in"><AddIcon sx={{ fontSize: 18 }} /></IconButton></span></Tooltip>
            <Tooltip title="Zoom out" placement="left"><span><IconButton size="small" onClick={() => zoomCentre(1 / 1.7)} disabled={ui.atMin} aria-label="Zoom out"><RemoveIcon sx={{ fontSize: 18 }} /></IconButton></span></Tooltip>
            <Tooltip title="Whole country" placement="left"><span><IconButton size="small" onClick={() => animateTo({ k: 1, x: 0, y: 0 })} disabled={ui.atMin} aria-label="Whole country"><CenterFocusStrongOutlinedIcon sx={{ fontSize: 18 }} /></IconButton></span></Tooltip>
          </Box>
          </Box>
          {card && (
            <Box sx={{
              position: "absolute", top: 8, zIndex: 3, width: { xs: "calc(100% - 16px)", sm: 320 }, maxHeight: "calc(100% - 64px)", overflowY: "auto",
              ...(pinned && pinned.X < boxW / 2 ? { right: 8 } : { left: 8 }),
            }}>{card}</Box>
          )}
          {shown && !(pinned && sameTarget(pinned, shown)) && (
            <HoverTip t={shown} base={base} m={m} names={names} palette={palette} joined={joined} layerValue={layerValue} boxW={boxW} />
          )}
        </Box>
        {note && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1, flexWrap: "wrap" }}>
            <Chip tint={note.bad ? "amber" : "blue"}>{note.text}</Chip>
            {note.undo && canGive && <Button size="small" onClick={undo} sx={{ textTransform: "none", fontWeight: 600, minWidth: 0, py: 0.25 }}>Undo</Button>}
          </Box>
        )}
        <Typography sx={{ fontSize: "0.74rem", color: FAINT, mt: 0.75 }}>
          Scroll or pinch to zoom, drag to move. Zoomed out, each region takes the colour of the person with most of its postcodes - paler where others hold part of it; zoomed in, every postcode shows its own area. Click a postcode or a region to see {canGive ? "it and give it to someone" : "who has it and why"}.
        </Typography>
      </Box>
    );
  }

  const legend = base ? (
    <Legend layer={effLayer} people={people} names={names} palette={palette} hl={hl} setHl={setHl} m={m} base={base} joined={joined} values={values}
      prio={prio} rampOf={rampOf} cc={cc} compact={compact} rule={rule} layersAt={layers.data?.at ?? null} revenueField={layers.data?.revenueField ?? null}
      onTop={(t) => { const p = base.points[t.point]; flyTo(p.x, p.y, kFor(p.cell)); setPinned({ kind: "marker", i: joined?.top.indexOf(t) ?? -1, X: 0, Y: 0 }); }} />
  ) : null;

  return (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: compact ? "minmax(0, 1fr)" : { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 320px" }, gridTemplateRows: "auto", alignItems: "start" }}>
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

/* ── the hover ── */

function HoverTip({ t, base, m, names, palette, joined, layerValue, boxW }: {
  t: Target; base: MapBase; m: CountryMap; names: Names; palette: Palette; joined: Joined | null; layerValue: (t: Target) => string | null; boxW: number;
}) {
  let title = "", sub = "", owner: string | null = null, line: string | null = null;
  if (t.kind === "cell") {
    const pts = base.cells[t.cell];
    const p = base.points[pts[0]];
    title = `${p.zip}${p.place ? ` ${p.place}` : ""}${pts.length > 1 ? ` +${pts.length - 1}` : ""}`;
    sub = t.region >= 0 ? base.regions[t.region].name : "";
    owner = String(m.picks[pts[0]]?.owner ?? "") || null;
  } else if (t.kind === "region") {
    const r = base.regions[t.region];
    const rt = m.tally.regions[t.region];
    title = r.name;
    sub = `${full(rt?.total ?? 0)} postcodes · ${km2Text(r.km2)}`;
    owner = rt?.owners[0]?.[0] ?? null;
    if (owner && rt && rt.owners.length > 1) line = `${Math.round((100 * rt.owners[0][1]) / Math.max(1, rt.total))}% of its postcodes`;
  } else if (joined) {
    const c = joined.top[t.i];
    if (c) {
      const p = base.points[c.point];
      title = c.name; sub = `${p.zip}${p.place ? ` ${p.place}` : ""} · revenue ${short(c.revenue)}`;
      owner = c.owner; line = "owner now in HubSpot";
    }
  }
  const value = layerValue(t);
  const left = Math.max(4, Math.min(t.X + 14, boxW - 264));
  return (
    <Box sx={{
      position: "absolute", pointerEvents: "none", zIndex: 4, left, top: Math.max(4, t.Y + 14), maxWidth: 260,
      bgcolor: "rgba(255,255,255,.97)", border: `1px solid ${HAIRLINE}`, borderRadius: "12px", px: 1.25, py: 0.9, boxShadow: "0 6px 20px rgba(31,45,78,.12)",
    }}>
      <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{title}</Typography>
      {sub && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{sub}</Typography>}
      {owner && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5 }}>
          <Swatch paint={palette(owner)} />
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK }}>{names.name(owner)}</Typography>
          {line && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{line}</Typography>}
        </Box>
      )}
      {value && <Typography sx={{ fontSize: "0.78rem", color: INK, mt: 0.4, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>}
    </Box>
  );
}

/* ── the card of what was clicked ── */

function GiveRow({ names, label, onGive, people }: { names: Names; label: string; onGive: (owner: string) => void; people?: string[] }) {
  const [who, setWho] = useState<string>("");
  const known = (people ?? []).map(String).filter((p) => names.active(p));
  return (
    <Box sx={{ mt: 1.25, pt: 1.25, borderTop: `1px solid ${HAIRLINE}`, display: "grid", gap: 0.75 }}>
      <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</Typography>
      {known.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {known.map((p) => (
            <Box key={p} component="button" type="button" onClick={() => setWho(p)} aria-pressed={who === p}
              sx={{ all: "unset", cursor: "pointer", px: 1, py: 0.35, borderRadius: "999px", fontSize: "0.76rem", fontWeight: 600, border: `1px solid ${who === p ? "#2459d1" : HAIRLINE}`, color: who === p ? "#2459d1" : MUTED, bgcolor: who === p ? "rgba(36,89,209,.08)" : "#fff", "&:focus-visible": { outline: "2px solid #2459d1" } }}>
              {names.name(p)}
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
        <OwnerPicker value={who || null} onChange={(v) => setWho(String(v ?? ""))} names={names} placeholder="pick a person" sx={{ flex: 1, minWidth: 0 }} />
        <Button variant="contained" size="small" disabled={!who} onClick={() => onGive(who)} disableElevation sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px", flexShrink: 0 }}>Give</Button>
      </Box>
    </Box>
  );
}

function PickCard({ target, base, m, joined, names, palette, cc, canGive, why, statLine, cellStat, people, onClose, onGive, onRegion, onFly, decided }: {
  target: Target; base: MapBase; m: CountryMap; joined: Joined | null; names: Names; palette: Palette; cc: string; canGive: boolean;
  why: (p: Decided | undefined, region: number) => string; statLine: (s: PostcodeStat | null) => string | null; cellStat: (cell: number) => PostcodeStat | null;
  people?: string[]; onClose: () => void; onGive: (change: MapChange, owner: string, what: string) => void; onRegion: (region: number) => void;
  onFly: (point: number) => void; decided: (point: number) => Decided | undefined;
}) {
  const head = (title: string, sub: string) => (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{title}</Typography>
        {sub && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{sub}</Typography>}
      </Box>
      <IconButton size="small" onClick={onClose} aria-label="Close" sx={{ mt: -0.5, mr: -0.5 }}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
    </Box>
  );
  const personLine = (owner: string | null, how?: string) => owner ? (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Swatch paint={palette(owner)} size={14} />
        <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK }}>{names.name(owner)}</Typography>
      </Box>
      {how && <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.25 }}>Why: {how}</Typography>}
    </Box>
  ) : null;
  let body: React.ReactNode = null;
  if (target.kind === "cell") {
    const pts = base.cells[target.cell];
    const p = base.points[pts[0]];
    const d = decided(pts[0]);
    const region = target.region >= 0 ? base.regions[target.region] : null;
    const owners = new Set(pts.map((i) => String(decided(i)?.owner ?? "")));
    const what = pts.length > 1 ? `${p.zip} and ${pts.length - 1} more` : `${p.zip}${p.place ? ` ${p.place}` : ""}`;
    body = (
      <>
        {head(`${p.zip}${p.place ? ` ${p.place}` : ""}`, [region?.name, km2Text(pts.reduce((s, i) => s + base.points[i].km2, 0))].filter(Boolean).join(" · "))}
        {personLine(d ? String(d.owner) : null, why(d, target.region))}
        {pts.length > 1 && (
          <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.75 }}>
            Same spot: {pts.slice(1, 9).map((i) => base.points[i].zip).join(", ")}{pts.length > 9 ? ` and ${pts.length - 9} more` : ""}{owners.size > 1 ? " - not all with the same person" : ""}
          </Typography>
        )}
        {joined && <Typography sx={{ fontSize: "0.78rem", color: INK, mt: 0.75 }}>{statLine(cellStat(target.cell))}</Typography>}
        {canGive && (
          <>
            <GiveRow names={names} people={people} label={pts.length > 1 ? `Give these ${pts.length} postcodes to` : `Give ${p.zip} to`}
              onGive={(o) => onGive({ kind: "postcodes", zips: pts.map((i) => base.points[i].zip) }, o, what)} />
            {region && (
              <Box component="button" type="button" onClick={() => onRegion(target.region)}
                sx={{ all: "unset", cursor: "pointer", mt: 1, fontSize: "0.78rem", fontWeight: 600, color: "#2459d1", "&:focus-visible": { outline: "2px solid #2459d1" } }}>
                Or all of {region.name} →
              </Box>
            )}
          </>
        )}
      </>
    );
  } else if (target.kind === "region") {
    const r = base.regions[target.region];
    const rt = m.tally.regions[target.region];
    const group = r.group ? base.regions.map((x, i) => ({ x, i })).filter(({ x }) => x.group === r.group) : [];
    body = (
      <>
        {head(r.name, [r.code, km2Text(r.km2), `${full(rt?.total ?? 0)} postcodes`].join(" · "))}
        <Box sx={{ mt: 1, display: "grid", gap: 0.4 }}>
          {(rt?.owners ?? []).slice(0, 4).map(([o, n]) => (
            <Box key={o} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Swatch paint={palette(o)} />
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{names.name(o)}</Typography>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{full(n)} · {Math.round((100 * n) / Math.max(1, rt.total))}%</Typography>
            </Box>
          ))}
          {(rt?.owners.length ?? 0) > 4 && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>and {rt.owners.length - 4} more people</Typography>}
          {!rt?.total && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>No postcode of the file lies here.</Typography>}
        </Box>
        {joined && <Typography sx={{ fontSize: "0.78rem", color: INK, mt: 0.75 }}>{statLine(joined.regions[target.region])}</Typography>}
        {canGive && (
          <>
            <GiveRow names={names} people={people} label={`Give all of ${r.name} to`} onGive={(o) => onGive({ kind: "regions", regions: [r.code] }, o, `All of ${r.name}`)} />
            {group.length > 1 && (
              <GiveRow names={names} people={people} label={`Or all of ${r.group} (${group.length} regions) to`}
                onGive={(o) => onGive({ kind: "regions", regions: group.map(({ x }) => x.code) }, o, `All of ${r.group}`)} />
            )}
          </>
        )}
      </>
    );
  } else if (joined) {
    const c = joined.top[target.i];
    if (c) {
      const p = base.points[c.point];
      const d = decided(c.point);
      body = (
        <>
          {head(c.name, `${p.zip}${p.place ? ` ${p.place}` : ""} · revenue ${short(c.revenue)}`)}
          <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 1 }}>Owner now in HubSpot</Typography>
          {personLine(c.owner)}
          {d && String(d.owner) !== String(c.owner ?? "") && (
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.75 }}>Its postcode goes to {names.name(String(d.owner))} by the rules on screen ({why(d, p.region)}); a key account or the SAE can still decide otherwise.</Typography>
          )}
          <Box sx={{ display: "flex", gap: 1.5, mt: 1 }}>
            <Box component="a" href={hsCompany(c.id)} target="_blank" rel="noreferrer" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.8rem", fontWeight: 600, color: "#2459d1", textDecoration: "none" }}>
              HubSpot <OpenInNewIcon sx={{ fontSize: 14 }} />
            </Box>
            <Box component="button" type="button" onClick={() => onFly(c.point)} sx={{ all: "unset", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: "#2459d1" }}>Zoom to it</Box>
          </Box>
        </>
      );
    }
  }
  if (!body) return null;
  return (
    <Box role="dialog" aria-label="Picked on the map" data-cc={cc}
      sx={{ bgcolor: "rgba(255,255,255,.98)", border: `1px solid ${HAIRLINE}`, borderRadius: "14px", p: 1.5, boxShadow: "0 10px 30px rgba(31,45,78,.16)" }}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      {body}
    </Box>
  );
}

/* ── the legend ── */

const layerTitle: Record<LayerKey, string> = {
  owners: "Who has what", revenue: "Revenue this year", customers: "Customers this year", newCustomers: "New customers this year",
  priority: "Sales priority", gdp: "GDP per region", top: "Top customers",
};

function Legend({ layer, people, names, palette, hl, setHl, m, base, joined, values, prio, rampOf, cc, compact, rule, layersAt, revenueField, onTop }: {
  layer: LayerKey; people: { owner: string; postcodes: number; km2: number; companies: number }[]; names: Names; palette: Palette;
  hl: string | null; setHl: (o: string | null) => void; m: CountryMap; base: MapBase; joined: Joined | null;
  values: { unit: "region" | "postcode"; thresholds: number[] } | null; prio: Priority; rampOf: (n: number) => string[]; cc: string; compact: boolean;
  rule: CountryRule | undefined; layersAt: string | null; revenueField: string | null; onTop: (t: Joined["top"][number]) => void;
}) {
  const kicker = (text: string, right?: React.ReactNode) => (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1 }}>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>{text}</Typography>
      {right}
    </Box>
  );
  const asOf = layersAt ? ` As of the scan of ${new Date(layersAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.` : "";
  const unplaced = joined && joined.unplaced ? ` ${full(joined.unplaced)} companies are not on the map (no postcode the map knows).` : "";

  if (layer === "owners" || (layer === "top" && !joined)) {
    const tot = people.reduce((s, p) => ({ postcodes: s.postcodes + p.postcodes, km2: s.km2 + p.km2, companies: s.companies + p.companies }), { postcodes: 0, km2: 0, companies: 0 });
    const cols = { xs: "12px minmax(64px, 1fr) 48px 54px 58px", sm: "14px minmax(0, 1fr) 54px 62px 74px" };
    const num = { fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums", textAlign: "right" as const, whiteSpace: "nowrap" as const };
    return (
      <Box sx={{ display: "grid", gap: 0.5, alignContent: "start", minWidth: 0 }}>
        {kicker(layerTitle.owners, hl ? <Box component="button" type="button" onClick={() => setHl(null)} sx={{ all: "unset", cursor: "pointer", fontSize: "0.74rem", color: "#2459d1", fontWeight: 600 }}>Show everyone</Box> : undefined)}
        <Box sx={{ display: "grid", gridTemplateColumns: cols, gap: 1, px: 1, alignItems: "end" }}>
          <span />
          {["Person", "Postcodes", "Companies", "km²"].map((h, i) => (
            <Typography key={h} sx={{ fontSize: { xs: "0.6rem", sm: "0.68rem" }, color: FAINT, fontWeight: 600, textAlign: i ? "right" : "left", whiteSpace: "nowrap" }}>{h}</Typography>
          ))}
        </Box>
        {people.length === 0 && <Typography sx={{ fontSize: "0.8rem", color: MUTED, px: 1 }}>Nobody yet.</Typography>}
        <Box sx={{ display: "grid", gap: 0.25 }}>
          {people.map((p) => {
            const on = hl === p.owner;
            return (
              <Box key={p.owner} component="button" type="button" onClick={() => setHl(on ? null : p.owner)} aria-pressed={on}
                sx={{
                  all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: cols, gap: 1, alignItems: "center", px: 1, py: 0.6, borderRadius: "10px", minHeight: 30,
                  bgcolor: on ? "rgba(36,89,209,.08)" : "transparent", opacity: hl && !on ? 0.55 : 1,
                  "&:hover": { bgcolor: on ? "rgba(36,89,209,.12)" : "rgba(21,34,58,.04)" }, "&:focus-visible": { outline: "2px solid #2459d1" },
                }}>
                <Swatch paint={palette(p.owner)} size={14} />
                <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{names.name(p.owner)}</Typography>
                <Typography sx={num}>{full(p.postcodes)}</Typography>
                <Typography sx={num}>{full(p.companies)}</Typography>
                <Typography sx={num}>{p.km2 > 0 && p.km2 < 10 ? p.km2.toFixed(1) : full(p.km2)}</Typography>
              </Box>
            );
          })}
        </Box>
        {people.length > 1 && (
          <Box sx={{ display: "grid", gridTemplateColumns: cols, gap: 1, px: 1, pt: 0.5, borderTop: `1px solid ${HAIRLINE}` }}>
            <span />
            <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: MUTED }}>{countryName(cc)}</Typography>
            <Typography sx={num}>{full(tot.postcodes)}</Typography>
            <Typography sx={num}>{full(tot.companies)}</Typography>
            <Typography sx={num}>{full(base.km2 ?? tot.km2)}</Typography>
          </Box>
        )}
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.75, lineHeight: 1.45 }}>
          Postcodes and km²: how many postcodes and how much land each person gets by the rules on screen{m.moved !== null ? ", your edits included" : ""}. Companies: how many companies each one got at the last scan, by the saved rules{rule?.source === "sae" || !rule ? " (the Performis SAE first, the zones for the rest)" : ""}. Click a person to pick out their land.
        </Typography>
      </Box>
    );
  }

  if (layer === "top" && joined) {
    return (
      <Box sx={{ display: "grid", gap: 0.5, alignContent: "start", minWidth: 0 }}>
        {kicker(layerTitle.top)}
        <Box sx={{ display: "grid", gap: 0.25 }}>
          {joined.top.slice(0, compact ? 8 : 12).map((t, i) => {
            const p = base.points[t.point];
            return (
              <Box key={`${t.id}-${i}`} component="button" type="button" onClick={() => onTop(t)}
                sx={{ all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) auto", gap: 1, alignItems: "center", px: 1, py: 0.55, borderRadius: "10px", "&:hover": { bgcolor: "rgba(21,34,58,.04)" }, "&:focus-visible": { outline: "2px solid #2459d1" } }}>
                <Typography sx={{ fontSize: "0.74rem", color: FAINT, fontVariantNumeric: "tabular-nums" }}>{i + 1}</Typography>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</Typography>
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.zip}{p.place ? ` ${p.place}` : ""} · {t.owner ? names.name(t.owner) : "no owner"}</Typography>
                </Box>
                <Typography sx={{ fontSize: "0.8rem", color: INK, fontVariantNumeric: "tabular-nums" }}>{short(t.revenue)}</Typography>
              </Box>
            );
          })}
        </Box>
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.75, lineHeight: 1.45 }}>
          The biggest customers by revenue this year, a dot each (bigger = more revenue; zoom in for more of them), on the land of each person in pale colours. Owner = the company owner in HubSpot today.{unplaced}{asOf}
        </Typography>
      </Box>
    );
  }

  // a value layer
  const t = values?.thresholds ?? [];
  const ramp = rampOf(t.length + 1);
  const fmt = (v: number) => (layer === "gdp" ? gdpText(v) : layer === "revenue" ? short(v) : full(v));
  const rows = ramp.map((c, i) => {
    const lo = i === 0 ? null : t[i - 1], hi = i < t.length ? t[i] : null;
    const label = lo === null && hi === null ? "more than 0" : lo === null ? `under ${fmt(hi!)}` : hi === null ? `${fmt(lo)} or more` : `${fmt(lo)} to under ${fmt(hi)}`;
    return { c, label };
  });
  const per = values?.unit === "postcode" ? "per postcode" : "per region";
  const what: Record<string, string> = {
    revenue: `Revenue this year${revenueField ? ` (${revenueField})` : ""} of the companies ${per === "per postcode" ? "at each postcode" : "in each region"}.`,
    customers: `Companies that ordered this year, ${per}.`,
    newCustomers: `Companies whose first order was this year, ${per}.`,
    priority: `Companies with sales priority ${prio}, ${per}.`,
    gdp: "GDP of each region (EUR).",
  };
  const total = joined ? (layer === "gdp" ? joined.gdp.reduce<number>((s, v) => s + (v ?? 0), 0) : statValue(joined.total, layer as ValueLayer, prio)) : null;
  return (
    <Box sx={{ display: "grid", gap: 0.5, alignContent: "start", minWidth: 0 }}>
      {kicker(layer === "gdp" ? layerTitle.gdp : `${layerTitle[layer]}${layer === "priority" ? ` ${prio}` : ""} · ${per}`)}
      <Box sx={{ display: "grid", gap: 0.4, px: 1, mt: 0.25 }}>
        {rows.map((r) => (
          <Box key={r.c} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ width: 22, height: 12, borderRadius: "3px", bgcolor: r.c, flexShrink: 0 }} />
            <Typography sx={{ fontSize: "0.8rem", color: INK, fontVariantNumeric: "tabular-nums" }}>{r.label}</Typography>
          </Box>
        ))}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ width: 22, height: 12, borderRadius: "3px", bgcolor: LAND, border: `1px solid ${HAIRLINE}`, flexShrink: 0 }} />
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{layer === "gdp" ? "unknown" : "none"}</Typography>
        </Box>
      </Box>
      {total !== null && (
        <Typography sx={{ fontSize: "0.82rem", color: INK, mt: 0.5, px: 1 }}>
          {countryName(cc)}: <b>{fmt(total)}</b>{layer !== "gdp" && joined ? ` · ${full(joined.total.companies)} companies` : ""}
        </Typography>
      )}
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.75, lineHeight: 1.45 }}>
        {what[layer] ?? ""} Darker = more; the classes split the {per === "per postcode" && layer !== "gdp" ? "postcodes" : "regions"} with any into five about equal groups.{layer !== "gdp" ? unplaced : ""}{asOf}
      </Typography>
    </Box>
  );
}

export function sourceNote(cc: string, rules: AssignRules, names: Names): { tint: "blue" | "purple" | "slate"; title: string; text: string } {
  const rule = rules.countries[cc];
  const c = countryName(cc);
  const fallback = names.name(rule?.defaultOwner || rules.defaultOwner);
  if (!rule) return { tint: "slate", title: `${c}: no rule`, text: `Companies go by the SAE table; without a known SAE to ${names.name(rules.defaultOwner)}. Give a postcode or a region to someone on the map, or add a rule on Rules, to draw zones.` };
  if (rule.source === "sae") return {
    tint: "purple", title: `${c}: the Performis SAE decides`,
    text: `A company with an SAE the table knows goes to that person. The map shows the postcode zones - they decide for companies without an SAE or with an unknown one; outside every zone: ${fallback}.`,
  };
  return { tint: "blue", title: `${c}: the map decides`, text: `Key accounts first, then the postcode zones; the SAE is shown, never copied. A postcode in no zone goes to ${fallback}.` };
}
