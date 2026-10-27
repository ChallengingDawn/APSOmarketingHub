// SATISFACTION - the rules, pure (SARCLA 27.10.2026: "a Satisfaction tab to show the happiness per country - based on
// locales - and languages and locale, and a new KPI page for satisfaction"). Every answer to a HubSpot feedback survey
// is read from what HubSpot keeps on it (src/lib/satisfaction/sync.ts) and placed here:
//   touchpoint  - from the survey's name: order success on the shop, the live chat, the shop chat, a Back Office ticket,
//                 a TSA call (never per person - the TSA_CALL_<NAME> surveys are one touchpoint), the NPS e-mail;
//   language    - the survey name's prefix (DE_, FR_, IT_, EN_, NL_, PL_), the language the customer answered in, else
//                 the store view's;
//   locale      - the shop's store view the answer was given on, from the page's address (.../de-DE/checkout/...), else
//                 language-country from the answer;
//   country     - the store view's country, else the answer's own country field, else the contact's country (ISO code);
//   sentiment   - a CSAT answer: happy / neutral / unhappy (HubSpot's 2 / 1 / 0); an NPS answer (0-10) is kept apart as
//                 promoter / passive / detractor, never mixed into the CSAT.
// No imports: the tests load it as is.

export type Touchpoint = "order" | "chat" | "shopchat" | "bo" | "tsa" | "nps" | "email" | "other";
export const TOUCHPOINT_LABEL: Record<Touchpoint, string> = {
  order: "Order success (shop)", chat: "Live chat", shopchat: "Shop chat", bo: "Back Office ticket", tsa: "TSA call",
  nps: "NPS e-mail", email: "E-mail survey", other: "Other surveys",
};
/** the chat's two touchpoints - the APSOassistant Chat page's Satisfaction tab */
export const CHAT_TOUCHPOINTS: Touchpoint[] = ["chat", "shopchat"];

/** The shop chat's survey (SARCLA's twin of EN_CSAT_Live_Chat_2501, a link survey answered from our own window). */
export const SHOP_CHAT_FORM = "e524ee0a-3ba8-4097-9c13-45fb37b859ee";

export function touchpointOf(surveyName: string | null | undefined, formGuid?: string | null): Touchpoint {
  if (formGuid && formGuid.toLowerCase() === SHOP_CHAT_FORM) return "shopchat";
  const n = String(surveyName || "").toUpperCase();
  if (/ORDER_SUCCESS/.test(n)) return "order";
  if (/LIVE_CHAT/.test(n)) return "chat";
  if (/BO_TICKET/.test(n)) return "bo";
  if (/TSA_CALL/.test(n)) return "tsa";
  if (/NPS/.test(n)) return "nps";
  if (/SURVEY_EMAIL|EMAIL/.test(n)) return "email";
  return "other";
}

const LANGS = ["de", "fr", "it", "en", "nl", "pl"];
export const LANGUAGE_LABEL: Record<string, string> = { de: "German", fr: "French", it: "Italian", en: "English", nl: "Dutch", pl: "Polish" };
/** The survey name's prefix: "DE_CSAT_Order_Success_2403" -> de. Null when the name carries none. */
export function languageOf(surveyName: string | null | undefined): string | null {
  const m = /^([A-Za-z]{2})_/.exec(String(surveyName || ""));
  const l = m ? m[1].toLowerCase() : null;
  return l && LANGS.includes(l) ? l : null;
}

/** HubSpot's country names (the answer's and the contact's country fields) to ISO codes; an ISO code passes. */
const COUNTRY_ISO: Record<string, string> = {
  switzerland: "CH", schweiz: "CH", suisse: "CH", svizzera: "CH", germany: "DE", deutschland: "DE", austria: "AT", österreich: "AT",
  france: "FR", italy: "IT", italia: "IT", netherlands: "NL", "the netherlands": "NL", nederland: "NL", poland: "PL", polska: "PL",
  liechtenstein: "LI", belgium: "BE", luxembourg: "LU", spain: "ES", portugal: "PT", "united kingdom": "GB", "united states": "US",
  slovenia: "SI", hungary: "HU", "czech republic": "CZ", czechia: "CZ", bulgaria: "BG", latvia: "LV", denmark: "DK", sweden: "SE",
  slovakia: "SK", croatia: "HR", romania: "RO", greece: "GR", ireland: "IE", finland: "FI", norway: "NO", lithuania: "LT", estonia: "EE",
};
export const COUNTRY_LABEL: Record<string, string> = {
  CH: "Switzerland", DE: "Germany", AT: "Austria", FR: "France", IT: "Italy", NL: "Netherlands", PL: "Poland", LI: "Liechtenstein",
  BE: "Belgium", LU: "Luxembourg", ES: "Spain", PT: "Portugal", GB: "United Kingdom", US: "United States", SI: "Slovenia", HU: "Hungary",
  CZ: "Czech Republic", BG: "Bulgaria", LV: "Latvia", DK: "Denmark", SE: "Sweden", SK: "Slovakia", HR: "Croatia", RO: "Romania",
  GR: "Greece", IE: "Ireland", FI: "Finland", NO: "Norway", LT: "Lithuania", EE: "Estonia",
};
export function countryIso(v: string | null | undefined): string | null {
  const s = String(v || "").trim();
  if (!s) return null;
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  return COUNTRY_ISO[s.toLowerCase()] ?? null;
}

