// VISIT & TRAFFIC ORIGIN - the read (the rules are in visitCube.ts). GA4: exact users per month
// and per month x country, a month x country x channel cube, the visitors who logged in (the login
// event), and the landing pages; HubSpot: the companies that logged in to the shop, per sales
// priority (Datatracker's login counts on the company), and the shop accounts with no company.
// A year per GA4 call (the hub asks GA4 for 365 days at most). About a minute; read every
// 6 hours, the page shows the last read meanwhile.

import { fetchGa4Report } from "@/lib/integrations/ga4Reports";
import { hubspotFetchJson, searchTotal } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import type { Unlinked, UnlinkedRow, VisitData } from "./visitCube";

// v2: users per country, the login event, the shop accounts without a company (18.10)
const KEY = "marketingKpis:visit:v2";
const TTL_MS = 6 * 60 * 60 * 1000;
const RETRY_FAILED_MS = 30 * 60 * 1000;
const PRIOS: [string, string | null][] = [
  ["Prio 1", "1-Prio 1 - Pot >25000€"], ["Prio 2", "2-Prio 2 - Pot btw 2500 & 24999€"], ["Prio 3", "3-Prio 3 - Pot btw 500 & 2499€"],
  ["No priority", "4- No priority for sales, Pot. <500€"], ["Not set", null],
];

export function visitData(): Promise<SlowState<VisitData>> {
  return slowReport(KEY, (v: VisitData) => (Object.keys(v?.errors ?? {}).length ? RETRY_FAILED_MS : TTL_MS), build);
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** GA4's countryId, "" when GA4 does not know it */
const countryOf = (k: string | undefined) => { const c = (k ?? "").toUpperCase(); return c === "(NOT SET)" ? "" : c; };
/** GA4's yearMonth "202609" as "2026-09"; a date "2026-09-14" as its month */
const monthKey = (k: string) => (/^\d{6}$/.test(k) ? `${k.slice(0, 4)}-${k.slice(4, 6)}` : k.slice(0, 7));

async function build(): Promise<VisitData> {
  const now = new Date();
  const year = now.getUTCFullYear(), py = year - 1;
  const monthsDone = now.getUTCMonth();
  const errors: Record<string, string> = {};
  const guard = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { errors[name] = String((e as Error)?.message ?? e).slice(0, 300); }
  };
  const ranges: [string, string][] = [[`${py}-01-01`, `${py}-12-31`], [`${year}-01-01`, iso(now)]];

  const users: VisitData["users"] = {};
  await guard("users", async () => {
    reportProgress(KEY, "reading GA4 users per month");
    for (const [from, to] of ranges) {
      const r = await fetchGa4Report({ name: "visitUsersMonthly", from, to });
      for (const row of r.rows) users[monthKey(row.keys[0] ?? "")] = [row.values[0] ?? 0, row.values[1] ?? 0, row.values[2] ?? 0];
    }
  });

  const channels: string[] = [];
  const cube: VisitData["cube"] = [];
  await guard("cube", async () => {
    reportProgress(KEY, "reading GA4 sessions by month, country and channel");
    const idx = (c: string) => { let i = channels.indexOf(c); if (i < 0) { i = channels.length; channels.push(c); } return i; };
    for (const [from, to] of ranges) {
      const r = await fetchGa4Report({ name: "visitCube", from, to });
      for (const row of r.rows) {
        cube.push([monthKey(row.keys[0] ?? ""), countryOf(row.keys[1]), idx(row.keys[2] || "(not set)"), row.values[0] ?? 0, row.values[1] ?? 0, row.values[2] ?? 0]);
      }
    }
  });

  const countryUsers: VisitData["countryUsers"] = [];
  await guard("countryUsers", async () => {
    reportProgress(KEY, "reading GA4 users by country");
    for (const [from, to] of ranges) {
      const r = await fetchGa4Report({ name: "visitCountryUsers", from, to });
      for (const row of r.rows) countryUsers.push([monthKey(row.keys[0] ?? ""), countryOf(row.keys[1]), row.values[0] ?? 0, row.values[1] ?? 0, row.values[2] ?? 0]);
    }
  });

  // the visitors who logged in to the shop: GA4's login event (the shop sends no user id)
  const logins: VisitData["logins"] = [];
  await guard("logins", async () => {
    reportProgress(KEY, "reading GA4 logins");
    for (const [from, to] of ranges) {
      const r = await fetchGa4Report({ name: "visitLoginUsers", from, to });
      for (const row of r.rows) logins.push([monthKey(row.keys[0] ?? ""), countryOf(row.keys[1]), row.values[0] ?? 0]);
    }
  });

  // landing pages: the whole months this year, and the same months a year earlier
  const landing: VisitData["landing"] = { months: monthsDone, cy: [], py: [] };
  await guard("landing", async () => {
    if (!monthsDone) return;
    reportProgress(KEY, "reading GA4 landing pages");
    const last = (y: number) => iso(new Date(Date.UTC(y, monthsDone, 0)));
    for (const [side, y] of [["cy", year], ["py", py]] as const) {
      const r = await fetchGa4Report({ name: "visitLanding", from: `${y}-01-01`, to: last(y) });
      landing[side] = r.rows.map((row) => [row.keys[0] || "(not set)", row.keys[1] || "(not set)", row.values[0] ?? 0, row.values[1] ?? 0]);
    }
  });

  // known customers: companies that logged in to the shop, per sales priority (V06, V07)
  const prio: VisitData["prio"] = [];
  await guard("prio", async () => {
    reportProgress(KEY, "counting logged-in companies by priority");
    const prioF = (v: string | null) => (v === null ? { propertyName: "sales_priority", operator: "NOT_HAS_PROPERTY" } : { propertyName: "sales_priority", operator: "EQ", value: v });
    for (const [band, value] of PRIOS) {
      prio.push({
        band,
        all: await searchTotal("companies", { filterGroups: [{ filters: [prioF(value)] }] }),
        cy: await searchTotal("companies", { filterGroups: [{ filters: [prioF(value), { propertyName: "n_of_logins_datatracker", operator: "GT", value: "0" }] }] }),
        py: await searchTotal("companies", { filterGroups: [{ filters: [prioF(value), { propertyName: `n_of_logins_datatracker_${py}`, operator: "GT", value: "0" }] }] }),
      });
    }
  });

  let unlinked: Unlinked | null = null;
  await guard("unlinked", async () => {
    reportProgress(KEY, "finding shop accounts without a company");
    unlinked = await unlinkedAccounts(year);
  });

  return { generatedAt: new Date().toISOString(), year, monthsDone, users, channels, cube, countryUsers, logins, landing, prio, unlinked, errors };
}

