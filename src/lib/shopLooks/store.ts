// SHOP LOOKS, KEPT.
//
// SARCLA, 05.10: "is this data being saved? This is primordial to then launch
// analyses". It was not, not at article level. The gateway writes each
// customer's shop activity onto the HubSpot company as one JSON property: daily
// counters for 400 days, and only the LAST 50 article lines - so which article a
// customer looked at, and in what quantity, was overwritten as they browsed on.
//
// This copies both into the hub's own Postgres every quarter of an hour, before
// they can be overwritten: one row per customer, day and article (the gateway's
// own grain - it folds a second look at the same article on the same day into
// one line), and one row per customer and day for the counters. Nothing is
// deleted; a line seen again is merged, so the cart and order flags and the
// largest quantity only ever grow.
//
// Read-only against HubSpot. The data stays in A+P's own AWS database - the
// gateway on Railway still keeps nothing.

import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { parseActivity, type DayRow, type LookRow } from "./parse";

const KV_LAST = "shoplooks:last-sweep";
const KV_STATUS = "shoplooks:status";
/** Companies whose activity changed since the last sweep, plus this margin. */
const OVERLAP_MS = 20 * 60_000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS apsomh_shop_looks (
  company_id  text        NOT NULL,
  day         date        NOT NULL,
  article     text        NOT NULL DEFAULT '',
  product     text        NOT NULL DEFAULT '',
  last_at     text        NOT NULL,
  qty         numeric,
  qty_max     numeric,
  carted      boolean     NOT NULL DEFAULT false,
  ordered     boolean     NOT NULL DEFAULT false,
  contact_id  text,
  first_seen  timestamptz NOT NULL DEFAULT now(),
  updated     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, day, article, product)
);
CREATE INDEX IF NOT EXISTS apsomh_shop_looks_day_idx ON apsomh_shop_looks (day);
CREATE INDEX IF NOT EXISTS apsomh_shop_looks_article_idx ON apsomh_shop_looks (article);
CREATE TABLE IF NOT EXISTS apsomh_shop_days (
  company_id text        NOT NULL,
  day        date        NOT NULL,
  views      integer     NOT NULL DEFAULT 0,
  logins     integer     NOT NULL DEFAULT 0,
  carts      integer     NOT NULL DEFAULT 0,
  orders     integer     NOT NULL DEFAULT 0,
  updated    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, day)
);`;

let schemaReady: Promise<void> | null = null;
function ensureLooksSchema(): Promise<void> {
  schemaReady ??= getPool().query(SCHEMA).then(() => undefined).catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}

async function writeCompany(companyId: string, looks: LookRow[], days: DayRow[]): Promise<void> {
  const pool = getPool();
  if (looks.length) {
    const v: unknown[] = [];
    const tuples = looks.map((r, i) => {
      v.push(companyId, r.day, r.article, r.product, r.at, r.qty, r.carted, r.ordered, r.contact);
      const b = i * 9;
      return `($${b + 1},$${b + 2}::date,$${b + 3},$${b + 4},$${b + 5},$${b + 6}::numeric,$${b + 6}::numeric,$${b + 7},$${b + 8},$${b + 9})`;
    });
    await pool.query(
      `INSERT INTO apsomh_shop_looks (company_id, day, article, product, last_at, qty, qty_max, carted, ordered, contact_id)
       VALUES ${tuples.join(",")}
       ON CONFLICT (company_id, day, article, product) DO UPDATE SET
         last_at = GREATEST(apsomh_shop_looks.last_at, EXCLUDED.last_at),
         qty = COALESCE(EXCLUDED.qty, apsomh_shop_looks.qty),
         qty_max = GREATEST(apsomh_shop_looks.qty_max, EXCLUDED.qty_max),
         carted = apsomh_shop_looks.carted OR EXCLUDED.carted,
         ordered = apsomh_shop_looks.ordered OR EXCLUDED.ordered,
         contact_id = COALESCE(apsomh_shop_looks.contact_id, EXCLUDED.contact_id),
         updated = now()`,
      v,
    );
  }
  if (days.length) {
    const v: unknown[] = [];
    const tuples = days.map((d, i) => {
      v.push(companyId, d.day, d.views, d.logins, d.carts, d.orders);
      const b = i * 6;
      return `($${b + 1},$${b + 2}::date,$${b + 3},$${b + 4},$${b + 5},$${b + 6})`;
    });
    // The gateway's day counters only grow, so the larger figure is the true one.
    await pool.query(
      `INSERT INTO apsomh_shop_days (company_id, day, views, logins, carts, orders)
       VALUES ${tuples.join(",")}
       ON CONFLICT (company_id, day) DO UPDATE SET
         views = GREATEST(apsomh_shop_days.views, EXCLUDED.views),
         logins = GREATEST(apsomh_shop_days.logins, EXCLUDED.logins),
         carts = GREATEST(apsomh_shop_days.carts, EXCLUDED.carts),
         orders = GREATEST(apsomh_shop_days.orders, EXCLUDED.orders),
         updated = now()`,
      v,
    );
  }
}

export type SweepStatus = {
  at: string; ok: boolean; companies: number; looks: number; days: number;
  error: string | null; sinceFrom: string | null;
};

/**
 * Copy every company whose activity may have changed since the last sweep. The
 * first sweep takes all of them. A failed sweep does not move the watermark, so
 * the next one covers the same ground again - merging makes that harmless.
 */
export async function sweepShopLooks(signal?: AbortSignal): Promise<SweepStatus> {
  await ensureLooksSchema();
  const startedAt = new Date().toISOString();
  const last = await kvGet<string>(KV_LAST);
  const filters: { propertyName: string; operator: string; value?: string }[] = [
    { propertyName: "eshop_activity", operator: "HAS_PROPERTY" },
  ];
  if (last) filters.push({ propertyName: "hs_lastmodifieddate", operator: "GTE", value: String(Date.parse(last) - OVERLAP_MS) });

  let after: string | undefined;
  let companies = 0, looks = 0, days = 0;
  try {
    do {
      const res = await hubspotFetchJson<{
        results?: { id?: string; properties?: Record<string, string | null> }[];
        paging?: { next?: { after?: string } };
      }>({
        path: "/crm/v3/objects/companies/search",
        method: "POST",
        signal,
        body: { filterGroups: [{ filters }], properties: ["eshop_activity"], limit: 100, after },
      });
      for (const r of res.results ?? []) {
        if (!r.id) continue;
        const parsed = parseActivity(r.properties?.eshop_activity);
        await writeCompany(String(r.id), parsed.looks, parsed.days);
        companies++;
        looks += parsed.looks.length;
        days += parsed.days.length;
      }
      after = res.paging?.next?.after;
    } while (after);
    await kvSet(KV_LAST, startedAt);
    const status: SweepStatus = { at: startedAt, ok: true, companies, looks, days, error: null, sinceFrom: last ?? null };
    await kvSet(KV_STATUS, status);
    return status;
  } catch (e) {
    const status: SweepStatus = { at: startedAt, ok: false, companies, looks, days, error: String((e as Error)?.message ?? e), sinceFrom: last ?? null };
    await kvSet(KV_STATUS, status).catch(() => {});
    throw e;
  }
}

/** What is kept so far - for the screen that says so. */
export async function looksKept(): Promise<{ looks: number; firstDay: string | null; lastSweep: SweepStatus | null } | null> {
  try {
    await ensureLooksSchema();
    const r = await getPool().query<{ n: string; first: string | null }>(
      "SELECT count(*)::text AS n, to_char(min(day), 'YYYY-MM-DD') AS first FROM apsomh_shop_looks",
    );
    return {
      looks: Number(r.rows[0]?.n ?? 0),
      firstDay: r.rows[0]?.first ?? null,
      lastSweep: (await kvGet<SweepStatus>(KV_STATUS)) ?? null,
    };
  } catch {
    return null;
  }
}
