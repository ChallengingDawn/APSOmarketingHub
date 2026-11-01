// ERP CUSTOMERS NOT IN HUBSPOT YET (SARCLA 01.11.2026: "on ERP we have the file also of the SAE so we can attribute them
// in the reports even if not in hubspot - when the connection is made in HS then link is established").
//
// The revenue step keeps the revenue of the customers no company carries yet - each live run, so a customer leaves as soon
// as a company carries its key and the run writes its revenue there. The sales agent step keeps the customer file's row of
// every key no company carries: the file brings a customer once, when it is new or changes, often before its first invoice,
// so the row is kept as it comes. The customers' cube reads both and counts each such customer as a company of its own,
// with the ERP's SAE, name and country, until HubSpot has it.

import { countryName, revenueProps, type CustomerYears } from "./revenueRules";
import { own, pyStrip } from "./filesRules";

/** The revenue step's customers no company carries, rewritten by each live run. */
export const ERP_ONLY_KEY = "connectors:hub:erp-only";
/** The customer file's rows of the keys no company carried when they came (sales agent step). */
export const ERP_INFO_KEY = "connectors:hub:erp-customer-info";
/** A list's id for such a customer - no HubSpot record to open. */
export const ERP_ONLY_ID = "erp:";
/** The rows kept at most, the oldest dropped first: the file brings about 300 keys no company carries per delivery. */
export const ERP_INFO_MAX = 25_000;

/** A customer's revenue as its company would carry it: rev_<year>_pc_monthly per year. */
export type ErpOnlyItem = { un: string; months: Record<string, string> };
export type ErpOnly = { at: string; items: ErpOnlyItem[] };
export type ErpInfo = { name: string; country: string | null; sae: string | null; channel: string | null; firstOrderYear: number | null; seen: string };
export type ErpInfoStore = { at: string; items: Record<string, ErpInfo> };

/** The customers of the rollup no company carries, each with its years' rev_<year>_pc_monthly. */
export function erpOnlyItems(agg: Map<string, CustomerYears>, uns: string[]): ErpOnlyItem[] {
  return uns.flatMap((un) => {
    const years = agg.get(un);
    if (!years) return [];
    const p = revenueProps(years, undefined, false);
    return [{ un, months: Object.fromEntries([...years.keys()].sort().map((y) => [String(y), String(p[`rev_${y}_pc_monthly`])])) }];
  });
}

export type InfoCols = { cnu: number; name: number | null; country: number | null; sae: number | null; channel: number | null; first: number | null };

/** The customer file's columns this keeps, by header name (the connector's names); null without CustomerNumberUnique. */
export function infoColumns(header: string[]): InfoCols | null {
  const i = new Map(header.map((h, k) => [h, k]));
  if (!i.has("CustomerNumberUnique")) return null;
  const at = (n: string) => i.get(n) ?? null;
  return { cnu: i.get("CustomerNumberUnique")!, name: at("CustomerName"), country: at("CountryST"), sae: at("SAE"), channel: at("Channel"), first: at("FirstOrderYear") };
}

/** One row -> [key, what the reports place the customer by]; null without a key. "Unknown" and the like count as empty. */
export function infoRow(r: string[], c: InfoCols, day: string): [string, ErpInfo] | null {
  const cell = (k: number | null) => {
    if (k === null || k >= r.length) return null;
    const v = own(pyStrip(r[k]));
    return v && !/^(unknown|n\/a|-|\.)$/i.test(v) ? v : null;
  };
  const un = cell(c.cnu);
  if (!un) return null;
  const code = cell(c.country);
  const year = Number(cell(c.first));
  return [un, {
    name: cell(c.name) ?? un,
    country: code ? countryName(code.toUpperCase()) : null,
    sae: cell(c.sae), channel: cell(c.channel),
    firstOrderYear: Number.isInteger(year) && year > 1900 ? year : null,
    seen: day,
  }];
}

/**
 * The kept rows after a customer file: its keys no company carries added (a field the new row leaves empty keeps what was
 * known), its keys a company carries dropped; beyond `max` the longest unseen go first.
 */
export function mergeInfo(prev: Record<string, ErpInfo>, rows: Map<string, ErpInfo>, carried: Set<string>, max = ERP_INFO_MAX): Record<string, ErpInfo> {
  const out: Record<string, ErpInfo> = {};
  for (const [un, e] of Object.entries(prev)) if (!carried.has(un)) out[un] = e;
  for (const [un, e] of rows) {
    if (carried.has(un)) { delete out[un]; continue; }
    const p = out[un];
    out[un] = p ? {
      ...e, name: e.name !== un ? e.name : p.name, country: e.country ?? p.country, sae: e.sae ?? p.sae,
      channel: e.channel ?? p.channel, firstOrderYear: e.firstOrderYear ?? p.firstOrderYear,
    } : e;
  }
  const keys = Object.keys(out);
  if (keys.length > max) for (const k of keys.sort((a, b) => out[a].seen.localeCompare(out[b].seen)).slice(0, keys.length - max)) delete out[k];
  return out;
}

/** The properties the customers' cube reads such a customer with, as its company would carry them. */
export function erpOnlyProps(item: ErpOnlyItem, info: ErpInfo | undefined): Record<string, string | null> {
  return {
    name: info?.name ?? item.un,
    mandant: item.un.startsWith("110-") ? "M110" : item.un.startsWith("100-") ? "M100" : null,
    country_custom: info?.country ?? null,
    sae_performis: info?.sae ?? null,
    ...Object.fromEntries(Object.entries(item.months).map(([y, v]) => [`rev_${y}_pc_monthly`, v])),
  };
}

/** Any revenue in a year before `year` - the rollup's years only. */
export function revenueBefore(item: ErpOnlyItem, year: number): boolean {
  return Object.entries(item.months).some(([y, blob]) => {
    if (Number(y) >= year) return false;
    try {
      return Object.values(JSON.parse(blob) as Record<string, Record<string, number>>).some((pcs) => Object.values(pcs).some((v) => v > 0));
    } catch { return false; }
  });
}

/**
 * Whether such a customer can be new in the three years from `firstYear`, as a company is (customers.ts): not with a first
 * order from 2015 to before them in the ERP, nor with revenue before them.
 */
export function canBeNew(item: ErpOnlyItem, info: ErpInfo | undefined, firstYear: number): boolean {
  const y = info?.firstOrderYear ?? null;
  if (y !== null && y >= 2015 && y < firstYear) return false;
  return !revenueBefore(item, firstYear);
}
