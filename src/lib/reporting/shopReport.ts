// THE ESO SHOP BEHAVIOUR PAGE'S READ (SARCLA 29.10.2026: "rebuild like Figures/Visits" - logins, views, logged in &
// ordered in the shop): every company the shop counted, of everyone (ESO, TSA and the rest - the Figures' ESO | TSA |
// Total and the line managers' teams), as small rows; the rules in ./shopRules.ts. In two parts, as they change:
//
// 1. The companies and the Performis years - every six hours, through slowReport (about 400 searches, 50,000
//    companies): the E-Shop Data Tracker's export is one total per company and year on the company in HubSpot
//    (n_of_logins_datatracker[_YYYY], n_of_views_…, orders_…), loaded by hand - property history says when (the last
//    time 15 Apr 2026, so its 2026 stops there; the page says so); with each company's owner, priority, customer
//    category and country. APSOparts' and A+P's own left out.
// 2. The live counters - every five minutes: the smart bar's logins, article views and articles ordered per company
//    and day, which the hub keeps in its own database (apsomh_shop_days, src/lib/shopLooks, copied every quarter of an
//    hour) - counted since 2 Oct 2026. A company counted live but not in the export is read once and remembered.

import { getPool } from "@/lib/db/client";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { ESHOP_YEARS } from "@/lib/integrations/eshopActivity";
import { ownerNames } from "@/lib/integrations/erosion";
import { teamOf } from "@/lib/datatracker/rosters";
import { isInternalCompany } from "@/lib/datatracker/rules";
import { readOwners } from "@/lib/ownerRules/hubspot";
import { categoryBand, prioBand, prioOf, CATEGORY_BANDS, PRIO_BANDS } from "./esoRules";
import { dayNo, type ShopData } from "./shopRules";

const BASE_KEY = "esoShop:base:v1";
const BASE_TTL_MS = 6 * 60 * 60 * 1000;
const LIVE_TTL_MS = 5 * 60 * 1000;
/** The first whole day the smart bar counted - it went live on 2 Oct 2026 at 09:18 UTC; a test's counts sit on 30 Sep. */
export const LIVE_FROM = "2026-10-02";

type Row = { id: string; properties?: Record<string, string | null> };
type Props = Record<string, string | null | undefined>;
type Filter = { propertyName: string; operator: string; value?: string };
const num = (v: string | null | undefined) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** The 2026 pair has no year in its name (eshopActivity.ts). */
const DT_NOW = 2026;
const dtProp = (what: "n_of_logins" | "n_of_views" | "orders", y: number) => (y === DT_NOW ? `${what}_datatracker` : `${what}_datatracker_${y}`);
const FACTS = ["name", "domain", "hubspot_owner_id", "sales_priority", "apso_customer", "country_custom"];

/** The companies part, kept six hours: ShopData without the live days, with each company row's HubSpot id. */
type Base = Pick<ShopData, "dtYears" | "dtLoaded" | "people" | "labels" | "companies" | "years"> & {
  generatedAt: string;
  ids: string[];
  /** APSOparts' and A+P's own, left out - kept so a live row of theirs is not read again */
  internal: string[];
};

/* ── the people and the company rows, shared by both parts ─────────────── */

/** Who a company owner is and in which team - the rosters, else the team HubSpot has them in (as the Visits). */
async function teamFinder(): Promise<(id: string) => { name: string; team: string }> {
  const names = await ownerNames().catch(() => new Map<string, string>());
  const hsTeam = new Map<string, string>();
  try { for (const o of await readOwners()) if (o.team) hsTeam.set(String(o.id), o.team); } catch { /* the rosters alone */ }
  return (id) => ({
    name: id ? names.get(id) ?? `Owner ${id}` : "No owner",
    team: !id ? "Other" : teamOf(id) ?? (/\bTSA\b/i.test(hsTeam.get(id) ?? "") ? "TSA" : /\bESO\b/i.test(hsTeam.get(id) ?? "") ? "ESO" : "Other"),
  });
}
/** Adds companies to people / labels / rows (arrays it may grow) - one row per company: owner, priority, category, country. */
function rowMaker(people: ShopData["people"], labels: ShopData["labels"], who: (id: string) => { name: string; team: string }) {
  const personIdx = new Map(people.map((p, i) => [p.id, i]));
  const at = (list: string[], v: string) => { let i = list.indexOf(v); if (i < 0) i = list.push(v) - 1; return i; };
  const person = (id: string) => {
    let i = personIdx.get(id);
    if (i === undefined) { i = people.push({ id, ...who(id) }) - 1; personIdx.set(id, i); }
    return i;
  };
  return (p: Props) => [person(p.hubspot_owner_id ?? ""), at(labels.prio, prioBand(prioOf(p.sales_priority))), at(labels.category, categoryBand(p.apso_customer)), at(labels.country, p.country_custom || "Not set")];
}

