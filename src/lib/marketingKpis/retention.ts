// RETAIN & GROW - RETENTION, the read (the rules are in retentionCube.ts). SARCLA's retention workbook
// (Desktop\Retention_breakdown.xlsx) was read once, by hand, on 30.08.2026; this reads the same, every day:
//   companies   every company (the list API, ~600 pages): its revenue each year since 2015 (this year's from its
//               monthly figures too), first order year, owner, priority, segment, country, APIC
//   orders      the base year's order documents (search, month by month): how many orders, which profit
//               centres, cut-to-size, specials, from the shop or the ERP, the margin
//   tickets     with their companies: demand, problem, delivery in the base year; sales and erosion since its January
//   activities  calls, meetings, visits and e-mails sent since January of the base year (list with companies)
//   contacts    every contact's company, marketing status and persona
// About a quarter of an hour; read again every 24 hours, the page shows the last read meanwhile. Read-only.
// Companies and orders must be read whole (a partial scan reads as lost customers); tickets, activities and
// contacts that fail are named on the page and left empty.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { read } from "@/lib/lifecycle/read";
import { monthTotal, parsePcMonthly } from "@/lib/reporting/esoRules";
import { ACTIVE_MIN, RETENTION_SHAPE, baseOf, type OwnerInfo, type RCo, type RetentionRaw } from "./retentionCube";

const KEY = "marketingKpis:retention:v1";
const TTL_MS = 24 * 60 * 60 * 1000;
const RETRY_FAILED_MS = 60 * 60 * 1000;
const FIRST_YEAR = 2015;
const VISIT_OBJ = "2-139767037";
/** Back Office, GQS, E-Commerce - problems; ESO, TSA, Special Prices, Product Management - sales */
const PROBLEM = new Set(["1726786777", "1726786775", "1726786778"]);
const SALES = new Set(["1726599376", "1726599377", "1553929403", "1737150687"]);

export function retentionData(): Promise<SlowState<RetentionRaw>> {
  return slowReport(KEY, (v: RetentionRaw) => ((v?.shape ?? 0) < RETENTION_SHAPE ? 0 : Object.keys(v?.errors ?? {}).length ? RETRY_FAILED_MS : TTL_MS), buildRetention);
}

type Obj = { id: string; properties?: Record<string, string | null>; associations?: { companies?: { results?: { id: string }[] } } };
type Page = { results?: Obj[]; paging?: { next?: { after?: string } }; total?: number };
const num = (v: unknown) => { const n = Number(v); return v == null || v === "" || !Number.isFinite(n) ? null : n; };
const companiesOf = (o: Obj) => [...new Set((o.associations?.companies?.results ?? []).map((x) => String(x.id)))];

/** Every record of an object, page by page (the list API: no search cap, not the throttled search). */
async function listAll(object: string, props: string[], withCompanies: boolean, label: string, each: (o: Obj) => void): Promise<number> {
  let after: string | undefined, n = 0;
  for (;;) {
    const qs = `limit=100&archived=false&properties=${props.join(",")}${withCompanies ? "&associations=companies" : ""}${after ? `&after=${encodeURIComponent(after)}` : ""}`;
    const r = await read<Page>({ path: `/crm/v3/objects/${object}?${qs}` });
    for (const o of r.results ?? []) { each(o); n++; }
    if (n % 5000 < 100) reportProgress(KEY, `reading ${label}: ${n.toLocaleString("en")} so far`);
    after = r.paging?.next?.after;
    if (!after) return n;
  }
}

/** Orders dated in [from, to), searched; a window over HubSpot's 10,000 cap is read in two halves. */
async function searchOrders(from: number, to: number, props: string[], each: (p: Record<string, string | null>) => void): Promise<void> {
  let after: string | undefined;
  for (let page = 0; ; page++) {
    const r = await read<Page>({
      path: "/crm/v3/objects/orders/search", method: "POST",
      body: {
        filterGroups: [{ filters: [
          { propertyName: "order_order_date", operator: "GTE", value: String(from) },
          { propertyName: "order_order_date", operator: "LT", value: String(to) },
        ] }],
        properties: props, limit: 200, ...(after ? { after } : {}),
      },
    });
    if (page === 0 && (r.total ?? 0) > 9_800) {
      if (to - from <= 86_400_000) throw new Error(`Orders of ${new Date(from).toISOString().slice(0, 10)}: ${r.total} in one day, over the search cap.`);
      const mid = from + Math.floor((to - from) / 2 / 86_400_000) * 86_400_000;
      await searchOrders(from, mid, props, each);
      await searchOrders(mid, to, props, each);
      return;
    }
    for (const x of r.results ?? []) each(x.properties ?? {});
    after = r.paging?.next?.after;
    if (!after) return;
  }
}

