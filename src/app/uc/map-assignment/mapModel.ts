// MAP ASSIGNMENT - the map's model: pure (no React, no canvas), so a test or the server can run it as is.
//   buildBase   one country's geometry, built once: the outline and regions (cantons / départements / Länder) projected
//               with d3-geo, every postcode placed, and the Voronoi of the postcode spots (d3-delaunay) - the postcode
//               areas the map shows zoomed in, clipped to the outline when drawn
//   rulePicker  who a postcode goes to under the rules on screen - zoneFor of rules.ts (the longest prefix, then a zone
//               holding the postcode's region, then the country's default, then TSA Team), compiled once per edit
//   tally       postcodes and km² per person, the person holding most of each region
//   joinLayer   the engine's LayerData (GET ?layers=CC) laid on the postcodes, and the class breaks of a value layer
//
// Geo files (public/geo): postcodes/<CC>.json rows [postcode, lat, lon, regionCode, km2, place] - km2 = the postcode's
// Voronoi cell clipped to the outline in an equal-area projection (postcodes on the very same spot share one cell: the
// first in the file carries it, the others 0); shapes/<CC>.json regions [{code, name, geometry, km2, group?}].

import { geoArea, geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { Delaunay, type Voronoi } from "d3-delaunay";
import type { Feature, FeatureCollection, Geometry, MultiPoint, Polygon, Position } from "geojson";
import { cleanZip, type CountryRule, type OwnerId } from "@/lib/mapAssign/rules";
import type { LayerData, PostcodeStat } from "@/lib/mapAssign/api";

/** The map's own coordinate width; the height follows the country (at most MAX_H). */
export const W = 800;
const PAD = 12;
const MAX_H = 760;
/** Zoomed in at least this much, the map shows the postcode areas instead of the regions. */
export const K_DETAIL = 1.5;

export type GeoInput = {
  points: { points: unknown[] } | null;
  shapes: { outline: Geometry | null; regions: { code: string; name: string; geometry: Geometry }[] } | null;
};

export type MapPoint = {
  zip: string; clean: string; place: string | null; lat: number; lon: number;
  /** projected, in map units (0..W) */
  x: number; y: number;
  /** index into regions, -1 = none */
  region: number;
  /** the postcode's area (0 for a postcode sharing its spot with an earlier one) */
  km2: number;
  /** its Voronoi cell (the cell of the first postcode on the same spot) */
  cell: number;
};
export type MapRegion = {
  code: string; name: string; group: string | null; km2: number | null;
  /** SVG path in map units */
  d: string;
  rings: Float64Array[];
  box: [number, number, number, number];
  /** where its name goes */
  label: [number, number] | null;
  points: number[];
};
export type MapBase = {
  cc: string; w: number; h: number;
  outline: string | null;
  outlineRings: Float64Array[];
  /** the outline's bounding box, map units */
  box: [number, number, number, number];
  regions: MapRegion[];
  points: MapPoint[];
  byClean: Map<string, number>;
  /** one cell per distinct spot: cells[c] = the points there, file order */
  cells: number[][];
  delaunay: Delaunay<number> | null;
  voronoi: Voronoi<number> | null;
  /** per cell: x0, y0, x1, y1 (map units); NaN when the cell is empty */
  cellBox: Float32Array;
  /** a typical small cell's side (10th percentile), map units - how far zoom has to go for postcode labels */
  smallCell: number;
  kMax: number;
  km2: number | null;
};

/* ── geometry ── */

/** d3-geo reads polygons on the sphere: an RFC 7946 (anticlockwise) ring means "everything but". Turn such rings round. */
export function rewind(g: Geometry): Geometry {
  const fix = (rings: Position[][]): Position[][] => (geoArea({ type: "Polygon", coordinates: rings } as Polygon) > 2 * Math.PI ? rings.map((r) => [...r].reverse()) : rings);
  if (g.type === "Polygon") return { ...g, coordinates: fix(g.coordinates) };
  if (g.type === "MultiPolygon") return { ...g, coordinates: g.coordinates.map(fix) };
  if (g.type === "GeometryCollection") return { ...g, geometries: g.geometries.map(rewind) };
  return g;
}

function polygonsOf(g: Geometry): Position[][][] {
  if (g.type === "Polygon") return [g.coordinates];
  if (g.type === "MultiPolygon") return g.coordinates;
  if (g.type === "GeometryCollection") return g.geometries.flatMap(polygonsOf);
  return [];
}

/** Even-odd ray test on projected rings - holes and islands included. */
export function insideRings(x: number, y: number, rings: Float64Array[]): boolean {
  let c = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}

export function regionAt(regions: MapRegion[], x: number, y: number): number {
  for (let i = 0; i < regions.length; i++) {
    const [x0, y0, x1, y1] = regions[i].box;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && insideRings(x, y, regions[i].rings)) return i;
  }
  return -1;
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));

