# Spain's map with the Canary Islands as an inset (SARCLA 20.10.2026: "Spain map is broken" - the islands, 1,000 km
# south-west of the peninsula, stretched the frame so the mainland drew small). Moves Las Palmas (ES-GC) and Santa Cruz
# de Tenerife (ES-TF) - their region geometries, the outline's island parts and their postcode points (35xxx, 38xxx) -
# by a plain shift into the empty sea below the Gulf of Cadiz, west of Ceuta: the frame becomes the peninsula's (with
# the Balearics, Ceuta and Melilla where they are). Codes, postcodes and every km2 stay as they were (measured on the
# real map). Writes shapes/ES.json "insets" (see geo_lib.py) and the new bbox. Runs once: a file that has the inset is
# left alone.
# usage: python -I scripts/geo/es_canaries_inset.py <public/geo>
#
# Also mended on the way: GeoNames puts 35290 / 35299 (San Bartolome de Tirajana, Gran Canaria) on Tenerife
# (28.223, -16.57 - a degree of longitude off), so the 19.10 file had them in ES-TF with a cell carved out of Tenerife.
# They go to the municipality's seat (Tunte) and back to Las Palmas; the islands' cells are measured again (the
# peninsula's come out as they were - checked below).
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import shape
from geo_lib import apply_insets, bbox3, dump, geojson, km2_round, load, region_codes, voronoi_km2

sys.stdout.reconfigure(encoding="utf-8")
GEO = sys.argv[1]
INSET = {"name": "Canary Islands", "regions": ["ES-GC", "ES-TF"], "src": [-18.5, 27.3, -13.0, 29.6], "dlon": 8.9, "dlat": 5.9}
FIX = {"35290": (27.917, -15.575), "35299": (27.917, -15.575)}  # Tunte, San Bartolome de Tirajana

sp, pp = os.path.join(GEO, "shapes", "ES.json"), os.path.join(GEO, "postcodes", "ES.json")
shp, pts = load(sp), load(pp)
if shp.get("insets"):
    sys.exit("ES already has its inset: " + str(shp["insets"]))
rows = pts["points"]
regions = [{"code": r["code"], "geometry": shape(r["geometry"])} for r in shp["regions"]]
outline = shape(shp["outline"])
fixed = [r for r in rows if r[0] in FIX]
for r in fixed:
    r[1], r[2] = FIX[r[0]]
    r[3] = region_codes([r], [(g["code"], g["geometry"].buffer(0)) for g in regions])[0][0]
area, _, _ = voronoi_km2(rows, outline.buffer(0))
changed = []
for r, a in zip(rows, area):
    k = km2_round(a)
    if k != r[4]:
        changed.append((r[0], r[4], k))
        r[4] = k
outside = [c for c in changed if c[0][:2] not in ("35", "38")]
print(f"ES: mended {[(r[0], r[1], r[2], r[3]) for r in fixed]}; km2 changed on {len(changed)} rows, "
      f"{len(outside)} of them off the islands {outside[:10]}")
assert len(outside) <= 3, "the peninsula's cells should come out as the 19.10 build made them"
canary = [r for r in rows if r[3] in INSET["regions"]]
by_pc = [r for r in rows if r[0][:2] in ("35", "38")]
assert {id(r) for r in canary} == {id(r) for r in by_pc}, "Canary points by region and by postcode differ"
before = shp["bbox"]
ins = dict(INSET)
outline = apply_insets([ins], outline, regions, rows)
geo = {r["code"]: r["geometry"] for r in regions}
for r in shp["regions"]:
    if r["code"] in INSET["regions"]:
        r["geometry"] = geojson(geo[r["code"]])
shp["outline"] = geojson(outline)
shp["bbox"] = bbox3(outline)
out = {}
for k in ("country", "name", "bbox", "outline", "regions", "km2"):
    out[k] = shp[k]
out["insets"] = [ins]
sb = dump(out, sp)
pb = dump(pts, pp)
print(f"ES: {len(canary)} Canary points moved, bbox {before} -> {out['bbox']}, inset {ins}, shapes {sb} B postcodes {pb} B")
