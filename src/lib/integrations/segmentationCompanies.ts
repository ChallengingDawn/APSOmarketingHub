// SMART SEGMENTATION - the companies behind the tabs (SARCLA 02.11.2026: "in Portfolio put another table with the list of
// companies"; "Profit center should also have KPIs"). Read live from HubSpot's search, a page of 25 at a time: every
// company, narrowed to a segment, a priority, a major profit centre or a split, in the order asked. And the profit-centre
// mix: how many companies hold each value of the two properties, held 3 hours.

import { kvGet, kvSet } from "@/lib/db/init";
import { ownerNames } from "./erosion";
import { hubspotFetchJson } from "./hubspot";
import { enums } from "./segmentation";
import { NO_SEGMENT, PAGE, SEARCH_CAP, SORTS, type CompaniesPage, type CompanyFilter, type PcMix } from "../segmentation/companies";

const year = () => new Date().getUTCFullYear();
const num = (v: string | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));
type Obj = { id: string; properties?: Record<string, string | null> };

export async function companiesPage(f: CompanyFilter): Promise<CompaniesPage> {
  const en = await enums();
  const rev = `revenue_${year()}`;
  const filters: object[] = [];
  const eqOrNone = (prop: string, v: string | undefined, none: string) => {
    if (v === undefined) return;
    filters.push(v === none ? { propertyName: prop, operator: "NOT_HAS_PROPERTY" } : { propertyName: prop, operator: "EQ", value: v });
  };
  eqOrNone("apso_customer", f.seg, NO_SEGMENT);
  // a priority is asked by its first character ("1".."4"); "" = none yet
  if (f.prio !== undefined) filters.push(f.prio === "" ? { propertyName: "sales_priority", operator: "NOT_HAS_PROPERTY" } : { propertyName: "sales_priority", operator: "EQ", value: en.prio[f.prio] ?? f.prio });
  eqOrNone("major_profit_center", f.major, "");
  eqOrNone("profit_center_split", f.split, "");
  const sortProp = f.sort === "revenue" ? rev : SORTS[f.sort ?? "basis"] ?? SORTS.basis;
  const page = Math.max(0, Math.min(Math.floor(f.page ?? 0), Math.floor((SEARCH_CAP - PAGE) / PAGE)));
  const r = await hubspotFetchJson<{ total?: number; results?: Obj[] }>({
    path: "/crm/v3/objects/companies/search", method: "POST",
    body: {
      ...(filters.length ? { filterGroups: [{ filters }] } : {}),
      ...(f.q ? { query: f.q.slice(0, 80) } : {}),
      sorts: [{ propertyName: sortProp, direction: f.dir === "asc" ? "ASCENDING" : "DESCENDING" }],
      properties: ["name", "country", "country_custom", "apso_customer", "sales_priority", "major_profit_center", "profit_center_split", "yearly_customer_potential", "max_pot_or_turnover", "max_revenue_2015_2026", rev, "hubspot_owner_id"],
      limit: PAGE, ...(page ? { after: String(page * PAGE) } : {}),
    },
  });
  const owners = await ownerNames().catch(() => new Map<string, string>());
  return {
    total: r.total ?? 0, page, year: year(),
    rows: (r.results ?? []).map((c) => {
      const p = c.properties ?? {};
      return {
        id: String(c.id), name: p.name ?? "", country: (p.country || p.country_custom || "").trim(), segment: p.apso_customer ?? "", prio: (p.sales_priority ?? "").slice(0, 1),
        major: p.major_profit_center ?? "", split: p.profit_center_split ?? "", potential: num(p.yearly_customer_potential), basis: num(p.max_pot_or_turnover),
        best: num(p.max_revenue_2015_2026), revenue: num(p[rev]), owner: p.hubspot_owner_id ? owners.get(p.hubspot_owner_id) ?? `Owner ${p.hubspot_owner_id}` : "",
      };
    }),
  };
}

const MIX_KEY = "segmentation:pc-mix";
/** the split changes once a night: counted again when older than this, behind the page */
const MIX_FRESH_MS = 3 * 60 * 60_000;
let refreshing: Promise<PcMix> | null = null;

async function count(filters: object[] | null): Promise<number> {
  const r = await hubspotFetchJson<{ total?: number }>({ path: "/crm/v3/objects/companies/search", method: "POST", body: { filterGroups: filters ? [{ filters }] : [], limit: 1, properties: ["name"] } });
  return r.total ?? 0;
}

async function countMix(): Promise<PcMix> {
  const out: PcMix = { at: new Date().toISOString(), total: await count(null), major: [], split: [] };
  for (const [prop, into] of [["major_profit_center", out.major], ["profit_center_split", out.split]] as const) {
    const def = await hubspotFetchJson<{ options?: { value: string }[] }>({ path: `/crm/v3/properties/companies/${prop}` });
    for (const o of def.options ?? []) {
      const n = await count([{ propertyName: prop, operator: "EQ", value: o.value }]);
      if (n) into.push({ value: o.value, n });
    }
    const none = await count([{ propertyName: prop, operator: "NOT_HAS_PROPERTY" }]);
    if (none) into.push({ value: "", n: none });
    into.sort((a, b) => b.n - a.n);
  }
  await kvSet(MIX_KEY, out);
  return out;
}

/**
 * How many companies hold each value of major_profit_center and profit_center_split ("" = none). Kept in the database:
 * the page gets the last count at once, and an older one is counted again behind it (~45 searches) - it used to be held
 * in one server's memory, so every restart and every second copy counted again while the page waited (SARCLA 02.11.2026).
 */
export async function pcMix(fresh = false): Promise<PcMix & { refreshing: boolean }> {
  const kept = await kvGet<PcMix>(MIX_KEY);
  if (fresh || !kept || Date.now() - Date.parse(kept.at) > MIX_FRESH_MS) {
    if (!refreshing) {
      refreshing = countMix().finally(() => { refreshing = null; });
      refreshing.catch((e) => console.warn(`[segmentation] profit-centre mix: ${(e as Error).message}`));
    }
  }
  if (kept) return { ...kept, refreshing: !!refreshing };
  return { ...(await refreshing!), refreshing: false };
}

