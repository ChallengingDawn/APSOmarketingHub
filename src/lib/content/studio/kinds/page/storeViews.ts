// THE SHOP'S STORE VIEWS, AS MAGENTO HAS THEM (09.11.2026). Pure: no "@/" imports, no network - the page studio
// (./model.ts), the Magento step (src/lib/convert/cms.ts) and the tests all read it.
//
// SARCLA 09.11.2026: "store views are still missing - for example international and the EUR version of the store". The
// studio's list came from the hreflang set and the sitemaps (14 addresses) and merged a currency into its country
// ("de-CH/eur" -> "de-CH"), so the Swiss shop in EUR, the English store views of every country and en-CH did not exist
// in it. Read on www.apsoparts.com that night, GET only: each country's front page carries the shop's own country /
// language switcher (`<li class="view-<store code> switcher-option">`) and its own "storeCode", "storeId" and
// "storeCurrencyCode". Twenty-five store views:
//
//   Switzerland, CHF   de-CH  fr-CH  it-CH  en-CH                 switzerland_chf_<lang>   ids 6, 7, 8, 5
//   Switzerland, EUR   de-CH/eur  fr-CH/eur  it-CH/eur  en-CH/eur  switzerland_eur_<lang>   ids 1, 3, 4, 2
//   Germany            de-DE  en-DE                                 germany_eur_<lang>       en 9
//   Austria            de-AT  en-AT                                 austria_eur_<lang>       en 11
//   France             fr-FR  en-FR                                 france_eur_<lang>        en 17
//   Italy              it-IT  en-IT                                 italy_eur_<lang>         en 19
//   Netherlands        nl-NL  en-NL                                 netherlands_eur_<lang>   en 21
//   International      en-INT de-INT fr-INT it-INT nl-INT           international_eur_<lang> en 26, nl 30
//   Poland             pl-PL  en-PL                                 poland_eur_<lang>        en 33
//
// A store view's KEY is its address on the shop: "<lang>-<COUNTRY>", and "/eur" after it for the Swiss shop's second
// currency (the shop's own spelling: www.apsoparts.com/de-CH/eur/). Its Magento store code is <country>_<currency>_<lang>
// - the code a CMS page is created under (POST /rest/<code>/V1/cmsPage). A write still reads the code and id from the
// store view's own front page first (./cms.ts storeRefOf); since Content v10 the list keeps the ids too (below).
//
// Content v10 (10.11.2026, SARCLA point 6, with two photos of Magento's own CMS page form - its "Store View" multi-select,
// "the store views we face each time we create a page"): the list is MAGENTO'S, by website as that form shows them -
// Switzerland EUR, Switzerland CHF, Germany, Austria, France, Italy, Netherlands, Czech Republic, China, International,
// Poland - with the four the shop's pages never showed: Czech Republic EUR (EN, CS), China EUR (EN) and International's
// CS. Their front pages are not open (www.apsoparts.com/cs-CZ/, /en-CZ/, /en-CN/ and /cs-INT/ all lead to /en-INT/, read
// 10.11.2026), so their store CODE and ID are not known to the hub - the list says so instead of guessing. The ids of the
// other 25 were read that day from each front page ("storeId"), on production AND on ACC: the same on both.
//
//   Switzerland EUR  de 1  en 2  fr 3  it 4          Netherlands EUR  en 21  nl 22
//   Switzerland CHF  de 6  en 5  fr 7  it 8          Czech Rep. EUR   en ?   cs ?
//   Germany EUR      en 9  de 10                     China EUR        en ?
//   Austria EUR      en 11 de 12                     International    en 26  de 27  fr 28  it 29  nl 30  cs ?
//   France EUR       en 17 fr 18                     Poland EUR       en 33  pl 36
//   Italy EUR        en 19 it 20
//
// A CMS page written for several store views carries them all in its store_id (./cmsPage.ts): a store view whose id is not
// known cannot be put in - the last step says so, and it is ticked in Magento by hand.

export type Currency = "CHF" | "EUR";

export type StoreView = {
  /** "de-CH", "de-CH/eur" - its address on the shop, and the key the hub keeps it under */
  key: string;
  /** "de" */
  lang: string;
  /** "CH", "INT" - as the address writes it */
  cc: string;
  /** "Switzerland" */
  country: string;
  currency: Currency;
  /** Magento's store code: "switzerland_eur_de" - null where the shop has never shown it (Czech Republic, China, CS) */
  code: string | null;
  /** Magento's store id (the same on production and ACC, read 10.11.2026) - null where it is not known */
  id: number | null;
  /** its front page answers on the shop (false: it leads to /en-INT/ - the store view is not open yet) */
  open: boolean;
  /** Magento's website it belongs to, as its forms name it: "Switzerland EUR" */
  website: string;
};

type Country = { cc: string; name: string; code: string; currencies: Currency[] };

