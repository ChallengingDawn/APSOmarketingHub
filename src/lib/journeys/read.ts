// Website > JOURNEYS - THE READS. Google Analytics for the visits (src/lib/integrations/ga4Reports.ts: journeySteps,
// journeyLanding, journeyLandingEvents, journeyEvents, convertPages, sessionTotals; and its funnel report, ./ga4Funnel.ts),
// the shop's own record for the signed-in customers (the Products Reports' read, src/lib/productSignals/read.ts - the
// same object APSOconvert's Problems use, never started twice). The rules are in ./model.ts.
//
// Each read is kept ten minutes per period (one at a time - a second ask joins the first); a store view is cut from the
// period's read in the hub, except the funnel's visits, which Google Analytics counts per store view itself (a visit is
// not a sum of pages). A failed read is never kept.

import { fetchGa4Report, type Ga4Where } from "@/lib/integrations/ga4Reports";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";
import { productSignals } from "@/lib/productSignals/read";
import { CO, SIGNALS_FROM } from "@/lib/productSignals/model";
import { STEPS, type Step } from "@/lib/convert/model";
import type { ShopState } from "@/lib/convert/problems";
import {
  GA4_EVENTS, JKINDS, biggestDrop, buildStepGraph, chainFlow, companyFunnel, entriesOf, foldFlow, ga4Funnel, kindFlow,
  landingRows, orderedFunnel, pageFlowOf, pathKey, storeOf, storesOf, topJourneys, topPagesByKind, transitionsOf,
  type Drop, type Entry, type FlowGraph, type FunnelStep, type JKind, type Journey, type LandingRow, type PageFlow,
  type StepGraph, type TopPage,
} from "./model";
import { fetchOrderedFunnel } from "./ga4Funnel";

const TTL_MS = 10 * 60_000;
/** the columns of the flow: the way in and four pages more */
export const FLOW_COLUMNS = 5;
/** a kind under this share of the visits in a column is drawn with the other pages */
const FOLD_SHARE = 0.01;
/** the main journeys: up to three pages, each with at least this share of the visits */
const JOURNEY = { depth: 3, minShare: 0.004, limit: 12 };

type Slot<T> = { at: number; p: Promise<T> };
const slots = ((globalThis as { __journeysCache?: Map<string, Slot<unknown>> }).__journeysCache ??= new Map());

/** One read per key at a time, kept ten minutes when `keep` says it is whole. */
function kept<T>(key: string, make: () => Promise<T>, keep: (v: T) => boolean = () => true): Promise<T> {
  const hit = slots.get(key) as Slot<T> | undefined;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.p;
  const p = make().then(
    (v) => { if (!keep(v)) slots.delete(key); return v; },
    (e) => { slots.delete(key); throw e; },
  );
  slots.set(key, { at: Date.now(), p });
  if (slots.size > 40) for (const [k, v] of slots) if (Date.now() - v.at > TTL_MS) slots.delete(k);
  // the step reads are large: never more than a few periods at once
  const big = [...slots.keys()].filter((k) => k.startsWith("raw:"));
  if (big.length > 6) slots.delete(big[0]);
  return p;
}

function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), ms);
  return run(c.signal).finally(() => clearTimeout(timer));
}

/* ── main journeys ────────────────────────────────────────────────────── */

type Raw = {
  graph: StepGraph; landing: LandingRow[];
  /** orders (transactions) per landing page key */
  orders: Map<string, number>;
  truncated: { steps: boolean; landing: boolean };
  stepRows: number;
};

function readRaw(from: string, to: string): Promise<Raw> {
  return kept(`raw:${from}:${to}`, () => withTimeout(60_000, async (signal) => {
    const [steps, landing, events] = await Promise.all([
      fetchGa4Report({ name: "journeySteps", from, to, signal }),
      fetchGa4Report({ name: "journeyLanding", from, to, signal }),
      fetchGa4Report({ name: "journeyLandingEvents", from, to, signal }),
    ]);
    const graph = buildStepGraph(steps.rows.map((r) => ({ path: r.keys[0] ?? "", referrer: r.keys[1] ?? "", views: r.values[0] ?? 0 })));
    const rows = landingRows(
      landing.rows.map((r) => ({ path: r.keys[0] ?? "", sessions: r.values[0] ?? 0 })),
      events.rows.map((r) => ({ path: r.keys[0] ?? "", event: r.keys[1] ?? "", sessions: r.values[0] ?? 0 })),
    );
    const orders = new Map<string, number>();
    for (const r of landing.rows) {
      const p = r.keys[0] ?? "";
      if (p.startsWith("/")) orders.set(pathKey(p), (orders.get(pathKey(p)) ?? 0) + (r.values[2] ?? 0));
    }
    return { graph, landing: rows, orders, truncated: { steps: steps.truncated, landing: landing.truncated || events.truncated }, stepRows: steps.rows.length };
  }));
}

