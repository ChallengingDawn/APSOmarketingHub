// The product facts' I/O (rules in ./productFactsRules.ts), run by the ERP revenue step each morning when the workbook
// carries the "KPI ARTICLES" sheet.
// - HubSpot's articles (apsomh_cx_product_ids: article_number -> record id), copied from HubSpot once a week (~1,400 list
//   calls): the sheet keeps only those (the BI model has ~860,000 articles, HubSpot ~142,000) and the updates go by id.
// - PREVIEW while PRODUCT_FACTS_LIVE is off: what it would write, property by property, and the GWStdP checked against the
//   values HubSpot already holds - nothing written. LIVE: the articles whose facts changed since the last write
//   (apsomh_cx_product_facts_written, the facts' hash per article), 100 a call, at most PER_RUN a morning.

import { query } from "@/lib/db/client";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { PRODUCTS_OBJECT, PRODUCT_FACTS_LIVE, checkOptions, factsHash, unpackFacts, type Facts } from "./productFactsRules";

const IDS = "apsomh_cx_product_ids";
const WRITTEN = "apsomh_cx_product_facts_written";
const IDS_TTL_MS = 7 * 86_400_000;
const PER_RUN = 20_000;
const SAMPLE = 300;
type Obj = { id: string; properties?: Record<string, string | null> };
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS ${IDS} (article text PRIMARY KEY, id text NOT NULL, at timestamptz NOT NULL DEFAULT now())`);
      await query(`CREATE TABLE IF NOT EXISTS ${WRITTEN} (article text PRIMARY KEY, hash text NOT NULL, at timestamptz NOT NULL DEFAULT now())`);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

/** Every Products & Pricing record's article number and id, from HubSpot (the list, 100 a page). */
async function refreshIds(beat: () => Promise<void>): Promise<number> {
  const at = new Date().toISOString();
  let after: string | undefined, n = 0;
  let buf: [string, string][] = [];
  const flush = async () => {
    if (!buf.length) return;
    await query(`INSERT INTO ${IDS} (article, id, at) SELECT a, i, $3::timestamptz FROM unnest($1::text[], $2::text[]) AS t(a, i)
      ON CONFLICT (article) DO UPDATE SET id = EXCLUDED.id, at = EXCLUDED.at`, [buf.map((x) => x[0]), buf.map((x) => x[1]), at]);
    n += buf.length;
    buf = [];
    await beat();
  };
  do {
    const r = await hubspotFetchJson<{ results?: Obj[]; paging?: { next?: { after?: string } } }>({
      path: `/crm/v3/objects/${PRODUCTS_OBJECT}?limit=100&properties=article_number${after ? `&after=${encodeURIComponent(after)}` : ""}`,
    });
    for (const o of r.results ?? []) { const a = (o.properties?.article_number ?? "").trim(); if (a) buf.push([a, String(o.id)]); }
    after = r.paging?.next?.after;
    if (buf.length >= 2000) await flush();
    await pause(120);
  } while (after);
  await flush();
  // an article no longer in HubSpot leaves the copy
  if (n) await query(`DELETE FROM ${IDS} WHERE at < $1::timestamptz`, [at]);
  return n;
}

/** HubSpot's articles -> record id, copied again when the copy is a week old. */
export async function loadProductIds(beat: () => Promise<void>): Promise<{ ids: Map<string, string>; refreshed: number | null }> {
  await ensure();
  const age = await query<{ n: string; at: string | null }>(`SELECT count(*)::text AS n, min(at)::text AS at FROM ${IDS}`);
  const row = age.rows[0];
  const fresh = Number(row?.n ?? 0) > 0 && !!row?.at && Date.now() - Date.parse(row.at) < IDS_TTL_MS;
  const refreshed = fresh ? null : await refreshIds(beat);
  const r = await query<{ article: string; id: string }>(`SELECT article, id FROM ${IDS}`);
  return { ids: new Map(r.rows.map((x) => [x.article, x.id])), refreshed };
}

/** the choice lists of the object's properties: name -> its options */
async function options(): Promise<Map<string, Set<string>>> {
  const r = await hubspotFetchJson<{ results?: { name: string; type: string; options?: { value: string }[] }[] }>({ path: `/crm/v3/properties/${PRODUCTS_OBJECT}` });
  return new Map((r.results ?? []).filter((p) => p.type === "enumeration").map((p) => [p.name, new Set((p.options ?? []).map((o) => o.value))]));
}

export async function productFactsRun(packed: Map<string, string>, ids: Map<string, string>, live: boolean, beat: () => Promise<void>): Promise<Record<string, unknown>> {
  await ensure();
  const opts = await options();
  const by_property: Record<string, number> = {}, dropped: Record<string, number> = {};
  const want = new Map<string, Facts>();
  for (const [a, s] of packed) {
    const c = checkOptions(unpackFacts(s), opts);
    for (const k of c.dropped) dropped[k] = (dropped[k] ?? 0) + 1;
    if (Object.keys(c.facts).length && ids.has(a)) want.set(a, c.facts);
  }
  const written = new Map((await query<{ article: string; hash: string }>(`SELECT article, hash FROM ${WRITTEN}`)).rows.map((x) => [x.article, x.hash]));
  const changed = [...want].filter(([a, f]) => written.get(a) !== factsHash(f));
  for (const [, f] of changed) for (const k of Object.keys(f)) by_property[k] = (by_property[k] ?? 0) + 1;
  const out: Record<string, unknown> = {
    live: PRODUCT_FACTS_LIVE && live, articles_kept: packed.size, in_hubspot: ids.size, with_facts: want.size, to_write: changed.length,
    by_property, dropped_not_an_option: dropped, examples: changed.slice(0, 5).map(([a, f]) => ({ article: a, ...f })),
  };

  // the GWStdP against what HubSpot holds today, on a sample (CHF per stock unit - productFactsRules.ts)
  const sample = changed.filter(([, f]) => f.unit_cost_chf).slice(0, SAMPLE);
  let compared = 0, same = 0;
  const ratios: number[] = [];
  for (let i = 0; i < sample.length; i += 100) {
    const part = sample.slice(i, i + 100);
    const r = await hubspotFetchJson<{ results?: Obj[] }>({
      path: `/crm/v3/objects/${PRODUCTS_OBJECT}/batch/read`, method: "POST",
      body: { inputs: part.map(([a]) => ({ id: ids.get(a)! })), properties: ["article_number", "unit_cost_chf"] },
    }).catch(() => ({ results: [] as Obj[] }));
    for (const o of r.results ?? []) {
      const has = Number(o.properties?.unit_cost_chf), mine = Number(want.get(o.properties?.article_number ?? "")?.unit_cost_chf);
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
  const todo = changed.slice(0, PER_RUN);
  let updated = 0, failed = 0;
  const errors: string[] = [];
  for (let i = 0; i < todo.length; i += 100) {
    const part = todo.slice(i, i + 100);
    try {
      await hubspotFetchJson({ path: `/crm/v3/objects/${PRODUCTS_OBJECT}/batch/update`, method: "POST", body: { inputs: part.map(([a, f]) => ({ id: ids.get(a)!, properties: f })) } });
      await query(`INSERT INTO ${WRITTEN} (article, hash, at) SELECT a, h, now() FROM unnest($1::text[], $2::text[]) AS t(a, h) ON CONFLICT (article) DO UPDATE SET hash = EXCLUDED.hash, at = now()`,
        [part.map(([a]) => a), part.map(([, f]) => factsHash(f))]);
      updated += part.length;
    } catch (e) {
      failed += part.length;
      if (errors.length < 3) errors.push(String((e as Error)?.message ?? e).slice(0, 200));
    }
    await pause(260);
    if (i % 2000 === 0) await beat();
  }
  return { ...out, updated, failed, ...(errors.length ? { errors } : {}), left_for_next_runs: Math.max(0, changed.length - PER_RUN) };
}
