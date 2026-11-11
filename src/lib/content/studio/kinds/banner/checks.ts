// BANNER - WHAT TO LOOK AT BEFORE IT GOES OUT, PLACE BY PLACE (08.11.2026; SARCLA: "the banner can be in multiple
// places" - so each place has its own checks). Pure: tests/studio-banner.test.ts.
//   stop   it cannot go out like this (a discount value, Chemours, words far over the room, a picture that cannot show)
//   warn   worth a look (a little over the room, no button target, one changing word, a hub picture on the shop)

import { brandFlags, isHubPicture, mediaUrl } from "./brand";
import { unreadable } from "./looks";
import { PRESET, overLimits, sizesOf, wordsFor, type BannerDoc, type PresetKey } from "./model";

export type Check = { level: "stop" | "warn"; text: string };

const FIELD = { eyebrow: "eyebrow", headline: "headline", word: "a changing word", line: "line", button: "button" } as const;

/** The pictures the banner shows (the changing ones, else the one). */
export const picturesOf = (d: BannerDoc) => (d.content.photos.length >= 2 ? d.content.photos.map((p) => p.url) : [d.content.image.url]).filter((u) => u.trim());

/** What to look at for one place. */
export function placeChecks(d: BannerDoc, k: PresetKey): Check[] {
  const p = PRESET[k];
  const w = wordsFor(d, k);
  const out: Check[] = [];
  for (const o of overLimits(d, k)) {
    const far = o.by > Math.max(6, p.limits[o.field] * 0.25);
    out.push({ level: far ? "stop" : "warn", text: `The ${FIELD[o.field]} is ${o.by} character${o.by === 1 ? "" : "s"} too long here${far ? "" : " - it may be cut"}. Give this place shorter words.` });
  }
  if (!w.headline) out.push({ level: "stop", text: "No headline yet." });
  // can it be read (Content v7): every word against what it stands on - the page studio's readability sums (looks.ts)
  for (const u of unreadable(d)) out.push({ level: "stop", text: u.text });
  if (d.look === "photo" && picturesOf(d).length && (d.content.photos.length >= 2 ? d.content.photos[0] : d.content.image).fit === "product") {
    out.push({ level: "warn", text: "A product photo on white reads better in another design - the photo behind the words wants a scene." });
  }
  for (const f of brandFlags([w.eyebrow, w.headline, ...w.words, w.line, w.button].join("\n"))) out.push({ level: "stop", text: f });
  // cv16: prices and delivery times too, as the Page builder's word rules (below)
  for (const f of promiseFlags([w.eyebrow, w.headline, ...w.words, w.line, w.button].join("\n"))) out.push({ level: "stop", text: f });
  if (p.out === "html" && w.button && !w.url) out.push({ level: "warn", text: "The button goes nowhere - say where it leads." });
  if (p.motion && d.content.rotatingWords.filter((x) => x.trim()).length === 1) out.push({ level: "warn", text: "One changing word does not change - add another, or put it in the headline." });
  const pics = picturesOf(d);
  if (pics.some((u) => !mediaUrl(u))) out.push({ level: "stop", text: "A picture's address cannot be used - pick another picture." });
  if (p.out === "html" && pics.some(isHubPicture)) {
    // cv16: "Copy the paste block" stores it in the hub's picture storage first (./media.ts, server.ts store_media)
    out.push({ level: "warn", text: "The picture is kept in the hub: copying the paste block stores it in the hub's picture storage first, where the shop's visitors see it." });
  }
  if (!pics.length && (p.group === "social" || p.group === "mail")) out.push({ level: "warn", text: "No picture - this place reads better with one." });
  return dedupe(out);
}

/** The checks for every place, then the banner's own - each said once, with the places it is about. */
export function allChecks(d: BannerDoc): { place: PresetKey; checks: Check[] }[] {
  return sizesOf(d).map((k) => ({ place: k, checks: placeChecks(d, k) }));
}

/** How a place stands: ready, worth a look, or not yet. */
export function placeState(checks: Check[]): "ready" | "look" | "stop" {
  return checks.some((c) => c.level === "stop") ? "stop" : checks.length ? "look" : "ready";
}

function dedupe(list: Check[]): Check[] {
  const seen = new Set<string>();
  return list.filter((c) => (seen.has(c.text) ? false : (seen.add(c.text), true)));
}

// a price ("CHF 12.50", "ab 9 €") or a delivery time ("in 24 h", "innert 2 Tagen") - the banner's checks say them too
// (cv16 - brand.ts brandFlags is shared with the social studio and stays as it is)
const PRICE = /(\b(CHF|EUR|USD|PLN|Fr\.)\s?\d|\d+([.,]\d+)?\s?(€|\$|CHF|EUR|USD|PLN)(?![\p{L}])|[€$]\s?\d)/iu;
const DELIVERY = /\b(in|within|innerhalb( von)?|innert|en|entro|binnen|w ciągu)\s+\d+(\s*[/-]\s*\d+)?\s*(h\b|std|stunden|hours?|tage[n]?|days?|jours?|giorni|dagen|dni|werktage[n]?|business days)/i;

/** A price or a delivery time in a banner's words: a short sentence each for the checks ([] = none). */
export function promiseFlags(text: string): string[] {
  const t = String(text ?? "");
  const out: string[] = [];
  const p = PRICE.exec(t);
  if (p) out.push(`No prices on a banner - take out "${p[0].trim()}".`);
  const d = DELIVERY.exec(t);
  if (d) out.push(`No delivery times on our pieces - take out "${d[0].trim()}".`);
  return out;
}