/** The countries: their address's code, their name, Magento's code for them and their currencies (the first is the plain
 * address: de-CH is the Swiss shop in CHF, de-CH/eur its EUR one). */
const COUNTRIES: Country[] = [
  { cc: "CH", name: "Switzerland", code: "switzerland", currencies: ["CHF", "EUR"] },
  { cc: "DE", name: "Germany", code: "germany", currencies: ["EUR"] },
  { cc: "AT", name: "Austria", code: "austria", currencies: ["EUR"] },
  { cc: "FR", name: "France", code: "france", currencies: ["EUR"] },
  { cc: "IT", name: "Italy", code: "italy", currencies: ["EUR"] },
  { cc: "NL", name: "Netherlands", code: "netherlands", currencies: ["EUR"] },
  { cc: "CZ", name: "Czech Republic", code: "", currencies: ["EUR"] },
  { cc: "CN", name: "China", code: "", currencies: ["EUR"] },
  { cc: "INT", name: "International", code: "international", currencies: ["EUR"] },
  { cc: "PL", name: "Poland", code: "poland", currencies: ["EUR"] },
];

/** Magento's websites in the order its CMS page form lists them, each with its store views in that form's order and their
 * ids (null: not known - never guessed). `hidden`: its code was never shown by the shop (the store view is not open). */
const WEBSITES: { cc: string; currency: Currency; views: { lang: string; id: number | null; hidden?: true }[] }[] = [
  { cc: "CH", currency: "EUR", views: [{ lang: "de", id: 1 }, { lang: "en", id: 2 }, { lang: "fr", id: 3 }, { lang: "it", id: 4 }] },
  { cc: "CH", currency: "CHF", views: [{ lang: "de", id: 6 }, { lang: "en", id: 5 }, { lang: "fr", id: 7 }, { lang: "it", id: 8 }] },
  { cc: "DE", currency: "EUR", views: [{ lang: "en", id: 9 }, { lang: "de", id: 10 }] },
  { cc: "AT", currency: "EUR", views: [{ lang: "en", id: 11 }, { lang: "de", id: 12 }] },
  { cc: "FR", currency: "EUR", views: [{ lang: "en", id: 17 }, { lang: "fr", id: 18 }] },
  { cc: "IT", currency: "EUR", views: [{ lang: "en", id: 19 }, { lang: "it", id: 20 }] },
  { cc: "NL", currency: "EUR", views: [{ lang: "en", id: 21 }, { lang: "nl", id: 22 }] },
  { cc: "CZ", currency: "EUR", views: [{ lang: "en", id: null, hidden: true }, { lang: "cs", id: null, hidden: true }] },
  { cc: "CN", currency: "EUR", views: [{ lang: "en", id: null, hidden: true }] },
  { cc: "INT", currency: "EUR", views: [{ lang: "en", id: 26 }, { lang: "de", id: 27 }, { lang: "fr", id: 28 }, { lang: "it", id: 29 }, { lang: "nl", id: 30 }, { lang: "cs", id: null, hidden: true }] },
  { cc: "PL", currency: "EUR", views: [{ lang: "en", id: 33 }, { lang: "pl", id: 36 }] },
];

export const LANGUAGE_NAME: Record<string, string> = { de: "German", fr: "French", it: "Italian", en: "English", nl: "Dutch", pl: "Polish", cs: "Czech", es: "Spanish" };

const keyOf = (lang: string, c: Country, cur: Currency) => `${lang}-${c.cc}${cur === c.currencies[0] ? "" : `/${cur.toLowerCase()}`}`;

/** Every store view of the shop, by website in Magento's order, each website's store views in its form's order. */
export const STORE_VIEWS: StoreView[] = WEBSITES.flatMap((w) => {
  const c = COUNTRIES.find((x) => x.cc === w.cc)!;
  return w.views.map((v): StoreView => ({
    key: keyOf(v.lang, c, w.currency), lang: v.lang, cc: c.cc, country: c.name, currency: w.currency,
    code: v.hidden || !c.code ? null : `${c.code}_${w.currency.toLowerCase()}_${v.lang}`, id: v.id, open: !v.hidden, website: `${c.name} ${w.currency}`,
  }));
});

const BY_KEY = new Map(STORE_VIEWS.map((v) => [v.key, v]));
const BY_CODE = new Map(STORE_VIEWS.filter((v) => v.code).map((v) => [v.code!, v]));

/**
 * A store view as the shop writes it, its currency kept where the shop has a second one: "de-ch/EUR" -> "de-CH/eur",
 * "fr-CH" -> "fr-CH"; the country's own currency is the plain address ("de-CH/chf" -> "de-CH"). Null when it is not one.
 */
