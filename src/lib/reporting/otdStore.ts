// OTD Reports' figures, kept (rules in ./otdRules.ts). Two sources, each its own kv entry:
// - "erp": the morning workbook's order lines (the same sheet as the Back Office's KPIs), every run of the chain's ERP
//   revenue step - the date at the customer from the shipment and the ERP's transport time;
// - "file": the OTD analysis file's lines (otd_history.csv, made once from its "Data Input" sheet and dropped with the
//   morning files), read again only when the file changes - the months before the morning lines begin, the planned flag,
//   the product groups and the customers' comments.
// Read by /api/reporting/otd as one cube (mergeCubes: the morning lines' months first).

import { promises as fs } from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { kvGet, kvSet } from "@/lib/db/init";
import {
  buildOtdCube, DATES_FILE, fromErpLines, HISTORY_FILE, mergeCubes, otdMainOf, parseDates, parseHistory, parseTransport, TRANSPORT_FILE,
  type OtdCube, type OtdMain,
} from "./otdRules";
import { transitOf, type ErpLine } from "./boErpLines";
import { zurichToday } from "./boDeliveryStore";
import { buildLineStore, type ArtInfo, type LineStore } from "./otdLines";

export const KV_OTD_ERP = "otd:cube:erp";
export const KV_OTD_FILE = "otd:cube:file";
/** the Back Office's share (otdMainOf), a few KB - kept apart so its page never reads the cubes */
export const KV_OTD_MAIN = "otd:main";
const KV_OTD_FILE_SEEN = "otd:history:seen";
/** each customer's transport days (otd_transport.csv) and the ERP's dates of the OTD analysis file (otd_dates.csv), kept so
 *  a run without the files - the first after a deploy - has them */
const KV_OTD_TRANSPORT = "otd:transport";
const KV_OTD_DATES = "otd:dates";
type Kept<V> = { sig: string; at: string; days: Record<string, V> };

export type OtdErpContext = {
  supplierOf?: (article: string) => string | undefined;
  /** article -> [planned "J"/"N", replenishment days] (the articles sheet's ConsumptionDriven, ReplenishmentDays) */
  planningOf?: (article: string) => [string, number] | undefined;
  /** customer -> its company's name and owner in HubSpot - asked for the customers kept only */
  customerOf?: (customer: string) => { name?: string; owner?: string };
  /** customer -> its transport days in the ERP (otdTransport) */
  customerDaysOf?: (customer: string) => number | undefined;
  /** lineKey -> the ERP's date at the customer from the OTD analysis file (otdDates) */
  fileDateOf?: (key: string) => string | undefined;
  /** article -> its text and groups from the nightly article master (otdArticles.ts) */
  infoOf?: (article: string) => ArtInfo | undefined;
  /** an order of DirectCut -> "L" a leftover off the shelf, "C" cut on the saw */
  glcOf?: (order: string) => "L" | "C" | undefined;
};

/** every line of the cube one by one, for OTD Reports > Customers (otdLines.ts): gzipped JSON in one kv entry */
export const KV_OTD_LINES = "otd:lines";
type LinesKept = { at: string; gz: string };
let linesCache: { at: string; store: LineStore } | null = null;
/** the lines kept - decoded once per morning run, then from memory */
export async function otdLinesNow(): Promise<LineStore | null> {
  const k = await kvGet<LinesKept>(KV_OTD_LINES).catch(() => null);
  if (!k?.gz) return null;
  if (linesCache?.at === k.at) return linesCache.store;
  const store = JSON.parse(gunzipSync(Buffer.from(k.gz, "base64")).toString("utf8")) as LineStore;
  linesCache = { at: k.at, store };
  return store;
}

