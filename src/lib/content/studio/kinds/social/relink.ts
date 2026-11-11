// SOCIAL POST - A LANGUAGE VERSION'S LINK, FOUND IN ITS OWN LANGUAGE (cv17, SARCLA 11.11.2026: "continue" - what cv16 left
// open: "a language version's link follows its language"). Pure: relative imports only - the server action (./server.ts
// "counterpart") and tests/studio-social-cv17.test.ts.
//
// The post's link is often a page of the shop: /de-CH/dichtungstechnik.html. Its French version must send its readers to
// /fr-CH/technologie-de-l-etancheite.html - another language has its own words for the same page, so it is never guessed:
// the Page builder already finds it, server side, from the shop's own hreflang links (page/shop.ts relinkOf - read once,
// one page at a time, the shop's firewall in mind). This file only says WHAT to ask it and reads its answer back:
//   linkAsk(url, lang)   the link to look up: a page of the shop in another language - its store view in the version's
//                        language (page/model.ts storeForLanguage: the link's own country where the shop has it), its host
//                        and what follows the page (?utm_source=linkedin, #sizes) kept aside
//   askDoc(ask)          the page-shaped document relinkOf reads: a new page in that store view whose one link is this one
//   linkAnswer(ask, r)   the address found, on the link's own host, its tracking kept - null: the shop has no such page

import { storeForLanguage } from "../page/model";
import { shopLinkOf } from "../page/links";

export type LinkAsk = {
  /** the version's language, small ("fr") */
  lang: string;
  /** the link's own language ("de") */
  from: string;
  /** the store view the page is looked for in ("fr-CH") */
  store: string;
  env: "prod" | "acc";
  /** "https://www.apsoparts.com", or "" for an address without its host ("/de-CH/...") */
  origin: string;
  /** the page's address on the shop ("/de-CH/dichtungstechnik.html") */
  path: string;
  /** what followed it: "?utm_source=linkedin", "#sizes" */
  tail: string;
};

const SHOP = /^(https?:\/\/(www|acc)\.apsoparts\.com)?(\/[^?#\s]*)([?#]\S*)?$/i;

/** A version's link to find in its language - null when it is not a page of the shop, or is one in that language already. */
export function linkAsk(url: string, lang: string | null | undefined): LinkAsk | null {
  const m = SHOP.exec(String(url ?? "").trim());
  const want = String(lang ?? "").slice(0, 2).toLowerCase();
  if (!m || !/^[a-z]{2}$/.test(want)) return null;
  const l = shopLinkOf(m[3]);
  if (!l) return null;
  const from = l.store.slice(0, 2).toLowerCase();
  if (from === want) return null;
  const env = (m[2] ?? "").toLowerCase() === "acc" ? "acc" : "prod";
  return {
    lang: want, from, store: storeForLanguage(want, l.store), env,
    origin: m[1] ? (env === "acc" ? "https://acc.apsoparts.com" : "https://www.apsoparts.com") : "",
    path: m[3], tail: m[4] ?? "",
  };
}

/** The address relinkOf is given (its page fields keep https addresses only). */
export const askUrl = (a: LinkAsk) => `https://www.apsoparts.com${a.path}`;

/** The page-shaped document the Page builder's relinkOf reads: a new page in the version's store view, its one link this one. */
export function askDoc(a: LinkAsk): Record<string, unknown> {
  return { v: 1, source: "new", env: a.env, store: a.store, stores: [a.store], fields: { links: [{ id: "l1", label: "", url: askUrl(a), note: "" }] } };
}

/** The address found for it, on the link's own host with its tracking and anchor kept - null when none was found. */
export function linkAnswer(a: LinkAsk, r: { map: Record<string, string> }): string | null {
  const found = r.map[askUrl(a)];
  if (!found) return null;
  const path = found.replace(/^https?:\/\/(www|acc)\.apsoparts\.com(?=\/)/i, "");
  const l = shopLinkOf(path);
  // only a page of the shop in the language asked for - anything else is not an answer
  if (!l || l.store.slice(0, 2).toLowerCase() !== a.lang) return null;
  return `${a.origin}${path}${a.tail}`;
}
