// SHOP ACCOUNTS WITHOUT A COMPANY - the read and the link (the rules are in shopAccountRules.ts).
// Read: HubSpot contacts with a shop customer id and no company, each with the companies of its
// e-mail domain. Link: one contact to the company a person picked, as its PRIMARY company (so its
// logins and orders count for that company) - only on that person's click; the hub never links or
// creates a company by itself (SARCLA: orders and companies, a person decides).

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { kvGet, kvSet } from "@/lib/db/init";
import { INTERNAL, kindOf, rankCandidates, type Candidate, type Unlinked, type UnlinkedRow } from "./shopAccountRules";

const KEY = "ticketAssoc:shopAccounts:v1";
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
  const rows: UnlinkedRow[] = people.map((c) => {
    const d = dom(c);
    const typed = (c.properties.company ?? "").trim();
    const candidates = rankCandidates(typed, byDomain[d] ?? []);
    return {
      id: c.id, company: typed, domain: d, country: (c.properties.country ?? "").trim(), created: (c.properties.createdate ?? "").slice(0, 10),
      kind: kindOf(d, candidates.length > 0), candidates,
      match: candidates.length ? { id: candidates[0].id, name: candidates[0].name, more: candidates.length - 1 } : null,
    };
  });
  const rank = { match: 0, business: 1, free: 2 } as const;
  rows.sort((a, b) => rank[a.kind] - rank[b.kind] || b.created.localeCompare(a.created));
  return {
    total: people.length, internal: all.length - people.length,
    matched: rows.filter((r) => r.kind === "match").length, business: rows.filter((r) => r.kind === "business").length, free: rows.filter((r) => r.kind === "free").length,
    createdThisYear: people.filter((c) => (c.properties.createdate ?? "") >= `${year}-01-01`).length,
    seenThisYear: people.filter((c) => { const t = Date.parse(c.properties.hs_analytics_last_visit_timestamp ?? ""); return Number.isFinite(t) && t >= since; }).length,
    rows,
  };
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
  const state = await shopAccounts();
  const row = state.value?.rows.find((r) => r.id === contactId);
  const pick = row?.candidates.find((c) => c.id === companyId);
  if (!row || !pick) throw new Error("That company is not one of this contact's e-mail domain - read the list again");
  const j = await hubspotFetchJson<{ numErrors?: number; errors?: { message?: string }[] }>({
    path: "/crm/v4/associations/contacts/companies/batch/create", method: "POST",
    body: { inputs: [{ from: { id: contactId }, to: { id: companyId }, types: [
      { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 279 },
      { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 1 },
    ] }] },
  });
  if (Number(j.numErrors ?? 0) > 0) throw new Error(String(j.errors?.[0]?.message ?? "HubSpot did not link them"));
  const done: LinkDone = { at: new Date().toISOString(), by, contact: contactId, company: companyId, companyName: pick.name, typed: row.company };
  await kvSet(LINKS, [done, ...(await linked())].slice(0, 1000));
  return done;
}
