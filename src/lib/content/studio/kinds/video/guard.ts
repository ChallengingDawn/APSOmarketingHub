// VIDEO - THE WORDS' GUARDS (cv16, 11.11.2026). Pure: relative imports only - ./model.ts (the checks before the film goes
// out), ./ai.ts (every AI line) and tests/studio-video-cv16.test.ts.
//
// SARCLA 11.11.2026 ~18:25: "compare the evolution of this page [the Page builder] to the other content types' generators,
// and improve them". The Page builder keeps every AI text away from a stock or delivery-time promise, an invented price
// and a certificate nobody named (page/plan/newpage.ts guardText; banner/brand.ts STOCK_WORDS). The film had its own two
// (never a discount value, no prices - ./model.ts forbidden); now the rest, in the film's terms:
//   never on screen        a stock promise ("in stock", "ab Lager" - the shop's words, banner/brand.ts), Chemours
//   only when it is so     a delivery time ("in 24 h", "48/72 h", "next day") and a certificate (FDA, KTW, ISO 3601...):
//                          on screen only when the film's facts - its features' own words (./features.ts) and the brief -
//                          say it. APSOparts' "48/72h delivery across Europe" is a feature: a film about it may say so.

import { STOCK_WORDS } from "../banner/brand";

/** A delivery time promised: "in 24 h", "innert 2 Tagen", "48/72 h", "next-day". */
const DELIVERY: RegExp[] = [
  /\b(in|within|innerhalb( von)?|innert|en|entro|binnen|w ciągu)\s+\d+(\s*[/-]\s*\d+)?\s*(h\b|std|stunden|hours?|tage[n]?|days?|jours?|giorni|dagen|dni|werktage[n]?|business days)/i,
  /\b\d+\s*[/-]\s*\d+\s*(h|std|stunden|hours?)\b/i,
  /\b\d+\s*(h|std|stunden|hours?)[- ]?(delivery|lieferung|livraison|consegna|levering|dostawa)\b/i,
  /\b(next[- ]day|same[- ]day|overnight|over night|über nacht|le lendemain|il giorno dopo)\b/i,
];
/** Certificates and approvals - only when the facts name them (as page/plan/plan.ts CERTS). */
const CERTS = /\b(FDA|KTW|W270|WRAS|ACS|NSF|USP\s*Class(\s*VI)?|EC\s*1935|1935\/2004|10\/2011|REACH|RoHS|ATEX|UL\s?\d+|DVGW|BAM|3-A|EHEDG|ISO\s?\d{3,5}|DIN\s?EN\s?\d+|ADI[- ]free)\b/gi;

const flat = (s: string) => String(s ?? "").replace(/\*/g, "").replace(/\s+/g, " ").trim();
const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** Why a line never goes on screen, whatever the facts - or null. */
export function neverOnScreen(text: string): string | null {
  const t = flat(text);
  const stock = STOCK_WORDS.exec(t);
  if (stock) return `No stock promises on screen ("${stock[0]}").`;
  if (/\bchemours\b/i.test(t)) return "Never name Chemours.";
  return null;
}

/** The delivery times a line promises ("in 24 h", "48/72 h"), as said. */
export function deliveryIn(text: string): string[] {
  const t = flat(text);
  return DELIVERY.map((re) => re.exec(t)?.[0]).filter((x): x is string => !!x);
}

/** The certificates a line names. */
export const certsIn = (text: string): string[] => [...flat(text).matchAll(CERTS)].map((m) => m[0]);

/** Why a line may not go on screen unless the film's facts say it (`facts`: the features' own words, the brief) - or null. */
export function notInFacts(text: string, facts: string): string | null {
  const f = squash(facts);
  for (const d of deliveryIn(text)) {
    // every number of the promise must be in the facts ("48/72 h" when a feature states 48/72h)
    const nums = d.match(/\d+/g) ?? [];
    const said = nums.length ? nums.every((n) => new RegExp(`(^|\\D)${n}(\\D|$)`).test(f)) : f.includes(squash(d));
    if (!said) return `A delivery time no fact of the film states ("${d}").`;
  }
  for (const c of certsIn(text)) if (!f.includes(squash(c))) return `${c}: a certificate no fact of the film names.`;
  return null;
}
