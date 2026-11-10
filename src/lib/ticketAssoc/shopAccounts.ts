// SHOP ACCOUNTS WITHOUT A COMPANY - the read and the link (the rules are in shopAccountRules.ts).
// Read: HubSpot contacts with a shop customer id and no company, each with the companies its orders
// are booked on (the ERP's customer - SARCLA 19.10: "if they have an order we can also link easily")
// and the companies of its e-mail domain. Link: one contact to the company a person picked, as its PRIMARY company (so its
// logins and orders count for that company) - only on that person's click; the hub never links or
// creates a company by itself (SARCLA: orders and companies, a person decides).

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { owners } from "@/lib/integrations/eshopActivity";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { kvGet, kvSet } from "@/lib/db/init";
import { locked } from "@/lib/ticketDuplicates/reads";
import { INTERNAL, industryOf, kindOf, rankCandidates, shopNumberOf, storeOf, withOrderCompanies, type Candidate, type Unlinked, type UnlinkedRow } from "./shopAccountRules";

// v2: the companies their orders are booked on (19.10); v3: who each person is, their orders (19.10); v4: the shop's own
// record, the web visits, the shop account's customer number and who each offered company is (10.11.2026)
const KEY = "ticketAssoc:shopAccounts:v4";
/** What a person needs to judge an offered company: its customer number, place, owner, last order, revenue. */
const CANDIDATE_PROPS = ["name", "country", "domain", "erp_customer_id", "mandant", "zip", "city", "hubspot_owner_id", "order_last_order_date", "erp_rev_ytd_cy"];
const LINKS = "ticketAssoc:shopLinks:v1";
/** One "Link all" at a time, across both copies of the hub. */
const LINK_ALL_LOCK = 4_107_282;
const TTL_MS = 10 * 60 * 1000;

type Obj = { id: string; properties: Record<string, string | null> };
type Page = { results?: Obj[]; paging?: { next?: { after?: string } } };

