// OTD Reports: each article's text, product group, sub group and product from the nightly article master - dim_article.csv,
// one of the files the ERP delivers every night beside the morning revenue file (SARCLA 10.11.2026: "No product group in
// these months ... WHY IT'S EMPTY?" - the groups came from the OTD analysis file only; "I'm not loading extra files"). Read
// for the morning lines' articles only and kept, so a run without the file on this copy's disk still names them.

import path from "node:path";
import { promises as fs } from "node:fs";
import { kvGet, kvSet } from "@/lib/db/init";
import { eachCsvRow } from "@/lib/connectors/steps/files";
import type { ArtInfo } from "./otdLines";

export const ARTICLE_FILE = "dim_article.csv";
const KV_INFO = "otd:articles:info";
type Kept = { sig: string; at: string; info: Record<string, [string, string, string, string]> };

/** an article number as both sides spell it: without its leading zeros ("0191200011" and "191200011" are one article) */
export const artKey = (a: string) => a.trim().replace(/^0+(?=\d)/, "");

/** The articles asked -> their text and groups. dim_article holds many rows per article (one per version): the first with a
 *  main group wins, the text from any. A file that cannot be read keeps the last kept names. */
export async function otdArticleInfo(dir: string, articles: Iterable<string>, beat: () => Promise<void> = async () => {},
  /** fetches the file from the ERP's folder when this copy lacks it (a step run from the page after a release) - an error, or null */
  fetchMissing?: (name: string) => Promise<string | null>):
  Promise<{ infoOf: (a: string) => ArtInfo | undefined; status: Record<string, unknown> | string }> {
  const want = new Set<string>();
  for (const a of articles) if (a) want.add(artKey(a));
  const kept = await kvGet<Kept>(KV_INFO).catch(() => null);
  const keptMap = new Map(Object.entries(kept?.info ?? {}));
  const of = (m: Map<string, [string, string, string, string]>) => (a: string): ArtInfo | undefined => {
    const x = m.get(artKey(a));
    return x ? { t: x[0] || undefined, g: x[1] || undefined, s: x[2] || undefined, p: x[3] || undefined } : undefined;
  };
  const p = path.join(dir, ARTICLE_FILE);
  let st = await fs.stat(p).catch(() => null);
  let fetched: string | null | undefined;
  if (!st && fetchMissing) {
    fetched = await fetchMissing(ARTICLE_FILE).catch((e: unknown) => String((e as Error)?.message ?? e));
    st = await fs.stat(p).catch(() => null);
  }
  if (!st) return { infoOf: of(keptMap), status: `no ${ARTICLE_FILE} on this copy's disk${fetched ? ` (fetching it failed: ${fetched})` : ""} - the ${keptMap.size} kept articles used` };
  const sig = `${st.size}:${st.mtimeMs}`;
  if (kept?.sig === sig) return { infoOf: of(keptMap), status: { articles: keptMap.size, read: false } };
  const found = new Map<string, [string, string, string, string]>();
  const head: { col?: Record<string, number> } = {};
  let rows = 0;
  try {
    await eachCsvRow(p, false, beat, (r) => {
      if (!head.col) { head.col = Object.fromEntries(r.map((h, i) => [h.replace(/^\uFEFF/, "").trim(), i])); return; }
      rows++;
      const c = head.col, a = artKey(r[c.ArticleNumber] ?? "");
      if (!a || !want.has(a)) return;
      const g = (r[c.MainGroupName] ?? "").trim(), t = (r[c.ArticleText] ?? "").trim();
      const x = found.get(a);
      if (!x) found.set(a, [t, g, (r[c.SubGroupName] ?? "").trim(), (r[c.ProductName] ?? "").trim()]);
      else if (!x[1] && g) found.set(a, [x[0] || t, g, (r[c.SubGroupName] ?? "").trim(), (r[c.ProductName] ?? "").trim()]);
      else if (!x[0] && t) x[0] = t;
    });
  }
  catch (e) { return { infoOf: of(keptMap), status: `${ARTICLE_FILE} not read: ${(e as Error)?.message ?? e} - the ${keptMap.size} kept articles used` }; }
  if (!head.col || !("ArticleNumber" in head.col) || !("MainGroupName" in head.col))
    return { infoOf: of(keptMap), status: `${ARTICLE_FILE} without ArticleNumber / MainGroupName - the ${keptMap.size} kept articles used` };
  // the kept names of articles this file no longer holds stay
  for (const [a, x] of keptMap) if (!found.has(a) && want.has(a)) found.set(a, x);
  await kvSet(KV_INFO, { sig, at: new Date().toISOString(), info: Object.fromEntries(found) } satisfies Kept);
  return { infoOf: of(found), status: { rows, asked: want.size, named: found.size, with_group: [...found.values()].filter((x) => x[1]).length, read: true, ...(fetched === null ? { fetched: true } : {}) } };
}
