// APSOconvert - THE RULES, PURE (Website > AI testing & personalization). SARCLA 07.11.2026: "let's start building this
// 01 APSOconvert [modelled on Webyn]: finds problems, suggests ideas, builds page versions, personalises; shows the better
// version to more visitors as results come in; nothing goes live until a person approves it" - with the pages indexed
// from production AND ACC, product, category and CMS pages from the start, and the problems down to the customer.
//
// No database, no network and no "@/" imports here, so the tests compile it as it is (tsconfig.test.json has no paths).
//
//   the shop's pages     each environment publishes one sitemap per store view under /media/sitemaps/. robots.txt names
//                        six of them on production and none on ACC (it blocks every crawler), and two more exist that it
//                        does not name (Swiss French and Swiss Italian) - so the list is robots.txt's plus the known names.
//                        A name that does not exist answers 200 with the shop's PLACEHOLDER PICTURE (image/jpeg), never a
//                        404, so a body is a sitemap only when it says <urlset> or <sitemapindex>.
//   one page             its address says what it is: /<store>/ alone is the home page, a first segment of 8 digits is a
//                        product (the product number), a checkout/account/search segment is a shop function, a .html
//                        is a category, the rest are CMS pages.
//   a problem            a page with a lot of traffic and little buying, by two lenses that see different people:
//                        Google Analytics (consented visitors, every page): views and add-to-carts;
//                        the shop's own record (every signed-in customer, whatever the cookie banner - product pages):
//                        the companies that opened a product, and where each of them stopped.

export type Env = "prod" | "acc";
export const ENVS: Record<Env, { label: string; base: string }> = {
  prod: { label: "Production", base: "https://www.apsoparts.com" },
  acc: { label: "ACC", base: "https://acc.apsoparts.com" },
};
export const isEnv = (x: unknown): x is Env => x === "prod" || x === "acc";

/** The sitemaps that exist on production (checked 07.11.2026) - robots.txt names the first six only. */
export const KNOWN_SITEMAPS = [
  "switzerland_chf_de", "france_eur_fr", "italy_eur_it", "netherlands_eur_nl", "international_eur_en", "poland_eur_pl",
  "switzerland_chf_fr", "switzerland_chf_it",
];

export type PageKind = "home" | "category" | "product" | "cms" | "system";
export const PAGE_KINDS: PageKind[] = ["home", "category", "product", "cms", "system"];
export const KIND_LABEL: Record<PageKind, string> = {
  home: "Home page", category: "Category", product: "Product", cms: "CMS page", system: "Shop function",
};
export const isKind = (x: unknown): x is PageKind => typeof x === "string" && (PAGE_KINDS as string[]).includes(x);

/* ── the sitemaps ─────────────────────────────────────────────────────── */

/** Every sitemap to read on one environment: robots.txt's (moved onto this environment's host) and the known names. */
export function sitemapList(robots: string, base: string): string[] {
  const origin = new URL(base).origin;
  const out: string[] = [];
  const add = (u: string) => { if (!out.includes(u)) out.push(u); };
  for (const m of robots.matchAll(/^\s*sitemap:\s*(\S+)\s*$/gim)) {
    try {
      const u = new URL(m[1]);
      add(`${origin}${u.pathname}`);
    } catch { /* not an address */ }
  }
  for (const n of KNOWN_SITEMAPS) add(`${origin}/media/sitemaps/${n}.xml`);
  return out;
}

/** The file name a sitemap address ends in, without .xml - how the page names it. */
export const sitemapName = (url: string) => (url.split("/").pop() ?? url).replace(/\.xml$/i, "");

export type SitemapEntry = { loc: string; lastmod: string | null };
export type ParsedSitemap = { kind: "urlset" | "index" | "not-a-sitemap"; entries: SitemapEntry[] };

const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();

