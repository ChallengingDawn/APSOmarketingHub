// The product facts' I/O (rules in ./productFactsRules.ts), run by the ERP revenue step each morning when the workbook
// carries the "KPI ARTICLES" sheet.
// - HubSpot's articles (apsomh_cx_product_ids: article_number -> record id, with the stock unit, sales unit and article
//   status HubSpot held then), copied from HubSpot once a week (~2,300 list calls): the sheet keeps only those (the BI model
//   has ~860,000 articles, HubSpot ~227,000), the updates go by id, and the preview tells what would really change.
// - PREVIEW while PRODUCT_FACTS_LIVE is off: what it would write, property by property, what it holds back and why, and the
//   GWStdP checked against the values HubSpot holds - nothing written. LIVE: the articles whose facts changed since the last
//   write (apsomh_cx_product_facts_written, the facts' hash per article), HubSpot's values read first so only real
//   differences go and the stock unit is decided on HubSpot's units of that moment, 100 a call, at most PER_RUN a morning.

import { query } from "@/lib/db/client";
import { kvGet } from "@/lib/db/init";
import { IntegrationError } from "@/lib/integrations/status";
import { hubspotRetry } from "./hs";
import {
  PRODUCTS_OBJECT, PRODUCT_FACTS_LIVE, PRODUCT_FILL_ONLY, PRODUCT_KEYS, STOCK_STEP, checkFacts, factsHash, sameValues, stockUnitCall, unpackFacts,
  type Facts, type HubSpotSide,
} from "./productFactsRules";

const IDS = "apsomh_cx_product_ids";
const WRITTEN = "apsomh_cx_product_facts_written";
const IDS_TTL_MS = 7 * 86_400_000;
const PER_RUN = 60_000;
const SAMPLE = 300;
type Props = Record<string, string | null | undefined>;
type Obj = { id: string | number; properties?: Props };
type BatchOut = { results?: Obj[]; errors?: { message?: string }[] };
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const msg = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 200);

/** What HubSpot held for an article at the last copy: its id, stock unit, sales unit and article status. */
export type HubSpotArticle = { id: string; su: string; sa: string; st: string };
export type ProductCopy = { articles: Map<string, HubSpotArticle>; refreshed: number | null };

