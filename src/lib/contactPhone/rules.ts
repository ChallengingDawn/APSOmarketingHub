// CONTACT PHONE - the rules (Map assignment > Phone numbers; the engine in engine.ts). The HubSpot workflow "SARCLA |
// Contact phone number correction" (3078691018) brought into the hub, SARCLA 25.10.2026: a contact that has the shop's
// phone (eyemagine_telephone) but no phone gets one - in the international form (+41 …) from its country. The
// conversion is the workflow's own Python, line for line (toE164), with two repairs: the contact's own country is the
// second choice when its ERP country (country_custom) is not one we know (the workflow asked for it but never received
// it), and "Österreich" (the workflow's table had it garbled). Since the audit of the same evening (1,179 of the
// workflow's 48,501 numbers not valid) every number is checked with libphonenumber-js and only a valid one is written.
//
// Pure: tests use it as is. libphonenumber-js is bundled (it is not in next.config's serverExternalPackages - this
// file is reached from instrumentation.ts).

import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export const WORKFLOW_ID = "3078691018";

const DIAL: Record<string, string> = {
  AC: "247", AD: "376", AE: "971", AF: "93", AG: "1", AI: "1", AL: "355", AM: "374", AO: "244", AR: "54", AS: "1", AT: "43", AU: "61", AW: "297",
  AX: "358", AZ: "994", BA: "387", BB: "1", BD: "880", BE: "32", BF: "226", BG: "359", BH: "973", BI: "257", BJ: "229", BL: "590", BM: "1", BN: "673",
  BO: "591", BQ: "599", BR: "55", BS: "1", BT: "975", BW: "267", BY: "375", BZ: "501", CA: "1", CC: "61", CD: "243", CF: "236", CG: "242", CH: "41",
  CI: "225", CK: "682", CL: "56", CM: "237", CN: "86", CO: "57", CR: "506", CU: "53", CV: "238", CW: "599", CX: "61", CY: "357", CZ: "420", DE: "49",
  DJ: "253", DK: "45", DM: "1", DO: "1", DZ: "213", EC: "593", EE: "372", EG: "20", EH: "212", ER: "291", ES: "34", ET: "251", FI: "358", FJ: "679",
  FK: "500", FM: "691", FO: "298", FR: "33", GA: "241", GB: "44", GD: "1", GE: "995", GF: "594", GG: "44", GH: "233", GI: "350", GL: "299", GM: "220",
  GN: "224", GP: "590", GQ: "240", GR: "30", GS: "500", GT: "502", GU: "1", GW: "245", GY: "592", HK: "852", HN: "504", HR: "385", HT: "509", HU: "36",
  ID: "62", IE: "353", IL: "972", IM: "44", IN: "91", IO: "246", IQ: "964", IR: "98", IS: "354", IT: "39", JE: "44", JM: "1", JO: "962", JP: "81",
  KE: "254", KG: "996", KH: "855", KI: "686", KM: "269", KN: "1", KP: "850", KR: "82", KW: "965", KY: "1", KZ: "7", LA: "856", LB: "961", LC: "1",
  LI: "423", LK: "94", LR: "231", LS: "266", LT: "370", LU: "352", LV: "371", LY: "218", MA: "212", MC: "377", MD: "373", ME: "382", MF: "590", MG: "261",
  MH: "692", MK: "389", ML: "223", MM: "95", MN: "976", MO: "853", MP: "1", MQ: "596", MR: "222", MS: "1", MT: "356", MU: "230", MV: "960", MW: "265",
  MX: "52", MY: "60", MZ: "258", NA: "264", NC: "687", NE: "227", NF: "672", NG: "234", NI: "505", NL: "31", NO: "47", NP: "977", NR: "674", NU: "683",
  NZ: "64", OM: "968", PA: "507", PE: "51", PF: "689", PG: "675", PH: "63", PK: "92", PL: "48", PM: "508", PR: "1", PS: "970", PT: "351", PW: "680",
  PY: "595", QA: "974", RE: "262", RO: "40", RS: "381", RU: "7", RW: "250", SA: "966", SB: "677", SC: "248", SD: "249", SE: "46", SG: "65", SH: "290",
  SI: "386", SJ: "47", SK: "421", SL: "232", SM: "378", SN: "221", SO: "252", SR: "597", SS: "211", ST: "239", SV: "503", SX: "1", SY: "963", SZ: "268",
  TA: "290", TC: "1", TD: "235", TF: "262", TG: "228", TH: "66", TJ: "992", TK: "690", TL: "670", TM: "993", TN: "216", TO: "676", TR: "90", TT: "1",
  TV: "688", TW: "886", TZ: "255", UA: "380", UG: "256", UM: "1", US: "1", UY: "598", UZ: "998", VA: "379", VC: "1", VE: "58", VG: "1", VI: "1",
  VN: "84", VU: "678", WF: "681", WS: "685", XK: "383", YE: "967", YT: "262", ZA: "27", ZM: "260", ZW: "263",
  AFGHANISTAN: "93", ALBANIA: "355", ALGERIA: "213", ANDORRA: "376", ANGOLA: "244", ARGENTINA: "54", ARMENIA: "374", AUSTRALIA: "61",
  AUSTRIA: "43", AZERBAIJAN: "994", BAHRAIN: "973", BANGLADESH: "880", BELARUS: "375", BELGIUM: "32", BOLIVIA: "591", BOSNIA: "387",
  BOSNIAANDHERZEGOVINA: "387", BOTSWANA: "267", BRAZIL: "55", BRUNEI: "673", BULGARIA: "359", CAMBODIA: "855", CAMEROON: "237", CANADA: "1", CHILE: "56",
  CHINA: "86", COLOMBIA: "57", COSTARICA: "506", CROATIA: "385", CUBA: "53", CYPRUS: "357", CZECHREPUBLIC: "420", CZECHIA: "420", DENMARK: "45",
  DOMINICAN: "1", DOMINICANREPUBLIC: "1", ECUADOR: "593", EGYPT: "20", ESTONIA: "372", ETHIOPIA: "251", FINLAND: "358", FRANCE: "33",
  GEORGIA: "995", GERMANY: "49", GHANA: "233", GREECE: "30", GUATEMALA: "502", HONDURAS: "504", HUNGARY: "36", ICELAND: "354", INDIA: "91", INDONESIA: "62",
  IRAN: "98", IRAQ: "964", IRELAND: "353", ISRAEL: "972", ITALY: "39", JAMAICA: "1", JAPAN: "81", JORDAN: "962", KAZAKHSTAN: "7", KENYA: "254",
  KUWAIT: "965", LATVIA: "371", LEBANON: "961", LIECHTENSTEIN: "423", LITHUANIA: "370", LUXEMBOURG: "352", MALAYSIA: "60", MALTA: "356",
  MEXICO: "52", MOLDOVA: "373", MONACO: "377", MONTENEGRO: "382", MOROCCO: "212", NETHERLANDS: "31", NEWZEALAND: "64", NIGERIA: "234",
  NORWAY: "47", PAKISTAN: "92", PANAMA: "507", PERU: "51", PHILIPPINES: "63", POLAND: "48", PORTUGAL: "351", QATAR: "974", ROMANIA: "40", RUSSIA: "7",
  RUSSIANFEDERATION: "7", SAUDIARABIA: "966", SANMARINO: "378", SERBIA: "381", SINGAPORE: "65", SLOVAKIA: "421", SLOVENIA: "386", SOUTHAFRICA: "27",
  SOUTHKOREA: "82", SPAIN: "34", SRILANKA: "94", SWEDEN: "46", SWITZERLAND: "41", THAILAND: "66", TURKEY: "90", TURKIYE: "90", UKRAINE: "380", UAE: "971",
  UNITEDARABEMIRATES: "971", UK: "44", UNITEDKINGDOM: "44", UNITEDSTATES: "1", UNITEDSTATESOFAMERICA: "1", URUGUAY: "598", VENEZUELA: "58", VIETNAM: "84",
  DEUTSCHLAND: "49", OSTERREICH: "43", OESTERREICH: "43", SCHWEIZ: "41", SUISSE: "41", ITALIA: "39", FRANCIA: "33", ESPAGNE: "34", ESPANA: "34",
  POLSKA: "48", NEDERLAND: "31",
};
/** Italy keeps its leading 0 after +39 (fixed lines are +39 0…). */
const KEEP_TRUNK_ZERO = new Set(["39"]);

