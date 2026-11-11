// COMPANY DATA > Country - the rule, pure (the engine in engine.ts). Replaces the HubSpot workflow "SARCLA | REGION TO
// COUNTRY CUSTOM" (3500481774, secret COMPANYSEG), SARCLA 11.11.2026: a company with a country and no country_custom gets
// country_custom, HubSpot's country dropdown (254 values, value = label) that the regions, phones and duplicates read.
//
// The workflow looked the country up in its own table ("DE", "Deutschland" -> "Germany") and otherwise wrote the country
// as it was - which the dropdown refuses unless it is one of its values, so "Schweiz", "CHE", "Italia", "poland" (18
// companies on 11.11.2026) failed and stayed without one. Here the country is matched without case, accents or dots
// against: the dropdown's own values; the workflow's table; every two-letter country code; a short list of three-letter
// ones; and the countries' names in the languages of our customers (Intl, the server's ICU). A country that matches
// nothing, or two values, is never guessed: it is listed for a person, who picks the value.

export const WORKFLOW_ID = "3500481774";
export const PROPERTY = "country_custom";
export const SOURCE = "country";

/** The workflow's own table, as it was (SARCLA | REGION TO COUNTRY CUSTOM, 07.01.2026). */
export const WORKFLOW_TABLE: Record<string, string> = {
  BE: "Belgium", Belgium: "Belgium", Belgique: "Belgium", "België": "Belgium",
  FR: "France", France: "France",
  DE: "Germany", Deutschland: "Germany", Germany: "Germany",
  NL: "Netherlands", Netherlands: "Netherlands", "The Netherlands": "Netherlands", Nederland: "Netherlands",
  LU: "Luxembourg", Luxembourg: "Luxembourg",
  AT: "Austria", Austria: "Austria", "Österreich": "Austria", Osterreich: "Austria",
  CH: "Switzerland", Switzerland: "Switzerland",
  GB: "United Kingdom", UK: "United Kingdom", "United Kingdom": "United Kingdom",
  IE: "Ireland", Ireland: "Ireland",
  SE: "Sweden", Sweden: "Sweden",
  NO: "Norway", Norway: "Norway",
  DK: "Denmark", Denmark: "Denmark",
  FI: "Finland", Finland: "Finland",
  IS: "Iceland", Iceland: "Iceland",
  EE: "Estonia", Estonia: "Estonia",
  LV: "Latvia", Latvia: "Latvia",
  LT: "Lithuania", Lithuania: "Lithuania",
  ES: "Spain", Spain: "Spain", "España": "Spain", Espana: "Spain",
  PT: "Portugal", Portugal: "Portugal",
  IT: "Italy", Italy: "Italy",
  GR: "Greece", Greece: "Greece",
  MT: "Malta", Malta: "Malta",
  CY: "Cyprus", Cyprus: "Cyprus",
  SM: "San Marino", "San Marino": "San Marino",
  PL: "Poland", Poland: "Poland",
  CZ: "Czech Republic", "Czech Republic": "Czech Republic", Czechia: "Czech Republic",
  SK: "Slovakia", Slovakia: "Slovakia",
  HU: "Hungary", Hungary: "Hungary",
  SI: "Slovenia", Slovenia: "Slovenia",
  HR: "Croatia", Croatia: "Croatia",
  RO: "Romania", Romania: "Romania",
  BG: "Bulgaria", Bulgaria: "Bulgaria",
  TR: "Turkey", Turkey: "Turkey", "Türkiye": "Turkey", Turkiye: "Turkey",
  US: "United States", USA: "United States", "United States": "United States",
  CA: "Canada", Canada: "Canada",
  MX: "Mexico", Mexico: "Mexico",
  BR: "Brazil", Brazil: "Brazil",
  CN: "China", China: "China",
  JP: "Japan", Japan: "Japan",
  KR: "South Korea", "South Korea": "South Korea",
  IN: "India", IND: "India", India: "India",
  SG: "Singapore", Singapore: "Singapore",
  HK: "Hong Kong", "Hong Kong": "Hong Kong",
  TW: "Taiwan", Taiwan: "Taiwan",
  MY: "Malaysia", Malaysia: "Malaysia",
  TH: "Thailand", Thailand: "Thailand",
  PH: "Philippines", Philippines: "Philippines",
  ID: "Indonesia", Indonesia: "Indonesia",
  LK: "Sri Lanka", SL: "Sri Lanka", "Sri Lanka": "Sri Lanka",
  AE: "United Arab Emirates", UAE: "United Arab Emirates",
  MA: "Morocco", Morocco: "Morocco",
  AU: "Australia", Australia: "Australia",
  NZ: "New Zealand", "New Zealand": "New Zealand",
};

