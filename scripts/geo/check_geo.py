# Checks public/geo against what the page and the hub read (shared.tsx loadGeo, mapModel.buildBase, plan.ts zipIndex):
# every country in index.json has both files and they parse; points are [postcode, lat, lon, regionCode, km2, place]
# with 3-decimal lat/lon, sorted, one per cleaned postcode; every point's region is in the shapes; region codes as
# plan.ts accepts them, unique; geometries valid; points inside the (drawn) outline; insets clear of the mainland;
# km2: postcodes' sum vs the outline vs the regions; index.json numbers = the files.
# usage: python -I scripts/geo/check_geo.py <public/geo> [CC ...]      exit 1 on a problem
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import shapely
from shapely.geometry import shape
from geo_lib import in_box, load, outline_parts

sys.stdout.reconfigure(encoding="utf-8")
GEO = sys.argv[1]
ONLY = [a.upper() for a in sys.argv[2:]]
REGION = re.compile(r"^[A-Z0-9]{1,4}(-[A-Z0-9]{1,6})?$")


def clean_zip(z):  # rules.ts cleanZip
    z = str(z or "").upper()
    z = re.sub(r"^[A-Z]{1,2}-(?=\d)", "", z)
    return re.sub(r"[\s-]", "", z)


index = load(os.path.join(GEO, "index.json"))
problems = []
for e in index:
    cc = e["country"]
    if ONLY and cc not in ONLY:
        continue
    bad = lambda m: problems.append(f"{cc}: {m}")
    pp, sp = os.path.join(GEO, "postcodes", cc + ".json"), os.path.join(GEO, "shapes", cc + ".json")
    pts, shp = load(pp), load(sp)
    rows = pts["points"]
    if pts.get("country") != cc or shp.get("country") != cc:
        bad("country field")
    if e["points"] != len(rows) or e["bytes"] != os.path.getsize(pp) or e["shapeBytes"] != os.path.getsize(sp) or e["regions"] != len(shp["regions"]) or e["bbox"] != shp["bbox"]:
        bad("index.json entry is not the files'")
    codes = [r["code"] for r in shp["regions"]]
    if len(set(codes)) != len(codes):
        bad("region code twice")
    for c in codes:
        if not REGION.match(c):
            bad(f"region code {c} is not one plan.ts accepts")
    known = set(codes)
    shape_rows = [r for r in rows if not (isinstance(r, list) and len(r) == 6 and isinstance(r[0], str) and isinstance(r[1], (int, float)) and isinstance(r[2], (int, float)) and isinstance(r[3], str) and isinstance(r[4], (int, float)) and isinstance(r[5], str))]
    if shape_rows:
        bad(f"{len(shape_rows)} rows not [postcode, lat, lon, region, km2, place]: {shape_rows[:2]}")
    if any(round(r[1], 3) != r[1] or round(r[2], 3) != r[2] for r in rows):
        bad("lat/lon with more than 3 decimals")
    if [r[0] for r in rows] != sorted(r[0] for r in rows):
        bad("points not sorted by postcode")
    cl = [clean_zip(r[0]) for r in rows]
    if len(set(cl)) != len(cl):
        bad(f"{len(cl) - len(set(cl))} postcodes the same once cleaned")
    unknown = sorted({r[3] for r in rows} - known)
    if unknown:
        bad(f"points in regions the shapes lack: {unknown}")
    if any(r[4] < 0 for r in rows):
        bad("negative km2")
    outline = shape(shp["outline"])
    regs = [shape(r["geometry"]) for r in shp["regions"]]
    if not outline.is_valid:
        bad("outline not valid")
    inv = [c for c, g in zip(codes, regs) if not g.is_valid]
    if inv:
        bad(f"regions not valid: {inv}")
    ob = outline.buffer(0.02)
    shapely.prepare(ob)
    xs = np.array([r[2] for r in rows]); ys = np.array([r[1] for r in rows])
    inside = int(shapely.contains_xy(ob, xs, ys).sum())
    # each region's points near the region itself (an inset moves both)
    far = 0
    gi = {c: g.buffer(0.05) for c, g in zip(codes, regs)}
    for r in rows:
        g = gi.get(r[3])
        if g is not None and not g.contains(shapely.Point(r[2], r[1])):
            far += 1
    for ins in shp.get("insets") or []:
        box = shapely.box(*ins["box"])
        main = shapely.union_all([p for p in outline_parts(outline) if not in_box(p, ins["box"])])
        if main.intersects(box):
            bad(f"inset {ins['name']} overlaps the rest of the country")
        for c in ins["regions"]:
            if c not in known:
                bad(f"inset region {c} not in the shapes")
    psum = sum(r[4] for r in rows)
    rsum = sum(r.get("km2") or 0 for r in shp["regions"])
    km2 = shp.get("km2")
    if km2 and abs(psum - km2) / km2 > 0.01:
        bad(f"postcodes' km2 {psum:.0f} vs outline {km2}")
    if far > max(5, 0.01 * len(rows)):
        bad(f"{far} points far from their own region")
    print(f"{cc:2} points {len(rows):6} regions {len(codes):3} | points in outline {inside}/{len(rows)}, far from own region {far} "
          f"| km2 postcodes {psum:9.0f} outline {km2} regions {rsum} | insets {[i['name'] for i in shp.get('insets') or []]}")
print("\n".join(problems) if problems else "OK")
sys.exit(1 if problems else 0)
