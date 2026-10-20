# Map assignment geo files for Portugal (PT) and the United Kingdom (GB), 20.10.2026 (SARCLA: "Portugal map is missing,
# UK map doesn't work"): public/geo/postcodes/<CC>.json + public/geo/shapes/<CC>.json, made the way the 14 first
# countries were (19.10: GeoNames postal codes, Natural Earth 10m admin-0 outline / admin-1 regions; see geo_lib.py).
#
#   PT  points  = the 4-digit CP4 ("1000"), one per CP4: the mean of its CP7s' spots ("1000-001", GeoNames PT.zip has
#                 ~198,000), place = the CP4's most common concelho
#       regions = the 18 districts + the autonomous regions Azores (PT-20) and Madeira (PT-30), Natural Earth admin-1
#                 (ISO 3166-2), group = Natural Earth's region (Norte, Centro, Lisbon, Alentejo, Algarve; Aveiro "Norte,
#                 Centro" -> Centro, where most of it lies)
#       insets  = Madeira moved next to the mainland (a plain shift), the Azores shifted AND drawn at half size - at
#                 full size they are twice as wide as the mainland and would shrink it by ~30 %
#   GB  points  = the outward codes ("SW1A", "B1", "BT7") that still have live postcodes (GeoNames GB_full.csv.zip,
#                 ~1.8 M postcodes): spot = the mean of the district's postcodes; GB.zip's legacy / closed districts
#                 ("W1", "EC1", "SW1", "OX6" ...) left out, the Isle of Man / Guernsey / Jersey (IM, GY, JE: not the UK)
#                 left out; place = GB.zip's name for it (the most common one), else GB_full's
#       regions = the 12 ITL1 regions (ex NUTS 1; ITL1 codes "TLC".."TLN" as "GB-TLC" ...): 9 English regions + Wales,
#                 Scotland, Northern Ireland - Natural Earth's 232 counties / unitary authorities joined by their
#                 region; group = the nation (England, Wales, Scotland, Northern Ireland)
#
# usage: python -I scripts/geo/build_pt_gb.py <geonames dir: PT.zip GB.zip GB_full.csv.zip>
#          <natural earth dir: ne_10m_admin_0_countries.geojson ne_10m_admin_1_states_provinces.geojson> <public/geo> [PT|GB ...]
import io, os, re, sys, zipfile
from collections import Counter, defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import shapely
from shapely.geometry import shape
from geo_lib import (apply_insets, bbox3, dump, finish, geojson, km2_round, load, proj_ea, region_codes,
                     simplify_regions, voronoi_km2)

sys.stdout.reconfigure(encoding="utf-8")
GN, NE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
ONLY = [a.upper() for a in sys.argv[4:]] or ["PT", "GB"]


def zip_text(name, member):
    with zipfile.ZipFile(os.path.join(GN, name)) as z:
        return z.read(member).decode("utf-8")


def rows_of(txt, cc):
    for line in txt.splitlines():
        r = line.split("\t")
        if len(r) >= 11 and r[0] == cc and r[1].strip() and r[9].strip() and r[10].strip():
            yield r


# ---- points ----

def points_pt():
    cp7 = {}
    for r in rows_of(zip_text("PT.zip", "PT.txt"), "PT"):
        pc = r[1].strip()
        if not re.fullmatch(r"\d{4}-\d{3}", pc) or pc in cp7:
            continue
        cp7[pc] = (float(r[9]), float(r[10]), r[5].strip() or r[2].strip())
    acc = defaultdict(lambda: [0.0, 0.0, 0, Counter()])
    for pc, (lat, lon, conc) in cp7.items():
        a = acc[pc[:4]]
        a[0] += lat; a[1] += lon; a[2] += 1; a[3][conc] += 1
    pts = [[k, round(a[0] / a[2], 3), round(a[1] / a[2], 3)] for k, a in sorted(acc.items())]
    place = {k: a[3].most_common(1)[0][0] for k, a in acc.items()}
    print(f"PT: {len(cp7)} CP7 -> {len(pts)} CP4")
    return pts, place


NOT_UK = ("IM", "GY", "JE")


def points_gb():
    small = defaultdict(list)
    for r in rows_of(zip_text("GB.zip", "GB.txt"), "GB"):
        small[r[1].strip()].append(r[2].strip())
    acc = defaultdict(lambda: [0.0, 0.0, 0, Counter()])
    with zipfile.ZipFile(os.path.join(GN, "GB_full.csv.zip")) as z:
        with z.open("GB_full.txt") as f:
            for line in io.TextIOWrapper(f, encoding="utf-8"):
                r = line.rstrip("\n").split("\t")
                if len(r) < 11 or r[0] != "GB" or not r[9] or not r[10]:
                    continue
                out = r[1].strip().split(" ")[0]
                if not out or out.startswith(NOT_UK):
                    continue
                a = acc[out]
                a[0] += float(r[9]); a[1] += float(r[10]); a[2] += 1; a[3][r[2].strip()] += 1
    freq = Counter(n for ns in small.values() for n in ns)
    place = {}
    for k, a in acc.items():
        ns = small.get(k)
        place[k] = max(ns, key=lambda n: (freq[n], -ns.index(n))) if ns else re.sub(r" \(B\)$", "", a[3].most_common(1)[0][0])
    pts = [[k, round(a[0] / a[2], 3), round(a[1] / a[2], 3)] for k, a in sorted(acc.items())]
    legacy = sorted(k for k in small if k not in acc and not k.startswith(NOT_UK))
    added = sorted(k for k in acc if k not in small)
    print(f"GB: {len(pts)} outward codes with live postcodes ({sum(a[2] for a in acc.values())} postcodes); "
          f"GB.zip codes left out (legacy / closed): {len(legacy)} {legacy}; not in GB.zip: {added}")
    return pts, place


