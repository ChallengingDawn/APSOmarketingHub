# Map assignment geo files for 15 more countries, 07.11.2026 (SARCLA on Europe's map: "possible d'avoir la Norvège et
# la Finlande? il manque la Croatie - la Croatie, Serbie, Bosnie etc. jusqu'en Grèce" - "do them all"):
# public/geo/postcodes/<CC>.json + public/geo/shapes/<CC>.json, made as the first countries were (geo_lib.py: Natural
# Earth 10m admin-0 outline / admin-1 regions, simplified 0.01 deg, Voronoi km2 in EPSG:3035).
#
# POSTCODES FROM GEONAMES (export/zip/<CC>.zip): NO FI SI HR RS MK AL HU SK RO BG - one point per postcode, at the mean
#   of the places GeoNames gives it, its place = the one nearest that mean. Norway without Svalbard / Jan Mayen.
#   Romania: GeoNames has ~38,000 street-level codes, most of a town's at the very same spot - one per spot is kept (a
#   company's code finds its town's through the nearest one, plan.ts placeZip).
# POSTAL AREAS ON THEIR MAIN TOWN: GR BA ME XK - GeoNames has no postcodes for them. One point per 2-digit postal area
#   ("71xxx" = every code starting 71), on the main town of that area (GeoNames export/dump/<CC>.zip, the most populous
#   place of that name): companies land in the right part of the country, not on their exact spot.
# REGIONS: Natural Earth admin-1 as it is, except
#   SI  193 municipalities -> the 12 statistical regions      MK  84 municipalities -> the 8 statistical regions
#   HU  the cities with county rights -> back into their county (19 counties + Budapest)
#   XK  30 municipalities -> the 7 districts                  ME  21 municipalities -> the 3 regions (north, centre, coast)
#   GR  Mount Athos -> Central Macedonia; English names      BA  the cantons / regions under codes of their own
#   NO  Svalbard and Jan Mayen left out (the outline too: they would stretch Europe's frame to 81 deg N)
# usage: python -I scripts/geo/build_more.py <geonames dir> <natural earth dir> <public/geo> [CC ...]
import os, re, sys, zipfile, unicodedata
from collections import Counter, defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import shapely
from shapely.geometry import shape, box
import geo_lib
from geo_lib import bbox3, dump, finish, geojson, km2_round, load, proj_ea, region_codes, simplify_regions, voronoi_km2

sys.stdout.reconfigure(encoding="utf-8")
GN, NE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
GN_CC = ["NO", "FI", "SI", "HR", "RS", "MK", "AL", "HU", "SK", "RO", "BG"]
AREA_CC = ["GR", "BA", "ME", "XK"]
ONLY = [a.upper() for a in sys.argv[4:]] or GN_CC + AREA_CC
REGION = re.compile(r"^[A-Z0-9]{1,4}(-[A-Z0-9]{1,6})?$")


def ascii_(s):
    return unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().strip()


def clean_zip(z):  # rules.ts cleanZip, for the uniqueness of the keys
    z = str(z or "").upper().strip()
    m = re.fullmatch(r"(\d{4})(?:\s*-\s*|\s+)\d{3}", z)
    if m:
        return m.group(1)
    return re.sub(r"[\s-]", "", re.sub(r"^[A-Z]{1,2}-(?=\d)", "", z))


# ---- points: GeoNames postcodes ----

def gn_rows(cc):
    with zipfile.ZipFile(os.path.join(GN, f"{cc}.zip")) as z:
        txt = z.read(f"{cc}.txt").decode("utf-8")
    for line in txt.splitlines():
        r = line.split("\t")
        if len(r) >= 11 and r[0] == cc and r[1].strip() and r[9].strip() and r[10].strip():
            yield r


