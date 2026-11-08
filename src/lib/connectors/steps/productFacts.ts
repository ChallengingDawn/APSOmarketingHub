// The product facts' I/O (rules in ./productFactsRules.ts): run by the ERP revenue step each morning when the workbook
// carries the "KPI ARTICLES" sheet. PREVIEW while PRODUCT_FACTS_LIVE is off: it counts what it would write, property by
// property, and checks the GWStdP's unit against the values HubSpot already holds - nothing written. LIVE: the articles
// whose facts changed since the last write (apsomh_cx_product_facts_written, the facts' hash per article), found by
// article_number and updated 100 at a time - at most PER_RUN a morning, the rest the next mornings.

import { query } from "@/lib/db/client";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { GWSTDP_PER, PRODUCTS_OBJECT, PRODUCT_FACTS_LIVE, articleFacts, checkOptions, factsHash, type ArticleRow, type Facts } from "./productFactsRules";

const WRITTEN = "apsomh_cx_product_facts_written";
const PER_RUN = 20_000;
const SAMPLE = 300;
type Obj = { id: string; properties?: Record<string, string | null> };
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  if (!ready) ready = query(`CREATE TABLE IF NOT EXISTS ${WRITTEN} (article text PRIMARY KEY, hash text NOT NULL, at timestamptz NOT NULL DEFAULT now())`).then(() => undefined).catch((e) => { ready = null; throw e; });
  return ready;
}

/** the choice lists of the object's properties: name -> its options */
async function options(): Promise<Map<string, Set<string>>> {
  const r = await hubspotFetchJson<{ results?: { name: string; type: string; options?: { value: string }[] }[] }>({ path: `/crm/v3/properties/${PRODUCTS_OBJECT}` });
  return new Map((r.results ?? []).filter((p) => p.type === "enumeration").map((p) => [p.name, new Set((p.options ?? []).map((o) => o.value))]));
}

/** the records of these articles (100 a call) */
async function byArticle(articles: string[], properties: string[], beat: () => Promise<void>): Promise<Map<string, Obj>> {
  const out = new Map<string, Obj>();
  for (let i = 0; i < articles.length; i += 100) {
    const r = await hubspotFetchJson<{ results?: Obj[] }>({
      path: `/crm/v3/objects/${PRODUCTS_OBJECT}/search`, method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: "article_number", operator: "IN", values: articles.slice(i, i + 100) }] }], properties: ["article_number", ...properties], limit: 100 },
    });
    for (const o of r.results ?? []) { const a = o.properties?.article_number; if (a && !out.has(a)) out.set(a, o); }
    await pause(260);
    if (i % 2000 === 0) await beat();
  }
  return out;
}

export async function productFactsRun(rows: ArticleRow[], live: boolean, beat: () => Promise<void>): Promise<Record<string, unknown>> {
  await ensure();
  const opts = await options();
  const by_property: Record<string, number> = {}, dropped: Record<string, number> = {};
  const want = new Map<string, Facts>();
  for (const r of rows) {
    const c = checkOptions(articleFacts(r), opts);
    for (const k of c.dropped) dropped[k] = (dropped[k] ?? 0) + 1;
    if (Object.keys(c.facts).length) want.set(r.article, c.facts);
  }
  const written = new Map((await query<{ article: string; hash: string }>(`SELECT article, hash FROM ${WRITTEN}`)).rows.map((x) => [x.article, x.hash]));
  const changed = [...want].filter(([a, f]) => written.get(a) !== factsHash(f));
  for (const [, f] of changed) for (const k of Object.keys(f)) by_property[k] = (by_property[k] ?? 0) + 1;
  const out: Record<string, unknown> = {
    live: PRODUCT_FACTS_LIVE && live, articles_in_sheet: rows.length, with_facts: want.size, to_write: changed.length, by_property, dropped_not_an_option: dropped,
    examples: changed.slice(0, 5).map(([a, f]) => ({ article: a, ...f })),
  };

  // the GWStdP's unit, against the third of the articles HubSpot already has a unit cost for
  const sample = [...want].filter(([, f]) => f.unit_cost_chf).slice(0, SAMPLE * 3).map(([a]) => a);
  const seen = await byArticle(sample, ["unit_cost_chf", "currency"], beat).catch(() => new Map<string, Obj>());
  let compared = 0, perUnit = 0, per100 = 0;
  const ratios: number[] = [];
  for (const [a, o] of seen) {
    const has = Number(o.properties?.unit_cost_chf), mine = Number(want.get(a)?.unit_cost_chf);
    if (!(has > 0) || !(mine > 0) || compared >= SAMPLE) continue;
    compared++;
    ratios.push(has / mine);
    if (Math.abs(has - mine) / has < 0.01) perUnit++;
    if (Math.abs(has - mine * GWSTDP_PER) / has < 0.01) per100++;
  }
  ratios.sort((x, y) => x - y);
  out.unit_cost_check = { compared, same_as_ours_per_unit: perUnit, same_as_the_erp_price_itself: per100, median_ratio_hubspot_to_ours: ratios.length ? Math.round(ratios[ratios.length >> 1] * 1000) / 1000 : null, per: GWSTDP_PER };

  if (!(PRODUCT_FACTS_LIVE && live)) return out;
  const todo = changed.slice(0, PER_RUN);
  const ids = await byArticle(todo.map(([a]) => a), [], beat);
  let updated = 0, failed = 0;
  const errors: string[] = [];
  for (let i = 0; i < todo.length; i += 100) {
    const part = todo.slice(i, i + 100).filter(([a]) => ids.has(a));
    if (!part.length) continue;
    try {
      await hubspotFetchJson({ path: `/crm/v3/objects/${PRODUCTS_OBJECT}/batch/update`, method: "POST", body: { inputs: part.map(([a, f]) => ({ id: ids.get(a)!.id, properties: f })) } });
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
  return { ...out, not_in_hubspot: todo.length - ids.size, updated, failed, ...(errors.length ? { errors } : {}), left_for_next_runs: Math.max(0, changed.length - PER_RUN) };
}
