# public/geo/index.json from the files as they are: one entry per country with both postcodes/<CC>.json and
# shapes/<CC>.json - points, bytes (postcodes file), shapeBytes, regions, bbox (the drawn frame: insets moved), and
# for a country with insets the moves (geo_lib.py) and a note. Order: the 19.10 order, new countries after it.
# usage: python -I scripts/geo/geo_index.py <public/geo>
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geo_lib import dump, load

sys.stdout.reconfigure(encoding="utf-8")
GEO = sys.argv[1]
ORDER = ["CH", "LI", "DE", "FR", "IT", "AT", "NL", "BE", "PL", "ES", "CZ", "LU", "DK", "SE", "PT", "GB"]
NOTES = {
    "ES": "Canary Islands (ES-GC, ES-TF, postcodes 35/38) drawn as an inset below the Gulf of Cadiz: moved +8.9 lon / +5.9 lat; km2 as on the real map",
    "PT": "Postcodes = CP4 (the 4 digits of 1000-001). Insets: Madeira (PT-30) moved +5.8 lon / +5.0 lat, Azores (PT-20) at half size around (-31.3, 39.73) then moved +18.2 / +1.27; km2 as on the real map",
    "GB": "Postcodes = outward codes (SW1A, B1, BT7). Regions = the 12 ITL1 regions (GB-TLC North East .. GB-TLN Northern Ireland; ex NUTS 1 UKC..UKN), group = the nation",
}
have = {f[:2] for f in os.listdir(os.path.join(GEO, "postcodes")) if f.endswith(".json")} & {f[:2] for f in os.listdir(os.path.join(GEO, "shapes")) if f.endswith(".json")}
index = []
for cc in [c for c in ORDER if c in have] + sorted(have - set(ORDER)):
    pp, sp = os.path.join(GEO, "postcodes", cc + ".json"), os.path.join(GEO, "shapes", cc + ".json")
    pts, shp = load(pp), load(sp)
    e = {"country": cc, "name": shp["name"], "points": len(pts["points"]), "bytes": os.path.getsize(pp), "shapeBytes": os.path.getsize(sp),
         "regions": len(shp["regions"]), "bbox": shp["bbox"]}
    if shp.get("insets"):
        e["insets"] = [{k: v for k, v in i.items()} for i in shp["insets"]]
    if cc in NOTES:
        e["note"] = NOTES[cc]
    index.append(e)
    print(cc, {k: v for k, v in e.items() if k not in ("insets", "note")})
n = dump(index, os.path.join(GEO, "index.json"))
print("index.json", n, "bytes,", len(index), "countries")
