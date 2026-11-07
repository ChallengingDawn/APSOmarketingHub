"use client";

// MAP ASSIGNMENT - Europe's map (SARCLA 07.11.2026: "est-ce possible d'avoir une map de l'Europe complète? Toute l'Europe,
// Europe with ESO, Europe TSA"). Every country the hub has a map of, in one picture: their regions coloured by the layer
// on screen - Owners (the person the rules give most of a region's companies, paler where others hold part of it),
// Revenue, Potential, Customers, New customers, a Priority, GDP - for every company, or only those the rules give ESO, or
// TSA (All · ESO · TSA over the map). Bottom left the summary over every country, per team and person (MapSummary.tsx).
// Zoom and pan as on a country (wheel, pinch, drag, − / +); regions only - a click on one opens its country's map, where
// the postcodes are.
//
// CONTRACT with the page (page.tsx): "Europe" is the first entry of the country menu (europeModel.ts EUROPE);
//   <EuropePanel d={d} names={names} palette={palette} top={<CountryPicker ... />} sandbox={...} onCountry={setCc} />
// Figures: GET /api/uc/map-assignment?europe=1 (EuropeData - every country's companies per region).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import CenterFocusStrongOutlinedIcon from "@mui/icons-material/CenterFocusStrongOutlined";
import { compact as short, full } from "@/app/charts/format";
import { FAINT, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import type { EuropeData, MapData } from "@/lib/mapAssign/api";
import { API, Swatch, countryName, loadShapes, useMapCountries, type Names, type Palette } from "./shared";
import { PRIORITIES, W, breaks, classOf, regionAt, type LayerKey, type Priority, type ValueLayer } from "./mapModel";
import { LAND, basePaths, drawMap, toBase, type BasePaths, type FillKey, type Frame, type Scene, type View } from "./mapDraw";
import { PillGroup, type PillDef } from "./mapTabs";
import { LAYERS, gdpText, rampOf } from "./SidePanel";
import { MapSummary } from "./MapSummary";
import { mix } from "./MapPanel";
import {
  EUROPE, TEAM_PICKS, buildEurope, figValue, isEuropeData, joinEurope,
  type CountryShapes, type EuropeBase, type EuropeJoined, type RegionFig, type TeamPick,
} from "./europeModel";

const STRONG = 0.8;
const DIM = 0.18;
const UNKNOWN: FillKey = `${LAND}|#d6dbe4`;
/** the layer is the country map's: the same one stays on when going from a country to Europe and back */
const LAYER_KEY = "apsomh:map-assignment:layer";
const TEAM_KEY = "apsomh:map-assignment:team";
const EU_LAYERS = LAYERS.filter((l) => l.key !== "top");
const VALUE: ValueLayer[] = ["revenue", "potential", "customers", "newCustomers", "priority", "gdp"];

/* ── the files and the figures ── */

let baseCache: { key: string; p: Promise<EuropeBase | null> } | null = null;
function europeBase(list: string[]): Promise<EuropeBase | null> {
  const key = list.join(",");
  if (baseCache?.key === key) return baseCache.p;
  const p = Promise.all(list.map((cc) => loadShapes(cc))).then((files) => {
    const got: CountryShapes[] = [];
    files.forEach((f, i) => { if (f) got.push({ country: list[i], outline: f.outline, regions: f.regions }); });
    return buildEurope(got);
  });
  baseCache = { key, p };
  return p;
}

function useEuropeBase(): { eb: EuropeBase | null; status: "loading" | "none" | "ok" } {
  const list = useMapCountries();
  const [got, setGot] = useState<{ key: string; eb: EuropeBase | null } | null>(null);
  useEffect(() => {
    if (!list) return;
    let live = true;
    const key = list.join(",");
    void europeBase(list).then((eb) => { if (live) setGot({ key, eb }); });
    return () => { live = false; };
  }, [list]);
  if (!list || !got || got.key !== list.join(",")) return { eb: null, status: "loading" };
  return { eb: got.eb, status: got.eb ? "ok" : "none" };
}

const dataCache = new Map<string, { at: number; p: Promise<EuropeData | null> }>();
function loadEurope(sandbox: string | null): Promise<EuropeData | null> {
  const key = sandbox ?? "";
  const hit = dataCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.p;
  const p = fetch(`${API}?europe=1${sandbox !== null ? `&sandbox=1&v=${encodeURIComponent(sandbox)}` : ""}`)
    .then(async (r) => {
      if (!r.ok) return null;
      const j = (await r.json()) as { ok?: boolean; data?: unknown };
      return j && j.ok && isEuropeData(j.data) ? j.data : null; // a hub that does not know ?europe answers with MapData
    })
    .catch(() => null)
    .then((x) => { if (!x && dataCache.get(key)?.p === p) dataCache.delete(key); return x; });
  dataCache.set(key, { at: Date.now(), p });
  return p;
}

function useEurope(sandbox: string | null): { data: EuropeData | null; loading: boolean } {
  const key = sandbox ?? "";
  const [got, setGot] = useState<{ key: string; data: EuropeData | null } | null>(null);
  useEffect(() => {
    let live = true;
    void loadEurope(sandbox).then((data) => { if (live) setGot({ key, data }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // a new sandbox version keeps the last figures on screen while it reads
  return got && got.key === key ? { data: got.data, loading: false } : { data: got?.data ?? null, loading: true };
}

/* ── the map ── */

type Hit = { region: number; X: number; Y: number };

export function EuropePanel({ d, names, palette, top, sandbox = null, onCountry }: {
  d: MapData; names: Names; palette: Palette;
  /** over the map, top left: the page's country menu */
  top?: React.ReactNode;
  /** the sandbox's version: its figures (null = live) */
  sandbox?: string | null;
  /** a click on a region: the page opens its country's map */
  onCountry: (cc: string) => void;
}) {
  const { eb, status } = useEuropeBase();
  const base = eb?.base ?? null;
  const europe = useEurope(sandbox);

  const [layer, setLayerState] = useState<LayerKey>("owners");
  const [team, setTeamState] = useState<TeamPick>("all");
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(LAYER_KEY);
      if (v && EU_LAYERS.some((l) => l.key === v)) setLayerState(v as LayerKey);
      const t = window.localStorage.getItem(TEAM_KEY);
      if (t && TEAM_PICKS.some((p) => p.key === t)) setTeamState(t as TeamPick);
    } catch { /* no storage */ }
  }, []);
  const [prio, setPrio] = useState<Priority>("P1");
  const [hl, setHl] = useState<string | null>(null);
  const setLayer = (k: LayerKey) => { setLayerState(k); try { window.localStorage.setItem(LAYER_KEY, k); } catch { /* no storage */ } };
  const setTeam = (k: TeamPick) => { setTeamState(k); setHl(null); try { window.localStorage.setItem(TEAM_KEY, k); } catch { /* no storage */ } };
  const [hover, setHover] = useState<Hit | null>(null);
  const [ui, setUi] = useState({ atMin: true, atMax: false });
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const joined = useMemo<EuropeJoined | null>(() => (eb && europe.data ? joinEurope(eb, europe.data, team) : null), [eb, europe.data, team]);
  const hasGdp = !!joined?.gdp.some((g) => g !== null);
  const effLayer: LayerKey = layer === "top" ? "owners" : layer === "owners" || (joined && (layer !== "gdp" || hasGdp)) ? layer : "owners";
  const valueLayer: ValueLayer | null = (VALUE as string[]).includes(effLayer) ? (effLayer as ValueLayer) : null;

  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<Frame | null>(null);
  const viewRef = useRef<View>({ k: 1, x: 0, y: 0 });
  const raf = useRef(0);
  const drawRef = useRef<() => void>(() => {});
  const schedule = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => { raf.current = 0; drawRef.current(); });
  }, []);
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  /* ── the canvas size: Europe fits below the top bar and beside (or above) the summary bottom left ── */
  const topBarRef = useRef<HTMLDivElement>(null);
  const cornerRef = useRef<HTMLDivElement>(null);
  const [bars, setBars] = useState({ top: 0, cw: 0, ch: 0 });
  useEffect(() => {
    const t = topBarRef.current, c = cornerRef.current;
    if (!t) return;
    const measure = () => {
      const next = { top: Math.round(t.offsetTop + t.offsetHeight), cw: Math.round(c?.offsetWidth ?? 0), ch: Math.round(c?.offsetHeight ?? 0) };
      setBars((b) => (b.top === next.top && b.cw === next.cw && b.ch === next.ch ? b : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(t);
    if (c) ro.observe(c);
    return () => ro.disconnect();
  }, [base]);
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !base) return;
    const measure = () => {
      const w = Math.max(200, Math.round(box.clientWidth));
      const h = Math.max(280, Math.round(box.clientHeight));
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [base]);
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !size || !base) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(size.w * dpr); cv.height = Math.round(size.h * dpr);
    const M = 8;
    const topY = Math.min(size.h / 3, bars.top) + M;
    const fit = (x0: number, y0: number, x1: number, y1: number) => {
      const w = Math.max(40, x1 - x0), h = Math.max(40, y1 - y0);
      const sx = Math.min(w / W, h / base.h);
      return { sx, ox: x0 + (w - W * sx) / 2, oy: y0 + (h - base.h * sx) / 2 };
    };
    const plain = fit(M, topY, size.w - M, size.h - M);
    const beside = bars.cw ? fit(bars.cw + 3 * M, topY, size.w - M, size.h - M) : plain;
    const above = bars.ch ? fit(M, topY, size.w - M, size.h - bars.ch - 2 * M - 10) : plain;
    const best = beside.sx >= above.sx ? beside : above;
    const before = frameRef.current;
    const next = { cssW: size.w, cssH: size.h, dpr, ...best };
    frameRef.current = next;
    const v = viewRef.current;
    if (v.k <= 1.02) setView({ k: 1, x: 0, y: 0 });
    else if (before && (before.sx !== next.sx || before.ox !== next.ox || before.oy !== next.oy)) {
      const k = (v.k * before.sx) / next.sx;
      setView({ k, x: before.ox * v.k + v.x - next.ox * k, y: before.oy * v.k + v.y - next.oy * k });
    } else setView(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, base, bars]);

  /* ── the view ── */
  const kMax = base?.kMax ?? 8;
  const clampView = (v: View): View => {
    const f = frameRef.current;
    const k = Math.max(1, Math.min(kMax, v.k));
    if (!f) return { k, x: 0, y: 0 };
    return { k, x: Math.min(0, Math.max(f.cssW - f.cssW * k, v.x)), y: Math.min(0, Math.max(f.cssH - f.cssH * k, v.y)) };
  };
  const setView = (v: View) => {
    const c = clampView(v);
    viewRef.current = c;
    const next = { atMin: c.k <= 1 + 1e-6, atMax: c.k >= kMax - 1e-6 };
    setUi((u) => (u.atMin === next.atMin && u.atMax === next.atMax ? u : next));
    schedule();
  };
  const zoomAt = (factor: number, X: number, Y: number) => {
    const v = viewRef.current;
    const k = Math.max(1, Math.min(kMax, v.k * factor));
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
    const k = Math.max(1, Math.min(kMax, v.k * factor));
    const X = f.cssW / 2, Y = f.cssH / 2;
    animateTo({ k, x: X - (X - v.x) * (k / v.k), y: Y - (Y - v.y) * (k / v.k) });
  };

  /* ── colours ── */
  const paintKey = useCallback((owner: string | null, t: number): FillKey | null => {
    if (!owner) return null;
    const p = palette(owner);
    return p.ring ? `${mix(p.color, t * 0.4)}|${mix(p.color, t)}` : mix(p.color, t);
  }, [palette]);

  const values = useMemo(() => {
    if (!base || !joined || !valueLayer) return null;
    const v: (number | null)[] = valueLayer === "gdp" ? joined.gdp : joined.regions.map((f) => figValue(f, valueLayer, prio));
    return { vals: v, thresholds: breaks(v.map((x) => x ?? 0)) };
  }, [base, joined, valueLayer, prio]);

  const regionKeys = useMemo<(FillKey | null)[]>(() => {
    if (!base) return [];
    if (values) {
      const ramp = rampOf(values.thresholds.length + 1);
      return values.vals.map((v) => {
        if (v === null) return UNKNOWN;
        const c = classOf(v, values.thresholds);
        return c ? ramp[Math.min(ramp.length - 1, c - 1)] : null;
      });
    }
    if (!joined) return base.regions.map(() => null);
    return joined.regions.map((f) => {
      const [o1, n1] = f?.owners[0] ?? [null, 0];
      if (!f || !o1) return null;
      const total = f.owners.reduce((s, [, n]) => s + n, 0);
      if (hl) {
        if (o1 === hl) return paintKey(o1, STRONG);
        const dim = paintKey(o1, DIM);
        return f.owners.some(([o]) => o === hl) && dim ? `${dim.split("|")[0]}|${mix(palette(hl).color, STRONG)}` : dim;
      }
      // paler where others hold part of it: all theirs = full strength
      return paintKey(o1, 0.25 + (STRONG - 0.25) * (n1 / Math.max(1, total)));
    });
  }, [base, values, joined, hl, paintKey, palette]);

  const paths = useMemo<BasePaths | null>(() => (base && typeof Path2D !== "undefined" ? basePaths(base) : null), [base]);
  const labels = useMemo(() => (eb ? eb.countries.filter((c) => c.label).map((c) => ({ x: c.label![0], y: c.label![1], text: countryName(c.cc), w: c.w })) : []), [eb]);

  drawRef.current = () => {
    const cv = canvasRef.current, f = frameRef.current;
    if (!cv || !f || !base || !paths) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const v = viewRef.current;
    const scene: Scene = {
      base, paths, frame: f, view: v, regionKeys, cells: null,
      hover: hover ? { region: hover.region } : null, pinned: null,
      // the countries' names first; the regions' once zoomed in enough to read them beside
      regionLabel: (i) => (v.k >= 2.2 ? base.regions[i].name : ""),
      markers: null, hoverMarker: null, labels,
    };
    drawMap(ctx, scene);
  };
  useEffect(() => { schedule(); });

  /* ── pointer ── */
  const hitAt = (X: number, Y: number): Hit | null => {
    const f = frameRef.current;
    if (!base || !f) return null;
    const [bx, by] = toBase(f, viewRef.current, X, Y);
    const r = regionAt(base.regions, bx, by);
    return r >= 0 ? { region: r, X, Y } : null;
  };
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ sx: number; sy: number; x0: number; y0: number; moved: boolean; pinch?: { d0: number; k0: number; bx: number; by: number } } | null>(null);
  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
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
      const k = Math.max(1, Math.min(kMax, g.pinch.k0 * (dist / g.pinch.d0)));
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
      setHover((cur) => (cur?.region === t?.region && cur?.X === t?.X && cur?.Y === t?.Y ? cur : t));
    });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current;
    const p = local(e);
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1 && g?.pinch) {
      const [q] = [...pointers.current.values()];
      gesture.current = { sx: q.x, sy: q.y, x0: viewRef.current.x, y0: viewRef.current.y, moved: true };
      return;
    }
    if (pointers.current.size) return;
    gesture.current = null;
    if (!g || g.moved || !eb) return;
    const t = hitAt(p.x, p.y);
    if (t) onCountry(eb.country[t.region]);
  };
  const onPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => { pointers.current.delete(e.pointerId); if (!pointers.current.size) gesture.current = null; };

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
    }
  };

  /* ── what the hover and the summary say ── */
  const teamName = team === "all" ? "" : ` ${team}`;
  const layerValue = (r: number): string | null => {
    if (!joined) return null;
    if (valueLayer === "gdp") return `GDP ${gdpText(joined.gdp[r])}`;
    const f = joined.regions[r];
    if (!valueLayer) return f ? `${full(f.companies)}${teamName} ${f.companies === 1 ? "company" : "companies"}` : `No${teamName} companies here`;
    const v = figValue(f, valueLayer, prio);
    const lab = valueLayer === "revenue" ? "Revenue" : valueLayer === "potential" ? "Potential" : valueLayer === "customers" ? "Customers" : valueLayer === "newCustomers" ? "New customers" : `${prio} companies`;
    return `${lab}${teamName} ${valueLayer === "revenue" || valueLayer === "potential" ? short(v) : full(v)}`;
  };
  /** with All: the region's figure split ESO / TSA (as on a country) */
  const teamSplit = (r: number): string | null => {
    const f = joined?.regions[r];
    if (!f || team !== "all") return null;
    const line = (what: "revenue" | "potential" | "customers" | "newCustomers" | "companies", lab: string) => {
      const money = what === "revenue" || what === "potential";
      const parts = (["ESO", "TSA", "Other"] as const).filter((k) => f.teams[k][what] > 0).map((k) => `${k} ${money ? short(f.teams[k][what]) : full(f.teams[k][what])}`);
      return parts.length ? `${lab}: ${parts.join(" · ")}` : null;
    };
    if (valueLayer === "revenue" || valueLayer === "potential" || valueLayer === "customers" || valueLayer === "newCustomers") return line(valueLayer, valueLayer === "newCustomers" ? "New" : valueLayer[0].toUpperCase() + valueLayer.slice(1));
    if (!valueLayer) return [line("companies", "Companies"), line("revenue", "Revenue"), line("potential", "Potential")].filter(Boolean).join("\n") || null;
    return null;
  };

  const mapList = useMemo(() => new Set(eb?.countries.map((c) => c.cc) ?? []), [eb]);
  const outside = useMemo(() => d.countries.filter((c) => !mapList.has(c.country)).reduce((s, c) => s + c.companies, 0), [d.countries, mapList]);
  const onMap = useMemo(() => [...new Set((joined?.regions ?? []).flatMap((f) => (f?.owners[0] ? [f.owners[0][0]] : [])))], [joined]);
  const gdpTotal = joined && hasGdp ? joined.gdp.reduce<number>((a, v) => a + (v ?? 0), 0) : null;
  const nCountries = mapList.size;

  const glassBar = { bgcolor: "rgba(255,255,255,.94)", border: `1px solid ${HAIRLINE}`, borderRadius: "14px", boxShadow: "0 2px 10px rgba(31,45,78,.08)" };
  const layerOptions: PillDef<LayerKey>[] = EU_LAYERS.map((l) => {
    if (l.key === "owners") return { key: l.key, label: l.label };
    const hint = europe.loading && !joined ? "Reading the companies of every country…"
      : !joined ? "No company figures for Europe yet - they come with the engine's scans"
      : l.key === "gdp" && !hasGdp ? "No GDP figures yet"
      : l.key === "potential" && !(joined.potential > 0) ? "No potential yet - the engine's next full read of the companies brings it" : undefined;
    return { key: l.key, label: l.label, disabled: !!hint, hint };
  });
  const teamOptions: PillDef<TeamPick>[] = TEAM_PICKS.map((t) => ({ key: t.key, label: t.label, count: joined ? full(joined.teamCompanies[t.key]) : null }));

  const summaryCard = base && joined && (joined.load.length || effLayer === "gdp") ? (
    <MapSummary cc={EUROPE} place={`Europe${teamName}`} layer={effLayer} prio={prio} load={joined.load} onMap={onMap} gdp={gdpTotal}
      names={names} palette={palette} hl={hl} setHl={setHl} maxHeight={Math.max(160, (size?.h ?? 600) - bars.top - 90)} narrow={(size?.w ?? 1000) < 700}
      note={`Per person the rules give each company - every${teamName} company of the ${full(nCountries)} countries with a map, with or without a postcode.${outside > 0 ? ` ${full(outside)} companies in other countries (or with no country) are not in it.` : ""}`} />
  ) : null;
  const ramp = values ? (
    <Box sx={{ ...glassBar, px: 1.25, py: 0.75, display: "flex", alignItems: "center", gap: 1 }}>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>less</Typography>
      <Box sx={{ display: "flex" }}>{rampOf(values.thresholds.length + 1).map((c) => <Box key={c} sx={{ width: 20, height: 10, bgcolor: c }} />)}</Box>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>more {EU_LAYERS.find((l) => l.key === effLayer)?.label.toLowerCase()}</Typography>
    </Box>
  ) : null;

  let stage: React.ReactNode;
  if (status === "loading") {
    stage = (
      <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 1, color: MUTED }}>
        <CircularProgress size={16} sx={{ color: MUTED }} /><Typography sx={{ fontSize: "0.85rem", color: MUTED }}>Reading the map of Europe…</Typography>
      </Box>
    );
  } else if (!base) {
    stage = (
      <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", p: 2, textAlign: "center" }}>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK }}>No country maps in the hub yet</Typography>
      </Box>
    );
  } else {
    stage = (
      <>
        <Box component="canvas" ref={canvasRef} tabIndex={0} role="img"
          aria-label={`Map of Europe: ${full(nCountries)} countries, ${full(base.regions.length)} regions coloured ${valueLayer ? `by ${EU_LAYERS.find((l) => l.key === effLayer)?.label.toLowerCase()}` : "by person"}${team === "all" ? "" : `, ${team} only`}. Plus and minus zoom, arrows move; a click on a region opens its country.`}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
          onPointerLeave={() => setHover(null)} onKeyDown={onKeyDown}
          sx={{
            position: "absolute", inset: 0, display: "block", width: "100%", height: "100%",
            touchAction: ui.atMin ? "pan-y" : "none", cursor: hover ? "pointer" : ui.atMin ? "default" : "grab",
            outline: "none", "&:focus-visible": { boxShadow: "inset 0 0 0 2px #2459d1" },
          }} />
        {hover && eb && (
          <EuropeTip X={hover.X} Y={hover.Y} boxW={size?.w ?? 600} name={base.regions[hover.region].name} cc={eb.country[hover.region]}
            fig={joined?.regions[hover.region] ?? null} names={names} palette={palette} value={layerValue(hover.region)} split={teamSplit(hover.region)} />
        )}
      </>
    );
  }

  return (
    <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
      <Box ref={boxRef} sx={{
        position: "relative", width: "100%", overflow: "hidden", borderRadius: "18px", bgcolor: sandbox !== null ? "#fbf7ee" : "#f3f5f8",
        border: sandbox !== null ? "2px solid #e0a43a" : `1px solid ${HAIRLINE}`,
        height: { xs: "72vh", md: "calc(100vh - 210px)" }, minHeight: { xs: 460, md: 560 },
      }}>
        {stage}
        {/* over the map, top: Europe (the country menu), the team, the zoom - and the layers */}
        <Box ref={topBarRef} sx={{ position: "absolute", top: 10, left: 10, right: 10, zIndex: 4, display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 1, pointerEvents: "none", "& > *": { pointerEvents: "auto" } }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
            {top}
            <PillGroup<TeamPick> name="Team" value={team} onChange={setTeam} options={teamOptions} />
            {base && (
              <Box role="group" aria-label="Zoom" sx={{ ...glassBar, borderRadius: "12px", display: "flex", alignItems: "center", p: 0.25, gap: 0.25 }}>
                <Tooltip title="Zoom out (−)"><span><IconButton onClick={() => zoomCentre(1 / 1.6)} disabled={ui.atMin} aria-label="Zoom out" sx={{ width: 34, height: 34, color: INK }}><RemoveIcon sx={{ fontSize: 22 }} /></IconButton></span></Tooltip>
                <Tooltip title="Zoom in (+)"><span><IconButton onClick={() => zoomCentre(1.6)} disabled={ui.atMax} aria-label="Zoom in" sx={{ width: 34, height: 34, color: INK }}><AddIcon sx={{ fontSize: 22 }} /></IconButton></span></Tooltip>
                <Box sx={{ width: "1px", alignSelf: "stretch", my: 0.5, bgcolor: HAIRLINE }} />
                <Tooltip title="Whole of Europe"><span><IconButton onClick={() => animateTo({ k: 1, x: 0, y: 0 })} disabled={ui.atMin} aria-label="Whole of Europe" sx={{ width: 34, height: 34, color: INK }}><CenterFocusStrongOutlinedIcon sx={{ fontSize: 20 }} /></IconButton></span></Tooltip>
              </Box>
            )}
            {europe.loading && base && <CircularProgress size={16} sx={{ color: MUTED }} aria-label="Reading the figures" />}
          </Box>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center", justifyContent: "flex-end" }}>
            <PillGroup<LayerKey> name="Map layers" small value={effLayer} onChange={setLayer} options={layerOptions} />
            {effLayer === "priority" && (
              <PillGroup<Priority> name="Sales priority" small value={prio} onChange={setPrio}
                options={PRIORITIES.map((p) => ({ key: p, label: p, count: joined ? full(joined.priority[p] ?? 0) : null }))} />
            )}
          </Box>
        </Box>
        {/* bottom left: the summary and the layer's scale */}
        {base && (
          <Box sx={{ position: "absolute", left: 10, right: 10, bottom: 10, zIndex: 4, display: "flex", alignItems: "flex-end", pointerEvents: "none" }}>
            <Box ref={cornerRef} sx={{ display: "grid", gap: 0.75, justifyItems: "start", minWidth: 0, maxWidth: "100%", pointerEvents: "auto" }}>
              {summaryCard}
              {ramp}
            </Box>
          </Box>
        )}
        {!europe.loading && !europe.data && base && (
          <Box sx={{ position: "absolute", top: { xs: 120, sm: 64 }, left: "50%", transform: "translateX(-50%)", zIndex: 5, ...glassBar, px: 1.5, py: 0.75 }}>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>The figures of Europe could not be read - the map shows the countries only.</Typography>
          </Box>
        )}
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>
        Europe = the {full(nCountries)} countries the hub has a map of. Scroll, pinch or the + and − buttons to zoom, drag to move. Each region takes the colour of the person the rules give most of its{team === "all" ? "" : ` ${team}`} companies - paler where others hold part of it. Click a region to open its country&apos;s map with the postcodes.
      </Typography>
    </Box>
  );
}

