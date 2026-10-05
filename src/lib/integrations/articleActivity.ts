// ARTICLE ACTIVITY — the Datatracker's Article tab.
//
// Orders, companies, stock and the assortment tree come from Products & Pricing,
// which the nightly load keeps current: `order_article_count` is filled on
// 130,966 articles and was written this morning. Those are ERP counts, so they
// cover every order whatever anyone chose on the cookie banner.
//
// Views used to come from GA4, which sees only consented sessions and carries no
// customer identity — so the column was both short of the truth and could not say
// WHO looked. The shop now reports the article itself, off the ERP price lookup
// that fires for every signed-in customer whatever they chose on the cookie
// banner. Those are the counts here, and they can name the customers behind them.

import { loadReport } from "./articleReport";
import { hubspotFetchJson } from "./hubspot";
import { fetchArticleLooks } from "./eshopActivity";

export type ArticleRow = {
  id: string;
  articleNumber: string | null;
  description: string | null;
  articleType: string | null;
  mainGroup: string | null;
  subGroup: string | null;
  stock: number | null;
  stockUnit: string | null;
  /** P&P profit_center: DT, KT, FT, AT, ST, PW. */
  profitCentre: string | null;
  /** P&P sales_unit, as stored - the unit quantities are asked and ordered in. Never guessed. */
  salesUnit: string | null;
  /**
   * Bought this year to date, from the Articles CY/LY report (each order once):
   * how many customers, how much in all, and how much each on average - one
   * customer taking a lot reads very differently from many taking a little.
   */
  buyersYtd: number | null;
  qtyYtd: number | null;
  qtyPerBuyer: number | null;
  /** ERP: how many orders carried this article. Complete. */
  orders: number | null;
  /** ERP: how many distinct companies ordered it. */
  companies: number | null;
  /** Times the shop reported this article being priced. Null when never seen. */
  views: number | null;
  /** How many distinct customers that was. */
  lookedBy: number | null;
  /** How many of those looks went on to the cart. */
  carts: number | null;
  /** The largest quantity anyone priced it at. */
  topQty: number | null;
  /** When it was last looked at, "YYYY-MM-DDTHH:MM". */
  lastLooked: string | null;
};

export type ArticleActivity = {
  /** The day this year's buying runs to; null when the Articles report has not been built. */
  boughtAsOf: string | null;
  rows: ArticleRow[];
  total: number | null;
  /** Null now that views come from the shop itself rather than a GA4 window. */
  viewsFrom: string | null;
  viewsTo: string | null;
  viewsError: string | null;
  generatedAt: string;
  /** Cursor for the next page, or null at the end of the result set. */
  after: string | null;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

const PROPERTIES = [
  "article_number", "article_description", "product_description", "article_type",
  "main_group_description", "sub_group_description",
  "stock_quantity", "stock_unit", "order_article_count", "company_article_count", "profit_center", "sales_unit",
];

/** article -> this year's buying, rebuilt only when a newer report exists. */
let boughtIndex: { generated: string; asOf: string; byArticle: Map<string, { buyers: number; qty: number }> } | null = null;
async function boughtThisYear(): Promise<typeof boughtIndex> {
  const report = await loadReport();
  if (!report) return null;
  if (boughtIndex?.generated === report.generated) return boughtIndex;
  const byArticle = new Map<string, { buyers: number; qty: number }>();
  for (const r of report.rows) byArticle.set(r.article, { buyers: r.customersCy, qty: r.qtyCy });
  boughtIndex = { generated: report.generated, asOf: report.today, byArticle };
  return boughtIndex;
}

export async function fetchArticleActivity(
  params: { search?: string; sort?: "orders" | "companies" | "stock"; pc?: string; limit?: number; after?: string; from?: string; to?: string; signal?: AbortSignal } = {},
): Promise<ArticleActivity> {
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 200);
  const sortProperty =
    params.sort === "companies" ? "company_article_count" : params.sort === "stock" ? "stock_quantity" : "order_article_count";

  const filters: { propertyName: string; operator: string; value?: string }[] = [
    { propertyName: sortProperty, operator: "GT", value: "0" },
  ];
  // One profit centre, filtered by HubSpot so paging and sorting stay right.
  if (params.pc) filters.push({ propertyName: "profit_center", operator: "EQ", value: params.pc });
  // A number search is an article; anything else is matched on the description.
  const search = params.search?.trim();
  if (search) {
    filters.push(
      /^\d+$/.test(search)
        ? { propertyName: "article_number", operator: "CONTAINS_TOKEN", value: `${search}*` }
        : { propertyName: "article_description", operator: "CONTAINS_TOKEN", value: `*${search}*` },
    );
  }

  const res = await hubspotFetchJson<{ total?: number; results?: { id?: string; properties?: Record<string, unknown> }[]; paging?: { next?: { after?: string } } }>({
    path: "/crm/v3/objects/2-200042439/search",
    method: "POST",
    body: {
      filterGroups: [{ filters }],
      properties: PROPERTIES,
      sorts: [{ propertyName: sortProperty, direction: "DESCENDING" }],
      limit,
      after: params.after,
    },
    signal: params.signal,
  });

  // What the shop reported, joined on the article number. A failure here costs
  // the view columns, not the table - the ERP counts are the rest of the screen.
  let looks: Record<string, { views: number; customers: number; carts: number; lastSeen: string | null; topQty: number | null }> = {};
  let viewsError: string | null = null;
  try {
    looks = await fetchArticleLooks(params.signal);
  } catch (err) {
    viewsError = String((err as Error)?.message ?? err);
  }
  // This year's buying. No report yet (or no database) costs these three
  // columns, never the table.
  const bought = await boughtThisYear().catch(() => null);

  const rows: ArticleRow[] = (res.results ?? []).map((r) => {
    const p = r.properties ?? {};
    const articleNumber = str(p.article_number);
    return {
      id: String(r.id ?? ""),
      articleNumber,
      description: str(p.article_description) ?? str(p.product_description),
      articleType: str(p.article_type),
      mainGroup: str(p.main_group_description),
      subGroup: str(p.sub_group_description),
      stock: num(p.stock_quantity),
      stockUnit: str(p.stock_unit),
      profitCentre: str(p.profit_center),
      salesUnit: str(p.sales_unit),
      ...(() => {
        const b = articleNumber ? bought?.byArticle.get(articleNumber) : undefined;
        if (!bought) return { buyersYtd: null, qtyYtd: null, qtyPerBuyer: null };
        if (!b || !b.buyers) return { buyersYtd: 0, qtyYtd: 0, qtyPerBuyer: null };
        return { buyersYtd: b.buyers, qtyYtd: b.qty, qtyPerBuyer: b.qty / b.buyers };
      })(),
      orders: num(p.order_article_count),
      companies: num(p.company_article_count),
      views: articleNumber ? looks[articleNumber]?.views ?? null : null,
      lookedBy: articleNumber ? looks[articleNumber]?.customers ?? null : null,
      carts: articleNumber ? looks[articleNumber]?.carts ?? null : null,
      topQty: articleNumber ? looks[articleNumber]?.topQty ?? null : null,
      lastLooked: articleNumber ? looks[articleNumber]?.lastSeen ?? null : null,
    };
  });

  return {
    rows,
    total: typeof res.total === "number" ? res.total : null,
    viewsFrom: null,
    viewsTo: null,
    viewsError,
    boughtAsOf: bought?.asOf ?? null,
    generatedAt: new Date().toISOString(),
    after: res.paging?.next?.after ?? null,
  };
}
