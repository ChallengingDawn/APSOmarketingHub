// THE SHOP-ORDER SYNC - the shop's web orders into HubSpot, run by the hub. Moved from
// APSOAssistant's "Hubspot to Magento connector" (smart-bar/gateway/magento-poller.js),
// SARCLA, 11.10.2026: "take the connectors out of the Assistant".
//
// Every minute, one copy of the hub at a time:
//   STAGE    read the orders the shop changed since the last sweep (30 days on the first)
//            into apsomh_mg_stage - always, whatever the mode
//   PROCESS  when Active: write each new or changed order into HubSpot (found by its web
//            order number), then link its contact (by email) and its articles (by SKU)
// Three modes (kv): off / stage - reads only, the side-by-side test with the old
// connector - / active. Rules: rules.ts. What changed against the old connector, on
// purpose: an order the ERP has linked keeps its ERP fields (rules.ts); no company is
// guessed from the billing name - the order takes its buyer's primary company (linkCompany);
// a contact that never turns up is given up after 24 hours instead of retried for ever.

import { getPool } from "@/lib/db/client";
import { hubChain } from "@/lib/connectors/chainStatus";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { magentoConfigured } from "@/lib/doc/config";
import { magentoGet } from "@/lib/doc/magento";
import { notifyOrderStock } from "@/lib/searchbar/orderStock";
import { magentoTs, mayNotCreate, orderSkus, provisionalProps, same, validate, writableProps, type MagentoOrder, type Props } from "./rules";

export type Mode = "off" | "stage" | "active";
const KV_MODE = "connectors:magento:mode";
const LOCK = 4_107_210;
/** The read back's own lock: the minute sweeps carry on while it reads a week. */
const READBACK_LOCK = 4_107_211;
const PIPE = { pipelineId: process.env.MAGENTO_HUBSPOT_PIPELINE ?? "3687945443", pipelineStage: process.env.MAGENTO_HUBSPOT_STAGE ?? "5093087452" };
const PP = "2-200042439";
const WINDOW_DAYS = 30;
/** The very first sweep reads one day back: 30 days of full orders in one go timed out (11.10.2026). */
const FIRST_DAYS = 1;
/**
 * Full orders are big (~12 KB each): 5 a page, and up to 90 s for a page. From the hub a page of
 * 20 never came back (read backs of 11.10, 14:02 and 16:08 UTC) while pages of 1-5 always did -
 * the same page of 20 reaches a laptop in under a second, so it is the path, not the shop.
 */
const PAGE_SIZE = 5;
const MAX_PAGES = 1000;
const PAGE_TIMEOUT_MS = 90_000;
/** After a failed sweep, the next one waits this long - a failing request is not repeated every minute. */
const BACKOFF_MS = 10 * 60_000;
/** A page the shop does not answer is asked again after these pauses, before the sweep counts as failed. */
const PAGE_RETRY_MS = [5_000, 15_000];
const RETENTION_DAYS = 30;
const GIVE_UP_HOURS = 24;
/**
 * A sweep still running after this long is stopped and its lock dropped. 14.10.2026 10:10 UTC one
 * sweep never came back while holding the lock: the other copy of the hub skips quietly while the
 * lock is taken, so for 20 hours no web order reached HubSpot and nothing said so. The catch-up
 * after that day-long gap took 10 minutes, so this leaves room for a long sweep.
 */
const SWEEP_LIMIT_MS = 25 * 60_000;
/** Each HubSpot call of the sync gives up after this long instead of waiting for ever. */
const HS_TIMEOUT_MS = 60_000;
/** When the other copy has held the lock this long, the log says so (again every as long). */
const LOCK_WARN_MS = 30 * 60_000;