/** Every shop account without a company, with the companies on its e-mail domain. */
export async function unlinkedAccounts(year = new Date().getUTCFullYear(), progressKey?: string): Promise<Unlinked> {
  const since = Date.UTC(year, 0, 1);
  const all: Obj[] = [];
  let after: string | undefined;
  do {
    const r = await hubspotFetchJson<Page>({
      path: "/crm/v3/objects/contacts/search", method: "POST",
      body: {
        filterGroups: [{ filters: [{ propertyName: "eyemagine_customer_id", operator: "HAS_PROPERTY" }, { propertyName: "associatedcompanyid", operator: "NOT_HAS_PROPERTY" }] }],
        properties: ["hs_email_domain", "company", "country", "createdate", "hs_analytics_last_visit_timestamp",
          "firstname", "lastname", "email", "phone", "mobilephone", "jobtitle", "address", "zip", "city", "hubspot_owner_id",
          // the shop's own record and HubSpot's tracking (10.11.2026)
          "hs_language", "eyemagine_lifetime_customer_since", "eyemagine_created_in", "eyemagine_last_login_at", "eyemagine_lifetime_order_total_sum",
          "eyemagine_erp_customer_id", "eyemagine_lifetime_purchased_product_name_1", "eyemagine_industry",
          "hs_analytics_num_visits", "hs_analytics_num_page_views", "hs_analytics_source"],
        sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
        limit: 100, ...(after ? { after } : {}),
      },
    });
    all.push(...(r.results ?? []));
    after = r.paging?.next?.after;
  } while (after && all.length < 3000);

  const dom = (c: Obj) => (c.properties.hs_email_domain ?? "").trim().toLowerCase();
  const people = all.filter((c) => !INTERNAL.test(dom(c)));
  const business = [...new Set(people.map(dom).filter((d) => d && kindOf(d, false) === "business"))];
  // the companies on each domain (a hundred domains a search)
  const byDomain: Record<string, Candidate[]> = {};
  for (let i = 0; i < business.length; i += 100) {
    if (progressKey) reportProgress(progressKey, `companies for the e-mail domains ${i + 1}-${Math.min(i + 100, business.length)} of ${business.length}`);
    let next: string | undefined, pages = 0;
    do {
      const r = await hubspotFetchJson<Page>({
        path: "/crm/v3/objects/companies/search", method: "POST",
        body: { filterGroups: [{ filters: [{ propertyName: "domain", operator: "IN", values: business.slice(i, i + 100) }] }], properties: ["domain", "name", "country"], limit: 100, ...(next ? { after: next } : {}) },
      });
      for (const c of r.results ?? []) {
        const list = (byDomain[(c.properties.domain ?? "").toLowerCase()] ??= []);
        if (list.length < 12) list.push({ id: c.id, name: c.properties.name ?? c.id, country: c.properties.country ?? "" });
      }
      next = r.paging?.next?.after;
    } while (next && ++pages < 10);
  }
  // the company of the customer number the shop account carries (10.11.2026: 115 of 523 carry one, 27 numbers name one company)
  if (progressKey) reportProgress(progressKey, "the customer numbers of their shop accounts");
  const numbers = [...new Set(people.map((c) => shopNumberOf(c.properties.eyemagine_erp_customer_id)).filter((x): x is string => !!x))];
  const byNumber = new Map<string, Candidate[]>();
  for (let i = 0; i < numbers.length; i += 100) {
    const r = await hubspotFetchJson<Page>({
      path: "/crm/v3/objects/companies/search", method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: "erp_customer_id", operator: "IN", values: numbers.slice(i, i + 100) }] }], properties: ["name", "country", "erp_customer_id"], limit: 100 },
    });
    for (const c of r.results ?? []) {
      const n = String(c.properties.erp_customer_id ?? "").trim();
      (byNumber.get(n) ?? byNumber.set(n, []).get(n)!).push({ id: c.id, name: c.properties.name ?? c.id, country: c.properties.country ?? "", why: "number" });
    }
  }
  // the companies each contact's orders are booked on (19.10: 56 of 609 have orders, 305 of their 308 orders on a company)
  if (progressKey) reportProgress(progressKey, "reading their orders");
  const { companies: fromOrders, orders: ordersOf } = await orderCompanies(people.map((c) => c.id));
  const ownerName = await owners().catch(() => new Map<string, string>());
  const num = (x: string | null | undefined) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
  const day = (x: string | null | undefined) => (x ? String(x).slice(0, 10) : null);
  const rows: UnlinkedRow[] = people.map((c) => {
    const d = dom(c);
    const typed = (c.properties.company ?? "").trim();
    const own = fromOrders.get(c.id) ?? [];
    const shopNumber = shopNumberOf(c.properties.eyemagine_erp_customer_id);
    const numbered = shopNumber ? byNumber.get(shopNumber) ?? [] : [];
    const candidates = withOrderCompanies(own, rankCandidates(typed, byDomain[d] ?? []), numbered);
    return {
      id: c.id, company: typed, domain: d, country: (c.properties.country ?? "").trim(), created: (c.properties.createdate ?? "").slice(0, 10),
      kind: kindOf(d, candidates.length > 0), candidates,
      match: candidates.length ? { id: candidates[0].id, name: candidates[0].name, more: candidates.length - 1 } : null,
      byOrder: own.length === 1,
      byNumber: !own.length && numbered.length === 1,
      person: {
        name: [c.properties.firstname, c.properties.lastname].map((x) => (x ?? "").trim()).filter(Boolean).join(" "),
        email: (c.properties.email ?? "").trim(), phone: (c.properties.phone || c.properties.mobilephone || "").trim(), jobtitle: (c.properties.jobtitle ?? "").trim(),
        address: (c.properties.address ?? "").trim(), zip: (c.properties.zip ?? "").trim(), city: (c.properties.city ?? "").trim(),
        owner: ownerName.get(String(c.properties.hubspot_owner_id ?? "")) ?? "",
        language: (c.properties.hs_language ?? "").trim() || undefined,
      },
      orders: ordersOf.get(c.id) ?? { n: 0, last: null },
      shop: {
        since: day(c.properties.eyemagine_lifetime_customer_since), store: storeOf(c.properties.eyemagine_created_in),
        lastLogin: day(c.properties.eyemagine_last_login_at), value: Math.round(num(c.properties.eyemagine_lifetime_order_total_sum)),
        number: shopNumber, products: (c.properties.eyemagine_lifetime_purchased_product_name_1 ?? "").split("|").map((x) => x.trim()).filter(Boolean).slice(0, 3).join(" · ") || null,
        industry: industryOf(c.properties.eyemagine_industry),
      },
      web: { visits: num(c.properties.hs_analytics_num_visits), views: num(c.properties.hs_analytics_num_page_views), lastVisit: day(c.properties.hs_analytics_last_visit_timestamp), source: (c.properties.hs_analytics_source ?? "").trim() || null },
    };
  });
  // who each offered company is - its customer number, place, owner, last order, revenue (10.11.2026)
  if (progressKey) reportProgress(progressKey, "the companies offered");
  const offered = [...new Set(rows.flatMap((r) => r.candidates.map((c) => c.id)))];
  const about = new Map<string, Record<string, string | null>>();
  for (let i = 0; i < offered.length; i += 100) {
    const r = await hubspotFetchJson<Page>({ path: "/crm/v3/objects/companies/batch/read", method: "POST", body: { inputs: offered.slice(i, i + 100).map((id) => ({ id })), properties: CANDIDATE_PROPS } });
    for (const c of r.results ?? []) about.set(c.id, c.properties);
  }
  for (const r of rows) r.candidates = r.candidates.map((c) => {
    const p = about.get(c.id);
    if (!p) return c;
    return { ...c, name: p.name ?? c.name, country: p.country ?? c.country, erp: (p.erp_customer_id ?? "").trim() || null, mandant: p.mandant ?? null, zip: p.zip ?? null, city: p.city ?? null,
      domain: p.domain ?? null, owner: ownerName.get(String(p.hubspot_owner_id ?? "")) ?? null, lastOrder: day(p.order_last_order_date), revenue: Math.round(num(p.erp_rev_ytd_cy)) };
  });
  for (const r of rows) if (r.match && r.candidates[0]) r.match = { ...r.match, name: r.candidates[0].name };
  const rank = { match: 0, business: 1, free: 2 } as const;
  const sure = (r: UnlinkedRow) => (r.candidates[0]?.orders ? 2 : r.byNumber ? 1 : 0);
  // the surest first: by kind, a company their orders name, then the newest
  rows.sort((a, b) => rank[a.kind] - rank[b.kind] || sure(b) - sure(a) || b.created.localeCompare(a.created));
  return {
    total: people.length, internal: all.length - people.length,
    matched: rows.filter((r) => r.kind === "match").length, withOrders: rows.filter((r) => r.candidates[0]?.orders).length, withNumber: rows.filter((r) => r.byNumber).length,
    business: rows.filter((r) => r.kind === "business").length, free: rows.filter((r) => r.kind === "free").length,
    createdThisYear: people.filter((c) => (c.properties.createdate ?? "") >= `${year}-01-01`).length,
    seenThisYear: people.filter((c) => { const t = Date.parse(c.properties.hs_analytics_last_visit_timestamp ?? ""); return Number.isFinite(t) && t >= since; }).length,
    rows,
  };
}

