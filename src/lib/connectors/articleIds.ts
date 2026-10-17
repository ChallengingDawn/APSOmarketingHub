// THE ERP'S INTERNAL ARTICLE IDS, REMEMBERED (SARCLA 17.10.2026: "we have articles without
// profit centre - this is not possible, we need to fix it").
//
// An ERP order line (fct_orderlinehist) never carries the 10-digit article number: it has the
// ERP's internal id (ArticleNumber, e.g. 178251) and a key into the article master
// (dim_article_key -> dim_article: 1222010102, profit centre DT, the text). A made-to-order
// article (8000...) is created the day it is ordered: that day's order lines use it, that
// day's dim_article does not have it yet - the hub then wrote the internal id with no profit
// centre and never came back. So the hub keeps here every internal id it has resolved, and
// the HubSpot orders whose lines it could not resolve yet; steps/articleMemory.ts repairs them
// once a later delivery knows the article. Two small tables, created on first use.
//
// A key is what an order line carries: the ERP's internal id - or, for a line the old fixmap
// resolved to its 10-digit article without a profit centre, that article number (an internal id
// is never 10 digits), answered by dim_article's own row for the article.

import { query } from "@/lib/db/client";
import type { ArtInfo } from "./steps/orderRules";

const IDS = "apsomh_article_ids";
const PENDING = "apsomh_article_pending";
const CHUNK = 2000;

