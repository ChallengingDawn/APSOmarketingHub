// MAP ASSIGNMENT - REGIONS: the company property "regions" (HubSpot dropdown "Regions", "Sales region of the company")
// written from the hub's own postcode -> region (public/geo/postcodes/<CC>.json, the region of each postcode point) -
// SARCLA 03.11.2026: "SARCLA | REGIONS SET can we then proceed to this migration?". It replaces the workflow's seven
// code steps (one table of postcodes per country, 3134893257). Pure: no HubSpot, no database, relative imports only.
//
// Where the region comes from, most precise first (SARCLA 03.11.2026, "yes, download"):
//   1. the official region of the postcode - public/geo/regions/regions.json, built from GeoNames' postal codes
//      (scratchpad build_table.py): the shortest postcode beginnings that hold one region only;
//   2. else the map's region of the postcode's point (public/geo/postcodes, a point inside a region's outline - wrong
//      near a border, so only where the official list does not know the postcode);
//   3. France overseas (971-976) by the postcode's first three digits.
// The workflow guessed from the first two digits (Le Locle 2400 as Bern, Mainaschaff 63814 as Hessen).

/** The dropdown's own values per country, as HubSpot has them (read 03.11.2026; 203 options). */
export const REGION_OPTIONS: Record<string, string[]> = {
  IT: [
    "1 - Valle D'Aosta",
    "2 - Piemonte",
    "3 - Liguria",
    "4 - Lombardia",
    "5 - Trentino Alto Adige",
    "6 - Friuli Venezia Giulia",
    "7 - Veneto",
    "8 - Emilia Romagna",
    "9 - Toscana",
    "10 - Umbria",
    "11 - Marche",
    "12 - Lazio",
    "13 - Abruzzo",
    "14 - Molise",
    "15 - Campania",
    "16 - Puglia",
    "17 - Basilicata",
    "18 - Calabria",
    "19 - Sicilia",
    "20 - Sardegna",
  ],
  FR: [
    "01 - Ain",
    "02 - Aisne",
    "03 - Allier",
    "04 - Alpes-de-Haute-Provence",
    "05 - Hautes-Alpes",
    "06 - Alpes-Maritimes",
    "07 - Ardèche",
    "08 - Ardennes",
    "09 - Ariège",
    "10 - Aube",
    "11 - Aude",
    "12 - Aveyron",
    "13 - Bouches-du-Rhône",
    "14 - Calvados",
    "15 - Cantal",
    "16 - Charente",
    "17 - Charente-Maritime",
    "18 - Cher",
    "19 - Corrèze",
    "2A - Corse-du-Sud",
    "2B - Haute-Corse",
    "21 - Côte-d'Or",
    "22 - Côtes-d’Armor",
    "23 - Creuse",
    "24 - Dordogne",
    "25 - Doubs",
    "26 - Drôme",
    "27 - Eure",
    "28 - Eure-et-Loir",
    "29 - Finistère",
    "30 - Gard",
    "31 - Haute-Garonne",
    "32 - Gers",
    "33 - Gironde",
    "34 - Hérault",
    "35 - Ille-et-Vilaine",
    "36 - Indre",
    "37 - Indre-et-Loire",
    "38 - Isère",
    "39 - Jura",
    "40 - Landes",
    "41 - Loir-et-Cher",
    "42 - Loire",
    "43 - Haute-Loire",
    "44 - Loire-Atlantique",
    "45 - Loiret",
    "46 - Lot",
    "47 - Lot-et-Garonne",
    "48 - Lozère",
    "49 - Maine-et-Loire",
    "50 - Manche",
    "51 - Marne",
    "52 - Haute-Marne",
    "53 - Mayenne",
    "54 - Meurthe-et-Moselle",
    "55 - Meuse",
    "56 - Morbihan",
    "57 - Moselle",
    "58 - Nièvre",
    "59 - Nord",
    "60 - Oise",
    "61 - Orne",
    "62 - Pas-de-Calais",
    "63 - Puy-de-Dôme",
    "64 - Pyrénées-Atlantiques",
    "65 - Hautes-Pyrénées",
    "66 - Pyrénées-Orientales",
    "67 - Bas-Rhin",
    "68 - Haut-Rhin",
    "69 - Rhône",
    "70 - Haute-Saône",
    "71 - Saône-et-Loire",
    "72 - Sarthe",
    "73 - Savoie",
    "74 - Haute-Savoie",
    "75 - Paris",
    "76 - Seine-Maritime",
    "77 - Seine-et-Marne",
    "78 - Yvelines",
    "79 - Deux-Sèvres",
    "80 - Somme",
    "81 - Tarn",
    "82 - Tarn-et-Garonne",
    "83 - Var",
    "84 - Vaucluse",
    "85 - Vendée",
    "86 - Vienne",
    "87 - Haute-Vienne",
    "88 - Vosges",
    "89 - Yonne",
    "90 - Territoire de Belfort",
    "91 - Essonne",
    "92 - Hauts-de-Seine",
    "93 - Seine-Saint-Denis",
    "94 - Val-de-Marne",
    "95 - Val-d’Oise",
    "971 - Guadeloupe",
    "972 - Martinique",
    "973 - Guyane",
    "974 - La Réunion",
    "976 - Mayotte",
  ],
  CH: [
    "AG - Aargau",
    "AI - Appenzell Innerrhoden",
    "AR - Appenzell Ausserrhoden",
    "BE - Bern",
    "BL - Basel-Landschaft",
    "BS - Basel-Stadt",
    "FR - Fribourg / Freiburg",
    "GE - Genève / Genf",
    "GL - Glarus",
    "GR - Graubünden / Grisons",
    "JU - Jura",
    "LU - Luzern",
    "NE - Neuchâtel / Neuenburg",
    "NW - Nidwalden",
    "OW - Obwalden",
    "SG - St. Gallen",
    "SH - Schaffhausen",
    "SO - Solothurn",
    "SZ - Schwyz",
    "TG - Thurgau",
    "TI - Ticino",
    "UR - Uri",
    "VD - Vaud",
    "VS - Valais / Wallis",
    "ZG - Zug",
    "ZH - Zürich",
  ],
  DE: [
    "BB - Brandenburg",
    "BE - Berlin",
    "BW - Baden-Württemberg",
    "BY - Bayern",
    "HB - Bremen",
    "HE - Hessen",
    "HH - Hamburg",
    "MV - Mecklenburg-Vorpommern",
    "NI - Niedersachsen",
    "NW - Nordrhein-Westfalen",
    "RP - Rheinland-Pfalz",
    "SH - Schleswig-Holstein",
    "SL - Saarland",
    "SN - Sachsen",
    "ST - Sachsen-Anhalt",
    "TH - Thüringen",
  ],
  NL: [
    "DR - Drenthe",
    "FL - Flevoland",
    "FR - Friesland",
    "GE - Gelderland",
    "GR - Groningen",
    "LI - Limburg",
    "NB - Noord-Brabant",
    "NH - Noord-Holland",
    "OV - Overijssel",
    "UT - Utrecht",
    "ZE - Zeeland",
    "ZH - Zuid-Holland",
  ],
  AT: [
    "B - Burgenland",
    "K - Kärnten",
    "NÖ - Niederösterreich",
    "OÖ - Oberösterreich",
    "S - Salzburg",
    "ST - Steiermark",
    "T - Tirol",
    "V - Vorarlberg",
    "W - Wien",
  ],
  PL: [
    "DS - Dolnośląskie",
    "KP - Kujawsko-Pomorskie",
    "LB - Lubuskie",
    "LD - Łódzkie",
    "LU - Lubelskie",
    "MA - Małopolskie",
    "MZ - Mazowieckie",
    "OP - Opolskie",
    "PD - Podlaskie",
    "PK - Podkarpackie",
    "PM - Pomorskie",
    "SK - Świętokrzyskie",
    "SL - Śląskie",
    "WN - Warmińsko-Mazurskie",
    "WP - Wielkopolskie",
    "ZP - Zachodniopomorskie",
  ],
  LI: ["LH - Liechtenstein"],
};
/** The workflow's "no region" value (its spelling) - written when the postcode is missing or not a postcode of the country. */
export const UNKNOWN_REGION = "ZIP CODE UNKOWN";
/** The countries the workflow covered - the same eight (Liechtenstein went with Switzerland). */
export const REGION_COUNTRIES = ["AT", "CH", "DE", "FR", "IT", "LI", "NL", "PL"] as const;