/* ── the hub's own tables (created on first use, never in ensureSchema) ── */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS apsomh_mg_stage (
  entity_id          bigint      PRIMARY KEY,
  increment_id       text,
  magento_updated_at timestamptz,
  magento_status     text,
  currency           text,
  grand_total        numeric,
  customer_email     text,
  customer_name      text,
  mandant            text,
  skus               text[],
  payload            jsonb,
  sync_status        text        NOT NULL DEFAULT 'pending',
  error_msg          text,
  first_seen         timestamptz NOT NULL DEFAULT now(),
  last_seen          timestamptz NOT NULL DEFAULT now(),
  processed_at       timestamptz,
  hs_order_id        text,
  contact_id         text,
  assoc_status       text,
  assoc_retries      int         NOT NULL DEFAULT 0,
  assoc_first_at     timestamptz,
  assoc_next_at      timestamptz
);
CREATE INDEX IF NOT EXISTS apsomh_mg_stage_sync  ON apsomh_mg_stage (sync_status, last_seen);
CREATE INDEX IF NOT EXISTS apsomh_mg_stage_assoc ON apsomh_mg_stage (assoc_status, assoc_next_at);
CREATE TABLE IF NOT EXISTS apsomh_mg_runs (
  id             bigserial   PRIMARY KEY,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  window_from    timestamptz,
  mode           text,
  orders_found   int         NOT NULL DEFAULT 0,
  orders_written int         NOT NULL DEFAULT 0,
  errors         int         NOT NULL DEFAULT 0,
  ok             boolean     NOT NULL DEFAULT true,
  error          text,
  skus           text
);`;

let schemaReady: Promise<void> | null = null;
export function ensureTables(): Promise<void> {
  schemaReady ??= getPool().query(SCHEMA).then(() => undefined).catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}

const q = async <T extends Record<string, unknown>>(sql: string, args: unknown[] = []) => (await getPool().query<T>(sql, args)).rows;

/* ── the mode ──────────────────────────────────────────────────────────── */

export async function getMode(): Promise<Mode> {
  const m = await kvGet<Mode>(KV_MODE);
  return m === "off" || m === "active" ? m : "stage";
}

/**
 * Switch. Going Active marks as handled every staged order HubSpot already holds with the
 * shop's latest change (hs_external_modified_date): the old connector wrote those, and
 * writing them again would only cost HubSpot calls. Everything else - an order it never
 * wrote, or wrote before its last change - stays to be written by the hub. (Until 11.10 this
 * was "staged more than 10 minutes ago", which would have let a fresh read back rewrite a week.)
 * If HubSpot cannot be asked, the mode does not change.
 */
export async function setMode(m: Mode): Promise<{ marked: number; toWrite: number; leftToErp: number }> {
  let marked = 0, toWrite = 0, leftToErp = 0;
  if (m === "active" && (await getMode()) !== "active") {
    await ensureTables();
    const pending = await q<{ entity_id: string; increment_id: string; mod: string | null; payload: Props }>(
      `SELECT entity_id::text, increment_id, payload->>'hs_external_modified_date' AS mod, payload FROM apsomh_mg_stage
        WHERE sync_status='pending' AND increment_id IS NOT NULL`);
    const done: string[] = [];
    const left: { id: string; why: string }[] = [];
    for (let i = 0; i < pending.length; i += 100) {
      const chunk = pending.slice(i, i + 100);
      const held = byWebNumber(await ordersByWebNumber(chunk.map((r) => r.increment_id), ["hs_external_modified_date"]));
      for (const r of chunk) {
        const hs = held.get(r.increment_id) ?? [];
        if (hs.length > 1) { left.push({ id: r.entity_id, why: split(hs.length) }); continue; }
        if (hs.length === 1) { if (!r.mod || same(r.mod, hs[0].properties?.hs_external_modified_date)) done.push(r.entity_id); continue; }
        const why = mayNotCreate(r.payload);
        if (why) left.push({ id: r.entity_id, why });
      }
    }
    for (const l of left) {
      await q("UPDATE apsomh_mg_stage SET sync_status='skipped', error_msg=$2, processed_at=now() WHERE entity_id=$1 AND sync_status='pending'", [l.id, l.why]);
    }
    leftToErp = left.length;
    if (done.length) {
      const r = await getPool().query(
        `UPDATE apsomh_mg_stage SET sync_status='ok', error_msg='written by the old connector', processed_at=now()
          WHERE sync_status='pending' AND entity_id = ANY($1::bigint[])`, [done]);
      marked = r.rowCount ?? 0;
    }
    toWrite = pending.length - marked - leftToErp;
  }
  await kvSet(KV_MODE, m);
  return { marked, toWrite, leftToErp };
}

/* ── the shop ──────────────────────────────────────────────────────────── */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** A sweep past its time limit stops at the next page or order instead of writing on beside the next one. */
function stopIfOver(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error(`stopped after ${SWEEP_LIMIT_MS / 60_000} minutes`);
}

/** One page of orders; a page the shop does not answer is asked again (5 s, then 15 s) before it counts as failed. */
async function ordersPage(path: string): Promise<{ items?: MagentoOrder[]; total_count?: number }> {
  let r = await magentoGet(path, PAGE_TIMEOUT_MS);
  for (const wait of PAGE_RETRY_MS) {
    if (r.status === 200) break;
    await sleep(wait);
    r = await magentoGet(path, PAGE_TIMEOUT_MS);
  }
  if (r.status !== 200) throw new Error(`the shop answered ${r.status || "nothing"} to the orders request`);
  return (r.json ?? {}) as { items?: MagentoOrder[]; total_count?: number };
}

/**
 * The orders the shop changed since `sinceIso`, oldest first. `onPage` gets each page as it
 * comes (the read back stages it at once, so a late failure keeps what was read); `pauseMs`
 * spaces the requests out (the read back's 50-odd pages are not fired back to back).
 */
async function ordersChangedSince(sinceIso: string, opts: { onPage?: (items: MagentoOrder[], page: number, total: number) => Promise<void>; pauseMs?: number; signal?: AbortSignal } = {}): Promise<MagentoOrder[]> {
  const all: MagentoOrder[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    stopIfOver(opts.signal);
    if (page > 1 && opts.pauseMs) await sleep(opts.pauseMs);
    const qs = [
      "searchCriteria[filterGroups][0][filters][0][field]=updated_at",
      `searchCriteria[filterGroups][0][filters][0][value]=${encodeURIComponent(sinceIso)}`,
      "searchCriteria[filterGroups][0][filters][0][conditionType]=gteq",
      "searchCriteria[sortOrders][0][field]=updated_at",
      "searchCriteria[sortOrders][0][direction]=ASC",
      `searchCriteria[pageSize]=${PAGE_SIZE}`,
      `searchCriteria[currentPage]=${page}`,
    ].join("&");
    const j = await ordersPage(`/rest/V1/orders?${qs}`);
    const items = Array.isArray(j.items) ? j.items : [];
    all.push(...items);
    if (opts.onPage) await opts.onPage(items, page, j.total_count ?? 0);
    if (items.length < PAGE_SIZE || all.length >= (j.total_count ?? 0)) break;
  }
  return all;
}

/* ── HubSpot ───────────────────────────────────────────────────────────── */

type Found = { id: string; properties?: Record<string, string | null> };

/** HubSpot with a time limit on every call: a call left waiting must not hold the sync's lock. */
const hs = <T = unknown>(req: Parameters<typeof hubspotFetchJson>[0]) =>
  hubspotFetchJson<T>({ ...req, signal: AbortSignal.timeout(HS_TIMEOUT_MS) });

/** Every HubSpot order carrying one of these web order numbers (at most 100 numbers), all pages. */
async function ordersByWebNumber(numbers: string[], properties: string[]): Promise<Found[]> {
  const out: Found[] = [];
  let after: string | undefined;
  do {
    const r = await hs<{ results?: Found[]; paging?: { next?: { after?: string } } }>({
      path: "/crm/v3/objects/orders/search", method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: "hs_external_order_id", operator: "IN", values: numbers }] }],
        properties: [...new Set(["hs_external_order_id", ...properties])], limit: 100, ...(after ? { after } : {}) },
    });
    out.push(...(r.results ?? []));
    after = r.paging?.next?.after;
  } while (after);
  return out;
}

/** The HubSpot orders per web order number - more than one means the ERP split it into deliveries. */
function byWebNumber(found: Found[]): Map<string, Found[]> {
  const m = new Map<string, Found[]>();
  for (const o of found) {
    const k = o.properties?.hs_external_order_id ?? "";
    m.set(k, [...(m.get(k) ?? []), o]);
  }
  return m;
}
const split = (n: number) => `left to the ERP: ${n} HubSpot orders carry this web number (the ERP's deliveries) - the shop's fields are not written onto one of them`;
const search = (obj: string, filters: object[], properties: string[], limit = 1) =>
  hs<{ results?: Found[] }>({ path: `/crm/v3/objects/${obj}/search`, method: "POST", body: { filterGroups: [{ filters }], properties, limit } });

/**
 * Update the order HubSpot holds under its web order number (an order the ERP linked keeps its
 * ERP fields), or create it - but only while it is still on the shop's side (rules.ts
 * mayNotCreate): an order the ERP has is the Compass sync's, and creating it makes a twin.
 */
async function upsertOrder(props: Props, erpSince?: number): Promise<{ id: string } | { skipped: string }> {
  const all = (await search("orders", [{ propertyName: "hs_external_order_id", operator: "EQ", value: props.hs_external_order_id }],
    ["order_order_number", "order_reconcile_state"], 10)).results ?? [];
  // the ERP split it: its deliveries carry the web number (an older load stamped them) - which
  // one would get the whole order's addresses and amounts is chance (11.10.2026: the old
  // connector wrote 10000057611's onto its .002), so none does
  if (all.length > 1) return { skipped: split(all.length) };
  const found = all[0];
  if (found) {
    const write = writableProps(props, found.properties ?? null);
    await hs({ path: `/crm/v3/objects/orders/${found.id}`, method: "PATCH", body: { properties: write } });
    return { id: found.id };
  }
  const why = mayNotCreate(props, Date.now(), erpSince);
  if (why) return { skipped: why };
  const made = await hs<{ id?: string }>({ path: "/crm/v3/objects/orders", method: "POST", body: { properties: props } });
  if (!made.id) throw new Error("HubSpot created the order but returned no id");
  return { id: made.id };
}

/**
 * The order's company = the buyer's PRIMARY company (or their only one), never guessed from the
 * billing name. 12.10.2026: without it every web order the hub wrote had no company, and the
 * Datatracker, which finds the customer through that link, showed 0 orders - magento_stamp
 * links the contact, not the order's company. Best effort: a buyer with no company leaves none.
 */
async function linkCompany(orderId: string, contactId: string): Promise<void> {
  try {
    const res = await hs<{ results?: { toObjectId: string | number; associationTypes?: { category?: string; typeId?: number }[] }[] }>({
      path: `/crm/v4/objects/contacts/${contactId}/associations/companies`,
    });
    const all = res.results ?? [];
    const primary = all.find((r) => r.associationTypes?.some((t) => t.category === "HUBSPOT_DEFINED" && t.typeId === 1));
    const company = primary ?? (all.length === 1 ? all[0] : undefined);
    if (company) await hs({ path: `/crm/v4/objects/orders/${orderId}/associations/default/companies/${company.toObjectId}`, method: "PUT" });
  } catch { /* best effort - the contact link already stands */ }
}

/** Link the order to its contact (found by email - never created), the contact's company, and its articles (by SKU). */
async function link(row: { entity_id: string; hs_order_id: string; customer_email: string | null; skus: string[] | null; assoc_retries: number; assoc_first_at: string | null }): Promise<"done" | "pending" | "failed"> {
  let contactId: string | null = null;
  let why = "no email on the order";
  if (row.customer_email) {
    try {
      const c = (await search("contacts", [{ propertyName: "email", operator: "EQ", value: row.customer_email }], ["email"])).results?.[0];
      if (c) {
        await hs({ path: `/crm/v4/objects/orders/${row.hs_order_id}/associations/default/contacts/${c.id}`, method: "PUT" });
        contactId = c.id;
        await linkCompany(row.hs_order_id, c.id);
      } else why = "no contact with this email yet";
    } catch (e) {
      why = `contact: ${(e as Error).message.slice(0, 120)}`;
    }
  }
  // the articles, by SKU - best effort, as before (USER_DEFINED 119, order -> Products & Pricing)
  if (row.assoc_retries === 0) {
    for (const sku of [...new Set(row.skus ?? [])]) {
      try {
        const p = (await search(PP, [{ propertyName: "article_number", operator: "EQ", value: sku }], ["article_number"])).results?.[0];
        if (p) await hs({ path: `/crm/v4/objects/orders/${row.hs_order_id}/associations/${PP}/${p.id}`, method: "PUT", body: [{ associationCategory: "USER_DEFINED", associationTypeId: 119 }] });
      } catch { /* best effort */ }
    }
  }
  if (contactId || !row.customer_email) {
    await q("UPDATE apsomh_mg_stage SET assoc_status='done', contact_id=$2, assoc_next_at=NULL, error_msg=NULL WHERE entity_id=$1", [row.entity_id, contactId]);
    return "done";
  }
  const first = row.assoc_first_at ? Date.parse(row.assoc_first_at) : Date.now();
  if (Date.now() - first > GIVE_UP_HOURS * 3_600_000) {
    await q("UPDATE apsomh_mg_stage SET assoc_status='failed', assoc_next_at=NULL, error_msg=$2 WHERE entity_id=$1",
      [row.entity_id, `no contact after ${GIVE_UP_HOURS} h (${why})`]);
    return "failed";
  }
  await q(`UPDATE apsomh_mg_stage SET assoc_status='pending', assoc_retries=$2, assoc_first_at=COALESCE(assoc_first_at, now()),
           assoc_next_at=now() + interval '30 minutes', error_msg=$3 WHERE entity_id=$1`,
    [row.entity_id, row.assoc_retries + 1, `waiting for the contact: ${why}`]);
  return "pending";
}

/** Put the shop's orders into the staging table - a changed order goes back to "to write". */
async function stage(orders: MagentoOrder[]): Promise<void> {
  for (const o of orders) {
    const props = provisionalProps(o, PIPE);
    const updated = o.updated_at ? new Date(`${String(o.updated_at).replace(" ", "T")}Z`) : null;
    await q(
      `INSERT INTO apsomh_mg_stage
         (entity_id, increment_id, magento_updated_at, magento_status, currency, grand_total,
          customer_email, customer_name, mandant, skus, payload, sync_status, last_seen)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,'pending',now())
       ON CONFLICT (entity_id) DO UPDATE SET
         increment_id=EXCLUDED.increment_id, magento_updated_at=EXCLUDED.magento_updated_at,
         magento_status=EXCLUDED.magento_status, currency=EXCLUDED.currency, grand_total=EXCLUDED.grand_total,
         customer_email=EXCLUDED.customer_email, customer_name=EXCLUDED.customer_name, mandant=EXCLUDED.mandant,
         skus=EXCLUDED.skus, payload=EXCLUDED.payload, last_seen=now(),
         sync_status = CASE WHEN apsomh_mg_stage.magento_updated_at IS DISTINCT FROM EXCLUDED.magento_updated_at
                            THEN 'pending' ELSE apsomh_mg_stage.sync_status END`,
      [o.entity_id, o.increment_id === undefined || o.increment_id === null ? null : String(o.increment_id), updated,
        o.status ?? null, props.hs_currency_code ?? null, o.grand_total ?? null, o.customer_email ?? null,
        props.order_customer_name ?? null, props.order_mandant ?? null, orderSkus(o), JSON.stringify(props)]);
    }
}

/* ── one sweep ─────────────────────────────────────────────────────────── */

const cetHour = () => (new Date().getUTCHours() + 2) % 24;
/** Business hours stay light (live orders in near real time); nights drain a backlog. */
const caps = () => (cetHour() >= 7 && cetHour() < 19 ? { write: 15, relink: 10 } : { write: 100, relink: 80 });

export type SweepResult = { mode: Mode; found: number; written: number; errors: number; error?: string };

async function sweep(mode: Mode, signal?: AbortSignal): Promise<SweepResult> {
  await ensureTables();
  const started = new Date();
  const floor = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const out: SweepResult = { mode, found: 0, written: 0, errors: 0 };
  // a sweep that just failed is not repeated every minute - it waits 10 minutes
  const prev = (await q<{ ok: boolean; started_at: Date }>("SELECT ok, started_at FROM apsomh_mg_runs WHERE mode <> 'readback' ORDER BY id DESC LIMIT 1"))[0];
  if (prev && !prev.ok && Date.now() - new Date(prev.started_at).getTime() < BACKOFF_MS) return out;
  const last = (await q<{ started_at: Date }>("SELECT started_at FROM apsomh_mg_runs WHERE ok AND mode <> 'readback' ORDER BY id DESC LIMIT 1"))[0];
  let since = new Date(Date.now() - FIRST_DAYS * 86_400_000);
  if (last?.started_at) {
    since = new Date(new Date(last.started_at).getTime() - 5 * 60_000);
    if (since < floor) since = floor;
  }
  let skus = "";
  try {
    // STAGE - always
    const orders = await ordersChangedSince(magentoTs(since.toISOString()), { signal });
    out.found = orders.length;
    await stage(orders);
    // the search bar re-reads these articles' stock at once (shop -> bar -> HubSpot), SARCLA 17.10.2026
    if (orders.length) notifyOrderStock(orders.flatMap((o) => orderSkus(o)), orders.length);
    // PROCESS - Active only
    if (mode === "active") {
      const cap = caps();
      const seen = new Set<string>();
      // the last ERP delivery (its pull's start; before pulledAt existed, the end of that run)
      const chain = await hubChain();
      const erpSec = chain?.pulledAt ?? (chain?.pulled ? chain.ts : undefined);
      const erpSince = erpSec ? erpSec * 1000 : undefined;
      // transferred before the first sweep saw it, yet placed after that delivery: write it now
      if (erpSince !== undefined) {
        await q(`UPDATE apsomh_mg_stage SET sync_status='pending' WHERE sync_status='skipped'
                   AND error_msg LIKE 'left to the ERP: the shop says "transferred"%'
                   AND CASE WHEN payload->>'hs_external_created_date' ~ '^[0-9]+$'
                            THEN (payload->>'hs_external_created_date')::bigint > $1 ELSE false END`, [erpSince]);
      }
      const pending = await q<{ entity_id: string; payload: Props; skus: string[] | null; customer_email: string | null }>(
        `SELECT entity_id, payload, skus, customer_email FROM apsomh_mg_stage WHERE sync_status='pending' ORDER BY last_seen ASC LIMIT ${cap.write}`);
      for (const row of pending) {
        stopIfOver(signal);
        (row.skus ?? []).forEach((s) => seen.add(s));
        const bad = validate(row.payload);
        let status = "ok", msg: string | null = bad, hsId: string | null = null;
        if (bad) status = "error";
        else {
          try {
            const r = await upsertOrder({ ...row.payload }, erpSince);
            if ("skipped" in r) { status = "skipped"; msg = r.skipped; } else hsId = r.id;
          } catch (e) { status = "error"; msg = (e as Error).message.slice(0, 300); }
        }
        if (status === "error") out.errors += 1; else if (status === "ok") out.written += 1;
        await q("UPDATE apsomh_mg_stage SET sync_status=$2, error_msg=$3, processed_at=now(), hs_order_id=COALESCE($4, hs_order_id) WHERE entity_id=$1",
          [row.entity_id, status, msg, hsId]);
        if (hsId) {
          await link({ entity_id: row.entity_id, hs_order_id: hsId, customer_email: row.customer_email, skus: row.skus, assoc_retries: 0, assoc_first_at: null })
            .catch((e) => console.warn(`[magento] link ${row.entity_id}: ${(e as Error).message}`));
        }
      }
      const due = await q<{ entity_id: string; hs_order_id: string; customer_email: string | null; skus: string[] | null; assoc_retries: number; assoc_first_at: string | null }>(
        `SELECT entity_id, hs_order_id, customer_email, skus, assoc_retries, assoc_first_at FROM apsomh_mg_stage
          WHERE assoc_status='pending' AND assoc_next_at <= now() AND hs_order_id IS NOT NULL ORDER BY assoc_next_at ASC LIMIT ${cap.relink}`);
      for (const row of due) {
        stopIfOver(signal);
        await link(row).catch((e) => console.warn(`[magento] relink ${row.entity_id}: ${(e as Error).message}`));
      }
      skus = [...seen].slice(0, 40).join(", ");
    }
  } catch (e) {
    out.error = (e as Error).message.slice(0, 300);
  }
  await q(
    `INSERT INTO apsomh_mg_runs (started_at, finished_at, window_from, mode, orders_found, orders_written, errors, ok, error, skus)
     VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9)`,
    [started, since, mode, out.found, out.written, out.errors, !out.error, out.error ?? null, skus || null]);
  await q(`DELETE FROM apsomh_mg_stage WHERE sync_status IN ('ok','cancelled','skipped') AND processed_at < now() - interval '${RETENTION_DAYS} days'`);
  if (Math.random() < 0.03) await q("DELETE FROM apsomh_mg_runs WHERE id < (SELECT min(id) FROM (SELECT id FROM apsomh_mg_runs ORDER BY id DESC LIMIT 5000) t)");
  // a line whenever the shop changed something (quiet otherwise - a line a minute would drown the log)
  if (out.error || out.found || out.written || out.errors) console.log(`[magento] sweep (${mode}): ${out.found} changed in the shop, ${out.written} written, ${out.errors} failed${out.error ? ` - FAILED ${out.error}` : ""}`);
  return out;
}

/** Since when this copy has found the lock taken by the other one, and when the log last said so. */
let lockTakenSince: number | null = null;
let lockWarnedAt = 0;

/**
 * One sweep under the sync's own lock (one copy of the hub at a time); null when the other copy
 * has it. When `signal` aborts (the time limit), the lock's connection is closed, so Postgres
 * frees the lock even if the sweep never comes back.
 */
export async function runSweep(signal?: AbortSignal): Promise<SweepResult | null> {
  if (!magentoConfigured()) return null;
  const mode = await getMode();
  if (mode === "off") return null;
  const client = await getPool().connect();
  let dropped = false;
  const drop = () => { dropped = true; client.release(new Error("the sweep's time limit")); };
  if (signal?.aborted) drop(); else signal?.addEventListener("abort", drop, { once: true });
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) {
      const now = Date.now();
      lockTakenSince ??= now;
      if (now - lockTakenSince >= LOCK_WARN_MS && now - lockWarnedAt >= LOCK_WARN_MS) {
        lockWarnedAt = now;
        console.warn(`[magento] the other copy has held the sync's lock for ${Math.round((now - lockTakenSince) / 60_000)} min - no sweep from here meanwhile`);
      }
      return null;
    }
    lockTakenSince = null;
    try {
      return await sweep(mode, signal);
    } finally {
      if (!dropped) await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    signal?.removeEventListener("abort", drop);
    if (!dropped) client.release();
  }
}

