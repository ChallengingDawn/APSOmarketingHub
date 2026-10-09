// THE ERP STOCK INTO PRODUCTS & PRICING - a step the Compass connector never had.
//
// fct_article_quantity_and_consumption.csv arrives on the SFTP folder every day and nothing
// loaded it on a schedule: stock_value_chf / _eur, unit_cost_chf and consumption on P&P were
// written once, on 07.07.2026, by a manual run of the connector's local load_consumption.py,
// and its mapping left StockQuantity to "the stock connector". That connector (the
// APSOAssistant gateway) writes Performis' availability, which is in the SALES unit - so a
// PTFE plate stocked in kg and sold by the piece read "1 Kg" for one 68.5 kg plate.
//
// This step, per article (rules in ./stockRules.ts, tested):
//   stock_value_chf, stock_value_eur, unit_cost_chf, consumption, stock_movement   every article
//   stock_quantity (kilograms, the stock unit)   only where stock_unit != sales_unit
// The gateway writes the piece count into stock_sales for those articles and stopped writing
// stock_quantity for them (APSOAssistant 9f1caa8, its mirror db8cbe8): one writer each.
//
// The file is a rolling refresh, so the newest snapshot per article and warehouse is kept in
// Postgres (apsomh_cx_erp_stock); a PREVIEW merges in memory and saves nothing. Like the
// article master: a change cache (apsomh_cx_stock_hash, recorded only once HubSpot took the
// batch), HubSpot's current values read before a write so only real differences go, and a
// batch HubSpot refuses for one bad record is retried record by record. Never creates a
// record. SARCLA 2026-10-09: "kg + pieces, both correct".

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { query } from "@/lib/db/client";
import { IntegrationError } from "@/lib/integrations/status";
import type { StepResult } from "./companyFacts";
import { PP_OBJECT, PyCsvReader, matchArticle, pyStrip } from "./filesRules";
import { hubspotRetry } from "./hs";
import {
  FCT_FILE, FctReader, KG_PROP, KeyBridge, VALUE_PROPS, isCrossUnit, keepNewest, sameNumbers,
  stockHash, stockPayload, sumSnaps, type Snap,
} from "./stockRules";

type Beat = () => Promise<void>;
type Props = Record<string, string | null | undefined>;
type Obj = { id: string; properties?: Props };
type Page = { results?: Obj[]; paging?: { next?: { after?: string } } };
type BatchOut = { results?: { id: string | number }[]; numErrors?: number; errors?: { message?: string }[] };

const msg = (e: unknown): string => String((e as Error)?.message ?? e).slice(0, 200);
const status = (e: unknown): number | null => (e instanceof IntegrationError ? e.status : null);
const exists = (p: string) => stat(p).then(() => true, () => false);

/** Every row of a ';' CSV as Python's csv.reader gives it, streamed (dim_article is ~300 MB). */
async function eachRow(file: string, beat: Beat, onRow: (r: string[]) => void): Promise<void> {
  const dec = new TextDecoder("utf-8");
  const csv = new PyCsvReader(";");
  const rows: string[][] = [];
  const flush = () => { for (const r of rows) onRow(r); rows.length = 0; };
  let bytes = 0, next = 64 << 20;
  for await (const chunk of createReadStream(file, { highWaterMark: 1 << 20 })) {
    csv.push(dec.decode(chunk as Buffer, { stream: true }), rows);
    flush();
    bytes += (chunk as Buffer).length;
    if (bytes >= next) { next += 64 << 20; await beat(); }
  }
  csv.push(dec.decode(), rows);
  csv.end(rows);
  flush();
}

/* ── state: the newest snapshot per article and warehouse, and the change cache ── */

const SNAP_TABLE = "apsomh_cx_erp_stock";
const HASH_TABLE = "apsomh_cx_stock_hash";
let tables: Promise<void> | null = null;

