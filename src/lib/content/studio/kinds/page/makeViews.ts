// SEVERAL STORE VIEWS MADE IN ONE GO (Content v7, 10.11.2026). Pure: relative imports only - the studio and the tests.
//
// SARCLA 10.11.2026: "you should be able to multiselect store view". In "+ Store view" (and the assistant's "Translate the
// whole page into") several are ticked - one by one, all of a language, all of a country - and ONE action makes them: a
// store view of a language the page has is a COPY (no AI), another language is TRANSLATED once (one AI call) and the
// others of that language are then copies of it. They are made one at a time; how many AI calls it takes is said before.

import { countryStore, langName, langOfStore, mainView, viewsOf, type PageDoc } from "./model";
import { STORE_VIEWS, shopOrder } from "./storeViews";

export type MakeStep = { key: string; how: "copy" | "translate"; from: string };

/** Each language's own store view first, where it is among the ones ticked (de-CH, fr-CH, it-CH, en-INT, nl-NL, pl-PL). */
const HOME: Record<string, string[]> = { de: ["de-CH"], fr: ["fr-CH"], it: ["it-CH"], en: ["en-INT", "en-CH"], nl: ["nl-NL"], pl: ["pl-PL"] };

/**
 * The steps that make the store views asked, in order: per language, its translation first (when the page has no store
 * view of it yet), then its copies. A copy is made from the same store view in its other currency when there is one,
 * else from the first of its language. Store views the page has already are left out; each asked once.
 */
export function planViews(d: PageDoc, keys: readonly string[]): MakeStep[] {
  const main = mainView(d);
  const have = viewsOf(d);
  const asked = [...new Set(keys)].filter((k) => k && !have.includes(k)).sort((a, b) => shopOrder(a) - shopOrder(b));
  const langs = [...new Set(asked.map(langOfStore))];
  // the page's own language first, then the shop's order of languages
  const order = ["de", "fr", "it", "en", "nl", "pl"];
  langs.sort((a, b) => (a === langOfStore(main) ? -1 : b === langOfStore(main) ? 1 : (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)));
  const made = [...have];
  const steps: MakeStep[] = [];
  for (const l of langs) {
    const mine = asked.filter((k) => langOfStore(k) === l);
    let rest = mine;
    if (!made.some((k) => langOfStore(k) === l)) {
      const first = (HOME[l] ?? []).find((h) => mine.includes(h)) ?? mine[0];
      steps.push({ key: first, how: "translate", from: main });
      made.push(first);
      rest = mine.filter((k) => k !== first);
    }
    for (const k of rest) {
      const same = made.filter((x) => langOfStore(x) === l);
      const twin = same.find((x) => countryStore(x) === countryStore(k));
      steps.push({ key: k, how: "copy", from: twin ?? same[0] });
      made.push(k);
    }
  }
  return steps;
}

/** "5 store views: 3 copies (no AI), 2 translations - 2 AI calls" - said before anything starts. */
export function planSummary(steps: readonly MakeStep[]): string {
  if (!steps.length) return "Tick the store views to make.";
  const copies = steps.filter((s) => s.how === "copy").length;
  const tr = steps.length - copies;
  const parts = [copies ? `${copies} cop${copies === 1 ? "y" : "ies"} (no AI)` : "", tr ? `${tr} translation${tr === 1 ? "" : "s"}` : ""].filter(Boolean).join(", ");
  return `${steps.length} store view${steps.length === 1 ? "" : "s"}: ${parts}${tr ? ` - ${tr} AI call${tr === 1 ? "" : "s"}, one at a time` : ""}`;
}

/** The store views of the shop in one language ("all of a language"), in the shop's order. */
export const viewsOfLanguage = (lang: string, all: readonly string[] = STORE_VIEWS.map((v) => v.key)): string[] => all.filter((k) => langOfStore(k) === lang.toLowerCase());

/** The store views of the shop in one country, both currencies ("all of a country"): "CH" -> de-CH ... en-CH/eur. */
export const viewsOfCountry = (cc: string, all: readonly string[] = STORE_VIEWS.map((v) => v.key)): string[] =>
  all.filter((k) => (countryStore(k) ?? "").split("-")[1] === cc.toUpperCase());

/** The countries and the languages the shop has, for the quick ticks. */
export const SHOP_COUNTRIES: { cc: string; name: string }[] = [...new Map(STORE_VIEWS.map((v) => [v.cc, { cc: v.cc, name: v.country }])).values()];
export const SHOP_LANGUAGES: { lang: string; name: string }[] = [...new Set(STORE_VIEWS.map((v) => v.lang))].map((l) => ({ lang: l, name: langName(l) }));

/** Ticks: a set of store views flipped on or off as one (all of a language / of a country): on unless all are on already. */
export function toggleAll(picked: readonly string[], set: readonly string[]): string[] {
  const allOn = set.length > 0 && set.every((k) => picked.includes(k));
  return allOn ? picked.filter((k) => !set.includes(k)) : [...new Set([...picked, ...set])];
}
