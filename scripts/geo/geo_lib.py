# Map assignment geo files (public/geo) - what the builders share. The rules are the ones the 14 first countries were
# built with on 19.10.2026 (GeoNames postal codes + Natural Earth 10m; simplified 0.01 deg, 3 decimals):
#   postcodes/<CC>.json  {"country", "points": [[postcode, lat, lon, regionCode, km2, place], ...]} sorted by postcode
#                        km2 = the postcode's Voronoi cell clipped to the outline in an equal-area projection (EPSG:3035);
#                        postcodes on the very same spot share one cell: the first in the file carries it, the others 0
#   shapes/<CC>.json     {"country", "name", "bbox", "outline", "regions": [{code, name, geometry, group?, km2}], "km2", "insets"?}
#
# INSETS (20.10.2026): far-off islands (the Canaries, Madeira, the Azores) are drawn moved next to the mainland so the
# map's frame is the mainland's. An inset moves the region geometries, the outline's parts and the postcode points of its
# regions by   lon' = lon0 + scale * (lon - lon0) + dlon,   lat' = lat0 + scale * (lat - lat0) + dlat   ([lon0, lat0] =
# "origin"; scale 1 = a plain shift). Region codes, postcodes and every km2 stay as on the real map (km2 is measured
# before the move). shapes/<CC>.json "insets" lists them, "box" = where the inset sits on the moved map.
# Anything that works on real positions (a GDP overlay by area, a distance) has to move them back first: unmove().
import json, os
import numpy as np
import shapely
from shapely.geometry import Polygon, MultiPolygon, mapping, shape
from shapely.ops import transform as sh_transform
from pyproj import Transformer

TOL = 0.01          # degrees, ~0.7-1.1 km
MIN_AREA = 0.0005   # deg2 (~4 km2): smaller islands / holes are dropped (a region always keeps its biggest part)

to_ea = Transformer.from_crs("EPSG:4326", "EPSG:3035", always_xy=True)
proj_ea = lambda g: sh_transform(lambda x, y, z=None: to_ea.transform(x, y), g)


def dump(obj, path):
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(s)
    return len(s.encode("utf-8"))


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def km2_round(a):
    a = a / 1e6
    return round(a, 1) if a < 10 else int(round(a))


def clean(g):
    """drop tiny parts and holes, keep the biggest part"""
    if g.is_empty:
        return g
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g] if isinstance(g, Polygon) else [p for p in getattr(g, "geoms", []) if isinstance(p, (Polygon, MultiPolygon))]
    flat = []
    for p in polys:
        flat.extend(p.geoms if isinstance(p, MultiPolygon) else [p])
    flat = [p for p in flat if not p.is_empty]
    if not flat:
        return Polygon()
    big = max(flat, key=lambda p: p.area)
    keep = []
    for p in flat:
        if p is not big and p.area < MIN_AREA:
            continue
        holes = [h for h in p.interiors if Polygon(h).area >= MIN_AREA]
        keep.append(Polygon(p.exterior, holes))
    return keep[0] if len(keep) == 1 else MultiPolygon(keep)


def finish(g):
    return clean(shapely.set_precision(g, 0.001))


def rnd(coords):
    if isinstance(coords, (list, tuple)) and coords and isinstance(coords[0], (int, float)):
        return [round(coords[0], 3), round(coords[1], 3)]
    return [rnd(c) for c in coords]


def geojson(g):
    m = mapping(g)
    out = {"type": m["type"], "coordinates": rnd(m["coordinates"])}

    def dedupe_ring(ring):
        res = []
        for pt in ring:
            if not res or res[-1] != pt:
                res.append(pt)
        return res
    if out["type"] == "Polygon":
        out["coordinates"] = [dedupe_ring(r) for r in out["coordinates"]]
        out["coordinates"] = [r for r in out["coordinates"] if len(r) >= 4]
    elif out["type"] == "MultiPolygon":
        polys = []
        for p in out["coordinates"]:
            rings = [dedupe_ring(r) for r in p]
            rings = [r for r in rings if len(r) >= 4]
            if rings:
                polys.append(rings)
        out["coordinates"] = polys
    return out


def bbox3(g):
    b = g.bounds
    return [round(b[0], 3), round(b[1], 3), round(b[2], 3), round(b[3], 3)]


# ---- insets ----

def _f(inset, back=False):
    s = float(inset.get("scale", 1))
    lon0, lat0 = inset.get("origin", [0.0, 0.0])
    dlon, dlat = float(inset.get("dlon", 0)), float(inset.get("dlat", 0))
    if not back:
        return lambda x, y: (lon0 + s * (x - lon0) + dlon, lat0 + s * (y - lat0) + dlat)
    return lambda x, y: (lon0 + (x - dlon - lon0) / s, lat0 + (y - dlat - lat0) / s)


def move_xy(inset, lon, lat, back=False):
    x, y = _f(inset, back)(lon, lat)
    return round(x, 3), round(y, 3)


def move_geom(inset, g, back=False):
    f = _f(inset, back)
    return shapely.transform(g, lambda a: np.column_stack(f(a[:, 0], a[:, 1])))


def outline_parts(outline):
    return list(outline.geoms) if isinstance(outline, MultiPolygon) else [outline]