let started = false;
let running = false;

/**
 * Every minute, from the first minute after boot. MAGENTO_SYNC=off stops it entirely. A sweep
 * past SWEEP_LIMIT_MS is stopped: its lock goes, and the next minute starts a fresh one.
 */
export function startMagentoSync() {
  if (started || process.env.MAGENTO_SYNC === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const limit = new AbortController();
    const timer = setTimeout(() => {
      console.error(`[magento] sweep still running after ${SWEEP_LIMIT_MS / 60_000} min - stopped and its lock dropped; the next minute starts a new one`);
      limit.abort();
      running = false;
    }, SWEEP_LIMIT_MS);
    timer.unref?.();
    void runSweep(limit.signal)
      .catch((e) => console.warn(`[magento] sweep: ${(e as Error).message}`))
      .finally(() => {
        clearTimeout(timer);
        // a sweep stopped by the limit already handed its turn on
        if (!limit.signal.aborted) running = false;
      });
  };
  setTimeout(tick, 60_000).unref?.();
  setInterval(tick, 60_000).unref?.();
}

/**
 * Read the shop's orders of the last `days` into the staging table - nothing is written to
 * HubSpot. For the side-by-side test before a switch: a few hundred orders to compare the
 * same day instead of waiting for them to come in (SARCLA, 11.10.2026). Under the sync's lock.
 */
