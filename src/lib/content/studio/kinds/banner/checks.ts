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
  if (p.out === "html" && w.button && !w.url) out.push({ level: "warn", text: "The button goes nowhere - say where it leads." });
  if (p.motion && d.content.rotatingWords.filter((x) => x.trim()).length === 1) out.push({ level: "warn", text: "One changing word does not change - add another, or put it in the headline." });
  const pics = picturesOf(d);
  if (pics.some((u) => !mediaUrl(u))) out.push({ level: "stop", text: "A picture's address cannot be used - pick another picture." });
  if (p.out === "html" && pics.some(isHubPicture)) {
    out.push({ level: "warn", text: "The picture is kept in the hub, which the shop's visitors cannot reach. Download it, put it in the shop's media, then pick it by its shop address." });
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