def points_gn(cc):
    by = defaultdict(list)
    for r in gn_rows(cc):
        lat, lon = float(r[9]), float(r[10])
        if cc == "NO" and lat > 71.5:  # Svalbard, Jan Mayen
            continue
        by[r[1].strip()].append((lat, lon, r[2].strip()))
    pts, place, seen, spots = [], {}, set(), set()
    dropped = 0
    for pc in sorted(by):
        L = by[pc]
        lat = sum(x[0] for x in L) / len(L); lon = sum(x[1] for x in L) / len(L)
        k = clean_zip(pc)
        if k in seen:
            continue
        spot = (round(lat, 3), round(lon, 3))
        if cc == "RO" and spot in spots:
            dropped += 1
            continue
        seen.add(k); spots.add(spot)
        pts.append([pc, spot[0], spot[1]])
        place[pc] = min(L, key=lambda x: (x[0] - lat) ** 2 + (x[1] - lon) ** 2)[2]
    print(f"{cc}: {len(by)} GeoNames postcodes -> {len(pts)} points" + (f" ({dropped} on a spot already taken left out)" if dropped else ""))
    return pts, place


# ---- points: postal areas on their main town ----
# 2-digit postal area -> the town (GeoNames names, tried in order)
AREAS = {
    "GR": {
        "10": ["Athens"], "11": ["Athens"], "12": ["Peristeri"], "13": ["Acharnes", "Acharnai"], "14": ["Kifisia", "Kifissia"],
        "15": ["Marousi", "Maroussi"], "16": ["Glyfada"], "17": ["Kallithea"], "18": ["Piraeus"], "19": ["Rafina"],
        "20": ["Korinthos", "Corinth"], "21": ["Nafplio", "Nafplion"], "22": ["Tripoli"], "23": ["Sparti"], "24": ["Kalamata"],
        "25": ["Aigio", "Aiyion"], "26": ["Patra", "Patras"], "27": ["Pyrgos"], "28": ["Argostoli", "Argostolion"], "29": ["Zakynthos", "Zakinthos"],
        "30": ["Agrinio", "Agrinion"], "31": ["Lefkada"], "32": ["Livadeia", "Livadia"], "33": ["Amfissa"], "34": ["Chalkida", "Chalkis"],
        "35": ["Lamia"], "36": ["Karpenisi", "Karpenision"], "37": ["Almyros"], "38": ["Volos"], "40": ["Tyrnavos"], "41": ["Larisa", "Larissa"],
        "42": ["Trikala"], "43": ["Karditsa"], "44": ["Konitsa"], "45": ["Ioannina"], "46": ["Igoumenitsa"], "47": ["Arta"], "48": ["Preveza"],
        "49": ["Kerkyra", "Corfu"], "50": ["Kozani"], "51": ["Grevena"], "52": ["Kastoria"], "53": ["Florina"], "54": ["Thessaloniki"],
        "55": ["Kalamaria"], "56": ["Evosmos"], "57": ["Sindos", "Thermi"], "58": ["Edessa"], "59": ["Veroia", "Veria"], "60": ["Katerini"],
        "61": ["Kilkis"], "62": ["Serres"], "63": ["Polygyros", "Poligiros"], "64": ["Eleftheroupoli", "Elevtheroupolis"], "65": ["Kavala"],
        "66": ["Drama"], "67": ["Xanthi"], "68": ["Alexandroupoli", "Alexandroupolis"], "69": ["Komotini"], "70": ["Chersonisos", "Limenas Chersonisou", "Moires"],
        "71": ["Irakleion", "Heraklion", "Iraklion"], "72": ["Agios Nikolaos"], "73": ["Chania"], "74": ["Rethymno", "Rethymnon"], "80": ["Kythira", "Kythera"],
        "81": ["Mytilene", "Mytilini"], "82": ["Chios"], "83": ["Samos", "Vathy"], "84": ["Ermoupoli", "Ermoupolis"], "85": ["Rodos", "Rhodes"],
    },
    "BA": {
        "70": ["Jajce"], "71": ["Sarajevo"], "72": ["Zenica"], "73": ["Gorazde"], "74": ["Doboj"], "75": ["Tuzla"], "76": ["Bijeljina"],
        "77": ["Bihac"], "78": ["Banja Luka"], "79": ["Prijedor"], "80": ["Livno"], "88": ["Mostar"], "89": ["Trebinje"],
    },
    "ME": {"81": ["Podgorica"], "84": ["Bijelo Polje"], "85": ["Budva"]},
    "XK": {**{f"1{d}": ["Pristina", "Prishtine"] for d in range(10)}, **{f"2{d}": ["Prizren"] for d in range(10)},
           **{f"3{d}": ["Peje", "Pec", "Peja"] for d in range(10)}, **{f"4{d}": ["Mitrovice", "Mitrovica", "Kosovska Mitrovica"] for d in range(10)},
           **{f"5{d}": ["Gjakove", "Gjakova", "Dakovica"] for d in range(10)}, **{f"6{d}": ["Gjilan", "Gnjilane"] for d in range(10)},
           **{f"7{d}": ["Ferizaj", "Urosevac"] for d in range(10)}},
}


