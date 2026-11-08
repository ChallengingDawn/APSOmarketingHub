// Website > JOURNEYS - THE RULES, PURE. SARCLA 08.11.2026: "you should be able to visually display journeys, analyse the
// main journeys; this should be a stand-alone app" - beside APSOconvert, read from Google Analytics and the shop's record.
//
// No database, no network and no "@/" imports here, so the tests compile it as it is (tsconfig.test.json has no paths).
//
//   a page's kind        its address says it (../convert/model.ts classify), with the shop functions told apart: the cart
//                        (checkout/cart), the check-out, the order placed (checkout/onepage/success), the search results
//                        (catalogsearch), the customer's account (customer/, sales/, wishlist/...)
//   a step               one page view and the page before it (Google Analytics' pageReferrer). Only a page of the shop
//                        before it is a step; another site or no page before is a way in. The same page again (a reload,
//                        a filter, the next page of a list) is not a step.
//   left                 the views of a page that no step out of it follows - they closed the tab, went to another site,
//                        or the next page was not recorded
//   a journey            CHAINED from the steps: of the visits on a kind of page, the share that goes on to each kind, and
//                        so on. These are steps people take, not visitors followed one by one - the pages say "built from
//                        page-to-page steps" wherever a figure is chained. The ways in (landing pages) and what those
//                        visits did (a cart, an order) are Google Analytics' own session counts, not chained.

import { classify, furthestByCompany, type ShopLook, type Step } from "../convert/model";

/* ── the kinds of page ────────────────────────────────────────────────── */

export type JKind = "home" | "category" | "search" | "product" | "cms" | "account" | "other" | "cart" | "checkout" | "order";
/** Top to bottom in every column of the flow: browsing first, the way to the order last. */
export const JKINDS: JKind[] = ["home", "category", "search", "product", "cms", "account", "other", "cart", "checkout", "order"];
/** A kind of page, or the end of a visit: they left the shop. */
export type FlowKind = JKind | "left";
export const FLOW_KINDS: FlowKind[] = [...JKINDS, "left"];
export const isJKind = (x: unknown): x is JKind => typeof x === "string" && (JKINDS as string[]).includes(x);

export const KIND_NAME: Record<FlowKind, string> = {
  home: "Home page", category: "Category", search: "Search", product: "Product", cms: "Content page", account: "Account",
  other: "Other page", cart: "Cart", checkout: "Check-out", order: "Order placed", left: "Left the shop",
};
/** "on a category", "on the home page" - for sentences. */
export const KIND_ON: Record<FlowKind, string> = {
  home: "on the home page", category: "on a category", search: "on the search results", product: "on a product",
  cms: "on a content page", account: "in their account", other: "on another page", cart: "in the cart",
  checkout: "in the check-out", order: "on the order confirmation", left: "gone",
};
/** One colour per kind, the same on every page of the app. */
export const KIND_COLOR: Record<FlowKind, string> = {
  home: "#6a46c9", category: "#2459d1", search: "#c27c0e", product: "#0e8fb0", cms: "#b63a76", account: "#5d6b85",
  other: "#9aa5b8", cart: "#e2672b", checkout: "#2f9e74", order: "#1b6e4a", left: "#c3cad6",
};
/** The kinds that count as "went to the cart": the cart page, the check-out (the mini cart skips the cart page), the order. */
export const CART_KINDS: JKind[] = ["cart", "checkout", "order"];

const ACCOUNT = new Set(["customer", "sales", "wishlist", "requisition_list", "company", "negotiable_quote", "rma", "downloadable", "vault", "review"]);