/** contact -> the companies its orders are booked on (with how many orders each), and its orders: how many, the last one's day. */
async function orderCompanies(contactIds: string[]): Promise<{ companies: Map<string, Candidate[]>; orders: Map<string, { n: number; last: string | null }> }> {
  type Assoc = { results?: { from?: { id?: string }; to?: { toObjectId?: number | string }[] }[] };
  const ordersOf = new Map<string, string[]>();
  for (let i = 0; i < contactIds.length; i += 1000) {
    const r = await hubspotFetchJson<Assoc>({ path: "/crm/v4/associations/contacts/orders/batch/read", method: "POST", body: { inputs: contactIds.slice(i, i + 1000).map((id) => ({ id })) } });
    for (const row of r.results ?? []) if (row.from?.id && row.to?.length) ordersOf.set(row.from.id, row.to.map((t) => String(t.toObjectId)));
  }
  const orders = [...new Set([...ordersOf.values()].flat())];
  const companyOf = new Map<string, string>();
  for (let i = 0; i < orders.length; i += 1000) {
    const r = await hubspotFetchJson<Assoc>({ path: "/crm/v4/associations/orders/companies/batch/read", method: "POST", body: { inputs: orders.slice(i, i + 1000).map((id) => ({ id })) } });
    for (const row of r.results ?? []) if (row.from?.id && row.to?.length) companyOf.set(row.from.id, String(row.to[0].toObjectId));
  }
  // each order's day, for "their last order"
  const dayOf = new Map<string, string>();
  for (let i = 0; i < orders.length; i += 100) {
    const r = await hubspotFetchJson<Page>({ path: "/crm/v3/objects/orders/batch/read", method: "POST", body: { inputs: orders.slice(i, i + 100).map((id) => ({ id })), properties: ["order_order_date"] } });
    for (const o of r.results ?? []) if (o.properties.order_order_date) dayOf.set(o.id, o.properties.order_order_date.slice(0, 10));
  }
  const counts = new Map<string, { n: number; last: string | null }>();
  for (const [contact, list] of ordersOf) {
    const days = list.map((o) => dayOf.get(o)).filter((d): d is string => !!d).sort();
    counts.set(contact, { n: list.length, last: days.length ? days[days.length - 1] : null });
  }
  const ids = [...new Set(companyOf.values())];
  const named = new Map<string, { name: string; country: string }>();
  for (let i = 0; i < ids.length; i += 100) {
    const r = await hubspotFetchJson<Page>({ path: "/crm/v3/objects/companies/batch/read", method: "POST", body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: ["name", "country"] } });
    for (const c of r.results ?? []) named.set(c.id, { name: c.properties.name ?? c.id, country: c.properties.country ?? "" });
  }
  const out = new Map<string, Candidate[]>();
  for (const [contact, list] of ordersOf) {
    const n = new Map<string, number>();
    for (const o of list) { const co = companyOf.get(o); if (co) n.set(co, (n.get(co) ?? 0) + 1); }
    if (n.size) out.set(contact, [...n].map(([id, orders]) => ({ id, name: named.get(id)?.name ?? id, country: named.get(id)?.country ?? "", orders })));
  }
  return { companies: out, orders: counts };
}

