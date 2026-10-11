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
// guessed from the billing name (the Compass sync's magento_stamp sets the right one);
// a contact that never turns up is given up after 24 hours instead of retried for ever.

import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { magentoConfigured } from "@/lib/doc/config";
import { magentoGet } from "@/lib/doc/magento";
import { magentoTs, orderSkus, provisionalProps, validate, writableProps, type MagentoOrder, type Props } from "./rules";

export type Mode = "off" | "stage" | "active";
const KV_MODE = "connectors:magento:mode";
const LOCK = 4_107_210;
const PIPE = { pipelineId: process.env.MAGENTO_HUBSPOT_PIPELINE ?? "3687945443", pipelineStage: process.env.MAGENTO_HUBSPOT_STAGE ?? "5093087452" };
const PP = "2-200042439";
const WINDOW_DAYS = 30;
const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const RETENTION_DAYS = 30;
const GIVE_UP_HOURS = 24;

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
 * Switch. Going Active marks what was staged more than 10 minutes ago as handled: the old
 * connector wrote those, and re-writing 30 days of orders would only cost HubSpot calls.
 */
export async function setMode(m: Mode): Promise<{ marked: number }> {
  let marked = 0;
  if (m === "active" && (await getMode()) !== "active") {
    await ensureTables();
    const r = await getPool().query(
      `UPDATE apsomh_mg_stage SET sync_status='ok', error_msg='written by the old connector', processed_at=now()
        WHERE sync_status='pending' AND last_seen < now() - interval '10 minutes'`);
    marked = r.rowCount ?? 0;
  }
  await kvSet(KV_MODE, m);
  return { marked };
}

/* ── the shop ──────────────────────────────────────────────────────────── */

async function ordersChangedSince(sinceIso: string): Promise<MagentoOrder[]> {
  const all: MagentoOrder[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const qs = [
      "searchCriteria[filterGroups][0][filters][0][field]=updated_at",
      `searchCriteria[filterGroups][0][filters][0][value]=${encodeURIComponent(sinceIso)}`,
      "searchCriteria[filterGroups][0][filters][0][conditionType]=gteq",
      "searchCriteria[sortOrders][0][field]=updated_at",
      "searchCriteria[sortOrders][0][direction]=ASC",
      `searchCriteria[pageSize]=${PAGE_SIZE}`,
      `searchCriteria[currentPage]=${page}`,
    ].join("&");
    const r = await magentoGet(`/rest/V1/orders?${qs}`);
    if (r.status !== 200) throw new Error(`the shop answered ${r.status || "nothing"} to the orders request`);
    const j = (r.json ?? {}) as { items?: MagentoOrder[]; total_count?: number };
    const items = Array.isArray(j.items) ? j.items : [];
    all.push(...items);
    if (items.length < PAGE_SIZE || all.length >= (j.total_count ?? 0)) break;
  }
  return all;
}

/* ── HubSpot ───────────────────────────────────────────────────────────── */

type Found = { id: string; properties?: Record<string, string | null> };
const search = (obj: string, filters: object[], properties: string[], limit = 1) =>
  hubspotFetchJson<{ results?: Found[] }>({ path: `/crm/v3/objects/${obj}/search`, method: "POST", body: { filterGroups: [{ filters }], properties, limit } });

/** Create or update the order by its web order number; an order the ERP linked keeps its ERP fields. */
async function upsertOrder(props: Props): Promise<string> {
  const found = (await search("orders", [{ propertyName: "hs_external_order_id", operator: "EQ", value: props.hs_external_order_id }],
    ["order_order_number", "order_reconcile_state"])).results?.[0];
  if (found) {
    const write = writableProps(props, found.properties ?? null);
    await hubspotFetchJson({ path: `/crm/v3/objects/orders/${found.id}`, method: "PATCH", body: { properties: write } });
    return found.id;
  }
  const made = await hubspotFetchJson<{ id?: string }>({ path: "/crm/v3/objects/orders", method: "POST", body: { properties: props } });
  if (!made.id) throw new Error("HubSpot created the order but returned no id");
  return made.id;
}

