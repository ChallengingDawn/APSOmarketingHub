// A PAGE'S LINKS TO THE SHOP, IN ITS OWN STORE VIEW (Content v10, 10.11.2026). Pure: no imports - the modules' kit
// (./modules/kit.ts href), the new page's renderer (./newpage.ts), the Magento step (./shop.ts) and the tests.
//
// SARCLA 10.11.2026 (point 9): "the link should lead to correct locale based on locale" - a product or category of a page
// in English never sends a visitor to a de-CH address, and the English page that goes to en-INT, en-CH and en-DE sends
// each visitor to their own shop. The shop's addresses are its store view, then the page: /en-INT/sealing-technology.html,
// /de-CH/eur/dichtungstechnik.html - and within one language the page part is the same in every country (read 10.11.2026:
// /en-INT/ and /en-CH/ list the same keys, /de-CH/ and /de-DE/ too); another language has its own words for it, so a link of
// another language is never guessed here - it is found by the shop's own hreflang links (./shop.ts relinkOf) or said.
//
//   inStore(url, store)         a link of the same language put in this store view: /de-CH/x -> /de-CH/eur/x, /en-INT/x -> /en-CH/x
//   relinkHtml(html, store, n)  every link to the shop in some HTML put in this store view; when the page goes to several
//                               store views (n > 1), Magento's own {{store direct_url='x'}} - each visitor's own store view
//                               writes it - and the links of another language listed, never changed

/** A link to the shop: its store view ("de-CH", "de-CH/eur") and the rest of its address - null when it is not one. */
export function shopLinkOf(url: string): { store: string; rest: string } | null {
  const m = /^(?:https:\/\/(?:www|acc)\.apsoparts\.com)?\/([a-z]{2})-([A-Za-z]{2,3})(\/(?:chf|eur))?(\/[^\s"'<>]*)?$/i.exec(String(url ?? "").trim());
  if (!m) return null;
  const store = `${m[1].toLowerCase()}-${m[2].toUpperCase()}${m[3] ? m[3].toLowerCase() : ""}`;
  // "/de-CH/chf/..." is the plain address
  return { store: store.replace(/\/chf$/, ""), rest: (m[4] ?? "/").replace(/^\/+/, "") };
}

const sameLanguage = (a: string, b: string) => a.slice(0, 2).toLowerCase() === b.slice(0, 2).toLowerCase();

/** A link of the shop put in this store view when it is of the same language (its address there); else as it is. Its
 * host is dropped - the page's own host serves it (ACC and production alike). */
export function inStore(url: string, store: string | null | undefined): string {
  // the shop's host dropped from every address of it (its files too: /media/...) - the page's own host serves it
  const path = String(url ?? "").replace(/^https:\/\/(www|acc)\.apsoparts\.com(?=\/)/i, "");
  const l = shopLinkOf(path);
  if (!l || !store || !/^[a-z]{2}-[A-Z]{2,3}(\/[a-z]{3})?$/.test(store) || !sameLanguage(l.store, store)) return path;
  return `/${store}/${l.rest}`;
}

/** Magento's own link for every store view a page serves: {{store direct_url='rest'}}. */
export const storeDirective = (rest: string) => `{{store direct_url='${rest.replace(/'/g, "%27")}'}}`;

/**
 * Every link to the shop in a page's HTML (href="...") put in the store view `store`: of the same language, at its address
 * there - or, when the page goes to several store views (`stores` > 1), as Magento's {{store direct_url}} so each store
 * view writes its own. A link of another language is kept as it is and listed in `foreign` (the hand-over says it).
 */
export function relinkHtml(html: string, store: string, stores = 1): { html: string; foreign: string[]; changed: number } {
  const foreign: string[] = [];
  let changed = 0;
  const out = html.replace(/(\bhref=)(["'])([^"']*)\2/gi, (all, attr: string, q: string, url: string) => {
    const raw = url.replace(/&amp;/g, "&");
    const l = shopLinkOf(raw);
    if (!l) return all;
    if (!sameLanguage(l.store, store)) { if (!foreign.includes(raw)) foreign.push(raw); return all; }
    const next = stores > 1 ? storeDirective(l.rest) : `/${store}/${l.rest}`;
    if (next === raw) return all;
    changed += 1;
    return `${attr}${q}${next.replace(/&/g, "&amp;")}${q}`;
  });
  return { html: out, foreign, changed };
}

/** The shop addresses a module's settings carry (its cards, their children, its buttons) - to find their counterparts. */
export function moduleLinks(settings: { items?: { url: string; children?: { url: string }[] }[]; feature?: { url: string } | null; link?: { url: string }; link2?: { url: string } }): string[] {
  const out: string[] = [];
  const add = (u: string | undefined) => { if (u && shopLinkOf(u) && !out.includes(u)) out.push(u); };
  for (const c of settings.items ?? []) { add(c.url); for (const x of c.children ?? []) add(x.url); }
  add(settings.feature?.url);
  add(settings.link?.url);
  add(settings.link2?.url);
  return out;
}

/** A module's settings with its addresses swapped by `map` (an address it has no counterpart for stays). */
export function relinkModule<T extends { items?: { url: string; children?: { url: string }[] }[]; feature?: { url: string } | null; link?: { url: string; label: string }; link2?: { url: string; label: string } }>(settings: T, map: Record<string, string>): T {
  const fx = (u: string) => map[u] ?? u;
  return {
    ...settings,
    ...(settings.items ? { items: settings.items.map((c) => ({ ...c, url: fx(c.url), ...(c.children ? { children: c.children.map((x) => ({ ...x, url: fx(x.url) })) } : {}) })) } : {}),
    ...(settings.feature ? { feature: { ...settings.feature, url: fx(settings.feature.url) } } : {}),
    ...(settings.link ? { link: { ...settings.link, url: fx(settings.link.url) } } : {}),
    ...(settings.link2 ? { link2: { ...settings.link2, url: fx(settings.link2.url) } } : {}),
  };
}

/**
 * A link as each store view the page goes to sends its visitor (Content v11, SARCLA 10.11.2026: "this should also get all
 * the links from all the locales in a dropdown"): a page of the shop in the same language - its address in that store
 * view; in another language - not moved (`moved` false: that language's own page is found by the shop's links when the
 * page is translated, never guessed here); an address that is not a page of a store view (a file, an outside page) - as
 * it is, in every one.
 */
export function linkInStores(url: string, stores: string[]): { store: string; path: string; moved: boolean }[] {
  const u = String(url ?? "").trim();
  const l = shopLinkOf(u.replace(/^https:\/\/(www|acc)\.apsoparts\.com(?=\/)/i, ""));
  return [...new Set(stores)].map((store) => {
    if (!u) return { store, path: "", moved: false };
    if (!l) return { store, path: inStore(u, store), moved: true };
    return sameLanguage(l.store, store) ? { store, path: inStore(u, store), moved: true } : { store, path: "", moved: false };
  });
}