/** The store view in the address the survey was answered on: "https://www.apsoparts.com/de-DE/checkout/..." -> de, DE. */
export function storeViewOf(url: string | null | undefined): { language: string; country: string } | null {
  const m = /^https?:\/\/[^/]+\/([a-z]{2})-([a-z]{2})(?:\/|$|\?|#)/i.exec(String(url || ""));
  if (!m || !LANGS.includes(m[1].toLowerCase())) return null;
  return { language: m[1].toLowerCase(), country: m[2].toUpperCase() };
}

/** language-country as the shop's store views name them (de-CH); "–" for a side that is not known. */
export function localeOf(language: string | null, country: string | null): string | null {
  if (!language && !country) return null;
  return `${language ?? "–"}-${country ?? "–"}`;
}

export type Sentiment = "happy" | "neutral" | "unhappy";
export type NpsGroup = "promoter" | "passive" | "detractor";
/**
 * One answer's reading. A CSAT answer: HubSpot's sentiment (Happy / Neutral / Unhappy), else its 0 / 1 / 2 value. An
 * NPS answer (an NPS survey, or a value above 2): its response group, never a CSAT sentiment.
 */
export function readingOf(p: { surveyName?: string | null; sentiment?: string | null; value?: string | number | null; group?: string | null }):
  { sentiment: Sentiment | null; nps: NpsGroup | null } {
  const v = p.value === null || p.value === undefined || p.value === "" ? null : Number(p.value);
  const isNps = /NPS/i.test(String(p.surveyName || "")) || (v !== null && v > 2) || /^(promoter|passive|detractor)$/i.test(String(p.sentiment || ""));
  if (isNps) {
    const g = String(p.group || p.sentiment || "").toLowerCase();
    const nps = g === "promoter" || g === "passive" || g === "detractor" ? (g as NpsGroup)
      : v === null ? null : v >= 9 ? "promoter" : v >= 7 ? "passive" : "detractor";
    return { sentiment: null, nps };
  }
  const s = String(p.sentiment || "").toLowerCase();
  if (s === "happy" || s === "neutral" || s === "unhappy") return { sentiment: s, nps: null };
  if (v === 2) return { sentiment: "happy", nps: null };
  if (v === 1) return { sentiment: "neutral", nps: null };
  if (v === 0) return { sentiment: "unhappy", nps: null };
  return { sentiment: null, nps: null };
}

export type Tally = { answers: number; happy: number; neutral: number; unhappy: number; promoters: number; passives: number; detractors: number };
export const emptyTally = (): Tally => ({ answers: 0, happy: 0, neutral: 0, unhappy: 0, promoters: 0, passives: 0, detractors: 0 });
export function add(t: Tally, r: { sentiment: Sentiment | null; nps: NpsGroup | null }): Tally {
  t.answers++;
  if (r.sentiment === "happy") t.happy++; else if (r.sentiment === "neutral") t.neutral++; else if (r.sentiment === "unhappy") t.unhappy++;
  if (r.nps === "promoter") t.promoters++; else if (r.nps === "passive") t.passives++; else if (r.nps === "detractor") t.detractors++;
  return t;
}
/** CSAT: the happy share of the CSAT answers (HubSpot's own definition); null without one. */
export function csat(t: Tally): number | null {
  const n = t.happy + t.neutral + t.unhappy;
  return n ? t.happy / n : null;
}
/** NPS: promoters minus detractors, in points (-100 .. 100); null without an NPS answer. */
export function nps(t: Tally): number | null {
  const n = t.promoters + t.passives + t.detractors;
  return n ? Math.round(((t.promoters - t.detractors) / n) * 100) : null;
}