/** Link the order to its contact (found by email - never created) and to its articles (by SKU). */
async function link(row: { entity_id: string; hs_order_id: string; customer_email: string | null; skus: string[] | null; assoc_retries: number; assoc_first_at: string | null }): Promise<"done" | "pending" | "failed"> {
  let contactId: string | null = null;
  let why = "no email on the order";
  if (row.customer_email) {
    try {
      const c = (await search("contacts", [{ propertyName: "email", operator: "EQ", value: row.customer_email }], ["email"])).results?.[0];
      if (c) {
        await hubspotFetchJson({ path: `/crm/v4/objects/orders/${row.hs_order_id}/associations/default/contacts/${c.id}`, method: "PUT" });
        contactId = c.id;
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
        if (p) await hubspotFetchJson({ path: `/crm/v4/objects/orders/${row.hs_order_id}/associations/${PP}/${p.id}`, method: "PUT", body: [{ associationCategory: "USER_DEFINED", associationTypeId: 119 }] });
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

/* ── one sweep ─────────────────────────────────────────────────────────── */

const cetHour = () => (new Date().getUTCHours() + 2) % 24;
/** Business hours stay light (live orders in near real time); nights drain a backlog. */
const caps = () => (cetHour() >= 7 && cetHour() < 19 ? { write: 15, relink: 10 } : { write: 100, relink: 80 });

export type SweepResult = { mode: Mode; found: number; written: number; errors: number; error?: string };

async function sweep(mode: Mode): Promise<SweepResult> {
  await ensureTables();
  const started = new Date();
  const floor = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const last = (await q<{ started_at: Date }>("SELECT started_at FROM apsomh_mg_runs WHERE ok ORDER BY id DESC LIMIT 1"))[0];
  let since = floor;
  if (last?.started_at) {
    since = new Date(new Date(last.started_at).getTime() - 5 * 60_000);
    if (since < floor) since = floor;
  }
  const out: SweepResult = { mode, found: 0, written: 0, errors: 0 };
  let skus = "";
  try {
    // STAGE - always
    const orders = await ordersChangedSince(magentoTs(since.toISOString()));
    out.found = orders.length;
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
    // PROCESS - Active only
    if (mode === "active") {
      const cap = caps();
      const seen = new Set<string>();
      const pending = await q<{ entity_id: string; payload: Props; skus: string[] | null; customer_email: string | null }>(
        `SELECT entity_id, payload, skus, customer_email FROM apsomh_mg_stage WHERE sync_status='pending' ORDER BY last_seen ASC LIMIT ${cap.write}`);
      for (const row of pending) {
        (row.skus ?? []).forEach((s) => seen.add(s));
        const bad = validate(row.payload);
        let status = "ok", msg: string | null = bad, hsId: string | null = null;
        if (bad) status = "error";
        else {
          try { hsId = await upsertOrder({ ...row.payload }); } catch (e) { status = "error"; msg = (e as Error).message.slice(0, 300); }
        }
        if (status === "error") out.errors += 1; else out.written += 1;
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
      for (const row of due) await link(row).catch((e) => console.warn(`[magento] relink ${row.entity_id}: ${(e as Error).message}`));
      skus = [...seen].slice(0, 40).join(", ");
    }
  } catch (e) {
    out.error = (e as Error).message.slice(0, 300);
  }
  await q(
    `INSERT INTO apsomh_mg_runs (started_at, finished_at, window_from, mode, orders_found, orders_written, errors, ok, error, skus)
     VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9)`,
    [started, since, mode, out.found, out.written, out.errors, !out.error, out.error ?? null, skus || null]);
  await q(`DELETE FROM apsomh_mg_stage WHERE sync_status IN ('ok','cancelled') AND processed_at < now() - interval '${RETENTION_DAYS} days'`);
  if (Math.random() < 0.03) await q("DELETE FROM apsomh_mg_runs WHERE id < (SELECT min(id) FROM (SELECT id FROM apsomh_mg_runs ORDER BY id DESC LIMIT 5000) t)");
  // a line whenever the shop changed something (quiet otherwise - a line a minute would drown the log)
  if (out.error || out.found || out.written || out.errors) console.log(`[magento] sweep (${mode}): ${out.found} changed in the shop, ${out.written} written, ${out.errors} failed${out.error ? ` - FAILED ${out.error}` : ""}`);
  return out;
}

/** One sweep under the sync's own lock (one copy of the hub at a time); null when the other copy has it. */
export async function runSweep(): Promise<SweepResult | null> {
  if (!magentoConfigured()) return null;
  const mode = await getMode();
  if (mode === "off") return null;
  const client = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await sweep(mode);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

let started = false;
let running = false;

/** Every minute, from the first minute after boot. MAGENTO_SYNC=off stops it entirely. */
export function startMagentoSync() {
  if (started || process.env.MAGENTO_SYNC === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    void runSweep().catch((e) => console.warn(`[magento] sweep: ${(e as Error).message}`)).finally(() => { running = false; });
  };
  setTimeout(tick, 60_000).unref?.();
  setInterval(tick, 60_000).unref?.();
}

/* ── for the page ──────────────────────────────────────────────────────── */

export type StageRow = {
  entity_id: string; increment_id: string | null; magento_status: string | null; currency: string | null; grand_total: string | null;
  customer_name: string | null; sync_status: string; error_msg: string | null; last_seen: string; processed_at: string | null;
  hs_order_id: string | null; assoc_status: string | null; assoc_retries: number;
};

export async function status() {
  await ensureTables();
  const [mode, counts, assoc, runs, today] = await Promise.all([
    getMode(),
    q<{ sync_status: string; n: string }>("SELECT sync_status, count(*)::text AS n FROM apsomh_mg_stage GROUP BY 1"),
    q<{ assoc_status: string; n: string }>("SELECT assoc_status, count(*)::text AS n FROM apsomh_mg_stage WHERE assoc_status IS NOT NULL GROUP BY 1"),
    q("SELECT id, started_at, finished_at, mode, orders_found, orders_written, errors, ok, error, skus FROM apsomh_mg_runs ORDER BY id DESC LIMIT 20"),
    q<{ n: string }>("SELECT count(*)::text AS n FROM apsomh_mg_stage WHERE sync_status='ok' AND processed_at >= date_trunc('day', now())"),
  ]);
  return {
    mode, configured: magentoConfigured(),
    counts: Object.fromEntries(counts.map((r) => [r.sync_status, Number(r.n)])),
    assoc: Object.fromEntries(assoc.map((r) => [r.assoc_status, Number(r.n)])),
    runs, writtenToday: Number(today[0]?.n ?? 0),
  };
}

export async function rows(kind: "orders" | "held" | "contacts", page = 0, size = 25): Promise<{ rows: StageRow[]; total: number }> {
  await ensureTables();
  const where = kind === "held" ? "sync_status='error'" : kind === "contacts" ? "assoc_status IN ('pending','failed')" : "true";
  const cols = "entity_id::text, increment_id, magento_status, currency, grand_total::text, customer_name, sync_status, error_msg, last_seen, processed_at, hs_order_id, assoc_status, assoc_retries";
  const [list, total] = await Promise.all([
    q<StageRow>(`SELECT ${cols} FROM apsomh_mg_stage WHERE ${where} ORDER BY last_seen DESC LIMIT ${size} OFFSET ${page * size}`),
    q<{ n: string }>(`SELECT count(*)::text AS n FROM apsomh_mg_stage WHERE ${where}`),
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

/** Two values the same, as HubSpot stores them: numbers as numbers, dates and datetimes as instants. */
function same(ours: string, theirs: string | null | undefined): boolean {
  if (theirs === null || theirs === undefined) return false;
  if (ours === theirs) return true;
  const a = Number(ours), b = Number(theirs);
  if (Number.isFinite(a) && Number.isFinite(b)) return a === b;
  // ours: epoch ms; HubSpot: "2026-10-10T14:28:03Z" (datetime) or "2026-10-10" (date)
  if (/^\d{10,}$/.test(ours) && /^\d{4}-\d{2}-\d{2}/.test(theirs)) return Number(ours) === Date.parse(theirs.length === 10 ? `${theirs}T00:00:00Z` : theirs);
  return ours.trim() === theirs.trim();
}

export type Comparison = {
  checked: number; notInHubSpot: number; identical: number; differing: number;
  fields: Record<string, number>; examples: { order: string; field: string; hub: string; hubspot: string | null }[];
};

/**
 * The newest staged orders against HubSpot: every field the hub would write, compared with
 * what HubSpot holds now - written by the old connector while the hub only reads. An order
 * the ERP has linked is compared on the shop's fields only (rules.ts writableProps).
 */
export async function compareWithHubSpot(limit = 200): Promise<Comparison> {
  await ensureTables();
  const staged = await q<{ increment_id: string; payload: Props }>(
    "SELECT increment_id, payload FROM apsomh_mg_stage WHERE increment_id IS NOT NULL AND payload IS NOT NULL ORDER BY last_seen DESC LIMIT $1", [limit]);
  const out: Comparison = { checked: 0, notInHubSpot: 0, identical: 0, differing: 0, fields: {}, examples: [] };
  for (let i = 0; i < staged.length; i += 100) {
    const chunk = staged.slice(i, i + 100);
    const keys = [...new Set(chunk.flatMap((r) => Object.keys(r.payload)))];
    const found = await hubspotFetchJson<{ results?: Found[] }>({
      path: "/crm/v3/objects/orders/search", method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: "hs_external_order_id", operator: "IN", values: chunk.map((r) => r.increment_id) }] }], properties: keys, limit: 100 },
    });
    const byInc = new Map((found.results ?? []).map((o) => [o.properties?.hs_external_order_id ?? "", o.properties ?? {}]));
    for (const r of chunk) {
      out.checked += 1;
      const hs = byInc.get(r.increment_id);
      if (!hs) { out.notInHubSpot += 1; continue; }
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