/* ── 1. the companies and the Performis years ──────────────────────────── */

function shopBase(): Promise<SlowState<Base>> {
  return slowReport(BASE_KEY, BASE_TTL_MS, buildBase);
}

/** Every company matching any of the groups, past the search's 10,000 by the object id (each group carries the cursor). */
async function searchAny(groups: Filter[][], properties: string[], label: string, seen: Map<string, Row>): Promise<void> {
  let lastId = "0";
  for (let page = 0; page < 2000; page++) {
    const r = await hubspotFetchJson<{ results?: Row[] }>({
      path: "/crm/v3/objects/companies/search", method: "POST",
      body: {
        limit: 200, properties,
        filterGroups: groups.map((g) => ({ filters: [...g, { propertyName: "hs_object_id", operator: "GT", value: lastId }] })),
        sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
      },
    });
    const rows = r.results ?? [];
    for (const x of rows) seen.set(String(x.id), x);
    reportProgress(BASE_KEY, `${label} · ${seen.size.toLocaleString("en")} companies`);
    if (rows.length < 200) break;
    lastId = rows[rows.length - 1].id;
  }
}

async function buildBase(): Promise<Base> {
  const years = [...ESHOP_YEARS].sort((a, b) => a - b);
  const props = [...FACTS, ...years.flatMap((y) => [dtProp("n_of_logins", y), dtProp("n_of_views", y), dtProp("orders", y)])];

  // every company the export has a login for, in any of its years (a search takes 5 groups at most)
  const found = new Map<string, Row>();
  const groups = years.map((y) => [{ propertyName: dtProp("n_of_logins", y), operator: "GT", value: "0" }]);
  for (let i = 0; i < groups.length; i += 3) await searchAny(groups.slice(i, i + 3), props, "reading the companies the shop counted", found);

  // the day the last export was loaded: the newest change of its newest logins, on the first companies that carry it
  let dtLoaded: string | null = null;
  try {
    const sample = [...found.values()].filter((c) => num(c.properties?.[dtProp("n_of_logins", DT_NOW)]) > 0).slice(0, 50);
    if (sample.length) {
      const r = await hubspotFetchJson<{ results?: { propertiesWithHistory?: Record<string, { timestamp: string }[]> }[] }>({
        path: "/crm/v3/objects/companies/batch/read", method: "POST",
        body: { inputs: sample.map((c) => ({ id: c.id })), properties: ["name"], propertiesWithHistory: [dtProp("n_of_logins", DT_NOW)] },
      });
      const votes = new Map<string, number>();
      for (const x of r.results ?? []) {
        const day = x.propertiesWithHistory?.[dtProp("n_of_logins", DT_NOW)]?.[0]?.timestamp?.slice(0, 10);
        if (day) votes.set(day, (votes.get(day) ?? 0) + 1);
      }
      dtLoaded = [...votes].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] ?? null;
    }
  } catch { /* not known: the page then names the year without its end */ }

  const people: ShopData["people"] = [];
  const labels: ShopData["labels"] = { prio: [...PRIO_BANDS], category: [...CATEGORY_BANDS], country: [] };
  const row = rowMaker(people, labels, await teamFinder());
  const ids: string[] = [], companies: number[][] = [], yearRows: number[][] = [], internal: string[] = [];
  for (const [id, c] of found) {
    const p = c.properties ?? {};
    if (isInternalCompany(p.name, p.domain)) { internal.push(id); continue; }
    const ci = companies.push(row(p)) - 1;
    ids.push(id);
    years.forEach((y, yi) => {
      const l = num(p[dtProp("n_of_logins", y)]), v = num(p[dtProp("n_of_views", y)]), o = num(p[dtProp("orders", y)]);
      if (l || v || o) yearRows.push([ci, yi, l, v, o]);
    });
  }
  return { generatedAt: new Date().toISOString(), dtYears: years, dtLoaded, people, labels, companies, years: yearRows, ids, internal };
}

/* ── 2. the live counters, joined to the companies ─────────────────────── */