/** "Österreich" -> "OSTERREICH": upper case, no accents, letters only. */
export function normCountry(c: string | null | undefined): string {
  if (!c) return "";
  return String(c).trim().toUpperCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^A-Z]/g, "");
}
export const dialCode = (c: string | null | undefined): string | undefined => DIAL[normCountry(c)];

/** Digits and "+" only; "(0)" dropped; more than one "+" -> one in front. */
export function cleanPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = String(raw).trim().replace(/\(\s*0\s*\)/g, "").replace(/[^\d+]/g, "");
  if ((s.match(/\+/g) ?? []).length > 1) s = "+" + s.replace(/\D/g, "");
  return s;
}
export function phoneEmpty(p: string | null | undefined): boolean {
  if (!p) return true;
  const c = cleanPhone(p);
  return c.length === 0 || c === "+";
}
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  if (phoneEmpty(a) && phoneEmpty(b)) return true;
  return cleanPhone(a).replace(/^\++/, "") === cleanPhone(b).replace(/^\++/, "");
}

/** The international form (+41…), or "" when it cannot be made. */
export function toE164(raw: string | null | undefined, country: string | null | undefined): string {
  if (!raw || phoneEmpty(raw)) return "";
  const s = cleanPhone(raw);
  if (s.replace(/\+/g, "").length < 4) return "";
  if (s.startsWith("+") && s.length > 3) return s;
  if (s.startsWith("00") && s.length > 4) return "+" + s.slice(2);
  const dial = dialCode(country);
  if (!dial) return "";
  let digits = s.replace(/\D/g, "");
  // the country code typed without + or 00 ("41791234567")
  if (dial !== "39" && digits.startsWith(dial) && digits.length - dial.length >= 7 && !digits.startsWith("0")) return `+${digits}`;
  if (!KEEP_TRUNK_ZERO.has(dial) && digits.startsWith("0") && digits.length > 1) digits = digits.slice(1);
  if (!digits || digits.length < 4) return "";
  return `+${dial}${digits}`;
}