export async function readBack(days: number): Promise<{ staged: number } | null> {
  if (!magentoConfigured()) throw new Error("the shop's login (MAGENTO_*) is not set in the hub");
  await ensureTables();
  const client = await getPool().connect();
  try {
    // its own lock: one read back at a time, while the minute sweeps go on
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [READBACK_LOCK]);
    if (!got.rows[0]?.ok) return null;
    const started = new Date();
    let staged = 0;
    const since = new Date(Date.now() - Math.min(30, Math.max(1, days)) * 86_400_000);
    // recorded as a run of its own (mode "readback") - the sweeps list shows it, the sweeps' window ignores it
    const record = (found: number, error: string | null) => q(
      `INSERT INTO apsomh_mg_runs (started_at, finished_at, window_from, mode, orders_found, ok, error) VALUES ($1, now(), $2, 'readback', $3, $4, $5)`,
      [started, since, found, !error, error]);
    try {
      // each page staged as it comes, so a failure late in the week keeps what was read
      await ordersChangedSince(magentoTs(since.toISOString()), {
        pauseMs: 500,
        onPage: async (items, page, total) => {
          await stage(items);
          staged += items.length;
          if (page === 1 || page % 20 === 0) console.log(`[magento] read back ${days} days: ${staged} of ${total} orders staged, ${Math.round((Date.now() - started.getTime()) / 1000)} s`);
        },
      });
      await record(staged, null);
      console.log(`[magento] read back ${days} days: ${staged} orders staged (nothing written to HubSpot)`);
      return { staged };
    } catch (e) {
      await record(staged, `${(e as Error).message.slice(0, 250)} - ${staged} orders staged before`).catch(() => {});
      console.warn(`[magento] read back ${days} days: stopped after ${staged} orders - ${(e as Error).message}`);
      throw e;
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [READBACK_LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

/* ── for the page ──────────────────────────────────────────────────────── */

export type StageRow = {
  entity_id: string; increment_id: string | null; magento_status: string | null; currency: string | null; grand_total: string | null;
  customer_name: string | null; sync_status: string; error_msg: string | null; last_seen: string; processed_at: string | null;
  hs_order_id: string | null; assoc_status: string | null; assoc_retries: number;
  /** When the order was placed in the shop (epoch ms, as text), and its distinct articles. */
  placed: string | null; lines: number;
};

export type Run = {
  id: string; started_at: string; finished_at: string | null; window_from: string | null; mode: string;
  orders_found: number; orders_written: number; errors: number; ok: boolean; error: string | null; skus: string | null;
};
// id as text for the page - ORDER BY must name apsomh_mg_runs.id, or it sorts the text ("999" above "1000")
const RUN_COLS = "id::text, started_at, finished_at, window_from, mode, orders_found, orders_written, errors, ok, error, skus";
/** Midnight in Zurich, as the database's instant. */
const TODAY = "(date_trunc('day', now() AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich')";

export async function status() {
  await ensureTables();
  const [mode, counts, assoc, runs, today, placed] = await Promise.all([
    getMode(),
    q<{ sync_status: string; n: string }>("SELECT sync_status, count(*)::text AS n FROM apsomh_mg_stage GROUP BY 1"),
    q<{ assoc_status: string; n: string }>("SELECT assoc_status, count(*)::text AS n FROM apsomh_mg_stage WHERE assoc_status IS NOT NULL GROUP BY 1"),
    q<Run>(`SELECT ${RUN_COLS} FROM apsomh_mg_runs WHERE mode <> 'readback' ORDER BY apsomh_mg_runs.id DESC LIMIT 1`),
    q<{ n: string }>(`SELECT count(*)::text AS n FROM apsomh_mg_stage WHERE sync_status='ok' AND processed_at >= ${TODAY} AND error_msg IS DISTINCT FROM 'written by the old connector'`),
    q<{ n: string }>(`SELECT count(*)::text AS n FROM apsomh_mg_stage WHERE (payload->>'hs_external_created_date')::bigint >= extract(epoch FROM ${TODAY}) * 1000`),
  ]);
  return {
    mode, configured: magentoConfigured(),
    counts: Object.fromEntries(counts.map((r) => [r.sync_status, Number(r.n)])),
    assoc: Object.fromEntries(assoc.map((r) => [r.assoc_status, Number(r.n)])),
    runs, writtenToday: Number(today[0]?.n ?? 0), placedToday: Number(placed[0]?.n ?? 0),
  };
}

export type Overview = {
  /** The orders the hub read (last 30 days), by their status in the shop. */
  shop: { status: string; n: number }[];
  /** The last 24 hours, hour by hour: orders changed in the shop, written, sweeps that failed. */
  hours: { hour: string; found: number; written: number; failed: number }[];
  /** What needs a look: held orders by reason, contacts still missing. */
  look: { kind: "held" | "contact"; why: string; n: number }[];
};

export async function overview(): Promise<Overview> {
  await ensureTables();
  const [shop, hours, look] = await Promise.all([
    q<{ status: string; n: number }>(`SELECT COALESCE(magento_status, '(none)') AS status, count(*)::int AS n FROM apsomh_mg_stage
       WHERE last_seen >= now() - interval '30 days' GROUP BY 1 ORDER BY count(*) DESC`),
    q<{ hour: Date; found: number; written: number; failed: number }>(`SELECT date_trunc('hour', started_at) AS hour, sum(orders_found)::int AS found,
       sum(orders_written)::int AS written, (count(*) FILTER (WHERE NOT ok))::int AS failed
       FROM apsomh_mg_runs WHERE started_at >= now() - interval '24 hours' AND mode <> 'readback' GROUP BY 1`),
    q<{ kind: "held" | "contact"; why: string; n: number }>(`
       SELECT 'held' AS kind, COALESCE(left(error_msg, 60), 'no reason given') AS why, count(*)::int AS n FROM apsomh_mg_stage WHERE sync_status='error' GROUP BY 2
       UNION ALL
       SELECT 'contact', CASE WHEN assoc_status='failed' THEN 'no contact after 24 h' ELSE 'waiting for the contact' END, count(*)::int
         FROM apsomh_mg_stage WHERE assoc_status IN ('pending','failed') GROUP BY 2`),
  ]);
  // every hour of the last 24, the quiet ones too
  const byHour = new Map(hours.map((h) => [new Date(h.hour).toISOString(), h]));
  const now = new Date(); now.setUTCMinutes(0, 0, 0);
  const all = Array.from({ length: 24 }, (_, i) => {
    const hour = new Date(now.getTime() - (23 - i) * 3_600_000).toISOString();
    const h = byHour.get(hour);
    return { hour, found: h?.found ?? 0, written: h?.written ?? 0, failed: h?.failed ?? 0 };
  });
  return { shop, hours: all, look: look.sort((a, b) => b.n - a.n) };
}

export type SweepFilter = "busy" | "failed" | "all";

/** The sweeps, newest first: those that found or wrote something (the minute-by-minute quiet ones hidden), the failed, or all. */
export async function sweeps(filter: SweepFilter, page = 0, size = 25) {
  await ensureTables();
  const where = filter === "failed" ? "NOT ok" : filter === "busy" ? "(orders_found > 0 OR orders_written > 0 OR errors > 0 OR NOT ok)" : "true";
  const [list, total, today] = await Promise.all([
    q<Run>(`SELECT ${RUN_COLS} FROM apsomh_mg_runs WHERE ${where} ORDER BY apsomh_mg_runs.id DESC LIMIT ${size} OFFSET ${page * size}`),
    q<{ n: string }>(`SELECT count(*)::text AS n FROM apsomh_mg_runs WHERE ${where}`),
    q<{ sweeps: number; failed: number; found: number; written: number }>(`SELECT count(*)::int AS sweeps, (count(*) FILTER (WHERE NOT ok))::int AS failed,
       COALESCE(sum(orders_found), 0)::int AS found, COALESCE(sum(orders_written), 0)::int AS written
       FROM apsomh_mg_runs WHERE started_at >= ${TODAY} AND mode <> 'readback'`),
  ]);
  return { rows: list, total: Number(total[0]?.n ?? 0), today: today[0] ?? { sweeps: 0, failed: 0, found: 0, written: 0 } };
}

const SYNC_STATES = ["pending", "ok", "error", "cancelled", "skipped"];

export async function rows(kind: "orders" | "held" | "contacts", page = 0, opts: { state?: string; find?: string } = {}, size = 25): Promise<{ rows: StageRow[]; total: number }> {
  await ensureTables();
  const conds = [kind === "held" ? "sync_status='error'" : kind === "contacts" ? "assoc_status IN ('pending','failed')" : "true"];
  const args: unknown[] = [];
  if (opts.state && SYNC_STATES.includes(opts.state)) { args.push(opts.state); conds.push(`sync_status=$${args.length}`); }
  const find = opts.find?.trim();
  if (find) { args.push(`%${find}%`); conds.push(`(increment_id ILIKE $${args.length} OR customer_name ILIKE $${args.length} OR customer_email ILIKE $${args.length})`); }
  const where = conds.join(" AND ");
  const cols = `entity_id::text, increment_id, magento_status, currency, grand_total::text, customer_name, sync_status, error_msg, last_seen, processed_at,
    hs_order_id, assoc_status, assoc_retries, payload->>'hs_external_created_date' AS placed, COALESCE(array_length(skus, 1), 0) AS lines`;
  const [list, total] = await Promise.all([
    q<StageRow>(`SELECT ${cols} FROM apsomh_mg_stage WHERE ${where} ORDER BY last_seen DESC LIMIT ${size} OFFSET ${page * size}`, args),
    q<{ n: string }>(`SELECT count(*)::text AS n FROM apsomh_mg_stage WHERE ${where}`, args),
  ]);
  return { rows: list, total: Number(total[0]?.n ?? 0) };
}

/** A held order again on the next sweep, or set aside. */
export async function act(entityId: string, action: "retry" | "cancel" | "relink"): Promise<boolean> {
  await ensureTables();
  const sql = action === "retry" ? "UPDATE apsomh_mg_stage SET sync_status='pending', error_msg=NULL WHERE entity_id=$1 AND sync_status='error'"
    : action === "cancel" ? "UPDATE apsomh_mg_stage SET sync_status='cancelled', processed_at=now() WHERE entity_id=$1 AND sync_status='error'"
      : "UPDATE apsomh_mg_stage SET assoc_status='pending', assoc_retries=0, assoc_first_at=now(), assoc_next_at=now() WHERE entity_id=$1 AND assoc_status IN ('pending','failed')";
  const r = await getPool().query(sql, [entityId]);
  return (r.rowCount ?? 0) > 0;
}

/* ── the side-by-side test ─────────────────────────────────────────────── */

export type Comparison = {
  /** notInHubSpot: the hub would create these; leftToErp: HubSpot does not hold them and the hub would not create them (the ERP has them). */
  checked: number; notInHubSpot: number; leftToErp: number; identical: number; differing: number;
  fields: Record<string, number>; examples: { order: string; field: string; hub: string; hubspot: string | null }[];
};

/**
 * The staged orders (newest first, up to 1,500 - a week read back) against HubSpot: every field the hub would write, compared with
 * what HubSpot holds now - written by the old connector while the hub only reads. An order
 * the ERP has linked is compared on the shop's fields only (rules.ts writableProps).
 */
export async function compareWithHubSpot(limit = 1500): Promise<Comparison> {
  await ensureTables();
  const staged = await q<{ increment_id: string; payload: Props }>(
    "SELECT increment_id, payload FROM apsomh_mg_stage WHERE increment_id IS NOT NULL AND payload IS NOT NULL ORDER BY last_seen DESC LIMIT $1", [limit]);
  const out: Comparison = { checked: 0, notInHubSpot: 0, leftToErp: 0, identical: 0, differing: 0, fields: {}, examples: [] };
  for (let i = 0; i < staged.length; i += 100) {
    const chunk = staged.slice(i, i + 100);
    // the A-number and the state too: whether the ERP linked an order decides what the hub may write
    const keys = [...new Set([...chunk.flatMap((r) => Object.keys(r.payload)), "order_order_number", "order_reconcile_state"])];
    const held = byWebNumber(await ordersByWebNumber(chunk.map((r) => r.increment_id), keys));
    for (const r of chunk) {
      out.checked += 1;
      const all = held.get(r.increment_id) ?? [];
      // split into deliveries: the hub leaves it to the ERP, as it would when writing
      if (all.length > 1) { out.leftToErp += 1; continue; }
      const hs = all[0]?.properties;
      if (!hs) { if (mayNotCreate(r.payload)) out.leftToErp += 1; else out.notInHubSpot += 1; continue; }
      let diff = false;
      for (const [k, v] of Object.entries(writableProps(r.payload, hs))) {
        if (same(v, hs[k])) continue;
        diff = true;
        out.fields[k] = (out.fields[k] ?? 0) + 1;
        if (out.examples.length < 20) out.examples.push({ order: r.increment_id, field: k, hub: v, hubspot: hs[k] ?? null });
      }
      if (diff) out.differing += 1; else out.identical += 1;
    }
  }
  return out;
}