export function parseSitemap(body: string): ParsedSitemap {
  const isIndex = /<sitemapindex[\s>]/i.test(body);
  const isSet = /<urlset[\s>]/i.test(body);
  if (!isIndex && !isSet) return { kind: "not-a-sitemap", entries: [] };
  const tag = isIndex ? "sitemap" : "url";
  const entries: SitemapEntry[] = [];
  for (const m of body.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi"))) {
    const loc = /<loc>([\s\S]*?)<\/loc>/i.exec(m[1])?.[1];
    if (!loc) continue;
    const lastmod = /<lastmod>([\s\S]*?)<\/lastmod>/i.exec(m[1])?.[1];
    entries.push({ loc: unescapeXml(loc), lastmod: lastmod ? unescapeXml(lastmod) : null });
  }
  return { kind: isIndex ? "index" : "urlset", entries };
}

/* ── one page ─────────────────────────────────────────────────────────── */

export type Classified = {
  /** the address' path, as Google Analytics reports it (pagePath): "/de-CH/dichtungstechnik.html" */
  path: string;
  /** "de-CH", "de-CH/eur" - null when the address has no store view */
  store: string | null;
  /** the path after the store view: "dichtungstechnik.html" ("" on the home page) */
  rest: string;
  kind: PageKind;
  /** a product page's 8-digit product number */
  product: string | null;
};

const STORE = /^[a-z]{2}-[A-Z]{2,3}$/;
const CURRENCY = /^(eur|chf|pln|usd|gbp)$/;
const SYSTEM = new Set([
  "checkout", "customer", "catalogsearch", "sales", "wishlist", "requisition_list", "company", "negotiable_quote",
  "quickorder", "multishipping", "paypal", "persistent", "review", "sendfriend", "downloadable", "vault", "rma",
]);

/** A store code typed in small letters ("/de-ch/...") written as the shop writes it ("/de-CH/...") - the shop sends the
 *  small one to "/de-CH/de-ch/...", a 404 (SARCLA saw "The shop answered 302" on 08.11.2026). */
export function storeCase(path: string): string {
  return path.replace(/^\/([a-z]{2})-([a-z]{2,3})(?=\/|$)/i, (_m, l: string, c: string) => `/${l.toLowerCase()}-${c.toUpperCase()}`);
}