/** A valid phone number in the international form (+41791234567), or null - libphonenumber-js with its full metadata
 *  (SARCLA 25.10.2026: "the hub writes only valid numbers"; 1,179 of the workflow's 48,501 were not). */
export function validE164(s: string | null | undefined): string | null {
  if (!s || !s.startsWith("+")) return null;
  try {
    const n = parsePhoneNumberFromString(s);
    return n && n.isValid() ? n.number : null;
  } catch {
    return null;
  }
}

/** The valid form of a number, and whether reading it dropped a 0 typed after the country code ("+41 079 …" - the
 *  library reads it as +41 79 …; Italy keeps its 0, which the library knows). */
export function readValid(s: string | null | undefined): { phone: string; zero: boolean } | null {
  const v = validE164(s);
  if (!v || !s) return null;
  const c = cleanPhone(s);
  return { phone: v, zero: c !== v && c.length === v.length + 1 && c.replace(/^(\+\d{1,3})0/, "$1") === v };
}

/** Italy, San Marino and the Vatican keep their 0 after the country code - it is part of the number. */
const KEEP_ZERO = new Set(["39", "378", "379"]);
export type Repair = "double" | "zero";
/**
 * The workflow's two faults put right, only when the result is valid (the audit of 25.10.2026):
 *   double  a full international number typed without "+" ("31 6 1234 5678") - the workflow put the contact's own
 *           country code in front of it; it is the number with a "+"
 *   zero    "+41 079 …" - one 0 typed after the country code (not Italy, San Marino, the Vatican)
 */
export function repairPhone(raw: string | null | undefined): { phone: string; how: Repair } | null {
  const s = cleanPhone(raw), digits = s.replace(/\D/g, "");
  if (!s.startsWith("+") && !s.startsWith("00") && !digits.startsWith("0") && digits.length >= 10) {
    const v = validE164(`+${digits}`);
    return v ? { phone: v, how: "double" } : null;
  }
  if (s.startsWith("+") && /^\+\d+$/.test(s)) {
    for (const len of [1, 2, 3]) {
      const cc = digits.slice(0, len), rest = digits.slice(len);
      if (!rest.startsWith("0") || KEEP_ZERO.has(cc)) continue;
      const want = `+${cc}${rest.slice(1)}`;
      // exactly one 0 dropped - never a number the library would read differently
      if (validE164(want) === want) return { phone: want, how: "zero" };
    }
  }
  return null;
}

/** normalized = a valid +country number · repaired = valid after putting a workflow fault right · invalid = no valid
 *  number can be made (listed, nothing written) · same = nothing to write · none = no phone to take */
export type Status = "normalized" | "repaired" | "invalid" | "same" | "none";
export const STATUS_TEXT: Record<Status, string> = {
  normalized: "A valid number, in the international form",
  repaired: "Repaired - the shop phone already had a country code, or a 0 after it",
  invalid: "Not a valid phone number - nothing written, for a person to look at",
  same: "Already the same - nothing to write",
  none: "No phone to take",
};
export type Verdict = {
  phone: string | null; status: Status; from: "shop" | "phone" | null; country: string; countryFrom: "erp" | "contact" | "none";
  /** what the old workflow would have written (shown next to a number that is not valid) */
  asWorkflow?: string | null; how?: Repair;
};