/** The country fitted to the map width: regions, outline, every postcode, the Voronoi of the postcode spots. */
export function buildBase(files: GeoInput, cc: string): MapBase | null {
  const regionsIn = (files.shapes?.regions ?? []).map((r) => {
    const extra = r as { km2?: unknown; group?: unknown };
    return { code: String(r.code ?? ""), name: String(r.name ?? r.code ?? ""), geometry: rewind(r.geometry), km2: extra.km2, group: extra.group };
  });
  const outlineGeo = files.shapes?.outline ? rewind(files.shapes.outline) : null;
  const rows = (files.points?.points ?? []).filter((r): r is unknown[] => Array.isArray(r) && r[0] != null && Number.isFinite(num(r[1])) && Number.isFinite(num(r[2])));
  let fit: GeoPermissibleObjects;
  if (outlineGeo) fit = { type: "Feature", geometry: outlineGeo, properties: {} } as Feature;
  else if (regionsIn.length) fit = { type: "FeatureCollection", features: regionsIn.map((r) => ({ type: "Feature", geometry: r.geometry, properties: {} })) } as FeatureCollection;
  else if (rows.length > 1) fit = { type: "MultiPoint", coordinates: rows.map((r) => [num(r[2]), num(r[1])]) } as MultiPoint;
  else return null;
  const projection = geoMercator().fitWidth(W - 2 * PAD, fit);
  const [[, fy0], [, fy1]] = geoPath(projection).bounds(fit);
  const inner = Math.max(120, Math.min(MAX_H - 2 * PAD, Number.isFinite(fy1 - fy0) ? fy1 - fy0 : 400));
  projection.fitExtent([[PAD, PAD], [W - PAD, PAD + inner]], fit);
  const path = geoPath(projection);
  const h = Math.ceil(inner + 2 * PAD);

  const ringsOfPolys = (polys: Position[][][]) => {
    const rings: Float64Array[] = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const poly of polys) for (const ring of poly) {
      const a = new Float64Array(ring.length * 2);
      let n = 0;
      for (const pos of ring) {
        const p = projection([pos[0], pos[1]]);
        if (!p) continue;
        a[n++] = p[0]; a[n++] = p[1];
        if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
      }
      if (n >= 6) rings.push(a.subarray(0, n));
    }
    return { rings, box: [x0, y0, x1, y1] as [number, number, number, number] };
  };

  const regions: MapRegion[] = regionsIn.map((r) => {
    const polys = polygonsOf(r.geometry);
    const { rings, box } = ringsOfPolys(polys);
    // the name goes on the biggest part's centre when that lies inside, else on its postcodes' middle (below)
    let label: [number, number] | null = null;
    let best: Position[][] | null = null, bestA = -1;
    for (const p of polys) { const a = geoArea({ type: "Polygon", coordinates: p } as Polygon); if (a > bestA) { bestA = a; best = p; } }
    if (best) {
      const c = path.centroid({ type: "Feature", geometry: { type: "Polygon", coordinates: best }, properties: {} } as Feature);
      if (Number.isFinite(c[0]) && Number.isFinite(c[1]) && insideRings(c[0], c[1], rings)) label = [c[0], c[1]];
    }
    const km2 = Number(r.km2);
    return {
      code: r.code, name: r.name, group: typeof r.group === "string" && r.group ? r.group : null, km2: Number.isFinite(km2) && km2 > 0 ? km2 : null,
      d: path({ type: "Feature", geometry: r.geometry, properties: {} } as Feature) ?? "", rings, box, label, points: [],
    };
  });
  const codeIx = new Map(regions.map((r, i) => [r.code, i] as const));
  const outlineRings = outlineGeo ? ringsOfPolys(polygonsOf(outlineGeo)) : null;
  let box: [number, number, number, number] = outlineRings?.box ?? [Infinity, Infinity, -Infinity, -Infinity];
  if (!outlineRings) for (const r of regions) box = [Math.min(box[0], r.box[0]), Math.min(box[1], r.box[1]), Math.max(box[2], r.box[2]), Math.max(box[3], r.box[3])];

  const points: MapPoint[] = [];
  const byClean = new Map<string, number>();
  const cells: number[][] = [];
  const spot = new Map<string, number>();
  const coords: number[] = [];
  for (const r of rows) {
    const lat = num(r[1]), lon = num(r[2]);
    const p = projection([lon, lat]);
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    const zip = String(r[0]);
    const clean = cleanZip(zip);
    const i = points.length;
    const coded = typeof r[3] === "string" ? codeIx.get(r[3]) : undefined;
    const region = coded ?? regionAt(regions, p[0], p[1]);
    const key = `${lat}|${lon}`;
    let cell = spot.get(key);
    if (cell === undefined) { cell = cells.length; spot.set(key, cell); cells.push([i]); coords.push(p[0], p[1]); } else cells[cell].push(i);
    const km2 = num(r[4]);
    points.push({ zip, clean, place: typeof r[5] === "string" && r[5] ? r[5] : null, lat, lon, x: p[0], y: p[1], region, km2: Number.isFinite(km2) && km2 > 0 ? km2 : 0, cell });
    if (clean && !byClean.has(clean)) byClean.set(clean, i);
    if (region >= 0) regions[region].points.push(i);
    if (!outlineRings && !regions.length) box = [Math.min(box[0], p[0]), Math.min(box[1], p[1]), Math.max(box[2], p[0]), Math.max(box[3], p[1])];
  }
  for (const r of regions) {
    if (r.label || !r.points.length) continue;
    let sx = 0, sy = 0;
    for (const i of r.points) { sx += points[i].x; sy += points[i].y; }
    const c: [number, number] = [sx / r.points.length, sy / r.points.length];
    r.label = insideRings(c[0], c[1], r.rings) ? c : [points[r.points[0]].x, points[r.points[0]].y];
  }

  let delaunay: Delaunay<number> | null = null, voronoi: Voronoi<number> | null = null;
  const cellBox = new Float32Array(cells.length * 4).fill(Number.NaN);
  const sides: number[] = [];
  if (cells.length) {
    delaunay = new Delaunay(Float64Array.from(coords));
    const m = 4;
    voronoi = delaunay.voronoi([Math.min(box[0], 0) - m, Math.min(box[1], 0) - m, Math.max(box[2], W) + m, Math.max(box[3], h) + m]);
    for (let c = 0; c < cells.length; c++) {
      const poly = voronoi.cellPolygon(c);
      if (!poly) continue;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      cellBox[c * 4] = x0; cellBox[c * 4 + 1] = y0; cellBox[c * 4 + 2] = x1; cellBox[c * 4 + 3] = y1;
      sides.push(Math.min(x1 - x0, y1 - y0));
    }
  }
  sides.sort((a, b) => a - b);
  const smallCell = sides.length ? Math.max(0.05, sides[Math.floor(sides.length * 0.1)]) : 10;
  // far enough in that a small town's postcodes take a label (about 40 px a side), never less than 8x
  const kMax = Math.max(8, Math.min(96, Math.ceil(40 / smallCell)));
  const km2 = Number((files.shapes as { km2?: unknown } | null)?.km2);
  return {
    cc, w: W, h, outline: outlineGeo ? path(fit) : null, outlineRings: outlineRings?.rings ?? [], box, regions, points, byClean, cells,
    delaunay, voronoi, cellBox, smallCell, kMax, km2: Number.isFinite(km2) && km2 > 0 ? km2 : null,
  };
}