export function classify(address: string): Classified {
  let path: string;
  try {
    path = new URL(address, "https://www.apsoparts.com").pathname;
  } catch {
    path = address.split("?")[0] || "/";
  }
  const segs = path.split("/").filter(Boolean);
  let store: string | null = null;
  let i = 0;
  if (segs[0] && STORE.test(segs[0])) {
    store = segs[0];
    i = 1;
    if (segs[1] && CURRENCY.test(segs[1])) { store = `${segs[0]}/${segs[1]}`; i = 2; }
  }
  const restSegs = segs.slice(i);
  const rest = restSegs.join("/");
  const first = restSegs[0] ?? "";
  let kind: PageKind;
  let product: string | null = null;
  const prod = /^(\d{8})(?=-|\.html$|$)/.exec(first);
  if (!rest) kind = "home";
  else if (prod) { kind = "product"; product = prod[1]; }
  else if (SYSTEM.has(first.toLowerCase())) kind = "system";
  // a category without its address rewrite: catalog/category/view/id/7939
  else if (/\.html$/i.test(rest) || /^catalog\/category\/view\//i.test(rest)) kind = "category";
  else kind = "cms";
  return { path, store, rest, kind, product };
}

/** A product number as the shop and Products & Pricing both write it: 8 digits, or null. */
export function productNumber(raw: string | null | undefined): string | null {
  const d = String(raw ?? "").trim().replace(/\.0+$/, "");
  if (!/^\d{1,8}$/.test(d)) return null;
  return d.padStart(8, "0");
}

/** A product page's name out of its address: "12202510-apsovibr-maschinenfuss-nivobloc.html" -> "apsovibr maschinenfuss nivobloc". */
export function nameFromRest(rest: string): string {
  const last = rest.split("/").pop() ?? rest;
  return last.replace(/\.html?$/i, "").replace(/^\d{8}-?/, "").replace(/-+/g, " ").trim();
}

/* ── the shop's own record of a product ───────────────────────────────── */

/** Where a look stopped on the shop's path - productSignals/model.ts PATH_STEPS, in the same order. */
export const STEPS = ["shelf", "looked", "moq", "price", "cart", "won"] as const;
export type Step = (typeof STEPS)[number];
export const STEP_LABEL: Record<Step, string> = {
  shelf: "No stock for the quantity",
  looked: "Opened only",
  moq: "Below the minimum order",
  price: "Priced and left",
  cart: "Left in the cart",
  won: "Ordered",
};
/** How far each step got, for a company's furthest look: opened < not served < below minimum < priced < cart < ordered. */
const PROGRESS: Record<Step, number> = { looked: 0, shelf: 1, moq: 2, price: 3, cart: 4, won: 5 };

/** One look as the shop path gives it: a company, an article of a product, a day, the step it stopped at. */
export type ShopLook = { company: string; article: string; product: string; day: string; step: Step };

export type ShopFunnel = {
  /** companies that opened the product */
  companies: number;
  looks: number;
  /** companies by the furthest step they reached */
  furthest: Record<Step, number>;
  /** companies that never ordered it in the period */
  lost: number;
  /** the step most of the lost companies stopped at */
  topLoss: Exclude<Step, "won"> | null;
};

const emptySteps = (): Record<Step, number> => ({ shelf: 0, looked: 0, moq: 0, price: 0, cart: 0, won: 0 });

/** Each company's furthest step on one product. */
export function furthestByCompany(looks: ShopLook[]): Map<string, { step: Step; looks: number; lastDay: string; articles: Set<string> }> {
  const out = new Map<string, { step: Step; looks: number; lastDay: string; articles: Set<string> }>();
  for (const l of looks) {
    const cur = out.get(l.company);
    if (!cur) { out.set(l.company, { step: l.step, looks: 1, lastDay: l.day, articles: new Set([l.article]) }); continue; }
    cur.looks += 1;
    if (l.day > cur.lastDay) cur.lastDay = l.day;
    cur.articles.add(l.article);
    if (PROGRESS[l.step] > PROGRESS[cur.step]) cur.step = l.step;
  }
  return out;
}

export function funnelOf(looks: ShopLook[]): ShopFunnel {
  const by = furthestByCompany(looks);
  const furthest = emptySteps();
  for (const v of by.values()) furthest[v.step] += 1;
  const lost = by.size - furthest.won;
  let topLoss: Exclude<Step, "won"> | null = null;
  for (const s of STEPS) {
    if (s === "won" || furthest[s] === 0) continue;
    if (topLoss === null || furthest[s] > furthest[topLoss]) topLoss = s;
  }
  return { companies: by.size, looks: looks.length, furthest, lost, topLoss };
}

/** The looks of a period [from, to] (inclusive, YYYY-MM-DD), by product. */
export function looksByProduct(looks: ShopLook[], from: string, to: string): Map<string, ShopLook[]> {
  const out = new Map<string, ShopLook[]>();
  for (const l of looks) {
    if (l.day < from || l.day > to || !l.product) continue;
    const list = out.get(l.product);
    if (list) list.push(l); else out.set(l.product, [l]);
  }
  return out;
}

/* ── problems ─────────────────────────────────────────────────────────── */

/** One address' traffic, as the Google Analytics report gives it. */
export type PageTraffic = { path: string; views: number; sessions: number; addToCarts: number };

export type ProblemPage = {
  /** "product:12202510" - a product is one problem across its languages; "page:/de-CH/x.html" otherwise */
  key: string;
  kind: PageKind;
  product: string | null;
  /** the most viewed address, and every address with its views */
  path: string;
  paths: { path: string; store: string | null; views: number; addToCarts: number }[];
  views: number;
  addToCarts: number;
  /** add-to-carts per view, or null without views */
  rate: number | null;
  /** the typical rate of this kind of page */
  typical: number | null;
  /** add-to-carts this page would have had at the typical rate */
  missed: number;
  shop: ShopFunnel | null;
  /** why it is on the list, in words - empty when it is not a problem */
  reasons: string[];
};

export type ProblemsOptions = {
  /** below this many views a rate says nothing */
  minViews: number;
  /** below this many companies the shop's record says nothing */
  minCompanies: number;
};
export const DEFAULT_OPTIONS: ProblemsOptions = { minViews: 100, minCompanies: 3 };

/** The views-weighted median add-to-cart rate of each kind of page with enough views. */
export function typicalRates(pages: { kind: PageKind; views: number; addToCarts: number }[], minViews: number): Record<PageKind, number | null> {
  const out = { home: null, category: null, product: null, cms: null, system: null } as Record<PageKind, number | null>;
  for (const kind of PAGE_KINDS) {
    const rows = pages.filter((p) => p.kind === kind && p.views >= minViews).map((p) => ({ r: p.addToCarts / p.views, w: p.views }));
    if (!rows.length) continue;
    rows.sort((a, b) => a.r - b.r);
    const half = rows.reduce((s, x) => s + x.w, 0) / 2;
    let acc = 0;
    for (const x of rows) { acc += x.w; if (acc >= half) { out[kind] = x.r; break; } }
  }
  return out;
}

const pct = (r: number) => `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}%`;

/**
 * Every page with traffic or a shop record, as problems: the traffic summed per key (a product across its languages),
 * the typical rate per kind, and the reasons in words. Shop functions (checkout, account, search) are left out - they
 * are not pages to redesign.
 */
export function rankProblems(traffic: PageTraffic[], shop: Map<string, ShopLook[]>, opts: ProblemsOptions = DEFAULT_OPTIONS): { pages: ProblemPage[]; typical: Record<PageKind, number | null> } {
  const byKey = new Map<string, ProblemPage>();
  const get = (key: string, kind: PageKind, product: string | null, path: string) => {
    let p = byKey.get(key);
    if (!p) {
      p = { key, kind, product, path, paths: [], views: 0, addToCarts: 0, rate: null, typical: null, missed: 0, shop: null, reasons: [] };
      byKey.set(key, p);
    }
    return p;
  };
  for (const t of traffic) {
    const c = classify(t.path);
    if (c.kind === "system") continue;
    const key = c.kind === "product" && c.product ? `product:${c.product}` : `page:${c.path}`;
    const p = get(key, c.kind, c.product, c.path);
    p.views += t.views;
    p.addToCarts += t.addToCarts;
    p.paths.push({ path: c.path, store: c.store, views: t.views, addToCarts: t.addToCarts });
  }
  for (const [product, looks] of shop) {
    const p = get(`product:${product}`, "product", product, "");
    p.shop = funnelOf(looks);
  }
  const pages = [...byKey.values()];
  for (const p of pages) {
    p.paths.sort((a, b) => b.views - a.views);
    if (p.paths[0]) p.path = p.paths[0].path;
    p.rate = p.views > 0 ? p.addToCarts / p.views : null;
  }
  const typical = typicalRates(pages, opts.minViews);
  for (const p of pages) {
    p.typical = typical[p.kind];
    if (p.rate !== null && p.typical !== null) p.missed = Math.max(0, Math.round(p.views * (p.typical - p.rate)));
    if (p.views >= opts.minViews && p.rate !== null && p.typical !== null && p.typical > 0 && p.rate < p.typical / 2) {
      p.reasons.push(`${p.views.toLocaleString("en-US")} views, ${pct(p.rate)} put something in the cart - ${pct(p.typical)} is typical for a ${KIND_LABEL[p.kind].toLowerCase()}`);
    }
    const s = p.shop;
    if (s && s.companies >= opts.minCompanies && s.lost > 0 && s.lost * 2 >= s.companies && s.topLoss) {
      const n = s.furthest[s.topLoss];
      p.reasons.push(`${s.lost} of ${s.companies} customers who opened it did not order - ${n} stopped at "${STEP_LABEL[s.topLoss].toLowerCase()}"`);
    }
  }
  return { pages, typical };
}

/** The two orders the list can take. */
export type RankBy = "missed" | "lost";
export function sortProblems(pages: ProblemPage[], by: RankBy): ProblemPage[] {
  const lost = (p: ProblemPage) => p.shop?.lost ?? 0;
  return [...pages].sort((a, b) =>
    by === "missed"
      ? b.missed - a.missed || lost(b) - lost(a) || b.views - a.views
      : lost(b) - lost(a) || b.missed - a.missed || b.views - a.views);
}