/** The tab's read, kept 10 minutes (a link done here is taken off at once, see linked()). */
export function shopAccounts(): Promise<SlowState<Unlinked>> {
  return slowReport(KEY, () => TTL_MS, () => unlinkedAccounts(undefined, KEY));
}

export type LinkDone = { at: string; by: string; contact: string; company: string; companyName: string; typed: string };
/** The links made from the tab, newest first. */
export async function linked(): Promise<LinkDone[]> {
  return (await kvGet<LinkDone[]>(LINKS)) ?? [];
}

/**
 * Link one shop account to the company a person picked - only a company the read offered for that
 * contact (its e-mail domain's), as the contact's primary company (association types 279 + 1).
 */
export async function linkAccount(contactId: string, companyId: string, by: string): Promise<LinkDone> {
  const { done, error } = await linkMany([{ contact: contactId, company: companyId }], by);
  if (!done[0]) throw new Error(error ?? "HubSpot did not link them");
  return done[0];
}

/**
 * "Link all": every account whose orders are all booked on ONE company, to that company - one click
 * for the clear ones (SARCLA 19.10: "if they have an order we can also link easily").
 */
export async function linkAllByOrder(by: string): Promise<{ linked: number; failed: number; error?: string }> {
  // one "Link all" at a time across both copies of the hub (hubspot-orders-3a's review 10.11.2026: two clicks at once both
  // ran, each having read "done" before the other started)
  const out = await locked(LINK_ALL_LOCK, async () => {
    const state = await shopAccounts();
    const done = new Set((await linked()).map((l) => l.contact));
    // since 10.11.2026 also the ones whose shop account's customer number names ONE company and no order says otherwise
    const todo = (state.value?.rows ?? []).filter((r) => (r.byOrder || r.byNumber) && !done.has(r.id)).map((r) => ({ contact: r.id, company: r.candidates[0].id }));
    let n = 0, failed = 0, error: string | undefined;
    for (let i = 0; i < todo.length; i += 100) {
      const part = todo.slice(i, i + 100);
      try {
        const r = await linkMany(part, by);
        n += r.done.length; failed += part.length - r.done.length;
        if (r.error) error = r.error;
      } catch (e) { failed += part.length; error = String((e as Error)?.message ?? e); }
    }
    return { linked: n, failed, ...(error ? { error } : {}) };
  });
  if (!out) throw new Error("Someone is linking all right now - read the list again in a minute");
  return out;
}

/**
 * Link contacts to companies the read offered them, as their primary company; who and when kept. HubSpot can link part
 * of a batch and refuse the rest: the ones it linked are kept as linked here, the refusal comes back as `error`
 * (hubspot-orders-3a's review 10.11.2026: a partly refused batch was recorded as nothing linked).
 */
async function linkMany(pairs: { contact: string; company: string }[], by: string): Promise<{ done: LinkDone[]; error?: string }> {
  const state = await shopAccounts();
  const checked = pairs.map(({ contact, company }) => {
    const row = state.value?.rows.find((r) => r.id === contact);
    const pick = row?.candidates.find((c) => c.id === company);
    if (!row || !pick) throw new Error("That company is not one the hub offered for this contact - read the list again");
    return { row, pick };
  });
  const j = await hubspotFetchJson<{ numErrors?: number; errors?: { message?: string }[]; results?: { fromObjectId?: string | number }[] }>({
    path: "/crm/v4/associations/contacts/companies/batch/create", method: "POST",
    body: { inputs: checked.map(({ row, pick }) => ({ from: { id: row.id }, to: { id: pick.id }, types: [
      { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 279 },
      { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 1 },
    ] })) },
  });
  const refused = Number(j.numErrors ?? 0) > 0;
  // all went through: every pair; partly refused: only the contacts HubSpot answered as linked
  const made = new Set((j.results ?? []).map((x) => String(x.fromObjectId ?? "")));
  const ok = refused ? checked.filter(({ row }) => made.has(row.id)) : checked;
  const at = new Date().toISOString();
  const done: LinkDone[] = ok.map(({ row, pick }) => ({ at, by, contact: row.id, company: pick.id, companyName: pick.name, typed: row.company }));
  if (done.length) await kvSet(LINKS, [...done, ...(await linked())].slice(0, 2000));
  return { done, ...(refused ? { error: String(j.errors?.[0]?.message ?? "HubSpot did not link them") } : {}) };
}