/** Italy: the map knows the 110 provinces (old Sardinian ones too), the dropdown the 20 regions (1 = Valle d'Aosta). */
const IT_REGION: Record<string, number> = {"AG": 19, "AL": 2, "AN": 11, "AO": 1, "AP": 11, "AQ": 13, "AR": 9, "AT": 2, "AV": 15, "BA": 16, "BG": 4, "BI": 2, "BL": 7, "BN": 15, "BO": 8, "BR": 16, "BS": 4, "BT": 16, "BZ": 5, "CA": 20, "CB": 14, "CE": 15, "CH": 13, "CI": 20, "CL": 19, "CN": 2, "CO": 4, "CR": 4, "CS": 18, "CT": 19, "CZ": 18, "EN": 19, "FC": 8, "FE": 8, "FG": 16, "FI": 9, "FM": 11, "FR": 12, "GE": 3, "GO": 6, "GR": 9, "IM": 3, "IS": 14, "KR": 18, "LC": 4, "LE": 16, "LI": 9, "LO": 4, "LT": 12, "LU": 9, "MB": 4, "MC": 11, "ME": 19, "MI": 4, "MN": 4, "MO": 8, "MS": 9, "MT": 17, "NA": 15, "NO": 2, "NU": 20, "OG": 20, "OR": 20, "OT": 20, "PA": 19, "PC": 8, "PD": 7, "PE": 13, "PG": 10, "PI": 9, "PN": 6, "PO": 9, "PR": 8, "PT": 9, "PU": 11, "PV": 4, "PZ": 17, "RA": 8, "RC": 18, "RE": 8, "RG": 19, "RI": 12, "RM": 12, "RN": 8, "RO": 7, "SA": 15, "SI": 9, "SO": 4, "SP": 3, "SR": 19, "SS": 20, "SV": 3, "TA": 16, "TE": 13, "TN": 5, "TO": 2, "TP": 19, "TR": 10, "TS": 6, "TV": 7, "UD": 6, "VA": 4, "VB": 2, "VC": 2, "VE": 7, "VI": 7, "VR": 7, "VS": 20, "VT": 12, "VV": 18};
/** Austria: the map's Bundesland numbers 1-9 in the dropdown's order (Burgenland .. Wien). */
const AT_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * The dropdown value for a postcode's region code ("DE-BY", "IT-RM", "AT-9", "FR-2A", "LI-07") in country `cc`;
 * null = the map's region has no value in the dropdown (never guessed).
 */
