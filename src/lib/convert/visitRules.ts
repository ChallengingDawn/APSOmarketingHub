// APSOconvert > Journeys > VISITS - THE RULES, PURE. SARCLA 09.11.2026: "also next sub on journeys you should allow to
// see the visits per customer really as a play again their visits and based on all of this data you do recommendations".
//
// No database, no network and no "@/" imports here, so the tests compile it as it is (tsconfig.test.json has no paths).
//
//   a page view    HubSpot's web tracking: a contact's page and its minute - page by page where HubSpot's events answer,
//                  else only each contact's last page seen (a contact property, always readable)
//   a look         the shop's own record of a signed-in customer (apsomh_shop_looks): an article opened, the quantity
//                  asked, the cart, the order - ONE line per article and day, at the LAST minute the shop saw it that day
//   a visit        one customer's page views and looks in time order, cut where 30 minutes pass without either
//   a step         one page of a visit. The same page again straight after (a reload, a filter) stays one step; a look
//                  joins the step of its product page when that page was seen within 10 minutes; looks at articles of
//                  the same product one after the other are one step
//   reached        the furthest a visit got: pages only < opened a product < checked a price < the cart < the order
//   time on a step the minutes to the next step. The last step's time is not known (nobody records the leaving) - "last".

import { journeyKind, pageName, pathKey, type JKind } from "../journeys/model";
import { classify, type Step } from "./model";

/* ── what comes in ────────────────────────────────────────────────────── */

export type Source = "pages" | "last" | "shop";
export const SOURCE_NAME: Record<Source, string> = {
  pages: "HubSpot, page by page",
  last: "HubSpot, last page seen",
  shop: "The shop's own record",
};

/** One page a contact opened, as HubSpot recorded it. `at` is an ISO time. */
export type PageView = { at: string; path: string; query: string | null; title: string | null; contact: string | null; source: "pages" | "last" };

/** One line of the shop's own record: an article of a product, the last minute of the day the shop saw it. */
export type Look = {
  /** "YYYY-MM-DDTHH:MM" (UTC, as the gateway writes it) or an ISO time */
  at: string;
  /** the 10-digit article - "" when the product page was opened without a variant */
  article: string;
  /** the 8-digit product (its page), null when unknown */
  product: string | null;
  /** the largest quantity asked that day */
  qty: number | null;
  carted: boolean;
  ordered: boolean;
  contact: string | null;
  /** where it stopped on the shop's path (the Products Reports' read), null when that read has not got it */
  step: Step | null;
  /** the article's description or the product's name (Products & Pricing) */
  name: string | null;
  /** the article's minimum order quantity (Products & Pricing) */
  minimum: number | null;
  /** the product's own name (Products & Pricing) - a page where customers stopped is named by it */
  page?: string | null;
};

/* ── what goes out ────────────────────────────────────────────────────── */

export type VStep = {
  at: string;
  /** the page's path - null for a look whose product page the hub does not know */
  path: string | null;
  kind: JKind;
  name: string;
  /** a search's words (from the address' q=) */
  query: string | null;
  title: string | null;
  /** seconds to the next step; null on the last */
  secs: number | null;
  contact: string | null;
  source: Source;
  looks: Look[];
  product: string | null;
};

export type Reach = "pages" | "product" | "price" | "cart" | "order";
export const REACHES: Reach[] = ["pages", "product", "price", "cart", "order"];
export const REACH_LABEL: Record<Reach, string> = {
  pages: "Pages only", product: "Opened products", price: "Checked a price", cart: "Cart, no order", order: "Ordered",
};
export const REACH_TINT: Record<Reach, "slate" | "blue" | "purple" | "amber" | "green"> = {
  pages: "slate", product: "blue", price: "purple", cart: "amber", order: "green",
};
const RANK: Record<Reach, number> = { pages: 0, product: 1, price: 2, cart: 3, order: 4 };
export const reachMax = (a: Reach, b: Reach): Reach => (RANK[a] >= RANK[b] ? a : b);
export const reachAtLeast = (r: Reach, floor: Reach) => RANK[r] >= RANK[floor];

