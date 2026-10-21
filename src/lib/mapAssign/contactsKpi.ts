// MAP ASSIGNMENT - the Contacts view's numbers (SARCLA 21.10.2026: "the KPI of new contacts entering the assignment -
// to whom, if it hit the rules or not - and also the contact association: every contact associated to a company
// matches the same as in the company"). Two parts:
//   newContactsKpi()  the contacts created in the last 30 Zurich days (one HubSpot search, 200 a page, newest first,
//                     10,000 at most - HubSpot's search cap; past it the oldest days are short and the KPI says so),
//                     A+P people left out, joined to the table in ONE query and classed by contacts.ts; kept in kv
//                     "mapAssign:newContacts", read again only when older than an hour. Called by the engine's run
//                     (which catches its errors); it catches nothing itself.
//   contactsData()    GET /api/uc/map-assignment?contacts=1: that kv value and the contact <-> company match totals,
//                     counted from the table on request (per country, per owner by the rules, all).
// The pure part (classes, counting, every type) is contacts.ts - re-exported here, so callers import from this file.

import { query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { ensureMapAssign } from "./engine";
import type { Internal } from "./plan";
import {
  KPI_VERSION, buildNewContacts, windowStart,
  type CompanyRuleRow, type ContactsData, type MatchCounts, type NewContactRow, type NewContactsKpi,
} from "./contacts";

export * from "./contacts";

const KV_NEW = "mapAssign:newContacts";
const DAYS = 30;
const FRESH_MS = 60 * 60_000;
/** HubSpot's search returns 10,000 results at most (after=10000 is refused). */
const MAX_READ = 10_000;
const PROPS = ["email", "hubspot_owner_id", "region_responsibility", "sae_performis", "associatedcompanyid", "createdate"];
const OWNERS_SHOWN = 15;

type Props = Record<string, string | null>;
type Page = { results?: { id: string; properties?: Props }[]; paging?: { next?: { after?: string } } };
const nz = (x: unknown) => { const s = String(x ?? "").trim(); return s ? s : null; };

/** The stored KPI when it has the shape this code writes; else null (never read, or an older shape). */
function stored(x: unknown): NewContactsKpi | null {
  const k = x as Partial<NewContactsKpi> | null | undefined;
  return k && typeof k === "object" && k.v === KPI_VERSION && typeof k.at === "string" && Array.isArray(k.perDay) && k.classes ? (k as NewContactsKpi) : null;
}

/**
 * The new contacts of the last 30 days, counted - at most hourly (a fresher stored one is returned as it is).
 * `signal`: the engine run's time limit, looked at between pages. `internal`: A+P people (the run's list 2865 read);
 * left out = the two company domains (INTERNAL_DOMAINS).
 */
export async function newContactsKpi(signal?: AbortSignal, internal?: Internal): Promise<NewContactsKpi> {
  const had = stored(await kvGet<unknown>(KV_NEW));
  if (had && Date.now() - Date.parse(had.at) < FRESH_MS) return had;

  const now = Date.now();
  const since = windowStart(now, DAYS);
  const byId = new Map<string, NewContactRow>();
  let after: string | undefined;
  let read = 0, capped = false;
  for (;;) {
    if (signal?.aborted) throw new Error("stopped: the run's time limit");
    const j = await hubspotRetry<Page>({
      path: "/crm/v3/objects/contacts/search", method: "POST",
      body: {
        filterGroups: [{ filters: [{ propertyName: "createdate", operator: "GTE", value: String(since) }] }],
        sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
        properties: PROPS, limit: 200, ...(after ? { after } : {}),
      },
    });
    const res = j.results ?? [];
    read += res.length;
    for (const o of res) {
      const p = o.properties ?? {};
      byId.set(String(o.id), {
        id: String(o.id), email: nz(p.email), created: nz(p.createdate), owner: nz(p.hubspot_owner_id), region: nz(p.region_responsibility),
        sae: nz(p.sae_performis), companyId: nz(p.associatedcompanyid),
      });
    }
    after = j.paging?.next?.after;
    if (!after || !res.length) break;
    if (read >= MAX_READ) { capped = true; break; }
  }

  const rows = [...byId.values()];
  const ids = [...new Set(rows.map((r) => r.companyId).filter((x): x is string => !!x))];
  const companies = new Map<string, CompanyRuleRow>();
  if (ids.length) {
    const r = await query<{ company_id: string; name: string | null; country: string | null; owner_now: string | null; region_now: string | null; owner_decided: string; via: string; sae: string | null }>(
      `SELECT company_id, name, country, owner_now, region_now, owner_decided, via, sae FROM apsomh_map_assign WHERE company_id = ANY($1::text[])`, [ids],
    );
    for (const x of r.rows) {
      companies.set(String(x.company_id), {
        id: String(x.company_id), name: x.name, country: x.country, ownerNow: x.owner_now === null ? null : String(x.owner_now),
        regionNow: x.region_now === null ? null : String(x.region_now), decided: String(x.owner_decided), via: String(x.via ?? ""), sae: x.sae,
      });
    }
  }
  const kpi = buildNewContacts(rows, companies, { now, days: DAYS, capped, internal });
  if (capped) console.warn(`[map-assign] new contacts: HubSpot's search stops at ${MAX_READ} - the oldest days of the ${DAYS} are short`);
  await kvSet(KV_NEW, kpi);
  return kpi;
}

/* ── the contact <-> company match, from the table ─────────────────────── */

/** contacts_mism is the engine's column (21.10.2026); until it is there the counts read as "not counted yet". */
let mismColumn = false;
async function mismExpr(): Promise<string> {
  if (!mismColumn) {
    const r = await query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'apsomh_map_assign' AND column_name = 'contacts_mism' LIMIT 1`);
    mismColumn = r.rows.length > 0;
  }
  return mismColumn ? "contacts_mism" : "NULL::int";
}

type DbCounts = { [K in keyof MatchCounts]: number | string | null };
/** Only companies whose contacts were counted (contacts_n), and every "off" kept within that count: the contacts are
 *  counted at night, a later read may find a few more off (LEAST alone would skip a NULL count). */
const countsSql = (m: string) => {
  const chk = `contacts_off IS NOT NULL AND contacts_n IS NOT NULL`;
  const mis = `${m} IS NOT NULL AND contacts_n IS NOT NULL`;
  return `
  count(*)::int AS companies,
  COALESCE(sum(contacts_n), 0)::int AS contacts,
  (count(*) FILTER (WHERE contacts_n IS NOT NULL))::int AS "companiesCounted",
  (count(*) FILTER (WHERE ${chk}))::int AS "companiesChecked",
  COALESCE(sum(contacts_n) FILTER (WHERE ${chk}), 0)::int AS checked,
  COALESCE(sum(LEAST(contacts_off, contacts_n)) FILTER (WHERE ${chk}), 0)::int AS "off",
  (count(*) FILTER (WHERE ${mis}))::int AS "companiesMism",
  COALESCE(sum(contacts_n) FILTER (WHERE ${mis}), 0)::int AS "mismCounted",
  COALESCE(sum(LEAST(${m}, contacts_n)) FILTER (WHERE ${mis}), 0)::int AS mism`;
};
const counts = (x: DbCounts | undefined): MatchCounts => ({
  companies: Number(x?.companies) || 0, contacts: Number(x?.contacts) || 0, companiesCounted: Number(x?.companiesCounted) || 0,
  companiesChecked: Number(x?.companiesChecked) || 0, checked: Number(x?.checked) || 0, off: Number(x?.off) || 0,
  companiesMism: Number(x?.companiesMism) || 0, mismCounted: Number(x?.mismCounted) || 0, mism: Number(x?.mism) || 0,
});
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

/** GET ?contacts=1: the new-contacts KPI as kept (null until the first run with it) and the match totals now. */
export async function contactsData(): Promise<ContactsData> {
  await ensureMapAssign();
  const newContacts = stored(await kvGet<unknown>(KV_NEW));
  const m = await mismExpr();
  const sql = countsSql(m);
  const byCountry = await query<DbCounts & { country: string }>(
    `SELECT COALESCE(country, '??') AS country, ${sql} FROM apsomh_map_assign GROUP BY 1 ORDER BY contacts DESC, companies DESC, 1`,
  );
  const byOwner = await query<DbCounts & { owner: string }>(
    `SELECT owner_decided AS owner, ${sql} FROM apsomh_map_assign GROUP BY 1 ORDER BY contacts DESC, companies DESC, 1 LIMIT ${OWNERS_SHOWN}`,
  );
  const all = await query<DbCounts & { at: Date | null; counted_at: Date | null }>(
    `SELECT ${sql}, max(checked_at) AS at, max(contacts_n_at) AS counted_at FROM apsomh_map_assign`,
  );
  const t = all.rows[0];
  return {
    newContacts,
    match: {
      at: iso(t?.at), countedAt: iso(t?.counted_at), mismKnown: m !== "NULL::int",
      byCountry: byCountry.rows.map((x) => ({ country: String(x.country), ...counts(x) })),
      byOwner: byOwner.rows.map((x) => ({ owner: String(x.owner), ...counts(x) })),
      totals: counts(t),
    },
  };
}
