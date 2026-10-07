// THE COMPANY-FACT STEPS' RULES, with no HubSpot in them - ported line for line
// from the Compass connector (service/mandant_sweep.py, company_stats.py,
// contact_shipment.py, 07.10.2026) so the hub decides every record the same
// way. tests/connectors-steps.test.ts holds them to it; the I/O is beside this.

import { pyRound } from "../../segmentation/engine";

/* ── mandant from the customer key ─────────────────────────────────────── */

/**
 * The mandant a customer key says: "110-815906" -> "M110". The key is the truth,
 * the picklist a copy. Null when the key has no numeric prefix - and, unlike the
 * connector, when the picklist has no such option (a 120- key would otherwise
 * fail its whole batch of 100).
 */
export function wantMandant(un: string | null | undefined, options?: Set<string>): string | null {
  const prefix = (un ?? "").trim().split("-")[0];
  if (!/^\d+$/.test(prefix)) return null;
  const want = `M${prefix}`;
  if (options && !options.has(want)) return null;
  return want;
}

/* ── order facts on the company ────────────────────────────────────────── */

export const ORDER_PIPELINE = "3687945443";
export const STAGE = { invoiced: "5093092552", creditNote: "5093087456", cancelled: "5676846286" } as const;
export const FACTS = ["order_first_order_date", "order_last_order_date", "order_last_shipment_date", "order_total_orders", "order_avg_days_between_orders"] as const;
export type Facts = Record<(typeof FACTS)[number], string | number | null>;
export type OrderLite = {
  order_order_number?: string | null; order_order_date?: string | null; order_shipment_date?: string | null;
  hs_pipeline?: string | null; hs_pipeline_stage?: string | null;
};
export type Baseline = { first?: string | null; last?: string | null; ship?: string | null; n?: number | string | null } | null;

/** A HubSpot date - "yyyy-mm-dd…" or epoch ms - as "yyyy-mm-dd". */
export function day(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v);
  if (/^\d+$/.test(s)) return new Date(Number(s)).toISOString().slice(0, 10);
  return s.slice(0, 10);
}

/** company_stats.compute: the five facts from all a company's orders plus its pre-2020 baseline. */
export function companyFacts(orders: OrderLite[], baseline: Baseline, today: string): Facts {
  const base = baseline ?? {};
  const bases = new Map<string, string | null>();
  let ship: string | null = base.ship ?? null;
  for (const p of orders) {
    if (p.hs_pipeline && p.hs_pipeline !== ORDER_PIPELINE) continue;
    const num = (p.order_order_number ?? "").trim();
    const st = p.hs_pipeline_stage ?? null;
    // no ERP number yet = a web order the ERP has not taken over; counted once linked
    if (!num || num.startsWith("G") || st === STAGE.creditNote || st === STAGE.cancelled) continue;
    const key = (num.match(/\./g) ?? []).length >= 2 ? num.slice(0, num.lastIndexOf(".")) : num;
    const d = day(p.order_order_date);
    if (d) {
      const have = bases.get(key);
      bases.set(key, have ? (d < have ? d : have) : d);
    } else if (!bases.has(key)) bases.set(key, null);
    const s = day(p.order_shipment_date);
    if (st === STAGE.invoiced && s && s <= today && (ship === null || s > ship)) ship = s;
  }
  const n = bases.size + Math.trunc(Number(base.n ?? 0) || 0);
  const dates = [...[...bases.values()].filter((d): d is string => !!d), ...[base.first, base.last].filter((d): d is string => !!d)];
  if (!n || !dates.length) return { order_first_order_date: null, order_last_order_date: null, order_last_shipment_date: null, order_total_orders: null, order_avg_days_between_orders: null };
  const first = dates.reduce((a, b) => (b < a ? b : a));
  const last = dates.reduce((a, b) => (b > a ? b : a));
  let avg: number | null = null;
  if (n > 1) {
    const span = Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000);
    avg = pyRound(span / (n - 1), 1);
  }
  return { order_first_order_date: first, order_last_order_date: last, order_last_shipment_date: ship, order_total_orders: n, order_avg_days_between_orders: avg };
}

/** company_stats._same: equal for the purpose of "does this need writing". */
export function sameValue(a: unknown, b: unknown): boolean {
  const empty = (x: unknown) => x === null || x === undefined || x === "";
  if (empty(a) && empty(b)) return true;
  const fa = Number(a), fb = Number(b);
  if (!empty(a) && !empty(b) && Number.isFinite(fa) && Number.isFinite(fb) && String(a).trim() !== "" && String(b).trim() !== "") {
    return Math.abs(fa - fb) < 0.05;
  }
  if (a && b && String(a).length >= 10 && String(b).length >= 10) return day(a) === day(b);
  return String(a ?? "None") === String(b ?? "None");
}

/** The facts that differ from what the company carries, as HubSpot property values ("" clears). */
export function factsDiff(current: Record<string, unknown>, want: Facts): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of FACTS) {
    const v = want[k];
    if (!sameValue(current[k], v)) out[k] = v === null ? "" : String(v);
  }
  return out;
}

/* ── last shipment date on the contact ─────────────────────────────────── */

/** "2026-07" -> every month from it to today's month, as [year, month]. */
export function monthsFrom(fromYm: string, today: string): [number, number][] {
  let y = Number(fromYm.slice(0, 4)), m = Number(fromYm.slice(5, 7));
  const ty = Number(today.slice(0, 4)), tm = Number(today.slice(5, 7));
  const out: [number, number][] = [];
  while (y < ty || (y === ty && m <= tm)) {
    out.push([y, m]);
    if (m === 12) { y += 1; m = 1; } else m += 1;
  }
  return out;
}

/** Each contact's latest shipment, from shipped documents and the contacts on them. */
export function latestShipment(shipped: Map<string, string>, contactsOf: Map<string, string[]>): { latest: Map<string, string>; noContact: number } {
  const latest = new Map<string, string>();
  let noContact = 0;
  for (const [oid, d] of shipped) {
    const cids = contactsOf.get(oid) ?? [];
    if (!cids.length) { noContact += 1; continue; }
    for (const c of cids) if (d > (latest.get(c) ?? "")) latest.set(c, d);
  }
  return { latest, noContact };
}