def towns(cc):
    best = {}
    with zipfile.ZipFile(os.path.join(GN, f"dump_{cc}.zip")) as z:
        txt = z.read(f"{cc}.txt").decode("utf-8")
    for line in txt.splitlines():
        r = line.split("\t")
        if len(r) < 15 or r[6] != "P":
            continue
        pop = int(r[14] or 0)
        for n in {r[1], r[2], *r[3].split(",")}:
            k = ascii_(n).lower()
            if k and (k not in best or pop > best[k][2]):
                best[k] = (float(r[4]), float(r[5]), pop, r[1])
    return best


def points_area(cc):
    t = towns(cc)
    pts, place = [], {}
    for pre, names in sorted(AREAS[cc].items()):
        hit = next((t[ascii_(n).lower()] for n in names if ascii_(n).lower() in t), None)
        if not hit:
            raise SystemExit(f"{cc}: no town {names} for postal area {pre}")
        pc = f"{pre}xxx"
        pts.append([pc, round(hit[0], 3), round(hit[1], 3)])
        place[pc] = hit[3]
    print(f"{cc}: {len(pts)} postal areas on their main town")
    return pts, place


# ---- regions ----

def union(gs):
    return shapely.union_all([g.buffer(0) for g in gs]).buffer(0)


def by_neighbour(items):
    """items [(key|None, geometry)] -> keys, the blanks given the key of the neighbour they share most border with"""
    keys = [k for k, _ in items]
    for _ in range(10):
        blank = [i for i, k in enumerate(keys) if not k]
        if not blank:
            break
        for i in blank:
            g = items[i][1].buffer(0.005)
            best, bl = None, 0.0
            for j, k in enumerate(keys):
                if k and j != i:
                    a = g.intersection(items[j][1]).area
                    if a > bl:
                        best, bl = k, a
            if best:
                keys[i] = best
    return keys


SI_CODE = {"Gorenjska": "GOR", "Goriška": "GOK", "Jugovzhodna Slovenija": "JVS", "Koroška": "KOR", "Notranjsko-kraška": "NOK",
           "Primorsko-notranjska": "NOK", "Obalno-kraška": "OBK", "Osrednjeslovenska": "OSR", "Podravska": "POD", "Pomurska": "POM",
           "Savinjska": "SAV", "Spodnjeposavska": "POS", "Posavska": "POS", "Zasavska": "ZAS"}
MK_REG = {"Greater Skopje": "Skopje", "Skopje": "Skopje", "Pelagonia": "Pelagonia", "Polog": "Polog", "Southwestern": "Southwestern",
          "Southeastern": "Southeastern", "Vardar": "Vardar", "Northeastern": "Northeastern", "Eastern": "Eastern"}
MK_CODE = {"Skopje": "SK", "Pelagonia": "PE", "Polog": "PO", "Southwestern": "SW", "Southeastern": "SE", "Vardar": "VA", "Northeastern": "NE", "Eastern": "EA"}
XK_REG = {"Pristina": ("PRI", "Pristina"), "Prizren": ("PRZ", "Prizren"), "Peć": ("PEJ", "Peja"), "Đakovica": ("GJA", "Gjakova"),
          "Gnjilane": ("GJI", "Gjilan"), "Uroševac": ("FER", "Ferizaj"), "Kosovska Mitrovica": ("MIT", "Mitrovica")}
ME_COAST = {"Herceg Novi", "Kotor", "Bar", "Ulcinj", "Budva", "Tivat"}
ME_CENTRE = {"Nikšic", "Nikšić", "Podgorica", "Cetinje", "Danilovgrad", "Tuzi", "Zeta"}
GR_NAME = {"GR-A": "Eastern Macedonia and Thrace", "GR-B": "Central Macedonia", "GR-C": "Western Macedonia", "GR-D": "Epirus",
           "GR-E": "Thessaly", "GR-F": "Ionian Islands", "GR-G": "Western Greece", "GR-H": "Central Greece", "GR-J": "Peloponnese",
           "GR-K": "North Aegean", "GR-L": "South Aegean", "GR-M": "Crete", "GR-A1": "Attica"}