/** What kind of page an address is (a path as Google Analytics reports it, or a whole address). */
export function journeyKind(path: string): JKind {
  if (!path.startsWith("/") && !/^https?:\/\//i.test(path)) return "other";
  const c = classify(path);
  if (c.kind !== "system") return c.kind;
  const rest = c.rest.toLowerCase();
  const first = rest.split("/")[0];
  if (first === "catalogsearch") return "search";
  if (/^(checkout\/onepage\/success|multishipping\/checkout\/success)/.test(rest)) return "order";
  if (/^checkout\/cart(\/|$)/.test(rest)) return "cart";
  if (first === "checkout" || first === "multishipping" || first === "paypal") return "checkout";
  if (ACCOUNT.has(first)) return "account";
  return "other";
}

/** The shop's store views (as the Black Friday page's report lists them). */
export const STORE_VIEWS = ["de-CH", "fr-CH", "it-CH", "en-CH", "fr-FR", "it-IT", "nl-NL", "pl-PL", "en-INT", "fr-INT", "it-INT", "nl-INT"];
/** A store view as a request may name one: "de-CH", "en-INT". */
export const isStoreView = (x: unknown): x is string => typeof x === "string" && /^[a-z]{2}-[A-Z]{2,3}$/.test(x);

/** The store view of an address ("de-CH" - a currency segment left off), or null. */
export function storeOf(path: string): string | null {
  return classify(path).store?.split("/")[0] ?? null;
}

/** One key per page: decoded, without the trailing slash ("/de-CH/" and "/de-CH" are one page). */
export function pathKey(path: string): string {
  let p = path.split(/[?#]/)[0] || "/";
  try { p = decodeURIComponent(p); } catch { /* keep it as it is */ }
  return p.length > 1 && p.endsWith("/") ? p.replace(/\/+$/, "") || "/" : p;
}

/** A page's name for a list: the product's or category's words, "Home page · de-CH", "Search results". */
export function pageName(path: string): string {
  const c = classify(path);
  const k = journeyKind(path);
  if (k === "home") return c.store ? `Home page · ${c.store}` : "Home page";
  if (k === "search") return "Search results";
  if (k === "cart") return "Cart";
  if (k === "checkout") return "Check-out";
  if (k === "order") return "Order placed";
  const last = c.rest.split("/").filter(Boolean).pop() ?? c.rest;
  const words = last.replace(/\.html?$/i, "").replace(/^\d{8}-?/, "").replace(/[-_]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : c.rest || path;
}

/* ── the page before ──────────────────────────────────────────────────── */

/** The shop's own addresses - a referrer on one of them is a step inside the shop. */
export const SHOP_HOSTS = ["www.apsoparts.com", "apsoparts.com", "acc.apsoparts.com"];

export type Referrer = { type: "page"; path: string } | { type: "site"; host: string } | { type: "none" };

/** Google Analytics' pageReferrer: a page of the shop, another site, or none (typed, a bookmark, an app). Null: unreadable. */
export function readReferrer(raw: string | null | undefined): Referrer | null {
  const s = String(raw ?? "").trim();
  if (!s || s === "(not set)") return { type: "none" };
  if (s.startsWith("/")) return { type: "page", path: s.split(/[?#]/)[0] };
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  // an app's own address (android-app://com.google.android.gm/): the app
  if (u.protocol !== "http:" && u.protocol !== "https:") return { type: "site", host: u.hostname || u.protocol.replace(/:$/, "") };
  const host = u.hostname.toLowerCase();
  if (SHOP_HOSTS.includes(host)) return { type: "page", path: u.pathname || "/" };
  return { type: "site", host: host.replace(/^www\./, "") };
}

/** Another site, by the name people know it under. */
export function siteName(host: string): string {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (/(^|\.)gemini\.google\.com$/.test(h)) return "Gemini";
  if (/(^|\.)google(\.[a-z]{2,3}){1,2}$/.test(h)) return "Google";
  if (/(^|\.)bing\.com$/.test(h)) return "Bing";
  if (/(^|\.)(chatgpt\.com|openai\.com)$/.test(h)) return "ChatGPT";
  if (/(^|\.)perplexity\.ai$/.test(h)) return "Perplexity";
  if (/(^|\.)copilot\.microsoft\.com$/.test(h)) return "Copilot";
  if (/(^|\.)(duckduckgo\.com|ecosia\.org|yahoo\.com|qwant\.com|yandex\.[a-z]+|baidu\.com|startpage\.com)$/.test(h)) return "Other search engines";
  if (/(^|\.)(linkedin\.com|lnkd\.in)$/.test(h)) return "LinkedIn";
  if (/(^|\.)(facebook\.com|instagram\.com|t\.co|x\.com|twitter\.com|youtube\.com)$/.test(h)) return "Social media";
  if (/(^|\.)(paypal\.com|datatrans\.com|saferpay\.com|twint\.ch|postfinance\.ch|stripe\.com|adyen\.com)$/.test(h)) return "A payment page";
  if (/(^|\.)angst-pfister\.(com|ch|de|fr|it|nl|pl)$/.test(h)) return "Angst+Pfister";
  return h;
}

/* ── the steps ────────────────────────────────────────────────────────── */

/** One row of the report: a page, the page before it (a whole address), its views. */
export type StepRow = { path: string; referrer: string; views: number };

export type PageTally = {
  /** the address as Google Analytics wrote it first */
  path: string;
  views: number;
  /** the same page again - a reload, a filter, the next page of a list: not a step */
  again: number;
  /** from another site, by name */
  sites: Map<string, number>;
  /** no page before: typed, a bookmark, an app */
  none: number;
};

export type StepGraph = {
  /** by pathKey */
  pages: Map<string, PageTally>;
  /** from pathKey -> to pathKey -> views */
  steps: Map<string, Map<string, number>>;
  /** views whose page before could not be read - counted with "no page before" */
  unreadable: number;
};

export function buildStepGraph(rows: StepRow[]): StepGraph {
  const g: StepGraph = { pages: new Map(), steps: new Map(), unreadable: 0 };
  for (const r of rows) {
    const v = Number(r.views);
    if (!r.path || !r.path.startsWith("/") || !(v > 0)) continue;
    const key = pathKey(r.path);
    let t = g.pages.get(key);
    if (!t) { t = { path: r.path, views: 0, again: 0, sites: new Map(), none: 0 }; g.pages.set(key, t); }
    t.views += v;
    const ref = readReferrer(r.referrer);
    if (!ref) { g.unreadable += v; t.none += v; continue; }
    if (ref.type === "none") { t.none += v; continue; }
    if (ref.type === "site") { const n = siteName(ref.host); t.sites.set(n, (t.sites.get(n) ?? 0) + v); continue; }
    const from = pathKey(ref.path);
    if (from === key) { t.again += v; continue; }
    let out = g.steps.get(from);
    if (!out) { out = new Map(); g.steps.set(from, out); }
    out.set(key, (out.get(key) ?? 0) + v);
  }
  return g;
}

const zeroKinds = (): Record<JKind, number> => Object.fromEntries(JKINDS.map((k) => [k, 0])) as Record<JKind, number>;
const inStore = (store: string | null) => (path: string) => !store || storeOf(path) === store;

/** The steps added up by kind of page, for one store view (null: all). Both ends of a step must be in the store view. */
export type KindFlow = {
  /** page views, a page again not counted */
  views: Record<JKind, number>;
  /** from kind -> to kind -> views */
  steps: Record<JKind, Record<JKind, number>>;
  /** views that came from another site or no page before */
  outside: Record<JKind, number>;
};

export function kindFlow(g: StepGraph, store: string | null): KindFlow {
  const ok = inStore(store);
  const kinds = new Map<string, JKind>();
  const kindOf = (key: string) => { let k = kinds.get(key); if (!k) { k = journeyKind(key); kinds.set(key, k); } return k; };
  const views = zeroKinds(), outside = zeroKinds();
  const steps = Object.fromEntries(JKINDS.map((k) => [k, zeroKinds()])) as Record<JKind, Record<JKind, number>>;
  for (const [key, t] of g.pages) {
    if (!ok(key)) continue;
    const k = kindOf(key);
    views[k] += t.views - t.again;
    outside[k] += t.none + [...t.sites.values()].reduce((a, b) => a + b, 0);
  }
  for (const [from, out] of g.steps) {
    if (!ok(from)) continue;
    const kf = kindOf(from);
    for (const [to, n] of out) if (ok(to)) steps[kf][kindOf(to)] += n;
  }
  return { views, steps, outside };
}

/** Of the visits on a kind of page, the share that goes on to each kind, and the share that leaves. */
export type Transitions = { p: Record<JKind, Record<JKind, number>>; exit: Record<JKind, number> };

/**
 * The shares from the steps. A page that opens more pages than it was viewed (several products opened in new tabs) has
 * its steps scaled to one: nobody left it. The order placed is the end - no step out of it is followed.
 */
export function transitionsOf(f: KindFlow): Transitions {
  const p = Object.fromEntries(JKINDS.map((k) => [k, zeroKinds()])) as Record<JKind, Record<JKind, number>>;
  const exit = zeroKinds();
  for (const k of JKINDS) {
    if (k === "order") { exit[k] = 1; continue; }
    const out = JKINDS.reduce((a, k2) => a + f.steps[k][k2], 0);
    const base = Math.max(f.views[k], out);
    if (base <= 0) { exit[k] = 1; continue; }
    for (const k2 of JKINDS) p[k][k2] = f.steps[k][k2] / base;
    exit[k] = Math.max(0, 1 - out / base);
  }
  return { p, exit };
}

/** The chance of reaching one of `targets` from each kind of page, step after step (the order placed ends a visit). */
export function reachChances(t: Transitions, targets: JKind[], rounds = 40): Record<JKind, number> {
  const goal = new Set(targets);
  let r = Object.fromEntries(JKINDS.map((k) => [k, goal.has(k) ? 1 : 0])) as Record<JKind, number>;
  for (let i = 0; i < rounds; i++) {
    const next = zeroKinds();
    for (const k of JKINDS) {
      if (goal.has(k)) { next[k] = 1; continue; }
      if (k === "order") continue;
      next[k] = JKINDS.reduce((a, k2) => a + t.p[k][k2] * r[k2], 0);
    }
    r = next;
  }
  return r;
}

/* ── the ways in ──────────────────────────────────────────────────────── */

/** A landing page's visits (sessions), those with an add to cart, those with an order - Google Analytics' own counts. */
export type LandingRow = { path: string; sessions: number; carts: number; orders: number };

/** The landing totals and the sessions per event (add_to_cart, purchase) merged into one row per page. */
export function landingRows(totals: { path: string; sessions: number }[], byEvent: { path: string; event: string; sessions: number }[]): LandingRow[] {
  const m = new Map<string, LandingRow>();
  const get = (path: string) => {
    const key = pathKey(path);
    let r = m.get(key);
    if (!r) { r = { path, sessions: 0, carts: 0, orders: 0 }; m.set(key, r); }
    return r;
  };
  for (const t of totals) if (t.path.startsWith("/") && t.sessions > 0) get(t.path).sessions += t.sessions;
  for (const e of byEvent) {
    if (!e.path.startsWith("/") || !(e.sessions > 0)) continue;
    if (e.event === "add_to_cart") get(e.path).carts += e.sessions;
    else if (e.event === "purchase") get(e.path).orders += e.sessions;
  }
  return [...m.values()];
}

export type Entry = { kind: JKind; sessions: number; carts: number; orders: number };

/** The visits by the kind of page they came in on, for one store view (null: all). */
export function entriesOf(rows: LandingRow[], store: string | null): Record<JKind, Entry> {
  const ok = inStore(store);
  const out = Object.fromEntries(JKINDS.map((k) => [k, { kind: k, sessions: 0, carts: 0, orders: 0 }])) as Record<JKind, Entry>;
  for (const r of rows) {
    if (!ok(r.path)) continue;
    const e = out[journeyKind(r.path)];
    e.sessions += r.sessions;
    e.carts += r.carts;
    e.orders += r.orders;
  }
  return out;
}

/** The store views with visits, the most first. */
export function storesOf(rows: LandingRow[]): { key: string; sessions: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) { const s = storeOf(r.path); if (s) m.set(s, (m.get(s) ?? 0) + r.sessions); }
  return [...m].map(([key, sessions]) => ({ key, sessions })).sort((a, b) => b.sessions - a.sessions || a.key.localeCompare(b.key));
}

/* ── the flow, chained ────────────────────────────────────────────────── */

export type FlowNode = { id: string; col: number; kind: FlowKind; value: number };
export type FlowLink = { source: string; target: string; value: number };
export type FlowGraph = { nodes: FlowNode[]; links: FlowLink[]; columns: number; total: number };

const nodeId = (col: number, kind: FlowKind) => `${col}:${kind}`;
const terminal = (k: FlowKind) => k === "order" || k === "left";

/**
 * The visits' way through the shop, column by column: the way in (Google Analytics' sessions by landing kind), then each
 * next page by the shares of the steps. Who leaves goes to "Left the shop" in the next column; the order placed and the
 * leaving end there. Built from page-to-page steps.
 */
export function chainFlow(entries: Record<JKind, number>, t: Transitions, columns: number): FlowGraph {
  const nodes = new Map<string, FlowNode>();
  const links = new Map<string, FlowLink>();
  const add = (col: number, kind: FlowKind, v: number) => {
    const id = nodeId(col, kind);
    const n = nodes.get(id);
    if (n) n.value += v; else nodes.set(id, { id, col, kind, value: v });
    return id;
  };
  const link = (s: string, tgt: string, v: number) => {
    const id = `${s}>${tgt}`;
    const l = links.get(id);
    if (l) l.value += v; else links.set(id, { source: s, target: tgt, value: v });
  };
  let total = 0;
  for (const k of JKINDS) if (entries[k] > 0) { add(0, k, entries[k]); total += entries[k]; }
  for (let c = 0; c < columns - 1; c++) {
    for (const n of [...nodes.values()].filter((x) => x.col === c && !terminal(x.kind) && x.value > 0)) {
      const k = n.kind as JKind;
      for (const k2 of JKINDS) {
        const v = n.value * t.p[k][k2];
        if (v > 0) link(n.id, add(c + 1, k2, v), v);
      }
      const e = n.value * t.exit[k];
      if (e > 0) link(n.id, add(c + 1, "left", e), e);
    }
  }
  const order = (k: FlowKind) => FLOW_KINDS.indexOf(k);
  return {
    nodes: [...nodes.values()].sort((a, b) => a.col - b.col || order(a.kind) - order(b.kind)),
    links: [...links.values()],
    columns,
    total,
  };
}

/** The small kinds of a column folded into "Other page", so the drawing stays readable (the order and the leaving never). */
export function foldFlow(g: FlowGraph, minShare: number): FlowGraph {
  const min = g.total * minShare;
  const remap = new Map<string, string>();
  for (const n of g.nodes) {
    if (terminal(n.kind) || n.kind === "other" || n.value >= min) remap.set(n.id, n.id);
    else remap.set(n.id, nodeId(n.col, "other"));
  }
  const nodes = new Map<string, FlowNode>();
  for (const n of g.nodes) {
    const id = remap.get(n.id)!;
    const cur = nodes.get(id);
    if (cur) cur.value += n.value; else nodes.set(id, { ...n, id, kind: id === n.id ? n.kind : "other" });
  }
  const links = new Map<string, FlowLink>();
  for (const l of g.links) {
    const s = remap.get(l.source) ?? l.source, t = remap.get(l.target) ?? l.target;
    const id = `${s}>${t}`;
    const cur = links.get(id);
    if (cur) cur.value += l.value; else links.set(id, { source: s, target: t, value: l.value });
  }
  const order = (k: FlowKind) => FLOW_KINDS.indexOf(k);
  return { ...g, nodes: [...nodes.values()].sort((a, b) => a.col - b.col || order(a.kind) - order(b.kind)), links: [...links.values()] };
}

export type LaidNode = FlowNode & { x: number; y: number; h: number };
export type LaidLink = FlowLink & { x0: number; x1: number; sy: number; ty: number; w: number };

/**
 * Where everything sits: one scale for every column (a visit is as tall everywhere), nodes stacked from the top in the
 * kinds' order, the bands leaving and entering each node in the order of the nodes at their other end. Bands under
 * `minLink` of the whole are left out of the drawing (they stay in the figures).
 */
export function layoutFlow(g: FlowGraph, o: { width: number; height: number; nodeWidth: number; gap: number; top?: number; minLink?: number }): { nodes: LaidNode[]; links: LaidLink[]; scale: number } {
  const top = o.top ?? 0;
  const cols = Array.from({ length: g.columns }, (_, c) => g.nodes.filter((n) => n.col === c && n.value > 0));
  const plot = o.height - top;
  const fits = cols.filter((c) => c.length).map((c) => (plot - (c.length - 1) * o.gap) / Math.max(1e-9, c.reduce((a, n) => a + n.value, 0)));
  const k = Math.max(0, fits.length ? Math.min(...fits) : 0);
  const step = g.columns > 1 ? (o.width - o.nodeWidth) / (g.columns - 1) : 0;
  const placed = new Map<string, LaidNode>();
  cols.forEach((c, ci) => {
    let y = top;
    for (const n of c) {
      const h = Math.max(1, n.value * k);
      placed.set(n.id, { ...n, x: ci * step, y, h });
      y += h + o.gap;
    }
  });
  const minV = (o.minLink ?? 0) * g.total;
  const live = g.links.filter((l) => l.value > 0 && l.value >= minV && placed.has(l.source) && placed.has(l.target));
  const yOf = (id: string) => placed.get(id)!.y;
  const sy = new Map<FlowLink, number>(), ty = new Map<FlowLink, number>();
  const outAt = new Map<string, number>(), inAt = new Map<string, number>();
  for (const l of [...live].sort((a, b) => yOf(a.source) - yOf(b.source) || yOf(a.target) - yOf(b.target))) {
    const at = outAt.get(l.source) ?? yOf(l.source);
    sy.set(l, at);
    outAt.set(l.source, at + l.value * k);
  }
  for (const l of [...live].sort((a, b) => yOf(a.target) - yOf(b.target) || yOf(a.source) - yOf(b.source))) {
    const at = inAt.get(l.target) ?? yOf(l.target);
    ty.set(l, at);
    inAt.set(l.target, at + l.value * k);
  }
  const links: LaidLink[] = live.map((l) => ({
    ...l, x0: placed.get(l.source)!.x + o.nodeWidth, x1: placed.get(l.target)!.x, sy: sy.get(l)!, ty: ty.get(l)!, w: Math.max(0.75, l.value * k),
  }));
  return { nodes: [...placed.values()], links, scale: k };
}

/** A band as a filled ribbon: two smooth curves, its width the volume. */
export function ribbonPath(x0: number, sy: number, x1: number, ty: number, w: number): string {
  const xm = (x0 + x1) / 2;
  const f = (n: number) => Math.round(n * 10) / 10;
  return `M${f(x0)},${f(sy)} C${f(xm)},${f(sy)} ${f(xm)},${f(ty)} ${f(x1)},${f(ty)} L${f(x1)},${f(ty + w)} C${f(xm)},${f(ty + w)} ${f(xm)},${f(sy + w)} ${f(x0)},${f(sy + w)} Z`;
}

/* ── the main journeys, chained ───────────────────────────────────────── */

export type Journey = {
  /** the pages, by kind, from the way in */
  kinds: JKind[];
  /** how it ends: they left, they ordered, or it goes on past the last page shown */
  end: "left" | "order" | "on";
  visits: number;
  /** of all the visits */
  share: number;
  /** of these visits, how many went to the cart (or the check-out) and how many ordered - at that point or later */
  cart: number;
  order: number;
};

/**
 * The most travelled ways through the shop, up to `depth` pages each: every way with at least `minShare` of the visits,
 * the most first. Built from page-to-page steps - the visits are the steps' shares chained, not visitors followed.
 */
export function topJourneys(entries: Record<JKind, number>, t: Transitions, o: { depth: number; minShare: number; limit: number }): Journey[] {
  const total = JKINDS.reduce((a, k) => a + Math.max(0, entries[k]), 0);
  if (total <= 0) return [];
  const min = total * o.minShare;
  const toCart = reachChances(t, CART_KINDS);
  const toOrder = reachChances(t, ["order"]);
  const out: Journey[] = [];
  const record = (kinds: JKind[], end: Journey["end"], v: number) => {
    const last = kinds[kinds.length - 1];
    const sawCart = kinds.some((k) => CART_KINDS.includes(k));
    const ordered = kinds.includes("order");
    const cart = sawCart ? v : end === "on" ? v * toCart[last] : 0;
    const order = ordered ? v : end === "on" ? v * toOrder[last] : 0;
    out.push({ kinds, end, visits: v, share: v / total, cart, order });
  };
  const walk = (kinds: JKind[], v: number) => {
    const last = kinds[kinds.length - 1];
    if (last === "order") { record(kinds, "order", v); return; }
    if (kinds.length >= o.depth) { record(kinds, "on", v); return; }
    const e = v * t.exit[last];
    if (e >= min) record(kinds, "left", e);
    for (const k2 of JKINDS) {
      const v2 = v * t.p[last][k2];
      if (v2 >= min) walk([...kinds, k2], v2);
    }
  };
  for (const k of JKINDS) if (entries[k] >= min) walk([k], entries[k]);
  return out.sort((a, b) => b.visits - a.visits).slice(0, o.limit);
}

/** A journey in words: "Category → Product → Cart, then left". */
export function journeyWords(j: Pick<Journey, "kinds" | "end">): string {
  const path = j.kinds.map((k) => KIND_NAME[k]).join(" → ");
  return j.end === "left" ? `${path}, then left` : j.end === "on" ? `${path} → …` : path;
}

/* ── the pages inside a kind ──────────────────────────────────────────── */

export type TopPage = {
  path: string; kind: JKind; store: string | null; name: string;
  /** page views, a page again not counted */
  views: number;
  /** visits that came in on it (Google Analytics' sessions) */
  entries: number;
  /** where its visits went next, by kind, as shares of its views - the biggest first */
  next: { kind: JKind; share: number }[];
  /** the share of its views no step out of it follows */
  left: number;
};

/** The most viewed pages of every kind, for one store view (null: all). */
export function topPagesByKind(g: StepGraph, landing: LandingRow[], store: string | null, limit: number): Record<JKind, TopPage[]> {
  const ok = inStore(store);
  const entries = new Map<string, number>();
  for (const r of landing) if (ok(r.path)) entries.set(pathKey(r.path), (entries.get(pathKey(r.path)) ?? 0) + r.sessions);
  const by = Object.fromEntries(JKINDS.map((k) => [k, [] as TopPage[]])) as Record<JKind, TopPage[]>;
  for (const [key, t] of g.pages) {
    if (!ok(key)) continue;
    const kind = journeyKind(key);
    const views = t.views - t.again;
    if (views <= 0) continue;
    const nextBy = zeroKinds();
    for (const [to, n] of g.steps.get(key) ?? []) if (ok(to)) nextBy[journeyKind(to)] += n;
    const out = JKINDS.reduce((a, k) => a + nextBy[k], 0);
    const base = Math.max(views, out);
    by[kind].push({
      path: t.path, kind, store: storeOf(key), name: pageName(t.path), views, entries: entries.get(key) ?? 0,
      next: JKINDS.filter((k) => nextBy[k] > 0).map((k) => ({ kind: k, share: nextBy[k] / base })).sort((a, b) => b.share - a.share),
      left: Math.max(0, 1 - out / base),
    });
  }
  for (const k of JKINDS) by[k] = by[k].sort((a, b) => b.views - a.views || a.path.localeCompare(b.path)).slice(0, limit);
  return by;
}

/* ── one page: where its visitors came from, where they went ──────────── */

export type FlowSide = {
  key: string;
  label: string;
  /** a kind of page; "site": another site; "none": no page before; "left": no next page */
  kind: FlowKind | "site" | "none";
  /** a page of the shop, to open its own flow */
  path: string | null;
  views: number;
};

export type PageFlow = {
  path: string; kind: JKind; store: string | null; name: string;
  views: number;
  again: number;
  from: FlowSide[];
  to: FlowSide[];
  /** views no step out of it follows */
  left: number;
};

/**
 * One page's two sides: `inRows` are the rows whose page is this one, `outRows` any rows whose page before may be this one
 * (the ones that are not are left out here). The biggest `limit` pages each side, the rest as "Other shop pages"; other
 * sites by name, the four biggest and the rest together.
 */
export function pageFlowOf(path: string, inRows: StepRow[], outRows: StepRow[], limit = 8): PageFlow {
  const key = pathKey(path);
  let views = 0, again = 0, none = 0;
  const pages = new Map<string, { path: string; v: number }>();
  const sites = new Map<string, number>();
  for (const r of inRows) {
    if (pathKey(r.path) !== key || !(r.views > 0)) continue;
    views += r.views;
    const ref = readReferrer(r.referrer);
    if (!ref || ref.type === "none") { none += r.views; continue; }
    if (ref.type === "site") { const n = siteName(ref.host); sites.set(n, (sites.get(n) ?? 0) + r.views); continue; }
    const from = pathKey(ref.path);
    if (from === key) { again += r.views; continue; }
    const cur = pages.get(from);
    if (cur) cur.v += r.views; else pages.set(from, { path: ref.path, v: r.views });
  }
  const nexts = new Map<string, { path: string; v: number }>();
  for (const r of outRows) {
    if (!(r.views > 0) || !r.path.startsWith("/")) continue;
    const ref = readReferrer(r.referrer);
    if (!ref || ref.type !== "page" || pathKey(ref.path) !== key) continue;
    const to = pathKey(r.path);
    if (to === key) continue;
    const cur = nexts.get(to);
    if (cur) cur.v += r.views; else nexts.set(to, { path: r.path, v: r.views });
  }
  const side = (m: Map<string, { path: string; v: number }>, n: number): FlowSide[] => {
    const all = [...m.entries()].sort((a, b) => b[1].v - a[1].v || a[0].localeCompare(b[0]));
    const head = all.slice(0, n).map(([k, x]): FlowSide => ({ key: `page:${k}`, label: pageName(x.path), kind: journeyKind(k), path: x.path, views: x.v }));
    const rest = all.slice(n).reduce((a, [, x]) => a + x.v, 0);
    return rest > 0 ? [...head, { key: "page:other", label: `Other shop pages (${all.length - n})`, kind: "other", path: null, views: rest }] : head;
  };
  const siteRows = [...sites].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const siteHead = siteRows.slice(0, 4).map(([n, v]): FlowSide => ({ key: `site:${n}`, label: n, kind: "site", path: null, views: v }));
  const siteRest = siteRows.slice(4).reduce((a, [, v]) => a + v, 0);
  const from: FlowSide[] = [
    ...side(pages, limit),
    ...siteHead,
    ...(siteRest > 0 ? [{ key: "site:other", label: `Other sites (${siteRows.length - 4})`, kind: "site" as const, path: null, views: siteRest }] : []),
    ...(none > 0 ? [{ key: "none", label: "No page before (typed, a bookmark, an app)", kind: "none" as const, path: null, views: none }] : []),
  ];
  const to = side(nexts, limit);
  const went = to.reduce((a, x) => a + x.views, 0);
  const left = Math.max(0, views - again - went);
  return { path, kind: journeyKind(path), store: storeOf(path), name: pageName(path), views, again, from, to, left };
}

/* ── the funnels ──────────────────────────────────────────────────────── */

export type FunnelStep = {
  key: string;
  /** short, for the bar */
  label: string;
  /** for a sentence: "visits that saw articles" */
  who: string;
  /** for a sentence: "put something in the cart" */
  did: string;
  n: number | null;
};

/** The shop's steps in Google Analytics: the events, and the visit itself first. view_item fires on lists too. */
export const GA4_EVENTS = ["view_item_list", "view_item", "add_to_cart", "begin_checkout", "purchase"] as const;
const GA4_WORDS: Record<(typeof GA4_EVENTS)[number] | "visit", { label: string; who: string; did: string }> = {
  visit: { label: "Visits", who: "visits", did: "visit" },
  view_item_list: { label: "Saw a list of articles", who: "visits that saw a list of articles", did: "see a list of articles" },
  view_item: { label: "Saw articles", who: "visits that saw articles", did: "see an article" },
  add_to_cart: { label: "Put in the cart", who: "visits that put something in the cart", did: "put something in the cart" },
  begin_checkout: { label: "Began the check-out", who: "visits that began the check-out", did: "begin the check-out" },
  purchase: { label: "Ordered", who: "visits that ordered", did: "order" },
};

/**
 * The visits through the shop's steps: all visits, then the sessions with each event. An event with no visits while a
 * later one has some is one the shop does not send - it is left out and named, never shown as nobody.
 */
export function ga4Funnel(total: number | null, sessionsByEvent: Record<string, number>): { steps: FunnelStep[]; notSent: string[] } {
  const steps: FunnelStep[] = [{ key: "visit", ...GA4_WORDS.visit, n: total }];
  const notSent: string[] = [];
  GA4_EVENTS.forEach((e, i) => {
    const n = sessionsByEvent[e] ?? 0;
    const later = GA4_EVENTS.slice(i + 1).some((x) => (sessionsByEvent[x] ?? 0) > 0);
    if (n <= 0 && later) { notSent.push(e); return; }
    steps.push({ key: e, ...GA4_WORDS[e], n });
  });
  return { steps, notSent };
}

/** The same steps for visitors who did them in this order (Google Analytics' funnel report counts people, not visits). */
export function orderedFunnel(users: { event: string; n: number | null }[]): FunnelStep[] {
  return users.map((u) => {
    const w = GA4_WORDS[u.event as (typeof GA4_EVENTS)[number]] ?? { label: u.event, who: u.event, did: u.event };
    return { key: u.event, label: w.label, who: w.who.replace(/^visits that/, "visitors who"), did: w.did, n: u.n };
  });
}

/** The signed-in customers' own steps, each company once at the furthest step it reached (../convert/model.ts). */
const SHOP_WORDS: { key: string; label: string; who: string; did: string; reached: Step[] }[] = [
  { key: "opened", label: "Opened an article", who: "companies that opened an article", did: "open an article", reached: ["looked", "shelf", "moq", "price", "cart", "won"] },
  { key: "asked", label: "Asked for a quantity", who: "companies that asked for a quantity", did: "ask for a quantity", reached: ["shelf", "moq", "price", "cart", "won"] },
  { key: "served", label: "Served from stock", who: "companies served from stock", did: "find the stock for it", reached: ["moq", "price", "cart", "won"] },
  { key: "minimum", label: "Minimum met, price shown", who: "companies that met the minimum and saw their price", did: "reach the minimum order", reached: ["price", "cart", "won"] },
  { key: "cart", label: "Put in the cart", who: "companies that put something in the cart", did: "put it in the cart", reached: ["cart", "won"] },
  { key: "ordered", label: "Ordered", who: "companies that ordered", did: "order", reached: ["won"] },
];
/** The step a company stopped at, between one shop step and the next (STEP_LABEL's words). */
export const SHOP_STOP: Record<string, Step> = { asked: "looked", served: "shelf", minimum: "moq", cart: "price", ordered: "cart" };

export function companyFunnel(looks: Pick<ShopLook, "company" | "step">[]): { companies: number; steps: FunnelStep[]; stopped: Record<Step, number> } {
  const furthest = furthestByCompany(looks.map((l) => ({ ...l, article: "", product: "", day: "" })));
  const stopped: Record<Step, number> = { shelf: 0, looked: 0, moq: 0, price: 0, cart: 0, won: 0 };
  for (const v of furthest.values()) stopped[v.step] += 1;
  const steps = SHOP_WORDS.map((w): FunnelStep => ({ key: w.key, label: w.label, who: w.who, did: w.did, n: w.reached.reduce((a, s) => a + stopped[s], 0) }));
  return { companies: furthest.size, steps, stopped };
}

export type Drop = { from: FunnelStep; to: FunnelStep; lost: number; share: number };

/** Where the most are lost, as a share of the step before (a step with more than the one before is no drop). */
export function biggestDrop(steps: FunnelStep[]): Drop | null {
  let best: Drop | null = null;
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1], b = steps[i];
    if (a.n === null || b.n === null || a.n <= 0 || b.n > a.n) continue;
    const share = 1 - b.n / a.n;
    if (!best || share > best.share || (share === best.share && a.n - b.n > best.lost)) best = { from: a, to: b, lost: a.n - b.n, share };
  }
  return best;
}

/** A drop in words: "Of the 12,300 visits that saw articles, 94% did not put something in the cart." */
export function dropWords(d: Drop, fmt: (n: number) => string = (n) => Math.round(n).toLocaleString("en-US")): string {
  const pct = d.share >= 0.995 ? "almost all" : `${Math.round(d.share * 100)}%`;
  return `Of the ${fmt(d.from.n ?? 0)} ${d.from.who}, ${pct} did not ${d.to.did}.`;
}