let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS ${IDS} (
        internal_id text PRIMARY KEY,
        article text NOT NULL,
        pc text NOT NULL DEFAULT '',
        text text NOT NULL DEFAULT '',
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS ${PENDING} (
        order_id text NOT NULL,
        internal_id text NOT NULL,
        first_seen timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (order_id, internal_id)
      )`);
      // the profit centre the line borrowed from its order or customer ('' = nothing to borrow);
      // NULL = not tried. The row stays: the real answer still replaces it (18.10.2026)
      await query(`ALTER TABLE ${PENDING} ADD COLUMN IF NOT EXISTS borrowed_pc text`);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

/** internal id -> [profit centre, article, text]; a later delivery's answer replaces an older one. */
export async function rememberArticles(rows: [id: string, info: ArtInfo][]): Promise<number> {
  const all = new Map<string, ArtInfo>();
  for (const [id, info] of rows) if (id && info[1]) all.set(id, info);
  if (!all.size) return 0;
  await ensure();
  const list = [...all.entries()];
  for (let i = 0; i < list.length; i += CHUNK) {
    const c = list.slice(i, i + CHUNK);
    await query(
      `INSERT INTO ${IDS} (internal_id, article, pc, text, updated_at)
       SELECT v.id, v.article, v.pc, v.text, now() FROM unnest($1::text[], $2::text[], $3::text[], $4::text[]) AS v(id, article, pc, text)
       ON CONFLICT (internal_id) DO UPDATE SET article = EXCLUDED.article, pc = EXCLUDED.pc, text = EXCLUDED.text, updated_at = now()`,
      [c.map((r) => r[0]), c.map((r) => r[1][1]), c.map((r) => r[1][0]), c.map((r) => r[1][2])],
    );
  }
  return all.size;
}

/** What the hub knows about these internal ids. */
export async function knownArticles(ids: string[]): Promise<Map<string, ArtInfo>> {
  const out = new Map<string, ArtInfo>();
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return out;
  await ensure();
  for (let i = 0; i < uniq.length; i += CHUNK) {
    const r = await query<{ internal_id: string; article: string; pc: string; text: string }>(
      `SELECT internal_id, article, pc, text FROM ${IDS} WHERE internal_id = ANY($1::text[])`, [uniq.slice(i, i + CHUNK)],
    );
    for (const x of r.rows) out.set(x.internal_id, [x.pc, x.article, x.text]);
  }
  return out;
}

/** HubSpot orders with a line the hub could not resolve yet (internal id still on it). */
export async function addPending(rows: [orderId: string, id: string][]): Promise<number> {
  const all = new Map<string, [string, string]>();
  for (const r of rows) if (r[0] && r[1]) all.set(`${r[0]}|${r[1]}`, r);
  if (!all.size) return 0;
  await ensure();
  const list = [...all.values()];
  for (let i = 0; i < list.length; i += CHUNK) {
    const c = list.slice(i, i + CHUNK);
    await query(
      `INSERT INTO ${PENDING} (order_id, internal_id) SELECT * FROM unnest($1::text[], $2::text[]) ON CONFLICT DO NOTHING`,
      [c.map((r) => r[0]), c.map((r) => r[1])],
    );
  }
  return all.size;
}

/** Up to `limit` orders whose pending ids the hub now knows, each with what it knows. */
export async function resolvablePending(limit: number): Promise<{ orderId: string; known: Map<string, ArtInfo> }[]> {
  await ensure();
  const r = await query<{ order_id: string; internal_id: string; article: string; pc: string; text: string }>(
    `SELECT p.order_id, p.internal_id, a.article, a.pc, a.text
     FROM ${PENDING} p JOIN ${IDS} a ON a.internal_id = p.internal_id
     WHERE p.order_id IN (SELECT DISTINCT p2.order_id FROM ${PENDING} p2 JOIN ${IDS} a2 ON a2.internal_id = p2.internal_id ORDER BY p2.order_id LIMIT $1)`,
    [limit],
  );
  const by = new Map<string, Map<string, ArtInfo>>();
  for (const x of r.rows) {
    const m = by.get(x.order_id) ?? new Map<string, ArtInfo>();
    m.set(x.internal_id, [x.pc, x.article, x.text]);
    by.set(x.order_id, m);
  }
  return [...by.entries()].map(([orderId, known]) => ({ orderId, known }));
}

/** Up to `limit` orders whose waiting ids nothing knows and that have not borrowed yet. */
export async function unknownPending(limit: number): Promise<{ orderId: string; ids: string[] }[]> {
  await ensure();
  const r = await query<{ order_id: string; ids: string[] }>(
    `SELECT p.order_id, array_agg(p.internal_id) AS ids FROM ${PENDING} p LEFT JOIN ${IDS} a ON a.internal_id = p.internal_id
     WHERE a.internal_id IS NULL AND p.borrowed_pc IS NULL GROUP BY p.order_id ORDER BY p.order_id LIMIT $1`,
    [limit],
  );
  return r.rows.map((x) => ({ orderId: x.order_id, ids: x.ids }));
}

/** The orders that found nothing to borrow are asked again (their customer may have revenue now). */
export async function retryNothingBorrowed(): Promise<void> {
  await ensure();
  await query(`UPDATE ${PENDING} SET borrowed_pc = NULL WHERE borrowed_pc = ''`);
}

/** The profit centre each id borrowed most often on its other orders: id -> profit centre. */
export async function usualBorrowed(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  await ensure();
  const r = await query<{ id: string; pc: string }>(
    `SELECT DISTINCT ON (internal_id) internal_id AS id, borrowed_pc AS pc FROM (
       SELECT internal_id, borrowed_pc, count(*) AS n FROM ${PENDING}
       WHERE internal_id = ANY($1::text[]) AND borrowed_pc <> '' GROUP BY internal_id, borrowed_pc
     ) t ORDER BY internal_id, n DESC, borrowed_pc`,
    [ids],
  );
  for (const x of r.rows) out.set(x.id, x.pc);
  return out;
}

export async function markBorrowed(orderId: string, ids: string[], pc: string): Promise<void> {
  if (!ids.length) return;
  await ensure();
  await query(`UPDATE ${PENDING} SET borrowed_pc = $3 WHERE order_id = $1 AND internal_id = ANY($2::text[])`, [orderId, ids, pc]);
}

/** The 10-digit articles waiting for their profit centre that the memory does not know yet. */
export async function pendingArticleNumbers(): Promise<string[]> {
  await ensure();
  const r = await query<{ id: string }>(
    `SELECT DISTINCT p.internal_id AS id FROM ${PENDING} p LEFT JOIN ${IDS} a ON a.internal_id = p.internal_id
     WHERE a.internal_id IS NULL AND p.internal_id ~ '^[0-9]{10}$'`,
  );
  return r.rows.map((x) => x.id);
}

export async function clearPending(orderId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await ensure();
  await query(`DELETE FROM ${PENDING} WHERE order_id = $1 AND internal_id = ANY($2::text[])`, [orderId, ids]);
}

/** For the page: ids remembered, lines waiting, and how many of those the hub can fix now. */
export async function memoryCounts(): Promise<{ remembered: number; pending_orders: number; pending_lines: number; resolvable_lines: number; borrowed_lines: number; nothing_to_borrow_lines: number }> {
  await ensure();
  const r = await query<{ a: string; o: string; l: string; k: string; b: string; n: string }>(
    `SELECT (SELECT count(*) FROM ${IDS})::text AS a,
            (SELECT count(DISTINCT order_id) FROM ${PENDING})::text AS o,
            (SELECT count(*) FROM ${PENDING})::text AS l,
            (SELECT count(*) FROM ${PENDING} p JOIN ${IDS} a ON a.internal_id = p.internal_id)::text AS k,
            (SELECT count(*) FROM ${PENDING} WHERE borrowed_pc <> '')::text AS b,
            (SELECT count(*) FROM ${PENDING} WHERE borrowed_pc = '')::text AS n`,
  );
  const x = r.rows[0];
  return {
    remembered: Number(x?.a ?? 0), pending_orders: Number(x?.o ?? 0), pending_lines: Number(x?.l ?? 0), resolvable_lines: Number(x?.k ?? 0),
    borrowed_lines: Number(x?.b ?? 0), nothing_to_borrow_lines: Number(x?.n ?? 0),
  };
}