/** The cell under a map point (null outside the country). */
export function cellAt(base: MapBase, x: number, y: number, hint = 0): number | null {
  if (!base.delaunay) return null;
  if (base.outlineRings.length && !insideRings(x, y, base.outlineRings)) return null;
  if (!base.outlineRings.length && regionAt(base.regions, x, y) < 0) return null;
  const c = base.delaunay.find(x, y, hint);
  return c >= 0 && c < base.cells.length ? c : null;
}

/* ── who a postcode goes to ── */

export type Decided = {
  owner: OwnerId;
  /** "prefix": a zone's postcode prefix; "region": a zone holding the postcode's region; "default": no zone */
  via: "prefix" | "region" | "default";
  /** the prefix or range that decided ("80-85"), null otherwise */
  token: string | null;
  zone: number;
  zoneId: string | null;
  /** "default" decided by the country's own default person (else TSA Team, the default everywhere) */
  countryDefault: boolean;
};

type Plain = { zone: number; order: number; token: string; len: number };
type Range = Plain & { n: number; a: string; b: string; lo: string; hi: string };

/**
 * zoneFor (rules.ts) compiled once: the longest matching prefix wins, at equal length the zone listed first; no prefix:
 * the first zone holding the region; nothing: the country's default, else `globalDefault` (TSA Team).
 */
