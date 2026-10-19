// VISIT & TRAFFIC ORIGIN - the read (the rules are in visitCube.ts). GA4: exact users per month
// and per month x country, a month x country x channel cube, the visitors who logged in (the login
// event), and the landing pages; HubSpot: the companies that logged in to the shop, per sales
// priority (Datatracker's login counts on the company), and the shop accounts with no company.
// A year per GA4 call (the hub asks GA4 for 365 days at most). About a minute; read every
// 6 hours, the page shows the last read meanwhile.

import { fetchGa4Report } from "@/lib/integrations/ga4Reports";
import { hubspotFetchJson, searchTotal } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import type { Unlinked, VisitData } from "./visitCube";

// v2: users per country, the login event, the shop accounts without a company (18.10)
// v3: Prio 1 and 2 companies logged in per day, from the live shop tracker (19.10)
const KEY = "marketingKpis:visit:v3";
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

  // the shop accounts without a company are no longer shown here (SARCLA 19.10: "this card should completely
  // disappear") - Ticket/order/article associations > Contacts without a company reads them itself
  const unlinked: Unlinked | null = null;

  // Prio 1 and 2 companies that logged in, day by day - the live shop tracker on the company
  // (eshop_activity, since 30 Sep 2026); the Datatracker's counts are per year (SARCLA 19.10: "a time for logging")
  let liveLogins: VisitData["liveLogins"] = null;
  await guard("liveLogins", async () => {
    reportProgress(KEY, "reading the live shop tracker of the Prio 1 and 2 companies");
    const days: Record<string, [number, number, number, number]> = {};
    let after: string | undefined, n = 0;
    do {
      const r = await hubspotFetchJson<{ results?: { properties: Record<string, string | null> }[]; paging?: { next?: { after?: string } } }>({
        path: "/crm/v3/objects/companies/search", method: "POST",
        body: { filterGroups: [{ filters: [{ propertyName: "eshop_activity", operator: "HAS_PROPERTY" }, { propertyName: "sales_priority", operator: "IN", values: [PRIOS[0][1], PRIOS[1][1]] }] }], properties: ["eshop_activity", "sales_priority"], limit: 100, ...(after ? { after } : {}) },
      });
      for (const c of r.results ?? []) {
        let j: { days?: Record<string, { l?: number }> };
        try { j = JSON.parse(c.properties.eshop_activity ?? ""); } catch { continue; }
        const p1 = (c.properties.sales_priority ?? "").startsWith("1");
        for (const [day, x] of Object.entries(j.days ?? {})) {
          if (!x?.l) continue;
          const o = (days[day] ??= [0, 0, 0, 0]);
          if (p1) { o[0]++; o[1] += x.l; } else { o[2]++; o[3] += x.l; }
        }
      }
      after = r.paging?.next?.after;
    } while (after && ++n < 100);
    const today = iso(new Date());
    liveLogins = { days: Object.entries(days).filter(([d]) => d < today).sort(([a], [b]) => a.localeCompare(b)).map(([d, o]) => [d, ...o]) };
  });

  return { generatedAt: new Date().toISOString(), year, monthsDone, users, channels, cube, countryUsers, logins, landing, prio, unlinked, liveLogins, errors };
}
