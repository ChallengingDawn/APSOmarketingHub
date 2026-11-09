// Website > JOURNEYS - THE READS. Google Analytics for the visits (src/lib/integrations/ga4Reports.ts: journeySteps,
// journeyLanding, journeyLandingEvents, convertPages; and its own funnel report, ./ga4Funnel.ts), the shop's own record
// for the signed-in customers (the Products Reports' read, src/lib/productSignals/read.ts - the same object APSOconvert's
// Problems use, never started twice). The rules, and how the rows become a page's answer, are in ./model.ts (pure).
//
// A device (desktop, phone, tablet) is asked of Google Analytics itself (deviceCategory); a store view is cut from the
// period's read in the hub. Each read is kept ten minutes per period and device (one at a time - a second ask joins the
// first). A failed read is never kept. Every figure is compared with the period of the same length just before.

import { fetchGa4Report, type Ga4Where } from "@/lib/integrations/ga4Reports";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";
import { productSignals } from "@/lib/productSignals/read";
import { CO, SIGNALS_FROM } from "@/lib/productSignals/model";
import { STEPS, type Step } from "@/lib/convert/model";
import type { ShopState } from "@/lib/convert/problems";
import {
  FLOW_COLUMNS, FOLD_SHARE, JOURNEY_RULES, biggestDrop, buildChain, buildStepGraph, chainFunnel, companyFunnel, funnelOf,
  ga4StepExpr, journeysOf, landingRows, landingTotals, pageFlowOf, pagePathPattern, pathKey, periodBefore, stepName,
  stepToken, storeChoices, storesOf,
  type Device, type DropPage, type Drop, type FunnelStep, type JourneysBody, type LandingRow, type PageFlow, type StepDef,
  type StepGraph, type StoreChoice, type Totals,
} from "./model";
import { fetchFunnelReport } from "./ga4Funnel";

export { FLOW_COLUMNS };

const TTL_MS = 10 * 60_000;

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
  if (slots.size > 60) for (const [k, v] of slots) if (Date.now() - v.at > TTL_MS) slots.delete(k);
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

const onDevice = (device: Device | null): Ga4Where[] => (device ? [{ field: "deviceCategory", match: "EXACT", value: device }] : []);

/* ── the reads ────────────────────────────────────────────────────────── */

type Landing = { landing: LandingRow[]; truncated: boolean };

/** The visits by the page they came in on, with their add-to-carts and orders - Google Analytics' own counts. */
function readLanding(from: string, to: string, device: Device | null): Promise<Landing> {
  return kept(`land:${from}:${to}:${device ?? ""}`, () => withTimeout(45_000, async (signal) => {
    const where = onDevice(device);
    const [landing, events] = await Promise.all([
      fetchGa4Report({ name: "journeyLanding", from, to, where, signal }),
      fetchGa4Report({ name: "journeyLandingEvents", from, to, where, signal }),
    ]);
    return {
      landing: landingRows(
        landing.rows.map((r) => ({ path: r.keys[0] ?? "", sessions: r.values[0] ?? 0, transactions: r.values[2] ?? 0 })),
        events.rows.map((r) => ({ path: r.keys[0] ?? "", event: r.keys[1] ?? "", sessions: r.values[0] ?? 0 })),
      ),
      truncated: landing.truncated || events.truncated,
    };
  }));
}

type Raw = Landing & { graph: StepGraph; truncatedSteps: boolean; stepRows: number };

/** Every page view with the page before it, and the ways in - the period's steps. */
function readRaw(from: string, to: string, device: Device | null): Promise<Raw> {
  return kept(`raw:${from}:${to}:${device ?? ""}`, () => withTimeout(60_000, async (signal) => {
    const [steps, land] = await Promise.all([
      fetchGa4Report({ name: "journeySteps", from, to, where: onDevice(device), signal }),
      readLanding(from, to, device),
    ]);
    const graph = buildStepGraph(steps.rows.map((r) => ({ path: r.keys[0] ?? "", referrer: r.keys[1] ?? "", views: r.values[0] ?? 0 })));
    return { ...land, graph, truncatedSteps: steps.truncated, stepRows: steps.rows.length };
  }));
}

/* ── main journeys ────────────────────────────────────────────────────── */

export type JourneysData = JourneysBody & {
  from: string; to: string; store: string | null; device: Device | null;
  /** the period just before, for the same store view and device - null when it could not be read */
  before: { from: string; to: string; totals: Totals } | null;
  /** every store view of the shop with its visits (on this device), then any other with visits */
  stores: StoreChoice[];
  ga4: { truncatedSteps: boolean; truncatedLanding: boolean; stepRows: number; unreadable: number };
  rules: { columns: number; foldShare: number; journey: typeof JOURNEY_RULES };
};

export async function buildJourneys(from: string, to: string, store: string | null, device: Device | null = null): Promise<JourneysData> {
  const prev = periodBefore(from, to);
  const [raw, before] = await Promise.all([readRaw(from, to, device), readLanding(prev.from, prev.to, device).catch(() => null)]);
  return {
    ...journeysOf(raw.graph, raw.landing, store),
    from, to, store, device,
    before: before ? { ...prev, totals: landingTotals(before.landing, store) } : null,
    stores: storeChoices(storesOf(raw.landing)),
    ga4: { truncatedSteps: raw.truncatedSteps, truncatedLanding: raw.truncated, stepRows: raw.stepRows, unreadable: raw.graph.unreadable },
    rules: { columns: FLOW_COLUMNS, foldShare: FOLD_SHARE, journey: JOURNEY_RULES },
  };
}

/* ── one page ─────────────────────────────────────────────────────────── */