export type JourneysData = {
  from: string; to: string; store: string | null;
  stores: { key: string; sessions: number }[];
  /** Google Analytics' own: visits, those with an add to cart, those with an order, the orders */
  totals: { visits: number; carts: number; orders: number; transactions: number };
  /** by the kind of page they came in on, the most first */
  entries: Entry[];
  /** chained from the steps */
  flow: FlowGraph;
  journeys: Journey[];
  /** page views by kind, a page again not counted */
  views: Record<JKind, number>;
  pages: Record<JKind, TopPage[]>;
  ga4: { truncatedSteps: boolean; truncatedLanding: boolean; stepRows: number; unreadable: number };
  rules: { columns: number; foldShare: number; journeyDepth: number; journeyMinShare: number };
};

export async function buildJourneys(from: string, to: string, store: string | null): Promise<JourneysData> {
  const raw = await readRaw(from, to);
  const byKind = entriesOf(raw.landing, store);
  const entryCounts = Object.fromEntries(JKINDS.map((k) => [k, byKind[k].sessions])) as Record<JKind, number>;
  const kf = kindFlow(raw.graph, store);
  const t = transitionsOf(kf);
  const entries = JKINDS.map((k) => byKind[k]).filter((e) => e.sessions > 0).sort((a, b) => b.sessions - a.sessions);
  let transactions = 0;
  for (const [k, n] of raw.orders) if (!store || storeOf(k) === store) transactions += n;
  return {
    from, to, store,
    stores: storesOf(raw.landing),
    totals: {
      visits: entries.reduce((a, e) => a + e.sessions, 0),
      carts: entries.reduce((a, e) => a + e.carts, 0),
      orders: entries.reduce((a, e) => a + e.orders, 0),
      transactions,
    },
    entries,
    flow: foldFlow(chainFlow(entryCounts, t, FLOW_COLUMNS), FOLD_SHARE),
    journeys: topJourneys(entryCounts, t, JOURNEY),
    views: kf.views,
    pages: topPagesByKind(raw.graph, raw.landing, store, 30),
    ga4: { truncatedSteps: raw.truncated.steps, truncatedLanding: raw.truncated.landing, stepRows: raw.stepRows, unreadable: raw.graph.unreadable },
    rules: { columns: FLOW_COLUMNS, foldShare: FOLD_SHARE, journeyDepth: JOURNEY.depth, journeyMinShare: JOURNEY.minShare },
  };
}

/* ── one page ─────────────────────────────────────────────────────────── */

const re2 = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The page's address as Google Analytics may write it - with or without the trailing slash, as typed or encoded. */
function pathPattern(key: string): string {
  const bare = key === "/" ? "" : key;
  const forms = [...new Set([bare, encodeURI(bare)])].map(re2);
  return `${forms.length > 1 ? `(?:${forms.join("|")})` : forms[0]}/?`;
}

export type PageFlowData = {
  from: string; to: string;
  flow: PageFlow;
  /** on the page itself: views, visits, add-to-carts (the report APSOconvert's Problems read) */
  page: { views: number; sessions: number; addToCarts: number } | null;
  /** the visits that came in on it, and what they did */
  landing: { sessions: number; carts: number; orders: number };
  truncated: boolean;
};

export async function buildPageFlow(path: string, from: string, to: string): Promise<PageFlowData> {
  const key = pathKey(path);
  return kept(`page:${key}:${from}:${to}`, () => withTimeout(45_000, async (signal) => {
    const onPage: Ga4Where[] = [{ field: "pagePath", match: "FULL_REGEXP", value: `^${pathPattern(key)}$` }];
    const after: Ga4Where[] = [{ field: "pageReferrer", match: "FULL_REGEXP", value: `^https?://(?:www\\.|acc\\.)?apsoparts\\.com${pathPattern(key)}(?:[?#].*)?$` }];
    const landed: Ga4Where[] = [{ field: "landingPage", match: "FULL_REGEXP", value: `^${pathPattern(key)}$` }];
    const [inRep, outRep, pageRep, landRep, landEv] = await Promise.all([
      fetchGa4Report({ name: "journeySteps", from, to, where: onPage, signal }),
      fetchGa4Report({ name: "journeySteps", from, to, where: after, signal }),
      fetchGa4Report({ name: "convertPages", from, to, where: onPage, signal }),
      fetchGa4Report({ name: "journeyLanding", from, to, where: landed, signal }),
      fetchGa4Report({ name: "journeyLandingEvents", from, to, where: landed, signal }),
    ]);
    const asSteps = (rows: typeof inRep.rows) => rows.map((r) => ({ path: r.keys[0] ?? "", referrer: r.keys[1] ?? "", views: r.values[0] ?? 0 }));
    const flow = pageFlowOf(path, asSteps(inRep.rows), asSteps(outRep.rows));
    const sum = (rows: typeof pageRep.rows, i: number) => rows.reduce((a, r) => a + (r.values[i] ?? 0), 0);
    const ev = (name: string) => landEv.rows.filter((r) => r.keys[1] === name).reduce((a, r) => a + (r.values[0] ?? 0), 0);
    return {
      from, to, flow,
      page: pageRep.rows.length ? { views: sum(pageRep.rows, 0), sessions: sum(pageRep.rows, 1), addToCarts: sum(pageRep.rows, 2) } : null,
      landing: { sessions: sum(landRep.rows, 0), carts: ev("add_to_cart"), orders: ev("purchase") },
      truncated: inRep.truncated || outRep.truncated,
    };
  }));
}