export function rulePicker(rule: CountryRule | undefined, globalDefault: OwnerId): (clean: string, region: string | null) => Decided {
  const zones = rule?.zones ?? [];
  const plain = new Map<string, Plain>();
  const ranges: Range[] = [];
  let order = 0, maxPlain = 0;
  zones.forEach((z, zone) => {
    for (const p of z.prefixes ?? []) {
      const r = /^(\w+)-(\w+)$/.exec(p.trim());
      const len = p.includes("-") ? p.split("-")[0].length : cleanZip(p).length;
      if (r && r[1].length === r[2].length) ranges.push({ zone, order, token: p, len, n: r[1].length, a: r[1], b: r[2], lo: r[1].toUpperCase(), hi: r[2].toUpperCase() });
      else {
        const q = cleanZip(p);
        if (q) {
          const was = plain.get(q);
          // same token twice: zoneFor keeps the first unless a later one is longer (it never is - same token)
          if (!was) plain.set(q, { zone, order, token: p, len });
          maxPlain = Math.max(maxPlain, q.length);
        }
      }
      order++;
    }
  });
  // numeric ranges of up to 4 characters: a table per length (head value -> the first range listed that holds it -
  // all of one length are equally long, so the first listed wins); the others are tried one by one
  const tables = new Map<number, Int32Array>();
  const slow: Range[] = [];
  for (const [ri, r] of ranges.entries()) {
    if (r.n > 4 || !/^\d+$/.test(r.a + r.b) || r.len !== r.n) { slow.push(r); continue; }
    let t = tables.get(r.n);
    if (!t) { t = new Int32Array(10 ** r.n).fill(-1); tables.set(r.n, t); }
    for (let v = Math.max(0, Number(r.a)), end = Math.min(10 ** r.n - 1, Number(r.b)); v <= end; v++) if (t[v] < 0) t[v] = ri;
  }
  const tableLens = [...tables.keys()];
  const byRegion = new Map<string, number>();
  zones.forEach((z, i) => { for (const g of z.regions ?? []) if (!byRegion.has(g)) byRegion.set(g, i); });
  const fallback = String(rule?.defaultOwner || globalDefault);
  const countryDefault = !!rule?.defaultOwner;
  return (clean, region) => {
    let best: Plain | null = null;
    if (clean) {
      for (let L = Math.min(clean.length, maxPlain); L >= 1; L--) {
        const hit = plain.get(clean.slice(0, L));
        // the map key is the cleaned token: a token starts the postcode exactly when its cleaned form does
        if (hit && (!best || hit.len > best.len || (hit.len === best.len && hit.order < best.order))) best = hit;
      }
      for (const n of tableLens) {
        const head = clean.slice(0, n);
        if (head.length < n || !/^\d+$/.test(head)) continue;
        const ri = tables.get(n)![Number(head)];
        const r = ri >= 0 ? ranges[ri] : null;
        if (r && (!best || r.len > best.len || (r.len === best.len && r.order < best.order))) best = r;
      }
      for (const r of slow) {
        const head = clean.slice(0, r.n);
        if (head.length < r.n) continue;
        const ok = /^\d+$/.test(head + r.a + r.b) ? Number(head) >= Number(r.a) && Number(head) <= Number(r.b) : head >= r.lo && head <= r.hi;
        if (ok && (!best || r.len > best.len || (r.len === best.len && r.order < best.order))) best = r;
      }
    }
    if (best) { const z = zones[best.zone]; return { owner: String(z.owner), via: "prefix", token: best.token, zone: best.zone, zoneId: z.id ?? null, countryDefault: false }; }
    const zi = region ? byRegion.get(region) : undefined;
    if (zi !== undefined) { const z = zones[zi]; return { owner: String(z.owner), via: "region", token: null, zone: zi, zoneId: z.id ?? null, countryDefault: false }; }
    return { owner: fallback, via: "default", token: null, zone: -1, zoneId: null, countryDefault };
  };
}

