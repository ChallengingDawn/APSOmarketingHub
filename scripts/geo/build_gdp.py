# GDP per map region (public/geo/gdp/<CC>.json {code: MEUR}, public/geo/gdp/index.json) - the 19.10.2026 build
# (scratchpad build_gdp.py) for the countries named, the others' files and index entries left as they are.
# Eurostat NUTS 3 GDP: each NUTS 3 region's share of the country's regional GDP (latest year every region has) x the
# country's GDP 2024, given whole to the map region holding >= 60 % of its area; a NUTS 3 region split between map
# regions leaves the regions it touches unknown (null). Insets (geo_lib.py) are moved back to the real map first.
# usage: python -I scripts/geo/build_gdp.py <dir with nuts3_gdp.json country_gdp_eurostat.json nuts3_2024.geojson> <public/geo> CC [CC ...]
import collections, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pyproj
from shapely.geometry import shape
from shapely.ops import transform
from geo_lib import load, unmove

sys.stdout.reconfigure(encoding="utf-8")
R, HUB, ONLY = sys.argv[1], sys.argv[2], [c.upper() for c in sys.argv[3:]]
OUT = os.path.join(HUB, "gdp")
NEST = 0.6
EU = {"GR": "EL", "GB": "UK"}


def jsonstat(fn):
    d = load(fn)
    ids, size = d["id"], d["size"]
    inv = {k: {i: v for v, i in d["dimension"][k]["category"]["index"].items()} for k in ids}
    out = {}
    for flat, val in d["value"].items():
        flat, idx = int(flat), {}
        for k, s in zip(reversed(ids), reversed(size)):
            idx[k] = inv[k][flat % s]; flat //= s
        out[(idx["geo"], idx["time"])] = val
    return out


g3 = jsonstat(os.path.join(R, "nuts3_gdp.json"))
gc = jsonstat(os.path.join(R, "country_gdp_eurostat.json"))
nuts = collections.defaultdict(list)
for f in load(os.path.join(R, "nuts3_2024.geojson"))["features"]:
    nuts[f["properties"]["CNTR_CODE"]].append((f["properties"]["NUTS_ID"], shape(f["geometry"])))
index = load(os.path.join(OUT, "index.json"))

for cc in ONLY:
    sh = load(os.path.join(HUB, "shapes", cc + ".json"))
    outline, regs, _ = unmove(sh)
    regions = [(r["code"], regs[r["code"]]) for r in sh["regions"] if r["code"] in regs]
    e = EU.get(cc, cc)
    cg = gc.get((e, "2024"))
    rs = nuts.get(e, [])
    year = next((y for y in ("2024", "2023", "2022", "2021") if rs and all(g3.get((nid, y)) is not None for nid, _ in rs)), None)
    out = {code: None for code, _ in regions}
    if cg is None or not year:
        index[cc] = {"unit": "MEUR", "year": 2024, "regionalYear": None, "countryGdp": round(cg, 1) if cg else None,
                     "onMap": 0, "outsideMap": 0, "regions": len(out), "known": 0}
        print(f"{cc}: no regional GDP")
    else:
        c = outline.representative_point()
        f = pyproj.Transformer.from_crs("EPSG:4326", f"+proj=laea +lat_0={c.y} +lon_0={c.x} +ellps=WGS84", always_xy=True).transform
        rp = [(code, transform(f, g)) for code, g in regions]
        total = sum(g3[(nid, year)] for nid, _ in rs)
        acc = collections.Counter()
        unknown, split, outside = set(), [], 0.0
        for nid, geom in rs:
            gp = transform(f, geom)
            val = cg * g3[(nid, year)] / total
            ov = [(code, gp.intersection(g).area / gp.area) for code, g in rp if gp.intersects(g)]
            ov = [(code, s) for code, s in ov if s > 0.001]
            if not ov:
                outside += val
                continue
            best = max(ov, key=lambda x: x[1])
            if best[1] >= NEST:
                acc[best[0]] += val
            else:
                split.append(f"{nid} ({', '.join(f'{code} {s:.0%}' for code, s in sorted(ov, key=lambda x: -x[1]) if s >= 0.05)})")
                for code, s in ov:
                    if s >= 0.05:
                        unknown.add(code)
        for code in out:
            out[code] = None if code in unknown or code not in acc else round(acc[code], 1)
        known = sum(v for v in out.values() if v is not None)
        index[cc] = {"unit": "MEUR", "year": 2024, "regionalYear": int(year), "countryGdp": round(cg, 1),
                     "onMap": round(known, 1), "outsideMap": round(outside, 1), "regions": len(out),
                     "known": sum(1 for v in out.values() if v is not None)}
        print(f"{cc}: {index[cc]['known']}/{len(out)} regions, {known / cg * 100:.1f}% of {round(cg):,} MEUR on the map, "
              f"outside {outside / cg * 100:.1f}%, regional {year}; split NUTS3: {split}")
    with open(os.path.join(OUT, cc + ".json"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
src = index.pop("_source", None)
index = dict(sorted(index.items()))
if src:
    index["_source"] = src
with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8", newline="\n") as fh:
    fh.write(json.dumps(index, ensure_ascii=False, indent=1))