export function storeKey(raw: string | null | undefined): string | null {
  const m = /^([a-z]{2})-([a-z]{2,3})(?:\/([a-z]{3}))?$/i.exec(String(raw ?? "").trim());
  if (!m) return null;
  const plain = `${m[1].toLowerCase()}-${m[2].toUpperCase()}`;
  const cur = m[3]?.toLowerCase();
  if (!cur) return plain;
  const c = COUNTRIES.find((x) => x.cc === m[2].toUpperCase());
  // the country's own currency is its plain address; a currency it does not have is not a store view of it
  if (c && c.currencies[0].toLowerCase() === cur) return plain;
  return `${plain}/${cur}`;
}

/** The store view without its currency: "de-CH/eur" -> "de-CH" (its language and country - hreflang knows no currency). */
export function countryStore(raw: string | null | undefined): string | null {
  const k = storeKey(raw);
  return k ? k.split("/")[0] : null;
}

/** A store view of the shop's list, or null. */
export const storeViewOf = (raw: string | null | undefined): StoreView | null => BY_KEY.get(storeKey(raw) ?? "") ?? null;
/** Magento's store code of a store view ("de-CH/eur" -> "switzerland_eur_de"), or null when the shop has none such. */
export const storeCodeOf = (raw: string | null | undefined): string | null => storeViewOf(raw)?.code ?? null;
/** The store view a Magento store code names ("international_eur_nl" -> nl-INT), or null. */
export const storeViewByCode = (code: string | null | undefined): StoreView | null => BY_CODE.get(String(code ?? "").toLowerCase()) ?? null;

/** Magento's store id of a store view (the same on production and ACC), or null when the hub does not know it. */
export const storeIdOf = (raw: string | null | undefined): number | null => storeViewOf(raw)?.id ?? null;

/** Its currency: the list's, else the one in its key, else the country's own (CHF in Switzerland, EUR elsewhere). */
export function currencyOf(raw: string | null | undefined): Currency | null {
  const k = storeKey(raw);
  if (!k) return null;
  const v = BY_KEY.get(k);
  if (v) return v.currency;
  const cur = k.split("/")[1];
  if (cur) return cur.toUpperCase() as Currency;
  return /-CH$/.test(k) ? "CHF" : "EUR";
}

/** "Switzerland · German · EUR" - a store view as people say it. */
export function viewName(raw: string | null | undefined): string {
  const k = storeKey(raw);
  if (!k) return String(raw ?? "");
  const v = BY_KEY.get(k);
  const lang = LANGUAGE_NAME[k.slice(0, 2)] ?? k.slice(0, 2).toUpperCase();
  if (v) return `${v.country} · ${lang} · ${v.currency}`;
  const cc = k.slice(3).split("/")[0];
  return `${COUNTRIES.find((c) => c.cc === cc)?.name ?? cc} · ${lang} · ${currencyOf(k)}`;
}

/** "DE-CH" / "DE-CH · EUR" - a store view on a tab. The plain address names its country's own currency. */
export function viewShort(raw: string | null | undefined): string {
  const k = storeKey(raw);
  if (!k) return String(raw ?? "").toUpperCase();
  const [base, cur] = k.split("/");
  return cur ? `${base.toUpperCase()} · ${cur.toUpperCase()}` : base.toUpperCase();
}

/** Two store views with the same language and country, one per currency ("de-CH" and "de-CH/eur"). */
export const sameCountry = (a: string, b: string) => countryStore(a) === countryStore(b);

/** The shop's order of a store view (STORE_VIEWS), unknown ones last. */
export function shopOrder(raw: string): number {
  const i = STORE_VIEWS.findIndex((v) => v.key === storeKey(raw));
  return i < 0 ? 999 : i;
}

/** A store view group as the shop's switcher shows it: one country in one currency, its languages. */
export type CountryGroup = { key: string; country: string; currency: Currency | null; label: string; stores: string[] };

/**
 * The store views grouped as Magento has them - a country in a currency ("Switzerland · CHF", "Switzerland · EUR",
 * "Germany · EUR" ...) - the shop's list first, then any store view `more` names that the list does not have (the page
 * index, a document's own), under "Other".
 */
export function countryGroups(more: readonly string[] = []): CountryGroup[] {
  const out: CountryGroup[] = [];
  for (const v of STORE_VIEWS) {
    const key = `${v.cc}|${v.currency}`;
    let g = out.find((x) => x.key === key);
    if (!g) { g = { key, country: v.country, currency: v.currency, label: `${v.country} · ${v.currency}`, stores: [] }; out.push(g); }
    g.stores.push(v.key);
  }
  const extra = [...new Set(more.map(storeKey).filter((k): k is string => !!k && !BY_KEY.has(k)))].sort();
  if (extra.length) out.push({ key: "other", country: "Other", currency: null, label: "Other store views", stores: extra });
  return out;
}

/** The store codes a page's country / language switcher names (`view-<code>` on each option) - what the shop has. */
export function codesInSwitcher(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/class=["'][^"']*\bview-([a-z]+_[a-z]{3}_[a-z]{2})\b/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}