/* ── the funnel ───────────────────────────────────────────────────────── */

type Ga4FunnelPart = {
  configured: boolean; missing: string[];
  ok: boolean; error: string | null;
  steps: FunnelStep[]; notSent: string[]; drop: Drop | null;
  /** Google Analytics' funnel report: the visitors who did the steps in this order - null when it was not asked */
  ordered: { ok: boolean; error: string | null; steps: FunnelStep[]; drop: Drop | null } | null;
};

function ga4FunnelPart(from: string, to: string, store: string | null): Promise<Ga4FunnelPart> {
  const status = integrationStatus().ga4;
  if (!status.configured) {
    return Promise.resolve({ configured: false, missing: status.missing, ok: false, error: null, steps: [], notSent: [], drop: null, ordered: null });
  }
  return kept(`funnel:${from}:${to}:${store ?? ""}`, () => withTimeout(45_000, async (signal) => {
    const where: Ga4Where[] | undefined = store ? [{ field: "pagePath", match: "BEGINS_WITH", value: `/${store}/` }] : undefined;
    try {
      const [events, totals] = await Promise.all([
        fetchGa4Report({ name: "journeyEvents", from, to, where, signal }),
        fetchGa4Report({ name: "sessionTotals", from, to, where, signal }),
      ]);
      const byEvent: Record<string, number> = {};
      for (const r of events.rows) byEvent[r.keys[0] ?? ""] = r.values[0] ?? 0;
      const { steps, notSent } = ga4Funnel(totals.rows[0]?.values[0] ?? null, byEvent);
      // in order: the events the shop sends, from the first article seen to the order
      const ev = GA4_EVENTS.filter((e) => !notSent.includes(e) && (byEvent[e] ?? 0) > 0);
      let ordered: Ga4FunnelPart["ordered"] = null;
      if (ev.length >= 2) {
        try {
          const o = orderedFunnel(await fetchOrderedFunnel({ from, to, events: ev, pathPrefix: store ? `/${store}/` : null, signal }));
          ordered = { ok: true, error: null, steps: o, drop: biggestDrop(o) };
        } catch (e) {
          ordered = { ok: false, error: describeIntegrationError(e).error, steps: [], drop: null };
        }
      }
      return { configured: true, missing: [], ok: true, error: null, steps, notSent, drop: biggestDrop(steps), ordered };
    } catch (e) {
      return { configured: true, missing: [], ok: false, error: describeIntegrationError(e).error, steps: [], notSent: [], drop: null, ordered: null };
    }
  }), (v) => v.ok);
}

type ShopFunnelPart = {
  state: ShopState;
  /** the first day the shop's record has */
  since: string;
  companies: number;
  looks: number;
  steps: FunnelStep[];
  stopped: Record<Step, number>;
  drop: Drop | null;
};

async function shopFunnelPart(from: string, to: string): Promise<ShopFunnelPart> {
  const empty: Record<Step, number> = { shelf: 0, looked: 0, moq: 0, price: 0, cart: 0, won: 0 };
  try {
    const st = await productSignals();
    const d = st.value ?? null;
    const state: ShopState = {
      state: d ? "ready" : st.error ? "error" : st.computing ? "computing" : "none",
      progress: st.progress ?? null, computedAt: st.computedAt ?? null, through: d?.through ?? null, error: st.error ?? null, unmatched: 0,
    };
    if (!d || !d.path) return { state: d ? { ...state, state: "none" } : state, since: SIGNALS_FROM, companies: 0, looks: 0, steps: [], stopped: empty, drop: null };
    const looks: { company: string; step: Step }[] = [];
    for (const [c, , day, s] of d.path) {
      if (day < from || day > to) continue;
      const co = d.companies[c];
      const step = STEPS[s] as Step | undefined;
      if (co && step) looks.push({ company: co[CO.id], step });
    }
    const f = companyFunnel(looks);
    return { state, since: SIGNALS_FROM, companies: f.companies, looks: looks.length, steps: f.steps, stopped: f.stopped, drop: biggestDrop(f.steps) };
  } catch (e) {
    return {
      state: { state: "error", progress: null, computedAt: null, through: null, error: String((e as Error)?.message ?? e), unmatched: 0 },
      since: SIGNALS_FROM, companies: 0, looks: 0, steps: [], stopped: empty, drop: null,
    };
  }
}

export type FunnelData = { from: string; to: string; store: string | null; ga4: Ga4FunnelPart; shop: ShopFunnelPart };

export async function buildFunnel(from: string, to: string, store: string | null): Promise<FunnelData> {
  const [ga4, shop] = await Promise.all([ga4FunnelPart(from, to, store), shopFunnelPart(from, to)]);
  return { from, to, store, ga4, shop };
}