# ---- regions ----

PT_GROUP_FIX = {"Norte, Centro": "Centro"}
ITL1 = {  # Natural Earth admin-1 region (England) / geonunit -> ITL1
    "North East": ("GB-TLC", "North East"), "North West": ("GB-TLD", "North West"),
    "Yorkshire and the Humber": ("GB-TLE", "Yorkshire and The Humber"), "East Midlands": ("GB-TLF", "East Midlands"),
    "West Midlands": ("GB-TLG", "West Midlands"), "East": ("GB-TLH", "East of England"), "Greater London": ("GB-TLI", "London"),
    "South East": ("GB-TLJ", "South East"), "South West": ("GB-TLK", "South West"),
    "Wales": ("GB-TLL", "Wales"), "Scotland": ("GB-TLM", "Scotland"), "Northern Ireland": ("GB-TLN", "Northern Ireland"),
}


def regions_of(cc, admin1):
    feats = [f for f in admin1 if f["properties"].get("iso_a2") == cc]
    if cc == "PT":
        out = []
        for f in feats:
            p = f["properties"]
            g = (p.get("region") or "").strip()
            out.append((p["iso_3166_2"], p.get("name") or p.get("name_en"), PT_GROUP_FIX.get(g, g), shape(f["geometry"]).buffer(0)))
        return out
    parts = defaultdict(list)
    for f in feats:
        p = f["properties"]
        nation = p.get("geonunit")
        key = p.get("region") if nation == "England" else nation
        if key not in ITL1:
            raise SystemExit(f"GB: no ITL1 for {p.get('name')} ({nation} / {p.get('region')})")
        parts[(ITL1[key], nation)].append(shape(f["geometry"]).buffer(0))
    return [(code, name, nation, shapely.union_all(gs).buffer(0)) for ((code, name), nation), gs in parts.items()]


# ---- insets (see geo_lib.py) ----
# src = where the inset's outline parts are on the real map; origin = the point it is scaled around
INSETS = {
    "PT": [
        {"name": "Azores", "regions": ["PT-20"], "src": [-32.0, 36.0, -24.0, 40.5], "origin": [-31.3, 39.73], "scale": 0.5, "dlon": 18.2, "dlat": 1.27},
        {"name": "Madeira", "regions": ["PT-30"], "src": [-17.5, 29.5, -15.5, 33.5], "dlon": 5.8, "dlat": 5.0},
    ],
}


def build(cc, countries, admin1):
    feat = next(f for f in countries if f["properties"].get("ISO_A2_EH") == cc)
    name = feat["properties"]["ADMIN"]
    pts, place = points_pt() if cc == "PT" else points_gb()
    outline = finish(shapely.simplify(shape(feat["geometry"]).buffer(0), 0.01, preserve_topology=True))
    regs = regions_of(cc, admin1)
    simp, how = simplify_regions([r[3] for r in regs])
    regions = []
    for (code, rname, group, _), g in zip(regs, simp):
        g = finish(g)
        if g.is_empty:
            print("  empty region", cc, code)
            continue
        regions.append({"code": code, "name": rname, "group": group, "geometry": g})
    regions.sort(key=lambda r: r["code"])
    # on the real map: each point's region, the regions' and the postcodes' km2
    codes, outside = region_codes(pts, [(r["code"], r["geometry"]) for r in regions])
    for r in regions:
        r["km2"] = km2_round(proj_ea(r["geometry"]).area)
    area, outline_m2, spots = voronoi_km2(pts, outline)
    rows = [[p[0], p[1], p[2], codes[i], km2_round(area[i]), place.get(p[0], "")] for i, p in enumerate(pts)]
    insets = [dict(i) for i in INSETS.get(cc, [])]
    if insets:
        outline = apply_insets(insets, outline, regions, rows)
    shp = {"country": cc, "name": name, "bbox": bbox3(outline), "outline": geojson(outline), "regions": [], "km2": km2_round(outline_m2)}
    for r in regions:
        o = {"code": r["code"], "name": r["name"], "geometry": geojson(r["geometry"])}
        if r["group"]:
            o["group"] = r["group"]
        o["km2"] = r["km2"]
        shp["regions"].append(o)
    if insets:
        shp["insets"] = insets
    sb = dump(shp, os.path.join(OUT, "shapes", cc + ".json"))
    pb = dump({"country": cc, "points": rows}, os.path.join(OUT, "postcodes", cc + ".json"))
    per = Counter(r[3] for r in rows)
    print(f"{cc} {name}: points {len(rows)} spots {spots} outside regions {outside} | regions {len(regions)} ({how}) "
          f"| cells km2 {sum(area) / 1e6:.0f} outline km2 {shp['km2']} regions km2 {sum(r['km2'] for r in regions)} "
          f"| bbox {shp['bbox']} | postcodes {pb / 1024:.0f} KB shapes {sb / 1024:.0f} KB")
    for r in regions:
        print(f"   {r['code']:7} {r['name']:28} {str(r['group']):18} km2 {r['km2']:>7} points {per.get(r['code'], 0)}")
    for i in insets:
        print("   inset", i)


countries = load(os.path.join(NE, "ne_10m_admin_0_countries.geojson"))["features"]
admin1 = load(os.path.join(NE, "ne_10m_admin_1_states_provinces.geojson"))["features"]
for cc in ONLY:
    build(cc, countries, admin1)
