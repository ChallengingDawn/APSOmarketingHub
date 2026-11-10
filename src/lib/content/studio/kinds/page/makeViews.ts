// SEVERAL STORE VIEWS MADE IN ONE GO (Content v7, 10.11.2026). Pure: relative imports only - the studio and the tests.
//
// SARCLA 10.11.2026: "you should be able to multiselect store view". In "+ Store view" (and the assistant's "Translate the
// whole page into") several are ticked - one by one, all of a language, all of a country - and ONE action makes them: a
// store view of a language the page has is a COPY (no AI), another language is TRANSLATED once (one AI call) and the
// others of that language are then copies of it. They are made one at a time; how many AI calls it takes is said before.
//
// Content v10 (SARCLA 10.11.2026, point 6: "one page should be able to work to multiple locales directly by language
// association"): a version is a LANGUAGE going to several store views (./model.ts storesOfView). A store view ticked of a
// language the page has simply goes to that language's page - no copy, no AI ("tick"); a language the page does not have
// is translated ONCE, and goes to the store views of it that were ticked. A store view's own words are a split
// (model.ts splitStore), never a step of this plan.

import { countryStore, langName, langOfStore, leadOf, mainView, versionOfStore, type PageDoc } from "./model";
import { STORE_VIEWS, shopOrder } from "./storeViews";

/** `tick`: into the version of its language the page has (no AI); `translate`: a new language, going to `stores`;
 * `copy`: an older plan's own copy of a store view (kept for a run started before - never planned since Content v10). */
export type MakeStep = { key: string; how: "copy" | "translate" | "tick"; from: string; stores?: string[] };

/** Each language's own store view first, where it is among the ones ticked (de-CH, fr-CH, it-CH, en-INT, nl-NL, pl-PL). */
const HOME: Record<string, string[]> = { de: ["de-CH"], fr: ["fr-CH"], it: ["it-CH"], en: ["en-INT", "en-CH"], nl: ["nl-NL"], pl: ["pl-PL"], cs: ["cs-CZ"] };

/**
 * The steps that make the store views asked, in order (the page's own language first, then the shop's): a store view of a
 * language the page has goes to that language's page ("tick", no AI); the store views of another language are ONE
 * translation, shown in its own store view (de-CH, fr-CH, en-INT ...) and going to all of them. A store view the page
 * goes to already is left out; each asked once.
 */
export function planViews(d: PageDoc, keys: readonly string[]): MakeStep[] {
  const main = mainView(d);
  const asked = [...new Set(keys)].filter((k) => k && !versionOfStore(d, k)).sort((a, b) => shopOrder(a) - shopOrder(b));
  const langs = [...new Set(asked.map(langOfStore))];
  const order = ["de", "fr", "it", "en", "nl", "pl", "cs"];
  langs.sort((a, b) => (a === langOfStore(main) ? -1 : b === langOfStore(main) ? 1 : (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)));
  const steps: MakeStep[] = [];
  for (const l of langs) {
    const mine = asked.filter((k) => langOfStore(k) === l);
    const lead = leadOf(d, l);
    if (lead) { for (const k of mine) steps.push({ key: k, how: "tick", from: lead }); continue; }
    const first = (HOME[l] ?? []).find((h) => mine.includes(h)) ?? mine[0];
    steps.push({ key: first, how: "translate", from: main, stores: mine });
  }
  return steps;
}

/** "9 store views: 3 to the page's languages (no AI), French and Italian translated - 2 AI calls" - said before. */
export function planSummary(steps: readonly MakeStep[]): string {
  if (!steps.length) return "Tick the store views to make.";
  const ticks = steps.filter((s) => s.how !== "translate").length;
  const tr = steps.filter((s) => s.how === "translate");
  const views = ticks + tr.reduce((n, s) => n + (s.stores?.length ?? 1), 0);
  const names = tr.map((s) => langName(s.key));
  const said = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  const parts = [ticks ? `${ticks} to the page's language${ticks === 1 ? "" : "s"} (no AI)` : "", tr.length ? `${said} translated` : ""].filter(Boolean).join(", ");
  return `${views} store view${views === 1 ? "" : "s"}: ${parts}${tr.length ? ` - ${tr.length} AI call${tr.length === 1 ? "" : "s"}, one at a time` : ""}`;
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
