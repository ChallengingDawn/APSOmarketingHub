// APSOconvert - PROBLEMS (Website > AI testing & personalization > Problems): pages with a lot of traffic and little
// buying, down to the customers behind them. Two reads, each answering for different people (./model.ts):
//
//   Google Analytics   every address with its views and add-to-carts in the period (report convertPages) - consented
//                      visitors only, no customer identity
//   the shop's record  the Products Reports' read (src/lib/productSignals/read.ts, shared and kept two hours): every look
//                      a signed-in customer made at an article, the company, the day and the step it stopped at - the
//                      article's product number (Products & Pricing) ties it to its product page
//
// Neither read is started twice: the Products Reports' read is the same object their pages use.

import { fetchGa4Report } from "@/lib/integrations/ga4Reports";
import { describeIntegrationError, integrationStatus } from "@/lib/integrations/status";
import { productSignals } from "@/lib/productSignals/read";
import { CO, AR, type SignalsData } from "@/lib/productSignals/model";
import { fetchPageAudience, type PersonRow } from "@/lib/integrations/hubspotJourney";
import {
  DEFAULT_OPTIONS, STEPS, classify, furthestByCompany, looksByProduct, productNumber, rankProblems,
  type PageKind, type ProblemPage, type ShopLook, type Step,
} from "./model";
import { indexedPaths } from "./pages";

export type ShopState = { state: "ready" | "computing" | "error" | "none"; progress: string | null; computedAt: string | null; through: string | null; error: string | null; unmatched: number };

export type ProblemsData = {
  from: string;
  to: string;
  pages: (ProblemPage & { name: string; indexed: boolean | null })[];
  typical: Record<PageKind, number | null>;
  ga4: { ok: boolean; error: string | null; truncated: boolean; addresses: number; configured: boolean };
  shop: ShopState;
  minViews: number;
  minCompanies: number;
};

/** The shop's looks as ShopLook rows, with the product each article belongs to. */
function shopLooks(d: SignalsData): { looks: ShopLook[]; names: Map<string, string>; unmatched: number } {
  const looks: ShopLook[] = [];
  const names = new Map<string, string>();
  let unmatched = 0;
  for (const [c, a, day, s] of d.path ?? []) {
    const co = d.companies[c];
    const ar = d.articles[a];
    const step = STEPS[s] as Step | undefined;
    if (!co || !ar || !step) continue;
    const product = productNumber(ar[AR.product]);
    if (!product) { unmatched += 1; continue; }
    if (ar[AR.productName] && !names.has(product)) names.set(product, ar[AR.productName]);
    looks.push({ company: co[CO.id], article: ar[AR.number], product, day, step });
  }
  return { looks, names, unmatched };
}

async function shopRead(): Promise<{ data: SignalsData | null; state: ShopState }> {
  try {
    const st = await productSignals();
    const v = st.value ?? null;
    const state: ShopState = {
      state: v ? "ready" : st.error ? "error" : st.computing ? "computing" : "none",
      progress: st.progress ?? null, computedAt: st.computedAt ?? null, through: v?.through ?? null, error: st.error ?? null, unmatched: 0,
    };
    return { data: v, state };
  } catch (e) {
    return { data: null, state: { state: "error", progress: null, computedAt: null, through: null, error: String((e as Error)?.message ?? e), unmatched: 0 } };
  }
}

export async function buildProblems(from: string, to: string, signal?: AbortSignal): Promise<ProblemsData> {
  const ga4Configured = integrationStatus().ga4.configured;
  const [ga4, shop, indexed] = await Promise.all([
    ga4Configured
      ? fetchGa4Report({ name: "convertPages", from, to, signal }).then((r) => ({ r, error: null as string | null })).catch((e) => ({ r: null, error: describeIntegrationError(e).error }))
      : Promise.resolve({ r: null, error: null as string | null }),
    shopRead(),
    indexedPaths().catch(() => null),
  ]);
  const traffic = (ga4.r?.rows ?? []).map((row) => ({
    path: row.keys[0] ?? "",
    views: row.values[0] ?? 0,
    sessions: row.values[1] ?? 0,
    addToCarts: row.values[2] ?? 0,
  })).filter((t) => t.path.startsWith("/"));

  let names = new Map<string, string>();
  let byProduct = new Map<string, ShopLook[]>();
  if (shop.data) {
    const s = shopLooks(shop.data);
    names = s.names;
    shop.state.unmatched = s.unmatched;
    byProduct = looksByProduct(s.looks, from, to);
  }
  const { pages, typical } = rankProblems(traffic, byProduct, DEFAULT_OPTIONS);
  const out = pages
    .filter((p) => p.views > 0 || (p.shop?.companies ?? 0) > 0)
    .map((p) => ({
      ...p,
      name: p.product ? (names.get(p.product) ?? (p.path ? classify(p.path).rest : p.product)) : p.path,
      indexed: indexed && p.path ? indexed.has(p.path) : null,
    }));
  return {
    from, to, pages: out, typical,
    ga4: { ok: !!ga4.r, error: ga4.error, truncated: ga4.r?.truncated ?? false, addresses: traffic.length, configured: ga4Configured },
    shop: shop.state,
    minViews: DEFAULT_OPTIONS.minViews,
    minCompanies: DEFAULT_OPTIONS.minCompanies,
  };
}

/* ── one page's customers ─────────────────────────────────────────────── */

export type CustomerLine = {
  companyId: string; name: string; customerNumber: string; country: string;
  step: Step; looks: number; lastDay: string; articles: string[];
};
export type PageCustomers =
  | { kind: "product"; product: string; from: string; to: string; shop: ShopState; customers: CustomerLine[] }
  | { kind: "page"; path: string; total: number | null; people: PersonRow[]; token: string };

/** A product page: every company that opened one of its articles in the period, furthest step first lost ones on top. */
export async function productCustomers(product: string, from: string, to: string): Promise<PageCustomers> {
  const shop = await shopRead();
  const customers: CustomerLine[] = [];
  if (shop.data) {
    const d = shop.data;
    const { looks } = shopLooks(d);
    const mine = looks.filter((l) => l.product === product && l.day >= from && l.day <= to);
    const coById = new Map(d.companies.map((c) => [c[CO.id], c]));
    for (const [id, v] of furthestByCompany(mine)) {
      const co = coById.get(id);
      customers.push({
        companyId: id, name: co?.[CO.name] || id, customerNumber: co?.[CO.un] ?? "", country: co?.[CO.country] ?? "",
        step: v.step, looks: v.looks, lastDay: v.lastDay, articles: [...v.articles].sort(),
      });
    }
  }
  // the ones we lost first, the furthest along first (they were closest to an order), then the most looks
  const order: Record<Step, number> = { cart: 0, price: 1, moq: 2, shelf: 3, looked: 4, won: 5 };
  customers.sort((a, b) => order[a.step] - order[b.step] || b.looks - a.looks || b.lastDay.localeCompare(a.lastDay));
  return { kind: "product", product, from, to, shop: shop.state, customers };
}

/** Any other page: the contacts HubSpot last saw on it (one page per contact - the newest). */
export async function pageCustomers(path: string, signal?: AbortSignal): Promise<PageCustomers> {
  const a = await fetchPageAudience({ path, limit: 25, signal });
  return { kind: "page", path, total: a.total, people: a.rows, token: a.token };
}