export type Visit = {
  /** minutes since 1970 at its first step - an address can name it */
  id: string;
  start: string;
  end: string;
  /** first step to last step, in seconds (the last page's own time is not known) */
  secs: number;
  steps: VStep[];
  reach: Reach;
  /** the contacts seen in it (HubSpot ids) */
  contacts: string[];
  /** the articles (or product pages) it looked at */
  articles: number;
  sources: Source[];
};

/* ── time ─────────────────────────────────────────────────────────────── */

export const GAP_MIN = 30;
const JOIN_MIN = 10;

/** A time as milliseconds: the gateway's "YYYY-MM-DDTHH:MM" is UTC. NaN when unreadable. */
export function ms(at: string): number {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) return Date.parse(`${at}:00Z`);
  return Date.parse(at);
}
const iso = (t: number) => new Date(t).toISOString();

/* ── a step's reach and words ─────────────────────────────────────────── */

const ASKED: Step[] = ["price", "moq", "shelf"];

/** How far one look got. A quantity above 1 is a price asked even when the step is not known (a 1 the shop asks itself). */
export function lookReach(l: Look): Reach {
  if (l.ordered || l.step === "won") return "order";
  if (l.carted || l.step === "cart") return "cart";
  if ((l.step && ASKED.includes(l.step)) || (l.step === null && l.qty !== null && l.qty > 1)) return "price";
  return "product";
}

export function stepReach(s: Pick<VStep, "kind" | "looks">): Reach {
  let r: Reach = s.kind === "order" ? "order" : s.kind === "cart" || s.kind === "checkout" ? "cart" : s.kind === "product" ? "product" : "pages";
  for (const l of s.looks) r = reachMax(r, lookReach(l));
  return r;
}

const qtyWords = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));

/** What happened to one article, in plain words: "Checked 50 - below the minimum of 100". A price checked is the shop
 *  showing it at once for the quantity typed - nothing waits for an answer. */
export function lookWords(l: Look): string {
  const q = l.qty !== null && l.qty > 0 ? qtyWords(l.qty) : null;
  if (l.ordered || l.step === "won") return q ? `Ordered ${q}` : "Ordered";
  if (l.carted || l.step === "cart") return q ? `Put ${q} in the cart` : "Put it in the cart";
  if (l.step === "shelf") return q ? `Checked ${q} - not enough in stock` : "Not enough in stock";
  if (l.step === "moq") return q && l.minimum ? `Checked ${q} - below the minimum of ${qtyWords(l.minimum)}` : q ? `Checked ${q} - below the minimum` : "Below the minimum";
  if (l.step === "price" || (l.step === null && l.qty !== null && l.qty > 1)) return q ? `Checked the price for ${q}` : "Checked the price";
  return "Opened it";
}

/** A step's name: the product's name from the shop's record, else the page's own words. */
function nameOf(kind: JKind, path: string | null, product: string | null, looks: Look[], query: string | null): string {
  if (kind === "search") return query ? `Search: "${query}"` : "Search results";
  if (kind === "product") {
    const n = looks.find((l) => l.name)?.name;
    if (n) return n;
    if (path) return pageName(path);
    return product ? `Product ${product}` : "Product";
  }
  return path ? pageName(path) : "Page";
}

/** The kinds a still picture can show: the shop's public pages. The cart, the check-out, the account and the search
 *  results are personal or need a session - the player shows their name instead. */
export const PICTURED: JKind[] = ["home", "category", "product", "cms"];
export const hasPicture = (s: Pick<VStep, "kind" | "path">) => !!s.path && PICTURED.includes(s.kind);

/* ── the visits ───────────────────────────────────────────────────────── */

type Draft = { t: number; path: string | null; kind: JKind; query: string | null; title: string | null; contact: string | null; source: Source; looks: Look[]; product: string | null };

/**
 * A customer's page views and looks as visits, newest first. `productPath` gives a product's page, for the looks whose
 * page HubSpot did not see.
 */