BA_CODE = {"Herzegovina-Neretva": "HNK", "Trebinje": "TRE", "Foča": "FOC", "Banja Luka": "BL", "Una-Sana": "USK", "Doboj": "DOB",
           "Posavina": "POS", "Brčko Distrikt": "BRC", "Bijeljina": "BIJ", "West Bosnia": "K10", "West Herzegovina": "ZHK", "Vlasenica": "VLA",
           "Central Bosnia": "SBK", "Zenica-Doboj": "ZDK", "Tuzla": "TK", "Sarajevo-romanija": "ISA", "Sarajevo": "KS", "Bosnian Podrinje": "BPK"}
BA_SRPSKA = {"Trebinje", "Foča", "Banja Luka", "Doboj", "Bijeljina", "Vlasenica", "Sarajevo-romanija"}
BA_NAME = {"Sarajevo-romanija": "Sarajevo-Romanija", "Brčko Distrikt": "Brčko District"}
HU_COUNTIES = {"BK", "BA", "BE", "BZ", "CS", "FE", "GS", "HB", "HE", "JN", "KE", "NO", "PE", "SO", "SZ", "TO", "VA", "VE", "ZA", "BU"}


def regions_of(cc, admin1):
    feats = [(f["properties"], shape(f["geometry"]).buffer(0)) for f in admin1 if f["properties"].get("iso_a2") == cc]
    name = lambda p: p.get("name") or p.get("name_en") or ""
    if cc == "SI":
        keys = by_neighbour([((p.get("region") or "").strip() or None, g) for p, g in feats])
        parts = defaultdict(list)
        for k, (p, g) in zip(keys, feats):
            parts[k].append(g)
        return [(f"SI-{SI_CODE[k]}", k, None, union(gs)) for k, gs in parts.items()]
    if cc == "MK":
        keys = by_neighbour([(MK_REG.get((p.get("region") or "").strip()), g) for p, g in feats])
        parts = defaultdict(list)
        for k, (p, g) in zip(keys, feats):
            parts[k].append(g)
        return [(f"MK-{MK_CODE[k]}", k, None, union(gs)) for k, gs in parts.items()]
    if cc == "XK":
        parts = defaultdict(list)
        for p, g in feats:
            parts[XK_REG[(p.get("region") or "").strip()]].append(g)
        return [(f"XK-{c}", n, None, union(gs)) for (c, n), gs in parts.items()]
    if cc == "ME":
        parts = defaultdict(list)
        for p, g in feats:
            n = name(p)
            parts[("COA", "Coastal region") if n in ME_COAST else ("CEN", "Central region") if n in ME_CENTRE else ("NOR", "Northern region")].append(g)
        return [(f"ME-{c}", n, None, union(gs)) for (c, n), gs in parts.items()]
    if cc == "HU":
        counties = {p["iso_3166_2"][3:]: [p, [g]] for p, g in feats if p["iso_3166_2"][3:] in HU_COUNTIES}
        for p, g in feats:
            c = p["iso_3166_2"][3:]
            if c in HU_COUNTIES:
                continue
            gb = g.buffer(0.01)
            into = max(counties, key=lambda k: gb.intersection(counties[k][1][0]).area)
            counties[into][1].append(g)
        return [(f"HU-{c}", name(p), None, union(gs)) for c, (p, gs) in counties.items()]
    if cc == "GR":
        parts = defaultdict(list)
        for p, g in feats:
            c = p["iso_3166_2"]
            parts["GR-B" if c == "GR-69" else c].append(g)
        return [(c, GR_NAME[c], None, union(gs)) for c, gs in parts.items()]
    if cc == "BA":
        out = []
        for p, g in feats:
            n = name(p)
            # by name - Natural Earth files Posavina canton under Republika Srpska
            group = "Brčko District" if n == "Brčko Distrikt" else "Republika Srpska" if n in BA_SRPSKA else "Federation of Bosnia and Herzegovina"
            out.append((f"BA-{BA_CODE[n]}", BA_NAME.get(n, n), group, g))
        return out
    parts = {}  # one region per code - Natural Earth splits a few in pieces (HR-12 Brodsko-Posavska)
    for p, g in feats:
        c = p.get("iso_3166_2") or ""
        if cc == "NO" and (name(p) in ("Svalbard", "Jan Mayen") or g.bounds[3] > 71.5):
            continue
        parts.setdefault(c, [name(p), []])[1].append(g)
    return [(c, n, None, union(gs)) for c, (n, gs) in parts.items()]


