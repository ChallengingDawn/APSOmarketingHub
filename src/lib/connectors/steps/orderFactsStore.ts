// Where the order facts live between the steps (rules in ./orderFactsRules.ts). Two Postgres tables, created on first use:
// - apsomh_cx_erp_order_facts: what the morning workbook's sheets gave - per order ("B:" + the number without its
//   suffix: first confirmed date, special articles, shipment status) and per delivery ("O:" + its number: the invoice).
//   Written by the ERP revenue step each morning - added to, never emptied; read by order_sync at night.
// - apsomh_cx_order_facts_written: per HubSpot order id, what order_sync last wrote (the facts' hash) - so a night
//   writes only the orders whose facts changed.

import { query } from "@/lib/db/client";
import type { Facts } from "./orderFactsRules";

const ERP = "apsomh_cx_erp_order_facts";
const WRITTEN = "apsomh_cx_order_facts_written";
let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS ${ERP} (key text PRIMARY KEY, facts text NOT NULL, at timestamptz NOT NULL DEFAULT now())`);
      await query(`CREATE TABLE IF NOT EXISTS ${WRITTEN} (id text PRIMARY KEY, hash text NOT NULL, at timestamptz NOT NULL DEFAULT now())`);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

/** The sheets' facts, added to what is kept: a fact is replaced when a file gives it again, never dropped - so the history
 *  loaded once (the invoices since 2020, SARCLA 08.11.2026: "also historicals") stays when the daily file covers 13 months. */
export async function saveErpFacts(byBase: Map<string, Facts>, byOrder: Map<string, Facts>): Promise<{ orders: number; deliveries: number }> {
  await ensure();
  const at = new Date().toISOString();
  const rows: [string, string][] = [...[...byBase].map(([k, f]) => [`B:${k}`, JSON.stringify(f)] as [string, string]), ...[...byOrder].map(([k, f]) => [`O:${k}`, JSON.stringify(f)] as [string, string])];
  for (let i = 0; i < rows.length; i += 1000) {
    const part = rows.slice(i, i + 1000);
    await query(`INSERT INTO ${ERP} (key, facts, at) SELECT k, f, $3::timestamptz FROM unnest($1::text[], $2::text[]) AS t(k, f)
      ON CONFLICT (key) DO UPDATE SET facts = EXCLUDED.facts, at = EXCLUDED.at`, [part.map((r) => r[0]), part.map((r) => r[1]), at]);
  }
  return { orders: byBase.size, deliveries: byOrder.size };
}

export async function loadErpFacts(): Promise<{ byBase: Map<string, Facts>; byOrder: Map<string, Facts> }> {
  await ensure();
  const r = await query<{ key: string; facts: string }>(`SELECT key, facts FROM ${ERP}`);
  const byBase = new Map<string, Facts>(), byOrder = new Map<string, Facts>();
  for (const x of r.rows) {
    try { (x.key.startsWith("B:") ? byBase : byOrder).set(x.key.slice(2), JSON.parse(x.facts) as Facts); } catch { /* a bad row is skipped */ }
  }
  return { byBase, byOrder };
}

export async function loadWritten(): Promise<Map<string, string>> {
  await ensure();
  const r = await query<{ id: string; hash: string }>(`SELECT id, hash FROM ${WRITTEN}`);
  return new Map(r.rows.map((x) => [x.id, x.hash]));
}
export async function saveWritten(rows: [id: string, hash: string][]): Promise<void> {
  if (!rows.length) return;
  await ensure();
  for (let i = 0; i < rows.length; i += 1000) {
    const part = rows.slice(i, i + 1000);
    await query(`INSERT INTO ${WRITTEN} (id, hash, at) SELECT i, h, now() FROM unnest($1::text[], $2::text[]) AS t(i, h)
      ON CONFLICT (id) DO UPDATE SET hash = EXCLUDED.hash, at = now()`, [part.map((r) => r[0]), part.map((r) => r[1])]);
  }
}