/** Every postcode of the country, decided. */
export function pickAll(base: MapBase, rule: CountryRule | undefined, globalDefault: OwnerId): Decided[] {
  const pick = rulePicker(rule, globalDefault);
  return base.points.map((p) => pick(p.clean, p.region >= 0 ? base.regions[p.region].code : null));
}

/* ── counts ── */

export type RegionTally = {
  /** postcodes per person, most first */
  owners: [OwnerId, number][];
  total: number;
};
export type Tally = {
  /** per person: postcodes and km² - each region's own area, shared by the postcode areas each person holds in it
   *  (all of it when the region is all theirs); a region without a postcode of its own goes to whoever holds its middle */
  byOwner: Map<string, { postcodes: number; km2: number }>;
  byZone: Map<string, number>;
  regions: RegionTally[];
};

export function tally(base: MapBase | null, picks: Decided[]): Tally {
  const byOwner = new Map<string, { postcodes: number; km2: number }>();
  const byZone = new Map<string, number>();
  const per = (base?.regions ?? []).map(() => new Map<string, { n: number; km2: number }>());
  const add = (o: string, n: number, km2: number) => { const t = byOwner.get(o); if (t) { t.postcodes += n; t.km2 += km2; } else byOwner.set(o, { postcodes: n, km2 }); };
  picks.forEach((p, i) => {
    const o = String(p.owner ?? "");
    const pt = base?.points[i];
    if (p.zoneId) byZone.set(p.zoneId, (byZone.get(p.zoneId) ?? 0) + 1);
    const r = pt?.region ?? -1;
    if (r >= 0) { const m = per[r]; const t = m.get(o); if (t) { t.n++; t.km2 += pt?.km2 ?? 0; } else m.set(o, { n: 1, km2: pt?.km2 ?? 0 }); }
    else add(o, 1, pt?.km2 ?? 0);
  });
  if (base?.delaunay) base.regions.forEach((r, ri) => {
    if (per[ri].size || !r.km2 || !r.label) return;
    const c = base.delaunay!.find(r.label[0], r.label[1]);
    const o = c >= 0 && base.cells[c] ? String(picks[base.cells[c][0]]?.owner ?? "") : "";
    if (o) add(o, 0, r.km2);
  });
  const regions: RegionTally[] = per.map((m, ri) => {
    const owners = [...m].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
    // the region's own area, shared by the postcode areas each person holds in it (all of it for one person)
    const area = base?.regions[ri].km2 ?? null;
    const cellsKm2 = owners.reduce((sum, [, t]) => sum + t.km2, 0);
    const n = owners.reduce((sum, [, t]) => sum + t.n, 0);
    for (const [o, t] of owners) add(o, t.n, area === null ? t.km2 : area * (cellsKm2 > 0 ? t.km2 / cellsKm2 : t.n / Math.max(1, n)));
    return { owners: owners.map(([o, t]) => [o, t.n] as [OwnerId, number]), total: owners.reduce((s, [, t]) => s + t.n, 0) };
  });
  return { byOwner, byZone, regions };
}

/* ── the engine's layers ── */

export type ValueLayer = "revenue" | "customers" | "newCustomers" | "priority" | "gdp";
export type LayerKey = "owners" | ValueLayer | "top";
export const PRIORITIES = ["P1", "P2", "P3", "P4"] as const;
export type Priority = (typeof PRIORITIES)[number];

export type TopCompany = { id: string; name: string; revenue: number; owner: OwnerId | null; point: number };
export type Joined = {
  /** per cell: the summed stats of its postcodes (null = no company there) */
  cells: (PostcodeStat | null)[];
  /** per region: the summed stats */
  regions: (PostcodeStat | null)[];
  /** GDP per region, null = unknown */
  gdp: (number | null)[];
  /** the biggest customers on the map, biggest first */
  top: TopCompany[];
  /** companies the map could not place (no postcode the files know) */
  unplaced: number;
  total: PostcodeStat;
};