/** Two-letter codes whose English name (Intl) is not the dropdown's spelling. */
const CODE_NAME: Record<string, string> = {
  CZ: "Czech Republic", TR: "Turkey", HK: "Hong Kong", MO: "Macau", MK: "Macedonia (FYROM)", SZ: "Swaziland",
  TL: "East Timor", TP: "East Timor", PS: "Palestine", CD: "Democratic Republic of the Congo", ZR: "Democratic Republic of the Congo",
  CG: "Congo", CI: "Cote d'Ivoire", CV: "Cape Verde", MM: "Myanmar (Burma)", XK: "Kosovo", VA: "Vatican City",
};
/** Three-letter codes seen or likely in our countries (ISO 3166 alpha-3 -> alpha-2). */
const ALPHA3: Record<string, string> = {
  CHE: "CH", DEU: "DE", AUT: "AT", FRA: "FR", ITA: "IT", LIE: "LI", ESP: "ES", PRT: "PT", NLD: "NL", BEL: "BE", LUX: "LU",
  GBR: "GB", IRL: "IE", POL: "PL", CZE: "CZ", SVK: "SK", SVN: "SI", HUN: "HU", HRV: "HR", ROU: "RO", BGR: "BG", GRC: "GR",
  SWE: "SE", NOR: "NO", DNK: "DK", FIN: "FI", ISL: "IS", EST: "EE", LVA: "LV", LTU: "LT", MLT: "MT", CYP: "CY", MCO: "MC",
  SMR: "SM", TUR: "TR", RUS: "RU", UKR: "UA", SRB: "RS", USA: "US", CAN: "CA", MEX: "MX", BRA: "BR", CHN: "CN", JPN: "JP",
  KOR: "KR", IND: "IN", SGP: "SG", HKG: "HK", TWN: "TW", MYS: "MY", THA: "TH", ISR: "IL", ARE: "AE", ZAF: "ZA", AUS: "AU",
  NZL: "NZ", MAR: "MA", TUN: "TN", EGY: "EG",
};
/** The languages the countries' own names are read in (our customers' and the shop's). */
const LANGS = ["en", "de", "fr", "it", "es", "pt", "nl", "pl", "cs", "sk", "hu", "ro", "hr", "sl", "sv", "da", "nb", "fi", "tr"];

/** Compared without case, accents, dots and the like; "&" as "and", "St." as "Saint". */
export function norm(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss").toLowerCase()
    .replace(/&/g, " and ").replace(/\bst\.\s*/g, "saint ").replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

const CODES: string[] = (() => {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", out: string[] = [];
  for (const a of A) for (const b of A) out.push(a + b);
  return out;
})();
function displayNames(lang: string): Intl.DisplayNames | null {
  try { return new Intl.DisplayNames([lang], { type: "region" }); } catch { return null; }
}

export type CountryIndex = Map<string, string | null>;

/** Every way of writing a country -> the dropdown's value (null = two values: never written). */
export function buildIndex(options: string[]): CountryIndex {
  const byNorm = new Map<string, string>();
  for (const o of options) if (o && !byNorm.has(norm(o))) byNorm.set(norm(o), o);
  const idx: CountryIndex = new Map();
  // a tier never overrides an earlier one; within a tier, two values make the spelling ambiguous
  const tier = (pairs: [string, string | undefined][]) => {
    const here = new Map<string, string | null>();
    for (const [alias, value] of pairs) {
      const k = norm(alias);
      if (!k || !value || idx.has(k)) continue;
      const prev = here.get(k);
      here.set(k, prev === undefined || prev === value ? value : null);
    }
    for (const [k, v] of here) idx.set(k, v);
  };
  const opt = (name: string | undefined) => (name ? byNorm.get(norm(name)) : undefined);
  const en = displayNames("en");
  const ofCode = (c: string): string | undefined => {
    if (CODE_NAME[c]) return opt(CODE_NAME[c]);
    const n = en?.of(c);
    return n && n !== c ? opt(n) : undefined;
  };
  tier(options.map((o) => [o, o]));
  tier(Object.entries(WORKFLOW_TABLE).map(([k, v]) => [k, opt(v)]));
  tier(CODES.map((c) => [c, ofCode(c)]));
  tier(Object.entries(ALPHA3).map(([k, c]) => [k, ofCode(c)]));
  const native: [string, string | undefined][] = [];
  for (const lang of LANGS) {
    const dn = displayNames(lang);
    if (!dn) continue;
    for (const c of CODES) {
      const v = ofCode(c);
      if (!v) continue;
      const n = dn.of(c);
      if (n && n !== c) native.push([n, v]);
    }
  }
  tier(native);
  return idx;
}

export type CountryVerdict = { status: "sure"; value: string } | { status: "check"; reason: "unknown" | "two" };

/** The dropdown's value for a company's country, or for a person. */
export function decideCountry(country: string | null | undefined, idx: CountryIndex): CountryVerdict {
  const k = norm(country);
  if (!idx.has(k)) return { status: "check", reason: "unknown" };
  const v = idx.get(k);
  return v ? { status: "sure", value: v } : { status: "check", reason: "two" };
}
