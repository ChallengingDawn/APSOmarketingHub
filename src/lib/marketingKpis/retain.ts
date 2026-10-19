// RETAIN & GROW - the read (the rules are in retainCube.ts). Every order document in HubSpot from January
// five years ago to today, month by month, summed per customer and article as it comes in (350,000
// documents - never held at once): the invoiced revenue of each year, of the last 12 months, and the open
// orders. Kept: the lines whose best year reached EUR 2,500, with their customer's name, owner and
// country. A quarter of an hour; read again every 24 hours in the background (leadsWarm.ts), the page
// shows the last read meanwhile. Read-only. A page that fails stops the read - a scan cut short would
// show every article of the missing month as unsold (feedback: a partial scan reads as a data gap).

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { read } from "@/lib/lifecycle/read";
import fixmapJson from "@/lib/erosion/article_fixmap.json";
import type { FixMap } from "@/lib/erosion/detector";
import { RETAIN_SHAPE, addOrder, finish, newAcc, type RetainData } from "./retainCube";

const KEY = "marketingKpis:retain:v1";
const TTL_MS = 24 * 60 * 60 * 1000;
const RETRY_FAILED_MS = 60 * 60 * 1000;
const FIXMAP = fixmapJson as unknown as FixMap;
const PROPS = [
  "order_order_number", "order_order_date", "order_positions_json", "order_mandant", "order_customer_number",
  "order_order_type", "order_order_status", "order_invoice_date",
];

export function retainData(): Promise<SlowState<RetainData>> {
  return slowReport(KEY, (v: RetainData) => ((v?.shape ?? 0) < RETAIN_SHAPE ? 0 : Object.keys(v?.errors ?? {}).length ? RETRY_FAILED_MS : TTL_MS), buildRetain);
}

type Page = { total?: number; results?: { id: string; properties?: Record<string, unknown> }[]; paging?: { next?: { after?: string } } };

/** Every order dated in [from, to) into the sums; a window over HubSpot's 10,000 cap is read in two halves. */
async function scan(from: number, to: number, each: (p: Record<string, unknown>) => void): Promise<void> {
  let after: string | undefined;
  for (let page = 0; ; page++) {
    const r = await read<Page>({
      path: "/crm/v3/objects/orders/search", method: "POST",
      body: {
        filterGroups: [{ filters: [
          { propertyName: "order_order_date", operator: "GTE", value: String(from) },
          { propertyName: "order_order_date", operator: "LT", value: String(to) },
        ] }],
        properties: PROPS, limit: 200, ...(after ? { after } : {}),
      },
    });
    if (page === 0 && (r.total ?? 0) > 9_800) {
      if (to - from <= 86_400_000) throw new Error(`Orders of ${new Date(from).toISOString().slice(0, 10)}: ${r.total} in one day, over the search cap.`);
      const mid = from + Math.floor((to - from) / 2 / 86_400_000) * 86_400_000;
      await scan(from, mid, each);
      await scan(mid, to, each);
      return;
    }
    for (const x of r.results ?? []) each(x.properties ?? {});
    after = r.paging?.next?.after;
    if (!after) return;
  }
}

/** The owners' names - and those who left, marked so (their customers keep them as owner). */
async function ownerNames(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const archived of [false, true]) {
    let after: string | undefined;
    do {
      const j: { results?: { id: string; firstName?: string; lastName?: string; email?: string }[]; paging?: { next?: { after?: string } } } =
        await hubspotFetchJson({ path: `/crm/v3/owners?limit=100&archived=${archived}${after ? `&after=${after}` : ""}` });
      for (const o of j.results ?? []) {
        const name = [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || String(o.id);
        out[String(o.id)] ??= archived ? `${name} (left)` : name;
      }
      after = j.paging?.next?.after;
    } while (after);
  }
  return out;
}

/** The read itself (exported for a local check; the page goes through retainData). */
export async function buildRetain(): Promise<RetainData> {
  const today = new Date().toISOString().slice(0, 10);
  const acc = newAcc(today);
  const errors: Record<string, string> = {};

  // month by month, from January of the first of the five years to today
  let y = acc.w.years[0], m = 0;
  const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1];
  while (y < ty || (y === ty && m <= tm)) {
    const [ny, nm] = m === 11 ? [y + 1, 0] : [y, m + 1];
    reportProgress(KEY, `reading the orders · ${y}-${String(m + 1).padStart(2, "0")} · ${acc.orders.toLocaleString("en")} so far`);
    await scan(Date.UTC(y, m, 1), Date.UTC(ny, nm, 1), (p) => addOrder(acc, p, FIXMAP));
    [y, m] = [ny, nm];
  }
  const lines = finish(acc);

  // the customers: name, owner and country, by the mandant-customer number
  reportProgress(KEY, "reading the customers");
  const companies: RetainData["companies"] = {};
  const uns = [...new Set(lines.map((l) => l.u))];
  try {
    for (let i = 0; i < uns.length; i += 100) {
      let after: string | undefined;
      do {
        const r = await read<{ results?: { id: string; properties?: Record<string, string | null> }[]; paging?: { next?: { after?: string } } }>({
          path: "/crm/v3/objects/companies/search", method: "POST",
          body: {
            filterGroups: [{ filters: [{ propertyName: "company_unique_number", operator: "IN", values: uns.slice(i, i + 100) }] }],
            properties: ["name", "hubspot_owner_id", "company_unique_number", "country_custom", "country"],
            sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 100, ...(after ? { after } : {}),
          },
        });
        for (const c of r.results ?? []) {
          const p = c.properties ?? {};
          const un = (p.company_unique_number ?? "").trim();
          if (un) companies[un] = { n: p.name ?? "", o: (p.hubspot_owner_id ?? "").trim(), k: (p.country_custom || p.country || "").trim() || "Unknown", id: c.id };
        }
        after = r.paging?.next?.after;
      } while (after);
    }
  } catch (e) {
    errors.companies = String((e as Error)?.message ?? e).slice(0, 200);
  }

  let owners: Record<string, string> = {};
  try { owners = await ownerNames(); } catch (e) { errors.owners = String((e as Error)?.message ?? e).slice(0, 200); }

  const articles: RetainData["articles"] = {};
  for (const l of lines) articles[l.a] ??= acc.articles.get(l.a) ?? { t: "", p: "" };

  return {
    lines, years: acc.w.years, articles, companies, owners, asOf: today, readAt: new Date().toISOString(),
    orders: acc.orders, noCustomer: acc.noCustomer, errors, shape: RETAIN_SHAPE,
  };
}