def in_box(g, box):
    p = g.representative_point()
    return box[0] <= p.x <= box[2] and box[1] <= p.y <= box[3]


def unmove(shapes, points=None):
    """The shapes file (and its postcode rows) back on the real map: geometries and points of each inset moved back.
    Returns (outline, {code: geometry}, rows) as shapely geometries / new row lists; files without insets come back as they are."""
    insets = shapes.get("insets") or []
    outline = shape(shapes["outline"]).buffer(0)
    regs = {r["code"]: shape(r["geometry"]).buffer(0) for r in shapes["regions"] if r.get("geometry")}
    rows = [list(p) for p in (points or [])]
    if not insets:
        return outline, regs, rows
    parts = outline_parts(outline)
    for ins in insets:
        codes = set(ins["regions"])
        for c in codes:
            if c in regs:
                regs[c] = move_geom(ins, regs[c], back=True)
        box = ins["box"]
        parts = [move_geom(ins, p, back=True) if in_box(p, box) else p for p in parts]
        for r in rows:
            if len(r) > 3 and r[3] in codes:
                r[2], r[1] = move_xy(ins, float(r[2]), float(r[1]), back=True)
    outline = MultiPolygon([q for p in parts for q in (p.geoms if isinstance(p, MultiPolygon) else [p])])
    return outline, regs, rows


def apply_insets(insets, outline, regions, rows):
    """Move each inset's regions (by code), outline parts (those inside the inset's real-map box `src`) and points
    (by region code). `regions` = list of dicts {code, geometry: shapely}; rows = postcode rows. Fills each inset's
    "box" (its bounds on the moved map). Returns the moved outline."""
    parts = outline_parts(outline)
    for ins in insets:
        codes = set(ins["regions"])
        src = ins.pop("src")
        moved = []
        out = []
        for p in parts:
            if in_box(p, src):
                q = shapely.set_precision(move_geom(ins, p), 0.001)
                moved.append(q)
                out.append(q)
            else:
                out.append(p)
        parts = out
        for r in regions:
            if r["code"] in codes:
                r["geometry"] = shapely.set_precision(move_geom(ins, r["geometry"]), 0.001)
                moved.append(r["geometry"])
        for row in rows:
            if row[3] in codes:
                row[2], row[1] = move_xy(ins, row[2], row[1])
        u = shapely.union_all(moved)
        ins["box"] = bbox3(u)
    flat = []
    for p in parts:
        flat.extend(p.geoms if isinstance(p, MultiPolygon) else [p])
    flat = [p for p in flat if not p.is_empty]
    return flat[0] if len(flat) == 1 else MultiPolygon(flat)


# ---- regions of points, Voronoi km2 (enrich_geo.py of 19.10) ----

def region_codes(rows, regs):
    """rows [pc, lat, lon]; regs [(code, shapely geometry)] -> code per row (nearest region when in none), count outside"""
    xs = np.array([float(p[2]) for p in rows]); ys = np.array([float(p[1]) for p in rows])
    code = [None] * len(rows)
    for c, g in regs:
        shapely.prepare(g)
        hit = shapely.contains_xy(g, xs, ys)
        for i in np.nonzero(hit)[0]:
            if code[i] is None:
                code[i] = c
    outside = [i for i, c in enumerate(code) if c is None]
    for i in outside:
        p = shapely.Point(xs[i], ys[i])
        code[i] = min(regs, key=lambda cg: cg[1].distance(p))[0]
    return code, len(outside)


def voronoi_km2(rows, outline):
    """m2 per row: the Voronoi cell of its spot clipped to the outline (EPSG:3035); same spot = first row carries it"""
    outline_ea = proj_ea(outline)
    first = {}
    owner_of = []
    for i, p in enumerate(rows):
        k = (p[1], p[2])
        if k not in first:
            first[k] = i
            owner_of.append(i)
    uniq = [rows[i] for i in owner_of]
    area = [0.0] * len(rows)
    if len(uniq) == 1:
        area[owner_of[0]] = outline_ea.area
        return area, outline_ea.area, len(uniq)
    exy = np.array([to_ea.transform(float(p[2]), float(p[1])) for p in uniq])
    mp = shapely.MultiPoint(exy)
    env = outline_ea.envelope.buffer(200_000)
    cells = list(shapely.voronoi_polygons(mp, extend_to=env, ordered=True).geoms)
    assert len(cells) == len(uniq), (len(cells), len(uniq))
    cells = np.array(cells, dtype=object)
    shapely.prepare(outline_ea)
    within = shapely.within(cells, outline_ea)
    a = shapely.area(cells)
    cross = np.nonzero(~within)[0]
    if len(cross):
        a[cross] = shapely.area(shapely.intersection(cells[cross], outline_ea))
    for j, i in enumerate(owner_of):
        area[i] = float(a[j])
    return area, outline_ea.area, len(uniq)


def simplify_regions(geoms):
    try:
        return list(shapely.coverage_simplify(geoms, TOL)), "coverage"
    except Exception as e:  # not a clean coverage: simplify one by one
        return [shapely.simplify(g, TOL, preserve_topology=True) for g in geoms], "each (" + str(e)[:60] + ")"