/** Free e-mail providers: such an address names no company. */
const FREE_MAIL = /^(gmail|googlemail|hotmail|outlook|live|yahoo|ymail|gmx|web|bluewin|icloud|me|mac|aol|libero|t-online|freenet|orange|free|wanadoo|sunrise|hispeed|proton|protonmail|pm|mail|email|yandex|wp|o2|onet|interia|op|alice|tiscali|virgilio|laposte|sfr|msn|ziggo|kpnmail|home|posteo|seznam|tutanota|zoho|gmx-topmail|vodafone|arcor|telenet|skynet|fastwebnet|inwind|tin|aruba|pec|bigpond)\./i;
/** A+P's own people: their test accounts are not customers to fix. */
const INTERNAL = /(^|\.)(apsoparts|angst-pfister|angstpfister)\.[a-z.]+$/i;

type Contact = { id: string; properties: Record<string, string | null> };
/**
 * The shop accounts (contacts with a shop customer id) that have no company in HubSpot: their
 * logins, views and orders count for no company, so they are not known customers on any report
 * (SARCLA 18.10: "companies that are not company that we can fix"). Each with a company of its
 * e-mail domain when there is one - to link - never created by the hub (orders and companies: a
 * person decides).
 */
async function unlinkedAccounts(year: number): Promise<Unlinked> {
  const since = String(Date.UTC(year, 0, 1));
  const all: Contact[] = [];
  let after: string | undefined;
  do {
    const r = await hubspotFetchJson<{ results?: Contact[]; paging?: { next?: { after?: string } } }>({
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

  const dom = (c: Contact) => (c.properties.hs_email_domain ?? "").trim().toLowerCase();
  const people = all.filter((c) => !INTERNAL.test(dom(c)));
  const business = [...new Set(people.map(dom).filter((d) => d && !FREE_MAIL.test(d)))];
  // a company with that domain? (a hundred domains a search; several companies on one domain are said)
  const byDomain: Record<string, { id: string; name: string; more: number }> = {};
  for (let i = 0; i < business.length; i += 100) {
    let next: string | undefined, pages = 0;
    do {
      const r = await hubspotFetchJson<{ results?: Contact[]; paging?: { next?: { after?: string } } }>({
        path: "/crm/v3/objects/companies/search", method: "POST",
        body: { filterGroups: [{ filters: [{ propertyName: "domain", operator: "IN", values: business.slice(i, i + 100) }] }], properties: ["domain", "name"], limit: 100, ...(next ? { after: next } : {}) },
      });
      for (const c of r.results ?? []) {
        const d = (c.properties.domain ?? "").toLowerCase();
        if (byDomain[d]) byDomain[d].more++;
        else byDomain[d] = { id: c.id, name: c.properties.name ?? d, more: 0 };
      }
      next = r.paging?.next?.after;
    } while (next && ++pages < 10);
  }
  const rows: UnlinkedRow[] = people.map((c) => {
    const d = dom(c);
    const match = byDomain[d] ?? null;
    return {
      id: c.id, company: (c.properties.company ?? "").trim(), domain: d, country: (c.properties.country ?? "").trim(),
      created: (c.properties.createdate ?? "").slice(0, 10),
      kind: match ? "match" : !d || FREE_MAIL.test(d) ? "free" : "business", match,
    };
  });
  const rank = { match: 0, business: 1, free: 2 } as const;
  rows.sort((a, b) => rank[a.kind] - rank[b.kind] || b.created.localeCompare(a.created));
  return {
    total: people.length, internal: all.length - people.length,
    matched: rows.filter((r) => r.kind === "match").length, business: rows.filter((r) => r.kind === "business").length, free: rows.filter((r) => r.kind === "free").length,
    createdThisYear: people.filter((c) => (c.properties.createdate ?? "") >= `${year}-01-01`).length,
    seenThisYear: people.filter((c) => { const t = Date.parse(c.properties.hs_analytics_last_visit_timestamp ?? ""); return Number.isFinite(t) && t >= Number(since); }).length,
    rows: rows.slice(0, 400),
  };
}