function EuropeTip({ X, Y, boxW, name, cc, fig, names, palette, value, split }: {
  X: number; Y: number; boxW: number; name: string; cc: string; fig: RegionFig | null; names: Names; palette: Palette;
  value: string | null; split: string | null;
}) {
  const owner = fig?.owners[0]?.[0] ?? null;
  const total = fig ? fig.owners.reduce((s, [, n]) => s + n, 0) : 0;
  const share = owner && fig && fig.owners.length > 1 ? `${Math.round((100 * fig.owners[0][1]) / Math.max(1, total))}% of its companies` : null;
  const left = Math.max(4, Math.min(X + 14, boxW - 274));
  return (
    <Box sx={{
      position: "absolute", pointerEvents: "none", zIndex: 4, left, top: Math.max(4, Y + 14), maxWidth: 270,
      bgcolor: "rgba(255,255,255,.97)", border: `1px solid ${HAIRLINE}`, borderRadius: "12px", px: 1.25, py: 0.9, boxShadow: "0 6px 20px rgba(31,45,78,.12)",
    }}>
      <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{name}</Typography>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{countryName(cc)}</Typography>
      {owner && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5 }}>
          <Swatch paint={palette(owner)} />
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK }}>{names.name(owner)}</Typography>
          {share && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{share}</Typography>}
        </Box>
      )}
      {value && <Typography sx={{ fontSize: "0.78rem", color: INK, mt: 0.4, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>}
      {split && <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.25, fontVariantNumeric: "tabular-nums", whiteSpace: "pre-line" }}>{split}</Typography>}
      <Typography sx={{ fontSize: "0.72rem", color: FAINT, mt: 0.4 }}>Click: the map of {countryName(cc)}</Typography>
    </Box>
  );
}