# coasts of islands (07.11.2026): with geo_lib's 4 km2 floor, 86 Norwegian and 7 Croatian postcodes sat on islands the
# map had dropped - those two keep their islands down to ~0.4 km2
SMALL_ISLANDS = {"NO": 0.00005, "HR": 0.00005}


def build(cc, countries, admin1):
    geo_lib.MIN_AREA = SMALL_ISLANDS.get(cc, 0.0005)
    feat = next(f for f in countries if f["properties"].get("ISO_A2_EH") == cc)
    cname = {"RS": "Serbia"}.get(cc, feat["properties"]["ADMIN"])
    pts, place = points_area(cc) if cc in AREA_CC else points_gn(cc)
    g0 = shape(feat["geometry"]).buffer(0)
    if cc == "NO":
        g0 = g0.intersection(box(3.0, 57.0, 32.5, 71.5))
    outline = finish(shapely.simplify(g0, 0.01, preserve_topology=True))
    regs = regions_of(cc, admin1)
    if cc == "NO":
        regs = [(c, n, gr, g.intersection(box(3.0, 57.0, 32.5, 71.5))) for c, n, gr, g in regs]
    simp, how = simplify_regions([r[3] for r in regs])
    regions = []
    for (code, rname, group, _), g in zip(regs, simp):
        g = finish(g)
        if g.is_empty:
            print("  empty region", cc, code)
            continue
        if not REGION.match(code):
            raise SystemExit(f"{cc}: region code {code} not one plan.ts accepts")
        regions.append({"code": code, "name": rname, "group": group, "geometry": g})
    regions.sort(key=lambda r: r["code"])
    if len({r["code"] for r in regions}) != len(regions):
        raise SystemExit(f"{cc}: a region code twice: {Counter(r['code'] for r in regions).most_common(3)}")
    codes, outside = region_codes(pts, [(r["code"], r["geometry"]) for r in regions])
    for r in regions:
        r["km2"] = km2_round(proj_ea(r["geometry"]).area)
    area, outline_m2, spots = voronoi_km2(pts, outline)
    rows = [[p[0], p[1], p[2], codes[i], km2_round(area[i]), place.get(p[0], "")] for i, p in enumerate(pts)]
    shp = {"country": cc, "name": cname, "bbox": bbox3(outline), "outline": geojson(outline), "regions": [], "km2": km2_round(outline_m2)}
    for r in regions:
        o = {"code": r["code"], "name": r["name"], "geometry": geojson(r["geometry"])}
        if r["group"]:
            o["group"] = r["group"]
        o["km2"] = r["km2"]
        shp["regions"].append(o)
    sb = dump(shp, os.path.join(OUT, "shapes", cc + ".json"))
    pb = dump({"country": cc, "points": rows}, os.path.join(OUT, "postcodes", cc + ".json"))
    per = Counter(r[3] for r in rows)
    print(f"{cc} {cname}: points {len(rows)} spots {spots} outside regions {outside} | regions {len(regions)} ({how}) "
          f"| outline km2 {shp['km2']} regions km2 {sum(r['km2'] for r in regions)} | bbox {shp['bbox']} "
          f"| postcodes {pb / 1024:.0f} KB shapes {sb / 1024:.0f} KB")
    for r in regions:
        print(f"   {r['code']:7} {r['name']:34} {str(r['group'] or ''):24} km2 {r['km2']:>7} points {per.get(r['code'], 0)}")
    if cc in AREA_CC:
        for p in rows:
            print(f"   area {p[0]} {p[5]:22} -> {p[3]}")


countries = load(os.path.join(NE, "ne_10m_admin_0_countries.geojson"))["features"]
admin1 = load(os.path.join(NE, "ne_10m_admin_1_states_provinces.geojson"))["features"]
for cc in ONLY:
    build(cc, countries, admin1)