const emptyStat = (zip = ""): PostcodeStat => ({ zip, companies: 0, customers: 0, newCustomers: 0, revenue: 0, priority: {}, top: [], sae: {}, now: {}, decided: {}, change: 0 });
const addTo = (into: Record<string, number>, from: Record<string, number> | undefined) => {
  for (const [k, v] of Object.entries(from ?? {})) into[k] = (into[k] ?? 0) + (Number(v) || 0);
};
function addStat(into: PostcodeStat, s: PostcodeStat) {
  into.companies += s.companies || 0; into.customers += s.customers || 0; into.newCustomers += s.newCustomers || 0;
  into.revenue += Number.isFinite(s.revenue) ? s.revenue : 0;
  addTo(into.priority, s.priority);
  // where it comes from (a hub without these fields yet: empty)
  addTo(into.sae!, s.sae); addTo(into.now!, s.now); addTo(into.decided!, s.decided);
  into.change = (into.change ?? 0) + (Number(s.change) || 0);
}
/** A record's entries, biggest first: [[key, n], ...]. */
export const ranked = (r: Record<string, number> | undefined): [string, number][] =>
  Object.entries(r ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

/** Is it LayerData for this country (and not, say, the page's own data from a route that does not know ?layers yet)? */
export function isLayerData(x: unknown, cc: string): x is LayerData {
  const o = x as LayerData | null;
  return !!o && typeof o === "object" && Array.isArray(o.points) && String(o.country ?? "").toUpperCase() === cc;
}

/** The engine's postcodes on the map's: the same postcode, else the longest known start of it ("1234AB" -> "1234"). */
export function joinLayer(base: MapBase, data: LayerData): Joined {
  const cells: (PostcodeStat | null)[] = base.cells.map(() => null);
  const regions: (PostcodeStat | null)[] = base.regions.map(() => null);
  const total = emptyStat();
  const tops: TopCompany[] = [];
  let unplaced = Number(data.unplaced) || 0;
  for (const s of data.points ?? []) {
    if (!s || typeof s !== "object") continue;
    let z = cleanZip(s.zip);
    let i = base.byClean.get(z);
    while (i === undefined && z.length > 3) { z = z.slice(0, -1); i = base.byClean.get(z); }
    addStat(total, s);
    if (i === undefined) { unplaced += s.companies || 0; continue; }
    const p = base.points[i];
    const c = cells[p.cell] ?? (cells[p.cell] = emptyStat(p.zip));
    addStat(c, s);
    if (p.region >= 0) addStat(regions[p.region] ?? (regions[p.region] = emptyStat(base.regions[p.region].code)), s);
    for (const t of s.top ?? []) if (t && Number(t.revenue) > 0) tops.push({ id: String(t.id), name: String(t.name ?? t.id), revenue: Number(t.revenue), owner: t.owner ? String(t.owner) : null, point: i });
  }
  tops.sort((a, b) => b.revenue - a.revenue || a.id.localeCompare(b.id));
  const gdpBy = new Map((data.gdp ?? []).map((g) => [String(g.code), g.gdp] as const));
  const gdp = base.regions.map((r) => { const v = gdpBy.get(r.code); return v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v); });
  return { cells, regions, gdp, top: tops, unplaced, total };
}

export function statValue(s: PostcodeStat | null, layer: ValueLayer, prio: Priority): number {
  if (!s) return 0;
  if (layer === "revenue") return s.revenue;
  if (layer === "customers") return s.customers;
  if (layer === "newCustomers") return s.newCustomers;
  if (layer === "priority") return Number(s.priority?.[prio]) || 0;
  return 0;
}

/** Class thresholds for positive values: quantiles, rounded to two significant digits, at most `n` classes. */
export function breaks(values: number[], n = 5): number[] {
  const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length < 2) return [];
  const nice = (x: number) => { const e = Math.pow(10, Math.floor(Math.log10(x)) - 1); return Math.max(1, Math.round(x / e) * e); };
  const out: number[] = [];
  for (let i = 1; i < n; i++) {
    const t = nice(v[Math.min(v.length - 1, Math.floor((v.length * i) / n))]);
    if (t > v[0] && t <= v[v.length - 1] && (!out.length || t > out[out.length - 1])) out.push(t);
  }
  return out;
}

/** 0 = nothing (zero), 1.. = the class (thresholds.length + 1 classes); a value at a threshold opens the next class. */
export function classOf(v: number, thresholds: number[]): number {
  if (!(v > 0)) return 0;
  let c = 1;
  for (const t of thresholds) if (v >= t) c++;
  return c;
}