export function regionsValue(cc: string | null | undefined, regionCode: string | null | undefined): string | null {
  const c = String(cc ?? "").toUpperCase(), code = String(regionCode ?? "").toUpperCase();
  if (!c || !code.startsWith(`${c}-`)) return null;
  const k = code.slice(c.length + 1);
  if (c === "LI") return REGION_OPTIONS.LI[0];
  const list = REGION_OPTIONS[c];
  if (!list) return null;
  if (c === "IT") { const n = IT_REGION[k]; return n ? list[n - 1] ?? null : null; }
  if (c === "AT") { const i = AT_ORDER.indexOf(k); return i >= 0 ? list[i] ?? null : null; }
  return list.find((v) => v.startsWith(`${k} - `)) ?? null;
}

/** Which country a dropdown value belongs to (the codes repeat across countries: "BE - Bern" / "BE - Berlin"). */
export function regionsCountry(value: string | null | undefined): string | null {
  const v = String(value ?? "");
  for (const [cc, list] of Object.entries(REGION_OPTIONS)) if (list.includes(v)) return cc;
  return null;
}

/** regions.json: per country, a postcode beginning -> the index of its value in REGION_OPTIONS[country]; a postcode
 *  with places in several regions (Mattsee 5163, Salzburg, and 20 Upper Austrian hamlets) -> {r: its regions, most places
 *  first, p: each place's name (lower case, no accents) -> its region}. */