/** The companies counted live but not in the export: their facts, read once (again after six hours); null = gone (merged). */
const factsSeen = new Map<string, { at: number; p: Props | null }>();
async function liveOnlyFacts(ids: string[]): Promise<Map<string, Props | null>> {
  const now = Date.now();
  const stale = ids.filter((id) => { const f = factsSeen.get(id); return !f || now - f.at > BASE_TTL_MS; });
  for (let i = 0; i < stale.length; i += 100) {
    const part = stale.slice(i, i + 100);
    const r = await hubspotFetchJson<{ results?: Row[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST",
      body: { inputs: part.map((id) => ({ id })), properties: FACTS },
    });
    const got = new Map((r.results ?? []).map((x) => [String(x.id), x.properties ?? {}]));
    for (const id of part) factsSeen.set(id, { at: now, p: got.get(id) ?? null });
  }
  return new Map(ids.map((id) => [id, factsSeen.get(id)?.p ?? null]));
}

async function withLive(b: Base): Promise<ShopData> {
  const today = new Date().toISOString().slice(0, 10);
  let live: { company_id: string; day: string; logins: number; views: number; orders: number }[] = [];
  try {
    const r = await getPool().query(
      `SELECT company_id, to_char(day, 'YYYY-MM-DD') AS day, logins, views, orders FROM apsomh_shop_days WHERE day >= $1::date AND day <= $2::date`,
      [LIVE_FROM, today],
    );
    live = r.rows;
  } catch (e) {
    // the table is made by the first sweep (src/lib/shopLooks) - none yet is no counters yet
    if (!/does not exist/i.test(String((e as Error)?.message ?? e))) throw e;
  }
  // the companies part is shared: grown on copies, never in place
  const people = [...b.people];
  const labels = { prio: [...b.labels.prio], category: [...b.labels.category], country: [...b.labels.country] };
  const companies = [...b.companies];
  const idx = new Map(b.ids.map((id, i) => [id, i]));
  const internal = new Set(b.internal);
  const missing = [...new Set(live.map((r) => String(r.company_id)))].filter((id) => !idx.has(id) && !internal.has(id));
  if (missing.length) {
    const facts = await liveOnlyFacts(missing);
    const row = rowMaker(people, labels, await teamFinder());
    for (const id of missing) {
      const p = facts.get(id);
      if (!p || isInternalCompany(p.name, p.domain)) continue;
      idx.set(id, companies.push(row(p)) - 1);
    }
  }
  const days: number[][] = [];
  for (const r of live) {
    const ci = idx.get(String(r.company_id));
    if (ci === undefined) continue; // internal, or gone from HubSpot (merged)
    days.push([ci, dayNo(LIVE_FROM, r.day), Number(r.logins) || 0, Number(r.views) || 0, Number(r.orders) || 0]);
  }
  return {
    generatedAt: new Date().toISOString(), today, liveFrom: LIVE_FROM, dtYears: b.dtYears, dtLoaded: b.dtLoaded,
    people, labels, companies, days, years: b.years,
    coverage: { companies: companies.length, live: new Set(days.map((r) => r[0])).size, performis: new Set(b.years.map((r) => r[0])).size, internal: b.internal.length },
  };
}

/** The page's read: the companies part (six hours) joined to the live counters (five minutes). While the counters are
 *  read again, the last join is answered; the first one is waited for. */
type Joined = { at: number; base: string; value?: ShopData; pending?: Promise<ShopData>; error?: string };
let joined: Joined | null = null;
export async function esoShop(): Promise<SlowState<ShopData>> {
  const base = await shopBase();
  if (!base.value) return { computing: base.computing, progress: base.progress, error: base.error };
  const b = base.value;
  const same = joined?.base === b.generatedAt;
  if (!joined || !same || (!joined.pending && Date.now() - joined.at > LIVE_TTL_MS)) {
    const run: Joined = { at: Date.now(), base: b.generatedAt, value: same ? joined?.value : undefined };
    const p = withLive(b).then((v) => { run.value = v; run.at = Date.now(); run.error = undefined; return v; });
    run.pending = p;
    // handled here, so a failed refresh behind a value already answered never goes unheard; the next look tries again
    p.catch((e) => { run.error = String((e as Error)?.message ?? e); }).finally(() => { run.pending = undefined; });
    joined = run;
  }
  const j = joined;
  if (j.value) return { ...base, value: j.value };
  try {
    if (!j.pending) throw new Error(j.error ?? "the shop's counters could not be read");
    return { ...base, value: await j.pending };
  } catch (e) {
    if (joined === j) joined = null;
    return { computing: false, error: String((e as Error)?.message ?? e) };
  }
}
