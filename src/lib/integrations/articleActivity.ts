// ARTICLE ACTIVITY — the Datatracker's Article tab.
//
// Orders, companies, stock and the assortment tree come from Products & Pricing,
// which the nightly load keeps current: `order_article_count` is filled on
// 130,966 articles and was written this morning. Those are ERP counts, so they
// cover every order whatever anyone chose on the cookie banner.
//
// Views are the one column HubSpot does not carry. The shop counts them on an
// essential-cookie basis and the desktop tracker shows them; nothing loads them
// into Products & Pricing. Until something does, the views here come from GA4's
// item data — consented sessions only, so smaller than the truth — and the
// screen labels them as such rather than passing them off as the real count.

import { hubspotFetchJson } from "./hubspot";
import { fetchGa4Report } from "./ga4Reports";

export type ArticleRow = {
  id: string;
  articleNumber: string | null;
  description: string | null;
  articleType: string | null;
  mainGroup: string | null;
  subGroup: string | null;
  stock: number | null;
  stockUnit: string | null;
  /** ERP: how many orders carried this article. Complete. */
  orders: number | null;
  /** ERP: how many distinct companies ordered it. */
  companies: number | null;
  /** GA4, consented sessions only. Null when GA4 has no row for it. */
  views: number | null;
};

export type ArticleActivity = {
  rows: ArticleRow[];
  total: number | null;
  /** The window the GA4 view column covers; the ERP columns are all-time counts. */
  viewsFrom: string | null;
  viewsTo: string | null;
  viewsError: string | null;
  generatedAt: string;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

const PROPERTIES = [
  "article_number", "article_description", "product_description", "article_type",
  "main_group_description", "sub_group_description",
  "stock_quantity", "stock_unit", "order_article_count", "company_article_count",
];

export async function fetchArticleActivity(
  params: { search?: string; sort?: "orders" | "companies" | "stock"; limit?: number; from?: string; to?: string; signal?: AbortSignal } = {},
): Promise<ArticleActivity> {
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 200);
  const sortProperty =
    params.sort === "companies" ? "company_article_count" : params.sort === "stock" ? "stock_quantity" : "order_article_count";

  const filters: { propertyName: string; operator: string; value?: string }[] = [
    { propertyName: sortProperty, operator: "GT", value: "0" },
  ];
  // A number search is an article; anything else is matched on the description.
  const search = params.search?.trim();
  if (search) {
    filters.push(
      /^\d+$/.test(search)
        ? { propertyName: "article_number", operator: "CONTAINS_TOKEN", value: `${search}*` }
        : { propertyName: "article_description", operator: "CONTAINS_TOKEN", value: `*${search}*` },
    );
  }

  const res = await hubspotFetchJson<{ total?: number; results?: { id?: string; properties?: Record<string, unknown> }[] }>({
    path: "/crm/v3/objects/2-200042439/search",
    method: "POST",
    body: {
      filterGroups: [{ filters }],
      properties: PROPERTIES,
      sorts: [{ propertyName: sortProperty, direction: "DESCENDING" }],
      limit,
    },
    signal: params.signal,
  });

  // GA4's item rows, joined on the article number. A failure here costs the one
  // column, not the table — the ERP counts are the point of this screen.
  let views = new Map<string, number>();
  let viewsError: string | null = null;
  let viewsFrom: string | null = null;
  let viewsTo: string | null = null;
  try {
    const to = params.to ?? new Date().toISOString().slice(0, 10);
    const from = params.from ?? new Date(Date.parse(`${to}T00:00:00Z`) - 89 * 86_400_000).toISOString().slice(0, 10);
    const report = await fetchGa4Report({ name: "itemActivity", from, to, signal: params.signal });
    views = new Map(report.rows.map((r) => [String(r.keys[0] ?? ""), r.values[0] ?? 0]));
    viewsFrom = from;
    viewsTo = to;
  } catch (err) {
    viewsError = String((err as Error)?.message ?? err);
  }

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
      orders: num(p.order_article_count),
      companies: num(p.company_article_count),
      views: articleNumber ? views.get(articleNumber) ?? null : null,
    };
  });

  return {
    rows,
    total: typeof res.total === "number" ? res.total : null,
    viewsFrom,
    viewsTo,
    viewsError,
    generatedAt: new Date().toISOString(),
  };
}