/** The owners - those who left too - and the team each belongs to. */
async function ownersOf(): Promise<Record<string, OwnerInfo>> {
  const out: Record<string, OwnerInfo> = {};
  for (const archived of [false, true]) {
    let after: string | undefined;
    do {
      const j: { results?: { id: string; firstName?: string; lastName?: string; email?: string; teams?: { name?: string }[] }[]; paging?: { next?: { after?: string } } } =
        await hubspotFetchJson({ path: `/crm/v3/owners?limit=100&archived=${archived}${after ? `&after=${after}` : ""}` });
      for (const o of j.results ?? []) {
        if (out[String(o.id)]) continue;
        const teams = (o.teams ?? []).map((t) => t.name ?? "");
        const team = teams.includes("ESO") ? "ESO - field sales" : teams.includes("TSA") ? "TSA - inside sales" : teams.some((t) => /back ?office/i.test(t)) ? "Back Office" : "No team";
        out[String(o.id)] = { n: [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || String(o.id), team, left: archived };
      }
      after = j.paging?.next?.after;
    } while (after);
  }
  return out;
}

export async function buildRetention(): Promise<RetentionRaw> {
  const today = new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));
  const { base, next } = baseOf(today);
  const years = Array.from({ length: year - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
  const from = `${base}-01-01`, baseEnd = `${base + 1}-01-01`;
  const errors: Record<string, string> = {};
  const counts: Record<string, number> = {};

  reportProgress(KEY, "reading the owners");
  const owners = await ownersOf();

  // the companies: revenue each year, and where each one sits
  const props = ["company_unique_number", "hubspot_owner_id", "sales_priority", "apso_customer", "yearly_customer_potential", "apic_ap", "country_custom", "compass_first_order_year",
    ...years.map((y) => `revenue_${y}`), `rev_${year}_pc_monthly`];
  const cos = new Map<string, RCo>();
  const byUn = new Map<string, RCo>();
  counts.companies = await listAll("companies", props, false, "the companies", (o) => {
    const p = o.properties ?? {};
    const r = years.map((y) => Math.round(num(p[`revenue_${y}`]) ?? 0));
    // this year: the monthly figures as well (the yearly one is not always written yet)
    const blob = parsePcMonthly(p[`rev_${year}_pc_monthly`]);
    const months = blob.reduce((a, _, m) => a + monthTotal(blob, m), 0);
    r[r.length - 1] = Math.max(r[r.length - 1], Math.round(months));
    if (!r.some((v) => v >= ACTIVE_MIN)) return;
    const f = num(p.compass_first_order_year);
    const c: RCo = { id: o.id, o: p.hubspot_owner_id ?? "", p: p.sales_priority ?? "", s: p.apso_customer ?? "", k: (p.country_custom ?? "").trim(), a: p.apic_ap ?? "", pot: num(p.yearly_customer_potential), f: f == null ? null : Math.round(f), r };
    cos.set(o.id, c);
    const u = (p.company_unique_number ?? "").trim();
    if (u) byUn.set(u, c);
  });

  // the base year's orders
  const beh = new Map<RCo, { n: Set<string>; pcs: Set<string>; c2s: number; sp: number; web: number; erp: number; gm: number[] }>();
  let orders = 0;
  const oProps = ["order_mandant", "order_customer_number", "order_order_type", "order_order_number", "order_order_date", "cuttosize_order", "order_avg_gm_pct", "order_has_special_articles", "order_order_source", "order_profit_center"];
  for (let m = 0; m < 12; m++) {
    reportProgress(KEY, `reading the orders of ${base} · ${base}-${String(m + 1).padStart(2, "0")} · ${orders.toLocaleString("en")} so far`);
    await searchOrders(Date.UTC(base, m, 1), Date.UTC(base, m + 1, 1), oProps, (o) => {
      orders++;
      if (o.order_order_type === "Credit note") return;
      const c = byUn.get(`${(o.order_mandant ?? "").trim()}-${(o.order_customer_number ?? "").trim()}`);
      if (!c) return;
      let b = beh.get(c);
      if (!b) { b = { n: new Set(), pcs: new Set(), c2s: 0, sp: 0, web: 0, erp: 0, gm: [] }; beh.set(c, b); }
      const no = String(o.order_order_number ?? "").replace(/\.\d{3}$/, "");
      if (no && !b.n.has(no)) { b.n.add(no); if (o.order_order_source === "eShop") b.web++; else b.erp++; }
      if (o.order_profit_center) b.pcs.add(o.order_profit_center);
      if (String(o.cuttosize_order).toLowerCase() === "true") b.c2s = 1;
      if (String(o.order_has_special_articles).toLowerCase() === "true") b.sp = 1;
      const g = num(o.order_avg_gm_pct);
      if (g != null) b.gm.push(g);
    });
  }
  counts.orders = orders;
  for (const [c, b] of beh) c.b = { n: b.n.size, pcs: [...b.pcs], c2s: b.c2s, sp: b.sp, web: b.web, erp: b.erp, gm: b.gm.length ? Math.round(b.gm.reduce((a, x) => a + x, 0) / b.gm.length) : null };

  // the base year's tickets
  try {
    counts.tickets = await listAll("tickets", ["createdate", "hs_pipeline", "hs_ticket_category", "enquiry_category", "erosion_key"], true, "the tickets", (o) => {
      const p = o.properties ?? {};
      // sales and erosion tickets are a sales touch, since January of the base year like the calls; demand and
      // problem tickets count in the base year only (one of this year follows an order of this year)
      const day = p.createdate ?? "";
      if (day < from) return;
      const inBase = day < baseEnd;
      const cat = `${p.enquiry_category ?? ""};${p.hs_ticket_category ?? ""}`, pipe = String(p.hs_pipeline ?? "");
      for (const id of companiesOf(o)) {
        const c = cos.get(id);
        if (!c) continue;
        c.t ??= { dem: 0, prob: 0, del: 0, sales: 0, ero: 0 };
        if (p.erosion_key) c.t.ero++;
        else if (SALES.has(pipe)) c.t.sales++;
        if (inBase && PROBLEM.has(pipe)) { c.t.prob++; if (/Delivery/.test(cat)) c.t.del++; }
        if (inBase && /Product Price|Product Information/.test(cat)) c.t.dem++;
      }
    });
  } catch (e) { errors.tickets = String((e as Error)?.message ?? e).slice(0, 200); }

  // calls, meetings, visits, e-mails sent - since January of the base year
  const ownerActs: RetentionRaw["ownerActs"] = {};
  const oa = (o: string) => (ownerActs[o] ??= { calls: 0, em: 0, mtg: 0 });
  const touch = (o: Obj, owner: string, f: (x: NonNullable<RCo["x"]>) => void) => {
    for (const id of companiesOf(o)) {
      const c = cos.get(id);
      if (!c) continue;
      c.x ??= { calls: 0, out: 0, inb: 0, mtg: 0, vis: 0, em: 0, by: [] };
      f(c.x);
      if (owner && !c.x.by.includes(owner)) c.x.by.push(owner);
    }
  };
  const step = async (name: string, f: () => Promise<number>) => { try { counts[name] = await f(); } catch (e) { errors[name] = String((e as Error)?.message ?? e).slice(0, 200); } };
  await step("calls", () => listAll("calls", ["hs_timestamp", "hs_call_direction", "hubspot_owner_id"], true, "the calls", (o) => {
    const p = o.properties ?? {};
    if ((p.hs_timestamp ?? "") < from) return;
    const owner = p.hubspot_owner_id ?? "";
    if (owner) oa(owner).calls++;
    touch(o, owner, (x) => { x.calls++; if (p.hs_call_direction === "INBOUND") x.inb++; else x.out++; });
  }));
  await step("meetings", () => listAll("meetings", ["hs_timestamp", "hubspot_owner_id"], true, "the meetings", (o) => {
    const p = o.properties ?? {};
    if ((p.hs_timestamp ?? "") < from) return;
    const owner = p.hubspot_owner_id ?? "";
    if (owner) oa(owner).mtg++;
    touch(o, owner, (x) => { x.mtg++; });
  }));
  await step("visits", () => listAll(VISIT_OBJ, ["meeting_date_with_time", "hs_createdate", "hubspot_owner_id"], true, "the visits", (o) => {
    const p = o.properties ?? {};
    if ((p.meeting_date_with_time ?? p.hs_createdate ?? "") < from) return;
    const owner = p.hubspot_owner_id ?? "";
    if (owner) oa(owner).mtg++;
    touch(o, owner, (x) => { x.vis++; });
  }));
  await step("emails", () => listAll("emails", ["hs_timestamp", "hs_email_direction", "hubspot_owner_id"], true, "the e-mails", (o) => {
    const p = o.properties ?? {};
    if ((p.hs_timestamp ?? "") < from || p.hs_email_direction !== "EMAIL") return;
    const owner = p.hubspot_owner_id ?? "";
    if (owner) oa(owner).em++;
    touch(o, owner, (x) => { x.em++; });
  }));

  // contacts: marketing status and persona, on their company
  const personas: Record<string, string> = {};
  const per = new Map<RCo, Map<string, number>>();
  await step("contacts", async () => {
    try {
      const j: { options?: { value: string; label: string }[] } = await hubspotFetchJson({ path: "/crm/v3/properties/contacts/hs_persona" });
      for (const o of j.options ?? []) personas[o.value] = o.label;
    } catch { /* the codes stay */ }
    return listAll("contacts", ["associatedcompanyid", "hs_marketable_status", "hs_persona"], false, "the contacts", (o) => {
      const p = o.properties ?? {};
      const c = cos.get(String(p.associatedcompanyid ?? ""));
      if (!c) return;
      c.c ??= { n: 0, mkt: 0, per: null };
      c.c.n++;
      if (String(p.hs_marketable_status) === "true") c.c.mkt++;
      if (p.hs_persona) { let m = per.get(c); if (!m) { m = new Map(); per.set(c, m); } m.set(p.hs_persona, (m.get(p.hs_persona) ?? 0) + 1); }
    });
  });
  for (const [c, m] of per) c.c!.per = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];

  return { years, base, next, asOf: today, readAt: new Date().toISOString(), owners, personas, ownerActs, cos: [...cos.values()], counts, errors, shape: RETENTION_SHAPE };
}