/** Created on first use (the article master's pattern), never inside the app's schema init. */
function ensureTables(): Promise<void> {
  tables ??= (async () => {
    await query(
      `CREATE TABLE IF NOT EXISTS ${SNAP_TABLE} (
         article    text NOT NULL,
         warehouse  text NOT NULL,
         snap_date  integer NOT NULL,
         qty        double precision NOT NULL,
         cons       double precision NOT NULL,
         mov        double precision NOT NULL,
         gw         double precision,
         vchf       double precision NOT NULL,
         veur       double precision NOT NULL,
         updated_at timestamptz NOT NULL DEFAULT now(),
         PRIMARY KEY (article, warehouse)
       )`,
    );
    await query(
      `CREATE TABLE IF NOT EXISTS ${HASH_TABLE} (
         pp_id      text PRIMARY KEY,
         hash       text NOT NULL,
         article    text,
         updated_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
  })().catch((e) => { tables = null; throw e; });
  return tables;
}

type SnapRow = { article: string; warehouse: string; snap_date: number; qty: number; cons: number; mov: number; gw: number | null; vchf: number; veur: number };

/** What earlier deliveries left for these articles, keyed "article|warehouse". */
async function heldFor(articles: string[]): Promise<Map<string, Snap>> {
  const out = new Map<string, Snap>();
  for (let i = 0; i < articles.length; i += 20_000) {
    const r = await query<SnapRow>(
      `SELECT article, warehouse, snap_date, qty, cons, mov, gw, vchf, veur FROM ${SNAP_TABLE} WHERE article = ANY($1::text[])`,
      [articles.slice(i, i + 20_000)],
    );
    for (const x of r.rows) {
      out.set(`${x.article}|${x.warehouse}`, { date: Number(x.snap_date), qty: Number(x.qty), cons: Number(x.cons), mov: Number(x.mov), gw: x.gw === null ? null : Number(x.gw), vchf: Number(x.vchf), veur: Number(x.veur) });
    }
  }
  return out;
}

/** Save the snapshots that replaced or added one - an older one never overwrites a newer. */
async function saveSnaps(rows: [string, string, Snap][]): Promise<void> {
  for (let i = 0; i < rows.length; i += 5_000) {
    const c = rows.slice(i, i + 5_000);
    await query(
      `INSERT INTO ${SNAP_TABLE} (article, warehouse, snap_date, qty, cons, mov, gw, vchf, veur)
       SELECT * FROM unnest($1::text[], $2::text[], $3::integer[], $4::float8[], $5::float8[], $6::float8[], $7::float8[], $8::float8[], $9::float8[])
       ON CONFLICT (article, warehouse) DO UPDATE SET
         snap_date = EXCLUDED.snap_date, qty = EXCLUDED.qty, cons = EXCLUDED.cons, mov = EXCLUDED.mov,
         gw = EXCLUDED.gw, vchf = EXCLUDED.vchf, veur = EXCLUDED.veur, updated_at = now()
       WHERE EXCLUDED.snap_date > ${SNAP_TABLE}.snap_date`,
      [c.map((x) => x[0]), c.map((x) => x[1]), c.map((x) => x[2].date), c.map((x) => x[2].qty), c.map((x) => x[2].cons),
        c.map((x) => x[2].mov), c.map((x) => x[2].gw), c.map((x) => x[2].vchf), c.map((x) => x[2].veur)],
    );
  }
}

async function loadHashes(): Promise<Map<string, string>> {
  const r = await query<{ pp_id: string; hash: string }>(`SELECT pp_id, hash FROM ${HASH_TABLE}`);
  return new Map(r.rows.map((x) => [x.pp_id, x.hash]));
}

async function saveHashes(rows: { id: string; hash: string; art: string }[]): Promise<void> {
  if (!rows.length) return;
  await query(
    `INSERT INTO ${HASH_TABLE} (pp_id, hash, article)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
     ON CONFLICT (pp_id) DO UPDATE SET hash = EXCLUDED.hash, article = EXCLUDED.article, updated_at = now()`,
    [rows.map((r) => r.id), rows.map((r) => r.hash), rows.map((r) => r.art)],
  );
}

/** Every Products & Pricing record, page by page. */
async function listPP(props: string[], beat: Beat, each: (o: Obj) => void): Promise<number> {
  let after: string | undefined;
  let seen = 0, pages = 0;
  for (;;) {
    const j = await hubspotRetry<Page>({ path: `/crm/v3/objects/${PP_OBJECT}?limit=100&archived=false&properties=${props.join(",")}${after ? `&after=${encodeURIComponent(after)}` : ""}` });
    for (const o of j.results ?? []) { each(o); seen += 1; }
    after = j.paging?.next?.after;
    if (++pages % 50 === 0) await beat();
    if (!after) return seen;
  }
}

/* ── the step ──────────────────────────────────────────────────────────── */

export async function stockLoad(live: boolean, beat: Beat, opts: { file: string; articleFile: string }): Promise<StepResult> {
  const t0 = Date.now();
  if (!(await exists(opts.articleFile))) {
    throw new Error("dim_article.csv is not on this copy's disk - it turns the stock file's keys into article numbers; the next delivery brings it");
  }

  // 1. the fact: the newest snapshot per (article key, warehouse) - ~140,000 small records
  const byKey = new Map<string, Snap>();
  const days = new Map<number, number>();
  const st: { r?: FctReader } = {};
  await eachRow(opts.file, beat, (r) => {
    if (!st.r) { st.r = new FctReader(r); return; }
    const x = st.r.row(r);
    if (!x) return;
    days.set(x.snap.date, (days.get(x.snap.date) ?? 0) + 1);
    keepNewest(byKey, `${x.key}|${x.wh}`, x.snap);
  });
  const fr = st.r;
  if (!fr) throw new Error(`${FCT_FILE} is empty`);

  // 2. key -> article number, held only for the keys the fact uses
  const wantedKeys = new Set<string>();
  for (const k of byKey.keys()) wantedKeys.add(k.slice(0, k.indexOf("|")));
  const sb: { b?: KeyBridge } = {};
  await eachRow(opts.articleFile, beat, (r) => {
    if (!sb.b) { sb.b = new KeyBridge(r); return; }
    sb.b.add(r, wantedKeys);
  });
  const bridge = sb.b?.map ?? new Map<string, string>();

  // 3. per (article, warehouse): an article can carry more than one key (its versions)
  const today = new Map<string, Snap>();
  let unknownKeys = 0;
  for (const [k, s] of byKey) {
    const i = k.indexOf("|");
    const art = bridge.get(k.slice(0, i));
    if (!art) { unknownKeys += 1; continue; }
    keepNewest(today, `${art}|${k.slice(i + 1)}`, s);
  }
  byKey.clear();
  const touched = new Set<string>();
  for (const k of today.keys()) touched.add(k.slice(0, k.indexOf("|")));
  await beat();

  // 4. merged with what earlier deliveries left: newer wins, a warehouse not in today's file keeps its row
  await ensureTables();
  const held = await heldFor([...touched]);
  const heldBefore = held.size;
  const replaced: [string, string, Snap][] = [];
  for (const [k, s] of today) {
    if (keepNewest(held, k, s)) { const i = k.indexOf("|"); replaced.push([k.slice(0, i), k.slice(i + 1), s]); }
  }
  today.clear();
  const perArt = new Map<string, Snap[]>();
  for (const [k, s] of held) {
    const art = k.slice(0, k.indexOf("|"));
    if (!touched.has(art)) continue;
    const list = perArt.get(art);
    if (list) list.push(s); else perArt.set(art, [s]);
  }
  held.clear();
  if (live) await saveSnaps(replaced);
  await beat();

  // 5. every P&P record's article number and units - the units decide who owns stock_quantity
  const ids: string[] = [], ans: string[] = [], sus: string[] = [], sas: string[] = [];
  await listPP(["article_number", "stock_unit", "sales_unit"], beat, (o) => {
    ids.push(o.id);
    ans.push(pyStrip(o.properties?.article_number ?? ""));
    sus.push(o.properties?.stock_unit ?? "");
    sas.push(o.properties?.sales_unit ?? "");
  });

  // 6. what changed since the last write, compared with HubSpot, written 100 at a time
  const cache = live ? await loadHashes() : await loadHashes().catch(() => new Map<string, string>());
  const readProps = [...VALUE_PROPS, KG_PROP];
  const errors: string[] = [];
  const crossExamples: unknown[] = [], sameExamples: unknown[] = [];
  let matched = 0, cross = 0, unchanged = 0, toUpdate = 0, already = 0, updated = 0, failed = 0, isolated = 0, batches = 0;
  type Item = { id: string; art: string; payload: Record<string, string>; hash: string };
  let batch: Item[] = [];

  const write = async (send: Item[]): Promise<Item[]> => {
    try {
      const j = await hubspotRetry<BatchOut>({ path: `/crm/v3/objects/${PP_OBJECT}/batch/update`, method: "POST", body: { inputs: send.map((b) => ({ id: b.id, properties: b.payload })) } });
      const okIds = j.results ? new Set(j.results.map((r) => String(r.id))) : new Set(send.map((b) => b.id));
      const bad = send.filter((b) => !okIds.has(b.id));
      failed += bad.length;
      if (bad.length && errors.length < 5) errors.push(String(j.errors?.[0]?.message ?? "partial failure").slice(0, 200));
      return send.filter((b) => okIds.has(b.id));
    } catch (e) {
      const s = status(e);
      // a 4xx fails all 100 for one bad record: the first few such batches go one by one
      if (s !== null && s >= 400 && s < 500 && s !== 429 && send.length > 1 && isolated < 3) {
        isolated += 1;
        const ok: Item[] = [];
        for (const b of send) ok.push(...(await write([b])));
        return ok;
      }
      failed += send.length;
      if (errors.length < 5) errors.push(`${send.length === 1 ? `${send[0].id} (${send[0].art})` : `batch of ${send.length}`}: ${msg(e)}`);
      return [];
    }
  };

  const flush = async () => {
    if (!batch.length) return;
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: `/crm/v3/objects/${PP_OBJECT}/batch/read`, method: "POST", body: { inputs: batch.map((b) => ({ id: b.id })), properties: readProps } });
    const cur = new Map((j.results ?? []).map((o) => [String(o.id), o.properties ?? {}]));
    const send: Item[] = [], current: Item[] = [];
    for (const b of batch) {
      const c = cur.get(b.id);
      if (!c) continue; // gone since the listing
      if (sameNumbers(b.payload, c)) { already += 1; current.push(b); } else send.push(b);
    }
    toUpdate += send.length;
    for (const b of send) {
      const into = KG_PROP in b.payload ? crossExamples : sameExamples;
      if (into.length < (into === crossExamples ? 8 : 3)) into.push({ id: b.id, article: b.art, properties: b.payload });
    }
    if (live) {
      const ok = send.length ? await write(send) : [];
      updated += ok.length;
      await saveHashes([...ok, ...current]);
    }
    batch = [];
    if (++batches % 20 === 0) await beat();
  };

  for (let i = 0; i < ids.length; i++) {
    const art = matchArticle(ans[i], (k) => perArt.has(k));
    if (!art) continue;
    matched += 1;
    const isCross = isCrossUnit(sus[i], sas[i]);
    if (isCross) cross += 1;
    const payload = stockPayload(sumSnaps(perArt.get(art)!), isCross);
    const hash = stockHash(payload);
    if (cache.get(ids[i]) === hash) { unchanged += 1; continue; }
    batch.push({ id: ids[i], art, payload, hash });
    if (batch.length >= 100) await flush();
  }
  await flush();

  return {
    rows_in_file: fr.rows, deleted_rows: fr.deleted, unusable_rows: fr.broken,
    days_in_file: Object.fromEntries([...days].sort((a, b) => a[0] - b[0])),
    articles_in_file: touched.size, keys_without_article: unknownKeys,
    warehouse_rows_held_before: heldBefore, warehouse_rows_refreshed: replaced.length,
    pp_seen: ids.length, matched, cross_unit_kg_written_to_stock_quantity: cross,
    unchanged_since_last_write: unchanged, to_update: toUpdate, already_current: already,
    ...(live ? { updated, errors: failed } : {}),
    ...(errors.length ? { error_messages: errors } : {}),
    examples: [...crossExamples, ...sameExamples],
    seconds: Math.round((Date.now() - t0) / 1000),
  };
}