/** the morning lines -> the "erp" cube; nothing kept when no line qualifies */
export async function saveOtdFromErp(lines: ErpLine[], ctx: OtdErpContext = {}): Promise<Record<string, unknown>> {
  const { lines: otd, skipped, exactDays, dated } = fromErpLines(lines, transitOf, ctx.supplierOf, ctx.planningOf, ctx.customerDaysOf, ctx.fileDateOf,
    ctx.infoOf ? (a) => ctx.infoOf!(a)?.g : undefined, ctx.glcOf);
  const k = buildOtdCube(otd, "erp", zurichToday());
  k.dated = dated;
  for (const [w, n] of Object.entries(skipped)) k.skipped[w] = (k.skipped[w] ?? 0) + n;
  for (const c of k.customers ?? []) {
    const x = ctx.customerOf?.(c.c);
    if (x?.name) c.name = x.name;
    if (x?.owner) c.owner = x.owner;
  }
  if (k.lines) { await kvSet(KV_OTD_ERP, k); await saveMain(); }
  // every line one by one, for OTD Reports > Customers - never the cube's problem
  let lineStore: Record<string, unknown> | string = "no line";
  if (k.lines) {
    try {
      const store = buildLineStore(otd, zurichToday(), { namesOf: ctx.customerOf, infoOf: ctx.infoOf, glcOf: ctx.glcOf });
      const gz = gzipSync(Buffer.from(JSON.stringify(store), "utf8")).toString("base64");
      await kvSet(KV_OTD_LINES, { at: store.at, gz } satisfies LinesKept);
      lineStore = { lines: store.rows.length, customers: store.cust.length, named: Object.keys(store.names).length, articles: store.art.length,
        with_text: Object.keys(store.info).length, groups: store.grp.length, leftover: store.rows.filter((r) => r[11] === 1).length,
        cut_to_size: store.rows.filter((r) => r[11] === 2).length, kb: Math.round(gz.length / 1024) };
    }
    catch (e) { lineStore = `not kept: ${(e as Error)?.message ?? e}`; }
  }
  return { lines: k.lines, first: k.first, last: k.last, skipped: k.skipped, suppliers: k.suppliers.length, kept: k.lines > 0, line_store: lineStore,
    with_group: otd.filter((l) => l.group).length,
    erp_date_at_customer: exactDays, dated, planned_known: otd.filter((l) => l.planned).length, wish_dates: otd.filter((l) => l.wishDay).length,
    customers_kept: k.customers?.length ?? 0, customers_named: (k.customers ?? []).filter((c) => c.name).length };
}

/** otd_history.csv beside the morning workbook -> the "file" cube, once per version of the file (its size and time) */
export async function loadOtdHistory(dir: string): Promise<Record<string, unknown> | string> {
  const p = path.join(dir, HISTORY_FILE);
  const st = await fs.stat(p).catch(() => null);
  if (!st) return "no history file";
  const sig = `${st.size}:${st.mtimeMs}`;
  if ((await kvGet<string>(KV_OTD_FILE_SEEN).catch(() => null)) === sig) return "history already read";
  const k = buildOtdCube(parseHistory(await fs.readFile(p, "utf8")), "file", zurichToday());
  if (!k.lines) return "history file without a line";
  await kvSet(KV_OTD_FILE, k);
  await kvSet(KV_OTD_FILE_SEEN, sig);
  await saveMain();
  return { lines: k.lines, first: k.first, last: k.last, skipped: k.skipped, kept: true };
}

/** a table dropped beside the morning workbook -> its rows; read again only when the file changes, kept, so the runs without
 *  it still have them - and a file that cannot be read never undoes the kept rows (every month's figures would move) */
async function keptTable<V>(dir: string, file: string, key: string, parse: (text: string) => { days: Map<string, V>; rejected: number },
  without: string): Promise<{ days?: Map<string, V>; status: Record<string, unknown> | string }> {
  const p = path.join(dir, file);
  const st = await fs.stat(p).catch(() => null);
  const kept = await kvGet<Kept<V>>(key).catch(() => null);
  const keptDays = kept?.days ? new Map(Object.entries(kept.days)) : undefined;
  const fallback = (why: string) => ({ days: keptDays, status: `${why} - ${keptDays ? `the ${keptDays.size} kept rows used` : without}` });
  if (st) {
    const sig = `${st.size}:${st.mtimeMs}`;
    if (kept?.sig !== sig) {
      let read: { days: Map<string, V>; rejected: number };
      try { read = parse(await fs.readFile(p, "utf8")); }
      catch (e) { return fallback(`${file} not read: ${(e as Error)?.message ?? e}`); }
      if (!read.days.size) return fallback(`${file} without a row (${read.rejected} refused)`);
      await kvSet(key, { sig, at: new Date().toISOString(), days: Object.fromEntries(read.days) } satisfies Kept<V>);
      return { days: read.days, status: { rows: read.days.size, rejected: read.rejected, read: true } };
    }
  }
  return keptDays ? { days: keptDays, status: { rows: keptDays.size, read: false, since: kept!.at } } : { status: `no ${file}` };
}
/** otd_transport.csv -> each customer's transport days */
export const otdTransport = (dir: string) => keptTable(dir, TRANSPORT_FILE, KV_OTD_TRANSPORT, parseTransport, "the country's times used");
/** otd_dates.csv -> the ERP's dates of the OTD analysis file, by lineKey */
export const otdDates = (dir: string) => keptTable(dir, DATES_FILE, KV_OTD_DATES, parseDates, "the transport times used");

async function saveMain() {
  const main = otdMainOf(await otdNow());
  if (main) await kvSet(KV_OTD_MAIN, main);
}
export const otdMainNow = () => kvGet<OtdMain>(KV_OTD_MAIN).catch(() => null);

/** the two as one, for the pages */
export async function otdNow(): Promise<OtdCube | null> {
  const [erp, file] = await Promise.all([kvGet<OtdCube>(KV_OTD_ERP).catch(() => null), kvGet<OtdCube>(KV_OTD_FILE).catch(() => null)]);
  return mergeCubes(erp ?? null, file ?? null);
}