export type PageFlowData = {
  from: string; to: string; device: Device | null;
  flow: PageFlow;
  /** on the page itself: views, visits, add-to-carts (the report APSOconvert's Problems read) */
  page: { views: number; sessions: number; addToCarts: number } | null;
  /** the visits that came in on it, and what they did */
  landing: { sessions: number; carts: number; orders: number };
  truncated: boolean;
};

export async function buildPageFlow(path: string, from: string, to: string, device: Device | null = null): Promise<PageFlowData> {
  const key = pathKey(path);
  return kept(`page:${key}:${from}:${to}:${device ?? ""}`, () => withTimeout(45_000, async (signal) => {
    const dev = onDevice(device);
    const onPage: Ga4Where[] = [{ field: "pagePath", match: "FULL_REGEXP", value: `^${pagePathPattern(key)}$` }, ...dev];
    const after: Ga4Where[] = [{ field: "pageReferrer", match: "FULL_REGEXP", value: `^https?://(?:www\\.|acc\\.)?apsoparts\\.com${pagePathPattern(key)}(?:[?#].*)?$` }, ...dev];
    const landed: Ga4Where[] = [{ field: "landingPage", match: "FULL_REGEXP", value: `^${pagePathPattern(key)}$` }, ...dev];
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
      from, to, device, flow,
      page: pageRep.rows.length ? { views: sum(pageRep.rows, 0), sessions: sum(pageRep.rows, 1), addToCarts: sum(pageRep.rows, 2) } : null,
      landing: { sessions: sum(landRep.rows, 0), carts: ev("add_to_cart"), orders: ev("purchase") },
      truncated: inRep.truncated || outRep.truncated,
    };
  }));
}

/* ── the funnel ───────────────────────────────────────────────────────── */

type Ga4FunnelPart = {
  configured: boolean; ok: boolean; error: string | null;
  /** Google Analytics' funnel report: the visitors who did the steps in this order, for the device asked (or all) */
  now: (number | null)[] | null;
  before: (number | null)[] | null;
  /** all devices asked: each device's own */
  byDevice: Record<string, (number | null)[]> | null;
};

function ga4FunnelPart(from: string, to: string, store: string | null, device: Device | null, steps: StepDef[]): Promise<Ga4FunnelPart> {
  if (!integrationStatus().ga4.configured) return Promise.resolve({ configured: false, ok: false, error: null, now: null, before: null, byDevice: null });
  const prev = periodBefore(from, to);
  const tokens = steps.map(stepToken).join(",");
  return kept(`gfun:${from}:${to}:${store ?? ""}:${device ?? ""}:${tokens}`, () => withTimeout(45_000, async (signal) => {
    const asked = steps.map((d) => ({ name: stepName(d).slice(0, 60), filterExpression: ga4StepExpr(d, store) }));
    try {
      const [now, before] = await Promise.all([
        fetchFunnelReport({ from, to, steps: asked, breakdown: "deviceCategory", signal }),
        fetchFunnelReport({ from: prev.from, to: prev.to, steps: asked, breakdown: "deviceCategory", signal }).catch(() => null),
      ]);
      const pick = (t: { all: (number | null)[]; by: Record<string, (number | null)[]> }) =>
        device ? (t.by[device] ?? steps.map(() => 0)) : t.all;
      return { configured: true, ok: true, error: null, now: pick(now), before: before ? pick(before) : null, byDevice: device ? null : now.by };
    } catch (e) {
      return { configured: true, ok: false, error: describeIntegrationError(e).error, now: null, before: null, byDevice: null };
    }
  }), (v) => v.ok);
}

type ChainedPart = {
  ok: boolean; error: string | null;
  /** the visits through the steps, chained from page-to-page steps */
  now: number[];
  before: number[] | null;
  /** for each step but the last: the pages that lose the most to the next */
  drops: DropPage[][];
  truncated: boolean;
  /** every store view with its visits in the period (on this device) - for the store view choice */
  stores: StoreChoice[] | null;
};

async function chainedPart(from: string, to: string, store: string | null, device: Device | null, steps: StepDef[]): Promise<ChainedPart> {
  if (!integrationStatus().ga4.configured) return { ok: false, error: "Google Analytics is not connected on this hub.", now: [], before: null, drops: [], truncated: false, stores: null };
  const prev = periodBefore(from, to);
  try {
    const [raw, rawBefore] = await Promise.all([readRaw(from, to, device), readRaw(prev.from, prev.to, device).catch(() => null)]);
    const f = funnelOf(raw.graph, raw.landing, store, steps);
    const pages = steps.flatMap((d) => (d.type === "page" ? [d.path] : []));
    const before = rawBefore ? chainFunnel(buildChain(rawBefore.graph, rawBefore.landing, store, pages), steps) : null;
    return { ok: true, error: null, now: f.n, before, drops: f.drops, truncated: raw.truncatedSteps, stores: storeChoices(storesOf(raw.landing)) };
  } catch (e) {
    return { ok: false, error: describeIntegrationError(e).error, now: [], before: null, drops: [], truncated: false, stores: null };
  }
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

export type FunnelData = {
  from: string; to: string; store: string | null; device: Device | null;
  before: { from: string; to: string };
  /** the steps as the address keeps them (model.ts parseStep) */
  steps: string[];
  ga4: Ga4FunnelPart;
  chained: ChainedPart;
  shop: ShopFunnelPart;
};

export async function buildFunnel(from: string, to: string, store: string | null, device: Device | null, steps: StepDef[]): Promise<FunnelData> {
  const [ga4, chained, shop] = await Promise.all([
    ga4FunnelPart(from, to, store, device, steps),
    chainedPart(from, to, store, device, steps),
    shopFunnelPart(from, to),
  ]);
  return { from, to, store, device, before: periodBefore(from, to), steps: steps.map(stepToken), ga4, chained, shop };
}