/** The workflow's own answer: the +country form, else the digits, else the number as typed. */
function workflowAnswer(source: string, country: string): string | null {
  const e = toE164(source, country);
  if (e) return e;
  const cleaned = cleanPhone(source);
  if (cleaned && cleaned.replace(/\+/g, "").length >= 4) return cleaned;
  return /\d{4,}/.test(source) ? source : null;
}

/**
 * What the contact's phone becomes: the shop's phone (else its own), in the international form from its ERP country -
 * the workflow's own way first; then the contact's own country, then the two repairs. Only a valid number is ever
 * given; none = "invalid" (the workflow's answer kept to show).
 */
export function decidePhone(c: { shop?: string | null; phone?: string | null; countryCustom?: string | null; country?: string | null }): Verdict {
  const cc = String(c.countryCustom ?? "").trim(), co = String(c.country ?? "").trim();
  const [country, countryFrom]: [string, Verdict["countryFrom"]] = dialCode(cc) ? [cc, "erp"] : dialCode(co) ? [co, "contact"] : [cc || co, "none"];
  const shop = String(c.shop ?? "").trim(), own = String(c.phone ?? "").trim();
  const [source, from]: [string, Verdict["from"]] = !phoneEmpty(shop) ? [shop, "shop"] : !phoneEmpty(own) ? [own, "phone"] : ["", null];
  if (!from) return { phone: null, status: "none", from, country, countryFrom };
  const done = (phone: string, status: Status, cf: Verdict["countryFrom"], how?: Repair): Verdict =>
    ({ phone, status: samePhone(phone, own) ? "same" : status, from, country: cf === "contact" && countryFrom === "erp" ? co : country, countryFrom: cf, ...(how ? { how } : {}) });
  const first = readValid(toE164(source, country));
  if (first) return first.zero ? done(first.phone, "repaired", countryFrom, "zero") : done(first.phone, "normalized", countryFrom);
  // the ERP country gives no valid number: the contact's own country
  if (countryFrom === "erp" && dialCode(co) && dialCode(co) !== dialCode(cc)) {
    const second = readValid(toE164(source, co));
    if (second) return second.zero ? done(second.phone, "repaired", "contact", "zero") : done(second.phone, "normalized", "contact");
  }
  const fixed = repairPhone(source);
  if (fixed) return done(fixed.phone, "repaired", countryFrom, fixed.how);
  return { phone: null, status: "invalid", from, country, countryFrom, asWorkflow: workflowAnswer(source, country) };
}

/** A number a person typed on the tab: as written (+41 …, 0041 …), else read in the contact's ERP / own country - only
 *  when valid. */
export function manualPhone(input: string | null | undefined, countryCustom?: string | null, country?: string | null): string | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  const direct = readValid(cleanPhone(s).replace(/^00/, "+"));
  if (direct) return direct.phone;
  for (const k of [countryCustom, country]) {
    const v = readValid(toE164(s, k));
    if (v) return v.phone;
  }
  return null;
}

/**
 * A phone already in HubSpot (the list of the ones that are not valid): null = valid; else the certain repair, if any -
 *   nocode  written without a country code; the contact's ERP / own country gives a valid number
 *   double  the old workflow put the country code in front of a shop phone that already had one
 *   zero    one 0 after the country code
 */
export function checkPhone(c: { phone: string; shop?: string | null; countryCustom?: string | null; country?: string | null }): { repair: string | null; how: Repair | "nocode" | null } | null {
  const phone = String(c.phone ?? "").trim();
  // valid as it is stored (spaces and dashes do not count); a 0 the library had to drop is a repair
  const r = readValid(cleanPhone(phone));
  if (r) return r.zero ? { repair: r.phone, how: "zero" } : null;
  if (!phone.startsWith("+") && !phone.startsWith("00")) {
    for (const k of [c.countryCustom, c.country]) {
      const v = validE164(toE164(phone, k));
      if (v) return { repair: v, how: "nocode" };
    }
  }
  const shop = cleanPhone(c.shop), shopDigits = shop.replace(/\D/g, "");
  const dial = dialCode(c.countryCustom) || dialCode(c.country);
  if (dial && shopDigits && phone.replace(/\D/g, "") === dial + shopDigits) {
    const r = repairPhone(shop);
    if (r?.how === "double") return { repair: r.phone, how: "double" };
  }
  const z = repairPhone(phone);
  if (z?.how === "zero") return { repair: z.phone, how: "zero" };
  return { repair: null, how: null };
}