export type SharedPostcode = { r: number[]; p: Record<string, number> };
export type RegionsTable = Record<string, Record<string, number | SharedPostcode> | string>;
/** A town's name as the table keeps it: "Wien, Floridsdorf" -> "wien floridsdorf", "Brandstätt" -> "brandstatt". */
export const placeKey = (s: string | null | undefined) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, " ").trim();
/** The postcode's digits per country (Netherlands: 4 digits, then 2 letters the table does not need). */
const ZIP_LEN: Record<string, number> = { AT: 4, CH: 4, LI: 4, NL: 4, DE: 5, FR: 5, IT: 5, PL: 5 };

/** The postcode as the table knows it: "A-4060" / "A 5224" / "PL 26-600" / "5941 AG" -> "4060" / "5224" / "26600" / "5941";
 *  null when it is not one of the country's postcodes (too short, too long, letters). */
export function regionsZip(cc: string, zip: string | null | undefined): string | null {
  const n = ZIP_LEN[cc];
  if (!n) return null;
  const z = String(zip ?? "").toUpperCase().trim().replace(/^[A-Z]{1,2}[\s-]?(?=\d)/, "").replace(/[\s.-]/g, "");
  const m = /^(\d+)([A-Z]{2})?$/.exec(z);
  if (!m || m[1].length !== n || (m[2] && cc !== "NL")) return null;
  return m[1];
}

/** `also`: every region of a postcode that spans several - a company already in one of them keeps it. */
export type RegionsAnswer = { value: string; via: "postcode" | "map"; also?: string[] } | null;
/** The dropdown value for a company: its postcode in the official table, else the map's region of the postcode
 *  (mapRegion, e.g. "DE-BY"), else nothing (null - the page says why). A postcode shared by two regions: the company's
 *  town picks one (city), else the map's, else the one with most places. */
export function regionsFor(table: RegionsTable, cc: string, zip: string | null | undefined, mapRegion: string | null | undefined, city?: string | null): RegionsAnswer {
  const c = String(cc ?? "").toUpperCase();
  const list = REGION_OPTIONS[c];
  if (!list) return null;
  const z = regionsZip(c, zip);
  if (!z) return null;
  const t = table[c];
  if (t && typeof t === "object") {
    for (let k = z.length; k > 0; k--) {
      const i = t[z.slice(0, k)];
      if (i === undefined) continue;
      if (typeof i === "object") {
        // several regions: the company's town, else the one the postcode's point lies in, else the one with most places
        const also = i.r.map((n) => list[n]).filter(Boolean);
        const town = placeKey(city), byTown = town ? i.p[town] ?? i.p[town.split(" ")[0]] : undefined;
        const m = regionsValue(c, mapRegion);
        const value = byTown !== undefined && list[byTown] ? list[byTown] : m && also.includes(m) ? m : also[0];
        return value ? { value, via: "postcode", also } : null;
      }
      return list[i] ? { value: list[i], via: "postcode" } : null;
    }
  }
  if (c === "FR" && /^97[1-6]/.test(z)) {
    const v = list.find((x) => x.startsWith(`${z.slice(0, 3)} - `));
    if (v) return { value: v, via: "postcode" };
  }
  const m = regionsValue(c, mapRegion);
  return m ? { value: m, via: "map" } : null;
}

/** What to write: the answer when the company has another value; nothing when it already has it (or one of a shared
 *  postcode's regions); the workflow's "ZIP CODE UNKOWN" only on an empty field - a value is never taken away. */
export function regionsToWrite(current: string | null | undefined, answer: RegionsAnswer): string | null {
  const cur = String(current ?? "").trim();
  if (!answer) return cur ? null : UNKNOWN_REGION;
  if (cur === answer.value || (cur && answer.also?.includes(cur))) return null;
  return answer.value;
}