export function buildVisits(views: PageView[], looks: Look[], o: { gapMin?: number; productPath?: (product: string) => string | null } = {}): Visit[] {
  const gap = (o.gapMin ?? GAP_MIN) * 60_000;
  const join = JOIN_MIN * 60_000;
  // the same page view twice (the last page seen is also among the page-by-page views): one
  const seen = new Set<string>();
  const vs = views
    .map((v) => ({ v, t: ms(v.at) }))
    .filter((x) => Number.isFinite(x.t) && x.v.path)
    .sort((a, b) => a.t - b.t)
    .filter((x) => { const k = `${x.v.contact ?? ""}|${pathKey(x.v.path)}|${Math.floor(x.t / 60_000)}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const ls = looks.map((l) => ({ l, t: ms(l.at) })).filter((x) => Number.isFinite(x.t)).sort((a, b) => a.t - b.t);

  // cut every event (page views and looks together) into visits
  type Ev = { t: number; v?: PageView; l?: Look };
  const evs: Ev[] = [...vs.map((x): Ev => ({ t: x.t, v: x.v })), ...ls.map((x): Ev => ({ t: x.t, l: x.l }))];
  evs.sort((a, b) => a.t - b.t || (a.v ? 0 : 1) - (b.v ? 0 : 1));
  const groups: Ev[][] = [];
  for (const e of evs) {
    const g = groups[groups.length - 1];
    if (g && e.t - g[g.length - 1].t <= gap) g.push(e); else groups.push([e]);
  }

  const out: Visit[] = [];
  for (const g of groups) {
    // the page views as steps, the same page straight after kept as one
    const steps: Draft[] = [];
    for (const e of g) {
      if (!e.v) continue;
      const path = e.v.path;
      const prev = steps[steps.length - 1];
      if (prev && prev.path && pathKey(prev.path) === pathKey(path)) continue;
      const kind = journeyKind(path);
      steps.push({ t: e.t, path, kind, query: e.v.query, title: e.v.title, contact: e.v.contact, source: e.v.source, looks: [], product: classify(path).product });
    }
    // each look on the nearest step of its product page (within 10 minutes), else a step of its own
    for (const e of g) {
      if (!e.l) continue;
      const l = e.l;
      let best: Draft | null = null;
      if (l.product) {
        for (const s of steps) {
          if (s.kind !== "product" || s.product !== l.product || Math.abs(s.t - e.t) > join) continue;
          if (!best || Math.abs(s.t - e.t) < Math.abs(best.t - e.t)) best = s;
        }
      }
      if (best) { best.looks.push(l); continue; }
      const path = l.product && o.productPath ? o.productPath(l.product) : null;
      steps.push({ t: e.t, path, kind: "product", query: null, title: null, contact: l.contact, source: "shop", looks: [l], product: l.product });
    }
    steps.sort((a, b) => a.t - b.t);
    // looks at the same product one after the other: one step (its first minute)
    const merged: Draft[] = [];
    for (const s of steps) {
      const prev = merged[merged.length - 1];
      if (prev && s.source === "shop" && prev.kind === "product" && s.product && prev.product === s.product) {
        prev.looks.push(...s.looks);
        continue;
      }
      merged.push(s);
    }
    if (!merged.length) continue;
    const vsteps: VStep[] = merged.map((s, i) => ({
      at: iso(s.t), path: s.path, kind: s.kind, name: nameOf(s.kind, s.path, s.product, s.looks, s.query), query: s.query, title: s.title,
      secs: i < merged.length - 1 ? Math.round((merged[i + 1].t - s.t) / 1000) : null,
      contact: s.contact ?? s.looks.find((l) => l.contact)?.contact ?? null, source: s.source, looks: s.looks, product: s.product,
    }));
    const first = merged[0].t, last = merged[merged.length - 1].t;
    const contacts = [...new Set(vsteps.flatMap((s) => [s.contact, ...s.looks.map((l) => l.contact)]).filter((c): c is string => !!c))];
    const articles = new Set(vsteps.flatMap((s) => s.looks.map((l) => l.article || `p${l.product ?? ""}`)));
    const sources = [...new Set(vsteps.map((s) => s.source))];
    out.push({
      id: String(Math.floor(first / 60_000)), start: iso(first), end: iso(last), secs: Math.round((last - first) / 1000),
      steps: vsteps, reach: vsteps.reduce<Reach>((r, s) => reachMax(r, stepReach(s)), "pages"), contacts, articles: articles.size, sources,
    });
  }
  return out.sort((a, b) => b.start.localeCompare(a.start));
}

/** The furthest any of the visits got. */
export const reachOf = (visits: Pick<Visit, "reach">[]): Reach => visits.reduce<Reach>((r, v) => reachMax(r, v.reach), "pages");

/* ── where they stopped ───────────────────────────────────────────────── */

export type Stop = {
  path: string | null; product: string | null; kind: JKind; name: string;
  /** visits without an order that ended on this page */
  left: number;
  /** articles of it whose price was checked for a quantity (no cart) */
  asked: number;
  /** articles of it put in the cart, not ordered */
  carted: number;
  /** what held the articles back: below the minimum, not enough stock */
  moq: number;
  shelf: number;
  /** visits that saw it */
  visits: number;
};

/**
 * The pages where the visits stopped short of an order: the last page of each visit without an order, and the product
 * pages where a price was asked or the cart filled and nothing was ordered. Most stops first; the shop's public pages only
 * (the cart or an account page is no page to change).
 */
export function stopsOf(visits: Visit[]): Stop[] {
  const by = new Map<string, Stop>();
  const keyOf = (s: VStep) => (s.product ? `p:${s.product}` : s.path ? `u:${pathKey(s.path)}` : null);
  for (const v of visits) {
    const seenHere = new Set<string>();
    for (const s of v.steps) {
      const k = keyOf(s);
      if (!k) continue;
      const name = s.looks.find((l) => l.page)?.page ?? s.name;
      const cur = by.get(k) ?? { path: s.path, product: s.product, kind: s.kind, name, left: 0, asked: 0, carted: 0, moq: 0, shelf: 0, visits: 0 };
      if (!cur.path && s.path) cur.path = s.path;
      if (!seenHere.has(k)) { cur.visits += 1; seenHere.add(k); }
      for (const l of s.looks) {
        const r = lookReach(l);
        if (r === "price") cur.asked += 1;
        if (r === "cart") cur.carted += 1;
        if (l.step === "moq") cur.moq += 1;
        if (l.step === "shelf") cur.shelf += 1;
      }
      by.set(k, cur);
    }
    if (v.reach !== "order") {
      const last = v.steps[v.steps.length - 1];
      const k = last ? keyOf(last) : null;
      if (k && by.has(k)) by.get(k)!.left += 1;
    }
  }
  const weight = (s: Stop) => s.carted * 3 + s.asked * 2 + s.left;
  return [...by.values()]
    .filter((s) => PICTURED.includes(s.kind) && weight(s) > 0)
    .sort((a, b) => weight(b) - weight(a) || b.visits - a.visits);
}

/** A page where several customers stopped: the stops of each customer added up, `companies` = how many stopped there. */
export type SharedStop = Stop & { companies: number };

export function mergeStops(perCompany: Stop[][]): SharedStop[] {
  const by = new Map<string, SharedStop>();
  for (const list of perCompany) {
    for (const s of list) {
      const k = s.product ? `p:${s.product}` : s.path ? `u:${pathKey(s.path)}` : null;
      if (!k) continue;
      const cur = by.get(k);
      if (!cur) { by.set(k, { ...s, companies: 1 }); continue; }
      cur.companies += 1;
      cur.left += s.left; cur.asked += s.asked; cur.carted += s.carted; cur.moq += s.moq; cur.shelf += s.shelf; cur.visits += s.visits;
      if (!cur.path && s.path) cur.path = s.path;
    }
  }
  const weight = (s: SharedStop) => s.companies * 4 + s.carted * 3 + s.asked * 2 + s.left;
  return [...by.values()].sort((a, b) => weight(b) - weight(a) || b.visits - a.visits);
}

/** A shop address as a path and its search words - null for another site (the blog's host, ACC, a landing page). */
export function shopPathOf(url: string | null | undefined): { path: string; query: string | null } | null {
  if (!url) return null;
  let u: URL;
  try { u = new URL(url, "https://www.apsoparts.com"); } catch { return null; }
  if (!/^(www\.)?apsoparts\.com$/i.test(u.hostname)) return null;
  const path = u.pathname.replace(/;jsessionid=[^/?#]*/i, "") || "/";
  const q = u.searchParams.get("q");
  return { path, query: q ? q.trim().slice(0, 80) || null : null };
}

/** "left here in 2 visits · price checked 3× · 1 in the cart" */
export function stopWords(s: Stop): string {
  const parts: string[] = [];
  if (s.left) parts.push(`left here in ${s.left} visit${s.left === 1 ? "" : "s"}`);
  if (s.asked) parts.push(`price checked ${s.asked}×`);
  if (s.carted) parts.push(`${s.carted} in the cart, not ordered`);
  if (s.moq) parts.push(`${s.moq}× below the minimum`);
  if (s.shelf) parts.push(`${s.shelf}× not enough stock`);
  return parts.join(" · ");
}

/* ── the list ─────────────────────────────────────────────────────────── */

export type CustomerRow = {
  id: string;
  name: string | null;
  number: string | null;
  country: string | null;
  segment: string | null;
  priority: string | null;
  owner: string | null;
  /** the store view the contacts' last pages were on (most of them), null when unknown */
  store: string | null;
  lastAt: string | null;
  contacts: { id: string; name: string; lastAt: string | null }[];
  visits: number;
  articles: number;
  reach: Reach;
  sources: Source[];
  /** the kinds of the newest visit's steps, for its little strip (16 at most) */
  strip: JKind[];
  /** the page this customer stopped at most (stopsOf's first) */
  stop: { name: string; path: string | null; words: string } | null;
};

export type RowFilter = { reach: Reach | "all"; store: string | "all"; q: string };

export function filterRows(rows: CustomerRow[], f: RowFilter): CustomerRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) =>
    (f.reach === "all" || r.reach === f.reach)
    && (f.store === "all" || r.store === f.store)
    && (!q || (r.name ?? "").toLowerCase().includes(q) || (r.number ?? "").toLowerCase().includes(q) || r.contacts.some((c) => c.name.toLowerCase().includes(q))));
}

/** The most common of a list ("de-CH" of three de-CH and one fr-CH), null when empty. */
export function mostOf(xs: (string | null)[]): string | null {
  const n = new Map<string, number>();
  for (const x of xs) if (x) n.set(x, (n.get(x) ?? 0) + 1);
  let best: string | null = null;
  for (const [k, c] of n) if (best === null || c > n.get(best)! || (c === n.get(best)! && k < best)) best = k;
  return best;
}

/* ── the player ───────────────────────────────────────────────────────── */

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

/**
 * How long a step stays on the screen while the visit plays: ten times faster than the visit was, between 3 and 12
 * seconds at 1x (a step whose time is not known: 4 s), then divided by the speed.
 */
export function replayMs(secs: number | null, speed: number): number {
  const base = secs === null ? 4000 : Math.min(12_000, Math.max(3000, secs * 100));
  return Math.round(base / Math.max(1, speed));
}

/** "45 s", "3 min", "1 h 05"; null: "-". */
export function durWords(secs: number | null): string {
  if (secs === null || !Number.isFinite(secs)) return "-";
  if (secs < 60) return `${Math.max(0, Math.round(secs))} s`;
  const m = Math.round(secs / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

/* ── for the AI ───────────────────────────────────────────────────────── */

const ZURICH = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** "2026-11-08 10:21" in Swiss time. */
export function zurichTime(at: string): string {
  const t = ms(at);
  if (!Number.isFinite(t)) return at;
  const p = Object.fromEntries(ZURICH.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/**
 * One visit as one line for the AI: when, how long, how far, and every step with its time - the contacts as letters
 * (A, B...), never their names.
 */
export function visitLine(v: Visit, letter: (contact: string | null) => string): string {
  const who = [...new Set(v.contacts.map(letter))].join("+") || "?";
  const steps = v.steps.map((s) => {
    const page = s.kind === "product" ? `product ${s.product ?? "?"} "${s.name.slice(0, 60)}"` : s.kind === "search" ? s.name.slice(0, 60) : `${s.kind} "${s.name.slice(0, 50)}"`;
    const looks = s.looks.length ? ` [${s.looks.slice(0, 4).map((l) => `${l.article || "page"}: ${lookWords(l)}`).join("; ")}${s.looks.length > 4 ? `; +${s.looks.length - 4}` : ""}]` : "";
    return `${page}${looks} (${s.secs === null ? "last" : durWords(s.secs)})`;
  });
  return `${zurichTime(v.start)} · contact ${who} · ${durWords(v.secs)} · reached: ${REACH_LABEL[v.reach]} · ${steps.join(" > ")}`;
}