let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS ${IDS} (article text PRIMARY KEY, id text NOT NULL, at timestamptz NOT NULL DEFAULT now())`);
      // NULL = copied before these were read: the copy is taken again
      await query(`ALTER TABLE ${IDS} ADD COLUMN IF NOT EXISTS su text, ADD COLUMN IF NOT EXISTS sa text, ADD COLUMN IF NOT EXISTS st text`);
      await query(`CREATE TABLE IF NOT EXISTS ${WRITTEN} (article text PRIMARY KEY, hash text NOT NULL, at timestamptz NOT NULL DEFAULT now())`);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

/** Every Products & Pricing record's article number, id and units, from HubSpot (the list, 100 a page). */
async function refreshCopy(beat: () => Promise<void>): Promise<number> {
  const at = new Date().toISOString();
  let after: string | undefined, n = 0, pages = 0;
  let buf: [string, string, string, string, string][] = [];
  const flush = async () => {
    if (!buf.length) return;
    await query(`INSERT INTO ${IDS} (article, id, su, sa, st, at)
      SELECT a, i, s, l, t, $6::timestamptz FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[]) AS x(a, i, s, l, t)
      ON CONFLICT (article) DO UPDATE SET id = EXCLUDED.id, su = EXCLUDED.su, sa = EXCLUDED.sa, st = EXCLUDED.st, at = EXCLUDED.at`,
      [buf.map((x) => x[0]), buf.map((x) => x[1]), buf.map((x) => x[2]), buf.map((x) => x[3]), buf.map((x) => x[4]), at]);
    n += buf.length;
    buf = [];
  };
  do {
    const r = await hubspotRetry<{ results?: Obj[]; paging?: { next?: { after?: string } } }>({
      path: `/crm/v3/objects/${PRODUCTS_OBJECT}?limit=100&archived=false&properties=article_number,stock_unit,sales_unit,article_status${after ? `&after=${encodeURIComponent(after)}` : ""}`,
    });
    for (const o of r.results ?? []) {
      const p = o.properties ?? {};
      const a = (p.article_number ?? "").trim();
      if (a) buf.push([a, String(o.id), (p.stock_unit ?? "").trim(), (p.sales_unit ?? "").trim(), (p.article_status ?? "").trim()]);
    }
    after = r.paging?.next?.after;
    if (buf.length >= 2000) await flush();
    if (++pages % 50 === 0) await beat();
    await pause(120);
  } while (after);
  await flush();
  // an article no longer in HubSpot leaves the copy
  if (n) await query(`DELETE FROM ${IDS} WHERE at < $1::timestamptz`, [at]);
  return n;
}

/** HubSpot's articles, copied again when the copy is a week old or was taken before the units were read. */
export async function loadProductIds(beat: () => Promise<void>): Promise<ProductCopy & { ids: Map<string, string> }> {
  await ensure();
  const age = await query<{ n: string; at: string | null; unread: string }>(
    `SELECT count(*)::text AS n, min(at)::text AS at, count(*) FILTER (WHERE su IS NULL)::text AS unread FROM ${IDS}`);
  const row = age.rows[0];
  const fresh = Number(row?.n ?? 0) > 0 && Number(row?.unread ?? 0) === 0 && !!row?.at && Date.now() - Date.parse(row.at) < IDS_TTL_MS;
  const refreshed = fresh ? null : await refreshCopy(beat);
  const r = await query<{ article: string; id: string; su: string | null; sa: string | null; st: string | null }>(`SELECT article, id, su, sa, st FROM ${IDS}`);
  const articles = new Map(r.rows.map((x) => [x.article, { id: x.id, su: x.su ?? "", sa: x.sa ?? "", st: x.st ?? "" }]));
  return { articles, ids: new Map(r.rows.map((x) => [x.article, x.id])), refreshed };
}

/** The object's properties (a choice list's options; null for the others) and whether the stock step runs live. */
async function hubspotSide(): Promise<HubSpotSide> {
  const r = await hubspotRetry<{ results?: { name: string; type: string; options?: { value: string }[] }[] }>({ path: `/crm/v3/properties/${PRODUCTS_OBJECT}` });
  const props = new Map<string, Set<string> | null>((r.results ?? []).map((p) => [p.name, p.type === "enumeration" ? new Set((p.options ?? []).map((o) => o.value)) : null]));
  const live = (await kvGet<Record<string, boolean>>("connectors:hub:live").catch(() => undefined)) ?? {};
  return { props, stockStepLive: !!live[STOCK_STEP] };
}

const bump = (m: Record<string, number>, k: string) => { m[k] = (m[k] ?? 0) + 1; };

export async function productFactsRun(packed: Map<string, string>, copy: ProductCopy, live: boolean, beat: () => Promise<void>): Promise<Record<string, unknown>> {
  await ensure();
  const hs = await hubspotSide();
  const dropped: Record<string, number> = {}, unitCalls: Record<string, number> = {}, statusChanges: Record<string, number> = {};
  const heldExamples: unknown[] = [];
  const want = new Map<string, Facts>();
  for (const [a, s] of packed) {
    const art = copy.articles.get(a);
    if (!art) continue;
    const c = checkFacts(unpackFacts(s), hs);
    for (const [k, why] of Object.entries(c.dropped)) bump(dropped, `${k}: ${why}`);
    const f = c.facts;
    if (f.stock_unit) {
      const call = stockUnitCall(f.stock_unit, art.su, art.sa);
      bump(unitCalls, call);
      if (call === "moves_stock" && heldExamples.length < 8) heldExamples.push({ article: a, erp_stock_unit: f.stock_unit, hubspot_stock_unit: art.su || null, hubspot_sales_unit: art.sa || null });
      if (call !== "write") delete f.stock_unit;
    }
    if (f.article_status && f.article_status !== art.st) bump(statusChanges, `${art.st || "(empty)"} -> ${f.article_status}`);
    if (Object.keys(f).length) want.set(a, f);
  }
  const written = new Map((await query<{ article: string; hash: string }>(`SELECT article, hash FROM ${WRITTEN}`)).rows.map((x) => [x.article, x.hash]));
  const changed = [...want].filter(([a, f]) => written.get(a) !== factsHash(f));
  const by_property: Record<string, number> = {};
  for (const [, f] of changed) for (const k of Object.keys(f)) bump(by_property, k);
  const out: Record<string, unknown> = {
    live: PRODUCT_FACTS_LIVE && live, articles_kept: packed.size, in_hubspot: copy.articles.size, with_facts: want.size, to_check: changed.length,
    by_property, held_back: dropped, stock_step_live: hs.stockStepLive,
    stock_unit: { ...unitCalls, note: "write = empty or another unit in HubSpot; same = HubSpot already says it; moves_stock = held, it would change who writes the stock", held_examples: heldExamples },
    article_status_changes: statusChanges,
    examples: changed.slice(0, 5).map(([a, f]) => ({ article: a, ...f })),
  };

  // the GWStdP against what HubSpot holds today, on a sample (CHF per stock unit - productFactsRules.ts)
  const sample = changed.filter(([, f]) => f.unit_cost_chf).slice(0, SAMPLE);
  let compared = 0, same = 0;
  const ratios: number[] = [];
  for (let i = 0; i < sample.length; i += 100) {
    const part = sample.slice(i, i + 100);
    const r = await hubspotRetry<BatchOut>({
      path: `/crm/v3/objects/${PRODUCTS_OBJECT}/batch/read`, method: "POST",
      body: { inputs: part.map(([a]) => ({ id: copy.articles.get(a)!.id })), properties: ["article_number", "unit_cost_chf"] },
    }).catch(() => ({ results: [] as Obj[] }));
    for (const o of r.results ?? []) {
      const has = Number(o.properties?.unit_cost_chf), mine = Number(want.get((o.properties?.article_number ?? "").trim())?.unit_cost_chf);
      if (!(has > 0) || !(mine > 0)) continue;
      compared++;
      ratios.push(has / mine);
      if (Math.abs(has - mine) / has < 0.02) same++;
    }
    await pause(260);
  }
  ratios.sort((x, y) => x - y);
  out.unit_cost_check = { compared, within_2_percent: same, median_ratio_hubspot_to_ours: ratios.length ? Math.round(ratios[ratios.length >> 1] * 1000) / 1000 : null };

  if (!(PRODUCT_FACTS_LIVE && live)) return out;

  // LIVE: HubSpot's values first - only real differences go, the stock unit decided on its units of this moment
  const todo = changed.slice(0, PER_RUN);
  const readProps = [...new Set([...PRODUCT_KEYS, "stock_unit", "sales_unit"])];
  let updated = 0, already = 0, failed = 0, isolated = 0;
  const errors: string[] = [];
  type Item = { id: string; art: string; props: Facts; hash: string };
  const send = async (items: Item[]): Promise<Item[]> => {
    try {
      const j = await hubspotRetry<BatchOut>({ path: `/crm/v3/objects/${PRODUCTS_OBJECT}/batch/update`, method: "POST", body: { inputs: items.map((b) => ({ id: b.id, properties: b.props })) } });
      const ok = j.results ? new Set(j.results.map((r) => String(r.id))) : new Set(items.map((b) => b.id));
      const bad = items.filter((b) => !ok.has(b.id));
      failed += bad.length;
      if (bad.length && errors.length < 3) errors.push(String(j.errors?.[0]?.message ?? "partial failure").slice(0, 200));
      return items.filter((b) => ok.has(b.id));
    } catch (e) {
      const st = e instanceof IntegrationError ? e.status : null;
      // a 4xx fails all 100 for one bad record: the first few such batches go one by one
      if (st !== null && st >= 400 && st < 500 && st !== 429 && items.length > 1 && isolated < 3) {
        isolated++;
        const ok: Item[] = [];
        for (const b of items) ok.push(...(await send([b])));
        return ok;
      }
      failed += items.length;
      if (errors.length < 3) errors.push(`${items.length === 1 ? items[0].art : `batch of ${items.length}`}: ${msg(e)}`);
      return [];
    }
  };
  for (let i = 0; i < todo.length; i += 100) {
    const part = todo.slice(i, i + 100);
    const cur = await hubspotRetry<BatchOut>({
      path: `/crm/v3/objects/${PRODUCTS_OBJECT}/batch/read`, method: "POST",
      body: { inputs: part.map(([a]) => ({ id: copy.articles.get(a)!.id })), properties: readProps },
    }).catch((e) => { if (errors.length < 3) errors.push(`read: ${msg(e)}`); return null; });
    if (!cur) { failed += part.length; continue; }
    const now = new Map((cur.results ?? []).map((o) => [String(o.id), o.properties ?? {}]));
    const go: Item[] = [], current: Item[] = [];
    for (const [a, f] of part) {
      const id = copy.articles.get(a)!.id, c = now.get(id);
      if (!c) continue; // gone since the copy
      const props = { ...f };
      if (props.stock_unit && stockUnitCall(props.stock_unit, c.stock_unit, c.sales_unit) !== "write") delete props.stock_unit;
      for (const k of PRODUCT_FILL_ONLY) if (props[k] && (c[k] ?? "").trim()) delete props[k]; // HubSpot's own value stays
      const item = { id, art: a, props, hash: factsHash(f) };
      if (!Object.keys(props).length || sameValues(props, c)) { already++; current.push(item); } else go.push(item);
    }
    const ok = go.length ? await send(go) : [];
    updated += ok.length;
    const done = [...ok, ...current];
    if (done.length) {
      await query(`INSERT INTO ${WRITTEN} (article, hash, at) SELECT a, h, now() FROM unnest($1::text[], $2::text[]) AS t(a, h) ON CONFLICT (article) DO UPDATE SET hash = EXCLUDED.hash, at = now()`,
        [done.map((d) => d.art), done.map((d) => d.hash)]);
    }
    await pause(260);
    if (i % 2000 === 0) await beat();
  }
  return { ...out, updated, already_current: already, failed, ...(errors.length ? { errors } : {}), left_for_next_runs: Math.max(0, changed.length - PER_RUN) };
}
