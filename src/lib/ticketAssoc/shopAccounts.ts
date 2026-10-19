// SHOP ACCOUNTS WITHOUT A COMPANY - the read and the link (the rules are in shopAccountRules.ts).
// Read: HubSpot contacts with a shop customer id and no company, each with the companies its orders
// are booked on (the ERP's customer - SARCLA 19.10: "if they have an order we can also link easily")
// and the companies of its e-mail domain. Link: one contact to the company a person picked, as its PRIMARY company (so its
// logins and orders count for that company) - only on that person's click; the hub never links or
// creates a company by itself (SARCLA: orders and companies, a person decides).

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { kvGet, kvSet } from "@/lib/db/init";
import { INTERNAL, kindOf, rankCandidates, withOrderCompanies, type Candidate, type Unlinked, type UnlinkedRow } from "./shopAccountRules";

// v2: the companies their orders are booked on (19.10)
const KEY = "ticketAssoc:shopAccounts:v2";
const LINKS = "ticketAssoc:shopLinks:v1";
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
        properties: ["hs_email_domain", "company", "country", "createdate", "hs_analytics_last_visit_timestamp"],
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
  // the companies each contact's orders are booked on (19.10: 56 of 609 have orders, 305 of their 308 orders on a company)
  if (progressKey) reportProgress(progressKey, "reading their orders");
  const fromOrders = await orderCompanies(people.map((c) => c.id));
  const rows: UnlinkedRow[] = people.map((c) => {
    const d = dom(c);
    const typed = (c.properties.company ?? "").trim();
    const own = fromOrders.get(c.id) ?? [];
    const candidates = withOrderCompanies(own, rankCandidates(typed, byDomain[d] ?? []));
    return {
      id: c.id, company: typed, domain: d, country: (c.properties.country ?? "").trim(), created: (c.properties.createdate ?? "").slice(0, 10),
      kind: kindOf(d, candidates.length > 0), candidates,
      match: candidates.length ? { id: candidates[0].id, name: candidates[0].name, more: candidates.length - 1 } : null,
      byOrder: own.length === 1,
    };
  });
  const rank = { match: 0, business: 1, free: 2 } as const;
  const sure = (r: UnlinkedRow) => (r.candidates[0]?.orders ? 1 : 0);
  // the surest first: by kind, a company their orders name, then the newest
  rows.sort((a, b) => rank[a.kind] - rank[b.kind] || sure(b) - sure(a) || b.created.localeCompare(a.created));
  return {
    total: people.length, internal: all.length - people.length,
    matched: rows.filter((r) => r.kind === "match").length, withOrders: rows.filter((r) => sure(r)).length,
    business: rows.filter((r) => r.kind === "business").length, free: rows.filter((r) => r.kind === "free").length,
    createdThisYear: people.filter((c) => (c.properties.createdate ?? "") >= `${year}-01-01`).length,
    seenThisYear: people.filter((c) => { const t = Date.parse(c.properties.hs_analytics_last_visit_timestamp ?? ""); return Number.isFinite(t) && t >= since; }).length,
    rows,
  };
}

/** contact -> the companies its orders are booked on, with how many orders each. */
async function orderCompanies(contactIds: string[]): Promise<Map<string, Candidate[]>> {
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
  return out;
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
  const [done] = await linkMany([{ contact: contactId, company: companyId }], by);
  return done;
}

/**
 * "Link all": every account whose orders are all booked on ONE company, to that company - one click
 * for the clear ones (SARCLA 19.10: "if they have an order we can also link easily").
 */
export async function linkAllByOrder(by: string): Promise<{ linked: number; failed: number; error?: string }> {
  const state = await shopAccounts();
  const done = new Set((await linked()).map((l) => l.contact));
  const todo = (state.value?.rows ?? []).filter((r) => r.byOrder && !done.has(r.id)).map((r) => ({ contact: r.id, company: r.candidates[0].id }));
  let n = 0, failed = 0, error: string | undefined;
  for (let i = 0; i < todo.length; i += 100) {
    const part = todo.slice(i, i + 100);
    try { n += (await linkMany(part, by)).length; } catch (e) { failed += part.length; error = String((e as Error)?.message ?? e); }
  }
  return { linked: n, failed, ...(error ? { error } : {}) };
}

/** Link contacts to companies the read offered them, as their primary company; who and when kept. */
async function linkMany(pairs: { contact: string; company: string }[], by: string): Promise<LinkDone[]> {
  const state = await shopAccounts();
  const checked = pairs.map(({ contact, company }) => {
    const row = state.value?.rows.find((r) => r.id === contact);
    const pick = row?.candidates.find((c) => c.id === company);
    if (!row || !pick) throw new Error("That company is not one the hub offered for this contact - read the list again");
    return { row, pick };
  });
  const j = await hubspotFetchJson<{ numErrors?: number; errors?: { message?: string }[] }>({
    path: "/crm/v4/associations/contacts/companies/batch/create", method: "POST",
    body: { inputs: checked.map(({ row, pick }) => ({ from: { id: row.id }, to: { id: pick.id }, types: [
      { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 279 },
      { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 1 },
    ] })) },
  });
  if (Number(j.numErrors ?? 0) > 0) throw new Error(String(j.errors?.[0]?.message ?? "HubSpot did not link them"));
  const at = new Date().toISOString();
  const done: LinkDone[] = checked.map(({ row, pick }) => ({ at, by, contact: row.id, company: pick.id, companyName: pick.name, typed: row.company }));
  await kvSet(LINKS, [...done, ...(await linked())].slice(0, 2000));
  return done;
}
